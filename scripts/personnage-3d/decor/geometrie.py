"""La géométrie commune aux modèles des décors (#4335) : le cap d'un azimut, la normale d'une
tangente, la courbe lissée par des points et la coque close d'une suite d'anneaux."""
import math

from mathutils import Vector

HAUT = Vector((0, 0, 1))


def cap(azimut):
    """Le vecteur horizontal unitaire d'`azimut` degrés."""
    return Vector((math.cos(math.radians(azimut)), math.sin(math.radians(azimut)), 0))


def normale(t):
    """Une normale unitaire à la tangente unitaire `t`."""
    ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
    return (ref - t * ref.dot(t)).normalized()


def lisse(points, pas):
    """La courbe de Catmull-Rom par `points`, `pas` points par tronçon."""
    chemin = []
    for i in range(len(points) - 1):
        p0, p1, p2, p3 = points[max(i - 1, 0)], points[i], points[i + 1], points[min(i + 2, len(points) - 1)]
        for s in range(pas):
            t = s / pas
            chemin.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    return chemin + [points[-1]]


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
