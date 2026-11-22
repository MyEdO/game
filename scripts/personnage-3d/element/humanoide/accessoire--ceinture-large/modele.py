"""Géométrie de `humanoide--accessoire--ceinture-large` (`element/taille.py`, `maille.py`), d'après `donnees.py` (aucun
nombre ici).

- la bande : un cuir de section rectangulaire fermé autour de la taille, chaque section posée sur la culotte publiée,
  son bord haut et son bord bas chacun au jeu le long de son rayon ;
- le bourrelet : un boudin fermé, posé sur le bord haut de la bande ;
- la boucle, un cadre de quatre barres au milieu du devant ; les disques et le triangle, plaques sur la face de la
  bande ; le soleil, une plaque en étoile et sa bosse, sur la culotte sous la bande. Chacun, raide, prend en bloc les
  poids du cuir qui le porte ;
- la languette : une bande de toile mince qui pend de la bande sur la culotte, son premier rang aux poids du cuir,
  chaque autre à ceux de la culotte sous lui ;
- l'emplacement `EMPLACEMENT`, offert sur la face de la bande (`Base.offrir_sur`), aux poids de la culotte sous lui.
Chaque section du cuir, bande et bourrelet, prend en bloc les poids de la culotte sous le bourrelet, ceux du corps à la
taille : aux poids de la culotte sous son milieu, la bande s'écartait du bourrelet et du dos, assis et accroupi (rendu,
Sitting_Idle_Loop, Crouch_Idle_Loop). Silhouettes et clés `gabarit_*` transférées de la culotte publiée sous la ceinture.
"""
import math

import numpy as np
from maille import Maille, poutre
from taille import HAUT, Cuir, boucler, ceindre, raidir
from tissu import direction_spatiale, emprunter, porteur_de, unitaire


def polygone(rayon, cotes):
    """Le contour régulier de `cotes` côtés, une pointe en haut."""
    return [(-rayon * math.sin(2 * math.pi * k / cotes), rayon * math.cos(2 * math.pi * k / cotes)) for k in range(cotes)]


