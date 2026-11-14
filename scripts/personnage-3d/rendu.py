"""Rendus de contrôle d'un personnage ou d'un élément rigide sans skin (véhicule, décor) : studio Cycles (vues
trois-quarts, portrait du personnage, échelles, isométrique), cadré sur la hauteur des meshes skinnés du personnage
ou sur la plus grande dimension de l'élément, et studio Workbench de QA. Le GLB source n'est jamais modifié.
`--silhouettes` pose, avant le rendu, les shape keys nommées sur tout mesh qui les porte, à la syntaxe de
`npm run godot:evaluer -- --silhouettes` (`hotes/godot/asset/evaluer.mjs`) ; un nom qu'aucun mesh ne porte arrête le
rendu. Si le manifeste voisin de `--input` porte `gabarit.osDesSilhouettes`, chaque os de repos de la base est translaté
de son déplacement aux mêmes poids (`deplacements_des_os`), comme dans les hôtes : au repos, rien ne change ; sous un
clip, chaque os tourne autour de sa tête déplacée, et un rigide monté suit son os. Sous `corpulence`, la force de la
normal map de chaque surface de peau de ce manifeste suit son `reliefDeCorpulence` (`facteur_de_relief`, #4002).
`bornes` et `studio` cadrent et éclairent aussi la revue d'un véhicule (`vehicule/revue.py`).

Une tenue se rend montée sur sa base : `--input` est la base, chaque `--element` un GLB d'élément, chacun avec son manifeste
voisin (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json` d'un import), comme l'évaluateur. Les zones
que couvrent les éléments sont masquées sur la base, un rigide pend à l'os de même nom de la base, une pièce skinnée suit
son armature. `--preset` colore chaque surface à l'emplacement de palette que lui donne son manifeste, de la couleur que
le preset de personnage (`src/data/presets-de-personnage.json`) y pose au nuancier (`src/data/materials.json`) ; `--clip`
pose la base à l'image `--image` d'un de ses clips, sans quoi elle reste au repos. `--illustration` pose l'illustration
directrice à gauche des vues de face, de trois-quarts et de dos dans `planche.png` : un rendu se montre à côté d'elle.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <fichier.glb> --output <dossier vide> [--isometric-only] [--silhouettes feminin=1,corpulence=0.5]
    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <base.glb> --element <a.glb> [--element <b.glb>] \\
        --preset sorcier [--clip Hampe_Repos_Loop --image 20] [--illustration <illustration.png>] --output <dossier vide>
"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from glb import lire_glb  # noqa: E402
from noms_silhouettes import CORPULENCE  # noqa: E402

DONNEES = Path(__file__).resolve().parents[2] / 'src' / 'data'
ETENDUE_DU_STUDIO = 1.82
"""L'étendue, en mètres, pour laquelle les puissances des lumières du studio sont réglées : la hauteur du corps de la
base humanoïde. Les lumières se placent à des distances proportionnelles à l'étendue du modèle ; leur puissance suit son
carré, pour que l'éclairement d'un modèle ne dépende pas de sa taille."""


def lire_silhouettes(texte):
    """Les poids de `--silhouettes`, `nom=poids[,nom=poids]` : {nom: poids}."""
    poids = {}
    for paire in texte.split(','):
        nom, egal, valeur = paire.partition('=')
        try:
            nombre = float(valeur)
        except ValueError:
            nombre = math.nan
        if not nom or nom.strip() != nom or not egal or '=' in valeur or not math.isfinite(nombre):
            raise argparse.ArgumentTypeError(f'« {paire} » ; attendu nom=<nombre>[,nom=<nombre>]')
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


def chemin_du_manifeste_voisin(glb):
    """Le chemin du manifeste à côté de `glb` : `<id>.element.json` d'un dossier de production, sinon
    `<id>.manifeste.json` ; `None` sans l'un ni l'autre."""
    return next((c for c in (glb.with_name(glb.stem + s) for s in ('.element.json', '.manifeste.json')) if c.exists()), None)


def manifeste_voisin(glb):
    """Le manifeste à côté de `glb` (`chemin_du_manifeste_voisin`), exigé."""
    chemin = chemin_du_manifeste_voisin(glb)
    if chemin is None:
        raise ValueError(f'{glb} : ni {glb.stem}.element.json ni {glb.stem}.manifeste.json à côté')
    return json.loads(chemin.read_text(encoding='utf-8'))


def matrice_du_noeud(noeud):
    """La matrice 4×4 du nœud glTF `noeud` dans le repère de son parent (`matrix`, sinon `translation`, `rotation`,
    `scale`)."""
    import numpy as np
    if 'matrix' in noeud:
        return np.array(noeud['matrix'], dtype=float).reshape(4, 4).T
    x, y, z, w = noeud.get('rotation', (0, 0, 0, 1))
    rotation = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    matrice = np.eye(4)
    matrice[:3, :3] = rotation * np.array(noeud.get('scale', (1, 1, 1)), dtype=float)
    matrice[:3, 3] = noeud.get('translation', (0, 0, 0))
    return matrice


def deplacements_des_os(document, os_des_silhouettes, poids):
    """Par nom de nœud du document glTF `document`, le déplacement (repère du monde glTF) de sa position de repos sous
    les translations locales `os_des_silhouettes` (`gabarit.osDesSilhouettes` : silhouette → os → `[x, y, z]` dans le
    repère du parent, au poids 1) aux `poids` des silhouettes : celui de son parent plus la somme pondérée de ses
    translations tournée par le repère du monde de repos de son parent. Seuls les nœuds déplacés y sont."""
    import numpy as np
    noeuds = document.get('nodes', [])
    enfants = {e for n in noeuds for e in n.get('children', [])}
    deplacements = {}
    pile = [(i, np.eye(3), np.zeros(3)) for i in range(len(noeuds)) if i not in enfants]
    while pile:
        i, repere_du_parent, du_parent = pile.pop()
        noeud = noeuds[i]
        translation = sum((poids.get(s, 0) * np.array(par_os[noeud['name']], dtype=float)
                           for s, par_os in os_des_silhouettes.items() if noeud.get('name') in par_os), np.zeros(3))
        deplacement = du_parent + repere_du_parent @ translation
        if deplacement.any() and 'name' in noeud:
            deplacements[noeud['name']] = deplacement
        repere = repere_du_parent @ matrice_du_noeud(noeud)[:3, :3]
        pile.extend((e, repere, deplacement) for e in noeud.get('children', []))
    return deplacements


def deplacer_les_os(bpy, rig, deplacements):
    """Translate la tête et la queue de chaque os de repos de `rig` du déplacement que `deplacements` (repère du monde
    glTF, `deplacements_des_os`) donne à son nom, passé au repère Blender (Y haut glTF vers Z haut) puis à celui de
    l'armature."""
    from mathutils import Vector
    vers_le_rig = rig.matrix_world.inverted().to_3x3()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for os_ in rig.data.edit_bones:
        if os_.name in deplacements:
            x, y, z = deplacements[os_.name]
            decalage = vers_le_rig @ Vector((x, -z, y))
            os_.head += decalage
            os_.tail += decalage
    bpy.ops.object.mode_set(mode='OBJECT')


