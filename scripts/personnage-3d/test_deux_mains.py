"""deux_mains : les clés de geste s'interpolent en partant et en arrivant au
repos, sauf à une clé d'élan, la prise `main` à la moitié de l'écart du milieu de chaque clé ; le repère de l'arme porte
son +Y vers le fer et son +X au plus près du flanc donné ; chaque clip dérivé a une clé au début et une à la fin, et un
maniement dont la seconde prise est déclarée ; le bras ne se tord pas et l'avant-bras porte la torsion dans ses bornes ;
le dépassement des bornes articulaires se lit sur le vecteur de rotation, à la marge donnée près ; il écarte l'IK d'une pose
qui sort des bornes resserrées de leur marge, et un bras posé ne manque le contrôle des bornes qu'au-delà de la borne
elle-même ;
une peau déplacée d'un bloc garde ses longueurs, un os plié étire l'arête à cheval, l'écrasement ne lit que les arêtes
que meuvent les os libres ; la peau du bras porte son repos sous chaque jeu du tronc et rapporte une arête à sa longueur
au repos du corps neutre : sous un jeu dont la clé de forme double une arête, son rapport au repos du jeu est 2 (#3810) ; la seconde
prise de chaque arme tourne comme celle des clips de son maniement ;
sous une silhouette à os, les têtes déplacées sont celles du squelette déplacé explicite ; le prix du tronc compte le
pire sommet de la peau du membre à sa marge, sur la tête d'os déplacée ; la poussée requise est nulle là où l'avancée ne
sort pas la peau (#4002, #3810) ; l'arme n'avance que pour la peau des mains, et la peau entière que l'IK laisse dans le
tronc se rend avec son jeu et la zone de son os dominant, à sa profondeur exacte : à 3 mm dedans elle passe, à 7 mm
elle refuse le clip ; un bras posé manque le contrôle d'une main qui tourne trop vite sur son avant-bras ou d'une peau
trop étirée (#3810) ;
le chemin d'un clip garde sa famille de poses tant qu'en changer paie plus que le prix qu'il y gagne, et en change sur
l'intervalle le plus long, et son roulis suit le repère de l'arme qui tourne sur son manche (#3878)."""
import json
import math
import sys
import unittest
from pathlib import Path

import bpy
import numpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from deux_mains import (BORNES, CLIPS, CONTINUITE, MARGE_DES_BORNES, PRONATION, SECONDES, TOURS, PeauDuBras, bras,  # noqa: E402
                        chemin, cle, defaut_du_bras, ecarter, etirement_du_bras, hors_des_bornes, interpoler, peau_du_bras,
                        peau_fixe, poser_les_bras, prix_du_tronc, rapports_du_bras, refus_du_tronc, repere_de_l_arme,
                        tour_du_repere)
from ecart import ECART_DU_TRONC, POUSSEE  # noqa: E402
from sol import ecarts_des_os, rotations_de_peau, tetes_deplacees  # noqa: E402
from test_sol import DEPLACEMENTS, PARENT, TETES, autour_de_l_avant, peaux  # noqa: E402
from test_tronc import tronc_en_boite  # noqa: E402
from tronc import TRONC, ChaineDuBras, PeauDuMembre, membre_pose  # noqa: E402

