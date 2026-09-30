// Les COMPTEURS DE VERSION d'une forme persistée et leur collision entre une branche et le tronc (#2222).
// Déclaration UNIQUE (fichier, symbole) : l'étape `rebase` de `scripts/ops/publier.mjs` la lit, la file
// de fusion (#2178) la relira. Module PUR : les textes lus aux révisions arrivent en paramètre.

/** @typedef {{ fichier: string, symbole: string }} Compteur */

/** @type {readonly Compteur[]} */
export const COMPTEURS = Object.freeze([
  Object.freeze({ fichier: 'src/state/saves.ts', symbole: 'SAVE_VERSION' }),
  Object.freeze({ fichier: 'src/data/schemas/defs-scenes/projet.ts', symbole: 'SCHEMA_PROJET' }),
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
 * Les compteurs que la branche ET le tronc ont changés depuis leur base de fusion. PURE.
 * @param {{ base: Map<string, string|null>, branche: Map<string, string|null>, tronc: Map<string, string|null> }} textes
 *   le texte de chaque fichier de `FICHIERS_DES_COMPTEURS` à chaque révision.
 * @param {readonly Compteur[]} [compteurs]
 * @returns {{ symbole: string, fichier: string, base: number, branche: number, tronc: number }[]}
 * @throws {CompteurIllisible}
 */
export function collisionsDeCompteurs({ base, branche, tronc }, compteurs = COMPTEURS) {
  const collisions = []
  for (const compteur of compteurs) {
    const valeurs = {
      base: valeurDuCompteur(base.get(compteur.fichier), compteur, 'base'),
      branche: valeurDuCompteur(branche.get(compteur.fichier), compteur, 'branche'),
      tronc: valeurDuCompteur(tronc.get(compteur.fichier), compteur, 'tronc'),
    }
    if (valeurs.branche !== valeurs.base && valeurs.tronc !== valeurs.base) collisions.push({ ...compteur, ...valeurs })
  }
  return collisions
}

/** Le refus d'une collision (#2222). PURE. @param {{ symbole: string, tronc: number }} collision */
export const messageDeCollision = ({ symbole, tronc }) =>
  `\`${symbole}\` : main est passé à ${tronc} depuis ta base, la tienne doit viser ${tronc + 1} et rejouer sa migration/son golden`
