"""Géométrie de `humanoide--vetement--bas-de-chausses` : par jambe, un tube d'anneaux horizontaux fermés, ajustés sur la
coupe de la jambe, du haut sous la culotte à la cheville dans la bottine (`donnees.py`) ; poids empruntés au corps sommet
par sommet puis lissés, silhouettes et clés `gabarit_*` transférées."""
import numpy as np

from robe import Nappe, piece_de
from tissu import anneau, centre_de, direction, emprunter, joindre


def construire(D, materiaux, b):
    b.exiger(D['PORTEUSES']['g'] + D['PORTEUSES']['d'])
    jambes = []
    for c, s in (('g', 1.0), ('d', -1.0)):
        porteur = b.porteur(D['PORTEUSES'][c])
        nappe, faits = Nappe(), []
        thetas = [s * 360.0 * i / D['COLONNES'] for i in range(D['COLONNES'])]
        for z in D['RANGEES']:
            P = b.coupe(D['PORTEUSES'][c], (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
            centre = centre_de(P)
            pts = [np.array([p[0], p[1], z]) for p in anneau(P, centre, [direction(t) for t in thetas],
                                                              [D['AISANCE']] * len(thetas), D['DEGAGEMENT_MIN'],
                                                              au_plus_pres=True)]
            faits.append((nappe.poser(pts, [emprunter(p, porteur)[0] for p in pts]), np.array([centre[0], centre[1], z])))
        for (A, ca), (B, cb) in zip(faits, faits[1:]):
            nappe.bande(A, B, (ca + cb) / 2)
        jambes.append(piece_de(D, b, nappe, materiaux['bas'], f'bas_{c}'))
    piece = joindre(jambes)
    piece.name = 'bas'
    b.transferer(piece, D['PORTEUSES']['g'] + D['PORTEUSES']['d'], D['BORNES_DES_CLES'])
    return piece
