// RÉPARTITION DES TESTS `scripts/**` ENTRE LES GATES (#1759) — table UNIQUE, décision par RÉPERTOIRE.
//
// Le cas : `package.json` nommait 98 tests un par un (le seul `test:hooks` faisait 2 445 caractères),
// et deux tests nés sous ces listes n'y étaient jamais entrés — jamais joués depuis leur naissance
// (`scripts/guards/lib/spawnResilient.test.mjs`, 2026-09-04 ; `scripts/docs/lib/canauxMecaniques.test.mjs`,
// 2026-09-13). Une liste à la main ne dit RIEN quand elle est incomplète : elle passe au vert.
//
// L'invariant : un test `scripts/**/*.test.mjs` est joué par EXACTEMENT UNE gate, décidée par son
// RÉPERTOIRE — jamais par son nom. Le test N+1 coûte zéro ligne : il tombe dans la racine qui le
// contient. Toute lecture des « tests d'une gate » (package.json via `scripts/test/node-tests.mjs`,
// `ecrivainsAtteints`, doc générée) passe ICI, et nulle part ailleurs.
//
// La source de la LISTE est GIT, pas le disque : ce que la CI joue, c'est ce qui est SUIVI. Un test
// laissé dans l'arbre sans être suivi (fixture d'un banc, reste d'un chantier) ne se joue donc pas
// ici — sinon le vert local et le vert de CI cessent de parler du même ensemble.
//
// Une racine appartient à UNE gate : `couverture()` rend rouge, nominativement, tout test qu'aucune
// racine ne prend (orphelin) ou que deux prennent (doublon) — garde `testsParGate.test.mjs`.
import { GitIndisponible, TRAVAIL, depotDe, listerImage } from '../guards/lib/gitPorte.mjs'

/** Suffixe qui fait d'un fichier un test joué par `node --test`. */
const SUFFIXE_TEST = '.test.mjs'

/**
 * Racines par gate — table GELÉE : un banc qui veut une autre répartition en passe une COPIE en
 * paramètre, il ne mute pas la source de vérité du dépôt.
 * Une racine `'scripts/x'` prend `scripts/x` ET tout ce qu'il contient ; une racine `'scripts/*'` ne
 * prend que les fichiers DIRECTS de `scripts/`.
 * Les tests `.test.ts` des racines de la suite Vitest (`scripts/guards/lib/racinesDeLaSuite.mjs`) ne sont pas ici : Vitest les joue.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const RACINES = Object.freeze({
  'test:runner': Object.freeze(['scripts/test', 'scripts/*']),
  'test:agents': Object.freeze(['scripts/agents']),
  'test:hooks': Object.freeze([
    'scripts/hooks', 'scripts/git-hooks', 'scripts/guards', 'scripts/gates', 'scripts/migrations',
    // Les bancs de la garde `mods:check` (lanceur factice) et du mur `murs/mod-sans-regle` (config ESLint résolue).
    'scripts/mods',
  ]),
  'test:docs': Object.freeze(['scripts/docs']),
  'test:recette': Object.freeze(['scripts/recette']),
  'test:raw': Object.freeze(['scripts/raw', 'scripts/source']),
  'test:ops': Object.freeze(['scripts/ops']),
})

/** Les gates qui jouent des tests `scripts/**`, dans l'ordre de la table. */
export const GATES = Object.freeze(Object.keys(RACINES))

/** `true` si `chemin` (relatif POSIX) tombe sous `racine`. */
function sousRacine(chemin, racine) {
  if (racine.endsWith('/*')) {
    const dossier = racine.slice(0, -2)
    return chemin.startsWith(`${dossier}/`) && !chemin.slice(dossier.length + 1).includes('/')
  }
  return chemin.startsWith(`${racine}/`)
}

/** Les gates dont une racine prend `chemin` — 0, 1 ou plusieurs (c'est le défaut que `couverture` nomme). */
const gatesQuiPrennent = (chemin, racines) =>
  Object.keys(racines).filter((gate) => racines[gate].some((racine) => sousRacine(chemin, racine)))

/**
 * La gate qui joue ce test, ou `null` si aucune racine ne le prend — ou si plusieurs le prennent
 * (un test que deux gates revendiquent n'a pas de propriétaire).
 * @param {string} chemin chemin relatif POSIX, depuis la racine du dépôt
 * @param {Record<string, readonly string[]>} [racines]
 * @returns {string | null}
 */
export function gateDe(chemin, racines = RACINES) {
  const prises = gatesQuiPrennent(chemin, racines)
  return prises.length === 1 ? prises[0] : null
}

/**
 * Tous les tests `scripts/**\/*.test.mjs` du dépôt — SUIVIS ou NON ENCORE INDEXÉS —, chemins
 * relatifs POSIX, triés. Un test neuf n'est pas indexé tant qu'on ne l'a pas `git add` : le lister
 * par les seuls fichiers suivis rendrait VERTE, par ABSENCE, toute garde qui vient d'être écrite.
 * Une lecture git sans verdict LÈVE : jouer « zéro test » serait le pire des verts.
 * @param {string} [racine] racine du dépôt
 * @returns {string[]}
 */
export function listerTests(racine = process.cwd()) {
  let chemins
  try {
    chemins = listerImage(depotDe(racine), TRAVAIL, 'scripts')
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    throw new Error(`testsParGate : git ne rend pas les fichiers sous ${racine}/scripts (${e.raison}) — la répartition des tests ne se devine pas`, { cause: e })
  }
  return chemins.filter((f) => f.endsWith(SUFFIXE_TEST)).sort()
}

/**
 * Les tests que joue `gate`, triés. La liste ne vient JAMAIS d'un nom écrit à la main.
 * @param {string} gate
 * @param {() => string[]} [lister] source des tests (injectable pour les bancs)
 * @param {Record<string, readonly string[]>} [racines]
 * @returns {string[]}
 */
export function testsDe(gate, lister = listerTests, racines = RACINES) {
  if (!racines[gate])
    throw new Error(`gate inconnue de testsParGate : « ${gate} » (connues : ${Object.keys(racines).join(', ')})`)
  return lister()
    .filter((chemin) => gateDe(chemin, racines) === gate)
    .sort()
}

/**
 * Ce que la table RATE : les tests qu'aucune racine ne prend, ceux que plusieurs prennent.
 * @param {() => string[]} [lister]
 * @param {Record<string, readonly string[]>} [racines]
 * @returns {{ orphelins: string[], doublons: Array<{ test: string, gates: string[] }> }}
 */
export function couverture(lister = listerTests, racines = RACINES) {
  const orphelins = []
  const doublons = []
  for (const chemin of lister()) {
    const gates = gatesQuiPrennent(chemin, racines)
    if (gates.length === 0) orphelins.push(chemin)
    else if (gates.length > 1) doublons.push({ test: chemin, gates })
  }
  return { orphelins: orphelins.sort(), doublons }
}
