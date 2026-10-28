"""Normalisation de la pose de bind d'un personnage habillé, transfert de clips squelettiques sous licence vers son
squelette commun, et vérification par réimport. Un seul manifeste sort, `manifest.json` : `model`, `model_sha256`, les
rôles du jeu dans `clips`, les poses de production dans `production_clips`.

La correspondance avec le pack de clips source est une donnée (`--correspondance <fichier.json>`, celle du pack
KayKit : `correspondances/kaykit.json`) :
    bones             {os source: os du squelette commun}
    height_bones      [os source dont les sommets mesurent la hauteur du pack]
    clips             {rôle du jeu: nom du clip exporté}
    source_clips      {rôle du jeu: nom du clip source}
    production_clips  {nom du clip exporté: nom du clip source}, poses hors rôles (facultatif)

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/animation.py \\
        --input-glb <modulaire.glb> --source-glb <clips.glb> --correspondance <correspondance.json> \\
        --output <dossier vide> [--manifest <manifest du personnage>] [--os 53] [--licence-source <LICENSE.txt>]
    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/animation.py --verify <animated.glb> \\
        --manifest <manifest.json> [--os 53]
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys

from glb import lire_glb
from mesure import world_vertices
from pistes import aller_a, sacs
from rendu import qa_studio
from seuils import IMAGES_PAR_SECONDE, POIDS_NEGLIGEABLE, SOL_TOLERANCE_M

sys.dont_write_bytecode = True
FRACTIONS_QA = (.5, 1.)
"""Instants de chaque clip rendus dans les planches de QA, en fraction de sa durée."""
DELAI_VERIFICATION_S = 600
"""Durée maximale du processus de réimport qui vérifie l'export."""


def clips_a_cuire(correspondance):
    """[(nom exporté, nom source, rôle ou None)] : les rôles du jeu, puis les poses de production."""
    if set(correspondance['source_clips']) != set(correspondance['clips']):
        raise ValueError('source_clips and clips must name the same roles')
    roles =[(name, correspondance['source_clips'][role], role) for role, name in correspondance['clips'].items()]
    production = [(name, source, None) for name, source in correspondance.get('production_clips', {}).items()]
    names = [name for name, _, _ in roles + production]
    if len(set(names)) != len(names):
        raise ValueError(f'Exported clip names collide: {names}')
    return roles + production


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')


def meshes_for(bpy, rig):
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and
            any(m.type == 'ARMATURE' and m.object == rig for m in o.modifiers)]


def tetes(manifest):
    """Les têtes à parcourir : chaque `head_options`, ou `[None]` pour un personnage sans tête interchangeable.
    `default_head` vaut `None` si et seulement si `head_options` est vide, sinon il en est un `id`."""
    ids = [option['id'] for option in manifest['head_options']]
    defaut = manifest['default_head']
    if (defaut is None) != (not ids) or (defaut is not None and defaut not in ids):
        raise RuntimeError(f'default_head {defaut!r}: None if and only if head_options is empty, else one of {ids}')
    return ids or [None]


def combinaison(head, preset):
    """Le libellé d'une combinaison tête × preset, commun aux planches et au rapport de réimport."""
    return f'{head or "sans-tete"}-{preset}'


def manifest_selection(meshes, manifest, head=None, preset=None):
    if manifest is None:
        return list(meshes)
    tetes(manifest)
    selected_head = head or manifest['default_head']
    selected = set(manifest['presets'][preset]['components'] if preset else manifest['defaults'])
    selected.add('body')
    if selected_head is not None:
        selected.add(selected_head)
    objects = {obj.name: obj for obj in meshes}
    if set(objects) != {piece['node'] for piece in manifest['pieces'].values()}:
        raise RuntimeError('Manifest node set differs from the complete skinned mesh set')
    visible = []
    for piece in manifest['pieces'].values():
        active = (piece['component'] in selected and
                  (not piece.get('headVariant') or piece['headVariant'] == selected_head) and
                  not (set(piece.get('hiddenBy', [])) & selected))
        obj = objects[piece['node']]
        obj.hide_render = not active
        if active:
            visible.append(obj)
    return visible


def vertex_weights(obj, index):
    names = {group.index: group.name for group in obj.vertex_groups}
    return {names[group.group]: group.weight for group in obj.data.vertices[index].groups if group.weight > POIDS_NEGLIGEABLE}


