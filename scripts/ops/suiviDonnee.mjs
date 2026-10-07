// LA DONNÉE du suivi de vague, `.git/suivi/<N>.json` : son schéma (zod, le validateur de
// `scripts/ops/session-runtime.mjs`), ses mutations et leur évaluateur `appliquer`, son empreinte, sa
// lecture `lireSuivi` et la définition de l'outil MCP qui l'écrit. PUR : ni fichier, ni mesure, ni
// `board.mjs` ; la garde d'écriture, le hook de session et le mod l'importent sans charger la mesure.
//
// « Le faite que tu le fichier soit un fichier .md que tu modifie a la main est un soucis. Ca aurait du
// etre un json modifiable que via des outils adaptés, histoire d'éviter de faire n'importe quoi dessus,
// non ? » (utilisateur, 2026-10-07, #2460). Design jugé : #2460, commentaire 6044039158, §1 et §2.
//
// IDENTITÉS. Un item ou une entrée de file par `ticket`, unique sur `items ∪ file` ; une étape par
// `(ticket, n)`, `n` tiré de `prochaineEtape`, jamais réutilisé ; un arbitrage, un signalement, une
// friction par `n`, tiré de `compteurs`. Aucune position n'identifie quoi que ce soit.
//
// ÉTATS d'item : l'intention de l'orchestrateur (`actif | attente | gare | clos`), jamais un état de
// branche, d'issue ou de publication : la mesure les porte (`<N>.mesure.json`).
//
// ÉCRITURE. `appliquer` est TOUT OU RIEN : chaque mutation s'applique sur l'état laissé par la
// précédente, l'état est validé après chacune, et un refus nomme le rang et le geste fautifs.
// `sceller` pose `ecritLe` et l'`empreinte` (sha256 du document canonique hors empreinte) ;
// `lireSuivi` la recalcule : une empreinte fausse est un suivi « écrit hors de l'outil ».
import { createHash } from 'node:crypto'
import { z } from 'zod'

/** Version du format. */
const VERSION_DU_SUIVI = 1
/** Longueur maximale (caractères) d'un libellé d'item ou d'entrée de file. Valeur maison. */
export const LONGUEUR_LIBELLE = 120
/** Longueur maximale (caractères) d'une étape. Valeur maison. */
export const LONGUEUR_ETAPE = 200
/** Étapes au plus par item. Valeur maison. */
const ETAPES_PAR_ITEM = 12
/** Étapes OUVERTES au plus par item. Valeur maison. */
export const ETAPES_OUVERTES_PAR_ITEM = 5
/** Longueur maximale (caractères) d'un verbatim d'arbitrage. Valeur maison. */
const LONGUEUR_VERBATIM = 1000
/** Longueur maximale (caractères) d'un texte : résumé, arbitrage d'ingénierie, signalement, friction, motif. Valeur maison. */
const LONGUEUR_TEXTE = 300
/** Longueur maximale (caractères) d'un titre, d'un objectif, d'une portée, d'un porteur, d'un genre. Valeur maison. */
const LONGUEUR_COURTE = 200
/** Mutations au plus par lot. Valeur maison. */
const MUTATIONS_PAR_LOT = 20

/** Un SECRET probable : 64 caractères hexadécimaux d'un tenant (jeton `ops:session`, empreinte). */
const SECRET = /[0-9a-fA-F]{64}/
/** Une tête de liste Markdown : case `[ ]`/`[x]`, puce, numéro. */
const PREFIXE_DE_LISTE = /^\s*(?:\[[ xX]\]|[-*+]\s|\d+\.\s)/

