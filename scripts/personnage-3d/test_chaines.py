"""chaines.ajouter_chaines et chaines.cuire_chaines sur un squelette synthétique aux os de la base : les six chaînes du
design posées sous leurs os porteurs, le manifeste lu de la scène, une piste de rotation LINEAR par os de chaîne dans
chaque clip, la jupe qui suit la cuisse avancée et la cape qui pend quand le dos se penche en arrière."""
import math
import sys
import unittest
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from animation import assign_action, clear_animation  # noqa: E402
from chaines import SEGMENTS, ajouter_chaines, cuire_chaines, rotation_du_brin  # noqa: E402
from pistes import sacs  # noqa: E402

OS = {
    'root': ((0, 0, 0), (0, 0, 0.2), None),
    'pelvis': ((0, 0.043, 0.959), (0, 0.01, 1.07), 'root'),
    'thigh_l': ((0.114, 0.036, 0.981), (0.114, 0.036, 0.552), 'pelvis'),
    'calf_l': ((0.114, 0.036, 0.552), (0.114, 0.088, 0.096), 'thigh_l'),
    'thigh_r': ((-0.114, 0.036, 0.981), (-0.114, 0.036, 0.552), 'pelvis'),
    'spine_03': ((0, -0.007, 1.32), (0, 0.036, 1.505), 'pelvis'),
    'clavicle_l': ((0.031, -0.033, 1.505), (0.212, 0.065, 1.465), 'spine_03'),
    'upperarm_l': ((0.212, 0.065, 1.465), (0.463, 0.073, 1.465), 'clavicle_l'),
    'lowerarm_l': ((0.463, 0.073, 1.465), (0.7, 0.073, 1.465), 'upperarm_l'),
    'clavicle_r': ((-0.031, -0.033, 1.505), (-0.212, 0.065, 1.465), 'spine_03'),
    'upperarm_r': ((-0.212, 0.065, 1.465), (-0.463, 0.073, 1.465), 'clavicle_r'),
    'lowerarm_r': ((-0.463, 0.073, 1.465), (-0.7, 0.073, 1.465), 'upperarm_r'),
    'neck_01': ((0, 0.041, 1.53), (0, 0.017, 1.609), 'spine_03'),
    'Head': ((0, 0.017, 1.609), (0, 0.017, 1.8), 'neck_01'),
}
PORTEURS = {'jupe_avant_01': 'pelvis', 'jupe_arriere_01': 'pelvis', 'jupe_g_01': 'pelvis', 'jupe_d_01': 'pelvis',
            'cape_01': 'spine_03', 'queue_01': 'pelvis', 'aile_g_01': 'spine_03', 'aile_d_01': 'spine_03',
            'bras_sup_g_01': 'clavicle_l', 'bras_sup_d_01': 'clavicle_r', 'cou_long_01': 'neck_01'}
BAS = Vector((0.0, 0.0, -1.0))


def construire():
    """Le squelette `OS`, un corps en anneaux elliptiques des hanches aux épaules, et deux clips : `Marche` avance la
    cuisse gauche de 30° à l'image 10 ; `Penche` penche le dos de 20° en arrière à l'image 10, en avant à l'image 20."""
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
    points = [(0.18 * math.cos(a), 0.03 + 0.12 * math.sin(a), z)
              for z in (0.96, 0.98, 1.0, 1.41, 1.43, 1.45, 1.47, 1.49) for a in (k * math.pi / 8 for k in range(16))]
    maillage = bpy.data.meshes.new('corps')
    maillage.from_pydata(points, [], [])
    corps = bpy.data.objects.new('corps', maillage)
    bpy.context.scene.collection.objects.link(corps)
    clips = [cle_au_milieu(rig, 'Marche', {10: {'thigh_l': Matrix.Rotation(math.radians(-30), 3, 'X')}}),
             cle_au_milieu(rig, 'Penche', {10: {'spine_03': Matrix.Rotation(math.radians(-20), 3, 'X')},
                                           20: {'spine_03': Matrix.Rotation(math.radians(20), 3, 'X')}})]
    return rig, corps, clips


