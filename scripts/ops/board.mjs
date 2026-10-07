// BOARD DES CHANTIERS — l'état d'un chantier ne se SAISIT pas, il se MESURE : le Project GitHub n'en
// est qu'une PROJECTION, rejouable et idempotente.
//
// « Bon deja faudrait mettre un board sur notre git, on bosse sur pleins de chantier différent en
// même temps et difficile de savoir ce qui est en cours, a mergé, etc ... » (utilisateur, 2026-09-15)
//
// Invariant du régime (#1750, verbatim) : « Le régime est déclaré UNE fois dans le dépôt (…) et les
// outils `scripts/ops/*` le LISENT : un geste du régime qu'une session doit encore savoir par cœur
// est un défaut d'outillage. Chaque outil se joue depuis n'importe quel worktree du dépôt (la racine
// mesurée est `git rev-parse --git-common-dir`, jamais le dossier du script), refuse NOMMÉMENT ce
// qu'il ne sait pas faire, et laisse une trace machine de ce qu'il a fait (journal, log,
// commentaire). »
//
// LA BASE DE MESURE EST UN PARAMÈTRE, ET LE CLI LA FIXE À `origin/main` APRÈS `fetch` — le `main`
// LOCAL n'est jamais la base. Mesure du 2026-09-15, AVANT la remise à niveau de `main` : le `main`
// local de l'arbre principal était à `e6c11db77`, `origin/main` à `3113daad1`, soit 2 commits
// d'avance et 56 de retard ; la MÊME mesure rendait « 9 chantiers en cours à +40…+56 » contre `main`
// local, alors que contre `origin/main` 9 branches étaient à 0 d'avance et une seule en cours (+1).
// Une base fausse rend donc un board entièrement faux, sans rien dire.
//
// CE QUI EST IGNORÉ, ET POURQUOI : une branche sans avance ET sans worktree n'a plus rien à suivre
// (son travail est dans la base, son arbre est retiré) — la poser au board ferait grossir un tableau
// de choses finies. Une branche sans avance MAIS avec un worktree posé, elle, demande un geste : son
// arbre occupe le disque, et c'est ce que dit l'état « Fusionné ».
//
// Usage : `npm run ops:board` (mesurer puis synchroniser) · `-- --liste` (mesurer et IMPRIMER, aucun
// appel d'écriture, aucun Project requis ; `--sans-fetch` y tolère un `origin` injoignable) ·
// `-- --creer` (créer le Project « Chantiers », ses champs et son lien au dépôt, puis synchroniser).
import { TRONC, arbrePrincipal, branchesDe, depotDe, divergenceDe, fetchOrigin, journalDe, refusDeGit, reussi } from '../guards/lib/gitPorte.mjs'
import { numerosDeLaChaine } from '../guards/lib/fermetures.mjs'
import { inventaire } from './worktrees.mjs'
import { DEPOT, appelGhRunner, pagesRest } from '../guards/lib/ticketsGh.mjs'

/** Le propriétaire du Project (un Project d'UTILISATEUR, pas d'organisation). */
export const PROPRIETAIRE = 'cgauche'
/** Le titre qui IDENTIFIE le Project : un second Project de même titre serait le même board. */
export const TITRE_PROJECT = 'Chantiers'
/** La référence de base de toute mesure d'avance/retard. */
export const BASE = TRONC.suivi
/** Au-delà de ce nombre de jours sans commit, un chantier en avance est DORMANT. */
export const JOURS_DORMANT = 7
/** Fenêtre de lecture des tickets cités par les commits de la base. */
export const JOURS_FUSION_RECENTE = 14

const MS_JOUR = 24 * 60 * 60 * 1000

/**
 * Les cinq statuts, du plus VIVANT au plus mort — l'ordre sert au tri ET à la fusion des branches
 * d'un même ticket. `Ouvert` et `Fusionné` disent deux choses différentes sur une branche à 0 commit
 * d'avance : `Fusionné` EXIGE la preuve qu'un commit de la base cite le ticket dans la fenêtre ;
 * sans cette preuve, rien n'a encore été publié depuis ce chantier, il est seulement `Ouvert`.
 */
export const STATUTS = ['En cours', 'Dormant', 'Ouvert', 'Fusionné', 'Fermé']

/** La couleur de chaque option, dans le vocabulaire de `ProjectV2SingleSelectFieldOptionColor`. */
export const COULEURS_STATUT = Object.freeze({
  'En cours': 'GREEN', Dormant: 'ORANGE', Ouvert: 'YELLOW', Fusionné: 'BLUE', Fermé: 'GRAY',
})

/**
 * Les champs du board, déclarés UNE fois. `type` est la valeur `--data-type` de `gh`.
 *
 * LE STATUT EST PORTÉ PAR LE CHAMP INTÉGRÉ `Status`, dont les OPTIONS sont réécrites : la vue Board
 * de GitHub groupe par `Status`, donc un second champ « Statut » obligerait à re-régler la vue à la
 * main et laisserait une colonne « Todo » morte à côté des nôtres.
 */
export const CHAMPS = Object.freeze([
  Object.freeze({ nom: 'Status', type: 'SINGLE_SELECT', options: Object.freeze([...STATUTS]) }),
  Object.freeze({ nom: 'Branche', type: 'TEXT' }),
  Object.freeze({ nom: 'Worktree', type: 'TEXT' }),
  Object.freeze({ nom: 'Avance', type: 'TEXT' }),
  Object.freeze({ nom: 'Dernier commit', type: 'DATE' }),
])

