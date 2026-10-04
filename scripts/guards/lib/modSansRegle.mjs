// GARDE DE CLASSE des mods Claude Code (#2278) : un mod REND, les scripts MESURENT. Un mod est une
// racine `.claude/skills/<x>/` qui porte `.claude-plugin/plugin.json` ; ses modules `hooks/**` ne
// portent aucune règle du régime — ni seuil, ni parsing, ni accès au moteur hors d'une liste blanche.
// La couture `hooks/ops.ts` est le seul module qui lance un script et lit sa sortie `--json`.
// Motifs lus sur la vue CODE SEUL (`codeSeul.mjs`), sauf les deux contrôles qui visent une CHAÎNE
// (le littéral `ask`, la cible d'un `$.ui.invalidate`) : ceux-là lisent la source brute.
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { codeSeul } from './codeSeul.mjs'
import { estSuiteVitest } from './fichierVitest.mjs'
import { listerArbre, listerDossier } from './lister.mjs'
import { demandes } from './stdinHorsBorne.mjs'

/** Le fichier qui fait d'une racine de `.claude/skills/` un mod. */
export const MANIFESTE = join('.claude-plugin', 'plugin.json')

/** La couture, relative à la racine du mod. */
export const COUTURE = 'hooks/ops.ts'

/** Accès à `$` permis HORS couture, une ligne par accès ; `x.*` permet toute méthode de `$.x`. */
export const ACCES_PERMIS = Object.freeze([
  'ui.resolve',
  'ui.log',
  'ui.invalidate',
  'state.*',
  'session.id',
  'session.append',
  'tool.register',
  'clock.every',
])

/** Accès à `$` permis DANS la couture : lancer un script, situer le dépôt, journaliser un échec. */
export const ACCES_DE_COUTURE = Object.freeze(['process.run', 'plugin.root', 'ui.log'])

/** Extensions jugées sous `hooks/`. */
const CODE = /\.(?:ts|mts|cts|js|mjs|cjs)$/
/** Extensions refusées sous `hooks/` : `codeSeul` est un lexer JS sans JSX. */
const JSX = /\.(?:tsx|jsx)$/

/** Un accès membre à `$` : `$.a` ou `$.a.b`. */
const ACCES_DOLLAR = /(?<![\w$.])\$\.([A-Za-z_]\w*)(?:\.([A-Za-z_]\w*))?/g
/** `$` affecté ou déstructuré : `= $`, `} = $`. */
const DOLLAR_AFFECTE = /(?<![=!<>])=\s*\$(?![\w$.])/
/** Lecture d'un texte : méthodes de découpe et de motif, `RegExp`, `JSON.parse`. */
const PARSING = /\.(?:split|match|matchAll|replace|replaceAll)\s*\(|\bRegExp\b/
const JSON_PARSE = /\bJSON\.parse\b/
/** Un littéral de regexp : `/` après une ponctuation ouvrante, un opérateur ou un début de ligne. */
const REGEXP_LITTERALE = /(?:^|[(,=:[!&|?{};+\-*%~^<>]|\breturn|\btypeof)\s*\/(?![/*\s])(?:\\.|\[[^\]\n]*\]|[^/\\\n])+\/[dgimsuyv]*/
/** Un seuil : comparaison ou arithmétique contre un littéral numérique. */
const SEUIL = /(?<!=)[<>]=?\s*-?\d|(?<![\w$.])\d[\d_.]*\s*[<>]|%|\/\s*\d/
/** La propriété `ask:` (code seul). */
const PROPRIETE_ASK = /(?<![\w$.])ask\s*:/
/** `$.ui.invalidate` qui vise le prompt (source brute) : il casse le préfixe du cache de prompt. */
const INVALIDE_PROMPT = /\$\.ui\.invalidate\s*\(\s*(['"`])prompt\.(?:context|section)\b/g

/** `true` si l'accès `a.b` figure dans `table`. */
const permis = (table, a, b) => table.includes(`${a}.${b ?? ''}`) || table.includes(`${a}.*`)

/** Le numéro de ligne (1-based) de l'indice `i` de `source`. */
const ligneDe = (source, i) => source.slice(0, i).split('\n').length

/**
 * Les fautes d'un module de mod : chaque ligne qui porte une règle du régime ou un accès non permis.
 * @param {string} source
 * @param {{ couture?: boolean }} [options] `couture: true` pour `hooks/ops.ts`
 * @returns {{ ligne: number, texte: string, motif: string }[]}
 */
export function fautesDeModule(source, { couture = false } = {}) {
  const lignesSource = source.split('\n')
  const fautes = []
  const faute = (ligne, motif) => fautes.push({ ligne, texte: lignesSource[ligne - 1].trim(), motif })
  const table = couture ? ACCES_DE_COUTURE : ACCES_PERMIS
  codeSeul(source).split('\n').forEach((code, i) => {
    for (const [acces, a, b] of code.matchAll(ACCES_DOLLAR))
      if (!permis(table, a, b)) faute(i + 1, `accès \`${acces}\` hors de ${couture ? 'ACCES_DE_COUTURE' : 'ACCES_PERMIS'}`)
    if (DOLLAR_AFFECTE.test(code)) faute(i + 1, '`$` affecté ou déstructuré')
    if (PARSING.test(code) || REGEXP_LITTERALE.test(code)) faute(i + 1, 'parsing')
    if (!couture && JSON_PARSE.test(code)) faute(i + 1, '`JSON.parse` hors couture')
    if (SEUIL.test(code)) faute(i + 1, 'seuil (comparaison ou arithmétique contre un littéral numérique)')
    if (PROPRIETE_ASK.test(code)) faute(i + 1, 'propriété `ask`')
  })
  for (const { ligne } of demandes(source)) faute(ligne, 'littéral `ask`')
  for (const m of source.matchAll(INVALIDE_PROMPT)) faute(ligneDe(source, m.index), '`$.ui.invalidate` du prompt')
  return fautes.sort((x, y) => x.ligne - y.ligne)
}

/**
 * Les racines de mod d'un dossier `.claude/skills` : ses enfants qui portent `MANIFESTE`.
 * @param {string} dossierSkills
 * @returns {string[]} chemins absolus, triés
 */
export function racinesDeMods(dossierSkills) {
  return listerDossier(dossierSkills, { absent: 'vide' })
    .map((nom) => join(dossierSkills, nom))
    .filter((racine) => existsSync(join(racine, MANIFESTE)))
}

/**
 * Les fautes des modules `hooks/**` (bancs `*.test.ts`, joués par `claude plugin test`, exclus) des mods d'un dossier `.claude/skills`.
 * @param {string} dossierSkills
 * @returns {{ fichier: string, ligne: number, texte: string, motif: string }[]}
 */
export function modsSansRegle(dossierSkills) {
  return racinesDeMods(dossierSkills).flatMap((racine) => {
    const mod = basename(racine)
    return listerArbre(join(racine, 'hooks'), { filtre: (rel) => !estSuiteVitest(rel), absent: 'vide' })
      .map((sousHooks) => `hooks/${sousHooks}`)
      .flatMap((rel) => {
        const fichier = `${mod}/${rel}`
        if (JSX.test(rel)) return [{ fichier, ligne: 0, texte: rel, motif: 'module JSX : un mod s’écrit en `.ts` avec `h()`' }]
        if (!CODE.test(rel)) return []
        return fautesDeModule(readFileSync(join(racine, rel), 'utf8'), { couture: rel === COUTURE }).map((f) => ({ fichier, ...f }))
      })
  })
}
