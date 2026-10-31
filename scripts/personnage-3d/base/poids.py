"""Lissage des poids de la base humanoïde (#2972, lot B3) : là où un clip étire ou écrase une arête de la peau hors de
`ETIREMENT_EN_CLIP`, les poids de ses deux sommets prennent la moyenne de leurs voisins pondérée par l'inverse du carré de la
longueur de l'arête qui les relie, jusqu'à ce qu'aucune arête n'en sorte. L'étirement d'une arête croît comme l'écart de
poids de ses sommets rapporté à sa longueur : la pondération reporte le saut de poids des micro-arêtes sur les arêtes
longues, où il étire peu.

L'étirement d'une arête est le rapport de sa longueur déformée à sa longueur au repos sans shape key, aux instants de chaque
clip passé (`instants`), en skinning linéaire sur `INFLUENCES_MAX` os normalisés, à chaque état de la peau : le neutre, et
chaque shape key à 1, ses sommets déplacés de leur décalage avant le skinning. C'est le modèle de l'export glTF et des
gardes de `hotes/godot/asset/evaluateur/gardes/etirement.ts`. Une arête hors bornes dans un seul état entre dans la région
lissée. Les arêtes sont celles des triangles, diagonales comprises. Les jumeaux (sommets confondus au repos, plus proches
que `TOLERANCE_JUMEAUX_POSITION_M`) se lissent comme un seul sommet.
"""
import math

import bpy
import numpy
from mathutils.kdtree import KDTree

from animation import assign_action
from formes import aretes_des_triangles, region_locale
from pistes import aller_a, sacs
from seuils import (ETIREMENT_EN_CLIP, IMAGES_PAR_SECONDE, INFLUENCES_MAX, INSTANTS_CONFONDUS,
                    TOLERANCE_JUMEAUX_POSITION_M)

STAGNATION = 1e-3
"""Variation de poids d'une passe sous laquelle le lissage tient son point fixe : la région lissée gagne alors un anneau
de voisins autour des arêtes hors de `ETIREMENT_EN_CLIP` (`formes.region_locale`)."""
PASSES_MAX = 200
"""Passes de lissage au-delà desquelles la construction s'arrête."""
LOT = 64
"""Échantillons déformés ensemble."""
CLES_CONFONDUES = 1e-4
"""Deux temps de clé plus proches que cet écart, en images, sont confondus (`sol`)."""


def instants(action):
    """Les instants de `action`, en images à la cadence de la scène : l'union des multiples de `pas` compris entre sa
    première et sa dernière clé, `pas` valant 1/`IMAGES_PAR_SECONDE` s, et des clés de toutes ses courbes, triée, un
    élément qui suit le précédent de `INSTANTS_CONFONDUS` s au plus n'en faisant qu'un avec lui ; aucun pour une action
    sans clé. Une action dont la première clé est 0 a les instants de l'évaluateur (`echantillonnage.ts` `instants`),
    en images. Une clé qui n'est pas un instant suit de `INSTANTS_CONFONDUS` s au plus l'élément qui la précède dans le
    tri."""
    cles = [float(k.co[0]) for sac in sacs(action) for c in sac.fcurves for k in c.keyframe_points]
    if not cles:
        return []
    rendu = bpy.context.scene.render
    images = rendu.fps / rendu.fps_base
    pas = images / IMAGES_PAR_SECONDE
    debut, fin = math.ceil(min(cles) / pas - 1e-9), math.floor(max(cles) / pas + 1e-9)
    grille = [k * pas for k in range(debut, fin + 1)]
    tous = sorted(grille + cles)
    return [t for i, t in enumerate(tous) if i == 0 or t - tous[i - 1] > INSTANTS_CONFONDUS * images]


def poses(rig, action, temps=None):
    """Par instant de `temps` (défaut : `instants(action)`), en images, de `action` joué sur `rig`, la matrice monde de
    chaque os, dans l'ordre de `rig.data.bones` : (instants, os, 4, 4)."""
    scene = bpy.context.scene
    image = scene.frame_current
    assign_action(rig, action)
    echantillons = []
    for instant in instants(action) if temps is None else temps:
        aller_a(scene, instant)
        echantillons.append([rig.matrix_world @ rig.pose.bones[b.name].matrix for b in rig.data.bones])
    scene.frame_set(image)
    return numpy.array(echantillons)


def repos(rig):
    """Par os de `rig`, l'inverse de sa matrice de repos, repère monde : (os, 4, 4) ; `poses(…) @ repos(rig)` donne les
    matrices de peau."""
    return numpy.array([b.matrix_local.inverted() @ rig.matrix_world.inverted() for b in rig.data.bones])


