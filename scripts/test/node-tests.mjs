#!/usr/bin/env node
// LANCEUR DES TESTS `node --test` D'UNE GATE (#1759) :
//   node scripts/test/node-tests.mjs <gate> [drapeaux de `node --test`…]
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
// Les DURÉES par fichier (#2497) : le reporter `dureesNodeTest.mjs` écrit sous `os.tmpdir()`, puis la ligne
// `[durees] node <gate> {json}` (`ligneDeDurees`) les imprime au journal, lu par `scripts/test/dureesCi.mjs`.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { GATES, RACINES, couverture, listerTests, testsDe } from '../gates/testsParGate.mjs'
import { codeEnfant } from './partition.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Le reporter `node --test` des durées par fichier. */
const REPORTER_DUREES = pathToFileURL(join(RACINE, 'scripts/test/dureesNodeTest.mjs')).href

/**
 * Les arguments de reporter d'un lancement : la sortie de l'appelant gardée — son `--test-reporter` s'il en passe un
 * (seul et sans destination : `stdout`), sinon celle de `node --test` par défaut, `spec` sous un terminal (`tty`),
 * `tap` hors terminal —, puis le reporter des durées vers `sortie`. PURE.
 * @param {string[]} drapeaux @param {{ tty: boolean, sortie: string }} p
 */
export function reportersDuLancement(drapeaux, { tty, sortie }) {
  const compte = (nom) => drapeaux.filter((d) => d === nom || d.startsWith(`${nom}=`)).length
  const reporters = compte('--test-reporter')
  const sortieDeLAppelant = reporters
    ? (reporters === 1 && compte('--test-reporter-destination') === 0 ? ['--test-reporter-destination=stdout'] : [])
    : [`--test-reporter=${tty ? 'spec' : 'tap'}`, '--test-reporter-destination=stdout']
  return [...sortieDeLAppelant, `--test-reporter=${REPORTER_DUREES}`, `--test-reporter-destination=${sortie}`]
}

/** La ligne `[durees] node <gate> {json}` des durées `{ [chemin absolu]: ms }`, chemins relatifs POSIX à `racine`,
 *  ms arrondies. PURE. */
export const ligneDeDurees = (gate, durees, racine) =>
  `[durees] node ${gate} ${JSON.stringify(Object.fromEntries(Object.entries(durees).map(([f, ms]) => [relative(racine, f).split(sep).join('/'), Math.round(ms)])))}`

/**
 * Lance `node --test` sur les `tests` de la gate `gate` depuis `racine` (`reportersDuLancement`), imprime la ligne de
 * ses durées (`ligneDeDurees`) si le reporter en a rendu, efface son dossier temporaire (sous `temporaire`) et rend le code
 * de sortie.
 * @param {{ gate: string, tests: string[], drapeaux?: string[], racine?: string, temporaire?: string, tty?: boolean, spawn?: typeof spawnSync, imprimer?: (ligne: string) => void }} p
 */
export function lancerGate({ gate, tests, drapeaux = [], racine = RACINE, temporaire = tmpdir(), tty = process.stdout.isTTY === true, spawn = spawnSync, imprimer = console.log }) {
  const dossier = mkdtempSync(join(temporaire, 'durees-node-'))
  try {
    const sortie = join(dossier, 'durees.json')
    const { status, signal } = spawn(process.execPath, ['--test', ...drapeaux, ...reportersDuLancement(drapeaux, { tty, sortie }), ...tests], {
      cwd: racine,
      stdio: 'inherit',
    })
    let durees = null
    try { durees = JSON.parse(readFileSync(sortie, 'utf8')) } catch { durees = null }
    if (durees) imprimer(ligneDeDurees(gate, durees, racine))
    return codeEnfant(status, signal)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const gate = process.argv[2]
  const drapeaux = process.argv.slice(3)
  if (!gate || !GATES.includes(gate)) {
    console.error(
      '[tests] usage : node scripts/test/node-tests.mjs <gate> [drapeaux de `node --test`…] — ' +
        `gates connues : ${GATES.join(', ')}${gate ? ` (reçu « ${gate} »)` : ''}`,
    )
    process.exit(2)
  }

  const lister = () => listerTests(RACINE)
  const { orphelins, doublons } = couverture(lister)
  if (orphelins.length || doublons.length) {
    console.error(
      `[tests] répartition incomplète — rien n'est lancé.\n` +
        orphelins.map((t) => `  orphelin (aucune gate ne le joue) : ${t}`).join('\n') +
        (orphelins.length && doublons.length ? '\n' : '') +
        doublons.map((d) => `  doublon (${d.gates.join(' + ')}) : ${d.test}`).join('\n') +
        '\n  remède : donne son répertoire à UNE gate dans scripts/gates/testsParGate.mjs',
    )
    process.exit(2)
  }

  const tests = testsDe(gate, lister)
  if (!tests.length) {
    console.error(`[tests] ${gate} : aucun test sous ses racines (${RACINES[gate].join(', ')}) — table ou arbre à revoir`)
    process.exit(2)
  }

  process.exit(lancerGate({ gate, tests, drapeaux }))
}
