"""membres (#3810) : un bras hors du tronc ne se corrige pas et sa pose ressort à l'identique ; un avant-bras à 3 mm dans
le tronc, sous la tolérance de la garde mais à moins de la marge, ne se corrige pas ; une main dans le tronc en sort à
la marge par l'avancée ; un avant-bras dans le tronc, main dehors, en sort par l'écart du coude, vers le dehors, la main
en place et le bras sans torsion ajoutée ; l'enveloppe raccorde l'écart d'une image corrigée à ses voisines, à pas
borné ; un bras que ni l'avancée ni le coude ne sortent ne requiert rien ; une correction qui laisse la peau dans le
tronc se refuse, une qui ferme sauf sous la carrure maximale, où la peau reste aussi enfoncée qu'à la source, se garde et
le dit, une qui l'y enfonce plus qu'à la source, même d'un dixième de millimètre, se refuse ; l'étirement de la peau du
bras se lit sous chaque jeu : sous un jeu dont la clé de forme double une arête, au double de celui du neutre, et sous un
jeu à os, sur la peau du squelette déplacé explicite ; une correction qui étire hors de `ETIREMENT_EN_CLIP` une arête que
la source y tenait se refuse, et la même se garde si la source dépassait déjà autant, non si elle l'aggrave au-delà de
`ETIREMENT_AGGRAVE` ; les courbes d'un bras refusé reviennent à leur source au bit près ; sur un rig, un clip dont un bras
ferme et l'autre manque un contrôle revient tout entier à sa source au bit près, os de pose compris, un clip dont un bras
n'a rien à corriger et l'autre ferme se garde, un clip dont la correction d'un bras enfonce dans le tronc l'autre bras,
non corrigé, revient à sa source, un clip dont la correction étire une arête hors de `ETIREMENT_EN_CLIP` sous un seul jeu
revient à sa source au bit près, un clip que rien ne sort sous la carrure maximale se garde sans elle, sauf si la
correction l'y enfonce plus qu'à la source ; sur un clip long, l'image voisine non écrite d'une image corrigée se
re-mesure, et chaque clé écrite garde l'hémisphère du quaternion source ; la passe du pack corrige sous les cinq jeux de
la visée initiale, puis sans la carrure maximale ; sur un rig, le tronc d'un état du gabarit est posé de ses clés à leurs
poids et ses os déplacés de ses facteurs (#3810)."""
import contextlib
import io
import math
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

import bpy  # noqa: F401
import numpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from animation import assign_action, meshes_for  # noqa: E402
from deux_mains import PeauDuBras, peau_du_bras  # noqa: E402
from ecart import ECART_DU_TRONC, RACCORD, poussee_requise  # noqa: E402
from noms_silhouettes import CARRURE_PLUS  # noqa: E402
from membres import (ETIREMENT_AGGRAVE, JEUX_REQUIS, bras_de_l_image, corriger, courbes,  # noqa: E402
                     ecarter_les_membres, etirement_neuf, etirements, exactes, peau_posee, poses_du_bras, requis, restaurer,
                     verdict)
from seuils import ETIREMENT_EN_CLIP, IMAGES_PAR_SECONDE, SOL_TOLERANCE_M  # noqa: E402
from test_sol import DEPLACEMENTS, PARENT, SOMMET, autour_de_l_avant, peaux  # noqa: E402
from test_tronc import boite  # noqa: E402
from tronc import (BRAS, TRONC as JEUX, PeauDuMembre, PeauDuTronc, champs_du_tronc, jeu_de_l_etat, peau_du_tronc,  # noqa: E402
                   profondeurs, tronc_pose)

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


SEUL = (0,)
"""Le seul jeu du tronc en boîte."""


def corriger_(images):
    """`corriger` sur les `images` (`TroncPose`, `Bras`), une par instant, sous le seul jeu du tronc en boîte."""
    poses, bras = [p for p, _ in images], [b for _, b in images]
    sources = numpy.array([exactes(TRONC, p, b) for p, b in images])
    return corriger(TRONC, poses, bras, numpy.arange(float(len(images))), sources, SEUL)


class HorsDuTronc(unittest.TestCase):
    def test_un_bras_hors_du_tronc_ne_se_corrige_pas_et_sa_pose_ressort_a_l_identique(self):
        pose, bras = devant()
        avancees, ecarts, rien = corriger_([(pose, bras)] * 3)
        self.assertEqual(rien, 0)
        self.assertEqual([float(v) for v in numpy.concatenate((avancees, ecarts))], [0.0] * 6)
        matrices, _, _ = poses_du_bras(bras, pose, 0.0, [0.0])
        numpy.testing.assert_allclose(matrices[0], bras.sources[0], atol=1e-6)
        self.assertEqual(exactes(TRONC, pose, bras).tolist(), [-math.inf])


