"""Géométrie de `humanoide--vetement--col-de-fourrure` (`element/tissu.py`) : une pèlerine fermée autour du cou, posée sur
la bure et le baudrier publiés.

Colonnes en azimut autour de l'axe vertical du cou. Le premier rang, le col, est visé horizontalement de cet axe vers le
dehors, au-dessus de la couture cou/torse, et posé au jeu du cou ; sous lui, chaque colonne suit son profil, visé du dehors
vers le `CENTRE`, sous les épaules, d'élévation en élévation (`PAS_D_ELEVATION`) de `ELEVATION_HAUT` à celle du bord de la
colonne (`BORD`), le bord en mèches (`lambeaux`, `MECHES`), et ses rangs s'y posent à abscisses curvilignes égales. Chaque visée
s'arrête au jeu de la plus extérieure des surfaces dessous (bure, baudrier, cou, torse), et la fourrure gonfle au-delà
entre le col et le bord (`GONFLEMENT`), en touffes (`TOUFFES`). Double nappe, poids empruntés au plus proche de ces surfaces puis lissés, clés
reprises de la bure et du corps. Toute cote vient de `donnees.py`.
"""
import math
import random

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from tissu import Maillage, emprunter, lambeaux, lisser, porteur_de, voisinage


def joindre_les_surfaces(morceaux):
    """Positions, triangles et poids de morceaux (positions, triangles, poids) joints."""
    decalages = np.cumsum([0] + [len(p) for p, _, _ in morceaux[:-1]])
    return (np.concatenate([p for p, _, _ in morceaux]), np.concatenate([t + k for (_, t, _), k in zip(morceaux, decalages)]),
            np.concatenate([w for _, _, w in morceaux]))


def horizontale(psi):
    """Direction horizontale de l'azimut `psi` (degrés, depuis l'avant -y vers la gauche +x)."""
    a = math.radians(psi)
    return np.array([math.sin(a), -math.cos(a), 0.0])


def selon(table, psi):
    """La valeur de `table` (`[(azimut, valeur)]`, de 0 à 180°) à l'azimut `psi`, interpolée, symétrique."""
    a, v = zip(*table)
    return float(np.interp(abs((psi + 180.0) % 360.0 - 180.0), a, v))


