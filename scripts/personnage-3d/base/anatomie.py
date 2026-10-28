"""Zones, emplacements et prises de la base humanoïde (#2972, lot B2), posés sur le corps UBC skinné au squelette UAL.

- Zone : chaque face du corps reçoit la zone de son os dominant (`ZONE_DE_L_OS`), puis les régions `genou`, `visage`
  et `nez` se découpent autour du genou et du centre des yeux (`GENOU_DEMI_HAUTEUR`, `VISAGE_AVANT`, `VISAGE_HAUT`,
  `NEZ`) ; un mesh par zone, `extras.zone` sur son nœud.
- Emplacement : un point de la peau au repos, trouvé par un rayon (`surface_hit`), ou sur l'axe de l'os pour le
  poignet ; son repère a, au repos, les axes du personnage (glTF : +X sa gauche, +Y le haut, +Z l'avant).
- Prise : le centre du creux du poing fermé d'un clip (`POING`), par l'ajustement d'un cercle sur chaque doigt replié ;
  +Y suit l'axe de la poignée de l'auriculaire vers l'index, +Z va du poignet vers les jointures.

Une attache est exprimée dans le repère de son os : position en mètres, rotation en radians, ordre XYZ de three
(R = Rx·Ry·Rz, l'Euler `ZYX` de Blender).
"""
import bpy
import bmesh
import numpy
from mathutils import Matrix, Vector

from animation import assign_action
from geometrie import surface_hit, surface_tree

ZONES = ('tete', 'visage', 'nez', 'oeil_g', 'oeil_d', 'cou', 'torse', 'hanches',
         'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d', 'main_g', 'main_d',
         'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d', 'mollet_g', 'mollet_d', 'pied_g', 'pied_d')
"""Les zones de la base, valeurs de `couvre`, dans l'ordre du manifeste."""

ZONE_DE_L_OS = {
    'Head': 'tete', 'neck': 'cou', 'spine': 'torse', 'clavicle': 'torse', 'pelvis': 'hanches',
    'upperarm': 'bras_haut', 'lowerarm': 'avant_bras', 'hand': 'main', 'thumb': 'main', 'index': 'main',
    'middle': 'main', 'ring': 'main', 'pinky': 'main', 'thigh': 'cuisse', 'calf': 'mollet', 'foot': 'pied', 'ball': 'pied',
}
"""Par préfixe d'os UAL (avant le premier `_`), sa zone ; latéralisée par le suffixe `_l`/`_r` de l'os."""

GENOU_DEMI_HAUTEUR = 0.05
"""Demi-hauteur, en mètres, de la bande du genou autour de l'articulation cuisse/mollet."""
VISAGE_AVANT = 0.045
"""Profondeur, en mètres, du visage derrière le centre des yeux."""
VISAGE_HAUT = 0.05
"""Hauteur, en mètres, du haut du visage au-dessus du centre des yeux."""
NEZ = {'demi_largeur': 0.02, 'bas': 0.052, 'avant': 0.025}
"""Le nez : demi-largeur, hauteur sous le centre des yeux, saillie minimale devant lui, en mètres."""
NORMALE_DE_COUTURE = 'normale_de_couture'
"""Attribut de coin, temporaire, qui porte la normale d'avant la découpe en zones."""

EMPLACEMENTS = {
    'tete': ('Head', 0.0, (0, 0, -1)),
    'visage': ('Head', 'yeux', (0, 1, 0)),
    'cou': ('neck_01', 0.5, (0, 1, 0)),
    'epaule_g': ('upperarm_l', 0.15, (0, 0, -1)),
    'epaule_d': ('upperarm_r', 0.15, (0, 0, -1)),
    'dos': ('spine_03', 0.5, (0, -1, 0)),
    'ceinture_g': ('pelvis', 1.0, (-1, 0, 0)),
    'ceinture_d': ('pelvis', 1.0, (1, 0, 0)),
    'ceinture_avant': ('pelvis', 1.0, (0, 1, 0)),
    'ceinture_arriere': ('pelvis', 1.0, (0, -1, 0)),
    'cuisse_g': ('thigh_l', 0.35, (-1, 0, 0)),
    'cuisse_d': ('thigh_r', 0.35, (1, 0, 0)),
    'genou_g': ('calf_l', 0.0, (0, 1, 0)),
    'genou_d': ('calf_r', 0.0, (0, 1, 0)),
    'poignet_g': ('lowerarm_l', 1.0, None),
    'poignet_d': ('lowerarm_r', 1.0, None),
}
"""Par emplacement : son os, l'ancre (fraction de l'os de la tête à la queue, ou `yeux`) et la direction du rayon qui
cherche la peau en venant de l'extérieur, dans le repère Blender (+X gauche, −Y avant, +Z haut) ; sans direction,
l'emplacement est sur l'axe de l'os."""

