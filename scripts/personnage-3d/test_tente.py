"""tente.Tente sur une jupe synthétique de huit brins de trois os autour de l'axe vertical : au dessin sans obstacle,
par-dessus une cuisse levée, sous une main, enfoncée par la main dans ce qui cède et jamais dans ce qui ne cède pas, la
chute et la montée bornées d'une image à la suivante, ce que le dessin couvre, le sol d'un filet debout et celui d'un filet couché,
le large, l'écart borné de deux bouts voisins et ce qui lui cède, dans l'ordre : le plafond du dehors tient, puis ce qui
cède s'enfonce, puis le dehors est recouvert, enfin le dedans et le sol cèdent."""
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import tente  # noqa: E402

S, K, L = 8, 3, 0.3
RAYON, HAUTEUR, PENTE = 0.2, 1.0, np.radians(10)
AZIMUTS = 2 * np.pi * np.arange(S) / S
DEHORS = np.column_stack([np.sin(AZIMUTS), -np.cos(AZIMUTS), np.zeros(S)])
"""Le brin 0 est devant (-Y), le brin 2 à gauche (+X), le brin 4 derrière."""
O = np.array([0.0, 0.0, HAUTEUR])
DEBOUT = np.eye(3)
VIDE = (np.zeros((0, 3)), np.zeros(0), np.zeros(0, int), np.zeros((0, 2), int))


def jupe():
    pas = L * np.array([np.sin(PENTE), -np.cos(PENTE)])
    brins = np.array([[O + (RAYON + k * pas[0]) * d + np.array([0, 0, k * pas[1]]) for k in range(K + 1)] for d in DEHORS])
    return tente.Tente(brins, (0.0, 0.0), True), brins


def tube(a, b, rayon, cote, anneaux=7, cotes=12):
    """Un tube de `a` à `b` : ses sommets, leurs rayons nuls, leur côté et ses arêtes."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    axe = (b - a) / np.linalg.norm(b - a)
    u = np.cross(axe, np.eye(3)[np.abs(axe).argmin()])
    u /= np.linalg.norm(u)
    v = np.cross(axe, u)
    tours = 2 * np.pi * np.arange(cotes) / cotes
    pts = np.array([a + (b - a) * i / (anneaux - 1) + rayon * (np.cos(t) * u + np.sin(t) * v) for i in range(anneaux) for t in tours])
    n = lambda i, j: i * cotes + j % cotes
    aretes = [(n(i, j), n(i, j + 1)) for i in range(anneaux) for j in range(cotes)]
    aretes += [(n(i, j), n(i + 1, j)) for i in range(anneaux - 1) for j in range(cotes)]
    aretes += [(n(i, j), n(i + 1, j + 1)) for i in range(anneaux - 1) for j in range(cotes)]
    return pts, np.zeros(len(pts)), np.full(len(pts), cote), np.array(aretes)


def ensemble(*surfaces):
    decalages = np.cumsum([0] + [len(s[0]) for s in surfaces[:-1]])
    return (np.concatenate([s[0] for s in surfaces]), np.concatenate([s[1] for s in surfaces]),
            np.concatenate([s[2] for s in surfaces]), np.concatenate([s[3] + d for s, d in zip(surfaces, decalages)]))


def hauteur_sur_le_brin(x, point, dehors):
    """La hauteur du brin `x` (K+1, 3), dans son plan, à la distance à l'axe de `point`, moins celle de `point`."""
    return float(np.interp(point @ dehors, (x - O) @ dehors, x[:, 2]) - point[2])


def rayon_du_brin(x, z, dehors):
    """La distance à l'axe du brin pendant `x` (K+1, 3) à la hauteur `z`."""
    return float(np.interp(-z, -x[:, 2], (x - O) @ dehors))


CUISSE = ((0.0, -0.05, 0.9), (0.0, -0.45, 0.9))
"""Une cuisse levée à l'horizontale vers l'avant, sous le brin 0."""
MAIN_A_GAUCHE = ((0.27, -0.03, 0.8), (0.27, 0.03, 0.8))
"""Une main posée au dehors du brin 2 dessiné."""
SANS_SECTEUR = (np.zeros(0), np.zeros(0), np.zeros(0, bool))


