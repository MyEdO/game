"""Le tronc de la base humanoïde dont l'avant-bras et la main se tiennent à l'écart, dans les clips dérivés à deux mains
(`deux_mains`) comme dans les clips du pack (`membres`) (#3806, #4002, #3810), mesuré comme le mesure la garde `membres`
(`hotes/godot/asset/evaluateur/gardes/membres.ts`) : même peau, même surface, même posture, même sens ; et la chaîne du
bras qui porte cette peau (`BRAS`, `coude`, `matrices_de_la_chaine`, `poser_le_membre`).

La surface du tronc est faite des faces des zones `TRONC['zones']`, la zone d'une face étant celle de l'os dominant de
ses sommets (`anatomie.os_de_la_face`) ; les sujets, des faces des zones de l'avant-bras et de la main d'un côté. Sous un
jeu de silhouettes, leurs sommets prennent les clés de forme du jeu à 1 et, sous une silhouette à os
(`portage.lire_os_des_silhouettes`), se posent sur les os déplacés comme l'hôte les joue : chaque sommet se déplace de
plus de w · e, e_b = ΔJ_b − R_b D_b (docstring de `sol`).

La posture du tronc est la rotation moyenne de ses os depuis leur repos, pondérée par le poids de peau total de chacun
sur les sommets du tronc, alignée en signe sur l'os le plus lourd (`posture_du_tronc`). Le champ du tronc posé
(`champ`) est, dans le repère du tronc au repos, une grille régulière de pas `CHAMP['pas']` sur la boîte du tronc élargie
de `CHAMP['portee']`, qui porte en chaque nœud son enfoncement, positif dedans. Un nœud est dedans si ses deux
demi-droites vers l'avant et l'arrière du tronc (±Y du rig) coupent chacune la surface un nombre impair de fois. Sa
grandeur est sa distance aux triangles à moins de `CHAMP['portee']`, sinon sa distance à la plus proche traversée de la
surface par les trois droites des axes qui le portent ; dehors, elle se borne à `CHAMP['portee']`. Entre les nœuds,
l'enfoncement s'interpole en trilinéaire (`lire_le_champ`) ; hors de la grille, tout point est dehors, à
`CHAMP['portee']`. Sans champ, un point se sait dans le tronc ou à portée de lui par la même parité et sa distance aux
triangles proches (`atteints`), et sa profondeur exacte par la même parité et sa distance au plus proche triangle
(`profondeurs_exactes`) : le champ vise, la profondeur exacte décide (#3810).

Repère Blender du rig : +X la gauche du personnage, −Y l'avant, +Z le haut.
"""
import math
from typing import NamedTuple

import numpy
from mathutils import Matrix

from anatomie import os_de_la_face, zone_de_l_os
from noms_silhouettes import CARRURE_MOINS, CARRURE_PLUS, CORPULENCE, FEMININ
from poids import peau_lineaire
from portage import deplacements_du_manifeste, lire_os_des_silhouettes
from sol import rotations_de_peau, tetes_deplacees

TRONC = {'zones': ('torse', 'hanches'),
         'silhouettes': ((), (CORPULENCE,), (FEMININ, CORPULENCE), (CARRURE_PLUS,), (CARRURE_MOINS,))}
"""Le tronc (`peau_du_tronc`) : les faces des `zones`, sous chaque jeu de `silhouettes` posées à 1."""
CHAMP = {'pas': 0.015, 'portee': 0.02, 'echantillon': 0.015, 'grossier': 0.04}
"""En mètres : le pas de la grille du champ du tronc posé ; la portée de sa distance exacte aux triangles, qui élargit
sa boîte et borne son enfoncement dehors ;
le côté des cellules où la peau d'un membre se sous-échantillonne, un sommet par cellule, et celui de son échantillon
grossier (`peau_du_membre`). Sur les sommets de la peau des avant-bras et des mains qu'il lit à moins de 1 cm de la
surface, à chaque image des clips dérivés à deux mains, sous chaque jeu, l'enfoncement lu s'écarte de l'enfoncement
exact (parité et distance à tous les triangles) de 0,4 mm en moyenne, de moins de 1,8 mm à 99 %, de 6,5 mm au plus
(`Hampe_Attaque` sous la carrure large : lu à 7,0 mm dehors pour 0,6 mm) ; au repos, un sommet de l'avant-bras et de
la main est à moins de 15,1 mm (4,1 mm en moyenne) d'un sommet du sous-échantillon, qui en retient 449 sur 1314 par
côté (#3810)."""
AXE = 1
"""L'axe des demi-droites du sens : l'avant-arrière du tronc au repos, Y du rig."""
DECALAGE = 1.37e-6
"""Le décalage des droites du sens, hors des arêtes et des sommets du tronc (`DECALAGE_M` de la garde `membres`)."""
BRAS = {cote: (f'upperarm_{cote}', f'lowerarm_{cote}', f'hand_{cote}') for cote in ('r', 'l')}
"""Par côté, la chaîne d'un bras : épaule, coude, main."""


