"""Primitives de maillage des éléments rigides (#2987, #3743), communes aux modèles de `vehicule/<modele>/modele.py`,
de `decor/<modele>/modele.py` et d'`element/<base>/<id>/modele.py` : la maille accumulée en coordonnées du monde, l'interpolation des tables de forme, les
solides (révolution, boîte, poutre, tube, tore, treuil), l'objet Blender final et le montage des nœuds d'un engin à son
emprise recentrée (`monter`) ; les UV en mètres d'un élément sur base (`poser_les_uv_en_metres`, #4313).

Repère Blender d'un véhicule : z vers le haut, l'avant vers -y, la gauche (bâbord) vers +x ; l'export glTF (y vers le
haut) place l'avant vers +z. Un décor, de même, le front de sa recette vers -y (`decor/gabarit.py`). Un élément tenu se
construit dans le repère de sa prise (`element/construire.py`).
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Vector

UV_DE_LA_BRIQUE = "uv_de_la_brique"
"""L'attribut booléen de face d'un objet (`objet`) : vrai sur les faces dont la brique a donné les UV, qu'elles gardent
(`poser_les_uv_en_metres`)."""
AUTRES_AXES = np.array([[1, 2], [0, 2], [0, 1]])
"""Par axe dominant de la normale d'une face, les deux axes qui portent ses UV (`uv_cubiques`)."""


def tirage(graine):
    """Tirage déterministe, graine des codes de caractères de `graine` (procédure, section 6)."""
    return random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(graine)))


class Maille:
    """Sommets, faces, index de matériau et UV des coins d'un objet, en coordonnées du monde ; `None` pour les UV d'une
    face que la brique ne donne pas."""

    def __init__(self, materiaux):
        self.v, self.f, self.m, self.uv = [], [], [], []
        self.materiaux = materiaux

    def ajouter(self, sommets, faces, mat, uvs=None):
        """`uvs` : les UV de chaque coin de chaque face, s'il y en a."""
        base = len(self.v)
        self.v.extend(tuple(p) for p in sommets)
        index = [m.name for m in self.materiaux].index(mat)
        for k, face in enumerate(faces):
            self.f.append([base + i for i in face])
            self.m.append(index)
            self.uv.append(uvs[k] if uvs else None)


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


def revolution(profil, axe, centre, segments, ferme=False):
    """Les sommets et les faces (`segments` par tronçon du profil, dans son ordre) de la révolution du profil [(a, r)] autour de l'axe 'x', 'y' ou
    'z' passant par `centre`, ou du repère `axe` (`point`) ; r = 0 ferme sur l'axe ; une entrée (a, r, r_w) donne une
    section elliptique, `r` sur le premier axe du plan normal, `r_w` sur le second ; `a`, `r` ou `r_w` peut être une
    suite, une valeur par colonne. Chaque face, bouts compris, a son endroit du même côté du profil. `ferme` : profil en
    boucle (anneau)."""
    def colonne(valeur, k):
        return valeur if np.ndim(valeur) == 0 else valeur[k]

    anneaux = []
    sommets = []
    for a, r, *aplati in profil:
        r_w = aplati[0] if aplati else r
        if np.ndim(r) == 0 and r == 0:
            anneaux.append([len(sommets)])
            sommets.append(point(axe, centre, a, 0, 0))
        else:
            debut = len(sommets)
            for k in range(segments):
                t = 2 * math.pi * k / segments
                sommets.append(point(axe, centre, colonne(a, k), colonne(r, k) * math.cos(t), colonne(r_w, k) * math.sin(t)))
            anneaux.append(list(range(debut, debut + segments)))
    paires = list(zip(range(len(profil) - 1), range(1, len(profil))))
    if ferme:
        paires.append((len(profil) - 1, 0))
    faces = []
    for i, j in paires:
        a, b = anneaux[i], anneaux[j]
        for k in range(segments):
            k2 = (k + 1) % segments
            if len(a) == 1:
                faces.append([a[0], b[k2], b[k]])
            elif len(b) == 1:
                faces.append([a[k], a[k2], b[0]])
            else:
                faces.append([a[k], a[k2], b[k2], b[k]])
    return sommets, faces