def membre_leve(brin):
    """Un membre levé au-dessus de l'horizontale sous le brin `brin`."""
    return O + 0.05 * DEHORS[brin] - [0, 0, 0.18], O + 0.45 * DEHORS[brin] - [0, 0, 0.01]


class Tente(unittest.TestCase):
    def setUp(self):
        self.tente, self.dessin = jupe()
        self.racines = self.dessin[:, 0]

    def poser(self, obstacles, avant=None, dt=0.0, racines=None):
        return self.tente.poser(self.racines if racines is None else racines, O, DEBOUT, obstacles, tente.SOL_M, avant, dt)

    def test_sans_obstacle_le_filet_pend_a_son_dessin(self):
        x, phi = self.poser(VIDE)
        np.testing.assert_allclose(x, self.dessin, atol=1e-9)
        np.testing.assert_allclose(phi, PENTE, atol=1e-9)

    def test_le_brin_passe_par_dessus_la_cuisse_levee_et_l_arriere_reste_au_dessin(self):
        cuisse = tube(*CUISSE, 0.08, tente.DEDANS)
        x, phi = self.poser(cuisse)
        dessus = [hauteur_sur_le_brin(x[0], p, DEHORS[0]) for p in cuisse[0] if abs(p[0]) < 0.05 and p[2] > 0.9 and RAYON < -p[1] < 0.4]
        self.assertGreaterEqual(len(dessus), 6)
        self.assertGreater(min(dessus), 0.0)
        self.assertGreater(np.degrees(phi[0, 0]), 60)
        np.testing.assert_allclose(x[4], self.dessin[4], atol=1e-9)

    def test_le_brin_passe_sous_la_main(self):
        main = tube((-0.03, -0.24, 0.8), (0.03, -0.24, 0.8), 0.02, tente.DEHORS, anneaux=3)
        x, phi = self.poser(main)
        self.assertLess(phi[0, 0], PENTE)
        for p in main[0]:
            self.assertLess(rayon_du_brin(x[0], p[2], DEHORS[0]), -p[1])

    def test_la_main_enfonce_le_tissu_dans_ce_qui_cede_jamais_dans_ce_qui_ne_cede_pas(self):
        main = tube((-0.03, -0.3, 0.9), (0.03, -0.3, 0.9), 0.02, tente.DEHORS, anneaux=3)
        _, cede = self.poser(ensemble(tube(*CUISSE, 0.08, tente.CEDE), main))
        _, ferme = self.poser(ensemble(tube(*CUISSE, 0.08, tente.DEDANS), main))
        _, libre = self.poser(tube(*CUISSE, 0.08, tente.DEDANS))
        self.assertLess(cede[0, 0], libre[0, 0] - np.radians(20))
        self.assertAlmostEqual(ferme[0, 0], libre[0, 0], places=6)

    def test_le_tissu_ne_retombe_et_ne_se_releve_que_de_ses_vitesses(self):
        cuisse = tube(*CUISSE, 0.08, tente.DEDANS)
        _, leve = self.poser(cuisse)
        dt = 1 / 24
        _, retombe = self.poser(VIDE, leve, dt)
        self.assertAlmostEqual(retombe[0, 0], leve[0, 0] - tente.VITESSE_M_S * dt / L, places=6)
        _, remonte = self.poser(cuisse, np.full((S, K), PENTE), dt)
        self.assertAlmostEqual(remonte[0, 0], PENTE + tente.MONTEE_M_S * dt / L, places=6)
        self.assertLess(remonte[0, 0], leve[0, 0])
        _, pose = self.poser(cuisse, remonte, 1.0)
        np.testing.assert_allclose(pose, leve, atol=1e-9)

    def test_ce_que_le_dessin_couvre_ne_vient_pas_du_dehors(self):
        a_mi_hauteur = O + [0, 0, -1.5 * L * np.cos(PENTE)]
        rayon = RAYON + 1.5 * L * np.sin(PENTE)
        points = [a_mi_hauteur + (rayon - 0.02) * DEHORS[0], a_mi_hauteur + (rayon + 0.2) * DEHORS[0], O + [0, 0, 0.05] + 0.1 * DEHORS[0]]
        self.assertEqual(self.tente.sous_le_dessin(points).tolist(), [True, False, False])

    def test_le_bout_d_un_os_ne_passe_pas_sous_le_sol(self):
        bas = self.racines - [0, 0, HAUTEUR - 0.5]
        x, _ = self.tente.poser(bas, O - [0, 0, HAUTEUR - 0.5], DEBOUT, VIDE, tente.SOL_M, None, 0.0)
        self.assertGreaterEqual(x[:, 1:, 2].min(), tente.SOL_M - 1e-9)

    def test_le_sol_d_un_filet_couche_laisse_pendre_le_tissu(self):
        bas = [0, 0, HAUTEUR - 0.5]
        x, _ = self.tente.poser(self.racines - bas, O - bas, DEBOUT, VIDE, tente.SOL_M - 2.0, None, 0.0)
        np.testing.assert_allclose(x, self.dessin - bas, atol=1e-9)

    def test_le_bout_d_un_os_descend_sous_le_sol_plutot_que_de_passer_au_large(self):
        bas = [0, 0, HAUTEUR - 0.2]
        x, _ = self.tente.poser(self.racines - bas, O - bas, DEBOUT, VIDE, tente.SOL_M, None, 0.0)
        au_large = tente.ETIREMENT_MAX * np.linalg.norm(self.dessin[:, 1:, :2], axis=2)
        self.assertLessEqual((np.linalg.norm(x[:, 1:, :2], axis=2) - au_large).max(), 1e-9)
        self.assertLess(x[:, -1, 2].max(), tente.SOL_M)
        self.assertGreaterEqual(x[:, 1, 2].min(), tente.SOL_M - 1e-9)

    def test_le_bout_d_un_os_entre_dans_le_dedans_plutot_que_de_passer_au_large(self):
        membre = O + 0.05 * DEHORS[0] - [0, 0, 0.05], O + 1.2 * DEHORS[0] - [0, 0, 0.05]
        x, _ = self.poser(tube(*membre, 0.05, tente.DEDANS))
        au_large = tente.ETIREMENT_MAX * np.linalg.norm(self.dessin[:, 1:, :2], axis=2)
        self.assertLessEqual((np.linalg.norm(x[:, 1:, :2], axis=2) - au_large).max(), 1e-9)
        self.assertLess(x[0, -1, 2], HAUTEUR - 0.05)

    def test_un_os_parti_de_sous_le_sol_y_reste(self):
        self.assertTrue(np.isfinite(tente.sous_le_sol(0.1, L, 0.0, -1.0)).all())
        self.assertEqual(tente.sous_le_sol(-0.1, L, 0.0, -1.0), (np.inf, np.inf))

    def ecart_le_plus_grand(self, x):
        return max(np.linalg.norm(x[i, k + 1] - x[j, k + 1]) / self.tente.ecarts[f, k] for f, (i, j) in enumerate(self.tente.faces) for k in range(K))

    def test_deux_bouts_voisins_ne_s_ecartent_pas_au_dela_de_la_borne(self):
        x, phi = self.poser(tube(*CUISSE, 0.08, tente.DEDANS))
        self.assertLessEqual(self.ecart_le_plus_grand(x), tente.ETIREMENT_MAX + 1e-6)
        self.assertGreater(phi[1, 0], PENTE + np.radians(5))

    def test_la_main_tient_le_tissu_et_son_voisin_s_enfonce_dans_ce_qui_cede(self):
        main = tube(*MAIN_A_GAUCHE, 0.02, tente.DEHORS, anneaux=3)
        _, libre = self.poser(tube(*membre_leve(1), 0.08, tente.CEDE))
        x, phi = self.poser(ensemble(tube(*membre_leve(1), 0.08, tente.CEDE), main))
        self.assertGreater(libre[2, 0], np.radians(90))
        self.assertLess(rayon_du_brin(x[2], 0.8, DEHORS[2]), 0.25)
        self.assertLess(phi[0, 0], libre[0, 0] - np.radians(5))
        self.assertLessEqual(self.ecart_le_plus_grand(x), tente.ETIREMENT_MAX + 1e-6)

    def tendre(self, phi, plafond, fermes, toit=180.0, sols={}):
        """`Tente.retendre` sur les premiers os, sans peau : `phi` (S,), en degrés ; `plafond` : par brin, celui que lui
        pose le dehors ; `fermes` : par brin, l'angle jusqu'où le `DEDANS` le tient ; `toit`, celui de tous ou par brin ;
        `sols` : par brin, son secteur du sol."""
        phi = np.radians(np.asarray(phi, float))
        plafonds, secteurs = np.full(S, np.inf), np.full((S, 2), np.inf)
        for brin, angle in plafond.items():
            plafonds[brin] = np.radians(angle)
        for brin, secteur in sols.items():
            secteurs[brin] = np.radians(secteur)
        du_ferme = lambda s: (np.array([-np.pi]), np.radians([fermes[s]]), np.array([True])) if s in fermes else SANS_SECTEUR
        self.tente.retendre(0, self.racines, phi, DEHORS, np.array([0.0, 0.0, -1.0]), [SANS_SECTEUR[:2]] * S, du_ferme, plafonds,
                            secteurs, np.radians(np.broadcast_to(np.asarray(toit, float), S)))
        x = self.racines[:, None] + L * np.stack([np.zeros((S, 3)), np.sin(phi)[:, None] * DEHORS - np.cos(phi)[:, None] * [0, 0, 1]], axis=1)
        ecart = max(np.linalg.norm(x[i, 1] - x[j, 1]) / self.tente.ecarts[f, 0] for f, (i, j) in enumerate(self.tente.faces))
        return np.degrees(phi), ecart

    def test_le_plus_bas_de_deux_voisins_trop_ecartes_se_releve(self):
        phi, ecart = self.tendre([140] + [10] * 7, {}, {})
        self.assertAlmostEqual(phi[0], 140)
        self.assertGreater(phi[1], 20)
        self.assertAlmostEqual(phi[1], phi[7])
        self.assertLessEqual(ecart, tente.ETIREMENT_MAX + 1e-6)

    def test_sous_le_plafond_du_dehors_le_plus_haut_s_abaisse_et_garde_ce_plafond(self):
        phi, ecart = self.tendre([140] + [10] * 7, {1: 10, 7: 10}, {})
        self.assertAlmostEqual(phi[1], 10)
        self.assertAlmostEqual(phi[7], 10)
        self.assertLess(phi[0], 130)
        self.assertLessEqual(ecart, tente.ETIREMENT_MAX + 1e-6)

    def test_quand_le_dedans_tient_le_plus_haut_le_plus_bas_passe_par_dessus_le_dehors(self):
        phi, ecart = self.tendre([140] + [10] * 7, {1: 10, 7: 10}, {0: 140})
        self.assertAlmostEqual(phi[0], 140)
        self.assertGreater(phi[1], 20)
        self.assertLessEqual(ecart, tente.ETIREMENT_MAX + 1e-6)

    def test_sous_son_toit_le_plus_bas_reste_et_le_plus_haut_s_abaisse_jusque_dans_le_dedans(self):
        phi, ecart = self.tendre([140] + [10] * 7, {}, {0: 140}, toit=15.0)
        self.assertLessEqual(phi[1:].max(), 15 + 1e-9)
        self.assertLess(phi[0], 140)
        self.assertLessEqual(ecart, tente.ETIREMENT_MAX + 1e-6)

    def test_le_plus_haut_s_abaisse_jusque_sous_le_sol(self):
        phi, ecart = self.tendre([140] + [10] * 7, {}, {}, toit=15.0, sols={0: (-100, 120)})
        self.assertLess(phi[0], 120)
        self.assertLessEqual(ecart, tente.ETIREMENT_MAX + 1e-6)

    def test_les_brins_que_le_dedans_tient_s_abaissent_de_proche_en_proche(self):
        phi, ecart = self.tendre([140, 140] + [10] * 6, {}, {0: 140, 1: 140}, toit=[180, 180, 15, 15, 15, 15, 15, 180])
        self.assertLessEqual(phi[2], 15 + 1e-9)
        self.assertLess(phi[1], phi[0])
        self.assertLessEqual(ecart, tente.ETIREMENT_MAX + 1e-6)


if __name__ == '__main__':
    unittest.main()
