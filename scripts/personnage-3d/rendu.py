"""Rendus de contrôle d'un personnage ou d'un élément rigide sans skin (véhicule, décor) : studio Cycles (vues
trois-quarts, portrait du personnage, échelles, isométrique), cadré sur la hauteur des meshes skinnés du personnage
ou sur la plus grande dimension de l'élément, et studio Workbench de QA. Le GLB source n'est jamais modifié.
`--silhouettes` pose, avant le rendu, les shape keys nommées sur tout mesh qui les porte, à la syntaxe de
`npm run godot:evaluer -- --silhouettes` (`hotes/godot/asset/evaluer.mjs`) ; un nom qu'aucun mesh ne porte arrête le
rendu. Si le manifeste voisin de `--input` porte `gabarit.osDesSilhouettes`, chaque os de repos de la base est translaté
de son déplacement aux mêmes poids (`deplacements_des_os`), comme dans les hôtes : au repos, rien ne change ; sous un
clip, chaque os tourne autour de sa tête déplacée, et un rigide monté suit son os. Sous `corpulence`, la force de la
normal map de chaque surface de peau de ce manifeste suit son `reliefDeCorpulence` (`facteur_de_relief`, #4002).
`bornes` et `studio` cadrent et éclairent aussi la revue d'un véhicule (`vehicule/revue.py`), que `habiller_le_modele`
habille.

Une tenue se rend montée sur sa base : `--input` est la base, chaque `--element` un GLB d'élément, chacun avec son manifeste
voisin (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json` d'un import), comme l'évaluateur. Les zones
que couvrent les éléments sont masquées sur la base, un rigide pend à l'os de même nom de la base, une pièce skinnée suit
son armature. Sous `--preset`, un rigide que le jeu range (`rangementsObjets` du preset, `rangement` de son trapping) se
pose là où le jeu le range, sur l'emplacement de la base ou la case de la pièce qui l'offre, au repos comme à l'image du
clip posé : l'éditeur Godot épinglé le pose et rend sa transformation (`poses_des_ranges`,
`hotes/godot/asset/posesDesRanges.mjs`, #4351) ; un élément porté plusieurs fois par le preset se donne autant de fois,
chaque `--element` montant à son tour la ligne suivante du preset. `--preset` colore chaque surface à l'emplacement de palette que lui donne son manifeste, de la couleur que
la race du preset de personnage (`src/data/raceAppearance.json`) puis le preset (`src/data/presets-de-personnage.json`)
y posent au nuancier (`src/data/materials.json`) ; chaque surface d'un élément qui déclare une `matiere` s'habille comme
le jeu l'habille, de sa texture du catalogue `CATALOGUE` (`habiller_le_modele`, aux UV du mesh, #4313), teinte de cette
couleur, et du relief de sa matière (#4527) ; `--clip`
pose la base à l'image `--image` d'un de ses clips, sans quoi elle reste au repos. `--illustration` pose l'illustration
directrice à gauche des vues de face, de trois-quarts et de dos dans `planche.png` : un rendu se montre à côté d'elle.
`--cadre x,y,z,étendue` (mètres, repère de `bounds` du rapport, Z haut) vise ce centre et cadre cette étendue dans les vues
de face, de trois-quarts, de dos, d'échelle et isométriques au lieu de celles du modèle ; l'éclairage reste celui du
modèle (#4338).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <fichier.glb> --output <dossier vide> [--isometric-only] [--silhouettes feminin=1,corpulence=0.5]
    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/rendu.py --input <base.glb> --element <a.glb> [--element <b.glb>] \\
        --preset sorcier [--clip Hampe_Repos_Loop --image 20] [--illustration <illustration.png>] [--cadre 0,0.02,0.62,1.2] --output <dossier vide>
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
from script_node import lancer  # noqa: E402

DEPOT = Path(__file__).resolve().parents[2]
DONNEES = DEPOT / 'src' / 'data'
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


VERS_BLENDER = ((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1))
"""Du repère glTF (Y haut) à celui de Blender (Z haut), comme l'import glTF de Blender."""


def poses_des_ranges(base, manifeste, elements, preset, silhouettes, clip=None, t=0):
    """Par GLB d'`elements`, `None` ou `{ligne, meshes}` : par nom de nœud, la transformation glTF (16 nombres, colonne
    par colonne) où le jeu range ce mesh sous le `preset`, `None` s'il ne le montre pas rangé, au repos ou à l'instant
    `t` du `clip` (`hotes/godot/asset/posesDesRanges.mjs`). Une ligne du preset sans GLB donné se dit sur la sortie
    d'erreur."""
    demande = {'base': str(base), 'manifeste': str(manifeste), 'elements': [str(e) for e in elements], 'preset': preset,
               'silhouettes': silhouettes, **({'clip': clip, 't': t} if clip else {})}
    reponse = json.loads(lancer(DEPOT / 'hotes' / 'godot' / 'asset' / 'posesDesRanges.mjs', [], json.dumps(demande)))
    if reponse['sans']:
        print(f"--preset {preset} : ligne(s) montée(s) par le jeu sans --element répété : {', '.join(reponse['sans'])}", file=sys.stderr)
    return reponse['elements']


