"""Lissage des poids de la base humanoïde (#2972, lot B3) : là où un clip étire ou écrase une arête de la peau hors de
`ETIREMENT_VISE`, les poids de ses deux sommets prennent la moyenne de leurs voisins pondérée par l'inverse du carré de la
longueur de l'arête qui les relie, jusqu'à ce qu'aucune arête n'en sorte. L'étirement d'une arête croît comme l'écart de
poids de ses sommets rapporté à sa longueur : la pondération reporte le saut de poids des micro-arêtes sur les arêtes
longues, où il étire peu.

L'étirement d'une arête est le rapport de sa longueur déformée à sa longueur de repos, aux images clés de chaque clip,
en skinning linéaire sur `INFLUENCES_MAX` os normalisés : le modèle de l'export glTF et de la garde
`hotes/godot/asset/evaluateur/gardes/etirement.ts`. Les arêtes sont celles des triangles, diagonales comprises. Les
jumeaux (sommets confondus au repos, plus proches que `DEPLACEMENT_MIN_M`) se lissent comme un seul sommet.
"""
import bpy
import numpy
from mathutils.kdtree import KDTree

from animation import assign_action
from mesure import INFLUENCES_MAX
from verifier_export import DEPLACEMENT_MIN_M

ETIREMENT_VISE = (0.014, 3.51)
"""Rapports extrêmes visés, déformé / repos : ceux de la référence `UAL1_Standard.glb` (etirement.ts:5)."""
STAGNATION = 1e-3
"""Variation de poids d'une passe sous laquelle le lissage tient son point fixe : la région lissée gagne alors un anneau
de voisins autour des arêtes hors de `ETIREMENT_VISE`."""
PASSES_MAX = 200
"""Passes de lissage au-delà desquelles la construction s'arrête."""
LOT = 64
"""Échantillons déformés ensemble."""


def matrices_de_peau(rig, clips):
    """Les noms d'os, et par image clé de chaque clip la matrice de peau de chaque os, repère monde : (N, os, 4, 4)."""
    noms = [b.name for b in rig.data.bones]
    monde, inverse = rig.matrix_world, rig.matrix_world.inverted()
    repos = [b.matrix_local.inverted() @ inverse for b in rig.data.bones]
    scene = bpy.context.scene
    image = scene.frame_current
    echantillons = []
    for action in clips:
        assign_action(rig, action)
        debut, fin = (round(f) for f in action.frame_range)
        for f in range(debut, fin + 1):
            scene.frame_set(f)
            echantillons.append([monde @ rig.pose.bones[n].matrix @ r for n, r in zip(noms, repos)])
    scene.frame_set(image)
    return noms, numpy.array(echantillons, dtype=numpy.float32)


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
    for k in range(0, len(matrices), LOT):
        lot = matrices[k:k + LOT]
        n = len(lot)
        melange = (ws @ lot.transpose(1, 0, 2, 3).reshape(lot.shape[1], n * 16)).reshape(len(sommets), n, 4, 4)
        p = numpy.einsum('snij,sj->nsi', melange[:, :, :3, :], xs)
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
    return numpy.array([min(i for _, i, _ in arbre.find_range(p[:3], DEPLACEMENT_MIN_M)) for p in x])


def lisser(peau, noms, matrices):
    """Lisse les poids de `peau` jusqu'à ce que ses arêtes restent dans `ETIREMENT_VISE` ; rend le nombre de sommets
    retouchés."""
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
    w = limiter(w)
    jumeau = jumeaux(x)
    peau.data.calc_loop_triangles()
    triangles = jumeau[numpy.array([t.vertices[:] for t in peau.data.loop_triangles])]
    aretes = numpy.unique(numpy.sort(triangles[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2), axis=1), axis=0)
    aretes = aretes[aretes[:, 0] != aretes[:, 1]]
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
        hors = (bas < ETIREMENT_VISE[0]) | (haut > ETIREMENT_VISE[1])
        print('POIDS', peau.name, 'passe', passe, 'arêtes', int(hors.sum()), 'rapports', round(float(bas.min()), 4),
              round(float(haut.max()), 3), 'anneaux', anneaux, flush=True)
        if not hors.any():
            break
        if passe == PASSES_MAX:
            raise RuntimeError(f'{peau.name} : {int(hors.sum())} arête(s) hors de {ETIREMENT_VISE} après {PASSES_MAX} passes')
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