class Peau(NamedTuple):
    """Les sommets des faces de zones données (`peau_des_zones`) : par jeu de `TRONC['silhouettes']`, leurs positions au
    repos, homogènes, dans le repère du rig (jeux, sommets, 4), leurs poids sur chaque os, et les faces en triangles
    d'indices de ces sommets."""
    x: numpy.ndarray
    w: numpy.ndarray
    triangles: numpy.ndarray


def peau_des_zones(rig, peaux, zones):
    """La `Peau` des faces de `peaux` (`poids.peau_lineaire`, os de `rig`) dont la zone (`anatomie.os_de_la_face`) est
    dans `zones`."""
    noms = [b.name for b in rig.data.bones]
    vers_rig = numpy.array(rig.matrix_world.inverted())
    jeux, poids, triangles, compte = [[] for _ in TRONC['silhouettes']], [], [], 0
    for peau in peaux:
        x, w = peau_lineaire(peau, noms)
        dominants = [noms[i] for i in w.argmax(axis=1)]
        peau.data.calc_loop_triangles()
        gardees = {f.index for f in peau.data.polygons if zone_de_l_os(os_de_la_face([dominants[i] for i in f.vertices])) in zones}
        faces = numpy.array([t.vertices[:] for t in peau.data.loop_triangles if t.polygon_index in gardees], dtype=numpy.int64)
        if not len(faces):
            continue
        sommets, locales = numpy.unique(faces, return_inverse=True)
        tour = vers_rig[:3, :3] @ numpy.array(peau.matrix_world.to_3x3())
        cles = peau.data.shape_keys.key_blocks if peau.data.shape_keys else {}
        base = numpy.array([v.co for v in peau.data.vertices], dtype=numpy.float64)[sommets]
        for jeu, silhouettes in zip(jeux, TRONC['silhouettes']):
            ecart = sum((numpy.array([c.co for c in cles[n].data], dtype=numpy.float64)[sommets] - base for n in silhouettes),
                        numpy.zeros_like(base))
            jeu.append(x[sommets].astype(numpy.float64) @ vers_rig.T + numpy.c_[ecart @ tour.T, numpy.zeros(len(base))])
        poids.append(w[sommets].astype(numpy.float64))
        triangles.append(locales.reshape(-1, 3) + compte)
        compte += len(sommets)
    return Peau(numpy.stack([numpy.concatenate(j) for j in jeux]), numpy.concatenate(poids), numpy.concatenate(triangles))


class PeauDuTronc(NamedTuple):
    """Le tronc (`TRONC`) : sa `Peau` (`x`, `w`, `triangles`), l'indice du parent de chaque os (-1 pour une racine) et,
    par jeu, le déplacement D de la tête de chaque os (jeux, os, 3), dans le repère du rig."""
    x: numpy.ndarray
    w: numpy.ndarray
    triangles: numpy.ndarray
    parent: numpy.ndarray
    deplacements: numpy.ndarray


def peau_du_tronc(rig, peaux):
    """La `PeauDuTronc` de `peaux` sur les os de `rig`, dans le repère du rig : les têtes d'os d'un jeu sont la somme de
    celles de ses silhouettes à os (`portage.deplacements_du_manifeste`), nulles sans elles."""
    noms = [b.name for b in rig.data.bones]
    vers_rig = numpy.array(rig.matrix_world.inverted())
    tetes = {nom: deplacements_du_manifeste(rig, table) for nom, table in lire_os_des_silhouettes(rig).items()}
    deplacements = numpy.array([sum((numpy.array([tetes[s][n] for n in noms]) for s in silhouettes if s in tetes),
                                    numpy.zeros((len(noms), 3))) @ vers_rig[:3, :3].T for silhouettes in TRONC['silhouettes']])
    parent = numpy.array([noms.index(b.parent.name) if b.parent else -1 for b in rig.data.bones])
    return PeauDuTronc(*peau_des_zones(rig, peaux, TRONC['zones']), parent, deplacements)


def melanger(w, matrices, x):
    """Σ_b w_b M_b x de chaque sommet (`w` (sommets, os), `x` homogènes) sous les matrices de peau `matrices`
    (os, 4, 4) : (sommets, 3)."""
    return numpy.einsum('nij,nj->ni', (w @ matrices[:, :3].reshape(len(matrices), 12)).reshape(-1, 3, 4), x)


