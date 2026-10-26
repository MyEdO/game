// VOLETS DE LA PORTE DES COMPTES (#2705, #3021) : ce que juge `refusDesComptes` (`scripts/guards/lib/corpusDesComptes.mts`),
// déclaré UNE fois ici — le nom d'un volet, l'identité d'un site, son compte, la CIBLE qui solde une naissance ou une
// hausse, et le juge propre d'un PLANCHER (`refus`). Chaque volet se mesure sur le CODE seul (defs, grammaire, `OP_DEFS`,
// `Source/`) : ajouter ou retirer une donnée n'en fait bouger aucun (#2995). La dette que seule la donnée révèle n'est pas
// ici : elle est INVENTORIÉE (`scripts/guards/lib/inventaireDeDette.mts`). Les COLLECTIONS À COMPTE sont les volets dont un
// stock porte le compte ; leur contrat est `src/data/structures-contrat.test.ts`, l'écrivain de leurs baisses
// `scripts/guards/occurrences-structures.mts`.
import { analyserTexte, typescript } from './dialecte.mjs'
import { CHAMP_D_OCCURRENCE, SEPARATEUR_DE_REMEDE, cleDeSite, ecartsDeStock, refusDeCroissance } from './stock.mjs'
import { MOTIF_DECROISSANT } from './stockDeSites.mjs'
import { SOURCE_FORMAT } from '../../raw/check-source-format.mjs'
import { PORTEURS } from './porteursDesComptes.mjs'

const siteDeRedeclaration = (r) => `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun}`

/** Le compte d'une entrée de collection à compte. */
export const occurrencesDe = (e) => e.occurrences

/** La commande qui écrit les BAISSES mesurées. */
export const COMMANDE_D_ECRITURE = 'node scripts/lancer-local.mjs tsx -- tsx scripts/guards/occurrences-structures.mts --write'

/** Les redéclarations de l'AST des defs (`scannerRedeclarations`), comptées par identité. */
function redeclarationsComptees(redeclarations) {
  const parSite = new Map()
  for (const { def, champ, concept, signature, statut, commun } of redeclarations) {
    const e = { def, champ, concept, signature, statut, commun }
    const k = siteDeRedeclaration(e)
    parSite.set(k, { ...e, occurrences: (parSite.get(k)?.occurrences ?? 0) + 1 })
  }
  return [...parSite.values()]
}

/**
 * Les collections à compte. `mesure` lit le CORPUS `{ redeclarations }` (`corpusDesComptes`,
 * `scripts/guards/lib/corpusDesComptes.mts`) ; `site` est l'identité d'une entrée hors compte et hors pilotage ;
 * `cible` la phrase de la voie qui solde une hausse de ce site.
 */
