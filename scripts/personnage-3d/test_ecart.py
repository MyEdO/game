"""ecart (#4002, #3810) : une peau dans un tronc en boîte en sort à sa marge en avançant, d'exactement ce qu'il faut, une
peau dehors ne bouge pas, une peau que l'avancée ne sort pas, derrière la boîte ou au-delà de la borne, n'est pas
poussée ; l'enveloppe rend la valeur requise d'une seule image à cette image, y monte et en redescend en continu, nulle
à `RACCORD` d'elle, et couvre deux images requises."""
import math
import sys
import unittest
from pathlib import Path

import bpy  # noqa: F401
import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from ecart import ECART_DU_TRONC, POUSSEE, RACCORD, enfoncement, envelopper, poussee_requise  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from test_tronc import tronc_en_boite  # noqa: E402


class Poussee(unittest.TestCase):
    def test_une_peau_dans_un_tronc_en_sort_a_sa_marge_en_avancant_d_exactement_ce_qu_il_faut(self):
        tronc = tronc_en_boite()
        peau = numpy.array([[[0.01, -0.146, 1.1], [0.05, -0.143, 1.0], [0.0, -0.5, 1.1]]])
        requise = 0.007 + ECART_DU_TRONC['marge']
        poussee = poussee_requise(tronc, peau)
        self.assertGreaterEqual(poussee, requise - 1e-9)
        self.assertLessEqual(poussee, requise + POUSSEE['tolerance'])
        self.assertLessEqual(enfoncement(tronc, peau + (0.0, -poussee, 0.0))[0], -ECART_DU_TRONC['marge'])

    def test_une_peau_dehors_ne_bouge_pas(self):
        self.assertEqual(poussee_requise(tronc_en_boite(), numpy.array([[[0.01, -0.15 - ECART_DU_TRONC['marge'] - 0.002, 1.1]]])), 0.0)

    def test_une_peau_que_l_avancee_ne_sort_pas_n_est_pas_poussee(self):
        mince = tronc_en_boite(numpy.array([-0.2, -0.05, 0.8]), numpy.array([0.2, 0.05, 1.4]))
        self.assertIsNone(poussee_requise(mince, numpy.array([[[0.0, 0.045, 1.1]]])))
        self.assertIsNone(poussee_requise(tronc_en_boite(), numpy.array([[[0.0, 0.0, 1.1]]])))


class Enveloppe(unittest.TestCase):
    RACCORD_EN_IMAGES = RACCORD * IMAGES_PAR_SECONDE

    def test_la_valeur_requise_d_une_seule_image_monte_et_redescend_en_continu(self):
        instants_, requise, milieu = numpy.arange(97.0), 0.03, 48
        requises = numpy.zeros(len(instants_))
        requises[milieu] = requise
        avancees = envelopper(requises, instants_)
        self.assertAlmostEqual(avancees[milieu], requise, places=12)
        self.assertFalse(avancees[numpy.abs(instants_ - milieu) >= self.RACCORD_EN_IMAGES].any())
        pas = numpy.diff(avancees)
        self.assertTrue((pas[:milieu] >= 0).all() and (pas[milieu:] <= 0).all())
        self.assertLessEqual(numpy.abs(pas).max(), requise * math.pi / (2 * self.RACCORD_EN_IMAGES) + 1e-12)

    def test_deux_images_requises_sont_couvertes_et_raccordees(self):
        instants_ = numpy.arange(49.0)
        requises = numpy.zeros(len(instants_))
        requises[[20, 26]] = 0.02, 0.05
        avancees = envelopper(requises, instants_)
        self.assertTrue((avancees >= requises - 1e-12).all())
        self.assertAlmostEqual(avancees[26], 0.05, places=12)
        self.assertTrue((avancees[20:27] >= 0.02 - 1e-12).all())
        self.assertLessEqual(numpy.abs(numpy.diff(avancees)).max(), 0.05 * math.pi / (2 * self.RACCORD_EN_IMAGES) + 1e-12)


if __name__ == '__main__':
    unittest.main()
