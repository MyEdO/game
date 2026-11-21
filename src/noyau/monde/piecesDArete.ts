/** Les pièces qu'une arête porte (`PieceDArete`, `./aretes.ts`) : un mur plein, une porte fermée ou ouverte, une fenêtre
 *  aux volets ouverts ou clos, la brèche d'une structure abattue, ou une échelle. Module sans import, que lit aussi la
 *  chaîne 3D (`scripts/personnage-3d/arete/pieces.mjs`, `positions.mjs`). */
export const PIECES_D_ARETE = ['mur', 'porte-fermee', 'porte-ouverte', 'fenetre', 'fenetre-close', 'breche', 'echelle'] as const;

/** Les pièces qu'un côté de marches porte (`PieceDEscalier`, `./cotesDeMarches.ts`) : le limon, la rampe. */
export const PIECES_D_ESCALIER = ['limon', 'rampe'] as const;

/** Les pièces qu'un segment de toit porte (`PieceDeToit`, `./faitieres.ts`) : la faîtière d'un faîte. */
export const PIECES_DE_TOIT = ['faitiere'] as const;

/** Les places d'une arête dans son ouverture (`PositionDansLOuverture`, `./aretes.ts`), et d'une rampe dans sa suite de
 *  rampes (`./cotesDeMarches.ts`) : seule, ou à son bout -X (`gauche`), entre ses deux bouts (`milieu`), à son bout +X
 *  (`droite`), X le long du `sens` de l'arête (#4471) ; celles des nœuds `<pièce>--<position>` des kits, que lit la chaîne
 *  3D (`scripts/personnage-3d/arete/positions.mjs`). */
export const POSITIONS_DANS_L_OUVERTURE = ['seule', 'gauche', 'milieu', 'droite'] as const;
