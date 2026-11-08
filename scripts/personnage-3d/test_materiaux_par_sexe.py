"""materiaux_par_sexe (#3188) : la recouche d'une image d'un jeu d'UV sur un autre (identité, miroir et rotation, carte de
normales tournée, marge et fond), les UV lues dans le plan d'une face du donneur, et la variante `KHR_materials_variants`
que l'export glTF écrit."""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from glb import lire_glb  # noqa: E402
from materiaux_par_sexe import (DILATATION, NORMALE_PLATE, declarer_les_variantes, dilater, recoucher,  # noqa: E402
                                rotations_tangentes, texels, uv_lus)

CARRE = numpy.array([[[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 1], [0, 1]]], dtype=float)
"""Deux triangles qui couvrent tout le carré UV."""


def image(taille=8):
    """Une image (taille, taille, 4) dont chaque texel porte sa colonne et sa ligne."""
    y, x = numpy.mgrid[0:taille, 0:taille]
    return numpy.stack([x / taille, y / taille, numpy.full_like(x, 0.5, dtype=float), numpy.ones_like(x, dtype=float)],
                       axis=2).astype(float)


class Recouche(unittest.TestCase):
    def test_identite(self):
        source = image()
        self.assertTrue(numpy.allclose(recoucher(source, CARRE, CARRE, False), source))

    def test_miroir(self):
        source = image()
        miroir = CARRE.copy()
        miroir[..., 0] = 1 - miroir[..., 0]
        self.assertTrue(numpy.allclose(recoucher(source, CARRE, miroir, False), source[:, ::-1]))

    def test_les_normales_tournent_du_repere_uv(self):
        """Source lue en miroir de u : la tangente change de sens, la composante x de chaque normale aussi."""
        normale = numpy.array([0.8, 0.6, 0.0]) * 0.6 + numpy.array([0, 0, 0.8])
        source = numpy.tile(numpy.array([*(normale / numpy.linalg.norm(normale) + 1) / 2, 1.0]), (8, 8, 1))
        miroir = CARRE.copy()
        miroir[..., 0] = 1 - miroir[..., 0]
        lue = recoucher(source, CARRE, miroir, True)[..., :3] * 2 - 1
        attendue = normale / numpy.linalg.norm(normale) * [-1, 1, 1]
        self.assertTrue(numpy.allclose(lue, attendue, atol=1e-9))

    def test_rotation_d_un_quart_de_tour(self):
        cible = CARRE[:1]
        source = numpy.array([[[1, 0], [1, 1], [0, 1]]], dtype=float)
        self.assertTrue(numpy.allclose(rotations_tangentes(cible, source)[0], [[0, 1], [-1, 0]]))
        self.assertTrue(numpy.allclose(rotations_tangentes(numpy.zeros((1, 3, 2)), source)[0], numpy.eye(2)))

    def test_marge_puis_fond(self):
        """Un seul texel couvert : la marge s'étend de `DILATATION` texels, au-delà le fond (normale nulle)."""
        taille = 2 * DILATATION + 8
        petit = numpy.array([[[0.5, 0.5], [0.5 + 1.5 / taille, 0.5], [0.5, 0.5 + 1.5 / taille]]])
        normale = numpy.array([0.8, 0.5, 0.9, 1.0])
        sortie = recoucher(numpy.tile(normale, (taille, taille, 1)), petit, petit, True)
        couverts = numpy.isclose(sortie, normale).all(axis=2)
        lignes, colonnes = numpy.nonzero(couverts)
        self.assertEqual((lignes.max() - lignes.min(), colonnes.max() - colonnes.min()), (2 * DILATATION, 2 * DILATATION))
        self.assertTrue(numpy.allclose(sortie[~couverts], NORMALE_PLATE))

    def test_dilater_moyenne_les_voisins_couverts(self):
        pixels = numpy.zeros((3, 3, 1))
        pixels[0, 0], pixels[0, 2] = 1.0, 3.0
        couverts = numpy.zeros((3, 3), dtype=bool)
        couverts[0, 0] = couverts[0, 2] = True
        sortie, couverts = dilater(pixels, couverts, 1)
        self.assertEqual(sortie[0, 1, 0], 2.0)
        self.assertEqual(sortie[1, 1, 0], 2.0)
        self.assertFalse(couverts[2].any())

    def test_texels_couvre_chaque_centre_une_fois(self):
        colonnes, lignes, _, poids = texels(CARRE, 4, 4)
        self.assertEqual(sorted(set(zip(colonnes.tolist(), lignes.tolist()))), [(x, y) for x in range(4) for y in range(4)])
        self.assertTrue(numpy.allclose(poids.sum(axis=1), 1))


class UvLues(unittest.TestCase):
    def test_coins_projetes_dans_le_plan_de_la_face(self):
        surface = numpy.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=float)
        faces = numpy.array([[0, 1, 2]])
        uv = numpy.array([[[0.1, 0.1], [0.5, 0.1], [0.1, 0.5]]])
        coins = numpy.array([[[0, 0, 0.3], [1, 0, -0.2], [2, 0, 0]]], dtype=float)
        self.assertTrue(numpy.allclose(uv_lus(numpy.array([0]), coins, surface, faces, uv), [[[0.1, 0.1], [0.5, 0.1], [0.9, 0.1]]]))


class Variantes(unittest.TestCase):
    def test_l_export_porte_la_variante_du_nom_du_sexe(self):
        import bpy
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.mesh.primitive_plane_add()
        plan = bpy.context.object
        homme, femme = bpy.data.materials.new('peau_m'), bpy.data.materials.new('peau_f')
        plan.data.materials.append(homme)
        declarer_les_variantes(bpy, [plan], {'peau_m': {'F': femme}})
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / 'plan.glb'
            bpy.ops.export_scene.gltf(filepath=str(chemin), export_format='GLB')
            document, _ = lire_glb(chemin)
        noms = [m['name'] for m in document['materials']]
        self.assertEqual(document['extensions']['KHR_materials_variants']['variants'], [{'name': 'F'}])
        primitive = document['meshes'][0]['primitives'][0]
        self.assertEqual(noms[primitive['material']], 'peau_m')
        self.assertEqual([(noms[m['material']], m['variants']) for m in primitive['extensions']['KHR_materials_variants']['mappings']],
                         [('peau_f', [0])])


if __name__ == '__main__':
    unittest.main()
