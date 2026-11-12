"""Géométrie de `humanoide--vetement--cape` (`element/tissu.py`) : une nappe pendue au col, dans le dos.

Sous `HAUT`, colonnes en azimut autour de l'axe du filet `cape` de la base, rangs horizontaux jusqu'à l'ourlet : chaque
colonne suit, dans son demi-plan vertical, le filet au repos, jamais en deçà de l'enveloppe concave du profil de la robe
et du corps (le rayon de l'enveloppe convexe de chaque coupe horizontale, d'un appui à l'autre en ligne droite, sans
épouser les creux du dos), au jeu au-delà ; l'ourlet tombe en lambeaux. Au-dessus, l'empiècement monte sur les épaules jusqu'au col, sous l'écharpe de la capuche : le col, qui tourne
devant les épaules, suit la couture du cou et du torse, au jeu de la plus extérieure des surfaces (robe, bandoulière, torse,
cou) ; entre lui et `HAUT`, chaque point, sur la droite du col au point de `HAUT` de sa colonne, est visé du dehors vers un
axe transversal sous les épaules et s'arrête au jeu. Double nappe ; poids du filet (`tissu.Filet`) sous sa charnière,
empruntés au-dessus au plus proche des éléments publiés sous elle (robe, bandoulière), hors des manches ; clés empruntées
aux mêmes, celles de l'empiècement aussi au cou. Toute cote vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from tissu import Maillage, direction, emprunter, enveloppe_convexe, lambeaux, lisser, porteur_de, rayon_a_l_enveloppe, voisinage


def joindre_les_surfaces(morceaux):
    """Positions, triangles et poids de morceaux (positions, triangles, poids) joints."""
    decalages = np.cumsum([0] + [len(p) for p, _, _ in morceaux[:-1]])
    return (np.concatenate([p for p, _, _ in morceaux]), np.concatenate([t + k for (_, t, _), k in zip(morceaux, decalages)]),
            np.concatenate([w for _, _, w in morceaux]))


def aretes(T):
    a = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
    return np.unique(np.sort(a, axis=1), axis=0)


def coupe(P, A, z):
    """Points (x, y) où les arêtes `A` de la surface `P` traversent le plan horizontal de hauteur `z`."""
    sa, sb = P[A[:, 0], 2] - z, P[A[:, 1], 2] - z
    m = sa * sb < 0
    t = (sa[m] / (sa[m] - sb[m]))[:, None]
    return (P[A[m, 0]] + t * (P[A[m, 1]] - P[A[m, 0]]))[:, :2]


def majorant(z, r):
    """L'enveloppe concave des points (z, r) : la plus petite fonction concave de z au-dessus d'eux, rendue par ses
    sommets dans l'ordre des z croissants."""
    h = []
    for p in sorted(zip(z, r)):
        while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) >= 0:
            h.pop()
        h.append(p)
    return np.array(h)


def azimuts(D, z):
    """Les azimuts (`tissu.direction`) des colonnes à la hauteur `z`, la demi-ouverture de part et d'autre du dos menée
    de `HAUT` à l'ourlet."""
    s = min(1.0, max(0.0, (D['HAUT'] - z) / (D['HAUT'] - D['OURLET'])))
    haut, bas = D['DEMI_OUVERTURE']
    return 180.0 - np.linspace(-1.0, 1.0, D['COLONNES'] + 1) * (haut + s * (bas - haut))


