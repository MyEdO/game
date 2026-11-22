"""Géométrie de `humanoide--vetement--haut-de-chausses` : une culotte d'anneaux horizontaux (`element/culotte.py`), de
la ceinture au bandeau du genou (`donnees.py`).

Par pan de `PAN` colonnes, celle du milieu bombe à l'aisance, les deux autres rentrent du `CREUX` : la bande entre deux
pans est le crevé. Mi-partie : la jambe gauche a ses pans en `toile` et ses crevés en `drap`, la droite l'inverse ; le
bandeau est en `drap`. Poids lissés ; silhouettes et clés `gabarit_*` transférées.
"""
from culotte import nappe_de_culotte, table
from robe import piece_de
from tissu import selon


def azimut(D, j):
    """L'azimut de la colonne `j` à la jambe gauche : par pan, le crevé large de `LARGEUR_DU_CREVE`, la colonne bombée au
    milieu du reste."""
    largeur = 360.0 * D['PAN'] / D['COLONNES_JAMBE']
    pan, k = divmod(j, D['PAN'])
    return pan * largeur + (largeur - D['LARGEUR_DU_CREVE']) * k / (D['PAN'] - 1)


def aisances(D, z, js):
    """L'aisance des colonnes `js` à la hauteur `z` : bombée au milieu d'un pan, rentrée du creux ailleurs, éteinte vers
    l'entrejambe."""
    a, creux = table(D['AISANCE'], z), table(D['CREUX'], z)
    return [a * selon(D['VERS_L_ENTREJAMBE'], azimut(D, j) - 90.0) - (0.0 if j % D['PAN'] == 1 else creux) for j in js]


def materiau_de_face(D, ja, jb, cote):
    """`toile` ou `drap` pour la face entre les colonnes `ja` et `jb` (voisines) du côté `cote`."""
    m = D['COLONNES_JAMBE']
    k = ja if (jb - ja) % m == 1 else jb
    fente = k % D['PAN'] == D['PAN'] - 1
    return 'toile' if fente == (cote == 'd') else 'drap'


def construire(D, materiaux, b):
    nappe, bandes = nappe_de_culotte(D, b, azimut, aisances, haut_fixe=False)
    faces = []
    for cols, rang in bandes:
        bandeau = rang is not None and rang >= len(D['JAMBE']) - D['BANDEAU']
        for i, (ja, cote) in enumerate(cols):
            faces.extend(['drap' if bandeau else materiau_de_face(D, ja, cols[(i + 1) % len(cols)][0], cote)] * 2)

    piece = piece_de(D, b, nappe, materiaux['drap'], 'haut_de_chausses')
    # `tissu.double_nappe` : la face extérieure du triangle t est le polygone 2t.
    piece.data.materials.append(materiaux['toile'])
    indice = len(piece.data.materials) - 1
    for t, nom in enumerate(faces):
        if nom == 'toile':
            piece.data.polygons[2 * t].material_index = indice
    b.transferer(piece, D['PORTEUSES'], D['BORNES_DES_CLES'])
    return piece