export const COLLECTIONS_A_COMPTE = Object.freeze([
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_REDECLARATIONS', site: siteDeRedeclaration,
    cible: (_cle, r) => `Migrer : composer ${r.commun ? `\`${r.commun}\`` : 'le nœud commun'} de la grammaire (src/data/schemas/grammaire/) au lieu de le re-taper.`,
    mesure: ({ redeclarations }) => redeclarationsComptees(redeclarations) },
].map((c) => Object.freeze(c)))

/** Le motif d'un site de `DETTE_OPS` dont le payload n'est pas typé (`OPS_NON_TYPEES`). */
export const MOTIF_NON_TYPEE = 'non typée'
/** Le motif d'un site de `DETTE_OPS` dont la clé `cle` du payload est une feuille `idDe` À PLAT (`refsAPlat`). */
export const motifAPlat = (cle) => `à plat:${cle}`

/** Le volet DETTE_OPS (L1c #1468) : un site par op de `OPS_NON_TYPEES` et un par couple (op, clé) de `refsAPlat(OP_DEFS)`,
 *  mesurés par `sitesDeDetteDOps` (`corpusDesComptes.mts`). */
export const DETTE_OPS = Object.freeze({
  nom: 'DETTE_OPS',
  site: (o) => `${o.op} | ${o.motif}`,
  nombre: () => 1,
  cible: (_cle, o) => (o.motif === MOTIF_NON_TYPEE
    ? 'Typer le payload de l’op dans `OP_DEFS` et la retirer d’`OPS_NON_TYPEES` (src/data/schemas/grammaire/mecanique.ts).'
    : 'Emboîter la référence du payload (`skill: {id, spec}`, `OP_DEFS`, src/data/schemas/grammaire/mecanique.ts).'),
})

/** Le volet DETTE_ENVELOPPE (L1d #1469) : un site par type de `CONTENU_A_SOURCER` (`src/data/schemas/grammaire/sans-livre.ts`),
 *  dont la provenance se mesure sans que la fabrique l'exige, mesuré par `sitesDEnveloppeASourcer` (`corpusDesComptes.mts`). */
export const DETTE_ENVELOPPE = Object.freeze({
  nom: 'DETTE_ENVELOPPE',
  site: (e) => e.type,
  nombre: () => 1,
  cible: () => 'Sourcer le document et retirer son type de `CONTENU_A_SOURCER` (src/data/schemas/grammaire/sans-livre.ts) : la fabrique exige alors sa provenance.',
})

const cibleDeFeuille = () =>
  'Rendre au chemin sa feuille `idDe` : une référence se pose par la fabrique (`ref`/`refs`/`specRef`/`pick`, src/data/schemas/grammaire/ref.ts), jamais en chaîne nue.'

/**
 * Le PLANCHER FEUILLES_D_ID : chaque chemin de schéma de document et son état (`cheminsDeDocument`,
 * `structuresLocales.mts`). Il TIENT ses chemins `idDe` ; il CÈDE quand un chemin `idDe` à la base est encore un chemin du
 * schéma de la tête et n'y est plus `idDe` (`libre` ou `ferme`) : une alternative d'union qui admet une valeur libre rend
 * son chemin `libre` (`admisDe`). Un chemin né, disparu ou gagné ne cède rien. Règle CONSERVATRICE : ajouter sous un
 * chemin `idDe` une alternative, même légitime, qui admet une valeur libre refuse ; aucune ligne de message ne l'admet,
 * seul un renommage du chemin passe. Une baisse de son DÉTECTEUR se justifie par `FAUX-POSITIF:`
 * (`baissesDuDetecteur`, `corpusDesComptes.mts`).
 */
export const FEUILLES_D_ID = Object.freeze({
  nom: 'FEUILLES_D_ID',
  site: cleDeSite,
  nombre: () => 1,
  cible: cibleDeFeuille,
  plancher: Object.freeze({
    tient: (e) => e.etat === 'idDe',
    cede: (avant, apres) => {
      const tete = new Map(apres.map((e) => [cleDeSite(e), e]))
      return avant.filter((e) => e.etat === 'idDe' && tete.has(cleDeSite(e)) && tete.get(cleDeSite(e)).etat !== 'idDe')
        .map((e) => `${cleDeSite(e)}${SEPARATEUR_DE_REMEDE}feuille \`idDe\` RELÂCHÉE : le chemin n’est plus \`idDe\` à la tête (\`${tete.get(cleDeSite(e)).etat}\`). ${cibleDeFeuille()} Aucune ligne de message ne l’admet.`)
    },
  }),
})

/** L'EMPREINTE de champs `[clé, type]` : `clé:type` triés, joints par `,` ; `champsDEmpreinte` la relit. PURE. */
export const empreinteDeChamps = (champs) => champs.map(([cle, type]) => `${cle}:${type}`).sort().join(',')
/** Les `clé:type` d'une EMPREINTE de site (`empreinteDeChamps`). PURE. */
const champsDEmpreinte = (empreinte) =>
  new Map(empreinte.split(',').filter(Boolean).map((c) => [c.slice(0, c.lastIndexOf(':')), c.slice(c.lastIndexOf(':') + 1)]))

/** L'empreinte `ne` ÉTEND `disparu` : chaque clé du disparu au même type, chaque clé en plus optionnelle. PURE. */
function etend(ne, disparu) {
  const [n, d] = [champsDEmpreinte(ne), champsDEmpreinte(disparu)]
  return [...d].every(([k, t]) => n.get(k) === t) && [...n].every(([k, t]) => d.has(k) || t === 'optional')
}

