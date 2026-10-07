// #2436 ; verbatims utilisateur du 2026-09-17 et du 2026-10-06.
// Garde PreToolUse : les gates de ECRIT_LU sont refusées à tous les appelants des canaux shell.
// POURQUOI — verbatims utilisateur du 2026-09-15 :
//   « C'est absurde ... on a dépêché un agent pour créer un fichier (+ son test, + le lien pour
//     l'appeler) et ça va nous prendre 25 min ? »
//   « La mémoire c'est cool mais ça n'empêche pas de réitérer la même erreur plus tard »
// Mesuré sur #1768 : ~12 min de code + test verts, puis ~13 min de gates (lint, knip, docs:check,
// test:ops) imposées au codeur par son BRIEF. Le run CI de la branche les joue TOUTES, UNE fois, sur
// la tête poussée (`.github/workflows/ci.yml`, #1776) : les payer aussi en local, par agent, c'est
// les payer deux fois. `.claude/agents/codeur.md` le disait déjà — une consigne, pas un verrou : le
// brief l'a écrasée. D'où ce hook, qui refuse le geste au lieu de le déconseiller.
//
// Les gates sont déclarées UNE fois dans le dépôt (`ECRIT_LU` de `scripts/gates/toutes.mjs`, dont
// les clés sont des noms de scripts npm) et ce hook les LIT : ajouter une gate = une ligne dans
// `ci.yml` et une dans `ECRIT_LU`, zéro ligne ici (#1750 : « un geste du régime qu'une session doit
// encore savoir par cœur est un défaut d'outillage »).
//
// Ce que la garde ne LIT pas :
// - la commande qui suit un commentaire `#` porteur d'une apostrophe, sous PowerShell : l'apostrophe ouvre une quote (#2172) ;
// - la sous-expression `$x = ( … )` (#2172) ;
// - le contenu d'un script lancé par son chemin (`bash f.sh`), fût-il écrit par un heredoc de la même commande (#2172).
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { APPEL_VITEST, appelDe, appelleTscNu, appelleVitestNu, LECTEURS } from '../guards/lib/appelsRunners.mjs'
import {
  CHANGEMENTS_DE_REPERTOIRE, REFUS_SATURE, basenameExecutable, jetonNu, nouveauBudget, pipelinesDeJetons, sansRedirections,
} from './solde-ticket-guard.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { fileURLToPath } from 'node:url'
import { resolve, isAbsolute } from 'node:path'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'
import { contexteSonde, estSondeVitest } from '../guards/lib/sondeVitest.mjs'
import { demandeDe } from '../gates/sur-demande-utilisateur.mjs'

/**
 * `npm test` est la suite ENTIÈRE sous son nom npm canonique — une gate même si la liste ne la
 * nomme pas —, ET le seul script de gate qui porte aussi une forme de PÉRIMÈTRE :
 * `npm test -- <chemins>` est le lanceur RESTREINT que le dépôt recommande (capture en fichier +
 * bornes de charge). Sans chemin, c'est la suite entière, donc la gate.
 */
const SUITE_ENTIERE_NPM = new Set(['test'])

/** Dossiers dont l'analyse entière EST la gate (par opposition à une liste de fichiers). */
const CIBLES_DE_GATE = new Set(['.', 'src', 'scripts', 'server', 'docs'])

/** Sous-commandes de `npm` qui nomment leur script, et raccourcis qui portent leur nom pour nom. */
const SOUS_COMMANDES_RUN = new Set(['run', 'run-script'])
const RACCOURCIS_NPM = new Set(['test', 'start', 'stop', 'restart'])
const APPEL_KNIP = appelDe('knip')
const APPEL_ESLINT = appelDe('eslint')
/** Le lanceur d'une gate entière : `node scripts/gates/…`, `node scripts/test/node-tests.mjs <gate>`. */
const LANCEUR_DE_GATE = /^node\s+(?:\S*[\\/])?scripts[\\/]gates[\\/]/
const LANCEUR_NODE_TESTS = /^node\s+(?:\S*[\\/])?scripts[\\/]test[\\/]node-tests\.mjs(?=\s|$)/

