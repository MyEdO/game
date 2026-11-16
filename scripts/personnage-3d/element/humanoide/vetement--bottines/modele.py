"""Géométrie de `humanoide--vetement--bottines` : par pied, des anneaux horizontaux fermés, chacun autour du centre de sa
coupe du pied et de la cheville (`donnees.py`), sur l'ellipse de sa boîte ou son appui, le plus loin (`tissu.anneau`),
pour un bout rond : bas, ils font le tour du pied, de la pointe au talon ; plus haut, celui
de la cheville, et la bande qui les joint devant monte de la pointe au cou-de-pied. Un éventail ferme la semelle ; la
tige, au-dessus de `PLIS`, rentre une colonne sur deux. Poids empruntés au corps sommet par sommet puis lissés,
silhouettes et clés `gabarit_*` transférées."""
import numpy as np

from robe import Nappe, piece_de
from tissu import anneau, centre_de, direction, emprunter, joindre


def construire(D, materiaux, b):
    b.exiger(D['PORTEUSES']['g'] + D['PORTEUSES']['d'])
    pieds = []
    for c, s in (('g', 1.0), ('d', -1.0)):
        porteur = b.porteur(D['PORTEUSES'][c])
        nappe, faits = Nappe(), []
        thetas = [s * 360.0 * i / D['COLONNES'] for i in range(D['COLONNES'])]
        z_plis, pli = D['PLIS']
        for z, aisance in D['RANGEES']:
            P = b.coupe(D['PORTEUSES'][c], (0.0, 0.0, z), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
            centre = centre_de(P)
            ais = [aisance - (pli if z >= z_plis and i % 2 else 0.0) for i in range(len(thetas))]
            pts = [np.array([p[0], p[1], z]) for p in anneau(P, centre, [direction(t) for t in thetas], ais,
                                                              D['DEGAGEMENT_MIN'])]
            faits.append((nappe.poser(pts, [emprunter(p, porteur)[0] for p in pts]), np.array([centre[0], centre[1], z])))
        for (A, ca), (B, cb) in zip(faits, faits[1:]):
            nappe.bande(A, B, (ca + cb) / 2)
        bas, centre_bas = faits[0]
        semelle = np.array([*np.mean([nappe.sommets[i] for i in bas], axis=0)[:2], D['SEMELLE']])
        milieu = nappe.poser([semelle], [emprunter(semelle, porteur)[0]])[0]
        for i in range(len(bas)):
            nappe.triangle(bas[i], bas[(i + 1) % len(bas)], milieu, centre_bas + np.array([0.0, 0.0, 0.05]))
        pieds.append(piece_de(D, b, nappe, materiaux['cuir'], f'bottine_{c}'))
    piece = joindre(pieds)
    piece.name = 'bottines'
    b.transferer(piece, D['PORTEUSES']['g'] + D['PORTEUSES']['d'], D['BORNES_DES_CLES'])
    return piece
