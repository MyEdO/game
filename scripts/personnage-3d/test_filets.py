"""filets.draper sur une base synthétique exportée en GLB : un squelette aux os de la base, un corps en tubes par zone,
un clip qui lève la cuisse gauche. Les os des filets et des manches joints à la peau, leurs pistes LINEAR image par
image, les racines autour du corps, la cape par-dessus la jupe, le brin de devant levé par la cuisse et celui de
derrière au repos, le même GLB quand on le drape deux fois, ce qu'une nappe lit du filet au repos (`tissu.Filet`), et
l'image d'un filet monté (`Monte.etat`) : debout ou couché, de l'un à l'autre sur ses images voisines, et sous ce que
le bras balaie d'un instant voisin. Les manches : leurs brins d'aplomb sous l'avant-bras tendu, enfants de leur tour ; sous un avant-bras qui roule,
le tour qui ramène la manche à son côté bas, le tube qui n'en prend qu'une portion, et les brins qui restent d'aplomb ; les liens de ses brins voisins ; le tour lissé d'un demi-tour ; le fût
d'une hampe qui écarte un brin ; le brin qu'un obstacle lâche, rendu à l'aplomb sur ses images voisines ; ce qu'une poche lit de la manche au repos (`tissu.Manche`)."""
import math
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
import numpy as np
from mathutils import Quaternion

sys.path[:0] = [str(Path(__file__).resolve().parent / dossier) for dossier in ('base', 'element')]

from animation import assign_action, clear_animation  # noqa: E402
import tente  # noqa: E402
import pendant  # noqa: E402
from filets import (COUCHE_SOUS_LE_SOL_M, FILETS, FUT_DE_HAMPE, MANCHES, Manche, Monte, Peau, Squelette, autour, draper,  # noqa: E402
                    filets_au_repos, manches_au_repos, os_du_tour, os_du_tube, repere_de_prise)
from pistes import sacs  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from tissu import CHARNIERE_M, Filet  # noqa: E402
from tissu import Manche as PocheDeManche  # noqa: E402