def prisme(m, contour, c, repere, epaisseur, mat):
    """La plaque de `contour` (sens trigonométrique vu du dehors, dans le plan des deux premiers axes de `repere`, étoilé
    autour de son origine) posée en `c`, épaisse d'`epaisseur` le long du troisième : sa face, en éventail, et ses
    chants."""
    t, z, d = repere
    n = len(contour)
    bas = [c + x * t + y * z for x, y in contour]
    m.ajouter(bas + [p + epaisseur * d for p in bas] + [c + epaisseur * d],
              [[n + i, n + (i + 1) % n, 2 * n] for i in range(n)]
              + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)], mat)


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    culotte = porteur_de(*b.matieres_publiees(D['CONTOURNE']['culotte'], D['MATIERES_DE_LA_CULOTTE']))
    cuir = Cuir(D, b, culotte)
    demi, R = D['LARGEUR'] / 2, D['BOURRELET']
    sous_le_bourrelet = cuir.rayons(R['hauteur'])
    m = Maille(list(materiaux.values()))

    def a_la_taille(theta):
        """Les poids de la culotte sous le bourrelet, dans la direction `theta`."""
        return emprunter(cuir.sur_le_vetement(R['hauteur'], theta)[0], culotte)[0]

    def raidir_a(abscisse):
        """Les sommets posés depuis le dernier appel prennent en bloc les poids du cuir à l'`abscisse`."""
        raidir(m, poids, a_la_taille(cuir.azimut(abscisse)))

    sections = [a_la_taille(theta) for theta in cuir.angles]
    boudin = []
    for i, theta in enumerate(cuir.angles):
        d = direction_spatiale(theta)
        centre = cuir.axe + HAUT * R['hauteur'] + (max(sous_le_bourrelet[i], cuir.haut[i]) + R['rayon'] - R['rentre']) * d
        for k in range(R['cotes']):
            a = 2 * math.pi * k / R['cotes']
            boudin.append(centre + R['rayon'] * (math.cos(a) * d + math.sin(a) * HAUT))
    boucler(m, cuir.sections(), 4, 'cuir')
    boucler(m, boudin, R['cotes'], 'cuir')
    poids = [w for w in sections for _ in range(4)] + [w for w in sections for _ in range(R['cotes'])]

    B = D['BOUCLE']
    c, repere = cuir.face(0.0)
    t, z, d = repere
    c = c + d * B['epaisseur'] / 2
    for cote in (-1, 1):
        for milieu, demi_long, large in ((cote * (B['largeur'] - B['barre']) / 2 * t, B['hauteur'] / 2 * z, B['barre']),
                                         (cote * (B['hauteur'] - B['barre']) / 2 * z, (B['largeur'] / 2 - B['barre']) * t, B['barre'])):
            poutre(m, tuple(c + milieu - demi_long), tuple(c + milieu + demi_long), large, B['epaisseur'], tuple(d), 'metal')
    raidir_a(0.0)

    Q = D['DISQUES']
    for abscisse in Q['abscisses']:
        c, repere = cuir.face(abscisse)
        prisme(m, polygone(Q['rayon'], Q['cotes']), c, repere, Q['epaisseur'], 'metal')
        raidir_a(abscisse)

    T = D['TRIANGLE']
    c, repere = cuir.face(T['abscisse'])
    prisme(m, polygone(T['cote'] / math.sqrt(3), 3), c, repere, T['epaisseur'], 'metal')
    raidir_a(T['abscisse'])

    S = D['SOLEIL']
    p, n, _ = cuir.sur_le_vetement(D['HAUTEUR'] - demi - S['sous_la_bande'], cuir.azimut(S['abscisse']))
    t = unitaire(np.cross(HAUT, n))
    repere = (t, np.cross(n, t), n)
    c = p + (D['JEU'] + D['EPAISSEUR'] + S['saillie']) * n
    etoile = [(-r * math.sin(math.pi * k / S['rayons']), r * math.cos(math.pi * k / S['rayons']))
              for k in range(2 * S['rayons']) for r in [S['pointe'] if k % 2 == 0 else S['rayon']]]
    prisme(m, etoile, c, repere, S['epaisseur'], 'metal')
    prisme(m, polygone(S['bosse'], S['rayons']), c + S['epaisseur'] * n, repere, S['saillie'], 'metal')
    raidir_a(S['abscisse'])

    L = D['LANGUETTE']
    theta = cuir.azimut(L['abscisse'])
    c, (t, _, d) = cuir.face(L['abscisse'])
    rangs = [(c + D['JEU'] * d, d, a_la_taille(theta))]
    for z in L['rangs'][1:]:
        p, n, _ = cuir.sur_le_vetement(z, theta)
        rangs.append((p + (D['JEU'] + L['epaisseur']) * n, n, emprunter(p, culotte)[0]))
    dernier = len(rangs) - 1
    toile, faces = [], []
    for k, (p, n, w) in enumerate(rangs):
        for j in (-1, 0, 1):
            q = p + j * L['demi_largeur'] * t + (L['fourche'] * HAUT if k == dernier and j == 0 else 0.0)
            toile += [q, q - L['epaisseur'] * n]
        poids += [w] * 6
        # Par rang, six sommets : l'endroit puis l'envers de la droite, du milieu et de la gauche.
        a, e = 6 * (k - 1), 6 * k
        if k == 1:
            faces += [[a + 2 * j, a + 2 * j + 2, a + 2 * j + 3, a + 2 * j + 1] for j in (0, 1)]
        if k:
            for j in (0, 1):
                faces += [[e + 2 * j, e + 2 * j + 2, a + 2 * j + 2, a + 2 * j],
                          [a + 2 * j + 1, a + 2 * j + 3, e + 2 * j + 3, e + 2 * j + 1]]
            faces += [[a, a + 1, e + 1, e], [a + 4, e + 4, e + 5, a + 5]]
        if k == dernier:
            faces += [[e + 2 * j, e + 2 * j + 1, e + 2 * j + 3, e + 2 * j + 2] for j in (0, 1)]
    m.ajouter(toile, faces, 'tissu')

    point, _ = cuir.face(D['ABSCISSE_DE_L_EMPLACEMENT'])
    b.offrir_sur(D['EMPLACEMENT'], point, culotte)

    mat = materiaux['cuir']
    teintes = [None if m.materiaux[rang] is mat else m.materiaux[rang] for rang in m.m]
    return ceindre(b, 'ceinture-large', m.v, m.f, mat, np.array(poids), D['ANGLE_VIF'], D['ZONES'],
                   D['CONTOURNE']['culotte'], D['ZONES_DE_LA_CULOTTE'], teintes)