def profils(D, P, A, filet):
    """Par colonne, le rayon de la nappe extérieure à chaque rang, au jeu et à l'épaisseur au-delà du filet `filet` et de
    l'enveloppe concave, de haut en bas, du rayon de l'enveloppe convexe de chaque coupe, lissée entre colonnes voisines
    sans passer sous elle ; les plis s'y ajoutent."""
    O = filet.axe
    zs = np.arange(D['HAUT'], D['OURLET'] - 1e-9, -D['PAS_DU_PROFIL'])
    if zs[-1] > D['OURLET'] + 1e-9:
        zs = np.append(zs, D['OURLET'])
    r = np.zeros((len(zs), D['COLONNES'] + 1))
    for k, z in enumerate(zs):
        Q = coupe(P, A, z)
        if z > D['Z_BRAS']:
            Q = Q[np.abs(Q[:, 0]) <= D['X_BRAS']]
        if len(Q) < 3:
            raise ValueError(f'cape : coupe vide à z = {z:.3f}')
        H = enveloppe_convexe(Q)
        r[k] = [rayon_a_l_enveloppe(H, O, direction(phi)) for phi in azimuts(D, z)]
    rangs = np.linspace(D['HAUT'], D['OURLET'], D['RANGS'] + 1)
    plancher = np.array([[np.interp(z, *majorant(zs, r[:, j]).T) for j in range(r.shape[1])] for z in rangs])
    lisse = plancher.copy()
    for _ in range(D['PASSES_DE_LISSAGE']):
        lisse[:, 1:-1] = np.maximum(0.25 * lisse[:, :-2] + 0.5 * lisse[:, 1:-1] + 0.25 * lisse[:, 2:], plancher[:, 1:-1])
    u = np.linspace(0.0, 1.0, D['COLONNES'] + 1)
    s = (D['HAUT'] - rangs) / (D['HAUT'] - D['OURLET'])
    plis = D['PLIS']['ampleur'] * np.outer(s, 0.5 * (1.0 - np.cos(2 * math.pi * D['PLIS']['nombre'] * u)))
    sur_le_filet = np.array([[filet.point(z, theta)[0] for theta in azimuts(D, z)] for z in rangs])
    return rangs, np.maximum(lisse, sur_le_filet) + D['JEU'] + D['EPAISSEUR'] + plis


def sans_les_bras(D, P, T):
    """Les triangles `T` hors des bras et des manches : au-dessus de `Z_BRAS`, ceux dont le centre est à |x| <= `X_BRAS`."""
    centres = P[T].mean(axis=1)
    return T[(centres[:, 2] <= D['Z_BRAS']) | (np.abs(centres[:, 0]) <= D['X_BRAS'])]


def empiecement(D, b, morceaux, bas):
    """Les rangs de l'empiècement, du col au rang au-dessus de `bas` (le rang de `HAUT`), sur les surfaces `morceaux`,
    le col aussi sur les zones `ZONES_DU_COL`."""
    e = D['EMPIECEMENT']

    def arbre_de(morceaux_):
        P, T, _ = joindre_les_surfaces(morceaux_)
        return BVHTree.FromPolygons([tuple(p) for p in P], sans_les_bras(D, P, T).tolist(), all_triangles=True)

    arbres = {'col': arbre_de(morceaux + [b.corps(z) for z in D['ZONES_DU_COL']]), 'rangs': arbre_de(morceaux)}

    def vise(depart, d, portee, jeu, arbre):
        """Le point le plus extérieur de la demi-droite (`depart`, `d`), sous `portee`, au jeu des surfaces de `arbre`."""
        r = portee
        while r > 0:
            if arbres[arbre].find_nearest(Vector((depart + r * d).tolist()))[3] <= jeu:
                return depart + (r + e['pas']) * d
            r -= e['pas']
        return None

    cou = b.corps('cou')[0]
    axe = np.array(b.tete(e['os_du_col']))
    psi_cou = np.degrees(np.arctan2(cou[:, 0] - axe[0], cou[:, 1] - axe[1]))
    col = []
    for u in np.linspace(-1.0, 1.0, len(bas)):
        psi = e['demi_ouverture'] * u
        proches = np.abs((psi_cou - psi + 180.0) % 360.0 - 180.0) <= e['fenetre']
        O = np.array([axe[0], axe[1], cou[proches, 2].min()])
        d = np.array([math.sin(math.radians(psi)), math.cos(math.radians(psi)), 0.0])
        q = vise(O, d, e['portee_du_col'], e['jeu_du_col'] + D['EPAISSEUR'], 'col')
        if q is None:
            raise ValueError(f'cape : aucune surface sous le col, azimut {psi:.1f}')
        col.append(q)
    col = np.array(col)
    rayon = np.hypot(col[:, 0] - axe[0], col[:, 1] - axe[1])
    plancher, dirs, z = rayon.copy(), (col[:, :2] - axe[:2]) / rayon[:, None], col[:, 2].copy()
    for _ in range(e['passes_du_col']):
        rayon[1:-1] = np.maximum(0.25 * rayon[:-2] + 0.5 * rayon[1:-1] + 0.25 * rayon[2:], plancher[1:-1])
        z[1:-1] = 0.25 * z[:-2] + 0.5 * z[1:-1] + 0.25 * z[2:]
    col = [np.array([*(axe[:2] + r * d), h]) for r, d, h in zip(rayon, dirs, z)]
    y0, z0 = np.array(b.tete(e['os']))[1:] + np.asarray(e['centre'])
    rangs = [col]
    for k in range(1, e['rangs']):
        t = k / e['rangs']
        jeu = e['jeu_du_col'] + t * (D['JEU'] - e['jeu_du_col']) + D['EPAISSEUR']
        rang = []
        for q, p in zip(col, bas):
            m = (1 - t) * q + t * p
            c = np.array([m[0], y0, z0])
            d = (m - c) / np.linalg.norm(m - c)
            rang.append(vise(c, d, np.linalg.norm(m - c) + e['portee'], jeu, 'rangs'))
        if any(p is None for p in rang):
            raise ValueError(f'cape : aucune surface sous le rang {k} de l\'empiècement')
        rangs.append(rang)
    return rangs


