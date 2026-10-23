"""Mesures de maillage, normalisation des influences de peau et préparation des textures de jeu (dans bpy)."""
import hashlib
import math
from pathlib import Path

INFLUENCES_MAX = 4
"""Influences d'os par sommet d'une peau de jeu : un seul jeu JOINTS_0/WEIGHTS_0 glTF."""
IMAGES_PAR_SECONDE = 24
"""Cadence des clips que la chaîne produit et échantillonne."""


def world_vertices(bpy, objects):
    """Sommets évalués (déformés) de chaque objet, en coordonnées monde : {nom: tableau (n, 3)}."""
    import numpy as np
    result = {}
    graph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        coords = np.empty(len(mesh.vertices) * 3, dtype=np.float64)
        mesh.vertices.foreach_get('co', coords)
        matrix = np.array(evaluated.matrix_world, dtype=np.float64)
        result[obj.name] = coords.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
        evaluated.to_mesh_clear()
    return result


def material_modes(obj, key):
    masked = key in ('hair_short', 'hair_swept', 'eyebrows')
    for material in obj.data.materials:
        material.use_backface_culling = not masked
        for node in material.node_tree.nodes:
            if node.type != 'BSDF_PRINCIPLED':
                continue
            socket = node.inputs['Alpha']
            sources = [link.from_socket for link in socket.links]
            for link in list(socket.links):
                material.node_tree.links.remove(link)
            socket.default_value = 1.
            if masked and sources:
                clip = material.node_tree.nodes.new('ShaderNodeMath')
                clip.operation = 'GREATER_THAN'
                clip.inputs[1].default_value = .45
                material.node_tree.links.new(sources[0], clip.inputs[0])
                material.node_tree.links.new(clip.outputs[0], socket)


def prepare_game_textures(objects, output):
    import bpy
    import numpy as np
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    cache, records, touched = {}, [], set()
    def endpoints(node, visited=None):
        visited = set() if visited is None else visited
        if node in visited:
            return set()
        visited.add(node)
        result = set()
        for socket in node.outputs:
            for link in socket.links:
                if link.to_node.type in ('BSDF_PRINCIPLED', 'NORMAL_MAP', 'BUMP'):
                    result.add((link.to_node.type, link.to_socket.name))
                result.update(endpoints(link.to_node, visited))
        return result
    def alpha_range(image):
        pixels = np.empty(len(image.pixels), dtype=np.float32)
        image.pixels.foreach_get(pixels)
        alpha = pixels.reshape((-1, image.channels))[:, 3] if image.channels == 4 else np.ones(1)
        return [float(alpha.min()), float(alpha.max())]
    for obj in objects:
        component = obj.get('component_id', '')
        cap = 2048 if component in ('body', 'head_a', 'head_b') else 1024
        masked = component in ('hair_short', 'hair_swept', 'eyebrows')
        for material in obj.data.materials:
            if not material or material.as_pointer() in touched:
                continue
            touched.add(material.as_pointer())
            for node in list(material.node_tree.nodes):
                if node.type != 'TEX_IMAGE' or not node.image:
                    continue
                usage = endpoints(node)
                if not usage:
                    material.node_tree.nodes.remove(node)
                    continue
                normal = any(kind in ('NORMAL_MAP', 'BUMP') for kind, socket in usage)
                image = node.image
                source = Path(bpy.path.abspath(image.filepath)).resolve()
                source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
                key = (source_hash, 2048 if normal else cap, normal, masked)
                if key not in cache:
                    size = list(image.size)
                    before_alpha = alpha_range(image)
                    factor = min(1., key[1] / max(size))
                    target_size = [max(1, round(value * factor)) for value in size]
                    copy = image.copy()
                    copy.name = 'game_' + image.name
                    copy.colorspace_settings.name = 'Non-Color' if normal else 'sRGB'
                    if target_size != size:
                        copy.scale(*target_size)
                    file_format = 'PNG' if normal or masked else 'JPEG'
                    target = output / (source_hash[:14] + ('_normal' if normal else '_alpha' if masked else '_color') + ('.png' if file_format == 'PNG' else '.jpg'))
                    if target.exists() or target == source:
                        raise ValueError(f'Texture output collision: {target}')
                    copy.file_format = file_format
                    copy.filepath_raw = str(target)
                    copy.save(quality=90)
                    after_alpha = alpha_range(copy)
                    encoded = target.read_bytes()
                    copy.pack(data=encoded, data_len=len(encoded))
                    if bytes(copy.packed_file.data) != encoded:
                        raise ValueError(f'Optimized packed texture differs from saved image: {target}')
                    if hashlib.sha256(source.read_bytes()).hexdigest() != source_hash:
                        raise ValueError(f'Source image changed: {source}')
                    record = {'source': str(source), 'source_sha256_before': source_hash, 'source_sha256_after': source_hash,
                              'source_dimensions': size, 'source_alpha_range': before_alpha, 'dimensions': target_size,
                              'alpha_range': after_alpha if file_format == 'PNG' else [1., 1.], 'format': file_format, 'quality': 90 if file_format == 'JPEG' else None,
                              'path': str(target), 'bytes': target.stat().st_size, 'normal': normal, 'alpha_required': masked,
                              'colorspace': copy.colorspace_settings.name, 'source_channels': image.channels,
                              'encoded_channels': 3 if file_format == 'JPEG' else copy.channels,
                              'source_gpu_rgba8': size[0] * size[1] * 4, 'gpu_rgba8': target_size[0] * target_size[1] * 4}
                    records.append(record)
                    cache[key] = copy
                node.image = cache[key]
    before = sum(record['source_gpu_rgba8'] for record in records)
    after = sum(record['gpu_rgba8'] for record in records)
    return {'images': records, 'gpu_rgba8_before': before, 'gpu_rgba8_after': after,
            'gpu_rgba8_with_mips_before': round(before * 4 / 3), 'gpu_rgba8_with_mips_after': round(after * 4 / 3),
            'encoded_texture_bytes': sum(record['bytes'] for record in records)}


