"""Base humanoïde (#2972, lots B1 à B3) : le squelette UAL (65 os), le corps UBC skinné dessus et découpé en zones, les
clips UAL1 + UAL2, les emplacements et les prises (`anatomie.py`).

Le corps UBC porte les 65 os d'UAL1, mêmes noms et même hiérarchie, sur son propre repos : ce repos est gardé, et chaque
clip s'y joue relatif au repos (les clés Blender de l'import glTF). Pistes de position retirées hors `root` et `pelvis`,
interpolation LINEAR. Au repos, le sommet le plus bas des peaux est posé au sol de la racine (`poser_au_sol`), et les
poids sont lissés là où un clip étire la peau (`poids.py`), puis chaque clip est posé au sol et la marche plantée
(`sol.py`) ; un clip sans sol (pelvis source sous le sol) se retire. La part du manifeste de base que pose la construction
(os, chaînes, zones, emplacements, prises, silhouettes, table du gabarit, pieds, os à position animée) passe, après
l'export, à `manifeste.mjs`, qui complète le manifeste avec la déclaration du corps `humanoide.json` et écrit le dossier
de production du GLB (`production.ts`) ; il juge déclaration, sortie hors dépôt et licences des packs avant Blender.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py \\
        --ual1 <UAL1_Standard.glb> --ual2 <UAL2_Standard.glb> --corps <Superhero_Male_FullBody.gltf> --sortie <humanoide.glb>
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ICI = Path(__file__).resolve().parent
DECLARATION = ICI / 'humanoide.json'
"""La déclaration du corps : `base`, porteur de référence et clips de marche."""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anatomie import PIEDS, gabarit, poser  # noqa: E402
from animation import assign_action, clear_animation, meshes_for  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from pistes import sacs  # noqa: E402
from poids import lisser_les_poids  # noqa: E402
from sol import bas_des_sources, poser_les_clips_au_sol, retirer_sans_sol  # noqa: E402

PELVIS = 'pelvis'
OS_A_POSITION = ('root', PELVIS)
"""Os dont la piste de position reste : la racine et le pelvis."""
TOLERANCE_DOUBLON = 1e-5
"""Écart maximal entre les clés de deux clips homonymes pour les tenir pour le même clip."""


def importer(bpy, chemin):
    """Importe un glTF ; rend son armature au repos, ses autres objets et ses actions neuves."""
    objets, actions = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=str(chemin), bone_heuristic='BLENDER')
    neufs = [o for o in bpy.data.objects if o not in objets]
    rig = next(o for o in neufs if o.type == 'ARMATURE')
    clear_animation(rig)
    return rig, [o for o in neufs if o is not rig], [a for a in bpy.data.actions if a not in actions]


def resoudre_images(bpy, chemin):
    """Une image que le glTF `chemin` appelle par une uri absente se lit au fichier de son `name`, à côté de lui : le kit
    UBC exporte des uris `<name>_png.png` sans toujours livrer leur copie. Sans ce fichier, la construction s'arrête."""
    if chemin.suffix != '.gltf':
        return
    noms = {i['uri']: i['name'] for i in json.loads(chemin.read_text(encoding='utf-8')).get('images', []) if 'uri' in i}
    for image in bpy.data.images:
        fichier = Path(bpy.path.abspath(image.filepath))
        if image.source != 'FILE' or image.packed_file or fichier.is_file():
            continue
        repli = chemin.parent / noms.get(fichier.name, '')
        if fichier.parent != chemin.parent or not noms.get(fichier.name) or not repli.is_file():
            raise RuntimeError(f'image « {image.name} » : {fichier} absent, et aucun fichier à son nom glTF')
        image.filepath = str(repli)
        image.reload()
        print('IMAGE', fichier.name, '->', repli.name, flush=True)


