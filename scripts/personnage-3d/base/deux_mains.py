"""Les clips tenus à deux mains de la base humanoïde (#3319), dérivés de clips à une main : chacun garde le corps et les
jambes de son clip source, fléchit le dos, et pose les deux bras par IK à deux os sur une arme dont les prises sont à
`ECART` l'une de l'autre, la prise `main` sur la main droite, la seconde sur la main gauche.

Une clé de geste porte, dans le repère de repos du rig mené par l'os `repere` du clip, le milieu des deux prises, la
direction de la prise `main` vers la seconde prise, et la flexion du dos vers l'avant, en degrés. Entre deux clés, le
milieu et la flexion s'interpolent en ligne, la direction au plus court sur la sphère, sous un lissage en S. Le repère
de l'arme garde le roulis de la prise `main` du clip source, tourné au plus court vers la direction de la clé ; son
+Y va vers le fer, la seconde prise est à −`ECART` sur cet axe (`liaison.secondePrise`, `hotes/godot/asset/element.ts`).

Repère Blender du rig : +X la gauche du personnage, −Y l'avant, +Z le haut.
"""
import math

from mathutils import Matrix, Quaternion, Vector

from pistes import aller_a, sacs
from poids import instants

ECART = 0.35
"""Distance, en mètres, de la prise `main` à la seconde prise des clips dérivés ; la seconde prise propre à chaque arme
se rejoint à l'exécution (`SecondePrise`, `hotes/godot/projet/scripts/seconde_prise.gd`)."""

BRAS = {cote: (f'upperarm_{cote}', f'lowerarm_{cote}', f'hand_{cote}') for cote in ('r', 'l')}
"""Par côté, le bras posé par IK : épaule, coude, main."""
DOS = ('spine_01', 'spine_02', 'spine_03')
"""Les os qui se partagent la flexion du dos."""
POLES = {'r': Vector((-0.55, 0.35, -0.75)), 'l': Vector((0.55, 0.35, -0.75))}
"""Par côté, la direction vers laquelle plie le coude, au repos : en dehors, en arrière et vers le bas."""


def cle(u, milieu, direction, flexion=0.0):
    """La clé de geste à l'instant `u` (fraction du clip) : prise `main` et direction unitaire vers la seconde prise."""
    direction = Vector(direction).normalized()
    return u, Vector(milieu) - direction * (ECART / 2), direction, flexion


REPOS = ((0.0, -0.22, 1.12), (0.6, 0.1, -0.8))
"""Le manche en travers du corps, bas, le fer en haut à droite."""
GARDE = ((0.0, -0.28, 1.2), (0.6, 0.1, -0.75))
"""Le manche en travers du corps, à hauteur de ventre."""
ARME = ((-0.2, -0.1, 1.72), (0.3, -0.4, -0.85))
"""Les deux mains au-dessus de l'épaule droite, le fer levé."""
FRAPPE = ((-0.01, -0.52, 1.10), (0.35, 0.6, 0.6))
"""Les bras tendus vers l'avant et le bas, le fer abattu devant."""

