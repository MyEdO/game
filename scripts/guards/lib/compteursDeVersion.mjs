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
 * La lecture de `compteur` dans `texte` : la valeur et le numéro (à partir de 1) de l'unique ligne
 * `export const <symbole> = <entier>`. PURE.
 * @param {string | null | undefined} texte @param {Compteur} compteur @param {string} revision
 * @returns {{ valeur: number, ligne: number }} @throws {CompteurIllisible}
 */
export function lectureDuCompteur(texte, compteur, revision) {
  if (typeof texte !== 'string') throw new CompteurIllisible(compteur, revision, 'fichier absent')
  const motif = new RegExp(`^export const ${echapper(compteur.symbole)}\\s*=\\s*(\\d+)\\s*;?\\s*$`)
  const vus = texte.split('\n').flatMap((l, i) => {
    const vu = motif.exec(l)
    return vu ? [{ valeur: Number(vu[1]), ligne: i + 1 }] : []
  })
  if (vus.length !== 1) throw new CompteurIllisible(compteur, revision, `${vus.length} ligne(s) \`export const ${compteur.symbole} = <entier>\`, une seule attendue`)
  return vus[0]
}

/**
 * La collision de `compteur` (#2222), ou `null` : la valeur `publiee` à la tête est déjà PRISE par le
 * tronc. PURE.
 * @param {Compteur} compteur
 * @param {{ publiee: number, tronc: number, depart: number, ecriteParLaBranche: boolean }} faits
 *   `depart` = la valeur au premier commit de la chaîne des premiers parents de la tête contenu dans le
 *   tronc ; `ecriteParLaBranche` = l'auteur de la ligne à la tête (`git help blame`) n'est pas un
 *   ancêtre du tronc.
 * @returns {{ symbole: string, fichier: string, publiee: number, tronc: number, depart: number } | null}
 */
export function collisionDuCompteur(compteur, { publiee, tronc, depart, ecriteParLaBranche }) {
  return ecriteParLaBranche && publiee <= tronc && publiee !== depart ? { ...compteur, publiee, tronc, depart } : null
}

/** Le refus d'une collision (#2222). PURE. @param {{ symbole: string, publiee: number, tronc: number }} collision */
export const messageDeCollision = ({ symbole, publiee, tronc }) =>
  `\`${symbole}\` : la branche publie ${publiee}, déjà prise par main (à ${tronc}) — prochaine libre : ${tronc + 1}, à renuméroter avec sa migration/son golden`