def vertex_normals(obj, mesh=None, indices=None):
    import numpy as np
    mesh = mesh or obj.data
    normal_matrix = np.linalg.inv(np.array(obj.matrix_world)[:3, :3]).T
    normals = [[] for _ in mesh.vertices]
    for loop, normal in zip(mesh.loops, mesh.corner_normals):
        if indices is not None and loop.vertex_index not in indices:
            continue
        value = normal_matrix @ np.array(normal.vector)
        value /= np.linalg.norm(value)
        normals[loop.vertex_index].append(value)
    return normals


def normal_angle(a, b):
    import numpy as np
    return math.degrees(math.acos(float(np.clip(np.dot(a, b), -1., 1.))))


def skin_world_normal(rig, obj, index, normal):
    import numpy as np
    transformed = np.zeros(3)
    inverse_rig = rig.matrix_world.inverted()
    for name, weight in vertex_weights(obj, index).items():
        bone = rig.pose.bones[name]
        matrix = rig.matrix_world @ bone.matrix @ bone.bone.matrix_local.inverted() @ inverse_rig
        transformed += weight * (np.array(matrix)[:3, :3] @ normal)
    length = np.linalg.norm(transformed)
    if length < 1e-7:
        raise RuntimeError('Degenerate skinned normal')
    return transformed / length


def seam_contract(bpy, meshes, manifest):
    import numpy as np
    if manifest is None:
        return [], {}
    points = world_vertices(bpy, meshes)
    objects = {obj.name: obj for obj in meshes}
    normals = {name: vertex_normals(obj) for name, obj in objects.items()}
    lookup = {}
    for piece in manifest['pieces'].values():
        if piece['component'] != 'body':
            continue
        name = piece['node']
        for index, point in enumerate(points[name]):
            lookup.setdefault(tuple(np.round(point, 5)), []).append((name, index))
    pairs, report = [], {}
    for head in (option['id'] for option in manifest['head_options']):
        count, position_error, normal_error, weight_error = 0, 0., 0., 0.
        matches = []
        for piece in manifest['pieces'].values():
            if piece.get('headVariant') != head:
                continue
            name = piece['node']
            for index, point in enumerate(points[name]):
                candidates = lookup.get(tuple(np.round(point, 5)), [])
                if not candidates:
                    continue
                choices = []
                weights = vertex_weights(objects[name], index)
                for body_name, body_index in candidates:
                    body_weights = vertex_weights(objects[body_name], body_index)
                    weight_delta = max(abs(weights.get(key, 0.) - body_weights.get(key, 0.)) for key in weights.keys() | body_weights.keys())
                    normal_delta, body_normal_index, head_normal_index = min(
                        (normal_angle(a, b), bi, hi) for hi, a in enumerate(normals[name][index])
                        for bi, b in enumerate(normals[body_name][body_index]))
                    choices.append((weight_delta + normal_delta, body_name, body_index, weight_delta,
                                    normal_delta, body_normal_index, head_normal_index))
                _, body_name, body_index, weight_delta, normal_delta, body_normal_index, head_normal_index = min(choices)
                delta = float(np.linalg.norm(point - points[body_name][body_index]))
                pairs.append((head, body_name, body_index, name, index, body_normal_index, head_normal_index))
                matches.append({'body_node': body_name, 'body_vertex': body_index, 'head_node': name,
                                'head_vertex': index, 'body_corner_ordinal': body_normal_index,
                                'head_corner_ordinal': head_normal_index, 'position': point.tolist(),
                                'body_normal': normals[body_name][body_index][body_normal_index].tolist(),
                                'head_normal': normals[name][index][head_normal_index].tolist(),
                                'body_weights': vertex_weights(objects[body_name], body_index), 'head_weights': weights})
                count += 1
                position_error = max(position_error, delta)
                normal_error = max(normal_error, normal_delta)
                weight_error = max(weight_error, weight_delta)
        if count < 16 or position_error > 5e-5 or weight_error > .0001 or normal_error > .1:
            raise RuntimeError(f'Invalid neck seam {head}: {count}, {position_error}, {weight_error}, {normal_error}')
        report[head] = {'pairs': count, 'position_error_m': position_error,
                        'weight_error': weight_error, 'normal_error_degrees': normal_error, 'matches': matches}
    return pairs, report


