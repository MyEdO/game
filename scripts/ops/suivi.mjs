// SUIVI DE VAGUE — `.git/suivi/<N>.json`, un fichier par ÉPIQUE `<N>`, seule source du plan et du
// prochain geste de l'orchestrateur, ÉCRIT PAR CE SCRIPT SEUL : sa donnée, ses mutations et leur
// évaluateur vivent dans `scripts/ops/suiviDonnee.mjs` ; la garde `scripts/hooks/suivi-ecriture-guard.mjs`
// refuse toute autre écriture, et la lecture (`lireSuivi`) dit un suivi illisible ou écrit hors de l'outil.
//
// « Perso j'étais certain qu'un orchestrator avait un fichier de lot qui indiquait les tickets qu'il
// comptait travailler et le mettait a jour au fil de l'eau, histoire de savoir ou il en est et ou il
// va » ; « Il faut absoluelement faire un truc pour ce fichier de suivis, c'est vital si on veux
// éviter la dérive » (utilisateur, 2026-09-28, #2132). Emplacement choisi le même jour : « Commun git
// local (Recommandé) ». Le format : #2460, design jugé au commentaire 6044039158.
//
// LA MESURE (état de branche, d'avance, d'issue, de publication : il ne se saisit pas, il se mesure,
// `mesurer` de scripts/ops/board.mjs) vit dans le fichier VOISIN `<N>.mesure.json`, jamais dans le suivi ;
// elle se prend dans `scripts/ops/suiviMesure.mjs`, que le CLI charge pour `--mesurer` seulement : le lecteur,
// le hook de session et les gardes ne chargent jamais `board.mjs`.
//
// L'ÉCRITURE. Suivi comme mesure : `ecrireSuivi` (scripts/ops/suiviFichiers.mjs, que ce CLI et la mesure
// importent). Un lot refusé pour un autre écrivain se rejoue sur le texte frais
// (`ESSAIS_D_EDITION`).
//
// LA RELECTURE SANS MÉMOIRE (#2132, #2279), CONFRONTÉE À LA MESURE (#2460, `confronter`, suiviDonnee.mjs).
// `lignesDeSituation` : le bandeau d'un suivi lié (⚠ en ligne 1 — illisible, hors outil, mesure absente,
// PÉRIMÉE ou portée changée, `.md` abandonné —, item actif, prochain geste numéroté, anomalies, ouverts).
// `digestDuSuivi` : titre, anomalies, items et étapes ouvertes NUMÉROTÉES, file, arbitrages, signalements,
// mesure datée, coupé à `PLAFOND_INJECTION`. `etatDeSession` : pour les suivis liés à une session au JOURNAL
// `<dossier>/.journal`, le `contexte`, les lignes du bandeau, la situation datée à `ajouter`, sa `cle` et
// `aMesurer` — ce que rendent le hook de session (`scripts/hooks/inject-suivi.mjs`, surface Codex) et le mod
// `harnais` (`.claude/skills/harnais/hooks/suivi.ts`). Le lecteur ne mesure JAMAIS (#2279) : il DIT les
// épiques à re-mesurer, et le mod lance `--mesurer --sans-fetch`, sous le verrou de mesure sans attente.
// Un lien de session vers un `<N>.md` sans `<N>.json` se dit « format .md abandonné », sans le lire.
//
// Usage : `USAGE`, dérivé de `FORMES_DU_CLI` (la table des gestes, scripts/ops/suiviDonnee.mjs).
import * as FS from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { dossierDesSuivis } from '../guards/lib/gitPorte.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import {
  FORMES_DU_CLI, Lot, OUTIL_SUIVI, PLAFOND_INJECTION, appliquer, confronter, heuresDe, horodatage, lignesDeLaMesure, lignesDuPlan,
  lireSuivi, texteDuSuivi,
} from './suiviDonnee.mjs'
import { ecrireSuivi, lireLeSuivi, listerSuivis, nomDuSuivi, relire, suivisLisibles } from './suiviFichiers.mjs'

