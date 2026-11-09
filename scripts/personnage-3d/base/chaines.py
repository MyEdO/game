"""Chaînes d'appendice de la base humanoïde et leurs pistes cuites (#3102 ; #2972, commentaire 6389032417, « Appendices »).

`ajouter_chaines` pose, après la correction des poids, les os des six chaînes du design, chacun ancré sur le corps au
repos (bande horizontale de sommets autour d'une hauteur d'os) ; aucun sommet de la base ne les pondère.
`cuire_chaines` écrit dans chaque clip une piste de rotation LINEAR par os de chaîne, image par image :
- `jupe` : pend à la verticale ; le brin avant suit la cuisse la plus avancée, l'arrière la plus reculée, chaque côté
  l'écart de sa cuisse, angles pris dans l'armature, quelle que soit l'inclinaison du bassin ;
- `cape` : pend selon la gravité quand le dos se penche en arrière, couchée sur le dos sinon ;
- `queue`, `ailes`, `bras_sup`, `cou_long` : au repos, sous l'os qui les porte.
Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du personnage.
"""
import math

from mathutils import Matrix, Quaternion, Vector

from animation import assign_action, clear_animation
from pistes import sacs
from sol import ecrire

BANDE_M = 0.02
"""Demi-hauteur, en mètres, de la bande de sommets du corps qui ancre un brin."""
JEU_M = 0.03
"""Écart, en mètres, entre la peau au repos et la racine d'un brin."""
CHEVILLE_M = 0.1
"""Hauteur, en mètres, au-dessus de la cheville où finissent les brins de jupe."""

BRINS_DE_JUPE = ('avant', 'arriere', 'g', 'd')
SEGMENTS = {'jupe': 3, 'cape': 4, 'queue': 4, 'ailes': 3, 'bras_sup': 3, 'cou_long': 2}
"""Os par brin de chaque chaîne."""
QUEUE = Vector((0.0, 0.5, -0.45))
"""De sa racine au bout, la queue au repos, en mètres."""
AILE = Vector((0.55, 0.12, 0.3))
"""De sa racine au bout, l'aile gauche au repos, en mètres ; l'aile droite en est le miroir en X."""
MAIN_SUP_M = 0.08
"""Longueur, en mètres, de l'os de main d'un bras supérieur."""
BRAS_SUP_SOUS_M = 0.12
"""Hauteur, en mètres, de la racine d'un bras supérieur sous celle du bras."""
CAPE_SOUS_M = 0.03
"""Hauteur, en mètres, de la racine de la cape sous celle des clavicules."""
AILE_SOUS_M = 0.08
"""Hauteur, en mètres, de la racine des ailes sous celle des clavicules."""
AILE_ECART_M = 0.08
"""Écart latéral, en mètres, de la racine d'une aile à l'axe du dos."""


def _bande(points, z):
    return [p for p in points if abs(p.z - z) <= BANDE_M]


def _brin(depart, arrivee, n):
    return [(depart.lerp(arrivee, i / n), depart.lerp(arrivee, (i + 1) / n)) for i in range(n)]