def construire(D, materiaux, b):
    zones_des_cles = sorted(set(D['ZONES_DE_LA_BURE']) | set(D['ZONES_DU_CORPS']))
    b.exiger(zones_des_cles)
    publies = [b.matieres_publiees(id_, D['MATIERES'][nom]) for nom, id_ in D['CONTOURNE'].items()]
    P, T, W = joindre_les_surfaces(publies + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    arbre = BVHTree.FromPolygons([tuple(p) for p in P], T.tolist(), all_triangles=True)

    def vise(depart, d, portee, pas, jeu):
        """Le point le plus extérieur de la demi-droite (`depart`, `d`), sous `portee`, au `jeu` de la nappe intérieure aux
        surfaces dessous."""
        r = portee
        while r > 0:
            if arbre.find_nearest(Vector((depart + r * d).tolist()))[3] <= jeu + D['EPAISSEUR']:
                return depart + (r + pas) * d
            r -= pas
        raise ValueError(f'col-de-fourrure : aucune surface depuis {tuple(depart)} vers {tuple(d)}')

    m = D['COLONNES']
    psis = [360.0 * j / m for j in range(m)]
    c = D['COL']
    axe = np.array(b.tete(c['os']))
    cou = b.corps('cou')[0]
    psi_cou = np.degrees(np.arctan2(cou[:, 0] - axe[0], -(cou[:, 1] - axe[1])))
    col = []
    for psi in psis:
        proches = np.abs((psi_cou - psi + 180.0) % 360.0 - 180.0) <= c['fenetre']
        O = np.array([axe[0], axe[1], cou[proches, 2].min() + c['hauteur']])
        # Du dedans du cou vers le dehors : visé du dehors, le col s'arrêtait sur l'épaule, plus haute que lui sur les côtés.
        touche = arbre.ray_cast(Vector(O.tolist()), Vector(horizontale(psi).tolist()))[0]
        if touche is None:
            raise ValueError(f'col-de-fourrure : aucun cou à l\'azimut {psi:.1f}')
        col.append(np.array(touche) + (c['jeu'] + D['EPAISSEUR']) * horizontale(psi))

    C = np.array(b.tete(D['CENTRE']['os'])) + np.array([0.0, D['CENTRE']['dy'], 0.0])
    C[2] = D['CENTRE']['z']
    meches = lambeaux(D['LAMBEAUX'], m)
    touffes = random.Random(sum(ord(x) * (i + 1) for i, x in enumerate(D['TOUFFES']['graine'])))
    colonnes = []
    for j, psi in enumerate(psis):
        # Le profil de la colonne : le col puis une visée par pas d'élévation jusqu'au bord ; les rangs s'y posent à
        # abscisses curvilignes égales (aux élévations égales, ils se serraient sur l'épaule, où le bord est proche du col).
        bas = selon(D['BORD'], psi) + meches[j] * selon(D['MECHES'], psi)
        phis = np.linspace(D['ELEVATION_HAUT'], bas, max(2, int(math.ceil((bas - D['ELEVATION_HAUT']) / D['PAS_D_ELEVATION'])) + 1))
        jeu = selon(D['JEU'], psi)
        visees = [vise(C, math.sin(math.radians(p)) * horizontale(psi) + np.array([0.0, 0.0, math.cos(math.radians(p))]),
                       D['PORTEE'], D['PAS'],
                       float(np.interp(p, [D['ELEVATION_HAUT'], D['ELEVATION_HAUT'] + selon(D['RAMPE_DU_JEU'], psi)], [c['jeu'], jeu])))
                  for p in phis]
        # Devant, les premières visées touchent le cou au-dessus du col : le profil ne garde que celles qui s'écartent de l'axe
        # du cou au-delà du col (sur l'épaule, presque à sa hauteur, une borne en hauteur les retirait presque toutes).
        rayon = lambda q: math.hypot(q[0] - axe[0], q[1] - axe[1])
        profil = np.array([col[j]] + [q for q in visees if rayon(q) > rayon(col[j])])
        s_ = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(profil, axis=0), axis=1))])
        u = np.linspace(0.0, 1.0, D['RANGS'] + 1)
        pts = np.array([[np.interp(t * s_[-1], s_, profil[:, a]) for a in range(3)] for t in u])
        # Le gonflement est horizontal, dans le plan de la colonne : le long des visées, il montait la fourrure du devant vers
        # le menton. Chaque sommet sous le col y ajoute sa touffe, tirée au hasard (graine des codes de caractères), croissante du col au bord.
        touffe = np.array([0.0] + [t * touffes.uniform(0.0, D['TOUFFES']['ampleur']) for t in u[1:]])
        colonnes.append(pts + (D['GONFLEMENT'] * np.sin(np.pi * u) + touffe)[:, None] * horizontale(psi))
    rangs = [[colonnes[j][k] for j in range(m)] for k in range(D['RANGS'] + 1)]

    M = Maillage()
    lignes = [M.ajouter(rang, 'fourrure') for rang in rangs]
    for A, B in zip(lignes, lignes[1:]):
        M.bande(A, B, C)
    X, orientes, normales = M.orienter()
    porteur = porteur_de(P, T, W)
    Wx = lisser(np.array([emprunter(p, porteur)[0] for p in X]), voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    piece = b.nappe('fourrure', X, normales, Wx, orientes, materiaux['fourrure'], D['EPAISSEUR'])
    b.transferer(piece, zones_des_cles, masques=[([True] * len(piece.data.vertices), D['ZONES_DU_CORPS'],
                                                  {D['CONTOURNE']['bure']: D['ZONES_DE_LA_BURE']})])
    return piece
