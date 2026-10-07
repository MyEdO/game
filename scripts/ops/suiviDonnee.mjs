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
// précédente — un refus propre au geste (cible absente, étape déjà faite…) nomme son rang et son geste —,
// puis le schéma valide l'état FINAL.
// `sceller` pose `ecritLe` et l'`empreinte` (sha256 du document canonique hors empreinte) ;
// `lireSuivi` la recalcule : une empreinte fausse est un suivi « écrit hors de l'outil », que seule la
// mutation `reconnaitre`, en tête de lot, re-scelle — en le SIGNALANT.
//
// LE BUDGET. Le plan complet (`lignesDuPlan`, `complet`) tient sous `BUDGET_DU_SUIVI` : un lot dont l'état
// FINAL le dépasse ET grossit est refusé, avec ses candidats à condenser ; un lot qui réduit passe (#2460,
// design §6, décision 3).
//
// LA CONFRONTATION (`confronter`) : la projection PURE de (suivi, mesure, autres suivis du dossier), calculée
// à la lecture, jamais stockée (design §5). « Le suivi de vague dit l'état RÉEL de la vague, ou il dit qu'il
// ne le sait pas » (#2460, invariant).
import { createHash } from 'node:crypto'
import { z } from 'zod'

/** Taille maximale (caractères) d'un digest injecté au contexte. Valeur maison. */
export const PLAFOND_INJECTION = 8000
/** Taille maximale (caractères) du plan COMPLET d'un suivi (`tailleDuSuivi`) : il s'injecte entier. */
export const BUDGET_DU_SUIVI = PLAFOND_INJECTION
/** Âge (h) au-delà duquel une mesure est PÉRIMÉE et redemandée (`aMesurer`). Valeur maison. */
export const HEURES_PEREMPTION = 2
/** Candidats de condensation nommés au plus dans un refus de budget. Valeur maison. */
const CANDIDATS_NOMMES = 6

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

/** Le préfixe du signalement que pose `reconnaitre`. PURE. */
const RECONNU = (jour) => `écrit hors de l'outil, reconnu le ${jour} : `

/** Un entier `>= 1` lu dans `texte` (argument du CLI), sinon une erreur qui nomme `quoi`. PURE. */
function entier(texte, quoi) {
  if (!/^\d+$/.test(texte) || Number(texte) < 1) throw new Error(`${quoi} attendu, reçu « ${texte} »`)
  return Number(texte)
}

/** `ticket.n` lu dans `texte` (argument du CLI, `2400.4`). PURE. */
function etapeVisee(texte) {
  const m = /^(\d+)\.(\d+)$/.exec(texte)
  if (!m) throw new Error(`\`ticket.n\` attendu (ex. 2400.4), reçu « ${texte} »`)
  return { ticket: entier(m[1], 'ticket'), n: entier(m[2], 'n') }
}

/**
 * LA table des gestes, UNIQUE (table du §2 du design) : pour chaque geste, ses `champs` (zod), son `effet`
 * — il modifie `s`, copie de travail, ou refuse (`refuser`) ; `jour` : la date du jour (ISO), `instant` :
 * l'instant — et sa forme au CLI : ses `args` (leur nombre est son ARITÉ, fixe ; un texte s'y passe en UN
 * argument cité) et leur conversion `vers` en champs. L'union `Mutation`, l'évaluateur `appliquer` et le
 * parseur du CLI (`FORMES_DU_CLI`) en dérivent.
 */
