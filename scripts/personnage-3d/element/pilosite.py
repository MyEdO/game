"""Kit des pilosités posées sur la peau de la tête publiée (#3867, #4394) : la calvitie et barbe rase, la barbe courte.
Le poil est la peau de la tête sous un masque, décalée le long de sa normale ; le `modele.py` de la pièce en règle la
hauteur et le nappage, le kit en donne la peau soudée, le masque, les faces gardées et leurs anneaux. Le poil suit la
tête sous ses clés propres (`formesDeTete` : `visage_long` allonge le menton sous la barbe), copiées sommet à sommet de
sa peau (`Base.matieres_et_cles_publiees`).

Un sommet de la peau se repère depuis le centre d'une bande par son azimut `phi` (degrés, 0 devant, positif vers la
gauche +x) et son élévation (degrés depuis l'horizontale du centre) ; une bande est comprise entre un bord bas et un bord
haut (tables `(|phi|, élévation)` interpolées), bornée en azimut, chaque bord découpé en mèches (`tissu.lambeaux`, une
mèche par `pas_des_meches` degrés). La barbe garde les lèvres nues, une ellipse d'azimut et d'élévation.
"""
import math

import numpy as np
from mathutils import Vector

from tissu import arbre_de, lambeaux, table, voisinage


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


def barbe(D, b, X):
    """Par sommet de la peau `X`, s'il est dans la barbe `D['BARBE']`, hors des lèvres, et ses azimut et élévation
    depuis son centre."""
    k = D['BARBE']
    phi, e = angles(b, k, X)
    e0, e1 = k['bouche']['elevation']
    levres = (phi / k['bouche']['phi']) ** 2 + ((e - 0.5 * (e0 + e1)) / (0.5 * (e1 - e0))) ** 2 < 1.0
    poil = np.array([dans_la_bande(k, p, f, 'phi_max') for p, f in zip(phi, e)])
    return poil & ~levres, phi, e


def a_l_air(X, N, T, portee):
    """Par sommet, si sa normale sort à l'air libre : un sommet dont la normale rencontre la peau à moins de `portee`
    est au creux d'une cavité (l'intérieur de la bouche), où aucun poil ne pousse."""
    arbre = arbre_de(X, T)
    return np.array([arbre.ray_cast(Vector((p + 1e-4 * n).tolist()), Vector(n.tolist()), portee)[0] is None
                     for p, n in zip(X, N)])


def souder(P, T, W, cles, tolerance):
    """Les sommets des faces de la peau soudés (coutures d'UV) : positions, triangles, poids et clés réindexés."""
    utilises = np.unique(T)
    _, premier, inverse = np.unique(np.round(P[utilises] / tolerance).astype(np.int64), axis=0, return_index=True,
                                    return_inverse=True)
    index = np.zeros(len(P), int)
    index[utilises] = inverse.ravel()
    gardes = utilises[premier]
    return P[gardes], index[T], W[gardes], {nom: champ[gardes] for nom, champ in cles.items()}


def normales_de(X, T):
    """Normales de sommet, moyenne des normales des faces `T` pondérées par l'aire, vers le dehors de la peau. Le poil
    prend celles de ses seules faces : à la racine de l'oreille, la normale de toute la peau est celle du pli, et le bord
    du poil s'y retournait (`enroulement`, 3 triangles au-dessus de l'oreille)."""
    n = np.cross(X[T[:, 1]] - X[T[:, 0]], X[T[:, 2]] - X[T[:, 0]])
    N = np.zeros_like(X)
    for k in range(3):
        np.add.at(N, T[:, k], n)
    return N / np.linalg.norm(N, axis=1, keepdims=True)


def peau_de_la_tete(D, b):
    """La peau de la tête publiée `D['CONTOURNE']['tete']` (faces de `D['MATIERES_DE_LA_TETE']`), soudée à
    `D['SOUDURE']` : positions, triangles, poids et clés propres ; les zones `D['ZONES_DES_CLES']` exigées de la base."""
    b.exiger(D['ZONES_DES_CLES'])
    return souder(*b.matieres_et_cles_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE']), D['SOUDURE'])


def au_poil(D, peau, poil, nu):
    """Les faces de la `peau` (`peau_de_la_tete`) au poil : `D['SOMMETS_PAR_FACE']` de leurs sommets sous le masque
    `poil`, aucun de `nu` ni au creux d'une cavité (`a_l_air` à `D['CAVITE']`). Rend les sommets gardés (indices dans la
    peau), puis leurs positions, les faces réindexées sur eux, leurs poids et leurs clés."""
    P, T, W, cles = peau
    nu = nu | ~a_l_air(P, normales_de(P, T), T, D['CAVITE'])
    faces = T[(poil[T].sum(axis=1) >= D['SOMMETS_PAR_FACE']) & ~nu[T].any(axis=1)]
    gardes = np.unique(faces)
    index = -np.ones(len(P), int)
    index[gardes] = np.arange(len(gardes))
    return gardes, P[gardes], index[faces], W[gardes], {nom: champ[gardes] for nom, champ in cles.items()}


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
