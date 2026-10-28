"""Base humanoïde (#2972, lots B1 et B2) : le squelette UAL (65 os), le corps UBC skinné dessus et découpé en zones, les
clips UAL1 + UAL2, les emplacements et les prises (`anatomie.py`).

Le corps UBC porte les 65 os d'UAL1, mêmes noms et même hiérarchie, sur son propre repos : ce repos est gardé, et chaque
clip s'y joue relatif au repos (les clés Blender de l'import glTF). Pistes de position retirées hors `root` et `pelvis`,
interpolation LINEAR. La part du manifeste de base que pose la construction (zones, emplacements, prises) s'écrit à
côté du GLB, dans `<sortie>.manifeste.json`.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py \\
        --ual1 <UAL1_Standard.glb> --ual2 <UAL2_Standard.glb> --corps <Superhero_Male_FullBody.gltf> --sortie <humanoide.glb>
"""
import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anatomie import poser  # noqa: E402
from animation import assign_action, clear_animation  # noqa: E402

OS_A_POSITION = ('root', 'pelvis')
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


def hierarchie(rig):
    return {b.name: b.parent.name if b.parent else None for b in rig.data.bones}


def sacs(action):
    """Les sacs de F-curves d'une action en couches (Blender 5)."""
    return [sac for couche in action.layers for bande in couche.strips for slot in action.slots
            if (sac := bande.channelbag(slot))]


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


def construire(args):
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rig1, figurants1, clips = importer(bpy, args.ual1)
    rig2, figurants2, clips2 = importer(bpy, args.ual2)
    squelette, objets, _ = importer(bpy, args.corps)
    reference = hierarchie(rig1)
    if len(reference) != args.os:
        raise RuntimeError(f'{args.ual1.name} : {len(reference)} os, {args.os} attendus')
    for nom, rig in ((args.ual2.name, rig2), (args.corps.name, squelette)):
        if hierarchie(rig) != reference:
            raise RuntimeError(f'{nom} : noms ou parents d\'os différents de {args.ual1.name}')
    peaux = [o for o in objets if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == squelette for m in o.modifiers)]
    for objet in [rig1, rig2, *figurants1, *figurants2, *[o for o in objets if o not in peaux]]:
        if objet in objets:
            print('RETIRE', objet.name, '(hors peau du corps)', flush=True)
        bpy.data.objects.remove(objet, do_unlink=True)
    clips = fusionner(bpy, clips, clips2)
    for action in clips:
        preparer(action)
    manifeste = poser(squelette, peaux)
    for image in bpy.data.images:
        if image.has_data:
            image.pack()
    assign_action(squelette, clips[0])
    args.sortie.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.sortie), export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=False,
                              export_optimize_animation_size=False, export_extras=True)
    chemin = args.sortie.with_suffix('.manifeste.json')
    chemin.write_text(json.dumps(manifeste, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print('CLIPS', len(clips), 'OS', len(squelette.data.bones), 'ZONES', len(manifeste['zones']),
          'EMPLACEMENTS', len(manifeste['emplacements']), 'MANIFESTE', chemin, flush=True)
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