OS = {
    'pelvis': ((0, 0, 0.95), (0, 0, 1.05), None),
    'spine_01': ((0, 0, 1.05), (0, 0, 1.2), 'pelvis'),
    'spine_02': ((0, 0, 1.2), (0, 0, 1.35), 'spine_01'),
    'spine_03': ((0, 0, 1.35), (0, 0, 1.45), 'spine_02'),
    'neck_01': ((0, 0, 1.45), (0, 0, 1.55), 'spine_03'),
    'Head': ((0, 0, 1.55), (0, 0, 1.75), 'neck_01'),
    **{f'{nom}_{c}': (tuple(s * v if i == 0 else v for i, v in enumerate(tete)), tuple(s * v if i == 0 else v for i, v in enumerate(queue)),
                      parent if parent.startswith(('pelvis', 'spine')) else f'{parent}_{c}')
       for c, s in (('l', 1), ('r', -1)) for nom, tete, queue, parent in (
           ('clavicle', (0.02, 0, 1.45), (0.2, 0, 1.45), 'spine_03'), ('upperarm', (0.2, 0, 1.45), (0.45, 0, 1.45), 'clavicle'),
           ('lowerarm', (0.45, 0, 1.45), (0.7, 0, 1.45), 'upperarm'), ('hand', (0.7, 0, 1.45), (0.8, 0, 1.45), 'lowerarm'),
           ('thigh', (0.1, 0, 0.95), (0.1, 0, 0.52), 'pelvis'), ('calf', (0.1, 0, 0.52), (0.1, 0, 0.1), 'thigh'),
           ('foot', (0.1, 0, 0.1), (0.1, -0.15, 0.02), 'calf'))},
}
TUBES = {
    'hanches': ([(0, 0, 0.9), (0, 0, 1.05)], 0.17, ['pelvis', 'pelvis']),
    'torse': ([(0, 0, 1.05), (0, 0, 1.2), (0, 0, 1.35), (0, 0, 1.45)], 0.16, ['spine_01', 'spine_02', 'spine_03', 'spine_03']),
    'cou': ([(0, 0, 1.45), (0, 0, 1.55)], 0.06, ['neck_01', 'neck_01']),
    'tete': ([(0, 0, 1.55), (0, 0, 1.75)], 0.09, ['Head', 'Head']),
    'visage': ([(0, -0.09, 1.6), (0, -0.09, 1.7)], 0.02, ['Head', 'Head']),
    'nez': ([(0, -0.11, 1.63), (0, -0.11, 1.67)], 0.01, ['Head', 'Head']),
    **{f'{zone}_{c}': ([tuple(s * v if i == 0 else v for i, v in enumerate(p)) for p in points], rayon, [f'{o}_{cote}' for o in os_])
       for c, cote, s in (('g', 'l', 1), ('d', 'r', -1)) for zone, points, rayon, os_ in (
           ('cuisse', [(0.1, 0, 0.95), (0.1, 0, 0.75), (0.1, 0, 0.56)], 0.08, ['thigh'] * 3),
           ('genou', [(0.1, 0, 0.56), (0.1, 0, 0.48)], 0.07, ['thigh', 'calf']),
           ('mollet', [(0.1, 0, 0.48), (0.1, 0, 0.3), (0.1, 0, 0.12)], 0.06, ['calf'] * 3),
           ('pied', [(0.1, 0, 0.12), (0.1, 0, 0.03)], 0.06, ['foot'] * 2),
           ('bras_haut', [(0.2, 0, 1.45), (0.45, 0, 1.45)], 0.05, ['upperarm'] * 2),
           ('avant_bras', [(0.45, 0, 1.45), (0.7, 0, 1.45)], 0.04, ['lowerarm'] * 2),
           ('main', [(0.7, 0, 1.45), (0.8, 0, 1.45)], 0.04, ['hand'] * 2))},
}
"""Par zone du corps, un tube : les centres de ses anneaux, son rayon, l'os de chaque anneau."""
COTES = 12
LEVEE = math.radians(70)
IMAGES = 12
PRISE = {'os': 'hand_r', 'position': [0.0, 0.05, 0.0], 'rotation': [0.0, 0.0, 0.0]}
"""La prise `main`, à 5 cm sur l'os de la main droite, son +Y le long de l'os."""


def tube(nom, centres, rayon, os_, rig):
    centres = np.array(centres, float)
    axe = centres[-1] - centres[0]
    axe /= np.linalg.norm(axe)
    u = np.cross(axe, np.eye(3)[np.abs(axe).argmin()])
    u /= np.linalg.norm(u)
    v = np.cross(axe, u)
    sommets = [tuple(c + rayon * (math.cos(t) * u + math.sin(t) * v)) for c in centres for t in (2 * math.pi * j / COTES for j in range(COTES))]
    n = lambda i, j: i * COTES + j % COTES
    faces = [(n(i, j), n(i, j + 1), n(i + 1, j + 1), n(i + 1, j)) for i in range(len(centres) - 1) for j in range(COTES)]
    maillage = bpy.data.meshes.new(nom)
    maillage.from_pydata(sommets, [], faces)
    objet = bpy.data.objects.new(nom, maillage)
    bpy.context.scene.collection.objects.link(objet)
    for i, o in enumerate(os_):
        groupe = objet.vertex_groups.get(o) or objet.vertex_groups.new(name=o)
        groupe.add(range(i * COTES, (i + 1) * COTES), 1.0, 'REPLACE')
    objet.parent = rig
    objet.modifiers.new('Armature', 'ARMATURE').object = rig