L1, L2 = 0.25, 0.24
LIBRE = {a: [-180, 180] for a in 'xyz'}


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
        essais = bras(self.EPAULE, self.AXES, main, (L1, L2), Vector((0.55, 0.35, -0.75)), un, un, PRONATION['l'], bornes)
        return main, min(essais(TOURS), key=lambda e: e[0])

    def test_une_borne_de_l_avant_bras_ecarte_l_ik_de_la_pose_qui_en_sort(self):
        _, (_, humerus, avant_bras, _, _, _) = self.poser(0)
        q = (humerus.transposed() @ avant_bras).to_quaternion()
        v = q.axis * math.degrees(q.angle)
        axe = max(range(3), key=lambda i: abs(v[i]))
        serree = {**LIBRE, 'xyz'[axe]: [-abs(v[axe]) / 2, abs(v[axe]) / 2]}
        _, (_, humerus_, avant_bras_, _, _, detail) = self.poser(0, bornes=(serree, LIBRE))
        self.assertLess(hors_des_bornes(humerus_.transposed() @ avant_bras_, serree, MARGE_DES_BORNES),
                        hors_des_bornes(humerus.transposed() @ avant_bras, serree, MARGE_DES_BORNES))
        self.assertAlmostEqual(detail[4], round(hors_des_bornes(humerus_.transposed() @ avant_bras_, serree, MARGE_DES_BORNES), 1),
                               places=6)

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
        self.assertEqual(hors_des_bornes(Matrix.Identity(3), bornes, MARGE_DES_BORNES), 0)
        self.assertAlmostEqual(hors_des_bornes(Matrix.Rotation(math.radians(30), 3, 'Z'), bornes, MARGE_DES_BORNES), 10 + MARGE_DES_BORNES,
                               places=4)
        self.assertAlmostEqual(hors_des_bornes(Matrix.Rotation(math.radians(-30), 3, 'X'), bornes, MARGE_DES_BORNES), 10 + MARGE_DES_BORNES,
                               places=4)
        self.assertAlmostEqual(hors_des_bornes(Matrix.Rotation(math.radians(19.5), 3, 'Z'), bornes, MARGE_DES_BORNES), 0.5, places=4)
        self.assertEqual(hors_des_bornes(Matrix.Rotation(math.radians(19.5), 3, 'Z'), bornes, 0.0), 0)


