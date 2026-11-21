"""Les bras des clips du pack de la base humanoïde hors du tronc (#3810) : dans chaque clip, la peau de l'avant-bras et
de la main de chaque bras (`tronc.peau_du_membre`) se tient dans le tronc à au plus `SOL_TOLERANCE_M`, la tolérance de
la garde `membres`, à sa profondeur exacte (`ecart.enfoncement`, `tronc.profondeurs_exactes`), sous chaque jeu requis
(`JEUX_REQUIS`), les os déplacés comme l'hôte les joue.

Seules se corrigent les images où la peau source d'un bras est plus enfoncée que la tolérance sous un jeu requis ; un bras
sans telle image garde sa source, sans clé écrite. Chaque bras se corrige de deux grandeurs ≥ 0, chacune
enveloppée dans le temps (`ecart.envelopper`, `ecart.RACCORD`) : l'avancée de la main le long de l'avant du tronc posé
(`tronc.avant`), la main gardant son orientation, le bras reposé par IK à deux os (`tronc.coude`) dans le plan du coude
de la pose source ; l'écart du coude, tourné autour de l'axe épaule-poignet, du côté qui l'éloigne de l'axe du tronc
(`poses_du_bras`), la main inchangée. Une image requiert d'abord l'avancée qui sort la peau de la main, portée d'un bloc
(`ecart.poussee_requise`), puis, le bras posé à cette avancée, le plus petit écart du coude qui tient la peau entière à
`ecart.ECART_DU_TRONC['marge']` dehors, lue sur le champ du tronc posé ; si aucun écart ne suffit, l'avancée se relève
d'un pas tant qu'elle enfonce moins la peau (`requis`, `ECART_DU_COUDE`, `ecart.POUSSEE`).

Le clip se corrige d'un bloc, sous chaque liste de `JEUX_REQUIS` dans l'ordre, ses deux bras sous la même ; une image
que rien ne sort ne requiert rien, l'enveloppe de ses voisines la couvre ou non. Si aucune image ne requiert rien, la
liste est perdue ; sinon les deux bras s'écrivent et le clip reposé se garde si la peau exacte de chacun de ses deux
bras, corrigé ou non (le tronc suit aussi les os des bras), reste sous la tolérance à chaque image sous chaque jeu requis
et n'est, sous un jeu retiré du requis, à aucune image plus enfoncée qu'à la source (`verdict`), si chaque bras corrigé
passe, aux images corrigées, les contrôles d'un bras posé (`deux_mains.defaut_du_bras`), et si, aux images corrigées et
à leurs voisines, la peau que meut chaque bras corrigé ne sort de `ETIREMENT_EN_CLIP` sous aucun jeu de `tronc.TRONC['jeux']`
là où la source y était, mesurée comme la garde `etirement` (`etirements`, `etirement_neuf`). Sinon les courbes sources
des deux bras reviennent à l'identique et la liste suivante s'essaie ; après la dernière, le clip reste sa source. La
ligne `MEMBRES` du clip le dit.

La clavicule et le dos restent ceux du clip ; la passe écrit les rotations du bras, de l'avant-bras et de la main aux
instants du clip (`poids.instants`) où l'une des grandeurs enveloppées n'est pas nulle, et ne touche pas les courbes
ailleurs.

Repère Blender du rig : +X la gauche du personnage, −Y l'avant, +Z le haut.
"""
import math
import time
from typing import NamedTuple

import numpy
from mathutils import Matrix, Quaternion, Vector

from anatomie import zone_de_l_os
from animation import assign_action, meshes_for
from deux_mains import defaut_du_bras, etirement_du_bras, lire_le_bras, peau_du_bras, peau_fixe, rapports_du_bras
from ecart import ECART_DU_TRONC, POUSSEE, envelopper, poussee_requise
from noms_silhouettes import CARRURE_PLUS
from pistes import aller_a, sacs
from poids import instants
from seuils import ETIREMENT_EN_CLIP, SOL_TOLERANCE_M
from tronc import (BRAS, TRONC, avant, chaine_du_bras, champs_du_tronc, coude, matrices_de_la_chaine, membre_pose,
                   peau_du_membre, peau_du_tronc, poser_le_membre, poser_sous_les_jeux, pres_du_tronc, profondeurs,
                   profondeurs_exactes, repos_de_la_chaine, tetes_du_bras, tronc_pose)