class SousLaTolerance(unittest.TestCase):
    def test_un_avant_bras_a_3_mm_dans_le_tronc_a_moins_de_la_marge_ne_se_corrige_pas(self):
        articulation = Vector((0.197, -0.05, 1.1))
        pose, bras = image(articulation + Vector((0, 0, 0.25)), articulation, segment(articulation, (0, -1, 0), 0.24))
        self.assertAlmostEqual(float(exactes(TRONC, pose, bras)[0]), 0.003, delta=2e-4)
        self.assertGreater(profondeurs(avec_champs(pose), peau_posee(bras)[:, 0]).max(), -ECART_DU_TRONC['marge'])
        avancees, ecarts, rien = corriger_([(pose, bras)] * 3)
        self.assertEqual(rien, 0)
        self.assertEqual([float(v) for v in numpy.concatenate((avancees, ecarts))], [0.0] * 6)


class MainDansLeTronc(unittest.TestCase):
    def test_elle_en_sort_a_la_marge_par_l_avancee(self):
        epaule = Vector((0.3, -0.35, 1.3))
        articulation = segment(epaule, (0, 0, -1), 0.25)
        pose, bras = image(epaule, articulation, segment(articulation, (-0.5, 0.6, 0), 0.24))
        pose = avec_champs(pose)
        self.assertGreater(peau_posee(bras)[..., 1].max(), -0.15)
        avancee, ecart = requis(pose, bras, SEUL)
        self.assertGreater(avancee, 0.0)
        self.assertAlmostEqual(avancee, poussee_requise(pose, bras.main), places=12)
        self.assertEqual(ecart, 0.0)
        matrices, axes, _ = poses_du_bras(bras, pose, avancee, [ecart])
        self.assertLessEqual(profondeurs(pose, peau_posee(bras, matrices, axes)).max(), -ECART_DU_TRONC['marge'])


class AvantBrasDansLeTronc(unittest.TestCase):
    def test_il_en_sort_par_l_ecart_du_coude_vers_le_dehors_la_main_en_place(self):
        pose, bras = coude_dedans()
        pose = avec_champs(pose)
        self.assertEqual(poussee_requise(pose, bras.main), 0.0)
        avancee, ecart = requis(pose, bras, SEUL)
        self.assertEqual(avancee, 0.0)
        self.assertGreater(ecart, 0.0)
        matrices, axes, ((humerus, _, articulation),) = poses_du_bras(bras, pose, avancee, [ecart])
        self.assertLessEqual(profondeurs(pose, peau_posee(bras, matrices, axes)).max(), -ECART_DU_TRONC['marge'])
        self.assertGreater(Vector(articulation[:2]).length, Vector(bras.mondes[1, :2, 3]).length)
        numpy.testing.assert_allclose(matrices[0, 2] @ RESTES[3], bras.mondes[2], atol=1e-5)
        appui = Matrix(bras.appui.tolist())
        self.assertAlmostEqual(torsion(appui, humerus), torsion(appui, Matrix(bras.mondes[0, :3, :3].tolist())), places=5)


class Enveloppe(unittest.TestCase):
    def test_l_ecart_d_une_image_corrigee_se_raccorde_a_ses_voisines_a_pas_borne(self):
        loin, contact, milieu = devant(), coude_dedans(), 15
        _, ecarts, _ = corriger_([contact if i == milieu else loin for i in range(31)])
        requis_ = requis(avec_champs(contact[0]), contact[1], SEUL)[1]
        self.assertAlmostEqual(ecarts[milieu], requis_, places=9)
        en_images = RACCORD * IMAGES_PAR_SECONDE
        self.assertTrue((ecarts[[milieu - 1, milieu + 1]] > 0).all())
        self.assertFalse(ecarts[numpy.abs(numpy.arange(31) - milieu) >= en_images].any())
        self.assertLessEqual(numpy.abs(numpy.diff(ecarts)).max(), requis_ * math.pi / (2 * en_images) + 1e-9)


def rien_ne_sort():
    """Le bras dont l'avant-bras plonge dans le tronc, au plus profond, par son flanc +X."""
    epaule = Vector((0.3, 0.05, 1.3))
    articulation = segment(epaule, (-0.24, 0, -0.07), 0.25)
    return image(epaule, articulation, segment(articulation, (0, 0, -1), 0.24))


