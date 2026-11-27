/** Une entrée du journal du noyau : une donnée que chaque hôte rédige (#4574). `ligne` : texte déjà rédigé par le
 *  noyau, stock à résorber (#4574). `deFixe` : écrite pendant qu'un jet saisi par le joueur s'applique (#939). */
export type EntreeDuJournal = { sorte: 'ligne'; texte: string; deFixe?: true };
export const ligneDeTexte = (texte: string): EntreeDuJournal => ({ sorte: 'ligne', texte });
