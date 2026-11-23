"""Rendus de contrôle d'un personnage, d'un rigide seul ou d'un élément sans skin (véhicule, décor) : studio Cycles (vues
trois-quarts, face, profil et dos du personnage, son portrait, échelles, isométrique), cadré sur tous les meshes montrés,
rigides compris (`cadrage`), et studio Workbench de QA. Le GLB source n'est jamais modifié.
`--silhouettes` pose, avant le rendu, les shape keys nommées sur tout mesh qui les porte, à la syntaxe de
`npm run godot:evaluer -- --silhouettes` (`hotes/godot/asset/evaluer.mjs`) ; un nom qu'aucun mesh ne porte arrête le
rendu. Si le manifeste voisin de `--input` porte `gabarit.osDesSilhouettes`, chaque os de repos de la base est translaté
de son déplacement aux mêmes poids (`deplacements_des_os`), comme dans les hôtes : au repos, rien ne change ; sous un
clip, chaque os tourne autour de sa tête déplacée, et un rigide monté suit son os. Sous `corpulence`, la force de la
normal map de chaque surface de peau de ce manifeste suit son `reliefDeCorpulence` (`facteur_de_relief`, #4002).
`bornes` et `studio` cadrent et éclairent aussi la revue d'un véhicule (`vehicule/revue.py`), que `habiller_le_modele`
habille.

Une tenue se rend montée sur sa base : `--input` est la base, chaque `--element` un GLB d'élément, chacun avec son manifeste
voisin (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json` d'un import), comme l'évaluateur ;
`--tenue <preset>` vaut `--preset <preset>` et monte d'abord la tenue que le jeu monte pour ce preset (`tenueDesGlb`,
`posesDesRanges.mjs`, #4338), chaque `--local <id>=<glb>` remplaçant l'élément publié `<id>` ou s'ajoutant après elle.
Une zone couverte se masque sur la base et sur les éléments comme dans le jeu (`masquer_les_zones_couvertes`), un rigide
pend à l'os de même nom de la base, une pièce skinnée suit son armature. Sous `--preset`, un rigide que le jeu range (`rangementsObjets` du preset, `rangement` de son trapping) se
pose là où le jeu le range, sur l'emplacement de la base ou la case de la pièce qui l'offre, au repos comme à l'image du
clip posé : l'éditeur Godot épinglé le pose et rend sa transformation (`preset_du_jeu`,
`hotes/godot/asset/posesDesRanges.mjs`, #4351) ; un élément porté plusieurs fois par le preset se donne autant de fois,
chaque `--element` montant à son tour la ligne suivante du preset. Sous `--preset`, les formes de la tête que le jeu pose
au preset se posent aussi, sur tout mesh qui les porte, une forme que `--silhouettes` nomme gardant le poids qu'il lui
donne (`silhouettesSousLePreset`, `posesDesRanges.mjs`). `--preset` colore chaque surface à l'emplacement de palette que
lui donne son manifeste, de la couleur que le jeu y pose pour ce preset (`paletteDesCouleurs`, `posesDesRanges.mjs`), complétée pour un élément de
celle de la teinte de sa ligne (`Monte.palette`, `montageDesElements`) ; chaque surface d'un élément qui déclare une `matiere` s'habille comme
le jeu l'habille, de sa texture du catalogue `CATALOGUE` (`habiller_le_modele`, aux UV du mesh, #4313), teinte de cette
couleur, et du relief de sa matière (#4527) ; `--clip`
pose la base à l'image `--image` d'un de ses clips, sans quoi elle reste au repos. `--illustration` pose l'illustration
directrice à gauche des vues de face, de trois-quarts, de profil (côté gauche du personnage) et de dos dans
`planche.png` : un rendu se montre à côté d'elle. `--cadre x,y,z,étendue` (mètres, repère de `bounds` du rapport, Z haut)
vise ce centre et cadre cette étendue dans les vues de face, de trois-quarts, de profil, de dos, d'échelle et
isométriques au lieu de celles du modèle ; l'éclairage reste celui du modèle (#4338).

Un rigide sur base (`--input` à côté du manifeste d'un élément lié en `rigide`) se rend seul, dressé le long du +Y de sa
prise (`dresser`) : vues de face, de profil et de dos (`VUES_DU_RIGIDE`), `--preset` le colorant et l'habillant comme le jeu,
`--illustration` et `--cadre` (repère des vues dressées) comme pour un personnage.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <fichier.glb> --output <dossier vide> [--isometric-only] [--silhouettes feminin=1,corpulence=0.5]
    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <base.glb> --element <a.glb> [--element <b.glb>] \\
        --preset sorcier [--clip Hampe_Repos_Loop --image 20] [--illustration <illustration.png>] [--cadre 0,0.02,0.62,1.2] --output <dossier vide>
    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <base.glb> --tenue gladiateur \\
        [--local humanoide--rigide--grande_hache=<hache.glb>] [--element <c.glb>] --output <dossier vide>
    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <rigide.glb> --preset gladiateur \\
        [--illustration <illustration.png>] [--cadre 0,0,0.6,0.5] --output <dossier vide>
"""
import argparse
import hashlib
import json
import math
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from glb import lire_glb  # noqa: E402
from habillage import couleur_lineaire  # noqa: E402
from noms_silhouettes import CORPULENCE  # noqa: E402
from production import MODELES  # noqa: E402
from script_node import lancer  # noqa: E402

