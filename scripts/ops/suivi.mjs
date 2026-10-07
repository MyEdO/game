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
// `mesurer` de scripts/ops/board.mjs) vit dans le fichier VOISIN `<N>.mesure.json`, jamais dans le suivi.
//
// L'ÉCRITURE. Suivi comme mesure : `ecrireSuivi`, sous le verrou exclusif `.<nom>.verrou` voisin
// (`prendreVerrou`, scripts/test/verrou.mjs), par un temporaire `.<nom>.<pid>.tmp`, texte relu juste avant
// le `rename` (refus s'il a changé). Un lot refusé pour un autre écrivain se rejoue sur le texte frais
// (`ESSAIS_D_EDITION`).
//
// LE PROFIL. Chaque geste injectable de la mesure (`GESTES_DU_BOARD`, `inv`, `issues`) est
// chronométré ; le `reste` est le total moins leur somme.
//
// LA RELECTURE SANS MÉMOIRE (#2132, #2279). `lignesDeSituation` : le bandeau d'un suivi lié (alerte en
// tête, item actif, prochain geste numéroté, ouverts, mesure). `digestDuSuivi` : titre, objectif, items et
// étapes ouvertes NUMÉROTÉES, file, arbitrages, signalements, mesure datée, coupé à `PLAFOND_INJECTION`.
// `etatDeSession` : pour les suivis liés à une session au JOURNAL `<dossier>/.journal`, le `contexte`, les
// lignes du bandeau, la situation datée à `ajouter` et sa `cle` — ce que rendent le hook de session
// (`scripts/hooks/inject-suivi.mjs`, surface Codex) et le mod `harnais` (`.claude/skills/harnais/hooks/suivi.ts`).
// Un lien de session vers un `<N>.md` sans `<N>.json` se dit « format .md abandonné », sans le lire.
//
// Usage : `USAGE`, dérivé de la table `GESTES`.
import * as FS from 'node:fs'
import { etapeProfilee } from '../etape-profilee.mjs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { arbrePrincipal, depotDe } from '../guards/lib/gitPorte.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { GESTES_DU_BOARD, issuesDeGh, mesurer } from './board.mjs'
import { inventaire } from './worktrees.mjs'
import { prendreVerrou } from '../test/verrou.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { Lot, Mutation, OUTIL_SUIVI, appliquer, lireSuivi, texteDuSuivi } from './suiviDonnee.mjs'

const SUIVI = /^\d+\.json$/
const ORPHELIN = /^\.\d+\.(?:mesure\.)?json\.\d+\.tmp$/
const TENU = new Set(['EPERM', 'EACCES', 'EBUSY'])

/** Âge (h) au-delà duquel une mesure est PÉRIMÉE. Valeur maison. */
export const HEURES_PEREMPTION = 24
/** Taille maximale (caractères) d'un digest injecté au contexte. Valeur maison. */
export const PLAFOND_INJECTION = 8000
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

/** Le fichier du suivi de l'épique `n`. PURE. */
const nomDuSuivi = (n) => `${n}.json`
/** Le fichier de la mesure du suivi de l'épique `n`. PURE. */
const nomDeLaMesure = (n) => `${n}.mesure.json`

// ————————————————————————————————— fonctions PURES —————————————————————————————————

