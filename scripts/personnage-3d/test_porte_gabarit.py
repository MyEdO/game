"""#3104 issuecomment-6547804765."""
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
from porte_gabarit import normaliser, verifier_gabarit  # noqa: E402
from glb import lire_accesseur  # noqa: E402
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

        self.acceder = acceder
        cible = {'POSITION': acceder(d), 'NORMAL': acceder(np.zeros_like(d))}
        primitive = {'attributes': {'POSITION': acceder(p), 'NORMAL': acceder(n)},
                     'indices': acceder(np.arange(3, dtype=np.float32)), 'targets': [cible]}
        self.document['meshes'] = [{'name': 'corps', 'extras': {'targetNames': ['gabarit_legs_moins']},
                                    'primitives': [primitive]}]
        self.primitive = primitive
        self.reference = {'etats': np.array(json.dumps([{'nom': 'cuit', 'pointCuisson': True,
                                                        'poidsSilhouettes': {}, 'poidsGabarit': {'gabarit_legs_moins': 1}}])),
                          'sens_cuits': np.array(1), 'base': p, 'triangles': np.array([[0, 1, 2]]),
                          'meshes': np.array(json.dumps([{'nom': 'corps', 'triangles': [0, 1], 'coins': [0, 3]}])),
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
        self.fusions = [json.loads(ligne.removeprefix('GABARIT_FUSIONS ')) for ligne in sortie.getvalue().splitlines()
                        if ligne.startswith('GABARIT_FUSIONS ')]
        return [json.loads(ligne.removeprefix('GABARIT_PORTE ')) for ligne in sortie.getvalue().splitlines()
                if ligne.startswith('GABARIT_PORTE ')]

    def perturber(self, attribut, valeur):
        acces = self.document['accessors'][self.primitive['targets'][0][attribut]]
        position = self.document['bufferViews'][acces['bufferView']]['byteOffset']
        struct.pack_into('<f', self.binaire, position, valeur)

    def etat(self, nom, poids, silhouettes=None, point=False):
        self.reference['etats'] = np.array(json.dumps([{'nom': nom, 'poidsGabarit': poids,
                                                       'poidsSilhouettes': silhouettes or {}, 'pointCuisson': point}]))
        self.reference['sens_cuits'] = np.array(int(point))

    def test_le_temoin_passe(self):
        self.verifier()

    def test_un_delta_croise_perturbe_de_1e4_m_refuse(self):
        self.document['meshes'][0]['extras']['targetNames'][0] = 'gabarit_legs_moins_corpulence'
        self.etat('croise', {'gabarit_legs_moins_corpulence': 1})
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

    def test_une_normale_fausse_au_point_cuit_avec_silhouette_infime_refuse(self):
        for poids in (0, 1e-12):
            with self.subTest(poids=poids):
                self.document['meshes'][0]['extras']['targetNames'] = ['nom_libre', 'forme_libre']
                self.primitive['targets'] = [self.primitive['targets'][0]] * 2
                self.etat('cuit', {'nom_libre': 1}, {'forme_libre': poids}, point=True)
                self.perturber('NORMAL', .1)
                with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
                    self.verifier()

    def test_les_normales_mixtes_sont_mesurees_avec_leur_base_sans_seuil(self):
        self.document['meshes'][0]['extras']['targetNames'].append('feminin')
        self.primitive['targets'].append(self.primitive['targets'][0].copy())
        self.etat('mixte', {'gabarit_legs_moins': .5}, {'feminin': .5})
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
                self.etat(nom, {'gabarit_legs_moins': poids})
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
        self.etat('milieu', {'gabarit_legs_moins': .5})
        self.reference['positions'][0, :, 2] = .05
        self.perturber('POSITION', 1e-4)
        with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
            self.verifier()

    def test_une_couverture_incomplete_des_coins_refuse(self):
        self.reference['meshes'] = np.array(json.dumps([{'nom': 'corps', 'triangles': [0, 1], 'coins': [0, 4]}]))
        self.reference['positions'] = np.concatenate([self.reference['positions'], self.reference['positions'][:, :1]], axis=1)
        self.reference['normales'] = np.concatenate([self.reference['normales'], self.reference['normales'][:, :1]], axis=1)
        self.reference['normales_silhouettes'] = np.concatenate([self.reference['normales_silhouettes'], self.reference['normales_silhouettes'][:, :1]], axis=1)
        with self.assertRaisesRegex(RuntimeError, 'couverture des coins 3/4'):
            self.verifier()

    def test_normales_nulles_ou_non_finies_refusent(self):
        for n in (np.zeros((1, 3)), np.array([[np.nan, 0, 1]])):
            with self.assertRaisesRegex(RuntimeError, 'normales non finies ou nulles'):
                normaliser(n)

    def test_noms_et_cibles_en_nombre_different_refusent(self):
        self.primitive['targets'] = []
        with self.assertRaisesRegex(RuntimeError, 'noms de clés et cibles'):
            self.verifier()

    def test_mesure_non_finie_refuse(self):
        self.reference['positions'][0, 0, 0] = np.nan
        with self.assertRaisesRegex(RuntimeError, 'mesure non finie'):
            self.verifier()

    def test_point_de_cuisson_manquant_refuse(self):
        self.reference['sens_cuits'] = np.array(2)
        with self.assertRaisesRegex(RuntimeError, 'nombre de points de cuisson'):
            self.verifier()

    def test_indice_de_sommet_hors_plage_et_fractionnaire_refusent(self):
        for valeur in (7, .5, -1):
            access = self.document['accessors'][self.primitive['indices']]
            offset = self.document['bufferViews'][access['bufferView']]['byteOffset']
            struct.pack_into('<f', self.binaire, offset, valeur)
            with self.assertRaisesRegex(RuntimeError, 'indices de sommet invalides'):
                self.verifier()

    def test_attribut_sans_consommateur_refuse(self):
        self.primitive['attributes']['_INSTRUMENT'] = self.primitive['indices']
        with self.assertRaisesRegex(RuntimeError, 'attribut livré sans consommateur'):
            self.verifier()

    def test_triangle_sans_reference_refuse(self):
        self.reference['base'][0, 0] = 2
        with self.assertRaisesRegex(RuntimeError, 'triangle livré sans référence'):
            self.verifier()

    def fusionner_les_coins(self):
        self.reference['base'] = np.concatenate([self.reference['base']] * 2)
        self.reference['triangles'] = np.array([[0, 1, 2], [3, 4, 5]])
        self.reference['meshes'] = np.array(json.dumps([{'nom': 'corps', 'triangles': [0, 2], 'coins': [0, 6]}]))
        for champ in ('positions', 'normales', 'normales_silhouettes'):
            self.reference[champ] = np.concatenate([self.reference[champ]] * 2, axis=1)

    def test_coins_fusionnes_avec_normales_sous_seuil_passent_et_sont_mesures(self):
        self.fusionner_les_coins()
        self.reference['normales'][0, 3, 0] = .01
        mesure = self.verifier()[0]
        self.assertGreater(mesure['normale_max_deg'], .57)
        self.assertAlmostEqual(mesure['normale_p99_deg'], .98 * mesure['normale_max_deg'])
        self.assertEqual(self.fusions[0]['fusions'], 3)
        self.assertEqual(self.fusions[0]['references_differentes'], 1)
        self.assertAlmostEqual(self.fusions[0]['normale_max_deg'], mesure['normale_max_deg'], places=6)

    def test_coins_fusionnes_avec_normales_au_dessus_du_seuil_refusent_par_la_porte(self):
        self.fusionner_les_coins()
        self.reference['normales'][0, 3, 0] = .1
        with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
            self.verifier()

    def test_coins_fusionnes_avec_positions_sous_seuil_passent_et_sont_mesures(self):
        self.fusionner_les_coins()
        self.reference['positions'][0, 3, 0] += 5e-6
        mesure = self.verifier()[0]
        self.assertAlmostEqual(mesure['position_max_m'], 5e-6)
        self.assertAlmostEqual(self.fusions[0]['position_max_m'], 5e-6)

    def test_coins_fusionnes_avec_positions_au_dessus_du_seuil_refusent_par_la_porte(self):
        self.fusionner_les_coins()
        self.reference['positions'][0, 3, 0] += 2e-5
        with self.assertRaisesRegex(RuntimeError, 'porte refusée'):
            self.verifier()

    def test_mesh_absent_refuse(self):
        self.document['meshes'][0]['name'] = 'inconnu'
        with self.assertRaisesRegex(RuntimeError, 'mesh de référence absent'):
            self.verifier()

    def test_mesh_de_reference_absent_du_glb_refuse_la_couverture_globale(self):
        self.reference['meshes'] = np.array(json.dumps([
            {'nom': 'corps', 'triangles': [0, 1], 'coins': [0, 3]},
            {'nom': 'absent', 'triangles': [1, 2], 'coins': [3, 6]}]))
        self.reference['base'] = np.concatenate([self.reference['base']] * 2)
        self.reference['triangles'] = np.array([[0, 1, 2], [3, 4, 5]])
        for champ in ('positions', 'normales', 'normales_silhouettes'):
            self.reference[champ] = np.concatenate([self.reference[champ]] * 2, axis=1)
        with self.assertRaisesRegex(RuntimeError, 'couverture des coins 3/6'):
            self.verifier()

    def test_attributs_base_de_tailles_differentes_refusent(self):
        self.document['accessors'][self.primitive['attributes']['NORMAL']]['count'] = 2
        with self.assertRaisesRegex(RuntimeError, 'attributs de base invalides'):
            self.verifier()

    def test_sommet_livre_sans_coin_refuse(self):
        self.primitive['attributes']['POSITION'] = self.acceder(np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [2, 2, 2]], dtype=np.float32))
        self.primitive['attributes']['NORMAL'] = self.acceder(np.tile([0, 0, 1], (4, 1)).astype(np.float32))
        with self.assertRaisesRegex(RuntimeError, 'sommet livré sans coin'):
            self.verifier()

    def test_triangles_identiques_aux_references_identiques_passent(self):
        self.reference['base'] = np.concatenate([self.reference['base']] * 2)
        self.reference['triangles'] = np.array([[0, 1, 2], [3, 4, 5]])
        self.reference['meshes'] = np.array(json.dumps([{'nom': 'corps', 'triangles': [0, 2], 'coins': [0, 6]}]))
        for champ in ('positions', 'normales', 'normales_silhouettes'):
            self.reference[champ] = np.concatenate([self.reference[champ]] * 2, axis=1)
        self.verifier()

    def test_accesseur_creux_sans_base_et_normalise(self):
        document = {'accessors': [{'componentType': 5121, 'type': 'SCALAR', 'count': 3, 'normalized': True,
                                  'sparse': {'count': 1, 'indices': {'bufferView': 0, 'componentType': 5121},
                                             'values': {'bufferView': 1}}}],
                    'bufferViews': [{'byteOffset': 0, 'byteLength': 1}, {'byteOffset': 1, 'byteLength': 1}]}
        np.testing.assert_allclose(lire_accesseur(document, bytes([1, 255]), 0), [[0], [1], [0]])
        document['accessors'][0]['bufferView'] = 2
        document['bufferViews'].append({'byteOffset': 2, 'byteLength': 3})
        np.testing.assert_allclose(lire_accesseur(document, bytes([1, 255, 10, 20, 30]), 0), [[10 / 255], [1], [30 / 255]])

    def test_accesseur_creux_refuse_indices_invalides_et_depassement(self):
        document = {'accessors': [{'componentType': 5126, 'type': 'SCALAR', 'count': 3,
                                  'sparse': {'count': 2, 'indices': {'bufferView': 0, 'componentType': 5121},
                                             'values': {'bufferView': 1}}}],
                    'bufferViews': [{'byteOffset': 0, 'byteLength': 2}, {'byteOffset': 2, 'byteLength': 8}]}
        for indices in ([1, 1], [2, 1], [1, 3]):
            with self.assertRaisesRegex(ValueError, 'Invalid sparse indices'):
                lire_accesseur(document, bytes(indices) + bytes(8), 0)
        with self.assertRaisesRegex(ValueError, 'overruns'):
            lire_accesseur(document, bytes([0, 1]), 0)

    def test_accesseur_creux_refuse_indices_flottants(self):
        document = {'accessors': [{'componentType': 5126, 'type': 'SCALAR', 'count': 3,
                                  'sparse': {'count': 1, 'indices': {'bufferView': 0, 'componentType': 5126},
                                             'values': {'bufferView': 1}}}],
                    'bufferViews': [{'byteOffset': 0, 'byteLength': 4}, {'byteOffset': 4, 'byteLength': 4}]}
        with self.assertRaisesRegex(ValueError, 'Invalid sparse accessor'):
            lire_accesseur(document, bytes(8), 0)

    def test_accesseur_creux_refuse_trop_d_entrees(self):
        document = {'accessors': [{'componentType': 5126, 'type': 'SCALAR', 'count': 3,
                                  'sparse': {'count': 4, 'indices': {'bufferView': 0, 'componentType': 5121},
                                             'values': {'bufferView': 1}}}],
                    'bufferViews': [{'byteOffset': 0, 'byteLength': 4}, {'byteOffset': 4, 'byteLength': 16}]}
        with self.assertRaisesRegex(ValueError, 'Invalid sparse accessor'):
            lire_accesseur(document, bytes(20), 0)

    def test_accesseur_refuse_un_autre_buffer_que_le_chunk_bin(self):
        document = {'accessors': [{'componentType': 5126, 'type': 'SCALAR', 'count': 1, 'bufferView': 0}],
                    'bufferViews': [{'buffer': 1, 'byteOffset': 0, 'byteLength': 4}]}
        with self.assertRaisesRegex(ValueError, 'outside the GLB BIN chunk'):
            lire_accesseur(document, bytes(4), 0)

    def test_accesseur_refuse_un_depassement_de_vue_meme_si_le_bin_est_assez_long(self):
        document = {'accessors': [{'componentType': 5126, 'type': 'SCALAR', 'count': 2, 'bufferView': 0}],
                    'bufferViews': [{'byteOffset': 0, 'byteLength': 4}]}
        with self.assertRaisesRegex(ValueError, 'overruns the BIN chunk'):
            lire_accesseur(document, bytes(8), 0)


if __name__ == '__main__':
    unittest.main()
