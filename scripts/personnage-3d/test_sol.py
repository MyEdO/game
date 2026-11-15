"""sol (#4002) sous une silhouette à os, sur une chaîne racine -> parent -> enfant : `bas` d'une clé portée égale la peau
explicite du squelette déplacé (têtes translatées, binds compensés), `ecarts_des_os` est nul au repos,
`garder_les_pieds` mesure une clé portée à son portage, `geometrie` compte |d − D_b| + L_b au rayon d'un os."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from seuils import TOLERANCE_JUMEAUX_POSITION_M  # noqa: E402
from sol import bas, ecarts_des_os, garder_les_pieds, geometrie  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

TETES = numpy.array([[0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 0.0, 2.0]])
PARENT = numpy.array([-1, 0, 1])
DECALAGE = numpy.array([0.1, 0.0, 0.0])
"""D de l'enfant, latéral ; la racine et le parent ne bougent pas."""
DEPLACEMENTS = numpy.array([numpy.zeros(3), numpy.zeros(3), DECALAGE])
PROPRE = numpy.array([0.0, 0.0, 0.05])
"""h : la part du déplacement de clé du sommet hors du portage de l'enfant, d = D + h."""
SOMMET = numpy.array([0.0, 0.0, 2.3, 1.0])
"""Un sommet rigide de l'enfant, à r = 0,3 m de sa tête."""
POIDS = numpy.array([[0.0, 0.0, 1.0]])
TOLERANCE = 1e-12


def translation(v):
    m = numpy.eye(4)
    m[:3, 3] = v
    return m


def autour_de_l_avant(angle):
    """Rotation 4×4 d'`angle` autour de l'axe avant-arrière y."""
    c, s = numpy.cos(angle), numpy.sin(angle)
    m = numpy.eye(4)
    m[:3, :3] = [[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]]
    return m


def peaux(deplacements, locales):
    """Les matrices de peau de la chaîne, ses têtes au repos déplacées de `deplacements`, binds compensés, sous les
    rotations locales `locales` : P_b = P_p B_p⁻¹ B_b L_b, S_b = P_b B_b⁻¹ ; (os, 4, 4)."""
    binds = [translation(TETES[b] + deplacements[b]) for b in range(3)]
    poses = []
    for b in range(3):
        relatif = binds[b] if PARENT[b] < 0 else poses[PARENT[b]] @ numpy.linalg.inv(binds[PARENT[b]]) @ binds[b]
        poses.append(relatif @ locales[b])
    return numpy.array([p @ numpy.linalg.inv(m) for p, m in zip(poses, binds)])


def explicite(locales, cle):
    """La hauteur du sommet au pire coin c ∈ {0, 1}, par la peau du squelette déplacé de c D sous `locales`."""
    return min((peaux(c * DEPLACEMENTS, locales)[2] @ (SOMMET + numpy.r_[c * cle, 0.0]))[2] for c in (0.0, 1.0))


class BasSousUneClePortee(unittest.TestCase):
    CLE = DECALAGE + PROPRE

    def mesurer(self, locales):
        matrices = peaux(numpy.zeros((3, 3)), locales)[None]
        d = self.CLE[None, None]
        porte = bas(POIDS, SOMMET[None], d, matrices, {0: ecarts_des_os(matrices, PARENT, DEPLACEMENTS)})[0]
        naif = bas(POIDS, SOMMET[None], d, matrices, {})[0]
        return porte, naif

    def test_parent_tourne_l_enfant_porte_par_lui(self):
        """Le parent tourné de 90° autour de l'avant, l'enfant sans rotation locale : R_enfant = R_parent, e nul, la clé
        portée et la clé nue coïncident, et la peau explicite le confirme."""
        locales = [numpy.eye(4), autour_de_l_avant(numpy.pi / 2), numpy.eye(4)]
        porte, naif = self.mesurer(locales)
        self.assertAlmostEqual(porte, explicite(locales, self.CLE), delta=TOLERANCE)
        self.assertAlmostEqual(porte, naif, delta=TOLERANCE)

    def test_enfant_tourne_sous_son_parent(self):
        """Le parent tourné de 90° autour de l'avant, l'enfant de −90° sous lui : `bas` égale la peau explicite et
        s'écarte de repos + M d d'au moins 1 cm."""
        locales = [numpy.eye(4), autour_de_l_avant(numpy.pi / 2), autour_de_l_avant(-numpy.pi / 2)]
        porte, naif = self.mesurer(locales)
        self.assertAlmostEqual(porte, explicite(locales, self.CLE), delta=TOLERANCE)
        self.assertGreaterEqual(abs(porte - naif), 0.01)