CLIPS = {
    'DeuxMains_Repos_Loop': ('Idle_Loop', 'spine_03', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'DeuxMains_Marche_Loop': ('Walk_Loop', 'spine_03', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'DeuxMains_Garde_Loop': ('Sword_Idle', 'spine_03', (cle(0.0, *GARDE), cle(1.0, *GARDE))),
    'DeuxMains_Attaque': ('TreeChopping_Loop', 'pelvis', (cle(0.0, *ARME, -5), cle(0.18, *FRAPPE, 40),
                                                          cle(0.32, *FRAPPE, 40), cle(1.0, *ARME, -5))),
}
"""Par clip dérivé : son clip source, l'os qui mène le repère de ses clés, et ses clés de geste."""


def lisse(u):
    """Le lissage en S de `u` dans [0, 1]."""
    return u * u * (3 - 2 * u)


def interpoler(cles, u):
    """La prise `main`, la direction vers la seconde prise et la flexion du dos à l'instant `u` entre les `cles`."""
    for (u0, p0, d0, f0), (u1, p1, d1, f1) in zip(cles, cles[1:]):
        if u0 <= u <= u1:
            k = lisse((u - u0) / (u1 - u0)) if u1 > u0 else 0.0
            tour = Quaternion().slerp(d0.rotation_difference(d1), k)
            return p0.lerp(p1, k), (tour @ d0).normalized(), f0 + (f1 - f0) * k
    _, p, d, f = cles[-1]
    return p.copy(), d.copy(), f


def coude(epaule, cible, l1, l2, pole):
    """Le poignet atteint et le coude d'un bras de segments `l1` puis `l2`, de l'`epaule` vers la `cible` : la cible
    hors de portée se ramène sur la sphère de portée, et le coude plie du côté de `pole`."""
    axe = (cible - epaule).normalized()
    distance = max(abs(l1 - l2) + 1e-4, min((cible - epaule).length, l1 + l2 - 1e-4))
    a = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    plan = (pole - axe * pole.dot(axe)).normalized()
    return epaule + axe * distance, epaule + axe * a + plan * h


def repere_de_l_arme(prise_source, prise, direction):
    """Le repère de la prise `main` à la `prise`, son +Y vers le fer (−`direction`), tourné au plus court depuis
    `prise_source`."""
    tour = (prise_source.to_3x3() @ Vector((0, 1, 0))).rotation_difference(-direction)
    repere = (tour.to_matrix() @ prise_source.to_3x3()).to_4x4()
    repere.translation = prise
    return repere


def _orienter(bpy, os, axe, tete):
    """L'os de pose `os` tourné au plus court pour porter son +Y sur `axe`, sa tête en `tete`."""
    matrice = os.matrix.copy()
    tour = (matrice.to_3x3() @ Vector((0, 1, 0))).rotation_difference(axe)
    nouvelle = (tour.to_matrix() @ matrice.to_3x3()).to_4x4()
    nouvelle.translation = tete
    os.matrix = nouvelle
    bpy.context.view_layer.update()


def _poser_le_bras(bpy, rig, cote, main, cadre, longueurs):
    """Le bras `cote` posé pour que sa main prenne la matrice `main` ; rend l'écart de position restant."""
    pose = rig.pose.bones
    epaule, avant_bras, os_main = (pose[n] for n in BRAS[cote])
    poignet, articulation = coude(epaule.matrix.translation.copy(), main.translation.copy(), *longueurs[cote],
                                  cadre.to_3x3() @ POLES[cote])
    _orienter(bpy, epaule, (articulation - epaule.matrix.translation).normalized(), epaule.matrix.translation.copy())
    _orienter(bpy, avant_bras, (poignet - articulation).normalized(), avant_bras.matrix.translation.copy())
    finale = main.copy()
    finale.translation = os_main.matrix.translation.copy()
    os_main.matrix = finale
    bpy.context.view_layer.update()
    return (main.translation - os_main.matrix.translation).length


def deriver(bpy, rig, reperes):
    """Les actions de `CLIPS`, ajoutées au rig `rig` d'après ses clips sources, aux instants de chacun (`poids.instants`) ;
    `reperes` : par prise `main` et `off`, son os et son repère dans celui de cet os (`anatomie.reperes_des_prises`)."""
    repos = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    longueurs = {cote: ((repos[c].translation - repos[e].translation).length, (repos[m].translation - repos[c].translation).length)
                 for cote, (e, c, m) in BRAS.items()}
    prise_main, prise_off = reperes['main'][1], reperes['off'][1]
    scene, pose = bpy.context.scene, rig.pose.bones
    animes = [n for os in BRAS.values() for n in os] + list(DOS)
    derivees = []
    for nom, (source_nom, os_du_cadre, cles) in CLIPS.items():
        source = bpy.data.actions[source_nom]
        rig.animation_data_create()
        rig.animation_data.action = source
        images = instants(source)
        debut, fin = images[0], images[-1]
        prises_sources, dos_source = {}, {}
        for image in images:
            aller_a(scene, image)
            prises_sources[image] = pose[BRAS['r'][2]].matrix @ prise_main
            dos_source[image] = {n: pose[n].rotation_quaternion.copy() for n in DOS}
        action = source.copy()
        action.name = nom
        for sac in sacs(action):
            for courbe in [c for c in sac.fcurves if c.data_path.split('"')[1:2] and c.data_path.split('"')[1] in animes]:
                sac.fcurves.remove(courbe)
        rig.animation_data.action = action
        rig.animation_data.action_slot = action.slots[0]
        ecart = 0.0
        for image in images:
            aller_a(scene, image)
            for n in animes:
                pose[n].rotation_quaternion = dos_source[image].get(n, Quaternion())
                pose[n].location = Vector()
            bpy.context.view_layer.update()
            prise, direction, flexion = interpoler(cles, (image - debut) / (fin - debut))
            lateral = (pose[os_du_cadre].matrix @ repos[os_du_cadre].inverted()).to_3x3() @ Vector((1, 0, 0))
            for n in DOS:
                tete = pose[n].matrix.translation.copy()
                tour = Matrix.Rotation(math.radians(flexion / len(DOS)), 4, lateral)
                pose[n].matrix = Matrix.Translation(tete) @ tour @ Matrix.Translation(-tete) @ pose[n].matrix
                bpy.context.view_layer.update()
            cadre = pose[os_du_cadre].matrix @ repos[os_du_cadre].inverted()
            arme = repere_de_l_arme(prises_sources[image], cadre @ prise, (cadre.to_3x3() @ direction).normalized())
            seconde = arme @ Matrix.Translation((0, -ECART, 0))
            ecart = max(ecart, _poser_le_bras(bpy, rig, 'r', arme @ prise_main.inverted(), cadre, longueurs),
                        _poser_le_bras(bpy, rig, 'l', seconde @ prise_off.inverted(), cadre, longueurs))
            for n in animes:
                pose[n].keyframe_insert('rotation_quaternion', frame=image)
        print('DEUX_MAINS', nom, 'de', source_nom, 'images', len(images), 'écart de main', round(ecart, 4), flush=True)
        derivees.append(action)
    return derivees
