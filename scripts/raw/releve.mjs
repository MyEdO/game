// RELEVÉ MÉCANIQUE des sections d'un livre de `Source/` qui portent un TERME (#1887, lot 7) : le
// rappel, sans agent ; la précision appartient au tri qui lit le paquet (`paquet.mjs`).
//
// Quatre ORIGINES, chacune par la règle unique `nommes` (`src/data/source/renvoi.ts`) :
//  - `index` : une entrée de l'index imprimé (`index-imprime.ts`) dont le terme NOMME le terme cherché,
//    chaque page résolue comme un renvoi (`resoudreRenvoi`) ;
//  - `titre` : une section dont le titre NOMME le terme ;
//  - `mention` : une section dont le texte NOMME le terme ;
//  - `renvoi` : une section qui porte un « page N » résolu vers une section déjà relevée par les trois
//    autres origines.
// Une section d'un chapitre `horsRegle` n'est jamais relevée ; une section d'une plage `entites` va
// sous `entite`, toute autre sous `regle` (`scripts/raw/chapitres.json`). Une entrée d'index qui ne
// résout pas vers une cible va sous `ambigus` avec ses candidats (`page` : les sections du folio),
// sous `introuvables` si son folio ne porte aucun texte ou si sa cible est `horsRegle` ; une section
// qu'`adresseDe` n'adresse pas va sous `introuvables`, avec son code d'erreur.
//
// Lancer : node scripts/raw/releve.mjs <id du livre> <terme>…   (JSON sur la sortie standard)
import { chapterFile, estHorsRegle, livreExtraitDe, plagesDEntites, readText, sigleDe } from './_lib.mjs'
import { chapitresParses } from '../source/lecteur-fs.mjs'
import {
  MOTIFS_DE_RENVOI, cle, indexerLivre, nommes, renvoisDuLivre, resoudreRenvoi, singulier,
} from '../../src/data/source/renvoi.ts'
import { lireIndexImprime } from '../../src/data/source/index-imprime.ts'
import { adresseDe, estErreur, graphieDuFichier, numeroDuFichier, ouDeLAdresse, titreDuFichier } from '../../src/data/source/decoupe.ts'

/** Les origines d'une section relevée, dans l'ordre du relevé. */
export const ORIGINES = ['index', 'titre', 'mention', 'renvoi']

/** Titre du fichier de l'index imprimé d'un livre (`titreDuFichier`). */
const TITRE_DE_L_INDEX = 'Index'

/** Identité d'une section : fichier, slug, occurrence. */
const cleDeSection = (fichier, slug, occ) => `${fichier}\u0000${slug}#${occ}`

/** Identité d'une adresse (`DescRef`) : sa désignation (`ouDeLAdresse`) et ses empreintes. */
export const cleDAdresse = (ref) => `${ouDeLAdresse(ref)} ${ref.parts.map((p) => p.sum).join(' + ')}`

/**
 * Livre prêt au relevé (PUR) : ses chapitres indexés (`indexerLivre`), ses renvois résolus, son index
 * imprimé (`indexMd`, `null` sans fichier « Index »), et la NATURE de chaque section — `horsRegle`,
 * `entite` ou `regle` — par `horsRegle(numéro)` et les `plages` d'entités (`plagesDEntites`).
 */
export function preparerLivre({ book, langue, chapitres, indexMd, horsRegle, plages }) {
  const indexe = indexerLivre(book, langue, chapitres)
  const natures = new Map()
  for (const { fichier, parse } of chapitres) {
    const n = numeroDuFichier(fichier)
    const plage = plages.find((p) => p.ch === n)
    const rangDe = (b) => parse.sections.findIndex((s) => s.slug === b.slug && s.occ === b.occ)
    const de = plage?.from ? rangDe(plage.from) : 0
    const a = plage?.to ? rangDe(plage.to) : parse.sections.length - 1
    if (plage && (de < 0 || a < 0)) throw new Error(`releve : plage d'entités morte au ch.${n} de ${book}`)
    natures.set(fichier, parse.sections.map((_, rang) =>
      horsRegle(n) ? 'horsRegle' : plage && rang >= de && rang <= a ? 'entite' : 'regle'))
  }
  const index = indexMd == null ? [] : lireIndexImprime(indexMd, langue)
  return { book, langue, indexe, index, natures, renvois: renvoisDuLivre(indexe) }
}