def poser(w, x, matrices, tetes, deplacements):
    """Les sommets (`w`, `x` homogènes) sous les matrices de peau `matrices` (os, 4, 4), le squelette déplacé de
    `deplacements` (os, 3), aux têtes posées déplacées de `tetes` (`sol.tetes_deplacees`, os, 3) : (sommets, 3)."""
    return melanger(w, matrices, x) + w @ (tetes - numpy.einsum('bij,bj->bi', rotations_de_peau(matrices), deplacements))


def posture_du_tronc(poids, matrices):
    """La rotation (3, 3) moyenne des os depuis leur repos sous les matrices de peau `matrices` (os, 4, 4), pondérée par
    `poids` (os,) : leurs quaternions alignés en signe sur celui de l'os le plus lourd, sommés, normalisés."""
    os_ = numpy.flatnonzero(poids > 0)
    quaternions = numpy.array([tuple(Matrix(r).to_quaternion()) for r in rotations_de_peau(matrices[os_])])
    quaternions *= numpy.sign(quaternions @ quaternions[poids[os_].argmax()])[:, None]
    somme = (poids[os_, None] * quaternions).sum(axis=0)
    w, x, y, z = somme / numpy.linalg.norm(somme)
    return numpy.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def _paires(bas, haut):
    """Les indices entiers de chaque boîte [`bas`, `haut`] (boîtes, d) de la grille : (boîte de chaque indice, indices)."""
    tailles = numpy.maximum(haut - bas + 1, 0)
    comptes = tailles.prod(axis=1)
    boites = numpy.repeat(numpy.arange(len(bas)), comptes)
    rang = numpy.arange(comptes.sum()) - numpy.repeat(numpy.cumsum(comptes) - comptes, comptes)
    indices = numpy.empty((len(boites), bas.shape[1]), dtype=numpy.int64)
    for axe in range(bas.shape[1] - 1, -1, -1):
        t = tailles[boites, axe]
        indices[:, axe] = bas[boites, axe] + rang % t
        rang //= t
    return boites, indices


def _croix(u, v):
    return numpy.stack((u[..., 1] * v[..., 2] - u[..., 2] * v[..., 1], u[..., 2] * v[..., 0] - u[..., 0] * v[..., 2],
                        u[..., 0] * v[..., 1] - u[..., 1] * v[..., 0]), axis=-1)


def _scalaire(u, v):
    return numpy.einsum('...k,...k->...', u, v)


def distances_aux_triangles(p, a, b, c):
    """La distance de chaque point `p` (…, 3) au triangle (`a`, `b`, `c`) de même rang : au plan si le point se projette
    dans le triangle, sinon à la plus proche de ses arêtes."""
    n = _croix(b - a, c - a)
    nn = _scalaire(n, n)
    dedans = nn > 0
    aretes = []
    for u, v in ((a, b), (b, c), (c, a)):
        e, pu = v - u, p - u
        dedans &= _scalaire(_croix(e, pu), n) >= 0
        t = numpy.clip(_scalaire(pu, e) / numpy.maximum(_scalaire(e, e), 1e-30), 0.0, 1.0)
        aretes.append(numpy.linalg.norm(pu - t[..., None] * e, axis=-1))
    plan = numpy.abs(_scalaire(p - a, n)) / numpy.sqrt(numpy.maximum(nn, 1e-30))
    return numpy.where(dedans, plan, numpy.minimum.reduce(aretes))


class Champ(NamedTuple):
    """Le champ d'un tronc posé (`champ`) : l'origine de sa grille dans le repère du tronc au repos et l'enfoncement de
    chaque nœud (nx, ny, nz), positif dedans."""
    origine: numpy.ndarray
    valeurs: numpy.ndarray


