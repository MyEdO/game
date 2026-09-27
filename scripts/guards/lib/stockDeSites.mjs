// FORMATS et RÉGÉNÉRATION des stocks de sites (#1711, #1828, #1903). `stock.mjs` est la définition,
// pour TOUT stock nominatif, du calcul d'écart (`ecartsDeStock`) et du remède (`ecartDuVolet`), et,
// pour les stocks de sites, de la forme d'entrée (`EntreeDeSite`, `cleDeSite`, `sitesEnEntrees`) et
// de l'échéance (`CHAMPS_D_ECHEANCE`). Ici vivent :
//   - les deux FORMATS de fichier d'un stock de sites, keyés par extension (`FORMATS`, `formatDe`) :
//     `FORMAT_JSON`, un document `{ quoi, entrees }` dont les entrées sont des `EntreeDeSite` datées
//     par `Echeance` (`lireStockJson`, `lireEntreesDeSite`, `texteDeStock`, `texteEnPlace`), et
//     `FORMAT_MJS`, un module dont chaque `export const <NOM> = [ … ]` d'entrées de site est une
//     collection, lu par l'AST ;
//   - l'ORDRE canonique de toute collection, `parCleDeSite`, qui DÉRIVE de la clé que déclare
//     `stock.mjs` et vit avec les formats qu'il range : `stock.mjs` n'importe rien (#1475) ;
//   - les entrées qu'une régénération écrit (`entreesRegenerees`) et le compte des sites par famille
//     (`comptesParFamille`) ;
//   - le cœur PUR de la régénération : les trois politiques de croissance (`DECROISSANT`, `SOUS_LOT`,
//     `REMESURE`), `texteRegenere` et `ecartDeRegeneration`. Il n'écrit rien : les entrées-sorties
//     vivent dans `regenStock.mts`, que n'atteignent que sa commande et son banc.
// Le PLAFOND ne vit nulle part ici : il vit dans le test de chaque garde.
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import { typescript, ast } from './dialecte.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { litteralJs } from './litteralJs.mjs'
import {
  CHAMPS_DE_GROUPE, CHAMP_D_OCCURRENCE, estEntreeDeSite, naissanceDu, refusDeCroissance, sitesEnEntrees,
  survieDeLecheance,
} from './stock.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

/** Contenu JSON d'un fichier de stock, ou `{}` s'il est ABSENT (un stock soldé : rien de toléré,
 *  l'écart fait le reste). Lecteur partagé : `reconcile.mjs` en tire ses `trous`. */
