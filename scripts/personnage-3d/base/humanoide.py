"""Base humanoïde (#2972, lots B1 à B3) : le squelette UAL (65 os), le corps UBC skinné dessus et découpé en zones, les
clips UAL1 + UAL2, les emplacements et les prises (`anatomie.py`), les silhouettes (`silhouettes.py`).

Le corps UBC porte les 65 os d'UAL1, mêmes noms et même hiérarchie, sur son propre repos : ce repos est gardé, et chaque
clip s'y joue relatif au repos (les clés Blender de l'import glTF). Pistes de position retirées hors `root` et `pelvis`,
interpolation LINEAR ; un clip sans sol (pelvis source sous le sol) se retire. Au repos, le sommet le plus bas des peaux
est posé au sol de la racine (`poser_au_sol`).

Puis, plan de #3101 (issuecomment-6535025119), depuis les clips d'avant sol (`sol.figer`, `sol.restaurer`) :
- les poids sont lissés au neutre contre les clips d'avant sol (`poids.py`) ;
- sur ces poids se posent les silhouettes du corps (`silhouettes.py`), recalculées des donneurs : le corps F d'UBC, aux
  mêmes os, donne la clé `feminin` ; la carrure se pose aux bornes de `st` de la donnée, publiées dans `gabarit.st` ;
  MakeHuman (données de MPFB) donne `corpulence` (`corpulence.py`) ; chaque clé finie passe aux peaux secondaires ;
- chaque clip est posé au sol et la marche plantée (`sol.py`) ;
- les poids sont lissés là où un clip posé étire la peau, au neutre comme à chaque clé à 1 (`poids.py`) ; un sommet
  retouché d'une surface de pied arrête la construction (`sol.garder_les_poids_des_pieds`). Les poids sont figés ;
- les silhouettes se recalculent des donneurs sur ces poids, puis se tiennent au sol (`tenue_au_sol.tenir_au_sol`).

La part du manifeste de base que pose la construction (os, chaînes, zones, emplacements, prises, silhouettes, table du
gabarit, pieds, os à position animée) passe, après l'export, à `manifeste.mjs`, qui complète le manifeste avec la
déclaration du corps `humanoide.json` et écrit le dossier de production du GLB (`production.ts`) ; il juge
déclaration, sortie hors dépôt et textes de licence nommés des packs avant Blender.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/humanoide.py \\
        --ual1 <UAL1_Standard.glb> --ual2 <UAL2_Standard.glb> --corps <Superhero_Male_FullBody.gltf> \\
        --corps-feminin <Superhero_Female_FullBody.gltf> --licence-ual1 <License.txt> --licence-ual2 <License.txt> \\
        --licence-corps <License_Standard.txt> --licence-corps-feminin <License_Standard.txt> \\
        --mpfb <dossier data de MPFB> --licence-mpfb <LICENSE.ASSETS.md> --sortie <humanoide.glb>
"""
import argparse
import json
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
from script_node import lancer  # noqa: E402
from corpulence import ajouter_corpulence  # noqa: E402
from poids import lisser_les_poids, matrices_de_peau, peau_lineaire  # noqa: E402
from silhouettes import SILHOUETTES, ajouter_feminin_et_carrure, bornes_de_st, corps_et_secondaires, finir_les_silhouettes  # noqa: E402
from sol import (bas_des_sources, deplacements, figer, garder_les_poids_des_pieds, poser_les_clips_au_sol,  # noqa: E402
                 restaurer, retirer_sans_sol, surfaces_des_pieds)
from tenue_au_sol import tenir_au_sol  # noqa: E402
from cuisson_gabarit import bornes_du_gabarit, cuire_gabarit, preparer_reference, sauver_reference  # noqa: E402
from porte_gabarit import verifier_gabarit  # noqa: E402

PELVIS = 'pelvis'
OS_A_POSITION = ('root', PELVIS)
"""Os dont la piste de position reste : la racine et le pelvis."""
PACKS = ('ual1', 'ual2', 'corps', 'corps_feminin', 'mpfb')
"""Les packs sources tracés au dossier de production, chacun avec son texte de licence (`production.ts`)."""
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
        peau.data.transform(Matrix.Translation(peau.matrix_world.inverted().to_3x3() @ Vector((0, 0, hauteur))),
                            shape_keys=True)
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
    """Les silhouettes de la construction présentes sur les peaux, dans l'ordre de première rencontre."""
    noms = []
    for peau in peaux:
        cles_de_forme = peau.data.shape_keys
        for cle in cles_de_forme.key_blocks if cles_de_forme else ():
            if cle != cles_de_forme.reference_key and cle.name in SILHOUETTES and cle.name not in noms:
                noms.append(cle.name)
    return noms


def manifeste_mjs(args, *options, entree=None):
    """Lance `manifeste.mjs` sur la sortie et les packs sources de `args` : `--verifier` juge déclaration, sortie et
    licences avant la construction ; sans lui, la part `entree` complète le dossier de production."""
    sources = [a for s in PACKS for o in (s, f'licence_{s}') for a in (f'--{o.replace("_", "-")}', getattr(args, o))]
    print(lancer(ICI / 'manifeste.mjs', [DECLARATION, args.sortie, *sources, *options], entree), end='', flush=True)


