"""Lissage des poids de la base humanoïde (#2972, lot B3) : là où un clip étire ou écrase une arête de la peau hors de
`ETIREMENT_EN_CLIP`, les poids de ses deux sommets prennent la moyenne de leurs voisins pondérée par l'inverse du carré de la
longueur de l'arête qui les relie, jusqu'à ce qu'aucune arête n'en sorte. L'étirement d'une arête croît comme l'écart de
poids de ses sommets rapporté à sa longueur : la pondération reporte le saut de poids des micro-arêtes sur les arêtes
longues, où il étire peu.

L'étirement d'une arête est le rapport de sa longueur déformée à sa longueur de repos, aux clés de chaque clip (`instants`),
en skinning linéaire sur `INFLUENCES_MAX` os normalisés : le modèle de l'export glTF et de la garde
`hotes/godot/asset/evaluateur/gardes/etirement.ts`. Les arêtes sont celles des triangles, diagonales comprises. Les
jumeaux (sommets confondus au repos, plus proches que `TOLERANCE_JUMEAUX_POSITION_M`) se lissent comme un seul sommet.
"""
import bpy
import numpy
from mathutils.kdtree import KDTree

from animation import assign_action
from formes import aretes_des_triangles
from pistes import aller_a, sacs
from seuils import ETIREMENT_EN_CLIP, INFLUENCES_MAX, TOLERANCE_JUMEAUX_POSITION_M

STAGNATION = 1e-3
"""Variation de poids d'une passe sous laquelle le lissage tient son point fixe : la région lissée gagne alors un anneau
de voisins autour des arêtes hors de `ETIREMENT_EN_CLIP`."""
PASSES_MAX = 200
"""Passes de lissage au-delà desquelles la construction s'arrête."""
LOT = 64
"""Échantillons déformés ensemble."""
CLES_CONFONDUES = 1e-4
"""Deux clés plus proches que cet écart, en images, sont un seul instant."""


def instants(action):
    """Les instants de `action`, en images : l'union des clés de toutes ses courbes, triée. Entre deux instants
    consécutifs, aucune courbe n'a de clé."""
    cles = sorted({float(k.co[0]) for sac in sacs(action) for c in sac.fcurves for k in c.keyframe_points})
    return [t for i, t in enumerate(cles) if i == 0 or t - cles[i - 1] > CLES_CONFONDUES]


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


def deformer_par_lots(w, x, matrices):
    """Par lot de `LOT` échantillons de `matrices` de peau, les positions monde des sommets (`w`, `x`) : (lot,
    sommets, 3)."""
    for k in range(0, len(matrices), LOT):
        lot = matrices[k:k + LOT]
        n = len(lot)
        melange = (w @ lot.transpose(1, 0, 2, 3).reshape(lot.shape[1], n * 16)).reshape(len(x), n, 4, 4)
        yield numpy.einsum('snij,sj->nsi', melange[:, :, :3, :], x)


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


def extremes(w, x, aretes, longueurs, matrices):
    """Par arête de `aretes`, ses rapports minimal et maximal, déformé / repos, sur les échantillons `matrices`."""
    sommets, locales = numpy.unique(aretes, return_inverse=True)
    locales = locales.reshape(aretes.shape)
    ws, xs = w[sommets], x[sommets]
    bas = numpy.full(len(aretes), numpy.inf, dtype=numpy.float32)
    haut = numpy.zeros(len(aretes), dtype=numpy.float32)
    for p in deformer_par_lots(ws, xs, matrices):
        rapport = numpy.linalg.norm(p[:, locales[:, 0]] - p[:, locales[:, 1]], axis=2) / longueurs
        bas = numpy.minimum(bas, rapport.min(axis=0))
        haut = numpy.maximum(haut, rapport.max(axis=0))
    return bas, haut


def jumeaux(x):
    """Par sommet, le plus petit indice des sommets confondus avec lui au repos."""
    arbre = KDTree(len(x))
    for i, p in enumerate(x):
        arbre.insert(p[:3], i)
    arbre.balance()
    return numpy.array([min(i for _, i, _ in arbre.find_range(p[:3], TOLERANCE_JUMEAUX_POSITION_M)) for p in x])


def lisser(peau, noms, matrices):
    """Lisse les poids de `peau` jusqu'à ce que ses arêtes restent dans `ETIREMENT_EN_CLIP` ; rend le nombre de sommets
    retouchés."""
    sommets = peau.data.vertices
    x, w = peau_lineaire(peau, noms)
    jumeau = jumeaux(x)
    aretes = aretes_des_triangles(peau, jumeau)
    longueurs = numpy.linalg.norm(x[aretes[:, 0], :3] - x[aretes[:, 1], :3], axis=1)
    voisins = [([], []) for _ in sommets]
    for (a, b), l in zip(aretes, longueurs):
        for s, n in ((a, b), (b, a)):
            voisins[s][0].append(n)
            voisins[s][1].append(l ** -2)
    actives = numpy.arange(len(aretes))
    retouches, anneaux = set(), 0
    for passe in range(PASSES_MAX + 1):
        bas, haut = extremes(w, x, aretes[actives], longueurs[actives], matrices)
        hors = (bas < ETIREMENT_EN_CLIP[0]) | (haut > ETIREMENT_EN_CLIP[1])
        print('POIDS', peau.name, 'passe', passe, 'arêtes', int(hors.sum()), 'rapports', round(float(bas.min()), 4),
              round(float(haut.max()), 3), 'anneaux', anneaux, flush=True)
        if not hors.any():
            break
        if passe == PASSES_MAX:
            raise RuntimeError(f'{peau.name} : {int(hors.sum())} arête(s) hors de {ETIREMENT_EN_CLIP} après {PASSES_MAX} passes')
        region = set(aretes[actives[hors]].ravel().tolist())
        for _ in range(anneaux):
            region.update(n for s in list(region) for n in voisins[s][0])
        region = numpy.array(sorted(region))
        lisses = limiter(numpy.array([numpy.array(voisins[s][1]) @ w[voisins[s][0]] for s in region]))
        if numpy.abs(lisses - w[region]).max() < STAGNATION:
            anneaux += 1
        w[region] = lisses
        retouches.update(region.tolist())
        actives = numpy.flatnonzero(numpy.isin(aretes, region).any(axis=1))
    retouches = numpy.flatnonzero(numpy.isin(jumeau, list(retouches)))
    for s in retouches:
        for g in list(sommets[s].groups):
            peau.vertex_groups[g.group].remove([int(s)])
        for i in numpy.flatnonzero(w[jumeau[s]]):
            groupe = peau.vertex_groups.get(noms[i]) or peau.vertex_groups.new(name=noms[i])
            groupe.add([int(s)], float(w[jumeau[s], i]), 'REPLACE')
    return len(retouches)


def lisser_les_poids(rig, peaux, clips):
    """Lisse les poids de chaque peau de `peaux` contre les clips `clips` du rig."""
    noms, matrices = matrices_de_peau(rig, clips)
    print('POIDS', len(matrices), 'échantillons', flush=True)
    for peau in peaux:
        print('POIDS', peau.name, lisser(peau, noms, matrices), 'sommet(s) retouché(s)', flush=True)
