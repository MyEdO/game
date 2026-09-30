// SUIVI DE VAGUE — `.git/suivi/<N>.md`, un fichier par ÉPIQUE `<N>`, seule source du plan et du
// prochain geste de l'orchestrateur ; ce script en rafraîchit la zone MESURÉE.
//
// « Perso j'étais certain qu'un orchestrator avait un fichier de lot qui indiquait les tickets qu'il
// comptait travailler et le mettait a jour au fil de l'eau, histoire de savoir ou il en est et ou il
// va » ; « Il faut absoluelement faire un truc pour ce fichier de suivis, c'est vital si on veux
// éviter la dérive » (utilisateur, 2026-09-28, #2132). Emplacement choisi le même jour : « Commun git
// local (Recommandé) ».
//
// DEUX ZONES. La zone ÉCRITE (tout hors des marqueurs) porte le plan et les étapes `[x]`/`[ ]`,
// écrites au fil de l'eau ; ce script ne la réécrit JAMAIS, elle ressort intacte à l'octet. La zone
// MESURÉE (entre `<!-- suivi:mesure:debut -->` et `<!-- suivi:mesure:fin -->`, chacun seul sur sa
// ligne) porte l'état de branche, d'avance, d'issue et de publication : il ne se saisit pas, il se
// mesure (`mesurer`, scripts/ops/board.mjs). Les marqueurs se lisent sur les lignes BRUTES, avant tout
// nettoyage : un marqueur seul sur sa ligne dans un bloc de code ou un commentaire HTML reste un marqueur.
//
// LA GRAMMAIRE DE LA ZONE ÉCRITE. Nettoyage, dans cet ordre : la zone mesurée, les commentaires HTML
// (multi-lignes compris ; non fermé → jusqu'à la fin du document, anomalie), les blocs de code
// clôturés au sens CommonMark (0 à 3 espaces, au moins 3 `` ` `` ou `~`, fermés par le MÊME
// caractère en longueur au moins égale ; non fermé → jusqu'à la fin du document, anomalie). Puis la
// section : première ligne `^## En cours\b`, jusqu'au `^## ` suivant. Un ITEM est une ligne
// `^\d+\.\s` en COLONNE 0 ; son ticket est le PREMIER `#N` de la ligne ; une étape qui n'est pas un
// ticket prévu s'indente. Anomalies : item sans ticket, numéro invalide (`#0`), ligne de colonne 0
// de la section qui porte un `#N` sans être un item. La SECTION d'un ticket compte les lignes non
// vides de ses items : la ligne d'item et ses lignes indentées, jusqu'à l'item suivant, sommées sur
// les items qui le citent.
//
// « À CONDENSER ». La zone mesurée liste chaque ticket dont l'issue est FERMÉE (`etatIssue`, lu par
// `gh` quel que soit qui l'a fermée) et dont la section dépasse `LIGNES_D_UN_TICKET_FERME` ; la
// condensation reste un geste d'orchestrateur, la zone écrite n'est jamais réécrite ici. « Par contre
// le fichier comme tu le dis va grossir, il n'y a pas un moment quand tu ferme un ticket une mise a
// jour du fichier de suivi en ne gardant du ticket que l'essentiel ? » (utilisateur, 2026-09-30, #2132).
//
// L'ÉCRITURE. Portée lue, mesure, portée RELUE (refus si elle a changé), rendu dans
// `.<N>.md.<pid>.tmp`, texte relu juste avant le `rename` (refus s'il a changé), `rename`. Un
// `rename` en EPERM/EACCES/EBUSY est un refus « suivi tenu par un autre processus » ; chaque refus
// supprime le temporaire. Une mesure refusée réécrit la zone avec son motif daté, par le même chemin.
// La concurrence n'est couverte qu'à la fenêtre relire → `rename` près.
//
// LE PROFIL. Chaque geste injectable de la mesure (`GESTES_DU_BOARD`, `inv`, `issues`) est
// chronométré ; le `reste` est le total moins leur somme.
//
// LA RELECTURE SANS MÉMOIRE (#2132). `digestDuSuivi` est ce que le hook de session
// (`scripts/hooks/inject-suivi.mjs`) met en contexte : titre, Objectif, items et étapes ouvertes, zone
// mesurée datée, coupé à `PLAFOND_INJECTION` ; il ne mesure rien. `dossierDesSuivis` est le dossier que
// ce script, le hook de session et le lien de session (`scripts/hooks/suivi-lien-guard.mjs`) partagent.
//
// Usage : `npm run ops:suivi -- <N> [--creer] [--sans-fetch]` · sans `<N>` : la liste des suivis.
import * as FS from 'node:fs'
import { join } from 'node:path'
import { arbrePrincipal, depotDe } from '../guards/lib/gitPorte.mjs'
import { numerosDeLaChaine } from '../guards/lib/fermetures.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { BASE, GESTES_DU_BOARD, JOURS_FUSION_RECENTE, issuesDeGh, mesurer, urlDuTicket } from './board.mjs'
import { inventaire } from './worktrees.mjs'