def construire(args):
    import bpy
    manifeste_mjs(args, '--verifier')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
    rig1, figurants1, clips = importer(bpy, args.ual1)
    rig2, figurants2, clips2 = importer(bpy, args.ual2)
    squelette, objets, _ = importer(bpy, args.corps)
    resoudre_images(bpy, args.corps)
    squelette_f, objets_f, _ = importer(bpy, args.corps_feminin)
    reference = hierarchie(rig1)
    if len(reference) != args.os:
        raise RuntimeError(f'{args.ual1.name} : {len(reference)} os, {args.os} attendus')
    for nom, rig in ((args.ual2.name, rig2), (args.corps.name, squelette), (args.corps_feminin.name, squelette_f)):
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
    figee = {a.name: figer(a) for a in clips}
    poser_au_sol(bpy, squelette, peaux)
    lisser_les_poids(squelette, peaux, clips, {p.name: {} for p in peaux})
    corps, secondaires = corps_et_secondaires(peaux)
    corps_f, _ = corps_et_secondaires(meshes_for(bpy, squelette_f))
    bornes = bornes_de_st()
    racine = gabarit(squelette)['racine']
    marches = json.loads(DECLARATION.read_text(encoding='utf-8'))['clipsDeMarche']
    noms = [b.name for b in squelette.data.bones]

    def poser_les_silhouettes():
        clear_animation(squelette)
        bpy.context.view_layer.update()
        for action in clips:
            restaurer(action, figee[action.name])
        ajouter_feminin_et_carrure(squelette, corps, squelette_f, corps_f, bornes)
        ajouter_corpulence(squelette, corps, args.mpfb)
        return finir_les_silhouettes(squelette, corps, secondaires, bornes)

    def poser_les_clips():
        for action in clips:
            restaurer(action, figee[action.name])
        poser_les_clips_au_sol(squelette, peaux, clips, sources, PIEDS, racine, PELVIS, marches)

    def surfaces():
        return {p.name: surfaces_des_pieds(squelette, peau_lineaire(p, noms)[1], PIEDS) for p in peaux}

    poser_les_silhouettes()
    poser_les_clips()
    avant = surfaces()
    retouches = lisser_les_poids(squelette, peaux, clips, {p.name: deplacements(p) for p in peaux})
    apres = surfaces()
    for peau in peaux:
        garder_les_poids_des_pieds(peau.name, retouches[peau.name],
                                   {pied: avant[peau.name][pied] | apres[peau.name][pied] for pied in PIEDS})
    print('POIDS figés :', sum(map(len, retouches.values())), 'sommet(s) retouché(s) contre les clips posés ;',
          ' '.join(f'{nom}:{len(s)}' for nom, s in retouches.items()), flush=True)
    refinir, mesurer = poser_les_silhouettes()
    for objet in [squelette_f, *objets_f]:
        bpy.data.objects.remove(objet, do_unlink=True)

    def poser_au_sol_des_clips():
        poser_les_clips()
        return matrices_de_peau(squelette, clips)[1]

    tours = tenir_au_sol(poser_au_sol_des_clips, mesurer, refinir)
    print('SOL tenu en', tours, 'tour(s)', flush=True)
    clear_animation(squelette)
    bpy.context.view_layer.update()
    table = {**gabarit(squelette), 'st': bornes, 'bornes': bornes_du_gabarit()}
    print('GABARIT_ANATOMIE_OK table disjointe ; head sans enfants', flush=True)
    print('GABARIT_BORNES', json.dumps(table['bornes']), flush=True)
    references = cuire_gabarit(squelette, peaux, table)
    formes = silhouettes(peaux)
    manifeste = poser(squelette, peaux)
    manifeste['gabarit'] = table
    manifeste = {'os': [b.name for b in squelette.data.bones], 'chaines': {}, **manifeste, 'silhouettes': formes,
                 'osAPositionAnimee': os_a_position_animee(squelette, clips, manifeste['gabarit']['racine'])}
    clear_animation(squelette)
    bpy.context.view_layer.update()
    reference = preparer_reference(meshes_for(bpy, squelette), references)
    if args.preuve_gabarit:
        sauver_reference(args.preuve_gabarit, reference)
    for image in bpy.data.images:
        if image.has_data:
            image.pack()
    assign_action(squelette, clips[0])
    args.sortie.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.sortie), export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=False,
                              export_optimize_animation_size=False, export_extras=True,
                              export_morph_normal=True, export_attributes=True, export_try_sparse_sk=False)
    verifier_gabarit(args.sortie, reference)
    print('CLIPS', len(clips), 'OS', len(manifeste['os']), 'ZONES', len(manifeste['zones']),
          'EMPLACEMENTS', len(manifeste['emplacements']), 'SILHOUETTES', formes, 'ST', bornes,
          'POSITION', manifeste['osAPositionAnimee'], flush=True)
    manifeste_mjs(args, entree=json.dumps(manifeste, ensure_ascii=False))
    print('HUMANOIDE_OK', args.sortie, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ual1', type=Path, required=True, help='UAL1_Standard.glb : squelette de référence et clips')
    parser.add_argument('--ual2', type=Path, required=True, help='UAL2_Standard.glb : clips sur le même squelette')
    parser.add_argument('--corps', type=Path, required=True, help="corps UBC (.gltf/.glb) skinné aux os d'UAL")
    parser.add_argument('--corps-feminin', type=Path, required=True,
                        help="corps UBC féminin (.gltf/.glb) aux mêmes os : source de la clé `feminin`")
    for pack in PACKS:
        option = pack.replace('_', '-')
        parser.add_argument(f'--licence-{option}', type=Path, required=True,
                            help=f'texte de licence du pack de --{option}, dans un dossier ancêtre de la source')
    parser.add_argument('--mpfb', type=Path, required=True,
                        help='dossier `data` de MPFB (3dobjs, targets) : donneur de la clé `corpulence`')
    parser.add_argument('--sortie', type=Path, required=True, help='humanoide.glb produit')
    parser.add_argument('--os', type=int, default=65, help="nombre d'os du squelette UAL")
    parser.add_argument('--preuve-gabarit', type=Path, help='archive des oracles H5 directs, hors dossier de production')
    construire(parser.parse_args())


if __name__ == '__main__':
    main()