def poser_au_sol(bpy, rig, peaux):
    """Monte les os sous la racine et les peaux de la hauteur qui pose, au repos, le sommet le plus bas des peaux sur le
    sol (z = 0) ; les racines restent au sol, et aucun sommet ne doit en dépendre."""
    racines = {b.name for b in rig.data.bones if b.parent is None}
    for peau in peaux:
        portees = {g.index for g in peau.vertex_groups if g.name in racines}
        if any(g.group in portees and g.weight > 0 for v in peau.data.vertices for g in v.groups):
            raise RuntimeError(f'{peau.name} : sommet porté par une racine {sorted(racines)}, que le sol ne monte pas')
    hauteur = -min((peau.matrix_world @ v.co).z for peau in peaux for v in peau.data.vertices)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    montee = rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, hauteur))
    for os in rig.data.edit_bones:
        if os.parent:
            os.translate(montee)
    bpy.ops.object.mode_set(mode='OBJECT')
    for peau in peaux:
        peau.data.transform(Matrix.Translation(peau.matrix_world.inverted().to_3x3() @ Vector((0, 0, hauteur))))
    print('SOL monté de', round(hauteur, 6), 'm', flush=True)


def hierarchie(rig):
    return {b.name: b.parent.name if b.parent else None for b in rig.data.bones}


def cles(action):
    return {(c.data_path, c.array_index): [tuple(k.co) for k in c.keyframe_points] for sac in sacs(action) for c in sac.fcurves}


def meme_clip(a, b):
    """Vrai si deux actions portent les mêmes courbes aux mêmes clés, à `TOLERANCE_DOUBLON` près."""
    ca, cb = cles(a), cles(b)
    return ca.keys() == cb.keys() and all(
        len(ca[k]) == len(cb[k]) and all(abs(x - y) <= TOLERANCE_DOUBLON for p, q in zip(ca[k], cb[k]) for x, y in zip(p, q))
        for k in ca)


def fusionner(bpy, clips, autres):
    """Ajoute `autres` à `clips` ; un homonyme (suffixé `.001` à l'import) identique se retire, différent s'arrête."""
    noms = {a.name for a in clips}
    for action in autres:
        nom = action.name.rsplit('.', 1)[0]
        if action.name not in noms and nom in noms:
            if not meme_clip(bpy.data.actions[nom], action):
                raise RuntimeError(f'collision de clip « {nom} » : UAL1 et UAL2 diffèrent')
            print('COLLISION', nom, ': identique à', TOLERANCE_DOUBLON, 'près, gardé une fois', flush=True)
            bpy.data.actions.remove(action)
            continue
        clips.append(action)
    return clips


def preparer(action):
    """Retire les pistes de position hors `OS_A_POSITION` et passe toute clé en LINEAR."""
    for sac in sacs(action):
        for courbe in list(sac.fcurves):
            chemin = courbe.data_path
            os_courbe = chemin.split('"')[1] if chemin.startswith('pose.bones["') else None
            if chemin.endswith('.location') and os_courbe not in OS_A_POSITION:
                sac.fcurves.remove(courbe)
                continue
            for cle in courbe.keyframe_points:
                cle.interpolation = 'LINEAR'
    action.use_fake_user = True


def os_a_position_animee(rig, clips, racine):
    """Les os de `rig`, hors `racine`, dont un clip garde une piste de position, dans l'ordre du squelette."""
    animes = {c.data_path.split('"')[1] for action in clips for sac in sacs(action) for c in sac.fcurves
              if c.data_path.startswith('pose.bones["') and c.data_path.endswith('.location')}
    return [b.name for b in rig.data.bones if b.name in animes and b.name != racine]


def silhouettes(peaux):
    """Les shape keys des peaux, hors leur clé de référence, dans l'ordre de première rencontre."""
    noms = []
    for peau in peaux:
        cles_de_forme = peau.data.shape_keys
        for cle in cles_de_forme.key_blocks if cles_de_forme else ():
            if cle != cles_de_forme.reference_key and cle.name not in noms:
                noms.append(cle.name)
    return noms