class RienNeSort(unittest.TestCase):
    def test_un_bras_que_ni_l_avancee_ni_le_coude_ne_sortent_ne_requiert_rien(self):
        pose, bras = rien_ne_sort()
        self.assertGreater(float(exactes(TRONC, pose, bras)[0]), SOL_TOLERANCE_M)
        self.assertIsNone(requis(avec_champs(pose), bras, SEUL))
        avancees, ecarts, rien = corriger_([(pose, bras)])
        self.assertEqual(float(numpy.abs(numpy.concatenate((avancees, ecarts))).max()), 0.0)
        self.assertEqual(rien, 1)


class Verdict(unittest.TestCase):
    IMAGES = [0.0, 1.0, 2.0]
    CARRURE_PLUS = next(j for j in JEUX_REQUIS[0] if j not in JEUX_REQUIS[1])

    def peaux(self, carrure_plus_source, carrure_plus_apres):
        sources = numpy.full((3, len(JEUX['jeux'])), 0.012)
        apres = numpy.full((3, len(JEUX['jeux'])), 0.002)
        sources[:, self.CARRURE_PLUS], apres[:, self.CARRURE_PLUS] = carrure_plus_source, carrure_plus_apres
        return sources, apres

    def test_une_correction_qui_laisse_la_peau_dans_le_tronc_se_refuse(self):
        sources, apres = self.peaux(0.02, 0.008)
        defaut, _ = verdict(sources, apres, JEUX_REQUIS[0], self.IMAGES)
        self.assertTrue(defaut.startswith('tronc image 0.00 carrure_plus 0.80 cm'))

    def test_une_correction_qui_ferme_sauf_sous_la_carrure_maximale_aussi_enfoncee_qu_a_la_source_se_garde_et_le_dit(self):
        sources, apres = self.peaux(0.02, 0.02)
        defaut, reste = verdict(sources, apres, JEUX_REQUIS[1], self.IMAGES)
        self.assertIsNone(defaut)
        self.assertEqual(reste, ' sauf carrure_plus : reste 2.00 cm image 0.00')

    def test_une_correction_qui_enfonce_la_peau_sous_la_carrure_maximale_plus_qu_a_la_source_se_refuse(self):
        for source, apres_ in ((0.02, 0.0201), (0.0045, 0.0054), (-math.inf, 0.0001)):
            sources, apres = self.peaux(source, apres_)
            defaut, _ = verdict(sources, apres, JEUX_REQUIS[1], self.IMAGES)
            self.assertEqual(defaut, f'carrure_plus plus enfoncée image 0.00 {apres_ * 100:.4f} cm pour {max(source, 0.0) * 100:.4f} cm')


class EtirementNeuf(unittest.TestCase):
    """Deux images, trois arêtes au rapport 1 sous chaque jeu, sauf la dernière sous le dernier jeu."""
    JEU = len(JEUX['jeux']) - 1

    def rapports(self, source, apres):
        sources, apres_ = numpy.ones((2, len(JEUX['jeux']), 3)), numpy.ones((2, len(JEUX['jeux']), 3))
        sources[1, self.JEU, 2], apres_[1, self.JEU, 2] = source, apres
        return sources, apres_

    def test_une_correction_qui_etire_hors_des_bornes_une_arete_que_la_source_y_tenait_se_refuse(self):
        haut = ETIREMENT_EN_CLIP[1]
        self.assertEqual(etirement_neuf(*self.rapports(haut - 0.005, haut + 0.005), [0.0, 8.0]),
                         f'étirement sous {JEUX["jeux"][self.JEU].nom} image 8.00 {haut + 0.005:.5f}')

    def test_la_meme_correction_se_garde_si_la_source_depassait_deja_autant(self):
        haut = ETIREMENT_EN_CLIP[1]
        self.assertIsNone(etirement_neuf(*self.rapports(haut + 0.04, haut + 0.04), [0.0, 8.0]))
        self.assertIsNone(etirement_neuf(*self.rapports(haut + 0.04, (haut + 0.04) * (1 + ETIREMENT_AGGRAVE / 2)), [0.0, 8.0]))

    def test_une_correction_qui_aggrave_un_depassement_de_la_source_au_dela_de_sa_part_se_refuse(self):
        haut = ETIREMENT_EN_CLIP[1]
        self.assertIsNotNone(etirement_neuf(*self.rapports(haut + 0.04, (haut + 0.04) * (1 + 2 * ETIREMENT_AGGRAVE)), [0.0, 8.0]))