// Le sous-projet `server/` a son propre tsconfig et ses propres scripts : le train de la racine n'y répond pas.
// Les deux façons d'y entrer n'ont PAS la même portée. `cd server` change le répertoire de SON shell (`shell` des
// segments de `pipelinesDeJetons`) : ce qui le suit dans ce shell, et dans les shells qu'il lance, est dans le
// sous-projet ; un sous-shell `( … )` ou un membre de tube est un shell enfant, son `cd` ne remonte pas. Tout autre
// changement de répertoire (`CHANGEMENTS_DE_REPERTOIRE`, ou un `cd` vers une cible non littérale) ramène la portée à
// la RACINE, et un appel dont un argument remonte d'un cran (`REMONTE_RE`) s'y juge. `--prefix server` ne vaut que pour l'appel npm qui le porte : le segment suivant est à la RACINE.
const EST_SERVER = /(?:^|[\\/])server[\\/]?$/
const PREFIX_SERVER = /--prefix\s+server\b/
/** Un composant de chemin `..` (`--root ..`, `--prefix=..`, `-p ../tsconfig.json`) : l'appel vise un lieu hors de
 *  `server/`, il se juge à la RACINE (arbitrage d'ingénierie de l'orchestrateur, 2026-10-05). */
const REMONTE_RE = /(?:^|[\\/=])\.\.(?:[\\/]|$)/
/** Cible de `cd` écrite en toutes lettres : ni variable, ni substitution, ni `~`, ni joker. */
const CIBLE_LITTERALE_RE = /^[^$%`~*?[\]]+$/

/** `true` si ce `cd` (ses jetons, redirections retirées) entre dans `server/` par une cible littérale. */
const entreDansServer = ([exe, cible, ...reste]) =>
  basenameExecutable(exe.text) === 'cd' && reste.length === 0 && cible !== undefined && jetonNu(cible) &&
  !cible.substitutions?.length && cible.text !== '-' && CIBLE_LITTERALE_RE.test(cible.text) && EST_SERVER.test(cible.text)

/** Drapeaux qui CONSOMMENT le mot suivant : sa valeur n'est pas un chemin. */
const DRAPEAUX_A_VALEUR = new Set(['-t', '--testNamePattern', '--reporter', '--project', '--config', '-c', '--root', '--dir', '--workspace'])

/**
 * Arguments POSITIONNELS d'un segment, l'exécutable et les drapeaux (avec leur valeur) retirés.
 * @param {string} segment
 * @param {RegExp} appel motif de l'exécutable, à retirer en tête
 * @returns {string[]}
 */
function argumentsPositionnels(segment, appel) {
  const mots = segment.replace(appel, '').trim().split(/\s+/).filter(Boolean)
  const positionnels = []
  for (let i = 0; i < mots.length; i += 1) {
    const mot = mots[i]
    if (mot.startsWith('-')) {
      if (DRAPEAUX_A_VALEUR.has(mot)) i += 1
      continue
    }
    positionnels.push(mot)
  }
  return positionnels
}

/** `true` si ce mot est un dossier dont l'analyse ENTIÈRE est la gate (slash final indifférent). */
const estCibleDeGate = (mot) => CIBLES_DE_GATE.has(mot.replace(/[\\/]+$/, ''))

/** `true` si ce mot DÉSIGNE un chemin de fichier ou de sous-dossier (≠ un dossier-gate, ≠ un motif). */
const designeUnChemin = (mot) =>
  !estCibleDeGate(mot) && (/[\\/]/.test(mot) || /\.(?:ts|tsx|mts|mjs|cjs|js|jsx|json)$/.test(mot))

/**
 * Nom du script npm qu'un segment lance (`npm run <x>`, `npm <raccourci>`), ou `null`. Le segment
 * arrive TOKENISÉ par le socle : l'exécutable se juge sur son basename (`npm.cmd`, `& npm`) et les
 * drapeaux propres à npm (`--silent`, `-s`) se sautent aux deux crans, comme npm lui-même le fait.
 * @param {string[]} tokens
 * @returns {string|null}
 */
function nomScriptNpm(tokens) {
  const debut = tokens[0] === '&' ? 1 : 0
  if (basenameExecutable(tokens[debut] ?? '') !== 'npm') return null
  const apresFlags = (i) => {
    while (tokens[i] !== undefined && tokens[i].startsWith('-') && tokens[i] !== '--') i += tokens[i] === '--prefix' ? 2 : 1
    return i
  }
  const iSub = apresFlags(debut + 1)
  const sub = tokens[iSub]
  if (SOUS_COMMANDES_RUN.has(sub)) return tokens[apresFlags(iSub + 1)] ?? null
  return RACCOURCIS_NPM.has(sub) ? sub : null
}

/** Noms de scripts npm que la CI joue, tirés de la table `ECRIT_LU` du dépôt. */
export const gatesDeLaCi = (ecritLu = ECRIT_LU) =>
  Object.keys(ecritLu)

/**
 * Le GESTE à nommer dans le refus : le segment fautif quand il figure tel quel dans la commande,
 * sinon la commande entière — un segment issu d'une RÉSOLUTION (`npm run gates` → le corps lu dans
 * `package.json`) ou d'un déballage d'enrobeur ne se retrouve pas dans ce que le codeur a tapé.
 * @param {string} segment
 * @param {string} commande
 * @returns {string}
 */
const gesteNomme = (segment, commande) => (commande.includes(segment) ? segment : commande.trim())

/**
 * La raison du refus, en une phrase : ce qui est refusé, qui le porte, et ce que l'appelant joue
 * à la place — y compris le geste à faire quand c'est un BRIEF qui impose la gate.
 * @param {string} geste la commande refusée, telle qu'écrite
 * @returns {string}
 */
const raisonDuRefus = (geste) =>
  `[gates-ci] « ${geste} » est une gate de la CI : pousser la branche, puis \`gh run watch\` ` +
  `ou \`gh run view --log-failed\`. Avant de rendre ou de committer : \`npm run test:perimetre\` (après ` +
  `\`npm run typecheck:fast\` si du \`.ts\` bouge) ; pendant l'itération, \`node --test <fichier>\` et ` +
  `\`npm test -- <chemins>\` restent admis. Un brief qui impose une gate de la CI se refuse : ` +
  `« BRIEF REFUSÉ : gates hors périmètre ». Une sonde dont la configuration ne peut être vérifiée exige un filtre de fichier explicite.`

/**
 * Décision PURE du hook.
 * @param {{ commande?: string, gates?: string[], options?: object, contexte?: object }} entree
 *   `gates` = les noms de scripts npm que la CI joue (défaut : lus dans `ECRIT_LU`).
 * @returns {{ decision: 'deny', reason: string }|null} `null` = rien à dire.
 */
export function evaluate({ commande = '', gates = gatesDeLaCi(), options, contexte } = {}) {
  const deLaCi = new Set(gates)
  const brute = String(commande)

  // Segmentation PROFONDE (socle partagé) : sous-shells, enrobeurs de tête, et RÉSOLUTION d'un
  // `npm run <x>` vers le corps lu dans `package.json` — c'est elle qui fait tomber `npm run gates`
  // (résolu en `node scripts/gates/toutes.mjs`, le rejeu local) et les sept enrobages mesurés. Un script
  // résolu sous `cd server` l'est dans un shell du sous-projet : il est écarté avec lui.
  const budget = nouveauBudget()
  const pipelines = pipelinesDeJetons(brute, 0, { ...options, budget })
  if (budget.sature) return REFUS_SATURE
  const repertoireChange = pipelines.flat().some(({ jetons }) => CHANGEMENTS_DE_REPERTOIRE.has(basenameExecutable(sansRedirections(jetons)[0]?.text ?? '')))
  const repertoires = new Map() // shell → `true` dans `server/`, `false` à la racine, après son dernier `cd`
  const dansServer = (shell) => (shell ? repertoires.get(shell) ?? dansServer(shell.parent) : false)
  for (const { jetons, shell, enTete } of pipelines.flat()) {
    // Une redirection n'est pas un argument : `npx tsc >x.txt --noEmit` reste la gate.
    const lus = sansRedirections(jetons)
    const tokens = lus.map((j) => j.text)
    if (tokens.length === 0) continue
    if (CHANGEMENTS_DE_REPERTOIRE.has(basenameExecutable(tokens[0]))) {
      repertoires.set(shell, entreDansServer(lus))
      continue
    }
    const segment = tokens.join(' ')
    const script = nomScriptNpm(tokens)
    const remonte = [...enTete, ...lus].some((j) => REMONTE_RE.test(j.text))
    if (LECTEURS.test(segment)) continue

    const site = fileURLToPath(new URL('../gates/sur-demande-utilisateur.mjs', import.meta.url))
    if (basenameExecutable(tokens[0]) === 'node' && tokens[1] &&
      (!repertoireChange || isAbsolute(tokens[1])) &&
      canoniser(resolve(contexte?.dir ?? process.cwd(), tokens[1])) === canoniser(site)) {
      if (lus.some(j => j.substitutions?.length) || !demandeDe(tokens.slice(2))) {
        return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
      }
      continue
    }

    if (LANCEUR_DE_GATE.test(segment) || LANCEUR_NODE_TESTS.test(segment)) {
      return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
    }
    const expliciteRacine = deLaCi.has(script) && !['typecheck', 'lint', 'test'].includes(script)
    if (!expliciteRacine && ((dansServer(shell) && !remonte) || PREFIX_SERVER.test(segment))) continue

    // 1. Un script npm que la CI joue, sous son nom.
    if (script) {
      const estUneGate = SUITE_ENTIERE_NPM.has(script) || deLaCi.has(script)
      const restreintAUnPerimetre =
        SUITE_ENTIERE_NPM.has(script) && argumentsPositionnels(segment, /^\S+/).some(designeUnChemin)
      if (estUneGate && !restreintAUnPerimetre) {
        return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
      }
    }

    // 3. `knip` : il n'y a pas de knip « de périmètre », il balaie le graphe entier.
    if (APPEL_KNIP.test(segment)) return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }

    // 4. `eslint` sur un DOSSIER (ou sans cible) = la gate `lint` ; sur des FICHIERS = le périmètre.
    if (APPEL_ESLINT.test(segment)) {
      const cibles = argumentsPositionnels(segment, APPEL_ESLINT)
      if (cibles.length === 0 || cibles.every(estCibleDeGate)) {
        return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
      }
    }

    // 5. `vitest run` SANS chemin = la suite entière ; avec des chemins = le test du périmètre.
    if (appelleVitestNu(segment)) {
      const cibles = argumentsPositionnels(segment, APPEL_VITEST)
        .filter((cible) => cible !== 'run')
      const contexteDuShell = contexte && { ...contexte, repertoireChange }
      if (!cibles.some(designeUnChemin) && !estSondeVitest(lus, contexteDuShell)) return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
    }

    // 6. `tsc --noEmit` nu : la porte de vérité full, ~42 s, portée par le train.
    if (appelleTscNu(segment)) return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
  }

  return null
}

export const garde = {
  nom: 'codeur-gates',
  outils: OUTILS_SHELL,
  evaluer: (entree, contexte) => verdictDe(evaluate({
    commande: commandeDe(entree),
    contexte: contexteSonde(contexte),
  })),
}
