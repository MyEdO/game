// VÉRIFICATEUR du verdict d'un agent de tri (#1887, lot 8) : le paquet `tri` (`paquet.mjs`) est
// REJOUÉ depuis les termes, jamais lu depuis le verdict ; chaque ligne est vérifiée contre lui.
//  - Verdict : tableau de lignes `{ ref, role, preuve }`, `role` dans `ROLES`, ou `{ ref, role:
//    'hors-système' }` (`raison` facultative, ignorée), exclusive dans sa section.
//  - ADRESSE DÉRIVÉE de la preuve, jamais lue : l'UNIQUE bloc de la section où la preuve s'aligne
//    (`aligner`) entre deux BORNES DE MOT, adressé par `fragmentBlocs` et re-résolu par `resoudreAdresse`.
//    La borne se juge sur la première occurrence, celle que rend le témoin d'`aligner`.
//  - Une preuve NOMME un terme de sa section (`nommeUnDeSesTermes`) dès que le texte de la section en
//    nomme un.
//  - Refus NOMMÉS (`REFUS`), chacun avec sa ligne fautive.
//  - SCORE contre `releve-rappel.json` quand le système y figure (mêmes termes) : matrice (attendue,
//    écartée, non étiquetée) × (retenue, rejetée), accord de rôle, cas nommés ; diagnostic, jamais
//    une assertion.
// GARDE DE FUITE : `fuitesDeLaConsigne` rend les 6-grammes (`normText`) du rappel, ou le texte entier
// s'il a moins de six mots, présents dans la consigne de tri (`tri-consigne.md`).
//
// Lancer : node scripts/raw/tri.mjs <id du livre> <verdict.json> <terme>…   (JSON sur la sortie standard)
//          node scripts/raw/tri.mjs --fuite                                  (code 1 sur toute fuite)
import { readFileSync } from 'node:fs'
import { livreDuReleve } from './releve.mjs'
import { CONSIGNE_DE_TRI, nommeUnDeSesTermes, sectionsDuPaquet, texteDe } from './paquet.mjs'
import { aligner, estErreur, fragmentBlocs, normText, resoudreAdresse, unitesDuBloc, unitesDuTexte } from '../../src/data/source/decoupe.ts'

/** Les rôles d'une ligne retenue, ceux de la consigne du rappel. */
export const ROLES = ['définit', 'modifie', 'déclenche', 'consomme']
/** Le rôle d'une section qui n'en joue aucun. */
export const HORS_SYSTEME = 'hors-système'
/** Les refus du vérificateur. */
export const REFUS = ['ref-hors-paquet', 'section-sans-verdict', 'hors-systeme-non-exclusif', 'role-inconnu', 'preuve-introuvable', 'preuve-ambigue', 'preuve-sans-terme']

/** Le rappel du dépôt. */
export const RAPPEL = new URL('./releve-rappel.json', import.meta.url)

/** La section d'une section du paquet, dans son chapitre parsé. */
function sectionDuPaquet(livre, it) {
  const chapitre = livre.indexe.chapitres.get(it.fichier)
  const [f] = it.adresse.parts
  return { chapitre, f, section: chapitre.sections.find((s) => s.slug === f.sec && s.occ === f.secOcc) }
}

/** Un caractère de MOT : lettre ou chiffre. */
const DE_MOT = /[\p{L}\p{N}]/u

/** Mots d'un texte au sens de `normText` : ses suites de caractères de mot, ponctuation écartée. */
const mots = (s) => normText(s).match(/[\p{L}\p{N}]+/gu) ?? []

/** L'alignement commence-t-il et finit-il à une borne de mot de l'adresse (`couvertes` d'`aligner`) ? */
function entreBornesDeMot(unites, { couvertes: { premiere, derniere } }) {
  const avant = unites[premiere.unite].norm[premiere.coupe - 1]
  const apres = unites[derniere.unite].norm[derniere.coupe]
  return !(avant && DE_MOT.test(avant)) && !(apres && DE_MOT.test(apres))
}

/** Les blocs de la section du paquet où la preuve s'aligne (`aligner` : égalité ou partie stricte)
 *  entre deux bornes de mot. */
export function blocsDeLaPreuve(livre, it, preuve) {
  const { f, section } = sectionDuPaquet(livre, it)
  const u = unitesDuTexte(preuve)
  if (!u.length) return []
  const blocs = []
  for (let b = f.b0; b <= f.b1; b++) {
    const unites = unitesDuBloc(section, b)
    const a = aligner(u, unites)
    if (a != null && entreBornesDeMot(unites, a)) blocs.push(b)
  }
  return blocs
}

