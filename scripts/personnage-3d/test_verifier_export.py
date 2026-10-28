"""verifier_export.verify et animation.verify sur des GLB fabriqués dans bpy : attache rigide, contrôles du conteneur
glTF, clips déclarés ; puis le modèle commité Knight.glb."""
import argparse
import json
import struct
import tempfile
import unittest
from pathlib import Path

import bpy
import numpy as np

import animation
from glb import CHUNK_BIN, CHUNK_JSON, MAGIE_GLB, lire_glb
from verifier_export import controles_glb, verify

MODELES = Path(__file__).resolve().parents[2] / 'hotes' / 'godot' / 'projet' / 'modeles'


def construire(chemin, prop=None, uv=True, blend=False, clip_fixe=False):
    """Un rig deux os animé ('Bouge'), un corps skinné, et selon `prop` une pièce attachée à l'os 'main' :
    'os' (parent os), 'os_mod' (parent os et modificateur Armature), 'objet' (parent objet), 'libre' (sans parent)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig = bpy.data.objects.new('Rig', bpy.data.armatures.new('Rig'))
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    root = rig.data.edit_bones.new('root')
    root.head, root.tail = (0, 0, 0), (0, 0, 1)
    main = rig.data.edit_bones.new('main')
    main.head, main.tail, main.parent = (0, 0, 1), (0, 0, 2), root
    bpy.ops.object.mode_set(mode='OBJECT')
    material = bpy.data.materials.new('m')
    texture = material.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = bpy.data.images.new('tex', 4, 4)
    bsdf = next(node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED')
    material.node_tree.links.new(texture.outputs[0], bsdf.inputs['Base Color'])
    if blend:
        material.node_tree.links.new(texture.outputs['Alpha'], bsdf.inputs['Alpha'])
        material.surface_render_method = 'BLENDED'

    def tetraedre(nom, z):
        mesh = bpy.data.meshes.new(nom)
        mesh.from_pydata([(0, 0, z), (1, 0, z), (0, 1, z), (0, 0, z + 1)], [], [(0, 1, 2), (0, 1, 3), (1, 2, 3), (0, 2, 3)])
        mesh.materials.append(material)
        if uv:
            mesh.uv_layers.new()
        obj = bpy.data.objects.new(nom, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj

    corps = tetraedre('corps', 0)
    corps.parent = rig
    corps.vertex_groups.new(name='root').add([0, 1, 2, 3], 1.0, 'REPLACE')
    corps.modifiers.new('Rig', 'ARMATURE').object = rig
    if prop:
        piece = tetraedre('prop', 1)
        if prop in ('os', 'os_mod'):
            piece.parent, piece.parent_type, piece.parent_bone = rig, 'BONE', 'main'
        elif prop == 'objet':
            piece.parent = rig
        if prop == 'os_mod':
            piece.modifiers.new('Rig', 'ARMATURE').object = rig
            piece.vertex_groups.new(name='main').add([0], 1.0, 'REPLACE')
    rig.animation_data_create()
    bone = rig.pose.bones['root']
    if clip_fixe:
        fixe = bpy.data.actions.new('Fixe')
        rig.animation_data.action = fixe
        bone.location = (0, 0, 0)
        bone.keyframe_insert('location', frame=1)
        bone.keyframe_insert('location', frame=10)
        track = rig.animation_data.nla_tracks.new()
        track.strips.new('Fixe', 1, fixe)
    rig.animation_data.action = bpy.data.actions.new('Bouge')
    bone.location = (0, 0, 0)
    bone.keyframe_insert('location', frame=1)
    bone.location = (0, 0, 1)
    bone.keyframe_insert('location', frame=10)
    bpy.ops.export_scene.gltf(filepath=str(chemin), export_format='GLB', export_animation_mode='ACTIONS')
    return chemin


def ecrire_glb(chemin, document, binary):
    texte = json.dumps(document).encode('utf-8')
    texte += b' ' * (-len(texte) % 4)
    binary = bytes(binary) + b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(texte) + 8 + len(binary)
    chemin.write_bytes(struct.pack('<III', MAGIE_GLB, 2, total) + struct.pack('<II', len(texte), CHUNK_JSON) + texte
                       + struct.pack('<II', len(binary), CHUNK_BIN) + binary)


def ecrire_nan(document, binary, accessor_index):
    """Copie du chunk BIN où la première composante flottante de l'accesseur vaut NaN."""
    accessor = document['accessors'][accessor_index]
    view = document['bufferViews'][accessor['bufferView']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    mutated = bytearray(binary)
    struct.pack_into('<f', mutated, offset, float('nan'))
    return mutated


class Base(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.racine = Path(self.dossier.name)

    def tearDown(self):
        self.dossier.cleanup()


class AttacheRigide(Base):
    def cas(self, prop):
        report = verify(construire(self.racine / f'{prop}.glb', prop=prop), 'rig', clips=['Bouge'])
        piece = next(mesh for mesh in report['meshes'] if mesh['name'] == 'prop')
        return piece, [error for error in report['errors'] if error.startswith('Invalid weights')]

    def test_piece_sous_un_os_est_une_attache_rigide(self):
        for prop in ('os', 'os_mod'):
            with self.subTest(prop=prop):
                piece, errors = self.cas(prop)
                self.assertFalse(piece['weight_check_applicable'])
                self.assertEqual(piece['parent_bone'], 'main')
                self.assertEqual(errors, [])

    def test_piece_sans_os_parent_doit_etre_skinnee(self):
        for prop in ('objet', 'libre'):
            with self.subTest(prop=prop):
                piece, errors = self.cas(prop)
                self.assertTrue(piece['weight_check_applicable'])
                self.assertIsNone(piece['parent_bone'])
                self.assertEqual(errors, ['Invalid weights: prop'])


class ControlesDuConteneur(Base):
    def test_temoin_passe(self):
        report = verify(construire(self.racine / 'temoin.glb'), 'rig', clips=['Bouge'])
        self.assertEqual(report['errors'], [])

    def test_primitive_sans_uv_refusee(self):
        report = verify(construire(self.racine / 'sans_uv.glb', uv=False), 'rig', clips=['Bouge'])
        self.assertEqual(report['errors'], ['Primitive without TEXCOORD_0: corps'])

    def test_materiau_en_melange_alpha_refuse(self):
        report = verify(construire(self.racine / 'blend.glb', blend=True), 'rig', clips=['Bouge'])
        self.assertEqual(report['errors'], ['Blended alpha material: m'])

    def muter(self, mutation):
        document, binary = lire_glb(construire(self.racine / 'temoin.glb'))
        binary = mutation(document, binary) or binary
        chemin = self.racine / 'mute.glb'
        ecrire_glb(chemin, document, binary)
        return controles_glb(chemin)

    def test_inverse_bind_matrices_absentes(self):
        def mutation(document, _):
            del document['skins'][0]['inverseBindMatrices']
        self.assertEqual(self.muter(mutation), ['Skin without inverse bind matrices: Rig'])

    def test_inverse_bind_matrices_en_nombre_faux(self):
        def mutation(document, _):
            document['accessors'][document['skins'][0]['inverseBindMatrices']]['count'] -= 1
        self.assertEqual(self.muter(mutation), ['Inverse bind matrix count differs from joints: Rig'])

    def test_inverse_bind_matrices_non_finies(self):
        self.assertEqual(self.muter(lambda document, binary: ecrire_nan(document, binary, document['skins'][0]['inverseBindMatrices'])),
                         ['Non-finite inverse bind matrices: Rig'])

    def test_second_jeu_d_influences_refuse(self):
        def mutation(document, _):
            attributes = document['meshes'][0]['primitives'][0]['attributes']
            attributes['JOINTS_1'], attributes['WEIGHTS_1'] = attributes['JOINTS_0'], attributes['WEIGHTS_0']
        self.assertEqual(self.muter(mutation), ['More than 4 influences declared: corps'])

    def test_poids_non_finis(self):
        self.assertEqual(self.muter(lambda document, binary: ecrire_nan(
            document, binary, document['meshes'][0]['primitives'][0]['attributes']['WEIGHTS_0'])),
            ['Non-finite skin weights: corps'])


class ClipsDeclares(Base):
    def test_seuls_les_clips_declares_sont_mesures(self):
        report = verify(construire(self.racine / 'deux.glb', clip_fixe=True), 'rig', clips=['Bouge'])
        self.assertEqual(sorted(report['action_names']), ['Bouge', 'Fixe'])
        self.assertEqual([action['name'] for action in report['actions']], ['Bouge'])
        self.assertEqual(report['errors'], [])

    def test_clip_declare_sans_deformation_refuse(self):
        report = verify(construire(self.racine / 'deux.glb', clip_fixe=True), 'rig', clips=['Bouge', 'Fixe'])
        self.assertEqual(report['errors'], ['No finite real deformation: Fixe'])

    def test_clip_declare_absent_refuse(self):
        report = verify(construire(self.racine / 'temoin.glb'), 'rig', clips=['Absent'])
        self.assertEqual(report['errors'], ['Missing animation: Absent'])


class VerificationDuReimport(Base):
    def verifier(self, **construction):
        chemin = construire(self.racine / 'animated.glb', **construction)
        manifest = self.racine / 'manifest.json'
        manifest.write_text(json.dumps({'clips': {'idle': 'Bouge'}}), encoding='utf-8')
        animation.verify(argparse.Namespace(verify=chemin, os=2, manifest=manifest))
        return json.loads((self.racine / 'reimport-report.json').read_text(encoding='utf-8'))

    def test_delegue_au_verificateur(self):
        report = self.verifier()
        self.assertEqual(report['export']['errors'], [])
        self.assertEqual(list(report['clips']), ['Bouge'])

    def test_erreur_du_verificateur_leve(self):
        with self.assertRaisesRegex(RuntimeError, 'Primitive without TEXCOORD_0'):
            self.verifier(uv=False)


class Tetes(unittest.TestCase):
    PIECES = {'body': {'node': 'corps', 'component': 'body', 'headVariant': None},
              'cape': {'node': 'cape', 'component': 'cape', 'headVariant': None, 'hiddenBy': ['capuche']}}

    def manifeste(self, default_head, head_options):
        return {'default_head': default_head, 'head_options': head_options, 'defaults': ['cape'], 'presets': {},
                'pieces': self.PIECES}

    def test_personnage_sans_tete(self):
        manifest = self.manifeste(None, [])
        self.assertEqual(animation.tetes(manifest), [None])
        meshes = [argparse.Namespace(name=piece['node'], hide_render=True) for piece in self.PIECES.values()]
        visibles = animation.manifest_selection(meshes, manifest)
        self.assertEqual(sorted(obj.name for obj in visibles), ['cape', 'corps'])

    def test_tete_par_defaut_hors_de_ses_options_refusee(self):
        for default_head, head_options in ((None, [{'id': 'a'}]), ('a', []), ('b', [{'id': 'a'}])):
            with self.subTest(default_head=default_head, head_options=head_options):
                with self.assertRaisesRegex(RuntimeError, 'default_head'):
                    animation.tetes(self.manifeste(default_head, head_options))

    def test_preset_selectionne_ses_composants(self):
        manifest = {**self.manifeste(None, []), 'defaults': [],
                    'presets': {'manteau': {'label_fr': 'Manteau', 'components': ['cape']}}}
        meshes = [argparse.Namespace(name=piece['node'], hide_render=True) for piece in self.PIECES.values()]
        visibles = animation.manifest_selection(meshes, manifest, preset='manteau')
        self.assertEqual(sorted(obj.name for obj in visibles), ['cape', 'corps'])

    def test_libelle_de_combinaison(self):
        self.assertEqual(animation.combinaison(None, 'manteau'), 'sans-tete-manteau')
        self.assertEqual(animation.combinaison('a', 'manteau'), 'a-manteau')


class ModeleCommite(unittest.TestCase):
    def test_knight_passe(self):
        manifest = json.loads((MODELES / 'Knight.manifeste.json').read_text(encoding='utf-8'))
        report = verify(MODELES / manifest['model'], 'rig', clips=manifest['clips'].values())
        self.assertEqual(report['errors'], [])
        self.assertEqual(sorted(action['name'] for action in report['actions']), sorted(manifest['clips'].values()))
        self.assertTrue(np.all([action['has_real_deformation'] for action in report['actions']]))


if __name__ == '__main__':
    unittest.main()