def facteur_de_relief(manifeste, poids):
    """Le facteur de force de la normal map des surfaces de peau du `manifeste` de base aux `poids` des silhouettes
    (`reliefDeCorpulence`, #4002), `None` sans ce champ ou à poids de `corpulence` nul."""
    relief, corpulence = manifeste.get('reliefDeCorpulence'), poids.get(CORPULENCE, 0)
    return None if relief is None or corpulence == 0 else 1 - corpulence + relief * corpulence


def accuser_le_relief(objets, peaux, facteur):
    """Multiplie par `facteur` la force (`Strength`) de chaque nœud Normal Map des matériaux des `objets` dont le nom
    est dans `peaux`, chaque matériau une fois."""
    materiaux = {slot.material for obj in objets if obj.type == 'MESH' for slot in obj.material_slots
                 if slot.material and slot.material.node_tree and slot.material.name.split('.')[0] in peaux}
    for materiau in materiaux:
        for noeud in materiau.node_tree.nodes:
            if noeud.type == 'NORMAL_MAP':
                noeud.inputs['Strength'].default_value *= facteur


def importer(bpy, glb):
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    return [obj for obj in bpy.data.objects if obj not in avant]


def monter(bpy, base, rig, elements):
    """Monte sur la base (ses objets `base`, son armature `rig`) chaque `(objets importés, manifeste)` d'`elements` :
    les meshes de la base dans une zone qu'un élément couvre sont masqués, un rigide pend à l'os de même nom de `rig`
    à la même position locale, une pièce skinnée suit `rig` ; les armatures des éléments et les meshes sans matériau
    (forme d'os de l'import) sont masqués."""
    couvre = {zone for _, manifeste in elements for zone in manifeste.get('couvre', [])}
    for obj in base:
        if obj.type == 'MESH' and obj.get('zone') in couvre:
            obj.hide_render = True
    for objets, _ in elements:
        for obj in objets:
            if obj.type == 'ARMATURE' or (obj.type == 'MESH' and not obj.data.materials):
                obj.hide_render = True
            elif obj.type == 'MESH' and obj.parent_type == 'BONE':
                porteur, os_ = obj.parent, obj.parent_bone
                local = (porteur.matrix_world @ porteur.data.bones[os_].matrix_local).inverted() @ obj.matrix_world
                obj.parent, obj.parent_type, obj.parent_bone = rig, 'BONE', os_
                bpy.context.view_layer.update()
                obj.matrix_world = rig.matrix_world @ rig.data.bones[os_].matrix_local @ local
            elif obj.type == 'MESH':
                for mod in obj.modifiers:
                    if mod.type == 'ARMATURE':
                        mod.object = rig


