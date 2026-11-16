"""Kit de ce qui ceint la taille sur une robe publiée (#3867, #4351) : la cordelière sur la bure, la ceinture à boucle sur
la robe. Le `modele.py` de la pièce bâtit ses sommets, ses faces et ses poids autour de l'axe du corps ; le kit en fait la
pièce skinnée, aux clés de la robe qu'elle ceint.
"""
import math

import numpy as np
from tissu import JUMEAU, maillage_skinne, poids_normalises


def axe_du_corps(b, zones, hauteur):
    """Le point de l'axe vertical du corps à la `hauteur` : le centre de la boîte de la tranche des zones `zones`, à z nul."""
    P = np.concatenate([b.corps(z)[0] for z in zones])
    tranche = P[np.abs(P[:, 2] - hauteur) < 0.02]
    return np.array([(tranche[:, 0].min() + tranche[:, 0].max()) / 2, (tranche[:, 1].min() + tranche[:, 1].max()) / 2, 0.0])


def ceindre(b, nom, sommets, faces, materiaux, matieres, W, angle_vif, zones, publie, zones_du_publie):
    """La pièce skinnée `nom` (nappe simple) : ses `faces` aux matériaux `materiaux`, celui de rang `matieres[k]` pour la
    face k, ses poids `W` par os de la base, lisse hors des arêtes de plus d'`angle_vif` degrés, ses silhouettes et ses
    clés `gabarit_*` transférées des meshes des zones `zones_du_publie` de l'élément publié `publie` qu'elle ceint."""
    piece = maillage_skinne(nom, sommets, faces, materiaux[0], b.rig, poids_normalises(W, b.os))
    for materiau in materiaux[1:]:
        piece.data.materials.append(materiau)
    for poly, rang in zip(piece.data.polygons, matieres):
        poly.material_index = rang
        poly.use_smooth = True
    piece.data.set_sharp_from_angle(angle=math.radians(angle_vif))
    piece.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    b.transferer(piece, zones, masques=[([True] * len(sommets), zones, {publie: zones_du_publie})])
    return piece