/** L'adresse DÉRIVÉE d'une preuve : `{ adresse }` de son bloc unique, ou `{ refus, blocs }` ; une
 *  preuve qui ne nomme aucun terme d'une section dont le texte en nomme un est `preuve-sans-terme`. */
export function adresseDeLaPreuve(livre, it, preuve) {
  const blocs = typeof preuve === 'string' ? blocsDeLaPreuve(livre, it, preuve) : []
  if (blocs.length !== 1) return { refus: blocs.length ? 'preuve-ambigue' : 'preuve-introuvable', blocs }
  const nommeUn = nommeUnDeSesTermes(livre, it)
  if (nommeUn(texteDe(livre, it)) && !nommeUn(preuve)) return { refus: 'preuve-sans-terme', blocs }
  const { chapitre, f } = sectionDuPaquet(livre, it)
  const adresse = { book: it.adresse.book, ch: it.adresse.ch, parts: [fragmentBlocs(chapitre, { sec: f.sec, secOcc: f.secOcc, b0: blocs[0], b1: blocs[0] })] }
  const r = resoudreAdresse(chapitre, adresse)
  if (estErreur(r)) throw new Error(`tri : l'adresse dérivée de ${it.ref} bloc ${blocs[0]} ne résout pas — ${r.error} : ${r.detail}`)
  return { adresse }
}

/** Les sections du paquet par réf ; deux sections à la même réf sont une erreur (l'agent ne les distinguerait pas). */
function parRef(sections) {
  const m = new Map()
  for (const it of sections) {
    if (m.has(it.ref)) throw new Error(`tri : deux sections du paquet à la réf ${it.ref}`)
    m.set(it.ref, it)
  }
  return m
}

/**
 * Vérifie un verdict contre les sections du paquet : `lignes` adressées, `refus` nommés, et les rôles
 * de l'agent par réf (`roles`, lignes à réf et rôle connus).
 */
export function verifier(livre, sections, verdict) {
  if (!Array.isArray(verdict)) throw new Error('tri : le verdict n’est pas un tableau JSON')
  const refs = parRef(sections)
  const roles = new Map(sections.map((it) => [it.ref, []]))
  const lignes = []
  const refus = []
  verdict.forEach((l, ligne) => {
    const refuser = (code, detail = {}) => refus.push({ refus: code, ligne, verdict: l, ...detail })
    const it = typeof l?.ref === 'string' ? refs.get(l.ref) : undefined
    if (!it) return refuser('ref-hors-paquet')
    if (l.role !== HORS_SYSTEME && !ROLES.includes(l.role)) return refuser('role-inconnu')
    roles.get(it.ref).push({ role: l.role, ligne })
    if (l.role === HORS_SYSTEME) return lignes.push({ ref: l.ref, role: l.role })
    const a = adresseDeLaPreuve(livre, it, l.preuve)
    if (a.refus) return refuser(a.refus, { blocs: a.blocs })
    lignes.push({ ref: l.ref, role: l.role, preuve: l.preuve, adresse: a.adresse })
  })
  for (const [ref, rs] of roles) {
    if (!rs.length) refus.push({ refus: 'section-sans-verdict', ref })
    else if (rs.some((r) => r.role === HORS_SYSTEME) && rs.some((r) => r.role !== HORS_SYSTEME)) {
      refus.push({ refus: 'hors-systeme-non-exclusif', ref, lignes: rs.map((r) => r.ligne) })
    }
  }
  return { lignes, refus, roles: new Map([...roles].map(([ref, rs]) => [ref, rs.map((r) => r.role)])) }
}

/** Le système du rappel dont les termes sont ceux-ci (même ensemble), ou `null`. */
export function systemeDuRappel(rappel, termes) {
  const cle = (ts) => [...new Set(ts)].sort().join('\u0000')
  const trouve = Object.entries(rappel.systemes).find(([, s]) => cle(s.termes) === cle(termes))
  return trouve ? { id: trouve[0], ...trouve[1] } : null
}

/**
 * SCORE d'un verdict contre un système du rappel. Une section est RETENUE si au moins une de ses
 * lignes n'est pas `hors-système` ; l'accord de rôle se lit « rôle du rappel ∈ rôles de l'agent ».
 */