export function lireStockJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/** Le TEXTE d'un fichier de stock sur le disque, ou `null` s'il est absent. */
export function texteEnPlace(chemin) {
  try {
    return readFileSync(chemin, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

/** Les comptes « à la naissance » du `quoi` du fichier de stock EN PLACE (`naissanceDu`), ou `null`. */
export const naissanceEnPlace = (path, familles) => naissanceDu(lireStockJson(path).quoi, familles)

/** Les ENTRÉES DE SITE d'un fichier de stock JSON (fichier absent, ou stock vide : aucune entrée). */
export function lireEntreesDeSite(path) {
  return lireStockJson(path).entrees ?? []
}

/** Le TEXTE d'un fichier de stock JSON — la seule ÉCRITURE du format `FORMAT_JSON`, en regard de
 *  `lireStockJson` : toute régénération rend le même octet. */
export const texteDeStock = (quoi, entrees) => `${JSON.stringify({ quoi, entrees }, null, 2)}\n`

/**
 * ORDRE CANONIQUE de toute collection de stock de sites, JSON comme `.mjs` : les champs de groupe de la
 * clé (`CHAMPS_DE_GROUPE`, `stock.mjs`) par unités de code, puis l'occurrence en nombre. Il DÉRIVE de la
 * clé et ne doit rien à l'ordre du balayage : deux corpus parcourus dans deux ordres rendent le MÊME
 * fichier, donc un registre réordonné (`src/data/books.json`, #1825) ne réécrit aucun artefact commité.
 * Il vit ici, avec les formats qu'il range, et non dans `sitesEnEntrees` : `stock.mjs` n'importe rien
 * (#1475).
 * @param {Partial<import('./stock.mjs').EntreeDeSite>} a @param {Partial<import('./stock.mjs').EntreeDeSite>} b
 */
export function parCleDeSite(a, b) {
  for (const c of CHAMPS_DE_GROUPE) {
    const d = parUnitesDeCode(a[c] ?? '', b[c] ?? '')
    if (d) return d
  }
  return (a[CHAMP_D_OCCURRENCE] ?? 0) - (b[CHAMP_D_OCCURRENCE] ?? 0)
}

/**
 * Format `.json` : `lire` parse le TEXTE (le chemin n'y sert pas) et rend `null` s'il n'est pas du JSON
 * ou si l'objet n'a pas EXACTEMENT les clés `quoi` et `entrees` ; `horsCollections` est `quoi`, la
 * collection `entrees`. `ecrire` rend `texteDeStock`, entrées rangées par `parCleDeSite`. Un stock JSON
 * soldé est un fichier ABSENT (`absentSiVide`).
 */
export const FORMAT_JSON = Object.freeze({
  absentSiVide: true,
  lire(texte) {
    let brut
    try { brut = JSON.parse(texte) } catch { return null }
    if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) return null
    const cles = Object.keys(brut)
    if (cles.length !== 2 || !cles.includes('quoi') || !cles.includes('entrees') || !Array.isArray(brut.entrees)) return null
    return { horsCollections: brut.quoi, collections: new Map([['entrees', brut.entrees]]) }
  },
  ecrire(image) {
    return texteDeStock(image.horsCollections, [...image.collections.get('entrees')].sort(parCleDeSite))
  },
})

/** La valeur d'un nœud littéral d'entrée (`'…'`, `` `…` `` sans substitution, nombre fini), ou `undefined`. */
function valeurLitterale(ts, n) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
  if (ts.isNumericLiteral(n)) return Number(n.text)
  if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) return -Number(n.operand.text)
  return undefined
}

/** Les entrées d'un tableau littéral, ou `null` s'il n'est pas une collection d'entrées de site. */
function entreesDuTableau(ts, tableau) {
  const entrees = []
  for (const el of tableau.elements) {
    if (!ts.isObjectLiteralExpression(el)) return null
    const e = {}
    for (const p of el.properties) {
      if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return null
      const v = valeurLitterale(ts, p.initializer)
      if (v === undefined) return null
      e[p.name.text] = v
    }
    if (!estEntreeDeSite(e)) return null
    entrees.push(e)
  }
  return entrees
}

/** Le texte d'un champ d'entrée dans un module `.mjs` : une chaîne par `litteralJs`, un nombre fini tel
 *  quel ; toute autre valeur lève en nommant le fichier, la collection et le champ. */
function valeurMjs(v, { chemin, nom, champ }) {
  if (typeof v === 'string') return litteralJs(v)
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  throw new Error(`${chemin} : ${nom}.${champ} vaut ${JSON.stringify(v)}, ni chaîne ni nombre fini`)
}

/** Le corps d'une collection `.mjs` : `[]` vide, sinon une ligne par entrée, rangée par `parCleDeSite`,
 *  avec TOUS les champs présents de l'entrée (ni `undefined` ni `null`), dans l'ordre de l'entrée. */
function corpsMjs(entrees, chemin, nom) {
  if (entrees.length === 0) return '[]'
  const lignes = [...entrees].sort(parCleDeSite).map((e) => {
    const champs = Object.entries(e)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([champ, v]) => `${champ}: ${valeurMjs(v, { chemin, nom, champ })}`)
    return `  { ${champs.join(', ')} },`
  })
  return `[\n${lignes.join('\n')}\n]`
}

