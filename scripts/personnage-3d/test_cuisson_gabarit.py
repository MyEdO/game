"""#3104 issuecomment-6543628310."""
import json
import sys
import unittest
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))
from cuisson_gabarit import ATTRIBUT_SOMMET, corps_du_gabarit, preparer_reference, vers_gltf  # noqa: E402
from formes import positions, poser_la_cle  # noqa: E402
from script_node import lancer  # noqa: E402


class GrapheDuGabarit(unittest.TestCase):
    def setUp(self):
        mesh = bpy.data.meshes.new('couture')
        mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)],
                         [], [(0, 1, 2), (3, 4, 5)])
        self.peau = bpy.data.objects.new('couture', mesh)
        self.peau.vertex_groups.new(name='root').add([1, 2, 3, 4, 5], .5, 'REPLACE')
        self.peau.vertex_groups.new(name='leg').add([0], 1, 'REPLACE')
        self.peau.vertex_groups['leg'].add([1, 2, 3, 4, 5], .5, 'REPLACE')
        poser_la_cle(self.peau, 'corpulence', np.tile([0, 0, .1], (6, 1)))

    def tearDown(self):
        mesh = self.peau.data
        bpy.data.objects.remove(self.peau, do_unlink=True)
        bpy.data.meshes.remove(mesh)

    def test_les_sommets_jumeaux_partagent_positions_poids_et_silhouettes(self):
        corps, noeud = corps_du_gabarit(self.peau, ['root', 'leg'], [])
        self.assertEqual(noeud.tolist(), [0, 1, 2, 1, 3, 2])
        self.assertEqual(len(corps['positions']), 4)
        self.assertEqual(len(corps['aretes']), 5)
        self.assertEqual(corps['poids'], [[(1, 1.0)], [(0, .5), (1, .5)], [(0, .5), (1, .5)], [(0, .5), (1, .5)]])
        np.testing.assert_allclose(corps['silhouettes'][0]['deltas'], np.tile([0, 0, .1], (4, 1)))

    def test_le_quotient_relie_une_composante_sans_ancre(self):
        identite = np.eye(4)
        local = identite.copy()
        local[1, 3] = 1
        squelette = [{'nom': 'root', 'parent': None, 'repos': identite.T.ravel().tolist(),
                      'boneInverse': identite.T.ravel().tolist()},
                     {'nom': 'leg', 'parent': 0, 'repos': local.T.ravel().tolist(),
                      'boneInverse': np.linalg.inv(local).T.ravel().tolist()}]
        corps, _ = corps_du_gabarit(self.peau, ['root', 'leg'], squelette)
        table = {'racine': 'root', 'legs': ['leg'], 'arms': [], 'head': [], 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12}, 'arms': {'min': 1, 'max': 1.6},
                            'head': {'min': 1, 'max': 1.9}}}
        resultat = json.loads(lancer(Path(__file__).resolve().parent / 'base/gabarit.mjs', [],
                                    json.dumps({'table': table, 'corps': corps})))
        self.assertEqual(resultat['ancres'], 1)
        self.assertTrue(resultat['cles'])
        self.assertTrue(all(len(cle['deltas']) == 4 for cle in resultat['cles']))

    def test_la_reference_des_silhouettes_exclut_le_gabarit_et_garde_les_memes_poids(self):
        deltas = np.zeros((6, 3))
        deltas[[1, 3], 2] = .8
        poser_la_cle(self.peau, 'corpulence', deltas)
        co = positions(self.peau.data)
        gabarit = np.zeros((6, 3))
        gabarit[[2, 5], 2] = 1
        poser_la_cle(self.peau, 'gabarit_legs_moins', gabarit)
        attribut = self.peau.data.attributes.new(ATTRIBUT_SOMMET, 'INT', 'POINT')
        attribut.data.foreach_set('value', np.arange(6, dtype=np.int32))
        etat = {'nom': 'mixte', 'poids': {'corpulence': .5, 'gabarit_legs_moins': 1},
                'positions': (co + .5 * deltas + gabarit).tolist()}
        cles_avant = [cle.name for cle in self.peau.data.shape_keys.key_blocks]
        reference = preparer_reference([self.peau], [(0, 6, {'etats': [etat]})])
        cle = poser_la_cle(self.peau, 'attendu', .5 * deltas)
        attendu = vers_gltf(np.array(cle.normals_split_get()).reshape(-1, 3))
        self.peau.shape_key_remove(cle)
        np.testing.assert_allclose(reference['normales_silhouettes'][0], attendu)
        self.assertGreater(np.max(np.abs(reference['normales'][0] - attendu)), .1)
        self.assertEqual([cle.name for cle in self.peau.data.shape_keys.key_blocks], cles_avant)


if __name__ == '__main__':
    unittest.main()
