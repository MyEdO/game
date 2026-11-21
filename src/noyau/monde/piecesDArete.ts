/** Les pièces qu'une arête porte (`PieceDArete`, `./aretes.ts`) : un mur plein, une porte fermée ou ouverte, une fenêtre
 *  aux volets ouverts ou clos, la brèche d'une structure abattue, ou une échelle. Module sans import, que lit aussi la
 *  chaîne 3D (`scripts/personnage-3d/arete/pieces.mjs`). */
export const PIECES_D_ARETE = ['mur', 'porte-fermee', 'porte-ouverte', 'fenetre', 'fenetre-close', 'breche', 'echelle'] as const;

/** Les pièces qu'un côté de marches porte (`PieceDEscalier`, `./cotesDeMarches.ts`) : le limon, la rampe. */
export const PIECES_D_ESCALIER = ['limon', 'rampe'] as const;