const GESTES = {
  'creer': {
    champs: { titre: texte(LONGUEUR_COURTE), objectif: texte(LONGUEUR_COURTE).optional() },
    args: ['titre'], vers: ([titre]) => ({ titre }),
    effet: () => refuser('le suivi existe déjà'),
  },
  'ajouter-item': {
    champs: { ticket: Ticket, libelle: texte(LONGUEUR_LIBELLE), etat: EtatItem.optional(), porteur: texte(LONGUEUR_COURTE).optional() },
    args: ['ticket', 'libellé'], vers: ([t, libelle]) => ({ ticket: entier(t, 'ticket'), libelle }),
    effet: (s, m) => {
      s.items.push(sansIndefini({ ticket: m.ticket, libelle: m.libelle, etat: m.etat ?? 'actif', porteur: m.porteur, prochaineEtape: 1, etapes: [] }))
    },
  },
  'etat': {
    champs: { ticket: Ticket, etat: EtatItem },
    args: ['ticket', 'actif|attente|gare|clos'], vers: ([t, etat]) => ({ ticket: entier(t, 'ticket'), etat }),
    effet: (s, m) => { itemDe(s, m.ticket).etat = m.etat },
  },
  'condenser': {
    champs: { ticket: Ticket, resume: texte(LONGUEUR_LIBELLE) },
    args: ['ticket', 'résumé'], vers: ([t, resume]) => ({ ticket: entier(t, 'ticket'), resume }),
    effet: (s, m) => {
      const item = itemDe(s, m.ticket)
      if (item.etat !== 'clos') refuser(`item #${m.ticket} « ${item.etat} » : seul un item clos se condense`)
      item.libelle = m.resume
      item.etapes = []
    },
  },
  'retirer-item': {
    champs: { ticket: Ticket },
    args: ['ticket'], vers: ([t]) => ({ ticket: entier(t, 'ticket') }),
    effet: (s, m) => {
      const item = itemDe(s, m.ticket)
      if (item.etat !== 'clos') refuser(`item #${m.ticket} « ${item.etat} » : seul un item clos se retire`)
      s.items = s.items.filter((i) => i !== item)
    },
  },
  'ajouter-etape': {
    champs: { ticket: Ticket, texte: texte(LONGUEUR_ETAPE) },
    args: ['ticket', 'texte'], vers: ([t, txt]) => ({ ticket: entier(t, 'ticket'), texte: txt }),
    effet: (s, m, { instant }) => {
      const item = itemDe(s, m.ticket)
      item.etapes.push({ n: item.prochaineEtape, texte: m.texte, faite: false, date: instant })
      item.prochaineEtape += 1
    },
  },
  'cocher': {
    champs: { ticket: Ticket, n: Rang },
    args: ['ticket.n'], vers: ([e]) => etapeVisee(e),
    effet: (s, m) => {
      const etape = etapeDe(itemDe(s, m.ticket), m.n)
      if (etape.faite) refuser(`étape #${m.ticket}.${m.n} déjà faite`)
      etape.faite = true
    },
  },
  'retirer-etape': {
    champs: { ticket: Ticket, n: Rang },
    args: ['ticket.n'], vers: ([e]) => etapeVisee(e),
    effet: (s, m) => {
      const item = itemDe(s, m.ticket)
      const etape = etapeDe(item, m.n)
      item.etapes = item.etapes.filter((e) => e !== etape)
    },
  },
  'enfiler': {
    champs: { ticket: Ticket, libelle: texte(LONGUEUR_LIBELLE), bloquePar: z.array(Ticket).optional() },
    args: ['ticket', 'libellé'], vers: ([t, libelle]) => ({ ticket: entier(t, 'ticket'), libelle }),
    effet: (s, m) => { s.file.push(sansIndefini({ ticket: m.ticket, libelle: m.libelle, bloquePar: m.bloquePar })) },
  },
  'placer': {
    champs: { ticket: Ticket, apres: Ticket.nullable() },
    args: ['ticket', 'après|tete'], vers: ([t, a]) => ({ ticket: entier(t, 'ticket'), apres: a === 'tete' ? null : entier(a, 'ticket après') }),
    effet: (s, m) => {
      const [entree] = s.file.splice(rangDeFile(s, m.ticket), 1)
      if (m.apres === m.ticket) refuser(`#${m.ticket} ne se place pas après lui-même`)
      const k = m.apres === null ? 0 : rangDeFile(s, m.apres) + 1
      s.file.splice(k, 0, entree)
    },
  },
  'defiler': {
    champs: { ticket: Ticket },
    args: ['ticket'], vers: ([t]) => ({ ticket: entier(t, 'ticket') }),
    effet: (s, m) => { s.file.splice(rangDeFile(s, m.ticket), 1) },
  },
  'demarrer': {
    champs: { ticket: Ticket },
    args: ['ticket'], vers: ([t]) => ({ ticket: entier(t, 'ticket') }),
    effet: (s, m) => {
      const [entree] = s.file.splice(rangDeFile(s, m.ticket), 1)
      s.items.push({ ticket: entree.ticket, libelle: entree.libelle, etat: 'actif', prochaineEtape: 1, etapes: [] })
    },
  },
  'arbitrer': {
    champs: {
      date: Jour, nature: Nature, verbatim: texte(LONGUEUR_VERBATIM, { ligne: false }).optional(), texte: texte(LONGUEUR_TEXTE).optional(),
      portee: texte(LONGUEUR_COURTE).optional(), tickets: z.array(Ticket).optional(),
    },
    args: ['utilisateur|ingenierie', 'AAAA-MM-JJ', 'verbatim|texte'],
    vers: ([nature, date, t]) => ({ nature, date, [nature === 'utilisateur' ? 'verbatim' : 'texte']: t }),
    effet: (s, m) => {
      const { geste: _g, ...champs } = m
      s.arbitrages.push(sansIndefini({ n: tirer(s, 'arbitrage'), ...champs }))
    },
  },
  'retirer-arbitrage': {
    champs: { n: Rang },
    args: ['n'], vers: ([n]) => ({ n: entier(n, 'n') }),
    effet: (s, m) => retirerN(s, 'arbitrages', m.n),
  },
  'signaler': {
    champs: { texte: texte(LONGUEUR_TEXTE), tickets: z.array(Ticket).optional() },
    args: ['texte'], vers: ([txt]) => ({ texte: txt }),
    effet: (s, m, { jour }) => { s.aSignaler.push(sansIndefini({ n: tirer(s, 'signalement'), date: jour, texte: m.texte, tickets: m.tickets })) },
  },
  'retirer-signalement': {
    champs: { n: Rang },
    args: ['n'], vers: ([n]) => ({ n: entier(n, 'n') }),
    effet: (s, m) => retirerN(s, 'aSignaler', m.n),
  },
  'friction': {
    champs: { texte: texte(LONGUEUR_TEXTE) },
    args: ['texte'], vers: ([txt]) => ({ texte: txt }),
    effet: (s, m, { jour }) => { s.frictions.push({ n: tirer(s, 'friction'), date: jour, texte: m.texte, verseeA: null }) },
  },
  'verser-friction': {
    champs: { n: Rang, ticket: Ticket },
    args: ['n', 'ticket'], vers: ([n, t]) => ({ n: entier(n, 'n'), ticket: entier(t, 'ticket') }),
    effet: (s, m) => {
      const friction = s.frictions.find((f) => f.n === m.n) ?? refuser(`friction n° ${m.n} absente`)
      friction.verseeA = m.ticket
    },
  },
  'ignorer-anomalie': {
    champs: { genre: texte(LONGUEUR_COURTE), cle: texte(LONGUEUR_COURTE), motif: texte(LONGUEUR_TEXTE) },
    args: ['genre', 'clé', 'motif'], vers: ([genre, cle, motif]) => ({ genre, cle, motif }),
    effet: (s, m, { jour }) => {
      if (s.dispositions.some((d) => d.genre === m.genre && d.cle === m.cle)) refuser(`disposition (${m.genre}, ${m.cle}) déjà posée`)
      s.dispositions.push({ genre: m.genre, cle: m.cle, disposition: 'ignorer', motif: m.motif, date: jour })
    },
  },
  'lever-disposition': {
    champs: { genre: texte(LONGUEUR_COURTE), cle: texte(LONGUEUR_COURTE) },
    args: ['genre', 'clé'], vers: ([genre, cle]) => ({ genre, cle }),
    effet: (s, m) => {
      const k = s.dispositions.findIndex((d) => d.genre === m.genre && d.cle === m.cle)
      if (k < 0) refuser(`disposition (${m.genre}, ${m.cle}) absente`)
      s.dispositions.splice(k, 1)
    },
  },
  'reconnaitre': {
    champs: { motif: texte(LONGUEUR_COURTE) },
    args: ['motif'], vers: ([motif]) => ({ motif }),
    effet: (s, m, { jour }) => { s.aSignaler.push({ n: tirer(s, 'signalement'), date: jour, texte: `${RECONNU(jour)}${m.motif}` }) },
  },
}