def cle_au_milieu(rig, nom, poses):
    """Un clip `nom` de 0 à 20 : au repos aux bouts, à chaque image de `poses` ses os tournés (rotation de l'armature)."""
    action = bpy.data.actions.new(nom)
    assign_action(rig, action)
    for image in (0, *poses, 20):
        for os_ in ('thigh_l', 'spine_03'):
            b = rig.pose.bones[os_]
            b.rotation_mode = 'QUATERNION'
            rotation = poses.get(image, {}).get(os_)
            b.rotation_quaternion = rotation_du_brin(b.bone.matrix_local, rotation) if rotation else (1, 0, 0, 0)
            b.keyframe_insert('rotation_quaternion', frame=image)
    clear_animation(rig)
    return action


def direction(rig, nom):
    b = rig.pose.bones[nom]
    return (b.tail - b.head).normalized()


class Chaines(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rig, corps, cls.clips = construire()
        cls.chaines = ajouter_chaines(bpy, cls.rig, corps)
        cuire_chaines(bpy, cls.rig, cls.clips, cls.chaines)

    def poser(self, clip, image):
        assign_action(self.rig, clip)
        bpy.context.scene.frame_set(image)
        self.addCleanup(clear_animation, self.rig)

    def test_les_six_chaines_du_design_sous_leurs_os_porteurs(self):
        self.assertEqual(list(self.chaines), ['jupe', 'cape', 'queue', 'ailes', 'bras_sup', 'cou_long'])
        for chaine, os_ in self.chaines.items():
            brins = 4 if chaine == 'jupe' else 2 if chaine in ('ailes', 'bras_sup') else 1
            self.assertEqual(len(os_), brins * SEGMENTS[chaine], chaine)
        os_de_la_scene = {b.name for b in self.rig.data.bones}
        self.assertTrue(all(nom in os_de_la_scene for noms in self.chaines.values() for nom in noms))
        self.assertEqual({nom: self.rig.data.bones[nom].parent.name for nom in PORTEURS}, PORTEURS)

    def test_chaque_clip_porte_une_piste_de_rotation_lineaire_par_os_de_chaine(self):
        for clip in self.clips:
            courbes = {(c.data_path, c.array_index): c for sac in sacs(clip) for c in sac.fcurves}
            for nom in (n for noms in self.chaines.values() for n in noms):
                for i in range(4):
                    courbe = courbes.get((f'pose.bones["{nom}"].rotation_quaternion', i))
                    self.assertIsNotNone(courbe, f'{clip.name} : {nom}[{i}]')
                    self.assertEqual({k.interpolation for k in courbe.keyframe_points}, {'LINEAR'}, f'{clip.name} : {nom}[{i}]')

    def test_le_brin_avant_de_la_jupe_suit_la_cuisse_avancee_l_arriere_reste_vertical(self):
        self.poser(self.clips[0], 10)
        cuisse = direction(self.rig, 'thigh_l')
        self.assertAlmostEqual(math.degrees(cuisse.angle(BAS)), 30, places=3)
        avant = direction(self.rig, 'jupe_avant_01')
        self.assertAlmostEqual(avant.angle(BAS), cuisse.angle(BAS), places=4)
        self.assertLess(avant.y, 0)
        self.assertAlmostEqual(direction(self.rig, 'jupe_arriere_01').angle(BAS), 0, places=4)

    def test_la_cape_pend_quand_le_dos_se_penche_en_arriere_et_se_couche_sur_lui_en_avant(self):
        self.poser(self.clips[1], 10)
        self.assertAlmostEqual(direction(self.rig, 'cape_01').angle(BAS), 0, places=4)
        self.poser(self.clips[1], 20)
        self.assertAlmostEqual(math.degrees(direction(self.rig, 'cape_01').angle(BAS)), 20, places=3)


if __name__ == '__main__':
    unittest.main()