POING = {'main': ('r', 'Sword_Idle', 8), 'off': ('l', 'Idle_Shield_Loop', 44)}
"""Par prise : le côté de la main, le clip et l'image où le poing fermé tient sa poignée."""
DOIGTS_DU_POING = ('index', 'middle', 'ring', 'pinky')

AXES_DU_PERSONNAGE = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
"""Les axes glTF du personnage (+X, +Y, +Z en colonnes) dans le repère Blender."""


def zone_de_l_os(nom):
    prefixe = nom.split('_')[0]
    if prefixe not in ZONE_DE_L_OS:
        raise RuntimeError(f'os « {nom} » : aucune zone')
    zone = ZONE_DE_L_OS[prefixe]
    cote = {'l': 'g', 'r': 'd'}.get(nom.rsplit('_', 1)[-1]) if '_' in nom else None
    return f'{zone}_{cote}' if cote and f'{zone}_{cote}' in ZONES else zone


def yeux(objets):
    """Le centre des deux yeux, au repos, dans le repère Blender."""
    sommets = [v.co for v in objets['Eyes'].data.vertices]
    return sum(sommets, Vector()) / len(sommets)


def zones_des_faces(objet, centre_des_yeux, rig):
    """La zone de chaque face du corps : os dominant de ses sommets, puis régions du genou, du visage et du nez."""
    groupes = {g.index: g.name for g in objet.vertex_groups}
    dominant = [groupes[max(v.groups, key=lambda g: g.weight).group] if v.groups else None for v in objet.data.vertices]
    genoux = {cote: rig.data.bones[f'calf_{cote}'].head_local.z for cote in 'lr'}
    zones = []
    for face in objet.data.polygons:
        votes = [dominant[i] for i in face.vertices]
        if None in votes:
            raise RuntimeError(f'{objet.name} : face {face.index} sur un sommet sans os')
        os = max(sorted(set(votes)), key=votes.count)
        zone, c = zone_de_l_os(os), face.center
        if zone.startswith(('cuisse_', 'mollet_')) and abs(c.z - genoux[os[-1]]) <= GENOU_DEMI_HAUTEUR:
            zone = 'genou_' + zone[-1]
        elif zone == 'tete' and c.y < centre_des_yeux.y + VISAGE_AVANT and c.z <= centre_des_yeux.z + VISAGE_HAUT:
            nez = (abs(c.x) <= NEZ['demi_largeur'] and centre_des_yeux.z - NEZ['bas'] <= c.z <= centre_des_yeux.z
                   and c.y < centre_des_yeux.y - NEZ['avant'])
            zone = 'nez' if nez else 'visage'
        zones.append(zone)
    return zones


def scinder(objet, zones):
    """Un objet par zone de `zones` (une par face), copie de `objet` réduite à ses faces ; `objet` est retiré. Chaque coin
    garde sa normale d'avant la découpe, posée en normale personnalisée : la couture entre deux zones ne se voit pas."""
    normales = objet.data.attributes.new(NORMALE_DE_COUTURE, 'FLOAT_VECTOR', 'CORNER')
    normales.data.foreach_set('vector', [c for n in objet.data.corner_normals for c in n.vector])
    morceaux = []
    for zone in sorted(set(zones), key=ZONES.index):
        copie = objet.copy()
        copie.data = objet.data.copy()
        for collection in objet.users_collection:
            collection.objects.link(copie)
        bm = bmesh.new()
        bm.from_mesh(copie.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f, z in zip(bm.faces, zones) if z != zone], context='FACES')
        bm.to_mesh(copie.data)
        bm.free()
        gardees = copie.data.attributes[NORMALE_DE_COUTURE]
        copie.data.normals_split_custom_set([tuple(c.vector) for c in gardees.data])
        copie.data.attributes.remove(gardees)
        copie.name = copie.data.name = f'{objet.name}-{zone}'
        copie['zone'] = zone
        morceaux.append(copie)
    bpy.data.objects.remove(objet, do_unlink=True)
    return morceaux


def poser_zones(rig, objets, corps, centre_des_yeux):
    """Remplace les peaux `objets` (par nom) par un mesh par zone, et les rend."""
    meshes = scinder(corps, zones_des_faces(corps, centre_des_yeux, rig))
    meshes += scinder(objets['Eyes'], ['oeil_g' if f.center.x > 0 else 'oeil_d' for f in objets['Eyes'].data.polygons])
    meshes += scinder(objets['Eyebrows'], ['visage'] * len(objets['Eyebrows'].data.polygons))
    absentes = [z for z in ZONES if not any(m['zone'] == z for m in meshes)]
    if absentes:
        raise RuntimeError(f'zones sans face : {", ".join(absentes)}')
    for m in meshes:
        print('ZONE', m['zone'], m.name, len(m.data.polygons), flush=True)
    return meshes