ECART_DU_COUDE = {'pas': 1.0, 'borne': 45.0}
"""En degrés, l'écart du coude autour de l'axe épaule-poignet (`requis`) : cherché par pas de `pas`, jusqu'à `borne`
(#3810)."""
JEUX_REQUIS = (tuple(range(len(TRONC['jeux']))),
               tuple(j for j, jeu in enumerate(TRONC['jeux']) if jeu.nom != CARRURE_PLUS))
"""Les jeux de `tronc.TRONC['jeux']` (indices) sous lesquels la correction d'un bras doit tenir sa peau, essayés dans l'ordre :
tous, puis tous sauf la carrure maximale, sous laquelle la peau reste alors, au pire, aussi enfoncée qu'à la source
(`verdict`) : le corps normal d'abord (#3810)."""
ETIREMENT_AGGRAVE = 0.01
"""La part de son rapport source dont une correction peut encore éloigner de `ETIREMENT_EN_CLIP` une arête que la source
tenait déjà hors de lui (`etirement_neuf`)."""


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
    """Par jeu et par pose, les `sommets` de la peau du membre du `Bras` `bras` (jeux, poses, sommets, 3) sous les
    `matrices` de peau de la chaîne et les `axes` de chaque pose (`poses_du_bras`), sous sa pose sans eux."""
    if matrices is None:
        return poser_le_membre(bras.membre, bras.sources, bras.tetes, sommets)
    return poser_le_membre(bras.membre, matrices, tetes_du_bras(bras.chaine, axes), sommets)


def pres(tronc, pose, bras, matrices=None, axes=None):
    """Si l'échantillon grossier de la peau du `Bras` `bras` (`peau_posee`), élargi de son rayon, peut toucher le
    `tronc.TroncPose` `pose` de `tronc` à `ECART_DU_TRONC['marge']` sous l'un de ses jeux (`tronc.pres_du_tronc`)."""
    points = peau_posee(bras, matrices, axes, bras.peau.grossier)
    return pres_du_tronc(tronc, pose, points, bras.peau.rayon + ECART_DU_TRONC['marge'])


def requis(pose, bras, jeux):
    """L'avancée et l'écart du coude qui tiennent la peau du `Bras` `bras` à `ECART_DU_TRONC['marge']` hors du
    `tronc.TroncPose` `pose` (avec ses champs) sous les `jeux` (indices) : l'avancée qui sort la peau de la main
    (`ecart.poussee_requise`, nulle si l'avancée ne la sort pas), puis le plus petit écart du coude de pas
    `ECART_DU_COUDE['pas']`, jusqu'à sa borne ; sans lui, l'avancée se relève de `POUSSEE['pas']`, jusqu'à
    `POUSSEE['borne']`, tant que la peau la plus enfoncée l'est moins de `POUSSEE['tolerance']`. `None` si rien ne la
    sort."""
    jeux = list(jeux)
    avancee = poussee_requise(pose, bras.main, jeux) or 0.0
    ecarts = numpy.arange(0.0, ECART_DU_COUDE['borne'] + ECART_DU_COUDE['pas'] / 2, ECART_DU_COUDE['pas'])
    precedente = math.inf
    while avancee <= POUSSEE['borne'] + POUSSEE['tolerance']:
        matrices, axes, _ = poses_du_bras(bras, pose, avancee, ecarts)
        pires = profondeurs(pose, peau_posee(bras, matrices, axes)).max(axis=2)[jeux].max(axis=0)
        sortis = numpy.flatnonzero(pires <= -ECART_DU_TRONC['marge'])
        if len(sortis):
            return avancee, float(ecarts[sortis[0]])
        if pires.min() > precedente - POUSSEE['tolerance']:
            return None
        precedente = float(pires.min())
        avancee += POUSSEE['pas']
    return None