def plan_des_chaines(os, points):
    """Le plan des chaînes : par chaîne, ses brins, chacun `(parent, [(nom, tête, queue)…])`, en repère de l'armature.
    `os` : par nom, `(tête, queue)` de l'os au repos ; `points` : les sommets du corps au repos."""
    tete = {n: Vector(t) for n, (t, _) in os.items()}
    queue = {n: Vector(q) for n, (_, q) in os.items()}
    hanche = tete['thigh_l'].z
    hanches = _bande(points, hanche)
    avant, arriere = min(p.y for p in hanches) - JEU_M, max(p.y for p in hanches) + JEU_M
    cote = max(abs(p.x) for p in hanches) + JEU_M
    bas = queue['calf_l'].z + CHEVILLE_M
    jupe = {'avant': Vector((0.0, avant, hanche)), 'arriere': Vector((0.0, arriere, hanche)),
            'g': Vector((cote, 0.0, hanche)), 'd': Vector((-cote, 0.0, hanche))}
    plan = {'jupe': [('pelvis', [(f'jupe_{b}_{i + 1:02d}', *s) for i, s in enumerate(
        _brin(jupe[b], Vector((jupe[b].x, jupe[b].y, bas)), SEGMENTS['jupe']))]) for b in BRINS_DE_JUPE]}
    epaule = tete['clavicle_l'].z
    dos = max(p.y for p in _bande(points, epaule - CAPE_SOUS_M)) + JEU_M
    cape = Vector((0.0, dos, epaule - CAPE_SOUS_M))
    plan['cape'] = [('spine_03', [(f'cape_{i + 1:02d}', *s) for i, s in enumerate(
        _brin(cape, Vector((0.0, dos, tete['calf_l'].z)), SEGMENTS['cape']))])]
    racine_queue = Vector((0.0, arriere, tete['pelvis'].z))
    plan['queue'] = [('pelvis', [(f'queue_{i + 1:02d}', *s) for i, s in enumerate(
        _brin(racine_queue, racine_queue + QUEUE, SEGMENTS['queue']))])]
    omoplates = max(p.y for p in _bande(points, epaule - AILE_SOUS_M)) + JEU_M
    plan['ailes'] = []
    plan['bras_sup'] = []
    for cote_, signe in (('g', 1.0), ('d', -1.0)):
        miroir = Vector((signe, 1.0, 1.0))
        racine = Vector((signe * AILE_ECART_M, omoplates, epaule - AILE_SOUS_M))
        plan['ailes'].append(('spine_03', [(f'aile_{cote_}_{i + 1:02d}', *s) for i, s in enumerate(
            _brin(racine, racine + AILE * miroir, SEGMENTS['ailes']))]))
        suffixe = 'l' if cote_ == 'g' else 'r'
        bras, avant_bras = f'upperarm_{suffixe}', f'lowerarm_{suffixe}'
        epaule_sup = tete[bras] - Vector((0.0, 0.0, BRAS_SUP_SOUS_M))
        coude = epaule_sup + (queue[bras] - tete[bras])
        poignet = coude + (queue[avant_bras] - tete[avant_bras])
        main = poignet + (queue[avant_bras] - tete[avant_bras]).normalized() * MAIN_SUP_M
        plan['bras_sup'].append((f'clavicle_{suffixe}', [
            (f'bras_sup_{cote_}_01', epaule_sup, coude), (f'bras_sup_{cote_}_02', coude, poignet),
            (f'bras_sup_{cote_}_03', poignet, main)]))
    plan['cou_long'] = [('neck_01', [(f'cou_long_{i + 1:02d}', *s) for i, s in enumerate(
        _brin(tete['neck_01'], tete['Head'], SEGMENTS['cou_long']))])]
    return plan


def ajouter_chaines(bpy, rig, corps):
    """Pose les os des chaînes sur `rig` d'après `corps` au repos ; rend le manifeste `chaines`, lu de la scène."""
    monde = rig.matrix_world
    os = {b.name: (monde @ b.head_local, monde @ b.tail_local) for b in rig.data.bones}
    points = [corps.matrix_world @ v.co for v in corps.data.vertices]
    plan = plan_des_chaines(os, points)
    inverse = monde.inverted()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for brins in plan.values():
        for parent, segments in brins:
            precedent = rig.data.edit_bones[parent]
            for i, (nom, debut, fin) in enumerate(segments):
                os_ = rig.data.edit_bones.new(nom)
                os_.head, os_.tail = inverse @ debut, inverse @ fin
                os_.parent = precedent
                os_.use_connect = i > 0
                os_.use_deform = True
                precedent = os_
    bpy.ops.object.mode_set(mode='OBJECT')
    return chaines_de_la_scene(rig, plan)


def chaines_de_la_scene(rig, plan):
    """Le manifeste `chaines` : par chaîne du plan, les os que `rig` porte, dans l'ordre des brins."""
    return {chaine: [nom for _, segments in brins for nom, _, _ in segments if nom in rig.data.bones]
            for chaine, brins in plan.items()}


def _retour_au_repos(pose, repos):
    """La rotation qui ramène l'armature d'un os posé `pose` à son repos `repos` : un vecteur ou une rotation de
    l'armature, composé à gauche, s'y exprime dans le repère de l'os au repos."""
    return repos.to_3x3() @ pose.to_3x3().inverted()


def angles_de_cuisse(direction, cote):
    """Sous la direction `direction` d'une cuisse (repère de l'armature), son avancée vers -Y et son écart vers
    l'extérieur (`cote` : +1 à gauche, -1 à droite), en radians, depuis la verticale."""
    bas = -direction.z
    return math.atan2(-direction.y, bas), math.atan2(cote * direction.x, bas)


