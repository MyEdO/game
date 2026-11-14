"""Géométrie de `humanoide--accessoire--sceau-de-cire`, d'après `donnees.py` (aucun nombre ici) :

- la feuille : une grille couchée sur la bure publiée, chaque sommet visé depuis l'axe du corps le long de son azimut et
  posé sur la bure, plus le jeu ; son haut au-dessus de la corde publiée, son bas déchiré, un coin relevé ;
- la bande : trois colonnes couchées de même par-dessus la feuille, du sceau à sa queue d'aronde ;
- le sceau : un disque bombé tourné autour de la normale de la bure sous son centre, posé sur la bande, son cachet en
  creux ;
- l'emplacement `EMPLACEMENT`, offert sur la face extérieure de la corde au milieu de la feuille (`Base.offrir`).
Feuille et bande, en double nappe, prennent les poids de la bure sous chaque sommet ; le sceau, en bloc, ceux de la bure
sous son centre. Silhouettes et clés `gabarit_*` transférées de la bure publiée sous la pièce.
"""
import math

import numpy as np
from tissu import JUMEAU, Maillage, direction, emprunter, joindre, maillage_skinne, poids_normalises, porteur_de, \
    sur_le_porteur

HAUT = np.array([0.0, 0.0, 1.0])


def unitaire(x):
    return x / np.linalg.norm(x)