def construire(chemin):
    """Exporte en `chemin` le squelette `OS`, le corps `Corps-<zone>` de `TUBES` et le clip `Pas`, qui lève la cuisse
    gauche de `LEVEE` vers l'avant à mi-chemin de ses `IMAGES` images."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = bpy.data.objects.new('Rig', bpy.data.armatures.new('Rig'))
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for nom, (tete, queue, parent) in OS.items():
        os_ = rig.data.edit_bones.new(nom)
        os_.head, os_.tail = tete, queue
        os_.parent = rig.data.edit_bones[parent] if parent else None
    bpy.ops.object.mode_set(mode='OBJECT')
    for zone, (centres, rayon, os_) in TUBES.items():
        tube(f'Corps-{zone}', centres, rayon, os_, rig)
    action = bpy.data.actions.new('Pas')
    assign_action(rig, action)
    cuisse = rig.pose.bones['thigh_l']
    cuisse.rotation_mode = 'QUATERNION'
    vers_l_avant = cuisse.bone.matrix_local.to_3x3().inverted() @ Quaternion((1.0, 0.0, 0.0), -LEVEE).to_matrix() @ cuisse.bone.matrix_local.to_3x3()
    for image, rotation in ((0, Quaternion()), (IMAGES // 2, vers_l_avant.to_quaternion()), (IMAGES, Quaternion())):
        cuisse.rotation_quaternion = rotation
        cuisse.keyframe_insert('rotation_quaternion', frame=image)
    for sac in sacs(action):
        for courbe in sac.fcurves:
            for cle in courbe.keyframe_points:
                cle.interpolation = 'LINEAR'
    clear_animation(rig)
    assign_action(rig, action)
    bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
    bpy.ops.export_scene.gltf(filepath=str(chemin), export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=False)


class Filets(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.dossier.cleanup)
        cls.chemin = Path(cls.dossier.name) / 'base.glb'
        construire(cls.chemin)
        cls.chaines = draper(cls.chemin, 'Corps', PRISE, set())
        cls.squelette = Squelette(cls.chemin)
        cls.repos = filets_au_repos(cls.chemin)
        cls.manches = manches_au_repos(cls.chemin)

    def test_les_os_des_filets_sont_des_joints_de_la_peau_sous_leur_porteur(self):
        self.assertEqual({nom: len(os_) for nom, os_ in self.chaines.items()}, {'jupe': 48, 'cape': 28, 'manche': 40})
        joints = {self.squelette.noeuds[j]['name'] for j in self.squelette.peau['joints']}
        self.assertLessEqual({os_ for noms in self.chaines.values() for os_ in noms}, joints)
        self.assertEqual(len(self.squelette.liaisons), len(self.squelette.peau['joints']))
        for filet in FILETS:
            for brin in self.repos[filet['nom']]['os']:
                parents = [self.squelette.noeuds[self.squelette.parent[self.squelette.indice[os_]]]['name'] for os_ in brin]
                self.assertEqual(parents, [filet['porteur'], *brin[:-1]])
        parent = lambda os_: self.squelette.noeuds[self.squelette.parent[self.squelette.indice[os_]]]['name']
        for manche in MANCHES:
            repos = self.manches[manche['nom']]
            self.assertEqual((repos['porteur'], repos['tube'], repos['part_du_tube']), (manche['porteur'], os_du_tube(manche), 0.1))
            self.assertEqual([parent(os_du_tube(manche)), parent(os_du_tour(manche))], [manche['porteur']] * 2)
            for brin in repos['os']:
                self.assertEqual([parent(os_) for os_ in brin], [os_du_tour(manche), *brin[:-1]])

    def test_chaque_clip_porte_une_piste_lineaire_par_os_une_cle_par_image(self):
        action = self.squelette.clips['Pas']
        pistes = self.squelette.pistes('Pas')
        for os_ in (o for noms in self.chaines.values() for o in noms):
            canal, = [c for c in action['channels'] if c['target'] == {'node': self.squelette.indice[os_], 'path': 'rotation'}]
            self.assertEqual(action['samplers'][canal['sampler']]['interpolation'], 'LINEAR')
            instants, quaternions = pistes[(self.squelette.indice[os_], 'rotation')]
            np.testing.assert_allclose(instants, np.arange(IMAGES + 1) / IMAGES_PAR_SECONDE, atol=1e-6)
            np.testing.assert_allclose(np.linalg.norm(quaternions, axis=1), 1.0, atol=1e-6)

    def test_les_racines_entourent_le_corps_et_les_brins_gardent_leur_longueur(self):
        jupe = self.repos['jupe']['brins']
        self.assertEqual(jupe.shape, (16, 4, 3))
        self.assertEqual(self.repos['cape']['brins'].shape, (7, 5, 3))
        self.assertGreater(np.linalg.norm(jupe[:, 0, :2], axis=1).min(), 0.17)
        longueurs = np.linalg.norm(jupe[:, 1:] - jupe[:, :-1], axis=2)
        np.testing.assert_allclose(longueurs, longueurs[:, :1].repeat(3, axis=1), atol=1e-6)
        self.assertLess(jupe[:, -1, 2].max(), 0.3)

    def test_la_cape_au_repos_passe_par_dessus_la_jupe(self):
        jupe, cape = self.repos['jupe']['brins'], self.repos['cape']['brins']
        axe = jupe[:, 0, :2].mean(axis=0)
        azimut = lambda p: np.arctan2(p[0] - axe[0], axe[1] - p[1]) % (2 * np.pi)
        tours = np.array([azimut(brin[-1]) for brin in jupe])
        sous_les_racines = [p for brin in cape for p in brin if p[2] < jupe[0, 0, 2]]
        self.assertGreaterEqual(len(sous_les_racines), 10)
        for p in sous_les_racines:
            i = int(np.searchsorted(tours, azimut(p), side='right') - 1)
            coins = [np.interp(-p[2], -jupe[s, :, 2], np.linalg.norm(jupe[s, :, :2] - axe, axis=1)) * np.array([np.sin(tours[s]), -np.cos(tours[s])])
                     for s in (i, (i + 1) % len(jupe))]
            rayon, _ = np.linalg.solve(np.column_stack([(p[:2] - axe) / np.linalg.norm(p[:2] - axe), coins[0] - coins[1]]), coins[0])
            self.assertGreater(np.linalg.norm(p[:2] - axe), rayon)

    def test_une_nappe_lit_sur_le_filet_son_rayon_et_ses_poids(self):
        repos = self.repos['jupe']
        filet = Filet(repos, self.squelette.indice)
        brins, racines = repos['brins'], float(repos['brins'][0, 0, 2])
        np.testing.assert_allclose(filet.axe, [0.0, 0.0], atol=1e-6)
        self.assertEqual([filet.part(racines), filet.part(racines - CHARNIERE_M)], [0.0, 1.0])
        gauche, z = 4, float(brins[4, 1:3, 2].mean())
        rayon, i, j, part = filet.point(z, 90.0)
        self.assertEqual((i, j, part), (gauche, gauche + 1, 0.0))
        self.assertAlmostEqual(rayon, np.linalg.norm(brins[gauche, 1:3, :2].mean(axis=0)), places=6)
        poids = filet.poids(z, 90.0 + 360.0 / 32)
        portes = {nom: round(float(poids[self.squelette.indice[nom]]), 6) for nom in repos['os'][gauche] + repos['os'][gauche + 1]}
        self.assertEqual(portes, {'jupe_g_01': 0.0, 'jupe_g_02': 0.5, 'jupe_g_03': 0.0, 'jupe_g_arriere_g_01': 0.0, 'jupe_g_arriere_g_02': 0.5, 'jupe_g_arriere_g_03': 0.0})
        self.assertAlmostEqual(float(poids.sum()), 1.0, places=6)
        cape = Filet(self.repos['cape'], self.squelette.indice)
        self.assertEqual(cape.point(1.0, 90.0)[1:], (0, 0, 0.0))
        self.assertEqual(cape.point(1.0, 270.0)[1:], (6, 6, 0.0))

    def bouts(self, image):
        """Par brin de jupe, la tête de son dernier os à l'image `image` du clip."""
        mondes = self.squelette.monde(self.squelette.pistes('Pas'), image / IMAGES_PAR_SECONDE, [brin[-1] for brin in self.repos['jupe']['os']])
        return np.array([m[:3, 3] for m in mondes.values()])

    def test_la_cuisse_levee_leve_le_devant_de_la_jupe_et_laisse_l_arriere(self):
        repos, leve = self.bouts(0), self.bouts(IMAGES // 2)
        np.testing.assert_allclose(repos, self.repos['jupe']['brins'][:, -2], atol=1e-5)
        devant_gauche, arriere = 1, 8
        self.assertGreater(leve[devant_gauche, 2] - repos[devant_gauche, 2], 0.2)
        self.assertLess(leve[devant_gauche, 1], repos[devant_gauche, 1] - 0.1)
        np.testing.assert_allclose(leve[arriere], repos[arriere], atol=1e-5)

    def jupe_montee(self):
        squelette = Squelette(self.chemin)
        peau = Peau(squelette, 'Corps')
        return Monte(squelette, FILETS[0], peau, []), peau.poser(squelette, {}, 0.0, ['pelvis'])

    def test_debout_le_filet_pend_d_aplomb_au_dessus_du_sol_et_couche_il_suit_son_porteur_sans_sol(self):
        jupe, (mondes, sommets) = self.jupe_montee()
        sur_le_dos = np.eye(4)
        sur_le_dos[:3, :3] = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
        couche = sur_le_dos @ mondes['pelvis']
        np.testing.assert_allclose(jupe.aplombs([mondes['pelvis'], couche], False), [1 - 22 / 64, 22 / 64], atol=1e-9)
        (_, _, Q, _, sol), _ = jupe.etat(mondes, sommets, [], [], 1.0)
        np.testing.assert_allclose(Q, np.eye(3), atol=1e-6)
        self.assertAlmostEqual(sol, tente.SOL_M)
        (_, _, Q, _, sol), _ = jupe.etat({**mondes, 'pelvis': couche}, sommets, [], [], 0.0)
        np.testing.assert_allclose(Q, sur_le_dos[:3, :3], atol=1e-6)
        self.assertAlmostEqual(sol, tente.SOL_M - COUCHE_SOUS_LE_SOL_M)

    def test_un_filet_passe_de_debout_a_couche_sur_ses_images_voisines_et_referme_un_clip_qui_boucle(self):
        jupe, (mondes, _) = self.jupe_montee()
        sur_le_dos = np.eye(4)
        sur_le_dos[:3, :3] = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
        debout, couche = mondes['pelvis'], sur_le_dos @ mondes['pelvis']
        np.testing.assert_array_equal(jupe.aplombs([debout] * 5, False), np.ones(5))
        chute = jupe.aplombs([debout] * 6 + [couche] * 6, False)
        np.testing.assert_allclose(chute[[0, 1, 2, -3, -2, -1]], [1, 1, 1, 0, 0, 0], atol=1e-9)
        self.assertAlmostEqual(float(-np.diff(chute).max()), 0.0)
        self.assertAlmostEqual(float(-np.diff(chute).min()), 20 / 64)
        boucle = jupe.aplombs([debout] * 4 + [couche] * 4 + [debout], True)
        self.assertEqual(boucle[0], boucle[-1])
        self.assertLess(boucle[0], 1.0)

    def test_le_filet_voit_au_dehors_ce_que_le_bras_balaie_d_un_instant_voisin(self):
        jupe, (mondes, sommets) = self.jupe_montee()
        (_, _, _, immobile, _), _ = jupe.etat(mondes, sommets, [], [(mondes, sommets)], 1.0)
        voisine = {**sommets, 'bras': sommets['bras'] - [0, 0, 0.3]}
        (_, _, _, balaye, _), _ = jupe.etat(mondes, sommets, [], [(mondes, voisine)], 1.0)
        du_dehors = lambda obstacles: obstacles[0][obstacles[2] == tente.DEHORS]
        np.testing.assert_allclose(du_dehors(immobile), sommets['bras'], atol=1e-9)
        np.testing.assert_allclose(du_dehors(balaye), np.concatenate([sommets['bras'], voisine['bras']]), atol=1e-9)

    def test_draper_deux_fois_rend_le_meme_filet(self):
        pistes = self.squelette.pistes('Pas')
        self.assertEqual(draper(self.chemin, 'Corps', PRISE, set()), self.chaines)
        encore = Squelette(self.chemin)
        self.assertEqual(len(encore.noeuds), len(self.squelette.noeuds))
        self.assertEqual(encore.peau['joints'], self.squelette.peau['joints'])
        for nom, filet in filets_au_repos(self.chemin).items():
            np.testing.assert_allclose(filet['brins'], self.repos[nom]['brins'], atol=1e-5)
        for nom, manche in manches_au_repos(self.chemin).items():
            np.testing.assert_allclose(manche['brins'], self.manches[nom]['brins'], atol=1e-5)
        for cle, (_, quaternions) in encore.pistes('Pas').items():
            np.testing.assert_allclose(quaternions, pistes[cle][1], atol=1e-5)

    def test_les_brins_d_une_manche_pendent_d_aplomb_sous_l_avant_bras_tendu(self):
        for manche, signe in zip(MANCHES, (1, -1)):
            brins = self.manches[manche['nom']]['brins']
            self.assertEqual(brins.shape, (6, 4, 3))
            np.testing.assert_allclose(brins[:, 1:, :2], brins[:, :1, :2].repeat(3, axis=1), atol=1e-6)
            np.testing.assert_allclose(brins[:, 0, 2] - brins[:, -1, 2], [longueur for *_, longueur in manche['brins']], atol=1e-6)
            np.testing.assert_allclose(signe * brins[:, 0, 0], [0.45 + part * 0.25 for _, part, _, _ in manche['brins']], atol=1e-6)
            self.assertTrue((brins[:, 0, 2] < 1.45 - 0.04).all())
            np.testing.assert_allclose(np.abs(brins[:, 0, 1]), brins[0, 0, 1] * -1, atol=1e-6)
            self.assertEqual([y < 0 for y in brins[:, 0, 1]], [azimut > 0 for _, _, azimut, _ in manche['brins']])
        bouts = self.squelette.monde(self.squelette.pistes('Pas'), (IMAGES // 2) / IMAGES_PAR_SECONDE, [brin[-1] for brin in self.manches['manche_g']['os']])
        np.testing.assert_allclose([m[:3, 3] for m in bouts.values()], self.manches['manche_g']['brins'][:, -2], atol=1e-5)

    def manche_montee(self):
        squelette = Squelette(self.chemin)
        peau = Peau(squelette, 'Corps')
        return Manche(squelette, MANCHES[0], peau), peau, peau.poser(squelette, {}, 0.0, ['lowerarm_l', 'hand_l'])

    def test_sous_un_avant_bras_qui_roule_le_tour_ramene_la_manche_a_son_cote_bas_et_ses_brins_restent_d_aplomb(self):
        manche, peau, (mondes, sommets) = self.manche_montee()
        coude = mondes['lowerarm_l'][:3, 3]
        roule = np.eye(4)
        roule[:3, :3] = autour(np.array([1.0, 0.0, 0.0]), np.radians(120))
        roule[:3, 3] = coude - roule[:3, :3] @ coude
        pose = roule @ mondes['lowerarm_l']
        x, rotations = (image[0] for image in manche.cuire([({'lowerarm_l': pose}, [pendant.Sol(tente.SOL_M)])], False))
        np.testing.assert_allclose(x[:, 0], manche.repos[:, 0], atol=1e-6)
        np.testing.assert_allclose(x, manche.repos, atol=1e-6)
        tours = [2 * np.degrees(np.arccos(abs(rotations[os_][3]))) for os_ in (os_du_tour(MANCHES[0]), os_du_tube(MANCHES[0]))]
        np.testing.assert_allclose(tours, [120.0, 0.5 * 120.0], atol=1e-4)
        dresse = np.eye(4)
        dresse[:3, :3] = autour(np.array([0.0, 1.0, 0.0]), np.radians(90))
        dresse[:3, 3] = coude - dresse[:3, :3] @ coude
        x, rotations = (image[0] for image in manche.cuire([({'lowerarm_l': dresse @ mondes['lowerarm_l']}, [pendant.Sol(tente.SOL_M)])], False))
        np.testing.assert_allclose(rotations[os_du_tour(MANCHES[0])], [0, 0, 0, 1], atol=1e-6)
        np.testing.assert_allclose(x[:, 1:, :2], x[:, :1, :2].repeat(3, axis=1), atol=1e-6)

    def test_le_tissu_lie_les_brins_voisins_d_une_manche(self):
        manche, _, _ = self.manche_montee()
        paires, ecarts = manche.liens
        self.assertEqual(paires.tolist(), [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]])
        np.testing.assert_allclose(ecarts, tente.ETIREMENT_MAX * np.linalg.norm(manche.repos[paires[:, 0], 1:] - manche.repos[paires[:, 1], 1:], axis=2))
        np.testing.assert_allclose(ecarts[[0, 3, 6]], ecarts[[0, 3, 6], :1].repeat(3, axis=1), atol=1e-9)
        self.assertTrue((np.diff(ecarts[[1, 2, 4, 5]], axis=1) > 0).all())
        np.testing.assert_allclose(manche.degagements, manche.degagements[:1].repeat(6, axis=0))

    def test_le_tour_d_une_manche_se_lisse_d_une_image_a_ses_voisines(self):
        manche, peau, (mondes, sommets) = self.manche_montee()
        coude = mondes['lowerarm_l'][:3, 3]

        def roule(degres):
            m = np.eye(4)
            m[:3, :3] = autour(np.array([1.0, 0.0, 0.0]), np.radians(degres))
            m[:3, 3] = coude - m[:3, :3] @ coude
            return {'lowerarm_l': m @ mondes['lowerarm_l']}, [pendant.Sol(tente.SOL_M)]

        _, rotations = manche.cuire([roule(0)] * 6 + [roule(120)] * 6, False)
        angles = np.array([2 * np.degrees(np.arccos(abs(image[os_du_tour(MANCHES[0])][3]))) for image in rotations])
        np.testing.assert_allclose(angles[[0, 1, 2, -3, -2, -1]], [0, 0, 0, 120, 120, 120], atol=1e-4)
        self.assertTrue((np.diff(angles) >= -1e-9).all())
        self.assertLess(np.diff(angles).max(), 120 * 20 / 64 + 1e-4)


    def test_un_brin_qu_un_obstacle_lache_revient_a_l_aplomb_sur_ses_images_voisines(self):
        manche, peau, (mondes, sommets) = self.manche_montee()
        bout = manche.repos[-1, -1]
        fut = pendant.Fut(bout + [0.0, -0.5, 0.05], bout + [0.0, 0.5, 0.05], 0.05)
        sol = pendant.Sol(tente.SOL_M)
        pris, libre = ({'lowerarm_l': mondes['lowerarm_l']}, [fut, sol]), ({'lowerarm_l': mondes['lowerarm_l']}, [sol])
        poses, _ = manche.cuire([pris] * 6 + [libre] * 6, False)
        bouts = np.array([x[-1, -1] for x in poses])
        ecart = np.linalg.norm(bouts[0] - bouts[-1])
        self.assertGreater(ecart, 0.05)
        np.testing.assert_allclose(bouts[-1], bout, atol=1e-6)
        self.assertLess(np.linalg.norm(np.diff(bouts, axis=0), axis=1).max(), 0.4 * ecart)
        longueurs = np.linalg.norm(np.diff(np.array(poses), axis=2), axis=3)
        np.testing.assert_allclose(longueurs, np.broadcast_to(manche.longueurs, longueurs.shape), atol=1e-9)

    def test_le_fut_d_une_hampe_ecarte_le_brin_qu_il_croise(self):
        manche, peau, (mondes, sommets) = self.manche_montee()
        racine = manche.repos[4, 0]
        fut = pendant.Fut(racine + [0.0, -1.0, -0.2], racine + [0.0, 1.0, -0.2], FUT_DE_HAMPE[2])
        libres, _ = manche.cuire([(mondes, [pendant.Peaux(*peau.orientee(sommets))])], False)
        ecartes, _ = manche.cuire([(mondes, [pendant.Peaux(*peau.orientee(sommets)), fut])], False)
        np.testing.assert_allclose(libres[0], manche.repos, atol=1e-6)
        points = ecartes[0][4, :-1, None, :] + np.linspace(0, 1, 6)[None, :, None] * (ecartes[0][4, 1:] - ecartes[0][4, :-1])[:, None, :]
        self.assertGreater(np.hypot(points[..., 0] - racine[0], points[..., 2] - racine[2] + 0.2).min(), FUT_DE_HAMPE[2] + pendant.JEU_M - 0.005)
        prise = repere_de_prise({'os': 'hand_r', 'position': [0.1, 0.2, 0.3], 'rotation': [np.pi / 2, 0.0, 0.0]})
        np.testing.assert_allclose(prise, [[1, 0, 0, 0.1], [0, 0, -1, 0.2], [0, 1, 0, 0.3], [0, 0, 0, 1]], atol=1e-9)

    def test_une_poche_lit_sur_la_manche_son_tour_et_ses_poids(self):
        repos = self.manches['manche_g']
        poche = PocheDeManche(repos, self.squelette.indice)
        indice = self.squelette.indice
        coude, avant_bras = repos['coude'], repos['poignet'] - repos['coude']
        portes = lambda w: {self.squelette.noeuds[i]['name']: round(float(x), 6) for i, x in enumerate(w) if x > 1e-6}
        self.assertEqual(portes(poche.tour(coude - 0.1 * avant_bras)), {'lowerarm_l': 1.0})
        self.assertEqual(portes(poche.tour(coude + 0.05 * avant_bras)), {'lowerarm_l': 0.5, 'manche_g_tube': 0.5})
        self.assertEqual(portes(poche.tour(coude + 0.9 * avant_bras)), {'manche_g_tube': 1.0})
        self.assertEqual([poche.part(0.0), poche.part(CHARNIERE_M)], [0.0, 1.0])
        brins = repos['brins']
        milieu_avant = [s for s, noms in enumerate(repos['os']) if noms[0] == 'manche_g_milieu_avant_01'][0]
        poids = poche.poids(brins[milieu_avant, 1:3].mean(axis=0))
        self.assertAlmostEqual(float(poids.sum()), 1.0, places=6)
        self.assertAlmostEqual(float(poids[self.squelette.indice['manche_g_milieu_avant_02']]), 1.0, places=5)
        entre = poche.poids((brins[milieu_avant, 1] + brins[milieu_avant + 1, 1]) / 2)
        self.assertEqual(portes(entre), {'manche_g_milieu_avant_01': 0.25, 'manche_g_milieu_avant_02': 0.25, 'manche_g_milieu_arriere_01': 0.25, 'manche_g_milieu_arriere_02': 0.25})
        self.assertAlmostEqual(poche.ecart(brins[milieu_avant, 0]), -poche.ecart(brins[milieu_avant + 1, 0]), places=6)
        points, pendus = poche.pendre([brins[milieu_avant, 0] + [0, 0, 0.02]] * 2, [0.0, 0.3])
        np.testing.assert_allclose(points[1] - points[0], [0, 0, -0.3], atol=1e-9)
        self.assertAlmostEqual(float(pendus[0][indice['manche_g_tube']]), 1.0, places=6)
        self.assertEqual(float(pendus[1][indice['manche_g_tube']]), 0.0)
        self.assertAlmostEqual(float(pendus[1].sum()), 1.0, places=6)


if __name__ == '__main__':
    unittest.main()