def exactes(tronc, pose, bras, matrices=None, axes=None):
    """Par jeu, la profondeur exacte (`tronc.profondeurs_exactes`) du sommet le plus enfoncé de la peau du `Bras` `bras`
    (`peau_posee`) dans le `tronc.TroncPose` `pose` de `tronc` : (jeux,), `-inf` sous chaque jeu si la peau ne peut
    toucher le tronc (`pres`)."""
    if not pres(tronc, pose, bras, matrices, axes):
        return numpy.full(len(pose.positions), -numpy.inf)
    return profondeurs_exactes(pose, peau_posee(bras, matrices, axes)[:, 0]).max(axis=1)


def corriger(tronc, poses, bras, instants_, sources, jeux):
    """L'avancée et l'écart du coude de chaque image (images,) d'un bras, enveloppés (`ecart.envelopper`) aux
    `instants_` sur les valeurs requises (`requis`) sous les `jeux` aux images où la peau `sources` (images, jeux)
    dépasse `SOL_TOLERANCE_M` sous l'un d'eux, nulles là où rien ne sort la peau : `poses`, le `tronc.TroncPose` de
    `tronc` de chaque image, chargé de ses champs là où il le faut ; `bras`, le `Bras` de chaque image. Rend aussi le
    compte des images où rien ne sort la peau."""
    requises, rien = numpy.zeros((2, len(bras))), 0
    for i in numpy.flatnonzero(sources[:, list(jeux)].max(axis=1) > SOL_TOLERANCE_M):
        if not poses[i].champs:
            poses[i] = champs_du_tronc(tronc, poses[i])
        requise = requis(poses[i], bras[i], jeux)
        if requise is None:
            rien += 1
        else:
            requises[:, i] = requise
    return envelopper(requises[0], instants_), envelopper(requises[1], instants_), rien


def nom_du_jeu(jeu):
    return TRONC['jeux'][jeu].nom or 'neutre'


def en_cm(profondeur):
    """La `profondeur` exacte (`exactes`), en centimètres, ou « dehors »."""
    return 'dehors' if profondeur == -math.inf else f'{profondeur * 100:.2f} cm'


def verdict(sources, apres, jeux, images):
    """Ce que dit le tronc de la correction d'un bras dont la peau exacte (`exactes`) est `sources` à la source et
    `apres` le clip reposé (images, jeux de `tronc.TRONC['jeux']`), aux `images` (instants), sous les `jeux` requis : le défaut,
    `None` si la peau reste sous `SOL_TOLERANCE_M` à chaque image sous chaque jeu requis et, sous chaque jeu retiré, à
    aucune image plus enfoncée qu'à la source ; et le reste sous les jeux retirés au-delà de la tolérance (« sauf <jeu> :
    reste … »)."""
    requis_ = apres[:, list(jeux)]
    retires = [j for j in range(apres.shape[1]) if j not in jeux]
    reste = ''.join(f' sauf {nom_du_jeu(j)} : reste {apres[:, j].max() * 100:.2f} cm image {images[int(apres[:, j].argmax())]:.2f}'
                    for j in retires if apres[:, j].max() > SOL_TOLERANCE_M)
    if requis_.max() > SOL_TOLERANCE_M:
        i, j = numpy.unravel_index(requis_.argmax(), requis_.shape)
        return f'tronc image {images[i]:.2f} {nom_du_jeu(jeux[j])} {requis_[i, j] * 100:.2f} cm', reste
    for j in retires:
        plus = numpy.maximum(apres[:, j], 0.0) - numpy.maximum(sources[:, j], 0.0)
        if plus.max() > 0.0:
            i = int(plus.argmax())
            return (f'{nom_du_jeu(j)} plus enfoncée image {images[i]:.2f} {apres[i, j] * 100:.4f} cm pour '
                    f'{max(sources[i, j], 0.0) * 100:.4f} cm'), reste
    return None, reste