/** Un nom de branche NON discriminée dans une clé de site (`nomDeBranche`, `structuresLocales.mts`). */
const BRANCHE_NON_DISCRIMINEE = /\|\{[^}]*\}/g
/** `ref` privée, tour à tour, de chacun de ses noms de branche non discriminée. PURE. */
const sansUneBranche = (ref) =>
  [...ref.matchAll(BRANCHE_NON_DISCRIMINEE)].map((m) => `${ref.slice(0, m.index)}\u0000${ref.slice(m.index + m[0].length)}`)
/** Deux clés qui ne diffèrent que par le nom d'UNE branche non discriminée. PURE. */
function uneBrancheRenommee(a, b) {
  const deA = new Set(sansUneBranche(a))
  return sansUneBranche(b).some((x) => deA.has(x))
}

/**
 * Les RENOMMAGES d'un site de structure entre `base` et `tete` (entrées mesurées, avec leur `empreinte`) : la clé
 * (`cleDeSite`) de chaque site NÉ apparié à un site DISPARU du même document (`fichier`), (i) d'empreinte identique, sinon (ii) dont la
 * clé ne diffère que par le nom d'UNE branche non discriminée et dont l'empreinte ÉTEND la sienne. Chaque disparu
 * s'apparie une fois. PURE.
 */
export function renommagesDeStructure(base, tete) {
  const [avant, apres] = [new Set(base.map(cleDeSite)), new Set(tete.map(cleDeSite))]
  const disparus = base.filter((e) => !apres.has(cleDeSite(e)))
  const nes = tete.filter((e) => !avant.has(cleDeSite(e)))
  const pris = new Set()
  const apparies = new Set()
  const regles = [(n, d) => n.empreinte === d.empreinte, (n, d) => uneBrancheRenommee(n.ref, d.ref) && etend(n.empreinte, d.empreinte)]
  for (const regle of regles) {
    for (const n of nes) {
      if (apparies.has(cleDeSite(n))) continue
      const d = disparus.find((x) => !pris.has(x) && x.fichier === n.fichier && regle(n, x))
      if (d === undefined) continue
      pris.add(d)
      apparies.add(cleDeSite(n))
    }
  }
  return apparies
}

/** Le volet des STRUCTURES LOCALES (#3012) : un site par nœud de schéma, sans compte, mesuré par `sitesDeStructure`
 *  (`structuresLocales.mts`) ; un site né que `renommages` apparie à un disparu n'est pas une naissance. */
export const STRUCTURES_LOCALES = Object.freeze({
  porteur: PORTEURS.STRUCTURES_LOCALES,
  nom: 'STRUCTURES_LOCALES',
  site: cleDeSite,
  nombre: () => 1,
  cible: (_cle, e) => (e.classe === 'D5'
    ? 'Typer le nœud : un `z.unknown()`, `z.any()` ou `z.custom()` ne valide rien.'
    : 'Composer un nœud PARTAGÉ de la grammaire (src/data/schemas/grammaire/) au lieu d’une structure locale au def.'),
  renommages: renommagesDeStructure,
})

/**
 * Tout ce que juge la PORTE DES COMPTES (`jugerLesComptes`, `scripts/guards/lib/corpusDesComptes.mts`) : les collections
 * à compte, comptées par `occurrencesDe`, les volets `DETTE_OPS` et `DETTE_ENVELOPPE`, le plancher `FEUILLES_D_ID`, le
 * volet `STRUCTURES_LOCALES` et le volet `SOURCE_FORMAT` (`scripts/raw/check-source-format.mjs`). Un volet à stock nomme
 * son porteur, l'un de `PORTEURS_SOUS_LA_PORTE` (`porteursDesComptes.mjs`).
 */
export const SOUS_LA_PORTE = Object.freeze([
  ...COLLECTIONS_A_COMPTE.map((c) => Object.freeze({ ...c, nombre: occurrencesDe })),
  DETTE_OPS, DETTE_ENVELOPPE, FEUILLES_D_ID, STRUCTURES_LOCALES, SOURCE_FORMAT,
])

/** Les collections à compte par nom. */
export const COLLECTIONS_A_COMPTE_PAR_NOM = Object.freeze(Object.fromEntries(COLLECTIONS_A_COMPTE.map((c) => [c.nom, c])))

