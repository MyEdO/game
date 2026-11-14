"""Géométrie de `humanoide--pilosite--calvitie-et-barbe-rase` (`element/tissu.py`) : un chaume ras, la peau de la tête
publiée sous un masque, décalée le long de sa normale.

- Le masque : les sommets de la peau dans la couronne (de la tempe gauche à la tempe droite par la nuque, au-dessus et
  derrière les oreilles) ou dans la barbe (d'un favori à l'autre par le menton et le dessous du menton, les lèvres hors
  d'elle) ; chaque bord, bas, haut et côtés, découpé en mèches. Une face de la peau est au poil si
  `SOMMETS_PAR_FACE` de ses sommets le sont : le contour suit les faces de la tête (lèvres comprises).
- Les nus : une face dont un sommet est sur une oreille ou au creux d'une cavité (sa normale rencontre la peau :
  l'intérieur de la bouche) reste nue, quel que soit le masque.
- La hauteur : du bord au cœur, `HAUTEUR` selon l'anneau du sommet, plus un grain ; le chaume se fond dans la peau à son
  pourtour, sans marche.

Double nappe d'épaisseur sous la hauteur du bord, poids de la peau tels quels, silhouettes et clés `gabarit_*`
transférées des zones de la base que la tête recouvre. Toute cote vient de `donnees.py`.
"""
import math
import random

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from tissu import lambeaux, voisinage


def tirage(graine):
    """Tirage déterministe, graine des codes de caractères (procédure, section 6)."""
    return random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(graine)))


def table(points, x):
    return float(np.interp(x, *zip(*points)))


def meches(c, nom):
    """La profondeur des mèches du bord `nom` de la bande `c` en fonction d'un angle (degrés) : une pointe ou un creux
    (`tissu.lambeaux`) tous les `pas_des_meches` degrés, interpolés, périodique sur le tour."""
    n = math.ceil(360.0 / c['pas_des_meches'])
    profondeurs = lambeaux({**c['meches'], 'graine': f"{c['meches']['graine']}-{nom}"}, n)
    noeuds = [360.0 * k / n for k in range(n + 1)]
    return lambda angle: float(np.interp(angle % 360.0, noeuds, profondeurs + profondeurs[:1]))


def angles(b, c, X):
    """Azimut et élévation (degrés) de chaque point de `X` depuis le centre de la bande `c`."""
    d = X - (np.array(b.tete(c['os_du_centre'])) + np.asarray(c['centre'], float))
    phi = np.degrees(np.arctan2(d[:, 0], -d[:, 1]))
    e = np.degrees(np.arctan2(d[:, 2], np.hypot(d[:, 0], d[:, 1])))
    return phi, e


def dans_la_bande(c, phi, e, cote):
    """Le point (`phi`, `e`) est-il entre les bords bas et haut de `c`, et du bon côté de sa limite d'azimut `cote`
    (`'phi_min'` : au-delà, `'phi_max'` : en deçà), chaque bord en mèches ?"""
    a = abs(phi)
    bas = table(c['bas'], a) - meches(c, 'bas')(phi)
    haut = table(c['haut'], a) + meches(c, 'haut')(phi)
    limite = table(c[cote], e)
    if cote == 'phi_min':
        limite -= meches(c, 'cote')(e + (180.0 if phi < 0 else 0.0))
        return bas <= e <= haut and a >= limite
    limite += meches(c, 'cote')(e + (180.0 if phi < 0 else 0.0))
    return bas <= e <= haut and a <= limite


def oreille(D, X):
    """Par sommet de la peau `X`, s'il est sur une oreille."""
    o = D['OREILLE']
    return (np.abs(X[:, 0]) > o['x_min']) & (X[:, 1] > o['y'][0]) & (X[:, 1] < o['y'][1]) \
        & (X[:, 2] > o['z'][0]) & (X[:, 2] < o['z'][1])


