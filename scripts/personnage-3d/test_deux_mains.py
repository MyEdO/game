"""deux_mains : le coude d'un bras à deux os atteint la cible à portée en gardant ses segments et plie du côté du pôle,
ramène une cible hors de portée sur la sphère de portée ; les clés de geste s'interpolent en partant et en arrivant au
repos, sauf à une clé d'élan, la prise `main` à la moitié de l'écart du milieu de chaque clé ; le repère de l'arme porte
son +Y vers le fer et son +X au plus près du flanc donné ; chaque clip dérivé a une clé au début et une à la fin, et un
maniement dont la seconde prise est déclarée ; le bras ne se tord pas et l'avant-bras porte la torsion dans ses bornes ;
le dépassement des bornes articulaires se lit sur le vecteur de rotation, à la marge près, et écarte l'IK d'une pose qui
en sort ;
une peau déplacée d'un bloc garde ses longueurs, un os plié étire l'arête à cheval, l'écrasement ne lit que les arêtes
que meuvent les os libres ; la seconde
prise de chaque arme tourne comme celle des clips de son maniement."""
import json
import math
import sys
import unittest
from pathlib import Path

import bpy
import numpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from deux_mains import (CLIPS, MARGE_DES_BORNES, POIGNET, PRONATION, SECONDES, PeauDuBras, bras, cle, coude,  # noqa: E402
                        etirement_du_bras, hors_des_bornes, interpoler, peau_fixe, repere_de_l_arme)

L1, L2 = 0.25, 0.24
LIBRE = {a: [-180, 180] for a in 'xyz'}


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


def torsion(parent, enfant):
    """La torsion, en degrés, de l'os aux axes `enfant` autour de son +Y, relative aux axes `parent`."""
    return math.degrees((parent.transposed() @ enfant).to_quaternion().to_swing_twist('Y')[1])


class Bras(unittest.TestCase):
    EPAULE = Vector((0.2, 0, 1.45))
    AXES = Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0)))
    """Le bras gauche au repos en T : son +Y vers la gauche du personnage (+X), son +X vers le bas."""

    def poser(self, tourne, cible=Vector((0.15, -0.38, 1.2)), bornes=(LIBRE, LIBRE)):
        devant = self.AXES.col[1].rotation_difference(Vector((0, -1, 0))).to_matrix() @ self.AXES
        main = (devant @ Matrix.Rotation(math.radians(tourne), 3, 'Y')).to_4x4()
        main.translation = cible
        un = Matrix.Identity(3)
        return main, bras(self.EPAULE, self.AXES, main, (L1, L2), Vector((0.55, 0.35, -0.75)), un, un, PRONATION['l'], bornes)

    def test_une_borne_de_l_avant_bras_ecarte_l_ik_de_la_pose_qui_en_sort(self):
        _, (_, humerus, avant_bras, _, _, _) = self.poser(0)
        q = (humerus.transposed() @ avant_bras).to_quaternion()
        v = q.axis * math.degrees(q.angle)
        axe = max(range(3), key=lambda i: abs(v[i]))
        serree = {**LIBRE, 'xyz'[axe]: [-abs(v[axe]) / 2, abs(v[axe]) / 2]}
        _, (_, humerus_, avant_bras_, _, _, detail) = self.poser(0, bornes=(serree, LIBRE))
        self.assertLess(hors_des_bornes(humerus_.transposed() @ avant_bras_, serree),
                        hors_des_bornes(humerus.transposed() @ avant_bras, serree))
        self.assertAlmostEqual(detail[4], round(hors_des_bornes(humerus_.transposed() @ avant_bras_, serree), 1), places=6)

    def test_le_bras_ne_se_tord_pas_et_l_avant_bras_porte_la_torsion_dans_ses_bornes(self):
        for tourne in (-150, -90, -40, 0, 30, 90):
            with self.subTest(tourne=tourne):
                main, (_, humerus, avant_bras, articulation, _, _) = self.poser(tourne)
                self.assertAlmostEqual(torsion(self.AXES, humerus), 0, places=3)
                self.assertLessEqual(PRONATION['l'][0] - 1e-3, torsion(humerus, avant_bras))
                self.assertLessEqual(torsion(humerus, avant_bras), PRONATION['l'][1] + 1e-3)
                self.assertAlmostEqual((articulation - self.EPAULE).length, L1, places=5)

    def test_une_main_tournee_dans_les_bornes_de_l_avant_bras_garde_le_poignet_droit(self):
        for tourne in (-150, -90, -30):
            with self.subTest(tourne=tourne):
                main, (_, _, avant_bras, _, _, _) = self.poser(tourne)
                self.assertAlmostEqual(torsion(avant_bras, main.to_3x3()), 0, places=2)

    def test_au_dela_de_sa_borne_l_avant_bras_s_y_arrete_et_le_poignet_prend_le_reste(self):
        for tourne in (0, 30, 60):
            with self.subTest(tourne=tourne):
                main, (_, humerus, avant_bras, _, _, _) = self.poser(tourne)
                self.assertAlmostEqual(torsion(humerus, avant_bras), PRONATION['l'][1], places=2)
                self.assertGreater(torsion(avant_bras, main.to_3x3()), 0)