class EcartsAuRepos(unittest.TestCase):
    def test_nuls_pour_tout_d(self):
        matrices = numpy.broadcast_to(numpy.eye(4), (2, 3, 4, 4)).copy()
        for graine in range(5):
            deplacements = numpy.random.default_rng(graine).normal(size=(3, 3))
            numpy.testing.assert_allclose(ecarts_des_os(matrices, PARENT, deplacements), 0.0, rtol=0, atol=TOLERANCE)


class GarderLesPieds(unittest.TestCase):
    """Deux sommets, tous deux de la surface du pied ; un portage C qui les translate."""
    SURFACES = {'foot_l': numpy.array([True, True])}
    PORTAGE = numpy.array([[0.02, 0.0, -0.01], [0.03, 0.0, -0.01]])
    RESIDU = numpy.array([0.0, 0.0, 1e-3])

    def garder(self, nom, delta, portages):
        garder_les_pieds([nom], delta[None], self.SURFACES, portages)

    def test_cle_portee_qui_translate_le_pied_de_son_portage(self):
        self.garder('carrure_moins', self.PORTAGE.copy(), {'carrure_moins': self.PORTAGE})

    def test_cle_portee_au_residu_d_un_millimetre(self):
        with self.assertRaisesRegex(RuntimeError, r'carrure_moins.*foot_l à 0\.001000 m de son portage par les os'):
            self.garder('carrure_moins', self.PORTAGE + self.RESIDU, {'carrure_moins': self.PORTAGE})

    def test_cle_non_portee_qui_deplace_le_pied(self):
        self.assertLess(TOLERANCE_JUMEAUX_POSITION_M, 1e-3)
        with self.assertRaisesRegex(RuntimeError, r'feminin.*foot_l à 0\.001000 m de son repos'):
            self.garder('feminin', numpy.array([self.RESIDU, numpy.zeros(3)]), {'carrure_moins': self.PORTAGE})


def rig():
    """La chaîne au repos, en objet Blender que lit `geometrie`."""
    os_ = []
    for nom, tete, parent in zip(('racine', 'parent', 'enfant'), TETES, PARENT):
        os_.append(SimpleNamespace(name=nom, head_local=Vector(tete), parent=os_[parent] if parent >= 0 else None))
    return SimpleNamespace(matrix_world=Matrix.Identity(4), data=SimpleNamespace(bones=os_))


class GeometrieSousUneClePortee(unittest.TestCase):
    RAYON = 0.3

    def test_rayon_de_l_enfant_porte(self):
        _, _, rayons, _ = geometrie(rig(), POIDS, SOMMET[None], (DECALAGE + PROPRE)[None, None], {0: DEPLACEMENTS})
        attendu = self.RAYON + numpy.linalg.norm(PROPRE) + numpy.linalg.norm(DECALAGE)
        self.assertAlmostEqual(rayons[2], attendu, delta=1e-6)

    def test_rayon_sans_silhouette_a_os(self):
        cle = DECALAGE + PROPRE
        _, _, rayons, _ = geometrie(rig(), POIDS, SOMMET[None], cle[None, None], {})
        self.assertAlmostEqual(rayons[2], self.RAYON + numpy.linalg.norm(cle), delta=1e-6)


if __name__ == '__main__':
    unittest.main()