/** Fenêtre (h) de l'index des suivis d'une session sans lien. Valeur maison. */
export const HEURES_INDEX = 72
/** Part (caractères) d'un digest en deçà de laquelle le contexte passe à une ligne par épique. Valeur maison. */
export const PART_D_UN_DIGEST = 400
/** Largeur maximale (caractères) d'une ligne du bandeau et de l'ajout. Valeur maison. */
export const LARGEUR_D_UNE_LIGNE = 160
/** Essais d'un lot dont l'écriture est refusée (verrou pris, texte changé) avant le refus. Valeur maison. */
export const ESSAIS_D_EDITION = 20
/** Pause (ms) entre deux essais d'un lot. Valeur maison. */
export const PAUSE_ENTRE_ESSAIS_MS = 25
/** Nom du journal des liens de session, dans le dossier des suivis (le listage, `^\d+\.json$`, l'ignore). */
export const JOURNAL = '.journal'

// ————————————————————————————————— fonctions PURES —————————————————————————————————

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

/** L'âge d'une mesure, en minutes sous une heure, en heures au-delà. PURE. */
const age = (heures) => (heures < 1 ? `${Math.floor(heures * 60)} min` : `${Math.floor(heures)} h`)

/** La confrontation d'un suivi lu (`confronter`), `null` s'il n'est pas lu. PURE. */
const confrontation = (lu, maintenant) => (lu.suivi ? confronter({ suivi: lu.suivi, mesure: lu.mesure, autresSuivis: lu.autres ?? [], maintenant }) : null)

/** L'alerte de LIGNE 1 d'un suivi lu et de sa confrontation `c`, `null` sans rien à dire. PURE. */
const alerteDe = (lu, c) => {
  const dites = [...(lu.alerte ? [lu.alerte.replace(/^⚠ /, '')] : []), ...(c?.alertes ?? []).map((a) => a.court)]
  return dites.length ? `⚠ ${dites.join(' · ')}` : null
}

/** Le plan confronté d'un suivi lu : ses anomalies EN TÊTE (texte), ses étiquettes de mesure, puis sa mesure. PURE. */
function lignesConfrontees(lu, c, { complet }) {
  const anomalies = [
    ...c.anomalies.map((a) => `- ⚠ ${a.texte}`),
    ...(c.taisees ? [`- ${c.taisees} anomalie(s) tue(s) par disposition`] : []),
  ]
  return [...lignesDuPlan(lu.suivi, { complet, anomalies, etiquettes: c.etiquettes }), '', ...lignesDeLaMesure(lu)]
}

/**
 * Le DIGEST d'un suivi lu (`lireLeSuivi`) : son en-tête, son alerte EN TÊTE, son titre, ses anomalies, son
 * plan sans ce qui est clos ou fait, sa mesure. Coupé à `plafond`, terminé par le geste qui le rend entier. PURE.
 * @param {ReturnType<typeof lireLeSuivi>} lu
 * @param {{maintenant: Date, plafond?: number}} params
 * @returns {string}
 */
export function digestDuSuivi(lu, { maintenant, plafond = PLAFOND_INJECTION }) {
  const tete = `[suivi #${lu.epique}]`
  if (!lu.suivi) return plafonner([`${tete} ${lu.alerte}`], plafond, '…')
  const c = confrontation(lu, maintenant)
  const alerte = alerteDe(lu, c)
  const sortie = [
    `${tete} ${lu.chemin} — écrit le ${horodatage(new Date(lu.suivi.ecritLe))}`,
    ...(alerte ? [`${tete} ${alerte}`] : []),
    ...lignesConfrontees(lu, c, { complet: false }),
  ]
  return plafonner(sortie, plafond, `… tronqué, \`npm run ops:suivi -- ${lu.epique} --rendu\` le rend entier`)
}

