"""Géométrie de `humanoide--vetement--haut-de-chausses` : une culotte d'anneaux horizontaux, autour des hanches de la
ceinture à l'entrejambe, puis autour de chaque jambe jusqu'au bandeau du genou (`donnees.py`).

Chaque jambe a `COLONNES_JAMBE` colonnes ; au-dessus de l'entrejambe, l'anneau des hanches reprend les colonnes du dehors
des deux jambes et les deux coutures du milieu, devant et derrière. À la rangée de l'entrejambe, les colonnes de
l'entrejambe des deux jambes sont les mêmes sommets, sur le plan du milieu : la culotte reste d'un seul tenant.
Par pan de `PAN` colonnes, celle du milieu bombe à l'aisance, les deux autres rentrent du `CREUX` : la bande entre deux
pans est le crevé. Mi-partie : la jambe gauche a ses pans en `toile` et ses crevés en `drap`, la droite l'inverse ; le
bandeau est en `drap`. Poids empruntés au corps sommet par sommet, ceux du milieu à la moyenne des deux jambes, puis
lissés ; silhouettes et clés `gabarit_*` transférées.
"""
import numpy as np

from robe import Nappe, piece_de
from tissu import anneau, centre_de, direction, emprunter, selon

COTES = {'g': 1.0, 'd': -1.0}


def table(points, z):
    return float(np.interp(z, *zip(*sorted(points))))


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


def coupe(b, z, zones):
    return b.coupe(zones, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)


def anneau_de_jambe(D, b, z, cote):
    """Les `COLONNES_JAMBE` points de la jambe `cote` à `z`, et le centre de sa coupe."""
    m, s = D['COLONNES_JAMBE'], COTES[cote]
    P = coupe(b, z, D['PORTEUSES'])
    P = P[s * P[:, 0] > 0]
    c = centre_de(P)
    js = list(range(m))
    pts = anneau(P, c, [direction(s * azimut(D, j)) for j in js], aisances(D, z, js), D['DEGAGEMENT_MIN'],
                 au_plus_pres=True)
    return [np.array([p[0], p[1], z]) for p in pts], np.array([c[0], c[1], z])


def colonnes_des_hanches(D):
    """L'anneau des hanches : (colonne de jambe, côté, azimut autour des hanches), de la couture devant par la gauche, la
    couture du dos, puis la droite."""
    m, f, d = D['COLONNES_JAMBE'], D['COUTURE_DEVANT'], D['COUTURE_DOS']
    dehors = [(f + 1 + k) % m for k in range((d - f) % m - 1)]
    arc = (azimut(D, d) - azimut(D, f)) % 360.0

    def autour(j):
        return 180.0 * ((azimut(D, j) - azimut(D, f)) % 360.0) / arc
    return ([(f, 'g', 0.0)] + [(j, 'g', autour(j)) for j in dehors] + [(d, 'g', 180.0)]
            + [(j, 'd', -autour(j)) for j in reversed(dehors)])


def materiau_de_face(D, ja, jb, cote):
    """`toile` ou `drap` pour la face entre les colonnes `ja` et `jb` (voisines) du côté `cote`."""
    m = D['COLONNES_JAMBE']
    k = ja if (jb - ja) % m == 1 else jb
    fente = k % D['PAN'] == D['PAN'] - 1
    return 'toile' if fente == (cote == 'd') else 'drap'


def construire(D, materiaux, b):
    b.exiger(D['PORTEUSES'])
    porteurs = {'T': b.porteur(D['PORTEUSES']),
                **{c: b.porteur(['hanches', f'cuisse_{c}', f'genou_{c}']) for c in COTES}}
    m = D['COLONNES_JAMBE']
    nappe, faces = Nappe(), []

    def relier(A, B, cols, ref, bandeau=False):
        """Les quads entre les anneaux fermés `A` et `B` de colonnes `cols` ((colonne, côté) par sommet)."""
        for i in range(len(A)):
            k = (i + 1) % len(A)
            nappe.quad(A[i], A[k], B[k], B[i], ref)
            (ja, ca), (jb, _) = cols[i], cols[k]
            faces.extend(['drap' if bandeau else materiau_de_face(D, ja, jb, ca)] * 2)

    # Hanches : de la ceinture à la rangée au-dessus de l'entrejambe.
    hanches = colonnes_des_hanches(D)
    cols_h = [(j, c) for j, c, _ in hanches]
    anneaux_h = []
    for z in D['CEINTURE']:
        P = coupe(b, z, D['PORTEUSES'])
        c = centre_de(P)
        pts = anneau(P, c, [direction(t) for _, _, t in hanches], aisances(D, z, [j for j, _, _ in hanches]),
                     D['DEGAGEMENT_MIN'], au_plus_pres=True)
        pts = [np.array([p[0], p[1], z]) for p in pts]
        anneaux_h.append((nappe.poser(pts, [emprunter(p, porteurs['T'])[0] for p in pts]), np.array([c[0], c[1], z])))

    # Entrejambe : un anneau par jambe ; les coutures et l'entrejambe sur le plan du milieu, communs aux deux.
    z = D['ENTREJAMBE']
    jambes = {c: anneau_de_jambe(D, b, z, c) for c in COTES}
    milieu = [D['COUTURE_DEVANT'], D['COUTURE_DOS']] + [j for j in range(m) if (j - D['COUTURE_DOS']) % m
                                                         < (D['COUTURE_DEVANT'] - D['COUTURE_DOS']) % m and j != D['COUTURE_DOS']]
    communs = {}
    for j in milieu:
        p = np.array([0.0, (jambes['g'][0][j][1] + jambes['d'][0][j][1]) / 2, z])
        w = (emprunter(p, porteurs['g'])[0] + emprunter(p, porteurs['d'])[0]) / 2
        communs[j] = nappe.poser([p], [w])[0]
    rangee = {}
    for c in COTES:
        pts, _ = jambes[c]
        propres = [j for j in range(m) if j not in communs]
        idx = nappe.poser([pts[j] for j in propres], [emprunter(pts[j], porteurs[c])[0] for j in propres])
        rangee[c] = [communs[j] if j in communs else idx[propres.index(j)] for j in range(m)]
    entrejambe = [rangee[c][j] for j, c in cols_h]
    centre_e = np.array([0.0, float(np.mean([jambes[c][1][1] for c in COTES])), z])
    for (A, ca), (B, cb) in zip(anneaux_h, anneaux_h[1:] + [(entrejambe, centre_e)]):
        relier(A, B, cols_h, (ca + cb) / 2)

    # Jambes : de l'entrejambe au bandeau.
    for c in COTES:
        cols = [(j, c) for j in range(m)]
        precedent, centre_p = rangee[c], jambes[c][1]
        for k, zj in enumerate(D['JAMBE']):
            pts, centre = anneau_de_jambe(D, b, zj, c)
            A = nappe.poser(pts, [emprunter(p, porteurs[c])[0] for p in pts])
            relier(precedent, A, cols, (centre_p + centre) / 2, bandeau=k >= len(D['JAMBE']) - D['BANDEAU'])
            precedent, centre_p = A, centre

    piece = piece_de(D, b, nappe, materiaux['drap'], 'haut_de_chausses')
    # `tissu.double_nappe` : la face extérieure du triangle t est le polygone 2t.
    piece.data.materials.append(materiaux['toile'])
    indice = len(piece.data.materials) - 1
    for t, nom in enumerate(faces):
        if nom == 'toile':
            piece.data.polygons[2 * t].material_index = indice
    b.transferer(piece, D['PORTEUSES'], D['BORNES_DES_CLES'])
    return piece
