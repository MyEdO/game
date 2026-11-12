"""#2972 ; #3101 issuecomment-6535025119 ; #3104 issuecomment-6549354475 ; #3188."""
import argparse
import json
import sys
from pathlib import Path
from contextlib import ExitStack

sys.dont_write_bytecode = True
ICI = Path(__file__).resolve().parent
DECLARATION = ICI / 'humanoide.json'
"""La déclaration du corps : `base`, porteur de référence et table rôle → clip, dont `marche`, la marche plantée."""
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anatomie import PIEDS, gabarit, poser, reperes_des_prises  # noqa: E402
from deux_mains import deriver as deriver_a_deux_mains  # noqa: E402
from animation import assign_action, clear_animation, meshes_for  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from pistes import sacs  # noqa: E402
from script_node import lancer  # noqa: E402
from chaines import ajouter_chaines, cuire_chaines  # noqa: E402
from filets import draper  # noqa: E402
from corpulence import ajouter_corpulence  # noqa: E402
from diagnostic_poids import imprimer_retournements  # noqa: E402
from poids import (PASSES_MAX, SUITE_DE_CORRECTION, peau_lineaire, etats_ponderes, sommets_des_surfaces,  # noqa: E402
                   jumeaux, preparer_correction, avancer_correction, appliquer_correction, imprimer_correction, refuser_correction,
                   verifier_repos_cuit)
from pas_des_poids import cellules_du_domaine  # noqa: E402
from formes import aretes_des_triangles  # noqa: E402
from noms_silhouettes import SILHOUETTES  # noqa: E402
from silhouettes import ajouter_feminin_et_carrure, bornes_de_st, corps_et_secondaires, finir_les_silhouettes  # noqa: E402
from sol import (bas_des_sources, deplacements, figer, garder_les_poids_des_pieds, poser_les_clips_au_sol,  # noqa: E402
                 restaurer, retirer_sans_sol, rigidifier_les_pieds, surfaces_des_pieds)
from point_fixe import atteindre_le_point_fixe, suite_de_phase  # noqa: E402
from cuisson_gabarit import (bornes_du_gabarit, clips_plantes, cuire_gabarit, preparer_reference, groupes_de_peau,
                            exporter_gabarit, etats_aux_facteurs_neutres, etats_du_gabarit)
from seuils import TOLERANCE_JUMEAUX_POSITION_M
import numpy as np  # noqa: E402
from selection_appuis import etats_des_appuis, selectionner_appuis
from porte_gabarit import verifier_gabarit  # noqa: E402
from glb import souder_les_normales_des_cibles  # noqa: E402
from reprises import Reprises, dossier_de_construction  # noqa: E402
from materiaux_par_sexe import declarer_les_variantes, recoucher_les_variantes  # noqa: E402

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


def os_des_pieds(rig, noms):
    """Par pied de `PIEDS`, ses indices d'os dans `noms`, descendants compris : les os de `sol.surfaces_des_pieds`."""
    indice = {n: i for i, n in enumerate(noms)}
    return [[indice[pied], *(indice[b.name] for b in rig.data.bones[pied].children_recursive)] for pied in PIEDS]


def faces_des_noeuds(peau, noeud):
    """Les triangles de `peau` entre nœuds `noeud`, sans triangle dégénéré : (faces, 3)."""
    peau.data.calc_loop_triangles()
    t = noeud[np.array([f.vertices[:] for f in peau.data.loop_triangles])]
    return t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])]


