"""Selected-source surface baking with explicit target UVs and ray coverage measurements."""
from pathlib import Path


def bake_surface(bpy, target, donors, output, identity, resolution=2048, cage_extrusion=.012,
                 ray_distance=.06, roughness=.72):
    from mathutils.bvhtree import BVHTree
    import numpy as np
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    if not target.data.uv_layers.active:
        raise ValueError('Target requires its own UV layout')
    if not donors or target in donors:
        raise ValueError('Separate high resolution donors are required')
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.use_cage = False
    scene.render.bake.normal_space = 'TANGENT'
    scene.render.bake.cage_extrusion = cage_extrusion
    scene.render.bake.max_ray_distance = ray_distance
    scene.render.bake.margin = 12
    material = bpy.data.materials.new(identity + '_material')
    material.use_backface_culling = True
    target.data.materials.clear()
    target.data.materials.append(material)
    nodes = material.node_tree.nodes
    shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Roughness'].default_value = roughness
    points, faces = [], []
    for donor in donors:
        offset = len(points)
        points.extend(donor.matrix_world @ v.co for v in donor.data.vertices)
        faces.extend([i + offset for i in p.vertices] for p in donor.data.polygons)
    tree = BVHTree.FromPolygons(points, faces)
    nearest, ray_hits = [], 0
    target.data.update()
    normal_matrix = target.matrix_world.to_3x3().inverted().transposed()
    for vertex in target.data.vertices:
        point = target.matrix_world @ vertex.co
        normal = (normal_matrix @ vertex.normal).normalized()
        hit = tree.ray_cast(point + normal * cage_extrusion, -normal, ray_distance + cage_extrusion)
        ray_hits += int(hit[0] is not None)
        close = tree.find_nearest(point)
        if close[0] is not None:
            nearest.append(close[3])
    result = {'method': 'Cycles selected-to-active EMIT of temporary source Base Color shader and tangent NORMAL; target-owned UVs',
        'target': target.name, 'donors': [o.name for o in donors], 'resolution': resolution,
        'cage_extrusion_m': cage_extrusion, 'ray_distance_m': ray_distance,
        'vertex_ray_hits': ray_hits, 'vertex_samples': len(target.data.vertices),
        'vertex_ray_fraction': ray_hits / max(1, len(target.data.vertices)),
        'nearest_surface_m': {'max': max(nearest, default=0.), 'p95': float(np.percentile(nearest, 95)) if nearest else None},
        'coverage_limit': 'Vertex rays are a geometric probe, not a per-texel coverage proof; inspect baked surface views.', 'textures': []}
    for kind in ('color', 'normal'):
        image = bpy.data.images.new(identity + '_' + kind, width=resolution, height=resolution, alpha=False)
        image.generated_color = (.32, .19, .12, 1.) if kind == 'color' else (.5, .5, 1., 1.)
        image.colorspace_settings.name = 'sRGB' if kind == 'color' else 'Non-Color'
        node = nodes.new('ShaderNodeTexImage')
        node.image = image
        nodes.active = node
        bpy.ops.object.select_all(action='DESELECT')
        target.hide_set(False)
        target.select_set(True)
        bpy.context.view_layer.objects.active = target
        for donor in donors:
            donor.hide_set(False)
            donor.select_set(True)
        scene.render.bake.use_pass_direct = False
        scene.render.bake.use_pass_indirect = False
        scene.render.bake.use_pass_color = True
        print('BAKE_START', identity, kind, flush=True)
        backups, copies = [], []
        try:
            if kind == 'color':
                for donor in donors:
                    for slot in donor.material_slots:
                        original = slot.material
                        if not original:
                            raise ValueError('Base Color bake requires a source material')
                        copy = original.copy()
                        copies.append(copy)
                        backups.append((slot, original))
                        slot.material = copy
                        source_shader = next((n for n in copy.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                        if source_shader is None:
                            raise ValueError('Source material has no Principled Base Color')
                        emission = copy.node_tree.nodes.new('ShaderNodeEmission')
                        base = source_shader.inputs['Base Color']
                        if base.is_linked:
                            copy.node_tree.links.new(base.links[0].from_socket, emission.inputs['Color'])
                        else:
                            emission.inputs['Color'].default_value = base.default_value
                        output_node = next(n for n in copy.node_tree.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output)
                        copy.node_tree.links.new(emission.outputs['Emission'], output_node.inputs['Surface'])
            bpy.ops.object.bake(type='EMIT' if kind == 'color' else 'NORMAL')
        finally:
            for slot, original in backups:
                slot.material = original
            restored = all(slot.material == original for slot, original in backups)
            for copy in copies:
                bpy.data.materials.remove(copy)
            if not restored:
                raise RuntimeError('Donor material slots were not restored')
            if kind == 'color':
                result['source_material_slots_restored'] = restored
        path = output / (identity + '_' + kind + '.png')
        image.filepath_raw, image.file_format = str(path), 'PNG'
        image.save()
        image.pack()
        if kind == 'color':
            material.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
        else:
            normal = nodes.new('ShaderNodeNormalMap')
            material.node_tree.links.new(node.outputs['Color'], normal.inputs['Color'])
            material.node_tree.links.new(normal.outputs['Normal'], shader.inputs['Normal'])
        result['textures'].append({'kind': kind, 'file': path.name, 'resolution': resolution})
        print('BAKE_DONE', identity, kind, flush=True)
    return result