const sansSecret = (s) => !SECRET.test(s)
/** Un texte borné, sans secret ; `ligne` : une seule ligne, sans tête de liste Markdown. */
const texte = (max, { ligne = true } = {}) => {
  const base = z.string().trim().min(1).max(max).refine(sansSecret, 'porte 64 caractères hexadécimaux (un secret ?) : retirer')
  return ligne
    ? base.refine((s) => !/[\r\n]/.test(s), 'une seule ligne').refine((s) => !PREFIXE_DE_LISTE.test(s), 'sans tête de liste Markdown (`[ ]`, `-`, `1.`)')
    : base
}
const Ticket = z.number().int().min(1)
const Rang = z.number().int().min(1)
const EtatItem = z.enum(['actif', 'attente', 'gare', 'clos'])
const Nature = z.enum(['utilisateur', 'ingenierie'])
const Jour = z.iso.date()
const Instant = z.iso.datetime()

const Etape = z.strictObject({ n: Rang, texte: texte(LONGUEUR_ETAPE), faite: z.boolean(), date: Instant })
const Item = z.strictObject({
  ticket: Ticket, libelle: texte(LONGUEUR_LIBELLE), etat: EtatItem, porteur: texte(LONGUEUR_COURTE).optional(),
  prochaineEtape: Rang, etapes: z.array(Etape).max(ETAPES_PAR_ITEM),
}).superRefine((item, ctx) => {
  const ns = item.etapes.map((e) => e.n)
  if (new Set(ns).size !== ns.length) ctx.addIssue({ code: 'custom', message: `étape en double dans l'item #${item.ticket}` })
  if (ns.some((n) => n >= item.prochaineEtape)) ctx.addIssue({ code: 'custom', message: `étape de l'item #${item.ticket} au-delà de prochaineEtape` })
  const ouvertes = item.etapes.filter((e) => !e.faite).length
  if (ouvertes > ETAPES_OUVERTES_PAR_ITEM) ctx.addIssue({ code: 'custom', message: `item #${item.ticket} : ${ouvertes} étapes ouvertes, ${ETAPES_OUVERTES_PAR_ITEM} au plus` })
})
const EntreeDeFile = z.strictObject({ ticket: Ticket, libelle: texte(LONGUEUR_LIBELLE), bloquePar: z.array(Ticket).optional() })
const Arbitrage = z.strictObject({
  n: Rang, date: Jour, nature: Nature, verbatim: texte(LONGUEUR_VERBATIM, { ligne: false }).optional(),
  texte: texte(LONGUEUR_TEXTE).optional(), portee: texte(LONGUEUR_COURTE).optional(), tickets: z.array(Ticket).optional(),
}).refine((a) => a.nature !== 'utilisateur' || a.verbatim !== undefined, 'un arbitrage utilisateur porte son verbatim')
  .refine((a) => a.verbatim !== undefined || a.texte !== undefined, 'un arbitrage porte un verbatim ou un texte')
const Signalement = z.strictObject({ n: Rang, date: Jour, texte: texte(LONGUEUR_TEXTE), tickets: z.array(Ticket).optional() })
const Friction = z.strictObject({ n: Rang, date: Jour, texte: texte(LONGUEUR_TEXTE), verseeA: Ticket.nullable() })
const Disposition = z.strictObject({
  genre: texte(LONGUEUR_COURTE), cle: texte(LONGUEUR_COURTE), disposition: z.literal('ignorer'), motif: texte(LONGUEUR_TEXTE), date: Jour,
})
const Compteurs = z.strictObject({ arbitrage: z.number().int().min(0), signalement: z.number().int().min(0), friction: z.number().int().min(0) })

/** Les listes numérotées par `compteurs`, et leur compteur. */
const NUMEROTEES = [['arbitrages', 'arbitrage'], ['aSignaler', 'signalement'], ['frictions', 'friction']]

/** Le corps du suivi, hors scellé (`ecritLe`, `empreinte`). */
const Corps = {
  version: z.literal(VERSION_DU_SUIVI), epique: Ticket, titre: texte(LONGUEUR_COURTE), objectif: texte(LONGUEUR_COURTE).nullable(),
  compteurs: Compteurs, items: z.array(Item), file: z.array(EntreeDeFile), arbitrages: z.array(Arbitrage),
  aSignaler: z.array(Signalement), frictions: z.array(Friction), dispositions: z.array(Disposition),
}