def verify_combinations(bpy, rig, meshes, actions, manifest, pairs):
    import numpy as np
    results = {}
    objects = {obj.name: obj for obj in meshes}
    required = {}
    for variant, body, bi, part, pi, bn, hn in pairs:
        required.setdefault(body, set()).add(bi)
        required.setdefault(part, set()).add(pi)
    rest_normals = {name: vertex_normals(objects[name], indices=indices) for name, indices in required.items()}
    for head in tetes(manifest):
        for preset in manifest['presets']:
            visible = manifest_selection(meshes, manifest, head, preset)
            for alias, name in manifest['clips'].items():
                action = actions[name]
                assign_action(rig, action)
                start, end = action.frame_range
                samples = []
                for fraction in (0., .25, .5, .75, 1.):
                    frame = start + (end - start) * fraction
                    aller_a(bpy.context.scene, frame)
                    points = world_vertices(bpy, meshes)
                    seam_error = max((float(np.linalg.norm(points[body][bi] - points[part][pi]))
                                      for variant, body, bi, part, pi, bn, hn in pairs if variant == head), default=0.)
                    normal_maps = {}
                    graph = bpy.context.evaluated_depsgraph_get()
                    needed = {name for variant, body, bi, part, pi, bn, hn in pairs if variant == head for name in (body, part)}
                    for obj in meshes:
                        if obj.name in needed:
                            evaluated = obj.evaluated_get(graph)
                            mesh = evaluated.to_mesh()
                            normal_maps[obj.name] = vertex_normals(evaluated, mesh, required[obj.name])
                            evaluated.to_mesh_clear()
                    seam_normal = max((normal_angle(normal_maps[body][bi][bn], normal_maps[part][pi][hn])
                                       for variant, body, bi, part, pi, bn, hn in pairs if variant == head), default=0.)
                    skin_normal = max((normal_angle(skin_world_normal(rig, objects[body], bi, rest_normals[body][bi][bn]),
                                                    skin_world_normal(rig, objects[part], pi, rest_normals[part][pi][hn]))
                                       for variant, body, bi, part, pi, bn, hn in pairs if variant == head), default=0.)
                    floor = min(float(points[obj.name][:, 2].min()) for obj in visible)
                    passed = seam_error <= 5e-5 and floor >= -SOL_TOLERANCE_M and skin_normal <= .1
                    samples.append({'fraction': fraction, 'floor_m': floor, 'neck_seam_error_m': seam_error,
                                    'neck_seam_normal_degrees_lbs': skin_normal,
                                    'blender_modifier_neck_normal_degrees': seam_normal, 'passed': passed})
                results[f'{combinaison(head, preset)}/{alias}'] = {'visible': [obj.name for obj in visible], 'samples': samples}
    manifest_selection(meshes, manifest)
    return results

def clear_animation(rig):
    if rig.animation_data:
        rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()


def assign_action(rig, action):
    rig.animation_data_create()
    rig.animation_data.action = action
    if action.slots:
        rig.animation_data.action_slot = action.slots[0]


