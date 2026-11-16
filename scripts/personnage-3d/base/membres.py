"""Les bras des clips du pack de la base humanoïde hors du tronc (#3810) : dans chaque clip, la peau de l'avant-bras et
de la main de chaque bras (`tronc.peau_du_membre`) se tient à `ecart.ECART_DU_TRONC['marge']` hors du tronc sous chaque
jeu de `tronc.TRONC`, les os déplacés comme l'hôte les joue, mesurée comme la mesure la garde `membres` (`tronc`).

Chaque bras se corrige seul, de deux grandeurs ≥ 0, chacune enveloppée dans le temps (`ecart.envelopper`,
`ecart.RACCORD`) : l'avancée de la main le long de l'avant du tronc posé (`tronc.avant`), la main gardant son orientation,
le bras reposé par IK à deux os (`tronc.coude`) dans le plan du coude de la pose source ; l'écart du coude, tourné autour
de l'axe épaule-poignet, du côté qui l'éloigne de l'axe du tronc (`poses_du_bras`), la main inchangée. Une image requiert
d'abord l'avancée qui sort la peau de la main, portée d'un bloc (`ecart.poussee_requise`), puis, le bras posé à cette
avancée, le plus petit écart du coude qui sort la peau entière ; si aucun écart ne suffit, l'avancée se relève d'un pas
tant qu'elle enfonce moins la peau (`requis`, `ECART_DU_COUDE`, `ecart.POUSSEE`).

La clavicule et le dos restent ceux du clip ; la passe écrit les rotations du bras, de l'avant-bras et de la main aux
instants du clip (`poids.instants`) où l'une des grandeurs enveloppées n'est pas nulle, et ne touche pas les courbes
ailleurs. Une peau qui reste dans le tronc ne retire pas le clip de la base (#3810) : elle se rend sur la ligne
`MEMBRES` du clip.

Le champ du tronc posé (`tronc.champs_du_tronc`) ne se calcule qu'aux images où l'échantillon grossier de la peau d'un
bras, élargi de son rayon, peut toucher le tronc à la marge (`pres`, `tronc.pres_du_tronc`).

Repère Blender du rig : +X la gauche du personnage, −Y l'avant, +Z le haut.
"""
import math
import time
from typing import NamedTuple

import numpy
from mathutils import Matrix, Quaternion, Vector

from anatomie import zone_de_l_os
from animation import assign_action, meshes_for
from ecart import ECART_DU_TRONC, POUSSEE, envelopper, poussee_requise
from pistes import aller_a
from poids import instants
from tronc import (BRAS, TRONC, avant, chaine_du_bras, champs_du_tronc, coude, matrices_de_la_chaine, membre_pose,
                   peau_du_membre, peau_du_tronc, poser_le_membre, pres_du_tronc, profondeurs, repos_de_la_chaine,
                   tetes_du_bras, tronc_pose)

ECART_DU_COUDE = {'pas': 1.0, 'borne': 45.0}
"""En degrés, l'écart du coude autour de l'axe épaule-poignet (`requis`) : cherché par pas de `pas`, jusqu'à `borne`.
Sur les 83 clips du pack de la base cfa3b34c, 26 se corrigent ; l'écart enveloppé atteint `borne` dans 11 d'entre eux et
41° à 44° dans 2 autres ; aux pires images des dix clips à reste, les bornes levées à 90° et 30 cm sortent la peau d'un
seul bras de plus, à 81°, et en laissent neuf dedans (#3810)."""


class Bras(NamedTuple):
    """Un bras d'une image (`bras_de_l_image`) : les matrices monde de son bras, de son avant-bras et de sa main
    (3, 4, 4), les axes de repos du bras sous son parent posé (3, 3), les longueurs du bras et de l'avant-bras, le repos de la chaîne (`tronc.repos_de_la_chaine`), sa
    `tronc.ChaineDuBras`, les matrices de peau de la chaîne à l'image (1, 3, 4, 4) et ses ΔJ par jeu (jeux, 1, 3, 3),
    la `tronc.MembrePose` de la peau de l'avant-bras et de la main et sa `tronc.PeauDuMembre`, par jeu la peau de la
    main posée (jeux, sommets, 3), et la zone de l'os dominant de chaque sommet de la peau du membre."""
    mondes: numpy.ndarray
    appui: numpy.ndarray
    longueurs: tuple
    repos: tuple
    chaine: object
    sources: numpy.ndarray
    tetes: numpy.ndarray
    membre: object
    peau: object
    main: numpy.ndarray
    zones: list


