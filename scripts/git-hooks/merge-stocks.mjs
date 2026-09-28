#!/usr/bin/env node
// Pilote de fusion (`merge driver`) `stocks` des stocks de sites. Invoqué par git via .gitattributes :
//   node scripts/git-hooks/merge-stocks.mjs %O %A %B %P
// %O = ancêtre commun, %A = version COURANTE (le fichier que le pilote écrit), %B = version entrante,
// %P = chemin réel dans l'arbre, dont l'extension choisit le format (`formatDe`, `stockDeSites.mjs`).
//
// ADMISSION, par la forme : deux versions identiques à l'octet rendent la troisième, ou l'une d'elles,
// sans lire le format. Sinon chaque version est lue par le format de %P, jamais exécutée, et doit être
// un POINT FIXE de ce format (son écriture rend son texte) ; les trois portent les mêmes collections.
// REPLIS : une version JSON illisible, une version qui n'est pas un point fixe, des collections
// différentes, toute exception de lecture ou d'écriture → la fusion 3-voies ordinaire (`threeWay`),
// marqueurs dans %A et sortie 1 sur conflit.
// FUSION : hors collections, le côté qui a changé ; les deux côtés changés différemment → 3-voies. Par
// collection, au niveau du GROUPE de site (`groupeDeSite`, `stock.mjs`) : un groupe inchangé d'un côté
// prend l'autre côté ; un groupe changé des deux côtés dont aucune entrée ne porte de champ hors de la
// clé est recompté par ordinal d'occurrence ; sinon → 3-voies. L'écriture est celle du format.
import '../node-requis.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { threeWay } from './three-way.mjs'
// Clôture statique chargeable sous un Node refusé : scripts/node-requis.mjs (#1801).
const { formatDe } = await import('../guards/lib/stockDeSites.mjs')
const { CHAMPS_DE_CLE, CHAMP_D_OCCURRENCE, groupeDeSite } = await import('../guards/lib/stock.mjs')
const { tableTotale } = await import('../../src/lib/tableTotale.ts')

/** Repli : la version n'est pas admise par la forme. */
class NonAdmis extends Error {}

/** Texte canonique d'une valeur, clés d'objet rangées : l'égalité « tous champs » ignore leur ordre. */
const canonique = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? tableTotale(Object.keys(x).sort(), (k) => x[k]) : x))

/** Les entrées de `entrees` par groupe de site, chaque groupe en ordre d'occurrence. */
function parGroupe(entrees) {
  const groupes = new Map()
  for (const e of entrees) {
    const g = groupeDeSite(e)
    if (!groupes.has(g)) groupes.set(g, [])
    groupes.get(g).push(e)
  }
  for (const liste of groupes.values()) liste.sort((a, b) => a[CHAMP_D_OCCURRENCE] - b[CHAMP_D_OCCURRENCE])
  return groupes
}

const memesEntrees = (a, b) => a.length === b.length && a.every((e, i) => canonique(e) === canonique(b[i]))
const horsCle = (e) => Object.keys(e).some((c) => !CHAMPS_DE_CLE.includes(c) && e[c] !== undefined)

/** Le groupe fusionné de ses trois versions (en ordre d'occurrence), ou `NonAdmis`. */
function groupeFusionne(Og, Ag, Bg) {
  if (memesEntrees(Ag, Og)) return Bg
  if (memesEntrees(Bg, Og) || memesEntrees(Ag, Bg)) return Ag
  if ([...Og, ...Ag, ...Bg].some(horsCle)) throw new NonAdmis()
  const n = Og.length + Math.max(0, Ag.length - Og.length) + Math.max(0, Bg.length - Og.length)
    - Math.max(0, Og.length - Ag.length, Og.length - Bg.length)
  const modele = [...Ag, ...Bg, ...Og][0]
  return Array.from({ length: n }, (_, i) => ({ ...modele, [CHAMP_D_OCCURRENCE]: i + 1 }))
}

/** Une collection fusionnée de ses trois versions. */
function collectionFusionnee(O, A, B) {
  const [Og, Ag, Bg] = [O, A, B].map(parGroupe)
  const groupes = new Set([...Og.keys(), ...Ag.keys(), ...Bg.keys()])
  return [...groupes].flatMap((g) => groupeFusionne(Og.get(g) ?? [], Ag.get(g) ?? [], Bg.get(g) ?? []))
}

/** Le texte fusionné par le format de `chemin`, ou lève (`NonAdmis`, ou l'exception du format). */
function fusionParLeFormat({ base, ours, theirs, chemin }) {
  const format = formatDe(chemin)
  const [O, A, B] = [base, ours, theirs].map((texte) => {
    const image = format.lire(texte, chemin)
    if (image === null || format.ecrire(image) !== texte) throw new NonAdmis()
    return image
  })
  const noms = [...O.collections.keys()]
  if ([A, B].some((v) => canonique([...v.collections.keys()]) !== canonique(noms))) throw new NonAdmis()
  const [hO, hA, hB] = [O, A, B].map((v) => canonique(v.horsCollections))
  if (hA !== hO && hB !== hO && hA !== hB) throw new NonAdmis()
  const horsCollections = hA !== hO ? A.horsCollections : B.horsCollections
  const collections = new Map(noms.map((nom) => [nom, collectionFusionnee(O.collections.get(nom), A.collections.get(nom), B.collections.get(nom))]))
  return format.ecrire({ horsCollections, collections, chemin })
}

/** Fusion de trois versions d'un stock de sites. Retourne `{ text, conflict }`. */
export function fusionnerStocks({ base, ours, theirs, chemin, labels }) {
  if (ours === theirs || base === theirs) return { text: ours, conflict: false }
  if (base === ours) return { text: theirs, conflict: false }
  try {
    return { text: fusionParLeFormat({ base, ours, theirs, chemin }), conflict: false }
  } catch {
    return threeWay(ours, base, theirs, labels)
  }
}

async function main(argv) {
  const [O, A, B, P] = argv
  if (!O || !A || !B || !P) {
    process.stderr.write('merge-stocks: usage — merge-stocks.mjs %O %A %B %P\n')
    return 2
  }
  const res = fusionnerStocks({
    base: readFileSync(O, 'utf8'), ours: readFileSync(A, 'utf8'), theirs: readFileSync(B, 'utf8'), chemin: P,
    labels: { ours: `${P} (courant)`, base: `${P} (ancêtre)`, theirs: `${P} (entrant)` },
  })
  writeFileSync(A, res.text)
  if (res.conflict) {
    process.stderr.write(`merge-stocks: ${P} — conflit résiduel, fusion 3-voies ordinaire.\n`)
    return 1
  }
  return 0
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