def matrices_de_peau(rig, clips):
    """Les noms d'os, et par instant de chaque clip la matrice de peau de chaque os, repère monde : (N, os, 4, 4)."""
    inverses = repos(rig)
    return [b.name for b in rig.data.bones], numpy.concatenate([poses(rig, a) @ inverses for a in clips]).astype(numpy.float32)


def peau_lineaire(peau, noms):
    """Les sommets de `peau` au repos, repère monde et homogènes, et leurs poids sur les os `noms`, réduits à
    `INFLUENCES_MAX` et normalisés : le skinning de l'export glTF."""
    index = {n: i for i, n in enumerate(noms)}
    groupes = {g.index: g.name for g in peau.vertex_groups}
    if set(groupes.values()) - index.keys():
        raise RuntimeError(f'{peau.name} : groupes hors du squelette {sorted(set(groupes.values()) - index.keys())}')
    sommets = peau.data.vertices
    x = numpy.array([(*(peau.matrix_world @ v.co), 1.0) for v in sommets], dtype=numpy.float32)
    w = numpy.zeros((len(sommets), len(noms)), dtype=numpy.float32)
    for v in sommets:
        for g in v.groups:
            w[v.index, index[groupes[g.group]]] = g.weight
    if not w.sum(axis=1).all():
        raise RuntimeError(f'{peau.name} : sommet sans poids')
    return x, limiter(w)


def melanges_par_lots(w, matrices):
    """Par lot de `LOT` échantillons de `matrices` de peau, la matrice de chaque sommet mélangée par ses poids `w`,
    réduite à ses trois premières lignes : (sommets, lot, 3, 4)."""
    for k in range(0, len(matrices), LOT):
        lot = matrices[k:k + LOT]
        n = len(lot)
        yield (w @ lot.transpose(1, 0, 2, 3).reshape(lot.shape[1], n * 16)).reshape(len(w), n, 4, 4)[:, :, :3, :]


def appliquer(melange, x):
    """Les sommets `x` (homogènes) sous leurs matrices mélangées `melange` (`melanges_par_lots`) : (lot, sommets, 3)."""
    return numpy.einsum('snij,sj->nsi', melange, x)


def deformer_par_lots(w, x, matrices):
    """Par lot de `LOT` échantillons de `matrices` de peau, les positions monde des sommets (`w`, `x`) : (lot,
    sommets, 3)."""
    for melange in melanges_par_lots(w, matrices):
        yield appliquer(melange, x)


def deformer(w, x, matrices):
    """Les positions monde des sommets (`w`, `x`) sous chaque échantillon de `matrices` de peau : (échantillons,
    sommets, 3)."""
    return numpy.concatenate(list(deformer_par_lots(w, x, matrices)))


def limiter(w):
    """Les lignes de `w` réduites à leurs `INFLUENCES_MAX` plus lourds, normalisées."""
    w = w.copy()
    rang = numpy.argsort(-w, axis=1)[:, INFLUENCES_MAX:]
    numpy.put_along_axis(w, rang, 0.0, axis=1)
    return w / w.sum(axis=1, keepdims=True)


def etats(x, decalages):
    """Les sommets `x` (homogènes) dans chaque état de la peau : le neutre, puis chaque shape key de `decalages`
    (`(clés, sommets, 3)`) à 1, décalage ajouté : (1 + clés, sommets, 4)."""
    deplaces = numpy.pad(decalages, ((0, 0), (0, 0), (0, 1)))
    return numpy.concatenate([x[None], x[None] + deplaces]).astype(numpy.float32)


def extremes(w, x, decalages, aretes, longueurs, matrices):
    """Par état de la peau (`etats` : ligne 0 le neutre, ligne 1 + k la clé k de `decalages`) et par arête de `aretes`,
    ses rapports minimal et maximal sur les échantillons `matrices` : sa longueur déformée, sommets (`w`, `x` + décalage
    de l'état), rapportée à `longueurs`, celles du repos sans clé. Rend (bas, haut), chacun (1 + clés, arêtes)."""
    sommets, locales = numpy.unique(aretes, return_inverse=True)
    locales = locales.reshape(aretes.shape)
    positions = etats(x[sommets], decalages[:, sommets])
    bas = numpy.full((len(positions), len(aretes)), numpy.inf, dtype=numpy.float32)
    haut = numpy.zeros((len(positions), len(aretes)), dtype=numpy.float32)
    for melange in melanges_par_lots(w[sommets], matrices):
        for e, xs in enumerate(positions):
            p = appliquer(melange, xs)
            rapport = numpy.linalg.norm(p[:, locales[:, 0]] - p[:, locales[:, 1]], axis=2) / longueurs
            bas[e] = numpy.minimum(bas[e], rapport.min(axis=0))
            haut[e] = numpy.maximum(haut[e], rapport.max(axis=0))
    return bas, haut


