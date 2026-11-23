"""Géométrie de `humanoide--accessoire--baudrier-sur-torse-nu` (`element/taille.py`, `maille.py`), d'après `donnees.py`
(aucun nombre ici).

- la sangle : un cuir de section rectangulaire fermé autour du torse nu, dans le plan oblique de l'épaule gauche au
  flanc droit ; chaque section posée sur la peau, au plus loin de ses deux bords et de son milieu, plus le jeu ; chaque
  bord prend les poids de la peau sous lui ;
- la boucle : un cadre de quatre barres et son ardillon, à plat sur le brin de devant, aux poids de la section qui le
  porte.
Silhouettes et clés `gabarit_*` transférées du torse."""
import math

import numpy as np
from maille import Maille, poutre
from taille import boucler, raidir
from tissu import centre_de, emprunter, unitaire, viser


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    peau = b.porteur(D['ZONES'])
    P = peau['P']
    y = (P[:, 1].min() + P[:, 1].max()) / 2
    epaule, flanc = (np.array([x, y, z]) for x, z in (D['EPAULE'], D['FLANC']))
    e1 = unitaire(flanc - epaule)
    e2 = np.array([0.0, -1.0, 0.0])
    n = np.cross(e1, e2)
    demi = D['LARGEUR'] / 2
    centre = centre_de(b.coupe(D['ZONES'], epaule, n, e1, e2))
    origine = epaule + centre[0] * e1 + centre[1] * e2
    s = D['SEGMENTS']
    dirs = [math.cos(a) * e1 + math.sin(a) * e2 for a in (2 * math.pi * (i + 0.5) / s for i in range(s))]

    def sur_la_peau(d):
        """La distance au centre de la peau la plus extérieure le long de `d`, sur les deux bords et le milieu de la
        sangle."""
        touches = [viser(peau, origine + k * demi * n, d, D['PORTEE']) for k in (-1, 0, 1)]
        distances = [D['PORTEE'] - t[3] for t in touches if t[0] is not None]
        if not distances:
            raise ValueError(f'baudrier : aucune peau le long de {tuple(d)}')
        return max(distances)

    r = [sur_la_peau(d) + D['JEU'] for d in dirs]
    for _ in range(D['PASSES_DE_PONT']):
        r = [max(r[i], (r[i - 1] + r[(i + 1) % s]) / 2) for i in range(s)]

    m = Maille(list(materiaux.values()))
    sections, poids = [], []
    for ri, d in zip(r, dirs):
        for rayon, k in ((ri, -1), (ri + D['EPAISSEUR'], -1), (ri + D['EPAISSEUR'], 1), (ri, 1)):
            sections.append(origine + k * demi * n + rayon * d)
        bords = [emprunter(origine + k * demi * n + ri * d, peau)[0] for k in (-1, 1)]
        poids += [bords[0], bords[0], bords[1], bords[1]]
    boucler(m, sections, 4, 'cuir')

    # La boucle : sur la section de devant la plus proche de `BOUCLE_Z`.
    B = D['BOUCLE']
    milieux = [origine + (ri + D['EPAISSEUR']) * d for ri, d in zip(r, dirs)]
    i = min((i for i in range(s) if dirs[i] @ e2 > 0), key=lambda i: abs(milieux[i][2] - D['BOUCLE_Z']))
    le_long = unitaire(milieux[(i + 1) % s] - milieux[i - 1])
    sortante = np.cross(le_long, n)
    sortante = sortante if sortante @ dirs[i] > 0 else -sortante
    c = milieux[i] + sortante * B['epaisseur'] / 2
    for cote in (-1, 1):
        for milieu, demi_long in ((cote * (B['largeur'] - B['barre']) / 2 * n, B['longueur'] / 2 * le_long),
                                  (cote * (B['longueur'] - B['barre']) / 2 * le_long, (B['largeur'] / 2 - B['barre']) * n)):
            poutre(m, tuple(c + milieu - demi_long), tuple(c + milieu + demi_long), B['barre'], B['epaisseur'],
                   tuple(sortante), 'boucle')
    poutre(m, tuple(c - B['longueur'] / 2 * le_long + sortante * B['epaisseur'] / 2),
           tuple(c + B['longueur'] / 2 * le_long + sortante * B['epaisseur'] / 2), B['ardillon'], B['epaisseur'] / 2,
           tuple(sortante), 'boucle')
    raidir(m, poids, (poids[4 * i] + poids[4 * i + 2]) / 2)

    cuir = materiaux['cuir']
    teintes = [None if m.materiaux[rang] is cuir else m.materiaux[rang] for rang in m.m]
    piece = b.nappe_simple('baudrier-sur-torse-nu', m.v, m.f, np.array(poids), cuir, teintes, D['ANGLE_VIF'])
    b.transferer(piece, D['ZONES'])
    return piece
