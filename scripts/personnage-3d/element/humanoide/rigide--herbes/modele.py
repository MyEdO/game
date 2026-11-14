"""Géométrie de `humanoide--rigide--herbes` : des brins qui partent du lien (l'origine) en éventail vers +Y, chacun une tige
fine retombante et ses feuilles alternées de part et d'autre, losanges à plat face à +Z."""
import math

from mathutils import Vector
from maille import Maille, objet, tube


def feuille(m, base, sens, cote, L, F):
    """Losange épais de `base` à la pointe, le long de `sens`, sa plus grande largeur au tiers."""
    n = sens.cross(cote).normalized() * F['epaisseur'] / 2
    w = cote * F['largeur'] / 2
    contour = [base, base + sens * (L / 3) + w, base + sens * L, base + sens * (L / 3) - w]
    sommets = [tuple(p + n) for p in contour] + [tuple(p - n) for p in contour]
    faces = [[0, 1, 2, 3], [7, 6, 5, 4]] + [[i, 4 + i, 4 + (i + 1) % 4, (i + 1) % 4] for i in range(4)]
    m.ajouter(sommets, faces, 'vegetal')


def brin(m, D, longueur, arriere, exterieur):
    a, b = math.radians(arriere), math.radians(exterieur)
    d = Vector((math.sin(a) * math.cos(b), math.cos(a) * math.cos(b), math.sin(b)))
    bas = Vector((0.0, 1.0, 0.0))

    def point(t):
        return d * (longueur * t) + bas * (D['COURBURE'] * longueur * t * t)

    n = D['POINTS_TIGE']
    debut = -D['DEPASSE'] / longueur
    tube(m, [point(debut + (1 - debut) * i / (n - 1)) for i in range(n)], D['RAYON_TIGE'], D['COTES_TIGE'], 'vegetal')
    F = D['FEUILLES']
    long0, long1 = F['longueur']
    for k in range(2 * F['paires']):
        f = F['depuis'] + (1 - F['depuis']) * (k + 0.5) / (2 * F['paires'])
        tangente = (point(f + 1e-3) - point(f - 1e-3)).normalized()
        cote = Vector((0.0, 0.0, 1.0)).cross(tangente).normalized() * (1 if k % 2 else -1)
        angle = math.radians(F['angle'])
        sens = (tangente * math.cos(angle) + cote * math.sin(angle)).normalized()
        L = long0 + (long1 - long0) * (f - F['depuis']) / (1 - F['depuis'])
        feuille(m, point(f), sens, cote, L, F)


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    for longueur, arriere, exterieur in D['TIGES']:
        brin(m, D, longueur, arriere, exterieur)
    return [objet('humanoide--rigide--herbes', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
