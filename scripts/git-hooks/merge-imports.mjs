#!/usr/bin/env node
// Pilote de fusion (`merge driver`) `imports` des modules de code. Invoqué par git via .gitattributes :
//   node scripts/git-hooks/merge-imports.mjs %O %A %B %P
// %O = ancêtre commun, %A = version COURANTE (le fichier que le pilote écrit), %B = version entrante,
// %P = chemin réel dans l'arbre, dont l'extension choisit le dialecte (`dialecte.mjs`).
//
// D'ABORD la fusion 3-voies ordinaire (`threeWay`) : sans conflit, elle est rendue telle quelle.
// EN CONFLIT : une RÉGION est une suite de lignes de la fusion, blocs en conflit compris, faite seulement
// de déclarations `import` / `export` de premier niveau ENTIÈRES (lues par l'arbre syntaxique de chaque
// version, `declarationsDImport`) et de lignes vides. Chaque région qui porte un conflit est fusionnée par
// ENSEMBLE : chaque liaison (défaut, espace de noms, nom, effet), sous le nom qu'elle lie dans le module,
// prend la valeur du côté qui l'a changée depuis l'ancêtre (ajout, retrait, autre module, `type`), et reste
// en conflit si les deux côtés l'ont changée différemment.
// La disposition est celle de la version courante ; un ajout entrant rejoint la déclaration courante de
// même clé qui lui ressemble le plus (`homologue`), sinon s'insère en déclaration neuve. Une déclaration
// que les deux côtés écrivent différemment est réimprimée, à un nom par ligne dès deux noms
// (`unNomParLigne`).
// REPLIS, la région restant en conflit : une vue qui ne se parse pas ou porte autre chose qu'une
// déclaration (commentaire compris), le même nom lié deux fois par une vue, une liaison changée des deux
// côtés, deux imports d'effet différents ajoutés chacun d'un côté (leur rang compte), une déclaration que
// ne suit aucun saut de ligne, une déclaration à réimprimer que son texte ne permet pas (commentaire
// interne, forme que la grammaire refuse). REPLI du fichier entier sur la fusion ordinaire : le même nom
// lié deux fois, d'une région à une autre ou à une déclaration du code, toute exception. Les autres
// conflits du fichier restent des conflits : marqueurs dans %A et sortie 1.
import '../node-requis.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { threeWay, threeWayDiff3 } from './three-way.mjs'
import { lignesDe, segmentsDeFusion } from '../guards/lib/blocsDeFusion.mjs'

/** Ouvre, dans les trois versions marquées, chaque ligne d'une déclaration d'import ou d'export entière. */
const MARQUE = '\u0001'

/** Repli : la région n'est pas admise. */
class NonAdmis extends Error {}

const COTES = /** @type {const} */ (['ours', 'base', 'theirs'])

/** `texte` dont chaque ligne tenue en entier par des déclarations d'import ou d'export s'ouvre par `MARQUE`. */
function marquer(lire, texte) {
  if (texte.includes(MARQUE)) throw new NonAdmis()
  const lu = lire(texte)
  if (!lu) throw new NonAdmis()
  const lignes = lignesDe(texte)
  const debuts = []
  let position = 0
  for (const ligne of lignes) {
    debuts.push(position)
    position += ligne.length
  }
  const ligneDe = (pos) => debuts.findLastIndex((debut) => debut <= pos)
  const marquees = new Set()
  for (const { debut, fin } of lu.declarations) {
    const [premiere, derniere] = [ligneDe(debut), ligneDe(fin - 1)]
    if (texte.slice(debuts[premiere], debut).trim() || texte.slice(fin, debuts[derniere] + lignes[derniere].length).trim()) continue
    if (!lignes[derniere].endsWith('\n')) continue
    for (let l = premiere; l <= derniere; l += 1) marquees.add(l)
  }
  return lignes.map((ligne, l) => (marquees.has(l) ? MARQUE + ligne : ligne)).join('')
}

/** La vue `cote` d'une suite d'atomes (lignes fusionnées et blocs en conflit), sans marque. */
const vueDe = (atomes, cote) => atomes.map((a) => ('ligne' in a ? a.ligne : a[cote].join(''))).join('').replaceAll(MARQUE, '')

/**
 * Les liaisons des déclarations d'un texte lu réunies par clé (`parCle`), ses LIENS, chaque liaison sous son identité
 * (le nom qu'elle lie dans le module, ou sa clé et elle-même quand elle n'en lie aucun), et les clés de ses imports
 * d'effet. `NonAdmis` si deux liaisons ont la même identité, ou une liaison celle d'un nom que le code du module lie
 * ou exporte.
 */
