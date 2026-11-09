"""Primitives de maillage des véhicules (#2987), communes aux modèles de `vehicule/<modele>/modele.py` : la maille
accumulée en coordonnées du monde, l'interpolation des tables de forme, les solides (révolution, boîte, poutre, tube,
tore, roue) et l'objet Blender final.

Repère Blender de construction : z vers le haut, l'avant vers -y, la gauche (bâbord) vers +x ; l'export glTF (y vers le
haut) place l'avant vers +z.
"""
import math

import bmesh
import bpy
from mathutils import Vector


class Maille:
    """Sommets, faces, index de matériau et UV des coins d'un objet, en coordonnées du monde."""

    def __init__(self, materiaux):
        self.v, self.f, self.m, self.uv = [], [], [], []
        self.materiaux = materiaux

    def ajouter(self, sommets, faces, mat, uvs=None):
        """`uvs` : les UV de chaque coin de chaque face, (0, 0) partout sinon."""
        base = len(self.v)
        self.v.extend(tuple(p) for p in sommets)
        index = [m.name for m in self.materiaux].index(mat)
        for k, face in enumerate(faces):
            self.f.append([base + i for i in face])
            self.m.append(index)
            self.uv.append(uvs[k] if uvs else [(0.0, 0.0)] * len(face))


def lineaire(table, x):
    """Interpolation linéaire par morceaux de `table` [(x, y)], bornée aux extrémités."""
    if x <= table[0][0]:
        return table[0][1]
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def recentrer(mailles):
    """Recentre en x et y l'emprise de toutes les `mailles` (le sol reste z = 0) ; rend le décalage (dx, dy)."""
    toutes = [p for m in mailles for p in m.v]
    dx = -(min(p[0] for p in toutes) + max(p[0] for p in toutes)) / 2
    dy = -(min(p[1] for p in toutes) + max(p[1] for p in toutes)) / 2
    for m in mailles:
        m.v = [(x + dx, y + dy, z) for x, y, z in m.v]
    return dx, dy


def basculer(point, pivot, angle):
    """`point` tourné de `angle` degrés autour de l'axe x passant par `pivot` (y, z) : l'avant (-y) se lève, l'arrière
    (+y) s'abaisse."""
    x, y, z = point
    py, pz = pivot
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    return (x, py + (y - py) * c + (z - pz) * s, pz - (y - py) * s + (z - pz) * c)


def basculer_maille(maille, pivot, angle):
    """Tous les sommets de `maille` tournés par `basculer`."""
    maille.v = [basculer(p, pivot, angle) for p in maille.v]


def plaque(maille, contour, epaisseur, mat):
    """Plaque d'`epaisseur` en x, centrée sur le `contour` [(x, y, z)] (sens trigonométrique vu de +x)."""
    sommets = [(x - epaisseur / 2, y, z) for x, y, z in contour] + [(x + epaisseur / 2, y, z) for x, y, z in contour]
    k = len(contour)
    faces = [list(range(k)), list(range(2 * k - 1, k - 1, -1))]
    faces += [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)]
    maille.ajouter(sommets, faces, mat)


def poutre(maille, a, b, largeur, epaisseur, normale, mat):
    """Poutre de section rectangulaire de `a` à `b` ; `normale` oriente l'épaisseur."""
    a, b, n = Vector(a), Vector(b), Vector(normale).normalized()
    d = (b - a).normalized()
    u = d.cross(n).normalized() * largeur / 2
    w = n * epaisseur / 2
    coins = [-u - w, u - w, u + w, -u + w]
    sommets = [tuple(a + c) for c in coins] + [tuple(b + c) for c in coins]
    faces = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]
    maille.ajouter(sommets, faces, mat)


