"""tronc (#3810) : la posture du tronc est la moyenne pondérée des rotations de ses os ; le champ d'une boîte fermée porte
son enfoncement, tournée ou non, signé et à 2 mm près, profond compris ; un tube ouvert en haut et en bas contient son axe et
non le dessus de son ouverture, couché par ses os comme debout, et son avant suit sa posture ; un point loin du tronc est
dehors ; la profondeur exacte d'un point dans une boîte ou un tube ouvert est sa distance au plus proche triangle, un
point dehors ou au-dessus de l'ouverture est à `-inf` ; un point dans une boîte ou à portée d'elle est atteint, un point au-delà non ; sous une silhouette à os, le
tronc posé et la peau du membre posée sous une autre pose de la chaîne sont ceux du squelette déplacé explicite (#4002) ; le coude
d'un bras à deux os atteint la cible à portée en gardant ses segments et plie du côté du pôle, ramène une cible hors de
portée sur la sphère de portée."""
import math
import sys
import unittest
from pathlib import Path

import bpy  # noqa: F401
import numpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from sol import tetes_deplacees  # noqa: E402
from test_sol import DECALAGE, DEPLACEMENTS, PARENT, POIDS, PROPRE, SOMMET, autour_de_l_avant, peaux  # noqa: E402
from tronc import (CHAMP, MembrePose, PeauDuMembre, PeauDuTronc, atteints, avant, champ, coude,  # noqa: E402
                   lire_le_champ, membre_pose, posture_du_tronc, poser_le_membre, profondeurs, profondeurs_exactes, tronc_pose)

BAS, HAUT = numpy.array([-0.2, -0.15, 0.8]), numpy.array([0.2, 0.15, 1.4])


def autour_de_z(angle):
    c, s = math.cos(angle), math.sin(angle)
    m = numpy.eye(4)
    m[:2, :2] = [[c, -s], [s, c]]
    return m


def autour_de_x(angle):
    c, s = math.cos(angle), math.sin(angle)
    m = numpy.eye(4)
    m[1:3, 1:3] = [[c, -s], [s, c]]
    return m


def boite(bas=BAS, haut=HAUT, n=12):
    """Les triangles (triangles, 3, 3) de la surface fermée de la boîte [`bas`, `haut`], `n` × `n` carreaux par face."""
    triangles = []
    for axe in range(3):
        u, v = [i for i in range(3) if i != axe]
        gu, gv = numpy.linspace(bas[u], haut[u], n + 1), numpy.linspace(bas[v], haut[v], n + 1)
        for cote in (bas[axe], haut[axe]):
            for i in range(n):
                for j in range(n):
                    coins = []
                    for a, b in ((gu[i], gv[j]), (gu[i + 1], gv[j]), (gu[i + 1], gv[j + 1]), (gu[i], gv[j + 1])):
                        p = numpy.zeros(3)
                        p[axe], p[u], p[v] = cote, a, b
                        coins.append(p)
                    triangles += [[coins[0], coins[1], coins[2]], [coins[0], coins[2], coins[3]]]
    return numpy.array(triangles)


def tronc_en_boite(*bornes):
    """Le tronc en boîte (`boite`, aux `bornes` données), posé au repos sur un seul os, un seul jeu : sa `PeauDuTronc` et
    son `TroncPose`."""
    return tronc_pose(peau_de_boite(*bornes), numpy.eye(4)[None])


def peau_de_boite(*bornes):
    """La `PeauDuTronc` de la boîte (`boite`, aux `bornes` données), sur un seul os, un seul jeu."""
    x = boite(*bornes).reshape(-1, 3)
    return PeauDuTronc(numpy.c_[x, numpy.ones(len(x))][None], numpy.ones((len(x), 1)), numpy.arange(len(x)).reshape(-1, 3),
                       numpy.array([-1]), numpy.zeros((1, 1, 3)))