def _traversees(sommets, origine, forme, axe):
    """Par nœud de la grille (`origine`, `forme`, pas `CHAMP['pas']`), sur la droite d'axe `axe` qui le porte, décalée
    de `DECALAGE` : si ses deux demi-droites coupent chacune les triangles `sommets` un nombre impair de fois, et sa
    distance à la plus proche traversée, infinie sans traversée ; deux tableaux (nx, ny, nz)."""
    pas = CHAMP['pas']
    a, b = [i for i in range(3) if i != axe]
    noeuds = origine[axe] + numpy.arange(forme[axe]) * pas
    bas = numpy.ceil((sommets[:, :, [a, b]].min(axis=1) - origine[[a, b]] - DECALAGE) / pas).astype(int)
    haut = numpy.floor((sommets[:, :, [a, b]].max(axis=1) - origine[[a, b]] - DECALAGE) / pas).astype(int)
    t, colonnes = _paires(bas, haut)
    q = origine[[a, b]] + colonnes * pas + DECALAGE
    s = sommets[t]
    aire = (s[:, 1, a] - s[:, 0, a]) * (s[:, 2, b] - s[:, 0, b]) - (s[:, 2, a] - s[:, 0, a]) * (s[:, 1, b] - s[:, 0, b])
    with numpy.errstate(divide='ignore', invalid='ignore'):
        u = ((s[:, 1, a] - q[:, 0]) * (s[:, 2, b] - q[:, 1]) - (s[:, 2, a] - q[:, 0]) * (s[:, 1, b] - q[:, 1])) / aire
        v = ((s[:, 2, a] - q[:, 0]) * (s[:, 0, b] - q[:, 1]) - (s[:, 0, a] - q[:, 0]) * (s[:, 2, b] - q[:, 1])) / aire
    r = 1 - u - v
    coupe = (aire != 0) & (u >= 0) & (v >= 0) & (r >= 0)
    hauteurs = u[coupe] * s[coupe, 0, axe] + v[coupe] * s[coupe, 1, axe] + r[coupe] * s[coupe, 2, axe]
    colonne = colonnes[coupe, 0] * forme[b] + colonnes[coupe, 1]
    etendue = 2 * (noeuds[-1] - noeuds[0]) + 1.0
    cles = numpy.sort(colonne * etendue + (hauteurs - noeuds[0]))
    total = numpy.bincount(colonne, minlength=forme[a] * forme[b])
    debut = numpy.cumsum(total) - total
    colonne_du_noeud = numpy.repeat(numpy.arange(forme[a] * forme[b]), forme[axe])
    cle = colonne_du_noeud * etendue + numpy.tile(noeuds - noeuds[0], forme[a] * forme[b])
    rang = numpy.searchsorted(cles, cle)
    dessous = rang - debut[colonne_du_noeud]
    dessus = total[colonne_du_noeud] - dessous
    dedans = (dessous % 2 == 1) & (dessus % 2 == 1)
    distance = numpy.full(len(cle), numpy.inf)
    if len(cles):
        for voisin, valide in ((rang, dessus > 0), (rang - 1, dessous > 0)):
            ecart = numpy.abs(cles[numpy.clip(voisin, 0, len(cles) - 1)] - cle)
            distance = numpy.where(valide, numpy.minimum(distance, ecart), distance)
    ordre = numpy.argsort([a, b, axe])
    return (dedans.reshape(forme[a], forme[b], forme[axe]).transpose(*ordre),
            distance.reshape(forme[a], forme[b], forme[axe]).transpose(*ordre))