def masque(D, b, X):
    """Par sommet de la peau `X`, s'il est dans la couronne ou la barbe, hors des lèvres."""
    c, k = D['COURONNE'], D['BARBE']
    pc, ec = angles(b, c, X)
    pb, eb = angles(b, k, X)
    bouche = k['bouche']
    e0, e1 = bouche['elevation']
    milieu, demi = 0.5 * (e0 + e1), 0.5 * (e1 - e0)
    levres = (pb / bouche['phi']) ** 2 + ((eb - milieu) / demi) ** 2 < 1.0
    poil = np.array([dans_la_bande(c, p, e, 'phi_min') or dans_la_bande(k, q, f, 'phi_max')
                     for p, e, q, f in zip(pc, ec, pb, eb)])
    return poil & ~levres


def a_l_air(X, N, T, portee):
    """Par sommet, si sa normale sort à l'air libre : un sommet dont la normale rencontre la peau à moins de `portee`
    est au creux d'une cavité (l'intérieur de la bouche), où aucun poil ne pousse."""
    arbre = BVHTree.FromPolygons([tuple(p) for p in X], T.tolist(), all_triangles=True)
    return np.array([arbre.ray_cast(Vector((p + 1e-4 * n).tolist()), Vector(n.tolist()), portee)[0] is None
                     for p, n in zip(X, N)])


def souder(P, T, W, tolerance):
    """Les sommets des faces de la peau soudés (coutures d'UV) : positions, triangles et poids réindexés."""
    utilises = np.unique(T)
    _, premier, inverse = np.unique(np.round(P[utilises] / tolerance).astype(np.int64), axis=0, return_index=True,
                                    return_inverse=True)
    index = np.zeros(len(P), int)
    index[utilises] = inverse.ravel()
    return P[utilises][premier], index[T], W[utilises][premier]


def normales_de(X, T):
    """Normales de sommet, moyenne des normales des faces `T` pondérées par l'aire, vers le dehors de la peau. Le poil
    prend celles de ses seules faces : à la racine de l'oreille, la normale de toute la peau est celle du pli, et le bord
    du poil s'y retournait (`enroulement`, 3 triangles au-dessus de l'oreille)."""
    n = np.cross(X[T[:, 1]] - X[T[:, 0]], X[T[:, 2]] - X[T[:, 0]])
    N = np.zeros_like(X)
    for k in range(3):
        np.add.at(N, T[:, k], n)
    return N / np.linalg.norm(N, axis=1, keepdims=True)


def anneaux(faces, n):
    """Par sommet des `faces`, son anneau compté depuis le bord de la région (0 sur une arête de bord)."""
    aretes = {}
    for f in faces:
        for a, b_ in zip(f, np.roll(f, -1)):
            cle = (min(a, b_), max(a, b_))
            aretes[cle] = aretes.get(cle, 0) + 1
    rang = np.full(n, -1)
    front = sorted({s for (a, b_), compte in aretes.items() if compte == 1 for s in (a, b_)})
    rang[front] = 0
    voisins = voisinage(faces, n)
    r = 0
    while front:
        r += 1
        suivant = sorted({v for s in front for v in voisins[s] if rang[v] < 0})
        rang[suivant] = r
        front = suivant
    return rang


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    P, T, W = souder(*b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE']), D['SOUDURE'])
    normales = normales_de(P, T)
    au_poil, nu = masque(D, b, P), oreille(D, P) | ~a_l_air(P, normales, T, D['CAVITE'])
    faces = T[(au_poil[T].sum(axis=1) >= D['SOMMETS_PAR_FACE']) & ~nu[T].any(axis=1)]
    gardes = np.unique(faces)
    index = -np.ones(len(P), int)
    index[gardes] = np.arange(len(gardes))
    faces = index[faces]
    X, W = P[gardes], W[gardes]
    N = normales_de(X, faces)
    rang = anneaux(faces, len(X))
    grain = tirage(D['GRAINE'])
    hauteur = np.array([D['HAUTEUR'][min(r, 2)] + (grain.uniform(-0.5, 0.5) * D['GRAIN'] if r > 0 else 0.0) for r in rang])
    piece = b.nappe('calvitie_et_barbe_rase', X + N * hauteur[:, None], N, W, [tuple(f) for f in faces],
                    materiaux['poil'], D['EPAISSEUR'])
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
