// Les COMPTEURS DE VERSION d'une forme persistée et la collision de la valeur qu'une tête publie (#2222).
// Déclaration UNIQUE (fichier, symbole) ; l'assemblage git vit dans `compteursDuDepot.mjs`. Module PUR :
// les textes lus aux révisions et les faits git arrivent en paramètre.

/** @typedef {{ fichier: string, symbole: string }} Compteur */

/** @type {readonly Compteur[]} */
export const COMPTEURS = Object.freeze([
  Object.freeze({ fichier: 'src/state/saves.ts', symbole: 'SAVE_VERSION' }),
  Object.freeze({ fichier: 'src/data/schemas/defs-scenes/projet.ts', symbole: 'SCHEMA_PROJET' }),
  Object.freeze({ fichier: 'src/state/roster.ts', symbole: 'EXPORT_VERSION' }),
])

/** Les fichiers à lire pour juger `COMPTEURS`, sans doublon. */
export const FICHIERS_DES_COMPTEURS = Object.freeze([...new Set(COMPTEURS.map((c) => c.fichier))])

/** Un compteur sans valeur lisible à une révision : l'erreur le NOMME. */
export class CompteurIllisible extends Error {
  /** @param {Compteur} compteur @param {string} revision @param {string} raison */
  constructor(compteur, revision, raison) {
    super(`\`${compteur.symbole}\` illisible à la révision ${revision} (${compteur.fichier}) : ${raison}`)
    this.name = 'CompteurIllisible'
    this.compteur = compteur
    this.revision = revision
  }
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * La valeur de `compteur` dans `texte` : l'unique ligne `export const <symbole> = <entier>`. PURE.
 * @param {string | null | undefined} texte @param {Compteur} compteur @param {string} revision
 * @returns {number} @throws {CompteurIllisible}
 */
export function valeurDuCompteur(texte, compteur, revision) {
  if (typeof texte !== 'string') throw new CompteurIllisible(compteur, revision, 'fichier absent')
  const motif = new RegExp(`^export const ${echapper(compteur.symbole)}\\s*=\\s*(\\d+)\\s*;?\\s*$`, 'gm')
  const vus = [...texte.matchAll(motif)]
  if (vus.length !== 1) throw new CompteurIllisible(compteur, revision, `${vus.length} ligne(s) \`export const ${compteur.symbole} = <entier>\`, une seule attendue`)
  return Number(vus[0][1])
}

/**
 * La branche a-t-elle MONTÉ le compteur ? Un de ses commits non-fusion en change la VALEUR, ou une de
 * ses fusions rend une valeur qu'aucun de ses parents ne porte. PURE.
 * @param {{ propres: { avant: number, apres: number }[], fusions: { valeur: number, parents: number[] }[] }} valeurs
 * @returns {boolean}
 */
export const monteeParLaBranche = ({ propres, fusions }) =>
  propres.some(({ avant, apres }) => avant !== apres) || fusions.some(({ valeur, parents }) => !parents.includes(valeur))

/**
 * La collision de `compteur` (#2222), ou `null` : la branche l'a monté, le tronc aussi depuis le point
 * de départ, et la valeur `publiee` à la tête n'est pas au-dessus du tronc. PURE.
 * @param {Compteur} compteur
 * @param {{ publiee: number, tronc: number, depart: number, montee: boolean }} faits `depart` = la valeur
 *   au point de départ (`pointDeDepart`, `gitPorte.mjs`) ; `montee` = `monteeParLaBranche`.
 * @returns {{ symbole: string, fichier: string, publiee: number, tronc: number, depart: number } | null}
 */
export function collisionDuCompteur(compteur, { publiee, tronc, depart, montee }) {
  return montee && tronc !== depart && publiee <= tronc ? { ...compteur, publiee, tronc, depart } : null
}

/** Le refus d'une collision (#2222). PURE. @param {{ symbole: string, publiee: number, tronc: number }} collision */
export const messageDeCollision = ({ symbole, publiee, tronc }) =>
  `\`${symbole}\` : la branche publie ${publiee}, déjà prise par main (à ${tronc}) — prochaine libre : ${tronc + 1}, à renuméroter avec sa migration/son golden`