class EtirementSousLesJeux(unittest.TestCase):
    def test_sous_un_jeu_dont_la_cle_double_une_arete_l_etirement_lu_est_le_double_de_celui_du_neutre(self):
        rig = rig_minimal()
        objet = bpy.data.objects['Rig-bras-l']
        double = next(j for j, jeu in enumerate(JEUX['jeux']) if len(jeu.poids) == 1)
        sommets = [numpy.array(objet.data.vertices[i].co) for i in (0, 4)]
        objet.data.shape_keys.key_blocks[next(iter(JEUX['jeux'][double].poids))].data[4].co = tuple(2 * sommets[1] - sommets[0])
        poser(rig, 'l', *flanc('l'))
        noms = [b.name for b in rig.data.bones]
        peaux_ = meshes_for(bpy, rig)
        tronc = peau_du_tronc(rig, peaux_, JEUX['jeux'])
        epaule = rig.data.bones['upperarm_l']
        peau_ = peau_du_bras(peaux_, noms, [o.name for o in (epaule, *epaule.children_recursive)], rig.matrix_world.inverted(),
                             JEUX['jeux'])
        courantes = numpy.array([numpy.array(rig.pose.bones[n].matrix @ rig.data.bones[n].matrix_local.inverted()) for n in noms])
        rapports = etirements(tronc, peau_, tronc_pose(tronc, courantes, champs=False), courantes)
        a, b = (int(numpy.linalg.norm(peau_.x[0, :, :3] - s, axis=1).argmin()) for s in sommets)
        arete = next(k for k, paire in enumerate(peau_.aretes) if {int(paire[0]), int(paire[1])} == {a, b})
        self.assertAlmostEqual(rapports[0, arete], 1.0, places=5)
        self.assertAlmostEqual(rapports[double, arete], 2 * rapports[0, arete], places=5)

    def test_sous_un_jeu_a_os_la_peau_suit_l_os_deplace(self):
        x = numpy.array([SOMMET, [0.05, 0.0, 1.5, 1.0]])
        w = numpy.array([[0.0, 0.0, 1.0], [0.0, 1.0, 0.0]])
        deplacements = numpy.stack([numpy.zeros((3, 3)), DEPLACEMENTS])
        tronc = PeauDuTronc(numpy.stack([SOMMET[None]] * 2), numpy.array([[0.0, 0.0, 1.0]]), numpy.array([[0, 0, 0]]), PARENT,
                            deplacements)
        longueur = numpy.linalg.norm(x[0, :3] - x[1, :3])
        peau_ = PeauDuBras(numpy.stack([x] * 2), w, numpy.array([[0, 1]]), numpy.array([longueur]))
        locales = [numpy.eye(4), autour_de_l_avant(numpy.pi / 2), autour_de_l_avant(-numpy.pi / 2)]
        courantes = peaux(numpy.zeros((3, 3)), locales)
        rapports = etirements(tronc, peau_, tronc_pose(tronc, courantes, champs=False), courantes)
        for jeu, d in enumerate(deplacements):
            y = numpy.einsum('nb,bij,nj->ni', w, peaux(d, locales), x)[:, :3]
            self.assertAlmostEqual(rapports[jeu, 0], numpy.linalg.norm(y[0] - y[1]) / longueur, places=9)
        self.assertGreater(abs(rapports[1, 0] - rapports[0, 0]), 0.01)


class Restaurer(unittest.TestCase):
    def test_les_courbes_d_un_bras_refuse_reviennent_a_leur_source_au_bit_pres(self):
        action = bpy.data.actions.new('Restaurer')
        bande = action.layers.new('Couche').strips.new(type='KEYFRAME')
        sac = bande.channelbag(action.slots.new(id_type='OBJECT', name='Rig'), ensure=True)
        for i in range(4):
            courbe = sac.fcurves.new('pose.bones["lowerarm_l"].rotation_quaternion', index=i)
            for image, valeur in ((0.0, 0.1 * i + 1 / 3), (7.5, -0.2 * i + 2 / 7)):
                courbe.keyframe_points.insert(image, valeur).interpolation = 'LINEAR'
        os_ = ('upperarm_l', 'lowerarm_l', 'hand_l')
        source = courbes(action, os_)
        for courbe in sac.fcurves:
            courbe.keyframe_points.insert(3.25, 0.7)
            courbe.keyframe_points[0].co[1] += 0.01
        sac.fcurves.new('pose.bones["hand_l"].rotation_quaternion', index=0).keyframe_points.insert(1.0, 0.5)
        self.assertNotEqual(courbes(action, os_), source)
        restaurer(action, os_, source)
        self.assertEqual(courbes(action, os_), source)
        bpy.data.actions.remove(action)


EPAULE = Vector((0.3, -0.12, 1.225))
"""L'épaule gauche du rig minimal (`rig_minimal`), au repos ; la droite en miroir. Le bras pend au repos vers l'avant,
chaque os aux axes `REPOS`, l'avant-bras à 0,25 m de l'épaule, la main à 0,24 m du coude."""
GAUCHE = {'r': -1.0, 'l': 1.0}
"""Le signe de X de chaque côté (+X la gauche du personnage)."""


