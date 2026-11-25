// LE LOT DES RECETTES DU JEU DE RÔLE (#4936) : les jeux des parcours de `hotes/godot/recette.mjs` qui ouvrent son
// contenu, chacun par ses ids, de même forme que `JEUX_DU_PARCOURS` (`hotes/godot/lot-de-recettes.mjs`), qui les joue
// sur l'entrée du projet (`npm run jeu-de-role:recette`).

/** Les jeux du lot, `{ parcours: { nom du jeu: arguments après --parcours <parcours> } }`. */
export const JEUX = {
  campagne: { campagne: ['--campagne', 'la-diligence'] },
  document: { document: ['--scenario', 'documents-edo'] },
  cadrages: { 'cadrages-diligence': ['--scenario', 'diligence', '--vues', 'projets/jeu-de-role/cadrages/la-diligence.json'] },
}
