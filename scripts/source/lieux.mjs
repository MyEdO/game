// LIEUX d'un texte dans son livre et PREUVE d'une adresse figée, par la relation de texte (`aligner`,
// `src/data/source/decoupe.ts`) : un foyer, lu par `judge` (`derive-decoupes.mjs`, raison d'un ECHEC) et par
// les migrations qui adressent une prose (`scripts/migrations/lib/adressesFigees.mjs`). Lecture du disque :
// `lecteur-fs.mjs`.
import { chapitresDe, lireChapitre } from './lecteur-fs.mjs'
import {
  adresseDe, aligner, estDeContenu, estErreur, filDuChapitre, fragmentBlocs, intervalleDe, ouDeLAdresse, resoudreAdresse,
  tablesOf, unitesDe, unitesDeLAdresse, unitesDuBloc, unitesDuTexte,
} from '../../src/data/source/decoupe.ts'

/** Mémo par livre : chaque chapitre, ses blocs au fil (`BlocDuFil`), leurs unités et la longueur de leur
 *  contenu hors habillage. */
const _blocsDuLivre = new Map()

/** Les blocs d'un livre entier, chapitre par chapitre, dans l'ordre du fil. */
function blocsDuLivre(livre) {
  if (!_blocsDuLivre.has(livre)) {
    const chapitres = []
    for (const ch of chapitresDe(livre)) {
      const chapitre = lireChapitre(livre, ch)
      if (!chapitre) continue
      const blocs = filDuChapitre(chapitre).flatMap((el) => {
        if (el.kind !== 'bloc') return []
        const unites = unitesDuBloc(chapitre.sections.find((s) => s.slug === el.sec && s.occ === el.secOcc), el.idx)
        const longueur = unites.filter((u) => estDeContenu(u) && !u.habillage).reduce((n, u) => n + u.norm.length, 0)
        return [{ bloc: { sec: el.sec, secOcc: el.secOcc, idx: el.idx }, unites, longueur }]
      })
      chapitres.push({ ch, chapitre, blocs })
    }
    _blocsDuLivre.set(livre, chapitres)
  }
  return _blocsDuLivre.get(livre)
}

/**
 * Les LIEUX d'une desc dans son livre : les suites de blocs contigus au fil (titres intermédiaires
 * compris) dont le rendu la contient (`aligner`) et dont aucune suite plus courte ne la contient — un
 * bloc qui la contient seul est un lieu. Une suite ne s'allonge que tant que ses blocs intérieurs, que
 * la desc couvre entiers hors habillage, ne sont pas plus longs qu'elle.
 * @param {string} livre @param {string} desc
 * @returns {{ ch: string, depart: { sec: string, secOcc: number, idx: number }, fin: { sec: string, secOcc: number, idx: number }, blocs: number }[]}
 */
export function lieuxDe(livre, desc) {
  const texte = unitesDuTexte(desc)
  const longueur = texte.filter(estDeContenu).reduce((n, u) => n + u.norm.length, 0)
  const lieux = []
  for (const { ch, chapitre, blocs } of blocsDuLivre(livre)) {
    const contient = (a, z) => {
      if (a === z) return aligner(texte, blocs[a].unites) !== null
      const unites = unitesDe(chapitre, intervalleDe(chapitre, blocs[a].bloc, blocs[z].bloc))
      return !estErreur(unites) && aligner(texte, unites.unites) !== null
    }
    for (let a = 0; a < blocs.length; a++) {
      let interieur = 0
      for (let z = a; z < blocs.length; z++) {
        if (contient(a, z)) {
          if (z === a || !contient(a + 1, z)) lieux.push({ ch, depart: blocs[a].bloc, fin: blocs[z].bloc, blocs: z - a + 1 })
          break
        }
        if (z > a) interieur += blocs[z].longueur
        if (interieur > longueur) break
      }
    }
  }
  return lieux
}

/** La plus petite unité adressable qui contient un lieu : l'intervalle de ses blocs, ouvert par le tableau
 *  ENTIER (`adresseDe`, légende comprise) quand son premier bloc est une table. */