def champ(sommets):
    """Le `Champ` des triangles `sommets` (triangles, 3, 3), donnés dans le repère du tronc au repos."""
    pas, portee = CHAMP['pas'], CHAMP['portee']
    origine = sommets.min(axis=(0, 1)) - portee
    forme = numpy.ceil((sommets.max(axis=(0, 1)) + portee - origine) / pas).astype(int) + 1
    vues = [_traversees(sommets, origine, forme, axe) for axe in range(3)]
    dedans = vues[AXE][0]
    plat = numpy.minimum.reduce([d for _, d in vues]).reshape(-1)
    bas = numpy.ceil((sommets.min(axis=1) - portee - origine) / pas).astype(int)
    haut = numpy.floor((sommets.max(axis=1) + portee - origine) / pas).astype(int)
    normales = _croix(sommets[:, 1] - sommets[:, 0], sommets[:, 2] - sommets[:, 0])
    normales /= numpy.maximum(numpy.linalg.norm(normales, axis=1, keepdims=True), 1e-30)
    for lot in numpy.array_split(numpy.arange(len(sommets)), max(1, len(sommets) // 400)):
        t, indices = _paires(bas[lot], haut[lot])
        t = lot[t]
        p = origine + indices * pas
        proche = numpy.abs(_scalaire(p - sommets[t, 0], normales[t])) <= portee
        t, indices, p = t[proche], indices[proche], p[proche]
        d = distances_aux_triangles(p, sommets[t, 0], sommets[t, 1], sommets[t, 2])
        numpy.minimum.at(plat, numpy.ravel_multi_index(indices.T, forme), d)
    plat = plat.reshape(forme)
    return Champ(origine, numpy.where(dedans, plat, -numpy.minimum(plat, portee)))


def lire_le_champ(champ_, points):
    """L'enfoncement de chaque point de `points` (…, 3), donnés dans le repère du tronc au repos, dans le `Champ`
    `champ_`, interpolé en trilinéaire, `-CHAMP['portee']` hors de sa grille."""
    forme = numpy.array(champ_.valeurs.shape)
    g = (points - champ_.origine) / CHAMP['pas']
    i = numpy.floor(g).astype(numpy.int64)
    dans = ((i >= 0) & (i < forme - 1)).all(axis=-1)
    i = numpy.where(dans[..., None], i, 0)
    fx, fy, fz = numpy.moveaxis(numpy.where(dans[..., None], g - i, 0.0), -1, 0)
    sx, sy = forme[1] * forme[2], forme[2]
    base = i[..., 0] * sx + i[..., 1] * sy + i[..., 2]
    plat = champ_.valeurs.reshape(-1)
    v = {coin: plat[base + coin[0] * sx + coin[1] * sy + coin[2]] for coin in numpy.ndindex(2, 2, 2)}
    x00, x01 = v[0, 0, 0] + fx * (v[1, 0, 0] - v[0, 0, 0]), v[0, 0, 1] + fx * (v[1, 0, 1] - v[0, 0, 1])
    x10, x11 = v[0, 1, 0] + fx * (v[1, 1, 0] - v[0, 1, 0]), v[0, 1, 1] + fx * (v[1, 1, 1] - v[0, 1, 1])
    y0, y1 = x00 + fy * (x10 - x00), x01 + fy * (x11 - x01)
    return numpy.where(dans, y0 + fz * (y1 - y0), -CHAMP['portee'])


class TroncPose(NamedTuple):
    """Le tronc posé (`tronc_pose`) : par jeu, les positions de ses sommets (jeux, sommets, 3), le déplacement ΔJ de la
    tête posée de chaque os (`sol.tetes_deplacees`, jeux, os, 3) et son `Champ` ; `retour`, la rotation (3, 3) qui
    ramène le repère du rig à celui du tronc au repos, l'inverse de sa posture (`posture_du_tronc`) ; ses triangles
    d'indices de sommets (`PeauDuTronc.triangles`)."""
    positions: numpy.ndarray
    tetes: numpy.ndarray
    champs: list
    retour: numpy.ndarray
    triangles: numpy.ndarray


def tronc_pose(tronc, matrices, champs=True):
    """Le `TroncPose` de `tronc` (`PeauDuTronc`) sous les matrices de peau `matrices` (os, 4, 4), comme l'hôte le joue ;
    sans ses champs si `champs` est faux (`champs_du_tronc`), ses sommets lus par `pres_du_tronc`."""
    tetes = numpy.stack([tetes_deplacees(matrices[None], tronc.parent, d)[0] for d in tronc.deplacements])
    positions = numpy.stack([poser(tronc.w, x, matrices, t, d) for x, t, d in zip(tronc.x, tetes, tronc.deplacements)])
    pose = TroncPose(positions, tetes, [], posture_du_tronc(tronc.w.sum(axis=0), matrices).T, tronc.triangles)
    return champs_du_tronc(tronc, pose) if champs else pose


def champs_du_tronc(tronc, pose):
    """Le `TroncPose` `pose` de `tronc` (`PeauDuTronc`), un `Champ` par jeu."""
    return pose._replace(champs=[champ((p @ pose.retour.T)[tronc.triangles]) for p in pose.positions])


def profondeurs(tronc, points):
    """Par jeu, l'enfoncement dans le `TroncPose` `tronc` de chaque point de `points` (jeux, …, 3), dans le repère du
    rig (`lire_le_champ`)."""
    return numpy.stack([lire_le_champ(c, p @ tronc.retour.T) for c, p in zip(tronc.champs, points)])


def _dedans(sommets, p):
    """Si chaque point de `p` (points, 3) est dans les triangles `sommets` (triangles, 3, 3), tous dans le repère du
    tronc au repos : ses deux demi-droites d'axe `AXE`, décalées de `DECALAGE`, coupent chacune les triangles un nombre
    impair de fois. Seules les paires que la boîte d'un triangle admet se calculent."""
    a, b = [i for i in range(3) if i != AXE]
    bas, haut = sommets.min(axis=1), sommets.max(axis=1)
    q = p[:, [a, b]] + DECALAGE
    i, t = numpy.nonzero((q[:, None, 0] >= bas[:, a]) & (q[:, None, 0] <= haut[:, a]) & (q[:, None, 1] >= bas[:, b])
                         & (q[:, None, 1] <= haut[:, b]))
    s, q = sommets[t], q[i]
    aire = (s[:, 1, a] - s[:, 0, a]) * (s[:, 2, b] - s[:, 0, b]) - (s[:, 2, a] - s[:, 0, a]) * (s[:, 1, b] - s[:, 0, b])
    with numpy.errstate(divide='ignore', invalid='ignore'):
        u = ((s[:, 1, a] - q[:, 0]) * (s[:, 2, b] - q[:, 1]) - (s[:, 2, a] - q[:, 0]) * (s[:, 1, b] - q[:, 1])) / aire
        v = ((s[:, 2, a] - q[:, 0]) * (s[:, 0, b] - q[:, 1]) - (s[:, 0, a] - q[:, 0]) * (s[:, 2, b] - q[:, 1])) / aire
        r = 1 - u - v
        coupe = (aire != 0) & (u >= 0) & (v >= 0) & (r >= 0)
        hauteurs = u * s[:, 0, AXE] + v * s[:, 1, AXE] + r * s[:, 2, AXE]
    dessus = numpy.bincount(i[coupe & (hauteurs > p[i, AXE])], minlength=len(p))
    dessous = numpy.bincount(i[coupe & (hauteurs < p[i, AXE])], minlength=len(p))
    return (dessus % 2 == 1) & (dessous % 2 == 1)


def atteints(sommets, points, portee):
    """Si chaque point de `points` (points, 3) est dans les triangles `sommets` (triangles, 3, 3) (`_dedans`), ou à
    moins de `portee` d'eux, tous dans le repère du tronc au repos."""
    bas, haut = sommets.min(axis=1), sommets.max(axis=1)
    vus = numpy.zeros(len(points), dtype=bool)
    retenus = numpy.flatnonzero(((points >= bas.min(axis=0) - portee) & (points <= haut.max(axis=0) + portee)).all(axis=1))
    if not len(retenus):
        return vus
    p = points[retenus]
    dedans = _dedans(sommets, p)
    proches = ~dedans[:, None]
    for k in range(3):
        proches = proches & (p[:, None, k] >= bas[:, k] - portee) & (p[:, None, k] <= haut[:, k] + portee)
    i, t = numpy.nonzero(proches)
    dedans[i[distances_aux_triangles(p[i], sommets[t, 0], sommets[t, 1], sommets[t, 2]) <= portee]] = True
    vus[retenus] = dedans
    return vus


def profondeurs_exactes(tronc, points):
    """Par jeu, la profondeur exacte dans le `TroncPose` `tronc` de chaque point de `points` (jeux, …, 3), dans le
    repère du rig, comme la mesure la garde `membres` : un point dans la boîte du tronc et dedans (`_dedans`) est à sa
    plus petite distance à un triangle du tronc, positive ; tout autre point est dehors, à `-inf`. La garde ne cherche
    le triangle le plus proche qu'à `PORTEE_DU_VOISINAGE_M` autour du point, sinon à la plus proche traversée de ses
    demi-droites : les deux mesures s'accordent sous 3 cm de profondeur (#3810)."""
    vus = numpy.full(points.shape[:-1], -numpy.inf)
    for jeu, (s, p) in enumerate(zip(tronc.positions, points)):
        sommets = (s @ tronc.retour.T)[tronc.triangles]
        p = p.reshape(-1, 3) @ tronc.retour.T
        retenus = numpy.flatnonzero(((p >= sommets.min(axis=(0, 1))) & (p <= sommets.max(axis=(0, 1)))).all(axis=1))
        retenus = retenus[_dedans(sommets, p[retenus])]
        plat = vus[jeu].reshape(-1)
        for lot in numpy.array_split(retenus, max(1, len(retenus) // 64)) if len(retenus) else ():
            forme = (len(lot), len(sommets), 3)
            plat[lot] = distances_aux_triangles(numpy.broadcast_to(p[lot, None], forme),
                                                *(numpy.broadcast_to(sommets[None, :, k], forme) for k in range(3))).min(axis=1)
    return vus


def pres_du_tronc(tronc, pose, points, portee):
    """Si l'un des `points` (jeux, …, 3), dans le repère du rig, est dans le `TroncPose` `pose` de `tronc`
    (`PeauDuTronc`) ou à moins de `portee` de lui sous son jeu (`atteints`)."""
    return any(atteints((s @ pose.retour.T)[tronc.triangles], p.reshape(-1, 3) @ pose.retour.T, portee).any()
               for s, p in zip(pose.positions, points))


def avant(tronc):
    """L'avant (3,) du `TroncPose` `tronc` dans le repère du rig : sa posture (`posture_du_tronc`) appliquée à l'avant
    du repos, −Y du rig."""
    return -tronc.retour[AXE]


class ChaineDuBras(NamedTuple):
    """Le bras d'un côté sous chaque jeu d'un `TroncPose` : l'inverse de la rotation de repos du bras et de l'avant-bras
    (2, 3, 3), et par jeu les têtes déplacées de la chaîne bras, avant-bras, main (`sol.tetes_deplacees`, jeux, 3, 3) : le
    bras à son ΔJ posé, l'avant-bras et la main à ce ΔJ plus leur déplacement D relatif à celui du bras."""
    repos: numpy.ndarray
    chaines: numpy.ndarray


def repos_de_la_chaine(rig, cote):
    """Le repos de la chaîne `BRAS[cote]` de `rig` (`matrices_de_la_chaine`, `chaine_du_bras`) : les inverses des
    matrices de repos de ses trois os (3, 4, 4) et la tête de la main dans le repère de repos de l'avant-bras."""
    repos = rig.data.bones
    _, coude_, main = BRAS[cote]
    return (numpy.array([numpy.array(repos[n].matrix_local.inverted()) for n in BRAS[cote]]),
            (repos[coude_].matrix_local.inverted() @ repos[main].matrix_local).translation.copy())


def chaine_du_bras(tronc, pose, chaine, repos):
    """La `ChaineDuBras` des os `chaine` (indices du bras, de l'avant-bras et de la main) sous le `TroncPose` `pose` de
    `tronc` (`PeauDuTronc`) ; `repos` : celui de `repos_de_la_chaine`."""
    return ChaineDuBras(repos[0][:2, :3, :3],
                        pose.tetes[:, chaine[:1]] + tronc.deplacements[:, chaine] - tronc.deplacements[:, chaine[:1]])


def coude(epaule, cible, l1, l2, pole):
    """Le poignet atteint et le coude d'un bras de segments `l1` puis `l2`, de l'`epaule` vers la `cible` : la cible
    hors de portée se ramène sur la sphère de portée, et le coude plie du côté de `pole`."""
    axe = (cible - epaule).normalized()
    distance = max(abs(l1 - l2) + 1e-4, min((cible - epaule).length, l1 + l2 - 1e-4))
    a = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    plan = (pole - axe * pole.dot(axe)).normalized()
    return epaule + axe * distance, epaule + axe * a + plan * h


def matrices_de_la_chaine(epaule, humerus, coude_, avant_bras, axes_main, repos):
    """Les matrices de peau (3, 4, 4) du bras aux axes `humerus` sur l'`epaule`, de l'avant-bras aux axes `avant_bras`
    sur le `coude_` et de la main aux axes `axes_main` sur sa tête, que l'avant-bras porte : `repos`, celui de
    `repos_de_la_chaine`."""
    inverses, decalage = repos
    poses = []
    for axes, origine in ((humerus, epaule), (avant_bras, coude_), (axes_main, coude_ + avant_bras @ decalage)):
        pose = axes.to_4x4()
        pose.translation = origine
        poses.append(numpy.array(pose))
    return numpy.array(poses) @ inverses


def tetes_du_bras(chaine, axes):
    """Par jeu, les ΔJ du bras, de l'avant-bras et de la main (jeux, essais, 3, 3) de la `ChaineDuBras` `chaine` sous les
    `axes` du bras et de l'avant-bras de chaque essai (essais, 2, 3, 3), leurs rotations jouées (`sol.tetes_deplacees`)."""
    matrices = numpy.tile(numpy.eye(4), (len(axes), 3, 1, 1))
    matrices[:, :2, :3, :3] = axes @ chaine.repos
    return numpy.stack([tetes_deplacees(matrices, (-1, 0, 1), c) for c in chaine.chaines])


class PeauDuMembre(NamedTuple):
    """Une peau de membre : sa `Peau` (`x`, `w`, `triangles`), les indices de son sous-échantillon, un sommet par
    cellule de `CHAMP['echantillon']`, ceux de son échantillon grossier, un par cellule de `CHAMP['grossier']`, et le
    rayon qui couvre la peau autour de l'échantillon grossier : la plus grande distance d'un sommet à son plus proche
    sommet grossier, au repos du corps neutre."""
    x: numpy.ndarray
    w: numpy.ndarray
    triangles: numpy.ndarray
    echantillon: numpy.ndarray
    grossier: numpy.ndarray
    rayon: float


def un_par_cellule(x, cellule):
    """Les indices triés d'un point de `x` (points, 3) par cellule cubique de côté `cellule`."""
    return numpy.sort(numpy.unique(numpy.floor(x / cellule).astype(int), axis=0, return_index=True)[1])


def peau_du_membre(rig, peaux, zones):
    """La `PeauDuMembre` des faces des `zones` de `peaux` sur les os de `rig`."""
    peau = peau_des_zones(rig, peaux, zones)
    x = peau.x[0, :, :3]
    grossier = un_par_cellule(x, CHAMP['grossier'])
    rayon = float(numpy.sqrt(((x[:, None] - x[grossier][None]) ** 2).sum(axis=-1)).min(axis=1).max())
    return PeauDuMembre(*peau, un_par_cellule(x, CHAMP['echantillon']), grossier, rayon)


class MembrePose(NamedTuple):
    """Une `PeauDuMembre` sous les matrices de peau d'une image, prête à suivre la chaîne bras, avant-bras, main
    (`membre_pose`) : par jeu, sa part fixe (jeux, sommets, 3) ; par os g de la chaîne, avec ses descendants hors de la
    suite de la chaîne, y = Σ w M x (jeux, 3, sommets, 3), s = Σ w (3, sommets) et z = Σ w (e − ΔJ_g)
    (jeux, 3, sommets, 3) ; les matrices de peau de la chaîne à l'image (3, 4, 4)."""
    fixe: numpy.ndarray
    y: numpy.ndarray
    s: numpy.ndarray
    z: numpy.ndarray
    chaine: numpy.ndarray


def membre_pose(membre, matrices, tetes, deplacements, parent, chaine):
    """La `MembrePose` de `membre` (`PeauDuMembre`) sous les matrices de peau `matrices` (os, 4, 4), aux ΔJ posés
    `tetes` (`sol.tetes_deplacees`, jeux, os, 3), sous les `deplacements` D (jeux, os, 3) et les `parent` des os ;
    `chaine`, les indices du bras, de l'avant-bras et de la main."""
    groupe = numpy.full(len(parent), -1)
    for b in range(len(parent)):
        a = b
        while a >= 0 and a not in chaine:
            a = parent[a]
        groupe[b] = list(chaine).index(a) if a >= 0 else -1
    e = tetes - numpy.einsum('bik,jbk->jbi', rotations_de_peau(matrices), deplacements)
    fixe, y, z = [], [], []
    s = numpy.stack([membre.w[:, groupe == g].sum(axis=1) for g in range(3)])
    for j, x in enumerate(membre.x):
        parts = []
        for g in (-1, 0, 1, 2):
            os_ = numpy.flatnonzero((groupe == g) & (membre.w.sum(axis=0) > 0))
            w = membre.w[:, os_]
            parts.append((melanger(w, matrices[os_], x), w @ e[j, os_]))
        fixe.append(parts[0][0] + parts[0][1])
        y.append(numpy.stack([p[0] for p in parts[1:]]))
        z.append(numpy.stack([p[1] - s[g][:, None] * tetes[j, chaine[g]] for g, p in enumerate(parts[1:])]))
    return MembrePose(numpy.stack(fixe), numpy.stack(y), s, numpy.stack(z), matrices[list(chaine)])


def _tourner(vecteurs, rotations):
    """Chaque vecteur de `vecteurs` (jeux, sommets, 3) sous chaque matrice de `rotations` (essais, 3, 3) :
    (jeux, essais, sommets, 3)."""
    jeux, sommets, _ = vecteurs.shape
    tournes = vecteurs.reshape(-1, 3) @ rotations.transpose(2, 0, 1).reshape(3, -1)
    return tournes.reshape(jeux, sommets, len(rotations), 3).transpose(0, 2, 1, 3)


def poser_le_membre(membre, matrices, tetes, sommets=slice(None)):
    """Les `sommets` de la `MembrePose` `membre` sous les matrices de peau `matrices` de la chaîne par essai
    (essais, 3, 4, 4), aux ΔJ `tetes` de la chaîne par jeu et par essai (`tetes_du_bras`, jeux, essais, 3, 3), ses os
    descendants suivant chacun son os de la chaîne : (jeux, essais, sommets, 3)."""
    relatives = matrices @ numpy.linalg.inv(membre.chaine)
    tours = rotations_de_peau(matrices) @ rotations_de_peau(membre.chaine).transpose(0, 2, 1)
    s = membre.s[:, sommets]
    posee = membre.fixe[:, None, sommets] + s.T @ (relatives[None, :, :, :3, 3] + tetes)
    for g in range(3):
        posee += _tourner(membre.y[:, g, sommets], relatives[:, g, :3, :3]) + _tourner(membre.z[:, g, sommets], tours[:, g])
    return posee
