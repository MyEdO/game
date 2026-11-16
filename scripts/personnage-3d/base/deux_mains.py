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

Un clip dérivé tient la peau de ses avant-bras et de ses mains hors du tronc sous chaque jeu de silhouettes de
`tronc.TRONC`, carrures comprises, les os déplacés comme l'hôte les joue, mesurée comme la mesure la garde `membres`
(`tronc`) : l'IK choisit le tour du coude qui l'écarte, et ce qu'elle ne peut pas écarter, l'arme l'écarte, translatée
hors du tronc avec les deux mains qui la tiennent (`pousser`, `POUSSEE`, #4002, #3810).

Le roulis de l'arme et le tour de chaque coude se choisissent sur le clip entier : le chemin retenu
est celui qui paie le moins, poses et vitesses comprises (`chemin`, `poser_les_bras`, #3878).

Repère Blender du rig : +X la gauche du personnage, −Y l'avant, +Z le haut.
"""
import json
import math
from pathlib import Path
from typing import NamedTuple

import numpy
from mathutils import Matrix, Quaternion, Vector

from animation import assign_action, meshes_for
from pistes import aller_a, sacs
from poids import cadence, deformer, instants, peau_lineaire
from seuils import ETIREMENT_EN_CLIP, POIDS_NEGLIGEABLE, VITESSE_DU_POIGNET
from tronc import (TRONC, ChaineDuBras, membre_pose, peau_du_membre, peau_du_tronc, poser_le_membre, profondeurs, tetes_du_bras,
                   tronc_pose)

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
BORNES = json.loads(Path(__file__).with_name('humanoide.json').read_text(encoding='utf-8'))['bornesArticulaires']
"""Par os, les bornes articulaires que déclare le corps (`bornesArticulaires`, #2992) : par axe, [min, max] en degrés du
vecteur de rotation de l'os depuis son repos (`hors_des_bornes`) ; une pose d'avant-bras ou de main qui en sort, à
`MARGE_DES_BORNES` près, se paie comme une limite."""
MARGE_DES_BORNES = 1.0
"""En degrés, la marge en deçà des bornes où l'IK tient une pose : l'export et l'interpolation entre deux images la
déplacent de moins que cela, et la garde `amplitude` mesure la pose jouée."""
PEAU = {'marge': 0.25, 'echelle': 0.02, 'plancher': 0.2, 'echelle_plancher': 0.01}
"""L'étirement des arêtes de la peau que meut un bras (`etirement_du_bras`), mesuré sur le corps neutre, se paie au-delà de
la borne haute de `ETIREMENT_EN_CLIP` moins `marge`, par pas d'`echelle`, et son écrasement en deçà de `plancher`, par pas
d'`echelle_plancher` : la marge et le plancher couvrent les silhouettes et les états du gabarit, que la mesure ne parcourt
pas, sous lesquels une arête du poignet écrasée à 0,07 sur le corps neutre passe sous la borne basse, et l'aisselle et le
haut de l'épaule, tenus à 0,12 sur le corps neutre, passent sous elle sous les silhouettes combinées (#3319)."""
ECART_DU_TRONC = {'marge': 0.005, 'echelle': 0.01}
"""En mètres : la peau de l'avant-bras et de la main (`tronc.peau_du_membre`) se tient à `marge` hors du tronc
(`tronc.TRONC`) sous chacun de ses jeux, les os déplacés comme l'hôte les joue ; le pire de ses sommets, plus près que
`marge` ou dedans, se paie par pas d'`echelle` (`prix_du_tronc`, #3806, #4002, #3810). La garde `membres` admet un sommet
à 5 mm dedans (`ECART_DE_SUIVI_M`) ; le champ s'écarte de la distance exacte de moins de 4,2 mm près de la surface
(`tronc.CHAMP`) : un sommet tenu à `marge` dehors par le champ reste hors de portée de la garde."""
POUSSEE = {'pas': 8, 'passes': 4, 'tolerance': 1e-4, 'refus': 0.0009}
"""La poussée de l'arme hors du tronc (`pousser`, `poser_les_bras`) : au plus `pas` translations par poussée, chacune
contre le gradient du champ du tronc (`tronc.profondeurs`) au sommet le plus enfoncé de la peau que la translation
emporte, jusqu'à `ECART_DU_TRONC['marge']` dehors à `tolerance` mètres près ; au plus `passes` tours de poussée puis
d'IK après le premier IK (#4002, #3810). La peau entière posée encore enfoncée de plus de `refus` mètres refuse le
clip : la garde `membres` admet 5 mm dedans et le champ s'écarte de la distance exacte de moins de 4,1 mm
(`tronc.CHAMP`), une peau lue à moins de 0,9 mm dedans reste sous la tolérance de la garde."""
ROULIS = tuple(range(-180, 180, 15))
"""En degrés, les roulis de l'arme autour de son manche parmi lesquels le chemin d'un clip se cherche d'abord
(`poser_les_bras`)."""
TOURS = tuple(range(-120, 121, 6))
"""En degrés, les tours du coude autour de l'axe épaule-poignet parmi lesquels le chemin d'un clip se cherche d'abord."""
AFFINAGES = (((-9, -6, -3, 0, 3, 6, 9), (-4, -2, 0, 2, 4)), ((-2, -1, 0, 1, 2), (-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5)))
"""Par affinage du chemin, en degrés, les écarts de roulis puis de tour du coude essayés autour de l'état retenu à chaque
image : chaque affinage couvre le pas de la recherche qui le précède, le dernier au degré de roulis et au demi-degré de
tour."""
CONTINUITE = {'vitesse': 3.0, 'passes': 4}
"""`vitesse` : en degrés par image de `IMAGES_PAR_SECONDE`, la vitesse du roulis de l'arme et du tour d'un coude qui paie,
sur une image, une unité de prix (`chemin`, #3878). `passes` : le nombre de fois où chaque affinage se rejoue autour du
chemin qu'il vient de rendre, pour qu'un écart pris d'un coup sur le pas d'une recherche s'étale sur les images voisines."""


def cle(u, milieu, direction, flexion=0.0, torsion=0.0, elan=False):
    """La clé de geste à l'instant `u` (fraction du clip) : milieu des deux prises, direction unitaire vers la seconde
    prise, flexion et torsion du dos, et si le geste y passe avec élan."""
    return u, Vector(milieu), Vector(direction).normalized(), Vector((flexion, torsion)), elan


REPOS = ((-0.02, -0.25, 1.2925), (0.85, 0.0, -0.53))
"""Le manche en travers de la poitrine, à une main de distance devant elle, la main droite devant l'épaule droite, la
gauche devant le bas du sternum, le fer en haut à droite : l'avant-bras droit reste hors du ventre corpulent (#3806)."""
REPOS_LOIN = ((-0.02, -0.40, 1.2925), (0.85, 0.0, -0.53))
"""Le repos, les mains écartées de la poitrine : dans le recul et la chute, le dos qui se plie sur les hanches ne mène pas
l'avant-bras gauche dans le ventre ; une fois le corps à terre, les mains reviennent au repos, sur la poitrine, et ne
tendent pas l'arme vers le ciel (#3806)."""
GARDE = ((0.04, -0.38, 1.12), (0.40, 0.10, -0.91))
"""Les mains devant le ventre, assez loin de lui pour le ventre corpulent, la hache dressée, penchée vers l'épaule
droite, le tranchant vers l'adversaire, la main gauche sous la droite, à peine en arrière d'elle : l'arrière de
l'aisselle gauche ne s'écrase pas sous les silhouettes féminine, corpulente ou mince (#3806)."""
LEVEE = ((-0.24, -0.22, 1.16), (0.25, -0.25, -0.93))
"""Les mains montées devant l'épaule droite, le fer dressé au-dessus d'elle, le manche presque droit à droite du menton
et non en travers du visage (#3806)."""
ARME = ((-0.38, -0.12, 1.40), (-0.05, -0.98, -0.2))
"""Les mains montées à droite de la tête, la hache armée au-dessus de l'épaule droite, le manche le long de la tête et
non devant le visage ni dans la bouche, le tranchant vers le haut (#3806)."""
TAILLE = ((-0.06, -0.36, 1.26), (0.58, -0.101, -0.809))
"""Les mains descendues devant le visage, à bout de bras, le fer passant au-dessus de la tête : l'avant-bras gauche passe
devant la poitrine et non contre elle (#3806)."""
COUP = ((0.10, -0.36, 1.06), (0.42, 0.72, -0.55))
"""Les mains abaissées devant le ventre, la gauche à gauche de la droite plus que derrière elle, le fer abattu devant, à
hauteur de poitrine, le tranchant vers le bas : l'avant-bras gauche ne rentre pas dans le ventre corpulent, et le bras
droit, peu croisé devant le corps, n'écrase pas le haut de l'épaule droite au retour en garde (#3806)."""

HAMPE_REPOS = ((-0.05, -0.25, 1.28), (0.55, 0.05, 0.83))
"""La hampe dressée devant le torse, penchée vers l'épaule gauche, la main droite à la hanche, la gauche devant le sein
gauche, le fer au-dessus."""
HAMPE_CHUTE = ((-0.02, -0.33, 1.36), (0.88, 0.1, -0.4))
"""La hampe en travers de la poitrine, la main droite devant l'épaule droite, la gauche devant le bas de la poitrine, le
fer en bas à gauche : dans la chute, le corps la garde en travers de lui et non dressée en l'air, les mains hautes et
écartées du ventre, qui se plie (#3806)."""
HAMPE_GISANT = ((-0.02, -0.22, 1.30), (0.88, 0.1, -0.4))
"""La hampe de la chute, couchée sur la poitrine du corps à terre, le fer vers le sol à sa gauche (#3806)."""
HAMPE_GARDE = ((-0.175, -0.2, 1.0), (0.272, -0.809, 0.521))
"""La main droite au talon contre la hanche droite, la gauche devant, le fer pointé à hauteur de tête."""
HAMPE_ARME = ((-0.13, -0.04, 1.143), (0.437, -0.354, 0.827))
"""La main gauche montée devant la poitrine, hors de la poitrine corpulente, la droite à la hanche droite, le fer dressé
haut, penché devant à gauche (#3806)."""
HAMPE_COUP = ((-0.07, -0.36, 1.0), (0.4, -0.85, 0.25))
"""Le corps penché dans le coup, les mains devant les hanches, le fer jeté devant, à hauteur de tête à deux mètres."""

CLIPS = {
    'Lourde_Repos_Loop': ('Idle_Loop', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'Lourde_Marche_Loop': ('Walk_Loop', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(1.0, *REPOS))),
    'Lourde_Attaque': ('Sword_Idle', 'root', 'lourde2m', (cle(0.0, *GARDE, 8), cle(0.2, *LEVEE, 0, -5, elan=True),
                                                          cle(0.35, *ARME, -8, -20), cle(0.44, *TAILLE, 9.5, 9, elan=True),
                                                          cle(0.52, *COUP, 25, 35, elan=True),
                                                          cle(0.62, *COUP, 25, 35), cle(1.0, *GARDE, 8))),
    'Lourde_Touche': ('Hit_Chest', 'spine_03', 'lourde2m', (cle(0.0, *REPOS_LOIN), cle(0.75, *REPOS_LOIN), cle(1.0, *REPOS))),
    'Lourde_Mort': ('Death01', 'spine_03', 'lourde2m', (cle(0.0, *REPOS), cle(0.05, *REPOS_LOIN), cle(0.42, *REPOS_LOIN),
                                                    cle(0.52, *REPOS), cle(1.0, *REPOS))),
    'Hampe_Repos_Loop': ('Idle_Loop', 'spine_03', 'hampe', (cle(0.0, *HAMPE_REPOS), cle(1.0, *HAMPE_REPOS))),
    'Hampe_Marche_Loop': ('Walk_Loop', 'spine_03', 'hampe', (cle(0.0, *HAMPE_REPOS), cle(1.0, *HAMPE_REPOS))),
    'Hampe_Attaque': ('Sword_Idle', 'root', 'hampe', (cle(0.0, *HAMPE_GARDE, 5), cle(0.3, *HAMPE_ARME, -5, -10),
                                                      cle(0.48, *HAMPE_COUP, 35, 25, elan=True),
                                                      cle(0.6, *HAMPE_COUP, 35, 25), cle(1.0, *HAMPE_GARDE, 5))),
    'Hampe_Touche': ('Hit_Chest', 'spine_03', 'hampe', (cle(0.0, *HAMPE_REPOS), cle(1.0, *HAMPE_REPOS))),
    'Hampe_Mort': ('Death01', 'spine_03', 'hampe', (cle(0.0, *HAMPE_REPOS), cle(0.12, *HAMPE_CHUTE), cle(0.42, *HAMPE_CHUTE),
                                                cle(0.52, *HAMPE_GISANT), cle(1.0, *HAMPE_GISANT))),
}
"""Par clip dérivé : son clip source, l'os qui mène le repère de ses clés, son maniement (`SECONDES`) et ses clés de
geste. L'attaque d'une arme lourde, une taille verticale, part de la garde et y revient, sur les jambes de la garde ;
celle d'une hampe dresse le fer de la main gauche, la droite au talon, puis le jette devant, loin du corps. Touché et
mort gardent l'arme de leur repos, menée par le haut du dos : le corps recule ou tombe, l'arme en travers de lui ; la
hampe, dressée au repos, passe en travers dans la chute."""


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


def prix_du_tronc(tronc, membre, chaine, matrices, axes):
    """Par essai, matrices de peau du bras, de l'avant-bras et de la main `matrices` (essais, 3, 4, 4) et `axes` du bras
    et de l'avant-bras (essais, 2, 3, 3), le prix de la peau du membre `membre` ((`tronc.MembrePose`, indices de son
    sous-échantillon, `tronc.PeauDuMembre`)) près du `tronc.TroncPose` `tronc`, sur le bras déplacé sous chaque jeu
    (`tronc.ChaineDuBras` `chaine`) : sous chaque jeu, l'enfoncement de son pire sommet, à `ECART_DU_TRONC['marge']`.
    Seuls les essais dont l'échantillon grossier, élargi de son rayon, peut toucher le tronc à cette marge lisent le
    sous-échantillon."""
    pose, peau = membre
    tetes = tetes_du_bras(chaine, axes)
    grossiers = profondeurs(tronc, poser_le_membre(pose, matrices, tetes, peau.grossier)).max(axis=-1)
    pires = grossiers.copy()
    proches = numpy.flatnonzero((grossiers + peau.rayon + ECART_DU_TRONC['marge'] > 0).any(axis=0))
    if len(proches):
        pires[:, proches] = profondeurs(tronc, poser_le_membre(pose, matrices[proches], tetes[:, proches], peau.echantillon)).max(axis=-1)
    return ((numpy.maximum(0.0, pires + ECART_DU_TRONC['marge']) / ECART_DU_TRONC['echelle']) ** 2).sum(axis=0)


def enfoncement(tronc, peau):
    """Le sommet le plus enfoncé de `peau` (jeux, sommets, 3) dans le `tronc.TroncPose` `tronc`, chacun sous son jeu, à
    `ECART_DU_TRONC['marge']` : son enfoncement en mètres, la direction (3,) qui l'en sort, contre le gradient du champ,
    et son jeu."""
    dedans, pentes = profondeurs(tronc, peau, gradient=True)
    jeu, i = numpy.unravel_index(dedans.argmax(), dedans.shape)
    pente = pentes[jeu, i]
    return float(dedans[jeu, i]) + ECART_DU_TRONC['marge'], -pente / max(numpy.linalg.norm(pente), 1e-12), int(jeu)


def pousser(tronc, peau):
    """La translation (3,) qui sort la `peau` (jeux, sommets, 3) des mains et des avant-bras qui tiennent une arme rigide
    du `tronc.TroncPose` `tronc`, à `ECART_DU_TRONC['marge']`, par pas contre le gradient du champ au sommet le plus
    enfoncé (`enfoncement`), au plus `POUSSEE['pas']` fois ; nulle sans contact."""
    pas = numpy.zeros(3)
    for _ in range(POUSSEE['pas']):
        profondeur, direction, _ = enfoncement(tronc, peau + pas)
        if profondeur <= POUSSEE['tolerance']:
            break
        pas = pas + direction * profondeur
    return pas


def hors_des_bornes(rotation, bornes):
    """Le dépassement, en degrés, sommé sur les axes, du vecteur de rotation de la matrice `rotation` (axe × angle,
    l'angle dans [0, 180], `hotes/godot/asset/evaluateur/gardes/amplitude.ts` `vecteurDeRotation`) hors de `bornes`
    (par axe, [min, max]) resserrées de `MARGE_DES_BORNES`."""
    q = rotation.to_quaternion()
    if q.w < 0:
        q.negate()
    v = q.axis * math.degrees(q.angle)
    return sum(max(0.0, v[i] - bornes[a][1] + MARGE_DES_BORNES, bornes[a][0] + MARGE_DES_BORNES - v[i]) for i, a in enumerate('xyz'))


def matrices_de_la_chaine(epaule, humerus, coude_, avant_bras, axes_main, repos):
    """Les matrices de peau (3, 4, 4) du bras aux axes `humerus` sur l'`epaule`, de l'avant-bras aux axes `avant_bras`
    sur le `coude_` et de la main aux axes `axes_main` sur sa tête, que l'avant-bras porte : `repos`, les inverses des
    matrices de repos des trois os et la tête de la main dans le repère de repos de l'avant-bras."""
    inverses, decalage = repos
    poses = []
    for axes, origine in ((humerus, epaule), (avant_bras, coude_), (axes_main, coude_ + avant_bras @ decalage)):
        pose = axes.to_4x4()
        pose.translation = origine
        poses.append(numpy.array(pose))
    return numpy.array(poses) @ inverses


def bras(epaule, axes_epaule, main, longueurs, pole, rel_avant_bras, rel_main, pronation, bornes, repos=None, peau=None, membre=None):
    """Les poses d'un bras dont la main prend la matrice `main` : le bras tourne au plus court depuis `axes_epaule` (sa pose
    au repos sous la clavicule), sans torsion, comme dans les clips sources ; l'avant-bras plie depuis le bras, puis tourne
    sur son axe, dans les bornes de `pronation`, pour détordre le poignet ; le coude tourne autour de l'axe
    épaule-poignet, à partir du côté de `pole`. Chaque tour du coude a son prix (`POIGNET`), dans les `bornes` de
    l'avant-bras puis de la main (`BORNES`, `hors_des_bornes`), sous l'étirement de la peau (`PEAU`) quand `peau` porte
    la `PeauDuBras`, sa part fixe (`peau_fixe`) et l'indice d'os du bras puis de l'avant-bras, et à l'écart du tronc
    quand `membre` porte le `tronc.TroncPose`, la `tronc.MembrePose` de ce côté et son sous-échantillon, et la
    `tronc.ChaineDuBras` de ce côté (`prix_du_tronc`) ; `repos` : celui de `matrices_de_la_chaine`, requis avec `peau`
    ou `membre`. `rel_avant_bras` et `rel_main` : chaque os dans le repère de son parent, au repos. Rend la
    fonction qui, à des tours du coude, en degrés, donne par tour le prix de la pose, les axes du bras et de l'avant-bras,
    le coude, le tour et le détail : torsion demandée et portée par l'avant-bras, flexion du poignet, écart de charnière,
    dépassement des bornes, étirement et écrasement de la peau. Le tour retenu se choisit sur le clip entier (`chemin`)."""
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
        hors = hors_des_bornes(repos.transposed() @ avant_bras, bornes[0]) \
            + hors_des_bornes((avant_bras @ rel_main).transposed() @ axes_main, bornes[1])
        prix = ((torsion - tourne) / POIGNET['torsion']) ** 2 + (max(0.0, flexion - POIGNET['flexion']) / 10) ** 2 \
            + (max(0.0, charniere - POIGNET['charniere']) / 10) ** 2 + (tour / 45) ** 2 \
            + 1e3 * (max(0.0, abs(torsion - tourne) - POIGNET['torsion_max']) + max(0.0, flexion - POIGNET['flexion_max']) + hors) ** 2
        return prix, humerus, avant_bras, coude_, tour, (round(torsion), round(tourne), round(flexion), round(charniere), round(hors, 1))

    def essais(tours):
        gestes = [geste(t) for t in tours]
        etires, ecrases, troncs = numpy.ones(len(gestes)), numpy.ones(len(gestes)), numpy.zeros(len(gestes))
        if peau is not None or membre is not None:
            chaines = numpy.array([matrices_de_la_chaine(epaule, g[1], g[3], g[2], axes_main, repos) for g in gestes])
        if peau is not None:
            peau_, fixe, os_bras, os_avant_bras = peau
            etires, ecrases = etirement_du_bras(peau_, fixe, [(os_bras, chaines[:, 0]), (os_avant_bras, chaines[:, 1])])
        if membre is not None:
            troncs = prix_du_tronc(membre[0], membre[1], membre[2], chaines, numpy.array([[g[1], g[2]] for g in gestes]))
        return [(g[0] + t + (max(0.0, e - ETIREMENT_EN_CLIP[1] + PEAU['marge']) / PEAU['echelle']) ** 2
                 + (max(0.0, PEAU['plancher'] - c) / PEAU['echelle_plancher']) ** 2, *g[1:5], (*g[5], float(e), float(c)))
                for g, e, c, t in zip(gestes, etires, ecrases, troncs)]

    return essais


def chemin(prix, valeurs, durees, tours_de_l_arme):
    """Par image, l'indice sur chaque axe de l'état du chemin qui paie le moins sur le clip entier : `prix[i]` porte le
    prix de chaque état de l'image i, un tableau à un axe par grandeur, le roulis de l'arme puis le tour de chaque
    coude ; `valeurs[i]` les valeurs de chaque axe, en degrés ; `durees[i]` la durée, en images, de l'image i − 1 à
    l'image i. D'une image à la suivante, chaque grandeur paie le carré de son écart sur `CONTINUITE['vitesse']`² fois
    la durée : l'intégrale du carré de sa vitesse. L'écart du roulis est celui de l'arme roulée, au plus court : il
    compte `tours_de_l_arme[i]`, le tour du repère de l'arme sur son manche de l'image i − 1 à l'image i
    (`tour_du_repere`)."""
    def passage(i, axe):
        ecarts = numpy.subtract.outer(numpy.asarray(valeurs[i][axe], dtype=float), numpy.asarray(valeurs[i - 1][axe], dtype=float))
        if axe == 0:
            ecarts = (ecarts + tours_de_l_arme[i] + 180) % 360 - 180
        return ecarts ** 2 / (CONTINUITE['vitesse'] ** 2 * durees[i])

    cumules = [numpy.asarray(prix[0], dtype=float)]
    for i in range(1, len(prix)):
        v = (passage(i, 0)[:, :, None, None] + cumules[-1][None]).min(axis=1)
        v = (passage(i, 1)[None, :, :, None] + v[:, None]).min(axis=2)
        v = (passage(i, 2)[None, None, :, :] + v[:, :, None]).min(axis=3)
        cumules.append(v + prix[i])
    etat = numpy.unravel_index(cumules[-1].argmin(), cumules[-1].shape)
    etats = [etat]
    for i in range(len(prix) - 1, 0, -1):
        total = cumules[i - 1] + passage(i, 0)[etat[0]][:, None, None] + passage(i, 1)[etat[1]][None, :, None] \
            + passage(i, 2)[etat[2]][None, None, :]
        etat = numpy.unravel_index(total.argmin(), total.shape)
        etats.append(etat)
    return [tuple(int(k) for k in e) for e in reversed(etats)]


def repere_de_l_arme(flanc, prise, fer):
    """Le repère de la prise `main` à la `prise`, son +Y vers le `fer`, son +X au plus près de `flanc`."""
    y = fer.normalized()
    x = (flanc - y * flanc.dot(y)).normalized()
    repere = Matrix((x, y, x.cross(y))).transposed().to_4x4()
    repere.translation = prise
    return repere


def tour_du_repere(avant, apres):
    """En degrés, le tour du repère d'une arme (`repere_de_l_arme`) autour de son manche, des axes `avant` aux axes
    `apres` : l'angle, autour du +Y d'`apres`, du +X d'`avant` mené au plus court sur le nouveau manche à celui
    d'`apres`. Le +X au plus près du flanc bascule quand le manche passe près du flanc ; le roulis qui garde l'arme
    comme elle est tourne d'autant en sens inverse."""
    mene = avant.col[1].rotation_difference(apres.col[1]) @ avant.col[0]
    return math.degrees(math.atan2(apres.col[1].dot(mene.cross(apres.col[0])), mene.dot(apres.col[0])))


class BrasDeLImage(NamedTuple):
    """Les deux bras d'une image d'un clip dérivé (`bras_de_l_image`) : le `tronc.TroncPose` de l'image ;
    `prix(translation, roulis, tours)`, le prix de chaque état (roulis de l'arme autour de son manche, tour du coude
    droit, tour du coude gauche), l'arme translatée de `translation`, sur les roulis `roulis` et, par côté, les tours
    `tours`, tous en degrés ; `poses(translation, etat)`, l'arme roulée et par côté la pose de son bras (`bras`) à l'état
    `etat` ; `peau(poses)`, par jeu, la peau entière des deux avant-bras et des deux mains (`tronc.peau_du_membre`) sous
    les `poses` (`poses`) : (jeux, sommets, 3) ; `mains(translation)`, par jeu, la peau des deux mains sur l'arme
    translatée de `translation`, sans roulis, chacune portée d'un bloc par sa main depuis la pose de l'image avant l'IK,
    à son ΔJ de l'image : (jeux, sommets, 3) ; `epaules`, par côté, la tête du bras."""
    tronc: object
    prix: object
    poses: object
    peau: object
    mains: object
    epaules: dict


def bras_de_l_image(rig, arme, mains, cadre, longueurs, peaux, tronc, membres, paumes):
    """Le `BrasDeLImage` de la pose courante de `rig`, l'arme au repère `arme` : par côté, `mains` porte la matrice de sa
    main dans le repère de l'arme, `peaux` la peau que meut son bras
    (`peau_du_bras`), `membres` la peau de son avant-bras et de sa main et `paumes` celle de sa main
    (`tronc.peau_du_membre`) ; chaque bras se tient à l'écart du `tronc.PeauDuTronc` `tronc` sous chacun de ses jeux."""
    pose, repos = rig.pose.bones, rig.data.bones
    noms = [b.name for b in repos]
    inverses = {n: repos[n].matrix_local.inverted() for n in noms}
    courantes = numpy.array([numpy.array(pose[n].matrix @ inverses[n]) for n in noms])
    tronc_ = tronc_pose(tronc, courantes)
    poses, chaines, membres_, reposes, paumes_ = {}, {}, {}, {}, {}
    for cote in mains:
        epaule = pose[BRAS[cote][0]]
        rel = [(repos[p].matrix_local.inverted() @ repos[e].matrix_local).to_3x3() for p, e in zip(BRAS[cote], BRAS[cote][1:])]
        main_ = BRAS[cote][2]
        suivent = [noms.index(o.name) for o in repos[main_].children_recursive]
        chaine = [noms.index(n) for n in BRAS[cote]]
        poses[cote] = (epaule.matrix.translation.copy(), epaule.matrix.to_3x3(), cadre.to_3x3() @ POLES[cote], rel,
                       noms.index(main_), suivent, chaine[:2])
        reposes[cote] = (numpy.array([numpy.array(inverses[n]) for n in BRAS[cote]]),
                         (repos[BRAS[cote][1]].matrix_local.inverted() @ repos[main_].matrix_local).translation.copy())
        chaines[cote] = ChaineDuBras(numpy.array([numpy.array(inverses[n].to_3x3()) for n in BRAS[cote][:2]]),
                                     tronc_.tetes[:, chaine[:1]] + tronc.deplacements[:, chaine] - tronc.deplacements[:, chaine[:1]])
        membres_[cote] = membre_pose(membres[cote], courantes, tronc_.tetes, tronc.deplacements, tronc.parent, chaine)
        paume = membre_pose(paumes[cote], courantes, tronc_.tetes, tronc.deplacements, tronc.parent, chaine)
        paumes_[cote] = (poser_le_membre(paume, courantes[chaine][None], tronc_.tetes[:, chaine][:, None])[:, 0],
                         tronc_.tetes[:, chaine[2]], courantes[chaine[2]], inverses[main_])

    def peau(cote, main, os_main, suivent, libres):
        """La peau du bras `cote` (`bras`) dont la main prend la matrice `main` ; ses descendants la suivent."""
        matrices = courantes.copy()
        matrices[os_main] = numpy.array(main @ inverses[noms[os_main]])
        relative = matrices[os_main] @ numpy.linalg.inv(courantes[os_main])
        matrices[suivent] = relative @ courantes[suivent]
        return peaux[cote], peau_fixe(peaux[cote], matrices, libres), *libres

    def roulee(translation, roulis):
        return Matrix.Translation(translation) @ arme @ Matrix.Rotation(math.radians(roulis), 4, 'Y')

    def essais(cote, roule):
        t, a, p, r, m, d, libres = poses[cote]
        return bras(t, a, roule @ mains[cote], longueurs[cote], p, r[0], r[1], PRONATION[cote],
                    (BORNES[BRAS[cote][1]], BORNES[BRAS[cote][2]]), reposes[cote], peau(cote, roule @ mains[cote], m, d, libres),
                    (tronc_, (membres_[cote], membres[cote]), chaines[cote]))

    def prix(translation, roulis, tours):
        table = numpy.empty((len(roulis), len(tours['r']), len(tours['l'])))
        for i, r in enumerate(roulis):
            roule = roulee(translation, r)
            droit, gauche = (numpy.array([e[0] for e in essais(c, roule)(tours[c])]) for c in ('r', 'l'))
            table[i] = (r / POIGNET['roulis']) ** 2 + droit[:, None] + gauche[None, :]
        return table

    def poses_(translation, etat):
        roule = roulee(translation, etat[0])
        return roule, {c: essais(c, roule)([tour])[0] for c, tour in zip(('r', 'l'), etat[1:])}

    def peau_(poses__):
        roule, bras_ = poses__
        vues = []
        for c, (_, humerus, avant_bras, coude_, _, _) in bras_.items():
            matrices = matrices_de_la_chaine(poses[c][0], humerus, coude_, avant_bras, (roule @ mains[c]).to_3x3(), reposes[c])
            tetes = tetes_du_bras(chaines[c], numpy.array([[numpy.array(humerus), numpy.array(avant_bras)]]))
            vues.append(poser_le_membre(membres_[c], matrices[None], tetes)[:, 0])
        return numpy.concatenate(vues, axis=1)

    def mains_(translation):
        vues = []
        for c, (posee, tetes, courante, inverse) in paumes_.items():
            relative = numpy.array(Matrix.Translation(translation) @ arme @ mains[c] @ inverse) @ numpy.linalg.inv(courante)
            vues.append((posee - tetes[:, None]) @ relative[:3, :3].T + relative[:3, 3] + tetes[:, None])
        return numpy.concatenate(vues, axis=1)

    return BrasDeLImage(tronc_, prix, poses_, peau_, mains_, {c: poses[c][0] for c in mains})


def poser_les_bras(images, durees, tours_de_l_arme):
    """Par image de `images` (`BrasDeLImage`), l'arme roulée, la pose de chaque bras (`bras`) et la translation de l'arme :
    le roulis de l'arme et les tours des deux coudes suivent le chemin qui paie le moins sur le clip entier (`chemin`),
    cherché sur `ROULIS` et `TOURS`, puis autour de lui à chaque pas d'`AFFINAGES`, `CONTINUITE['passes']` fois chacun ;
    `durees` et `tours_de_l_arme` : ceux de `chemin`. Avant l'IK, l'arme de chaque image se translate hors du tronc avec
    la peau des deux mains (`pousser`, `BrasDeLImage.mains`) ; après lui, l'arme de chaque image dont la peau entière
    posée reste enfoncée de plus de `POUSSEE['refus']` se translate de nouveau, avec elle, puis l'IK se rejoue, au plus
    `POUSSEE['passes']` fois. Rend aussi, par image, l'enfoncement de la peau entière posée et son jeu, le jeu `None`
    sous `POUSSEE['refus']`, et le nombre de tours de poussée après le premier IK."""
    def choisir():
        valeurs = [(ROULIS, TOURS, TOURS)] * len(images)
        etats = None
        for affinage in (None, *(a for a in AFFINAGES for _ in range(CONTINUITE['passes']))):
            if affinage is not None:
                valeurs = [tuple([centre + d for d in ecarts] for centre, ecarts in zip(etat, (affinage[0], affinage[1], affinage[1])))
                           for etat in etats]
            prix = [image.prix(t, v[0], {'r': v[1], 'l': v[2]}) for image, t, v in zip(images, translations, valeurs)]
            etats = [tuple(v[axe][k] for axe, k in enumerate(indices)) for v, indices in zip(valeurs, chemin(prix, valeurs, durees, tours_de_l_arme))]
        return [image.poses(t, etat) for image, t, etat in zip(images, translations, etats)]

    def enfoncees():
        vues = [enfoncement(image.tronc, image.peau(p)) for image, p in zip(images, poses)]
        return [(profondeur - ECART_DU_TRONC['marge'], jeu) for profondeur, _, jeu in vues]

    translations = [Vector(pousser(image.tronc, image.mains(Vector()))) for image in images]
    poses = choisir()
    restes, passes = enfoncees(), 0
    while passes < POUSSEE['passes'] and any(d > POUSSEE['refus'] for d, _ in restes):
        for i, (d, _) in enumerate(restes):
            if d > POUSSEE['refus']:
                translations[i] = translations[i] + Vector(pousser(images[i].tronc, images[i].peau(poses[i])))
        poses = choisir()
        restes, passes = enfoncees(), passes + 1
    restes = [(d, jeu if d > POUSSEE['refus'] else None) for d, jeu in restes]
    return [(roule, bras_, t) for (roule, bras_), t in zip(poses, translations)], restes, passes


def deriver(bpy, rig, reperes):
    """Les actions de `CLIPS`, ajoutées au rig `rig` d'après ses clips sources, aux instants de chacun (`poids.instants`),
    sur la peau aux poids corrigés et les clips sources posés au sol (après le point fixe de `humanoide.construire`) ;
    `reperes` : par prise `main` et `secondaire`, son os et son repère dans celui de cet os (`anatomie.reperes_des_prises`).
    Les avant-bras, les mains et l'arme se tiennent à l'écart du tronc sous chaque jeu de `tronc.TRONC`, os des
    silhouettes compris (`poser_les_bras`, #4002, #3810) ; une peau que la poussée ne sort pas refuse le clip, comme un poignet trop tordu, une
    peau du bras trop étirée, ou une main qui tourne sur son avant-bras plus vite que `VITESSE_DU_POIGNET` (#3878)."""
    repos = {b.name: b.matrix_local.copy() for b in rig.data.bones}
    longueurs = {cote: ((repos[c].translation - repos[e].translation).length, (repos[m].translation - repos[c].translation).length)
                 for cote, (e, c, m) in BRAS.items()}
    prise_main, prise_off = reperes['main'][1], reperes['secondaire'][1]
    scene, pose = bpy.context.scene, rig.pose.bones
    noms = [b.name for b in rig.data.bones]
    peaux = {cote: peau_du_bras(meshes_for(bpy, rig), noms, [o.name for o in (rig.data.bones[b], *rig.data.bones[b].children_recursive)],
                                rig.matrix_world.inverted())
             for cote, (b, _, _) in BRAS.items()}
    tronc = peau_du_tronc(rig, meshes_for(bpy, rig))
    zones = {'r': 'd', 'l': 'g'}
    membres = {cote: peau_du_membre(rig, meshes_for(bpy, rig), (f'avant_bras_{zones[cote]}', f'main_{zones[cote]}')) for cote in BRAS}
    paumes = {cote: peau_du_membre(rig, meshes_for(bpy, rig), (f'main_{zones[cote]}',)) for cote in BRAS}
    bras_animes = [n for os in BRAS.values() for n in os]
    animes = bras_animes + list(CLAVICULES) + list(DOS)
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
        cote, tour_seconde = SECONDES[maniement]
        mains = {'r': prise_main.inverted(),
                 'l': Matrix.Translation((0, cote, 0)) @ Matrix.Rotation(math.radians(tour_seconde), 4, 'Y') @ prise_off.inverted()}
        bras_des_images, armes = [], []
        for image in images:
            aller_a(scene, image)
            for n in animes:
                pose[n].rotation_quaternion = dos_source[image].get(n, Quaternion())
                pose[n].location = Vector()
            bpy.context.view_layer.update()
            prise, direction, (flexion, torsion) = interpoler(cles, (image - debut) / (fin - debut), abs(cote))
            axes = (pose[os_du_cadre].matrix @ repos[os_du_cadre].inverted()).to_3x3()
            tour = (Matrix.Rotation(math.radians(flexion / len(DOS)), 4, axes @ Vector((1, 0, 0)))
                    @ Matrix.Rotation(math.radians(torsion / len(DOS)), 4, axes @ Vector((0, 0, 1))))
            for n in DOS:
                tete = pose[n].matrix.translation.copy()
                pose[n].matrix = Matrix.Translation(tete) @ tour @ Matrix.Translation(-tete) @ pose[n].matrix
                bpy.context.view_layer.update()
            for n in (*CLAVICULES, *DOS):
                pose[n].keyframe_insert('rotation_quaternion', frame=image)
            cadre = pose[os_du_cadre].matrix @ repos[os_du_cadre].inverted()
            arme = repere_de_l_arme(cadre.to_3x3() @ Vector((1, 0, 0)), cadre @ prise, cadre.to_3x3() @ direction * math.copysign(1, cote))
            bras_des_images.append(bras_de_l_image(rig, arme, mains, cadre, longueurs, peaux, tronc, membres, paumes))
            armes.append(cadre.to_3x3().inverted() @ arme.to_3x3())
        poses, restes, passes = poser_les_bras(bras_des_images, [0.0] + [b - a for a, b in zip(images, images[1:])],
                                       [0.0] + [tour_du_repere(a, b) for a, b in zip(armes, armes[1:])])
        ecart, poussee, vitesse, poignets = 0.0, 0.0, 0.0, {'torsion': 0, 'flexion': 0, 'coude': 1.0, 'bornes': 0.0}
        precedentes = None
        for image, bras_de_l_image_, (roule, bras_, translation), (enfonce, jeu) in zip(images, bras_des_images, poses, restes):
            if jeu is not None:
                raise ValueError(f'{nom} image {image} : peau du membre enfoncée de {enfonce * 100:.1f} cm dans le tronc sous '
                                 f'{"+".join(TRONC["silhouettes"][jeu]) or "le corps neutre"}')
            aller_a(scene, image)
            mains_sur_l_avant_bras = {}
            for cote_, (_, humerus, axes_avant_bras, articulation, _, (torsion_, tourne, flexion_, _, hors, etire, ecrase)) in bras_.items():
                if abs(torsion_ - tourne) > POIGNET['torsion_max'] or flexion_ > POIGNET['flexion_max']:
                    raise ValueError(f'{nom} image {image} : poignet {cote_} tordu de {torsion_ - tourne}°, plié de {flexion_}°')
                if etire > ETIREMENT_EN_CLIP[1] or ecrase < ETIREMENT_EN_CLIP[0]:
                    raise ValueError(f'{nom} image {image} : peau du bras {cote_} étirée à {etire:.2f}, écrasée à {ecrase:.3f}')
                poignets = {'torsion': max(poignets['torsion'], abs(torsion_ - tourne)), 'flexion': max(poignets['flexion'], flexion_),
                            'coude': round(max(poignets['coude'], etire), 2), 'bornes': max(poignets['bornes'], hors)}
                finale = roule @ mains[cote_]
                mains_sur_l_avant_bras[cote_] = (axes_avant_bras.transposed() @ finale.to_3x3()).to_quaternion()
                if precedentes is not None:
                    angle = precedentes[1][cote_].rotation_difference(mains_sur_l_avant_bras[cote_]).angle
                    tourne_de = math.degrees(min(angle, 2 * math.pi - angle))
                    vitesse_ = tourne_de / ((image - precedentes[0]) / cadence())
                    if vitesse_ > VITESSE_DU_POIGNET:
                        raise ValueError(f'{nom} image {image} : main {cote_} tournée de {tourne_de:.1f}° sur son avant-bras '
                                         f'depuis l\'image {precedentes[0]}, soit {vitesse_:.0f}°/s pour {VITESSE_DU_POIGNET}')
                    vitesse = max(vitesse, vitesse_)
                epaule, avant_bras, os_main = (pose[n] for n in BRAS[cote_])
                for os_, axes, origine in ((epaule, humerus, bras_de_l_image_.epaules[cote_]), (avant_bras, axes_avant_bras, articulation)):
                    matrice = axes.to_4x4()
                    matrice.translation = origine
                    os_.matrix = matrice
                    bpy.context.view_layer.update()
                cible = finale.translation.copy()
                finale.translation = os_main.matrix.translation.copy()
                os_main.matrix = finale
                bpy.context.view_layer.update()
                ecart = max(ecart, (cible - os_main.matrix.translation).length)
            precedentes = (image, mains_sur_l_avant_bras)
            poussee = max(poussee, translation.length)
            for n in bras_animes:
                pose[n].keyframe_insert('rotation_quaternion', frame=image)
        print('DEUX_MAINS', nom, 'de', source_nom, 'images', len(images), 'écart de main', round(ecart, 4), 'poignet',
              poignets, 'vitesse du poignet', round(vitesse), 'arme poussée', round(poussee, 4), 'passes de poussée', passes,
              'peau la plus enfoncée', round(max(d for d, _ in restes), 4), flush=True)
        derivees.append(action)
    return derivees
