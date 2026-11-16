"""Géométrie de `humanoide--vetement--pourpoint` : un corps ajusté d'anneaux horizontaux fermés, du bas du torse au bas
du cou, et les mancherons du kit des robes (`robe.manches`), bouffants de l'épaule au coude, fendus de crevés : une
colonne sur `COLONNES_DE_CREVE`, rentrée en creux aux anneaux intérieurs de la bande `CREVES`, porte la surface
`creves` ; poids empruntés au corps, sommet par sommet, silhouettes et clés `gabarit_*` transférées."""
import numpy as np

from robe import BRAS, COU, TRONC, Nappe, manches, piece_de
from tissu import anneau, centre_de, direction, emprunter

PORTEUSES = TRONC + COU + BRAS['g'] + BRAS['d']


def anneaux(D, b, nappe, porteur, liste, m):
    """Les anneaux horizontaux fermés de `liste` (ancre, décalage, aisance), `m` colonnes, coupés dans le tronc et le
    cou, dans le cou seul au-dessus du bas du cou (la coupe du tronc y passe encore sur le trapèze, jusqu'aux épaules),
    reliés en bandes."""
    ancres = {'bas': float(b.corps('torse')[0][:, 2].min()),
              'aisselle': min(float(b.corps(z)[0][:, 2].min()) for z in BRAS['g'][:1] + BRAS['d'][:1]),
              'cou': float(b.corps('cou')[0][:, 2].min())}
    thetas = [360.0 * i / m for i in range(m)]
    faits = []
    for ancre, dz, e in liste:
        z = ancres[ancre] + dz
        zones = COU if ancre == 'cou' and dz > 0 else TRONC + COU
        P = b.coupe(zones, (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
        c = centre_de(P)
        pts = [np.array([p[0], p[1], z]) for p in anneau(P, c, [direction(t) for t in thetas], [e] * m,
                                                          D['DEGAGEMENT_MIN'], au_plus_pres=True)]
        faits.append((nappe.poser(pts, [emprunter(p, porteur)[0] for p in pts]), np.array([c[0], c[1], z])))
    for (A, ca), (B, cb) in zip(faits, faits[1:]):
        nappe.bande(A, B, (ca + cb) / 2)


def creves(D, nappe, debut):
    """Les crevés des deux mancherons posés par `robe.manches` à partir du sommet `debut` (par côté, les anneaux de
    `MANCHE` de `SEGMENTS_MANCHE` sommets, puis le fond de l'épaule) : rentre les deux bords de chaque crevé aux anneaux
    intérieurs de la bande, et rend l'ensemble des triangles de la nappe qui le remplissent."""
    s, n = D['SEGMENTS_MANCHE'], len(D['MANCHE'])
    k0, k1 = D['CREVES']
    cols = [i for i in range(s) if i % D['COLONNES_DE_CREVE'] == 0]
    place = {}
    for cote in range(2):
        origine = debut + cote * (n * s + 1)
        for k in range(n):
            anneau_ = [origine + k * s + i for i in range(s)]
            for i, v in enumerate(anneau_):
                place[v] = (cote, k, i)
            if k0 < k < k1:
                centre = np.mean([nappe.sommets[v] for v in anneau_], axis=0)
                for i in cols:
                    for v in (anneau_[i], anneau_[(i + 1) % s]):
                        p = nappe.sommets[v]
                        nappe.sommets[v] = p + D['RETRAIT_DES_CREVES'] * (centre - p) / np.linalg.norm(centre - p)
    fentes = set()
    for t, tri in enumerate(nappe.triangles):
        if not all(v in place for v in tri):
            continue
        cotes, ks, iss = zip(*(place[v] for v in tri))
        if len(set(cotes)) == 1 and k0 <= min(ks) and max(ks) <= k1 and max(ks) - min(ks) == 1 and \
                any(set(iss) <= {i, (i + 1) % s} for i in cols):
            fentes.add(t)
    return fentes


def construire(D, materiaux, b):
    b.exiger(PORTEUSES)
    porteurs = {'T': b.porteur(TRONC + COU), 'g': b.porteur(['torse'] + BRAS['g']),
                'd': b.porteur(['torse'] + BRAS['d'])}
    pourpoint = Nappe()
    anneaux(D, b, pourpoint, porteurs['T'], D['CORPS'], D['SEGMENTS_CORPS'])
    debut = len(pourpoint.sommets)
    manches(D, b, pourpoint, porteurs)
    fentes = creves(D, pourpoint, debut)
    piece = piece_de(D, b, pourpoint, materiaux['pourpoint'], 'pourpoint')
    # `tissu.double_nappe` : la face extérieure du triangle t est le polygone 2t.
    piece.data.materials.append(materiaux['creves'])
    indice = len(piece.data.materials) - 1
    for t in fentes:
        piece.data.polygons[2 * t].material_index = indice
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    return piece
