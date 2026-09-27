#!/usr/bin/env node
// scripts/git-hooks/merge-docs.mjs — pilote de fusion (`merge driver`) des docs DÉRIVÉS.
// Invoqué par git via .gitattributes :
//   node scripts/git-hooks/merge-docs.mjs <famille> %O %A %B %P
// %O = ancêtre commun, %A = version COURANTE (« ours », c'est le fichier que le pilote doit écrire),
// %B = version entrante, %P = chemin réel dans l'arbre.
//
// Trois familles, trois contrats :
//   - `generes`   : fichier 100 % dérivé. La fusion textuelle n'a aucun sens (seule la
//                   régénération fait foi) : on garde %A tel quel, exit 0. `npm run docs:build`
//                   (hooks post-merge / post-rewrite) reconstruit la valeur juste.
//   - `catalogue` : docs/raw/catalogue-*.md — dérivé SAUF ses blocs `<!-- X-INTEGRATION -->`
//                   (correctifs manuels, cf. scripts/raw/build-catalogs.mjs). Garde %A comme
//                   `generes`, mais REFUSE la fusion si un bloc entrant serait perdu.
//   - `fiche-raw` : fiche docs/raw/*.md MIXTE (prose manuscrite + champs `**Implémente :**`
//                   dérivés). Les champs dérivés sont neutralisés (sentinelle) dans les TROIS
//                   versions, la fusion 3-voies ne porte donc que sur la PROSE ; chaque champ est
//                   réinjecté PAR IDENTITÉ (topic `parseFiche` = heading porteur), courant d'abord,
//                   puis entrant, puis ancêtre — une section AJOUTÉE par l'entrant garde donc SON
//                   champ. Conflit résiduel = divergence de prose, donc humain : marqueurs écrits
//                   dans %A et exit 1.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { threeWay } from './three-way.mjs'
// Frontière du champ dérivé : SOURCE UNIQUE partagée avec le générateur (scripts/raw/build-implemente.mjs).
import { NOT_IMPL, parseFiche } from '../raw/build-implemente.mjs'
// Blocs préservés des catalogues : SOURCE UNIQUE partagée avec le générateur.
import { BLOCK_START, extractPreservedBlocks } from '../raw/build-catalogs.mjs'

export const FAMILIES = ['generes', 'catalogue', 'fiche-raw']

/** Stem neutre passé à `parseFiche` : seule la part APRÈS `#` du topic sert de clé, et elle doit
 *  être identique dans les trois versions — le nom réel du fichier n'entre donc pas dans l'identité. */
const STEM = 'fiche.md'

/** Ligne de remplacement d'un bloc `**Implémente :**` pendant la fusion, PORTEUSE de l'identité du
 *  champ (topic `parseFiche` : heading porteur + rang de doublon). Deux versions qui décrivent la
 *  même section produisent la même sentinelle et s'alignent ; une section neuve produit la sienne,
 *  qui s'insère avec elle. */
export const sentinelFor = (topic) => `<!-- merge-docs:implemente ${topic.split('#')[1]} -->`
const SENTINEL_RE = /^<!-- merge-docs:implemente (.+) -->$/

/** Remplace chaque bloc `**Implémente :**` par sa sentinelle. Retourne le texte neutralisé et les
 *  blocs retirés, indexés par identité. Sans champ : texte inchangé, `blocks` vide. */
export function stripImplemente(text) {
  const lines = text.split('\n')
  const byStart = new Map(parseFiche(STEM, text).fields.map((f) => [f.headerIdx, f]))
  const out = []
  const blocks = new Map()
  for (let i = 0; i < lines.length; i++) {
    const f = byStart.get(i)
    if (f) {
      blocks.set(f.topic.split('#')[1], lines.slice(f.headerIdx, f.endIdx))
      out.push(sentinelFor(f.topic))
      i = f.endIdx - 1
      continue
    }
    out.push(lines[i])
  }
  return { text: out.join('\n'), blocks }
}

/** Réinjecte les blocs à la place des sentinelles, PAR IDENTITÉ. `blockMaps` est consulté dans
 *  l'ordre donné (courant, puis entrant, puis ancêtre). Identité inconnue des trois = forme non
 *  implémentée : la valeur juste revient à la régénération, jamais à la fusion. */
export function restoreImplemente(text, ...blockMaps) {
  const out = []
  for (const ln of text.split('\n')) {
    const m = SENTINEL_RE.exec(ln)
    if (!m) { out.push(ln); continue }
    out.push(...(blockMaps.map((b) => b.get(m[1])).find(Boolean) ?? [`**Implémente :** ${NOT_IMPL}`]))
  }
  return out.join('\n')
}

/** Blocs `<!-- X-INTEGRATION -->` d'un catalogue, indexés par marqueur. */
export function preservedBlocksByTag(path) {
  const byTag = new Map()
  for (const block of extractPreservedBlocks(path)) {
    const header = block.split('\n').find((l) => BLOCK_START.test(l))
    if (header) byTag.set(header.match(BLOCK_START)[1], block)
  }
  return byTag
}

/** Marqueurs dont le correctif MANUEL entrant serait perdu en gardant %A : absent du courant, ou
 *  modifié côté entrant seul. Liste vide = la régénération suffit, %A peut être gardé. */
export function catalogueConflicts({ base, ours, theirs }) {
  const O = preservedBlocksByTag(base)
  const A = preservedBlocksByTag(ours)
  const B = preservedBlocksByTag(theirs)
  const lost = []
  for (const [tag, block] of B) {
    if (!A.has(tag)) { lost.push(tag); continue }
    if (block !== A.get(tag) && block !== O.get(tag)) lost.push(tag)
  }
  return lost
}

/** Fusion d'une fiche docs/raw : prose fusionnée 3-voies, champs dérivés repris de `ours`. */
export function mergeFicheRaw(ours, base, theirs, labels) {
  const a = stripImplemente(ours)
  const o = stripImplemente(base)
  const b = stripImplemente(theirs)
  const merged = threeWay(a.text, o.text, b.text, labels)
  return { text: restoreImplemente(merged.text, a.blocks, b.blocks, o.blocks), conflict: merged.conflict }
}

function main(argv) {
  const [family, O, A, B, P] = argv
  if (!FAMILIES.includes(family) || !O || !A || !B) {
    process.stderr.write(`merge-docs: usage — merge-docs.mjs <${FAMILIES.join('|')}> %O %A %B %P\n`)
    return 2
  }
  if (family === 'generes') return 0
  if (family === 'catalogue') {
    const lost = catalogueConflicts({ base: O, ours: A, theirs: B })
    if (!lost.length) return 0
    process.stderr.write(`merge-docs: ${P ?? A} — correctif(s) MANUEL(s) entrant(s) que la régénération ne reproduira pas : ${lost.join(', ')} — bloc(s) récupérable(s) : \`git show :3:${P ?? A}\`.\n`)
    return 1
  }
  const res = mergeFicheRaw(
    readFileSync(A, 'utf8'), readFileSync(O, 'utf8'), readFileSync(B, 'utf8'),
    { ours: `${P ?? A} (courant)`, base: `${P ?? O} (ancêtre)`, theirs: `${P ?? B} (entrant)` },
  )
  writeFileSync(A, res.text)
  if (res.conflict) {
    process.stderr.write(`merge-docs: ${P ?? A} — conflit de PROSE (le champ Implémente a été fusionné automatiquement).\n`)
    return 1
  }
  return 0
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) process.exit(main(process.argv.slice(2)))
