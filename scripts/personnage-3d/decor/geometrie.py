"""La géométrie commune aux modèles des décors (#4335) : les axes, les coins d'un carré, la boîte et le cylindre d'une
primitive en `Vector`, l'aléa semé de l'id, le cap d'un azimut, les normales d'une tangente, le point d'un chemin à une
hauteur, la courbe lissée par des points, l'anneau régulier et la coque close d'une suite d'anneaux ; les pièces de
bois et de fer que les familles partagent (pièce équarrie, planche, pièce profilée, pièce tournée, cheville, clou) et
le partage inégal d'une longueur ; et la déclaration des éléments d'une famille, avec la construction d'un décor dont
les nœuds se bâtissent ensemble."""
import math
import random

from mathutils import Vector

import habillage
from gabarit import Gabarit, boite
from maille import Maille, objet

X, Y, HAUT = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
ANGLES = ((1, 1), (-1, 1), (-1, -1), (1, -1))
"""Les signes (x, y) des quatre coins d'un carré centré, dans le sens direct."""
MAT = "bois"
"""Le matériau d'une pièce de bois (`barre`, `planche`, `tournee`, `cheville`)."""


def pave(primitive):
    """Le centre et les côtés (x, y, z) de la boîte, du prisme ou du cylindre d'axe vertical `primitive` de la recette
    (`gabarit.boite`)."""
    centre, demi = boite(primitive)
    return Vector(centre), tuple(2 * e for e in demi)


def rond(primitive):
    """Le centre, le rayon et la longueur du cylindre `primitive` de la recette (`pave`)."""
    centre, (diametre, _, longueur) = pave(primitive)
    return centre, diametre / 2, longueur


def alea(id_):
    """Le générateur semé des codes de caractères de `id_`."""
    return random.Random(sum((i + 1) * ord(c) for i, c in enumerate(id_)))


def cap(azimut):
    """Le vecteur horizontal unitaire d'`azimut` degrés."""
    return Vector((math.cos(math.radians(azimut)), math.sin(math.radians(azimut)), 0))


def normale(t):
    """Une normale unitaire à la tangente unitaire `t`."""
    ref = X if abs(t.x) < 0.9 else Y
    return (ref - t * ref.dot(t)).normalized()


def normales(t):
    """Deux normales unitaires `(n, b)` à la tangente unitaire `t`, `(t, n, b)` direct."""
    n = normale(t)
    return n, t.cross(n)


def a_la_hauteur(chemin, z):
    """Le point de `chemin`, qui monte, à la hauteur `z`."""
    i = max(i for i, p in enumerate(chemin[:-1]) if p.z <= z)
    return chemin[i].lerp(chemin[i + 1], (z - chemin[i].z) / (chemin[i + 1].z - chemin[i].z))


def lisse(points, pas):
    """La courbe de Catmull-Rom par `points`, `pas` points par tronçon."""
    chemin = []
    for i in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(i - 1, 0)], points[i], points[i + 1], points[min(i + 2, len(points) - 1)]
        for s in range(pas):
            t = s / pas
            chemin.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    return chemin + [points[-1]]


def anneau(centre, u, v, rayon, cotes):
    """Les `cotes` sommets du polygone régulier de `rayon` autour de `centre`, dans le plan de `u` et `v` unitaires, le
    premier sur `u`, dans le sens de `u` vers `v`."""
    return [centre + (u * math.cos(2 * math.pi * j / cotes) + v * math.sin(2 * math.pi * j / cotes)) * rayon for j in range(cotes)]


def coque(m, anneaux, mat, pointe=None):
    """La coque close des `anneaux` successifs (listes de points de même longueur) : le premier fermé à plat, le
    dernier à plat aussi, ou en cône vers `pointe`."""
    k = len(anneaux[0])
    sommets = [tuple(p) for anneau in anneaux for p in anneau]
    faces = [[i * k + j, i * k + (j + 1) % k, (i + 1) * k + (j + 1) % k, (i + 1) * k + j]
             for i in range(len(anneaux) - 1) for j in range(k)]
    faces.append(list(range(k))[::-1])
    dernier = (len(anneaux) - 1) * k
    if pointe is None:
        faces.append([dernier + j for j in range(k)])
    else:
        faces += [[dernier + j, dernier + (j + 1) % k, len(sommets)] for j in range(k)]
        sommets.append(tuple(pointe))
    m.ajouter(sommets, faces, mat)


def octogone(c, u, v, du, dv, chanfrein):
    """Le rectangle de centre `c` et de demi-côtés `du` sur `u`, `dv` sur `v`, ses coins abattus de `chanfrein`."""
    return [c + u * x + v * y for x, y in ((du - chanfrein, -dv), (du, -dv + chanfrein), (du, dv - chanfrein), (du - chanfrein, dv),
                                           (-du + chanfrein, dv), (-du, dv - chanfrein), (-du, -dv + chanfrein), (-du + chanfrein, -dv))]