def ranger(elements, poses):
    """Pose chaque mesh rigide des `(objets importés, manifeste)` d'`elements` que `poses` range (`poses_des_ranges`) à sa
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


def palette(preset, races, matieres):
    """La palette du `preset` de personnage, comme le noyau la compose (`porteeDeComposition`, #4379) :
    `{emplacement: couleur linéaire (r, g, b)}`, les couleurs de sa race de `races` (`raceAppearance.json`), chacune
    remplacée par la sienne, résolues au nuancier de `matieres` (`materials.json`)."""
    race = next(r for r in races if r['id'] == preset['race']['id'])
    nuancier = {m['id']: m['color'] for m in matieres if m.get('domain') == 'couleur'}
    couleurs = {**race.get('couleurs', {}), **preset.get('couleurs', {})}
    return {slot: couleur_lineaire(nuancier[couleur['id']]) for slot, couleur in couleurs.items()}


def palette_du_preset(id_):
    """`palette` du preset de personnage `id_` sur les données du dépôt."""
    def lire(fichier):
        return json.loads((DONNEES / fichier).read_text(encoding='utf-8'))
    preset = next((p for p in lire('presets-de-personnage.json') if p['id'] == id_), None)
    if preset is None:
        raise ValueError(f'--preset {id_} : aucun preset de personnage de cet id')
    return palette(preset, lire('raceAppearance.json'), lire('materials.json'))


def colorer(objets, surfaces, palette):
    """Pose sur la couleur de base de chaque matériau des `objets` d'un modèle (la base ou un élément) la couleur de
    `palette` à l'emplacement que lui donnent les `surfaces` de ce modèle (`{nom du matériau: emplacement}`), car deux
    éléments peuvent nommer pareil des matériaux d'emplacements différents ; un matériau sans emplacement ou dont la palette ne colore pas
    l'emplacement garde la sienne."""
    for obj in objets:
        for slot in obj.material_slots if obj.type == 'MESH' else []:
            couleur = palette.get(surfaces.get(slot.material.name.split('.')[0])) if slot.material else None
            principled = next((n for n in slot.material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if couleur else None
            if principled:
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
    parser.add_argument('--cadre', type=lire_cadre, help='x,y,z,étendue : centre et étendue cadrés au lieu de ceux du modèle')
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
        palette = palette_du_preset(args.preset) if args.preset else {}
        for objets, manifeste in [(base, manifeste_voisin(source))] + elements:
            colorer(objets, {s['nom']: s['palette'] for s in manifeste.get('surfaces', [])}, palette)
        for objets, manifeste in elements:
            habiller_le_modele(bpy, objets, manifeste, None, True, palette)
        if args.clip:
            action = bpy.data.actions.get(args.clip)
            if action is None:
                raise ValueError(f'--clip {args.clip} : clips de la base {sorted(a.name for a in bpy.data.actions)}')
            rig.animation_data_create()
            rig.animation_data.action = action
            if action.slots:
                rig.animation_data.action_slot = action.slots[0]
            bpy.context.scene.frame_set(args.image)
        if args.preset and args.element:
            # io_scene_gltf2/blender/imp/animation_node.py : l'import pose la clé de l'instant t à l'image t × fps × fps_base.
            cadence = bpy.context.scene.render.fps * bpy.context.scene.render.fps_base
            instant = {'clip': args.clip, 't': args.image / cadence} if args.clip else {}
            ranger(elements, poses_des_ranges(source, chemin, [Path(glb).resolve(strict=True) for glb in args.element], args.preset,
                                              args.silhouettes, **instant))
            bpy.context.view_layer.update()
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
    cible, etendue = (Vector(args.cadre[:3]), args.cadre[3]) if args.cadre else (center, extent)
    if args.isometric_only:
        report['camera_elevation_degrees'] = 45
        report['camera_direction'] = [1, -1, 2 ** 0.5]
        for size in (512, 40, 64, 128):
            render('isometrique-' + str(size) + 'px.png', (1, -1, 2 ** 0.5), cible, etendue * 1.12, size, size)
    else:
        render('face-trois-quarts.png', (0.65, -1, 0.17), cible, etendue * 1.12, 1000, 1200)
        render('dos-trois-quarts.png', (-0.65, 1, 0.17), cible, etendue * 1.12, 1000, 1200)
        if skinned:
            render('face.png', (0, -1, 0.05), cible, etendue * 1.12, 1000, 1200)
            render('dos.png', (0, 1, 0.05), cible, etendue * 1.12, 1000, 1200)
            if args.illustration:
                planche(bpy, [args.illustration.resolve(strict=True)] + [output / v for v in ('face.png', 'face-trois-quarts.png', 'dos.png')],
                        output / 'planche.png')
            portrait_target = Vector((center.x, center.y, low.z + height * 0.86))
            render('portrait.png', (0.3, -1, 0.05), portrait_target, height * 0.32, 768, 768)
        for size in (40, 64, 128):
            render('echelle-' + str(size) + 'px.png', (0.65, -1, 0.17), cible, etendue * 1.12, round(size * 1000 / 1200), size)
    report['elapsed_seconds'] = time.monotonic() - start
    report['sha256_after'] = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != report['sha256_after']:
        raise RuntimeError('Source changed')
    (output / 'render-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('DONE', output, flush=True)
    bpy.ops.wm.quit_blender()


if __name__ == '__main__':
    main()