def bras_de_l_image(tronc, pose, courantes, chaine, repos, membre, main, zones):
    """Le `Bras` de la chaîne `chaine` (indices du bras, de l'avant-bras et de la main) sous les matrices de peau
    `courantes` (os, 4, 4), sur le `tronc.TroncPose` `pose` de `tronc` (`tronc.PeauDuTronc`) : `repos`, celui de
    `tronc.repos_de_la_chaine` ; `membre` et `main`, les `tronc.PeauDuMembre` de l'avant-bras et de la main, et de la
    main ; `zones`, celles des sommets de `membre`."""
    reposes = numpy.linalg.inv(repos[0])
    sources, tetes = courantes[chaine][None], pose.tetes[:, chaine][:, None]
    poses = [membre_pose(m, courantes, pose.tetes, tronc.deplacements, tronc.parent, chaine) for m in (membre, main)]
    longueurs = tuple(float(numpy.linalg.norm(reposes[i + 1, :3, 3] - reposes[i, :3, 3])) for i in (0, 1))
    appui = courantes[tronc.parent[chaine[0]]][:3, :3] @ reposes[0, :3, :3]
    return Bras(courantes[chaine] @ reposes, appui, longueurs, repos, chaine_du_bras(tronc, pose, chaine, repos), sources, tetes,
                poses[0], membre, poser_le_membre(poses[1], sources, tetes)[:, 0], zones)


def poses_du_bras(bras, pose, avancee, ecarts):
    """Les poses du `Bras` `bras` dont la main avance de `avancee` mètres le long de l'avant du `tronc.TroncPose` `pose`,
    son orientation gardée, le bras reposé par IK dans le plan du coude de sa pose, puis le coude tourné de chaque écart
    de `ecarts` (degrés ≥ 0) autour de l'axe épaule-poignet, du côté où le coude s'éloigne de l'axe du tronc (la droite
    du centre de ses sommets au repos du corps neutre posé, le long du haut de sa posture). Le bras et l'avant-bras
    tournent au plus court de leur direction source, le bras gardant la torsion autour de son +Y de sa rotation sous son
    parent (`bornesArticulaires` de `humanoide.json`). Rend, par écart, les matrices de peau de la chaîne (écarts, 3, 4, 4),
    les axes du bras et de l'avant-bras (écarts, 2, 3, 3) et, en `mathutils`, ces axes et le coude."""
    mondes = [Matrix(m.tolist()) for m in bras.mondes]
    epaule, articulation_source, poignet_source = (m.translation.copy() for m in mondes)
    cible = poignet_source + Vector(avant(pose)) * float(avancee)
    poignet, articulation = coude(epaule, cible, *bras.longueurs, articulation_source - epaule)
    axe = (poignet - epaule).normalized()
    centre = epaule + axe * (articulation - epaule).dot(axe)
    haut = Vector(pose.retour[2])
    eloigne = articulation - Vector(pose.positions[0].mean(axis=0))
    eloigne -= haut * eloigne.dot(haut)
    sens = 1.0 if axe.cross(articulation - centre).dot(eloigne) >= 0 else -1.0
    vers_coude = (articulation_source - epaule).normalized()
    vers_poignet = (poignet_source - articulation_source).normalized()
    appui = Matrix(bras.appui.tolist())
    torsion = Quaternion((0, 1, 0), (appui.transposed() @ mondes[0].to_3x3()).to_quaternion().to_swing_twist('Y')[1])
    matrices, axes, gestes = [], [], []
    for ecart in ecarts:
        coude_ = centre + Quaternion(axe, math.radians(sens * float(ecart))) @ (articulation - centre)
        tourne = vers_coude.rotation_difference((coude_ - epaule).normalized()).to_matrix() @ mondes[0].to_3x3()
        humerus = appui @ ((appui.transposed() @ tourne).to_quaternion().to_swing_twist('Y')[0] @ torsion).to_matrix()
        avant_bras = vers_poignet.rotation_difference((poignet - coude_).normalized()).to_matrix() @ mondes[1].to_3x3()
        matrices.append(matrices_de_la_chaine(epaule, humerus, coude_, avant_bras, mondes[2].to_3x3(), bras.repos))
        axes.append([numpy.array(humerus), numpy.array(avant_bras)])
        gestes.append((humerus, avant_bras, coude_))
    return numpy.array(matrices), numpy.array(axes), gestes


def peau_posee(bras, matrices=None, axes=None, sommets=slice(None)):
    """Par jeu et par essai, les `sommets` de la peau du membre du `Bras` `bras` (jeux, essais, sommets, 3) sous les
    `matrices` de peau de la chaîne et les `axes` de chaque essai (`poses_du_bras`), sous sa pose sans eux."""
    if matrices is None:
        return poser_le_membre(bras.membre, bras.sources, bras.tetes, sommets)
    return poser_le_membre(bras.membre, matrices, tetes_du_bras(bras.chaine, axes), sommets)