def tour(maille, profil, axe, centre, segments, mats, ferme=False):
    """Révolution du profil [(a, r)] autour de l'axe 'x', 'y' ou 'z' passant par `centre` ; r = 0 ferme sur l'axe.
    `mats` : un matériau, ou un par tronçon du profil. `ferme` : profil en boucle (anneau)."""
    mats = mats if isinstance(mats, list) else [mats] * len(profil)
    anneaux = []
    sommets = []
    for a, r in profil:
        if r == 0:
            anneaux.append([len(sommets)])
            sommets.append(point(axe, centre, a, 0, 0))
        else:
            debut = len(sommets)
            for k in range(segments):
                t = 2 * math.pi * k / segments
                sommets.append(point(axe, centre, a, r * math.cos(t), r * math.sin(t)))
            anneaux.append(list(range(debut, debut + segments)))
    paires = list(zip(range(len(profil) - 1), range(1, len(profil))))
    if ferme:
        paires.append((len(profil) - 1, 0))
    faces_par_mat = {}
    for i, j in paires:
        a, b = anneaux[i], anneaux[j]
        faces = faces_par_mat.setdefault(mats[i], [])
        for k in range(segments):
            k2 = (k + 1) % segments
            if len(a) == 1:
                faces.append([a[0], b[k], b[k2]])
            elif len(b) == 1:
                faces.append([a[k], b[0], a[k2]])
            else:
                faces.append([a[k], a[k2], b[k2], b[k]])
    for mat, faces in faces_par_mat.items():
        utilises = sorted({i for face in faces for i in face})
        renum = {i: n for n, i in enumerate(utilises)}
        maille.ajouter([sommets[i] for i in utilises], [[renum[i] for i in face] for face in faces], mat)


def cylindre(maille, a0, a1, rayon, axe, centre, segments, mat):
    """Cylindre plein de `rayon`, de l'abscisse `a0` à `a1` sur l'axe 'x', 'y' ou 'z' passant par `centre`."""
    tour(maille, [(a0, 0), (a0, rayon), (a1, rayon), (a1, 0)], axe, centre, segments, mat)


def point(axe, centre, a, u, w):
    """Le point d'abscisse `a` sur l'axe 'x', 'y' ou 'z' passant par `centre`, décalé de (u, w) dans le plan normal."""
    cx, cy, cz = centre
    if axe == "y":
        return (cx + u, cy + a, cz + w)
    if axe == "z":
        return (cx + u, cy + w, cz + a)
    return (cx + a, cy + u, cz + w)


def boite(maille, mini, maxi, mat):
    (x0, y0, z0), (x1, y1, z1) = mini, maxi
    sommets = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    maille.ajouter(sommets, faces, mat)


def tube(maille, chemin, rayon, cotes, mat):
    """Tube fermé de section polygonale le long de `chemin` (points), repère par transport du vecteur x."""
    pts = [Vector(p) for p in chemin]
    sommets, faces = [], []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        e1 = Vector((1, 0, 0))
        e1 = (e1 - d * e1.dot(d)).normalized()
        e2 = d.cross(e1)
        for k in range(cotes):
            t = 2 * math.pi * k / cotes
            sommets.append(tuple(p + (e1 * math.cos(t) + e2 * math.sin(t)) * rayon))
    for i in range(len(pts) - 1):
        for k in range(cotes):
            k2 = (k + 1) % cotes
            faces.append([i * cotes + k, i * cotes + k2, (i + 1) * cotes + k2, (i + 1) * cotes + k])
    faces.append(list(range(cotes))[::-1])
    faces.append([(len(pts) - 1) * cotes + k for k in range(cotes)])
    maille.ajouter(sommets, faces, mat)


def tore(maille, axe, centre, grand, petit, n_grand, n_petit, mat):
    """Tore d'axe 'x', 'y' ou 'z' (anneau plaqué contre une face de cette normale)."""
    sommets, faces = [], []
    for i in range(n_grand):
        t = 2 * math.pi * i / n_grand
        for j in range(n_petit):
            s = 2 * math.pi * j / n_petit
            r = grand + petit * math.cos(s)
            sommets.append(point(axe, centre, petit * math.sin(s), r * math.cos(t), r * math.sin(t)))
    for i in range(n_grand):
        for j in range(n_petit):
            i2, j2 = (i + 1) % n_grand, (j + 1) % n_petit
            faces.append([i * n_petit + j, i2 * n_petit + j, i2 * n_petit + j2, i * n_petit + j2])
    maille.ajouter(sommets, faces, mat)