def normalize_bind(bpy, rig, meshes, diagnostic_output=None, pose_setup=None):
    import numpy as np
    from mathutils import Vector
    clear_animation(rig)
    ordered = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
    if pose_setup is not None:
        pose_setup(bpy, rig)
    else:
        for bone in ordered:
            if bone.name.startswith(('upperarm_', 'lowerarm_', 'hand_')):
                direction = Vector((1 if bone.name.endswith('_l') else -1, 0, 0))
                current = bone.matrix.to_quaternion()
                delta = (current @ Vector((0, 1, 0))).rotation_difference(direction)
                desired = (delta @ current).to_matrix().to_4x4()
                desired.translation = bone.matrix.translation
                bone.matrix = desired
                bpy.context.view_layer.update()
    before = world_vertices(bpy, meshes)
    graph = bpy.context.evaluated_depsgraph_get()
    normal_snapshots = {}
    for obj in meshes:
        evaluated = obj.evaluated_get(graph)
        evaluated_mesh = evaluated.to_mesh()
        normal_array = np.array([normal.vector[:] for normal in evaluated_mesh.corner_normals])
        lengths = np.linalg.norm(normal_array, axis=1)
        if np.any(lengths < 1e-7):
            raise RuntimeError(f'Zero evaluated corner normal: {obj.name}')
        normals = (normal_array / lengths[:, None]).tolist()
        evaluated.to_mesh_clear()
        replacement = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=graph)
        if len(replacement.vertices) != len(obj.data.vertices):
            raise RuntimeError('Bind normalization changed topology')
        if any(not vertex.groups for vertex in replacement.vertices):
            raise RuntimeError('Bind normalization lost vertex weights')
        replacement.normals_split_custom_set(normals)
        normal_snapshots[obj.name] = np.array(normals)
        obj.data = replacement
        for modifier in list(obj.modifiers):
            if modifier.type == 'ARMATURE':
                obj.modifiers.remove(modifier)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for obj in meshes:
        mod = obj.modifiers.new('Common skeleton', 'ARMATURE')
        mod.object = rig
    bpy.context.view_layer.update()
    after = world_vertices(bpy, meshes)
    errors = {name: float(np.max(np.linalg.norm(before[name] - after[name], axis=1))) for name in before}
    if max(errors.values()) > 5e-5:
        raise RuntimeError(f'Bind normalization moved vertices: {errors}')
    normal_errors = {}
    diagnostics = {}
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        normals = np.array([normal.vector[:] for normal in mesh.corner_normals])
        normals /= np.linalg.norm(normals, axis=1)[:, None]
        dots = np.sum(normal_snapshots[obj.name] * normals, axis=1)
        differences = np.degrees(np.arccos(np.clip(dots, -1., 1.)))
        normal_errors[obj.name] = float(np.max(differences))
        outliers = np.flatnonzero(differences > .2)
        diagnostics[obj.name] = {'loops': len(normals), 'outliers': len(outliers),
            'maximum': float(differences.max()), 'p99': float(np.percentile(differences, 99)),
            'samples': [{'loop': int(index), 'position': list(mesh.vertices[mesh.loops[index].vertex_index].co),
                         'expected': normal_snapshots[obj.name][index].tolist(), 'actual': normals[index].tolist()}
                        for index in outliers[:12]]}
        evaluated.to_mesh_clear()
    if diagnostic_output:
        write_json(diagnostic_output / 'bind-normal-diagnostic.json', {'unit': 'degrees', 'limit': .2, 'meshes': diagnostics})
    if max(normal_errors.values()) > .2:
        raise RuntimeError(f'Bind normalization changed normals: {normal_errors}')
    return errors, normal_errors


def verify(args):
    import bpy
    import numpy as np
    from verifier_export import verify as verifier_export
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    export = verifier_export(args.verify, 'rig', bones=args.os, clips=manifest['clips'].values())
    if export['errors']:
        raise RuntimeError(f"Export verification failed: {export['errors']}")
    rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    meshes = meshes_for(bpy, rig)
    pieces = manifest if 'pieces' in manifest else None
    visible = manifest_selection(meshes, pieces)
    actions = {a.name: a for a in bpy.data.actions}
    result = {'export': export, 'clips': {}}
    clear_animation(rig)
    bpy.context.view_layer.update()
    pairs, seam_report = seam_contract(bpy, meshes, pieces)
    result['rest_neck_seams'] = seam_report
    for name in [*manifest['clips'].values(), *manifest.get('production_clips', {})]:
        matches = [a for key, a in actions.items() if key == name]
        if len(matches) != 1:
            raise RuntimeError(f'Clip reimport ambiguity: {name}: {[a.name for a in matches]}')
        action = matches[0]
        assign_action(rig, action)
        start, end = action.frame_range
        low = np.inf
        samples = []
        for frame in np.linspace(start, end, 9):
            aller_a(bpy.context.scene, frame)
            floor = float(min(points[:, 2].min() for points in world_vertices(bpy, visible).values()))
            low = min(low, floor)
            samples.append({'frame': float(frame), 'min_z': floor})
        if low < -SOL_TOLERANCE_M:
            raise RuntimeError(f'Ground penetration exceeds {SOL_TOLERANCE_M} m: {name}: {low}')
        result['clips'][name] = {'range': list(action.frame_range), 'samples': samples}
    if pieces:
        result['combinations'] = verify_combinations(bpy, rig, meshes, actions, pieces, pairs)
    write_json(args.verify.parent / 'reimport-report.json', result)
    failures = [key for key, value in result.get('combinations', {}).items() if not all(sample['passed'] for sample in value['samples'])]
    if failures:
        raise RuntimeError(f'Combination verification failed: {failures}; see reimport-report.json')
    print('REIMPORT_OK', json.dumps({'bones': args.os, 'clips': len(result['clips'])}), flush=True)