/** Les branches qu'aucun chantier ne porte : la base et les deux préfixes de sauvegarde. */
const EXCLUES = [/^main$/, /^backup\//, /^sauvegarde\//]

/**
 * Le motif de CITATION dans un message de commit : un mot-clé puis une CHAÎNE de `#N`
 * (`refs #1392 #1388` cite les DEUX — mesuré sur 14 j d'`origin/main` : ne garder que le premier
 * perdait 8 citations de #1644 et 5 de #1673). Un `#N` nu, hors chaîne, n'est pas une citation.
 */
const CITATION = /\b(refs?|corrige|fixes|closes|ferme)((?:[ \t]*,?[ \t]*#\d+)+)/gi

// ————————————————————————————————— fonctions PURES —————————————————————————————————

/**
 * Clé de COMPARAISON d'un nom de champ : `gh` sérialise les valeurs de champ d'un item sous un nom
 * DÉRIVÉ du libellé (casse et espaces compris), et cette dérivation n'est pas un contrat public. La
 * comparaison se fait donc sur une forme sans casse, sans accent et sans séparateur — « Dernier
 * commit », « dernier commit » et « dernierCommit » désignent le même champ. PURE.
 * @param {string} nom @returns {string}
 */
export const cleNormalisee = (nom) => String(nom ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '')

/** `true` si cette branche est celle d'un chantier (ni la base, ni une sauvegarde). PUR. */
export const estBrancheDeChantier = (nom) => !EXCLUES.some((re) => re.test(String(nom ?? '')))

/** La colonne « Avance » d'une branche. PURE. */
export const avanceDite = ({ avance = 0, retard = 0 }) => `+${avance} / −${retard}`

/**
 * Les tickets CITÉS par un texte de commit, et leur nombre de citations. PURE.
 * @param {string} texte @returns {Map<number, number>}
 */
export function ticketsCites(texte) {
  const comptes = new Map()
  for (const [, , chaine] of String(texte ?? '').matchAll(CITATION)) {
    for (const n of numerosDeLaChaine(chaine).map(Number)) comptes.set(n, (comptes.get(n) ?? 0) + 1)
  }
  return comptes
}

/** Le ticket le PLUS cité d'un texte ; à égalité, le plus petit numéro. `null` si aucun. PUR. */
export function ticketLePlusCite(texte) {
  const comptes = [...ticketsCites(texte)]
  if (!comptes.length) return null
  comptes.sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
  return comptes[0][0]
}

/**
 * Les tickets d'une branche : d'abord son NOM (tout segment purement numérique de ≥ 3 chiffres,
 * séparé par `/`, `-` ou `_`), sinon le ticket le plus cité par les messages de ses commits
 * d'avance. Vide = la branche ne se rattache à aucun ticket, et c'est une anomalie que l'appelant
 * NOMME. PURE.
 * @param {string} nomDeBranche @param {string} [messagesDAvance]
 * @returns {number[]}
 */
export function ticketsDe(nomDeBranche, messagesDAvance = '') {
  const duNom = String(nomDeBranche ?? '')
    .split(/[/\-_]/)
    .filter((segment) => /^\d{3,}$/.test(segment))
    .map(Number)
  if (duNom.length) return [...new Set(duNom)]
  const cite = ticketLePlusCite(messagesDAvance)
  return cite === null ? [] : [cite]
}

/**
 * Le statut d'UNE branche portant un ticket. `Fermé` PRIME : un ticket clos ne redevient pas vivant
 * parce qu'une branche traîne. À 0 commit d'avance, `citeParLaBase` décide entre `Fusionné` (un commit
 * de la base cite le ticket dans la fenêtre : le travail est publié) et `Ouvert` (rien n'est encore
 * parti de ce chantier — cas mesuré de #1768 et #1392, à +0/−0). PURE.
 * @param {{avance?: number, dernierCommitISO?: string, issue?: {state?: string}|null,
 *   citeParLaBase?: boolean}} mesure
 * @param {{maintenant?: Date, joursDormant?: number}} [cadre]
 * @returns {'En cours'|'Dormant'|'Ouvert'|'Fusionné'|'Fermé'}
 */
export function statutDe({ avance = 0, dernierCommitISO = '', issue = null, citeParLaBase = false },
  { maintenant = new Date(), joursDormant = JOURS_DORMANT } = {}) {
  if (String(issue?.state ?? '').toUpperCase() === 'CLOSED') return 'Fermé'
  if (avance <= 0) return citeParLaBase ? 'Fusionné' : 'Ouvert'
  const age = maintenant.getTime() - new Date(dernierCommitISO).getTime()
  if (!Number.isFinite(age)) return 'Dormant'
  return age <= joursDormant * MS_JOUR ? 'En cours' : 'Dormant'
}

/** Des deux statuts, le plus VIVANT (`En cours` > `Dormant` > `Fusionné` > `Fermé`). PUR. */
export function statutLePlusVivant(a, b) {
  if (!a) return b
  if (!b) return a
  return STATUTS.indexOf(a) <= STATUTS.indexOf(b) ? a : b
}

/**
 * Le JOUR d'un instant ISO, tel que `branchesDe`/`journalDe` le rendent : il porte le fuseau du
 * committer, donc ses 10 premiers caractères SONT la date locale du commit. Un `toISOString()`
 * reculerait d'un jour tout commit du soir sous un fuseau à l'est de UTC. PUR.
 */
export const jourDe = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(String(iso ?? '')) ? String(iso).slice(0, 10) : '')

/**
 * Les lignes du board, UNE PAR TICKET : les branches d'un même ticket fusionnent en une ligne, qui
 * prend le statut le plus vivant et liste TOUT ce qui le porte. PURE.
 *
 * UN TICKET SEULEMENT CITÉ PAR LA BASE ET DÉJÀ CLOS NE FAIT PAS DE LIGNE : son travail est publié et
 * son issue est fermée, il n'y a plus de geste à voir. `Fermé` ne reste donc à l'écran que pour un
 * ticket clos qui a ENCORE une branche ou un worktree — le stock à nettoyer.
 *
 * `fusionnes` porte TOUS les tickets cités par la base dans la fenêtre, branche vivante comprise :
 * c'est la PREUVE de publication qui distingue `Fusionné` d'`Ouvert` à 0 commit d'avance.
 *
 * AVEC UNE `portee` (les tickets prévus d'un suivi de vague, `scripts/ops/suivi.mjs`), les lignes
 * sont EXACTEMENT celles de la portée, dans SON ordre : un ticket clos garde sa ligne, un ticket sans
 * branche ni publication reçoit `branches: []` et le statut de son issue, un ticket absent de
 * `issues` prend le statut `Introuvable`. Sans portée, `Introuvable` n'apparaît jamais.
 * `etatIssue` et `issueMiseAJour` (l'`updatedAt` de l'issue, `''` sans elle) sont posés sur TOUTE ligne,
 * lus dans `issues`.
 * @param {{branches?: {nom: string, avance: number, retard: number, dernierCommitISO: string,
 *   tickets: number[], worktrees?: string[]}[],
 *   fusionnes?: {ticket: number, dateISO: string}[],
 *   issues?: Map<number, {state?: string, closedAt?: string|null, updatedAt?: string|null}>,
 *   portee?: number[]|null}} mesure
 * @param {{maintenant?: Date, joursDormant?: number}} [cadre]
 * @returns {{ticket: number, statut: string, etatIssue: 'ouvert'|'fermé'|'introuvable', issueMiseAJour: string,
 *   branches: string[], worktrees: string[], avance: string, dernierCommit: string}[]}
 */
export function construireLignes({ branches = [], fusionnes = [], issues = new Map(), portee = null },
  { maintenant = new Date(), joursDormant = JOURS_DORMANT } = {}) {
  const prevus = portee === null ? null : new Set(portee.map(Number))
  const parTicket = new Map()
  const citees = new Set(fusionnes.map((f) => Number(f.ticket)))
  const poser = (ticket) => {
    if (!parTicket.has(ticket)) {
      parTicket.set(ticket, {
        ticket,
        statut: null,
        branches: [],
        worktrees: [],
        avances: [],
        dernierCommitISO: '',
      })
    }
    return parTicket.get(ticket)
  }

  for (const branche of branches) {
    for (const ticket of branche.tickets ?? []) {
      const ligne = poser(ticket)
      ligne.branches.push(branche.nom)
      ligne.avances.push(avanceDite(branche))
      for (const w of branche.worktrees ?? []) if (!ligne.worktrees.includes(w)) ligne.worktrees.push(w)
      if (branche.dernierCommitISO > ligne.dernierCommitISO) ligne.dernierCommitISO = branche.dernierCommitISO
      ligne.statut = statutLePlusVivant(ligne.statut, statutDe({
        avance: branche.avance,
        dernierCommitISO: branche.dernierCommitISO,
        issue: issues.get(ticket) ?? null,
        citeParLaBase: citees.has(Number(ticket)),
      }, { maintenant, joursDormant }))
    }
  }

  for (const { ticket, dateISO } of fusionnes) {
    if (parTicket.has(ticket)) continue
    const issue = issues.get(ticket) ?? null
    if (String(issue?.state ?? '').toUpperCase() === 'CLOSED' && !prevus?.has(Number(ticket))) continue
    const ligne = poser(ticket)
    ligne.dernierCommitISO = dateISO
    ligne.statut = statutDe(
      { avance: 0, dernierCommitISO: dateISO, issue, citeParLaBase: true },
      { maintenant, joursDormant },
    )
  }

  for (const ticket of prevus ?? []) {
    if (parTicket.has(ticket)) continue
    poser(ticket).statut = statutDe({ avance: 0, issue: issues.get(ticket) ?? null }, { maintenant, joursDormant })
  }

  const lignes = [...parTicket.values()]
    .map(({ avances, dernierCommitISO, ...reste }) => ({
      ...reste,
      statut: prevus && !issues.has(reste.ticket) ? 'Introuvable' : reste.statut,
      etatIssue: etatIssueDe(issues.get(reste.ticket)),
      issueMiseAJour: issues.get(reste.ticket)?.updatedAt ?? '',
      avance: avances.join(' · '),
      dernierCommit: jourDe(dernierCommitISO),
    }))
    .sort((a, b) => (STATUTS.indexOf(a.statut) - STATUTS.indexOf(b.statut)) || (a.ticket - b.ticket))
  if (!prevus) return lignes
  const parNumero = new Map(lignes.map((l) => [Number(l.ticket), l]))
  return [...prevus].map((ticket) => parNumero.get(ticket))
}

/** L'état d'une issue lue par `indexerIssues`, ou `introuvable` si elle n'y est pas. PUR. */
const etatIssueDe = (issue) => {
  if (!issue) return 'introuvable'
  return String(issue.state ?? '').toUpperCase() === 'CLOSED' ? 'fermé' : 'ouvert'
}

/** Les valeurs de champ attendues pour une ligne, keyées par NOM de champ. PURE. */
export function valeursDeLigne(ligne) {
  return {
    Status: ligne.statut ?? '',
    Branche: (ligne.branches ?? []).join(' · '),
    Worktree: (ligne.worktrees ?? []).join(' · '),
    Avance: ligne.avance ?? '',
    'Dernier commit': ligne.dernierCommit ?? '',
  }
}

/** La valeur d'un champ d'item, cherchée par NOM normalisé (cf. `cleNormalisee`). PURE. */
export function valeurDeChamp(champs, nom) {
  const valeur = (champs ?? {})[cleNormalisee(nom)]
  return valeur === undefined || valeur === null ? '' : String(valeur)
}

/** Deux valeurs de champ disent-elles la même chose ? Une DATE ne se compare que sur son jour. PURE. */
export function memeValeur(nomDuChamp, attendue, presente) {
  const declare = CHAMPS.find((c) => c.nom === nomDuChamp)
  const forme = (v) => (declare?.type === 'DATE' ? String(v ?? '').slice(0, 10) : String(v ?? ''))
  return forme(attendue) === forme(presente)
}

/**
 * Le plan de synchronisation : ce qui MANQUE, ce qui DIFFÈRE, ce qui est ARCHIVABLE — et rien
 * d'autre. Rien n'est jamais supprimé. PURE.
 *
 * LE CYCLE DE VIE D'UN ITEM SE LIT SUR LA MESURE, PAS SUR UN DÉLAI : une ligne MESURÉE reste visible
 * tant que sa branche ou son worktree existe (une ligne `Fermé` est précisément le stock à nettoyer),
 * et un item n'est archivé que quand son ticket n'est PLUS mesuré ET que son issue est CLOSE. Un item
 * non mesuré dont l'issue est OUVERTE n'est pas touché : c'est une ligne posée à la main.
 * @param {ReturnType<typeof construireLignes>} lignes
 * @param {{id: string, ticket: number, champs: Record<string, unknown>}[]} itemsExistants
 * @param {{issues?: Map<number, {state?: string}>}} [cadre] état des issues des items existants
 * @returns {{ajouts: number[], editions: {itemId: string, champ: string, valeur: string}[], archivages: string[]}}
 */
export function planDeSync(lignes, itemsExistants = [], { issues = new Map() } = {}) {
  const parTicket = new Map(itemsExistants.map((i) => [Number(i.ticket), i]))
  const mesures = new Map(lignes.map((l) => [Number(l.ticket), l]))
  const plan = { ajouts: [], editions: [], archivages: [] }
  for (const ligne of lignes) {
    const item = parTicket.get(Number(ligne.ticket))
    if (!item) {
      plan.ajouts.push(ligne.ticket)
      continue
    }
    for (const [champ, valeur] of Object.entries(valeursDeLigne(ligne))) {
      if (!memeValeur(champ, valeur, valeurDeChamp(item.champs, champ))) {
        plan.editions.push({ itemId: item.id, champ, valeur })
      }
    }
  }
  for (const item of itemsExistants) {
    if (mesures.has(Number(item.ticket))) continue
    const etat = String(issues.get(Number(item.ticket))?.state ?? '').toUpperCase()
    if (etat === 'CLOSED') plan.archivages.push(item.id)
  }
  return plan
}

/**
 * Les entrées de `repos/<dépôt>/issues?state=all` → l'état des tickets DEMANDÉS, et une anomalie
 * (`anomalie`, genre `ticket-introuvable`, clé `#N`) par numéro absent de la liste. PURE.
 * La route `/issues` sert AUSSI les pull requests : une charge portant `pull_request` est ÉCARTÉE —
 * sans quoi une PR dont le numéro coïncide avec un ticket cité par une branche rendrait l'état d'un
 * objet qui n'est pas ce ticket (mesuré 2026-09-19 : 9 PR parmi les 1827 entrées de la liste).
 * La forme rendue est CELLE QUE LISENT les consommateurs : `state` en MAJUSCULES (REST rend
 * `open`/`closed`), `closed_at` sous `closedAt` et `updated_at` sous `updatedAt`, une seule forme dans la carte plutôt qu'une
 * normalisation reportée sur chaque lecteur (`statutDe`, `construireLignes`, `planDeSync`).
 * @param {unknown} entrees @param {number[]} numeros
 * @returns {{issues: Map<number, {number:number, state:string, closedAt:string|null, updatedAt:string|null, title:string}>,
 *   anomalies: Anomalie[]}}
 */
export function indexerIssues(entrees, numeros) {
  const parNumero = new Map()
  for (const entree of Array.isArray(entrees) ? entrees : []) {
    if (entree?.pull_request) continue
    const numero = Number(entree?.number)
    if (!Number.isFinite(numero)) continue
    parNumero.set(numero, {
      number: numero,
      state: String(entree?.state ?? '').toUpperCase(),
      closedAt: entree?.closed_at ?? null,
      updatedAt: entree?.updated_at ?? null,
      title: String(entree?.title ?? ''),
    })
  }
  const issues = new Map()
  const anomalies = []
  for (const numero of [...new Set(numeros.map(Number))].sort((a, b) => a - b)) {
    const vue = parNumero.get(numero)
    if (vue) issues.set(numero, vue)
    else anomalies.push(anomalie('ticket-introuvable', `#${numero}`, `ticket #${numero} introuvable dans ${DEPOT}`))
  }
  return { issues, anomalies }
}

/**
 * Une branche de chantier est VIVANTE quand un de ses worktrees est SALE, ou quand elle a de l'avance ET un
 * worktree, ou un dernier commit de moins de `joursFusionRecente` jours. Une vieille branche sans worktree, ou
 * une branche fusionnée (+0) au worktree propre, ne l'est pas. PURE.
 * @param {{avance: number, worktrees: string[], dernierCommit: string, sale: boolean}} branche
 * @param {{maintenant: Date, joursFusionRecente?: number}} cadre
 * @returns {boolean}
 */
export function estVivante({ avance, worktrees, dernierCommit, sale }, { maintenant, joursFusionRecente = JOURS_FUSION_RECENTE }) {
  if (sale) return true
  if (avance <= 0) return false
  return worktrees.length > 0 || maintenant.getTime() - new Date(dernierCommit).getTime() < joursFusionRecente * MS_JOUR
}

/**
 * Une ANOMALIE de la mesure : son `genre`, sa `cle` STABLE d'une mesure à l'autre (nom de branche, de
 * worktree, de base, `#ticket` — jamais une avance), son `texte` lisible.
 * @typedef {{genre: string, cle: string, texte: string}} Anomalie
 */

/** L'anomalie `genre` de clé `cle`. PURE. @returns {Anomalie} */
export const anomalie = (genre, cle, texte) => ({ genre, cle, texte })

/** Les champs d'un `gh project field-list --format json`, par nom normalisé. PURE. */
export function lireChamps(json) {
  const champs = new Map()
  for (const champ of Array.isArray(json?.fields) ? json.fields : []) {
    const options = new Map()
    for (const option of Array.isArray(champ?.options) ? champ.options : []) {
      options.set(cleNormalisee(option?.name), option?.id)
    }
    champs.set(cleNormalisee(champ?.name), { id: champ?.id, nom: champ?.name, options })
  }
  return champs
}

/**
 * Les OPTIONS d'un champ single-select lu par `field-list`, dans l'ordre rendu. PURE.
 * @param {unknown} json @param {string} nomDuChamp @returns {string[]}
 */
export function optionsDuChamp(json, nomDuChamp) {
  const champ = (Array.isArray(json?.fields) ? json.fields : [])
    .find((c) => cleNormalisee(c?.name) === cleNormalisee(nomDuChamp))
  return (Array.isArray(champ?.options) ? champ.options : []).map((o) => String(o?.name ?? ''))
}

/**
 * Faut-il réécrire les options du champ ? OUI dès que l'ENSEMBLE diffère de l'attendu (ordre compris :
 * l'ordre des options EST l'ordre des colonnes de la vue Board). PURE.
 * @param {string[]} presentes @param {string[]} [attendues] @returns {boolean}
 */
export const optionsAReecrire = (presentes, attendues = STATUTS) =>
  presentes.length !== attendues.length || presentes.some((nom, i) => nom !== attendues[i])

/**
 * La mutation qui réécrit les options du champ single-select INTÉGRÉ — la seule route : `gh project
 * field-create` ne sait que créer, et l'API n'expose aucune suppression d'option.
 * Forme introspectée le 2026-09-15 : `UpdateProjectV2FieldInput { fieldId: ID, name: String,
 * singleSelectOptions: [ProjectV2SingleSelectFieldOptionInput] }`, chaque option étant un
 * `{ name: String, color: ProjectV2SingleSelectFieldOptionColor, description: String }`. PURE.
 * @param {string} fieldId @param {string[]} [options] @returns {string}
 */
export function mutationOptions(fieldId, options = STATUTS) {
  const liste = options
    .map((nom) => `{name: ${JSON.stringify(nom)}, color: ${COULEURS_STATUT[nom] ?? 'GRAY'}, description: ${JSON.stringify('')}}`)
    .join(', ')
  return 'mutation {\n'
    + `  updateProjectV2Field(input: {fieldId: "${fieldId}", singleSelectOptions: [${liste}]}) {\n`
    + '    projectV2Field { ... on ProjectV2SingleSelectField { id options { id name } } }\n'
    + '  }\n}'
}

/**
 * Les items d'un `gh project item-list --format json`. On ne lit que `id`, `content.number`,
 * `content.repository` et les valeurs de champ par leur NOM normalisé : tout le reste de l'objet
 * (titre, corps, type) appartient à `gh` et peut changer de forme sans casser ce parseur. Les items
 * qui ne sont pas des tickets de `DEPOT` sont écartés. PURE.
 * @param {unknown} json
 * @returns {{id: string, ticket: number, champs: Record<string, unknown>}[]}
 */
export function lireItems(json) {
  const items = Array.isArray(json?.items) ? json.items : []
  return items
    .map((item) => {
      const champs = {}
      for (const [cle, valeur] of Object.entries(item ?? {})) {
        if (cle === 'id' || cle === 'content') continue
        champs[cleNormalisee(cle)] = typeof valeur === 'object' && valeur !== null ? '' : valeur
      }
      return {
        id: String(item?.id ?? ''),
        ticket: Number(item?.content?.number),
        depot: String(item?.content?.repository ?? ''),
        champs,
      }
    })
    .filter((i) => i.id && Number.isFinite(i.ticket)
      && (!i.depot || i.depot.replace(/\/$/, '').endsWith(DEPOT)))
}

/** L'URL du ticket, seule adresse que `gh project item-add` accepte. PURE. */
export const urlDuTicket = (ticket) => `https://github.com/${DEPOT}/issues/${ticket}`

/** La table de `--liste`, colonnes alignées. PURE. */
export function tableDeLignes(lignes) {
  const entetes = ['Ticket', 'Statut', 'Branche(s)', 'Avance', 'Dernier commit', 'Worktree(s)']
  const corps = lignes.map((l) => [
    `#${l.ticket}`, l.statut ?? '', (l.branches ?? []).join(' · '), l.avance ?? '',
    l.dernierCommit ?? '', (l.worktrees ?? []).join(' · '),
  ])
  const largeurs = entetes.map((e, i) => Math.max(e.length, ...corps.map((r) => r[i].length), 0))
  const rendre = (cellules) => cellules.map((c, i) => c.padEnd(largeurs[i])).join('  ').trimEnd()
  return [rendre(entetes), rendre(largeurs.map((n) => '─'.repeat(n))), ...corps.map(rendre)].join('\n')
}

/** Les comptes par statut, dans l'ordre de `STATUTS`, statuts vides omis. PURE. */
export function comptesParStatut(lignes) {
  const comptes = {}
  for (const statut of STATUTS) {
    const n = lignes.filter((l) => l.statut === statut).length
    if (n) comptes[statut] = n
  }
  return comptes
}

// ————————————————————————————————— mesure et gestes —————————————————————————————————

/**
 * `gh <args>` — la porte des appels de `synchroniser`, injectable partout. Elle JETTE, et c'est ce
 * dont dépendent ses DIX sites d'appel : une séquence de gestes qu'un refus doit INTERROMPRE, pas
 * une lecture qui rend un verdict. NEUF de ces sites sont `gh project …` — trois LECTURES (`project
 * list`, `field-list`, `item-list`) et six ÉCRITURES (`item-edit`, `create`, `link`, `field-create`,
 * `item-add`, `item-archive`) —, le DIXIÈME est `gh api graphql` (réécriture des options du champ
 * Status). Projects v2 n'a AUCUNE route REST (les Projects classiques ont été retirés — `gh api
 * repos/cgauche/game/projects` rend 404, mesuré 2026-09-19) : ni les lectures ni les écritures de
 * `synchroniser` ne peuvent passer par la couture REST.
 * Le SPAWN, lui, est unique dans le dépôt : `appelGhRunner` (`ticketsGh.mjs`), seul à porter
 * `stdio[0] = 'ignore'`, la parade au `gh` pendu sur le stdin d'un runner. Son motif de refus est le
 * STDERR de `gh`, et c'est là que `gh` met tout : sur `gh api graphql` refusé, stdout porte le corps
 * JSON et stderr la MÊME phrase plus le code (« … (HTTP 403) ») ; sur un argv invalide, stdout est
 * VIDE (mesuré 2026-09-19). Rien d'utile ne se perd.
 * @param {string[]} args @returns {string}
 */
export function gh(args) {
  const vu = appelGhRunner({ cwd: process.cwd(), maxBuffer: 256 * 1024 * 1024 })(args)
  if (!vu.ok) throw new Error(`gh ${args.join(' ')} a refusé : ${vu.raison || 'raison non dite'}`)
  return vu.stdout
}

/**
 * L'état des tickets demandés, lu par la LISTE REST du dépôt : `repos/<dépôt>/issues?state=all`,
 * page par page (`pagesRest` — JAMAIS `--paginate`, refusé aux sessions dès la 2ᵉ page).
 * UN SEUL CHEMIN, quel que soit le nombre de numéros : `--liste` en demande 84 sur cet arbre
 * (mesuré 2026-09-19), soit 84 spawns de `gh` à ~0,43 s par lecture ticket-à-ticket, contre 19 pages
 * à ~0,74 s pour la liste entière (1827 entrées, 14 s). Un embranchement « si peu de numéros alors un
 * GET par numéro » ferait deux lectures à tenir d'accord, pour un gain qui n'existe qu'en dessous de
 * ~30 numéros.
 * Un refus REST est JETÉ, jamais rendu en carte partielle : un ticket manquant vaut « Ouvert » pour
 * `statutDe`, et le board mentirait sans rien dire.
 * L'ORDRE est DEMANDÉ (`sort=created&direction=desc`), jamais supposé : l'arrêt anticipé
 * (`assezLu`) repose sur cet ordre demandé, pas sur une propriété des numéros — la route par défaut
 * trie déjà par création, mais rien ne le garantit, et un numéro n'est pas une date.
 * Et l'arrêt se fait sur la COMPLÉTUDE — tous les numéros demandés ont été VUS —, jamais sur un
 * SEUIL (« la page est passée sous le plus petit numéro demandé ») : une issue TRANSFÉRÉE d'un autre
 * dépôt porte une date de création ancienne et un numéro neuf, et le critère par seuil la manquerait.
 * Un numéro demandé qui n'existe pas fait lire la liste ENTIÈRE, plafond compris : c'est le cas
 * exhaustif d'avant, et il rend son anomalie « introuvable ».
 * @param {number[]} numeros
 * @param {(args: string[]) => {ok:boolean, stdout?:string, raison?:string}} [appel]
 */
export function issuesDeGh(numeros, appel = appelGhRunner({ cwd: process.cwd() })) {
  const demandes = [...new Set(numeros.map(Number).filter(Number.isFinite))]
  const vue = pagesRest(`repos/${DEPOT}/issues?state=all&sort=created&direction=desc`, appel, {
    assezLu: (entrees) => {
      const vus = new Set(entrees.map((e) => Number(e?.number)))
      return demandes.every((n) => vus.has(n))
    },
  })
  if (!vue.ok) throw new Error(`lecture des tickets de ${DEPOT} refusée : ${vue.raison}`)
  return indexerIssues(vue.entrees, numeros)
}

/** Les GESTES au dépôt de la mesure — ses questions et `fetchOrigin` —, ceux de l'hôte (`gitPorte.mjs`) : injectables (mesure). */
export const GESTES_DU_BOARD = Object.freeze({ arbrePrincipal, fetchOrigin, branchesDe, divergenceDe, journalDe })

/**
 * La MESURE complète, depuis n'importe quel worktree : la racine des gestes git est l'arbre
 * PRINCIPAL, et `base` est un PARAMÈTRE (le CLI la fixe à `origin/main` après `fetch`).
 * Les gestes au dépôt (`GESTES_DU_BOARD`), l'inventaire des worktrees et la lecture des issues
 * sont injectables (mesure).
 *
 * UN SEUL `fetchOrigin` PAR MESURE, aucun sous `sansFetch` : l'inventaire est TOUJOURS appelé sous
 * `sansFetch: true` : son verdict de fusion se lit sur les refs PRÉSENTES — celles que ce fetch vient
 * de poser, ou, sous `sansFetch`, celles qui étaient déjà là.
 *
 * `portee` (liste de tickets, `scripts/ops/suivi.mjs`) ne change RIEN côté git ; côté issues, la
 * lecture porte sur `portee` SEULE, et une portée vide ne lit rien. Son coût suit l'âge du plus
 * vieux ticket de la portée (`issuesDeGh`). Les lignes sont celles de `construireLignes` sous
 * `portee`. `commandeSansFetch` est la commande que cite le refus « origin non consultable ».
 * `vivants` : les branches de chantier à ticket, dans la portée ou non, qui sont VIVANTES (`estVivante`) ;
 * les autres restent des lignes du board.
 * @param {{cwd?: string, base?: string, gestes?: typeof GESTES_DU_BOARD, inv?: Function,
 *   issues?: Function, sansFetch?: boolean, portee?: number[]|null, commandeSansFetch?: string,
 *   maintenant?: Date, joursDormant?: number, joursFusionRecente?: number}} [params]
 * @returns {{ok: true, lignes: object[], vivants: {branche: string, tickets: number[], avance: number, retard: number,
 *   dernierCommit: string, sale: boolean,
 *   worktrees: string[]}[], anomalies: Anomalie[]} | {ok: false, refus: string}}
 */
export function mesurer({
  cwd = process.cwd(), base = BASE, gestes = GESTES_DU_BOARD, inv = inventaire,
  issues = issuesDeGh, sansFetch = false, portee = null,
  commandeSansFetch = 'npm run ops:board -- --liste --sans-fetch', maintenant = new Date(),
  joursDormant = JOURS_DORMANT, joursFusionRecente = JOURS_FUSION_RECENTE,
} = {}) {
  const vuRacine = gestes.arbrePrincipal(depotDe(cwd))
  if (!vuRacine.disponible) return { ok: false, refus: refusDeGit(vuRacine) }
  const principal = vuRacine.valeur
  let panne = null
  const depot = depotDe(principal, { enPanne: (_raison, vu) => { panne = refusDeGit(vu) } })
  const raison = () => {
    const dite = panne ?? 'objet absent'
    panne = null
    return dite
  }
  const anomalies = []

  if (!sansFetch) {
    const vuFetch = gestes.fetchOrigin(depot)
    if (!reussi(vuFetch)) {
      return {
        ok: false,
        refus: `origin non consultable (${refusDeGit(vuFetch)}) — la mesure contre ${base} `
          + `serait fausse ; \`${commandeSansFetch}\` mesure sur les refs déjà là`,
      }
    }
  } else {
    anomalies.push(anomalie('origin-non-rafraichi', base, `origin non rafraîchi (--sans-fetch) : la mesure porte sur les refs déjà présentes pour ${base}`))
  }

  const refs = gestes.branchesDe(depot)
  if (refs === null) return { ok: false, refus: `git for-each-ref illisible : ${raison()}` }

  const parBranche = new Map()
  const sales = new Set()
  const vuInv = inv({ racine: principal, cwd, sansFetch: true })
  if (!vuInv.ok) return { ok: false, refus: vuInv.refus }
  for (const w of vuInv.worktrees) {
    if (w.principal) continue
    if (!w.branche) {
      anomalies.push(anomalie('worktree-detache', w.chemin, `worktree détaché : ${w.chemin} (${w.classe}) — aucune branche à poser au board`))
      continue
    }
    const poses = parBranche.get(w.branche) ?? []
    poses.push(`${w.chemin} (${w.classe})`)
    parBranche.set(w.branche, poses)
    if (w.sale) sales.add(w.branche)
  }

  const branches = []
  for (const brute of refs.filter((b) => estBrancheDeChantier(b.nom))) {
    const comptes = gestes.divergenceDe(depot, base, brute.nom)
    if (comptes === null) {
      anomalies.push(anomalie('avance-non-mesurable', brute.nom, `avance de ${brute.nom} non mesurable contre ${base} : ${raison()}`))
      continue
    }
    const { avance, retard } = comptes
    const worktrees = parBranche.get(brute.nom) ?? []
    if (avance === 0 && !worktrees.length) continue
    let messages = ''
    let messagesLus = true
    if (avance > 0) {
      const journal = gestes.journalDe(depot, [`${base}..${brute.nom}`])
      messagesLus = journal !== null
      if (!messagesLus) {
        anomalies.push(anomalie('messages-illisibles', brute.nom, `messages d’avance de ${brute.nom} illisibles : ${raison()}`
          + ' — le repli par citation n’a pas pu être tenté'))
      }
      messages = (journal ?? []).map((c) => c.message).join('\n')
    }
    const tickets = ticketsDe(brute.nom, messages)
    if (!tickets.length) {
      if (messagesLus) {
        anomalies.push(anomalie('branche-sans-ticket', brute.nom, `branche sans ticket dérivable : ${brute.nom} (${avanceDite({ avance, retard })}`
          + `${worktrees.length ? `, ${worktrees.join(' · ')}` : ''})`))
      }
      continue
    }
    branches.push({ nom: brute.nom, dernierCommitISO: brute.dernierCommitISO, avance, retard, tickets, worktrees })
  }

  const journalBase = gestes.journalDe(depot, [base], { depuis: `${joursFusionRecente} days` })
  if (journalBase === null) {
    anomalies.push(anomalie('journal-illisible', base, `journal de ${base} illisible : ${raison()} — la classe `
      + 'Fusionné est incomplète (aucune preuve de publication n’a pu être lue)'))
  }
  const fusionnes = []
  for (const commit of journalBase ?? []) {
    for (const ticket of ticketsCites(commit.message).keys()) {
      const deja = fusionnes.find((f) => f.ticket === ticket)
      if (!deja) fusionnes.push({ ticket, dateISO: commit.date })
      else if (commit.date > deja.dateISO) deja.dateISO = commit.date
    }
  }

  const numeros = portee === null
    ? [...new Set([...branches.flatMap((b) => b.tickets), ...fusionnes.map((f) => f.ticket)])]
    : [...new Set(portee.map(Number))]
  const vuIssues = numeros.length ? issues(numeros) : { issues: new Map(), anomalies: [] }
  anomalies.push(...vuIssues.anomalies)

  const lignes = construireLignes(
    { branches, fusionnes, issues: vuIssues.issues, portee },
    { maintenant, joursDormant },
  )
  const vivants = branches
    .map((b) => ({ branche: b.nom, tickets: b.tickets, avance: b.avance, retard: b.retard, worktrees: b.worktrees, dernierCommit: b.dernierCommitISO, sale: sales.has(b.nom) }))
    .filter((v) => estVivante(v, { maintenant, joursFusionRecente }))
  return { ok: true, lignes, vivants, anomalies }
}

/**
 * Pose UNE valeur de champ sur un item, par le drapeau que le TYPE déclaré exige — et une valeur VIDE
 * EFFACE le champ (`--clear`, « Remove field value »). Sans cet effacement, une branche supprimée ou un
 * worktree retiré resteraient affichés à vie et le plan ne serait JAMAIS vide.
 * @param {{ghFn: Function, projetId: string, itemId: string, champs: Map, champ: string, valeur: string}} params
 */
export function poserChamp({ ghFn, projetId, itemId, champs, champ, valeur }) {
  const declare = CHAMPS.find((c) => c.nom === champ)
  const vu = champs.get(cleNormalisee(champ))
  if (!vu?.id) throw new Error(`champ « ${champ} » absent du Project : rien à poser`)
  const args = ['project', 'item-edit', '--project-id', projetId, '--id', itemId, '--field-id', vu.id]
  if (String(valeur ?? '') === '') args.push('--clear')
  else if (declare?.type === 'DATE') args.push('--date', String(valeur).slice(0, 10))
  else if (declare?.type === 'SINGLE_SELECT') {
    const option = vu.options.get(cleNormalisee(valeur))
    if (!option) throw new Error(`option « ${valeur} » absente du champ « ${champ} »`)
    args.push('--single-select-option-id', option)
  } else args.push('--text', String(valeur))
  ghFn(args)
}

/**
 * La PROJECTION des lignes sur le Project : ajouts, éditions de ce qui DIFFÈRE, archivages. Rien
 * n'est supprimé, et un second passage immédiat ne fait aucun geste.
 * Une valeur VIDE s'EFFACE (`poserChamp` → `--clear`) : un second passage rend un plan vide parce que
 * `memeValeur` compare « vide » et « absent/effacé » comme ÉGAUX — les deux bouts sont d'accord.
 * L'état des issues des items NON mesurés est lu ici : c'est ce qui décide d'un archivage.
 * @param {{lignes: object[], creer?: boolean, gh?: Function, issues?: Function}} params
 * @returns {{ok: true, numero: number, ajoutes: number, misAJour: number, archives: number, cree: boolean}
 *   | {ok: false, refus: string}}
 */
export function synchroniser({ lignes, creer = false, gh: ghFn = gh, issues: issuesFn = issuesDeGh }) {
  const liste = JSON.parse(ghFn(['project', 'list', '--owner', PROPRIETAIRE, '--format', 'json']))
  let projet = (Array.isArray(liste?.projects) ? liste.projects : [])
    .find((p) => p?.title === TITRE_PROJECT && p?.closed !== true)
  let cree = false
  if (!projet) {
    if (!creer) {
      return { ok: false, refus: `Project « ${TITRE_PROJECT} » absent — \`npm run ops:board -- --creer\`` }
    }
    projet = JSON.parse(ghFn(['project', 'create', '--owner', PROPRIETAIRE, '--title', TITRE_PROJECT, '--format', 'json']))
    ghFn(['project', 'link', String(projet.number), '--owner', PROPRIETAIRE, '--repo', DEPOT])
    cree = true
  }
  const numero = String(projet.number)
  const lireLesChamps = () => JSON.parse(
    ghFn(['project', 'field-list', numero, '--owner', PROPRIETAIRE, '--format', 'json', '-L', '100']),
  )
  let bruts = lireLesChamps()
  let champs = lireChamps(bruts)
  const manquants = CHAMPS.filter((c) => !champs.has(cleNormalisee(c.nom)))
  if (manquants.length) {
    if (!creer) {
      return {
        ok: false,
        refus: `champs absents du Project « ${TITRE_PROJECT} » : ${manquants.map((c) => c.nom).join(', ')}`
          + ' — `npm run ops:board -- --creer`',
      }
    }
    for (const champ of manquants) {
      const args = ['project', 'field-create', numero, '--owner', PROPRIETAIRE,
        '--name', champ.nom, '--data-type', champ.type, '--format', 'json']
      if (champ.options) args.push('--single-select-options', champ.options.join(','))
      ghFn(args)
    }
    bruts = lireLesChamps()
    champs = lireChamps(bruts)
  }

  const aOptions = CHAMPS.find((c) => c.type === 'SINGLE_SELECT')
  const presentes = optionsDuChamp(bruts, aOptions.nom)
  if (optionsAReecrire(presentes, aOptions.options)) {
    if (!creer) {
      return {
        ok: false,
        refus: `options du champ ${aOptions.nom} : ${presentes.join(', ') || 'aucune'} — attendu `
          + `${aOptions.options.join(', ')} — \`npm run ops:board -- --creer\``,
      }
    }
    const idChamp = champs.get(cleNormalisee(aOptions.nom))?.id
    if (!idChamp) return { ok: false, refus: `champ ${aOptions.nom} sans id dans field-list : rien à réécrire` }
    ghFn(['api', 'graphql', '-f', `query=${mutationOptions(idChamp, aOptions.options)}`])
    bruts = lireLesChamps()
    champs = lireChamps(bruts)
  }

  const items = lireItems(JSON.parse(
    ghFn(['project', 'item-list', numero, '--owner', PROPRIETAIRE, '--format', 'json', '-L', '1000']),
  ))
  const mesures = new Set(lignes.map((l) => Number(l.ticket)))
  const nonMesures = [...new Set(items.map((i) => Number(i.ticket)))].filter((t) => !mesures.has(t))
  const etats = nonMesures.length ? issuesFn(nonMesures).issues : new Map()
  const plan = planDeSync(lignes, items, { issues: etats })
  let ajoutes = 0
  let misAJour = 0
  let archives = 0
  for (const ticket of plan.ajouts) {
    const item = JSON.parse(ghFn(['project', 'item-add', numero, '--owner', PROPRIETAIRE,
      '--url', urlDuTicket(ticket), '--format', 'json']))
    ajoutes += 1
    const ligne = lignes.find((l) => l.ticket === ticket)
    for (const [champ, valeur] of Object.entries(valeursDeLigne(ligne))) {
      if (String(valeur) === '') continue
      poserChamp({ ghFn, projetId: projet.id, itemId: item.id, champs, champ, valeur })
    }
  }
  for (const edition of plan.editions) {
    poserChamp({ ghFn, projetId: projet.id, itemId: edition.itemId, champs, champ: edition.champ, valeur: edition.valeur })
    misAJour += 1
  }
  for (const itemId of plan.archivages) {
    ghFn(['project', 'item-archive', numero, '--owner', PROPRIETAIRE, '--id', itemId])
    archives += 1
  }
  return { ok: true, numero: projet.number, ajoutes, misAJour, archives, cree }
}

/** Le mot qui dit où régler la seule chose que l'API ne sait pas poser, et ce que `--creer` a réécrit. */
export const MOT_DE_LA_VUE = 'La VUE « Board » (disposition par colonnes, groupée par `Status`) n’est pas '
  + 'exposée par l’API : à régler UNE fois dans l’UI GitHub (Layout → Board, Group by → Status).\n'
  + '`--creer` RÉÉCRIT les options du champ intégré `Status` : Todo / In Progress / Done DISPARAISSENT, '
  + 'et tout item qui portait l’une d’elles perd sa valeur de Status.'

/**
 * Le texte de `--liste` d'une mesure réussie : la table, le TEXTE de chaque anomalie, le bilan. PURE.
 * @param {{lignes: object[], anomalies: Anomalie[]}} vu
 * @returns {string}
 */
export function texteDuBoard({ lignes, anomalies }) {
  const comptes = Object.entries(comptesParStatut(lignes)).map(([s, n]) => `${s}=${n}`).join(' ')
  return `${tableDeLignes(lignes)}\n`
    + (anomalies.length ? `\nANOMALIES\n${anomalies.map(({ texte }) => `  ${texte}\n`).join('')}` : '')
    + `\n[board] ${lignes.length} lignes · ${comptes || 'aucun statut'} · anomalies ${anomalies.length}\n`
}

function main() {
  const argv = process.argv.slice(2)
  const veutListe = argv.includes('--liste')
  const veutCreer = argv.includes('--creer')
  const veutSansFetch = argv.includes('--sans-fetch')
  if (veutSansFetch && !veutListe) {
    process.stderr.write('[board] --sans-fetch ne vaut qu’avec --liste : on ne synchronise pas un board '
      + 'sur des refs non rafraîchies.\n')
    process.exit(1)
  }

  let vu
  try {
    vu = mesurer({ base: BASE, sansFetch: veutSansFetch })
  } catch (e) {
    process.stderr.write(`[board] ${e.message}\n`)
    process.exit(1)
  }
  if (!vu.ok) {
    process.stderr.write(`[board] ${vu.refus}\n`)
    process.exit(1)
  }

  if (veutListe) {
    process.stdout.write(texteDuBoard(vu))
    return
  }

  let bilan
  try {
    bilan = synchroniser({ lignes: vu.lignes, creer: veutCreer })
  } catch (e) {
    process.stderr.write(`[board] ${e.message}\n`)
    process.exit(1)
  }
  if (!bilan.ok) {
    process.stderr.write(`[board] ${bilan.refus}\n`)
    process.exit(1)
  }
  for (const { texte } of vu.anomalies) process.stdout.write(`anomalie\t${texte}\n`)
  if (bilan.cree)
 process.stdout.write(`${MOT_DE_LA_VUE}\n`)
  process.stdout.write(`[board] Project #${bilan.numero} · ${vu.lignes.length} lignes · `
    + `ajoutés ${bilan.ajoutes} · mis à jour ${bilan.misAJour} · archivés ${bilan.archives} · `
    + `anomalies ${vu.anomalies.length}\n`)
}

if (import.meta.main) main()
