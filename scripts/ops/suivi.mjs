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
// de la section qui porte un `#N` sans être un item.
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
// Usage : `npm run ops:suivi -- <N> [--creer] [--sans-fetch]` · sans `<N>` : la liste des suivis.
import * as FS from 'node:fs'
import { join } from 'node:path'
import { arbrePrincipal, depotDe } from '../guards/lib/gitPorte.mjs'
import { numerosDeLaChaine } from '../guards/lib/fermetures.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
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

// ————————————————————————————————— fonctions PURES —————————————————————————————————

/** Les lignes d'un texte, fin de ligne COMPRISE (`\n` ou `\r\n`), la dernière sans fin si le texte n'en a pas. PURE. */
const lignesDe = (texte) => String(texte).match(/[^\n]*\n|[^\n]+$/g) ?? []
/** Une ligne sans sa fin. PURE. */
const sansFin = (ligne) => ligne.replace(/\r?\n$/, '')
/** Un extrait d'une ligne, pour une anomalie. PURE. */
const extrait = (ligne) => `« ${ligne.length > 80 ? `${ligne.slice(0, 79)}…` : ligne} »`

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
 * l'ordre — et les anomalies de sa grammaire (en-tête de ce fichier). `refus` est non nul quand le
 * texte est illisible (marqueurs, section absente). PURE.
 * @param {string} texte
 * @returns {{tickets: number[], anomalies: string[], refus: string|null}}
 */
export function ticketsPrevus(texte) {
  const zones = zonesDe(texte)
  if (!zones.ok) return { tickets: [], anomalies: [], refus: zones.refus }
  const { lignes, anomalies } = nettoyer(zones)
  const debut = lignes.findIndex((l) => SECTION.test(l))
  if (debut < 0) {
    return { tickets: [], anomalies, refus: 'section `## En cours` absente : un item `1. #N …` en colonne 0 par ticket prévu, sous ce titre' }
  }
  const suite = lignes.findIndex((l, i) => i > debut && /^## /.test(l))
  const tickets = []
  let rang = 0
  for (let i = debut + 1; i < (suite < 0 ? lignes.length : suite); i += 1) {
    const ligne = lignes[i]
    if (!ITEM.test(ligne)) {
      if (/^\S/.test(ligne) && /#\d+/.test(ligne)) {
        anomalies.push(`ligne hors grammaire qui porte un #N (l.${i + 1}) : ${extrait(ligne)} — un item s'écrit \`1. #N …\` en colonne 0`)
      }
      continue
    }
    rang += 1
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
  }
  return { tickets, anomalies, refus: null }
}

const deux = (n) => String(n).padStart(2, '0')
/** `AAAA-MM-JJ HH:MM`, heure LOCALE. PURE. */
export const horodatage = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ${deux(d.getHours())}:${deux(d.getMinutes())}`
/** Une cellule de table Markdown sur une ligne. PURE. */
const cellule = (v) => String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
/** Une puce sur une ligne. PURE. */
const puce = (v) => `- ${String(v).replace(/\r?\n/g, ' ')}`

/**
 * Les lignes de la zone MESURÉE, sans ses marqueurs. PURE.
 * @param {{mesure: {ok: boolean, lignes?: object[], anomalies?: string[], refus?: string},
 *   grammaire: string[], epique: number, maintenant: Date}} params
 * @returns {string[]}
 */
function lignesDeLaZone({ mesure, grammaire, epique, maintenant }) {
  const zone = [
    `> Zone MESURÉE par \`npm run ops:suivi -- ${epique}\` le ${horodatage(maintenant)} : réécrite à chaque appel, jamais éditée à la main.`,
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
  const { anomalies } = ticketsPrevus(texte)
  const zone = [MARQUE_DEBUT, ...lignesDeLaZone({ mesure, grammaire: anomalies, epique, maintenant })]
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

// ————————————————————————————————— mesure, écriture, CLI —————————————————————————————————

/**
 * `mesurer` sous PROFIL : chaque entrée de `GESTES_DU_BOARD`, `inv` et `issues` est enveloppée et
 * chronométrée ; `reste` = total − somme des gestes. Une exception de la mesure devient un refus.
 * @param {{gestes?: typeof GESTES_DU_BOARD, inv?: Function, issues?: Function,
 *   horloge?: () => number} & Record<string, unknown>} [params] le reste va à `mesurer`
 * @returns {{vu: ReturnType<typeof mesurer>, profil: {durees: Record<string, number>, total: number, reste: number}}}
 */
export function mesureProfilee({ gestes = GESTES_DU_BOARD, inv = inventaire, issues = issuesDeGh, horloge = () => performance.now(), ...params } = {}) {
  const durees = Object.fromEntries([...Object.keys(GESTES_DU_BOARD), 'inv', 'issues'].map((nom) => [nom, 0]))
  const envelopper = (nom, geste) => (...args) => {
    const depart = horloge()
    try {
      return geste(...args)
    } finally {
      durees[nom] += horloge() - depart
    }
  }
  const enveloppes = Object.fromEntries(Object.keys(GESTES_DU_BOARD).map((nom) => [nom, envelopper(nom, gestes[nom])]))
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
function relire(cible, fs) {
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

function main() {
  const argv = process.argv.slice(2)
  const numeros = argv.filter((a) => /^\d+$/.test(a)).map(Number)
  const valides = argv.every((a) => a === '--creer' || a === '--sans-fetch' || /^\d+$/.test(a))
  if (argv.length && (!valides || numeros.length !== 1 || numeros[0] < 1)) {
    process.stderr.write(`[suivi] arguments refusés : ${argv.join(' ')} — usage : \`npm run ops:suivi -- <N> `
      + '[--creer] [--sans-fetch]`, ou sans argument pour la liste des suivis\n')
    process.exit(1)
  }
  const vuRacine = arbrePrincipal(depotDe(process.cwd()))
  if (!vuRacine.disponible) {
    process.stderr.write(`[suivi] ${vuRacine.raison}\n`)
    process.exit(1)
  }
  const dossier = join(vuRacine.valeur, '.git', 'suivi')
  if (!numeros.length) {
    process.stdout.write(texteDeLaListe({ dossier, ...listerSuivis({ dossier }) }))
    return
  }
  const { code, stdout, stderr } = suivre({
    numero: numeros[0], dossier, creer: argv.includes('--creer'), sansFetch: argv.includes('--sans-fetch'),
  })
  process.stdout.write(stdout)
  process.stderr.write(stderr)
  process.exitCode = code
}

if (import.meta.main) main()
