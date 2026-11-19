"""Géométrie de `humanoide--vetement--chemise` : un corps ajusté d'anneaux horizontaux fermés (`robe.anneaux`), du bas du torse au cou,
un col droit sur le cou (surface `col`, ses clés prises du cou seul), et les manches du kit des robes (`robe.manches`), bouffantes sur l'avant-bras
et froncées au poignet ; poids empruntés au corps, sommet par sommet, silhouettes et clés `gabarit_*` transférées."""
from robe import BRAS, COU, TRONC, Nappe, anneaux, manches, piece_de
from tissu import joindre

PORTEUSES = TRONC + COU + BRAS['g'] + BRAS['d']


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