/**
 * Format `.mjs` : lu par l'AST (`ast`, dialecte de l'extension de `chemin` — le chemin DANS le dépôt,
 * jamais celui d'un temporaire), jamais exécuté. Chaque `export const <NOM> = [ … ]` dont les éléments
 * sont des objets littéraux à propriétés littérales satisfaisant `estEntreeDeSite` est une collection ;
 * un tableau vide en est une. `horsCollections` est le texte hors des corps de collections, en
 * segments. `ecrire` remplace chaque corps délimité par son nœud AST. Un stock `.mjs` est un module que
 * le code importe : il existe toujours, et une collection soldée s'y écrit `[]`.
 */
export const FORMAT_MJS = Object.freeze({
  absentSiVide: false,
  lire(texte, chemin) {
    const ts = typescript()
    const sf = ast({ rel: chemin, text: texte })
    const collections = new Map()
    const bornes = []
    for (const st of sf.statements) {
      if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer || !ts.isArrayLiteralExpression(d.initializer)) continue
        const entrees = entreesDuTableau(ts, d.initializer)
        if (entrees === null) continue
        collections.set(d.name.text, entrees)
        bornes.push([d.initializer.getStart(sf), d.initializer.getEnd()])
      }
    }
    const segments = []
    let curseur = 0
    for (const [debut, fin] of bornes) { segments.push(texte.slice(curseur, debut)); curseur = fin }
    segments.push(texte.slice(curseur))
    return { horsCollections: Object.freeze(segments), collections, chemin }
  },
  ecrire(image) {
    const noms = [...image.collections.keys()]
    const segments = image.horsCollections
    if (segments.length !== noms.length + 1) throw new Error(`${image.chemin} : ${noms.length} collection(s) pour ${segments.length} segment(s) hors collections`)
    return segments.map((seg, i) => (i < noms.length ? seg + corpsMjs(image.collections.get(noms[i]), image.chemin, noms[i]) : seg)).join('')
  },
})

/** Les formats de fichier d'un stock de sites, keyés par extension. Un format de plus : une ligne. */
export const FORMATS = Object.freeze({ '.mjs': FORMAT_MJS, '.json': FORMAT_JSON })

/** Le format du fichier de stock `chemin`, par son extension ; une extension hors de `FORMATS` lève. */
export function formatDe(chemin) {
  const format = FORMATS[extname(chemin)]
  if (!format) throw new Error(`${chemin} : extension hors des formats de stock de sites (${Object.keys(FORMATS).join(', ')})`)
  return format
}

/** Les entrées d'un stock de sites telles que sa régénération les écrit : les sites en entrées
 *  (`sitesEnEntrees`), l'échéance et la `preuve` en place survivantes (`survieDeLecheance`), rangées par
 *  `parCleDeSite`. PURE. */
export const entreesRegenerees = (sites, { lot, date, ancien = [] } = {}) =>
  survieDeLecheance(sitesEnEntrees(sites), { lot, date, ancien }).sort(parCleDeSite)

/** Le compte des sites (ou entrées) par famille : toutes les familles de `familles` présentes, même à
 *  zéro, dans leur ordre. PURE. */
export const comptesParFamille = (items, familles) =>
  tableTotale(familles, (f) => items.filter((s) => s.famille === f).length)

/** Politique `DECROISSANT` : la régénération n'écrit qu'un stock PLUS PETIT — une entrée neuve ou
 *  accrue est refusée ; sous `--amorce`, rien n'est refusé (le stock qui naît face aux sites que sa
 *  garde mesure déjà). Ne date rien. */
export const DECROISSANT = Object.freeze({
  nom: 'DECROISSANT',
  datee: false,
  refus: ({ chemin, collection, entrees, stock, amorce }) => (amorce ? null : refusDeCroissance(entrees, stock, {
    nom: `${chemin} : ${collection.nom}`,
    motif: `Cet outil ne peut qu'écrire un stock PLUS PETIT.${collection.motif ? ` ${collection.motif}` : ''}`,
  })),
})

/** Politique `SOUS_LOT` : une entrée neuve ou accrue exige le lot du chantier (`--lot <#N …>`), qui la
 *  date ; sans lui, amorce ou non, rien n'est écrit. */
