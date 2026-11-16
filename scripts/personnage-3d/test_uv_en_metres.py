"""UV en mètres d'un élément sur base (`maille.poser_les_uv_en_metres`, #4313) : sur un cube d'un mètre décalé de
l'origine, chaque face porte en UV ses deux coordonnées hors de l'axe de sa normale, en mètres ; une face d'un matériau
blason garde ses UV ; un pentagone oblique se projette sur le plan de l'axe dominant de sa normale."""
import sys
import unittest
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from maille import poser_les_uv_en_metres  # noqa: E402

ORIGINE = np.array([0.25, -1.0, 2.0])
FACES = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
"""Les six faces du cube de `cube` : -z, +z, -y, +x, +y, -x."""
AXES = [2, 2, 1, 0, 1, 0]
"""L'axe de la normale de chaque face de `FACES`."""
BLASON = 3
UV_DU_BLASON = (0.5, 0.5)


def cube():
    """Un cube d'un mètre, coin à `ORIGINE`, la face +x du matériau `blason`, ses UV à `UV_DU_BLASON`, les autres du
    matériau `bois`."""
    sommets = [ORIGINE + d for d in ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))]
    me = bpy.data.meshes.new("cube")
    me.from_pydata([tuple(s) for s in sommets], [], FACES)
    for nom in ("bois", "blason"):
        me.materials.append(bpy.data.materials.new(nom))
    for i, poly in enumerate(me.polygons):
        poly.material_index = 1 if i == BLASON else 0
    couche = me.uv_layers.new(name="UVMap")
    for boucle in me.polygons[BLASON].loop_indices:
        couche.data[boucle].uv = UV_DU_BLASON
    objet = bpy.data.objects.new("cube", me)
    bpy.context.scene.collection.objects.link(objet)
    return objet


def uv_de(objet):
    """Par face, les UV de ses coins, dans l'ordre de ses sommets."""
    me = objet.data
    return [[tuple(me.uv_layers[0].data[b].uv) for b in poly.loop_indices] for poly in me.polygons]


class UvEnMetres(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_chaque_face_porte_ses_coordonnees_hors_de_sa_normale_en_metres(self):
        objet = cube()
        poser_les_uv_en_metres(objet, ("blason",))
        me = objet.data
        for i, (poly, uvs) in enumerate(zip(me.polygons, uv_de(objet))):
            if i == BLASON:
                continue
            autres = [a for a in range(3) if a != AXES[i]]
            attendus = [tuple(np.array(me.vertices[v].co)[autres]) for v in poly.vertices]
            np.testing.assert_allclose(uvs, attendus, atol=1e-6, err_msg=f"face {FACES[i]}")

    def test_une_face_blason_garde_ses_uv(self):
        objet = cube()
        poser_les_uv_en_metres(objet, ("blason",))
        np.testing.assert_allclose(uv_de(objet)[BLASON], [UV_DU_BLASON] * 4, atol=1e-7)

    def test_une_face_oblique_se_projette_sur_le_plan_de_son_axe_dominant(self):
        sommets = [(0, 0, 0), (1, 0, 0.2), (1.2, 1, 0.5), (0.4, 1.3, 0.4), (-0.2, 0.6, 0.1)]
        me = bpy.data.meshes.new("pan")
        me.from_pydata(sommets, [], [tuple(range(5))])
        objet = bpy.data.objects.new("pan", me)
        poser_les_uv_en_metres(objet, ())
        np.testing.assert_allclose(uv_de(objet)[0], [s[:2] for s in sommets], atol=1e-6)

    def test_un_mesh_sans_uv_recoit_sa_couche(self):
        objet = cube()
        objet.data.uv_layers.remove(objet.data.uv_layers[0])
        poser_les_uv_en_metres(objet, ())
        self.assertEqual([c.name for c in objet.data.uv_layers], ["UVMap"])
        np.testing.assert_allclose(uv_de(objet)[BLASON], [tuple(np.array(objet.data.vertices[v].co)[[1, 2]]) for v in FACES[BLASON]], atol=1e-6)


if __name__ == "__main__":
    unittest.main()
