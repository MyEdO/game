/** Les pièces qu'une arête porte (`PieceDArete`, `./aretes.ts`) : un mur plein, une porte fermée ou ouverte, une fenêtre
 *  aux volets ouverts ou clos, la brèche d'une structure abattue, ou une échelle. Module sans import, que lit aussi la
 *  chaîne 3D (`scripts/personnage-3d/arete/pieces.mjs`, `positions.mjs`). */
export const PIECES_D_ARETE = ['mur', 'porte-fermee', 'porte-ouverte', 'fenetre', 'fenetre-close', 'breche', 'echelle'] as const;

/** Les pièces qu'un côté de marches porte (`PieceDEscalier`, `./cotesDeMarches.ts`) : le limon, la rampe. */
export const PIECES_D_ESCALIER = ['limon', 'rampe'] as const;

/** Les pièces qu'une arête de toit porte (`PieceDeToit`, `./piecesDeToit.ts`) : la faîtière d'un faîte, l'arêtier d'une
 *  arête saillante montante, la noue d'une arête rentrante. */
export const PIECES_DE_TOIT = ['faitiere', 'aretier', 'noue'] as const;

/** La demi-largeur (m) d'une pièce de toit posée, de son axe au bord de ses bras, en travers et en plan : aucune pièce
 *  d'un kit de toit ne la passe (`scripts/personnage-3d/test_toit.py`), et une arête recule d'autant à un nœud où sa
 *  pose déborderait sur le pan d'une voisine (`./piecesDeToit.ts`). */
export const DEMI_LARGEUR_DE_POSE_M = 0.5;

/** Les places d'une arête dans son ouverture (`PositionDansLOuverture`, `./aretes.ts`), et d'une rampe dans sa suite de
 *  rampes (`./cotesDeMarches.ts`) : seule, ou à son bout -X (`gauche`), entre ses deux bouts (`milieu`), à son bout +X
 *  (`droite`), X le long du `sens` de l'arête (#4471) ; celles des nœuds `<pièce>--<position>` des kits, que lit la chaîne
 *  3D (`scripts/personnage-3d/arete/positions.mjs`). */
export const POSITIONS_DANS_L_OUVERTURE = ['seule', 'gauche', 'milieu', 'droite'] as const;