/** Les refus d'identité d'un suivi : ticket en double sur `items ∪ file`, `n` en double ou au-delà de son compteur. PURE. */
function identites(suivi, ctx) {
  const tickets = [...suivi.items.map((i) => ['items', i.ticket]), ...suivi.file.map((f) => ['file', f.ticket])]
  const vus = new Map()
  for (const [ou, ticket] of tickets) {
    if (vus.has(ticket)) ctx.addIssue({ code: 'custom', message: `doublon : le ticket #${ticket} est deux fois sur items ∪ file (${vus.get(ticket)}, ${ou})` })
    else vus.set(ticket, ou)
  }
  for (const [liste, compteur] of NUMEROTEES) {
    const ns = suivi[liste].map((e) => e.n)
    if (new Set(ns).size !== ns.length) ctx.addIssue({ code: 'custom', message: `doublon : un n en double dans ${liste}` })
    if (ns.some((n) => n > suivi.compteurs[compteur])) ctx.addIssue({ code: 'custom', message: `${liste} : un n au-delà de compteurs.${compteur}` })
  }
  const cles = suivi.dispositions.map((d) => `${d.genre}\u0000${d.cle}`)
  if (new Set(cles).size !== cles.length) ctx.addIssue({ code: 'custom', message: 'doublon : une disposition en double (genre, cle)' })
}

/** Le suivi NON scellé : l'état sur lequel `appliquer` travaille. */
const SuiviOuvert = z.strictObject(Corps).superRefine(identites)

/** Le schéma de `.git/suivi/<N>.json`. */
const Suivi = z.strictObject({ ...Corps, ecritLe: Instant, empreinte: z.string().regex(/^[0-9a-f]{64}$/) }).superRefine(identites)

const geste = (nom, champs) => z.strictObject({ geste: z.literal(nom), ...champs })

/** L'union FERMÉE des mutations (table du §2 du design), discriminée par `geste`. */
export const Mutation = z.discriminatedUnion('geste', [
  geste('creer', { titre: texte(LONGUEUR_COURTE), objectif: texte(LONGUEUR_COURTE).optional() }),
  geste('ajouter-item', { ticket: Ticket, libelle: texte(LONGUEUR_LIBELLE), etat: EtatItem.optional(), porteur: texte(LONGUEUR_COURTE).optional() }),
  geste('etat', { ticket: Ticket, etat: EtatItem }),
  geste('condenser', { ticket: Ticket, resume: texte(LONGUEUR_LIBELLE) }),
  geste('retirer-item', { ticket: Ticket }),
  geste('ajouter-etape', { ticket: Ticket, texte: texte(LONGUEUR_ETAPE) }),
  geste('cocher', { ticket: Ticket, n: Rang }),
  geste('retirer-etape', { ticket: Ticket, n: Rang }),
  geste('enfiler', { ticket: Ticket, libelle: texte(LONGUEUR_LIBELLE), bloquePar: z.array(Ticket).optional() }),
  geste('placer', { ticket: Ticket, apres: Ticket.nullable() }),
  geste('defiler', { ticket: Ticket }),
  geste('demarrer', { ticket: Ticket }),
  geste('arbitrer', {
    date: Jour, nature: Nature, verbatim: texte(LONGUEUR_VERBATIM, { ligne: false }).optional(), texte: texte(LONGUEUR_TEXTE).optional(),
    portee: texte(LONGUEUR_COURTE).optional(), tickets: z.array(Ticket).optional(),
  }),
  geste('retirer-arbitrage', { n: Rang }),
  geste('signaler', { texte: texte(LONGUEUR_TEXTE), tickets: z.array(Ticket).optional() }),
  geste('retirer-signalement', { n: Rang }),
  geste('friction', { texte: texte(LONGUEUR_TEXTE) }),
  geste('verser-friction', { n: Rang, ticket: Ticket }),
  geste('ignorer-anomalie', { genre: texte(LONGUEUR_COURTE), cle: texte(LONGUEUR_COURTE), motif: texte(LONGUEUR_TEXTE) }),
  geste('lever-disposition', { genre: texte(LONGUEUR_COURTE), cle: texte(LONGUEUR_COURTE) }),
])