/** `AAAA-MM-JJ HH:MM`, heure LOCALE. PURE. */
export const horodatage = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} `
  + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

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

/** Le document `<N>.mesure.json`, tel que `mesurerLeSuivi` l'écrit. */
const Mesure = z.looseObject({
  version: z.literal(1), epique: z.number().int().min(1), date: z.iso.datetime(), sansFetch: z.boolean(),
  portee: z.array(z.number().int()), ok: z.boolean(), refus: z.string().nullable(),
  lignes: z.array(z.looseObject({ ticket: z.number().int() })), anomalies: z.array(z.string()),
})

/** La mesure lue : `null` absente, `{ ok: false, refus }` illisible, `{ ok: true, mesure }`. PURE. */
function lireMesure(contenu) {
  if (contenu === null) return null
  let brut
  try {
    brut = JSON.parse(contenu)
  } catch (e) {
    return { ok: false, refus: `JSON invalide (${e.message})` }
  }
  const vu = Mesure.safeParse(brut)
  if (vu.success) return { ok: true, mesure: vu.data }
  const [p] = vu.error.issues
  return { ok: false, refus: `hors schéma : ${p.path.join('.')} : ${p.message}` }
}

/** L'âge (h) d'une mesure à `maintenant`. PURE. */
const heuresDe = (mesure, maintenant) => (maintenant.getTime() - new Date(mesure.date).getTime()) / 3_600_000

/** L'âge d'une mesure, en minutes sous une heure, en heures au-delà. PURE. */
const age = (heures) => (heures < 1 ? `${Math.floor(heures * 60)} min` : `${Math.floor(heures)} h`)

/** `#a, #b` entre parenthèses, `''` sans ticket. PURE. */
const tickets = (liste) => (liste?.length ? ` (${liste.map((n) => `#${n}`).join(', ')})` : '')

/**
 * Le plan d'un suivi en lignes Markdown : titre, objectif, items (sauf `clos` hors `complet`) et leurs
 * étapes NUMÉROTÉES `#ticket.n` (ouvertes seules hors `complet`), file, arbitrages, signalements, frictions
 * (non versées seules hors `complet`), dispositions. PURE.
 */
function lignesDuPlan(suivi, { complet }) {
  const items = suivi.items.filter((i) => complet || i.etat !== 'clos')
  const frictions = suivi.frictions.filter((f) => complet || f.verseeA === null)
  const section = (titre, lignes) => (lignes.length ? ['', `## ${titre}`, ...lignes] : [])
  const arbitrage = (a) => (a.verbatim !== undefined ? `« ${a.verbatim.replace(/\r?\n/g, ' ')} »${a.texte ? ` — ${a.texte}` : ''}` : a.texte)
  return [
    `# ${suivi.titre}`,
    ...(suivi.objectif ? ['', `Objectif : ${suivi.objectif}`] : []),
    ...section('Items', items.flatMap((i) => [
      `- #${i.ticket} [${i.etat}] ${i.libelle}${i.porteur ? ` — ${i.porteur}` : ''}`,
      ...i.etapes.filter((e) => complet || !e.faite).map((e) => `  - [${e.faite ? 'x' : ' '}] #${i.ticket}.${e.n} ${e.texte}`),
    ])),
    ...section('File', suivi.file.map((f, k) => `${k + 1}. #${f.ticket} ${f.libelle}${f.bloquePar?.length ? ` (bloqué par ${f.bloquePar.map((n) => `#${n}`).join(', ')})` : ''}`)),
    ...section('Arbitrages', suivi.arbitrages.map((a) => `- n° ${a.n}, ${a.date}, ${a.nature}${a.portee ? `, ${a.portee}` : ''}${tickets(a.tickets)} : ${arbitrage(a)}`)),
    ...section('À signaler', suivi.aSignaler.map((s) => `- n° ${s.n}, ${s.date}${tickets(s.tickets)} : ${s.texte}`)),
    ...section('Frictions', frictions.map((f) => `- n° ${f.n}, ${f.date} : ${f.texte}${f.verseeA ? ` → versée à #${f.verseeA}` : ''}`)),
    ...section('Dispositions', suivi.dispositions.map((d) => `- ${d.disposition} ${d.genre} « ${d.cle} », ${d.date} : ${d.motif}`)),
  ]
}

/** Les lignes de la mesure d'un suivi lu, datée, PÉRIMÉE au-delà de `HEURES_PEREMPTION`. PURE. */
function lignesDeLaMesure({ epique, mesure }, { maintenant }) {
  const rafraichir = `\`npm run ops:suivi -- ${epique} --mesurer\``
  if (mesure === null) return ['## Mesure', `jamais mesurée : ${rafraichir}`]
  if (!mesure.ok) return ['## Mesure', `⚠ mesure illisible (${mesure.refus}) : ${rafraichir}`]
  const m = mesure.mesure
  const heures = heuresDe(m, maintenant)
  const ligne = (l) => `- #${l.ticket} ${l.statut} · issue ${l.etatIssue} · ${(l.branches ?? []).join(' ') || 'sans branche'} · `
    + `avance ${l.avance || '—'} · dernier commit ${l.dernierCommit || '—'}${l.worktrees?.length ? ` · ${l.worktrees.join(' ')}` : ''}`
  return [
    '## Mesure',
    `mesurée le ${horodatage(new Date(m.date))}${m.sansFetch ? ' (sans fetch)' : ''}`,
    ...(heures > HEURES_PEREMPTION ? [`**PÉRIMÉE** : mesurée il y a ${Math.floor(heures)} h (au-delà de ${HEURES_PEREMPTION} h) — ${rafraichir}`] : []),
    ...(m.ok ? m.lignes.map(ligne) : [`**Mesure refusée** : ${m.refus}`]),
    ...m.anomalies.map((a) => `- ⚠ ${a}`),
  ]
}

/**
 * Le DIGEST d'un suivi lu (`lireLeSuivi`) : son en-tête, son alerte EN TÊTE, son plan sans ce qui est clos
 * ou fait, sa mesure. Coupé à `plafond`, terminé par le geste qui le rend entier. PURE.
 * @param {ReturnType<typeof lireLeSuivi>} lu
 * @param {{maintenant: Date, plafond?: number}} params
 * @returns {string}
 */
export function digestDuSuivi(lu, { maintenant, plafond = PLAFOND_INJECTION }) {
  const tete = `[suivi #${lu.epique}]`
  if (!lu.suivi) return plafonner([`${tete} ${lu.alerte}`], plafond, '…')
  const sortie = [
    `${tete} ${lu.chemin} — écrit le ${horodatage(new Date(lu.suivi.ecritLe))}`,
    ...(lu.alerte ? [`${tete} ${lu.alerte}`] : []),
    ...lignesDuPlan(lu.suivi, { complet: false }), '', ...lignesDeLaMesure(lu, { maintenant }),
  ]
  return plafonner(sortie, plafond, `… tronqué, \`npm run ops:suivi -- ${lu.epique} --rendu\` le rend entier`)
}

/** Le RENDU complet d'un suivi lu, pour l'humain (`--rendu`) : alerte en tête, plan entier, mesure. PURE. */
export function renduDuSuivi(lu, { maintenant }) {
  if (!lu.suivi) return `[suivi #${lu.epique}] ${lu.alerte}\n`
  return `${[...(lu.alerte ? [`> ${lu.alerte}`, ''] : []), ...lignesDuPlan(lu.suivi, { complet: true }), '', ...lignesDeLaMesure(lu, { maintenant })].join('\n')}\n`
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
 * Les lignes d'ÉTAT d'un suivi lu, chacune sous `LARGEUR_D_UNE_LIGNE` : son alerte EN TÊTE, le premier
 * item `actif`, sa première étape ouverte `#ticket.n`, le compte des items non clos et de leurs étapes
 * ouvertes et la mesure — son ÂGE à `maintenant` pour le bandeau (`age: true`), sa DATE pour l'ajout. PURE.
 * @param {ReturnType<typeof lireLeSuivi>} lu
 * @param {{maintenant: Date, age: boolean}} params
 * @returns {string[]}
 */
export function lignesDeSituation(lu, { maintenant, age: enAge }) {
  const tete = `[suivi #${lu.epique}]`
  const coupe = (lignes) => lignes.map((l) => coupeAuMot(l, LARGEUR_D_UNE_LIGNE))
  if (!lu.suivi) return coupe([`${tete} ${lu.alerte}`])
  const ouverts = lu.suivi.items.filter((i) => i.etat !== 'clos')
  const actif = ouverts.find((i) => i.etat === 'actif')
  const prochaine = actif?.etapes.find((e) => !e.faite)
  const etapes = ouverts.reduce((t, i) => t + i.etapes.filter((e) => !e.faite).length, 0)
  let mesure = 'jamais mesurée'
  if (lu.mesure && !lu.mesure.ok) mesure = 'mesure illisible'
  else if (lu.mesure) {
    const heures = heuresDe(lu.mesure.mesure, maintenant)
    mesure = `${heures > HEURES_PEREMPTION ? 'PÉRIMÉE, ' : ''}mesurée ${enAge ? `il y a ${age(heures)}` : `le ${horodatage(new Date(lu.mesure.mesure.date))}`}`
  }
  return coupe([
    ...(lu.alerte ? [`${tete} ${lu.alerte}`] : []),
    actif ? `${tete} en cours : #${actif.ticket} ${actif.libelle}` : `${tete} aucun item actif`,
    ...(prochaine ? [`  prochain geste : #${actif.ticket}.${prochaine.n} ${prochaine.texte}`] : []),
    `  ouverts : ${ouverts.length} item(s), ${etapes} étape(s) · ${mesure}`,
  ])
}

// ————————————————————————————————— mesure, écriture, CLI —————————————————————————————————

/**
 * `mesurer` sous PROFIL : chaque entrée de `GESTES_DU_BOARD`, `inv` et `issues` est enveloppée et
 * chronométrée ; `reste` = total − somme des gestes. Une exception de la mesure devient un refus.
 * @param {{gestes?: typeof GESTES_DU_BOARD, inv?: Function, issues?: Function,
 *   horloge?: () => number} & Record<string, unknown>} [params] le reste va à `mesurer`
 * @returns {{vu: ReturnType<typeof mesurer>, profil: {durees: Record<string, number>, total: number, reste: number}}}
 */
export function mesureProfilee({ gestes = GESTES_DU_BOARD, inv = inventaire, issues = issuesDeGh, horloge = () => performance.now(), annoncer = (texte) => process.stderr.write(texte), ...params } = {}) {
  const durees = tableTotale([...Object.keys(GESTES_DU_BOARD), 'inv', 'issues'], () => 0)
  const envelopper = (nom, geste) => (...args) => {
    return etapeProfilee(`[suivi] ${nom}`, () => geste(...args), { horloge, annoncer, mesurer: (ms) => { durees[nom] += ms } })
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
 * Écrit `contenu` sur `cible` par un temporaire `.<nom>.<pid>.tmp` voisin, APRÈS avoir relu `cible`
 * et vérifié qu'elle vaut encore `attendu` (`null` : qu'elle n'existe pas). Temporaire non écrit, cible
 * disparue ou apparue, texte changé, ou `rename` en EPERM/EACCES/EBUSY → refus nommé, temporaire supprimé,
 * cible intacte ; toute autre erreur est relancée, temporaire supprimé. Un temporaire que le nettoyage ne
 * peut pas supprimer est NOMMÉ dans le refus (`listerSuivis` le retrouve en orphelin), sans jamais masquer
 * l'erreur d'origine. La relecture, la comparaison et le `rename` se font sous le verrou EXCLUSIF
 * `.<nom>.verrou` voisin (`prendreVerrou`) ; un verrou tenu par un processus vivant est un refus.
 * `rejouable` dit qu'un refus tient à un autre écrivain (verrou pris, texte changé ou apparu) : le même
 * geste, rejoué sur le texte frais, peut passer. `geste` nomme ce pendant quoi le texte a changé.
 * @param {{cible: string, contenu: string, attendu: string|null, geste: string, fs?: typeof FS, pid?: number}} params
 * @returns {{ok: true} | {ok: false, refus: string, rejouable: boolean}}
 */
export function ecrireSuivi({ cible, contenu, attendu, geste, fs = FS, pid = process.pid }) {
  const dossier = join(cible, '..')
  const nom = cible.replace(/\\/g, '/').split('/').pop()
  const verrou = prendreVerrou({ chemin: join(dossier, `.${nom}.verrou`), libelle: `suivi ${nom} en cours d'écriture`, pid, commande: 'scripts/ops/suivi.mjs', cwd: dossier })
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
  if (attendu === null && actuel !== null) return refuser(`${cible} est apparu pendant ${geste} : rien n'est écrit, relancer`, true)
  if (attendu !== null && actuel === null) return refuser(`${cible} a disparu pendant ${geste} : rien n'est écrit`)
  if (attendu !== null && actuel !== attendu) return refuser(`${cible} a changé pendant ${geste} : rien n'est écrit, relancer`, true)
  try {
    fs.renameSync(temporaire, cible)
    return { ok: true }
  } catch (e) {
    if (!TENU.has(e?.code)) throw relancee(e)
    return refuser(`suivi tenu par un autre processus (${e.code} au rename de ${cible}), relancer`, true)
  }
}

/**
 * Les suivis d'un dossier (`^\d+\.json$`, avec leur date) et les temporaires ORPHELINS
 * (`^\.\d+\.(mesure\.)?json\.\d+\.tmp$`) d'une écriture interrompue — nommés, jamais supprimés ici.
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
    : `aucun suivi sous ${dossier} — \`npm run ops:suivi -- <N> --creer <titre>\` en pose un\n`
  if (!orphelins.length) return texte
  return `${texte}\ntemporaires ORPHELINS (écriture interrompue) sous ${dossier} — à relire, puis à retirer à la main :\n`
    + orphelins.map((n) => `  ${n}\n`).join('')
}

/**
 * Le suivi de l'épique `epique` LU dans `dossier`, avec sa mesure : `suivi` (`null` s'il est absent ou
 * illisible ; le suivi lu s'il est valide mais écrit hors de l'outil), `alerte` (`null` s'il est lu et
 * scellé par l'outil) et `mesure` (`lireMesure`). Un `<N>.md` sans `<N>.json` est nommé, jamais lu.
 * @param {{dossier: string, epique: number, fs?: typeof FS}} params
 * @returns {{epique: number, chemin: string, suivi: object|null, alerte: string|null, mesure: ReturnType<typeof lireMesure>}}
 */
export function lireLeSuivi({ dossier, epique, fs = FS }) {
  const chemin = join(dossier, nomDuSuivi(epique))
  const texte = relire(chemin, fs)
  const mesure = lireMesure(relire(join(dossier, nomDeLaMesure(epique)), fs))
  if (texte === null) {
    const md = join(dossier, `${epique}.md`)
    return { epique, chemin, suivi: null, mesure, alerte: fs.existsSync(md) ? `format .md abandonné : ${md}` : `lié à cette session, mais absent : ${chemin}` }
  }
  const vu = lireSuivi(texte)
  if (vu.ok) return { epique, chemin, suivi: vu.suivi, mesure, alerte: null }
  return { epique, chemin, suivi: vu.suivi ?? null, mesure, alerte: `⚠ ${vu.genre === 'empreinte' ? '' : 'illisible, '}${vu.refus} — ${chemin}` }
}

/** Les suivis liés à `session` au `JOURNAL` de `dossier`, dans l'ordre de leur premier lien (`lireLeSuivi`). */
export function suivisLies({ session, dossier, fs = FS }) {
  return epiquesLiees(lignesDuJournal(relire(join(dossier, JOURNAL), fs) ?? ''), session).map((epique) => lireLeSuivi({ dossier, epique, fs }))
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
 * Le CONTEXTE d'une session : les digests de ses suivis liés `lus` (une ligne par épique quand la part
 * d'un digest passe sous `PART_D_UN_DIGEST`), sinon l'index des suivis de `dossier` modifiés depuis
 * moins de `HEURES_INDEX` et le geste qui lie ; `''` sans rien à dire.
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
  if (!recents.length) return ''
  const lignes = recents.map(({ nom, date }) => {
    const epique = Number(nom.replace(/\.json$/, ''))
    return `- #${epique} — ${titreDe(lireLeSuivi({ dossier, epique, fs }))} — ${horodatage(date)}`
  })
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
 * Le LOT entier sur un suivi : relecture (`lireSuivi` : un suivi illisible ou écrit hors de l'outil est
 * refusé), `appliquer` (tout ou rien), écriture atomique sous verrou (`ecrireSuivi`), rejouée sur le texte
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
    if (texte !== null) {
      const vu = lireSuivi(texte)
      if (!vu.ok) return refus(`${cible} : ${vu.refus} — rien n'est écrit`)
      suivi = vu.suivi
    }
    const applique = appliquer(suivi, mutations, { maintenant, epique: numero })
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

/**
 * La MESURE d'un suivi : portée (les tickets de ses items et de sa file), mesure profilée, écriture
 * atomique de `<N>.mesure.json` sous son verrou ; le suivi n'est jamais écrit. Rend le code de sortie et
 * les deux flux ; la mesure annonce ses gestes sur stderr.
 * @param {{numero: number, dossier: string, sansFetch?: boolean, json?: boolean, fs?: typeof FS,
 *   pid?: number, maintenant?: Date, mesure?: Record<string, unknown>}} params `mesure` va à `mesureProfilee`
 * @returns {{code: number, stdout: string, stderr: string}}
 */
export function mesurerLeSuivi({ numero, dossier, sansFetch = false, json = false, fs = FS, pid = process.pid, maintenant = new Date(), mesure = {} }) {
  const lu = lireLeSuivi({ dossier, epique: numero, fs })
  if (!lu.suivi) return { code: 1, stdout: '', stderr: `[suivi] ${lu.alerte}\n` }
  const portee = [...lu.suivi.items, ...lu.suivi.file].map((e) => e.ticket)
  const cible = join(dossier, nomDeLaMesure(numero))
  const avant = relire(cible, fs)
  const { vu, profil } = mesureProfilee({ ...mesure, portee, sansFetch, commandeSansFetch: `npm run ops:suivi -- ${numero} --mesurer --sans-fetch` })
  const document = {
    version: 1, epique: numero, date: maintenant.toISOString(), sansFetch, portee, ok: vu.ok, refus: vu.ok ? null : String(vu.refus),
    lignes: vu.ok ? vu.lignes : [], anomalies: vu.ok ? vu.anomalies : [], profil,
  }
  const ecrit = ecrireSuivi({ cible, contenu: `${JSON.stringify(document, null, 2)}\n`, attendu: avant, geste: 'la mesure', fs, pid })
  if (!ecrit.ok) return { code: 1, stdout: '', stderr: `[suivi] ${ecrit.refus}\n${vu.ok ? '' : `[suivi] mesure refusée : ${vu.refus}\n`}` }
  const rendu = json
    ? JSON.stringify(document)
    : [...lignesDeLaMesure({ epique: numero, mesure: lireMesure(relire(cible, fs)) }, { maintenant }), ligneDeProfil(profil)].join('\n')
  return { code: vu.ok ? 0 : 1, stdout: `${rendu}\n`, stderr: '' }
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

/** Un entier `>= 1` lu dans `texte`, sinon une erreur qui nomme `quoi`. PURE. */
function entier(texte, quoi) {
  if (!/^\d+$/.test(texte) || Number(texte) < 1) throw new Error(`${quoi} attendu, reçu « ${texte} »`)
  return Number(texte)
}

/** `ticket.n` lu dans `texte` (`2400.4`). PURE. */
function etapeVisee(texte) {
  const m = /^(\d+)\.(\d+)$/.exec(texte)
  if (!m) throw new Error(`\`ticket.n\` attendu (ex. 2400.4), reçu « ${texte} »`)
  return { ticket: entier(m[1], 'ticket'), n: entier(m[2], 'n') }
}

/**
 * Les gestes du CLI, la table UNIQUE du parseur et de l'usage : pour chaque mutation (`Mutation`), son
 * option `--<geste>`, ses arguments (leur nombre est son ARITÉ, fixe) et leur conversion en mutation.
 * Un texte s'y passe en UN argument, cité.
 */
export const GESTES = {
  'creer': { args: ['titre'], vers: ([titre]) => ({ titre }) },
  'ajouter-item': { args: ['ticket', 'libellé'], vers: ([t, libelle]) => ({ ticket: entier(t, 'ticket'), libelle }) },
  'etat': { args: ['ticket', 'actif|attente|gare|clos'], vers: ([t, etat]) => ({ ticket: entier(t, 'ticket'), etat }) },
  'condenser': { args: ['ticket', 'résumé'], vers: ([t, resume]) => ({ ticket: entier(t, 'ticket'), resume }) },
  'retirer-item': { args: ['ticket'], vers: ([t]) => ({ ticket: entier(t, 'ticket') }) },
  'ajouter-etape': { args: ['ticket', 'texte'], vers: ([t, texte]) => ({ ticket: entier(t, 'ticket'), texte }) },
  'cocher': { args: ['ticket.n'], vers: ([e]) => etapeVisee(e) },
  'retirer-etape': { args: ['ticket.n'], vers: ([e]) => etapeVisee(e) },
  'enfiler': { args: ['ticket', 'libellé'], vers: ([t, libelle]) => ({ ticket: entier(t, 'ticket'), libelle }) },
  'placer': { args: ['ticket', 'après|tete'], vers: ([t, a]) => ({ ticket: entier(t, 'ticket'), apres: a === 'tete' ? null : entier(a, 'ticket après') }) },
  'defiler': { args: ['ticket'], vers: ([t]) => ({ ticket: entier(t, 'ticket') }) },
  'demarrer': { args: ['ticket'], vers: ([t]) => ({ ticket: entier(t, 'ticket') }) },
  'arbitrer': {
    args: ['utilisateur|ingenierie', 'AAAA-MM-JJ', 'verbatim|texte'],
    vers: ([nature, date, t]) => ({ nature, date, [nature === 'utilisateur' ? 'verbatim' : 'texte']: t }),
  },
  'retirer-arbitrage': { args: ['n'], vers: ([n]) => ({ n: entier(n, 'n') }) },
  'signaler': { args: ['texte'], vers: ([texte]) => ({ texte }) },
  'retirer-signalement': { args: ['n'], vers: ([n]) => ({ n: entier(n, 'n') }) },
  'friction': { args: ['texte'], vers: ([texte]) => ({ texte }) },
  'verser-friction': { args: ['n', 'ticket'], vers: ([n, t]) => ({ n: entier(n, 'n'), ticket: entier(t, 'ticket') }) },
  'ignorer-anomalie': { args: ['genre', 'clé', 'motif'], vers: ([genre, cle, motif]) => ({ genre, cle, motif }) },
  'lever-disposition': { args: ['genre', 'clé'], vers: ([genre, cle]) => ({ genre, cle }) },
}

/** Les gestes nommés par `Mutation`, que `GESTES` couvre tous. */
export const GESTES_DE_LA_DONNEE = Mutation.options.map((o) => o.shape.geste.value)

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

/** L'usage, DÉRIVÉ de `GESTES`. */
const USAGE = '`npm run ops:suivi -- <N> [--<geste> <args>…] [--lot <json>|-] [--session <id> --json]`, gestes : '
  + `${Object.entries(GESTES).map(([nom, { args }]) => `--${nom} ${args.map((a) => `<${a}>`).join(' ')}`).join(' · ')} ; `
  + '`<N>` (la situation) · `<N> --rendu` · `<N> --mesurer [--sans-fetch] [--json]` · sans argument (la liste) · '
  + '`--session <id> --json [--depuis <cle>]` · `--outil --json`'

/**
 * Les arguments de ce script, ou `{ refus }` qui nomme le défaut. `<N>` vient en PREMIER ; chaque geste
 * (`GESTES`) consomme EXACTEMENT son arité, et un mot qui n'est ni une option ni un geste est refusé
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
    if (nom !== null && Object.hasOwn(GESTES, nom)) {
      const { args, vers } = GESTES[nom]
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
 * @returns {{code: number, stdout: string, stderr: string}}
 */
function executer({ argv, cwd, stdin, maintenant = new Date() }) {
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
    case 'mesurer': return mesurerLeSuivi({ numero: lus.numero, dossier, sansFetch: lus.sansFetch, json: lus.json, maintenant })
    default: {
      const lot = lus.lot === null ? { mutations: [] } : mutationsDuLot(lus.lot === '-' ? stdin() : lus.lot, lus.numero)
      if (lot.refus) return refus(lot.refus)
      return editer({ numero: lus.numero, dossier, session: lus.session, json: lus.json, mutations: [...lus.gestes, ...lot.mutations], maintenant })
    }
  }
}

if (import.meta.main) {
  const { code, stdout, stderr } = executer({ argv: process.argv.slice(2), cwd: process.cwd(), stdin: () => FS.readFileSync(0, 'utf8') })
  process.stdout.write(stdout)
  process.stderr.write(stderr)
  process.exitCode = code
}
