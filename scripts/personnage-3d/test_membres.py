"""membres (#3810) : un bras hors du tronc ne se corrige pas et sa pose ressort à l'identique ; un avant-bras à 3 mm dans
le tronc, sous la tolérance de la garde mais à moins de la marge, ne se corrige pas ; une main dans le tronc en sort à
la marge par l'avancée ; un avant-bras dans le tronc, main dehors, en sort par l'écart du coude, vers le dehors, la main
en place et le bras sans torsion ajoutée ; l'enveloppe raccorde l'écart d'une image corrigée à ses voisines, à pas
borné ; un bras que ni l'avancée ni le coude ne sortent ne requiert rien ; une avancée déjà essayée ne se repose pas ;
une correction qui laisse la peau dans le tronc se refuse, une qui ferme sauf sous la carrure maximale se garde et le
dit, sauf si elle y enfonce la peau plus qu'à la source ; les courbes d'un bras refusé reviennent à leur source au bit
près ; sur un rig, un clip dont un bras ferme et l'autre manque un contrôle revient tout entier à sa source au bit
près, un clip dont un bras n'a rien à corriger et l'autre ferme se garde, un clip dont la correction d'un bras enfonce
dans le tronc l'autre bras, non corrigé, revient à sa source."""
import contextlib
import io
import math
import sys
import unittest
from pathlib import Path
from unittest import mock

import bpy  # noqa: F401
import numpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from animation import assign_action  # noqa: E402
from ecart import ECART_DU_TRONC, RACCORD, poussee_requise  # noqa: E402
from membres import (JEUX_REQUIS, PLUS_ENFONCEE, bras_de_l_image, corriger, courbes,  # noqa: E402
                     ecarter_les_membres, exactes, peau_posee, poses_du_bras, requis, restaurer, verdict)
from seuils import IMAGES_PAR_SECONDE, SOL_TOLERANCE_M  # noqa: E402
from test_tronc import boite  # noqa: E402
from tronc import BRAS, TRONC as JEUX, PeauDuMembre, PeauDuTronc, champs_du_tronc, profondeurs, tronc_pose  # noqa: E402

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
    return corriger(TRONC, poses, bras, numpy.arange(float(len(images))), sources, SEUL, [{} for _ in images])


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
        avancee, ecart = requis(pose, bras, SEUL, {})
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
        avancee, ecart = requis(pose, bras, SEUL, {})
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
        requis_ = requis(avec_champs(contact[0]), contact[1], SEUL, {})[1]
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
        self.assertIsNone(requis(avec_champs(pose), bras, SEUL, {}))
        avancees, ecarts, rien = corriger_([(pose, bras)])
        self.assertEqual(float(numpy.abs(numpy.concatenate((avancees, ecarts))).max()), 0.0)
        self.assertEqual(rien, 1)


class Essais(unittest.TestCase):
    def test_une_avancee_deja_essayee_ne_se_repose_pas_et_rend_le_meme_requis(self):
        pose, bras = coude_dedans()
        pose = avec_champs(pose)
        essais = {}
        premier = requis(pose, bras, SEUL, essais)
        self.assertEqual(list(essais), [0.0])
        with mock.patch('membres.poses_du_bras', wraps=poses_du_bras) as compte:
            self.assertEqual(requis(pose, bras, SEUL, essais), premier)
        self.assertEqual(compte.call_count, 0)
        self.assertEqual(requis(pose, bras, SEUL, {}), premier)


class Verdict(unittest.TestCase):
    IMAGES = [0.0, 1.0, 2.0]
    CARRURE_PLUS = next(j for j in JEUX_REQUIS[0] if j not in JEUX_REQUIS[1])

    def peaux(self, carrure_plus_source, carrure_plus_apres):
        sources = numpy.full((3, len(JEUX['silhouettes'])), 0.012)
        apres = numpy.full((3, len(JEUX['silhouettes'])), 0.002)
        sources[:, self.CARRURE_PLUS], apres[:, self.CARRURE_PLUS] = carrure_plus_source, carrure_plus_apres
        return sources, apres

    def test_une_correction_qui_laisse_la_peau_dans_le_tronc_se_refuse(self):
        sources, apres = self.peaux(0.02, 0.008)
        defaut, _ = verdict(sources, apres, JEUX_REQUIS[0], self.IMAGES)
        self.assertTrue(defaut.startswith('tronc image 0.00 carrure_plus 0.80 cm'))

    def test_une_correction_qui_ferme_sauf_sous_la_carrure_maximale_se_garde_et_le_dit(self):
        sources, apres = self.peaux(0.02, 0.02 + PLUS_ENFONCEE / 2)
        defaut, reste = verdict(sources, apres, JEUX_REQUIS[1], self.IMAGES)
        self.assertIsNone(defaut)
        self.assertEqual(reste, ' sauf carrure_plus : reste 2.05 cm image 0.00')

    def test_une_correction_qui_enfonce_la_peau_sous_la_carrure_maximale_plus_qu_a_la_source_se_refuse(self):
        sources, apres = self.peaux(0.02, 0.02 + 2 * PLUS_ENFONCEE)
        defaut, _ = verdict(sources, apres, JEUX_REQUIS[1], self.IMAGES)
        self.assertTrue(defaut.startswith('carrure_plus plus enfoncée image 0.00'))


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


def maillage(rig, nom, sommets, faces, groupes):
    """Le maillage `nom` posé sur `rig`, chaque sommet tout entier sur l'os de `groupes`, avec une clé de forme neutre
    par silhouette du tronc (`tronc.TRONC`)."""
    donnee = bpy.data.meshes.new(nom)
    donnee.from_pydata(sommets, [], faces)
    objet = bpy.data.objects.new(nom, donnee)
    bpy.context.scene.collection.objects.link(objet)
    for i, os_ in enumerate(groupes):
        (objet.vertex_groups.get(os_) or objet.vertex_groups.new(name=os_)).add([i], 1.0, 'REPLACE')
    objet.modifiers.new('Rig', 'ARMATURE').object = rig
    objet.shape_key_add(name='Basis')
    for silhouette in sorted({s for jeu in JEUX['silhouettes'] for s in jeu}):
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


def clip(rig, nom, poses):
    """Le clip `nom` de deux images, 0 et 1, chacune aux `poses` (par côté, les arguments de `poser`, ou le repos)."""
    action = bpy.data.actions.new(nom)
    assign_action(rig, action)
    for image in (0, 1):
        for cote in BRAS:
            for os_ in BRAS[cote]:
                rig.pose.bones[os_].rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
            bpy.context.view_layer.update()
            if cote in poses:
                poser(rig, cote, *poses[cote])
            for os_ in BRAS[cote]:
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
        source = courbes(action, self.OS)
        ligne = self.passe(action)
        self.assertIn('rendu à la source', ligne)
        self.assertIn('l bornes de hand_l', ligne)
        self.assertEqual(courbes(action, self.OS), source)

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


if __name__ == '__main__':
    unittest.main()
