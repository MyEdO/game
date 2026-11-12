"""filets.draper sur une base synthétique exportée en GLB : un squelette aux os de la base, un corps en tubes par zone,
un clip qui lève la cuisse gauche. Les os des filets joints à la peau, leurs pistes LINEAR image par image, les racines
autour du corps, la cape par-dessus la jupe, le brin de devant levé par la cuisse et celui de derrière au repos, le
même GLB quand on le drape deux fois, ce qu'une nappe lit du filet au repos (`tissu.Filet`), et l'image d'un filet
monté (`Monte.etat`) : debout ou couché, et sous ce que le bras balaie d'un instant voisin."""
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
from filets import COUCHE_SOUS_LE_SOL_M, FILETS, Monte, Peau, Squelette, draper, filets_au_repos  # noqa: E402
from pistes import sacs  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from tissu import CHARNIERE_M, Filet  # noqa: E402

OS = {
    'pelvis': ((0, 0, 0.95), (0, 0, 1.05), None),
    'spine_01': ((0, 0, 1.05), (0, 0, 1.2), 'pelvis'),
    'spine_02': ((0, 0, 1.2), (0, 0, 1.35), 'spine_01'),
    'spine_03': ((0, 0, 1.35), (0, 0, 1.45), 'spine_02'),
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
        cls.chaines = draper(cls.chemin, 'Corps')
        cls.squelette = Squelette(cls.chemin)
        cls.repos = filets_au_repos(cls.chemin)

    def test_les_os_des_filets_sont_des_joints_de_la_peau_sous_leur_porteur(self):
        self.assertEqual({nom: len(os_) for nom, os_ in self.chaines.items()}, {'jupe': 48, 'cape': 28})
        joints = {self.squelette.noeuds[j]['name'] for j in self.squelette.peau['joints']}
        self.assertLessEqual({os_ for noms in self.chaines.values() for os_ in noms}, joints)
        self.assertEqual(len(self.squelette.liaisons), len(self.squelette.peau['joints']))
        for filet in FILETS:
            for brin in self.repos[filet['nom']]['os']:
                parents = [self.squelette.noeuds[self.squelette.parent[self.squelette.indice[os_]]]['name'] for os_ in brin]
                self.assertEqual(parents, [filet['porteur'], *brin[:-1]])

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
        (_, _, Q, _, sol), _ = jupe.etat(mondes, sommets, [], [])
        np.testing.assert_allclose(Q, np.eye(3), atol=1e-6)
        self.assertAlmostEqual(sol, tente.SOL_M)
        sur_le_dos = np.eye(4)
        sur_le_dos[:3, :3] = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
        (_, _, Q, _, sol), _ = jupe.etat({**mondes, 'pelvis': sur_le_dos @ mondes['pelvis']}, sommets, [], [])
        np.testing.assert_allclose(Q, sur_le_dos[:3, :3], atol=1e-6)
        self.assertAlmostEqual(sol, tente.SOL_M - COUCHE_SOUS_LE_SOL_M)

    def test_le_filet_voit_au_dehors_ce_que_le_bras_balaie_d_un_instant_voisin(self):
        jupe, (mondes, sommets) = self.jupe_montee()
        (_, _, _, immobile, _), _ = jupe.etat(mondes, sommets, [], [(mondes, sommets)])
        voisine = {**sommets, 'bras': sommets['bras'] - [0, 0, 0.3]}
        (_, _, _, balaye, _), _ = jupe.etat(mondes, sommets, [], [(mondes, voisine)])
        du_dehors = lambda obstacles: obstacles[0][obstacles[2] == tente.DEHORS]
        np.testing.assert_allclose(du_dehors(immobile), sommets['bras'], atol=1e-9)
        np.testing.assert_allclose(du_dehors(balaye), np.concatenate([sommets['bras'], voisine['bras']]), atol=1e-9)

    def test_draper_deux_fois_rend_le_meme_filet(self):
        pistes = self.squelette.pistes('Pas')
        self.assertEqual(draper(self.chemin, 'Corps'), self.chaines)
        encore = Squelette(self.chemin)
        self.assertEqual(len(encore.noeuds), len(self.squelette.noeuds))
        self.assertEqual(encore.peau['joints'], self.squelette.peau['joints'])
        for nom, filet in filets_au_repos(self.chemin).items():
            np.testing.assert_allclose(filet['brins'], self.repos[nom]['brins'], atol=1e-5)
        for cle, (_, quaternions) in encore.pistes('Pas').items():
            np.testing.assert_allclose(quaternions, pistes[cle][1], atol=1e-5)


if __name__ == '__main__':
    unittest.main()
