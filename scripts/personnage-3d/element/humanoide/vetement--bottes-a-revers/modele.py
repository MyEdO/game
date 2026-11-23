"""Géométrie de `humanoide--vetement--bottes-a-revers` : par pied, une nappe d'anneaux horizontaux fermés, chacun autour
du centre de sa coupe du pied et du mollet (`donnees.py`). Les anneaux du pied font le tour du pied, de la pointe au
talon, et un éventail ferme la semelle ; ceux de la tige montent sous le genou ; au pli, la même nappe se rabat et
redescend par-dehors : le revers. Poids empruntés au corps sommet par sommet puis lissés, silhouettes et clés
`gabarit_*` transférées."""
import numpy as np

from robe import Nappe, piece_de
from tente import HAUT
from tissu import anneau, centre_de, direction, emprunter, joindre


def construire(D, materiaux, b):
    b.exiger(D['PORTEUSES']['g'] + D['PORTEUSES']['d'])
    pieds = []
    for c, s in (('g', 1.0), ('d', -1.0)):
        porteur = b.porteur(D['PORTEUSES'][c])
        nappe, faits = Nappe(), []
        dirs = [direction(s * 360.0 * i / D['COLONNES']) for i in range(D['COLONNES'])]

        def poser(z, aisance, coupe_a, au_plus_pres):
            P = b.coupe(D['PORTEUSES'][c], (0.0, 0.0, coupe_a), HAUT, (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), minimum=1)
            centre = centre_de(P)
            pts = [np.array([p[0], p[1], z]) for p in anneau(P, centre, dirs, [aisance] * len(dirs), D['DEGAGEMENT_MIN'],
                                                              au_plus_pres)]
            faits.append((nappe.poser(pts, [emprunter(p, porteur)[0] for p in pts]), np.array([centre[0], centre[1], z])))

        for z, aisance in D['PIED']:
            poser(z, aisance, z, False)
        for z, aisance in D['TIGE']:
            poser(z, aisance, z, True)
        haut_de_tige = D['TIGE'][-1][0]
        poser(*D['PLI_DU_REVERS'], haut_de_tige, True)
        for z, aisance in D['REVERS']:
            poser(z, aisance, z, True)
        pli = len(D['PIED']) + len(D['TIGE'])
        for k, ((A, ca), (B, cb)) in enumerate(zip(faits, faits[1:])):
            nappe.bande(A, B, ca - 0.1 * HAUT if k + 1 == pli else (ca + cb) / 2)
        bas, centre_bas = faits[0]
        semelle = np.array([*np.mean([nappe.sommets[i] for i in bas], axis=0)[:2], D['SEMELLE']])
        milieu = nappe.poser([semelle], [emprunter(semelle, porteur)[0]])[0]
        for i in range(len(bas)):
            nappe.triangle(bas[i], bas[(i + 1) % len(bas)], milieu, centre_bas + 0.05 * HAUT)
        pieds.append(piece_de(D, b, nappe, materiaux['cuir'], f'botte_{c}'))
    piece = joindre(pieds)
    piece.name = 'bottes_a_revers'
    b.transferer(piece, D['PORTEUSES']['g'] + D['PORTEUSES']['d'], D['BORNES_DES_CLES'])
    return piece
