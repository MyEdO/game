// LE LOT DES RECETTES DU JEU DE RÔLE (#4936), entrée de `npm run jeu-de-role:recette` : les jeux des parcours de
// `hotes/godot/recette.mjs` qui ouvrent son contenu, chacun par ses ids, de même forme que `JEUX_DU_PARCOURS`, joués en
// natif sur l'entrée du projet par `jouerLeLot` (`hotes/godot/lot-de-recettes.mjs`), journaux sous
// `dist/jeu-de-role-recettes/` (ignoré par git). Rend 1 si un jeu est rouge.
import { jouerLeLot } from '../../../hotes/godot/lot-de-recettes.mjs'

/** Les jeux du lot, `{ parcours: { nom du jeu: arguments après --parcours <parcours> } }`. */
const JEUX = {
  campagne: { campagne: ['--campagne', 'la-diligence'] },
  document: { document: ['--scenario', 'documents-edo'] },
  cadrages: { 'cadrages-diligence': ['--scenario', 'diligence', '--vues', 'projets/jeu-de-role/cadrages/la-diligence.json'] },
}

process.exitCode = await jouerLeLot(JEUX, { natif: true, entree: 'projets/jeu-de-role/godot.ts', captures: 'dist/jeu-de-role-recettes' })