def normalize_deform_influences(obj, armature, maximum=INFLUENCES_MAX):
    deform_names = {bone.name for bone in armature.data.bones if bone.use_deform}
    groups = {group.index: group for group in obj.vertex_groups if group.name in deform_names}
    report = {"vertices": len(obj.data.vertices), "maximum": maximum,
              "discarded_weight_total": 0.0, "discarded_fraction_max": 0.0,
              "vertices_trimmed": 0, "unweighted_vertices": [], "max_influences": 0,
              "max_sum_error": 0.0, "finite": True}
    for vertex in obj.data.vertices:
        values = [(entry.group, float(entry.weight)) for entry in vertex.groups
                  if entry.group in groups and entry.weight > 0]
        if any(not math.isfinite(weight) for _, weight in values):
            raise ValueError(f"Non-finite skin weight: {obj.name}/{vertex.index}")
        values.sort(key=lambda item: (-item[1], item[0]))
        total = sum(weight for _, weight in values)
        kept, dropped = values[:maximum], values[maximum:]
        discarded = sum(weight for _, weight in dropped)
        report["discarded_weight_total"] += discarded
        report["discarded_fraction_max"] = max(report["discarded_fraction_max"], discarded / total if total else 0)
        report["vertices_trimmed"] += bool(dropped)
        for index, _ in values:
            groups[index].remove([vertex.index])
        retained = sum(weight for _, weight in kept)
        if not retained:
            report["unweighted_vertices"].append(vertex.index)
            continue
        for index, weight in kept:
            groups[index].add([vertex.index], weight / retained, 'REPLACE')
        report["max_influences"] = max(report["max_influences"], len(kept))
        report["max_sum_error"] = max(report["max_sum_error"], abs(sum(weight / retained for _, weight in kept) - 1))
    if report["unweighted_vertices"]:
        raise ValueError(f"Unweighted deform vertices in {obj.name}: {report['unweighted_vertices'][:16]}")
    for group in list(obj.vertex_groups):
        if group.name not in deform_names:
            obj.vertex_groups.remove(group)
    return report


def mesh_measurement(obj, evaluated=False):
    if evaluated:
        import bpy
        owner = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = owner.to_mesh()
    else:
        owner, mesh = obj, obj.data
    try:
        mesh.calc_loop_triangles()
        points = [owner.matrix_world @ vertex.co for vertex in mesh.vertices]
        bounds = {"min": [min(point[i] for point in points) for i in range(3)],
                  "max": [max(point[i] for point in points) for i in range(3)]} if points else None
        return {"vertices": len(mesh.vertices), "triangles": len(mesh.loop_triangles),
                "polygons": len(mesh.polygons), "uv_layers": list(mesh.uv_layers.keys()),
                "submeshes": [{"material_index": index,
                               "triangles": sum(t.material_index == index for t in mesh.loop_triangles)}
                              for index in range(len(mesh.materials))], "bounds_world": bounds}
    finally:
        if evaluated:
            owner.to_mesh_clear()