def barre(m, stations, u, v, mat=MAT):
    """Une pièce équarrie aux arêtes abattues : la coque des sections `stations` [(centre, du, dv, chanfrein)], chacune
    dans le plan de `u` et `v`."""
    coque(m, [octogone(c, u, v, du, dv, chanfrein) for c, du, dv, chanfrein in stations], mat)


def planche(m, a, b, u, v, du, dv, chanfrein, mat=MAT):
    """Une planche de `a` à `b`, ses rives et ses bouts adoucis de `chanfrein`."""
    d = (b - a).normalized() * chanfrein
    barre(m, [(a, du - chanfrein, dv - chanfrein, chanfrein / 2), (a + d, du, dv, chanfrein), (b - d, du, dv, chanfrein),
              (b, du - chanfrein, dv - chanfrein, chanfrein / 2)], u, v, mat)


def profilee(m, a, b, demi, profil):
    """Une pièce équarrie dressée de `a` à `b`, sections horizontales, de demi-côtés `demi` (x, y) d'après `profil`
    [(part de la longueur, part du demi-côté, chanfrein en fraction du plus petit demi-côté)]."""
    barre(m, [(a.lerp(b, t), demi[0] * part, demi[1] * part, min(demi) * chanfrein) for t, part, chanfrein in profil], X, Y)


def tournee(m, a, b, u, v, rayon, profil, cotes, mat=MAT):
    """Une pièce tournée de `a` à `b`, ses cercles dans le plan de `u` et `v`, de `rayon` d'après `profil`
    [(part de la longueur, part du rayon)]."""
    coque(m, [anneau(a.lerp(b, t), u, v, rayon * part, cotes) for t, part in profil], mat)


def cheville(m, p, n, rayon, K, a, mat=MAT):
    """Une cheville de `rayon` enfoncée en `p` dans la face de normale `n`, sa tête en saillie, d'après `K`
    (`CHEVILLE`)."""
    tournee(m, p - n * (rayon * K["enfonce"]), p + n * (rayon * a.uniform(*K["saillie"])), *normales(n), rayon, K["profil"], K["cotes"], mat)


def clou(m, centre, dehors, C, demi, mat):
    """Une tête de clou en pointe de diamant posée sur `centre`, tournée vers `dehors`, d'après `C` (`CLOU`), en
    fractions de `demi`."""
    u, v = normales(dehors)
    c = C[0] * demi
    coque(m, [[centre + u * a * c + v * b * c for a, b in ANGLES]], mat, centre + dehors * C[1] * demi)


def partage(a, nombre, ecart):
    """Les bornes de `nombre` parts de [0, 1], chaque borne du dedans écartée d'au plus `ecart` de sa part."""
    return [0.0] + [(k + a.uniform(-ecart, ecart)) / nombre for k in range(1, nombre)] + [1.0]


def par_noeuds(D, id_, noeuds, batir):
    """Le décor `id_` dont les `noeuds` {nœud : noms de ses matériaux (`D["MATERIAUX"]`)} se bâtissent ensemble par
    `batir(D, gabarit, mailles par nœud, aléa)`, chaque sommet ramené dans l'enveloppe à `D["RETRAIT"]` sous elle
    (`Gabarit.rentrer`), chaque nœud lissé sous `D["ANGLE_LISSE"][nœud]`, ses triangles dans `D["BUDGET_TRIANGLES"]`."""
    G = Gabarit(id_)
    mats = habillage.materiaux(D["MATERIAUX"][id_])
    pieces = {noeud: Maille([mats[nom] for nom in noms]) for noeud, noms in noeuds.items()}
    batir(D, G, pieces, alea(id_))
    objets = []
    for noeud, maille in pieces.items():
        maille.v = [tuple(p) for p in G.rentrer(maille.v, D["RETRAIT"])]
        objets.append(objet(noeud, maille, (0.0, 0.0, 0.0), D["ANGLE_LISSE"][noeud]))
    triangles = sum(len(o.data.polygons) for o in objets)
    if triangles > D["BUDGET_TRIANGLES"][id_]:
        raise ValueError(f"{id_} : {triangles} triangles, budget {D['BUDGET_TRIANGLES'][id_]}")
    return {}


def elements(D, decors, construire):
    """Les éléments de la famille (`construire.py`) : un par décor de `decors`, sa clé `decor`, ses matériaux
    `D["MATERIAUX"][id]`, bâti par `construire(D, id)`."""
    for id_ in decors:
        yield {"glb": id_, "cles": [("decor", {"prop": id_})], "materiaux": D["MATERIAUX"][id_], "blasons": (),
               "construire": lambda id_=id_: construire(D, id_)}
