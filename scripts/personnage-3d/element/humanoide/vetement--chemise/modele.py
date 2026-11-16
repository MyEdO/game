"""Géométrie de `humanoide--vetement--chemise` : un corps ajusté d'anneaux horizontaux fermés, du bas du torse au cou,
un col droit sur le cou (surface `col`, ses clés prises du cou seul), et les manches du kit des robes (`robe.manches`), bouffantes sur l'avant-bras
et froncées au poignet ; poids empruntés au corps, sommet par sommet, silhouettes et clés `gabarit_*` transférées."""
import numpy as np

from robe import BRAS, COU, TRONC, Nappe, manches, piece_de
from tissu import anneau, centre_de, direction, emprunter, joindre

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


def construire(D, materiaux, b):
    b.exiger(PORTEUSES)
    porteurs = {'T': b.porteur(TRONC + COU), 'g': b.porteur(['torse'] + BRAS['g']),
                'd': b.porteur(['torse'] + BRAS['d'])}
    chemise, nappe_du_col = Nappe(), Nappe()
    anneaux(D, b, chemise, porteurs['T'], D['CORPS'], D['SEGMENTS_CORPS'])
    manches(D, b, chemise, porteurs)
    anneaux(D, b, nappe_du_col, porteurs['T'], D['COL'], D['SEGMENTS_COL'])
    piece = piece_de(D, b, chemise, materiaux['chemise'], 'chemise')
    b.transferer(piece, PORTEUSES, D['BORNES_DES_CLES'])
    col = piece_de(D, b, nappe_du_col, materiaux['col'], 'col')
    b.transferer(col, D['ZONES_DU_COL'], D['BORNES_DES_CLES'])
    return joindre([piece, col])
