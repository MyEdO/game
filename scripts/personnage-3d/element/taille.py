"""Kit de ce qui ceint la taille sur un vêtement publié (#3867, #4351, #4394) : la cordelière sur la bure, la ceinture à
boucle sur la robe, la ceinture large sur la culotte. Le `modele.py` de la pièce bâtit ses sommets, ses faces et ses
poids autour de l'axe du corps ; le kit en fait la pièce skinnée, aux clés du vêtement qu'elle ceint. `Cuir` pose la
bande d'une ceinture de cuir sur ce vêtement et repère ce qu'elle porte.
"""
import math

import numpy as np

from tente import HAUT
from tissu import direction_spatiale, sur_le_porteur


def axe_du_corps(b, zones, hauteur):
    """Le point de l'axe vertical du corps à la `hauteur` : le centre de la boîte de la tranche des zones `zones`, à z nul."""
    P = np.concatenate([b.corps(z)[0] for z in zones])
    tranche = P[np.abs(P[:, 2] - hauteur) < 0.02]
    return np.array([(tranche[:, 0].min() + tranche[:, 0].max()) / 2, (tranche[:, 1].min() + tranche[:, 1].max()) / 2, 0.0])


def ceindre(b, nom, sommets, faces, mat, W, angle_vif, zones, publie, zones_du_publie, teintes=()):
    """La pièce skinnée `nom` (`Base.nappe_simple` : ses `faces` au matériau `mat`, la face k à celui de `teintes[k]` s'il
    n'est pas `None`, ses poids `W`, lisse hors des arêtes de plus d'`angle_vif` degrés), ses silhouettes et ses clés
    `gabarit_*` transférées des meshes des zones `zones_du_publie` de l'élément publié `publie` qu'elle ceint."""
    piece = b.nappe_simple(nom, sommets, faces, W, mat, teintes, angle_vif)
    b.transferer(piece, zones, masques=[([True] * len(sommets), zones, {publie: zones_du_publie})])
    return piece


class Cuir:
    """Le cuir d'une ceinture, bande de section rectangulaire fermée autour de la taille (`HAUTEUR`, `LARGEUR`,
    `EPAISSEUR`, `SEGMENTS` sections), chaque section posée sur le vêtement `porteur`, son bord haut et son bord bas
    chacun au `JEU` le long de son rayon ; elle ponte les creux du vêtement (`PASSES_DE_PONT`)."""

    def __init__(self, D, b, porteur):
        self.D, self.porteur = D, porteur
        self.axe = axe_du_corps(b, D['ZONES'], D['HAUTEUR'])
        self.angles = [360.0 * (i + 0.5) / D['SEGMENTS'] for i in range(D['SEGMENTS'])]
        demi = D['LARGEUR'] / 2
        self.bas, self.haut = self.rayons(D['HAUTEUR'] - demi), self.rayons(D['HAUTEUR'] + demi)
        self.devant = (self.bas[-1] + self.bas[0] + self.haut[-1] + self.haut[0]) / 4 + D['EPAISSEUR']

    def sur_le_vetement(self, z, theta):
        """Le point du vêtement à la hauteur `z` dans la direction `theta`, sa normale sortante et sa distance à l'axe."""
        o = self.axe + HAUT * z
        p, n = sur_le_porteur(self.porteur, o, direction_spatiale(theta), self.D['PORTEE'])
        return p, n, float(np.linalg.norm((p - o)[:2]))

    def rayons(self, z):
        """Par section, la distance à l'axe de l'envers du cuir à la hauteur `z` : le vêtement plus le jeu, jamais sous
        la corde des deux sections voisines."""
        s = len(self.angles)
        r = [self.sur_le_vetement(z, theta)[2] + self.D['JEU'] for theta in self.angles]
        for _ in range(self.D['PASSES_DE_PONT']):
            r = [max(r[i], (r[i - 1] + r[(i + 1) % s]) / 2) for i in range(s)]
        return r

    def sections(self):
        """Les quatre sommets de chaque section : l'envers et l'endroit du bord bas, l'endroit et l'envers du bord haut."""
        D, demi = self.D, self.D['LARGEUR'] / 2
        points = []
        for i, theta in enumerate(self.angles):
            d = direction_spatiale(theta)
            for r, dz in ((self.bas[i], -demi), (self.bas[i] + D['EPAISSEUR'], -demi), (self.haut[i] + D['EPAISSEUR'], demi),
                          (self.haut[i], demi)):
                points.append(self.axe + HAUT * (D['HAUTEUR'] + dz) + r * d)
        return points

    def azimut(self, abscisse):
        """L'angle autour de l'axe du point de la face du cuir à l'`abscisse` (m le long du cuir, depuis le milieu du
        devant vers la gauche du personnage)."""
        return math.degrees(abscisse / self.devant)

    def face(self, abscisse):
        """Le point du milieu de la face du cuir à l'`abscisse`, et son repère (le long du cuir vers la gauche du
        personnage, le haut, la sortante)."""
        s = len(self.angles)
        u = abscisse / self.devant / (2 * math.pi / s) - 0.5
        i, f = math.floor(u), u - math.floor(u)
        r = sum(((1 - f) * c[i % s] + f * c[(i + 1) % s]) / 2 for c in (self.bas, self.haut)) + self.D['EPAISSEUR']
        d = direction_spatiale(self.azimut(abscisse))
        return self.axe + HAUT * self.D['HAUTEUR'] + r * d, (np.cross(HAUT, d), HAUT, d)


def boucler(maille, sections, cotes, mat):
    """Pose sur `maille` la bande fermée des `sections` de `cotes` sommets chacune, dans le sens trigonométrique du plan
    (dehors, haut), au matériau `mat`."""
    s = len(sections) // cotes
    maille.ajouter(sections, [[cotes * i + k, cotes * ((i + 1) % s) + k, cotes * ((i + 1) % s) + (k + 1) % cotes,
                               cotes * i + (k + 1) % cotes] for i in range(s) for k in range(cotes)], mat)


def raidir(maille, poids, w):
    """Les sommets posés sur `maille` depuis le dernier poids de `poids` prennent en bloc les poids `w`."""
    poids.extend([w] * (len(maille.v) - len(poids)))
