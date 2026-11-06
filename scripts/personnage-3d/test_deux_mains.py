"""deux_mains : le coude d'un bras à deux os atteint la cible à portée en gardant ses segments et plie du côté du pôle,
ramène une cible hors de portée sur la sphère de portée ; les clés de geste s'interpolent en partant et en arrivant au
repos, sauf à une clé d'élan, la prise `main` à la moitié de l'écart du milieu de chaque clé ; le repère de l'arme porte
son +Y vers le fer et son +X au plus près du flanc donné ; chaque clip dérivé a une clé au début et une à la fin, et un
maniement dont la seconde prise est déclarée."""
import math
import sys
import unittest
from pathlib import Path

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from deux_mains import CLIPS, SECONDES, cle, coude, interpoler, repere_de_l_arme  # noqa: E402

L1, L2 = 0.25, 0.24


class Coude(unittest.TestCase):
    def test_une_cible_a_portee_est_atteinte_segments_gardes_coude_du_cote_du_pole(self):
        epaule, cible, pole = Vector((0, 0, 1.4)), Vector((0.1, -0.3, 1.1)), Vector((1, 0, -1))
        poignet, articulation = coude(epaule, cible, L1, L2, pole)
        self.assertAlmostEqual((poignet - cible).length, 0, places=6)
        self.assertAlmostEqual((articulation - epaule).length, L1, places=6)
        self.assertAlmostEqual((poignet - articulation).length, L2, places=6)
        axe = (cible - epaule).normalized()
        milieu = epaule + axe * (articulation - epaule).dot(axe)
        self.assertGreater((articulation - milieu).dot(pole), 0)

    def test_une_cible_hors_de_portee_tend_le_bras_vers_elle(self):
        epaule, cible = Vector((0, 0, 1.4)), Vector((0, -2, 1.4))
        poignet, _ = coude(epaule, cible, L1, L2, Vector((0, 0, -1)))
        self.assertAlmostEqual((poignet - epaule).length, L1 + L2, places=3)
        self.assertGreater((poignet - epaule).normalized().dot((cible - epaule).normalized()), 0.9999)


class Interpolation(unittest.TestCase):
    def test_les_cles_bornent_le_geste_et_le_milieu_suit_le_lissage(self):
        cles = (cle(0.0, (0, -0.3, 1.2), (1, 0, 0), 0, 10), cle(1.0, (0, -0.3, 1.6), (0, 0, -1), 40, -10))
        debut, fin, milieu = interpoler(cles, 0.0, 0.4), interpoler(cles, 1.0, 0.4), interpoler(cles, 0.5, 0.4)
        self.assertAlmostEqual((debut[0] - Vector((-0.2, -0.3, 1.2))).length, 0, places=6)
        self.assertAlmostEqual((fin[0] - Vector((0, -0.3, 1.8))).length, 0, places=6)
        self.assertAlmostEqual((fin[1] - cles[1][2]).length, 0, places=6)
        self.assertAlmostEqual((milieu[2] - Vector((20, 0))).length, 0, places=6)
        self.assertAlmostEqual(milieu[1].length, 1, places=6)
        self.assertAlmostEqual(milieu[1].angle(cles[0][2]), math.pi / 4, places=6)

    def test_le_geste_garde_sa_vitesse_a_une_cle_d_elan(self):
        cles = (cle(0.0, (0, -0.3, 1.2), (1, 0, 0)), cle(0.5, (0, -0.3, 1.6), (1, 0, 0), 40, elan=True),
                cle(1.0, (0, -0.3, 1.2), (1, 0, 0)))
        self.assertAlmostEqual(interpoler(cles, 0.25, 0.4)[2].x, 10, places=6)
        self.assertAlmostEqual(interpoler(cles, 0.75, 0.4)[2].x, 10, places=6)
        avant, apres = interpoler(cles, 0.5 - 1e-4, 0.4)[2].x, interpoler(cles, 0.5 + 1e-4, 0.4)[2].x
        self.assertAlmostEqual((40 - avant) / 1e-4, (40 - apres) / 1e-4, places=1)

    def test_une_cle_place_ses_deux_prises_a_l_ecart_autour_du_milieu(self):
        cles = (cle(0.0, (0, -0.3, 1.2), (3, 0, 4)),)
        prise, direction, _ = interpoler(cles, 0.0, 0.5)
        seconde = prise + direction * 0.5
        self.assertAlmostEqual(((prise + seconde) / 2 - Vector((0, -0.3, 1.2))).length, 0, places=6)


class RepereDeLArme(unittest.TestCase):
    def test_son_y_va_vers_le_fer_et_son_x_au_plus_pres_du_flanc(self):
        flanc, direction = Vector((1, 0, 0)), Vector((0.2, 0.5, -0.8)).normalized()
        repere = repere_de_l_arme(flanc, Vector((0.1, -0.3, 1.2)), direction * 2)
        axes = repere.to_3x3()
        self.assertAlmostEqual((axes @ Vector((0, 1, 0)) - direction).length, 0, places=6)
        self.assertAlmostEqual((repere.translation - Vector((0.1, -0.3, 1.2))).length, 0, places=6)
        self.assertAlmostEqual(axes.determinant(), 1, places=6)
        x = axes @ Vector((1, 0, 0))
        self.assertAlmostEqual(x.cross(flanc).dot(direction), 0, places=6)
        self.assertGreater(x.dot(flanc), 0)


class Clips(unittest.TestCase):
    def test_chaque_clip_derive_a_une_cle_au_debut_et_a_la_fin_et_un_maniement_a_seconde_prise(self):
        for nom, (source, os_du_cadre, maniement, cles) in CLIPS.items():
            with self.subTest(nom):
                self.assertIn(maniement, SECONDES)
                self.assertEqual((cles[0][0], cles[-1][0]), (0.0, 1.0))
                self.assertEqual([c[0] for c in cles], sorted(c[0] for c in cles))


if __name__ == '__main__':
    unittest.main()
