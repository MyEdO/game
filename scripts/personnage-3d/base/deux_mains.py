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
from typing import NamedTuple

import numpy
from mathutils import Matrix, Quaternion, Vector

from anatomie import zone_de_l_os
from animation import assign_action, meshes_for
from pistes import aller_a, sacs
from poids import deformer, instants, peau_lineaire
from seuils import ETIREMENT_EN_CLIP, POIDS_NEGLIGEABLE

SECONDES = {'lourde2m': (-0.35, 0.0), 'hampe': (0.5, -90.0)}
"""Par maniement, la seconde prise de ses clips dérivés dans le repère de la prise `main` : sa cote en mètres sur le +Y,
et son tour en degrés autour de ce +Y. Sur une arme lourde, la main gauche sous la droite, vers le talon, les jointures du
même côté ; sur une hampe, la main droite au talon et la gauche devant, vers le fer, du côté du pied avancé, la paume
tournée sous la hampe. La seconde prise propre à chaque arme se rejoint à l'exécution (`SecondePrise`,
`hotes/godot/projet/scripts/seconde_prise.gd`) ; son tour est celui de son maniement (`liaison.secondePrise.rotation`)."""

BRAS = {cote: (f'upperarm_{cote}', f'lowerarm_{cote}', f'hand_{cote}') for cote in ('r', 'l')}
"""Par côté, le bras posé par IK : épaule, coude, main."""
CLAVICULES = ('clavicle_r', 'clavicle_l')
"""Les clavicules, au repos dans un clip dérivé : la pose du bras source est remplacée, celle de sa clavicule avec. Les
clavicules levées avec le bras étirent la peau du haut de l'épaule au-delà de `ETIREMENT_EN_CLIP` sous les gabarits à tête
forte (#3319)."""
DOS = ('spine_01', 'spine_02', 'spine_03')
"""Les os qui se partagent la flexion et la torsion du dos."""
POLES = {'r': Vector((-0.55, 0.35, -0.75)), 'l': Vector((0.55, 0.35, -0.75))}
"""Par côté, la direction vers laquelle plie le coude, au repos : en dehors, en arrière et vers le bas."""
PRONATION = {'l': (-110.0, 40.0), 'r': (-40.0, 110.0)}
"""Par côté, en degrés, la torsion de l'avant-bras autour de son axe, relative au bras : les centiles 1 et 99 des clips
sources de la base r22, où le bras ne se tord jamais et où l'avant-bras porte toute la pronation."""
POIGNET = {'torsion': 60.0, 'torsion_max': 60.0, 'flexion': 50.0, 'flexion_max': 80.0, 'charniere': 45.0, 'roulis': 45.0}
"""En degrés : la torsion de la main sur l'avant-bras, sa flexion, et l'écart de l'axe de flexion du coude à son +X, au-delà
desquels une pose de bras se paie, et l'échelle du roulis de l'arme autour de son manche, qui tourne le tranchant ; une
torsion au-delà de `torsion_max` ou une flexion au-delà de `flexion_max` se paient comme une limite, et refusent le clip. Dans les clips sources, la torsion
et la flexion de la main restent sous 60° et 50° à 95 % des images, sous 80° de flexion à 99 %, et l'axe de flexion du
coude s'écarte de son +X de moins de 45° à 90 %."""
PEAU = {'marge': 0.25, 'echelle': 0.02, 'plancher': 0.2, 'echelle_plancher': 0.01}
"""L'étirement des arêtes de la peau que meut un bras (`etirement_du_bras`), mesuré sur le corps neutre, se paie au-delà de
la borne haute de `ETIREMENT_EN_CLIP` moins `marge`, par pas d'`echelle`, et son écrasement en deçà de `plancher`, par pas
d'`echelle_plancher` : la marge et le plancher couvrent les silhouettes et les états du gabarit, que la mesure ne parcourt
pas, sous lesquels une arête du poignet écrasée à 0,07 sur le corps neutre passe sous la borne basse, et l'aisselle et le
haut de l'épaule, tenus à 0,12 sur le corps neutre, passent sous elle sous les silhouettes combinées (#3319)."""
TRONC = {'zones': ('torse', 'hanches'), 'silhouettes': ((), ('corpulence',), ('feminin', 'corpulence')),
         'marge': 0.05, 'echelle': 0.01, 'points': (0.0, 1 / 3, 2 / 3)}
