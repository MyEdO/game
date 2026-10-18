#!/usr/bin/env node
// LANCEUR DES TESTS `node --test` D'UNE GATE (#1759) :
//   node scripts/test/node-tests.mjs <gate> [drapeaux de `node --test`…] [--reacquerir-memoire]
// Les arguments supplémentaires vont à `node --test` AVANT les fichiers (`--test-name-pattern=…`,
// `--test-concurrency=…`…) : un lanceur qui les avalerait rendrait le filtrage d'un cas impossible.
//
// La liste des fichiers vient de `scripts/gates/testsParGate.mjs` — la table qui répartit les tests
// `scripts/**` par RÉPERTOIRE — et de nulle part ailleurs : ni d'un nom recopié dans `package.json`,
// ni d'un glob que le shell expanserait différemment selon la plateforme. Un seul chemin de code,
// donc une seule vérité sur « quels tests joue cette gate ».
//
// Et la couverture se juge AVANT de lancer : un test orphelin (aucune racine) ou revendiqué par deux
// gates ne doit pas être découvert APRÈS coup, par un vert qui ne prouve rien.
//
// Le lancement prend le verrou machine des gestes lourds (`verrouGestesLourds.mjs`, #2603), ou l'emprunte
// par le jeton de son appelant, puis part sous `lancerNodeMesure` (`memoire.mjs`), supervisé.
//
// Les DURÉES par fichier (#2497) : le reporter `dureesNodeTest.mjs` écrit sous `os.tmpdir()`, puis la ligne
// `[durees] node <gate> {json}` (`ligneDeDurees`) les imprime au journal, lu par `scripts/test/dureesCi.mjs`.
import { lancerProcessusSupervise } from '../guards/lib/superviserProcessus.mjs'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { GATES, RACINES, couverture, listerTests, testsDe } from '../gates/testsParGate.mjs'
import { prendreVerrouAsync } from './verrou.mjs'
import { verrouGestesLourds } from './verrouGestesLourds.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { lancerNodeMesure } from './memoire.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Le reporter `node --test` des durées par fichier. */
const REPORTER_DUREES = pathToFileURL(join(RACINE, 'scripts/test/dureesNodeTest.mjs')).href

/** Le reporter par défaut de `node --test` en version `versionNode` : `spec` dès node 23 (nodejs/node#54548) ;
 *  avant, `spec` sous un terminal (`tty`), `tap` hors terminal (node v22, `internal/test_runner/utils`
 *  `kDefaultReporter`). PURE. */
export const reporterParDefaut = (versionNode, tty) => Number(versionNode.split('.')[0]) >= 23 || tty ? 'spec' : 'tap'

/**
 * Les arguments de reporter d'un lancement : la sortie de l'appelant gardée — son `--test-reporter` s'il en passe un
 * (seul et sans destination : `stdout`), sinon celle de `node --test` par défaut sous la version qui tourne
 * (`reporterParDefaut`) —, puis le reporter des durées vers `sortie`. PURE.
 * @param {string[]} drapeaux @param {{ tty: boolean, sortie: string, versionNode?: string }} p
 */
export function reportersDuLancement(drapeaux, { tty, sortie, versionNode = process.versions.node }) {
  const compte = (nom) => drapeaux.filter((d) => d === nom || d.startsWith(`${nom}=`)).length
  const reporters = compte('--test-reporter')
  const sortieDeLAppelant = reporters
    ? (reporters === 1 && compte('--test-reporter-destination') === 0 ? ['--test-reporter-destination=stdout'] : [])
    : [`--test-reporter=${reporterParDefaut(versionNode, tty)}`, '--test-reporter-destination=stdout']
  return [...sortieDeLAppelant, `--test-reporter=${REPORTER_DUREES}`, `--test-reporter-destination=${sortie}`]
}

/** La ligne `[durees] node <gate> {json}` des durées `{ [chemin absolu]: ms }`, chemins relatifs POSIX à `racine`,
 *  ms arrondies. PURE. */
export const ligneDeDurees = (gate, durees, racine) =>
  `[durees] node ${gate} ${JSON.stringify(Object.fromEntries(Object.entries(durees).map(([f, ms]) => [relative(racine, f).split(sep).join('/'), Math.round(ms)])))}`

/** Le rapport des durées `sortie`, `null` s'il est absent (le reporter n'a rien rendu) ; illisible, LÈVE avec `{ cause }`. */
function dureesDe(sortie) {
  try {
    return JSON.parse(readFileSync(sortie, 'utf8'))
  } catch (cause) {
    if (/** @type {any} */ (cause)?.code === 'ENOENT') return null
    throw new Error(`rapport des durées ${sortie} illisible`, { cause })
  }
}

