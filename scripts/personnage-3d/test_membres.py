"""membres (#3810) : un bras hors du tronc ne se corrige pas et sa pose ressort à l'identique ; une main dans le tronc en
sort à la marge par l'avancée ; un avant-bras dans le tronc, main dehors, en sort par l'écart du coude, vers le dehors,
la main en place et le bras sans torsion ajoutée ; l'enveloppe raccorde l'écart d'une image corrigée à ses voisines, à pas borné ; un bras que ni
l'avancée ni le coude ne sortent se rend en reste, sans lever."""
import math
import sys
import unittest
from pathlib import Path

import bpy  # noqa: F401
import numpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from ecart import ECART_DU_TRONC, POUSSEE, RACCORD, poussee_requise  # noqa: E402
from membres import bras_de_l_image, corriger, mesurer, peau_posee, poses_du_bras, requis  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from test_tronc import boite  # noqa: E402
from tronc import PeauDuMembre, PeauDuTronc, champs_du_tronc, tronc_pose  # noqa: E402

REPOS = Matrix(((-1, 0, 0), (0, -1, 0), (0, 0, 1)))
"""Les axes de repos des trois os du bras : leur +Y vers l'avant (−Y du rig)."""
TETES = [Vector((0.3, 0.0, 1.3)), Vector((0.3, -0.25, 1.3)), Vector((0.3, -0.49, 1.3))]
"""Les têtes de repos du bras, de l'avant-bras et de la main."""
CHAINE = [1, 2, 3]
"""Le dos (os 0, qui porte le tronc), puis le bras, l'avant-bras et la main."""


def matrice(axes, tete):
    m = axes.to_4x4()
    m.translation = tete
    return numpy.array(m)


RESTES = numpy.array([numpy.eye(4)] + [matrice(REPOS, t) for t in TETES])
TRONC = PeauDuTronc(numpy.c_[boite().reshape(-1, 3), numpy.ones(len(boite()) * 3)][None],
                    numpy.tile([1.0, 0.0, 0.0, 0.0], (len(boite()) * 3, 1)), numpy.arange(len(boite()) * 3).reshape(-1, 3),
                    numpy.array([-1, 0, 1, 2]), numpy.zeros((1, 4, 3)))
"""Le tronc en boîte (`test_tronc.boite`), sur le dos."""
REPOS_DE_LA_CHAINE = (numpy.linalg.inv(RESTES[1:]), Vector((0.0, 0.24, 0.0)))


def peau(points, os_):
    """La `tronc.PeauDuMembre` des `points` de repos, chacun sur l'os de `os_` (1 bras, 2 avant-bras, 3 main), tous
    échantillonnés, de rayon nul."""
    x = numpy.c_[points, numpy.ones(len(points))]
    tous = numpy.arange(len(x))
    return PeauDuMembre(x[None], numpy.eye(4)[os_], numpy.zeros((0, 3), dtype=int), tous, tous, 0.0)


AVANT_BRAS = [(0.3, -0.25 - 0.03 * k, 1.3) for k in range(7)]
MAIN = [(0.3 + dx, -0.49 - dy, 1.3) for dx in (-0.02, 0.02) for dy in (0.0, 0.04)]
MEMBRE, PAUME = peau(numpy.array(AVANT_BRAS + MAIN), [2] * 7 + [3] * 4), peau(numpy.array(MAIN), [3] * 4)
ZONES = ['avant_bras_g'] * 7 + ['main_g'] * 4


def image(epaule, articulation, poignet):
    """Le `TroncPose` du tronc en boîte et le `Bras` du bras posé de l'`epaule` au coude `articulation` puis au
    `poignet`, chaque os tourné au plus court depuis son repos, la main dans l'axe de l'avant-bras."""
    axes = [Vector((0, -1, 0)).rotation_difference((b - a).normalized()).to_matrix() @ REPOS
            for a, b in ((epaule, articulation), (articulation, poignet))]
    mondes = [matrice(axes[0], epaule), matrice(axes[1], articulation), matrice(axes[1], poignet)]
    courantes = numpy.array([numpy.eye(4)] + mondes) @ numpy.linalg.inv(RESTES)
    pose = tronc_pose(TRONC, courantes, champs=False)
    return pose, bras_de_l_image(TRONC, pose, courantes, CHAINE, REPOS_DE_LA_CHAINE, MEMBRE, PAUME, ZONES)


def torsion(appui, axes):
    """La torsion, en radians, autour de son +Y, de l'os aux `axes` sous les axes `appui`."""
    return (appui.transposed() @ axes).to_quaternion().to_swing_twist('Y')[1]


def segment(depart, direction, longueur):
    return depart + Vector(direction).normalized() * longueur


def devant():
    """Le bras tendu devant le tronc, loin de lui."""
    epaule = Vector((0.3, -0.05, 1.3))
    articulation = segment(epaule, (0, -1, -0.2), 0.25)
    return image(epaule, articulation, segment(articulation, (0, -1, 0), 0.24))