export const MARQUE_DEBUT = '<!-- suivi:mesure:debut -->'
export const MARQUE_FIN = '<!-- suivi:mesure:fin -->'
const MARQUEUR = /^<!-- suivi:mesure:(debut|fin) -->$/
const SECTION = /^## En cours\b/
const ITEM = /^\d+\.\s/
const SUIVI = /^\d+\.md$/
const ORPHELIN = /^\.\d+\.md\.\d+\.tmp$/
const TENU = new Set(['EPERM', 'EACCES', 'EBUSY'])
const OBJECTIF = /^## Objectif\b/
const ITEM_FAIT = /^\d+\.\s+\[[xX]\]/
const ETAPE_OUVERTE = /^\s+(?:[-*+]|\d+\.)\s+\[ \]/
const TETE_DE_ZONE = '> Zone MESURÉE par'

/** Âge (h) au-delà duquel la zone mesurée d'un digest est marquée PÉRIMÉE. Valeur maison. */
export const HEURES_PEREMPTION = 24
/** Taille maximale (caractères) d'un digest injecté au contexte. Valeur maison. */
export const PLAFOND_INJECTION = 8000
/** Lignes de section au-delà desquelles un ticket FERMÉ est « À condenser » : l'item et deux étapes. Valeur maison. */
export const LIGNES_D_UN_TICKET_FERME = 3

// ————————————————————————————————— fonctions PURES —————————————————————————————————

/** Les lignes d'un texte, fin de ligne COMPRISE (`\n` ou `\r\n`), la dernière sans fin si le texte n'en a pas. PURE. */
const lignesDe = (texte) => String(texte).match(/[^\n]*\n|[^\n]+$/g) ?? []
/** Une ligne sans sa fin. PURE. */
const sansFin = (ligne) => ligne.replace(/\r?\n$/, '')
/** Un extrait d'une ligne, pour une anomalie. PURE. */
const extrait = (ligne) => `« ${coupeAuMot(ligne, 80)} »`

/**
 * Les deux zones d'un texte : ses lignes, et l'indice des deux marqueurs (`-1` s'ils sont absents).
 * Doublés ou désordonnés → refus nommé avec leurs numéros de ligne. PURE.
 * @param {string} texte
 * @returns {{ok: true, lignes: string[], debut: number, fin: number} | {ok: false, refus: string}}
 */
export function zonesDe(texte) {
  const lignes = lignesDe(texte)
  const marques = []
  lignes.forEach((ligne, i) => {
    const m = MARQUEUR.exec(sansFin(ligne))
    if (m) marques.push({ quoi: m[1], i })
  })
  if (!marques.length) return { ok: true, lignes, debut: -1, fin: -1 }
  if (marques.length === 2 && marques[0].quoi === 'debut' && marques[1].quoi === 'fin') {
    return { ok: true, lignes, debut: marques[0].i, fin: marques[1].i }
  }
  return {
    ok: false,
    refus: `marqueurs de la zone mesurée doublés ou désordonnés : ${marques.map((m) => `${m.quoi} l.${m.i + 1}`).join(', ')}`
      + ` — attendu un \`${MARQUE_DEBUT}\` puis un \`${MARQUE_FIN}\`, chacun seul sur sa ligne`,
  }
}

/**
 * Les lignes de la zone écrite après nettoyage (zone mesurée, commentaires HTML, blocs de code), à
 * leur NUMÉRO d'origine : ce qui est retiré devient une ligne vide. PURE.
 * @param {{lignes: string[], debut: number, fin: number}} zones
 * @returns {{lignes: string[], anomalies: string[]}}
 */