/**
 * Lance `node --test` sur les `tests` de la gate `gate` depuis `racine` (`reportersDuLancement`), sous le verrou
 * `verrou` (par défaut `verrouGestesLourds(racine)`) pris par `prendreVerrouAsync` avec `env` (le jeton d'un
 * appelant s'y emprunte) et `signal` : refusé, il imprime le refus et rend `CODE_DIFFERE`. Pris, `executer` (`lancerNodeMesure`)
 * joue l'enfant supervisé par `superviser`, l'env augmenté du jeton de la prise, sous les `mesures` mémoire
 * (`forcer` les réacquiert). Imprime la ligne des durées (`ligneDeDurees`) si le reporter en a rendu. Le dossier
 * temporaire (sous `temporaire`) et le verrou ne se rendent que sur un arrêt prouvé `mort`. Rend le code de sortie ;
 * un rapport des durées illisible LÈVE (`dureesDe`).
 * @param {{ gate: string, tests: string[], drapeaux?: string[], racine?: string, temporaire?: string, tty?: boolean,
 *   superviser?: typeof lancerProcessusSupervise, imprimer?: (ligne: string) => void, env?: NodeJS.ProcessEnv,
 *   verrou?: Pick<Parameters<typeof prendreVerrouAsync>[0], 'chemin' | 'libelle' | 'attente' | 'identite'>, signal?: AbortSignal,
 *   mesures?: Parameters<typeof lancerNodeMesure>[0]['mesures'], forcer?: boolean, executer?: typeof lancerNodeMesure }} p
 */
export async function lancerGate({ gate, tests, drapeaux = [], racine = RACINE, temporaire = tmpdir(), tty = process.stdout.isTTY === true, superviser = lancerProcessusSupervise, imprimer = console.log, env = process.env, verrou, signal, mesures, forcer = false, executer = lancerNodeMesure }) {
  const prise = await prendreVerrouAsync({ ...(verrou ?? verrouGestesLourds(racine)), env, signal, cwd: racine, commande: 'node-tests ' + gate })
  if (prise.etat !== 'pris') { imprimer(prise.message); return CODE_DIFFERE }
  let retraitPermis = true
  const dossier = mkdtempSync(join(temporaire, 'durees-node-'))
  try {
    const sortie = join(dossier, 'durees.json')
    const resultat = await executer({ racine, fichiers: tests, argv: ['--test', ...drapeaux, ...reportersDuLancement(drapeaux, { tty, sortie })],
      env: { ...env, ...prise.env }, signal, mesures, forcer, superviser, journal: imprimer })
    retraitPermis = resultat.arret?.etat === 'mort'
    const lu = dureesDe(sortie)
    if (lu?.durees) imprimer(ligneDeDurees(gate, lu.durees, racine))
    return resultat.code
  } finally {
    if (retraitPermis) {
      rmSync(dossier, { recursive: true, force: true })
      prise.liberer()
    }
  }
}

/**
 * L'ENTRÉE de la CLI sur `argv` (`<gate> [drapeaux…] [--reacquerir-memoire]`) : usage, couverture des tests de
 * `lister`, puis `lancer` (`lancerGate`). REND le code de sortie : 2 sur un usage, une répartition ou une gate vide
 * fautifs, et sur toute erreur levée, imprimée par `journal` préfixée `[node-tests]`, sa cause comprise (#2586).
 * @param {string[]} argv
 * @param {{ lancer?: typeof lancerGate, lister?: () => string[], journal?: (ligne: string) => void }} [p]
 */
export async function entree(argv, { lancer = lancerGate, lister = () => listerTests(RACINE), journal = console.error } = {}) {
  const gate = argv[0]
  const forcer = argv.includes('--reacquerir-memoire')
  const drapeaux = argv.slice(1).filter((a) => a !== '--reacquerir-memoire')
  if (!gate || !GATES.includes(gate)) {
    journal(
      '[tests] usage : node scripts/test/node-tests.mjs <gate> [drapeaux de `node --test`…] — ' +
        `gates connues : ${GATES.join(', ')}${gate ? ` (reçu « ${gate} »)` : ''}`,
    )
    return 2
  }
  try {
    const { orphelins, doublons } = couverture(lister)
    if (orphelins.length || doublons.length) {
      journal(
        `[tests] répartition incomplète — rien n'est lancé.\n` +
          orphelins.map((t) => `  orphelin (aucune gate ne le joue) : ${t}`).join('\n') +
          (orphelins.length && doublons.length ? '\n' : '') +
          doublons.map((d) => `  doublon (${d.gates.join(' + ')}) : ${d.test}`).join('\n') +
          '\n  remède : donne son répertoire à UNE gate dans scripts/gates/testsParGate.mjs',
      )
      return 2
    }
    const tests = testsDe(gate, lister)
    if (!tests.length) {
      journal(`[tests] ${gate} : aucun test sous ses racines (${RACINES[gate].join(', ')}) — table ou arbre à revoir`)
      return 2
    }
    return await lancer({ gate, tests, drapeaux, forcer })
  } catch (erreur) {
    const e = /** @type {any} */ (erreur)
    journal(`[node-tests] ${e?.message ?? String(e)}`)
    if (e?.cause !== undefined) journal(`[node-tests] cause : ${e.cause?.message ?? String(e.cause)}`)
    return 2
  }
}

if (import.meta.main) process.exitCode = await entree(process.argv.slice(2))