def jumeaux(x):
    """Par sommet, le plus petit indice des sommets confondus avec lui au repos."""
    arbre = KDTree(len(x))
    for i, p in enumerate(x):
        arbre.insert(p[:3], i)
    arbre.balance()
    return numpy.array([min(i for _, i, _ in arbre.find_range(p[:3], TOLERANCE_JUMEAUX_POSITION_M)) for p in x])


def lisser_les_sommets(nom, x, w, decalages, jumeau, aretes, matrices):
    """Le noyau de `lisser`, sans Blender : les poids `w` des sommets `x` (homogènes, repère monde) lissés jusqu'à ce
    que les arêtes `aretes`, entre nœuds `jumeau`, restent dans `ETIREMENT_EN_CLIP` à chaque échantillon de `matrices`
    et à chaque état (`extremes`) ; `decalages` a la forme de `sol.deplacements`, {clé : (sommets, 3)}. Rend les poids
    lissés et les indices triés des sommets retouchés, jumeaux compris."""
    d = numpy.array(list(decalages.values()), dtype=numpy.float32).reshape(len(decalages), len(x), 3)
    w = w.copy()
    longueurs = numpy.linalg.norm(x[aretes[:, 0], :3] - x[aretes[:, 1], :3], axis=1)
    voisins = [([], []) for _ in x]
    for (a, b), l in zip(aretes, longueurs):
        for s, n in ((a, b), (b, a)):
            voisins[s][0].append(n)
            voisins[s][1].append(l ** -2)
    actives = numpy.arange(len(aretes))
    retouches, anneaux = set(), 0
    for passe in range(PASSES_MAX + 1):
        bas, haut = extremes(w, x, d, aretes[actives], longueurs[actives], matrices)
        hors = ((bas < ETIREMENT_EN_CLIP[0]) | (haut > ETIREMENT_EN_CLIP[1])).any(axis=0)
        print('POIDS', nom, 'passe', passe, 'arêtes', int(hors.sum()), 'rapports', round(float(bas.min()), 4),
              round(float(haut.max()), 3), 'anneaux', anneaux, 'états', 1 + len(d), flush=True)
        if not hors.any():
            break
        if passe == PASSES_MAX:
            raise RuntimeError(f'{nom} : {int(hors.sum())} arête(s) hors de {ETIREMENT_EN_CLIP} après {PASSES_MAX} passes')
        marquees = numpy.zeros(len(aretes), dtype=bool)
        marquees[actives[hors]] = True
        region = numpy.flatnonzero(region_locale(aretes, marquees, anneaux, len(x)))
        lisses = limiter(numpy.array([numpy.array(voisins[s][1]) @ w[voisins[s][0]] for s in region]))
        if numpy.abs(lisses - w[region]).max() < STAGNATION:
            anneaux += 1
        w[region] = lisses
        retouches.update(region.tolist())
        actives = numpy.flatnonzero(numpy.isin(aretes, region).any(axis=1))
    return w, numpy.flatnonzero(numpy.isin(jumeau, list(retouches)))


def lisser(peau, noms, matrices, decalages):
    """Lisse les poids de `peau` jusqu'à ce que ses arêtes restent dans `ETIREMENT_EN_CLIP` sous les matrices de peau
    `matrices`, à chaque état que portent ses `decalages` (`lisser_les_sommets`) ; rend les indices triés des sommets
    retouchés."""
    sommets = peau.data.vertices
    x, w = peau_lineaire(peau, noms)
    jumeau = jumeaux(x)
    w, retouches = lisser_les_sommets(peau.name, x, w, decalages, jumeau, aretes_des_triangles(peau, jumeau), matrices)
    for s in retouches:
        for g in list(sommets[s].groups):
            peau.vertex_groups[g.group].remove([int(s)])
        for i in numpy.flatnonzero(w[jumeau[s]]):
            groupe = peau.vertex_groups.get(noms[i]) or peau.vertex_groups.new(name=noms[i])
            groupe.add([int(s)], float(w[jumeau[s], i]), 'REPLACE')
    return retouches


def lisser_les_poids(rig, peaux, clips, decalages):
    """Lisse les poids de chaque peau de `peaux` contre les instants des clips `clips` du rig, tels que passés, à
    chaque état de la peau : `decalages[peau.name]` a la forme de `sol.deplacements(peau)`, vide pour une peau sans
    shape key. Rend, par nom de peau, l'ensemble des indices de ses sommets retouchés."""
    noms, matrices = matrices_de_peau(rig, clips)
    print('POIDS', len(matrices), 'échantillons', flush=True)
    retouches = {}
    for peau in peaux:
        retouches[peau.name] = set(lisser(peau, noms, matrices, decalages[peau.name]).tolist())
        print('POIDS', peau.name, len(retouches[peau.name]), 'sommet(s) retouché(s)', flush=True)
    return retouches