def rotation_du_brin(os_repos, rotation):
    """La rotation de pose d'un os de repos `os_repos` (3×3, repère de l'armature) qui le tourne de `rotation` (repère
    de son parent au repos) autour de sa tête."""
    repos = os_repos.to_3x3()
    return (repos.inverted() @ rotation @ repos).to_quaternion()


def rotations_de_jupe(cuisses):
    """Par brin de jupe, sa rotation dans l'armature, sous `cuisses` : par côté (`g`, `d`), `(avancée, écart)`."""
    avance = max(0.0, *(a for a, _ in cuisses.values()))
    recule = max(0.0, *(-a for a, _ in cuisses.values()))
    return {'avant': Matrix.Rotation(-avance, 3, 'X'), 'arriere': Matrix.Rotation(recule, 3, 'X'),
            'g': Matrix.Rotation(max(0.0, cuisses['g'][1]), 3, 'Y'),
            'd': Matrix.Rotation(-max(0.0, cuisses['d'][1]), 3, 'Y')}


def rotation_de_cape(dos_pose, dos_repos, cape_repos):
    """La rotation de la cape au repos du dos : vers la gravité si elle l'écarte du dos (+Y), l'identité sinon."""
    gravite = _retour_au_repos(dos_pose, dos_repos) @ Vector((0.0, 0.0, -1.0))
    if gravite.y <= cape_repos.y:
        return Matrix.Identity(3)
    return cape_repos.rotation_difference(gravite).to_matrix()


def _ecrire_pistes(action, pistes):
    """Écrit dans `action` les pistes `pistes` : par os, `(images, quaternions)`, une courbe LINEAR par composante."""
    sac, = sacs(action)
    for nom, (images, quaternions) in pistes.items():
        chemin = f'pose.bones["{nom}"].rotation_quaternion'
        for i in range(4):
            courbe = sac.fcurves.find(chemin, index=i) or sac.fcurves.new(chemin, index=i)
            ecrire(courbe, [(t, q[i]) for t, q in zip(images, quaternions)])


def cuire_chaines(bpy, rig, clips, chaines):
    """Écrit dans chaque clip de `clips` la piste de rotation de chaque os de `chaines` : image par image pour la racine
    de chaque brin de jupe et de la cape, au repos aux deux bouts du clip pour les autres."""
    repos = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    tous = [nom for noms in chaines.values() for nom in noms]
    animes = [f'jupe_{b}_01' for b in BRINS_DE_JUPE] + ['cape_01']
    for nom in tous:
        rig.pose.bones[nom].rotation_mode = 'QUATERNION'
    cape_dir = (repos['cape_01'].to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
    cuisses_repos = {os_: angles_de_cuisse(repos[os_].to_3x3() @ Vector((0.0, 1.0, 0.0)), signe)
                     for os_, signe in (('thigh_l', 1.0), ('thigh_r', -1.0))}
    scene = bpy.context.scene
    for action in clips:
        assign_action(rig, action)
        debut, fin = action.frame_range
        images = list(range(math.floor(debut), math.ceil(fin) + 1))
        pistes = {nom: (images, []) for nom in animes}
        for image in images:
            scene.frame_set(image)
            cuisses = {}
            for cote, os_, signe in (('g', 'thigh_l', 1.0), ('d', 'thigh_r', -1.0)):
                b = rig.pose.bones[os_]
                avance, ecart = angles_de_cuisse(b.tail - b.head, signe)
                cuisses[cote] = (avance - cuisses_repos[os_][0], ecart - cuisses_repos[os_][1])
            jupe = rotations_de_jupe(cuisses)
            bassin = _retour_au_repos(rig.pose.bones['pelvis'].matrix, repos['pelvis'])
            for brin in BRINS_DE_JUPE:
                nom = f'jupe_{brin}_01'
                pistes[nom][1].append(rotation_du_brin(repos[nom], bassin @ jupe[brin]))
            cape = rotation_de_cape(rig.pose.bones['spine_03'].matrix, repos['spine_03'], cape_dir)
            pistes['cape_01'][1].append(rotation_du_brin(repos['cape_01'], cape))
        identite = Quaternion()
        for nom in tous:
            if nom not in pistes:
                pistes[nom] = ([images[0], images[-1]], [identite, identite])
        _ecrire_pistes(action, pistes)
        clear_animation(rig)