function liensDe({ declarations, locaux, exportes }) {
  const duCode = new Set([...locaux.map((nom) => `import ${nom}`), ...exportes.map((nom) => `export ${nom}`)])
  /** @type {Map<string, Set<string>>} */
  const parCle = new Map()
  /** @type {Map<string, { cle: string, liaison: string }>} */
  const liens = new Map()
  for (const d of declarations) {
    if (!parCle.has(d.cle)) parCle.set(d.cle, new Set())
    for (const [liaison, nom] of d.liaisons) {
      const identite = nom === null ? `${d.cle} ${liaison}` : `${d.cle.split('|')[0]} ${nom}`
      if (liens.has(identite) || duCode.has(identite)) throw new NonAdmis()
      liens.set(identite, { cle: d.cle, liaison })
      parCle.get(d.cle).add(liaison)
    }
  }
  return { parCle, liens, effets: new Set(declarations.filter((d) => d.effet).map((d) => d.cle)) }
}

/** Les déclarations d'une vue de région et leurs liens (`liensDe`). `NonAdmis` si la vue porte autre chose qu'une
 *  déclaration. */
function lireRegion(lire, vue) {
  const lu = lire(vue)
  if (!lu?.seules) throw new NonAdmis()
  let reste = vue
  for (const d of lu.declarations.toReversed()) reste = reste.slice(0, d.debut) + reste.slice(d.fin)
  if (reste.trim()) throw new NonAdmis()
  return { declarations: lu.declarations, ...liensDe(lu) }
}

/** La déclaration de `region` de même clé que `d` qui partage le plus de liaisons avec elle ; sans partage, la seule
 *  de sa clé quand `d` est aussi la seule de la sienne. */
function homologue(d, region, deRegion) {
  const memeCle = region.declarations.filter((autre) => autre.cle === d.cle)
  const partage = (autre) => [...autre.liaisons.keys()].filter((l) => d.liaisons.has(l)).length
  const meilleure = memeCle.toSorted((x, y) => partage(y) - partage(x))[0]
  if (meilleure && partage(meilleure)) return meilleure
  return memeCle.length === 1 && deRegion.declarations.filter((autre) => autre.cle === d.cle).length === 1 ? meilleure : undefined
}

/** Le texte de la région fusionnée par ensemble, de ses vues ancêtre `O`, courante `A` et entrante `B`. */
function fusionDeRegion(lire, atomes) {
  const [A, O, B] = COTES.map((cote) => lireRegion(lire, vueDe(atomes, cote)))
  const liaisonsDe = (region, cle) => region.parCle.get(cle) ?? new Set()
  const effetNeuf = (region, autre) => [...region.effets].some((cle) => !O.effets.has(cle) && !autre.effets.has(cle))
  if (effetNeuf(A, B) && effetNeuf(B, A)) throw new NonAdmis()
  /** @type {Map<string, Set<string>>} */
  const fusionnees = new Map([...A.parCle.keys(), ...B.parCle.keys()].map((cle) => [cle, new Set()]))
  const meme = (x, y) => x?.cle === y?.cle && x?.liaison === y?.liaison
  for (const identite of new Set([...A.liens.keys(), ...B.liens.keys()])) {
    const [o, a, b] = [O, A, B].map((region) => region.liens.get(identite))
    if (!meme(a, b) && !meme(a, o) && !meme(b, o)) throw new NonAdmis()
    const lien = meme(a, o) ? b : a
    if (lien) fusionnees.get(lien.cle).add(lien.liaison)
  }
  const entrantes = new Map(B.declarations.map((b) => [b, homologue(b, A, B)]))
  /** Les liaisons fusionnées que porte la déclaration courante `a` : les siennes, puis celles qu'ajoute son homologue entrante. */
  const liaisonsDeA = (a) => [
    ...[...a.liaisons.keys()].filter((l) => fusionnees.get(a.cle).has(l)),
    ...B.declarations.filter((b) => entrantes.get(b) === a).flatMap((b) => [...b.liaisons.keys()])
      .filter((l) => fusionnees.get(a.cle).has(l) && !liaisonsDe(A, a.cle).has(l)),
  ]
  const liaisonsDeB = (b) => [...b.liaisons.keys()].filter((l) => fusionnees.get(b.cle).has(l) && !liaisonsDe(A, b.cle).has(l))
  const porte = (d, liaisons) => d && d.liaisons.size === liaisons.length && liaisons.every((l) => d.liaisons.has(l))
  const texteDeA = (a, liaisons) => {
    const [o, b] = [homologue(a, O, A), homologue(a, B, A)]
    if (porte(a, liaisons) && (!b || b.texte === a.texte || b.texte === o?.texte)) return a.texte
    if (porte(b, liaisons) && a.texte === o?.texte) return b.texte
    return a.imprimer(liaisons)
  }
  const vue = vueDe(atomes, 'ours')
  /** @type {{ declaration?: object, texte: string }[]} */
  const morceaux = []
  let position = 0
  for (const a of A.declarations) {
    morceaux.push({ texte: vue.slice(position, a.debut) })
    const finDeLigne = vue.indexOf('\n', a.fin) + 1 || vue.length
    const liaisons = liaisonsDeA(a)
    if (liaisons.length) morceaux.push({ declaration: a, texte: texteDeA(a, liaisons) + vue.slice(a.fin, finDeLigne) })
    position = finDeLigne
  }
  morceaux.push({ texte: vue.slice(position) })
  const ajoutCourant = (m) => (m.declaration ? !homologue(m.declaration, B, A) && !homologue(m.declaration, O, A) : m.texte === '')
  B.declarations.forEach((b, rang) => {
    const liaisons = entrantes.get(b) ? [] : liaisonsDeB(b)
    if (!liaisons.length) return
    const precedentes = B.declarations.slice(0, rang).map((p) => entrantes.get(p) ?? p)
    const ancre = morceaux.findLastIndex((m) => m.declaration && precedentes.includes(m.declaration))
    let place = ancre < 0 ? morceaux.findIndex((m) => m.declaration) : ancre + 1
    if (place < 0) place = morceaux.length
    while (ancre >= 0 && place < morceaux.length && ajoutCourant(morceaux[place])) place += 1
    if (morceaux.slice(0, place).findLast((m) => m.texte)?.texte.endsWith('\n') === false) throw new NonAdmis()
    morceaux.splice(place, 0, { declaration: b, texte: `${porte(b, liaisons) ? b.texte : b.imprimer(liaisons)}\n` })
  })
  const texte = morceaux.map((m) => m.texte).join('')
  const relue = lireRegion(lire, texte)
  for (const [cle, liaisons] of fusionnees) {
    const ecrites = liaisonsDe(relue, cle)
    if (ecrites.size !== liaisons.size || ![...liaisons].every((l) => ecrites.has(l))) throw new NonAdmis()
  }
  return texte
}

