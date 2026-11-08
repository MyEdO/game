"""Primitives de maillage des véhicules (#2987), communes aux modèles de `vehicule/<modele>/modele.py` : la maille
accumulée en coordonnées du monde, l'interpolation des tables de forme, la poutre et l'objet Blender final.

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