def pres(tronc, pose, bras, matrices=None, axes=None):
    """Si l'échantillon grossier de la peau du `Bras` `bras` (`peau_posee`), élargi de son rayon, peut toucher le
    `tronc.TroncPose` `pose` de `tronc` à `ECART_DU_TRONC['marge']` sous l'un de ses jeux (`tronc.pres_du_tronc`)."""
    points = peau_posee(bras, matrices, axes, bras.peau.grossier)
    return pres_du_tronc(tronc, pose, points, bras.peau.rayon + ECART_DU_TRONC['marge'])


def requis(pose, bras):
    """L'avancée, l'écart du coude et la profondeur de la peau du `Bras` `bras` qui s'ensuit dans le `tronc.TroncPose`
    `pose` (avec ses champs) : l'avancée qui sort la peau de la main (`ecart.poussee_requise`, nulle si l'avancée ne la
    sort pas), puis le plus petit écart du coude de pas `ECART_DU_COUDE['pas']`, jusqu'à sa borne, qui tient la peau
    entière à `ECART_DU_TRONC['marge']` dehors ; sans lui, l'avancée se relève de `POUSSEE['pas']`, jusqu'à
    `POUSSEE['borne']`, tant que la peau la plus enfoncée l'est moins de `POUSSEE['tolerance']`, et le couple qui
    l'enfonce le moins se rend, à cette tolérance près, de plus petit écart."""
    avancee = poussee_requise(pose, bras.main) or 0.0
    ecarts = numpy.arange(0.0, ECART_DU_COUDE['borne'] + ECART_DU_COUDE['pas'] / 2, ECART_DU_COUDE['pas'])
    meilleur = None
    while avancee <= POUSSEE['borne'] + POUSSEE['tolerance']:
        matrices, axes, _ = poses_du_bras(bras, pose, avancee, ecarts)
        pires = profondeurs(pose, peau_posee(bras, matrices, axes)).max(axis=(0, 2))
        sortis = numpy.flatnonzero(pires <= -ECART_DU_TRONC['marge'])
        if len(sortis):
            return avancee, float(ecarts[sortis[0]]), float(pires[sortis[0]])
        k = int(numpy.flatnonzero(pires <= pires.min() + POUSSEE['tolerance'])[0])
        if meilleur is not None and pires[k] > meilleur[2] - POUSSEE['tolerance']:
            break
        meilleur = (avancee, float(ecarts[k]), float(pires[k]))
        avancee += POUSSEE['pas']
    return meilleur


def corriger(tronc, poses, bras, instants_):
    """Par côté, l'avancée et l'écart du coude de chaque image (images,), enveloppés (`ecart.envelopper`) aux `instants_`
    sur les valeurs requises (`requis`) aux images où la peau du bras peut toucher le tronc (`pres`), et ces images
    (images,) : `poses`, le `tronc.TroncPose` de `tronc` de chaque image, chargé de ses champs là où il le faut ; `bras`,
    les `Bras` de chaque image par côté."""
    cotes = bras[0] if bras else ()
    requises = {c: numpy.zeros((2, len(bras))) for c in cotes}
    proches = {c: numpy.zeros(len(bras), dtype=bool) for c in cotes}
    for i, bras_ in enumerate(bras):
        for cote, b in bras_.items():
            proches[cote][i] = pres(tronc, poses[i], b)
            if proches[cote][i]:
                if not poses[i].champs:
                    poses[i] = champs_du_tronc(tronc, poses[i])
                requises[cote][:, i] = requis(poses[i], b)[:2]
    return {c: (envelopper(r[0], instants_), envelopper(r[1], instants_), proches[c]) for c, r in requises.items()}


def mesurer(tronc, pose, bras):
    """Le `tronc.TroncPose` `pose` de `tronc`, chargé de ses champs s'il le faut, et le sommet le plus enfoncé de la peau
    des `Bras` `bras` (par côté) qui peuvent toucher le tronc (`pres`) : sa profondeur, son jeu et sa zone ; `None` si
    aucun ne le peut."""
    pire = None
    for b in bras.values():
        if not pres(tronc, pose, b):
            continue
        if not pose.champs:
            pose = champs_du_tronc(tronc, pose)
        dedans = profondeurs(pose, peau_posee(b)[:, 0])
        jeu, i = numpy.unravel_index(dedans.argmax(), dedans.shape)
        if pire is None or dedans[jeu, i] > pire[0]:
            pire = (float(dedans[jeu, i]), int(jeu), b.zones[i])
    return pose, pire