def construire(D, materiaux, b):
    b.exiger(D['ZONES'])
    bure, corde = (porteur_de(*b.matieres_publiees(D['CONTOURNE'][k], D['MATIERES'][k])) for k in ('bure', 'cordeliere'))
    anneau = corde['P'][np.unique(corde['T'])]
    P = np.concatenate([b.corps(z)[0] for z in D['ZONES']])
    tranche = P[np.abs(P[:, 2] - np.median(anneau[:, 2])) < D['TRANCHE_DU_CORPS']]
    centre = np.array([*(tranche[:, :2].min(axis=0) + tranche[:, :2].max(axis=0)) / 2, 0.0])
    azimuts = np.degrees(np.arctan2(anneau[:, 0] - centre[0], centre[1] - anneau[:, 1]))
    pres = anneau[np.abs(azimuts - D['AZIMUT']) < D['TRANCHE']]
    hauteur = pres[:, 2].mean()
    d0 = np.array([*direction(D['AZIMUT']), 0.0])
    rayon = np.linalg.norm(sur_le_porteur(bure, centre + HAUT * hauteur, d0, D['PORTEE'])[0][:2] - centre[:2])

    def sur_la_bure(gauche, z, ecart):
        """Le point à `ecart` de la bure, à `gauche` (m, le long de la bure vers la gauche du personnage) du milieu de la
        feuille et à la hauteur `z`, et la normale de la bure sous lui."""
        d = np.array([*direction(D['AZIMUT'] + math.degrees(gauche / rayon)), 0.0])
        p, n = sur_le_porteur(bure, centre + HAUT * z, d, D['PORTEE'])
        return p + n * ecart, n

    F, R, S, C = D['FEUILLE'], D['RUBAN'], D['SCEAU'], D['CACHET']
    pieces = []

    # Feuille : colonne i de la gauche du personnage à sa droite, rang j de haut en bas.
    M = Maillage()
    n, k = F['colonnes'], F['rangs']
    colonnes = []
    for i in range(n + 1):
        gauche = F['largeur'] / 2 - F['largeur'] * i / n
        bas = F['hauteur'] - D['DECHIRURES'][i]
        coin = max(0.0, 1 - i / (0.35 * n))
        colonnes.append(M.ajouter([sur_la_bure(gauche, hauteur + F['au_dessus'] - bas * j / k,
                                               F['jeu'] + F['epaisseur'] + D['COIN_RELEVE'] * coin * (j / k) ** 2)[0]
                                   for j in range(k + 1)], None))
    for i in range(n):
        for j in range(k):
            M.quad(colonnes[i][j], colonnes[i + 1][j], colonnes[i + 1][j + 1], colonnes[i][j + 1],
                   centre + HAUT * M.sommets[colonnes[i][j]][2])
    pieces.append((M, F['epaisseur']))

    # Bande : trois colonnes, la pointe du milieu remontée en queue d'aronde.
    M = Maillage()
    ecart = F['jeu'] + F['epaisseur'] + R['jeu'] + R['epaisseur']
    haut, long_ = hauteur - S['sous'] + S['rayon'] / 2, R['longueur'] + S['rayon'] / 2
    m = R['segments']
    rangs = []
    for j in range(m + 1):
        milieu = -S['droite'] - R['derive'] * (j / m) ** 2
        z = haut - long_ * j / m
        rangs.append(M.ajouter([sur_la_bure(milieu + c * R['largeur'] / 2, z + (R['aronde'] if j == m and c == 0 else 0.0),
                                            ecart)[0] for c in (1, 0, -1)], None))
    for j in range(m):
        for c in range(2):
            M.quad(rangs[j][c], rangs[j][c + 1], rangs[j + 1][c + 1], rangs[j + 1][c], centre + HAUT * M.sommets[rangs[j][c]][2])
    pieces.append((M, R['epaisseur']))

    objets = []
    for (M, epaisseur), nom in zip(pieces, ('feuille', 'bande')):
        X, orientes, normales = M.orienter()
        objets.append(b.nappe(nom, X, normales, [emprunter(p, bure)[0] for p in X], orientes, materiaux['parchemin'],
                              epaisseur))

    # Sceau : profil (hauteur le long de la normale, rayon), tourné autour d'elle.
    o, axe = sur_la_bure(-S['droite'], hauteur - S['sous'], ecart)
    u = unitaire(HAUT - (HAUT @ axe) * axe)
    v = np.cross(axe, u)
    e, r = S['epaisseur'], S['rayon']
    profil = [(0.0, r), (e * 0.5, r), (e, r * 0.85), (e, r * C['rayon']), (e - C['creux'], r * C['rayon'] * 0.85)]
    q = S['segments']
    sommets = [o, o + axe * (e - C['creux'])]
    for h, rr in profil:
        sommets += [o + axe * h + rr * (math.cos(2 * math.pi * t / q) * u + math.sin(2 * math.pi * t / q) * v)
                    for t in range(q)]
    anneau_de = lambda a, t: 2 + a * q + t % q
    faces = [[0, anneau_de(0, t + 1), anneau_de(0, t)] for t in range(q)]
    faces += [[anneau_de(a, t), anneau_de(a, t + 1), anneau_de(a + 1, t + 1), anneau_de(a + 1, t)]
              for a in range(len(profil) - 1) for t in range(q)]
    faces += [[1, anneau_de(len(profil) - 1, t), anneau_de(len(profil) - 1, t + 1)] for t in range(q)]
    sceau = maillage_skinne('sceau', [tuple(p) for p in sommets], faces, materiaux['cire'], b.rig,
                            poids_normalises([emprunter(o, bure)[0]] * len(sommets), b.os))
    for poly in sceau.data.polygons:
        poly.use_smooth = True
    sceau.data.set_sharp_from_angle(angle=math.radians(D['ANGLE_LISSE']))
    sceau.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    objets.append(sceau)

    dehors = pres[np.argmax(np.linalg.norm(pres[:, :2] - centre[:2], axis=1))]
    point = centre + d0 * np.linalg.norm(dehors[:2] - centre[:2]) + HAUT * hauteur
    b.offrir(D['EMPLACEMENT'], emprunter(point, bure)[0], point, (np.cross(HAUT, d0), HAUT, d0))

    piece = joindre(objets)
    piece.name = D['MANIFESTE']['cle']['piece']
    b.transferer(piece, D['ZONES'], masques=[([True] * len(piece.data.vertices), D['ZONES'],
                                              {D['CONTOURNE']['bure']: D['ZONES_DE_LA_BURE']})])
    return piece