/** Le LOT que porte l'outil et `--lot` : l'épique et ses mutations. */
export const Lot = z.strictObject({ epique: Ticket, mutations: z.array(Mutation).min(1).max(MUTATIONS_PAR_LOT) })

/** Le premier problème d'un échec zod, `chemin : message`. PURE. */
const probleme = (erreur) => {
  const [p] = erreur.issues
  return p ? `${p.path.length ? `${p.path.join('.')} : ` : ''}${p.message}` : String(erreur)
}

/** Le JSON CANONIQUE d'une valeur : clés triées à chaque niveau. PURE. */
const canonique = (v) => (Array.isArray(v)
  ? `[${v.map(canonique).join(',')}]`
  : v !== null && typeof v === 'object'
    ? `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonique(v[k])}`).join(',')}}`
    : JSON.stringify(v))

/** L'empreinte d'un suivi : sha256 de son document canonique, `empreinte` exclue. PURE. */
const empreinteDe = (suivi) => {
  const { empreinte: _ignoree, ...corps } = suivi
  return createHash('sha256').update(canonique(corps)).digest('hex')
}

/** Le suivi SCELLÉ à `maintenant` : `ecritLe` et `empreinte` posés. PURE. */
export function sceller(suivi, { maintenant }) {
  const date = { ...suivi, ecritLe: maintenant.toISOString() }
  delete date.empreinte
  return { ...date, empreinte: empreinteDe(date) }
}

/** Le texte d'un suivi scellé, tel qu'il s'écrit sur disque. PURE. */
export const texteDuSuivi = (suivi) => `${JSON.stringify(suivi, null, 2)}\n`

/**
 * La lecture d'un suivi : JSON, schéma (identités comprises), empreinte. Un refus porte son `genre` :
 * `json`, `schema` (dont `doublon`), `empreinte` ; ce dernier rend aussi le `suivi` lu, valide mais
 * écrit hors de l'outil. PURE.
 * @param {string} contenu
 * @returns {{ok: true, suivi: object} | {ok: false, genre: 'json'|'schema'|'empreinte', refus: string, suivi?: object}}
 */
export function lireSuivi(contenu) {
  let brut
  try {
    brut = JSON.parse(contenu)
  } catch (e) {
    return { ok: false, genre: 'json', refus: `JSON invalide (${e.message})` }
  }
  const vu = Suivi.safeParse(brut)
  if (!vu.success) return { ok: false, genre: 'schema', refus: `hors schéma : ${probleme(vu.error)}` }
  if (empreinteDe(vu.data) !== vu.data.empreinte) {
    return { ok: false, genre: 'empreinte', refus: 'écrit hors de l\'outil : l\'empreinte ne correspond pas au contenu', suivi: vu.data }
  }
  return { ok: true, suivi: vu.data }
}

/** Le suivi neuf de `creer`. PURE. */
const suiviNeuf = (epique, { titre, objectif }) => ({
  version: VERSION_DU_SUIVI, epique, titre, objectif: objectif ?? null, compteurs: { arbitrage: 0, signalement: 0, friction: 0 },
  items: [], file: [], arbitrages: [], aSignaler: [], frictions: [], dispositions: [],
})

/** Une erreur de mutation, rattrapée par `appliquer`. */
class Refus extends Error {}
const refuser = (motif) => { throw new Refus(motif) }

const itemDe = (s, ticket) => s.items.find((i) => i.ticket === ticket) ?? refuser(`item #${ticket} absent`)
const etapeDe = (item, n) => item.etapes.find((e) => e.n === n) ?? refuser(`étape #${item.ticket}.${n} absente`)
const rangDeFile = (s, ticket) => {
  const k = s.file.findIndex((f) => f.ticket === ticket)
  return k >= 0 ? k : refuser(`#${ticket} absent de la file`)
}
const tirer = (s, compteur) => { s.compteurs[compteur] += 1; return s.compteurs[compteur] }
const retirerN = (s, liste, n) => {
  const k = s[liste].findIndex((e) => e.n === n)
  if (k < 0) refuser(`${liste} n° ${n} absent`)
  s[liste].splice(k, 1)
}
const sansIndefini = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/** Chaque geste : il modifie `s` (copie de travail) ou refuse. `jour` : la date du jour (ISO), `instant` : l'instant. */
const EFFETS = {
  'creer': () => refuser('le suivi existe déjà'),
  'ajouter-item': (s, m) => {
    s.items.push(sansIndefini({ ticket: m.ticket, libelle: m.libelle, etat: m.etat ?? 'actif', porteur: m.porteur, prochaineEtape: 1, etapes: [] }))
  },
  'etat': (s, m) => { itemDe(s, m.ticket).etat = m.etat },
  'condenser': (s, m) => {
    const item = itemDe(s, m.ticket)
    if (item.etat !== 'clos') refuser(`item #${m.ticket} « ${item.etat} » : seul un item clos se condense`)
    item.libelle = m.resume
    item.etapes = []
  },
  'retirer-item': (s, m) => {
    const item = itemDe(s, m.ticket)
    if (item.etat !== 'clos') refuser(`item #${m.ticket} « ${item.etat} » : seul un item clos se retire`)
    s.items = s.items.filter((i) => i !== item)
  },
  'ajouter-etape': (s, m, { instant }) => {
    const item = itemDe(s, m.ticket)
    item.etapes.push({ n: item.prochaineEtape, texte: m.texte, faite: false, date: instant })
    item.prochaineEtape += 1
  },
  'cocher': (s, m) => {
    const etape = etapeDe(itemDe(s, m.ticket), m.n)
    if (etape.faite) refuser(`étape #${m.ticket}.${m.n} déjà faite`)
    etape.faite = true
  },
  'retirer-etape': (s, m) => {
    const item = itemDe(s, m.ticket)
    const etape = etapeDe(item, m.n)
    item.etapes = item.etapes.filter((e) => e !== etape)
  },
  'enfiler': (s, m) => { s.file.push(sansIndefini({ ticket: m.ticket, libelle: m.libelle, bloquePar: m.bloquePar })) },
  'placer': (s, m) => {
    const [entree] = s.file.splice(rangDeFile(s, m.ticket), 1)
    if (m.apres === m.ticket) refuser(`#${m.ticket} ne se place pas après lui-même`)
    const k = m.apres === null ? 0 : rangDeFile(s, m.apres) + 1
    s.file.splice(k, 0, entree)
  },
  'defiler': (s, m) => { s.file.splice(rangDeFile(s, m.ticket), 1) },
  'demarrer': (s, m) => {
    const [entree] = s.file.splice(rangDeFile(s, m.ticket), 1)
    s.items.push({ ticket: entree.ticket, libelle: entree.libelle, etat: 'actif', prochaineEtape: 1, etapes: [] })
  },
  'arbitrer': (s, m) => {
    const { geste: _g, ...champs } = m
    s.arbitrages.push(sansIndefini({ n: tirer(s, 'arbitrage'), ...champs }))
  },
  'retirer-arbitrage': (s, m) => retirerN(s, 'arbitrages', m.n),
  'signaler': (s, m, { jour }) => { s.aSignaler.push(sansIndefini({ n: tirer(s, 'signalement'), date: jour, texte: m.texte, tickets: m.tickets })) },
  'retirer-signalement': (s, m) => retirerN(s, 'aSignaler', m.n),
  'friction': (s, m, { jour }) => { s.frictions.push({ n: tirer(s, 'friction'), date: jour, texte: m.texte, verseeA: null }) },
  'verser-friction': (s, m) => {
    const friction = s.frictions.find((f) => f.n === m.n) ?? refuser(`friction n° ${m.n} absente`)
    friction.verseeA = m.ticket
  },
  'ignorer-anomalie': (s, m, { jour }) => {
    if (s.dispositions.some((d) => d.genre === m.genre && d.cle === m.cle)) refuser(`disposition (${m.genre}, ${m.cle}) déjà posée`)
    s.dispositions.push({ genre: m.genre, cle: m.cle, disposition: 'ignorer', motif: m.motif, date: jour })
  },
  'lever-disposition': (s, m) => {
    const k = s.dispositions.findIndex((d) => d.genre === m.genre && d.cle === m.cle)
    if (k < 0) refuser(`disposition (${m.genre}, ${m.cle}) absente`)
    s.dispositions.splice(k, 1)
  },
}