def roue(R, x, essieu_z, signe, bois, fer):
    """Roue de bois cerclée de fer dans le plan `x`, d'axe x à la hauteur `essieu_z`, son moyeu tourné vers l'extérieur
    selon `signe` (+1 vers +x) : bandage, jante, moyeu frotté et rayons, d'après la table `R` (`affut/donnees.py`)."""
    roue = Maille([bois, fer])
    s = R["segments"]
    ri, ro, w = R["bandage"]
    tour(roue, [(x - w / 2, ri), (x + w / 2, ri), (x + w / 2, ro), (x - w / 2, ro)], "x", (0, 0, essieu_z), s, fer.name, ferme=True)
    ri, ro, w = R["jante"]
    tour(roue, [(x - w / 2, ri), (x + w / 2, ri), (x + w / 2, ro), (x - w / 2, ro)], "x", (0, 0, essieu_z), s, bois.name, ferme=True)
    rm, xi, xo = R["moyeu"]
    a, b = sorted((x + signe * xi, x + signe * xo))
    cylindre(roue, a, b, rm, "x", (0, 0, essieu_z), R["segments_moyeu"], bois.name)
    for (rf, f0, f1) in (R["chapeau"], R["frette"]):
        a, b = sorted((x + signe * f0, x + signe * f1))
        cylindre(roue, a, b, rf, "x", (0, 0, essieu_z), R["segments_moyeu"], fer.name)
    largeur, epaisseur = R["rayon_section"]
    for k in range(R["rayons"]):
        t = 2 * math.pi * (k + 0.5) / R["rayons"]
        d = (0, math.cos(t), math.sin(t))
        poutre(roue, (x, rm * 0.9 * d[1], essieu_z + rm * 0.9 * d[2]), (x, (R["jante"][0] + 0.02) * d[1], essieu_z + (R["jante"][0] + 0.02) * d[2]), largeur, epaisseur, (1, 0, 0), bois.name)
    return roue


def treuil(m, T, pied):
    """Treuil de bois sur deux chevalets posés à la hauteur `pied`, barres de manœuvre à chaque bout, d'après la table
    `T` (`catapulte/donnees.py`)."""
    ty, tz, tr, tl = T["y"], T["z"], T["rayon"], T["demi_longueur"]
    cx, cl, cp, ch = T["chevalet"]
    bs, blong = T["barre"]
    for signe in (1, -1):
        boite(m, (signe * cx - cl / 2, ty - cp / 2, pied), (signe * cx + cl / 2, ty + cp / 2, ch), "bois")
        for k in range(T["rayons"]):
            t = 2 * math.pi * (k + 0.5) / T["rayons"]
            poutre(m, (signe * tl, ty, tz), (signe * tl, ty + blong * math.cos(t), tz + blong * math.sin(t)), 2 * bs, 2 * bs, (1, 0, 0), "bois")
    cylindre(m, -tl - 0.04, tl + 0.04, tr, "x", (0, ty, tz), 12, "bois")


def objet(nom, maille, origine, angle_lisse):
    """L'objet `nom`, ses sommets ramenés à `origine`, triangulé, normales extérieures, lissé par angle ; seuls les
    matériaux que portent ses faces lui sont attachés, dans l'ordre de la maille."""
    utilises = sorted(set(maille.m))
    renum = {m: i for i, m in enumerate(utilises)}
    ox, oy, oz = origine
    donnees = bpy.data.meshes.new(nom)
    donnees.from_pydata([(x - ox, y - oy, z - oz) for x, y, z in maille.v], [], maille.f)
    for poly, m in zip(donnees.polygons, maille.m):
        poly.material_index = renum[m]
    couche = donnees.uv_layers.new(name="UVMap")
    for poly, coins in zip(donnees.polygons, maille.uv):
        for boucle, uv in zip(poly.loop_indices, coins):
            couche.data[boucle].uv = uv
    bm = bmesh.new()
    bm.from_mesh(donnees)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method="BEAUTY", ngon_method="BEAUTY")
    bm.to_mesh(donnees)
    bm.free()
    for m in utilises:
        donnees.materials.append(maille.materiaux[m])
    for poly in donnees.polygons:
        poly.use_smooth = True
    donnees.set_sharp_from_angle(angle=math.radians(angle_lisse))
    obj = bpy.data.objects.new(nom, donnees)
    obj.location = origine
    bpy.context.scene.collection.objects.link(obj)
    return obj
