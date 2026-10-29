// #673 L1 — les données orphelines d'EDOC ch.4 (Montures et véhicules) entrent au bestiaire.
//
// Écrit `src/data/creatures.json` et `src/data/traits.json` par ROUND-TRIP JSON (le fichier est
// exactement `JSON.stringify(…, null, 2)` sans saut final — vérifié avant écriture, refus sinon) :
// aucune ligne n'est retouchée en dehors des insertions.
//
// Toute `desc` est EXTRAITE du Source (jamais retapée) — EDOC 07.
//
// ENTRÉES : `src/data/creatures.json`, `src/data/traits.json` (lus et écrits) et le chapitre
// `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/07 - …` (lu, source des `desc`, des
// prix et des folios).
//
// FORME D'AVANT SEULE : le bestiaire d'avant se reconnaît au `chien` SANS facette d'achat ; les trois
// lots (facette d'achat du chien, mouton/cochon au bestiaire, Trait Entêté et ses porteurs optionnels)
// n'agissent que sur lui. Un bestiaire où le chien est absent ou porte déjà sa facette — migré, ou
// révisé depuis — est laissé tel quel ; rejoué sur l'état final, le script n'écrit RIEN et sort 0.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { folioGoverningWhy } from '../guards/lib/folioLineAlign.mjs'
import { serializeDataset } from '../../src/data/serialize.ts'

const CH = "Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon"
const files = readdirSync(CH)
const chapterLines = (ch) => {
  const f = files.find((n) => n.startsWith(String(ch).padStart(2, '0') + ' -'))
  return f ? readFileSync(join(CH, f), 'utf8').split('\n') : null
}
const edoc07 = chapterLines(7)
const ligne = (n) => edoc07[n - 1]
const folio = (n) => {
  const { folio: f, reason } = folioGoverningWhy(chapterLines, 7, n)
  if (reason !== 'ok') throw new Error(`folio non jugeable pour EDOC 07 l.${n} : ${reason}`)
  return f
}

/** Cellules d'une ligne de tableau Markdown. */
const cellules = (n) => ligne(n).split('|').slice(1, -1).map((c) => c.trim())

const brut = {}
const lire = (p) => {
  const raw = readFileSync(p, 'utf8')
  const data = JSON.parse(raw)
  if (serializeDataset(data) !== raw) throw new Error(`${p} n'est pas au format round-trip attendu`)
  brut[p] = raw
  return data
}
/** N'écrit que si le document a changé. @returns {boolean} vrai si le fichier a été réécrit. */
const ecrire = (p, data) => {
  const sortie = serializeDataset(data)
  if (sortie === brut[p]) return false
  writeFileSync(p, sortie, 'utf8')
  return true
}

// ── Prix : « 2 CO » / « 3 /- » / « 5 sc » (LDB 57 l.7 : sc = sous de cuivre, /- = pistoles
//    d'argent, CO = couronnes d'or) → { gold, silver, brass }.
function prix(cellule) {
  const m = /^(\d+)\s*(CO|\/-|sc)$/.exec(cellule)
  if (!m) throw new Error(`cellule de coût non reconnue : « ${cellule} »`)
  const n = Number(m[1])
  return { gold: m[2] === 'CO' ? n : 0, silver: m[2] === '/-' ? n : 0, brass: m[2] === 'sc' ? n : 0 }
}

const CREATURES = 'src/data/creatures.json'
const TRAITS = 'src/data/traits.json'
const creatures = lire(CREATURES)
const traits = lire(TRAITS)
const par = (arr, id) => arr.find((e) => e.id === id)
const indexDe = (arr, id) => arr.findIndex((e) => e.id === id)
const chien = par(creatures, 'chien')
const bestiaireDAvant = chien !== undefined && chien.purchase === undefined

// ── LOT 1 — facette d'achat du chien (EDOC 07 l.102, folio 24).
if (bestiaireDAvant) {
  const [, cout, , dispo] = cellules(102)
  // Ordre de clés du patron des 9 montures : … spells, [desc], source, purchase, appearance, grantGroups.
  const { appearance, grantGroups, ...tete } = chien
  Object.keys(chien).forEach((k) => delete chien[k])
  Object.assign(chien, tete, { purchase: { price: prix(cout), availability: dispo } }, { appearance, grantGroups })
}