function nettoyer({ lignes: brutes, debut, fin }) {
  const anomalies = []
  const zone = brutes.map((l, i) => (debut >= 0 && i >= debut && i <= fin ? '' : sansFin(l)))
  const sansCommentaires = zone.join('\n').replace(/<!--[\s\S]*?-->|<!--[\s\S]*$/g, (bloc, position, tout) => {
    if (!bloc.endsWith('-->')) {
      const ligne = tout.slice(0, position).split('\n').length
      anomalies.push(`commentaire HTML non fermé (ouvert l.${ligne}) : il court jusqu'à la fin du document`)
    }
    return bloc.replace(/[^\n]/g, '')
  })
  const lignes = sansCommentaires.split('\n')
  let dans = null
  for (let i = 0; i < lignes.length; i += 1) {
    const ligne = lignes[i]
    if (dans) {
      const f = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(ligne)
      if (f && f[1][0] === dans.car && f[1].length >= dans.longueur) dans = null
      lignes[i] = ''
      continue
    }
    const o = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(ligne)
    if (o && !(o[1][0] === '`' && o[2].includes('`'))) {
      dans = { car: o[1][0], longueur: o[1].length, ligne: i + 1 }
      lignes[i] = ''
    }
  }
  if (dans) anomalies.push(`bloc de code non fermé (ouvert l.${dans.ligne}) : il court jusqu'à la fin du document`)
  return { lignes, anomalies }
}

/**
 * Les tickets PRÉVUS d'un suivi — le premier `#N` de chaque item de `## En cours`, dédoublonnés dans
 * l'ordre —, la longueur de leur SECTION (en-tête de ce fichier) et les anomalies de sa grammaire.
 * `refus` est non nul quand le texte est illisible (marqueurs, section absente). PURE.
 * @param {string} texte
 * @returns {{tickets: number[], sections: Map<number, number>, anomalies: string[], refus: string|null}}
 */