/** Le RENDU complet d'un suivi lu, pour l'humain (`--rendu`) : alerte en tête, plan entier confronté, mesure. PURE. */
export function renduDuSuivi(lu, { maintenant }) {
  if (!lu.suivi) return `[suivi #${lu.epique}] ${lu.alerte}\n`
  const c = confrontation(lu, maintenant)
  const alerte = alerteDe(lu, c)
  return `${[...(alerte ? [`> ${alerte}`, ''] : []), ...lignesConfrontees(lu, c, { complet: true })].join('\n')}\n`
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

/**
 * Les lignes d'ÉTAT d'un suivi lu, chacune sous `LARGEUR_D_UNE_LIGNE` : l'alerte EN TÊTE (`alerteDe` :
 * illisible, hors outil, mesure absente, illisible, PÉRIMÉE ou portée changée), le premier item `actif`, sa
 * première étape ouverte `#ticket.n`, les anomalies de la confrontation (compte et forme courte), le compte
 * des items non clos et de leurs étapes ouvertes et la mesure — son ÂGE à `maintenant` pour le bandeau
 * (`age: true`), sa DATE pour l'ajout. PURE.
 * @param {ReturnType<typeof lireLeSuivi>} lu
 * @param {{maintenant: Date, age: boolean}} params
 * @returns {string[]}
 */
export function lignesDeSituation(lu, { maintenant, age: enAge }) {
  const tete = `[suivi #${lu.epique}]`
  const coupe = (lignes) => lignes.map((l) => coupeAuMot(l, LARGEUR_D_UNE_LIGNE))
  if (!lu.suivi) return coupe([`${tete} ${lu.alerte}`])
  const c = confrontation(lu, maintenant)
  const alerte = alerteDe(lu, c)
  const ouverts = lu.suivi.items.filter((i) => i.etat !== 'clos')
  const actif = ouverts.find((i) => i.etat === 'actif')
  const prochaine = actif?.etapes.find((e) => !e.faite)
  const etapes = ouverts.reduce((t, i) => t + i.etapes.filter((e) => !e.faite).length, 0)
  let mesure = 'jamais mesurée'
  if (lu.mesure && !lu.mesure.ok) mesure = 'mesure illisible'
  else if (lu.mesure) {
    mesure = `mesurée ${enAge ? `il y a ${age(heuresDe(lu.mesure.mesure, maintenant))}` : `le ${horodatage(new Date(lu.mesure.mesure.date))}`}`
      + `${lu.mesure.mesure.sansFetch ? ', sans fetch' : ''}`
  }
  return coupe([
    ...(alerte ? [`${tete} ${alerte}`] : []),
    actif ? `${tete} en cours : #${actif.ticket} ${actif.libelle}` : `${tete} aucun item actif`,
    ...(prochaine ? [`  prochain geste : #${actif.ticket}.${prochaine.n} ${prochaine.texte}`] : []),
    ...(c.anomalies.length ? [`  anomalies : ${c.anomalies.length} — ${c.anomalies.map((a) => a.court).join(' · ')}`] : []),
    `  ouverts : ${ouverts.length} item(s), ${etapes} étape(s) · ${mesure}`,
  ])
}

// ————————————————————————————————— écriture, CLI —————————————————————————————————

/** Le texte de la liste des suivis. PURE. */
export function texteDeLaListe({ dossier, suivis, orphelins }) {
  const texte = suivis.length
    ? suivis.map(({ nom, date }) => `${nom}\t${horodatage(date)}\n`).join('')
    : `aucun suivi sous ${dossier} — \`npm run ops:suivi -- <N> --creer <titre>\` en pose un\n`
  if (!orphelins.length) return texte
  return `${texte}\ntemporaires ORPHELINS (écriture interrompue) sous ${dossier} — à relire, puis à retirer à la main :\n`
    + orphelins.map((n) => `  ${n}\n`).join('')
}

/** Les suivis liés à `session` au `JOURNAL` de `dossier`, dans l'ordre de leur premier lien (`lireLeSuivi`). */
export function suivisLies({ session, dossier, fs = FS }) {
  const epiques = epiquesLiees(lignesDuJournal(relire(join(dossier, JOURNAL), fs) ?? ''), session)
  const lisibles = epiques.length ? suivisLisibles({ dossier, fs }) : []
  return epiques.map((epique) => lireLeSuivi({ dossier, epique, lisibles, fs }))
}

/** Le titre d'un suivi lu, son alerte s'il n'en a pas. PURE. */
const titreDe = (lu) => lu.suivi?.titre ?? lu.alerte

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
    const lignes = gardes.map((lu) => {
      const tete = `[suivi #${lu.epique}]`
      const fin = ` — lire ${lu.chemin}`
      const place = part - tete.length - 1 - fin.length
      const titre = place > 0 ? coupeAuMot(titreDe(lu), place) : ''
      const ligne = `${titre ? `${tete} ${titre}` : tete}${fin}`
      return ligne.length <= part ? ligne : ligne.slice(0, part)
    })
    return `${[...lignes, ...queue].join('\n')}\n`
  }
  return `${omises(0)[0]}\n`.slice(0, PLAFOND_INJECTION)
}