export const SOUS_LOT = Object.freeze({
  nom: 'SOUS_LOT',
  datee: true,
  refus: ({ chemin, collection, entrees, stock, lot }) => (lot !== null ? null : refusDeCroissance(entrees, stock, {
    nom: `${chemin} : ${collection.nom}`,
    motif: 'Passer `--lot <#N …>` : rien n\'est écrit.',
  })),
})

/** Politique `REMESURE` : la mesure fait foi, amorce ou non ; la croissance nette d'un fichier se
 *  déclare au commit par une ligne `CLIQUET:`, que la porte de plage exige. Ne date rien. */
export const REMESURE = Object.freeze({ nom: 'REMESURE', datee: false, refus: () => null })

/**
 * Le TEXTE régénéré d'UNE déclaration de stock de sites, PUR. Une déclaration dont le `manque` n'est pas
 * vide est refusée d'emblée. `enPlace` (le texte du fichier, `null` s'il est absent) se lit par le format
 * de `chemin` ; `null` sous un format `absentSiVide` est l'image vide de la déclaration. Chaque collection
 * déclarée écrit `entreesRegenerees` de ses sites sur son stock en place, `lot` et `date` passés sous une
 * politique qui date, et la politique la juge. Rend `{ refus }`, ou `{ texte, tailles }` — `texte` `null`
 * quand le format est `absentSiVide` et que toutes ses collections sortent vides (l'état soldé).
 * @param {import('./stockDeSites.mjs').RegenerationDeStock} regeneration
 * @param {{ enPlace: string | null, lot?: string | null, date?: string | null, amorce?: boolean }} p
 */
export function texteRegenere(regeneration, { enPlace, lot = null, date = null, amorce = false }) {
  const { chemin, politique, collections, horsCollections, manque = [] } = regeneration
  if (manque.length > 0) {
    return { refus: `REFUS : ${chemin} : mesure incomplète, rien n'est écrit :\n${manque.map((p) => `  ${p}`).join('\n')}` }
  }
  const format = formatDe(chemin)
  let image
  if (enPlace === null) {
    if (!format.absentSiVide) throw new Error(`${chemin} : fichier absent, que son format ne lit pas comme un stock soldé`)
    if (horsCollections === undefined) throw new Error(`${chemin} : fichier absent, et sa régénération ne déclare pas son horsCollections`)
    image = { horsCollections, collections: new Map(collections.map((c) => [c.nom, []])), chemin }
  } else {
    image = format.lire(enPlace, chemin)
    if (image === null) throw new Error(`${chemin} : illisible par son format`)
    for (const c of collections) if (!image.collections.has(c.nom)) throw new Error(`${chemin} : collection ${c.nom} absente du fichier`)
  }
  const sortie = new Map(image.collections)
  for (const c of collections) {
    const stock = image.collections.get(c.nom)
    const entrees = entreesRegenerees(c.sites, { ancien: stock, ...(politique.datee ? { lot, date } : {}) })
    const refus = politique.refus({ chemin, collection: c, entrees, stock, lot, amorce })
    if (refus) return { refus }
    sortie.set(c.nom, entrees)
  }
  const tailles = collections.map((c) => `${c.nom}=${sortie.get(c.nom).length}`).join(', ')
  if (format.absentSiVide && [...sortie.values()].every((e) => e.length === 0)) return { texte: null, tailles }
  const texte = format.ecrire({ ...image, horsCollections: horsCollections ?? image.horsCollections, collections: sortie })
  return { texte, tailles }
}

/**
 * Le stock en place est-il le POINT FIXE de sa régénération ? La seule réponse du dépôt : `null` si
 * oui (un stock soldé et absent compris), sinon la phrase qui le dit — le refus de `texteRegenere`, ou
 * « Stock PÉRIMÉ » et les tailles —, chaque phrase nommant le fichier. PURE.
 * @param {import('./stockDeSites.mjs').RegenerationDeStock} regeneration @param {string | null} enPlace
 */
export function ecartDeRegeneration(regeneration, enPlace) {
  const r = texteRegenere(regeneration, { enPlace, lot: null, date: null })
  if (r.refus) return r.refus
  return r.texte === enPlace ? null : `${regeneration.chemin} : Stock PÉRIMÉ (${r.tailles})`
}
