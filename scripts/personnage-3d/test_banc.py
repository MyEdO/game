"""banc (#3810, #4318) sur un GLB fabriqué dans bpy : les pistes réécrites sans rien changer rendent les quaternions
d'origine, une rotation forcée se retrouve dans le GLB écrit, le manifeste écrit porte l'empreinte du GLB écrit, et
l'outil refuse une sortie dans le dépôt."""
import hashlib
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import bpy
import numpy
from mathutils import Quaternion

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import banc  # noqa: E402
from glb import lire_accesseur, lire_glb  # noqa: E402
from pistes import sacs  # noqa: E402
from production import DEPOT  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402

CLIP = 'Geste'
OS = 'bras'
FORCEE = Quaternion((1, 0, 0), math.radians(30))


def construire(chemin):
    """Un rig `racine` → `bras` incliné, un corps skinné sur les deux, et le clip `CLIP` où `bras` tourne de 0 à 90°
    autour de son X ; exporté en GLB sous `chemin`. Rend son manifeste minimal, à son empreinte."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
    rig = bpy.data.objects.new('Rig', bpy.data.armatures.new('Rig'))
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    racine = rig.data.edit_bones.new('racine')
    racine.head, racine.tail = (0, 0, 0), (0, 0, 1)
    bras = rig.data.edit_bones.new(OS)
    bras.head, bras.tail, bras.parent = (0, 0, 1), (0.6, 0.2, 1.7), racine
    bpy.ops.object.mode_set(mode='OBJECT')
    mesh = bpy.data.meshes.new('corps')
    mesh.from_pydata([(0, 0, 0), (0.3, 0, 0), (0, 0.3, 0), (0, 0, 1), (0.6, 0.2, 1.7)], [],
                     [(0, 1, 2), (0, 1, 3), (1, 2, 3), (0, 2, 3), (1, 3, 4)])
    mesh.uv_layers.new()
    corps = bpy.data.objects.new('corps', mesh)
    bpy.context.scene.collection.objects.link(corps)
    corps.parent = rig
    corps.vertex_groups.new(name='racine').add([0, 1, 2], 1.0, 'REPLACE')
    corps.vertex_groups.new(name=OS).add([3, 4], 1.0, 'REPLACE')
    corps.modifiers.new('Rig', 'ARMATURE').object = rig
    rig.animation_data_create()
    rig.animation_data.action = bpy.data.actions.new(CLIP)
    pose = rig.pose.bones[OS]
    for image, degres in ((1, 0), (7, 50), (13, 90)):
        pose.rotation_quaternion = Quaternion((1, 0, 0), math.radians(degres))
        pose.keyframe_insert('rotation_quaternion', frame=image)
    bpy.ops.export_scene.gltf(filepath=str(chemin), export_format='GLB', export_animation_mode='ACTIONS')
    return {'base': 'synthetique', 'glb': banc.empreinte(chemin.read_bytes()), 'gabarit': {'osDesSilhouettes': {}}}


def rotations(chemin):
    """Les quaternions (x, y, z, w) de la piste de rotation de `OS` dans `CLIP` du GLB `chemin`."""
    document, binaire = lire_glb(chemin)
    noeud = next(i for i, n in enumerate(document['nodes']) if n.get('name') == OS)
    animation = next(a for a in document['animations'] if a['name'] == CLIP)
    canal = next(c for c in animation['channels'] if c['target'] == {'node': noeud, 'path': 'rotation'})
    return lire_accesseur(document, binaire, animation['samplers'][canal['sampler']]['output'])


class Banc(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.racine = Path(self.dossier.name)
        self.source = self.racine / 'base.glb'
        self.manifeste = construire(self.source)
        self.rig = banc.charger(self.source, self.manifeste)

    def tearDown(self):
        self.dossier.cleanup()

    def test_les_pistes_reecrites_sans_changement_rendent_les_quaternions_d_origine(self):
        sortie = self.racine / 'aller-retour.glb'
        banc.ecrire(self.source, sortie, self.rig, [CLIP], [OS])
        origine, relue = rotations(self.source), rotations(sortie)
        self.assertGreater(float(numpy.abs(origine - origine[0]).max()), 0.1)
        self.assertLess(float(numpy.minimum(numpy.abs(relue - origine), numpy.abs(relue + origine)).max()), 1e-6)

    def test_une_rotation_forcee_se_retrouve_dans_le_glb_ecrit(self):
        for sac in sacs(bpy.data.actions[CLIP]):
            for courbe in sac.fcurves:
                if courbe.data_path == f'pose.bones["{OS}"].rotation_quaternion':
                    for cle in courbe.keyframe_points:
                        cle.co[1] = FORCEE[courbe.array_index]
        os = self.rig.data.bones[OS]
        repos = (os.parent.matrix_local.inverted() @ os.matrix_local).to_quaternion()
        attendue = repos @ FORCEE
        sortie = self.racine / 'forcee.glb'
        banc.ecrire(self.source, sortie, self.rig, [CLIP], [OS])
        for q in rotations(sortie):
            self.assertLess(min(numpy.abs(q - [*attendue[1:], attendue[0]]).max(), numpy.abs(q + [*attendue[1:], attendue[0]]).max()), 1e-6)

    def test_le_manifeste_ecrit_porte_l_empreinte_du_glb_ecrit(self):
        sortie = self.racine / 'ecrit.glb'
        banc.ecrire(self.source, sortie, self.rig, [CLIP], [OS])
        chemin = self.racine / 'ecrit.manifeste.json'
        banc.ecrire_le_manifeste(self.manifeste, sortie, chemin)
        ecrit = json.loads(chemin.read_text(encoding='utf-8'))
        octets = sortie.read_bytes()
        self.assertEqual(ecrit['glb'], {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)})
        self.assertNotEqual(ecrit['glb'], self.manifeste['glb'])
        self.assertEqual(ecrit['gabarit'], self.manifeste['gabarit'])

    def test_l_outil_refuse_une_sortie_dans_le_depot(self):
        manifeste = self.racine / 'base.manifeste.json'
        manifeste.write_text(json.dumps(self.manifeste), encoding='utf-8')
        sortie = DEPOT / 'scripts' / 'personnage-3d' / '.banc-refuse'
        argv = ['banc.py', str(self.source), str(manifeste), '--sortie', str(sortie), '--pack', CLIP]
        try:
            with mock.patch.object(sys, 'argv', argv), self.assertRaisesRegex(ValueError, 'dans le dépôt'):
                banc.principal()
            self.assertFalse(sortie.exists())
        finally:
            for fichier in sortie.glob('*') if sortie.exists() else ():
                fichier.unlink()
            if sortie.exists():
                sortie.rmdir()


if __name__ == '__main__':
    unittest.main()
