"""Kit de ce qui ceint la taille sur une robe publiée (#3867, #4351) : la cordelière sur la bure, la ceinture à boucle sur
la robe. Le `modele.py` de la pièce bâtit ses sommets, ses faces et ses poids autour de l'axe du corps ; le kit en fait la
pièce skinnée, aux clés de la robe qu'elle ceint.
"""
import math

import numpy as np


def axe_du_corps(b, zones, hauteur):
    """Le point de l'axe vertical du corps à la `hauteur` : le centre de la boîte de la tranche des zones `zones`, à z nul."""
    P = np.concatenate([b.corps(z)[0] for z in zones])
    tranche = P[np.abs(P[:, 2] - hauteur) < 0.02]
    return np.array([(tranche[:, 0].min() + tranche[:, 0].max()) / 2, (tranche[:, 1].min() + tranche[:, 1].max()) / 2, 0.0])


def sortante(theta):
    """La direction horizontale qui sort de l'axe du corps à l'angle `theta` (radians, depuis l'avant -Y vers la gauche
    +X)."""
    return np.array([math.sin(theta), -math.cos(theta), 0.0])


def ceindre(b, nom, sommets, faces, mat, teintes, W, angle_vif, zones, publie, zones_du_publie):
    """La pièce skinnée `nom` (`Base.nappe_simple` : ses `faces` au matériau `mat`, la face k à celui de `teintes[k]` s'il
    n'est pas `None`, ses poids `W`, lisse hors des arêtes de plus d'`angle_vif` degrés), ses silhouettes et ses clés
    `gabarit_*` transférées des meshes des zones `zones_du_publie` de l'élément publié `publie` qu'elle ceint."""
    piece = b.nappe_simple(nom, sommets, faces, W, mat, teintes, angle_vif)
    b.transferer(piece, zones, masques=[([True] * len(sommets), zones, {publie: zones_du_publie})])
    return piece