// ── LOT 2 — mouton et cochon (EDOC 07 l.100-101, folio 24) : le livre ne leur imprime AUCUN profil
//    (aucun livre autorisé n'en donne — mesuré). Deux patrons, chacun pris sur ses porteurs RÉELS :
//    `char: {}` comme les animaux du bestiaire sans profil imprimé (`poulet`, `singe`, `vers`), et
//    `traits: []` parce qu'EDOC 07 n'en imprime aucun ; `grantGroups: ['bete']` comme les animaux
//    ACHETABLES voisins de la même table (`chien` l.102, `blaireau`) — `poulet`/`singe`/`vers`, eux,
//    n'en portent aucun.
//
//    DETTE OUVERTE — colonne « Capacité d'encombrement » d'EDOC 07 l.100-101 (Mouton 2, Cochon 3) :
//    ces deux cellules ne sont PAS modelées ici. Le seul champ porteur existant est `encPortee`, qui
//    vit sur les entrées de `src/data/montures.json` (table MOUVEMENT POUR LES MONTURES, EDOC 07
//    folio 25) ; mouton et cochon n'y figurent pas et ne sont pas des montures. Le champ porteur
//    d'une capacité de charge pour une bête NON montée reste à trancher (lot L2/L3 de #673) — aucune
//    modélisation forcée ici, aucune valeur inventée sur un champ détourné.
{
  const entree = (id, label, l) => {
    const [nom, cout, , dispo] = cellules(l)
    if (nom !== label) throw new Error(`EDOC 07 l.${l} ne porte pas « ${label} » mais « ${nom} »`)
    return {
      id,
      type: 'creatures',
      label,
      title: null,
      folder: 'Animaux et véhicules',
      char: {},
      traits: [],
      optionals: [],
      skills: [],
      talents: [],
      trappings: [],
      spells: [],
      source: { book: 'ennemi-dans-l-ombre-compagnon', page: folio(l) },
      purchase: { price: prix(cout), availability: dispo },
      grantGroups: ['bete'],
    }
  }
  if (bestiaireDAvant && !par(creatures, 'mouton') && !par(creatures, 'cochon')) {
    const apres = indexDe(creatures, 'poulet')
    if (apres < 0) throw new Error('poulet introuvable')
    creatures.splice(apres, 0, entree('cochon', 'Cochon', 101))
    creatures.splice(apres, 0, entree('mouton', 'Mouton', 100))
  }
}

// ── LOT 3 — Trait Entêté (EDOC 07 l.31, folio 22), prescription #630 §1 : le passif +20 FM
//    s'exprime ; le volet « Test opposé de maîtrise » est routé #617, jamais à demi dans le trait.
if (bestiaireDAvant) {
  const desc = ligne(31)
  if (!desc.startsWith('Les ânes et les mules possèdent souvent le Trait Entêté')) {
    throw new Error(`EDOC 07 l.31 n'est pas le paragraphe Entêté : ${desc.slice(0, 60)}`)
  }
  if (!par(traits, 'entete')) {
    const avant = indexDe(traits, 'ethere')
    if (avant < 0) throw new Error('ethere introuvable')
    traits.splice(avant, 0, {
      id: 'entete',
      type: 'traits',
      label: 'Entêté',
      desc,
      source: { book: 'ennemi-dans-l-ombre-compagnon', page: folio(31) },
      passive: [{ op: 'charMod', char: 'force-mentale', mod: 20 }],
    })
  }
  // « possèdent SOUVENT » → optionnel, jamais un trait de base (EDOC 07 l.31).
  for (const id of ['ane', 'mule']) {
    const c = par(creatures, id)
    if (Array.isArray(c?.optionals) && !c.optionals.some((o) => o.id === 'entete')) c.optionals.push({ id: 'entete' })
  }
}

const ecrits = [ecrire(CREATURES, creatures) && CREATURES, ecrire(TRAITS, traits) && TRAITS].filter(Boolean)
console.log(ecrits.length ? `${ecrits.join(' + ')} écrits` : 'no-op : creatures.json + traits.json portent déjà EDOC ch.4')
