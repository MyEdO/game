"""Géométrie de `humanoide--vetement--haut-de-chausses-ample` : une culotte d'anneaux horizontaux (`element/culotte.py`),
de la ceinture au bas de la blouse, sous le genou (`donnees.py`).

Le volume vient de l'aisance de chaque rangée, que les plis décalent en hauteur d'une colonne à l'autre ; les creux, en
hélice autour de la jambe, la cassent. Poids lissés, hors de la rangée du haut, qui garde ceux du corps ; silhouettes et
clés `gabarit_*` transférées.
"""
import math

from culotte import nappe_de_culotte
from robe import piece_de
from tissu import fondu, selon, table


def azimut(D, j):
    """L'azimut de la colonne `j` à la jambe gauche."""
    return 360.0 * j / D['COLONNES_JAMBE']


def aisance(D, z, j):
    """L'aisance de la colonne `j` à la hauteur `z` : celle de sa rangée, lue à la hauteur que décalent les plis, moins
    son creux, éteinte vers l'autre jambe, jamais sous celle qui passe le revers de la botte."""
    theta, plis, creux = azimut(D, j), D['PLIS'], D['CREUX']
    decalage = plis['pente'] * fondu((plis['de'] - z) / (plis['de'] - plis['a'])) * math.cos(math.radians(theta - plis['azimut']))
    rentre = table(creux['profondeur'], z) * max(0.0, math.cos(math.radians(creux['lobes'] * theta + creux['vrille'] * z))) ** 2
    bas = fondu((D['GENOU'][0] - z) / (D['GENOU'][0] - D['GENOU'][1]))
    part = (1 - bas) * selon(D['VERS_L_ENTREJAMBE'], theta - 90.0) + bas * selon(D['VERS_L_AUTRE_MOLLET'], theta - 90.0)
    return max((table(D['AISANCE'], z + decalage) - rentre) * part, table(D['SUR_LE_REVERS'], z))


def aisances(D, z, js):
    return [aisance(D, z, j) for j in js]


def construire(D, materiaux, b):
    nappe, _ = nappe_de_culotte(D, b, azimut, aisances, haut_fixe=True)
    piece = piece_de(D, b, nappe, materiaux['toile'], 'haut_de_chausses_ample')
    b.transferer(piece, D['PORTEUSES'], D['BORNES_DES_CLES'])
    return piece
