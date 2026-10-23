"""Aller-retour d'export en lecture seule : un GLB ou un .blend réimporté dans bpy, squelette, poids, textures et
déformation réelle de chaque action mesurés. Les attentes propres à un personnage (os, actions, collections) sont des
arguments.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/verifier_export.py \\
        --input <fichier.glb|.blend> --output-json <rapport.json> [--kind static|rig|blend] [--os N] \\
        [--os-requis NOM ...] [--animation-requise NOM ...] [--actions-min N] [--collection NOM ...]
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import bpy
import numpy as np

from glb import resume_glb
from mesure import world_vertices


def verify(path, kind, bones=None, required_bones=(), required_actions=(), minimum_actions=1, collections=()):
    started = time.monotonic()
    checksum = hashlib.sha256()
    with path.open('rb') as handle:
        while block := handle.read(1024 * 1024):
            checksum.update(block)
    report = {'input': path.name, 'kind': kind, 'sha256': checksum.hexdigest(),
              'blender': bpy.app.version_string, 'errors': []}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if kind == 'blend':
        bpy.ops.wm.open_mainfile(filepath=str(path))
    else:
        report['glb'] = resume_glb(path)
        bpy.ops.import_scene.gltf(filepath=str(path))
    rigs = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
    bone_display_helpers = {bone.custom_shape for rig in rigs for bone in rig.pose.bones if bone.custom_shape}
    report['importer_bone_display_helpers'] = [obj.name for obj in bone_display_helpers]
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj not in bone_display_helpers]
    expected = set(required_bones)
    report['armatures'] = []
    for rig in rigs:
        names = {bone.name for bone in rig.data.bones}
        missing = sorted(expected - names)
        report['armatures'].append({'name': rig.name, 'bones': sorted(names),
                                    'count': len(names), 'missing_expected': missing})
        if kind != 'static' and (missing or (bones is not None and len(names) != bones)):
            report['errors'].append(f'Unexpected skeleton: {rig.name}')
    if kind != 'static' and len(rigs) != 1:
        report['errors'].append(f'Expected one armature, found {len(rigs)}')
    if kind == 'static' and rigs:
        report['errors'].append('Static GLB unexpectedly contains an armature')
    bone_names = {bone.name for rig in rigs for bone in rig.data.bones}
    report['meshes'] = []
    for obj in meshes:
        modifiers = [mod.object.name if mod.object else None for mod in obj.modifiers if mod.type == 'ARMATURE']
        rigid_attachment = obj.parent_type == 'BONE' and not modifiers
        check_weights = bool(modifiers) or (kind == 'rig' and not rigid_attachment)
        group_names = {group.index: group.name for group in obj.vertex_groups}
        maximum = 0
        bad_sum = 0
        unweighted = 0
        sum_min, sum_max = float('inf'), 0.0
        for vertex in obj.data.vertices if check_weights else []:
            weights = [group.weight for group in vertex.groups
                       if group_names[group.group] in bone_names and group.weight > 1e-7]
            total = sum(weights)
            maximum = max(maximum, len(weights))
            unweighted += not weights
            bad_sum += abs(total - 1) > 1e-4
            sum_min, sum_max = min(sum_min, total), max(sum_max, total)
        report['meshes'].append({'name': obj.name, 'vertices': len(obj.data.vertices),
            'triangles': sum(len(face.vertices) - 2 for face in obj.data.polygons),
            'uv_layers': [layer.name for layer in obj.data.uv_layers],
            'max_influences': maximum, 'unweighted_vertices': unweighted,
            'weight_check_applicable': check_weights,
            'bad_weight_sums': bad_sum, 'weight_sum_range': [sum_min, sum_max] if check_weights else None,
            'armature_modifiers': modifiers, 'parent_bone': obj.parent_bone if rigid_attachment else None})
        if check_weights and (maximum > 4 or unweighted or bad_sum):
            report['errors'].append(f'Invalid weights: {obj.name}')
    image_nodes = set()
    for obj in meshes:
        for material in obj.data.materials:
            if material and material.use_nodes:
                image_nodes.update(node.image for node in material.node_tree.nodes
                                   if node.type == 'TEX_IMAGE' and node.image)
    report['textures'] = [{'name': image.name, 'dimensions': list(image.size),
                           'packed': bool(image.packed_file)} for image in image_nodes]
    if not image_nodes or any(min(image.size) <= 0 for image in image_nodes):
        report['errors'].append('Missing or unreadable material texture')
    report['actions'] = []
    actions = list(bpy.data.actions)
    deforming_meshes = [obj for obj in meshes if any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
    scene = bpy.context.scene
    scene.render.fps = 24

    def frame_set(frame):
        integer = int(frame)
        scene.frame_set(integer, subframe=frame - integer)
        bpy.context.view_layer.update()

    for rig in rigs:
        rig.animation_data_create()
        for action in actions:
            rig.animation_data.action = None
            for bone in rig.pose.bones:
                bone.matrix_basis.identity()
            rig.animation_data.action = action
            slots = [slot for slot in action.slots if slot.target_id_type == 'OBJECT']
            if slots:
                rig.animation_data.action_slot = slots[0]
            start, end = map(float, action.frame_range)
            frame_set(start)
            reference = world_vertices(bpy, deforming_meshes)
            samples = []
            for fraction in [.25, .5, .75, 1.0]:
                frame = start + (end - start) * fraction
                frame_set(frame)
                pose = world_vertices(bpy, deforming_meshes)
                movement = [np.linalg.norm(pose[name] - base, axis=1) for name, base in reference.items()]
                samples.append({'fraction': fraction, 'frame': frame,
                    'moved_vertices': sum(int(np.sum(delta > 1e-5)) for delta in movement),
                    'maximum_displacement_m': max((float(delta.max()) for delta in movement), default=0),
                    'finite': all(bool(np.isfinite(delta).all()) for delta in movement)})
            moved = any(sample['moved_vertices'] for sample in samples)
            report['actions'].append({'name': action.name, 'armature': rig.name,
                'frame_range': [start, end], 'has_real_deformation': moved, 'samples': samples})
            if not moved or not all(sample['finite'] for sample in samples):
                report['errors'].append(f'No finite real deformation: {action.name}')
    action_names = [action.name for action in actions] if kind == 'blend' else report['glb']['animation_names']
    report['action_names'] = action_names
    for name in required_actions if kind != 'static' else []:
        if not any(name in (actual or '') for actual in action_names):
            report['errors'].append(f'Missing animation: {name}')
    if kind != 'static' and len(report['actions']) < minimum_actions:
        report['errors'].append(f'Fewer than {minimum_actions} imported actions verified')
    if kind == 'static' and action_names:
        report['errors'].append('Static GLB unexpectedly contains animation')
    if kind == 'blend':
        report['collections'] = []
        for collection_name in collections:
            collection = bpy.data.collections.get(collection_name)
            objects = list(collection.all_objects) if collection else []
            report['collections'].append({'name': collection_name, 'present': collection is not None,
                'objects': [{'name': obj.name, 'type': obj.type,
                    'hidden_viewport': obj.hide_get(), 'hidden_render': obj.hide_render,
                    'triangles': sum(len(face.vertices) - 2 for face in obj.data.polygons) if obj.type == 'MESH' else None}
                    for obj in objects]})
            if not collection or not objects:
                report['errors'].append(f'Missing or empty collection: {collection_name}')
        if not all(image.packed_file for image in image_nodes):
            report['errors'].append('Blend has unpacked material image')
    if not meshes:
        report['errors'].append('No imported mesh')
    report['seconds'] = round(time.monotonic() - started, 3)
    report['status'] = 'passed_technical_roundtrip_visual_review_still_required' if not report['errors'] else 'failed'
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--output-json', required=True, type=Path)
    parser.add_argument('--kind', choices=['static', 'rig', 'blend'])
    parser.add_argument('--os', type=int, dest='bones', help="nombre d'os exact du squelette")
    parser.add_argument('--os-requis', nargs='*', default=[], dest='required_bones')
    parser.add_argument('--animation-requise', nargs='*', default=[], dest='required_actions')
    parser.add_argument('--actions-min', type=int, default=1, dest='minimum_actions')
    parser.add_argument('--collection', nargs='*', default=[], dest='collections', help='collections exigées (.blend)')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None)
    source = args.input.resolve()
    destination = args.output_json.resolve()
    if source == destination:
        raise ValueError('Report must not overwrite input')
    kind = args.kind or ('blend' if source.suffix.lower() == '.blend' else 'rig')
    result = verify(source, kind, args.bones, args.required_bones, args.required_actions, args.minimum_actions,
                    args.collections)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({'status': result['status'], 'errors': result['errors'],
                      'seconds': result['seconds'], 'report': destination.name}, ensure_ascii=False), flush=True)
    sys.exit(1 if result['errors'] else 0)


if __name__ == '__main__':
    main()