/** Livre prêt au relevé, lu sur le disque (`chapitresParses`, `chapitres.json`). @param {string} bookId */
export function livreDuReleve(bookId) {
  const livre = livreExtraitDe(bookId)
  if (!livre) throw new Error(`releve : aucun livre extrait d'id « ${bookId} » au registre src/data/books.json`)
  const abbr = sigleDe(bookId)
  const chapitres = chapitresParses(bookId)
  const fichierDIndex = chapitres.find((c) => titreDuFichier(c.fichier) === TITRE_DE_L_INDEX)?.fichier ?? null
  return preparerLivre({
    book: bookId,
    langue: livre.language,
    chapitres,
    indexMd: fichierDIndex ? readText(chapterFile(abbr, numeroDuFichier(fichierDIndex)).path) : null,
    horsRegle: (n) => estHorsRegle(abbr, n),
    plages: plagesDEntites(abbr),
  })
}

/** `texte` NOMME-t-il `terme` ? `nommes`, sur les clés `cle` au `singulier` de la langue du livre. */
export function nomme(livre, texte, terme) {
  const sg = (k) => singulier(k, MOTIFS_DE_RENVOI[livre.langue].pluriel)
  const k = sg(cle(terme))
  return k !== '' && nommes(` ${sg(cle(texte))} `, [[k, [k]]]).size > 0
}

/** Une section d'un chapitre du livre, par son fichier et son rang, avec sa graphie de chapitre. */
function sectionDe(livre, fichier, rang) {
  const chapitre = livre.indexe.chapitres.get(fichier)
  return { fichier, rang, chapitre, section: chapitre.sections[rang], ch: graphieDuFichier(fichier) }
}

/** Désignation lisible d'une section : `fichier § titre`. */
const nommer = ({ fichier, section }) => `${fichier} § ${section.title}`

/** Ligne d'une adresse dans son fichier : celle de son premier bloc. */
function ligneDe(livre, fichier, ref) {
  const [frag] = ref.parts
  const section = livre.indexe.chapitres.get(fichier).sections.find((s) => s.slug === frag.sec && s.occ === frag.secOcc)
  return section.blocks[frag.kind === 'blocs' ? frag.b0 : 0].line
}

/** Le fichier d'un chapitre du livre par sa graphie de `DescRef.ch`. */
const fichierDe = (livre, ch) => [...livre.indexe.chapitres.keys()].find((f) => graphieDuFichier(f) === ch)

/** Rang d'une section d'un fichier par son slug et son occurrence. */
const rangDe = (livre, fichier, slug, occ) =>
  livre.indexe.chapitres.get(fichier).sections.findIndex((s) => s.slug === slug && s.occ === occ)

/** Candidats d'un folio : ses sections, `fichier § titre`. */
const candidatsDuFolio = (livre, folio) => (livre.indexe.parFolio.get(folio) ?? []).map((s) => `${s.fichier} § ${s.titre}`)

/**
 * SORT d'une page d'une entrée d'index : `regle` ou `entite` avec son adresse, `horsRegle`, `ambigus`
 * avec ses candidats, ou `introuvables`. Toute page tombe dans UN compartiment.
 */
export function sortDeLEntree(livre, entree, page) {
  const r = resoudreRenvoi(livre.indexe, { folio: page, fin: null, debut: 0, clause: entree.terme, phrase: entree.terme })
  const base = { entree, page, niveau: r.niveau }
  if (r.cible) {
    const fichier = fichierDe(livre, r.cible.ch)
    const [frag] = r.cible.parts
    const nature = livre.natures.get(fichier)[rangDe(livre, fichier, frag.sec, frag.secOcc)]
    return { ...base, sort: nature, adresse: r.cible, fichier }
  }
  if (r.niveau === 'introuvable') return { ...base, sort: 'introuvables' }
  const candidats = r.candidats.length ? r.candidats : candidatsDuFolio(livre, page)
  return { ...base, sort: 'ambigus', candidats }
}

