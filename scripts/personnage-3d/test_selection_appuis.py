"""#3104 issuecomment-6549354475."""
import json
import sys
import unittest
from pathlib import Path
import numpy as np
BASE = Path(__file__).resolve().parent / 'base'
sys.path.insert(0, str(BASE))
from script_node import lancer
from selection_appuis import copies_d_appui, selectionner_sommets


class SelectionDesMinima(unittest.TestCase):
    def test_le_minimum_est_global_aux_meshes_et_aux_groupes_et_suit_tous_les_echantillons(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 1, 1]], dtype=np.float32)
        w = np.eye(2, dtype=np.float32)
        matrices = np.tile(np.eye(4, dtype=np.float32), (2, 2, 1, 1))
        matrices[1, 1, 2, 3] = -2
        etats = [{'poidsSilhouettes': {}, 'poidsGabarit': {}}]
        self.assertEqual(selectionner_sommets(w, x, {}, [(etats, [matrices], (2,))]), [0, 1])
        self.assertEqual(selectionner_sommets(w, x, {}, [(etats, [matrices[:1]], (1,)), (etats, [matrices[1:]], (1,))]), [0, 1])
        self.assertEqual(selectionner_sommets(w, x, {}, [(etats, [matrices[:1]], (1,))]), [0])

    def test_le_non_pied_devenu_minimum_et_les_ex_aequo_sont_conserves(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 1, 1], [2, 0, 1, 1]], dtype=np.float32)
        w = np.ones((3, 1), dtype=np.float32)
        m = np.eye(4, dtype=np.float32)[None, None]
        d = np.array([[0, 0, 0], [0, 0, -2], [0, 0, -2]], dtype=np.float32)
        etats = [{'poidsSilhouettes': {}, 'poidsGabarit': {}},
                 {'poidsSilhouettes': {}, 'poidsGabarit': {'gabarit': 1}}]
        self.assertEqual(selectionner_sommets(w, x, {'gabarit': d}, [(etats, [m, m], (1,))]), [0, 1, 2])
        self.assertEqual(selectionner_sommets(w, x, {'gabarit': d}, [(etats[:1], [m], (1,))]), [0])


    def test_chaque_etat_est_pose_par_sa_pile(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
        w = np.eye(2, dtype=np.float32)
        a = np.tile(np.eye(4, dtype=np.float32), (1, 2, 1, 1))
        b = a.copy()
        a[0, 0, 2, 3] = -1
        b[0, 1, 2, 3] = -1
        etats = [{'poidsSilhouettes': {}, 'poidsGabarit': {}}] * 2
        self.assertEqual(selectionner_sommets(w, x, {}, [(etats, [a, b], ())]), [0, 1])
        self.assertEqual(selectionner_sommets(w, x, {}, [(etats, [a, a], ())]), [0])

class CopiesDAppui(unittest.TestCase):
    def test_les_copies_de_la_bande_sont_des_candidats_valides_qui_suivent_leur_sommet_en_repere_gltf(self):
        fixture = json.loads(lancer(BASE / 'appuis.testkit.mjs', ['fixture'], ''))

        def blender(g):
            return np.array(g, dtype=np.float32)[:, [0, 2, 1]] * np.float32([1, -1, 1])

        doublon = [0, 1, 2, 0]
        x = np.column_stack((blender(fixture['sommets']), np.ones(3, dtype=np.float32)))[doublon]
        w = np.eye(len(fixture['noms']), dtype=np.float32)[fixture['os']][doublon]
        deltas = {nom: blender(d)[doublon] for nom, d in fixture['deltas'].items()}
        copies = copies_d_appui(x, w, deltas, fixture['noms'], range(len(doublon)))
        self.assertEqual([list(c['deltas']) for c in copies], [[], [], [fixture['cle']]])
        verdict = json.loads(lancer(BASE / 'appuis.testkit.mjs', ['valider'], json.dumps(copies)))
        self.assertEqual(verdict['ecarts'], [])
        self.assertEqual(len(verdict['distances']), 3)
        for distance in verdict['distances']:
            self.assertLess(distance, 1e-6)


if __name__ == '__main__':
    unittest.main()