def miroir(point, cote):
    return Vector((GAUCHE[cote] * point.x, point.y, point.z))


def tube(debut, fin, cote_, anneaux):
    """Les sommets et les faces d'un tube de section carrée de `cote_` mètres le long de Y, de `debut` à `fin`, en
    `anneaux` anneaux, ses bouts fermés."""
    sommets, faces = [], []
    for k in range(anneaux):
        centre = debut.lerp(fin, k / (anneaux - 1))
        sommets += [tuple(centre + Vector((dx, 0.0, dz))) for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1))
                    for dx, dz in [(dx * cote_ / 2, dz * cote_ / 2)]]
    for k in range(anneaux - 1):
        faces += [(4 * k + i, 4 * k + (i + 1) % 4, 4 * k + 4 + (i + 1) % 4, 4 * k + 4 + i) for i in range(4)]
    return sommets, faces + [(3, 2, 1, 0), tuple(4 * (anneaux - 1) + i for i in range(4))]


def maillage(rig, nom, sommets, faces, groupes, aretes=()):
    """Le maillage `nom` posé sur `rig`, chaque sommet tout entier sur l'os de `groupes`, avec une clé de forme neutre
    par silhouette du tronc (`tronc.TRONC`) ; `aretes`, des arêtes sans face."""
    donnee = bpy.data.meshes.new(nom)
    donnee.from_pydata(sommets, aretes, faces)
    objet = bpy.data.objects.new(nom, donnee)
    bpy.context.scene.collection.objects.link(objet)
    for i, os_ in enumerate(groupes):
        (objet.vertex_groups.get(os_) or objet.vertex_groups.new(name=os_)).add([i], 1.0, 'REPLACE')
    objet.modifiers.new('Rig', 'ARMATURE').object = rig
    objet.shape_key_add(name='Basis')
    for silhouette in sorted({s for jeu in JEUX['jeux'] for s in jeu.poids}):
        objet.shape_key_add(name=silhouette)


