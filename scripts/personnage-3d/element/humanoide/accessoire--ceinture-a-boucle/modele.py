"""Géométrie de `humanoide--accessoire--ceinture-a-boucle` (`element/taille.py`, `maille.py`), d'après `donnees.py`
(aucun nombre ici).

- le cuir : une bande de section rectangulaire fermée autour de la taille, chaque section posée sur la robe publiée, son
  bord haut et son bord bas chacun au plus loin de l'axe du corps le long de son rayon, plus le jeu ; elle ponte
  l'ouverture de la robe de dessus ;
- la boucle : un cadre de quatre barres au milieu du devant, et son ardillon ; deux passants, barres verticales en
  travers du cuir ; un anneau couché contre le cuir. Chacun, raide, prend en bloc les poids de la robe sous son centre ;
- l'emplacement `EMPLACEMENT`, offert sur la face du cuir (`Base.offrir`), aux poids de la robe sous lui.
Chaque section du cuir prend en bloc les poids de la robe au plus près du milieu de son envers (pris sommet par
sommet, les arêtes de son épaisseur s'étiraient au-delà de la porte, `arete-etiree` en 9 clips sur 12) ; silhouettes et
clés `gabarit_*` transférées de la robe publiée sous la ceinture.
"""
import math

import numpy as np
from anatomie import AXES_DU_PERSONNAGE
from maille import Maille, poutre, tore
from taille import axe_du_corps, ceindre
from tissu import emprunter, porteur_de, sur_le_porteur

HAUT = np.array([0.0, 0.0, 1.0])


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    robe = porteur_de(*b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES_DE_LA_ROBE']))
    axe = axe_du_corps(b, D['ZONES'], D['HAUTEUR'])
    s, demi = D['SEGMENTS'], D['LARGEUR'] / 2
    angles = [2 * math.pi * (i + 0.5) / s for i in range(s)]

    def sortante(theta):
        return np.array([math.sin(theta), -math.cos(theta), 0.0])

    def rayons(dz):
        """Par section, la distance à l'axe de l'envers du cuir à la hauteur `HAUTEUR + dz` : la robe plus le jeu,
        jamais sous la corde des deux sections voisines."""
        r = []
        for theta in angles:
            o = axe + HAUT * (D['HAUTEUR'] + dz)
            p, _ = sur_le_porteur(robe, o, sortante(theta), D['PORTEE'])
            r.append(float(np.linalg.norm((p - o)[:2])) + D['JEU'])
        for _ in range(D['PASSES_DE_PONT']):
            r = [max(r[i], (r[i - 1] + r[(i + 1) % s]) / 2) for i in range(s)]
        return r

    bas, haut = rayons(-demi), rayons(demi)
    m, poids = Maille(list(materiaux.values())), []
    cuir = []
    for i, theta in enumerate(angles):
        d = sortante(theta)
        for r, dz in ((bas[i], -demi), (bas[i] + D['EPAISSEUR'], -demi), (haut[i] + D['EPAISSEUR'], demi), (haut[i], demi)):
            cuir.append(axe + HAUT * (D['HAUTEUR'] + dz) + r * d)
        poids += [emprunter(axe + HAUT * D['HAUTEUR'] + (bas[i] + haut[i]) / 2 * d, robe)[0]] * 4
    m.ajouter(cuir, [[4 * i + k, 4 * ((i + 1) % s) + k, 4 * ((i + 1) % s) + (k + 1) % 4, 4 * i + (k + 1) % 4]
                     for i in range(s) for k in range(4)], 'cuir')
    devant = (bas[-1] + bas[0] + haut[-1] + haut[0]) / 4 + D['EPAISSEUR']

    def sur_le_cuir(abscisse):
        """Le point du milieu de la face du cuir à l'`abscisse`, et son repère (le long du cuir vers la gauche du
        personnage, le haut, la sortante)."""
        u = abscisse / devant / (2 * math.pi / s) - 0.5
        i, f = math.floor(u), u - math.floor(u)
        r = sum(((1 - f) * c[i % s] + f * c[(i + 1) % s]) / 2 for c in (bas, haut)) + D['EPAISSEUR']
        d = sortante(abscisse / devant)
        return axe + HAUT * D['HAUTEUR'] + r * d, (np.cross(HAUT, d), HAUT, d)

    def barre(c, repere, demis):
        """Une barre de laiton de centre `c`, de demi-côtés `demis` le long de `repere`."""
        (t, _, d), (demi_t, demi_z, demi_d) = repere, demis
        poutre(m, tuple(c - demi_t * t), tuple(c + demi_t * t), 2 * demi_z, 2 * demi_d, tuple(d), 'laiton')

    def raidir(centre):
        """Les sommets posés depuis le dernier appel prennent en bloc les poids de la robe sous `centre`."""
        poids.extend([emprunter(centre, robe)[0]] * (len(m.v) - len(poids)))

    B = D['BOUCLE']
    c, repere = sur_le_cuir(0.0)
    t, z, d = repere
    c = c + d * B['epaisseur'] / 2
    for cote in (-1, 1):
        barre(c + cote * (B['largeur'] - B['barre']) / 2 * t, repere, (B['barre'] / 2, B['hauteur'] / 2, B['epaisseur'] / 2))
        barre(c + cote * (B['hauteur'] - B['barre']) / 2 * z, repere,
              (B['largeur'] / 2 - B['barre'], B['barre'] / 2, B['epaisseur'] / 2))
    A = D['ARDILLON']
    barre(c + (A['longueur'] - B['largeur'] + B['barre']) / 2 * t + (B['epaisseur'] + A['section']) / 2 * d, repere,
          (A['longueur'] / 2, A['section'] / 2, A['section'] / 2))
    raidir(c)

    Q = D['PASSANTS']
    for abscisse in Q['abscisses']:
        c, repere = sur_le_cuir(abscisse)
        barre(c + repere[2] * Q['epaisseur'] / 2, repere, (Q['largeur'] / 2, demi + Q['debord'], Q['epaisseur'] / 2))
        raidir(c)

    N = D['ANNEAU']
    c, (t, z, d) = sur_le_cuir(N['abscisse'])
    tore(m, (d, t, z), c + d * N['section'], N['rayon'] - N['section'], N['section'], N['cotes'], N['facettes'], 'laiton')
    raidir(c)

    point, _ = sur_le_cuir(D['ABSCISSE_DE_L_EMPLACEMENT'])
    b.offrir(D['EMPLACEMENT'], emprunter(point, robe)[0], point, np.array(AXES_DU_PERSONNAGE).T)

    return ceindre(b, 'ceinture-a-boucle', m.v, m.f, m.materiaux, m.m, np.array(poids), D['ANGLE_VIF'], D['ZONES'],
                   D['CONTOURNE']['robe'], D['ZONES_DE_LA_ROBE'])
