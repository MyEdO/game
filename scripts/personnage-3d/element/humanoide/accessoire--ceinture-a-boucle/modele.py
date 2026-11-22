"""Géométrie de `humanoide--accessoire--ceinture-a-boucle` (`element/taille.py`, `maille.py`), d'après `donnees.py`
(aucun nombre ici).

- le cuir : une bande de section rectangulaire fermée autour de la taille, chaque section posée sur la robe publiée, son
  bord haut et son bord bas chacun au plus loin de l'axe du corps le long de son rayon, plus le jeu ; elle ponte
  l'ouverture de la robe de dessus ;
- la boucle : un cadre de quatre barres au milieu du devant, et son ardillon ; deux passants, barres verticales en
  travers du cuir ; un anneau couché contre le cuir. Chacun, raide, prend en bloc les poids de la robe sous son centre ;
- l'emplacement `EMPLACEMENT`, offert sur la face du cuir (`Base.offrir_sur`), aux poids de la robe sous lui.
Chaque section du cuir prend en bloc les poids de la robe au plus près du milieu de son envers (pris sommet par
sommet, les arêtes de son épaisseur s'étiraient au-delà de la porte, `arete-etiree` en 9 clips sur 12) ; silhouettes et
clés `gabarit_*` transférées de la robe publiée sous la ceinture.
"""
import numpy as np
from maille import Maille, poutre, tore
from taille import HAUT, Cuir, boucler, ceindre, raidir
from tissu import direction_spatiale, emprunter, porteur_de


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    robe = porteur_de(*b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES_DE_LA_ROBE']))
    cuir = Cuir(D, b, robe)
    demi = D['LARGEUR'] / 2
    m, poids = Maille(list(materiaux.values())), []
    boucler(m, cuir.sections(), 4, 'cuir')
    for i, theta in enumerate(cuir.angles):
        milieu = cuir.axe + HAUT * D['HAUTEUR'] + (cuir.bas[i] + cuir.haut[i]) / 2 * direction_spatiale(theta)
        poids += [emprunter(milieu, robe)[0]] * 4

    def barre(c, repere, demis):
        """Une barre de laiton de centre `c`, de demi-côtés `demis` le long de `repere`."""
        (t, _, d), (demi_t, demi_z, demi_d) = repere, demis
        poutre(m, tuple(c - demi_t * t), tuple(c + demi_t * t), 2 * demi_z, 2 * demi_d, tuple(d), 'laiton')

    def sous(centre):
        """Les poids de la robe sous `centre`."""
        return emprunter(centre, robe)[0]

    B = D['BOUCLE']
    c, repere = cuir.face(0.0)
    t, z, d = repere
    c = c + d * B['epaisseur'] / 2
    for cote in (-1, 1):
        barre(c + cote * (B['largeur'] - B['barre']) / 2 * t, repere, (B['barre'] / 2, B['hauteur'] / 2, B['epaisseur'] / 2))
        barre(c + cote * (B['hauteur'] - B['barre']) / 2 * z, repere,
              (B['largeur'] / 2 - B['barre'], B['barre'] / 2, B['epaisseur'] / 2))
    A = D['ARDILLON']
    barre(c + (A['longueur'] - B['largeur'] + B['barre']) / 2 * t + (B['epaisseur'] + A['section']) / 2 * d, repere,
          (A['longueur'] / 2, A['section'] / 2, A['section'] / 2))
    raidir(m, poids, sous(c))

    Q = D['PASSANTS']
    for abscisse in Q['abscisses']:
        c, repere = cuir.face(abscisse)
        barre(c + repere[2] * Q['epaisseur'] / 2, repere, (Q['largeur'] / 2, demi + Q['debord'], Q['epaisseur'] / 2))
        raidir(m, poids, sous(c))

    N = D['ANNEAU']
    c, (t, z, d) = cuir.face(N['abscisse'])
    tore(m, (d, t, z), c + d * N['section'], N['rayon'] - N['section'], N['section'], N['cotes'], N['facettes'], 'laiton')
    raidir(m, poids, sous(c))

    point, _ = cuir.face(D['ABSCISSE_DE_L_EMPLACEMENT'])
    b.offrir_sur(D['EMPLACEMENT'], point, robe)

    mat = materiaux['cuir']
    teintes = [None if m.materiaux[rang] is mat else m.materiaux[rang] for rang in m.m]
    return ceindre(b, 'ceinture-a-boucle', m.v, m.f, mat, np.array(poids), D['ANGLE_VIF'], D['ZONES'],
                   D['CONTOURNE']['robe'], D['ZONES_DE_LA_ROBE'], teintes)