def ecarter_les_membres(bpy, rig, clips):
    """Tient hors du tronc la peau des avant-bras et des mains de chaque action de `clips` sur le rig `rig`
    (`corriger`), en écrivant les rotations du bras, de l'avant-bras et de la main aux instants corrigés, et imprime
    par clip une ligne `MEMBRES` : images, images corrigées, avancée et écart du coude les plus grands, peau la plus
    enfoncée après la passe et, s'il en reste plus de `POUSSEE['refus']` dedans, l'image, le jeu, la zone et la
    profondeur de la pire, et la durée."""
    peaux = meshes_for(bpy, rig)
    tronc = peau_du_tronc(rig, peaux)
    noms = [b.name for b in rig.data.bones]
    inverses = numpy.array([numpy.array(b.matrix_local.inverted()) for b in rig.data.bones])
    cotes = {}
    for cote, zone in (('r', 'd'), ('l', 'g')):
        membre = peau_du_membre(rig, peaux, (f'avant_bras_{zone}', f'main_{zone}'))
        cotes[cote] = ([noms.index(n) for n in BRAS[cote]], repos_de_la_chaine(rig, cote), membre,
                       peau_du_membre(rig, peaux, (f'main_{zone}',)),
                       [zone_de_l_os(noms[i]) for i in membre.w.argmax(axis=1)])
    scene, pose = bpy.context.scene, rig.pose.bones

    def lire(image):
        aller_a(scene, image)
        courantes = numpy.array([numpy.array(pose[n].matrix) for n in noms]) @ inverses
        tronc_ = tronc_pose(tronc, courantes, champs=False)
        return tronc_, {cote: bras_de_l_image(tronc, tronc_, courantes, *v) for cote, v in cotes.items()}

    for action in clips:
        debut = time.time()
        assign_action(rig, action)
        images = instants(action)
        poses, bras = (list(v) for v in zip(*[lire(image) for image in images]))
        corrections = corriger(tronc, poses, bras, images)
        touchees = sorted({int(i) for a, e, _ in corrections.values() for i in numpy.flatnonzero((a > 0) | (e > 0))})
        for i in touchees:
            aller_a(scene, images[i])
            for cote, (avancees, ecarts, _) in corrections.items():
                if avancees[i] == 0 and ecarts[i] == 0:
                    continue
                (humerus, avant_bras, articulation), = poses_du_bras(bras[i][cote], poses[i], avancees[i], [ecarts[i]])[2]
                epaule, os_avant_bras, os_main = (pose[n] for n in BRAS[cote])
                sources = {n: pose[n].rotation_quaternion.copy() for n in BRAS[cote]}
                for os_, axes, origine in ((epaule, humerus, epaule.matrix.translation.copy()),
                                           (os_avant_bras, avant_bras, articulation)):
                    matrice = axes.to_4x4()
                    matrice.translation = origine
                    os_.matrix = matrice
                    bpy.context.view_layer.update()
                main = Matrix(bras[i][cote].mondes[2].tolist())
                main.translation = os_main.matrix.translation.copy()
                os_main.matrix = main
                bpy.context.view_layer.update()
                for n in BRAS[cote]:
                    if pose[n].rotation_quaternion.dot(sources[n]) < 0:
                        pose[n].rotation_quaternion = -pose[n].rotation_quaternion
                    pose[n].keyframe_insert('rotation_quaternion', frame=images[i])
        restes, pire = [], None
        for i, image in enumerate(images):
            if i not in touchees and not any(p[i] for _, _, p in corrections.values()):
                continue
            pose_, bras_ = lire(image) if i in touchees else (poses[i], bras[i])
            _, mesure = mesurer(tronc, pose_, bras_)
            if mesure is None:
                continue
            if pire is None or mesure[0] > pire[0]:
                pire = mesure
            if mesure[0] > POUSSEE['refus']:
                restes.append((mesure[0], image, mesure[1], mesure[2]))
        ligne = (f'MEMBRES {action.name} images {len(images)} corrigées {len(touchees)} avancée max '
                 f'{max((float(a.max()) for a, _, _ in corrections.values()), default=0.0) * 100:.2f} cm écart du coude max '
                 f'{max((float(e.max()) for _, e, _ in corrections.values()), default=0.0):.1f}° peau la plus enfoncée '
                 + ('hors de portée' if pire is None else f'{pire[0] * 100:.2f} cm'))
        if restes:
            profondeur, image, jeu, zone = max(restes)
            ligne += (f' reste {len(restes)} image(s), pire image {image:.2f} '
                      f'{"+".join(TRONC["silhouettes"][jeu]) or "neutre"} {zone} {profondeur * 100:.2f} cm')
        print(ligne, f'{time.time() - debut:.1f} s', flush=True)