def rig_minimal():
    """Le rig du tronc en boîte (`test_tronc.boite`) sur `spine_01` et des deux bras (`tronc.BRAS`), un tube
    d'avant-bras et un de main par côté."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps, bpy.context.scene.render.fps_base = IMAGES_PAR_SECONDE, 1.0
    rig = bpy.data.objects.new('Rig', bpy.data.armatures.new('Rig'))
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    dos = rig.data.edit_bones.new('spine_01')
    dos.head, dos.tail = (0.0, 0.0, 0.8), (0.0, 0.0, 1.4)
    for cote in BRAS:
        parent = dos
        for nom, (debut, longueur) in zip(BRAS[cote], ((0.0, 0.25), (0.25, 0.24), (0.49, 0.08))):
            os_ = rig.data.edit_bones.new(nom)
            os_.head, os_.tail = (0.0, 0.0, 0.0), (0.0, longueur, 0.0)
            os_.matrix = Matrix(matrice(REPOS, miroir(EPAULE, cote) + Vector((0.0, -debut, 0.0))).tolist())
            os_.parent = parent
            parent = os_
    bpy.ops.object.mode_set(mode='OBJECT')
    points, indices = numpy.unique(boite().reshape(-1, 3).round(9), axis=0, return_inverse=True)
    maillage(rig, 'Rig-torse', [tuple(p) for p in points], [tuple(t) for t in indices.reshape(-1, 3)], ['spine_01'] * len(points))
    for cote in BRAS:
        epaule = miroir(EPAULE, cote)
        sommets, faces = tube(epaule + Vector((0, -0.26, 0)), epaule + Vector((0, -0.48, 0)), 0.03, 8)
        main, faces_main = tube(epaule + Vector((0, -0.5, 0)), epaule + Vector((0, -0.56, 0)), 0.03, 3)
        maillage(rig, f'Rig-bras-{cote}', sommets + main, faces + [tuple(i + len(sommets) for i in f) for f in faces_main],
                 [BRAS[cote][1]] * len(sommets) + [BRAS[cote][2]] * len(main))
    return rig


def piece(rig, bas, haut):
    """Un bloc du tronc de `rig`, chaque sommet à 0,55 sur `spine_01` et 0,45 sur `upperarm_r`, posé à l'image 0 du clip
    courant dans la boîte [`bas`, `haut`]."""
    bpy.context.scene.frame_set(0)
    bras = rig.pose.bones['upperarm_r'].matrix @ rig.data.bones['upperarm_r'].matrix_local.inverted()
    vers_repos = numpy.linalg.inv(0.55 * numpy.eye(4) + 0.45 * numpy.array(bras))
    points, indices = numpy.unique(boite(numpy.array(bas), numpy.array(haut), 4).reshape(-1, 3).round(9), axis=0,
                                   return_inverse=True)
    repos = (numpy.c_[points, numpy.ones(len(points))] @ vers_repos.T)[:, :3]
    maillage(rig, 'Rig-piece', [tuple(p) for p in repos], [tuple(t) for t in indices.reshape(-1, 3)], ['spine_01'] * len(points))
    objet = bpy.data.objects['Rig-piece']
    objet.vertex_groups['spine_01'].add(range(len(points)), 0.55, 'REPLACE')
    objet.vertex_groups.new(name='upperarm_r').add(range(len(points)), 0.45, 'REPLACE')


def poser(rig, cote, articulation, poignet, torsion=0.0):
    """Le bras `cote` de `rig` posé de son épaule au coude `articulation` puis au `poignet`, chaque os tourné au plus court
    depuis son repos, la main dans l'axe de l'avant-bras tournée de `torsion` degrés autour de son +Y."""
    epaule = miroir(EPAULE, cote)
    haut, bas = (Vector((0, -1, 0)).rotation_difference((b - a).normalized()).to_matrix() @ REPOS
                 for a, b in ((epaule, articulation), (articulation, poignet)))
    for nom, axes, tete in zip(BRAS[cote], (haut, bas, bas @ Matrix.Rotation(math.radians(torsion), 3, 'Y')),
                               (epaule, articulation, poignet)):
        rig.pose.bones[nom].matrix = Matrix(matrice(axes, tete).tolist())
        bpy.context.view_layer.update()


def clip(rig, nom, poses, images=(0, 1), signe=1.0):
    """Le clip `nom` aux `images`, chacune aux `poses` (par côté, les arguments de `poser`, ou le repos), les mêmes à
    chaque image ou une par image (liste), les quaternions des clés multipliés par `signe`."""
    action = bpy.data.actions.new(nom)
    assign_action(rig, action)
    for image, poses_ in zip(images, poses if isinstance(poses, list) else [poses] * len(images)):
        for cote in BRAS:
            for os_ in BRAS[cote]:
                rig.pose.bones[os_].rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            bpy.context.view_layer.update()
            if cote in poses_:
                poser(rig, cote, *poses_[cote])
            for os_ in BRAS[cote]:
                rig.pose.bones[os_].rotation_quaternion = signe * rig.pose.bones[os_].rotation_quaternion
                rig.pose.bones[os_].keyframe_insert('rotation_quaternion', frame=image)
    return action


def flanc(cote):
    """Le coude dans le flanc du tronc du côté `cote`, la main dehors devant (`coude_dedans`)."""
    articulation = segment(miroir(EPAULE, cote), (-GAUCHE[cote] * 0.11, 0, -0.225), 0.25)
    return articulation, segment(articulation, (0, -1, 0), 0.24)


class ClipEntier(unittest.TestCase):
    OS = [n for os_ in BRAS.values() for n in os_]

    def passe(self, action):
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            ecarter_les_membres(bpy, self.rig, [action])
        return sortie.getvalue()

    def setUp(self):
        self.rig = rig_minimal()

    def test_un_clip_dont_un_bras_ferme_et_l_autre_manque_un_controle_revient_tout_entier_a_sa_source_au_bit_pres(self):
        action = clip(self.rig, 'Croise', {'r': flanc('r'), 'l': (*flanc('l'), 100.0)})
        source, statiques = courbes(action, self.OS), self.statiques()
        ligne = self.passe(action)
        self.assertIn('rendu à la source', ligne)
        self.assertIn('l bornes de hand_l', ligne)
        self.assertEqual(courbes(action, self.OS), source)
        self.assertEqual(self.statiques(), statiques)

    def statiques(self):
        """La position et l'échelle de pose de chaque os des bras."""
        return {n: (tuple(self.rig.pose.bones[n].location), tuple(self.rig.pose.bones[n].scale)) for n in self.OS}

    def test_un_clip_dont_un_bras_n_a_rien_a_corriger_et_l_autre_ferme_se_garde(self):
        action = clip(self.rig, 'Flanc', {'l': flanc('l')})
        source = courbes(action, self.OS)
        ligne = self.passe(action)
        self.assertIn('gardé tous les jeux : l corrigées 2', ligne)
        apres = courbes(action, self.OS)
        self.assertEqual({k: v for k, v in apres.items() if '_r"' in k[0]}, {k: v for k, v in source.items() if '_r"' in k[0]})
        self.assertNotEqual(apres, source)


    def test_un_clip_dont_la_correction_d_un_bras_enfonce_l_autre_bras_non_corrige_revient_a_sa_source(self):
        action = clip(self.rig, 'Pousse', {'r': flanc('r')})
        piece(self.rig, (0.23, -0.55, 1.25), (0.39, -0.43, 1.33))
        source = courbes(action, self.OS)
        ligne = self.passe(action)
        self.assertIn('rendu à la source', ligne)
        self.assertIn('tous les jeux : l tronc image', ligne)
        self.assertEqual(courbes(action, self.OS), source)

    def peau_de(self, os_):
        bpy.context.scene.frame_set(0)
        return self.rig.pose.bones[os_].matrix @ self.rig.data.bones[os_].matrix_local.inverted()

    def test_un_clip_dont_la_correction_etire_une_arete_hors_des_bornes_sous_un_seul_jeu_revient_a_sa_source_au_bit_pres(self):
        action = clip(self.rig, 'Fil', {'l': flanc('l')})
        jeu = next(j for j, s in enumerate(JEUX['jeux']) if len(s.poids) == 1 and s.nom != CARRURE_PLUS)
        coude, main = miroir(EPAULE, 'l') + Vector((0, -0.27, 0)), miroir(EPAULE, 'l') + Vector((0, -0.52, 0))
        maillage(self.rig, 'Rig-fil-l', [tuple(coude), tuple(main)], [], ['lowerarm_l', 'hand_l'], [(0, 1)])
        tendue = self.peau_de('lowerarm_l') @ coude - Vector((1, 0, 0)) * (ETIREMENT_EN_CLIP[1] - 0.01) * (main - coude).length
        bpy.data.objects['Rig-fil-l'].data.shape_keys.key_blocks[JEUX['jeux'][jeu].nom].data[1].co = \
            self.peau_de('hand_l').inverted() @ tendue
        source = courbes(action, self.OS)
        ligne = self.passe(action)
        self.assertIn('rendu à la source', ligne)
        nom = JEUX['jeux'][jeu].nom
        refus = re.search(f'refus : tous les jeux : l étirement sous {nom} image 0\\.00 (\\d\\.\\d{{5}}) ; '
                          f'sans carrure_plus : l étirement sous {nom} image 0\\.00 (\\d\\.\\d{{5}}) \\|', ligne)
        self.assertIsNotNone(refus, ligne)
        self.assertGreater(min(float(v) for v in refus.groups()), ETIREMENT_EN_CLIP[1])
        self.assertEqual(courbes(action, self.OS), source)

    def carrure_plus(self, deplacement):
        """La peau de l'avant-bras et de la main gauches déplacée sous la clé `carrure_plus` de `deplacement`, en mètres
        dans le repère du rig à l'image 0 du clip courant."""
        objet = bpy.data.objects['Rig-bras-l']
        cle = objet.data.shape_keys.key_blocks[CARRURE_PLUS]
        tour = self.peau_de('lowerarm_l').to_3x3().inverted()
        for sommet in objet.data.vertices:
            cle.data[sommet.index].co = sommet.co + tour @ Vector(deplacement)

    def test_un_clip_que_rien_ne_sort_sous_la_carrure_maximale_se_garde_sans_elle(self):
        action = clip(self.rig, 'Carrure', {'l': flanc('l')})
        self.carrure_plus((-0.1, 0.1, 0.0))
        source = courbes(action, self.OS)
        ligne = self.passe(action)
        self.assertRegex(ligne, r'gardé sans carrure_plus : l corrigées 2, .* sauf carrure_plus : reste \d+\.\d\d cm image 0\.00 '
                                r'\| refus : tous les jeux : rien à écrire, l rien ne sort la peau à 2 images \|')
        self.assertNotEqual(courbes(action, self.OS), source)

    def test_sans_la_carrure_maximale_une_correction_qui_y_enfonce_la_peau_plus_qu_a_la_source_revient_a_sa_source(self):
        action = clip(self.rig, 'Enfonce', {'l': flanc('l')})
        self.carrure_plus((-0.1, 0.05, 0.0))
        source = courbes(action, self.OS)
        ligne = self.passe(action)
        self.assertIn('rendu à la source', ligne)
        self.assertRegex(ligne, r'sans carrure_plus : l carrure_plus plus enfoncée image 0\.00 \d+\.\d{4} cm pour \d+\.\d{4} cm')
        self.assertEqual(courbes(action, self.OS), source)