def etirements(tronc, peau, pose, courantes):
    """Par jeu de `tronc.TRONC['jeux']`, le rapport de chaque arête de la `deux_mains.PeauDuBras` `peau` à sa longueur au repos du
    corps neutre (`deux_mains.rapports_du_bras`), posée sous les matrices de peau `courantes` (os, 4, 4) et les clés de
    forme du jeu, sur les os déplacés du `tronc.TroncPose` `pose` de `tronc` (`tronc.poser_sous_les_jeux`), comme la garde
    `etirement` la mesure (`hotes/godot/asset/evaluateur/gardes/etirement.ts`) : (jeux, arêtes)."""
    return rapports_du_bras(peau, poser_sous_les_jeux(peau.w, peau.x, courantes, pose.tetes, tronc.deplacements))


def etirement_neuf(sources, apres, images):
    """L'étirement qu'une correction fait naître, `None` sans lui : `sources` et `apres`, les rapports (`etirements`) de
    la source et du clip reposé aux `images` (instants) vérifiées (images, jeux, arêtes). Une arête hors de
    `ETIREMENT_EN_CLIP` après la correction compte si la source la tenait dedans, ou si la correction l'en éloigne encore
    de plus de `ETIREMENT_AGGRAVE` de son rapport source ; la pire, en écart logarithmique à 1 comme la garde, se rend :
    « étirement sous <jeu> image <instant> <rapport> »."""
    bas, haut = ETIREMENT_EN_CLIP
    neuves = (((apres > haut) & ((sources <= haut) | (apres > sources * (1 + ETIREMENT_AGGRAVE))))
              | ((apres < bas) & ((sources >= bas) | (apres < sources * (1 - ETIREMENT_AGGRAVE)))))
    if not neuves.any():
        return None
    i, j, k = numpy.unravel_index(numpy.where(neuves, numpy.abs(numpy.log(apres)), -numpy.inf).argmax(), neuves.shape)
    return f'étirement sous {nom_du_jeu(j)} image {images[i]:.2f} {apres[i, j, k]:.5f}'


def courbes(action, os_):
    """Les courbes de rotation des os `os_` dans `action`, par (chemin, indice) : leurs clés, chacune en (instant,
    valeur), poignées, interpolation, types de poignées et assouplissement."""
    return {(c.data_path, c.array_index): [(tuple(k.co), tuple(k.handle_left), tuple(k.handle_right), k.interpolation,
                                            k.handle_left_type, k.handle_right_type, k.easing) for k in c.keyframe_points]
            for sac in sacs(action) for c in sac.fcurves
            if c.data_path.split('"')[1:2] and c.data_path.split('"')[1] in os_ and c.data_path.endswith('rotation_quaternion')}


def restaurer(action, os_, sources):
    """Rend aux courbes de rotation des os `os_` dans `action` les clés `sources` (`courbes`), et retire celles qui n'y
    sont pas."""
    for sac in sacs(action):
        for c in list(sac.fcurves):
            cle = (c.data_path, c.array_index)
            if not (c.data_path.split('"')[1:2] and c.data_path.split('"')[1] in os_ and c.data_path.endswith('rotation_quaternion')):
                continue
            if cle not in sources:
                sac.fcurves.remove(c)
                continue
            c.keyframe_points.clear()
            c.keyframe_points.add(len(sources[cle]))
            for k, (co, gauche, droite, interpolation, type_gauche, type_droite, assouplissement) in zip(c.keyframe_points, sources[cle]):
                k.co, k.interpolation, k.easing = co, interpolation, assouplissement
                k.handle_left_type, k.handle_right_type = type_gauche, type_droite
                k.handle_left, k.handle_right = gauche, droite


