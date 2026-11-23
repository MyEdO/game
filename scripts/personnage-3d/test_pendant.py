"""pendant.pendre : un brin qui tend à l'aplomb, libre, pend d'aplomb ; il sort d'une peau, d'un fût et du sol en gardant
la longueur de ses os ; pris de face, il tourne vers son dégagement ; il bouge peu quand l'obstacle bouge peu ; deux
brins liés ne s'écartent pas de plus que leur lien. D'une image à la suivante (`vers_l_aplomb`) : un os écarté revient
vers l'aplomb de `RETOUR` par image, autant en une image qu'en trois tiers d'image ; il reste du côté du fût où il
était, sans y rentrer."""
import math
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from pendant import BAS, JEU_M, RETOUR, Fut, Peaux, Sol, pendre, vers_l_aplomb  # noqa: E402

LONGUEURS = np.array([[0.1, 0.1, 0.1]])
D_APLOMB = np.tile(BAS, (1, 3, 1))
VERS_X = np.array([[1.0, 0.0, 0.0]])
SANS_LIEN = np.zeros((0, 2), int), np.zeros((0, 3))


def boule(centre, rayon, n=40):
    """Une sphère en peau : ses sommets et leurs normales sortantes."""
    u, v = np.meshgrid(np.linspace(0, np.pi, n), np.linspace(0, 2 * np.pi, 2 * n, endpoint=False))
    N = np.column_stack([(np.sin(u) * np.cos(v)).ravel(), (np.sin(u) * np.sin(v)).ravel(), np.cos(u).ravel()])
    return Peaux(np.asarray(centre) + rayon * N, N)


