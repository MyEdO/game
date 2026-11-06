"""Les clips tenus à deux mains de la base humanoïde (#3319), dérivés de clips à une main, un jeu par maniement
(`maniement` de `src/data/apparences.json`) : chacun garde le corps et les jambes de son clip source, fléchit le dos, et
pose les deux bras par IK à deux os sur une arme dont les prises sont à l'écart de son maniement l'une de l'autre, la
prise `main` sur la main droite, la seconde sur la main gauche.

Une clé de geste porte, dans le repère de repos du rig mené par l'os `repere` du clip, le milieu des deux prises, la
direction de la prise `main` vers la seconde prise, la flexion du dos vers l'avant et sa torsion vers la gauche, en
degrés, et si le geste y passe avec élan, sans s'y arrêter. Entre deux clés, le milieu et le dos s'interpolent en ligne,
la direction au plus court sur la sphère, et l'avancée part et arrive au repos, sauf à une clé d'élan (`avancee`).

Le repère de l'arme porte son +Y vers le fer (la seconde prise est sur cet axe, `liaison.secondePrise`,
`hotes/godot/asset/element.ts`) et son +X au plus près du flanc gauche du personnage : le tranchant, sur le +Z de la prise
(du poignet vers les jointures), mène un coup qui tombe devant lui.

Repère Blender du rig : +X la gauche du personnage, −Y l'avant, +Z le haut.
"""
import math

from mathutils import Matrix, Quaternion, Vector

from pistes import aller_a, sacs
from poids import instants

SECONDES = {'lourde2m': -0.35, 'hampe': 0.5}
"""Par maniement, la cote en mètres de la seconde prise de ses clips dérivés sur le +Y de la prise `main` : sur une
arme lourde, la main gauche sous la droite, vers le talon ; sur une hampe, la main droite au talon et la gauche devant,
vers le fer, du côté du pied avancé. La seconde prise propre à chaque arme se rejoint à l'exécution (`SecondePrise`,
`hotes/godot/projet/scripts/seconde_prise.gd`)."""

BRAS = {cote: (f'upperarm_{cote}', f'lowerarm_{cote}', f'hand_{cote}') for cote in ('r', 'l')}
"""Par côté, le bras posé par IK : épaule, coude, main."""
CLAVICULES = ('clavicle_r', 'clavicle_l')
"""Les clavicules, au repos dans un clip dérivé : la pose du bras source est remplacée, celle de sa clavicule avec."""
DOS = ('spine_01', 'spine_02', 'spine_03')
"""Les os qui se partagent la flexion et la torsion du dos."""
POLES = {'r': Vector((-0.55, 0.35, -0.75)), 'l': Vector((0.55, 0.35, -0.75))}
"""Par côté, la direction vers laquelle plie le coude, au repos : en dehors, en arrière et vers le bas."""


def cle(u, milieu, direction, flexion=0.0, torsion=0.0, elan=False):
    """La clé de geste à l'instant `u` (fraction du clip) : milieu des deux prises, direction unitaire vers la seconde
    prise, flexion et torsion du dos, et si le geste y passe avec élan."""
    return u, Vector(milieu), Vector(direction).normalized(), Vector((flexion, torsion)), elan


REPOS = ((0.0, -0.22, 1.12), (0.78, 0.0, -0.62))
"""Le manche en travers du corps, bas, le fer en haut à droite."""
GARDE = ((0.04, -0.28, 1.05), (0.55, 0.65, -0.5))
"""Les mains devant le ventre, le fer levé vers l'adversaire, le talon le long de la hanche gauche."""
LEVEE = ((-0.3, -0.28, 1.33), (0.43, -0.43, -0.79))
"""Les mains montées devant l'épaule droite, le fer dressé au-dessus d'elle."""
ARME = ((-0.105, -0.065, 1.72), (-0.05, -0.92, -0.2))
"""Les mains au-dessus de la tête, la hache armée derrière elle, le tranchant vers le haut."""
COUP = ((0.14, -0.325, 1.0), (0.31, 0.91, -0.6))
"""Les bras tendus devant, le fer abattu à hauteur de poitrine, le talon tiré vers la hanche gauche."""

HAMPE_REPOS = ((-0.145, -0.18, 1.2975), (0.3, 0.08, 0.95))
"""La hampe dressée devant le torse, la main droite à la hanche, la gauche devant la poitrine, le fer au-dessus."""
HAMPE_GARDE = ((-0.075, -0.24, 1.0925), (0.3, -0.88, 0.37))
"""La main droite au talon contre la hanche droite, la gauche devant, le fer pointé à hauteur de tête."""
HAMPE_ARME = ((-0.03, -0.1175, 1.2925), (0.2, -0.15, 0.97))
"""La main gauche montée devant le visage, la droite devant le ventre, le fer dressé haut au-dessus de la tête."""
HAMPE_COUP = ((-0.0175, -0.4025, 1.05), (0.25, -0.93, 0.2))
"""Le corps penché dans le coup, la main gauche jetée devant, la droite tirée au ventre, le fer tombé à hauteur de tête
à deux mètres."""

