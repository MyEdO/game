"""#3104 issuecomment-6549354475."""
import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

import numpy as np

BASE = Path(__file__).resolve().parent / 'base'
sys.path.insert(0, str(BASE))
from poids import avancer_correction, etats_ponderes, extremes, preparer_correction, refuser_correction
from script_node import lancer
from test_silhouettes import groupe_a_un_clip


def mesures_croisees(variante='original'):
    entree = json.loads(lancer(BASE / 'mesure_poids.testkit.mjs', [variante], ''))
    x = np.array(entree['x'], dtype=np.float32)
    w = np.array(entree['w'], dtype=np.float32)
    deltas = {nom: np.array(d, dtype=np.float32) for nom, d in entree['deltas'].items()}
    matrices = np.array(entree['matrices'], dtype=np.float32)
    aretes = np.array(entree['aretes'], dtype=int)
    groupes = etats_ponderes(x, deltas, [({'etats': [entree['etat']], 'cellulesSilhouettes': []}, [matrices], (2,))])
    traces = []
    bas, haut = extremes(w, aretes, groupes, traces)
    entree['reposPython'] = float(traces[0].rapports_repos[0, 0])
    entree['coteReposPython'] = int(traces[0].cotes_repos[0, 0])
    return entree, bas, haut


class MesureCroiseeDesPoids(unittest.TestCase):
    def test_la_construction_mesure_la_garde_sur_la_meme_peau(self):
        for variante in ['original', 'modifie']:
            with self.subTest(poids=variante):
                entree, bas, haut = mesures_croisees(variante)
                self.assertAlmostEqual(float(bas[0, 0]), entree['garde']['minimum'], places=5)
                self.assertAlmostEqual(float(haut[0, 0]), entree['garde']['maximum'], places=5)
                self.assertEqual(entree['garde']['aretesMesurees'], [[[0, 1]], [[0, 1]]])
                repos = entree['garde']['repos']
                ref, pose = np.array(repos['reference']).reshape(-1, 3), np.array(repos['positions']).reshape(-1, 3)
                attendu = np.linalg.norm(pose[0] - pose[1]) / np.linalg.norm(ref[0] - ref[1])
                self.assertAlmostEqual(entree['reposPython'], attendu, places=5)
                self.assertEqual(entree['coteReposPython'], -1)
                self.assertEqual(repos['ecarts'], [])
                self.assertTrue(np.isinf(bas[0, 1]))
                self.assertEqual(float(haut[0, 1]), 0)

    def test_les_clauses_repos_et_clip_restent_distinctes(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
        w = np.ones((2, 1), dtype=np.float32)
        aretes = np.array([[0, 1]])
        for rapport_repos, refuse in [(3.5, False), (3.75, True), (.2, True)]:
            with self.subTest(rapport_repos=rapport_repos):
                forme = x.copy()
                forme[1, 0] = rapport_repos
                matrices = np.tile(np.eye(4, dtype=np.float32), (2, 1, 1, 1))
                matrices[1, 0, 0, 0] = 1 / rapport_repos
                groupes = [groupe_a_un_clip(forme[None], x[None], matrices, [])]
                etat = preparer_correction('repos', x, w, np.arange(2), aretes, groupes)
                self.assertFalse(etat['horsClip'].any())
                self.assertEqual(bool(etat['horsRepos'].any()), refuse)
                if refuse:
                    with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError) as erreur:
                        refuser_correction(etat, 0)
                    self.assertEqual(erreur.exception.diagnostic['aretes'][0]['parEtat'][0]['repos']['clause'], 'R')
                else:
                    self.assertFalse(avancer_correction(etat))
                    np.testing.assert_array_equal(etat['w'], w)
                    self.assertEqual(etat['retouches'], set())


if __name__ == '__main__':
    unittest.main()
