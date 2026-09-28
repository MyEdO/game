// MODULES FEUILLES — un module que RIEN n'importe, et la garde qui le mesure (#1813).
//
// LA RÈGLE : certains modules portent un geste dont l'unicité EST l'invariant. Tant qu'un tiers peut
// les importer, le geste lui est à portée d'appel, et aucune lecture d'argv ne le voit : un appel
// indirect ne laisse aucun littéral. L'unicité ne se tient donc pas sur ce qu'un fichier ÉCRIT, mais
// sur ce que le dépôt IMPORTE.
//
// POURQUOI cette garde plutôt qu'un prédicat par banc : un prédicat écrit à la main ne voit que les
// graphies qu'il a imaginées. Mesuré sur une regex `^\s*import…from '…'` — qui exige `import` et le
// chemin sur la MÊME ligne — : mono-ligne vu, multi-ligne RATÉ (la graphie que ce dépôt emploie
// partout), dynamique raté, ré-export raté, spécificateur sans extension raté. L'extraction vient
// donc de la primitive canonique du dépôt, `importGraph.mjs` (`IMPORT_RE` couvre statique
// multi-ligne, dynamique et effet de bord ; `resolveImport` ramène toute graphie d'un spécificateur
// relatif au MÊME fichier), complétée ici par la seule graphie qu'elle ne porte pas : `require`.
//
// CE QUE LA GARDE MESURE : pour chaque feuille déclarée, les sources SUIVIES par git qui la
// résolvent — hors elle-même et hors ses bancs déclarés. Zéro importeur, ou la liste nominative.
//
// Le jeu des feuilles est une DONNÉE : en ajouter une coûte une ligne, et aucune condition en dur ne
// nomme un module.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INDEX, depotDe, listerImage } from './gitPorte.mjs'
import { IMPORT_RE, resolveImport } from './importGraph.mjs'

/** L'arbre lu par défaut : celui où VIT ce module. */
export const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Extensions de MODULE que ce dépôt écrit : ce sont les fichiers qui peuvent porter un import. */
const EXTS_SOURCE = /\.(?:mjs|cjs|mts|cts|ts|tsx|js|jsx)$/

/**
 * Les feuilles déclarées. `module` est le chemin POSIX relatif à la racine ; `bancs` liste les
 * seules sources autorisées à l'importer (son propre banc — sans quoi le geste ne serait pas
 * testable) ; `pourquoi` dit l'invariant que la feuille sert.
 * @type {ReadonlyArray<{module:string, bancs:readonly string[], pourquoi:string}>}
 */
export const FEUILLES = Object.freeze([
  Object.freeze({
    module: 'scripts/ops/fermer-depuis-main.mjs',
    bancs: Object.freeze(['scripts/ops/fermer-depuis-main.test.mjs']),
    pourquoi:
      'porte le geste qui ferme les tickets SOLDÉS d’une plage poussée sur main (job `fermetures` de ' +
      'ci.yml) — le dépôt compte un SECOND site de fermeture, `scripts/ops/signaler-rouge.mjs` pour le ' +
      'canari, et les deux sont recensés par `sitesDeFermeture.mjs` (#1813)',
  }),
])

/** Sources SUIVIES par git susceptibles de porter un import, chemins POSIX relatifs, triés.
 *  La source est GIT, pas le disque : ce que la CI joue, c'est ce qui est suivi. */
export function sourcesSuivies(racine = RACINE) {
  return listerImage(depotDe(racine), INDEX)
    .filter((f) => EXTS_SOURCE.test(f))
    .sort()
}

/**
 * COMPLÉMENT d'`IMPORT_RE`, pas un second parseur d'imports ES : la seule graphie d'acquisition que
 * la primitive ne porte pas est `require`. Elle est VIVANTE ici — `createRequire(import.meta.url)`
 * charge le compilateur TypeScript dans `dialecte.mjs` et `stocksNominatifs.mjs` — et atteindrait
 * une feuille aussi sûrement qu'un `import`. Deux formes, et elles suffisent : l'appel chaîné
 * (`createRequire(…)('./x')`) et l'appel d'un `require` déjà lié, que ce soit celui de CJS ou celui
 * qu'un `const require = createRequire(…)` vient de poser.
 * HORS DE PORTÉE, et d'aucune lecture statique : un spécificateur passé par VARIABLE
 * (`require(chemin)`, `import(chemin)`) — il n'y a pas de littéral à lire —, et un `require` lié
 * sous un AUTRE nom (`const req = createRequire(…)` puis `req('./x')`), dont le callee n'est plus
 * un jeton connu. C'est pourquoi l'invariant
 * des feuilles se mesure sur l'ensemble des sources SUIVIES et non sur une liste de suspects.
 */
const REQUIRE_RE =
  /\bcreateRequire\s*\([^()]*\)\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * Les spécificateurs relatifs qu'un texte source acquiert, RÉSOLUS vers des fichiers réels.
 * Statiques (`from '…'`, y compris multi-ligne et ré-export), dynamiques (`import('…')`) et à effet
 * de bord — c'est `IMPORT_RE` qui le dit, jamais une regex de plus ; `require` et `createRequire`
 * par le complément `REQUIRE_RE` ci-dessus. `resolveImport` ramène toute graphie d'un spécificateur
 * relatif au MÊME fichier, donc une source qui acquiert deux fois la même cible ne rend qu'une
 * entrée par graphie écrite, jamais une par extension possible.
 * @param {string} fichierAbsolu @param {string} texte
 * @returns {{specificateur:string, resolu:string}[]}
 */
export function importsResolus(fichierAbsolu, texte) {
  const vus = []
  for (const motif of [IMPORT_RE, REQUIRE_RE])
    for (const m of texte.matchAll(motif)) {
      const specificateur = m[1] ?? m[2] ?? m[3]
      const resolu = resolveImport(fichierAbsolu, specificateur)
      if (resolu) vus.push({ specificateur, resolu })
    }
  return vus
}

/**
 * Qui importe une feuille — la mesure, nominative. Une feuille dont le MODULE est introuvable rend
 * un manquement elle aussi : une garde qui protège un fichier absent est verte pour rien.
 * @param {{racine?:string, sources?:string[], feuilles?:typeof FEUILLES}} [p]
 * @returns {{manquements:string[], sourcesLues:number}}
 */
export function manquementsDeFeuilles({ racine = RACINE, sources, feuilles = FEUILLES } = {}) {
  const lues = sources ?? sourcesSuivies(racine)
  const absolu = (rel) => resolve(racine, rel).split('\\').join('/')
  const manquements = []

  for (const feuille of feuilles) {
    if (!lues.includes(feuille.module))
      manquements.push(`feuille déclarée introuvable parmi les sources suivies : ${feuille.module}`)
  }

  const parCible = new Map(feuilles.map((f) => [absolu(f.module), f]))
  for (const source of lues) {
    if (feuilles.some((f) => f.module === source || f.bancs.includes(source))) continue
    let texte
    try {
      texte = readFileSync(absolu(source), 'utf8')
    } catch {
      continue
    }
    for (const { specificateur, resolu } of importsResolus(absolu(source), texte)) {
      const feuille = parCible.get(resolu)
      if (feuille)
        manquements.push(
          `${source} importe la FEUILLE ${feuille.module} (« ${specificateur} ») — elle ${feuille.pourquoi} : ` +
          'sors de cette feuille ce que tu viens y chercher, elle ne s’importe pas',
        )
    }
  }
  return { manquements: manquements.sort(), sourcesLues: lues.length }
}
