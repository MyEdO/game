"""Chaînes d'appendice de la base humanoïde et leurs pistes au repos (#3102 ; #2972, commentaire 6389032417,
« Appendices »). La jupe et la cape sont des filets, posés et drapés sur le GLB exporté (`filets.py`).

`ajouter_chaines` pose, après la correction des poids, les os des chaînes `queue`, `ailes`, `bras_sup` et `cou_long`,
chacun ancré sur le corps au repos (bande horizontale de sommets autour d'une hauteur d'os) ; aucun sommet de la base ne
les pondère. `cuire_chaines` écrit dans chaque clip une piste de rotation LINEAR par os de chaîne, au repos sous l'os qui
le porte.
Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du personnage.
"""
import math

from mathutils import Quaternion, Vector

from animation import assign_action, clear_animation
from pistes import sacs
from sol import ecrire

BANDE_M = 0.02
"""Demi-hauteur, en mètres, de la bande de sommets du corps qui ancre un brin."""
JEU_M = 0.03
"""Écart, en mètres, entre la peau au repos et la racine d'un brin."""

SEGMENTS = {'queue': 4, 'ailes': 3, 'bras_sup': 3, 'cou_long': 2}
"""Os par brin de chaque chaîne."""
QUEUE = Vector((0.0, 0.5, -0.45))
"""De sa racine au bout, la queue au repos, en mètres."""
AILE = Vector((0.55, 0.12, 0.3))
"""De sa racine au bout, l'aile gauche au repos, en mètres ; l'aile droite en est le miroir en X."""
MAIN_SUP_M = 0.08
"""Longueur, en mètres, de l'os de main d'un bras supérieur."""
BRAS_SUP_SOUS_M = 0.12
"""Hauteur, en mètres, de la racine d'un bras supérieur sous celle du bras."""
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
    arriere = max(p.y for p in _bande(points, tete['thigh_l'].z)) + JEU_M
    epaule = tete['clavicle_l'].z
    plan = {}
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


def _ecrire_pistes(action, pistes):
    """Écrit dans `action` les pistes `pistes` : par os, `(images, quaternions)`, une courbe LINEAR par composante."""
    sac, = sacs(action)
    for nom, (images, quaternions) in pistes.items():
        chemin = f'pose.bones["{nom}"].rotation_quaternion'
        for i in range(4):
            courbe = sac.fcurves.find(chemin, index=i) or sac.fcurves.new(chemin, index=i)
            ecrire(courbe, [(t, q[i]) for t, q in zip(images, quaternions)])


def cuire_chaines(bpy, rig, clips, chaines):
    """Écrit dans chaque clip de `clips` la piste de rotation de chaque os de `chaines`, au repos aux deux bouts du clip."""
    tous = [nom for noms in chaines.values() for nom in noms]
    for nom in tous:
        rig.pose.bones[nom].rotation_mode = 'QUATERNION'
    identite = Quaternion()
    for action in clips:
        assign_action(rig, action)
        debut, fin = action.frame_range
        bouts = [math.floor(debut), math.ceil(fin)]
        _ecrire_pistes(action, {nom: (bouts, [identite, identite]) for nom in tous})
        clear_animation(rig)