def planche_qa(bpy, rig, actions, output, label):
    """Rend chaque clip aux FRACTIONS_QA et les assemble en une planche : une ligne par fraction, une colonne par clip."""
    import numpy as np
    scene = bpy.context.scene
    width, height = scene.render.resolution_x, scene.render.resolution_y
    rows = []
    for fraction in FRACTIONS_QA:
        row = []
        for name, action in actions.items():
            assign_action(rig, action)
            start, end = action.frame_range
            aller_a(scene, start + (end - start) * fraction)
            image_path = output / f'qa-{label}-{name}-{int(fraction * 100)}.png'
            scene.render.filepath = str(image_path)
            bpy.ops.render.render(write_still=True)
            image = bpy.data.images.load(str(image_path), check_existing=False)
            pixels = np.empty(width * height * 4, dtype=np.float32)
            image.pixels.foreach_get(pixels)
            row.append(pixels.reshape(height, width, 4))
            bpy.data.images.remove(image)
        rows.append(np.concatenate(row, axis=1))
    board = bpy.data.images.new(f'QA {label}', width=width * len(actions), height=height * len(rows), alpha=True)
    board.colorspace_settings.name = 'sRGB'
    board.pixels.foreach_set(np.concatenate(rows[::-1], axis=0).ravel())
    board.filepath_raw = str(output / f'qa-planche-{label}.png')
    board.file_format = 'PNG'
    board.save()
    bpy.data.images.remove(board)