/**
 * L'INDEX d'une session sans lien : les suivis `recents` (le plus récent d'abord), une ligne chacun sous
 * `LARGEUR_D_UNE_LIGNE`, l'en-tête et le geste qui lie TOUJOURS gardés ; quand le tout passe
 * `PLAFOND_INJECTION`, les derniers sont omis et une ligne dit combien (#2266). PURE hors lecture des titres.
 * @param {{recents: {nom: string, date: Date}[], dossier: string, fs: typeof FS}} params
 * @returns {string}
 */
function indexDesSuivis({ recents, dossier, fs }) {
  const tete = `[suivi] session sans suivi lié ; suivis de vague modifiés depuis moins de ${HEURES_INDEX} h (${dossier}) :`
  const geste = '`npm run ops:suivi -- N` lie cette session au suivi #N.'
  const omis = (k) => `… ${k} autre(s) suivi(s) omis sous le plafond de ${PLAFOND_INJECTION} caractères : \`npm run ops:suivi\` les liste tous`
  const ordonnes = [...recents].sort((a, b) => b.date.getTime() - a.date.getTime())
  const gardees = []
  let taille = tete.length + 1 + geste.length + 1 + omis(ordonnes.length).length + 1
  for (const { nom, date } of ordonnes) {
    const epique = Number(nom.replace(/\.json$/, ''))
    const ligne = coupeAuMot(`- #${epique} — ${titreDe(lireLeSuivi({ dossier, epique, lisibles: [], fs }))} — ${horodatage(date)}`, LARGEUR_D_UNE_LIGNE)
    if (taille + ligne.length + 1 > PLAFOND_INJECTION) break
    gardees.push(ligne)
    taille += ligne.length + 1
  }
  const reste = ordonnes.length - gardees.length
  return [tete, ...gardees, ...(reste ? [omis(reste)] : []), geste, ''].join('\n')
}

/**
 * Le CONTEXTE d'une session : les digests de ses suivis liés `lus` (une ligne par épique quand la part
 * d'un digest passe sous `PART_D_UN_DIGEST`), sinon l'index des suivis de `dossier` modifiés depuis
 * moins de `HEURES_INDEX` (`indexDesSuivis`, sous `PLAFOND_INJECTION`) ; `''` sans rien à dire.
 * @param {{lus: ReturnType<typeof suivisLies>, dossier: string, maintenant: Date, fs?: typeof FS}} params
 * @returns {string}
 */
function contexteDeSession({ lus, dossier, maintenant, fs = FS }) {
  // Chaque digest reçoit sa part du plafond, séparateurs `\n\n` et fin `\n` déduits : le TOTAL tient.
  const plafond = Math.floor((PLAFOND_INJECTION - 2 * lus.length) / Math.max(1, lus.length))
  if (lus.length && plafond < PART_D_UN_DIGEST) return lignesParEpique({ lus, dossier })
  const digests = lus.map((lu) => digestDuSuivi(lu, { maintenant, plafond }))
  if (digests.length) return `${digests.join('\n\n')}\n`
  const recents = listerSuivis({ dossier, fs }).suivis
    .filter(({ date }) => maintenant.getTime() - date.getTime() < HEURES_INDEX * 3_600_000)
  return recents.length ? indexDesSuivis({ recents, dossier, fs }) : ''
}

/**
 * L'ÉTAT d'une session, prêt à rendre, sans rien mesurer ni écrire : par suivi lié, ses `lignes` de
 * bandeau (`lignesDeSituation`, âge de la mesure) ; le `contexte` (`contexteDeSession`) ; l'`ajout`, l'état
 * daté des suivis liés (`''` sans lien, ou quand la `cle` vaut `depuis`) ; la `cle`, condensé de cet état et
 * des (genre, clé) de ses anomalies, hors de leur âge et de la date de relecture ; `aMesurer`, les épiques
 * dont la confrontation demande une mesure (absente, illisible, PÉRIMÉE, portée changée).
 * @param {{session: string, dossier: string, maintenant: Date, depuis?: string|null, fs?: typeof FS}} params
 * @returns {{session: string, suivis: {epique: number, chemin: string, lignes: string[]}[], contexte: string, ajout: string,
 *   cle: string, aMesurer: number[]}}
 */