class JeuxDuPack(unittest.TestCase):
    def test_la_passe_du_pack_corrige_sous_les_cinq_jeux_de_la_visee_initiale_puis_sans_la_carrure_maximale(self):
        self.assertEqual([(j.nom, j.poids, j.facteurs) for j in JEUX['jeux']],
                         [('', {}, {}), ('corpulence', {'corpulence': 1.0}, {}),
                          ('feminin+corpulence', {'feminin': 1.0, 'corpulence': 1.0}, {}),
                          ('carrure_plus', {'carrure_plus': 1.0}, {}), ('carrure_moins', {'carrure_moins': 1.0}, {})])
        self.assertEqual(JEUX_REQUIS, ((0, 1, 2, 3, 4), (0, 1, 2, 4)))


class JeuDUnEtat(unittest.TestCase):
    def test_le_tronc_d_un_etat_du_gabarit_est_pose_de_ses_cles_a_leurs_poids_et_ses_os_deplaces_de_ses_facteurs(self):
        rig = rig_minimal()
        torse = bpy.data.objects['Rig-torse']
        cle = torse.shape_key_add(name='gabarit_arms_plus')
        for sommet in torse.data.vertices:
            cle.data[sommet.index].co = sommet.co + Vector((0.0, 0.0, 0.02))
        table = {'legs': [], 'arms': [BRAS[c][i] for c in BRAS for i in (0, 1)], 'head': []}
        etat = {'nom': 'arms_plus', 'facteurs': {'sl': 1, 'legs': 1, 'arms': 1.3, 'head': 1, 'st': 1},
                'poidsSilhouettes': {CARRURE_PLUS: 0}, 'poidsGabarit': {'gabarit_arms_plus': 0.5}}
        tronc = peau_du_tronc(rig, meshes_for(bpy, rig), (JEUX['jeux'][0], jeu_de_l_etat(table, etat)))
        numpy.testing.assert_allclose(tronc.x[1, :, :3] - tronc.x[0, :, :3], numpy.tile((0.0, 0.0, 0.01), (len(tronc.x[0]), 1)),
                                      atol=1e-6)
        noms = [b.name for b in rig.data.bones]
        for cote in BRAS:
            bras, avant_bras, main = (noms.index(n) for n in BRAS[cote])
            numpy.testing.assert_allclose(tronc.deplacements[1, [bras, avant_bras, main]],
                                          [(0, 0, 0), (0, -0.3 * 0.25, 0), (0, -0.3 * 0.49, 0)], atol=1e-6)
        numpy.testing.assert_allclose(tronc.deplacements[0], 0.0)


