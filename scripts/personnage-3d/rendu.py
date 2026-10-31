"""Rendus de contrôle d'un personnage : studio Cycles (vues trois-quarts, portrait, échelles, isométrique) et studio
Workbench de QA. Le GLB source n'est jamais modifié. `--silhouettes` prend uniquement les silhouettes de la table
`SILHOUETTES` de la construction (`base/silhouettes.py`) et les pose, avant le rendu, sur tout mesh qui les porte,
à la syntaxe de `npm run godot:evaluer -- --silhouettes` (`hotes/godot/asset/evaluer.mjs`) ; un nom qu'aucun mesh
ne porte arrête le rendu.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <fichier.glb> --output <dossier vide> [--isometric-only] [--silhouettes feminin=1,corpulence=0.5]
"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))


def lire_silhouettes(texte):
    """Les poids de `--silhouettes`, `nom=poids[,nom=poids]` : {nom: poids}."""
    from silhouettes import SILHOUETTES
    poids = {}
    for paire in texte.split(','):
        nom, egal, valeur = paire.partition('=')
        try:
            nombre = float(valeur)
        except ValueError:
            nombre = math.nan
        if not nom or nom.strip() != nom or not egal or '=' in valeur or not math.isfinite(nombre):
            raise argparse.ArgumentTypeError(f'« {paire} » ; attendu nom=<nombre>[,nom=<nombre>]')
        if nom not in SILHOUETTES:
            raise argparse.ArgumentTypeError(f'--silhouettes : « {nom} » n’est pas une silhouette de la construction')
        poids[nom] = nombre
    return poids


def poser_les_silhouettes(bpy, poids):
    """Pose chaque shape key de `poids` à son poids sur tout mesh de la scène qui la porte ; un nom qu'aucun mesh ne
    porte arrête le rendu."""
    poses = {nom: [] for nom in poids}
    for obj in bpy.context.scene.objects:
        cles = obj.data.shape_keys if obj.type == 'MESH' else None
        for nom, valeur in poids.items():
            cle = cles.key_blocks.get(nom) if cles else None
            if cle is None:
                continue
            cle.slider_min, cle.slider_max = min(cle.slider_min, valeur), max(cle.slider_max, valeur)
            cle.value = valeur
            poses[nom].append(obj.name)
    absentes = sorted(nom for nom, objets in poses.items() if not objets)
    if absentes:
        raise ValueError(f'--silhouettes : {absentes} portée(s) par aucun mesh')
    return poses


def qa_studio(bpy):
    from mathutils import Vector
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'TEXTURE'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.world = bpy.data.worlds.new('QA world')
    scene.world.color = (.13, .13, .13)
    scene.render.resolution_x, scene.render.resolution_y = 640, 720
    scene.render.resolution_percentage = 100
    camera_data = bpy.data.cameras.new('QA camera')
    camera = bpy.data.objects.new('QA camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (2.6, -4.8, 2.2)
    camera.rotation_euler = (Vector((0, 0, .9)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type, camera_data.ortho_scale = 'ORTHO', 2.6
    scene.camera = camera
    return camera


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--isometric-only', action='store_true', help='Render only 45-degree overhead views at 512, 40, 64 and 128 pixels high')
    parser.add_argument('--silhouettes', type=lire_silhouettes, default={},
                        help='nom=poids[,nom=poids] : shape keys posées sur tout mesh qui les porte avant le rendu')
    args = parser.parse_args()
    source = Path(args.input).resolve(strict=True)
    output = Path(args.output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output must be new or empty')
    output.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    import bpy
    import numpy as np
    from mathutils import Vector
    from mesure import world_vertices
    start = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source))
    silhouettes = poser_les_silhouettes(bpy, args.silhouettes)
    actors = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
    if not actors:
        raise ValueError('No skinned character meshes found')
    bpy.context.view_layer.update()
    coordinates = np.concatenate(list(world_vertices(bpy, actors).values()))
    low = Vector(coordinates.min(axis=0).tolist())
    high = Vector(coordinates.max(axis=0).tolist())
    height = high.z - low.z
    center = (low + high) / 2
    materials = []
    for material in bpy.data.materials:
        inputs = []
        images = []
        if material.node_tree:
            for node in material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    images.append({'node': node.name, 'image': node.image.name, 'size': list(node.image.size), 'alpha_mode': node.image.alpha_mode, 'color_space': node.image.colorspace_settings.name})
                if node.type == 'BSDF_PRINCIPLED':
                    for key in ('Base Color', 'Metallic', 'Roughness', 'Alpha', 'Normal'):
                        socket = node.inputs[key]
                        value = socket.default_value
                        inputs.append({'input': key, 'value': list(value) if hasattr(value, '__len__') else value, 'links': [{'node': link.from_node.name, 'socket': link.from_socket.name} for link in socket.links]})
        materials.append({'name': material.name, 'surface_render_method': material.surface_render_method, 'images': images, 'inputs': inputs})
    report = {'input': source.name, 'sha256_before': digest, 'bounds': {'min': list(low), 'max': list(high), 'height': height}, 'meshes': [{'name': obj.name, 'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons), 'materials': [slot.material.name if slot.material else None for slot in obj.material_slots]} for obj in actors], 'materials': materials, 'silhouettes': {nom: {'poids': args.silhouettes[nom], 'meshes': objets} for nom, objets in silhouettes.items()}, 'render_engine': 'CYCLES', 'samples': 16}
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.render.image_settings.file_format = 'PNG'
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    world = bpy.data.worlds.new('Studio')
    background = next(node for node in world.node_tree.nodes if node.type == 'BACKGROUND')
    background.inputs['Color'].default_value = (0.32, 0.35, 0.40, 1)
    background.inputs['Strength'].default_value = 0.45
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, low.z - 0.005))
    floor = bpy.context.object
    floor.name = 'studio_floor'
    floor_material = bpy.data.materials.new('studio_floor_material')
    floor_material.diffuse_color = (0.16, 0.18, 0.21, 1)
    floor.data.materials.append(floor_material)

    def area(name, location, power, size, color):
        lamp = bpy.data.lights.new(name, 'AREA')
        lamp.energy = power
        lamp.shape = 'DISK'
        lamp.size = size
        lamp.color = color
        obj = bpy.data.objects.new(name, lamp)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()

    area('Key', (height * 1.4, -height * 1.7, height * 2.2), 500, height * 1.5, (1, 0.93, 0.85))
    area('Fill', (-height * 1.5, -height * 0.6, height * 1.3), 240, height * 1.6, (0.82, 0.9, 1))
    area('Back', (height * 0.5, height * 1.5, height * 1.8), 350, height * 1.1, (1, 1, 1))
    camera_data = bpy.data.cameras.new('StudioCamera')
    camera = bpy.data.objects.new('StudioCamera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.lens = 70

    def render(name, direction, target, scale, width, image_height):
        camera.location = target + Vector(direction).normalized() * height * 4
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera_data.ortho_scale = scale
        scene.render.resolution_x = width
        scene.render.resolution_y = image_height
        scene.render.filepath = str(output / name)
        bpy.ops.render.render(write_still=True)
        print('RENDERED', name, round(time.monotonic() - start, 2), flush=True)

    if args.isometric_only:
        report['camera_elevation_degrees'] = 45
        report['camera_direction'] = [1, -1, 2 ** 0.5]
        for size in (512, 40, 64, 128):
            render('isometrique-' + str(size) + 'px.png', (1, -1, 2 ** 0.5), center, height * 1.12, size, size)
    else:
        render('face-trois-quarts.png', (0.65, -1, 0.17), center, height * 1.12, 1000, 1200)
        render('dos-trois-quarts.png', (-0.65, 1, 0.17), center, height * 1.12, 1000, 1200)
        portrait_target = Vector((center.x, center.y, low.z + height * 0.86))
        render('portrait.png', (0.3, -1, 0.05), portrait_target, height * 0.32, 768, 768)
        for size in (40, 64, 128):
            render('echelle-' + str(size) + 'px.png', (0.65, -1, 0.17), center, height * 1.12, round(size * 1000 / 1200), size)
    report['elapsed_seconds'] = time.monotonic() - start
    report['sha256_after'] = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != report['sha256_after']:
        raise RuntimeError('Source changed')
    (output / 'render-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('DONE', output, flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == '__main__':
    main()