def construire(D, materiaux, b):
    zones = sorted({z for zs in D['ZONES_PUBLIEES'].values() for z in zs} | set(D['ZONES_DU_CORPS']))
    b.exiger(sorted(set(zones) | set(D['ZONES_DU_COL'])))
    publies = [b.matieres_publiees(id_, D['MATIERES'][nom]) for nom, id_ in D['CONTOURNE'].items()]
    P, T, W = joindre_les_surfaces(publies + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    filet = b.filet('cape')
    O = filet.axe
    rangs, r = profils(D, P, aretes(T), filet)
    descente = lambeaux(D['LAMBEAUX'], D['COLONNES'] + 1)
    points = [[np.array([*(O + r[i, j] * direction(phi)), z - (descente[j] if i == len(rangs) - 1 else 0.0)])
               for j, phi in enumerate(azimuts(D, z))] for i, z in enumerate(rangs)]
    haut = empiecement(D, b, publies + [b.corps(z) for z in D['ZONES_DU_CORPS']], points[0])
    M = Maillage()
    lignes = [M.ajouter(rang, 'cape') for rang in haut + points]
    e = D['EMPIECEMENT']
    C = np.array(b.tete(e['os'])) + np.array([0.0, *e['centre']])
    refs = [C] * len(haut) + [np.array([O[0], O[1], 0.5 * (a + z)]) for a, z in zip(rangs, rangs[1:])]
    for i, ref in enumerate(refs):
        for j in range(D['COLONNES']):
            M.quad(lignes[i][j], lignes[i][j + 1], lignes[i + 1][j + 1], lignes[i + 1][j], ref)
    X, orientes, normales = M.orienter()
    porteur = porteur_de(P, sans_les_bras(D, P, T), W)
    Wx = np.array([emprunter(p, porteur)[0] for p in X])
    for a, o in D['OS_REPORTES'].items():
        Wx[:, b.indice_os[o]] += Wx[:, b.indice_os[a]]
        Wx[:, b.indice_os[a]] = 0.0
    Wx = lisser(Wx, voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    for i, p in enumerate(X):
        part = filet.part(p[2])
        Wx[i] = (1 - part) * Wx[i] + part * filet.poids(p[2], filet.azimut(p))
    piece = b.nappe('cape', X, normales, Wx, orientes, materiaux['cape'], D['EPAISSEUR'])
    publies = {D['CONTOURNE'][nom]: zs for nom, zs in D['ZONES_PUBLIEES'].items()}
    b.transferer(piece, zones, masques=[([True] * len(piece.data.vertices), [], publies),
                                        ([v.co.z > D['HAUT'] for v in piece.data.vertices], D['ZONES_DU_COL'], publies)])
    return piece