export function plusPetiteUnite(livre, ch, chapitre, { depart, fin }) {
  const section = chapitre.sections.find((s) => s.slug === depart.sec && s.occ === depart.secOcc)
  const table = tablesOf(section).find((t) => t.block === section.blocks[depart.idx])
  return table
    ? adresseDe({ book: livre, ch }, chapitre, { section, table, fin })
    : { book: livre, ch, parts: [intervalleDe(chapitre, depart, fin)] }
}

/** Désignation d'un lieu. */
const ouDuLieu = ({ ch, depart, fin }) =>
  `${ch}:${depart.sec}#${depart.secOcc}:${depart.idx}${fin.sec === depart.sec && fin.secOcc === depart.secOcc && fin.idx === depart.idx ? '' : ` → ${fin.sec}#${fin.secOcc}:${fin.idx}`}`

/** Désignation d'une adresse figée. */
export const ouDeLaCible = ({ ch, sec, secOcc, b0, b1 }) => `ch.${ch} §${sec}#${secOcc} blocs ${b0}-${b1}`

/**
 * PROUVE l'adresse figée d'une entrée inline : `{ ref, preuve }`, ou `{ erreur }` nominative.
 *  - RÉSOLUTION : `resoudreAdresse` réussit ; `sum` est l'empreinte du rendu (`fragmentBlocs`) ;
 *  - CONTENANCE : `aligner` aligne la desc entière sur le rendu ; son `ajoute` est rendu en preuve de perte,
 *    et doit valoir l'`ajoute` CONSIGNÉ quand la cible en porte un ;
 *  - UNICITÉ : exactement UN lieu du livre contient la desc (`lieuxDe`), et l'adresse en est la plus petite
 *    unité (`plusPetiteUnite`).
 * @param {{ id: string, desc: string, source: { book: string } }} entree
 * @param {{ ch: string, sec: string, secOcc: number, b0: number, b1: number, ajoute?: object[] }} cible
 */
export function prouver(entree, cible) {
  const livre = entree.source.book
  const ou = `${entree.id} → ${livre} ${ouDeLaCible(cible)}`
  const chapitre = lireChapitre(livre, cible.ch)
  if (!chapitre) return { erreur: `${ou} : chapitre introuvable` }
  const ref = { book: livre, ch: cible.ch, parts: [fragmentBlocs(chapitre, cible)] }
  const resolu = resoudreAdresse(chapitre, ref)
  if (estErreur(resolu)) return { erreur: `${ou} : ne résout pas — ${resolu.error} : ${resolu.detail}` }

  const unites = unitesDeLAdresse(chapitre, ref)
  const texte = unitesDuTexte(entree.desc)
  const alignement = estErreur(unites) ? null : aligner(texte, unites.unites)
  if (!alignement) return { erreur: `${ou} : la desc n'est pas contenue dans le rendu de l'adresse` }
  if (cible.ajoute !== undefined && JSON.stringify(alignement.ajoute) !== JSON.stringify(cible.ajoute)) {
    return { erreur: `${ou} : l'ajoute prouvé ${JSON.stringify(alignement.ajoute)} n'est pas l'ajoute consigné` }
  }

  const lieux = lieuxDe(livre, entree.desc)
  if (lieux.length !== 1) {
    return { erreur: `${ou} : ${lieux.length} lieux du livre contiennent la desc (${lieux.map(ouDuLieu).join(', ') || 'aucun'})` }
  }
  const [lieu] = lieux
  const attendue = lieu.ch === cible.ch ? plusPetiteUnite(livre, cible.ch, chapitre, lieu) : null
  if (!attendue || estErreur(attendue) || JSON.stringify(attendue) !== JSON.stringify(ref)) {
    const laquelle = attendue && !estErreur(attendue) ? ouDeLAdresse(attendue) : ouDuLieu(lieu)
    return { erreur: `${ou} : la plus petite unité qui contient la desc est ${laquelle}, pas l'adresse figée` }
  }
  return {
    ref,
    preuve: {
      unites: texte.length,
      ajoute: alignement.ajoute,
      ecartDeLongueurNormalisee: unites.unites.reduce((n, u) => n + u.norm.length, 0) - texte.reduce((n, u) => n + u.norm.length, 0),
      lieux: lieux.length,
    },
  }
}
