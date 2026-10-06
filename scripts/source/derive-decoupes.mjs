// Dérivation AUTOMATIQUE des adresses : chaque `desc` de `src/data/<dataset>.json` est-elle
// retrouvable telle quelle dans le livre qu'elle cite, sous forme de suite contiguë de blocs ? Le
// parsing et la résolution viennent ENTIÈREMENT de `src/data/source/decoupe.ts` (source unique), la
// lecture du disque de `lecteur-fs.mjs` ; ce fichier n'est qu'un chercheur de correspondances + un
// rapport.
//
// Verdicts : EXACT (un run contigu de blocs d'une même section) · EXACT-MULTI-SECTIONS (un run
// contigu à cheval sur plusieurs sections d'un même chapitre, adressé par UN intervalle : `finSec`
// posé, titres intermédiaires compris) · MONTAGE (2+ runs disjoints, découpe
// gloutonne par paragraphes de la desc) · CELLULE (la desc EST une case de table, adressée par clé
// de ligne × en-tête de colonne) · CELLULE-AMBIGUE (plusieurs cases du livre portent ce texte : pas
// d'adresse, une adresse arbitraire mentirait) · ECHEC (rien de contigu — paraphrase probable ou
// défaut d'extraction) · SANS-SOURCE (pas de `source.book`, ou livre sans `dir` dans `books.json`).
//
// Les chercheurs (`findRuns`, `findCells`, `cellRefFor`) PROPOSENT des candidats sur la chaîne de la
// desc préparée (`unitesDuTexte`). Anti-faux-EXACT : toute adresse émise porte l'empreinte de chacun
// de ses fragments et est RE-RÉSOLUE par `resoudreAdresse` (empreintes, plafond de montage et unicité
// des fragments comprises) ; la SEULE décision est `verifier`, l'égalité d'`aligner` entre les unités
// de la desc et celles de l'adresse (`unitesDeLAdresse`). Une divergence est rapportée en `verification`
// (bug de la chaîne, jamais un verdict silencieux). « sous-bloc » est la partie stricte d'`aligner`
// sur les unités d'un bloc.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MIN_FRAGMENT, aligner, cellRefFor, estDeContenu, estErreur, findCells, findRuns, joinNorm, unitesDeLAdresse,
  unitesDuBloc, unitesDuTexte,
} from '../../src/data/source/decoupe.ts'
import { chapitresDe, lireChapitre } from './lecteur-fs.mjs'
import { lieuxDe } from './lieux.mjs'
import { sigleDe } from '../raw/_lib.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Chapitres PARSÉS d'un livre, dans l'ordre. @returns {{ ch: string, chapitre: object }[]} */
function chapitresDuLivre(bookId) {
  const out = []
  for (const ch of chapitresDe(bookId)) {
    const chapitre = lireChapitre(bookId, ch)
    if (chapitre) out.push({ ch, chapitre })
  }
  return out
}

/** La chaîne que portent des unités préparées : la cible des chercheurs. */
const chaineDe = (unites) => joinNorm(unites.map((u) => u.norm))

/**
 * Découpe gloutonne de la desc par GROUPES d'unités DANS UN chapitre : fragments proposés par
 * `findRuns` pour l'adresse, ou `null` si un groupe résiste. Aucune décision par groupe : `verifier`.
 */
function montage(chapitre, unites) {
  const parts = []
  let pos = 0
  while (pos < unites.length) {
    let hit = null
    for (let k = unites.length; k > pos; k--) {
      const frag = findRuns(chapitre, chaineDe(unites.slice(pos, k)))
      if (frag) { hit = { frag, next: k }; break }
    }
    if (!hit) return null
    parts.push(hit.frag)
    pos = hit.next
  }
  return parts
}

/**
 * LA décision de `judge` : re-résout l'adresse en ses unités (`unitesDeLAdresse`), puis juge
 * l'ÉGALITÉ (`aligner`, `ajoute` vide) entre les unités de la desc et celles de l'adresse.
 * `undefined` si elle tient, la divergence sinon.
 * @param {import('../../src/data/source/decoupe.ts').ChapitreParse} chapitre
 * @param {import('../../src/data/source/decoupe.ts').DescRef} ref
 * @param {import('../../src/data/source/decoupe.ts').Unite[]} unites
 * @returns {string|undefined}
 */
export function verifier(chapitre, ref, unites) {
  const adresse = unitesDeLAdresse(chapitre, ref)
  if (estErreur(adresse)) return `${adresse.error} : ${adresse.detail}`
  return aligner(unites, adresse.unites)?.ajoute.length === 0 ? undefined : 'texte re-résolu != desc'
}

/** Raison d'un ECHEC sans ORPHELINE (la première unité de contenu de la desc qui ne s'aligne dans aucun
 *  bloc du livre) ni LIEU (`lieuxDe`) : chaque unité s'aligne dans un bloc, la desc entière dans aucun —
 *  ou elle est sous `MIN_FRAGMENT`, plancher de « sous-bloc ». */
export const PRESENTE_AU_LIVRE = 'présente au livre, alignement refusé'

/** Raison d'un ECHEC dont la desc a un LIEU au livre (`lieuxDe`) de `n` blocs, que les chercheurs ne
 *  proposent pas (ils ne proposent que des égalités de chaîne brute, #2253). */
export const contenueNonProposee = (n) =>
  `contenue dans ${n === 1 ? 'un bloc' : `une suite de ${n} blocs`}, non proposée`

/** Le bloc `b` de la section `s` contient-il la desc comme PARTIE STRICTE (`aligner`) ? */
const partieStricteDuBloc = (s, b, unites) => (aligner(unites, unitesDuBloc(s, b))?.ajoute.length ?? 0) > 0