def tube(rayon=0.12, bas=0.8, haut=1.4, cotes=32, etages=12):
    """Les sommets (sommets, 3) et les triangles d'indices d'un tube d'axe Z, ouvert en haut et en bas."""
    angles = numpy.linspace(0, 2 * math.pi, cotes, endpoint=False)
    hauteurs = numpy.linspace(bas, haut, etages + 1)
    sommets = numpy.array([(rayon * math.cos(a), rayon * math.sin(a), z) for z in hauteurs for a in angles])
    faces = []
    for k in range(etages):
        for i in range(cotes):
            a, b = k * cotes + i, k * cotes + (i + 1) % cotes
            faces += [[a, b, b + cotes], [a, b + cotes, a + cotes]]
    return sommets, numpy.array(faces)


class Posture(unittest.TestCase):
    def test_deux_os_de_poids_egaux_a_0_et_60_degres_donnent_30_degres(self):
        rotation = posture_du_tronc(numpy.array([1.0, 1.0]), numpy.array([numpy.eye(4), autour_de_z(math.radians(60))]))
        numpy.testing.assert_allclose(rotation, autour_de_z(math.radians(30))[:3, :3], atol=1e-12)


class ChampDUneBoite(unittest.TestCase):
    def test_tournee_signe_et_grandeur_a_2_mm_dedans_et_dehors(self):
        tour = autour_de_z(math.radians(45))[:3, :3]
        c = champ(boite() @ tour.T)
        points = numpy.array([[0.0, 0.0, 1.4 - 0.004], [0.0, -0.15 + 0.01, 1.1], [0.2 - 0.007, 0.03, 1.0],
                              [0.0, 0.0, 1.4 + 0.005], [0.0, -0.15 - 0.012, 1.1], [0.2 + 0.003, 0.03, 1.0]])
        numpy.testing.assert_allclose(lire_le_champ(c, points @ tour.T), [0.004, 0.01, 0.007, -0.005, -0.012, -0.003], atol=0.002)

    def test_un_point_profond_lit_sa_profondeur(self):
        self.assertAlmostEqual(lire_le_champ(champ(boite()), numpy.array([[0.01, -0.15 + 0.08, 1.1]]))[0], 0.08, delta=0.002)

    def test_un_point_loin_du_tronc_est_dehors(self):
        self.assertEqual(lire_le_champ(champ(boite()), numpy.array([[0.0, -0.9, 1.1]]))[0], -CHAMP['portee'])


class Atteints(unittest.TestCase):
    def test_un_point_dedans_ou_a_portee_est_atteint_un_point_au_dela_non(self):
        points = numpy.array([[0.0, 0.0, 1.4 - 0.004], [0.0, -0.15 + 0.08, 1.1], [0.0, -0.15 - 0.012, 1.1], [0.5, 0.0, 1.1],
                              [0.2 + 0.008, 0.149, 0.81]])
        self.assertEqual(atteints(boite(), points, 0.01).tolist(), [True, True, False, False, True])


def tronc_en_tube(matrice):
    """Le `TroncPose` du tube ouvert (`tube`) sur un seul os de matrice de peau `matrice`, un seul jeu."""
    sommets, faces = tube()
    x = numpy.c_[sommets, numpy.ones(len(sommets))]
    return tronc_pose(PeauDuTronc(x[None], numpy.ones((len(x), 1)), faces, numpy.array([-1]), numpy.zeros((1, 1, 3))),
                      matrice[None])


class ProfondeurExacte(unittest.TestCase):
    def test_dans_une_boite_la_distance_au_plus_proche_triangle_dehors_moins_l_infini(self):
        points = numpy.array([[[0.0, 0.0, 1.4 - 0.003], [0.05, -0.15 + 0.007, 1.0], [0.01, -0.15 + 0.08, 1.1],
                               [0.0, -0.15 - 0.002, 1.1], [0.5, 0.0, 1.1]]])
        vus = profondeurs_exactes(tronc_en_boite(), points)[0]
        numpy.testing.assert_allclose(vus[:3], [0.003, 0.007, 0.08], atol=1e-3)
        self.assertEqual(vus[3:].tolist(), [-math.inf, -math.inf])

    def test_dans_un_tube_ouvert_l_axe_est_dedans_a_son_rayon_le_dessus_de_l_ouverture_dehors(self):
        points = numpy.array([[[0.0, 0.0, 1.1], [0.0, 0.0, 1.41], [0.115, 0.0, 1.1], [0.1, 0.1, 1.1]]])
        vus = profondeurs_exactes(tronc_en_tube(numpy.eye(4)), points)[0]
        self.assertAlmostEqual(vus[0], 0.12 * math.cos(math.pi / 32), delta=1e-3)
        self.assertAlmostEqual(vus[2], 0.005, delta=1e-3)
        self.assertEqual(vus[[1, 3]].tolist(), [-math.inf, -math.inf])