export function etatDeSession({ session, dossier, maintenant, depuis = null, fs = FS }) {
  const lus = suivisLies({ session, dossier, fs })
  const confrontes = lus.map((lu) => confrontation(lu, maintenant))
  const situation = lus.flatMap((lu) => lignesDeSituation(lu, { maintenant, age: false }))
  const anomalies = confrontes.flatMap((c) => (c ? [...c.alertes, ...c.anomalies].map((a) => `${a.genre}\t${a.cle}`) : []))
  const cle = createHash('sha256').update([...situation, ...anomalies].join('\n')).digest('hex').slice(0, 16)
  return {
    session,
    suivis: lus.map((lu) => ({ epique: lu.epique, chemin: lu.chemin, lignes: lignesDeSituation(lu, { maintenant, age: true }) })),
    contexte: contexteDeSession({ lus, dossier, maintenant, fs }),
    ajout: situation.length && cle !== depuis ? [`[suivi] situation relue le ${horodatage(maintenant)}`, ...situation].join('\n') : '',
    cle,
    aMesurer: lus.filter((_, k) => confrontes[k]?.aMesurer).map((lu) => lu.epique),
  }
}

/**
 * Le LOT entier sur un suivi : relecture (`lireSuivi` : un suivi illisible est refusé ; un suivi écrit hors
 * de l'outil passe à `appliquer` sous `horsOutil`, qui exige `reconnaitre` en tête), `appliquer` (tout ou
 * rien, budget compris), écriture atomique sous verrou (`ecrireSuivi`), rejouée sur le texte
 * frais tant que l'écriture la refuse pour un autre écrivain (`ESSAIS_D_EDITION` au plus), lien de
 * `session` à l'épique (`ligneDeLien`), puis l'état : `etatDeSession` en JSON sous `json`, la situation
 * sinon. Rend le code de sortie et les deux flux, sans rien imprimer.
 * @param {{numero: number, dossier: string, session?: string|null, json?: boolean, mutations: unknown[],
 *   fs?: typeof FS, pid?: number, maintenant?: Date}} params
 * @returns {{code: number, stdout: string, stderr: string}}
 */
export function editer({ numero, dossier, session = null, json = false, mutations, fs = FS, pid = process.pid, maintenant = new Date() }) {
  const refus = (motif) => ({ code: 1, stdout: '', stderr: `[suivi] ${motif}\n` })
  const cible = join(dossier, nomDuSuivi(numero))
  for (let essai = 1; ; essai += 1) {
    const texte = relire(cible, fs)
    let suivi = null
    let horsOutil = false
    if (texte !== null) {
      const vu = lireSuivi(texte)
      if (!vu.ok && vu.genre !== 'empreinte') return refus(`${cible} : ${vu.refus} — rien n'est écrit`)
      suivi = vu.suivi
      horsOutil = !vu.ok
    }
    const applique = appliquer(suivi, mutations, { maintenant, epique: numero, horsOutil })
    if (!applique.ok) {
      const creer = texte === null ? ` — \`npm run ops:suivi -- ${numero} --creer <titre>\` le pose` : ''
      return refus(`suivi #${numero} : ${applique.refus}${creer}`)
    }
    if (texte === null) fs.mkdirSync(dossier, { recursive: true })
    const ecrit = ecrireSuivi({ cible, contenu: texteDuSuivi(applique.suivi), attendu: texte, geste: 'le lot', fs, pid })
    if (ecrit.ok) break
    if (!ecrit.rejouable) return refus(ecrit.refus)
    if (essai >= ESSAIS_D_EDITION) return refus(`${ecrit.refus} (${ESSAIS_D_EDITION} essais)`)
    attendreSync(PAUSE_ENTRE_ESSAIS_MS)
  }
  if (session !== null) {
    const journal = join(dossier, JOURNAL)
    const lien = ligneDeLien({ journal: relire(journal, fs) ?? '', session, epique: numero, iso: maintenant.toISOString() })
    if (lien) fs.appendFileSync(journal, lien)
  }
  const stdout = json
    ? JSON.stringify(etatDeSession({ session, dossier, maintenant, fs }))
    : lignesDeSituation(lireLeSuivi({ dossier, epique: numero, fs }), { maintenant, age: true }).join('\n')
  return { code: 0, stdout: `${stdout}\n`, stderr: '' }
}