/**
 * Juge une entrée : SEULE définition du verdict d'adressabilité du dépôt — le rapport de dérivation
 * ci-dessous en juge par elle, jamais par un second chemin. Aucune migration datée ne l'importe
 * (`scripts/guards/lib/migrationsVerdictVivant.mjs`).
 * @returns {{ verdict: string, ref?: object, reason?: string, verification?: string }}
 */
export function judge(entry) {
  const book = entry?.source?.book
  if (!book || !sigleDe(book)) {
    return { verdict: 'SANS-SOURCE', reason: book ? `livre sans dir: ${book}` : 'source.book absent' }
  }
  const unites = unitesDuTexte(typeof entry.desc === 'string' ? entry.desc : '')
  if (!unites.some(estDeContenu)) return { verdict: 'ECHEC', reason: 'desc-vide' }
  const chapitres = chapitresDuLivre(book)
  const texte = chaineDe(unites)

  for (const { ch, chapitre } of chapitres) {
    const frag = findRuns(chapitre, texte)
    if (!frag) continue
    const ref = { book, ch, parts: [frag] }
    const verification = verifier(chapitre, ref, unites)
    return {
      verdict: frag.finSec == null ? 'EXACT' : 'EXACT-MULTI-SECTIONS',
      ref,
      ...(verification ? { verification } : {}),
    }
  }

  if (unites.length > 1) {
    for (const { ch, chapitre } of chapitres) {
      const parts = montage(chapitre, unites)
      if (!parts) continue
      const ref = { book, ch, parts }
      const verification = verifier(chapitre, ref, unites)
      return { verdict: 'MONTAGE', ref, ...(verification ? { verification } : {}) }
    }
  }

  const cellules = []
  for (const { ch, chapitre } of chapitres) {
    for (const hit of findCells(chapitre, texte)) cellules.push({ ch, chapitre, hit })
  }
  if (cellules.length > 1) {
    return { verdict: 'CELLULE-AMBIGUE', reason: `${cellules.length} cases portent ce texte` }
  }
  if (cellules.length === 1) {
    const { ch, chapitre, hit } = cellules[0]
    const frag = cellRefFor(chapitre, hit)
    if (frag) {
      const ref = { book, ch, parts: [frag] }
      const verification = verifier(chapitre, ref, unites)
      return { verdict: 'CELLULE', ref, ...(verification ? { verification } : {}) }
    }
    return { verdict: 'ECHEC', reason: 'cellule sans clé de ligne adressable' }
  }

  const sub = texte.length >= MIN_FRAGMENT && chapitres.some(({ chapitre }) =>
    chapitre.sections.some((s) => s.blocks.some((_, b) => partieStricteDuBloc(s, b, unites))))
  if (sub) return { verdict: 'ECHEC', reason: 'sous-bloc (desc = fragment d\'un bloc)' }
  const orpheline = unites.filter(estDeContenu).find((u) => !chapitres.some(({ chapitre }) =>
    chapitre.sections.some((s) => s.blocks.some((_, b) => aligner([u], unitesDuBloc(s, b)) !== null))))
  if (orpheline) return { verdict: 'ECHEC', reason: `introuvable: « ${coupeAuMot(orpheline.norm, 70)} »` }
  const [lieu] = texte.length >= MIN_FRAGMENT ? lieuxDe(book, entry.desc) : []
  return { verdict: 'ECHEC', reason: lieu ? contenueNonProposee(lieu.blocs) : PRESENTE_AU_LIVRE }
}

/** Rapport de dérivation d'un dataset, sur la sortie standard (JSON) et son résumé sur l'erreur. */
function main() {
  const dataset = process.argv[2]
  if (!dataset) {
    console.error('usage: node scripts/source/derive-decoupes.mjs <dataset>   (nom sans .json)')
    process.exit(2)
  }
  const data = JSON.parse(readFileSync(join(ROOT, 'src', 'data', `${dataset}.json`), 'utf8'))
  if (!Array.isArray(data)) { console.error(`${dataset}.json n'est pas un tableau d'entrées`); process.exit(2) }

  const entries = data.map((e) => ({ id: e.id ?? e.label ?? '(sans id)', ...judge(e) }))
  const count = (v) => entries.filter((e) => e.verdict === v).length
  const report = {
    dataset,
    total: entries.length,
    exact: count('EXACT'),
    exactMultiSections: count('EXACT-MULTI-SECTIONS'),
    montage: count('MONTAGE'),
    cellule: count('CELLULE'),
    celluleAmbigue: count('CELLULE-AMBIGUE'),
    echec: count('ECHEC'),
    sansSource: count('SANS-SOURCE'),
    descVide: entries.filter((e) => e.reason === 'desc-vide').length,
    verifications: entries.filter((e) => e.verification).map((e) => ({ id: e.id, verification: e.verification })),
    entries,
  }
  console.log(JSON.stringify(report, null, 1))
  console.error(
    `${dataset}: total=${report.total} EXACT=${report.exact} EXACT-MULTI-SECTIONS=${report.exactMultiSections}` +
    ` MONTAGE=${report.montage} CELLULE=${report.cellule} CELLULE-AMBIGUE=${report.celluleAmbigue}` +
    ` ECHEC=${report.echec} (dont desc vide ${report.descVide})` +
    ` SANS-SOURCE=${report.sansSource} | verifications KO=${report.verifications.length}`,
  )
}

// Le module est IMPORTABLE (les tests montent `judge`) : le rapport ne part que si ce fichier est le
// point d'entrée du process — patron de `scripts/migrations/replay.mjs`.
if (import.meta.main) main()