def preparer_moteurs(rig, peaux, clips, plantes, table, etats, courantes, contraintes, ressources, repos_cuit=False,
                     captures=None, suites=None):
    """#3104 issuecomment-6549354475 ; #3101 issuecomment-6516197619. `suites` : par peau, la suite de sa correction
    (`SUITE_DE_CORRECTION`) lue dans une reprise."""
    cellules = cellules_du_domaine(etats)
    demandes = etats['etats']
    def sous(groupes, os, diagnostic):
        groupes = [({'etats': groupe, 'cellulesSilhouettes': cellules}, matrices, clips) for groupe, matrices, clips in groupes]
        moteurs = []
        for i, peau in enumerate(peaux):
            x, w = peau_lineaire(peau, os)
            jumeau = jumeaux(x)
            fixes = np.empty(0, dtype=int) if contraintes is None else np.unique(
                jumeau[sommets_des_surfaces(contraintes[peau.name])])
            etat = preparer_correction(
                peau.name, x, w, jumeau, aretes_des_triangles(peau, jumeau), etats_ponderes(x, courantes[peau.name], groupes), fixes,
                {**diagnostic, 'noms': list(os)}, () if contraintes is None else os_des_pieds(rig, os),
                None if suites is None else suites[i])
            if captures is not None:
                etat['h5'] = captures[peau.name]
            moteurs.append((peau, os, etat))
        return moteurs

    if repos_cuit:
        diagnostic = {}
        with groupes_de_peau(rig, [], table, demandes, (), diagnostic=diagnostic) as (os, groupes):
            for _, _, etat in sous(groupes, os, diagnostic):
                verifier_repos_cuit(etat)
    diagnostic = {}
    os, groupes = ressources.enter_context(groupes_de_peau(rig, clips, table, demandes, plantes, diagnostic=diagnostic))
    return sous(groupes, os, diagnostic)


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
    resoudre_images(bpy, args.corps_feminin)
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
    rigidifier_les_pieds(squelette, peaux, PIEDS)
    corps, secondaires = corps_et_secondaires(peaux)
    corps_f, _ = corps_et_secondaires(meshes_for(bpy, squelette_f))
    bornes = bornes_de_st()
    table = {**gabarit(squelette), 'st': bornes, 'bornes': bornes_du_gabarit()}
    declaration = json.loads(DECLARATION.read_text(encoding='utf-8'))
    marches = [declaration['clips']['marche']]
    plantes = clips_plantes(declaration)
    noms = [b.name for b in squelette.data.bones]
    reprises = Reprises(
        dossier_de_construction(ICI.parents[2], {k: v for k, v in vars(args).items() if k != 'sortie'}),
        lambda chemin: bpy.ops.wm.save_as_mainfile(filepath=str(chemin), copy=True, relative_remap=False, compress=False),
        lambda chemin: bpy.ops.wm.open_mainfile(filepath=str(chemin), load_ui=False))
    noms_des_objets = {'squelette': squelette.name, 'squelette_f': squelette_f.name, 'objets_f': [o.name for o in objets_f],
                       'peaux': [p.name for p in peaux], 'clips': [a.name for a in clips]}

    rabot = None

    def poser_les_silhouettes():
        nonlocal rabot
        clear_animation(squelette)
        bpy.context.view_layer.update()
        for action in clips:
            restaurer(action, figee[action.name])
        ajouter_feminin_et_carrure(squelette, corps, squelette_f, corps_f, bornes)
        ajouter_corpulence(squelette, corps, args.mpfb)
        neutres = etats_aux_facteurs_neutres(table, silhouettes(peaux))
        rabot = finir_les_silhouettes(squelette, corps, secondaires, table, etats_du_gabarit(table, silhouettes(peaux)),
                                      clips, plantes, neutres, rabot)
        return neutres

    def poser_les_clips():
        for action in clips:
            restaurer(action, figee[action.name])
        poser_les_clips_au_sol(squelette, peaux, clips, sources, PIEDS, table, PELVIS, marches)

    def surfaces():
        return {p.name: surfaces_des_pieds(squelette, peau_lineaire(p, noms)[1], PIEDS) for p in peaux}

    contraintes = None
    phase = 'neutre'
    phase_actuelle = None
    a_preparer = True
    renouveler = True
    etats_silhouettes = None
    references = precedentes = None
    captures = {}
    moteurs = []
    ressources = ExitStack()
    ecart_cles = 0
    etats = courantes = suites = None

    def ouvrir_la_phase():
        """Pose la phase `phase` sur la scène et en tire ses états et les déplacements courants des peaux."""
        nonlocal renouveler, references, precedentes, ecart_cles, etats_silhouettes, etats, courantes
        if phase == 'neutre':
            ecart_cles = 0
            etats = etats_aux_facteurs_neutres(table, [])
            courantes = {p.name: {} for p in peaux}
        elif phase == 'silhouettes':
            ecart_cles = 0
            if renouveler:
                etats_silhouettes = poser_les_silhouettes()
                renouveler = False
            poser_les_clips()
            etats = etats_silhouettes
            courantes = {p.name: deplacements(p) for p in peaux}
        else:
            poser_les_clips()
            clear_animation(squelette)
            bpy.context.view_layer.update()
            references = cuire_gabarit(squelette, peaux, table, captures)
            etats = {'etats': [{k: v for k, v in e.items() if k != 'positions'} for e in references[0][2]['etats']],
                     'cellulesSilhouettes': references[0][2]['cellulesSilhouettes']}
            courantes = {peau.name: {**deplacements(peau), **{
                c['nom']: np.array(c['deltas'], dtype=np.float32) for c in reference['cles']}}
                for peau, (_, _, reference) in zip(peaux, references)}
            ecart_cles = 1 if precedentes is None else max(
                float(np.abs(d - precedentes[nom][cle]).max(initial=0))
                for nom, champs in courantes.items() for cle, d in champs.items())
            precedentes = courantes

    def preparer_phase():
        nonlocal phase_actuelle, a_preparer, moteurs, suites
        ressources.close()
        clear_animation(squelette)
        bpy.context.view_layer.update()
        if suites is None:
            ouvrir_la_phase()
        clear_animation(squelette)
        bpy.context.view_layer.update()
        moteurs = preparer_moteurs(squelette, peaux, clips, plantes, table, etats, courantes, contraintes, ressources,
                                  repos_cuit=phase == 'gabarit' and suites is None,
                                  captures=captures if phase == 'gabarit' else None, suites=suites)
        suites = None
        phase_actuelle = phase
        a_preparer = False
        print('CONSTRUCTION_PHASE', phase_actuelle, flush=True)

    def construire_tour(passe):
        nonlocal contraintes, phase, a_preparer, renouveler
        if a_preparer:
            preparer_phase()
        for peau, os, etat in moteurs:
            if etat['hors'].any():
                avancer_correction(etat)
                retouches = appliquer_correction(peau, os, etat)
                if contraintes is not None:
                    apres = surfaces_des_pieds(squelette, peau_lineaire(peau, os)[1], PIEDS)
                    try:
                        garder_les_poids_des_pieds(peau.name, retouches,
                            {pied: contraintes[peau.name][pied] | apres[pied] for pied in PIEDS})
                    except RuntimeError as erreur:
                        refuser_correction(etat, passe, str(erreur))
            imprimer_correction(etat, passe)
        hors = sum(int(e['hors'].sum()) for _, _, e in moteurs)
        if hors:
            ecrire_la_reprise(f'passe-{passe:04d}', passe)
            return {'aretes': hors, 'phase': 1}
        retouches = sum(len(e['retouches']) for _, _, e in moteurs)
        for peau, _, etat in moteurs:
            if etat['retouches']:
                imprimer_retournements(etat, faces_des_noeuds(peau, etat['jumeau']))
        if phase_actuelle == 'neutre':
            contraintes = surfaces()
        phase, regenerer, fini = suite_de_phase(
            phase_actuelle, retouches, ecart_cles, TOLERANCE_JUMEAUX_POSITION_M)
        renouveler |= regenerer
        if fini:
            return {'aretes': 0, 'phase': 0}
        a_preparer = True
        ecrire_la_reprise(f'passe-{passe:04d}', passe)
        return {'sommets': retouches, 'phase': 1,
                'ecartCles': ecart_cles if ecart_cles > TOLERANCE_JUMEAUX_POSITION_M else 0}

    def ecrire_la_reprise(nom, passe):
        """Écrit la reprise `nom` après la passe `passe` : en fin de phase, l'état de la boucle ; au milieu d'une phase,
        aussi les états et déplacements de la phase et la suite de chaque correction."""
        au_milieu = not a_preparer and phase != 'fini'
        if not au_milieu:
            ressources.close()
        clear_animation(squelette)
        bpy.context.view_layer.update()
        for image in bpy.data.images:
            if image.has_data and not image.packed_file:
                image.pack()
        reprises.ecrire(nom, {'passe': passe, 'phase': phase, 'renouveler': renouveler, 'etats_silhouettes': etats_silhouettes,
                              'references': references, 'precedentes': precedentes, 'captures': captures,
                              'contraintes': contraintes, 'rabot': rabot, 'objets': noms_des_objets, 'ecart_cles': ecart_cles,
                              'etats': etats if au_milieu else None, 'courantes': courantes if au_milieu else None,
                              'suites': [{cle: etat[cle] for cle in SUITE_DE_CORRECTION} for _, _, etat in moteurs]
                              if au_milieu else None})

    def refuser(passe, reste):
        raison = f'construction : point fixe absent après {passe} passes, phase {phase_actuelle}, reste {reste}'
        erreurs = []
        en_ecart = [e for _, _, e in moteurs if e['hors'].any()]
        for etat in en_ecart or [moteurs[0][2]]:
            try:
                refuser_correction(etat, passe, raison)
            except RuntimeError as erreur:
                erreurs.append(erreur)
        raise erreurs[0]

    reprise = reprises.lire()
    if reprise is not None:
        objets_lus = reprise['objets']
        squelette, squelette_f = bpy.data.objects[objets_lus['squelette']], bpy.data.objects[objets_lus['squelette_f']]
        objets_f = [bpy.data.objects[n] for n in objets_lus['objets_f']]
        peaux = [bpy.data.objects[n] for n in objets_lus['peaux']]
        clips = [bpy.data.actions[n] for n in objets_lus['clips']]
        corps, secondaires = corps_et_secondaires(peaux)
        corps_f, _ = corps_et_secondaires(meshes_for(bpy, squelette_f))
        phase, renouveler, etats_silhouettes = reprise['phase'], reprise['renouveler'], reprise['etats_silhouettes']
        references, precedentes, captures = reprise['references'], reprise['precedentes'], reprise['captures']
        contraintes, rabot, passes = reprise['contraintes'], reprise['rabot'], reprise['passe']
        etats, courantes, suites, ecart_cles = reprise['etats'], reprise['courantes'], reprise['suites'], reprise['ecart_cles']
    if reprise is None or phase != 'fini':
        try:
            passes = atteindre_le_point_fixe(construire_tour, PASSES_MAX, refuser, depuis=1 if reprise is None else passes + 1)
        finally:
            ressources.close()
        phase = 'fini'
        ecrire_la_reprise('point-fixe', passes)
    print('SOL tenu en', passes, 'passe(s)', flush=True)
    clear_animation(squelette)
    bpy.context.view_layer.update()
    for action in deriver_a_deux_mains(bpy, squelette, reperes_des_prises(squelette)):
        preparer(action)
        clips.append(action)
    variantes = recoucher_les_variantes(bpy, squelette, peaux, squelette_f, objets_f, declaration.get('surfaces', []))
    for objet in [squelette_f, *objets_f]:
        bpy.data.objects.remove(objet, do_unlink=True)
    clear_animation(squelette)
    bpy.context.view_layer.update()
    nom_du_corps = corps.name
    chaines = ajouter_chaines(bpy, squelette, corps)
    cuire_chaines(bpy, squelette, clips, chaines)
    print('GABARIT_ANATOMIE_OK table disjointe ; head sans enfants', flush=True)
    print('GABARIT_BORNES', json.dumps(table['bornes']), flush=True)
    exporter_gabarit(peaux, references)
    formes = silhouettes(peaux)
    candidats = selectionner_appuis(squelette, peaux, clips, plantes, table, etats_des_appuis(table, formes))
    manifeste = poser(squelette, peaux)
    manifeste['appuis']['plusBas'] = candidats
    manifeste['gabarit'] = table
    manifeste = {'os': [b.name for b in squelette.data.bones], 'chaines': chaines, **manifeste, 'silhouettes': formes,
                 'osAPositionAnimee': os_a_position_animee(squelette, clips, manifeste['gabarit']['racine'])}
    clear_animation(squelette)
    bpy.context.view_layer.update()
    reference = preparer_reference(meshes_for(bpy, squelette), references)
    for image in bpy.data.images:
        if image.has_data:
            image.pack()
    declarer_les_variantes(bpy, [o for o in bpy.data.objects if o.type == 'MESH'], variantes)
    assign_action(squelette, clips[0])
    args.sortie.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(args.sortie), export_format='GLB', export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=False,
                              export_optimize_animation_size=False, export_extras=True,
                              export_morph_normal=True)
    print('NORMALES_DES_CIBLES soudées aux coutures, écart corrigé', round(souder_les_normales_des_cibles(args.sortie), 2),
          '°', flush=True)
    filets = draper(args.sortie, nom_du_corps)
    manifeste['os'] += [os_ for noms in filets.values() for os_ in noms]
    manifeste['chaines'] = {**filets, **chaines}
    verifier_gabarit(args.sortie, reference)
    print('CLIPS', len(clips), 'OS', len(manifeste['os']), 'ZONES', len(manifeste['zones']),
          'EMPLACEMENTS', len(manifeste['emplacements']), 'SILHOUETTES', formes, 'ST', bornes,
          'POSITION', manifeste['osAPositionAnimee'], flush=True)
    manifeste_mjs(args, entree=json.dumps(manifeste, ensure_ascii=False))
    reprises.effacer()
    print('HUMANOIDE_OK', args.sortie, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ual1', type=Path, required=True, help='UAL1_Standard.glb : squelette de référence et clips')
    parser.add_argument('--ual2', type=Path, required=True, help='UAL2_Standard.glb : clips sur le même squelette')
    parser.add_argument('--corps', type=Path, required=True, help="corps UBC (.gltf/.glb) skinné aux os d'UAL")
    parser.add_argument('--corps-feminin', type=Path, required=True,
                        help="corps UBC féminin (.gltf/.glb) aux mêmes os : source de la clé `feminin` et des matériaux `parSexe`")
    for pack in PACKS:
        option = pack.replace('_', '-')
        parser.add_argument(f'--licence-{option}', type=Path, required=True,
                            help=f'texte de licence du pack de --{option}, dans un dossier ancêtre de la source')
    parser.add_argument('--mpfb', type=Path, required=True,
                        help='dossier `data` de MPFB (3dobjs, targets) : donneur de la clé `corpulence`')
    parser.add_argument('--sortie', type=Path, required=True, help='humanoide.glb produit')
    parser.add_argument('--os', type=int, default=65, help="nombre d'os du squelette UAL")
    construire(parser.parse_args())


if __name__ == '__main__':
    main()