"""Le tronc dont l'avant-bras se tient à l'écart (`peau_du_tronc`) : les sommets des `zones` (celle de l'os dominant,
`anatomie.zone_de_l_os`), sous chaque jeu de `silhouettes` posées à 1. Les `points` de l'axe du bras, le coude puis des
fractions du coude au poignet, à moins de `marge` (le rayon de l'avant-bras) de la peau ou dedans, se paient par pas
d'`echelle` : le coude ne rentre pas dans le dos ni l'avant-bras dans le ventre (#3806). La garde `membres` de
l'évaluateur mesure la peau elle-même."""


def cle(u, milieu, direction, flexion=0.0, torsion=0.0, elan=False):
    """La clé de geste à l'instant `u` (fraction du clip) : milieu des deux prises, direction unitaire vers la seconde
    prise, flexion et torsion du dos, et si le geste y passe avec élan."""
    return u, Vector(milieu), Vector(direction).normalized(), Vector((flexion, torsion)), elan


REPOS = ((-0.02, -0.25, 1.2925), (0.85, 0.0, -0.53))
"""Le manche en travers de la poitrine, à une main de distance devant elle, la main droite devant l'épaule droite, la
gauche devant le bas du sternum, le fer en haut à droite : l'avant-bras droit reste hors du ventre corpulent (#3806)."""
GARDE = ((0.04, -0.36, 1.10), (0.525, 0.279, -0.804))
"""Les mains devant le ventre, assez loin de lui pour le ventre corpulent, la hache dressée, penchée vers l'épaule
droite, le tranchant vers l'adversaire (#3806)."""
LEVEE = ((-0.12, -0.21, 1.18), (0.482, -0.269, -0.834))
"""Les mains montées devant la poitrine, côté droit, le fer dressé au-dessus de l'épaule droite."""
ARME = ((-0.22, -0.18, 1.42), (0.12, -0.98, -0.15))
"""Les mains montées à droite du menton, devant lui, la hache armée au-dessus de l'épaule droite, le manche le long de la
tête et non devant le visage, le tranchant vers le haut."""
TAILLE = ((-0.06, -0.36, 1.26), (0.58, -0.101, -0.809))
"""Les mains descendues devant le visage, à bout de bras, le fer passant au-dessus de la tête : l'avant-bras gauche passe
devant la poitrine et non contre elle (#3806)."""
COUP = ((0.14, -0.36, 1.06), (0.42, 0.72, -0.55))
"""Les mains abaissées devant le ventre, la gauche à gauche de la droite plus que derrière elle, le fer abattu devant, à
hauteur de poitrine, le tranchant vers le bas : l'avant-bras gauche ne rentre pas dans le ventre corpulent (#3806)."""

HAMPE_REPOS = ((-0.05, -0.25, 1.28), (0.55, 0.05, 0.83))
"""La hampe dressée devant le torse, penchée vers l'épaule gauche, la main droite à la hanche, la gauche devant le sein
gauche, le fer au-dessus."""
HAMPE_GARDE = ((-0.175, -0.2, 1.0), (0.272, -0.809, 0.521))
"""La main droite au talon contre la hanche droite, la gauche devant, le fer pointé à hauteur de tête."""
HAMPE_ARME = ((-0.13, -0.017, 1.143), (0.437, -0.354, 0.827))
"""La main gauche montée devant la poitrine, la droite à la hanche droite, le fer dressé haut, penché devant à gauche."""
HAMPE_COUP = ((-0.07, -0.36, 1.0), (0.4, -0.85, 0.25))
"""Le corps penché dans le coup, les mains devant les hanches, le fer jeté devant, à hauteur de tête à deux mètres."""