class ChampDUnTube(unittest.TestCase):
    def tronc(self, matrice):
        return tronc_en_tube(matrice)

    def test_son_axe_est_dedans_et_le_dessus_de_son_ouverture_dehors(self):
        vus = profondeurs(self.tronc(numpy.eye(4)), numpy.array([[[0.0, 0.0, 1.1], [0.0, 0.0, 1.41]]]))[0]
        self.assertGreater(vus[0], 0)
        self.assertLess(vus[1], 0)

    def test_couche_par_ses_os_il_garde_ses_verdicts(self):
        couche = autour_de_x(math.radians(90))
        points = (couche[:3, :3] @ numpy.array([[0.0, 0.0, 1.1], [0.0, 0.0, 1.41]]).T).T
        vus = profondeurs(self.tronc(couche), points[None])[0]
        self.assertGreater(vus[0], 0)
        self.assertLess(vus[1], 0)

    def test_son_avant_suit_sa_posture(self):
        numpy.testing.assert_allclose(avant(self.tronc(numpy.eye(4))), (0.0, -1.0, 0.0), atol=1e-12)
        couche = autour_de_x(math.radians(90))
        numpy.testing.assert_allclose(avant(self.tronc(couche)), couche[:3, :3] @ (0.0, -1.0, 0.0), atol=1e-12)


LOCALES = [numpy.eye(4), autour_de_l_avant(numpy.pi / 2), autour_de_l_avant(-numpy.pi / 3)]
AUTRES = [autour_de_l_avant(0.4), autour_de_l_avant(-0.7), autour_de_l_avant(1.1)]
CLE = DECALAGE + PROPRE


class SousUneSilhouetteAOs(unittest.TestCase):
    def test_le_tronc_pose_est_la_peau_du_squelette_deplace(self):
        x = (SOMMET + numpy.r_[CLE, 0.0])[None, None]
        tronc = PeauDuTronc(x, POIDS, numpy.array([[0, 0, 0]]), PARENT, DEPLACEMENTS[None])
        pose = tronc_pose(tronc, peaux(numpy.zeros((3, 3)), LOCALES))
        explicite = (peaux(DEPLACEMENTS, LOCALES)[2] @ (SOMMET + numpy.r_[CLE, 0.0]))[:3]
        numpy.testing.assert_allclose(pose.positions[0, 0], explicite, atol=1e-12)

    def test_la_peau_du_membre_sous_une_autre_pose_est_celle_du_squelette_deplace(self):
        x = numpy.array([SOMMET + numpy.r_[CLE, 0.0], [0.05, 0.0, 1.5, 1.0]])
        w = numpy.array([[0.0, 0.5, 0.5], [0.2, 0.8, 0.0]])
        membre = PeauDuMembre(x[None], w, numpy.zeros((0, 3), dtype=int), numpy.arange(2), numpy.arange(2), 0.0)
        courantes = peaux(numpy.zeros((3, 3)), LOCALES)
        pose = membre_pose(membre, courantes, tetes_deplacees(courantes[None], PARENT, DEPLACEMENTS), DEPLACEMENTS[None], PARENT,
                           [0, 1, 2])
        self.assertIsInstance(pose, MembrePose)
        nouvelles = peaux(numpy.zeros((3, 3)), AUTRES)
        tetes = tetes_deplacees(nouvelles[None], PARENT, DEPLACEMENTS)[None]
        posee = poser_le_membre(pose, nouvelles[None], tetes)[0, 0]
        deplace = peaux(DEPLACEMENTS, AUTRES)
        explicite = numpy.einsum('nb,bij,nj->ni', w, deplace, x)[:, :3]
        numpy.testing.assert_allclose(posee, explicite, atol=1e-12)


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


if __name__ == '__main__':
    unittest.main()