/**
 * Relevé d'un terme : `{ terme, regle, entite, ambigus, introuvables }`. Une section relevée porte
 * son adresse, sa réf `NNN l.X`, son titre et ses origines ; `origines` restreint celles qui jouent.
 */
export function releve(livre, terme, { origines = ORIGINES } = {}) {
  const joue = new Set(origines)
  const relevees = new Map()
  const ambigus = []
  const introuvables = []
  const poser = (fichier, adresse, origine, titre) => {
    const k = cleDAdresse(adresse)
    if (!relevees.has(k)) {
      const ligne = ligneDe(livre, fichier, adresse)
      relevees.set(k, { adresse, fichier, ligne, ref: `${adresse.ch} l.${ligne}`, titre, origines: [] })
    }
    const it = relevees.get(k)
    if (!it.origines.includes(origine)) it.origines.push(origine)
  }
  const poserSection = (s, origine) => {
    const adresse = adresseDe({ book: livre.book, ch: s.ch }, s.chapitre, { section: s.section })
    if (estErreur(adresse)) introuvables.push({ origine, section: nommer(s), erreur: adresse.error, detail: adresse.detail })
    else poser(s.fichier, adresse, origine, s.section.title)
  }

  if (joue.has('index')) {
    for (const entree of livre.index.filter((e) => nomme(livre, e.terme, terme))) {
      for (const page of entree.pages) {
        const s = sortDeLEntree(livre, entree, page)
        if (s.sort === 'regle' || s.sort === 'entite') {
          const [frag] = s.adresse.parts
          poser(s.fichier, s.adresse, 'index', livre.indexe.chapitres.get(s.fichier).sections[rangDe(livre, s.fichier, frag.sec, frag.secOcc)].title)
        } else if (s.sort === 'ambigus') ambigus.push({ entree: s.entree, page, niveau: s.niveau, candidats: s.candidats })
        else introuvables.push({ origine: 'index', entree: s.entree, page, erreur: s.sort === 'horsRegle' ? 'hors-regle' : s.niveau })
      }
    }
  }
  for (const [fichier, natures] of livre.natures) {
    natures.forEach((nature, rang) => {
      if (nature === 'horsRegle') return
      const s = sectionDe(livre, fichier, rang)
      if (joue.has('titre') && nomme(livre, s.section.title, terme)) poserSection(s, 'titre')
      if (joue.has('mention') && s.section.blocks.length && nomme(livre, s.section.blocks.map((b) => b.md).join('\n'), terme)) poserSection(s, 'mention')
    })
  }
  if (joue.has('renvoi')) {
    const visees = new Set([...relevees.values()].map(({ fichier, adresse: { parts: [f] } }) => cleDeSection(fichier, f.sec, f.secOcc)))
    for (const r of livre.renvois) {
      if (!r.resolution.cible) continue
      const [f] = r.resolution.cible.parts
      if (!visees.has(cleDeSection(fichierDe(livre, r.resolution.cible.ch), f.sec, f.secOcc))) continue
      const rang = rangDe(livre, r.fichier, r.slug, r.occ)
      if (livre.natures.get(r.fichier)[rang] === 'horsRegle') continue
      poserSection(sectionDe(livre, r.fichier, rang), 'renvoi')
    }
  }

  const regle = []
  const entite = []
  for (const it of relevees.values()) {
    const [f] = it.adresse.parts
    const nature = livre.natures.get(it.fichier)[rangDe(livre, it.fichier, f.sec, f.secOcc)]
    if (nature === 'entite') entite.push(it)
    else regle.push(it)
  }
  return { terme, regle, entite, ambigus, introuvables }
}

function main() {
  const [bookId, ...termes] = process.argv.slice(2)
  if (!bookId || !termes.length) {
    console.error('Usage : node scripts/raw/releve.mjs <id du livre> <terme>…')
    process.exitCode = 2
    return
  }
  const livre = livreDuReleve(bookId)
  console.log(JSON.stringify(termes.map((t) => releve(livre, t)), null, 1))
}

if (import.meta.main) main()
