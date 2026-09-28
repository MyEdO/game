// GARDE DE CLASSE des hooks (#2112) : un hook `scripts/hooks/*.mjs` qui lit son stdin SANS la
// primitive bornée `lireStdinBorne` (`scripts/guards/lib/stdinBorne.mjs`) reste vivant tant que le
// harnais ne ferme pas ce stdin — le `timeout` déclaré dans `.claude/settings.json` n'y fait rien, et
// l'agent appelant attend un `tool_result` qui ne vient jamais.
// Motifs lus sur la vue CODE SEUL (`codeSeul.mjs`) : une mention en commentaire ou en chaîne ne lit rien.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { codeSeul } from './codeSeul.mjs'
import { listerDossier } from './lister.mjs'

/** Accès au stdin du processus : le flux `process.stdin`, ou une lecture SYNCHRONE du descripteur 0. */
const ACCES_STDIN = /\bprocess\.stdin\b|\b(?:readFileSync|readSync)\(\s*0\b/

/**
 * Les lignes d'un source qui accèdent au stdin hors de la primitive bornée.
 * @param {string} source
 * @returns {{ ligne: number, texte: string }[]}
 */
export function accesStdin(source) {
  const lignesSource = source.split('\n')
  return codeSeul(source)
    .split('\n')
    .flatMap((code, i) => (ACCES_STDIN.test(code) ? [{ ligne: i + 1, texte: lignesSource[i].trim() }] : []))
}

/**
 * Les accès au stdin hors primitive dans les hooks (`*.mjs` hors `*.test.mjs`) d'un dossier.
 * @param {string} dossierHooks
 * @returns {{ fichier: string, ligne: number, texte: string }[]}
 */
export function hooksHorsBorne(dossierHooks) {
  return modulesDeHooks(dossierHooks)
    .flatMap((nom) => accesStdin(readFileSync(join(dossierHooks, nom), 'utf8')).map((a) => ({ fichier: nom, ...a })))
}

/** Les modules d'un dossier de hooks, tests exclus. */
const modulesDeHooks = (dossierHooks) => listerDossier(dossierHooks).filter((nom) => nom.endsWith('.mjs') && !nom.endsWith('.test.mjs'))

// GARDE DE CLASSE des gardes (#2125) : une garde est une fonction PURE (`scripts/guards/lib/contratGarde.mjs`)
// — seuls les POINTS D'ENTRÉE lisent le stdin, écrivent la sortie et terminent le processus. Une garde
// qui le fait elle-même bloque ou tue le processus qui l'importe avec les autres.

/** Effet de processus réservé aux points d'entrée : stdin (brut ou borné), fin ou code de sortie,
 *  écriture sur stdout, console (une sortie corrompt le JSON unique du répartiteur). */
const EFFET_DE_PROCESSUS =
  /\bprocess\.(?:stdin|exit|exitCode)\b|\bprocess\.stdout\.write\b|\bconsole\.(?:log|info|dir|table|error|warn)\b|\blireStdinBorne\s*\(/
/** Un `let` ou un `var` de premier niveau : un état de module. */
const VARIABLE_DE_MODULE = /^(?:export\s+)?(?:let|var)\s/
/** Un `const` de premier niveau initialisé à un conteneur : un état de module s'il est muté. */
const CONTENEUR_DE_MODULE = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\[|\{|new\s+(?:Map|Set|WeakMap|WeakSet)\b)/
/** Exemption AU SITE d'un conteneur muté : un mémo dont la valeur ne dépend que de sa clé, marqué sur
 *  la ligne de sa déclaration par `// mémo-pur : <clé>`. */
const MEMO_PUR = /\/\/\s*mémo-pur\s*:\s*\S/
/** Une mutation de `nom` : méthode qui modifie en place, ou affectation d'un de ses membres. */
const mutationDe = (nom) => new RegExp(
  `(?<![\\w$.])${nom.replace(/\$/g, '\\$')}\\s*(?:\\.(?:push|pop|shift|unshift|splice|set|add|delete|clear|fill|reverse|sort)\\s*\\(|(?:\\[[^\\]\\n]*\\]|\\.[A-Za-z_$][\\w$]*)\\s*(?:[-+*/|&]|\\?\\?)?=(?!=))`,
)

/**
 * Les lignes d'un source qui portent un effet de processus ou un état de module.
 * @param {string} source
 * @returns {{ ligne: number, texte: string }[]}
 */
export function effetsDeModule(source) {
  const lignesSource = source.split('\n')
  const code = codeSeul(source)
  return code
    .split('\n')
    .flatMap((ligne, i) => {
      const conteneur = MEMO_PUR.test(lignesSource[i]) ? undefined : CONTENEUR_DE_MODULE.exec(ligne)?.[1]
      const faute = EFFET_DE_PROCESSUS.test(ligne) || VARIABLE_DE_MODULE.test(ligne) || (conteneur && mutationDe(conteneur).test(code))
      return faute ? [{ ligne: i + 1, texte: lignesSource[i].trim() }] : []
    })
}

/**
 * Les effets et états de module des modules d'un dossier de hooks hors de ses `pointsDEntree`.
 * @param {string} dossierHooks
 * @param {ReadonlySet<string>} pointsDEntree noms de fichier
 * @returns {{ fichier: string, ligne: number, texte: string }[]}
 */
export function gardesAEffets(dossierHooks, pointsDEntree) {
  return modulesDeHooks(dossierHooks)
    .filter((nom) => !pointsDEntree.has(nom))
    .flatMap((nom) => effetsDeModule(readFileSync(join(dossierHooks, nom), 'utf8')).map((a) => ({ fichier: nom, ...a })))
}

// GARDE DE CLASSE des décisions (#2125) : doctrine `user-doctrine-gardes-jamais-de-ask` (2026-09-28).

/** Le littéral `'ask'` (toute quote) : la valeur d'une décision qui demande. */
const LITTERAL_ASK = /(['"`])ask\1/g

/**
 * Les lignes d'un source qui portent le littéral `'ask'` dans le CODE (hors commentaire).
 * @param {string} source
 * @returns {{ ligne: number, texte: string }[]}
 */
export function demandes(source) {
  const code = codeSeul(source)
  const lignesSource = source.split('\n')
  const lignes = new Set()
  for (const m of source.matchAll(LITTERAL_ASK)) {
    if (code[m.index] === m[1]) lignes.add(source.slice(0, m.index).split('\n').length)
  }
  return [...lignes].map((ligne) => ({ ligne, texte: lignesSource[ligne - 1].trim() }))
}

/**
 * Les décisions `ask` des modules (`*.mjs` hors `*.test.mjs`) des `dossiers`.
 * @param {string[]} dossiers
 * @returns {{ fichier: string, ligne: number, texte: string }[]}
 */
export function modulesQuiDemandent(dossiers) {
  return dossiers.flatMap((dossier) => modulesDeHooks(dossier)
    .flatMap((nom) => demandes(readFileSync(join(dossier, nom), 'utf8')).map((a) => ({ fichier: join(dossier, nom), ...a }))))
}