class Pendre(unittest.TestCase):

    def longueurs(self, x):
        np.testing.assert_allclose(np.linalg.norm(x[:, 1:] - x[:, :-1], axis=2), LONGUEURS, atol=1e-9)

    def test_un_brin_libre_pend_d_aplomb(self):
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, D_APLOMB, VERS_X, [Sol(0.01), boule((1.0, 0.0, 1.0), 0.2)], SANS_LIEN)
        np.testing.assert_allclose(x[0], [[0, 0, 1.0], [0, 0, 0.9], [0, 0, 0.8], [0, 0, 0.7]], atol=1e-9)

    def test_un_brin_sort_d_une_peau_et_garde_ses_longueurs(self):
        centre, rayon = np.array([0.03, 0.0, 0.8]), 0.1
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, D_APLOMB, VERS_X, [boule(centre, rayon)], SANS_LIEN)
        self.longueurs(x)
        points = x[0, :-1, None, :] + np.linspace(0, 1, 6)[None, :, None] * (x[0, 1:] - x[0, :-1])[:, None, :]
        self.assertGreater(np.linalg.norm(points.reshape(-1, 3) - centre, axis=1).min(), rayon + JEU_M - 0.005)
        self.assertLess(x[0, -1, 0], 0.0)

    def test_un_brin_pris_de_face_tourne_vers_son_degagement(self):
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, D_APLOMB, VERS_X, [boule((0.0, 0.0, 0.8), 0.1)], SANS_LIEN)
        self.longueurs(x)
        self.assertGreater(x[0, -1, 0], 0.1)
        np.testing.assert_allclose(x[0, :, 1], 0.0, atol=1e-6)

    def test_un_brin_se_couche_sur_le_sol(self):
        x = pendre(np.array([[0.0, 0.0, 0.15]]), LONGUEURS, D_APLOMB, VERS_X, [Sol(0.01)], SANS_LIEN)
        self.longueurs(x)
        self.assertGreaterEqual(x[0, :, 2].min(), 0.01 - 0.002)
        self.assertGreater(x[0, -1, 0], 0.1)

    def test_un_brin_passe_a_cote_d_un_fut(self):
        fut = Fut(np.array([0.01, -1.0, 0.85]), np.array([0.01, 1.0, 0.85]), 0.02)
        x = pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, D_APLOMB, VERS_X, [fut], SANS_LIEN)
        self.longueurs(x)
        points = x[0, :-1, None, :] + np.linspace(0, 1, 6)[None, :, None] * (x[0, 1:] - x[0, :-1])[:, None, :]
        self.assertGreater(np.hypot(points[..., 0] - 0.01, points[..., 2] - 0.85).min(), 0.02 + JEU_M - 0.005)
        np.testing.assert_allclose(x[0, 1], [0.0, 0.0, 0.9], atol=1e-9)

    def test_un_obstacle_qui_bouge_peu_bouge_peu_le_brin(self):
        bouts = np.array([pendre(np.array([[0.0, 0.0, 1.0]]), LONGUEURS, D_APLOMB, VERS_X, [boule((0.16 - 0.002 * i, 0.0, 0.8), 0.1)], SANS_LIEN)[0, -1] for i in range(40)])
        self.assertLess(np.linalg.norm(np.diff(bouts, axis=0), axis=1).max(), 0.02)
        np.testing.assert_allclose(bouts[0], [0.0, 0.0, 0.7], atol=1e-9)
        self.assertLess(bouts[-1, 0], -0.04)

    def test_le_depart_d_un_brin_longe_la_peau_ou_sa_racine_est_posee(self):
        x = pendre(np.array([[0.11, 0.0, 0.8]]), LONGUEURS, D_APLOMB, VERS_X, [boule((0.0, 0.0, 0.8), 0.1)], SANS_LIEN)
        np.testing.assert_allclose(x[0, 1], [0.11, 0.0, 0.7], atol=1e-9)

    def test_deux_brins_lies_ne_s_ecartent_pas_de_plus_que_leur_lien(self):
        racines = np.array([[-0.05, 0.0, 0.15], [0.05, 0.0, 0.15]])
        longueurs, degagements = np.tile(LONGUEURS, (2, 1)), np.array([[-0.8, 0.6, 0.0], [0.8, 0.6, 0.0]])
        lien = np.array([[0, 1]]), np.full((1, 3), 0.25)
        d_aplomb = np.tile(BAS, (2, 3, 1))
        libres = pendre(racines, longueurs, d_aplomb, degagements, [Sol(0.01)], SANS_LIEN)
        self.assertGreater(libres[1, -1, 0] - libres[0, -1, 0], 0.4)
        lies = pendre(racines, longueurs, d_aplomb, degagements, [Sol(0.01)], lien)
        np.testing.assert_allclose(np.linalg.norm(lies[:, 1:] - lies[:, :-1], axis=2), longueurs, atol=1e-9)
        self.assertLess(np.linalg.norm(lies[1] - lies[0], axis=1).max(), 0.25 + 0.005)
        self.assertGreaterEqual(lies[:, :, 2].min(), 0.01 - 0.002)
        debout = pendre(racines + [0.0, 0.0, 1.0], longueurs, d_aplomb, degagements, [Sol(0.01)], lien)
        np.testing.assert_allclose(debout[:, -1], racines + [0.0, 0.0, 0.7], atol=1e-9)

    def test_un_os_ecarte_revient_vers_l_aplomb_d_une_part_par_image(self):
        d = np.tile([1.0, 0.0, 0.0], (1, 3, 1))
        angles = []
        for _ in range(4):
            d = vers_l_aplomb(d, VERS_X, 1)
            np.testing.assert_allclose(np.linalg.norm(d, axis=2), 1.0, atol=1e-12)
            np.testing.assert_allclose(d[0, :, 1], 0.0, atol=1e-12)
            angles.append(math.degrees(math.acos(d[0, 0] @ BAS)))
        np.testing.assert_allclose(angles, 90.0 * (1 - RETOUR) ** np.arange(1, 5), atol=1e-9)
        par_tiers = np.tile([1.0, 0.0, 0.0], (1, 3, 1))
        for _ in range(3):
            par_tiers = vers_l_aplomb(par_tiers, VERS_X, 1 / 3)
        np.testing.assert_allclose(par_tiers, vers_l_aplomb(np.tile([1.0, 0.0, 0.0], (1, 3, 1)), VERS_X, 1), atol=1e-12)
        np.testing.assert_array_equal(vers_l_aplomb(D_APLOMB, VERS_X, 1), D_APLOMB)
        dresse = vers_l_aplomb(-D_APLOMB, VERS_X, 1)
        self.assertGreater(dresse[0, 0, 0], 0.0)
        self.assertAlmostEqual(float(dresse[0, 0, 1]), 0.0)
        self.assertAlmostEqual(math.degrees(math.acos(dresse[0, 0] @ BAS)), 180.0 * (1 - RETOUR), places=1)

    def test_un_os_reste_du_cote_du_fut_ou_il_etait_et_n_y_rentre_pas(self):
        racine = np.array([[0.0, 0.0, 1.0]])
        fut = Fut(np.array([0.005, -1.0, 0.85]), np.array([0.005, 1.0, 0.85]), 0.02)
        au_fut = lambda x: np.hypot(*(x[0, :-1, None, :] + np.linspace(0, 1, 6)[None, :, None] * (x[0, 1:] - x[0, :-1])[:, None, :])[..., [0, 2]].reshape(-1, 2).T - [[0.005], [0.85]]).min()
        de_l_aplomb = pendre(racine, LONGUEURS, D_APLOMB, VERS_X, [fut], SANS_LIEN)
        self.assertLess(de_l_aplomb[0, 2, 0], 0.005)
        d = np.tile([0.6, 0.0, -0.8], (1, 3, 1))
        for _ in range(12):
            x = pendre(racine, LONGUEURS, vers_l_aplomb(d, VERS_X, 1), VERS_X, [fut], SANS_LIEN)
            self.longueurs(x)
            self.assertGreater(au_fut(x), 0.02 + JEU_M - 0.005)
            d = (x[:, 1:] - x[:, :-1]) / LONGUEURS[:, :, None]
        self.assertGreater(x[0, 2, 0], 0.005)
        self.assertLess(au_fut(x), 0.02 + JEU_M + 0.005)


if __name__ == '__main__':
    unittest.main()
