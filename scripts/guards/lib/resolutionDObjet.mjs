// GARDE de la résolution d'objet (#2324) : hors `src/data/`, un objet se résout par `resoudreObjet`
// et se nomme par `itemLabel` / `libelleDeRef` (`src/engine/items.ts`), qui voient la couche de
// campagne. Le foyer `src/data/` ne la voit pas : tout canal qui y résout un objet, DIRECT ou par une
// catégorie, lit une instance d'objet de campagne comme absente, et la nomme par son id.
// Module ESM pur, exécutable par `node` nu.
//
// CANAUX REFUSÉS hors du foyer (lignes de CODE, `codeSeul`) :
//  - `findTrappingById`, nommé (import, appel, ré-export) ;
//  - `refLabel`/`findById`/`byId` importés de `data` et appelés sur la catégorie `trappings`/`trapping` ;
//  - `refLabel` importé de `data` sur une catégorie DYNAMIQUE (elle peut valoir `trappings`) : la couture
//    est `libelleDeRef` ;
//  - `findById`/`byId` importés de `data` sur une catégorie dynamique, dont on lit le `.label` ;
//  - `resoudreObjet(…).label` : le nom d'un objet est `itemLabel`, jamais l'entrée relue à la main.
// COUVERTURE DITE : un `findById` dynamique qui ne lit pas `.label` (existence d'une fiche Codex) passe ;
// un nom importé sous un ALIAS (`refLabel as x`) n'est pas suivi.

import { codeSeul } from './codeSeul.mjs'
import { readCorpus } from './sourceCorpus.mjs'

/** Le résolveur du catalogue seul, que seul `src/data/` appelle. */
export const RESOLVEUR_DU_CATALOGUE = 'findTrappingById'

/** Le FOYER : le seul dossier où le catalogue seul est la bonne résolution (index, schémas). */
export const FOYER = 'src/data/'

/** Sites tolérés hors du foyer, par `fichier:ligne`. VIDE : un site qui résiste se corrige. */
export const EXCEPTIONS = Object.freeze([])

/** La COUTURE du nom d'une réf à catégorie dynamique : son corps DÉLÈGUE à `refLabel` hors `trappings`,
 *  c'est sa définition. Déclarée par son fichier ET sa fonction, jamais un fichier entier. */
export const COUTURE = Object.freeze({ fichier: 'src/engine/items.ts', fonction: 'libelleDeRef' })

const MOTIF_DIRECT = new RegExp(`\\b${RESOLVEUR_DU_CATALOGUE}\\b`, 'g')
const PAR_CATEGORIE = ['refLabel', 'findById', 'byId']
const APPEL = /\b(refLabel|findById|byId|resoudreObjet)\s*\(/g
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const DE_DATA = /(^|\/)data(\/index)?$/
const CATEGORIE_D_OBJET = /^\s*(['"`])trappings?\1/

/** Les noms de `PAR_CATEGORIE` que le texte importe d'un module `data`. @param {string} texte */
function importesDeData(texte) {
  const noms = new Set()
  for (const m of texte.matchAll(IMPORT)) {
    if (!DE_DATA.test(m[2])) continue
    for (const n of m[1].split(',').map((x) => x.trim().replace(/^type\s+/, ''))) if (PAR_CATEGORIE.includes(n)) noms.add(n)
  }
  return noms
}

/** Index de la parenthèse qui ferme celle ouverte en `ouvrante`, sur la vue CODE. */
function fermante(code, ouvrante) {
  let profondeur = 0
  for (let i = ouvrante; i < code.length; i++) {
    if (code[i] === '(') profondeur++
    else if (code[i] === ')' && --profondeur === 0) return i
  }
  return -1
}

/** Étendue `[début, fin]` du corps de la fonction `nom` dans la vue CODE, ou `null`. */
function corpsDe(code, nom) {
  const m = new RegExp(`\\bfunction\\s+${nom}\\s*\\(`).exec(code)
  if (!m) return null
  const debut = code.indexOf('{', fermante(code, m.index + m[0].length - 1))
  let profondeur = 0
  for (let i = debut; i < code.length; i++) {
    if (code[i] === '{') profondeur++
    else if (code[i] === '}' && --profondeur === 0) return [debut, i]
  }
  return null
}

/**
 * Les sites d'un texte source : chaque appel d'un canal refusé (voir l'en-tête), à sa ligne.
 * @param {string} texte
 * @param {{ couture?: string }} [opts] `couture` : nom de la fonction-couture du fichier, dont le corps
 *   est hors mesure.
 * @returns {{ line: number, detail: string }[]}
 */
export function sitesDansLeTexte(texte, { couture } = {}) {
  const code = codeSeul(texte)
  const horsMesure = couture ? corpsDe(code, couture) : null
  const source = texte.split('\n')
  const ligneDe = (i) => code.slice(0, i).split('\n').length
  const lignes = new Set()
  for (const m of code.matchAll(MOTIF_DIRECT)) lignes.add(ligneDe(m.index))
  const importes = importesDeData(texte)
  for (const m of code.matchAll(APPEL)) {
    const nom = m[1]
    const ouvrante = m.index + m[0].length - 1
    const arg = texte.slice(ouvrante + 1, ouvrante + 80)
    const fin = fermante(code, ouvrante)
    const litLeLabel = fin >= 0 && /^\s*\??\.\s*label\b/.test(code.slice(fin + 1, fin + 20))
    const litterale = /^\s*['"`]/.test(arg)
    const fautif = nom === 'resoudreObjet'
      ? litLeLabel
      : importes.has(nom) && (CATEGORIE_D_OBJET.test(arg) || (!litterale && (nom === 'refLabel' || litLeLabel)))
    if (fautif && !(horsMesure && m.index > horsMesure[0] && m.index < horsMesure[1])) lignes.add(ligneDe(m.index))
  }
  return [...lignes].sort((a, b) => a - b).map((line) => ({ line, detail: source[line - 1].trim() }))
}

/**
 * Les sites hors du foyer, hors exceptions, dans un corpus (défaut : le code de production de `src/`,
 * hors instruments Vitest).
 * @param {ReadonlyArray<{ rel: string, text: string }>} [corpus]
 * @returns {{ site: string, detail: string }[]}
 */
export function sitesHorsDuFoyer(corpus = readCorpus(['src'])) {
  return corpus
    .filter((f) => !f.rel.startsWith(FOYER))
    .flatMap((f) => sitesDansLeTexte(f.text, f.rel === COUTURE.fichier ? { couture: COUTURE.fonction } : {}).map(({ line, detail }) => ({ site: `${f.rel}:${line}`, detail })))
    .filter(({ site }) => !EXCEPTIONS.includes(site))
}