def attache(os_matrice, repere):
    """L'attache du repère `repere` (4×4, repère Blender) dans le repère de l'os de matrice `os_matrice`."""
    local = os_matrice.inverted() @ repere
    euler = local.to_3x3().to_euler('ZYX')
    return {'position': [round(v, 6) for v in local.translation], 'rotation': [round(v, 6) for v in (euler.x, euler.y, euler.z)]}


def poser_emplacements(rig, corps, centre_des_yeux):
    """Les emplacements de la base, au repos, sur la peau de `corps` (le corps entier, avant découpe)."""
    arbre = surface_tree(corps)
    axes = AXES_DU_PERSONNAGE.to_4x4()
    emplacements = {}
    for nom, (os, ancre, direction) in EMPLACEMENTS.items():
        bone = rig.data.bones[os]
        point = centre_des_yeux.copy() if ancre == 'yeux' else bone.head_local.lerp(bone.tail_local, ancre)
        if direction is not None:
            d = Vector(direction)
            point, _ = surface_hit(arbre, point - d, d)
        repere = Matrix.Translation(point) @ axes
        emplacements[nom] = {'os': os, **attache(bone.matrix_local, repere)}
        print('EMPLACEMENT', nom, os, tuple(round(v, 4) for v in point), flush=True)
    return emplacements


def cercle(points, axe):
    """Le centre et le rayon du cercle ajusté (moindres carrés de Kåsa) aux `points` projetés hors de `axe`."""
    moyen = sum(points, Vector()) / len(points)
    u = axe.orthogonal().normalized()
    v = axe.cross(u).normalized()
    plan = [((p - moyen).dot(u), (p - moyen).dot(v)) for p in points]
    a = numpy.array([[x, y, 1.0] for x, y in plan])
    b = numpy.array([-(x * x + y * y) for x, y in plan])
    d, e, f = numpy.linalg.lstsq(a, b, rcond=None)[0]
    cx, cy = -d / 2, -e / 2
    return moyen + u * cx + v * cy, float(numpy.sqrt(max(cx * cx + cy * cy - f, 0.0)))


def poser_prises(rig):
    """Les prises `main` et `off`, chacune au creux du poing fermé de son clip (`POING`) ; l'action du rig reste celle
    du dernier poing."""
    prises, scene = {}, bpy.context.scene
    image = scene.frame_current
    for prise, (cote, clip, image_du_poing) in POING.items():
        assign_action(rig, bpy.data.actions[clip])
        scene.frame_set(image_du_poing)
        pose = rig.pose.bones
        main = pose[f'hand_{cote}']
        jointures = [pose[f'{d}_01_{cote}'].head for d in DOIGTS_DU_POING]
        axe = (jointures[0] - jointures[-1]).normalized()
        centres = []
        for d in DOIGTS_DU_POING:
            points = [pose[f'{d}_0{i}_{cote}'].head for i in (1, 2, 3)] + [pose[f'{d}_04_leaf_{cote}'].head, pose[f'{d}_04_leaf_{cote}'].tail]
            centre, rayon = cercle([p.copy() for p in points], axe)
            centres.append(centre)
            print('PRISE', prise, d, 'rayon', round(rayon, 4), flush=True)
        creux = sum(centres, Vector()) / len(centres)
        y = (centres[0] - centres[-1]).normalized()
        z = (sum(jointures, Vector()) / len(jointures) - main.head)
        z = (z - y * z.dot(y)).normalized()
        repere = Matrix((y.cross(z), y, z)).transposed().to_4x4()
        repere.translation = creux
        prises[prise] = {'os': main.name, **attache(main.matrix, repere)}
        print('PRISE', prise, clip, image_du_poing, main.name, tuple(round(v, 4) for v in creux), flush=True)
    scene.frame_set(image)
    return prises


def poser(rig, peaux):
    """Pose emplacements, prises et zones de la base sur les peaux `peaux` du rig, clips déjà préparés ; rend leur part
    du manifeste de base."""
    objets = {o.name: o for o in peaux}
    for o in peaux:
        if o.matrix_world != Matrix.Identity(4):
            raise RuntimeError(f'{o.name} : transformation non identité, les repères supposent le repère du rig')
    centre = yeux(objets)
    corps = next(o for o in peaux if o.name not in ('Eyes', 'Eyebrows'))
    emplacements = poser_emplacements(rig, corps, centre)
    prises = poser_prises(rig)
    poser_zones(rig, objets, corps, centre)
    return {'zones': list(ZONES), 'emplacements': emplacements, 'prises': prises}
