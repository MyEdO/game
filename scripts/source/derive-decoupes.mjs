// Dérivation AUTOMATIQUE des adresses : chaque `desc` de `src/data/<dataset>.json` est-elle
// retrouvable telle quelle dans le livre qu'elle cite, sous forme de suite contiguë de blocs ? Le
// parsing et la résolution viennent ENTIÈREMENT de `src/data/source/decoupe.ts` (source unique), la
// lecture du disque de `lecteur-fs.mjs` ; ce fichier n'est qu'un chercheur de correspondances + un
// rapport.
//
// Verdicts : EXACT (un run contigu de blocs d'une même section) · EXACT-MULTI-SECTIONS (un run
// contigu à cheval sur plusieurs sections d'un même chapitre) · MONTAGE (2+ runs disjoints, découpe
// gloutonne par paragraphes de la desc) · CELLULE (la desc EST une case de table, adressée par clé
// de ligne × en-tête de colonne) · CELLULE-AMBIGUE (plusieurs cases du livre portent ce texte : pas
// d'adresse, une adresse arbitraire mentirait) · ECHEC (rien de contigu — paraphrase probable ou
// défaut d'extraction) · SANS-SOURCE (pas de `source.book`, ou livre sans `dir` dans `books.json`).
//
// Anti-faux-EXACT : toute adresse émise porte l'empreinte de chacun de ses fragments et est
// RE-RÉSOLUE par `resoudreAdresse` (empreintes, plafond de montage et unicité des fragments
// comprises), son texte normalisé re-comparé à la desc normalisée ; une divergence est rapportée en
// `verification` (bug de la chaîne, jamais un verdict silencieux).
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  cellRefFor, estErreur, findCells, findRuns, joinNorm, normText, resoudreAdresse,
} from '../../src/data/source/decoupe.ts'
import { chapitresDe, lireChapitre } from './lecteur-fs.mjs'
import { sigleDe } from '../raw/_lib.mjs'

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

/**
 * Découpe gloutonne de la desc par paragraphes DANS UN chapitre : fragments de l'adresse, ou `null`
 * si un morceau résiste.
 */
function montage(chapitre, paras) {
  const parts = []
  let pos = 0
  while (pos < paras.length) {
    let hit = null
    for (let k = paras.length; k > pos; k--) {
      const frags = findRuns(chapitre, joinNorm(paras.slice(pos, k)))
      if (frags) { hit = { frags, next: k }; break }
    }
    if (!hit) return null
    parts.push(...hit.frags)
    pos = hit.next
  }
  return parts
}

/** Re-résout une adresse et compare son texte à la desc normalisée. @returns {string|undefined} */
function verifier(chapitre, ref, D) {
  const res = resoudreAdresse(chapitre, ref)
  if (estErreur(res)) return `${res.error} : ${res.detail}`
  return normText(res.md) === D ? undefined : 'texte re-résolu != desc'
}

/**
 * Juge une entrée : SEULE définition du verdict d'adressabilité du dépôt — le rapport de dérivation
 * ci-dessous et la migration `scripts/migrations/2026-09-05-1389-psychology-desc-vers-descref.mjs`
 * en jugent par elle, jamais par un second chemin.
 * @returns {{ verdict: string, ref?: object, reason?: string, verification?: string }}
 */
export function judge(entry) {
  const book = entry?.source?.book
  if (!book || !sigleDe(book)) {
    return { verdict: 'SANS-SOURCE', reason: book ? `livre sans dir: ${book}` : 'source.book absent' }
  }
  const desc = typeof entry.desc === 'string' ? entry.desc : ''
  if (!desc.trim()) return { verdict: 'ECHEC', reason: 'desc-vide' }
  const chapitres = chapitresDuLivre(book)
  const D = normText(desc)
  const paras = desc.split(/\n\s*\n/).map(normText).filter(Boolean)

  for (const { ch, chapitre } of chapitres) {
    const parts = findRuns(chapitre, D)
    if (!parts) continue
    const ref = { book, ch, parts }
    const verification = verifier(chapitre, ref, D)
    return {
      verdict: parts.length > 1 ? 'EXACT-MULTI-SECTIONS' : 'EXACT',
      ref,
      ...(verification ? { verification } : {}),
    }
  }

  if (paras.length > 1) {
    for (const { ch, chapitre } of chapitres) {
      const parts = montage(chapitre, paras)
      if (!parts) continue
      const ref = { book, ch, parts }
      const verification = verifier(chapitre, ref, D)
      return { verdict: 'MONTAGE', ref, ...(verification ? { verification } : {}) }
    }
  }

  const cellules = []
  for (const { ch, chapitre } of chapitres) {
    for (const hit of findCells(chapitre, D)) cellules.push({ ch, chapitre, hit })
  }
  if (cellules.length > 1) {
    return { verdict: 'CELLULE-AMBIGUE', reason: `${cellules.length} cases portent ce texte` }
  }
  if (cellules.length === 1) {
    const { ch, chapitre, hit } = cellules[0]
    const frag = cellRefFor(chapitre, hit)
    if (frag) {
      const ref = { book, ch, parts: [frag] }
      const verification = verifier(chapitre, ref, D)
      return { verdict: 'CELLULE', ref, ...(verification ? { verification } : {}) }
    }
    return { verdict: 'ECHEC', reason: 'cellule sans clé de ligne adressable' }
  }

  const sub = D.length > 40 && chapitres.some(({ chapitre }) =>
    chapitre.sections.some((s) => s.blocks.some((b) => normText(b.md).includes(D))))
  const orphan = paras.find((p) => !chapitres.some(({ chapitre }) => findRuns(chapitre, p))) ?? D
  return {
    verdict: 'ECHEC',
    reason: sub ? 'sous-bloc (desc = fragment d\'un bloc)' : `introuvable: « ${orphan.slice(0, 70)} … »`,
  }
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

// Le module est IMPORTABLE (la migration du pilote monte `judge`) : le rapport ne part que si ce
// fichier est le point d'entrée du process — patron de `scripts/migrations/replay.mjs`.
if (import.meta.main) main()