class HorsDesBornes(unittest.TestCase):
    def test_le_vecteur_de_rotation_se_lit_par_axe_a_la_marge_pres(self):
        bornes = {'x': [-20, 50], 'y': [-180, 180], 'z': [-10, 20]}
        self.assertEqual(hors_des_bornes(Matrix.Identity(3), bornes), 0)
        self.assertAlmostEqual(hors_des_bornes(Matrix.Rotation(math.radians(30), 3, 'Z'), bornes), 10 + MARGE_DES_BORNES, places=4)
        self.assertAlmostEqual(hors_des_bornes(Matrix.Rotation(math.radians(-30), 3, 'X'), bornes), 10 + MARGE_DES_BORNES, places=4)
        self.assertAlmostEqual(hors_des_bornes(Matrix.Rotation(math.radians(19.5), 3, 'Z'), bornes), 0.5, places=4)


class Peau(unittest.TestCase):
    """Deux os, le second tournant autour de l'origine : une arête dans chaque os et une à cheval sur les deux."""
    X = numpy.array([[0, 0, 0, 1], [0.1, 0, 0, 1], [0.2, 0.01, 0, 1], [0.3, 0.01, 0, 1]], dtype=float)
    W = numpy.array([[1, 0], [1, 0], [0, 1], [0, 1]], dtype=float)
    ARETES = numpy.array([[0, 1], [1, 2], [2, 3]])

    def peau(self):
        longueurs = numpy.linalg.norm(self.X[self.ARETES[:, 0], :3] - self.X[self.ARETES[:, 1], :3], axis=1)
        return PeauDuBras(self.X, self.W, self.ARETES, longueurs)

    def etirement(self, *matrices):
        peau = self.peau()
        fixe = peau_fixe(peau, numpy.repeat(numpy.eye(4)[None], 2, axis=0), [0, 1])
        return etirement_du_bras(peau, fixe, [(i, numpy.array([numpy.array(m)])) for i, m in enumerate(matrices)])[0][0]

    def test_une_peau_deplacee_d_un_bloc_garde_ses_longueurs(self):
        bloc = Matrix.Translation((0.3, -0.2, 1.0)) @ Matrix.Rotation(1.1, 4, Vector((1, 2, 3)).normalized())
        self.assertAlmostEqual(self.etirement(Matrix.Identity(4), Matrix.Identity(4)), 1.0, places=6)
        self.assertAlmostEqual(self.etirement(bloc, bloc), 1.0, places=6)

    def test_le_second_os_plie_etire_l_arete_a_cheval(self):
        pli = Matrix.Rotation(math.radians(150), 4, 'Z')
        self.assertGreater(self.etirement(Matrix.Identity(4), pli), 2.0)

    def test_l_ecrasement_ne_lit_que_les_aretes_que_meuvent_les_os_libres(self):
        peau = self.peau()
        fixe = peau_fixe(peau, numpy.array([numpy.diag([0.1, 0.1, 0.1, 1.0]), numpy.eye(4)]), [1])
        ecrase = etirement_du_bras(peau, fixe, [(1, numpy.array([numpy.diag([0.5, 0.5, 0.5, 1.0])]))])[1][0]
        self.assertAlmostEqual(ecrase, 0.5, places=6)


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


class SecondesPrises(unittest.TestCase):
    RACINE = Path(__file__).resolve().parents[2]

    def test_la_seconde_prise_de_chaque_arme_tourne_comme_celle_des_clips_de_son_maniement(self):
        maniements = {a['id']: a.get('maniement') for a in json.loads((self.RACINE / 'src/data/apparences.json').read_text(encoding='utf-8'))}
        vues = 0
        for chemin in sorted((self.RACINE / 'hotes/godot/projet/modeles').glob('*.manifeste.json')):
            manifeste = json.loads(chemin.read_text(encoding='utf-8'))
            seconde = manifeste.get('liaison', {}).get('secondePrise')
            maniement = maniements.get(manifeste.get('cle', {}).get('apparence'))
            if seconde is None or maniement not in SECONDES:
                continue
            vues += 1
            with self.subTest(chemin.name):
                attendu = (0, math.radians(SECONDES[maniement][1]), 0)
                for lu, voulu in zip(seconde['rotation'], attendu):
                    self.assertAlmostEqual(lu, voulu, places=5)
                self.assertEqual(math.copysign(1, seconde['position'][1]), math.copysign(1, SECONDES[maniement][0]))
        self.assertGreater(vues, 0)


if __name__ == '__main__':
    unittest.main()