def palette_du_preset(id_):
    """`{emplacement: couleur linéaire (r, g, b)}` du preset de personnage `id_`, résolue au nuancier."""
    preset = next((p for p in json.loads((DONNEES / 'presets-de-personnage.json').read_text(encoding='utf-8')) if p['id'] == id_), None)
    if preset is None:
        raise ValueError(f'--preset {id_} : aucun preset de personnage de cet id')
    nuancier = {m['id']: m['color'] for m in json.loads((DONNEES / 'materials.json').read_text(encoding='utf-8')) if m.get('domain') == 'couleur'}

    def lineaire(hexa):
        return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in (int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)))
    return {slot: lineaire(nuancier[couleur['id']]) for slot, couleur in preset.get('couleurs', {}).items()}


def colorer(objets, surfaces, palette):
    """Pose sur la couleur de base de chaque matériau des `objets` la couleur de `palette` à l'emplacement que lui donne
    `surfaces` (`{nom du matériau: emplacement}`) ; un matériau sans emplacement ou dont la palette ne colore pas
    l'emplacement garde la sienne."""
    for obj in objets:
        for slot in obj.material_slots if obj.type == 'MESH' else []:
            couleur = palette.get(surfaces.get(slot.material.name.split('.')[0])) if slot.material else None
            principled = next((n for n in slot.material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if couleur else None
            if principled:
                principled.inputs['Base Color'].default_value = (*couleur, 1)


def planche(bpy, chemins, sortie):
    """Les images `chemins` côte à côte, chacune ramenée à la hauteur de la première vue rendue, dans `sortie`."""
    import numpy as np
    images = [bpy.data.images.load(str(c)) for c in chemins]
    hauteur = images[1].size[1]
    for image in images:
        largeur, haut = image.size
        if haut != hauteur:
            image.scale(round(largeur * hauteur / haut), hauteur)
    pixels = [np.array(image.pixels[:], dtype=np.float32).reshape(hauteur, image.size[0], 4) for image in images]
    fond = np.array([0.16, 0.18, 0.21, 1.0], dtype=np.float32)
    pixels[0] = pixels[0] * pixels[0][..., 3:] + fond * (1 - pixels[0][..., 3:])
    tout = np.concatenate(pixels, axis=1)
    resultat = bpy.data.images.new('planche', tout.shape[1], hauteur)
    resultat.pixels.foreach_set(tout.ravel())
    resultat.filepath_raw = str(sortie)
    resultat.file_format = 'PNG'
    resultat.save()


def bornes(bpy, objets):
    """Les coins bas et haut de l'emprise des sommets évalués des `objets`, dans le monde."""
    import numpy as np
    from mathutils import Vector
    from mesure import world_vertices
    bpy.context.view_layer.update()
    coordinates = np.concatenate(list(world_vertices(bpy, objets).values()))
    return Vector(coordinates.min(axis=0).tolist()), Vector(coordinates.max(axis=0).tolist())


def studio(bpy, low, center, extent, output, start):
    """Studio Cycles de contrôle, à l'échelle de l'étendue `extent` du modèle : monde, sol sous `low`, trois lumières
    visant `center` (`ETENDUE_DU_STUDIO`), caméra orthographique ; rend la fonction qui rend une vue dans `output`."""
    from mathutils import Vector
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
        lamp.energy = power * (extent / ETENDUE_DU_STUDIO) ** 2
        lamp.shape = 'DISK'
        lamp.size = size
        lamp.color = color
        obj = bpy.data.objects.new(name, lamp)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (center - obj.location).to_track_quat('-Z', 'Y').to_euler()

    area('Key', (extent * 1.4, -extent * 1.7, extent * 2.2), 500, extent * 1.5, (1, 0.93, 0.85))
    area('Fill', (-extent * 1.5, -extent * 0.6, extent * 1.3), 240, extent * 1.6, (0.82, 0.9, 1))
    area('Back', (extent * 0.5, extent * 1.5, extent * 1.8), 350, extent * 1.1, (1, 1, 1))
    camera_data = bpy.data.cameras.new('StudioCamera')
    camera = bpy.data.objects.new('StudioCamera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.lens = 70

    def render(name, direction, target, scale, width, image_height):
        camera.location = target + Vector(direction).normalized() * extent * 4
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera_data.ortho_scale = scale
        scene.render.resolution_x = width
        scene.render.resolution_y = image_height
        scene.render.filepath = str(output / name)
        bpy.ops.render.render(write_still=True)
        print('RENDERED', name, round(time.monotonic() - start, 2), flush=True)

    return render


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
    parser.add_argument('--element', action='append', default=[], help='GLB d\'élément monté sur la base --input')
    parser.add_argument('--preset', help='id du preset de personnage dont la palette colore les surfaces')
    parser.add_argument('--clip', help='clip de la base posé avant le rendu')
    parser.add_argument('--image', type=int, default=1, help='image du clip posée')
    parser.add_argument('--illustration', type=Path, help='illustration directrice posée à gauche de planche.png')
    args = parser.parse_args()
    source = Path(args.input).resolve(strict=True)
    output = Path(args.output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError('Output must be new or empty')
    output.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    import bpy
    from mathutils import Vector
    start = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    base = importer(bpy, source)
    chemin = chemin_du_manifeste_voisin(source)
    manifeste_de_base = {} if chemin is None else json.loads(chemin.read_text(encoding='utf-8'))
    deplacements = deplacements_des_os(lire_glb(source)[0], manifeste_de_base.get('gabarit', {}).get('osDesSilhouettes', {}),
                                       args.silhouettes)
    if args.element or args.preset or args.clip or deplacements:
        rigs = [obj for obj in base if obj.type == 'ARMATURE']
        if len(rigs) != 1:
            raise ValueError(f'{source} : {len(rigs)} armatures, une attendue pour monter, colorer, poser ou déplacer les os')
        rig = rigs[0]
        if deplacements:
            deplacer_les_os(bpy, rig, deplacements)
        elements = [(importer(bpy, Path(glb).resolve(strict=True)), manifeste_voisin(Path(glb))) for glb in args.element]
        monter(bpy, base, rig, elements)
        if args.preset:
            manifestes = [manifeste_voisin(source)] + [manifeste for _, manifeste in elements]
            colorer(bpy.data.objects, {s['nom']: s['palette'] for m in manifestes for s in m.get('surfaces', [])},
                    palette_du_preset(args.preset))
        if args.clip:
            action = bpy.data.actions.get(args.clip)
            if action is None:
                raise ValueError(f'--clip {args.clip} : clips de la base {sorted(a.name for a in bpy.data.actions)}')
            rig.animation_data_create()
            rig.animation_data.action = action
            if action.slots:
                rig.animation_data.action_slot = action.slots[0]
            bpy.context.scene.frame_set(args.image)
    silhouettes = poser_les_silhouettes(bpy, args.silhouettes)
    relief = facteur_de_relief(manifeste_de_base, args.silhouettes)
    if relief is not None:
        accuser_le_relief(base, {s['nom'] for s in manifeste_de_base.get('surfaces', []) if s['palette'] == 'peau'}, relief)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]
    skinned = [obj for obj in meshes if any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
    actors = skinned or meshes
    if not actors:
        raise ValueError('No meshes found')
    low, high = bornes(bpy, actors)
    height = high.z - low.z
    extent = height if skinned else max(high.x - low.x, high.y - low.y, height)
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
    report = {'input': source.name, 'sha256_before': digest, 'bounds': {'min': list(low), 'max': list(high), 'height': height, 'extent': extent}, 'meshes': [{'name': obj.name, 'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons), 'materials': [slot.material.name if slot.material else None for slot in obj.material_slots]} for obj in actors], 'materials': materials, 'silhouettes': {nom: {'poids': args.silhouettes[nom], 'meshes': objets} for nom, objets in silhouettes.items()}, 'render_engine': 'CYCLES', 'samples': 16}
    render = studio(bpy, low, center, extent, output, start)
    if args.isometric_only:
        report['camera_elevation_degrees'] = 45
        report['camera_direction'] = [1, -1, 2 ** 0.5]
        for size in (512, 40, 64, 128):
            render('isometrique-' + str(size) + 'px.png', (1, -1, 2 ** 0.5), center, extent * 1.12, size, size)
    else:
        render('face-trois-quarts.png', (0.65, -1, 0.17), center, extent * 1.12, 1000, 1200)
        render('dos-trois-quarts.png', (-0.65, 1, 0.17), center, extent * 1.12, 1000, 1200)
        if skinned:
            render('face.png', (0, -1, 0.05), center, extent * 1.12, 1000, 1200)
            render('dos.png', (0, 1, 0.05), center, extent * 1.12, 1000, 1200)
            if args.illustration:
                planche(bpy, [args.illustration.resolve(strict=True)] + [output / v for v in ('face.png', 'face-trois-quarts.png', 'dos.png')],
                        output / 'planche.png')
            portrait_target = Vector((center.x, center.y, low.z + height * 0.86))
            render('portrait.png', (0.3, -1, 0.05), portrait_target, height * 0.32, 768, 768)
        for size in (40, 64, 128):
            render('echelle-' + str(size) + 'px.png', (0.65, -1, 0.17), center, extent * 1.12, round(size * 1000 / 1200), size)
    report['elapsed_seconds'] = time.monotonic() - start
    report['sha256_after'] = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != report['sha256_after']:
        raise RuntimeError('Source changed')
    (output / 'render-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('DONE', output, flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == '__main__':
    main()