def ecarter_les_membres(bpy, rig, clips):
    """Tient hors du tronc la peau des avant-bras et des mains de chaque action de `clips` sur le rig `rig`, clip par
    clip, sous chaque liste de `JEUX_REQUIS` dans l'ordre jusqu'à la première dont la correction se garde (`corriger`),
    et imprime par clip une ligne `MEMBRES` : images, par bras sa peau exacte la plus enfoncée à la source, puis la liste
    gardée et, par bras corrigé, images corrigées, avancée et écart du coude les plus grands, peau exacte la plus
    enfoncée après et reste sous un jeu retiré du requis ; ou le clip rendu à sa source, avec pour chaque liste essayée
    le bras, le contrôle manqué (`verdict`, `deux_mains.defaut_du_bras`, `etirement_neuf`), l'instant et la valeur ; le
    compte des images que rien ne sort, par bras ; et la durée."""
    peaux = meshes_for(bpy, rig)
    tronc = peau_du_tronc(rig, peaux, TRONC['jeux'])
    noms = [b.name for b in rig.data.bones]
    inverses = numpy.array([numpy.array(b.matrix_local.inverted()) for b in rig.data.bones])
    cotes, aretes = {}, {}
    for cote, zone in (('r', 'd'), ('l', 'g')):
        membre = peau_du_membre(rig, peaux, (f'avant_bras_{zone}', f'main_{zone}'), TRONC['jeux'])
        cotes[cote] = ([noms.index(n) for n in BRAS[cote]], repos_de_la_chaine(rig, cote), membre,
                       peau_du_membre(rig, peaux, (f'main_{zone}',), TRONC['jeux']),
                       [zone_de_l_os(noms[i]) for i in membre.w.argmax(axis=1)])
        epaule = rig.data.bones[BRAS[cote][0]]
        aretes[cote] = peau_du_bras(peaux, noms, [o.name for o in (epaule, *epaule.children_recursive)], rig.matrix_world.inverted(),
                                    TRONC['jeux'])
    scene, pose = bpy.context.scene, rig.pose.bones

    def lire(image):
        aller_a(scene, image)
        courantes = numpy.array([numpy.array(pose[n].matrix) for n in noms]) @ inverses
        tronc_ = tronc_pose(tronc, courantes, champs=False)
        return (tronc_, {cote: bras_de_l_image(tronc, tronc_, courantes, *v) for cote, v in cotes.items()},
                {cote: lire_le_bras(pose, cote) for cote in cotes}, courantes)

    def etirement(courantes, cote):
        libres = cotes[cote][0][:2]
        haut, bas = etirement_du_bras(aretes[cote], peau_fixe(aretes[cote], courantes, libres),
                                      [(i, courantes[i][None]) for i in libres])
        return float(haut[0]), float(bas[0])

    def ecrire(images, lus, cote, avancees, ecarts, touchees):
        for i in touchees:
            aller_a(scene, images[i])
            tronc_, bras_ = lus[i][:2]
            (humerus, avant_bras, articulation), = poses_du_bras(bras_[cote], tronc_, avancees[i], [ecarts[i]])[2]
            epaule, os_avant_bras, os_main = (pose[n] for n in BRAS[cote])
            sources = {n: (pose[n].rotation_quaternion.copy(), pose[n].location.copy(), pose[n].scale.copy()) for n in BRAS[cote]}
            for os_, axes, origine in ((epaule, humerus, epaule.matrix.translation.copy()), (os_avant_bras, avant_bras, articulation)):
                matrice = axes.to_4x4()
                matrice.translation = origine
                os_.matrix = matrice
                bpy.context.view_layer.update()
            main = Matrix(bras_[cote].mondes[2].tolist())
            main.translation = os_main.matrix.translation.copy()
            os_main.matrix = main
            bpy.context.view_layer.update()
            for n in BRAS[cote]:
                rotation, pose[n].location, pose[n].scale = sources[n]
                if pose[n].rotation_quaternion.dot(rotation) < 0:
                    pose[n].rotation_quaternion = -pose[n].rotation_quaternion
                pose[n].keyframe_insert('rotation_quaternion', frame=images[i])

    os_des_bras = [n for c in cotes for n in BRAS[c]]
    for action in clips:
        debut = time.time()
        assign_action(rig, action)
        images = instants(action)
        lus = [lire(image) for image in images]
        poses = [l[0] for l in lus]
        sources = {cote: numpy.array([exactes(tronc, l[0], l[1][cote]) for l in lus]) for cote in cotes}
        tete = f'MEMBRES {action.name} images {len(images)} | source ' + ', '.join(
            f'{cote} {en_cm(float(s.max()))}' for cote, s in sources.items())
        if max(float(s.max()) for s in sources.values()) <= SOL_TOLERANCE_M:
            print(tete, f'sous la tolérance | {time.time() - debut:.1f} s', flush=True)
            continue
        originales = courbes(action, os_des_bras)
        refus, garde = [], None
        for jeux in JEUX_REQUIS:
            retires = [nom_du_jeu(j) for j in range(len(TRONC['jeux'])) if j not in jeux]
            niveau = 'sans ' + '+'.join(retires) if retires else 'tous les jeux'
            corrections, riens = {}, {}
            for cote in cotes:
                avancees, ecarts, riens[cote] = corriger(tronc, poses, [l[1][cote] for l in lus], images, sources[cote], jeux)
                touchees = [int(i) for i in numpy.flatnonzero((avancees > 0) | (ecarts > 0))]
                if touchees:
                    corrections[cote] = (avancees, ecarts, touchees)
            rien = ''.join(f', {cote} rien ne sort la peau à {n} images' for cote, n in riens.items() if n)
            if not corrections:
                refus.append(f'{niveau} : ' + ('rien à écrire' + rien if rien else 'aucune image à corriger'))
                continue
            defaut = None
            for cote, (avancees, ecarts, touchees) in corrections.items():
                ecrire(images, lus, cote, avancees, ecarts, touchees)
            relus = {j: lire(images[j]) for j in sorted({j for c in corrections.values() for i in c[2]
                                                         for j in (i - 1, i, i + 1) if 0 <= j < len(images)})}
            etats = []
            for cote in cotes:
                apres = sources[cote].copy()
                for i, l in relus.items():
                    apres[i] = exactes(tronc, l[0], l[1][cote])
                defaut_, reste = verdict(sources[cote], apres, jeux, images)
                if defaut_ is None and cote in corrections:
                    avancees, ecarts, touchees = corrections[cote]
                    lectures = [relus[i][2][cote] if i in relus else l[2][cote] for i, l in enumerate(lus)]
                    neutres = {i: etirement(relus[i][3], cote) for i in touchees}
                    controle, _ = defaut_du_bras(cote, images, lectures, neutres, touchees)
                    if controle is not None:
                        defaut_ = f'{controle[0]} image {controle[1]:.2f} {controle[2]}'
                    else:
                        verifiees = sorted({j for i in touchees for j in (i - 1, i, i + 1) if 0 <= j < len(images)})
                        defaut_ = etirement_neuf(
                            numpy.array([etirements(tronc, aretes[cote], lus[i][0], lus[i][3]) for i in verifiees]),
                            numpy.array([etirements(tronc, aretes[cote], relus[i][0], relus[i][3]) for i in verifiees]),
                            [images[i] for i in verifiees])
                    if defaut_ is None:
                        etats.append(f'{cote} corrigées {len(touchees)}, avancée max {avancees.max() * 100:.2f} cm, écart du '
                                     f'coude max {ecarts.max():.1f}°, après {en_cm(apres[:, list(jeux)].max())}{reste}')
                elif defaut_ is None and reste:
                    etats.append(f'{cote} non corrigé{reste}')
                if defaut_ is not None:
                    defaut = f'{cote} {defaut_}'
                    break
            if defaut is None:
                garde = f'gardé {niveau} : ' + ' ; '.join(etats) + rien
                break
            refus.append(f'{niveau} : {defaut}{rien}')
            restaurer(action, [n for c in corrections for n in BRAS[c]], originales)
        print(tete, '|', garde or 'rendu à la source', *(['| refus : ' + ' ; '.join(refus)] if refus else []),
              f'| {time.time() - debut:.1f} s', flush=True)
