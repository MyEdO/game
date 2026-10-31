"""#3104 issuecomment-6543628310."""
import contextlib
import io
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))
from porte_gabarit import point_de_cuisson, verifier_gabarit  # noqa: E402
from test_verifier_export import ecrire_glb  # noqa: E402


class PorteGabarit(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = Path(self.dossier.name) / 'base.glb'
        self.document = {'asset': {'version': '2.0'}, 'buffers': [], 'bufferViews': [], 'accessors': []}
        self.binaire = bytearray()
        p = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32)
        n = np.tile([0, 0, 1], (3, 1)).astype(np.float32)
        d = np.tile([0, 0, .1], (3, 1)).astype(np.float32)

        def acceder(valeurs):
            index = len(self.document['accessors'])
            self.document['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.binaire), 'byteLength': valeurs.nbytes})
            self.binaire.extend(valeurs.tobytes())
            self.document['accessors'].append({'bufferView': index, 'componentType': 5126, 'count': len(valeurs),
                                                'type': 'SCALAR' if valeurs.ndim == 1 else 'VEC3'})
            return index

        cible = {'POSITION': acceder(d), 'NORMAL': acceder(np.zeros_like(d))}
        primitive = {'attributes': {'POSITION': acceder(p), 'NORMAL': acceder(n),
                                     '_GABARIT_COIN': acceder(np.arange(3, dtype=np.float32))}, 'targets': [cible]}
        self.document['meshes'] = [{'name': 'corps', 'extras': {'targetNames': ['gabarit_legs_moins']},
                                    'primitives': [primitive]}]
        self.primitive = primitive
        self.reference = {'etats': np.array(json.dumps([{'nom': 'cuit', 'poids': {'gabarit_legs_moins': 1}}])),
                          'positions': np.array([p + d]), 'normales': np.array([n]),
                          'normales_silhouettes': np.array([n])}

    def tearDown(self):
        self.dossier.cleanup()

    def verifier(self):
        self.document['buffers'] = [{'byteLength': len(self.binaire)}]
        ecrire_glb(self.chemin, self.document, self.binaire)
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            verifier_gabarit(self.chemin, self.reference)
        return [json.loads(ligne.removeprefix('GABARIT_PORTE ')) for ligne in sortie.getvalue().splitlines()
                if ligne.startswith('GABARIT_PORTE ')]

    def perturber(self, attribut, valeur):
        acces = self.document['accessors'][self.primitive['targets'][0][attribut]]
        position = self.document['bufferViews'][acces['bufferView']]['byteOffset']
        struct.pack_into('<f', self.binaire, position, valeur)

    def test_le_temoin_passe(self):
        self.verifier()

    def test_un_delta_croise_perturbe_de_1e4_m_refuse(self):
        self.document['meshes'][0]['extras']['targetNames'][0] = 'gabarit_legs_moins_corpulence'
        self.reference['etats'] = np.array(json.dumps([{'nom': 'croise', 'poids': {'gabarit_legs_moins_corpulence': 1}}]))
        self.perturber('POSITION', 1e-4)
        with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
            self.verifier()

    def test_une_normale_exportee_fausse_refuse(self):
        self.perturber('NORMAL', .1)
        with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
            self.verifier()

    def test_une_normale_de_morph_absente_refuse(self):
        del self.primitive['targets'][0]['NORMAL']
        with self.assertRaisesRegex(RuntimeError, 'POSITION/NORMAL absent'):
            self.verifier()

    def test_une_cle_croisee_absente_refuse(self):
        self.document['meshes'][0]['extras']['targetNames'][0] = 'autre'
        with self.assertRaisesRegex(RuntimeError, 'clé gabarit_legs_moins absente'):
            self.verifier()

    def test_seule_une_cle_non_croisee_a_un_sans_silhouette_est_un_point_de_cuisson(self):
        for nom in ['gabarit_legs_moins', 'gabarit_legs_plus', 'gabarit_arms_plus', 'gabarit_head_plus']:
            self.assertTrue(point_de_cuisson({'poids': {nom: 1, 'feminin': 0, 'gabarit_head_moins': 0}}))
            self.assertFalse(point_de_cuisson({'poids': {nom: .5}}))
            self.assertFalse(point_de_cuisson({'poids': {nom: 1, 'feminin': 1}}))
        self.assertFalse(point_de_cuisson({'poids': {'gabarit_legs_moins_corpulence': 1}}))
        self.assertFalse(point_de_cuisson({'poids': {'gabarit_legs_moins': 1, 'gabarit_head_plus': 1}}))

    def test_les_normales_mixtes_sont_mesurees_avec_leur_base_sans_seuil(self):
        self.document['meshes'][0]['extras']['targetNames'].append('feminin')
        self.primitive['targets'].append(self.primitive['targets'][0].copy())
        self.reference['etats'] = np.array(json.dumps([{'nom': 'mixte', 'poids': {'gabarit_legs_moins': .5, 'feminin': .5}}]))
        self.perturber('NORMAL', 1)
        mesure = self.verifier()[0]
        self.assertFalse(mesure['normales_bloquantes'])
        self.assertGreater(mesure['normale_p99_deg'], 40)
        self.assertGreater(mesure['silhouettes_seules_p99_deg'], 20)
        self.assertLess(mesure['silhouettes_seules_p99_deg'], mesure['normale_p99_deg'])
        self.assertTrue(mesure['ok'])

    def test_les_normales_au_milieu_et_en_combinaison_sont_mesurees_sans_seuil(self):
        for nom, poids in [('milieu', .5), ('combinaison', 1.5)]:
            with self.subTest(nom=nom):
                self.reference['etats'] = np.array(json.dumps([{'nom': nom, 'poids': {'gabarit_legs_moins': poids}}]))
                self.reference['positions'][0, :, 2] = poids * .1
                self.perturber('NORMAL', 1)
                mesure = self.verifier()[0]
                self.assertFalse(mesure['normales_bloquantes'])
                self.assertGreater(mesure['normale_p99_deg'], 2)
                self.assertEqual(mesure['silhouettes_seules_max_deg'], 0)
                self.assertTrue(mesure['ok'])

    def test_une_normale_de_base_silhouettes_fausse_se_mesure_contre_son_oracle_propre(self):
        self.reference['normales_silhouettes'][0, :, 0] = 1
        mesure = self.verifier()[0]
        self.assertAlmostEqual(mesure['silhouettes_seules_p99_deg'], 45)
        self.assertEqual(mesure['normale_max_deg'], 0)

    def test_les_positions_restent_bloquantes_hors_point_de_cuisson(self):
        self.reference['etats'] = np.array(json.dumps([{'nom': 'milieu', 'poids': {'gabarit_legs_moins': .5}}]))
        self.reference['positions'][0, :, 2] = .05
        self.perturber('POSITION', 1e-4)
        with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
            self.verifier()

    def test_une_couverture_incomplete_des_coins_refuse(self):
        self.reference['positions'] = np.concatenate([self.reference['positions'], self.reference['positions'][:, :1]], axis=1)
        self.reference['normales'] = np.concatenate([self.reference['normales'], self.reference['normales'][:, :1]], axis=1)
        self.reference['normales_silhouettes'] = np.concatenate([self.reference['normales_silhouettes'], self.reference['normales_silhouettes'][:, :1]], axis=1)
        with self.assertRaisesRegex(RuntimeError, 'couverture des coins 3/4'):
            self.verifier()


if __name__ == '__main__':
    unittest.main()