DEPOT = Path(__file__).resolve().parents[2]
CATALOGUE = DEPOT / 'hotes' / 'godot' / 'projet' / 'textures'
"""Le catalogue des textures de matière du jeu."""
METRES_PAR_MOTIF = 2.0
"""`MiseEnPage.METRES_PAR_MOTIF` du monde Godot."""
NETTETE_DU_MOTIF = 4.0
"""`VolumeDeScene.NETTETE_DU_MOTIF` du monde Godot."""
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


def lire_cadre(texte):
    """Le cadre de `--cadre`, `x,y,z,étendue` en mètres, l'étendue positive : (x, y, z, étendue)."""
    try:
        cadre = tuple(float(v) for v in texte.split(','))
    except ValueError:
        cadre = ()
    if len(cadre) != 4 or not all(math.isfinite(v) for v in cadre) or cadre[3] <= 0:
        raise argparse.ArgumentTypeError(f'« {texte} » ; attendu x,y,z,étendue en mètres, l\'étendue positive')
    return cadre


def poser_les_silhouettes(bpy, poids, exigees):
    """Pose chaque shape key de `poids` à son poids sur tout mesh de la scène qui la porte ; un nom d'`exigees` qu'aucun
    mesh ne porte arrête le rendu."""
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
    absentes = sorted(nom for nom in exigees if not poses[nom])
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


def trouver(dossiers, id_):
    """Le GLB et le manifeste de `id_` dans le premier des `dossiers` qui les porte."""
    for d in dossiers:
        for glb, manifeste in ((d / id_ / f"{id_}.glb", d / id_ / f"{id_}.element.json"),
                               (d / f"{id_}.glb", d / f"{id_}.manifeste.json")):
            if glb.exists() and manifeste.exists():
                return glb, json.loads(manifeste.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"{id_} : ni <id>/<id>.glb ni <id>.glb (avec son manifeste) sous {[str(d) for d in dossiers]}")


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


def couches_du_jeu():
    """`COUCHES` et `RANG_DU_CORPS` (`hotes/godot/asset/element.ts`) : `{'COUCHES': [...], 'RANG_DU_CORPS': rang}`."""
    return json.loads(lancer(Path(__file__).resolve().parent / 'base' / 'gabarit.mjs', [], json.dumps({'operation': 'couches'})))


def masquer_les_zones_couvertes(porteurs, couches):
    """Masque chaque mesh de zone (`zone` de son nœud glTF) des `porteurs`, `(objets, manifeste)` de la base puis de
    chaque élément monté, que couvre (`couvre`) un élément de couche plus extérieure que celle de son porteur, la base
    sous toute couche, comme le jeu (`MontageDeComposition.masquer_les_zones_couvertes`) et l'évaluateur
    (`sansLesZonesMasquees`) ; `couches` : `couches_du_jeu`."""
    def rang(manifeste):
        return couches['COUCHES'].index(manifeste['couche']) if manifeste.get('couche') else couches['RANG_DU_CORPS']
    couvrant = {}
    for _, manifeste in porteurs:
        for zone in manifeste.get('couvre', []) if manifeste.get('couche') else []:
            couvrant[zone] = max(couvrant.get(zone, couches['RANG_DU_CORPS']), rang(manifeste))
    for objets, manifeste in porteurs:
        for obj in objets:
            if obj.type == 'MESH' and obj.get('zone') is not None and couvrant.get(obj['zone'], couches['RANG_DU_CORPS']) > rang(manifeste):
                obj.hide_render = True


def monter(bpy, rig, elements):
    """Monte sur la base d'armature `rig` chaque `(objets importés, manifeste)` d'`elements` : un rigide pend à l'os de
    même nom de `rig` à la même position locale, une pièce skinnée suit `rig` ; les armatures des éléments et les
    meshes sans matériau (forme d'os de l'import) sont masqués."""
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


VERS_BLENDER = ((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))
"""Du repère glTF (Y haut) à celui de Blender (Z haut), comme l'import glTF de Blender."""