/** Les options hors gestes : `valeur` si elles prennent UN argument. */
const OPTIONS = {
  '--session': { cle: 'session', valeur: true }, '--depuis': { cle: 'depuis', valeur: true }, '--lot': { cle: 'lot', valeur: true },
  '--json': { cle: 'json' }, '--rendu': { cle: 'rendu' }, '--outil': { cle: 'outil' }, '--mesurer': { cle: 'mesurer' }, '--sans-fetch': { cle: 'sansFetch' },
}

/** Les options interdites dans chaque mode. */
const HORS_DE_PROPOS = {
  liste: ['session', 'depuis', 'json', 'sansFetch'], session: ['sansFetch'], outil: ['session', 'depuis', 'sansFetch'],
  situation: ['session', 'depuis', 'json', 'sansFetch'], rendu: ['session', 'depuis', 'json', 'sansFetch'],
  mesurer: ['session', 'depuis'], lot: ['depuis', 'sansFetch'],
}

/** L'usage, DÉRIVÉ de `FORMES_DU_CLI`. */
const USAGE = '`npm run ops:suivi -- <N> [--<geste> <args>…] [--lot <json>|-] [--session <id> --json]`, gestes : '
  + `${Object.entries(FORMES_DU_CLI).map(([nom, { args }]) => `--${nom} ${args.map((a) => `<${a}>`).join(' ')}`).join(' · ')} ; `
  + '`<N>` (la situation) · `<N> --rendu` · `<N> --mesurer [--sans-fetch] [--json]` · sans argument (la liste) · '
  + '`--session <id> --json [--depuis <cle>]` · `--outil --json`'

/**
 * Les arguments de ce script, ou `{ refus }` qui nomme le défaut. `<N>` vient en PREMIER ; chaque geste
 * (`FORMES_DU_CLI`) consomme EXACTEMENT son arité, et un mot qui n'est ni une option ni un geste est refusé
 * (« argument en trop »). Modes : `liste` (rien), `session` (`--session <id> --json [--depuis <cle>]`),
 * `outil` (`--outil --json`), `situation` (`<N>`), `rendu` (`<N> --rendu`), `mesurer` (`<N> --mesurer
 * [--sans-fetch] [--json]`), `lot` (`<N>` et des gestes ou `--lot`, `[--session <id>] [--json]`, `--json`
 * exigeant `--session`). PURE.
 * @param {string[]} argv
 */
export function argumentsDuSuivi(argv) {
  const lus = { numero: null, session: null, depuis: null, lot: null, json: false, rendu: false, outil: false, mesurer: false, sansFetch: false, gestes: [] }
  const refus = (motif) => ({ refus: motif })
  let i = 0
  if (/^\d+$/.test(argv[0] ?? '')) {
    if (Number(argv[0]) < 1) return refus(`épique « ${argv[0]} » : un numéro >= 1`)
    lus.numero = Number(argv[0])
    i = 1
  }
  while (i < argv.length) {
    const a = argv[i]
    const nom = a.startsWith('--') ? a.slice(2) : null
    if (nom !== null && Object.hasOwn(FORMES_DU_CLI, nom)) {
      const { args, vers } = FORMES_DU_CLI[nom]
      const valeurs = argv.slice(i + 1, i + 1 + args.length)
      if (valeurs.length < args.length || valeurs.some((v) => v.startsWith('--'))) {
        return refus(`${a} attend ${args.length} argument(s) : ${args.map((x) => `<${x}>`).join(' ')}`)
      }
      try {
        lus.gestes.push({ geste: nom, ...vers(valeurs) })
      } catch (e) {
        return refus(`${a} : ${e.message}`)
      }
      i += 1 + args.length
    } else if (Object.hasOwn(OPTIONS, a)) {
      const { cle, valeur } = OPTIONS[a]
      if (valeur) {
        const v = argv[i + 1]
        if (v === undefined || v === '' || v.startsWith('--')) return refus(`${a} attend une valeur`)
        if (lus[cle] !== null) return refus(`${a} donné deux fois`)
        lus[cle] = v
        i += 2
      } else {
        if (lus[cle]) return refus(`${a} donné deux fois`)
        lus[cle] = true
        i += 1
      }
    } else {
      return refus(`argument en trop « ${a} » : un texte se cite en UN argument, une option se nomme \`--<option>\``)
    }
  }
  const edition = lus.gestes.length > 0 || lus.lot !== null
  const modes = [edition && 'lot', lus.rendu && 'rendu', lus.mesurer && 'mesurer', lus.outil && 'outil'].filter(Boolean)
  if (modes.length > 1) return refus(`modes incompatibles : ${modes.join(', ')}`)
  const mode = modes[0] ?? (lus.numero !== null ? 'situation' : lus.session !== null ? 'session' : 'liste')
  const present = HORS_DE_PROPOS[mode].find((cle) => lus[cle] !== null && lus[cle] !== false)
  if (present) return refus(`${Object.keys(OPTIONS).find((o) => OPTIONS[o].cle === present)} hors de propos en mode ${mode}`)
  if ((mode === 'session' || mode === 'outil') && !lus.json) return refus(`le mode ${mode} exige --json`)
  if (mode === 'outil' && lus.numero !== null) return refus('--outil se passe de <N>')
  if (['lot', 'rendu', 'mesurer'].includes(mode) && lus.numero === null) return refus(`le mode ${mode} exige <N> en premier argument`)
  if (mode === 'lot' && lus.json && lus.session === null) return refus('--json exige --session <id> : l\'état de la session')
  return { ...lus, mode }
}