class ClipLong(unittest.TestCase):
    """Le coude gauche dans le flanc à l'image 0, puis, des images 10 à 40, à 4 mm dans le tronc, sous la tolérance :
    l'enveloppe s'arrête avant l'image 40, et l'image qui la suit, sans clé, n'est pas écrite. Les quaternions des clés
    sources sont de l'hémisphère opposé à celui que Blender rend d'une matrice."""

    def setUp(self):
        self.rig = rig_minimal()
        articulation = segment(miroir(EPAULE, 'l'), (-0.11 * 0.78, 0, -0.225), 0.25)
        tolere = {'l': (articulation, segment(articulation, (0, -1, 0), 0.24))}
        self.action = clip(self.rig, 'Long', [{'l': flanc('l')}, tolere, tolere], images=(0, 10, 40), signe=-1.0)

    def passe(self):
        with mock.patch('membres.verdict', wraps=verdict) as espion, contextlib.redirect_stdout(io.StringIO()) as sortie:
            ecarter_les_membres(bpy, self.rig, [self.action])
        return sortie.getvalue(), espion

    def test_l_image_voisine_non_ecrite_d_une_image_corrigee_se_re_mesure(self):
        ligne, espion = self.passe()
        self.assertIn('gardé tous les jeux : l corrigées 20,', ligne)
        sources, apres = espion.call_args_list[-1].args[:2]
        self.assertGreater(sources[20].max(), 0.0)
        self.assertNotEqual(apres[20].max(), sources[20].max())
        self.assertEqual(apres[21].max(), sources[21].max())

    def test_chaque_cle_ecrite_garde_l_hemisphere_du_quaternion_source(self):
        scene, images = bpy.context.scene, range(41)
        sources = []
        for i in images:
            scene.frame_set(i)
            sources.append([self.rig.pose.bones[n].rotation_quaternion.copy() for n in BRAS['l']])
        ligne, _ = self.passe()
        self.assertIn('gardé tous les jeux : l corrigées 20,', ligne)
        for i in images:
            scene.frame_set(i)
            for n, source in zip(BRAS['l'], sources[i]):
                self.assertGreater(self.rig.pose.bones[n].rotation_quaternion.dot(source), 0.9, f'{n} image {i}')


if __name__ == '__main__':
    unittest.main()
