"""UV en mètres d'un élément sur base (`maille.poser_les_uv_en_metres`, #4313) : sur un cube d'un mètre décalé de
l'origine, chaque face porte en UV ses deux coordonnées hors de l'axe de sa normale, en mètres ; une face dont la brique
a donné les UV (`maille.objet`) les garde, les autres sortent de `maille.objet` à (0, 0) (un modèle sans
`poser_les_uv_en_metres`, véhicule ou décor, les exporte telles) ; un pentagone oblique se projette sur le plan de l'axe
dominant de sa normale."""
import sys
import unittest
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from maille import Maille, objet, poser_les_uv_en_metres  # noqa: E402

ORIGINE = np.array([0.25, -1.0, 2.0])
FACES = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
"""Les six faces du cube de `cube` : -z, +z, -y, +x, +y, -x."""
AXES = [2, 2, 1, 0, 1, 0]
"""L'axe de la normale de chaque face de `FACES`."""
SOMMETS = [ORIGINE + d for d in ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))]
DONNEE = 3
"""La face +x, dont la brique donne les UV dans `cube_de_la_brique`."""
UV_DONNEES = [(0.1, 0.2), (0.3, 0.2), (0.3, 0.4), (0.1, 0.4)]


def cube():
    """Un cube d'un mètre, coin à `ORIGINE`, ses UV à (0,5 ; 0,5)."""
    me = bpy.data.meshes.new("cube")
    me.from_pydata([tuple(s) for s in SOMMETS], [], FACES)
    couche = me.uv_layers.new(name="UVMap")
    couche.data.foreach_set("uv", [0.5] * 2 * len(me.loops))
    cube_ = bpy.data.objects.new("cube", me)
    bpy.context.scene.collection.objects.link(cube_)
    return cube_


def cube_de_la_brique():
    """Le cube bâti par `maille.objet`, la brique donnant les UV `UV_DONNEES` de sa face `DONNEE`, pas des autres."""
    m = Maille([bpy.data.materials.new("bois")])
    m.ajouter(SOMMETS, [f for i, f in enumerate(FACES) if i != DONNEE], "bois")
    m.ajouter(SOMMETS, [FACES[DONNEE]], "bois", [UV_DONNEES])
    return objet("cube", m, (0.0, 0.0, 0.0), 30.0)


def uv_de(objet):
    """Par face, les UV de ses coins, dans l'ordre de ses sommets."""
    me = objet.data
    return [[tuple(me.uv_layers[0].data[b].uv) for b in poly.loop_indices] for poly in me.polygons]


class UvEnMetres(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_chaque_face_porte_ses_coordonnees_hors_de_sa_normale_en_metres(self):
        cube_ = cube()
        poser_les_uv_en_metres(cube_)
        me = cube_.data
        for i, (poly, uvs) in enumerate(zip(me.polygons, uv_de(cube_))):
            autres = [a for a in range(3) if a != AXES[i]]
            attendus = [tuple(np.array(me.vertices[v].co)[autres]) for v in poly.vertices]
            np.testing.assert_allclose(uvs, attendus, atol=1e-6, err_msg=f"face {FACES[i]}")

    def test_une_face_garde_les_uv_de_sa_brique(self):
        cube_ = cube_de_la_brique()
        poser_les_uv_en_metres(cube_)
        me = cube_.data
        donnees = {tuple(np.round(SOMMETS[k] - ORIGINE, 6)): uv for k, uv in zip(FACES[DONNEE], UV_DONNEES)}
        vus = 0
        for poly, uvs in zip(me.polygons, uv_de(cube_)):
            coins = [tuple(np.round(np.array(me.vertices[v].co) - ORIGINE, 6)) for v in poly.vertices]
            if all(c[0] == 1.0 for c in coins):
                np.testing.assert_allclose(uvs, [donnees[c] for c in coins], atol=1e-6)
                vus += 1
            else:
                axe = int(np.argmax(np.abs(np.array(poly.normal))))
                np.testing.assert_allclose(uvs, [np.array(me.vertices[v].co)[[a for a in range(3) if a != axe]]
                                                 for v in poly.vertices], atol=1e-6)
        self.assertEqual(vus, 2)

    def test_une_face_sans_uv_de_sa_brique_sort_de_objet_a_zero(self):
        """#4394. Une face dont la brique ne donne pas les UV sort de `maille.objet` à (0, 0), pas au dépliage par face
        d'une couche neuve de Blender : ses coutures doubleraient les sommets des modèles exportés sans
        `poser_les_uv_en_metres`."""
        cube_ = cube_de_la_brique()
        for poly, uvs in zip(cube_.data.polygons, uv_de(cube_)):
            coins = [tuple(np.round(np.array(cube_.data.vertices[v].co) - ORIGINE, 6)) for v in poly.vertices]
            if not all(c[0] == 1.0 for c in coins):
                np.testing.assert_array_equal(uvs, [(0.0, 0.0)] * len(uvs))

    def test_une_face_oblique_se_projette_sur_le_plan_de_son_axe_dominant(self):
        sommets = [(0, 0, 0), (1, 0, 0.2), (1.2, 1, 0.5), (0.4, 1.3, 0.4), (-0.2, 0.6, 0.1)]
        me = bpy.data.meshes.new("pan")
        me.from_pydata(sommets, [], [tuple(range(5))])
        pan = bpy.data.objects.new("pan", me)
        poser_les_uv_en_metres(pan)
        np.testing.assert_allclose(uv_de(pan)[0], [s[:2] for s in sommets], atol=1e-6)

    def test_un_mesh_sans_uv_recoit_sa_couche(self):
        cube_ = cube()
        cube_.data.uv_layers.remove(cube_.data.uv_layers[0])
        poser_les_uv_en_metres(cube_)
        self.assertEqual([c.name for c in cube_.data.uv_layers], ["UVMap"])
        np.testing.assert_allclose(uv_de(cube_)[DONNEE], [tuple(np.array(cube_.data.vertices[v].co)[[1, 2]]) for v in FACES[DONNEE]], atol=1e-6)


if __name__ == "__main__":
    unittest.main()