/** Les trois versions où chaque région d'imports en conflit est fusionnée par ensemble ; `null` si aucune ne l'est.
 *  `NonAdmis` si la version courante ou entrante lie alors deux fois le même nom, d'une région à une autre ou à son code. */
function resoudreLesRegions(lire, versions) {
  const marquees = COTES.map((cote) => marquer(lire, versions[cote]))
  const { text, taille } = threeWayDiff3(...marquees)
  const segments = segmentsDeFusion(text, taille)
  if (!segments) throw new NonAdmis()
  const atomes = segments.flatMap((s) => ('lignes' in s ? s.lignes.map((ligne) => ({ ligne })) : [s]))
  const dImport = (ligne) => ligne.startsWith(MARQUE) || !ligne.trim()
  const pur = (a) => ('ligne' in a ? dImport(a.ligne) : COTES.every((cote) => a[cote].every(dImport)))
  const sortie = []
  let resolues = 0
  for (let i = 0; i < atomes.length;) {
    let j = i
    while (j < atomes.length && pur(atomes[j])) j += 1
    if (j === i) {
      sortie.push(atomes[i])
      i += 1
      continue
    }
    const region = atomes.slice(i, j)
    i = j
    if (!region.some((a) => !('ligne' in a) && COTES.some((cote) => a[cote].some((ligne) => ligne.startsWith(MARQUE))))) {
      sortie.push(...region)
      continue
    }
    try {
      sortie.push({ ligne: fusionDeRegion(lire, region) })
      resolues += 1
    } catch {
      sortie.push(...region)
    }
  }
  if (!resolues) return null
  const vues = Object.fromEntries(COTES.map((cote) => [cote, vueDe(sortie, cote)]))
  for (const cote of ['ours', 'theirs']) {
    const lu = lire(vues[cote])
    if (!lu) throw new NonAdmis()
    liensDe(lu)
  }
  return vues
}

/** Fusion de trois versions d'un module de code. Retourne `{ text, conflict }`. */
export async function fusionnerImports({ base, ours, theirs, chemin, labels }) {
  if (ours === theirs || base === theirs) return { text: ours, conflict: false }
  if (base === ours) return { text: theirs, conflict: false }
  const ordinaire = threeWay(ours, base, theirs, labels)
  if (!ordinaire.conflict) return ordinaire
  try {
    // Clôture statique chargeable sous un Node refusé : scripts/node-requis.mjs (#1801).
    const { declarationsDImport } = await import('../guards/lib/declarationsDImport.mjs')
    const lire = (texte) => declarationsDImport(chemin, texte)
    const resolues = resoudreLesRegions(lire, { ours, base, theirs })
    if (!resolues) return ordinaire
    const fusion = threeWay(resolues.ours, resolues.base, resolues.theirs, labels)
    return fusion.conflict || lire(fusion.text) ? fusion : ordinaire
  } catch {
    return ordinaire
  }
}

async function main(argv) {
  const [O, A, B, P] = argv
  if (!O || !A || !B || !P) {
    process.stderr.write('merge-imports: usage — merge-imports.mjs %O %A %B %P\n')
    return 2
  }
  const res = await fusionnerImports({
    base: readFileSync(O, 'utf8'), ours: readFileSync(A, 'utf8'), theirs: readFileSync(B, 'utf8'), chemin: P,
    labels: { ours: `${P} (courant)`, base: `${P} (ancêtre)`, theirs: `${P} (entrant)` },
  })
  writeFileSync(A, res.text)
  if (res.conflict) {
    process.stderr.write(`merge-imports: ${P} — conflit résiduel, fusion 3-voies ordinaire.\n`)
    return 1
  }
  return 0
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
