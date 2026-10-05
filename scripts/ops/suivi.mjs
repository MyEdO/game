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
// LA RELECTURE SANS MÉMOIRE (#2132, #2279). `structureDuSuivi` est la STRUCTURE lue d'un suivi ; ses
// projections ne mesurent rien. La SITUATION d'un suivi lié (`lignesDeSituation`) : item en cours, prochain
// geste, éléments ouverts, mesure. `digestDuSuivi` : titre, Objectif, items et étapes ouvertes, zone mesurée
// datée, coupé à `PLAFOND_INJECTION`. `etatDeSession` : pour les suivis liés à une session au JOURNAL
// `<dossier>/.journal`, le `contexte` (digests, sinon l'index des suivis récents), les lignes du bandeau,
// la situation datée à `ajouter` et sa `cle` — ce que rendent le hook de session (`scripts/hooks/inject-suivi.mjs`,
// surface Codex) et le mod `harnais` (`.claude/skills/harnais/hooks/suivi.ts`), qui lit `--session <id> --json`.
// `dossierDesSuivis` est le dossier que ce script, le hook de session et le lien de session
// (`scripts/hooks/suivi-lien-guard.mjs`) partagent.
//
// L'ÉDITION (#2279). `--ajouter-item`, `--ajouter-etape`, `--cocher` éditent la zone ÉCRITE d'un suivi
// (`editionDuSuivi`, qui refuse toute édition dont la structure relue n'est pas celle d'avant plus
// l'élément visé), jamais la zone mesurée ; ils rejouent l'édition sur le texte frais quand l'écriture la
// refuse (`ESSAIS_D_EDITION`), lient la session `--session` à l'épique (`ligneDeLien`), puis rendent
// `etatDeSession` en JSON. Toute écriture d'un suivi, mesure comme édition, passe sous le verrou
// exclusif `.<N>.md.verrou` (`prendreVerrou`, scripts/test/verrou.mjs).
//
// Usage : `npm run ops:suivi -- <N> [--creer] [--sans-fetch]` · sans `<N>` : la liste des suivis ·
// `--session <id> --json [--depuis <cle>]` : l'état de la session, en lecture seule · `<N> --session <id> --json
// [--ticket <M>] --ajouter-item <#M libellé…> | --ajouter-etape <texte…> | --cocher <début du texte…>` : l'édition.
import * as FS from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { arbrePrincipal, depotDe } from '../guards/lib/gitPorte.mjs'
import { numerosDeLaChaine } from '../guards/lib/fermetures.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { BASE, GESTES_DU_BOARD, JOURS_FUSION_RECENTE, issuesDeGh, mesurer, urlDuTicket } from './board.mjs'
import { inventaire } from './worktrees.mjs'
import { prendreVerrou } from '../test/verrou.mjs'

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
/** Une étape : puce ou numéro indentés, case `[ ]` (groupe 1 : l'espace) ou `[x]`. */
const ETAPE = /^\s+(?:[-*+]|\d+\.)\s+\[([ xX])\]\s*/
/** La tête d'un item : son numéro et sa case éventuelle. */
const TETE_D_ITEM = /^\d+\.\s+(?:\[[ xX]\]\s*)?/
const TETE_DE_ZONE = '> Zone MESURÉE par'

/** Âge (h) au-delà duquel la zone mesurée d'un digest est marquée PÉRIMÉE. Valeur maison. */
export const HEURES_PEREMPTION = 24
/** Taille maximale (caractères) d'un digest injecté au contexte. Valeur maison. */
export const PLAFOND_INJECTION = 8000
/** Lignes de section au-delà desquelles un ticket FERMÉ est « À condenser » : l'item et deux étapes. Valeur maison. */
export const LIGNES_D_UN_TICKET_FERME = 3
/** Fenêtre (h) de l'index des suivis d'une session sans lien. Valeur maison. */
export const HEURES_INDEX = 72
/**
 * Part (caractères) d'un digest en deçà de laquelle le contexte passe à une ligne par épique : l'en-tête,
 * le titre et l'Objectif du suivi réel #1816 (`scripts/ops/fixtures/suivi-1816.md`) en font 363. Valeur maison.
 */
export const PART_D_UN_DIGEST = 400
/** Largeur maximale (caractères) d'une ligne du bandeau et de l'ajout. Valeur maison. */
export const LARGEUR_D_UNE_LIGNE = 160
/** Essais d'une édition dont l'écriture est refusée (verrou pris, texte changé) avant le refus. Valeur maison. */
export const ESSAIS_D_EDITION = 20
/** Pause (ms) entre deux essais d'une édition. Valeur maison. */
export const PAUSE_ENTRE_ESSAIS_MS = 25
/** Nom du journal des liens de session, dans le dossier des suivis (le listage, `^\d+\.md$`, l'ignore). */
export const JOURNAL = '.journal'

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
 * leur NUMÉRO d'origine : ce qui est retiré devient une ligne vide. `traversees[i]` dit que la fin de la
 * ligne `i` tombe dans un commentaire HTML. PURE.
 * @param {{lignes: string[], debut: number, fin: number}} zones
 * @returns {{lignes: string[], anomalies: string[], traversees: boolean[]}}
 */