export function ticketsPrevus(texte) {
  const zones = zonesDe(texte)
  if (!zones.ok) return { tickets: [], sections: new Map(), anomalies: [], refus: zones.refus }
  const { lignes, anomalies } = nettoyer(zones)
  const debut = lignes.findIndex((l) => SECTION.test(l))
  if (debut < 0) {
    return { tickets: [], sections: new Map(), anomalies, refus: 'section `## En cours` absente : un item `1. #N …` en colonne 0 par ticket prévu, sous ce titre' }
  }
  const suite = lignes.findIndex((l, i) => i > debut && /^## /.test(l))
  const tickets = []
  const sections = new Map()
  const compter = (numero) => sections.set(numero, (sections.get(numero) ?? 0) + 1)
  let courant = null
  let rang = 0
  for (let i = debut + 1; i < (suite < 0 ? lignes.length : suite); i += 1) {
    const ligne = lignes[i]
    if (!ITEM.test(ligne)) {
      if (/^\S/.test(ligne) && /#\d+/.test(ligne)) {
        anomalies.push(`ligne hors grammaire qui porte un #N (l.${i + 1}) : ${extrait(ligne)} — un item s'écrit \`1. #N …\` en colonne 0`)
      }
      if (courant !== null && /^\s+\S/.test(ligne)) compter(courant)
      continue
    }
    rang += 1
    courant = null
    const [premier] = numerosDeLaChaine(ligne)
    if (premier === undefined) {
      anomalies.push(`item ${rang} sans ticket (l.${i + 1}) : ${extrait(ligne)}`)
      continue
    }
    const numero = Number(premier)
    if (numero < 1) {
      anomalies.push(`numéro invalide à l'item ${rang} (l.${i + 1}) : ${extrait(ligne)}`)
      continue
    }
    if (!tickets.includes(numero)) tickets.push(numero)
    courant = numero
    compter(numero)
  }
  return { tickets, sections, anomalies, refus: null }
}

/**
 * Le gabarit UNIQUE de l'horodatage `AAAA-MM-JJ HH:MM`, heure LOCALE : `horodatage` l'écrit,
 * `lireHorodatage` le relit. Un champ porte son nombre de chiffres et sa valeur dans une `Date`.
 */
const GABARIT_HORODATAGE = [
  { nom: 'an', chiffres: 4, de: (d) => d.getFullYear() }, '-',
  { nom: 'mois', chiffres: 2, de: (d) => d.getMonth() + 1 }, '-',
  { nom: 'jour', chiffres: 2, de: (d) => d.getDate() }, ' ',
  { nom: 'heure', chiffres: 2, de: (d) => d.getHours() }, ':',
  { nom: 'minute', chiffres: 2, de: (d) => d.getMinutes() },
]
const CHAMPS_HORODATAGE = GABARIT_HORODATAGE.filter((p) => typeof p !== 'string')
/** L'horodatage en expression régulière, un groupe par champ. */
const MOTIF_HORODATAGE = GABARIT_HORODATAGE
  .map((p) => (typeof p === 'string' ? p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : `(\\d{${p.chiffres}})`)).join('')
/** `AAAA-MM-JJ HH:MM`, heure LOCALE. PURE. */
export const horodatage = (d) => GABARIT_HORODATAGE
  .map((p) => (typeof p === 'string' ? p : String(p.de(d)).padStart(p.chiffres, '0'))).join('')
/** La `Date` (locale, à la minute) d'un `horodatage`, `null` si `texte` n'en est pas un. PURE. */
export function lireHorodatage(texte) {
  const m = new RegExp(`^${MOTIF_HORODATAGE}$`).exec(String(texte))
  if (!m) return null
  const { an, mois, jour, heure, minute } = Object.fromEntries(CHAMPS_HORODATAGE.map((p, i) => [p.nom, Number(m[i + 1])]))
  return new Date(an, mois - 1, jour, heure, minute)
}
/** Une cellule de table Markdown sur une ligne. PURE. */
const cellule = (v) => String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
/** Une puce sur une ligne. PURE. */
const puce = (v) => `- ${String(v).replace(/\r?\n/g, ' ')}`

/**
 * Les lignes de la zone MESURÉE, sans ses marqueurs. PURE.
 * @param {{mesure: {ok: boolean, lignes?: object[], anomalies?: string[], refus?: string},
 *   grammaire: string[], sections: Map<number, number>, epique: number, maintenant: Date}} params
 * @returns {string[]}
 */
function lignesDeLaZone({ mesure, grammaire, sections, epique, maintenant }) {
  const zone = [
    // `dateDeLaZone` relit cette date.
    `${TETE_DE_ZONE} \`npm run ops:suivi -- ${epique}\` le ${horodatage(maintenant)} : réécrite à chaque appel, jamais éditée à la main.`,
    `> Épique [#${epique}](${urlDuTicket(epique)}). « Dernier commit » : le plus récent d'une branche du ticket, sinon sa dernière citation par \`${BASE}\` dans les ${JOURS_FUSION_RECENTE} jours ; vide au-delà.`,
    '',
  ]
  if (!mesure.ok) {
    zone.push(`**Mesure refusée le ${horodatage(maintenant)}** : ${String(mesure.refus).replace(/\r?\n/g, ' ')}`)
  } else if (!mesure.lignes.length) {
    zone.push('_Aucun ticket prévu : un item `1. #N …` en colonne 0 sous `## En cours`._')
  } else {
    zone.push('| Ticket | Statut | Issue | Branche(s) | Avance | Dernier commit | Worktree(s) |')
    zone.push('|---|---|---|---|---|---|---|')
    for (const l of mesure.lignes) {
      zone.push(`| #${l.ticket} | ${cellule(l.statut)} | ${cellule(l.etatIssue)} | ${cellule(l.branches.join(' · '))} | `
        + `${cellule(l.avance)} | ${cellule(l.dernierCommit)} | ${cellule(l.worktrees.join(' · '))} |`)
    }
    const aCondenser = mesure.lignes.filter((l) => l.etatIssue === 'fermé' && (sections.get(l.ticket) ?? 0) > LIGNES_D_UN_TICKET_FERME)
    if (aCondenser.length) {
      zone.push('', '**À condenser**', '', ...aCondenser.map((l) => puce(`#${l.ticket} fermé : sa section fait ${sections.get(l.ticket)} lignes`
        + ' → la condenser à l\'essentiel (arbitrages verbatim au ticket d\'abord)')))
    }
  }
  if (grammaire.length) zone.push('', '**Grammaire du suivi**', '', ...grammaire.map(puce))
  if (mesure.ok && mesure.anomalies.length) {
    zone.push('', '**Anomalies de la mesure (hors vague comprises)**', '', ...mesure.anomalies.map(puce))
  }
  return zone
}

/**
 * Le texte du suivi, zone mesurée rendue : la zone ÉCRITE ressort intacte à l'octet (fins de ligne
 * comprises), la zone mesurée prend la fin de ligne du fichier. Marqueurs absents → la zone est
 * ajoutée en fin. PURE.
 * @param {{texte: string, mesure: object, epique: number, maintenant: Date}} params
 * @returns {string}
 * @throws {Error} marqueurs doublés ou désordonnés
 */
export function renduDuSuivi({ texte, mesure, epique, maintenant }) {
  const zones = zonesDe(texte)
  if (!zones.ok) throw new Error(zones.refus)
  const fin = /\r\n/.test(texte) ? '\r\n' : '\n'
  const { anomalies, sections } = ticketsPrevus(texte)
  const zone = [MARQUE_DEBUT, ...lignesDeLaZone({ mesure, grammaire: anomalies, sections, epique, maintenant })]
    .map((l) => `${l}${fin}`).join('')
  if (zones.debut < 0) {
    const jointure = texte === '' ? '' : `${texte.endsWith('\n') ? '' : fin}${fin}`
    return `${texte}${jointure}${zone}${MARQUE_FIN}${fin}`
  }
  const { lignes, debut, fin: indiceFin } = zones
  const finDuMarqueur = lignes[indiceFin].slice(sansFin(lignes[indiceFin]).length)
  return `${lignes.slice(0, debut).join('')}${zone}${MARQUE_FIN}${finDuMarqueur}${lignes.slice(indiceFin + 1).join('')}`
}

/** Le gabarit d'un suivi neuf : titre, objectif, section `## En cours` et son item exemple commenté, zone mesurée. PURE. */
export const gabaritDuSuivi = (epique) => [
  `# Suivi de vague — épique #${epique}`,
  '',
  '## Objectif',
  '',
  '## En cours',
  '',
  '<!-- 1. #1234 un item = un ticket prévu, en colonne 0 ; ses étapes [x]/[ ] s\'indentent dessous -->',
  '',
  MARQUE_DEBUT,
  MARQUE_FIN,
  '',
].join('\n')

/** La première ligne d'une zone mesurée (`lignesDeLaZone`), sa date en groupe 1. */
const DATE_DE_ZONE = new RegExp(`^${TETE_DE_ZONE} .+ le (${MOTIF_HORODATAGE}) :`)

/** La date (locale) d'une zone mesurée, relue sur sa première ligne ; `null` sans date. PURE. */
function dateDeLaZone(lignesDeZone) {
  const m = DATE_DE_ZONE.exec(lignesDeZone.find((l) => l.trim()) ?? '')
  return m ? lireHorodatage(m[1]) : null
}

/**
 * `lignes` jointes, coupées à la ligne pour tenir sous `plafond`, fin « tronqué » comprise : jamais
 * plus de `plafond` caractères. L'en-tête (première ligne) passe avant la fin : s'il ne tient pas
 * entier avec elle, il est coupé ; si la fin seule dépasse, seul l'en-tête coupé reste. PURE.
 */
function plafonner(lignes, plafond, chemin) {
  const entier = lignes.join('\n')
  if (entier.length <= plafond) return entier
  const fin = `… tronqué, lire ${chemin}`
  const gardees = []
  let taille = fin.length
  for (const ligne of lignes) {
    if (taille + ligne.length + 1 > plafond) break
    gardees.push(ligne)
    taille += ligne.length + 1
  }
  if (gardees.length) return [...gardees, fin].join('\n')
  const tete = lignes[0] ?? ''
  if (plafond <= fin.length) return tete.slice(0, Math.max(0, plafond))
  return `${tete.slice(0, plafond - fin.length - 1)}\n${fin}`
}

/**
 * Le DIGEST d'un suivi : son titre, son `## Objectif`, les items de `## En cours` (sauf ceux cochés
 * `[x]`) et leurs étapes `[ ]`, puis la zone mesurée — PÉRIMÉE au-delà de `HEURES_PEREMPTION`, ou
 * « jamais rafraîchie ». Commentaires HTML et blocs de code n'y entrent pas. Coupé à `plafond`
 * caractères, terminé par « tronqué, lire <chemin> ». PURE.
 * @param {string} texte
 * @param {{epique: number, chemin: string, mtime: Date, maintenant: Date, plafond?: number}} params
 * @returns {string}
 */
export function digestDuSuivi(texte, { epique, chemin, mtime, maintenant, plafond = PLAFOND_INJECTION }) {
  const vues = zonesDe(texte)
  const zones = vues.ok ? vues : { lignes: lignesDe(texte), debut: -1, fin: -1 }
  const sortie = [`[suivi #${epique}] ${chemin} — écrit le ${horodatage(mtime)}`]
  if (!vues.ok) sortie.push(`⚠ ${vues.refus}`)
  let titre = false
  let section = null
  for (const ligne of nettoyer(zones).lignes) {
    if (/^# /.test(ligne) && !titre) {
      titre = true
      sortie.push(ligne)
    } else if (/^## /.test(ligne)) {
      section = OBJECTIF.test(ligne) ? 'objectif' : SECTION.test(ligne) ? 'en-cours' : null
      if (section) sortie.push(ligne)
    } else if (section === 'objectif' && ligne.trim()) {
      sortie.push(ligne)
    } else if (section === 'en-cours' && ((ITEM.test(ligne) && !ITEM_FAIT.test(ligne)) || ETAPE_OUVERTE.test(ligne))) {
      sortie.push(ligne)
    }
  }
  const zone = zones.debut >= 0 ? zones.lignes.slice(zones.debut + 1, zones.fin).map(sansFin) : []
  const date = dateDeLaZone(zone)
  const rafraichir = `\`npm run ops:suivi -- ${epique}\``
  sortie.push('', '## Zone mesurée')
  if (!date) {
    sortie.push(`zone mesurée jamais rafraîchie : ${rafraichir}`)
  } else {
    const heures = (maintenant.getTime() - date.getTime()) / 3_600_000
    if (heures > HEURES_PEREMPTION) {
      sortie.push(`**PÉRIMÉE** : mesurée il y a ${Math.floor(heures)} h (au-delà de ${HEURES_PEREMPTION} h) — ${rafraichir}`)
    }
    sortie.push(...zone)
  }
  return plafonner(sortie, plafond, chemin)
}

// ————————————————————————————————— mesure, écriture, CLI —————————————————————————————————

/**
 * `mesurer` sous PROFIL : chaque entrée de `GESTES_DU_BOARD`, `inv` et `issues` est enveloppée et
 * chronométrée ; `reste` = total − somme des gestes. Une exception de la mesure devient un refus.
 * @param {{gestes?: typeof GESTES_DU_BOARD, inv?: Function, issues?: Function,
 *   horloge?: () => number} & Record<string, unknown>} [params] le reste va à `mesurer`
 * @returns {{vu: ReturnType<typeof mesurer>, profil: {durees: Record<string, number>, total: number, reste: number}}}
 */
export function mesureProfilee({ gestes = GESTES_DU_BOARD, inv = inventaire, issues = issuesDeGh, horloge = () => performance.now(), ...params } = {}) {
  const durees = tableTotale([...Object.keys(GESTES_DU_BOARD), 'inv', 'issues'], () => 0)
  const envelopper = (nom, geste) => (...args) => {
    const depart = horloge()
    try {
      return geste(...args)
    } finally {
      durees[nom] += horloge() - depart
    }
  }
  const enveloppes = tableTotale(Object.keys(GESTES_DU_BOARD), (nom) => envelopper(nom, gestes[nom]))
  const depart = horloge()
  let vu
  try {
    vu = mesurer({ ...params, gestes: enveloppes, inv: envelopper('inv', inv), issues: envelopper('issues', issues) })
  } catch (e) {
    vu = { ok: false, refus: e.message }
  }
  const total = horloge() - depart
  const somme = Object.values(durees).reduce((a, b) => a + b, 0)
  return { vu, profil: { durees, total, reste: total - somme } }
}

/** La ligne de profil. PURE. */
const ligneDeProfil = ({ durees, total, reste }) => `[suivi] profil (ms) : ${Object.entries(durees)
  .map(([nom, ms]) => `${nom} ${Math.round(ms)}`).join(' · ')} · total ${Math.round(total)} · reste ${reste.toFixed(1)}`

/** Le texte de `cible`, ou `null` si elle n'existe plus (`ENOENT`) ; toute autre erreur est relancée. */
export function relire(cible, fs) {
  try {
    return fs.readFileSync(cible, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT') return null
    throw e
  }
}

/**
 * Écrit `contenu` sur `cible` par un temporaire `.<N>.md.<pid>.tmp` voisin, APRÈS avoir relu `cible`
 * et vérifié qu'elle vaut encore `attendu`. Temporaire non écrit, cible disparue, texte changé, ou
 * `rename` en EPERM/EACCES/EBUSY → refus nommé, temporaire supprimé, cible intacte ; toute autre
 * erreur est relancée, temporaire supprimé. Un temporaire que le nettoyage ne peut pas supprimer
 * est NOMMÉ dans le refus (`listerSuivis` le retrouve en orphelin), sans jamais masquer l'erreur
 * d'origine. Une cible retirée entre sa relecture et le `rename` est recréée par ce `rename`, avec
 * le contenu rendu.
 * @param {{cible: string, contenu: string, attendu: string, fs?: typeof FS, pid?: number}} params
 * @returns {{ok: true} | {ok: false, refus: string}}
 */
export function ecrireSuivi({ cible, contenu, attendu, fs = FS, pid = process.pid }) {
  const dossier = join(cible, '..')
  const nom = cible.replace(/\\/g, '/').split('/').pop()
  const temporaire = join(dossier, `.${nom}.${pid}.tmp`)
  const refuser = (refus) => {
    try {
      fs.rmSync(temporaire, { force: true })
      return { ok: false, refus }
    } catch (nettoyage) {
      return { ok: false, refus: `${refus} ; temporaire RESTANT, non supprimé (${nettoyage?.code ?? nettoyage?.message}) : ${temporaire}` }
    }
  }
  const relancee = (e) => {
    const reste = refuser('').refus
    if (reste && e instanceof Error) e.message += reste
    return e
  }
  try {
    fs.writeFileSync(temporaire, contenu)
  } catch (e) {
    return refuser(`temporaire ${temporaire} non écrit (${e?.code ?? e?.message}) : rien n'est écrit, relancer`)
  }
  let actuel
  try {
    actuel = relire(cible, fs)
  } catch (e) {
    throw relancee(e)
  }
  if (actuel === null) return refuser(`${cible} a disparu pendant la mesure : rien n'est écrit`)
  if (actuel !== attendu) return refuser(`${cible} a changé pendant la mesure : rien n'est écrit, relancer`)
  try {
    fs.renameSync(temporaire, cible)
    return { ok: true }
  } catch (e) {
    if (!TENU.has(e?.code)) throw relancee(e)
    return refuser(`suivi tenu par un autre processus (${e.code} au rename de ${cible}), relancer`)
  }
}

/**
 * Les suivis d'un dossier (`^\d+\.md$`, avec leur date) et les temporaires ORPHELINS
 * (`^\.\d+\.md\.\d+\.tmp$`) d'une écriture interrompue — nommés, jamais supprimés ici.
 * @param {{dossier: string, fs?: typeof FS}} params
 * @returns {{suivis: {nom: string, date: Date}[], orphelins: string[]}}
 */
export function listerSuivis({ dossier, fs = FS }) {
  const noms = listerDossier(dossier, { absent: 'vide' })
  return {
    suivis: noms.filter((n) => SUIVI.test(n)).map((nom) => ({ nom, date: fs.statSync(join(dossier, nom)).mtime })),
    orphelins: noms.filter((n) => ORPHELIN.test(n)),
  }
}

/** Le texte de la liste des suivis. PURE. */
export function texteDeLaListe({ dossier, suivis, orphelins }) {
  const texte = suivis.length
    ? suivis.map(({ nom, date }) => `${nom}\t${horodatage(date)}\n`).join('')
    : `aucun suivi sous ${dossier} — \`npm run ops:suivi -- <N> --creer\` en pose un\n`
  if (!orphelins.length) return texte
  return `${texte}\ntemporaires ORPHELINS (écriture interrompue) sous ${dossier} — à relire, puis à retirer à la main :\n`
    + orphelins.map((n) => `  ${n}\n`).join('')
}

/**
 * Le geste entier sur un suivi : `--creer` éventuel, portée, mesure profilée, relecture, écriture
 * atomique. Rend le code de sortie et les deux flux, sans rien imprimer.
 * @param {{numero: number, dossier: string, creer?: boolean, sansFetch?: boolean, fs?: typeof FS,
 *   pid?: number, maintenant?: Date, mesure?: Record<string, unknown>}} params `mesure` va à `mesureProfilee`
 * @returns {{code: number, stdout: string, stderr: string}}
 */
export function suivre({ numero, dossier, creer = false, sansFetch = false, fs = FS, pid = process.pid, maintenant = new Date(), mesure = {} }) {
  const refus = (motif) => ({ code: 1, stdout: '', stderr: `[suivi] ${motif}\n` })
  const cible = join(dossier, `${numero}.md`)
  if (creer) {
    if (fs.existsSync(cible)) return refus(`${cible} existe déjà — \`npm run ops:suivi -- ${numero}\` le rafraîchit`)
    fs.mkdirSync(dossier, { recursive: true })
    fs.writeFileSync(cible, gabaritDuSuivi(numero), { flag: 'wx' })
  } else if (!fs.existsSync(cible)) {
    return refus(`suivi #${numero} absent (${cible}) — \`npm run ops:suivi -- ${numero} --creer\` le pose`)
  }

  const avant = ticketsPrevus(fs.readFileSync(cible, 'utf8'))
  if (avant.refus) return refus(`${cible} : ${avant.refus}`)
  const { vu, profil } = mesureProfilee({
    ...mesure, portee: avant.tickets, sansFetch, commandeSansFetch: `npm run ops:suivi -- ${numero} --sans-fetch`,
  })
  const texte = relire(cible, fs)
  if (texte === null) return refus(`${cible} a disparu pendant la mesure : rien n'est écrit`)
  const apres = ticketsPrevus(texte)
  if (apres.refus) return refus(`${cible} : ${apres.refus}`)
  if (apres.tickets.join() !== avant.tickets.join()) {
    return refus(`la portée de ${cible} a changé pendant la mesure ([${avant.tickets}] → [${apres.tickets}]) : rien n'est écrit, relancer`)
  }

  const contenu = renduDuSuivi({ texte, mesure: vu, epique: numero, maintenant })
  const ecrit = ecrireSuivi({ cible, contenu, attendu: texte, fs, pid })
  if (!ecrit.ok) {
    return { code: 1, stdout: '', stderr: `[suivi] ${ecrit.refus}\n${vu.ok ? '' : `[suivi] mesure refusée : ${vu.refus}\n`}` }
  }
  return { code: vu.ok ? 0 : 1, stdout: `${contenu}\n${ligneDeProfil(profil)}\n`, stderr: '' }
}

/**
 * Le dossier des suivis, `<arbre principal>/.git/suivi`, depuis n'importe quel arbre du dépôt (un
 * worktree lié compris) : l'union de `arbrePrincipal`, sa valeur prolongée du dossier.
 * @param {string} cwd
 * @returns {{disponible: true, valeur: string} | {disponible: false, raison: string}}
 */
export function dossierDesSuivis(cwd) {
  const vu = arbrePrincipal(depotDe(cwd))
  return vu.disponible ? { ...vu, valeur: join(vu.valeur, '.git', 'suivi') } : vu
}

/**
 * Les arguments de ce script : aucun (la liste des suivis), ou UN numéro `>= 1` et, au choix,
 * `--creer` et `--sans-fetch`. Toute autre forme est refusée (`null`). PURE.
 * @param {string[]} argv
 * @returns {{numero: number|null, creer: boolean, sansFetch: boolean} | null}
 */
export function argumentsDuSuivi(argv) {
  const numeros = argv.filter((a) => /^\d+$/.test(a)).map(Number)
  const valides = argv.every((a) => a === '--creer' || a === '--sans-fetch' || /^\d+$/.test(a))
  if (argv.length && (!valides || numeros.length !== 1 || numeros[0] < 1)) return null
  return { numero: numeros[0] ?? null, creer: argv.includes('--creer'), sansFetch: argv.includes('--sans-fetch') }
}

function main() {
  const argv = process.argv.slice(2)
  const lus = argumentsDuSuivi(argv)
  if (!lus) {
    process.stderr.write(`[suivi] arguments refusés : ${argv.join(' ')} — usage : \`npm run ops:suivi -- <N> `
      + '[--creer] [--sans-fetch]`, ou sans argument pour la liste des suivis\n')
    process.exit(1)
  }
  const vuDossier = dossierDesSuivis(process.cwd())
  if (!vuDossier.disponible) {
    process.stderr.write(`[suivi] ${vuDossier.raison}\n`)
    process.exit(1)
  }
  const dossier = vuDossier.valeur
  if (lus.numero === null) {
    process.stdout.write(texteDeLaListe({ dossier, ...listerSuivis({ dossier }) }))
    return
  }
  const { code, stdout, stderr } = suivre({ numero: lus.numero, dossier, creer: lus.creer, sansFetch: lus.sansFetch })
  process.stdout.write(stdout)
  process.stderr.write(stderr)
  process.exitCode = code
}

if (import.meta.main) main()