/** Les mutations d'un texte `--lot` (`Lot` : `{ epique, mutations }`), dont l'épique doit être `numero`. PURE. */
export function mutationsDuLot(texte, numero) {
  let brut
  try {
    brut = JSON.parse(texte)
  } catch (e) {
    return { refus: `--lot : JSON invalide (${e.message})` }
  }
  const vu = Lot.safeParse(brut)
  if (!vu.success) {
    const [p] = vu.error.issues
    return { refus: `--lot hors schéma : ${p.path.join('.')} : ${p.message}` }
  }
  if (vu.data.epique !== numero) return { refus: `--lot porte l'épique #${vu.data.epique}, la commande vise #${numero}` }
  return { mutations: vu.data.mutations }
}

/**
 * Le CLI entier, sans rien imprimer : `argv`, le dossier des suivis vu de `cwd`, et `stdin` (lu pour
 * `--lot -` seulement). Rend le code de sortie et les deux flux.
 * @param {{argv: string[], cwd: string, stdin: () => string, maintenant?: Date}} params
 * `--mesurer` charge `suiviMesure.mjs` (et `board.mjs`) à la demande.
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
async function executer({ argv, cwd, stdin, maintenant = new Date() }) {
  const refus = (motif) => ({ code: 1, stdout: '', stderr: `[suivi] ${motif}\n` })
  const sortie = (stdout) => ({ code: 0, stdout, stderr: '' })
  const lus = argumentsDuSuivi(argv)
  if (lus.refus) return refus(`arguments refusés : ${lus.refus} — usage : ${USAGE}`)
  if (lus.mode === 'outil') return sortie(`${JSON.stringify(OUTIL_SUIVI)}\n`)
  const vuDossier = dossierDesSuivis(cwd)
  if (!vuDossier.disponible) return refus(vuDossier.raison)
  const dossier = vuDossier.valeur
  const lu = () => lireLeSuivi({ dossier, epique: lus.numero })
  switch (lus.mode) {
    case 'session': return sortie(`${JSON.stringify(etatDeSession({ session: lus.session, dossier, maintenant, depuis: lus.depuis }))}\n`)
    case 'liste': return sortie(texteDeLaListe({ dossier, ...listerSuivis({ dossier }) }))
    case 'situation': return sortie(`${lignesDeSituation(lu(), { maintenant, age: true }).join('\n')}\n`)
    case 'rendu': return sortie(renduDuSuivi(lu(), { maintenant }))
    case 'mesurer': return (await import('./suiviMesure.mjs')).mesurerLeSuivi({ numero: lus.numero, dossier, sansFetch: lus.sansFetch, json: lus.json, maintenant })
    default: {
      const lot = lus.lot === null ? { mutations: [] } : mutationsDuLot(lus.lot === '-' ? stdin() : lus.lot, lus.numero)
      if (lot.refus) return refus(lot.refus)
      return editer({ numero: lus.numero, dossier, session: lus.session, json: lus.json, mutations: [...lus.gestes, ...lot.mutations], maintenant })
    }
  }
}

if (import.meta.main) {
  const { code, stdout, stderr } = await executer({ argv: process.argv.slice(2), cwd: process.cwd(), stdin: () => FS.readFileSync(0, 'utf8') })
  process.stdout.write(stdout)
  process.stderr.write(stderr)
  process.exitCode = code
}