def manifeste_mjs(args, *options, entree=None):
    """Lance `manifeste.mjs` sur la sortie et les packs sources de `args` : `--verifier` juge déclaration, sortie et
    licences avant la construction ; sans lui, la part `entree` complète le dossier de production."""
    node = shutil.which('node')
    if not node:
        raise RuntimeError('node introuvable : le manifeste de base se complète par manifeste.mjs')
    sources = [a for s in ('ual1', 'ual2', 'corps') for a in (f'--{s}', str(getattr(args, s)))]
    subprocess.run([node, str(ICI / 'manifeste.mjs'), str(DECLARATION), str(args.sortie), *sources, *options],
                   input=entree, text=True, encoding='utf-8', check=True)


def construire(args):
    import bpy
    manifeste_mjs(args, '--verifier')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
    rig1, figurants1, clips = importer(bpy, args.ual1)
    rig2, figurants2, clips2 = importer(bpy, args.ual2)
    squelette, objets, _ = importer(bpy, args.corps)
    resoudre_images(bpy, args.corps)
    reference = hierarchie(rig1)
    if len(reference) != args.os:
        raise RuntimeError(f'{args.ual1.name} : {len(reference)} os, {args.os} attendus')
    for nom, rig in ((args.ual2.name, rig2), (args.corps.name, squelette)):
        if hierarchie(rig) != reference:
            raise RuntimeError(f'{nom} : noms ou parents d\'os différents de {args.ual1.name}')
    peaux = meshes_for(bpy, squelette)
    sources = {**bas_des_sources(rig1, meshes_for(bpy, rig1), clips, PELVIS),
               **bas_des_sources(rig2, meshes_for(bpy, rig2), clips2, PELVIS)}
    for objet in [rig1, rig2, *figurants1, *figurants2, *[o for o in objets if o not in peaux]]:
        if objet in objets:
            print('RETIRE', objet.name, '(hors peau du corps)', flush=True)
        bpy.data.objects.remove(objet, do_unlink=True)
    clips = retirer_sans_sol(fusionner(bpy, clips, clips2), sources, PELVIS)
    for action in clips:
        preparer(action)
    poser_au_sol(bpy, squelette, peaux)
    lisser_les_poids(squelette, peaux, clips)
    poser_les_clips_au_sol(squelette, peaux, clips, sources, PIEDS, gabarit(squelette)['racine'], PELVIS,
                           json.loads(DECLARATION.read_text(encoding='utf-8'))['clipsDeMarche'])
    formes = silhouettes(peaux)
    manifeste = poser(squelette, peaux)
    manifeste = {'os': [b.name for b in squelette.data.bones], 'chaines': {}, **manifeste, 'silhouettes': formes,
                 'osAPositionAnimee': os_a_position_animee(squelette, clips, manifeste['gabarit']['racine'])}
    for image in bpy.data.images:
        if image.has_data:
            image.pack()
    assign_action(squelette, clips[0])
    args.sortie.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.sortie), export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=False,
                              export_optimize_animation_size=False, export_extras=True)
    print('CLIPS', len(clips), 'OS', len(manifeste['os']), 'ZONES', len(manifeste['zones']),
          'EMPLACEMENTS', len(manifeste['emplacements']), 'SILHOUETTES', len(formes),
          'POSITION', manifeste['osAPositionAnimee'], flush=True)
    manifeste_mjs(args, entree=json.dumps(manifeste, ensure_ascii=False))
    print('HUMANOIDE_OK', args.sortie, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ual1', type=Path, required=True, help='UAL1_Standard.glb : squelette de référence et clips')
    parser.add_argument('--ual2', type=Path, required=True, help='UAL2_Standard.glb : clips sur le même squelette')
    parser.add_argument('--corps', type=Path, required=True, help="corps UBC (.gltf/.glb) skinné aux os d'UAL")
    parser.add_argument('--sortie', type=Path, required=True, help='humanoide.glb produit')
    parser.add_argument('--os', type=int, default=65, help="nombre d'os du squelette UAL")
    construire(parser.parse_args())


if __name__ == '__main__':
    main()
