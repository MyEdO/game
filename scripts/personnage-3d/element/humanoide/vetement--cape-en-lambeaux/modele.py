"""Géométrie de `humanoide--vetement--cape-en-lambeaux` (`element/tissu.py`) : une nappe pendue au col, dans le dos, au
bas déchiqueté et percée de trous.

Sous `HAUT`, colonnes en azimut autour de l'axe du filet `cape` de la base, rangs horizontaux : chaque point est au jeu
au-delà du rayon du filet au repos, jamais à moins du jeu minimal de la robe et du corps. Chaque colonne finit à la
hauteur de son lambeau ; deux colonnes voisines se cousent point à point, puis en éventail là où l'une est plus longue :
les dents sont des découpes, pas des arêtes étirées. Au-dessus, l'empiècement monte sur les épaules jusqu'au col, au
pied du cou, sous l'écharpe du capuchon. Les triangles des trous sont ôtés. Double nappe ; poids du filet
(`tissu.Filet`) sous sa charnière, empruntés au-dessus à la robe et au corps, hors des manches ; clés reprises de la
robe, celles de l'empiècement aussi du cou. Toute cote vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector

from tissu import Maillage, direction, direction_spatiale, emprunter, joindre_les_surfaces, lambeaux, lisser, porteur_de, voisinage


def au_jeu(D, surfaces, origine, d, rayon, jeu):
    """Le rayon, depuis `origine` le long de `d` et à partir de `rayon`, du premier point dont la nappe intérieure est à
    `jeu` des `surfaces`."""
    while surfaces['arbre'].find_nearest(Vector((origine + rayon * d).tolist()))[3] < jeu + D['EPAISSEUR']:
        rayon += D['PAS']
    return rayon


def bords(D):
    """Par colonne, la hauteur où elle finit : les pointes et les entailles de `tissu.lambeaux`, une toutes les
    `COLONNES_PAR_DENT` colonnes, interpolées."""
    n, pas = D['COLONNES'] + 1, D['COLONNES_PAR_DENT']
    dents = lambeaux(D['LAMBEAUX'], (n - 1) // pas + 2)
    return [D['OURLET'] + D['LAMBEAUX']['profondeur'] - float(np.interp(j / pas, range(len(dents)), dents)) for j in range(n)]


def colonnes(D, b, surfaces, filet):
    """Par colonne, ses points du col au bas, chacun avec sa clé de couture : le rang pour un point d'un rang commun,
    une fraction de rang pour le dernier."""
    e = D['EMPIECEMENT']
    O = np.array([*filet.axe, 0.0])
    C = np.array(b.tete(e['os'])) + np.asarray(e['centre'], float)
    zs = np.linspace(D['HAUT'], D['OURLET'], D['RANGS'] + 1)
    pas_z = zs[0] - zs[1]
    us = np.linspace(-1.0, 1.0, D['COLONNES'] + 1)

    def pendu(u, z):
        s = (D['HAUT'] - z) / (D['HAUT'] - D['OURLET'])
        theta = 180.0 - u * (D['DEMI_OUVERTURE'][0] + s * (D['DEMI_OUVERTURE'][1] - D['DEMI_OUVERTURE'][0]))
        d = np.array([*direction(theta), 0.0])
        A = np.array([O[0], O[1], z])
        return A + au_jeu(D, surfaces, A, d, filet.point(z, theta)[0] + D['JEU'] + D['EPAISSEUR'], D['JEU_MIN']) * d

    def pose(d, depart):
        """Le point le plus extérieur de la demi-droite (`C`, `d`), sous `depart`, au jeu de l'empiècement."""
        r = depart
        while r > 0 and surfaces['arbre'].find_nearest(Vector((C + r * d).tolist()))[3] > e['jeu'] + D['EPAISSEUR']:
            r -= D['PAS']
        if r <= 0 or r == depart:
            raise ValueError(f'cape : aucune surface sous l\'empiècement vers {tuple(d)}')
        return C + (r + D['PAS']) * d

    p = math.radians(e['polaire'])
    sortie = []
    for u, bas in zip(us, bords(D)):
        haut = pendu(u, D['HAUT'])
        col = pose(math.sin(p) * direction_spatiale(180.0 - u * e['demi_ouverture']) + np.array([0.0, 0.0, math.cos(p)]),
                   e['portee_du_col'])
        points = [(0.0, col)]
        for k in range(1, e['rangs']):
            m = col + (haut - col) * k / e['rangs']
            points.append((float(k), pose((m - C) / np.linalg.norm(m - C), float(np.linalg.norm(m - C)) + e['portee'])))
        points += [(float(e['rangs'] + i), pendu(u, z)) for i, z in enumerate(zs) if z > bas + 0.25 * pas_z]
        points.append((e['rangs'] + (D['HAUT'] - bas) / pas_z, pendu(u, bas)))
        sortie.append((u, points))
    return sortie