CLIPS = {
    'Lourde_Repos_Loop': ('Idle_Loop', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'Lourde_Marche_Loop': ('Walk_Loop', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'Lourde_Attaque': ('Sword_Idle', 'root', 'lourde2m', (cle(0.0, *GARDE, 8), cle(0.2, *LEVEE, 0, -5, elan=True),
                                                          cle(0.35, *ARME, -8, -20), cle(0.52, *COUP, 25, 35, elan=True),
                                                          cle(0.62, *COUP, 25, 35), cle(1.0, *GARDE, 8))),
    'Hampe_Repos_Loop': ('Idle_Loop', 'spine_03', 'hampe', (cle(0.0, *HAMPE_REPOS), cle(1.0, *HAMPE_REPOS))),
    'Hampe_Marche_Loop': ('Walk_Loop', 'spine_03', 'hampe', (cle(0.0, *HAMPE_REPOS), cle(1.0, *HAMPE_REPOS))),
    'Hampe_Attaque': ('Sword_Idle', 'root', 'hampe', (cle(0.0, *HAMPE_GARDE, 5), cle(0.3, *HAMPE_ARME, -5, -10),
                                                      cle(0.48, *HAMPE_COUP, 35, 25, elan=True),
                                                      cle(0.6, *HAMPE_COUP, 35, 25), cle(1.0, *HAMPE_GARDE, 5))),
}
"""Par clip dérivé : son clip source, l'os qui mène le repère de ses clés, son maniement (`SECONDES`) et ses clés de
geste. L'attaque d'une arme lourde, une taille verticale, part de la garde et y revient, sur les jambes de la garde ;
celle d'une hampe dresse le fer de la main gauche, la droite au talon, puis le jette devant, loin du corps."""


def avancee(t, depart, arrivee):
    """La part du chemin faite à la fraction `t` d'un segment de geste, de vitesse nulle à chaque bout sauf à celui qui
    a de l'élan (`depart`, `arrivee`) : en S, en accélération, en décélération ou en ligne."""
    formes = {(False, False): t * t * (3 - 2 * t), (False, True): t * t, (True, False): t * (2 - t), (True, True): t}
    return formes[depart, arrivee]


def interpoler(cles, u, ecart):
    """La prise `main`, à `ecart / 2` du milieu de chaque clé, la direction vers la seconde prise et le dos (flexion,
    torsion) à l'instant `u` entre les `cles`."""
    for (u0, m0, d0, f0, depart), (u1, m1, d1, f1, arrivee) in zip(cles, cles[1:]):
        if u0 <= u <= u1:
            k = avancee((u - u0) / (u1 - u0) if u1 > u0 else 0.0, depart, arrivee)
            tour = Quaternion().slerp(d0.rotation_difference(d1), k)
            return (m0 - d0 * ecart / 2).lerp(m1 - d1 * ecart / 2, k), (tour @ d0).normalized(), f0.lerp(f1, k)
    _, m, d, f, _ = cles[-1]
    return m - d * ecart / 2, d.copy(), f.copy()


def coude(epaule, cible, l1, l2, pole):
    """Le poignet atteint et le coude d'un bras de segments `l1` puis `l2`, de l'`epaule` vers la `cible` : la cible
    hors de portée se ramène sur la sphère de portée, et le coude plie du côté de `pole`."""
    axe = (cible - epaule).normalized()
    distance = max(abs(l1 - l2) + 1e-4, min((cible - epaule).length, l1 + l2 - 1e-4))
    a = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    plan = (pole - axe * pole.dot(axe)).normalized()
    return epaule + axe * distance, epaule + axe * a + plan * h


def repere_de_l_arme(flanc, prise, fer):
    """Le repère de la prise `main` à la `prise`, son +Y vers le `fer`, son +X au plus près de `flanc`."""
    y = fer.normalized()
    x = (flanc - y * flanc.dot(y)).normalized()
    repere = Matrix((x, y, x.cross(y))).transposed().to_4x4()
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
    animes = [n for os in BRAS.values() for n in os] + list(CLAVICULES) + list(DOS)
    derivees = []
    for nom, (source_nom, os_du_cadre, maniement, cles) in CLIPS.items():
        source = bpy.data.actions[source_nom]
        rig.animation_data_create()
        rig.animation_data.action = source
        images = instants(source)
        debut, fin = images[0], images[-1]
        dos_source = {}
        for image in images:
            aller_a(scene, image)
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
            cote = SECONDES[maniement]
            prise, direction, (flexion, torsion) = interpoler(cles, (image - debut) / (fin - debut), abs(cote))
            axes = (pose[os_du_cadre].matrix @ repos[os_du_cadre].inverted()).to_3x3()
            tour = (Matrix.Rotation(math.radians(flexion / len(DOS)), 4, axes @ Vector((1, 0, 0)))
                    @ Matrix.Rotation(math.radians(torsion / len(DOS)), 4, axes @ Vector((0, 0, 1))))
            for n in DOS:
                tete = pose[n].matrix.translation.copy()
                pose[n].matrix = Matrix.Translation(tete) @ tour @ Matrix.Translation(-tete) @ pose[n].matrix
                bpy.context.view_layer.update()
            cadre = pose[os_du_cadre].matrix @ repos[os_du_cadre].inverted()
            arme = repere_de_l_arme(cadre.to_3x3() @ Vector((1, 0, 0)), cadre @ prise, cadre.to_3x3() @ direction * math.copysign(1, cote))
            seconde = arme @ Matrix.Translation((0, cote, 0))
            ecart = max(ecart, _poser_le_bras(bpy, rig, 'r', arme @ prise_main.inverted(), cadre, longueurs),
                        _poser_le_bras(bpy, rig, 'l', seconde @ prise_off.inverted(), cadre, longueurs))
            for n in animes:
                pose[n].keyframe_insert('rotation_quaternion', frame=image)
        print('DEUX_MAINS', nom, 'de', source_nom, 'images', len(images), 'écart de main', round(ecart, 4), flush=True)
        derivees.append(action)
    return derivees