def coude_dedans():
    """L'avant-bras qui part de l'intérieur du flanc +X du tronc vers l'avant, la main dehors devant."""
    epaule = Vector((0.3, -0.12, 1.225))
    articulation = segment(epaule, (-0.11, 0, -0.225), 0.25)
    return image(epaule, articulation, segment(articulation, (0, -1, 0), 0.24))


def avec_champs(pose):
    return champs_du_tronc(TRONC, pose)


class HorsDuTronc(unittest.TestCase):
    def test_un_bras_hors_du_tronc_ne_se_corrige_pas_et_sa_pose_ressort_a_l_identique(self):
        pose, bras = devant()
        corrections = corriger(TRONC, [pose] * 3, [{'l': bras}] * 3, numpy.arange(3.0))
        avancees, ecarts, proches = corrections['l']
        self.assertEqual([float(v) for v in numpy.concatenate((avancees, ecarts))], [0.0] * 6)
        self.assertFalse(proches.any())
        matrices, _, _ = poses_du_bras(bras, pose, 0.0, [0.0])
        numpy.testing.assert_allclose(matrices[0], bras.sources[0], atol=1e-6)
        self.assertIsNone(mesurer(TRONC, pose, {'l': bras})[1])


class MainDansLeTronc(unittest.TestCase):
    def test_elle_en_sort_a_la_marge_par_l_avancee(self):
        epaule = Vector((0.3, -0.35, 1.3))
        articulation = segment(epaule, (0, 0, -1), 0.25)
        pose, bras = image(epaule, articulation, segment(articulation, (-0.5, 0.6, 0), 0.24))
        pose = avec_champs(pose)
        self.assertGreater(peau_posee(bras)[..., 1].max(), -0.15)
        avancee, ecart, profondeur = requis(pose, bras)
        self.assertGreater(avancee, 0.0)
        self.assertAlmostEqual(avancee, poussee_requise(pose, bras.main), places=12)
        self.assertEqual(ecart, 0.0)
        self.assertLessEqual(profondeur, -ECART_DU_TRONC['marge'])


class AvantBrasDansLeTronc(unittest.TestCase):
    def test_il_en_sort_par_l_ecart_du_coude_vers_le_dehors_la_main_en_place(self):
        pose, bras = coude_dedans()
        pose = avec_champs(pose)
        self.assertEqual(poussee_requise(pose, bras.main), 0.0)
        avancee, ecart, profondeur = requis(pose, bras)
        self.assertEqual(avancee, 0.0)
        self.assertGreater(ecart, 0.0)
        self.assertLessEqual(profondeur, -ECART_DU_TRONC['marge'])
        matrices, _, ((humerus, _, articulation),) = poses_du_bras(bras, pose, avancee, [ecart])
        self.assertGreater(Vector(articulation[:2]).length, Vector(bras.mondes[1, :2, 3]).length)
        numpy.testing.assert_allclose(matrices[0, 2] @ RESTES[3], bras.mondes[2], atol=1e-5)
        appui = Matrix(bras.appui.tolist())
        self.assertAlmostEqual(torsion(appui, humerus), torsion(appui, Matrix(bras.mondes[0, :3, :3].tolist())), places=5)


class Enveloppe(unittest.TestCase):
    def test_l_ecart_d_une_image_corrigee_se_raccorde_a_ses_voisines_a_pas_borne(self):
        loin, contact, milieu = devant(), coude_dedans(), 15
        images = [contact if i == milieu else loin for i in range(31)]
        corrections = corriger(TRONC, [p for p, _ in images], [{'l': b} for _, b in images], numpy.arange(31.0))
        _, ecarts, _ = corrections['l']
        requis_ = requis(avec_champs(contact[0]), contact[1])[1]
        self.assertAlmostEqual(ecarts[milieu], requis_, places=9)
        en_images = RACCORD * IMAGES_PAR_SECONDE
        self.assertTrue((ecarts[[milieu - 1, milieu + 1]] > 0).all())
        self.assertFalse(ecarts[numpy.abs(numpy.arange(31) - milieu) >= en_images].any())
        self.assertLessEqual(numpy.abs(numpy.diff(ecarts)).max(), requis_ * math.pi / (2 * en_images) + 1e-9)


class Reste(unittest.TestCase):
    def test_un_bras_que_ni_l_avancee_ni_le_coude_ne_sortent_se_rend_en_reste_sans_lever(self):
        epaule = Vector((0.3, 0.05, 1.3))
        articulation = segment(epaule, (-0.24, 0, -0.07), 0.25)
        pose, bras = image(epaule, articulation, segment(articulation, (0, 0, -1), 0.24))
        corrections = corriger(TRONC, [pose], [{'l': bras}], numpy.zeros(1))
        self.assertLessEqual(corrections['l'][0][0], POUSSEE['borne'] + POUSSEE['tolerance'])
        _, (profondeur, jeu, zone) = mesurer(TRONC, pose, {'l': bras})
        self.assertGreater(profondeur, POUSSEE['refus'])
        self.assertEqual((jeu, zone in ZONES), (0, True))


if __name__ == '__main__':
    unittest.main()
