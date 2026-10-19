// COLLECTIONS À COMPTE (#2705) : les stocks dont chaque entrée porte un COMPTE d'occurrences
// (`occurrences`), déclarés UNE fois ici — leur porteur (fichier de stock), leur nom, l'identité de site d'une entrée, sa
// MESURE dans le corpus scanné, et la CIBLE qui solde une hausse. Les contrats
// (`src/data/structures-contrat.test.ts`, `src/data/slots-contrat.test.ts`), l'écrivain
// (`scripts/guards/occurrences-structures.mts`) et la porte de plage (`scripts/guards/comptes-plage.mts`)
// lisent cette liste.
import { analyserTexte, typescript } from './dialecte.mjs'
import { CHAMP_D_OCCURRENCE, ecartsDeStock, refusDeCroissance } from './stock.mjs'
import { MOTIF_DECROISSANT } from './stockDeSites.mjs'
import { ciblesDuSite } from '../../docs/lib/structures-lexique.mts'
import { SOURCE_FORMAT } from '../../raw/check-source-format.mjs'
import { PORTEURS } from './porteursDesComptes.mjs'

export const siteDeForme = (f) => `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature}`
export const siteDeSlot = (s) => `${s.dataset} | ${s.champ}`
/** Le détail d'une divergence d'enveloppe qui en dit l'IDENTITÉ (la classe d'un `type divergent`) ; celui d'une
 *  `cible partielle` est un ratio de comptes, hors identité. */
const detailIdentitaire = (e) => (e.motif === 'cible partielle' || !e.detail ? '' : `:${e.detail}`)
export const siteDEnveloppe = (e) => `${e.role} | ${e.cle} | ${e.motif}${detailIdentitaire(e)} | ${e.document} › ${e.chemin}`
const siteDeRedeclaration = (r) => `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun}`

/** Le compte d'une entrée de collection à compte. */
export const occurrencesDe = (e) => e.occurrences

/** La commande qui écrit les BAISSES mesurées. */
export const COMMANDE_D_ECRITURE = 'node scripts/lancer-local.mjs tsx -- tsx scripts/guards/occurrences-structures.mts --write'

const cibleDeForme = (_cle, f) => {
  const cibles = ciblesDuSite(f.concept, f.dataset, f.champ)
  return cibles.length
    ? `Migrer ce site vers une forme CIBLE du lexique (${cibles.map((c) => `\`${c}\``).join(', ')} ; scripts/docs/lib/structures-lexique.mts).`
    : 'Aucune cible déclarée à ce site : décider la cible (lexique + `STRUCTURES_CIBLES`) ou bloquer le lot sur sa migration.'
}

/**
 * Une op observée est une DETTE de L1c (#1468) quand son payload n'est pas typé — op de `OPS_NON_TYPEES`, ou
 * op que `OP_DEFS` ne connaît pas — ou quand, typée, elle porte une référence À PLAT là où la cible l'emboîte :
 * une clé de sa signature que `typage.aPlat` déclare feuille `idDe` du payload. `typage` = les ops de `OP_DEFS`,
 * `OPS_NON_TYPEES` et `aPlat` (`refsAPlat`, `corpusDesComptes.mts`) du schéma mesuré. PURE.
 */
export const estDetteDOp = (o, { types, nonTypees, aPlat }) =>
  !types.includes(o.op) || nonTypees.includes(o.op) || o.signature.split(',').some((k) => aPlat[o.op]?.includes(k) ?? false)

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
 * Les collections à compte. `mesure` lit le CORPUS `{ scan, sansSlot, inatteignables, redeclarations, typage }`
 * (`corpusDesComptes`, `scripts/guards/lib/corpusDesComptes.mts`) ; `site` est l'identité d'une entrée hors
 * compte et hors pilotage ; `cible` la phrase de la voie qui solde une hausse de ce site.
 */
export const COLLECTIONS_A_COMPTE = Object.freeze([
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_FORMES', site: siteDeForme, cible: cibleDeForme,
    mesure: ({ scan }) => scan.formes.filter((f) => f.statut === 'historique' || f.statut === 'divergente') },
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_OPS', site: (o) => `${o.op} | ${o.signature} | ${o.dataset}`,
    cible: () => 'Migrer la signature vers la cible L1c : union discriminée d’`OP_DEFS`, refs EMBOÎTÉES (`gameOpSchema`, src/data/schemas/grammaire/mecanique.ts).',
    mesure: ({ scan, typage }) => scan.ops.filter((o) => estDetteDOp(o, typage)) },
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_HOMONYMES', site: (h) => h.cle,
    cible: () => 'Migrer : un nom de concept est RÉSERVÉ à son type (#1463 S2), la valeur hors concept change de clé.',
    mesure: ({ scan }) => scan.homonymes.map((h) => ({ cle: h.cle, classes: h.classes, occurrences: h.total })) },
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_ENVELOPPE', site: siteDEnveloppe,
    cible: () => 'Migrer : l’enveloppe porte sa clé CIBLE (`ROLES_ENVELOPPE`, scripts/docs/lib/structures-lexique.mts) — L1b #1467, L1d #1469.',
    mesure: ({ scan }) => scan.enveloppe.map((e) => ({ ...e, occurrences: e.entrees })) },
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_REDECLARATIONS', site: siteDeRedeclaration,
    cible: (_cle, r) => `Migrer : composer ${r.commun ? `\`${r.commun}\`` : 'le nœud commun'} de la grammaire (src/data/schemas/grammaire/) au lieu de le re-taper.`,
    mesure: ({ redeclarations }) => redeclarationsComptees(redeclarations) },
  { porteur: PORTEURS.STRUCTURES, nom: 'STRUCTURES_ORPHELINES', site: (o) => `${o.dataset} | ${o.champ} | ${o.signature}`,
    cible: () => 'Migrer : un nom de concept est RÉSERVÉ à son type (#1463 S2) — la clé qui annonce une référence porte une référence qui résout, ou change de nom.',
    mesure: ({ scan }) => scan.orphelines },
  { porteur: PORTEURS.SLOTS, nom: 'SLOTS_SANS_DECLARATION', site: siteDeSlot,
    cible: () => 'Migrer : adopter la fabrique `ref`/`refs`/`specRef`/`pick` (`idDe`) sur le schéma du champ.',
    mesure: ({ sansSlot }) => sansSlot },
  { porteur: PORTEURS.SLOTS, nom: 'SLOTS_INATTEIGNABLES', site: siteDeSlot,
    cible: () => 'Migrer : la référence se pose en chaîne, pour qu’une case de l’occurrence la porte (`ANGLES_MORTS_SLOTS`).',
    mesure: ({ inatteignables }) => inatteignables },
].map((c) => Object.freeze(c)))

/**
 * Tout ce que juge la PORTE DES COMPTES (`jugerLesComptes`, `scripts/guards/lib/corpusDesComptes.mts`) : les collections
 * à compte, comptées par `occurrencesDe`, et le volet `SOURCE_FORMAT` (`scripts/raw/check-source-format.mjs`). Chaque
 * porteur est l'un de `PORTEURS_SOUS_LA_PORTE` (`porteursDesComptes.mjs`).
 */
export const SOUS_LA_PORTE = Object.freeze([...COLLECTIONS_A_COMPTE.map((c) => Object.freeze({ ...c, nombre: occurrencesDe })), SOURCE_FORMAT])

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