function nettoyer({ lignes: brutes, debut, fin }) {
  const anomalies = []
  const traversees = brutes.map(() => false)
  const zone = brutes.map((l, i) => (debut >= 0 && i >= debut && i <= fin ? '' : sansFin(l)))
  const sansCommentaires = zone.join('\n').replace(/<!--[\s\S]*?-->|<!--[\s\S]*$/g, (bloc, position, tout) => {
    const premiere = tout.slice(0, position).split('\n').length - 1
    bloc.split('\n').slice(1).forEach((_, k) => { traversees[premiere + k] = true })
    if (!bloc.endsWith('-->')) {
      const ligne = premiere + 1
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
  return { lignes, anomalies, traversees }
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
 * `lignes` jointes, coupées à la ligne pour tenir sous `plafond`, `fin` comprise : jamais plus de
 * `plafond` caractères. L'en-tête (première ligne) passe avant la fin : s'il ne tient pas entier avec
 * elle, il est coupé ; si la fin seule dépasse, seul l'en-tête coupé reste. PURE.
 */
function plafonner(lignes, plafond, fin) {
  const entier = lignes.join('\n')
  if (entier.length <= plafond) return entier
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
 * L'ÉTAT STRUCTURÉ d'un suivi, lu sur la zone écrite nettoyée (commentaires HTML et blocs de code n'y
 * entrent pas) : son titre (la première ligne `# `), ses sections `## Objectif` et `## En cours` dans
 * l'ordre — lignes non vides de l'Objectif ; items de `## En cours` (premier `#N` de la ligne, libellé
 * sans numéro ni case, fait si coché `[x]`) et leurs étapes `[ ]`/`[x]`, les étapes d'avant le premier
 * item à part —, puis la zone mesurée et sa date, PÉRIMÉE au-delà de `HEURES_PEREMPTION` de `maintenant`.
 * Chaque élément porte `i`, son indice de ligne dans le texte ; une section et un item portent `fin`,
 * l'indice de leur dernière ligne non vide (un item : sa ligne et ses lignes indentées). PURE.
 * @param {string} texte
 * @param {{maintenant?: Date}} [params] sans `maintenant`, ni âge ni péremption
 */
export function structureDuSuivi(texte, { maintenant } = {}) {
  const vues = zonesDe(texte)
  const zones = vues.ok ? vues : { lignes: lignesDe(texte), debut: -1, fin: -1 }
  let titre = null
  const sections = []
  let section = null
  let item = null
  nettoyer(zones).lignes.forEach((ligne, i) => {
    if (/^# /.test(ligne) && !titre) {
      titre = { i, ligne, texte: ligne.slice(2) }
    } else if (/^## /.test(ligne)) {
      const nature = OBJECTIF.test(ligne) ? 'objectif' : SECTION.test(ligne) ? 'en-cours' : null
      section = nature ? { i, fin: i, ligne, nature, objectif: [], items: [], etapesHorsItem: [] } : null
      item = null
      if (section) sections.push(section)
    } else if (section?.nature === 'objectif' && ligne.trim()) {
      section.objectif.push({ i, ligne })
      section.fin = i
    } else if (section?.nature === 'en-cours' && ligne.trim()) {
      section.fin = i
      if (ITEM.test(ligne)) {
        const [premier] = numerosDeLaChaine(ligne)
        const ticket = premier === undefined || Number(premier) < 1 ? null : Number(premier)
        item = { i, fin: i, ligne, ticket, libelle: ligne.replace(TETE_D_ITEM, ''), fait: ITEM_FAIT.test(ligne), etapes: [] }
        section.items.push(item)
        return
      }
      if (item && /^\s+\S/.test(ligne)) item.fin = i
      const m = ETAPE.exec(ligne)
      if (m) (item ? item.etapes : section.etapesHorsItem).push({ i, ligne, texte: ligne.slice(m[0].length), ouverte: m[1] === ' ' })
    }
  })
  const zone = zones.debut >= 0 ? zones.lignes.slice(zones.debut + 1, zones.fin).map(sansFin) : []
  const date = dateDeLaZone(zone)
  const heures = date && maintenant ? (maintenant.getTime() - date.getTime()) / 3_600_000 : null
  return {
    refus: vues.ok ? null : vues.refus,
    titre,
    sections,
    zone: { lignes: zone, date, heures, perimee: heures !== null && heures > HEURES_PEREMPTION },
  }
}

/** Les items des sections `## En cours` d'un `structureDuSuivi`, dans l'ordre. PURE. */
const itemsDe = (structure) => structure.sections.flatMap((s) => s.items)
/** Les étapes OUVERTES des sections `## En cours` d'un `structureDuSuivi`, dans l'ordre. PURE. */
const etapesOuvertesDe = (structure) => structure.sections.flatMap((s) => [...s.etapesHorsItem, ...s.items.flatMap((it) => it.etapes)])
  .filter((e) => e.ouverte)

/**
 * Le DIGEST d'un suivi, projection texte de `structureDuSuivi` : son titre, son `## Objectif`, les items de
 * `## En cours` (sauf ceux cochés `[x]`) et leurs étapes `[ ]`, dans l'ordre du texte, puis la zone
 * mesurée — PÉRIMÉE au-delà de `HEURES_PEREMPTION`, ou « jamais rafraîchie ». Coupé à `plafond`
 * caractères, terminé par « tronqué, lire <chemin> ». PURE.
 * @param {string} texte
 * @param {{epique: number, chemin: string, mtime: Date, maintenant: Date, plafond?: number}} params
 * @returns {string}
 */
export function digestDuSuivi(texte, { epique, chemin, mtime, maintenant, plafond = PLAFOND_INJECTION }) {
  const structure = structureDuSuivi(texte, { maintenant })
  const sortie = [`[suivi #${epique}] ${chemin} — écrit le ${horodatage(mtime)}`]
  if (structure.refus) sortie.push(`⚠ ${structure.refus}`)
  const plan = structure.sections.flatMap((s) => [s, ...s.objectif, ...s.items.filter((it) => !it.fait)])
  sortie.push(...[...(structure.titre ? [structure.titre] : []), ...plan, ...etapesOuvertesDe(structure)].sort((a, b) => a.i - b.i).map((e) => e.ligne))
  const rafraichir = `\`npm run ops:suivi -- ${epique}\``
  sortie.push('', '## Zone mesurée')
  if (!structure.zone.date) {
    sortie.push(`zone mesurée jamais rafraîchie : ${rafraichir}`)
  } else {
    if (structure.zone.perimee) {
      sortie.push(`**PÉRIMÉE** : mesurée il y a ${Math.floor(structure.zone.heures)} h (au-delà de ${HEURES_PEREMPTION} h) — ${rafraichir}`)
    }
    sortie.push(...structure.zone.lignes)
  }
  return plafonner(sortie, plafond, `… tronqué, lire ${chemin}`)
}

/** La ligne TSV d'un lien de session au `JOURNAL` (iso, session_id, épique), fin comprise. PURE. */
export const ligneDeJournal = ({ iso, session, epique }) =>
  `${[iso, session, epique].map((v) => String(v).replace(/[\t\r\n]/g, ' ')).join('\t')}\n`

/**
 * Les lignes lisibles d'un `JOURNAL` ; une ligne mal formée est ignorée. PURE.
 * @param {string} texte
 * @returns {Array<{iso: string, session: string, epique: number}>}
 */
export function lignesDuJournal(texte) {
  return String(texte ?? '').split(/\r?\n/).map((l) => l.split('\t')).filter((c) => c.length === 3 && /^\d+$/.test(c[2]))
    .map(([iso, session, epique]) => ({ iso, session, epique: Number(epique) }))
}

/** Les épiques liées à `session`, dans l'ordre de leur premier lien. PURE. */
export const epiquesLiees = (lignes, session) =>
  [...new Set(lignes.filter((l) => l.session === session).map((l) => l.epique))]

/** La ligne qui lie `session` à `epique` dans le texte du `journal`, `null` si le lien y est déjà. PURE. */
export const ligneDeLien = ({ journal, session, epique, iso }) =>
  (epiquesLiees(lignesDuJournal(journal), session).includes(epique) ? null : ligneDeJournal({ iso, session, epique }))

/** Le titre d'un suivi (`structureDuSuivi`), `''` sans titre. PURE. */
const titreDuSuivi = (texte) => structureDuSuivi(texte).titre?.texte ?? ''

/** La ligne d'un suivi lié mais absent. PURE. */
const ligneAbsente = (epique, chemin) => `[suivi #${epique}] lié à cette session, mais absent : ${chemin}`

/** L'âge d'une mesure, en minutes sous une heure, en heures au-delà. PURE. */
const age = (heures) => (heures < 1 ? `${Math.floor(heures * 60)} min` : `${Math.floor(heures)} h`)

/**
 * Les lignes d'ÉTAT d'un suivi lié, chacune sous `LARGEUR_D_UNE_LIGNE` : l'item en cours (premier item
 * non coché), sa prochaine étape ouverte, le compte des items et étapes ouverts et la mesure — son ÂGE
 * à `maintenant` pour le bandeau (`age: true`), sa DATE pour l'ajout. PURE.
 * @param {{epique: number, chemin: string, texte: string|null}} lu
 * @param {{maintenant: Date, age: boolean}} params
 * @returns {string[]}
 */
export function lignesDeSituation({ epique, chemin, texte }, { maintenant, age: enAge }) {
  if (texte === null) return [coupeAuMot(ligneAbsente(epique, chemin), LARGEUR_D_UNE_LIGNE)]
  const structure = structureDuSuivi(texte, { maintenant })
  const tete = `[suivi #${epique}]`
  const ouverts = itemsDe(structure).filter((it) => !it.fait)
  const prochaine = ouverts[0]?.etapes.find((e) => e.ouverte)
  const { date, heures, perimee } = structure.zone
  const quand = () => (enAge ? `il y a ${age(heures)}` : `le ${horodatage(date)}`)
  const mesure = date ? `${perimee ? 'PÉRIMÉE, ' : ''}mesurée ${quand()}` : 'jamais mesurée'
  return [
    ...(structure.refus ? [`${tete} ⚠ ${structure.refus}`] : []),
    ouverts.length ? `${tete} en cours : ${ouverts[0].libelle}` : `${tete} aucun item ouvert`,
    ...(prochaine ? [`  prochain geste : ${prochaine.texte}`] : []),
    `  ouverts : ${ouverts.length} item(s), ${etapesOuvertesDe(structure).length} étape(s) · ${mesure}`,
  ].map((l) => coupeAuMot(l, LARGEUR_D_UNE_LIGNE))
}

/** Un extrait de texte pour un refus d'édition. PURE. */
const cite = (texte) => `« ${coupeAuMot(texte, 80)} »`

/**
 * La FORME d'une structure de suivi, sans ses indices de ligne : titre, sections, items, étapes, zone
 * mesurée. Ce qu'une édition préserve, à l'élément visé près. PURE.
 */
const formeDe = (structure) => ({
  titre: structure.titre?.ligne ?? null,
  sections: structure.sections.map((s) => ({
    ligne: s.ligne,
    objectif: s.objectif.map((l) => l.ligne),
    etapesHorsItem: s.etapesHorsItem.map(({ texte, ouverte }) => ({ texte, ouverte })),
    items: s.items.map(({ ligne, ticket, fait, etapes }) => ({ ligne, ticket, fait, etapes: etapes.map(({ texte, ouverte }) => ({ texte, ouverte })) })),
  })),
  zone: structure.zone.lignes,
})

/**
 * Le texte d'un suivi après UNE édition de sa zone ÉCRITE, les autres lignes à l'octet, une ligne ajoutée
 * à la fin de ligne du fichier. Gestes :
 * - `ajouter-item` : `<n>. <texte>` après la dernière ligne de la première section `## En cours` (après la fin
 *   du commentaire HTML que cette ligne ouvre, s'il y en a un), `<n>`
 *   suivant le numéro de son dernier item ; `texte` porte un `#M` (le ticket de l'item) absent des items ;
 * - `ajouter-etape` : `- [ ] <texte>` après la dernière ligne de l'item du ticket `ticket` (même règle), à
 *   l'indentation de sa première étape (trois espaces sans étape) ;
 * - `cocher` : `[ ]` → `[x]` sur la SEULE étape ouverte de l'item `ticket` dont le texte commence par `texte`.
 * La structure relue après (`structureDuSuivi`, `zonesDe`) doit valoir celle d'avant plus EXACTEMENT
 * l'élément visé (item visible, étape visible sous son item, étape fermée) ; sinon refus, rien n'est rendu.
 * Refus nommé : texte vide ou sur plusieurs lignes, item absent ou déjà présent, item sans ticket, aucune
 * étape ou plusieurs, structure déformée. PURE.
 * @param {string} texte
 * @param {{quoi: 'ajouter-item'|'ajouter-etape'|'cocher', ticket?: number, texte: string}} geste
 * @returns {{ok: true, texte: string} | {ok: false, refus: string}}
 */
export function editionDuSuivi(texte, geste) {
  const refus = (motif) => ({ ok: false, refus: motif })
  const prevus = ticketsPrevus(texte)
  if (prevus.refus) return refus(prevus.refus)
  if (/[\r\n]/.test(String(geste.texte ?? ''))) return refus(`${geste.quoi} : texte sur plusieurs lignes — une édition porte UNE ligne`)
  const ecrit = String(geste.texte ?? '').trim()
  if (!ecrit) return refus(`${geste.quoi} : texte vide`)
  const structure = structureDuSuivi(texte)
  const attendue = formeDe(structure)
  const lignes = lignesDe(texte)
  const fin = /\r\n/.test(texte) ? '\r\n' : '\n'
  const verifie = (nouveau) => {
    const zones = zonesDe(nouveau)
    if (!zones.ok) return refus(`${geste.quoi} : l'édition casserait la zone mesurée (${zones.refus})`)
    if (JSON.stringify(formeDe(structureDuSuivi(nouveau))) !== JSON.stringify(attendue)) {
      return refus(`${geste.quoi} : l'édition ne serait pas lue telle quelle (commentaire HTML, bloc de code ou ligne qui change la structure) — rien n'est écrit`)
    }
    return { ok: true, texte: nouveau }
  }
  const vues = zonesDe(texte)
  const { traversees } = nettoyer(vues.ok ? vues : { lignes, debut: -1, fin: -1 })
  const inserer = (derniere, ligne) => {
    let i = derniere
    while (traversees[i]) i += 1
    const avant = lignes.slice(0, i + 1)
    if (!avant[i].endsWith('\n')) avant[i] += fin
    return verifie([...avant, `${ligne}${fin}`, ...lignes.slice(i + 1)].join(''))
  }
  const enCours = structure.sections.map((s, rang) => ({ s, rang })).filter(({ s }) => s.nature === 'en-cours')
  if (geste.quoi === 'ajouter-item') {
    const [premier] = numerosDeLaChaine(ecrit)
    if (premier === undefined || Number(premier) < 1) return refus(`item sans ticket : ${cite(ecrit)} — un item porte un #N`)
    const ticket = Number(premier)
    const deja = itemsDe(structure).find((it) => it.ticket === ticket)
    if (deja) return refus(`item #${ticket} déjà présent (l.${deja.i + 1}) : ${cite(deja.ligne)}`)
    const { s: section, rang } = enCours[0]
    const dernier = section.items.at(-1)
    const ligne = `${dernier ? Number(/^\d+/.exec(dernier.ligne)[0]) + 1 : 1}. ${ecrit}`
    attendue.sections[rang].items.push({ ligne, ticket, fait: ITEM_FAIT.test(ligne), etapes: [] })
    return inserer(section.fin, ligne)
  }
  const lieu = enCours.flatMap(({ s, rang }) => s.items.map((item, k) => ({ item, rang, k }))).find(({ item }) => item.ticket === geste.ticket)
  if (!lieu) return refus(`item #${geste.ticket} absent de \`## En cours\``)
  const { item, rang, k } = lieu
  const vise = attendue.sections[rang].items[k]
  if (geste.quoi === 'ajouter-etape') {
    const retrait = item.etapes.length ? /^\s+/.exec(item.etapes[0].ligne)[0] : '   '
    vise.etapes.push({ texte: ecrit, ouverte: true })
    return inserer(item.fin, `${retrait}- [ ] ${ecrit}`)
  }
  const candidates = item.etapes.map((e, rangEtape) => ({ e, rangEtape })).filter(({ e }) => e.ouverte && e.texte.startsWith(ecrit))
  if (!candidates.length) return refus(`aucune étape ouverte de l'item #${geste.ticket} ne commence par ${cite(ecrit)}`)
  if (candidates.length > 1) {
    return refus(`étape ambiguë : ${candidates.length} étapes ouvertes de l'item #${geste.ticket} commencent par ${cite(ecrit)}`
      + ` (${candidates.map(({ e }) => `l.${e.i + 1}`).join(', ')})`)
  }
  const [{ e: etape, rangEtape }] = candidates
  vise.etapes[rangEtape].ouverte = false
  return verifie(lignes.map((l, i) => (i === etape.i ? l.replace('[ ]', '[x]') : l)).join(''))
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
 * le contenu rendu. La relecture, la comparaison et le `rename` se font sous le verrou EXCLUSIF
 * `.<N>.md.verrou` voisin (`prendreVerrou`) ; un verrou tenu par un processus vivant est un refus.
 * `rejouable` dit qu'un refus tient à un autre écrivain (verrou pris, texte changé) : le même geste,
 * rejoué sur le texte frais, peut passer. `geste` nomme ce pendant quoi le texte a changé.
 * @param {{cible: string, contenu: string, attendu: string, geste: string, fs?: typeof FS, pid?: number}} params
 * @returns {{ok: true} | {ok: false, refus: string, rejouable: boolean}}
 */
export function ecrireSuivi({ cible, contenu, attendu, geste, fs = FS, pid = process.pid }) {
  const dossier = join(cible, '..')
  const nom = cible.replace(/\\/g, '/').split('/').pop()
  const verrou = prendreVerrou({ chemin: join(dossier, `.${nom}.verrou`), pid, commande: 'scripts/ops/suivi.mjs', cwd: dossier, env: {} })
  if (verrou.etat !== 'pris') return { ok: false, refus: `${cible} est en cours d'écriture par un autre processus : rien n'est écrit`, rejouable: true }
  try {
    return ecrireSousVerrou({ cible, contenu, attendu, geste, fs, pid, dossier, nom })
  } finally {
    verrou.liberer()
  }
}

/** Le corps de `ecrireSuivi`, verrou tenu. */
function ecrireSousVerrou({ cible, contenu, attendu, geste, fs, pid, dossier, nom }) {
  const temporaire = join(dossier, `.${nom}.${pid}.tmp`)
  const refuser = (refus, rejouable = false) => {
    try {
      fs.rmSync(temporaire, { force: true })
      return { ok: false, refus, rejouable }
    } catch (nettoyage) {
      return { ok: false, refus: `${refus} ; temporaire RESTANT, non supprimé (${nettoyage?.code ?? nettoyage?.message}) : ${temporaire}`, rejouable: false }
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
  if (actuel === null) return refuser(`${cible} a disparu pendant ${geste} : rien n'est écrit`)
  if (actuel !== attendu) return refuser(`${cible} a changé pendant ${geste} : rien n'est écrit, relancer`, true)
  try {
    fs.renameSync(temporaire, cible)
    return { ok: true }
  } catch (e) {
    if (!TENU.has(e?.code)) throw relancee(e)
    return refuser(`suivi tenu par un autre processus (${e.code} au rename de ${cible}), relancer`, true)
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
 * Les suivis liés à `session` au `JOURNAL` de `dossier`, dans l'ordre de leur premier lien : leur
 * texte (`null` s'il est absent) et sa date.
 * @param {{session: string, dossier: string, fs?: typeof FS}} params
 * @returns {{epique: number, chemin: string, texte: string|null, mtime: Date|null}[]}
 */
export function suivisLies({ session, dossier, fs = FS }) {
  return epiquesLiees(lignesDuJournal(relire(join(dossier, JOURNAL), fs) ?? ''), session).map((epique) => {
    const chemin = join(dossier, `${epique}.md`)
    const texte = relire(chemin, fs)
    return { epique, chemin, texte, mtime: texte === null ? null : fs.statSync(chemin).mtime }
  })
}

/**
 * Une ligne par suivi lié, `[suivi #N] <titre> — lire <chemin>`, chacune coupée à sa part (le titre
 * d'abord), le total fin comprise sous `PLAFOND_INJECTION`. Quand même `[suivi #N]` ne tient plus dans
 * la part, les derniers sont omis et une ligne dit combien. PURE.
 * @param {{lus: ReturnType<typeof suivisLies>, dossier: string}} params
 * @returns {string}
 */
function lignesParEpique({ lus, dossier }) {
  const omises = (k) => (k < lus.length ? [`[suivi] ${lus.length - k} autres épiques liées à cette session, omises : ${dossier}`] : [])
  for (let k = lus.length; k > 0; k -= 1) {
    const queue = omises(k)
    const part = Math.floor((PLAFOND_INJECTION - queue.reduce((t, l) => t + l.length + 1, 0) - k) / k)
    const gardes = lus.slice(0, k)
    if (gardes.some(({ epique }) => `[suivi #${epique}]`.length > part)) continue
    const lignes = gardes.map(({ epique, chemin, texte }) => {
      if (texte === null) return ligneAbsente(epique, chemin).slice(0, part)
      const tete = `[suivi #${epique}]`
      const fin = ` — lire ${chemin}`
      const place = part - tete.length - 1 - fin.length
      const titre = place > 0 ? coupeAuMot(titreDuSuivi(texte), place) : ''
      const ligne = `${titre ? `${tete} ${titre}` : tete}${fin}`
      return ligne.length <= part ? ligne : ligne.slice(0, part)
    })
    return `${[...lignes, ...queue].join('\n')}\n`
  }
  return `${omises(0)[0]}\n`.slice(0, PLAFOND_INJECTION)
}

/**
 * Le CONTEXTE d'une session : les digests de ses suivis liés `lus` (une ligne par épique quand la part
 * d'un digest passe sous `PART_D_UN_DIGEST`), sinon l'index des suivis de `dossier` modifiés depuis
 * moins de `HEURES_INDEX` et le geste qui lie ; `''` sans rien à dire. Le total ne dépasse jamais
 * `PLAFOND_INJECTION`.
 * @param {{lus: ReturnType<typeof suivisLies>, dossier: string, maintenant: Date, fs?: typeof FS}} params
 * @returns {string}
 */
function contexteDeSession({ lus, dossier, maintenant, fs = FS }) {
  // Chaque digest reçoit sa part du plafond, séparateurs `\n\n` et fin `\n` déduits : le TOTAL tient.
  const plafond = Math.floor((PLAFOND_INJECTION - 2 * lus.length) / Math.max(1, lus.length))
  if (lus.length && plafond < PART_D_UN_DIGEST) return lignesParEpique({ lus, dossier })
  const digests = lus.map(({ epique, chemin, texte, mtime }) => (texte === null
    ? ligneAbsente(epique, chemin).slice(0, plafond)
    : digestDuSuivi(texte, { epique, chemin, mtime, maintenant, plafond })))
  if (digests.length) return `${digests.join('\n\n')}\n`
  const recents = listerSuivis({ dossier, fs }).suivis
    .filter(({ date }) => maintenant.getTime() - date.getTime() < HEURES_INDEX * 3_600_000)
  if (!recents.length) return ''
  const lignes = recents.map(({ nom, date }) =>
    `- #${nom.replace(/\.md$/, '')} — ${titreDuSuivi(relire(join(dossier, nom), fs) ?? '')} — ${horodatage(date)}`)
  return [
    `[suivi] session sans suivi lié ; suivis de vague modifiés depuis moins de ${HEURES_INDEX} h (${dossier}) :`,
    ...lignes,
    '`npm run ops:suivi -- N` lie cette session au suivi #N.',
    '',
  ].join('\n')
}

/**
 * L'ÉTAT d'une session, prêt à rendre, sans rien mesurer ni écrire : par suivi lié, ses `lignes` de
 * bandeau (`lignesDeSituation`, âge de la mesure) ; le `contexte` (`contexteDeSession`) ; l'`ajout`, l'état
 * daté des suivis liés (`''` sans lien, ou quand la `cle` vaut `depuis`) ; la `cle`, condensé de cet état hors
 * de sa date de relecture.
 * @param {{session: string, dossier: string, maintenant: Date, depuis?: string|null, fs?: typeof FS}} params
 * @returns {{session: string, suivis: {epique: number, chemin: string, lignes: string[]}[], contexte: string, ajout: string, cle: string}}
 */
export function etatDeSession({ session, dossier, maintenant, depuis = null, fs = FS }) {
  const lus = suivisLies({ session, dossier, fs })
  const situation = lus.flatMap((lu) => lignesDeSituation(lu, { maintenant, age: false }))
  const cle = createHash('sha256').update(situation.join('\n')).digest('hex').slice(0, 16)
  return {
    session,
    suivis: lus.map((lu) => ({ epique: lu.epique, chemin: lu.chemin, lignes: lignesDeSituation(lu, { maintenant, age: true }) })),
    contexte: contexteDeSession({ lus, dossier, maintenant, fs }),
    ajout: situation.length && cle !== depuis ? [`[suivi] situation relue le ${horodatage(maintenant)}`, ...situation].join('\n') : '',
    cle,
  }
}

/**
 * L'édition entière d'un suivi : relecture, `editionDuSuivi`, écriture atomique sous verrou (`ecrireSuivi`),
 * rejouée sur le texte frais tant que l'écriture la refuse pour un autre écrivain (`ESSAIS_D_EDITION` au
 * plus), lien de `session` à l'épique (`ligneDeLien`), puis `etatDeSession` en JSON sur stdout. Rend le
 * code de sortie et les deux flux, sans rien imprimer.
 * @param {{numero: number, dossier: string, session: string, geste: Parameters<typeof editionDuSuivi>[1],
 *   fs?: typeof FS, pid?: number, maintenant?: Date}} params
 * @returns {{code: number, stdout: string, stderr: string}}
 */
export function editer({ numero, dossier, session, geste, fs = FS, pid = process.pid, maintenant = new Date() }) {
  const refus = (motif) => ({ code: 1, stdout: '', stderr: `[suivi] ${motif}\n` })
  const cible = join(dossier, `${numero}.md`)
  for (let essai = 1; ; essai += 1) {
    const texte = relire(cible, fs)
    if (texte === null) return refus(`suivi #${numero} absent (${cible}) — \`npm run ops:suivi -- ${numero} --creer\` le pose`)
    const edite = editionDuSuivi(texte, geste)
    if (!edite.ok) return refus(`${cible} : ${edite.refus}`)
    const ecrit = ecrireSuivi({ cible, contenu: edite.texte, attendu: texte, geste: `l'édition « ${geste.quoi} »`, fs, pid })
    if (ecrit.ok) break
    if (!ecrit.rejouable) return refus(ecrit.refus)
    if (essai >= ESSAIS_D_EDITION) return refus(`${ecrit.refus} (${ESSAIS_D_EDITION} essais)`)
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, PAUSE_ENTRE_ESSAIS_MS)
  }
  const journal = join(dossier, JOURNAL)
  const lien = ligneDeLien({ journal: relire(journal, fs) ?? '', session, epique: numero, iso: maintenant.toISOString() })
  if (lien) fs.appendFileSync(journal, lien)
  return { code: 0, stdout: `${JSON.stringify(etatDeSession({ session, dossier, maintenant, fs }))}\n`, stderr: '' }
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
  const ecrit = ecrireSuivi({ cible, contenu, attendu: texte, geste: 'la mesure', fs, pid })
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

/** Les gestes d'édition, et s'ils exigent `--ticket <M>` (l'item visé). */
const GESTES = {
  '--ajouter-item': { quoi: 'ajouter-item', ticket: false },
  '--ajouter-etape': { quoi: 'ajouter-etape', ticket: true },
  '--cocher': { quoi: 'cocher', ticket: true },
}
const NUMERO = /^\d+$/

/**
 * Les arguments de ce script, trois formes ; toute autre est refusée (`null`). PURE.
 * - aucun (la liste des suivis), ou UN numéro `>= 1` et, au choix, `--creer` et `--sans-fetch` ;
 * - `--session <id> --json [--depuis <cle>]` : l'état de la session (`etatDeSession`), `ajout` vide si sa
 *   clé vaut `<cle>` ;
 * - `<N> --session <id> --json [--ticket <M>]` puis, en DERNIER, un geste d'édition (`GESTES`) :
 *   `--ajouter-item <texte…>`, `--ajouter-etape <texte…>`, `--cocher <texte…>` ; `--ticket` est exigé par
 *   les gestes qui visent un item, refusé par les autres. Le texte est TOUT ce qui suit le geste, joint
 *   d'une espace : un argument cité ou ses mots découpés (`appelsDuSuivi`) rendent le même geste.
 * @param {string[]} argv
 * @returns {{numero: number|null, creer: boolean, sansFetch: boolean, session: string|null, json: boolean,
 *   depuis: string|null, geste: {quoi: string, ticket?: number, texte: string}|null} | null}
 */
export function argumentsDuSuivi(argv) {
  const k = argv.findIndex((a) => Object.hasOwn(GESTES, a))
  const tete = k < 0 ? argv : argv.slice(0, k)
  const valeurDe = (drapeau, argv) => {
    const k = argv.indexOf(drapeau)
    if (k < 0) return { valeur: null, reste: argv }
    const valeur = argv[k + 1] ?? ''
    return { valeur: valeur && !valeur.startsWith('--') ? valeur : '', reste: [...argv.slice(0, k), ...argv.slice(k + 2)] }
  }
  const { valeur: session, reste: sansSession } = valeurDe('--session', tete)
  const { valeur: depuis, reste: sansDepuis } = valeurDe('--depuis', sansSession)
  const { valeur: ticket, reste: restants } = valeurDe('--ticket', sansDepuis)
  if (session === '' || depuis === '' || ticket === '') return null
  if (ticket !== null && (!NUMERO.test(ticket) || Number(ticket) < 1)) return null
  let geste = null
  if (k >= 0) {
    const { quoi, ticket: exige } = GESTES[argv[k]]
    if (exige !== (ticket !== null)) return null
    geste = { quoi, ...(exige ? { ticket: Number(ticket) } : {}), texte: argv.slice(k + 1).join(' ') }
  } else if (ticket !== null) return null
  if (!restants.every((a) => a === '--creer' || a === '--sans-fetch' || a === '--json' || NUMERO.test(a))) return null
  const numeros = restants.filter((a) => NUMERO.test(a)).map(Number)
  if (numeros.length > 1 || numeros.some((n) => n < 1)) return null
  const lus = {
    numero: numeros[0] ?? null, creer: restants.includes('--creer'), sansFetch: restants.includes('--sans-fetch'),
    session, json: restants.includes('--json'), depuis, geste,
  }
  const options = lus.creer || lus.sansFetch
  if (session === null && !lus.json && !geste && depuis === null) return argv.length && lus.numero === null ? null : lus
  if (session === null || !lus.json || options || (depuis !== null && geste !== null)) return null
  return (lus.numero === null) === (geste === null) ? lus : null
}

/** L'usage, pour un refus d'arguments. */
const USAGE = '`npm run ops:suivi -- <N> [--creer] [--sans-fetch]`, sans argument pour la liste des suivis, '
  + '`--session <id> --json [--depuis <cle>]` pour l\'état de la session, `<N> --session <id> --json [--ticket <M>] '
  + '--ajouter-item <#M libellé…> | --ajouter-etape <texte…> | --cocher <début du texte…>` pour l\'édition'

function main() {
  const argv = process.argv.slice(2)
  const lus = argumentsDuSuivi(argv)
  if (!lus) {
    process.stderr.write(`[suivi] arguments refusés : ${argv.join(' ')} — usage : ${USAGE}\n`)
    process.exit(1)
  }
  const vuDossier = dossierDesSuivis(process.cwd())
  if (!vuDossier.disponible) {
    process.stderr.write(`[suivi] ${vuDossier.raison}\n`)
    process.exit(1)
  }
  const dossier = vuDossier.valeur
  if (lus.session !== null && lus.geste === null) {
    process.stdout.write(`${JSON.stringify(etatDeSession({ session: lus.session, dossier, maintenant: new Date(), depuis: lus.depuis }))}\n`)
    return
  }
  if (lus.numero === null) {
    process.stdout.write(texteDeLaListe({ dossier, ...listerSuivis({ dossier }) }))
    return
  }
  const { code, stdout, stderr } = lus.geste
    ? editer({ numero: lus.numero, dossier, session: lus.session, geste: lus.geste })
    : suivre({ numero: lus.numero, dossier, creer: lus.creer, sansFetch: lus.sansFetch })
  process.stdout.write(stdout)
  process.stderr.write(stderr)
  process.exitCode = code
}

if (import.meta.main) main()