def construire(D, materiaux, b):
    zones = sorted(set(D['ZONES_DE_LA_ROBE']) | set(D['ZONES_DU_CORPS']))
    b.exiger(sorted(set(zones) | set(D['ZONES_DU_COL'])))
    robe = b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES_DE_LA_ROBE'])
    P, T, W = joindre_les_surfaces([robe] + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    centres = P[T].mean(axis=1)
    surfaces = porteur_de(P, T[(centres[:, 2] <= D['Z_BRAS']) | (np.abs(centres[:, 0]) <= D['X_BRAS'])], W)
    filet = b.filet('cape')
    M = Maillage()
    us, lignes = [], []
    for u, points in colonnes(D, b, surfaces, filet):
        indices = M.ajouter([q for _, q in points], 'cape')
        us += [u] * len(indices)
        lignes.append(list(zip([c for c, _ in points], indices)))

    def triangle(a, b_, c):
        centre = np.mean([M.sommets[i] for i in (a, b_, c)], axis=0)
        u = float(np.mean([us[i] for i in (a, b_, c)]))
        if not any(((u - u0) / du) ** 2 + ((centre[2] - z0) / dz) ** 2 < 1.0 for u0, z0, du, dz in D['TROUS']):
            M.triangle(a, b_, c, np.array([filet.axe[0], filet.axe[1] - 0.05, centre[2] - 0.05]))

    for A, B in zip(lignes, lignes[1:]):
        i = j = 0
        while i < len(A) - 1 or j < len(B) - 1:
            suivant_a = A[i + 1][0] if i < len(A) - 1 else math.inf
            suivant_b = B[j + 1][0] if j < len(B) - 1 else math.inf
            if suivant_a == suivant_b:
                triangle(A[i][1], B[j][1], B[j + 1][1])
                triangle(A[i][1], B[j + 1][1], A[i + 1][1])
                i, j = i + 1, j + 1
            elif suivant_a < suivant_b:
                triangle(A[i][1], B[j][1], A[i + 1][1])
                i += 1
            else:
                triangle(A[i][1], B[j][1], B[j + 1][1])
                j += 1
    X, orientes, normales = M.orienter()
    Wx = np.array([emprunter(p, surfaces)[0] for p in X])
    for a, o in D['OS_REPORTES'].items():
        Wx[:, b.indice_os[o]] += Wx[:, b.indice_os[a]]
        Wx[:, b.indice_os[a]] = 0.0
    Wx = lisser(Wx, voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    for i, p in enumerate(X):
        part = filet.part(p[2])
        Wx[i] = (1 - part) * Wx[i] + part * filet.poids(p[2], filet.azimut(p))
    piece = b.nappe('cape_en_lambeaux', X, normales, Wx, orientes, materiaux['cape'], D['EPAISSEUR'])
    publies = {D['CONTOURNE']['robe']: D['ZONES_DE_LA_ROBE']}
    b.transferer(piece, zones, masques=[([True] * len(piece.data.vertices), [], publies),
                                        ([v.co.z > D['HAUT'] for v in piece.data.vertices], D['ZONES_DU_COL'], publies)])
    return piece