class Peau(unittest.TestCase):
    """Deux os, le second tournant autour de l'origine : une arête dans chaque os et une à cheval sur les deux."""
    X = numpy.array([[0, 0, 0, 1], [0.1, 0, 0, 1], [0.2, 0.01, 0, 1], [0.3, 0.01, 0, 1]], dtype=float)
    W = numpy.array([[1, 0], [1, 0], [0, 1], [0, 1]], dtype=float)
    ARETES = numpy.array([[0, 1], [1, 2], [2, 3]])

    def peau(self):
        longueurs = numpy.linalg.norm(self.X[self.ARETES[:, 0], :3] - self.X[self.ARETES[:, 1], :3], axis=1)
        return PeauDuBras(self.X[None], self.W, self.ARETES, longueurs)

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

    def test_sous_un_jeu_dont_la_cle_double_une_arete_son_rapport_au_repos_du_jeu_est_2(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        donnee = bpy.data.meshes.new('Bras')
        donnee.from_pydata([tuple(p[:3]) for p in self.X], [tuple(a) for a in self.ARETES], [])
        objet = bpy.data.objects.new('Bras', donnee)
        bpy.context.scene.collection.objects.link(objet)
        objet.vertex_groups.new(name='epaule').add(range(len(self.X)), 1.0, 'REPLACE')
        objet.shape_key_add(name='Basis')
        silhouettes = sorted({s for jeu in TRONC['silhouettes'] for s in jeu})
        for silhouette in silhouettes:
            objet.shape_key_add(name=silhouette)
        double = next(j for j, jeu in enumerate(TRONC['silhouettes']) if jeu == (silhouettes[0],))
        objet.data.shape_keys.key_blocks[silhouettes[0]].data[1].co = tuple(2 * self.X[1, :3] - self.X[0, :3])
        peau = peau_du_bras([objet], ['racine', 'epaule'], ['epaule'], Matrix.Identity(4))
        self.assertEqual(peau.x.shape, (len(TRONC['silhouettes']), len(self.X), 4))
        rapports = rapports_du_bras(peau, peau.x[:, :, :3])
        arete = next(k for k, (a, b) in enumerate(peau.aretes) if {int(a), int(b)} == {0, 1})
        self.assertAlmostEqual(rapports[0, arete], 1.0, places=6)
        self.assertAlmostEqual(rapports[double, arete], 2.0, places=6)


LOCALES = [numpy.eye(4), autour_de_l_avant(numpy.pi / 2), autour_de_l_avant(-numpy.pi / 2)]
"""Le parent tourné de 90° autour de l'avant, l'enfant de −90° sous lui : e_b = ΔJ_b − R_b D_b non nul (`test_sol`)."""


class SousUneSilhouetteAOs(unittest.TestCase):
    def test_les_tetes_deplacees_sont_celles_du_squelette_deplace_et_ecarts_des_os_en_lit_la_hauteur(self):
        matrices = peaux(numpy.zeros((3, 3)), LOCALES)[None]
        tetes = tetes_deplacees(matrices, PARENT, DEPLACEMENTS)[0]
        deplace, nu = peaux(DEPLACEMENTS, LOCALES), peaux(numpy.zeros((3, 3)), LOCALES)
        for b in range(3):
            explicite = (deplace[b] @ numpy.r_[TETES[b] + DEPLACEMENTS[b], 1.0] - nu[b] @ numpy.r_[TETES[b], 1.0])[:3]
            numpy.testing.assert_allclose(tetes[b], explicite, atol=1e-12)
        numpy.testing.assert_allclose(ecarts_des_os(matrices, PARENT, DEPLACEMENTS)[0],
                                      tetes[:, 2] - (rotations_de_peau(matrices)[0] @ DEPLACEMENTS[..., None])[:, 2, 0], atol=1e-12)


def membre(points, grossier=None):
    """La `tronc.MembrePose` des `points` (sommets, 3), chacun sur la main d'une chaîne bras, avant-bras, main au repos, et
    sa `tronc.PeauDuMembre`, tous les sommets échantillonnés, l'échantillon grossier `grossier` (tous sans lui), de
    rayon nul."""
    x = numpy.c_[points, numpy.ones(len(points))]
    tous = numpy.arange(len(x))
    peau = PeauDuMembre(x[None], numpy.tile([0.0, 0.0, 1.0], (len(x), 1)), numpy.zeros((0, 3), dtype=int), tous,
                        tous if grossier is None else numpy.array(grossier), 0.0)
    return membre_pose(peau, numpy.tile(numpy.eye(4), (3, 1, 1)), numpy.zeros((1, 3, 3)), numpy.zeros((1, 3, 3)), PARENT, [0, 1, 2]), peau


class Tronc(unittest.TestCase):
    AXES = numpy.eye(3)[None, None].repeat(2, axis=1)
    """Un essai, le bras et l'avant-bras à leur repos."""

    def prix(self, points, chaines=((0, 0, 0),) * 3, grossier=None):
        chaine = ChaineDuBras(numpy.eye(3)[None].repeat(2, axis=0), numpy.array(chaines, dtype=float)[None])
        return prix_du_tronc(tronc_en_boite(), membre(numpy.array(points), grossier), chaine,
                             numpy.tile(numpy.eye(4), (1, 3, 1, 1)), self.AXES)[0]

    def test_le_prix_du_tronc_compte_le_pire_sommet_de_la_peau_a_sa_marge(self):
        self.assertAlmostEqual(self.prix([(0.0, 0.0, 1.396), (0.0, 0.0, 1.7), (0.05, 0.0, 1.399)]),
                               ((0.004 + ECART_DU_TRONC['marge']) / ECART_DU_TRONC['echelle']) ** 2, places=6)

    def test_un_essai_dont_l_echantillon_grossier_ne_peut_toucher_ne_paie_rien(self):
        self.assertEqual(self.prix([(0.0, 0.0, 1.7), (0.0, 0.0, 1.396)], grossier=[0]), 0)
        self.assertGreater(self.prix([(0.0, 0.0, 1.7), (0.0, 0.0, 1.396)], grossier=[1]), 0)

    def test_sous_une_silhouette_a_os_la_peau_se_mesure_sur_sa_tete_deplacee(self):
        haute = [(0.0, 0.0, 1.41)]
        self.assertEqual(self.prix(haute), 0)
        self.assertAlmostEqual(self.prix(haute, ((0, 0, -0.02),) * 3),
                               ((0.01 + ECART_DU_TRONC['marge']) / ECART_DU_TRONC['echelle']) ** 2, places=6)

    def test_la_poussee_requise_est_nulle_la_ou_l_avancee_ne_sort_pas_la_peau(self):
        tronc = tronc_en_boite()
        requises = ecarter([tronc] * 2, [numpy.array([[[0.0, -0.146, 1.1]]]), numpy.array([[[0.0, 0.14, 1.1]]])])
        self.assertAlmostEqual(requises[0], 0.004 + ECART_DU_TRONC['marge'], delta=POUSSEE['tolerance'])
        self.assertEqual(requises[1], 0.0)


class DefautDuBras(unittest.TestCase):
    def lectures(self, tours):
        return [(Matrix.Identity(3), Matrix.Identity(3), Quaternion((0, 0, 1), math.radians(t))) for t in tours]

    def test_une_main_qui_tourne_sur_son_avant_bras_au_dela_de_la_vitesse_manque_le_controle_aux_images_verifiees(self):
        images, etirements = [0.0, 1.0, 2.0], [(1.0, 1.0)] * 3
        self.assertIsNone(defaut_du_bras('l', images, self.lectures((0, 1, 2)), etirements, range(3))[0])
        vite = self.lectures((0, 0, 179))
        self.assertEqual(defaut_du_bras('l', images, vite, etirements, range(3))[0][:2], ('vitesse du poignet', 2.0))
        self.assertIsNone(defaut_du_bras('l', images, vite, etirements, [0])[0])

    def test_une_peau_trop_etiree_manque_le_controle(self):
        defaut, _ = defaut_du_bras('l', [0.0], self.lectures((0,)), [(4.0, 1.0)], [0])
        self.assertEqual(defaut, ('étirement', 0.0, (4.0, 1.0)))

    def test_une_pose_dans_la_marge_des_bornes_passe_et_une_pose_au_dela_de_la_borne_manque_le_controle(self):
        borne = BORNES['lowerarm_l']['x'][1]
        for ecart_, attendu in ((-0.5, None), (0.5, ('bornes de lowerarm_l', 0.0, 0.5))):
            with self.subTest(ecart=ecart_):
                avant_bras = Matrix.Rotation(math.radians(borne + ecart_), 3, 'X')
                defaut, _ = defaut_du_bras('l', [0.0], [(avant_bras, Matrix.Identity(3), Quaternion())], [(1.0, 1.0)], [0])
                self.assertEqual(defaut, attendu)


class PoserLesBras(unittest.TestCase):
    class Image:
        """Une image sur le tronc en boîte dont la peau des mains est `mains` et la peau entière posée `peau`, l'arme
        translatée, chacune d'un sommet par zone de `zones` ; tout état paie le même prix."""
        def __init__(self, mains, peau, zones):
            self.tronc, self.zones = tronc_en_boite(), zones
            self._mains, self._peau = numpy.array([mains], dtype=float), numpy.array([peau], dtype=float)

        def prix(self, translation, roulis, tours):
            return numpy.zeros((len(roulis), len(tours['r']), len(tours['l'])))

        def poses(self, translation, etat):
            return numpy.array(translation), {}

        def peau(self, poses):
            return self._peau + poses[0]

        def mains(self, translation):
            return self._mains + numpy.array(translation)

    def test_l_arme_n_avance_que_pour_les_mains_et_la_peau_laissee_dedans_se_rend_avec_son_jeu_et_sa_zone(self):
        dehors, dedans = (0.0, -0.2, 1.1), (0.0, -0.146, 1.1)
        images = [self.Image([dehors], [dehors, (0.05, -0.146, 1.0)], ['main_d', 'avant_bras_g']),
                  self.Image([dedans], [dedans, dehors], ['main_g', 'avant_bras_d'])]
        poses, restes = poser_les_bras(images, [0.0, 1e3], [0.0, 0.0])
        self.assertEqual(tuple(poses[0][2]), (0.0, 0.0, 0.0))
        self.assertAlmostEqual(poses[1][2].y, -(0.004 + ECART_DU_TRONC['marge']), delta=POUSSEE['tolerance'])
        self.assertEqual((restes[0][1], restes[0][2]), (0, 'avant_bras_g'))
        self.assertAlmostEqual(restes[0][0], 0.004, delta=1e-3)
        self.assertLess(restes[1][0], 0.0)

    def test_une_peau_a_3_mm_dans_le_tronc_passe_a_7_mm_refuse_le_clip(self):
        images = [self.Image([(0.0, -0.3, 1.1)], [(0.0, -0.15 + p, 1.1)], ['main_d']) for p in (0.003, 0.007)]
        _, restes = poser_les_bras(images, [0.0, 1e3], [0.0, 0.0])
        self.assertIsNone(refus_du_tronc('Clip', 0.0, restes[0]))
        self.assertIn('main_d enfoncée de 0.70 cm', refus_du_tronc('Clip', 1.0, restes[1]))


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


class Chemin(unittest.TestCase):
    VALEURS = ([0, 90], [0], [0])
    """Deux familles de poses à 90° de roulis l'une de l'autre, les coudes fixes."""

    def etats(self, prix, durees, tours=None):
        prix = [numpy.array(p, dtype=float).reshape(2, 1, 1) for p in prix]
        return [e[0] for e in chemin(prix, [self.VALEURS] * len(prix), durees, tours or [0.0] * len(prix))]

    def test_il_garde_sa_famille_quand_une_image_seule_prefere_l_autre(self):
        saut = 90 ** 2 / CONTINUITE['vitesse'] ** 2
        ailleurs = 10 * saut
        self.assertEqual(self.etats([[0, ailleurs], [saut, 0], [0, ailleurs]], [0.0, 1.0, 1.0]), [0, 0, 0])
        self.assertEqual(self.etats([[0, ailleurs], [3 * saut, 0], [0, ailleurs]], [0.0, 1.0, 1.0]), [0, 1, 0])

    def test_il_change_de_famille_sur_l_intervalle_le_plus_long(self):
        self.assertEqual(self.etats([[0, 1e6], [0, 0], [0, 0], [1e6, 0]], [0.0, 1.0, 4.0, 1.0]), [0, 0, 1, 1])


    def test_le_roulis_suit_le_repere_de_l_arme_qui_tourne_sur_son_manche(self):
        self.assertEqual(self.etats([[0, 0], [0, 0]], [0.0, 1.0], [0.0, -90.0]), [0, 1])
        self.assertEqual(self.etats([[0, 0], [0, 0]], [0.0, 1.0], [0.0, 90.0]), [1, 0])
        self.assertEqual(self.etats([[0, 0], [0, 0]], [0.0, 1.0], [0.0, 270.0]), [0, 1])


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

    def test_son_tour_sur_le_manche_se_lit_quand_le_manche_passe_pres_du_flanc(self):
        flanc = Vector((1, 0, 0))
        avant, apres = (repere_de_l_arme(flanc, Vector(), Vector((1, 0, z))).to_3x3() for z in (0.1, -0.1))
        self.assertAlmostEqual(abs(tour_du_repere(avant, apres)), 180, places=4)
        tourne = Matrix.Rotation(math.radians(30), 3, avant.col[1]) @ avant
        self.assertAlmostEqual(tour_du_repere(avant, tourne), 30, places=4)
        self.assertAlmostEqual(tour_du_repere(tourne, avant), -30, places=4)


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