/**
 * Les collections des `modules` de stock dont les entrées portent un COMPTE : un champ numérique autre
 * que l'ordinal `CHAMP_D_OCCURRENCE`. Chacune doit être déclarée dans `COLLECTIONS_A_COMPTE`. PURE.
 * @param {readonly { fichier: string, module: Record<string, unknown> }[]} modules
 * @returns {string[]} `fichier : nom`, dans l'ordre des modules puis de leurs exports.
 */
export function collectionsACompteDe(modules) {
  return modules.flatMap(({ fichier, module }) => Object.entries(module).flatMap(([nom, valeur]) =>
    Array.isArray(valeur) && valeur.some((e) => e && typeof e === 'object' && Object.entries(e).some(([k, v]) => k !== CHAMP_D_OCCURRENCE && typeof v === 'number'))
      ? [`${fichier} : ${nom}`]
      : []))
}

/** Une HISTOIRE de compte écrite en commentaire d'un stock, transition (`a → b`) ou delta signé (`+N :`,
 *  `+N (#M) :`) : le compte vit dans l'entrée, son histoire dans git. */
export const HISTOIRE_DE_COMPTE = /\d+\s*(?:→|->)\s*\d+|(?<![\w.])[+−-]\d+\s*(?:\(#\d+\)\s*)?:/

/**
 * Les commentaires du tableau exporté `nom` de `texte` qui racontent un compte (`HISTOIRE_DE_COMPTE`), avec
 * leur ligne (1-based) : tout commentaire entre les crochets du tableau littéral. PURE.
 * @param {string} texte @param {string} nom @param {string} rel @returns {{ ligne: number, commentaire: string }[]}
 */
export function histoiresDeCompte(texte, nom, rel) {
  const ts = typescript()
  const { sourceFile: sf } = analyserTexte({ rel, text: texte })
  const tableau = sf.statements.filter((s) => ts.isVariableStatement(s)).flatMap((s) => [...s.declarationList.declarations])
    .find((d) => ts.isIdentifier(d.name) && d.name.text === nom)?.initializer
  if (!tableau || !ts.isArrayLiteralExpression(tableau)) return []
  const vus = new Map()
  for (const debut of [...tableau.elements.map((e) => e.pos), tableau.elements.end])
    for (const r of [...(ts.getTrailingCommentRanges(texte, debut) ?? []), ...(ts.getLeadingCommentRanges(texte, debut) ?? [])]) vus.set(r.pos, texte.slice(r.pos, r.end))
  const out = []
  for (const [pos, commentaire] of [...vus].sort(([a], [b]) => a - b))
    if (HISTOIRE_DE_COMPTE.test(commentaire)) out.push({ ligne: sf.getLineAndCharacterOfPosition(pos).line + 1, commentaire })
  return out
}

/**
 * L'écart d'une collection à compte à son stock (`ecartsDeStock`) : le compte sort de la clé, une hausse
 * porte la `cible` de la collection, une baisse la commande qui l'écrit.
 */
export function ecartsDeCollection({ nom, observe, stock, cle, remede = {} }) {
  return ecartsDeStock({
    observe, stock, cle, nombre: occurrencesDe, cible: COLLECTIONS_A_COMPTE_PAR_NOM[nom].cible,
    remede: { ...remede, baisse: () => `écrire la mesure : ${COMMANDE_D_ECRITURE}.` },
  })
}

/**
 * L'écriture des BAISSES mesurées dans les fichiers de stock, PURE. Chaque collection est jugée par son
 * `site` : une identité neuve, disparue ou dupliquée lève ; une HAUSSE refuse TOUT, aucune baisse du même
 * run n'est écrite (`refusDeCroissance`, motif `MOTIF_DECROISSANT`, puis la ligne de chaque site accru et
 * sa `cible`). Les collections d'un même fichier s'écrivent sur un seul texte.
 * @returns {{ refus: string } | { ecritures: { rel: string, texte: string, changements: string[] }[] }}
 */
export function actualiserOccurrences(collections) {
  const refus = collections.flatMap(({ nom, rel, observe, stock, site, cible }) => {
    const ecarts = ecartsDeStock({ observe, stock, cle: site })
    if (ecarts.taille !== stock.length || new Set(observe.map(site)).size !== observe.length)
      throw new Error(`${nom} : identités dupliquées`)
    if (ecarts.neuves.length || ecarts.perimees.length)
      throw new Error(`${nom} : identités inconnues ${ecarts.neuves.join('; ')} ; disparues ${ecarts.perimees.join('; ')}`)
    const r = refusDeCroissance(observe, stock, { cle: site, nombre: occurrencesDe, nom: `${rel} : ${nom}`, motif: MOTIF_DECROISSANT })
    if (r === null) return []
    const { accrues } = ecartsDeStock({ observe, stock, cle: site, nombre: occurrencesDe, cible })
    return [`${r}\n${accrues.map((l) => `  ${l}`).join('\n')}`]
  })
  if (refus.length) return { refus: `${refus.join('\n\n')}\nRien n’est écrit.` }
  const textes = new Map()
  const changements = new Map()
  for (const c of collections) {
    const { texte, sites } = comptesEcrits({ ...c, texte: textes.get(c.rel) ?? c.texte })
    textes.set(c.rel, texte)
    changements.set(c.rel, [...(changements.get(c.rel) ?? []), ...sites])
  }
  return { ecritures: [...textes].map(([rel, texte]) => ({ rel, texte, changements: changements.get(rel) })) }
}

/** Le texte d'une collection à compte réécrit à ses comptes mesurés, et les sites changés. */
function comptesEcrits({ texte, rel, nom, observe, stock, site }) {
  const ts = typescript()
  const { sourceFile: sf, diagnostics } = analyserTexte({ rel, text: texte })
  if (!sf || diagnostics.length) throw new Error(`${nom} : AST invalide`)
  const declarations = sf.statements.filter((s) => ts.isVariableStatement(s)
    && s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    && (s.declarationList.flags & ts.NodeFlags.Const)).flatMap((s) => [...s.declarationList.declarations])
    .filter((d) => ts.isIdentifier(d.name) && d.name.text === nom)
  if (declarations.length !== 1 || !declarations[0].initializer || !ts.isArrayLiteralExpression(declarations[0].initializer))
    throw new Error(`${nom} : export const tableau littéral requis`)
  const mesures = new Map(observe.map((e) => [site(e), e.occurrences]))
  const attendus = new Map(stock.map((e) => [site(e), e]))
  const vus = new Set()
  const remplacements = []
  for (const objet of declarations[0].initializer.elements) {
    if (!ts.isObjectLiteralExpression(objet)) throw new Error(`${nom} : entrée AST non reconnue`)
    const valeurs = {}
    const proprietes = new Map()
    for (const p of objet.properties) {
      if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))
        throw new Error(`${nom} : propriété AST non reconnue`)
      const cle = p.name.text
      if (proprietes.has(cle)) throw new Error(`${nom} : propriété ambiguë ${cle}`)
      proprietes.set(cle, p.initializer)
      if (ts.isStringLiteral(p.initializer)) valeurs[cle] = p.initializer.text
    }
    const cle = site(valeurs)
    const entree = attendus.get(cle)
    if (!entree || vus.has(cle)) throw new Error(`${nom} : identité AST inconnue ou dupliquée ${cle}`)
    vus.add(cle)
    const n = proprietes.get('occurrences')
    const mesure = mesures.get(cle)
    if (!n || !ts.isNumericLiteral(n) || !Number.isSafeInteger(Number(n.text)) || Number(n.text) < 0
      || Number(n.text) !== entree.occurrences || !Number.isSafeInteger(mesure) || mesure < 0)
      throw new Error(`${nom} : occurrences entières littérales requises pour ${cle}`)
    if (Number(n.text) !== mesure) remplacements.push({ debut: n.getStart(sf), fin: n.end, valeur: String(mesure), site: cle })
  }
  if (vus.size !== stock.length) throw new Error(`${nom} : identité AST disparue`)
  remplacements.sort((a, b) => b.debut - a.debut)
  let resultat = texte
  let borne = texte.length
  for (const r of remplacements) {
    if (r.fin > borne) throw new Error(`${nom} : spans recouvrants`)
    resultat = resultat.slice(0, r.debut) + r.valeur + resultat.slice(r.fin)
    borne = r.debut
  }
  return { texte: resultat, sites: remplacements.map((r) => r.site) }
}