CLIPS = {
    'Lourde_Repos_Loop': ('Idle_Loop', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'Lourde_Marche_Loop': ('Walk_Loop', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'Lourde_Attaque': ('Sword_Idle', 'root', 'lourde2m', (cle(0.0, *GARDE, 8), cle(0.2, *LEVEE, 0, -5, elan=True),
                                                          cle(0.35, *ARME, -8, -20), cle(0.44, *TAILLE, 9.5, 9, elan=True),
                                                          cle(0.52, *COUP, 25, 35, elan=True),
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


class PeauDuBras(NamedTuple):
    """Les arêtes de la peau que meut un bras (`peau_du_bras`) : leurs sommets au repos, homogènes, dans le repère du rig,
    les poids de chacun sur chaque os, les arêtes en indices de ces sommets, et leur longueur au repos."""
    x: numpy.ndarray
    w: numpy.ndarray
    aretes: numpy.ndarray
    longueurs: numpy.ndarray


def peau_du_bras(peaux, noms, mobiles, monde_vers_rig):
    """La `PeauDuBras` de `peaux` (`poids.peau_lineaire`, os `noms`) : les arêtes dont un sommet suit l'un des os
    `mobiles`, le bras, l'avant-bras et leurs descendants ; `monde_vers_rig` passe du repère monde à celui du rig."""
    colonnes = [noms.index(n) for n in mobiles]
    positions, poids, aretes, compte = [], [], [], 0
    for peau in peaux:
        x, w = peau_lineaire(peau, noms)
        paires = numpy.array([e.vertices[:] for e in peau.data.edges], dtype=numpy.int64).reshape(-1, 2)
        paires = paires[(w[:, colonnes].sum(axis=1)[paires] > POIDS_NEGLIGEABLE).any(axis=1)]
        sommets, locales = numpy.unique(paires, return_inverse=True)
        positions.append(x[sommets].astype(numpy.float64) @ numpy.array(monde_vers_rig).T)
        poids.append(w[sommets].astype(numpy.float64))
        aretes.append(locales.reshape(-1, 2) + compte)
        compte += len(sommets)
    x, aretes = numpy.concatenate(positions), numpy.concatenate(aretes)
    return PeauDuBras(x, numpy.concatenate(poids), aretes, numpy.linalg.norm(x[aretes[:, 0], :3] - x[aretes[:, 1], :3], axis=1))


def peau_fixe(peau, matrices, libres):
    """Les sommets de `peau` (`PeauDuBras`) sous les matrices de peau `matrices` (os, 4, 4) de tous les os sauf les
    `libres` (indices), dont la part reste à ajouter (`etirement_du_bras`)."""
    w = peau.w.copy()
    w[:, libres] = 0.0
    return deformer(w, peau.x, matrices[None])[0]


def etirement_du_bras(peau, fixe, libres):
    """Par pose, le plus grand rapport de longueur à la longueur de repos des arêtes de `peau` (`PeauDuBras`), et le plus
    petit de celles qu'un os de `libres` meut : `fixe` (`peau_fixe`), plus la part de chaque os de `libres`, couples
    d'indice d'os et de ses matrices de peau par pose (poses, 4, 4). Le poing fermé des clips sources, que les os libres
    ne meuvent pas, n'y entre pas."""
    y = fixe[None] + sum(peau.w[None, :, os_, None] * numpy.einsum('nj,kij->kni', peau.x, matrices)[..., :3]
                         for os_, matrices in libres)
    a, b = peau.aretes[:, 0], peau.aretes[:, 1]
    rapports = numpy.linalg.norm(y[:, a] - y[:, b], axis=2) / peau.longueurs[None]
    meues = (peau.w[:, [os_ for os_, _ in libres]].sum(axis=1) > POIDS_NEGLIGEABLE)[peau.aretes].any(axis=1)
    return rapports.max(axis=1), rapports[:, meues].min(axis=1)


class PeauDuTronc(NamedTuple):
    """Les sommets du tronc (`TRONC`) : par jeu de silhouettes, leurs positions au repos, homogènes, dans le repère du rig,
    leurs normales au repos et leurs poids sur chaque os."""
    x: numpy.ndarray
    n: numpy.ndarray
    w: numpy.ndarray


def peau_du_tronc(peaux, noms, monde_vers_rig):
    """La `PeauDuTronc` de `peaux` (`poids.peau_lineaire`, os `noms`) ; `monde_vers_rig` passe du repère monde à celui du
    rig."""
    jeux, normales, poids = [[] for _ in TRONC['silhouettes']], [], []
    vers_rig = numpy.array(monde_vers_rig)
    for peau in peaux:
        x, w = peau_lineaire(peau, noms)
        garde = numpy.array([zone_de_l_os(noms[i]) in TRONC['zones'] for i in w.argmax(axis=1)])
        if not garde.any():
            continue
        tour = vers_rig[:3, :3] @ numpy.array(peau.matrix_world.to_3x3())
        cles = peau.data.shape_keys.key_blocks if peau.data.shape_keys else {}
        base = numpy.array([v.co for v in peau.data.vertices], dtype=numpy.float64)[garde]
        for jeu, silhouettes in zip(jeux, TRONC['silhouettes']):
            ecart = sum((numpy.array([c.co for c in cles[n].data], dtype=numpy.float64)[garde] - base for n in silhouettes),
                        numpy.zeros_like(base))
            jeu.append(x[garde].astype(numpy.float64) @ vers_rig.T + numpy.c_[ecart @ tour.T, numpy.zeros(len(base))])
        normales.append(numpy.array([v.normal for v in peau.data.vertices], dtype=numpy.float64)[garde] @ tour.T)
        poids.append(w[garde].astype(numpy.float64))
    return PeauDuTronc(numpy.stack([numpy.concatenate(j) for j in jeux]), numpy.concatenate(normales), numpy.concatenate(poids))


def tronc_pose(tronc, matrices):
    """Les sommets de `tronc` (`PeauDuTronc`) sous les matrices de peau `matrices` (os, 4, 4) : par jeu, leurs positions
    (jeux, sommets, 3), et leurs normales (sommets, 3)."""
    positions = numpy.stack([deformer(tronc.w, x, matrices[None])[0] for x in tronc.x])
    normales = numpy.einsum('nb,bij,nj->ni', tronc.w, matrices[:, :3, :3], tronc.n)
    return positions, normales / numpy.linalg.norm(normales, axis=1, keepdims=True)


def prix_du_tronc(tronc, coudes, poignet):
    """Par coude de `coudes` (essais, 3), le prix des `points` de son axe jusqu'au `poignet` près du tronc posé
    (`tronc_pose`) : le plus proche sommet de chaque jeu, et l'enfoncement du point sous sa normale."""
    if tronc is None:
        return numpy.zeros(len(coudes))
    positions, normales = tronc
    points = numpy.stack([coudes + (numpy.array(poignet) - coudes) * f for f in TRONC['points']], axis=1)
    prix = numpy.zeros(len(coudes))
    for jeu in positions:
        ecarts = jeu[None, None] - points[:, :, None]
        proche = numpy.linalg.norm(ecarts, axis=3).argmin(axis=2)
        dedans = numpy.einsum('epk,epk->ep', numpy.take_along_axis(ecarts, proche[..., None, None], axis=2)[:, :, 0],
                              normales[proche])
        prix += ((numpy.maximum(0.0, dedans + TRONC['marge']) / TRONC['echelle']) ** 2).sum(axis=1)
    return prix


def bras(epaule, axes_epaule, main, longueurs, pole, rel_avant_bras, rel_main, pronation, precedent=None, peau=None,
         tronc=None):
    """La pose d'un bras dont la main prend la matrice `main` : le bras tourne au plus court depuis `axes_epaule` (sa pose
    au repos sous la clavicule), sans torsion, comme dans les clips sources ; l'avant-bras plie depuis le bras, puis tourne
    sur son axe, dans les bornes de `pronation`, pour détordre le poignet ; le coude tourne autour de l'axe
    épaule-poignet, à partir du côté de `pole`, jusqu'à la pose qui paie le moins (`POIGNET`), au plus près du tour
    `precedent`, sous l'étirement de la peau (`PEAU`) quand `peau` porte la `PeauDuBras`, sa part fixe (`peau_fixe`),
    et l'indice d'os et l'inverse du repos du bras puis de l'avant-bras, et à l'écart du tronc posé `tronc`
    (`tronc_pose`, `prix_du_tronc`). `rel_avant_bras` et `rel_main` : chaque os dans
    le repère de son parent, au repos. Rend le prix de la pose, les axes du bras et de l'avant-bras, le coude, le tour
    retenu, en degrés, et le détail : torsion demandée et portée par l'avant-bras, flexion du poignet, écart de charnière,
    étirement de la peau."""
    poignet, articulation = coude(epaule, main.translation, *longueurs, pole)
    axe = (poignet - epaule).normalized()
    centre = epaule + axe * (articulation - epaule).dot(axe)
    axes_main = main.to_3x3()

    def geste(tour):
        coude_ = centre + Quaternion(axe, math.radians(tour)) @ (articulation - centre)
        humerus = (axes_epaule.col[1].rotation_difference((coude_ - epaule).normalized()).to_matrix() @ axes_epaule)
        repos = humerus @ rel_avant_bras
        pli = repos.col[1].rotation_difference((poignet - coude_).normalized())
        charniere = 0.0 if pli.angle < 1e-6 else math.degrees((humerus.transposed() @ pli.axis).angle(Vector((1, 0, 0))))
        plie = pli.to_matrix() @ repos
        torsion = math.degrees(((plie @ rel_main).transposed() @ axes_main).to_quaternion().to_swing_twist('Y')[1])
        tourne = min(max(torsion, pronation[0]), pronation[1])
        avant_bras = plie @ Matrix.Rotation(math.radians(tourne), 3, 'Y')
        flexion = math.degrees(((avant_bras @ rel_main).transposed() @ axes_main).to_quaternion().to_swing_twist('Y')[0].angle)
        prix = ((torsion - tourne) / POIGNET['torsion']) ** 2 + (max(0.0, flexion - POIGNET['flexion']) / 10) ** 2 \
            + (max(0.0, charniere - POIGNET['charniere']) / 10) ** 2 + (tour / 45) ** 2 \
            + (0.0 if precedent is None else ((tour - precedent) / 10) ** 2) \
            + 1e3 * (max(0.0, abs(torsion - tourne) - POIGNET['torsion_max']) + max(0.0, flexion - POIGNET['flexion_max'])) ** 2
        return prix, humerus, avant_bras, coude_, tour, (round(torsion), round(tourne), round(flexion), round(charniere))

    def essais(tours):
        gestes = [geste(t) for t in tours]
        etires, ecrases = numpy.ones(len(gestes)), numpy.ones(len(gestes))
        if peau is not None:
            peau_, fixe, (os_bras, inverse_bras), (os_avant_bras, inverse_avant_bras) = peau
            matrices = {os_bras: [], os_avant_bras: []}
            for _, humerus, avant_bras, coude_, _, _ in gestes:
                for os_, axes, origine, inverse in ((os_bras, humerus, epaule, inverse_bras),
                                                    (os_avant_bras, avant_bras, coude_, inverse_avant_bras)):
                    pose_ = axes.to_4x4()
                    pose_.translation = origine
                    matrices[os_].append(numpy.array(pose_ @ inverse))
            etires, ecrases = etirement_du_bras(peau_, fixe, [(os_, numpy.array(m)) for os_, m in matrices.items()])
        troncs = prix_du_tronc(tronc, numpy.array([g[3] for g in gestes]), poignet)
        return [(g[0] + t + (max(0.0, e - ETIREMENT_EN_CLIP[1] + PEAU['marge']) / PEAU['echelle']) ** 2
                 + (max(0.0, PEAU['plancher'] - c) / PEAU['echelle_plancher']) ** 2, *g[1:5], (*g[5], float(e), float(c)))
                for g, e, c, t in zip(gestes, etires, ecrases, troncs)]

    meilleur = min(essais(range(-120, 121, 6)), key=lambda e: e[0])
    for pas in (2, 0.5):
        meilleur = min(essais([meilleur[4] + i * pas for i in range(-3, 4)]), key=lambda e: e[0])
    return meilleur


def repere_de_l_arme(flanc, prise, fer):
    """Le repère de la prise `main` à la `prise`, son +Y vers le `fer`, son +X au plus près de `flanc`."""
    y = fer.normalized()
    x = (flanc - y * flanc.dot(y)).normalized()
    repere = Matrix((x, y, x.cross(y))).transposed().to_4x4()
    repere.translation = prise
    return repere


def _poser_les_bras(bpy, rig, arme, mains, cadre, longueurs, precedents, peaux, tronc):
    """Les deux bras posés (`bras`) sur l'arme au repère `arme`, roulée autour de son manche (son +Y) du tour qui paie le
    moins, bras compris, au plus près du roulis `precedents['roulis']` : par côté, `mains` porte la matrice de sa main
    dans le repère de l'arme, et `peaux` la peau que meut son bras (`peau_du_bras`) ; chaque bras se tient à l'écart de
    la `PeauDuTronc` `tronc`. Rend l'écart de position restant,
    les tours retenus et le détail de chaque bras (`bras`)."""
    pose, repos = rig.pose.bones, rig.data.bones
    noms = [b.name for b in repos]
    inverses = {n: repos[n].matrix_local.inverted() for n in noms}
    courantes = numpy.array([numpy.array(pose[n].matrix @ inverses[n]) for n in noms])
    tronc_ = tronc_pose(tronc, courantes)
    poses = {}
    for cote in mains:
        epaule = pose[BRAS[cote][0]]
        rel = [(repos[p].matrix_local.inverted() @ repos[e].matrix_local).to_3x3() for p, e in zip(BRAS[cote], BRAS[cote][1:])]
        main_ = BRAS[cote][2]
        suivent = [noms.index(o.name) for o in repos[main_].children_recursive]
        poses[cote] = (epaule.matrix.translation.copy(), epaule.matrix.to_3x3(), cadre.to_3x3() @ POLES[cote], rel,
                       noms.index(main_), suivent, [(noms.index(n), inverses[n]) for n in BRAS[cote][:2]])

    def peau(cote, main, os_main, suivent, libres):
        """La peau du bras `cote` (`bras`) dont la main prend la matrice `main` ; ses descendants la suivent."""
        matrices = courantes.copy()
        matrices[os_main] = numpy.array(main @ inverses[noms[os_main]])
        relative = matrices[os_main] @ numpy.linalg.inv(courantes[os_main])
        matrices[suivent] = relative @ courantes[suivent]
        return peaux[cote], peau_fixe(peaux[cote], matrices, [i for i, _ in libres]), *libres

    def essai(roulis):
        roule = arme @ Matrix.Rotation(math.radians(roulis), 4, 'Y')
        poses_ = {c: bras(t, a, roule @ mains[c], longueurs[c], p, r[0], r[1], PRONATION[c], precedents.get(c),
                          peau(c, roule @ mains[c], m, d, libres), tronc_)
                  for c, (t, a, p, r, m, d, libres) in poses.items()}
        prix = sum(e[0] for e in poses_.values()) + (roulis / POIGNET['roulis']) ** 2 \
            + (0.0 if precedents.get('roulis') is None else ((roulis - precedents['roulis']) / 10) ** 2)
        return prix, roulis, roule, poses_

    meilleur = min((essai(r) for r in range(-180, 180, 30)), key=lambda e: e[0])
    for pas in (10, 3, 1):
        meilleur = min((essai(meilleur[1] + i * pas) for i in (-1, 0, 1)), key=lambda e: e[0])
    prix_total, roulis, roule, poses_ = meilleur
    ecart = 0.0
    for cote, (_, humerus, axes_avant_bras, articulation, _, _) in poses_.items():
        epaule, avant_bras, os_main = (pose[n] for n in BRAS[cote])
        for os_, axes, origine in ((epaule, humerus, poses[cote][0]), (avant_bras, axes_avant_bras, articulation)):
            matrice = axes.to_4x4()
            matrice.translation = origine
            os_.matrix = matrice
            bpy.context.view_layer.update()
        finale = roule @ mains[cote]
        cible = finale.translation.copy()
        finale.translation = os_main.matrix.translation.copy()
        os_main.matrix = finale
        bpy.context.view_layer.update()
        ecart = max(ecart, (cible - os_main.matrix.translation).length)
    return ecart, {'roulis': roulis, **{c: e[4] for c, e in poses_.items()}}, {c: e[5] for c, e in poses_.items()}


def deriver(bpy, rig, reperes):
    """Les actions de `CLIPS`, ajoutées au rig `rig` d'après ses clips sources, aux instants de chacun (`poids.instants`),
    sur la peau aux poids corrigés et les clips sources posés au sol (après le point fixe de `humanoide.construire`) ;
    `reperes` : par prise `main` et `off`, son os et son repère dans celui de cet os (`anatomie.reperes_des_prises`)."""
    repos = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    longueurs = {cote: ((repos[c].translation - repos[e].translation).length, (repos[m].translation - repos[c].translation).length)
                 for cote, (e, c, m) in BRAS.items()}
    prise_main, prise_off = reperes['main'][1], reperes['off'][1]
    scene, pose = bpy.context.scene, rig.pose.bones
    noms = [b.name for b in rig.data.bones]
    peaux = {cote: peau_du_bras(meshes_for(bpy, rig), noms, [o.name for o in (rig.data.bones[b], *rig.data.bones[b].children_recursive)],
                                rig.matrix_world.inverted())
             for cote, (b, _, _) in BRAS.items()}
    tronc = peau_du_tronc(meshes_for(bpy, rig), noms, rig.matrix_world.inverted())
    animes = [n for os in BRAS.values() for n in os] + list(CLAVICULES) + list(DOS)
    derivees = []
    for nom, (source_nom, os_du_cadre, maniement, cles) in CLIPS.items():
        source = bpy.data.actions[source_nom]
        assign_action(rig, source)
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
        assign_action(rig, action)
        ecart, tours, poignets = 0.0, {}, {'torsion': 0, 'flexion': 0, 'coude': 1.0}
        for image in images:
            aller_a(scene, image)
            for n in animes:
                pose[n].rotation_quaternion = dos_source[image].get(n, Quaternion())
                pose[n].location = Vector()
            bpy.context.view_layer.update()
            cote, tour_seconde = SECONDES[maniement]
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
            mains = {'r': prise_main.inverted(),
                     'l': Matrix.Translation((0, cote, 0)) @ Matrix.Rotation(math.radians(tour_seconde), 4, 'Y') @ prise_off.inverted()}
            reste, tours, details = _poser_les_bras(bpy, rig, arme, mains, cadre, longueurs, tours, peaux, tronc)
            ecart = max(ecart, reste)
            for cote_, (torsion_, tourne, flexion_, _, etire, ecrase) in details.items():
                if abs(torsion_ - tourne) > POIGNET['torsion_max'] or flexion_ > POIGNET['flexion_max']:
                    raise ValueError(f'{nom} image {image} : poignet {cote_} tordu de {torsion_ - tourne}°, plié de {flexion_}°')
                if etire > ETIREMENT_EN_CLIP[1] or ecrase < ETIREMENT_EN_CLIP[0]:
                    raise ValueError(f'{nom} image {image} : peau du bras {cote_} étirée à {etire:.2f}, écrasée à {ecrase:.3f}')
                poignets = {'torsion': max(poignets['torsion'], abs(torsion_ - tourne)), 'flexion': max(poignets['flexion'], flexion_),
                            'coude': round(max(poignets['coude'], etire), 2)}
            for n in animes:
                pose[n].keyframe_insert('rotation_quaternion', frame=image)
        print('DEUX_MAINS', nom, 'de', source_nom, 'images', len(images), 'écart de main', round(ecart, 4), 'poignet',
              poignets, flush=True)
        derivees.append(action)
    return derivees