def preset_du_jeu(base, manifeste, elements, preset, silhouettes, clip=None, t=0, tenue=False, locales=()):
    """Ce que le jeu pose sous le `preset` (`hotes/godot/asset/posesDesRanges.mjs`) : `glbs`, les GLB posés, la tenue du
    preset si `tenue` (`tenueDesGlb`, ses pièces `locales` de `--local` substituées) puis `elements` ; `poses`, par GLB de
    `glbs`, `None` ou `{ligne, meshes}` : par nom de nœud, la transformation glTF (16 nombres, colonne par colonne) où le
    jeu range ce mesh, `None` s'il ne le montre pas rangé, au repos ou à l'instant `t` du `clip` ; `poids`, les poids des
    `silhouettes` que cet instant pose ; `palette`, `{emplacement: couleur linéaire (r, g, b)}` ; `palettes`, par GLB de
    `glbs`, cette palette complétée de celle de la teinte de sa ligne (`montageDesElements`), comme le jeu la complète
    (`montage_de_composition.gd`, `palette.merge`). Une ligne du preset sans GLB donné se dit sur la sortie d'erreur."""
    demande = {'base': str(base), 'manifeste': str(manifeste), 'elements': [str(e) for e in elements], 'preset': preset,
               'silhouettes': silhouettes, 'tenue': tenue, 'locales': list(locales), **({'clip': clip, 't': t} if clip else {})}
    reponse = json.loads(lancer(DEPOT / 'hotes' / 'godot' / 'asset' / 'posesDesRanges.mjs', [], json.dumps(demande)))
    if reponse['sans']:
        print(f"--preset {preset} : ligne(s) montée(s) par le jeu sans --element répété : {', '.join(reponse['sans'])}", file=sys.stderr)
    palette = {slot: couleur_lineaire(couleur) for slot, couleur in reponse['palette'].items()}
    return {'glbs': [Path(g) for g in reponse['glbs']], 'poses': reponse['elements'], 'poids': reponse['silhouettes'],
            'palette': palette,
            'palettes': [{**palette, **{slot: couleur_lineaire(couleur) for slot, couleur in teinte.items()}}
                         for teinte in reponse['palettes']]}


def est_un_rigide_sur_base(manifeste):
    """Le manifeste `manifeste` est-il celui d'un élément lié en rigide sur une base (`liaison.mode`, `base`) ?"""
    return 'base' in manifeste and manifeste.get('liaison', {}).get('mode') == 'rigide'


def dresser(objets):
    """Les meshes des `objets` d'un rigide, détachés de leur os et dressés le long du +Y de leur prise, Z haut ; les meshes
    sans matériau (forme d'os de l'import) masqués."""
    from mathutils import Matrix
    meshes = []
    for obj in objets:
        if obj.type == 'MESH' and obj.data.materials:
            obj.parent = None
            obj.matrix_world = Matrix.Rotation(math.pi / 2, 4, 'X')
            meshes.append(obj)
        elif obj.type == 'MESH':
            obj.hide_render = True
    return meshes


def ranger(elements, poses):
    """Pose chaque mesh rigide des `(objets importés, manifeste)` d'`elements` que `poses` range (`preset_du_jeu`) à sa
    transformation, hors de son os : son nom est celui de son nœud glTF, au suffixe `.NNN` près que Blender ajoute à un
    nom déjà pris."""
    from mathutils import Matrix
    vers_blender = Matrix(VERS_BLENDER)
    for (objets, _), pose in zip(elements, poses):
        for obj in objets if pose else []:
            noeud = obj.name if obj.name in pose['meshes'] else re.sub(r'\.\d{3}$', '', obj.name)
            if obj.type == 'MESH' and obj.parent_type == 'BONE' and pose['meshes'].get(noeud):
                colonnes = pose['meshes'][noeud]
                obj.parent = None
                obj.matrix_world = vers_blender @ Matrix([colonnes[ligne::4] for ligne in range(4)]) @ vers_blender.inverted()