def tour(maille, profil, axe, centre, segments, mats, ferme=False):
    """La révolution du profil (`revolution`) ajoutée à `maille`. `mats` : un matériau, ou un par tronçon du profil."""
    mats = mats if isinstance(mats, list) else [mats] * len(profil)
    sommets, toutes = revolution(profil, axe, centre, segments, ferme)
    faces_par_mat = {}
    for rang, face in enumerate(toutes):
        faces_par_mat.setdefault(mats[rang // segments], []).append(face)
    for mat, faces in faces_par_mat.items():
        utilises = sorted({i for face in faces for i in face})
        renum = {i: n for n, i in enumerate(utilises)}
        maille.ajouter([sommets[i] for i in utilises], [[renum[i] for i in face] for face in faces], mat)


def cylindre(maille, a0, a1, rayon, axe, centre, segments, mat):
    """Cylindre plein de `rayon`, de l'abscisse `a0` à `a1` sur l'axe 'x', 'y' ou 'z' passant par `centre`."""
    tour(maille, [(a0, 0), (a0, rayon), (a1, rayon), (a1, 0)], axe, centre, segments, mat)


def point(axe, centre, a, u, w):
    """Le point d'abscisse `a` sur l'axe 'x', 'y' ou 'z' passant par `centre`, décalé de (u, w) dans le plan normal ; `axe`
    peut être un repère de trois vecteurs unitaires : l'axe, puis les deux du plan normal."""
    if not isinstance(axe, str):
        return tuple(np.asarray(centre) + a * np.asarray(axe[0]) + u * np.asarray(axe[1]) + w * np.asarray(axe[2]))
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
    """Tore d'axe 'x', 'y' ou 'z' (anneau plaqué contre une face de cette normale), ou du repère `axe` (`point`)."""
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


def faces_des_coins(debuts, totaux):
    """La face de chaque coin, chaque face portant ses `totaux` coins contigus à partir de `debuts`."""
    n = int(totaux.sum())
    face = np.empty(n, dtype=np.int64)
    face[np.repeat(debuts, totaux) + np.arange(n) - np.repeat(np.cumsum(totaux) - totaux, totaux)] = np.repeat(np.arange(len(debuts)), totaux)
    return face


def uv_cubiques(positions, coins, debuts, totaux):
    """Les UV en mètres de chaque coin (#4313) : chaque face projetée sur le plan de l'axe dominant de sa normale (Newell,
    calculée de `positions`, les sommets `(n, 3)`), ses UV ses deux autres coordonnées (`AUTRES_AXES`) ; `coins` porte le
    sommet de chaque coin (`faces_des_coins`)."""
    p = positions[coins]
    suivants = np.arange(len(coins)) + 1
    suivants[debuts + totaux - 1] = debuts
    face = faces_des_coins(debuts, totaux)
    normales = np.zeros((len(debuts), 3))
    np.add.at(normales, face, np.cross(p, p[suivants]))
    return np.take_along_axis(p, AUTRES_AXES[np.abs(normales).argmax(axis=1)][face], axis=1)


def poser_les_uv_en_metres(objet):
    """Pose sur la première couche d'UV de `objet`, créée si absente, les UV en mètres de ses faces au repos
    (`uv_cubiques`), hors des faces dont la brique a donné les UV (`UV_DE_LA_BRIQUE`), qui gardent les leurs (#4313)."""
    me = objet.data

    def lire(collection, champ, largeur, type_):
        valeurs = np.empty(len(collection) * largeur, dtype=type_)
        collection.foreach_get(champ, valeurs)
        return valeurs.reshape(-1, largeur) if largeur > 1 else valeurs
    debuts, totaux = lire(me.polygons, "loop_start", 1, np.int64), lire(me.polygons, "loop_total", 1, np.int64)
    couche = me.uv_layers[0] if me.uv_layers else me.uv_layers.new(name="UVMap")
    uv = lire(couche.data, "uv", 2, np.float32)
    donnees = me.attributes.get(UV_DE_LA_BRIQUE)
    garde = (lire(donnees.data, "value", 1, bool) if donnees else np.zeros(len(debuts), bool))[faces_des_coins(debuts, totaux)]
    cubiques = uv_cubiques(lire(me.vertices, "co", 3, np.float64), lire(me.loops, "vertex_index", 1, np.int64), debuts, totaux)
    uv[~garde] = cubiques[~garde]
    couche.data.foreach_set("uv", uv.ravel())


def objet(nom, maille, origine, angle_lisse):
    """L'objet `nom`, ses sommets ramenés à `origine`, triangulé, normales extérieures, lissé par angle ; seuls les
    matériaux que portent ses faces lui sont attachés, dans l'ordre de la maille ; les faces dont la maille porte les UV
    les gardent, marquées `UV_DE_LA_BRIQUE`, les autres sont à (0, 0)."""
    utilises = sorted(set(maille.m))
    renum = {m: i for i, m in enumerate(utilises)}
    ox, oy, oz = origine
    donnees = bpy.data.meshes.new(nom)
    donnees.from_pydata([(x - ox, y - oy, z - oz) for x, y, z in maille.v], [], maille.f)
    for poly, m in zip(donnees.polygons, maille.m):
        poly.material_index = renum[m]
    couche = donnees.uv_layers.new(name="UVMap", do_init=False)
    for poly, coins in zip(donnees.polygons, maille.uv):
        for boucle, uv in zip(poly.loop_indices, coins or ()):
            couche.data[boucle].uv = uv
    donnees.attributes.new(UV_DE_LA_BRIQUE, "BOOLEAN", "FACE").data.foreach_set("value", [c is not None for c in maille.uv])
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


def monter(noeuds, angle_lisse):
    """Les objets des `noeuds` {nom: (maille, pivot)}, dans leur ordre, l'emprise de toutes leurs mailles recentrée en
    x et y (`recentrer`) : chacun à son pivot, déplacé d'autant, ou à l'origine du monde sans pivot."""
    dx, dy = recentrer([maille for maille, _ in noeuds.values()])
    for nom, (maille, pivot) in noeuds.items():
        objet(nom, maille, (pivot[0] + dx, pivot[1] + dy, pivot[2]) if pivot else (0.0, 0.0, 0.0), angle_lisse)