/**
 * Le suivi après le lot `mutations`, TOUT OU RIEN. `suivi` vaut `null` pour un suivi neuf : la première
 * mutation est alors `creer` (le suivi de l'épique `epique`), et `creer` est refusé ailleurs. Chaque
 * mutation est validée (`Mutation`), appliquée sur l'état laissé par la précédente, puis l'état est validé
 * (`SuiviOuvert`). Le résultat est SCELLÉ à `maintenant`. Un refus nomme le rang (1 pour la première) et le
 * geste ; `suivi` n'est jamais modifié. PURE.
 * @param {object|null} suivi
 * @param {unknown[]} mutations
 * @param {{maintenant: Date, epique?: number}} params
 * @returns {{ok: true, suivi: object} | {ok: false, refus: string}}
 */
export function appliquer(suivi, mutations, { maintenant, epique }) {
  if (!Array.isArray(mutations) || mutations.length === 0) return { ok: false, refus: 'lot vide : au moins une mutation' }
  if (mutations.length > MUTATIONS_PAR_LOT) return { ok: false, refus: `lot de ${mutations.length} mutations : ${MUTATIONS_PAR_LOT} au plus` }
  const instant = maintenant.toISOString()
  const jour = instant.slice(0, 10)
  let s = null
  if (suivi !== null) {
    const { ecritLe: _e, empreinte: _p, ...corps } = suivi
    s = structuredClone(corps)
  }
  for (const [k, brute] of mutations.entries()) {
    const nom = typeof brute?.geste === 'string' ? brute.geste : '?'
    const fautive = (motif) => ({ ok: false, refus: `mutation ${k + 1} (${nom}) : ${motif} — rien n'est écrit` })
    const vue = Mutation.safeParse(brute)
    if (!vue.success) return fautive(`hors schéma : ${probleme(vue.error)}`)
    const m = vue.data
    try {
      if (s === null) {
        if (m.geste !== 'creer') refuser('suivi absent : la première mutation d\'un suivi neuf est `creer`')
        if (!Number.isInteger(epique) || epique < 1) refuser('épique inconnue pour `creer`')
        s = suiviNeuf(epique, m)
      } else {
        EFFETS[m.geste](s, m, { instant, jour })
      }
    } catch (e) {
      if (e instanceof Refus) return fautive(e.message)
      throw e
    }
    const etat = SuiviOuvert.safeParse(s)
    if (!etat.success) return fautive(`l'état produit est hors schéma : ${probleme(etat.error)}`)
  }
  return { ok: true, suivi: sceller(s, { maintenant }) }
}

/** L'outil MCP qui écrit le suivi : son `inputSchema` est DÉRIVÉ de `Lot` (`z.toJSONSchema`). */
export const OUTIL_SUIVI = {
  name: 'suivi',
  description: 'Écrit le suivi de vague `.git/suivi/<epique>.json` par un lot de mutations, TOUT OU RIEN, et lie cette '
    + 'session à l’épique. Identités : un item par ticket, une étape par (ticket, n) — `n` est rendu numéroté `#ticket.n` '
    + 'dans le contexte —, un arbitrage, un signalement, une friction par `n`. Un suivi neuf commence par `creer`. '
    + 'Rend la situation du suivi.',
  inputSchema: z.toJSONSchema(Lot),
}