def colorer(objets, surfaces, palette):
    """Pose sur la couleur de base de chaque matériau des `objets` d'un modèle (la base ou un élément) la couleur de
    `palette` à l'emplacement que lui donnent les `surfaces` de ce modèle (`{nom du matériau: emplacement}`), car deux
    éléments peuvent nommer pareil des matériaux d'emplacements différents ; un matériau sans emplacement ou dont la palette ne colore pas
    l'emplacement garde la sienne. La couleur remplace la texture de couleur du matériau, comme dans le jeu
    (`MontageDeComposition.peindre`) : la peau de la base, texturée, et celle d'une tête, en aplat, y ont la même."""
    for obj in objets:
        for slot in obj.material_slots if obj.type == 'MESH' else []:
            couleur = palette.get(surfaces.get(slot.material.name.split('.')[0])) if slot.material else None
            principled = next((n for n in slot.material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if couleur else None
            if principled:
                arbre = slot.material.node_tree
                for lien in [l for l in arbre.links if l.to_socket == principled.inputs['Base Color']]:
                    arbre.links.remove(lien)
                principled.inputs['Base Color'].default_value = (*couleur, 1)


def noeud(nt, type_, entrees=(), **reglages):
    """La première sortie active d'un nœud `type_` neuf de l'arbre `nt`, réglé de `reglages`, ses entrées actives
    liées dans l'ordre aux sorties `entrees`, ou posées à leur valeur."""
    n = nt.nodes.new(type_)
    for nom, valeur in reglages.items():
        setattr(n, nom, valeur)
    for prise, entree in zip([p for p in n.inputs if p.enabled], entrees):
        if isinstance(entree, (float, tuple)):
            prise.default_value = entree
        else:
            nt.links.new(entree, prise)
    return next(p for p in n.outputs if p.enabled)


def vecteur(nt, operation, *entrees):
    """La sortie d'un nœud Vector Math `operation` sur `entrees` (`noeud`)."""
    return noeud(nt, "ShaderNodeVectorMath", entrees, operation=operation)


def calcul(nt, operation, *entrees):
    """La sortie d'un nœud Math `operation` sur `entrees` (`noeud`)."""
    return noeud(nt, "ShaderNodeMath", entrees, operation=operation)


def composantes(nt, v):
    """Les sorties X, Y, Z de `v`."""
    return noeud(nt, "ShaderNodeSeparateXYZ", (v,)).node.outputs


def poids_triplanaires(nt, normale):
    """Le poids de chaque axe du repère de l'objet sous la `normale` de surface de ce repère, comme le jeu le donne
    (`uv1_power_normal`, `art/monde.gdshader`), à la netteté `NETTETE_DU_MOTIF`."""
    puissance = vecteur(nt, "POWER", vecteur(nt, "ABSOLUTE", normale), (NETTETE_DU_MOTIF,) * 3)
    return vecteur(nt, "SCALE", puissance, calcul(nt, "DIVIDE", 1.0, vecteur(nt, "DOT_PRODUCT", puissance, (1.0,) * 3)))


def lire_en_triplanaire(nt, motif, poids, image):
    """L'`image` lue au `motif` (le repère de l'objet à l'échelle du motif) sur le plan de chaque axe, mélangée de
    `poids` (`poids_triplanaires`), comme le jeu la lit (`triplanar_texture`, `art/monde.gdshader`), ses plans ramenés
    du repère glTF de Godot, Y haut, V vers le bas, à celui de Blender, Z haut, V vers le haut : X lu en (y, z), Y en
    (x, z), Z en (x, y)."""
    x, y, z = composantes(nt, motif)
    lu = None
    for (u, v), part in zip(((y, z), (x, z), (x, y)), composantes(nt, poids)):
        texel = noeud(nt, "ShaderNodeTexImage", (noeud(nt, "ShaderNodeCombineXYZ", (u, v)),), image=image)
        part = vecteur(nt, "SCALE", texel, part)
        lu = part if lu is None else vecteur(nt, "ADD", lu, part)
    return lu


def relief_triplanaire(nt, lu, normale):
    """La normale du monde que donne le relief `lu` (`lire_en_triplanaire`) à la `normale` de surface du repère de
    l'objet, dans la base que le jeu lie aux axes de ce repère (`vertex()`, `art/monde.gdshader`), ramenée au repère de
    Blender : tangente Y sous X, X sous Y et Z ; bitangente Z sous X et Y, Y sous Z ; la composante normale du relief
    reconstruite de ses deux autres, comme Godot le fait de `NORMAL_MAP`."""
    rx, ry, _ = composantes(nt, vecteur(nt, "MULTIPLY_ADD", lu, (2.0,) * 3, (-1.0,) * 3))
    plan = noeud(nt, "ShaderNodeCombineXYZ", (rx, ry))
    rz = calcul(nt, "SQRT", calcul(nt, "MAXIMUM", calcul(nt, "SUBTRACT", 1.0, vecteur(nt, "DOT_PRODUCT", plan, plan)), 0.0))
    ax, ay, az = composantes(nt, vecteur(nt, "ABSOLUTE", normale))
    tangente = vecteur(nt, "NORMALIZE", noeud(nt, "ShaderNodeCombineXYZ", (calcul(nt, "ADD", ay, az), ax)))
    bitangente = vecteur(nt, "NORMALIZE", noeud(nt, "ShaderNodeCombineXYZ", (0.0, az, calcul(nt, "ADD", ax, ay))))
    somme = vecteur(nt, "ADD", vecteur(nt, "SCALE", tangente, rx), vecteur(nt, "SCALE", bitangente, ry))
    somme = vecteur(nt, "NORMALIZE", vecteur(nt, "ADD", somme, vecteur(nt, "SCALE", normale, rz)))
    return noeud(nt, "ShaderNodeVectorTransform", (somme,), vector_type="NORMAL", convert_from="OBJECT", convert_to="WORLD")


def habiller(bpy, mat, surface, couche, emblem, par_uv, couleur):
    """La surface du manifeste comme le jeu l'habille (`MontageDeComposition.peindre`) : la texture de sa `matiere` du
    catalogue si le catalogue la porte, sa texture neutre (`<matiere>.neutre.jpg`) si `couleur` est donnée et que le
    catalogue la porte, teinte de `couleur` (linéaire), et son relief (`<matiere>.normale.jpg`) s'il y est
    (`VolumeDeScene.texturer`) ; lus aux UV `couche` si `par_uv` et que la surface n'est pas `blason`, sinon en
    triplanaire dans le repère de l'objet, relief compris (`lire_en_triplanaire`, `relief_triplanaire`) ; un motif tous
    les `METRES_PAR_MOTIF` ; sans texture, la couleur de son matériau ; l'emblème `emblem` en couche de détail (UV
    `couche`) si `blason` et qu'il est donné."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    base = bsdf.inputs["Base Color"]
    sortie = None
    matiere = surface.get("matiere")
    if matiere and (CATALOGUE / f"{matiere}.jpg").exists():
        for lien in list(nt.links):
            if lien.to_socket == base:
                nt.links.remove(lien)
        echelle = nt.nodes.new("ShaderNodeMapping")
        echelle.inputs["Scale"].default_value = (1 / METRES_PAR_MOTIF,) * 3
        neutre = CATALOGUE / f"{matiere}.neutre.jpg"
        image = neutre if couleur is not None and neutre.exists() else CATALOGUE / f"{matiere}.jpg"
        image = bpy.data.images.load(str(image.resolve(strict=True)), check_existing=True)
        relief = CATALOGUE / f"{matiere}.normale.jpg"
        if relief.exists():
            relief = bpy.data.images.load(str(relief.resolve(strict=True)), check_existing=True)
            relief.colorspace_settings.name = "Non-Color"
        else:
            relief = None
        if par_uv and not surface.get("blason"):
            coord = nt.nodes.new("ShaderNodeUVMap")
            coord.uv_map = couche
            nt.links.new(coord.outputs["UV"], echelle.inputs["Vector"])
            sortie = noeud(nt, "ShaderNodeTexImage", (echelle.outputs["Vector"],), image=image)
            if relief is not None:
                carte = noeud(nt, "ShaderNodeTexImage", (echelle.outputs["Vector"],), image=relief)
                normale = noeud(nt, "ShaderNodeNormalMap", (1.0, carte), uv_map=couche)
        else:
            coord = nt.nodes.new("ShaderNodeTexCoord")
            nt.links.new(coord.outputs["Object"], echelle.inputs["Vector"])
            poids = poids_triplanaires(nt, coord.outputs["Normal"])
            sortie = lire_en_triplanaire(nt, echelle.outputs["Vector"], poids, image)
            if relief is not None:
                lu = lire_en_triplanaire(nt, echelle.outputs["Vector"], poids, relief)
                normale = relief_triplanaire(nt, lu, coord.outputs["Normal"])
        if relief is not None:
            for lien in list(bsdf.inputs["Normal"].links):
                nt.links.remove(lien)
            nt.links.new(normale, bsdf.inputs["Normal"])
        if couleur is not None:
            teinte = nt.nodes.new("ShaderNodeMix")
            teinte.data_type, teinte.blend_type = "RGBA", "MULTIPLY"
            teinte.inputs["Factor"].default_value = 1.0
            nt.links.new(sortie, next(s for s in teinte.inputs if s.name == "A" and s.type == "RGBA"))
            next(s for s in teinte.inputs if s.name == "B" and s.type == "RGBA").default_value = (*couleur, 1)
            sortie = next(s for s in teinte.outputs if s.type == "RGBA")
    if surface.get("blason") and emblem is not None:
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = couche
        det = nt.nodes.new("ShaderNodeTexImage")
        det.image, det.extension = emblem, "CLIP"
        nt.links.new(uv.outputs["UV"], det.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(det.outputs["Alpha"], mix.inputs["Factor"])
        a = next(s for s in mix.inputs if s.name == "A" and s.type == "RGBA")
        if sortie is not None:
            nt.links.new(sortie, a)
        else:
            a.default_value = base.default_value
        nt.links.new(det.outputs["Color"], next(s for s in mix.inputs if s.name == "B" and s.type == "RGBA"))
        sortie = next(s for s in mix.outputs if s.type == "RGBA")
    if sortie is not None:
        nt.links.new(sortie, base)


def habiller_le_modele(bpy, objets, manifeste, emblem, par_uv, palette):
    """Chaque matériau des `objets` d'un modèle que nomme une surface de son `manifeste` habillé une fois (`habiller`),
    teint de la couleur de `palette` à son emplacement s'il en a une."""
    surfaces = {s["nom"]: s for s in manifeste.get("surfaces", [])}
    vus = set()
    for o in objets:
        for mat in o.data.materials if o.type == "MESH" else []:
            surface = surfaces.get(mat.name.split(".")[0]) if mat else None
            if surface and mat.name not in vus:
                vus.add(mat.name)
                habiller(bpy, mat, surface, o.data.uv_layers[0].name if o.data.uv_layers else "", emblem, par_uv,
                         palette.get(surface["palette"]))


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


VUES_DE_REVUE = (("face", (0, -1, 0.05)), ("trois-quarts", (0.65, -1, 0.45)), ("dessus", (0, -0.001, 1)))
"""Les vues de la revue d'un modèle sans base (`vues_de_revue`) : leur nom et la direction d'où la caméra regarde."""
COTE_DE_VUE = 640
"""Le côté (px) d'une vue de revue."""


def grille(bpy, lignes, sortie):
    """Les images `lignes` (listes de chemins de même taille) en grille, la première ligne en haut, dans `sortie`."""
    import numpy as np
    rangees = []
    for chemins in lignes:
        images = [bpy.data.images.load(str(c)) for c in chemins]
        rangees.append(np.concatenate([np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)
                                       for im in images], axis=1))
    tout = np.concatenate(rangees[::-1], axis=0)
    resultat = bpy.data.images.new("planche", tout.shape[1], tout.shape[0])
    resultat.pixels.foreach_set(tout.ravel())
    resultat.filepath_raw = str(sortie)
    resultat.file_format = "PNG"
    resultat.save()


def cadre(direction, cotes):
    """Le côté du carré de la vue de `direction`, d'aplomb, qui contient la boîte de `cotes` centrée sur son axe : le
    double du plus grand écart d'un de ses coins à cet axe, en largeur ou en hauteur d'image."""
    from mathutils import Vector
    axe = Vector(direction).normalized()
    droite = axe.cross(Vector((0, 0, 1))).normalized()
    haut = droite.cross(axe)
    signes = (-1, 1)
    coins = [Vector((sx * cotes.x, sy * cotes.y, sz * cotes.z)) / 2 for sx in signes for sy in signes for sz in signes]
    return 2 * max(abs(coin.dot(v)) for coin in coins for v in (droite, haut))


def vues_de_revue(rendre, sortie, nom, centre, cotes, etendue):
    """Rend par `rendre` (`studio`) les `VUES_DE_REVUE` de la boîte de `cotes` autour de `centre`, cadrées sur
    `etendue`, élargie à la vue qui la déborde (`cadre`), dans `sortie / <nom>-<vue>.png` ; rend leurs chemins, dans
    l'ordre."""
    for vue, direction in VUES_DE_REVUE:
        cote = max(etendue, cadre(direction, cotes)) * 1.12
        rendre(f"{nom}-{vue}.png", direction, centre, cote, COTE_DE_VUE, COTE_DE_VUE)
    return [sortie / f"{nom}-{vue}.png" for vue, _ in VUES_DE_REVUE]


def bornes(bpy, objets):
    """Les coins bas et haut de l'emprise des sommets évalués des `objets`, dans le monde."""
    import numpy as np
    from mathutils import Vector
    from mesure import world_vertices
    bpy.context.view_layer.update()
    coordinates = np.concatenate(list(world_vertices(bpy, objets).values()))
    return Vector(coordinates.min(axis=0).tolist()), Vector(coordinates.max(axis=0).tolist())


LARGEUR_DE_VUE, HAUTEUR_DE_VUE = 1000, 1200
"""Les côtés (px) d'une vue d'un personnage."""


def cadrage(bpy, meshes):
    """Le cadre des `meshes` montrés, rigides compris : les coins bas et haut de leur emprise (`bornes`) et l'étendue
    cadrée, la hauteur d'une vue d'un personnage (l'un d'eux skinné) qui tient leur hauteur et, en largeur, leur
    diagonale horizontale, sinon leur plus grande dimension."""
    low, high = bornes(bpy, meshes)
    cotes = high - low
    if not any(mod.type == 'ARMATURE' for obj in meshes for mod in obj.modifiers):
        return low, high, max(cotes)
    return low, high, max(cotes.z, math.hypot(cotes.x, cotes.y) * HAUTEUR_DE_VUE / LARGEUR_DE_VUE)


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


VUES_DU_PERSONNAGE = (('face', (0, -1, 0.05)), ('profil', (1, 0, 0.05)), ('dos', (0, 1, 0.05)))
"""Les vues de face, de profil (côté gauche) et de dos d'un personnage : leur nom et la direction d'où la caméra regarde."""
VUES_DU_RIGIDE = (('face', (1, 0, 0)), ('profil', (0, -1, 0)), ('dos', (-1, 0, 0)))
"""Les vues de face, de profil et de dos d'un rigide seul dressé (`dresser`)."""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--isometric-only', action='store_true', help='Render only 45-degree overhead views at 512, 40, 64 and 128 pixels high')
    parser.add_argument('--silhouettes', type=lire_silhouettes, default={},
                        help='nom=poids[,nom=poids] : shape keys posées sur tout mesh qui les porte avant le rendu')
    parser.add_argument('--element', action='append', default=[], help='GLB d\'élément monté sur la base --input')
    parser.add_argument('--preset', help='id du preset de personnage dont la palette colore les surfaces et dont les formes de la tête se posent')
    parser.add_argument('--tenue', help='id du preset de personnage dont la tenue se monte avant les --element ; implique --preset')
    parser.add_argument('--local', action='append', default=[], metavar='ID=GLB', help='pièce de la tenue lue à ce GLB local')
    parser.add_argument('--clip', help='clip de la base posé avant le rendu')
    parser.add_argument('--image', type=int, default=1, help='image du clip posée')
    parser.add_argument('--illustration', type=Path, help='illustration directrice posée à gauche de planche.png')
    parser.add_argument('--cadre', type=lire_cadre, help='x,y,z,étendue : centre et étendue cadrés au lieu de ceux du modèle')
    args = parser.parse_args()
    if args.tenue and args.preset:
        parser.error('--tenue implique --preset, à ne pas donner')
    if args.local and not args.tenue:
        parser.error('--local : --tenue requis')
    preset = args.tenue or args.preset
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
    rigide = est_un_rigide_sur_base(manifeste_de_base)
    if rigide and (args.element or args.tenue or args.clip or args.silhouettes):
        parser.error(f'{source.name} : un rigide seul, sans --element, --tenue, --clip ni --silhouettes')
    deplacements = deplacements_des_os(lire_glb(source)[0], manifeste_de_base.get('gabarit', {}).get('osDesSilhouettes', {}),
                                       args.silhouettes)
    poids = args.silhouettes
    if rigide:
        meshes = dresser(base)
        jeu = preset_du_jeu(MODELES / f"{manifeste_de_base['base']}.glb", MODELES / f"{manifeste_de_base['base']}.manifeste.json",
                            [], preset, {}) if preset else {'palette': {}}
        colorer(meshes, {s['nom']: s['palette'] for s in manifeste_de_base['surfaces']}, jeu['palette'])
        habiller_le_modele(bpy, meshes, manifeste_de_base, None, True, jeu['palette'])
    elif args.element or preset or args.clip or deplacements:
        rigs = [obj for obj in base if obj.type == 'ARMATURE']
        if len(rigs) != 1:
            raise ValueError(f'{source} : {len(rigs)} armatures, une attendue pour monter, colorer, poser ou déplacer les os')
        rig = rigs[0]
        if deplacements:
            deplacer_les_os(bpy, rig, deplacements)
        # io_scene_gltf2/blender/imp/animation_node.py : l'import pose la clé de l'instant t à l'image t × fps × fps_base.
        cadence = bpy.context.scene.render.fps * bpy.context.scene.render.fps_base
        instant = {'clip': args.clip, 't': args.image / cadence} if args.clip else {}
        glbs = [Path(glb).resolve(strict=True) for glb in args.element]
        jeu = preset_du_jeu(source, chemin, glbs, preset, args.silhouettes, **instant, tenue=bool(args.tenue),
                            locales=args.local) if preset else {'glbs': glbs, 'poses': [], 'poids': poids, 'palette': {},
                                                                 'palettes': [{} for _ in glbs]}
        elements = [(importer(bpy, glb), manifeste_voisin(glb)) for glb in jeu['glbs']]
        monter(bpy, rig, elements)
        if elements:
            masquer_les_zones_couvertes([(base, manifeste_de_base)] + elements, couches_du_jeu())
        poids, palette = jeu['poids'], jeu['palette']
        colorer(base, {s['nom']: s['palette'] for s in manifeste_de_base.get('surfaces', [])}, palette)
        for (objets, manifeste), couleurs in zip(elements, jeu['palettes'], strict=True):
            colorer(objets, {s['nom']: s['palette'] for s in manifeste.get('surfaces', [])}, couleurs)
            habiller_le_modele(bpy, objets, manifeste, None, True, couleurs)
        if args.clip:
            action = bpy.data.actions.get(args.clip)
            if action is None:
                raise ValueError(f'--clip {args.clip} : clips de la base {sorted(a.name for a in bpy.data.actions)}')
            rig.animation_data_create()
            rig.animation_data.action = action
            if action.slots:
                rig.animation_data.action_slot = action.slots[0]
            bpy.context.scene.frame_set(args.image)
        ranger(elements, jeu['poses'])
        bpy.context.view_layer.update()
    silhouettes = poser_les_silhouettes(bpy, poids, args.silhouettes)
    relief = facteur_de_relief(manifeste_de_base, args.silhouettes)
    if relief is not None:
        accuser_le_relief(base, {s['nom'] for s in manifeste_de_base.get('surfaces', []) if s['palette'] == 'peau'}, relief)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.data.materials and not obj.hide_render]
    skinned = [obj for obj in meshes if any(mod.type == 'ARMATURE' for mod in obj.modifiers)]
    if not meshes:
        raise ValueError('No meshes found')
    low, high, extent = cadrage(bpy, meshes)
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
    report = {'input': source.name, 'sha256_before': digest, 'bounds': {'min': list(low), 'max': list(high), 'height': height, 'extent': extent}, 'meshes': [{'name': obj.name, 'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons), 'materials': [slot.material.name if slot.material else None for slot in obj.material_slots]} for obj in meshes], 'materials': materials, 'silhouettes': {nom: {'poids': poids[nom], 'meshes': objets} for nom, objets in silhouettes.items()}, 'render_engine': 'CYCLES', 'samples': 16}
    render = studio(bpy, low, center, extent, output, start)
    if rigide:
        bpy.data.objects.remove(bpy.data.objects['studio_floor'])
    cible, etendue = (Vector(args.cadre[:3]), args.cadre[3]) if args.cadre else (center, extent)
    vues = VUES_DU_RIGIDE if rigide else VUES_DU_PERSONNAGE if skinned else ()
    if args.isometric_only:
        report['camera_elevation_degrees'] = 45
        report['camera_direction'] = [1, -1, 2 ** 0.5]
        for size in (512, 40, 64, 128):
            render('isometrique-' + str(size) + 'px.png', (1, -1, 2 ** 0.5), cible, etendue * 1.12, size, size)
    else:
        if not rigide:
            render('face-trois-quarts.png', (0.65, -1, 0.17), cible, etendue * 1.12, LARGEUR_DE_VUE, HAUTEUR_DE_VUE)
            render('dos-trois-quarts.png', (-0.65, 1, 0.17), cible, etendue * 1.12, LARGEUR_DE_VUE, HAUTEUR_DE_VUE)
        for nom, direction in vues:
            render(f'{nom}.png', direction, cible, etendue * (1.06 if rigide else 1.12), 800 if rigide else LARGEUR_DE_VUE, 1500 if rigide else HAUTEUR_DE_VUE)
        if vues and args.illustration:
            noms = ['face'] + ([] if rigide else ['face-trois-quarts']) + ['profil', 'dos']
            planche(bpy, [args.illustration.resolve(strict=True)] + [output / f'{nom}.png' for nom in noms], output / 'planche.png')
        if skinned:
            corps_bas, corps_haut = bornes(bpy, skinned)
            hauteur_du_corps = corps_haut.z - corps_bas.z
            centre_du_corps = (corps_bas + corps_haut) / 2
            portrait_target = Vector((centre_du_corps.x, centre_du_corps.y, corps_bas.z + hauteur_du_corps * 0.86))
            render('portrait.png', (0.3, -1, 0.05), portrait_target, hauteur_du_corps * 0.32, 768, 768)
        if not rigide:
            for size in (40, 64, 128):
                render('echelle-' + str(size) + 'px.png', (0.65, -1, 0.17), cible, etendue * 1.12, round(size * LARGEUR_DE_VUE / HAUTEUR_DE_VUE), size)
    report['elapsed_seconds'] = time.monotonic() - start
    report['sha256_after'] = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != report['sha256_after']:
        raise RuntimeError('Source changed')
    (output / 'render-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('DONE', output, flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == '__main__':
    main()