export function score(sections, roles, systeme) {
  const attendus = new Map(systeme.attendus.map((a) => [a.ref, a]))
  const ecartees = new Map(systeme.ecartees.map((e) => [e.ref, e]))
  const colonne = (ref) => (attendus.has(ref) ? 'attendue' : ecartees.has(ref) ? 'ecartee' : 'nonEtiquetee')
  const matrice = { attendue: { retenue: 0, rejetee: 0 }, ecartee: { retenue: 0, rejetee: 0 }, nonEtiquetee: { retenue: 0, rejetee: 0 } }
  const cas = { attendusRejetes: [], ecarteesRetenues: [], nonEtiqueteesRetenues: [], rolesEnDesaccord: [], attendusHorsPaquet: [] }
  const accord = { accord: 0, attenduesRetenues: 0 }
  for (const it of sections) {
    const rs = roles.get(it.ref) ?? []
    const retenue = rs.some((r) => r !== HORS_SYSTEME)
    const col = colonne(it.ref)
    matrice[col][retenue ? 'retenue' : 'rejetee']++
    const nom = `${it.ref} ${it.titre}`
    if (col === 'attendue' && !retenue) cas.attendusRejetes.push(nom)
    if (col === 'ecartee' && retenue) cas.ecarteesRetenues.push(nom)
    if (col === 'nonEtiquetee' && retenue) cas.nonEtiqueteesRetenues.push({ section: nom, roles: rs })
    if (col === 'attendue' && retenue) {
      accord.attenduesRetenues++
      const attendu = attendus.get(it.ref).role
      if (rs.includes(attendu)) accord.accord++
      else cas.rolesEnDesaccord.push({ section: nom, rappel: attendu, agent: rs })
    }
  }
  const dansLePaquet = new Set(sections.map((it) => it.ref))
  for (const a of systeme.attendus) if (!dansLePaquet.has(a.ref)) cas.attendusHorsPaquet.push(`${a.ref} ${a.titre}`)
  return { systeme: systeme.id, matrice, accordDeRole: accord, cas }
}

/** Les 6-grammes de mots d'un texte, ou son texte entier s'il a moins de six mots. */
function grammes(s) {
  const m = mots(s)
  const n = Math.min(6, m.length)
  const out = []
  for (let i = 0; n && i + n <= m.length; i++) out.push(m.slice(i, i + n).join(' '))
  return out
}

/**
 * GARDE DE FUITE : chaque 6-gramme (`normText`, ou le texte entier s'il a moins de six mots) d'un
 * `attendus[].preuve`, d'une `ecartees[].raison` ou d'un `ecartees[].titre` du rappel présent dans la
 * consigne, nommé par système, champ et réf.
 */
export function fuitesDeLaConsigne(consigne, rappel) {
  const texte = ` ${mots(consigne).join(' ')} `
  const fuites = []
  for (const [systeme, s] of Object.entries(rappel.systemes)) {
    const sources = [
      ...s.attendus.map((a) => ({ champ: 'attendus[].preuve', ref: a.ref, texte: a.preuve })),
      ...s.ecartees.flatMap((e) => [{ champ: 'ecartees[].raison', ref: e.ref, texte: e.raison }, { champ: 'ecartees[].titre', ref: e.ref, texte: e.titre }]),
    ]
    for (const src of sources) {
      for (const g of grammes(src.texte)) if (texte.includes(` ${g} `)) fuites.push({ systeme, champ: src.champ, ref: src.ref, gramme: g })
    }
  }
  return fuites
}

function main() {
  const args = process.argv.slice(2)
  const rappel = JSON.parse(readFileSync(RAPPEL, 'utf8'))
  if (args[0] === '--fuite' && args.length === 1) {
    const fuites = fuitesDeLaConsigne(readFileSync(CONSIGNE_DE_TRI, 'utf8'), rappel)
    console.log(JSON.stringify({ fuites }, null, 1))
    if (fuites.length) process.exitCode = 1
    return
  }
  const [bookId, fichier, ...termes] = args
  if (!bookId || !fichier || !termes.length) {
    console.error('Usage : node scripts/raw/tri.mjs <id du livre> <verdict.json> <terme>… | --fuite')
    process.exitCode = 2
    return
  }
  const livre = livreDuReleve(bookId)
  const sections = sectionsDuPaquet(livre, termes)
  const { lignes, refus, roles } = verifier(livre, sections, JSON.parse(readFileSync(fichier, 'utf8')))
  const systeme = systemeDuRappel(rappel, termes)
  console.log(JSON.stringify({ lignes, refus, score: systeme ? score(sections, roles, systeme) : null }, null, 1))
  if (refus.length) process.exitCode = 1
}

if (import.meta.main) main()