def run(args):
    import bpy
    import numpy as np
    from mathutils import Matrix, Vector
    output = args.output
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(f'Output must be empty: {output}')
    correspondance = json.loads(args.correspondance.read_text(encoding='utf-8'))
    a_cuire = clips_a_cuire(correspondance)
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = IMAGES_PAR_SECONDE
    bpy.ops.import_scene.gltf(filepath=str(args.input_glb))
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    if len(rig.data.bones) != args.os:
        raise RuntimeError(f'Expected {args.os} bones: {len(rig.data.bones)}')
    meshes = meshes_for(bpy, rig)
    manifest = json.loads(args.manifest.read_text(encoding='utf-8')) if args.manifest else None
    for obj in meshes:
        obj.hide_set(False)
    ground_meshes = manifest_selection(meshes, manifest)
    errors, normal_errors = normalize_bind(bpy, rig, meshes, output)
    _, rest_seams = seam_contract(bpy, meshes, manifest)
    rest_vertices = world_vertices(bpy, meshes)
    all_points = np.concatenate(list(rest_vertices.values()))
    target_height = float((rig.matrix_world @ rig.data.bones['head'].tail_local).z -
                          (rig.matrix_world @ rig.data.bones['Root'].head_local).z)
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(args.source_glb))
    imported = set(bpy.data.objects) - existing
    source = next(o for o in imported if o.type == 'ARMATURE')
    source_actions = list(bpy.data.actions)
    clear_animation(source)
    bpy.context.view_layer.update()
    source_meshes = meshes_for(bpy, source)
    source_geometry = world_vertices(bpy, source_meshes)
    height_bones = set(correspondance['height_bones'])
    height_points = []
    for obj in source_meshes:
        groups = {group.index: group.name for group in obj.vertex_groups}
        indices = [vertex.index for vertex in obj.data.vertices if any(
            group.weight > .5 and groups[group.group] in height_bones for group in vertex.groups)]
        if indices:
            height_points.append(source_geometry[obj.name][indices])
    source_points = np.concatenate(height_points)
    ratio = target_height / float(np.ptp(source_points[:, 2]))
    source_rest = {b.name: source.matrix_world @ b.matrix_local for b in source.data.bones}
    target_rest = {b.name: rig.matrix_world @ b.matrix_local for b in rig.data.bones}
    inverse_map = {target: original for original, target in correspondance['bones'].items()}
    ordered = sorted(rig.pose.bones, key=lambda b: len(b.parent_recursive))
    baseline_floor = 0.
    report = {'normalization_error': errors, 'normalization_normal_error_degrees': normal_errors,
              'source_height_ratio': ratio, 'target_height_m': target_height,
              'target_height_basis': 'Common skeleton head tail minus Root head; independent of every mesh and equipment',
              'source_height_m': float(np.ptp(source_points[:, 2])),
              'source_height_basis': 'Head, torso and leg weighted vertices; arm and hand equipment excluded',
              'input_floor_m': float(all_points[:, 2].min()), 'animation_floor_m': baseline_floor, 'clips': {},
              'mapping': correspondance['bones'], 'rest_neck_seams': rest_seams,
              'all_skinned_meshes': len(meshes), 'default_visible_meshes': [obj.name for obj in ground_meshes],
              'limitations': ['Individual finger articulation inherits the target rest pose; source aggregate hand controls are not finger joints.']}
    baked = []
    for name, source_name, alias in a_cuire:
        candidates = [a for a in source_actions if a.name == source_name]
        if len(candidates) != 1:
            raise RuntimeError(f'Missing/ambiguous source action {name}: {[a.name for a in candidates]}')
        action = candidates[0]
        assign_action(source, action)
        clear_animation(rig)
        result = bpy.data.actions.new(name + '_TARGET')
        assign_action(rig, result)
        start, end = action.frame_range
        frames = range(int(math.floor(start)), int(math.ceil(end)) + 1)
        floor_corrections = []
        previous_rotations = {}
        for frame in frames:
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            for bone in ordered:
                rest = target_rest[bone.name]
                if bone.parent:
                    head = (rig.matrix_world @ bone.parent.matrix @
                            bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local).translation
                else:
                    head = rest.translation.copy()
                original = inverse_map.get(bone.name)
                if original:
                    src_rest = source_rest[original]
                    src_pose = source.matrix_world @ source.pose.bones[original].matrix
                    rotation = src_pose.to_quaternion() @ src_rest.to_quaternion().inverted() @ rest.to_quaternion()
                    if bone.name in ('Root', 'pelvis'):
                        delta = (src_pose.translation - src_rest.translation) * ratio
                        head.z += delta.z
                elif bone.parent:
                    parent_world = rig.matrix_world @ bone.parent.matrix
                    relative = bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
                    rotation = parent_world.to_quaternion() @ relative.to_quaternion()
                else:
                    rotation = rest.to_quaternion()
                bone.matrix = rig.matrix_world.inverted() @ Matrix.LocRotScale(head, rotation, Vector((1, 1, 1)))
                bpy.context.view_layer.update()
            points = world_vertices(bpy, ground_meshes)
            floor = min(float(p[:, 2].min()) for p in points.values())
            correction = baseline_floor - floor
            root = rig.pose.bones['Root']
            matrix = root.matrix.copy()
            matrix.translation += rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, correction))
            root.matrix = matrix
            floor_corrections.append(correction)
            for bone in ordered:
                bone.rotation_mode = 'QUATERNION'
                rotation = bone.rotation_quaternion.copy()
                if bone.name in previous_rotations:
                    rotation.make_compatible(previous_rotations[bone.name])
                    bone.rotation_quaternion = rotation
                previous_rotations[bone.name] = rotation.copy()
                bone.keyframe_insert(data_path='location', frame=frame)
                bone.keyframe_insert(data_path='rotation_quaternion', frame=frame)
                bone.keyframe_insert(data_path='scale', frame=frame)
        for bag in sacs(result):
            for curve in bag.fcurves:
                for key in curve.keyframe_points:
                    key.interpolation = 'LINEAR'
        ground_margins = {frame: 0. for frame in frames}
        for frame in list(frames)[:-1]:
            required = 0.
            for fraction in (.25, .5, .75):
                aller_a(scene, frame + fraction)
                points = world_vertices(bpy, ground_meshes)
                minimum = min(float(p[:, 2].min()) for p in points.values())
                required = max(required, -minimum + .0005)
            ground_margins[frame] = max(ground_margins[frame], required)
            ground_margins[frame + 1] = max(ground_margins[frame + 1], required)
        for frame, margin in ground_margins.items():
            if margin <= 0.:
                continue
            scene.frame_set(frame)
            root = rig.pose.bones['Root']
            matrix = root.matrix.copy()
            matrix.translation += rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, margin))
            root.matrix = matrix
            root.keyframe_insert(data_path='location', frame=frame)
        result.use_fake_user = True
        baked.append((name, result))
        report['clips'][name] = {'role': alias, 'source_clip': source_name,
                                 'frames': [min(frames), max(frames)],
                                 'interpolation_ground_margin_max_m': max(ground_margins.values()),
                                 'floor_correction_range': [min(floor_corrections), max(floor_corrections)]}
        print('BAKED', name, len(frames), flush=True)
    clear_animation(source)
    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in source_actions:
        bpy.data.actions.remove(action)
    for name, action in baked:
        action.name = name
    for image in bpy.data.images:
        if image.has_data:
            image.pack()
    clear_animation(rig)
    assign_action(rig, baked[0][1])
    scene.frame_set(int(baked[0][1].frame_range[0]))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [rig] + meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'animated.blend'))
    bpy.ops.export_scene.gltf(filepath=str(output / 'animated.glb'), export_format='GLB', use_selection=True,
                              export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=True, export_frame_range=False, export_extras=True)
    document, _ = lire_glb(output / 'animated.glb')
    if len(document['skins']) != 1 or len(document['skins'][0]['joints']) != args.os:
        raise RuntimeError(f"Expected one {args.os}-joint skin: {[len(s['joints']) for s in document['skins']]}")
    exported_names = [a['name'] for a in document.get('animations', [])]
    if sorted(exported_names) != sorted(name for name, _, _ in a_cuire):
        raise RuntimeError(f'Incorrect exported clips: {exported_names}')
    report['exported_clips'] = exported_names
    if manifest:
        exported_nodes = {node['name'] for node in document['nodes'] if 'skin' in node}
        if exported_nodes != {piece['node'] for piece in manifest['pieces'].values()}:
            raise RuntimeError('Export changed the stable skinned node set')
    published = dict(manifest) if manifest else {'schema_version': 1}
    published['model'] = 'animated.glb'
    published['model_sha256'] = hashlib.sha256((output / 'animated.glb').read_bytes()).hexdigest()
    published['clips'] = dict(correspondance['clips'])
    published['source_clips'] = dict(correspondance['source_clips'])
    if correspondance.get('production_clips'):
        published['production_clips'] = dict(correspondance['production_clips'])
    published['retarget'] = {'fps': IMAGES_PAR_SECONDE, 'root_motion': 'in_place',
                             'input_sha256': hashlib.sha256(args.input_glb.read_bytes()).hexdigest(),
                             'source_sha256': hashlib.sha256(args.source_glb.read_bytes()).hexdigest(),
                             'hands': 'Open rest fingers; no individual finger retarget', 'rest_neck_seams': rest_seams}
    if args.licence_source:
        published['license_source'] = {'file': args.licence_source.name,
                                       'sha256': hashlib.sha256(args.licence_source.read_bytes()).hexdigest()}
    write_json(output / 'manifest.json', published)
    write_json(output / 'animation-report.json', report)
    qa_studio(bpy)
    actions = dict(baked)
    if manifest:
        for head in tetes(manifest):
            for preset in manifest['presets']:
                manifest_selection(meshes, manifest, head, preset)
                planche_qa(bpy, rig, actions, output, combinaison(head, preset))
        manifest_selection(meshes, manifest)
    else:
        planche_qa(bpy, rig, actions, output, 'defaut')
    verification_command = [sys.executable, '-E', '-s', '-X', 'utf8', '-u', str(Path(__file__).resolve()),
                            '--verify', str(output / 'animated.glb'), '--os', str(args.os),
                            '--manifest', str(output / 'manifest.json')]
    verification = subprocess.run(verification_command, timeout=DELAI_VERIFICATION_S, check=False)
    if verification.returncode:
        raise RuntimeError(f'Reimport process failed: {verification.returncode}')
    print('RETARGET_OK', output, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-glb', type=Path)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--source-glb', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--verify', type=Path)
    parser.add_argument('--os', type=int, default=53, help="nombre d'os du squelette commun")
    parser.add_argument('--correspondance', type=Path, help='correspondance JSON avec le pack de clips source')
    parser.add_argument('--licence-source', type=Path, help='licence des clips sources, consignée par nom et empreinte')
    args = parser.parse_args()
    if args.verify:
        if not args.manifest:
            parser.error('--verify requires --manifest')
        verify(args)
    else:
        if not all((args.input_glb, args.source_glb, args.correspondance, args.output)):
            parser.error('--input-glb, --source-glb, --correspondance and --output are required')
        run(args)


if __name__ == '__main__':
    main()
