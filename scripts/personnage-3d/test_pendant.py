"""pendant.pendre : un brin libre pend d'aplomb ; il sort d'une peau, d'un fût et du sol en gardant la longueur de ses
os ; pris de face, il tourne vers son dégagement ; il revient à l'aplomb dès qu'il ne touche plus ; il bouge peu quand
l'obstacle bouge peu."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from pendant import BAS, JEU_M, Fut, Peaux, Sol, pendre  # noqa: E402

LONGUEURS = np.array([[0.1, 0.1, 0.1]])
VERS_X = np.array([[1.0, 0.0, 0.0]])


def boule(centre, rayon, n=40):
    """Une sphère en peau : ses sommets et leurs normales sortantes."""
    u, v = np.meshgrid(np.linspace(0, np.pi, n), np.linspace(0, 2 * np.pi, 2 * n, endpoint=False))
    N = np.column_stack([(np.sin(u) * np.cos(v)).ravel(), (np.sin(u) * np.sin(v)).ravel(), np.cos(u).ravel()])
    return Peaux(np.asarray(centre) + rayon * N, N)


class Pendre(unittest.TestCase):

    def longueurs(self, x):
        np.testing.assert_allclose(np.linalg.norm(x[:, 1:] - x[:, :-1], axis=2), LONGUEURS, atol=1e-9)

    def test_un_brin_libre_pend_d_aplomb(self):
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, VERS_X, [Sol(0.01), boule((1.0, 0.0, 1.0), 0.2)])
        np.testing.assert_allclose(x[0], [[0, 0, 1.0], [0, 0, 0.9], [0, 0, 0.8], [0, 0, 0.7]], atol=1e-9)

    def test_un_brin_sort_d_une_peau_et_garde_ses_longueurs(self):
        centre, rayon = np.array([0.03, 0.0, 0.8]), 0.1
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, VERS_X, [boule(centre, rayon)])
        self.longueurs(x)
        points = x[0, :-1, None, :] + np.linspace(0, 1, 6)[None, :, None] * (x[0, 1:] - x[0, :-1])[:, None, :]
        self.assertGreater(np.linalg.norm(points.reshape(-1, 3) - centre, axis=1).min(), rayon + JEU_M - 0.005)
        self.assertLess(x[0, -1, 0], 0.0)

    def test_un_brin_pris_de_face_tourne_vers_son_degagement(self):
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, VERS_X, [boule((0.0, 0.0, 0.8), 0.1)])
        self.longueurs(x)
        self.assertGreater(x[0, -1, 0], 0.1)
        np.testing.assert_allclose(x[0, :, 1], 0.0, atol=1e-6)

    def test_un_brin_se_couche_sur_le_sol(self):
        x = pendre(np.array([[0.0, 0.0, 0.15]]), LONGUEURS, VERS_X, [Sol(0.01)])
        self.longueurs(x)
        self.assertGreaterEqual(x[0, :, 2].min(), 0.01 - 0.002)
        self.assertGreater(x[0, -1, 0], 0.1)

    def test_un_brin_passe_a_cote_d_un_fut(self):
        fut = Fut(np.array([0.01, -1.0, 0.85]), np.array([0.01, 1.0, 0.85]), 0.02)
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, VERS_X, [fut])
        self.longueurs(x)
        points = x[0, :-1, None, :] + np.linspace(0, 1, 6)[None, :, None] * (x[0, 1:] - x[0, :-1])[:, None, :]
        self.assertGreater(np.hypot(points[..., 0] - 0.01, points[..., 2] - 0.85).min(), 0.02 + JEU_M - 0.005)
        np.testing.assert_allclose(x[0, 1], [0.0, 0.0, 0.9], atol=1e-9)

    def test_un_obstacle_qui_bouge_peu_bouge_peu_le_brin(self):
        bouts = np.array([pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, VERS_X, [boule((0.16 - 0.002 * i, 0.0, 0.8), 0.1)])[0, -1] for i in range(40)])
        self.assertLess(np.linalg.norm(np.diff(bouts, axis=0), axis=1).max(), 0.02)
        np.testing.assert_allclose(bouts[0], [0.0, 0.0, 0.7], atol=1e-9)
        self.assertLess(bouts[-1, 0], -0.04)

    def test_le_depart_d_un_brin_longe_la_peau_ou_sa_racine_est_posee(self):
        x = pendre(np.array([[0.11, 0.0, 0.8]]), LONGUEURS, VERS_X, [boule((0.0, 0.0, 0.8), 0.1)])
        np.testing.assert_allclose(x[0, 1], [0.11, 0.0, 0.7], atol=1e-9)
        self.assertTrue(np.allclose(BAS, [0.0, 0.0, -1.0]))


if __name__ == '__main__':
    unittest.main()