/** L'union FERMÉE des mutations, DÉRIVÉE de `GESTES`, discriminée par `geste`. */
export const Mutation = z.discriminatedUnion('geste',
  Object.entries(GESTES).map(([nom, { champs }]) => z.strictObject({ geste: z.literal(nom), ...champs })))

/** Le LOT que porte l'outil et `--lot` : l'épique et ses mutations. */
export const Lot = z.strictObject({ epique: Ticket, mutations: z.array(Mutation).min(1).max(MUTATIONS_PAR_LOT) })

/** La forme CLI de chaque geste, DÉRIVÉE de `GESTES` : option `--<geste>`, `args` (son arité) et `vers`. */
export const FORMES_DU_CLI = Object.fromEntries(Object.entries(GESTES).map(([nom, { args, vers }]) => [nom, { args, vers }]))

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

/** `#a, #b` entre parenthèses, `''` sans ticket. PURE. */
const tickets = (liste) => (liste?.length ? ` (${liste.map((n) => `#${n}`).join(', ')})` : '')

/**
 * Le plan d'un suivi en lignes Markdown : titre, objectif, `anomalies` (lignes déjà rendues), items (sauf
 * `clos` hors `complet`) suivis de leur `etiquettes[ticket]` et leurs étapes NUMÉROTÉES `#ticket.n` (ouvertes
 * seules hors `complet`), file, arbitrages, signalements, frictions (non versées seules hors `complet`),
 * dispositions. PURE.
 * @param {object} suivi
 * @param {{complet: boolean, anomalies?: string[], etiquettes?: Record<number, string>}} params
 * @returns {string[]}
 */
export function lignesDuPlan(suivi, { complet, anomalies = [], etiquettes = {} }) {
  const items = suivi.items.filter((i) => complet || i.etat !== 'clos')
  const frictions = suivi.frictions.filter((f) => complet || f.verseeA === null)
  const section = (titre, lignes) => (lignes.length ? ['', `## ${titre}`, ...lignes] : [])
  const arbitrage = (a) => (a.verbatim !== undefined ? `« ${a.verbatim.replace(/\r?\n/g, ' ')} »${a.texte ? ` — ${a.texte}` : ''}` : a.texte)
  const etiquette = (t) => (etiquettes[t] ? ` · ${etiquettes[t]}` : '')
  return [
    `# ${suivi.titre}`,
    ...(suivi.objectif ? ['', `Objectif : ${suivi.objectif}`] : []),
    ...section('Anomalies', anomalies),
    ...section('Items', items.flatMap((i) => [
      `- #${i.ticket} [${i.etat}] ${i.libelle}${i.porteur ? ` — ${i.porteur}` : ''}${etiquette(i.ticket)}`,
      ...i.etapes.filter((e) => complet || !e.faite).map((e) => `  - [${e.faite ? 'x' : ' '}] #${i.ticket}.${e.n} ${e.texte}`),
    ])),
    ...section('File', suivi.file.map((f, k) => `${k + 1}. #${f.ticket} ${f.libelle}${f.bloquePar?.length ? ` (bloqué par ${f.bloquePar.map((n) => `#${n}`).join(', ')})` : ''}${etiquette(f.ticket)}`)),
    ...section('Arbitrages', suivi.arbitrages.map((a) => `- n° ${a.n}, ${a.date}, ${a.nature}${a.portee ? `, ${a.portee}` : ''}${tickets(a.tickets)} : ${arbitrage(a)}`)),
    ...section('À signaler', suivi.aSignaler.map((s) => `- n° ${s.n}, ${s.date}${tickets(s.tickets)} : ${s.texte}`)),
    ...section('Frictions', frictions.map((f) => `- n° ${f.n}, ${f.date} : ${f.texte}${f.verseeA ? ` → versée à #${f.verseeA}` : ''}`)),
    ...section('Dispositions', suivi.dispositions.map((d) => `- ${d.disposition} ${d.genre} « ${d.cle} », ${d.date} : ${d.motif}`)),
  ]
}

/** La taille (caractères) du plan COMPLET d'un suivi, celle que borne `BUDGET_DU_SUIVI`. PURE. */
export const tailleDuSuivi = (suivi) => lignesDuPlan(suivi, { complet: true }).join('\n').length

/**
 * Les gestes de condensation CANDIDATS d'un suivi, en syntaxe du CLI : retirer ou condenser un item clos,
 * retirer une étape faite, retirer un signalement (le plus ancien d'abord). PURE.
 * @returns {string[]}
 */
function candidatsDeCondensation(suivi) {
  return [
    ...suivi.items.filter((i) => i.etat === 'clos').map((i) => `--retirer-item ${i.ticket}`),
    ...suivi.items.flatMap((i) => i.etapes.filter((e) => e.faite).map((e) => `--retirer-etape ${i.ticket}.${e.n}`)),
    ...suivi.aSignaler.map((s) => `--retirer-signalement ${s.n}`),
  ]
}

/** Les candidats nommés dans un texte, `CANDIDATS_NOMMES` au plus, le reste compté. PURE. */
const candidatsDits = (suivi) => {
  const tous = candidatsDeCondensation(suivi)
  if (!tous.length) return 'aucun candidat mécanique : retirer un arbitrage (`--retirer-arbitrage <n>`) ou condenser un item clos'
  const reste = tous.length - CANDIDATS_NOMMES
  return `candidats : ${tous.slice(0, CANDIDATS_NOMMES).join(' · ')}${reste > 0 ? ` (+${reste})` : ''}`
}

/**
 * Le suivi après le lot `mutations`, TOUT OU RIEN. `suivi` vaut `null` pour un suivi neuf : la première
 * mutation est alors `creer` (le suivi de l'épique `epique`), et `creer` est refusé ailleurs. Chaque
 * mutation est validée (`Mutation`) et appliquée sur l'état laissé par la précédente (`GESTES`) : un refus
 * d'une mutation nomme son rang (1 pour la première) et son geste. L'état FINAL est ensuite validé
 * (`SuiviOuvert`) : un état intermédiaire hors schéma (une 6e étape ouverte que le lot coche ensuite) passe.
 * Le résultat est SCELLÉ à `maintenant` ; `suivi` n'est jamais modifié. PURE.
 * BUDGET : un état final dont le plan complet dépasse `BUDGET_DU_SUIVI` ET grossit par rapport au suivi
 * d'entrée est refusé, ses candidats de condensation nommés. HORS OUTIL (`horsOutil`, un suivi lu au genre
 * `empreinte`) : le lot commence par `reconnaitre`, seul geste qui le re-scelle ; `reconnaitre` est refusé
 * ailleurs. Sa croissance (le signalement qu'il pose) n'entre pas dans le budget : celui-ci se mesure
 * contre l'état reconnu.
 * @param {object|null} suivi
 * @param {unknown[]} mutations
 * @param {{maintenant: Date, epique?: number, horsOutil?: boolean}} params
 * @returns {{ok: true, suivi: object} | {ok: false, refus: string}}
 */
export function appliquer(suivi, mutations, { maintenant, epique, horsOutil = false }) {
  if (!Array.isArray(mutations) || mutations.length === 0) return { ok: false, refus: 'lot vide : au moins une mutation' }
  if (mutations.length > MUTATIONS_PAR_LOT) return { ok: false, refus: `lot de ${mutations.length} mutations : ${MUTATIONS_PAR_LOT} au plus` }
  const instant = maintenant.toISOString()
  const jour = instant.slice(0, 10)
  let s = null
  if (suivi !== null) {
    const { ecritLe: _e, empreinte: _p, ...corps } = suivi
    s = structuredClone(corps)
  }
  let avant = s === null ? 0 : tailleDuSuivi(s)
  for (const [k, brute] of mutations.entries()) {
    const nom = typeof brute?.geste === 'string' ? brute.geste : '?'
    const fautive = (motif) => ({ ok: false, refus: `mutation ${k + 1} (${nom}) : ${motif} — rien n'est écrit` })
    const vue = Mutation.safeParse(brute)
    if (!vue.success) return fautive(`hors schéma : ${probleme(vue.error)}`)
    const m = vue.data
    try {
      if (horsOutil && k === 0 && m.geste !== 'reconnaitre') {
        refuser('suivi écrit hors de l\'outil : `reconnaitre` (`--reconnaitre <motif>`), en tête de lot, le re-scelle en le signalant')
      }
      if (m.geste === 'reconnaitre' && (!horsOutil || k > 0)) {
        refuser('`reconnaitre` ne vaut qu\'en tête de lot, sur un suivi lu « écrit hors de l\'outil »')
      }
      if (s === null) {
        if (m.geste !== 'creer') refuser('suivi absent : la première mutation d\'un suivi neuf est `creer`')
        if (!Number.isInteger(epique) || epique < 1) refuser('épique inconnue pour `creer`')
        s = suiviNeuf(epique, m)
      } else {
        GESTES[m.geste].effet(s, m, { instant, jour })
      }
    } catch (e) {
      if (e instanceof Refus) return fautive(e.message)
      throw e
    }
    if (m.geste === 'reconnaitre') avant = tailleDuSuivi(s)
  }
  const final = SuiviOuvert.safeParse(s)
  if (!final.success) return { ok: false, refus: `lot refusé : l'état final est hors schéma : ${probleme(final.error)} — rien n'est écrit` }
  const apres = tailleDuSuivi(s)
  if (apres > BUDGET_DU_SUIVI && apres > avant) {
    return {
      ok: false,
      refus: `lot refusé : le suivi ferait ${apres} caractères (${avant} avant), au-delà du budget de ${BUDGET_DU_SUIVI} — `
        + `condenser dans le même lot, ou avant ; ${candidatsDits(s)} — rien n'est écrit`,
    }
  }
  return { ok: true, suivi: sceller(s, { maintenant }) }
}

/** Le document `<N>.mesure.json`, tel que `mesurerLeSuivi` (scripts/ops/suiviMesure.mjs) l'écrit. */
const Mesure = z.looseObject({
  version: z.literal(1), epique: Ticket, date: Instant, sansFetch: z.boolean(),
  portee: z.array(z.number().int()), ok: z.boolean(), refus: z.string().nullable(),
  lignes: z.array(z.looseObject({ ticket: z.number().int() })),
  vivants: z.array(z.strictObject({
    branche: z.string(), tickets: z.array(z.number().int()), avance: z.number().int(), retard: z.number().int(), worktrees: z.array(z.string()),
    dernierCommit: z.string(), sale: z.boolean(),
  })),
  anomalies: z.array(z.strictObject({ genre: z.string(), cle: z.string(), texte: z.string(), vueDepuis: Instant })),
})

/**
 * La mesure lue : `null` absente, `{ ok: false, refus }` illisible (JSON, ou forme d'avant), `{ ok: true, mesure }`. PURE.
 * @param {string|null} contenu
 */
export function lireMesure(contenu) {
  if (contenu === null) return null
  let brut
  try {
    brut = JSON.parse(contenu)
  } catch (e) {
    return { ok: false, refus: `JSON invalide (${e.message})` }
  }
  const vu = Mesure.safeParse(brut)
  return vu.success ? { ok: true, mesure: vu.data } : { ok: false, refus: `hors schéma : ${probleme(vu.error)}` }
}

/** L'âge (h) d'une mesure à `maintenant`. PURE. */
export const heuresDe = (mesure, maintenant) => (maintenant.getTime() - new Date(mesure.date).getTime()) / 3_600_000

/** `AAAA-MM-JJ HH:MM`, heure LOCALE. PURE. */
export const horodatage = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} `
  + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/** Les lignes de la mesure d'un suivi lu, datée ; sa péremption et ses anomalies sont à la confrontation. PURE. */
export function lignesDeLaMesure({ epique, mesure }) {
  const rafraichir = `\`npm run ops:suivi -- ${epique} --mesurer\``
  if (mesure === null) return ['## Mesure', `jamais mesurée : ${rafraichir}`]
  if (!mesure.ok) return ['## Mesure', `⚠ mesure illisible (${mesure.refus}) : ${rafraichir}`]
  const m = mesure.mesure
  const ligne = (l) => `- #${l.ticket} ${l.statut} · issue ${l.etatIssue} · ${(l.branches ?? []).join(' ') || 'sans branche'} · `
    + `avance ${l.avance || '—'} · dernier commit ${l.dernierCommit || '—'}${l.worktrees?.length ? ` · ${l.worktrees.join(' ')}` : ''}`
  return [
    '## Mesure',
    `mesurée le ${horodatage(new Date(m.date))}${m.sansFetch ? ' (sans fetch)' : ''}`,
    ...(m.ok ? m.lignes.map(ligne) : [`**Mesure refusée** : ${m.refus}`]),
  ]
}

/** Les tickets d'un suivi : ses items et sa file. PURE. */
export const porteeDe = (suivi) => [...suivi.items, ...suivi.file].map((e) => e.ticket)

/**
 * Une ANOMALIE de la confrontation : celle de la mesure (`board.mjs`), étendue de sa forme `court` pour le
 * bandeau ; son `texte` va au contexte. Une ALERTE est une anomalie rendue en tête.
 * @typedef {import('./board.mjs').Anomalie & {court: string}} Anomalie
 */

/**
 * Les genres d'anomalie de la mesure qui QUALIFIENT la mesure au lieu de dire un écart du suivi à la
 * réalité : la mesure les porte déjà (`sansFetch`), la ligne de mesure les dit ; `confronter` ne les rend pas.
 */
const QUALIFIENT_LA_MESURE = new Set(['origin-non-rafraichi'])

/** L'anomalie `genre`/`cle`. PURE. @returns {Anomalie} */
const anomalie = (genre, cle, court, texte = court) => ({ genre, cle, court, texte })

/**
 * La CONFRONTATION d'un suivi à sa mesure et aux autres suivis du dossier (#2460, design §5). PURE.
 * - `alertes` (ligne 1 du bandeau) : mesure absente, illisible, PÉRIMÉE (au-delà de `HEURES_PEREMPTION`),
 *   portée changée depuis elle ; chacune met `aMesurer` ;
 * - `anomalies`, dans l'ordre : ticket fermé d'un item non clos ou d'une entrée de file, et item clos dont
 *   le ticket est ouvert (1) ; chantier vivant que ne nomme AUCUN suivi (2) ; prochain geste antérieur à
 *   l'issue ou à la publication, heuristique « à revalider » (3) ; mesure refusée ; budget (6) ; anomalies
 *   de la mesure neuves, une par une, puis les RÉCURRENTES (`vueDepuis` antérieur à la mesure) en UNE (9),
 *   hors des genres qui qualifient la mesure (`QUALIFIENT_LA_MESURE`) ;
 *   disposition sans objet (9). Une disposition `ignorer` tait l'anomalie de même (genre, cle) ;
 * - `taisees` : le compte des anomalies tues ;
 * - `etiquettes` (10) : par ticket, « lot publié le <date>, ticket ouvert » (`Fusionné`) ou « clos » (`Fermé`).
 * Sans mesure lisible et réussie, seuls les alertes, la mesure refusée et le budget se calculent.
 * @param {{suivi: object, mesure: ReturnType<typeof lireMesure>, autresSuivis?: object[], maintenant: Date}} params
 * @returns {{alertes: Anomalie[], anomalies: Anomalie[], taisees: number, aMesurer: boolean, etiquettes: Record<number, string>}}
 */
export function confronter({ suivi, mesure, autresSuivis = [], maintenant }) {
  const alertes = []
  const brutes = []
  const etiquettes = {}
  const relancer = 're-mesure demandée'
  let m = null
  if (mesure === null) alertes.push(anomalie('mesure-absente', 'mesure', `jamais mesurée (${relancer})`))
  else if (!mesure.ok) alertes.push(anomalie('mesure-illisible', 'mesure', `mesure illisible (${relancer})`, `mesure illisible : ${mesure.refus} (${relancer})`))
  else {
    m = mesure.mesure
    if (heuresDe(m, maintenant) > HEURES_PEREMPTION) {
      alertes.push(anomalie('mesure-perimee', 'mesure', `mesure PÉRIMÉE (${relancer})`, `mesure PÉRIMÉE : plus de ${HEURES_PEREMPTION} h (${relancer})`))
    }
    const portee = new Set(porteeDe(suivi))
    if (portee.size !== m.portee.length || m.portee.some((t) => !portee.has(t))) {
      alertes.push(anomalie('portee-changee', 'mesure', `portée changée depuis la mesure (${relancer})`))
    }
    if (!m.ok) brutes.push(anomalie('mesure-refusee', 'mesure', 'mesure refusée', `mesure refusée : ${m.refus}`))
  }
  const taille = tailleDuSuivi(suivi)
  if (m?.ok) {
    const lignes = new Map(m.lignes.map((l) => [l.ticket, l]))
    for (const { ticket } of [...suivi.items, ...suivi.file]) {
      const l = lignes.get(ticket)
      if (l?.statut === 'Fusionné') etiquettes[ticket] = `lot publié le ${l.dernierCommit || '?'}, ticket ouvert`
      else if (l?.statut === 'Fermé') etiquettes[ticket] = 'clos'
    }
    for (const i of suivi.items) {
      const etat = lignes.get(i.ticket)?.etatIssue
      if (i.etat !== 'clos' && etat === 'fermé') {
        brutes.push(anomalie('ticket-ferme', `#${i.ticket}`, `#${i.ticket} fermé`, `#${i.ticket} fermé, item « ${i.etat} » : \`--etat ${i.ticket} clos\``))
      } else if (i.etat === 'clos' && etat === 'ouvert') {
        brutes.push(anomalie('clos-ticket-ouvert', `#${i.ticket}`, `#${i.ticket} clos, ticket ouvert`, `#${i.ticket} clos au suivi, ticket OUVERT : le rouvrir (\`--etat ${i.ticket} actif\`) ou fermer le ticket`))
      }
    }
    for (const f of suivi.file) {
      if (lignes.get(f.ticket)?.etatIssue === 'fermé') brutes.push(anomalie('ticket-ferme', `#${f.ticket}`, `#${f.ticket} fermé`, `#${f.ticket} fermé, en file : \`--defiler ${f.ticket}\``))
    }
    const nommes = new Set([suivi, ...autresSuivis].flatMap(porteeDe))
    for (const v of m.vivants) {
      if (v.tickets.some((t) => nommes.has(t))) continue
      brutes.push(anomalie('chantier-sans-item', v.branche, `${v.branche} sans item`,
        `${v.branche}${tickets(v.tickets)} vivant (+${v.avance} / −${v.retard}${v.worktrees.length ? `, ${v.worktrees.join(' · ')}` : ''}), `
        + 'nommé par AUCUN suivi : `--ajouter-item`, ou `--ignorer-anomalie chantier-sans-item <branche> <motif>`'))
    }
    for (const i of suivi.items.filter((x) => x.etat === 'actif')) {
      const e = i.etapes.find((x) => !x.faite)
      const l = lignes.get(i.ticket)
      if (!e || !l) continue
      const raison = l.issueMiseAJour && new Date(e.date) < new Date(l.issueMiseAJour) ? `l'issue, mise à jour le ${l.issueMiseAJour.slice(0, 10)}`
        : l.statut === 'Fusionné' && e.date.slice(0, 10) < l.dernierCommit ? `la publication du ${l.dernierCommit}` : null
      if (raison) {
        brutes.push(anomalie('geste-a-revalider', `#${i.ticket}.${e.n}`, `#${i.ticket}.${e.n} à revalider`,
          `prochain geste #${i.ticket}.${e.n} écrit le ${e.date.slice(0, 10)}, antérieur à ${raison} — heuristique, à revalider`))
      }
    }
  }
  if (taille > BUDGET_DU_SUIVI) {
    brutes.push(anomalie('budget', 'budget', `hors budget (${taille}/${BUDGET_DU_SUIVI})`,
      `hors budget : ${taille} caractères pour ${BUDGET_DU_SUIVI} ; seuls les lots qui réduisent passent — ${candidatsDits(suivi)}`))
  }
  const mesurees = m?.ok ? m.anomalies.filter((a) => !QUALIFIENT_LA_MESURE.has(a.genre)) : []
  const toutes = [...brutes, ...mesurees]
  const tue = (a) => suivi.dispositions.some((d) => d.genre === a.genre && d.cle === a.cle)
  const anomalies = brutes.filter((a) => !tue(a))
  const vives = mesurees.filter((a) => !tue(a))
  const neuves = vives.filter((a) => a.vueDepuis >= m.date)
  const recurrentes = vives.filter((a) => a.vueDepuis < m.date)
  anomalies.push(...neuves.map((a) => anomalie(a.genre, a.cle, `${a.genre} ${a.cle}`, a.texte)))
  if (recurrentes.length) {
    const depuis = recurrentes.map((a) => a.vueDepuis).sort()[0].slice(0, 10)
    anomalies.push(anomalie('recurrentes', 'recurrentes', `${recurrentes.length} récurrente(s) depuis le ${depuis}`,
      `${recurrentes.length} anomalie(s) de mesure récurrente(s) depuis le ${depuis}, sans disposition : `
      + `${recurrentes.map((a) => `${a.genre} « ${a.cle} »`).join(' · ')} — \`--ignorer-anomalie <genre> <clé> <motif>\` en tait une`))
  }
  if (m?.ok) {
    for (const d of suivi.dispositions.filter((x) => !toutes.some((a) => a.genre === x.genre && a.cle === x.cle))) {
      anomalies.push(anomalie('disposition-sans-objet', `${d.genre} ${d.cle}`, `disposition sans objet : ${d.genre} ${d.cle}`,
        `disposition sans objet : ${d.genre} « ${d.cle} » n'apparaît plus — \`--lever-disposition ${d.genre} ${d.cle}\``))
    }
  }
  return { alertes, anomalies, taisees: toutes.filter(tue).length, aMesurer: alertes.length > 0, etiquettes }
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
