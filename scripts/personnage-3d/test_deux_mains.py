"""deux_mains : le coude d'un bras à deux os atteint la cible à portée en gardant ses segments et plie du côté du pôle,
ramène une cible hors de portée sur la sphère de portée ; les clés de geste s'interpolent sous le lissage ; le repère de
l'arme porte son +Y vers le fer et garde le roulis de la prise source au plus court ; chaque clip dérivé a une clé au
début et une à la fin, ses prises à `ECART` l'une de l'autre."""
import math
import sys
import unittest
from pathlib import Path

from mathutils import Euler, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from deux_mains import CLIPS, ECART, cle, coude, interpoler, repere_de_l_arme  # noqa: E402

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
        cles = (cle(0.0, (0, -0.3, 1.2), (1, 0, 0), 0), cle(1.0, (0, -0.3, 1.6), (0, 0, -1), 40))
        debut, fin, milieu = interpoler(cles, 0.0), interpoler(cles, 1.0), interpoler(cles, 0.5)
        self.assertAlmostEqual((debut[0] - cles[0][1]).length, 0, places=6)
        self.assertAlmostEqual((fin[1] - cles[1][2]).length, 0, places=6)
        self.assertAlmostEqual(milieu[2], 20, places=6)
        self.assertAlmostEqual(milieu[1].length, 1, places=6)
        self.assertAlmostEqual(milieu[1].angle(cles[0][2]), math.pi / 4, places=6)

    def test_une_cle_place_ses_deux_prises_a_l_ecart_autour_du_milieu(self):
        _, prise, direction, _ = cle(0.0, (0, -0.3, 1.2), (3, 0, 4))
        seconde = prise + direction * ECART
        self.assertAlmostEqual(((prise + seconde) / 2 - Vector((0, -0.3, 1.2))).length, 0, places=6)


class RepereDeLArme(unittest.TestCase):
    def test_son_y_va_vers_le_fer_et_son_roulis_tourne_au_plus_court(self):
        source = Euler((0.3, -0.2, 0.5)).to_matrix().to_4x4()
        direction = Vector((0.2, 0.5, -0.8)).normalized()
        repere = repere_de_l_arme(source, Vector((0.1, -0.3, 1.2)), direction)
        self.assertAlmostEqual((repere.to_3x3() @ Vector((0, 1, 0)) + direction).length, 0, places=6)
        self.assertAlmostEqual((repere.translation - Vector((0.1, -0.3, 1.2))).length, 0, places=6)
        avant, apres = source.to_3x3() @ Vector((0, 1, 0)), repere.to_3x3() @ Vector((0, 1, 0))
        normale = avant.cross(apres).normalized()
        tour = repere.to_3x3() @ source.to_3x3().inverted()
        self.assertAlmostEqual((tour @ normale - normale).length, 0, places=6)

class Clips(unittest.TestCase):
    def test_chaque_clip_derive_a_une_cle_au_debut_et_a_la_fin(self):
        for nom, (source, os_du_cadre, cles) in CLIPS.items():
            with self.subTest(nom):
                self.assertEqual((cles[0][0], cles[-1][0]), (0.0, 1.0))
                self.assertEqual([c[0] for c in cles], sorted(c[0] for c in cles))


if __name__ == '__main__':
    unittest.main()
