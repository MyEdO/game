"""Shape keys d'un mesh (#2972, L1d #3101) : lecture et écriture des décalages d'une clé, lissage d'un champ de
décalages jusqu'à ce qu'aucune arête ne soit hors bornes, sur tout le mesh ou autour des arêtes hors bornes, liaison des sommets d'un corps à la surface d'un donneur (`lier`, `transporter`)
et transfert des clés d'une source vers une cible par liaison de surface (modificateur Surface Deform), pour les peaux
secondaires de la base comme pour les éléments posés sur elle.
"""
import bpy
import numpy
from mathutils.bvhtree import BVHTree

STAGNATION_M = 1e-4
"""Variation du champ d'une passe, en mètres, sous laquelle le lissage local s'élargit : valeur d'ingénierie #3101."""


def positions(mesh, cle=None):
    """Les positions des sommets de `mesh` (données `Mesh`) sous la shape key `cle` (nom), ou au repos : (sommets, 3)."""
    source = mesh.vertices if cle is None else mesh.shape_keys.key_blocks[cle].data
    co = numpy.empty(len(source) * 3, dtype=numpy.float64)
    source.foreach_get('co', co)
    return co.reshape(-1, 3)


def poser_la_cle(objet, nom, decalages):
    """Pose sur `objet` la shape key `nom` : le repos décalé de `decalages` (sommets, 3), repère du mesh. La clé
    de référence se crée si le mesh n'en a pas ; une clé homonyme est remplacée."""
    if objet.data.shape_keys is None:
        objet.shape_key_add(name='Basis', from_mix=False)
    cle = objet.data.shape_keys.key_blocks.get(nom) or objet.shape_key_add(name=nom, from_mix=False)
    cle.data.foreach_set('co', (positions(objet.data) + decalages).astype(numpy.float32).ravel())
    cle.value = 0.0
    return cle


def decalages(objet, nom):
    """Le décalage de chaque sommet de `objet` sous sa shape key `nom`, depuis le repos : (sommets, 3)."""
    return positions(objet.data, nom) - positions(objet.data)


def aretes_des_triangles(objet, noeud):
    """Les arêtes des triangles de `objet` (diagonales comprises), entre nœuds `noeud` (par sommet, l'indice du sommet
    qui représente son nœud, `poids.jumeaux`), sans doublon ni arête d'un nœud à lui-même : (arêtes, 2)."""
    objet.data.calc_loop_triangles()
    triangles = noeud[numpy.array([t.vertices[:] for t in objet.data.loop_triangles])]
    aretes = numpy.unique(numpy.sort(triangles[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2), axis=1), axis=0)
    return aretes[aretes[:, 0] != aretes[:, 1]]


def rapports(x, champ, aretes):
    """Par arête, sa longueur sous les sommets `x` décalés de `champ`, rapportée à sa longueur sous `x` : (arêtes,)."""
    y = x + champ
    return (numpy.linalg.norm(y[aretes[:, 0]] - y[aretes[:, 1]], axis=1)
            / numpy.linalg.norm(x[aretes[:, 0]] - x[aretes[:, 1]], axis=1))


def aux_noeuds(champ, noeud):
    """Le champ par sommet `champ` (sommets, …) moyenné sur chaque nœud `noeud` (`poids.jumeaux`) : (nœuds, …)."""
    n = noeud.max() + 1
    valeur = numpy.zeros((n, *champ.shape[1:]))
    numpy.add.at(valeur, noeud, champ)
    return valeur / numpy.maximum(numpy.bincount(noeud, minlength=n), 1).reshape(-1, *[1] * (champ.ndim - 1))


def pas_laplacien(valeur, aretes):
    """Un pas de lissage laplacien, pas 1/2, des valeurs `valeur` (nœuds, …) le long des arêtes `aretes`
    (`aretes_des_triangles`) : chaque nœud prend la moitié de sa valeur et la moitié de la moyenne de ses voisins."""
    a, b = numpy.concatenate([aretes[:, 0], aretes[:, 1]]), numpy.concatenate([aretes[:, 1], aretes[:, 0]])
    somme = numpy.zeros_like(valeur)
    numpy.add.at(somme, a, valeur[b])
    voisins = numpy.maximum(numpy.bincount(a, minlength=len(valeur)), 1).reshape(-1, *[1] * (valeur.ndim - 1))
    return 0.5 * valeur + 0.5 * somme / voisins


def region_locale(aretes, masque, anneaux, n):
    """Par nœud (`n` nœuds), s'il est extrémité d'une arête de `aretes` que marque `masque`, ou à au plus `anneaux`
    arêtes d'une telle extrémité : (nœuds,) booléen."""
    dans = numpy.zeros(n, dtype=bool)
    dans[aretes[masque].ravel()] = True
    for _ in range(anneaux):
        dans[aretes[dans[aretes].any(axis=1)].ravel()] = True
    return dans


def lisser(champ, x, noeud, aretes, facteur, hors, passes_max, region):
    """Le champ de décalages `champ` (sommets, 3) des sommets `x`, lissé (`pas_laplacien` sur les nœuds `noeud` et leurs
    arêtes `aretes`, `aretes_des_triangles`) puis multiplié par `facteur` (sommets,), jusqu'à ce que `hors` (champ
    complet -> masque booléen des arêtes `aretes`) ne marque plus aucune arête ; les sommets d'un même nœud reçoivent
    la même valeur. `region` `'pleine'` : le pas porte sur tous les nœuds ; `'locale'` : sur les seuls nœuds de
    `region_locale` autour des arêtes marquées, les autres gardent leur valeur, et la région gagne un anneau de voisins
    dès que le champ y varie de moins de `STAGNATION_M` sur une passe. Rend le champ et le nombre de passes. Une arête
    marquée dont les deux extrémités ont un `facteur` nul, qu'aucun pas ne change, ou une arête marquée au-delà de
    `passes_max` passes, arrête la construction."""
    if region not in ('pleine', 'locale'):
        raise ValueError(f"région {region!r} : 'pleine' ou 'locale'")
    valeur = aux_noeuds(champ, noeud)
    anneaux = 0
    for passe in range(passes_max + 1):
        resultat = valeur[noeud] * facteur[:, None]
        marquees = hors(resultat)
        if not marquees.any():
            return resultat, passe
        tenues = marquees & (facteur[aretes] == 0).all(axis=1)
        if tenues.any():
            raise RuntimeError(f'{int(tenues.sum())} arête(s) hors bornes aux deux extrémités tenues : aucune passe de '
                               'lissage ne les change')
        if passe == passes_max:
            raise RuntimeError(f'{int(marquees.sum())} arête(s) hors bornes après {passes_max} passes de lissage')
        lisse = pas_laplacien(valeur, aretes)
        if region == 'pleine':
            valeur = lisse
            continue
        dans = numpy.flatnonzero(region_locale(aretes, marquees, anneaux, len(valeur)))
        variation = numpy.abs((lisse[dans] - valeur[dans]) * facteur[dans][:, None]).max()
        valeur = valeur.copy()
        valeur[dans] = lisse[dans]
        if variation < STAGNATION_M:
            anneaux += 1


def voisins(rig, noms):
    """Par os (indice dans `noms`), les indices de lui-même, de son parent et de ses enfants."""
    index = {n: i for i, n in enumerate(noms)}
    return [sorted({index[b.name], *([index[b.parent.name]] if b.parent else []), *(index[c.name] for c in b.children)})
            for b in (rig.data.bones[n] for n in noms)]


def lier(x, os_de_x, surface, faces, os_des_faces, voisinage):
    """Lie chaque point `x` (points, 3) à son point le plus proche sur la surface d'un donneur (`surface`, sommets, 3 ;
    `faces`, triangles, 3), parmi les seules faces dont l'os dominant `os_des_faces` est voisin (`voisinage`, par os, la
    liste de ses os candidats, `voisins`) de l'os `os_de_x` du point : la surface la plus proche d'un autre membre n'est
    pas candidate. Rend, par point, la face retenue, les coordonnées barycentriques du point lié dans cette face
    (points, 3) et la distance ; un champ porté par les sommets du donneur se lit au point lié par `transporter`."""
    sommets = [tuple(p) for p in surface]
    parties = {o: numpy.flatnonzero(os_des_faces == o) for o in numpy.unique(os_des_faces)}
    arbres = {o: BVHTree.FromPolygons(sommets, faces[f].tolist(), all_triangles=True) for o, f in parties.items()}
    face, points, distances = numpy.empty(len(x), dtype=int), numpy.empty_like(x), numpy.empty(len(x))
    for i, (p, o) in enumerate(zip(x, os_de_x)):
        (point, _, local, distance), v = min(
            ((arbres[v].find_nearest(tuple(p)), v) for v in voisinage[o] if v in arbres),
            key=lambda t: t[0][3] if t[0][0] is not None else numpy.inf)
        if point is None:
            raise RuntimeError(f'point {i} : aucune face de son os ni de ses voisins')
        face[i], points[i], distances[i] = parties[v][local], point, distance
    a, b, c = (surface[faces[face, k]] for k in range(3))
    u, v, q = b - a, c - a, points - a
    uu, uv, vv = (u * u).sum(1), (u * v).sum(1), (v * v).sum(1)
    qu, qv = (q * u).sum(1), (q * v).sum(1)
    det = uu * vv - uv * uv
    beta, gamma = (vv * qu - uv * qv) / det, (uu * qv - uv * qu) / det
    return face, numpy.stack([1.0 - beta - gamma, beta, gamma], axis=1), distances


def transporter(champ, faces, face, barycentres):
    """Le champ `champ` (sommets du donneur, 3) lu en chaque point lié par `lier` (`face`, `barycentres`) : (points, 3)."""
    return numpy.einsum('pk,pkc->pc', barycentres, champ[faces[face]])


def noms_des_cles(objet):
    """Les shape keys de `objet` hors sa clé de référence, dans l'ordre du mesh."""
    cles = objet.data.shape_keys
    return [c.name for c in cles.key_blocks if c != cles.reference_key] if cles else []


def transferer_les_cles(source, cible, noms):
    """Pose sur `cible` chaque shape key `noms` de `source`, par liaison de surface au repos : `cible` suit la surface de
    `source` portée à 1 sur la clé, les autres à 0. Les autres modificateurs des deux objets sont coupés le temps
    du transfert."""
    coupes = [(m, m.show_viewport) for o in (source, cible) for m in o.modifiers]
    for m, _ in coupes:
        m.show_viewport = False
    valeurs = {c.name: c.value for c in source.data.shape_keys.key_blocks}
    liaison = cible.modifiers.new('liaison_de_surface', 'SURFACE_DEFORM')
    liaison.target = source
    try:
        with bpy.context.temp_override(object=cible, active_object=cible):
            bpy.ops.object.surfacedeform_bind(modifier=liaison.name)
        if not liaison.is_bound:
            raise RuntimeError(f'{cible.name} : liaison de surface à {source.name} impossible')
        repos = positions(cible.data)
        for nom in noms:
            for cle in source.data.shape_keys.key_blocks:
                cle.value = 1.0 if cle.name == nom else 0.0
            depsgraph = bpy.context.evaluated_depsgraph_get()
            depsgraph.update()
            evalue = cible.evaluated_get(depsgraph)
            co = numpy.empty(len(evalue.data.vertices) * 3, dtype=numpy.float64)
            evalue.data.vertices.foreach_get('co', co)
            poser_la_cle(cible, nom, co.reshape(-1, 3) - repos)
    finally:
        for cle in source.data.shape_keys.key_blocks:
            cle.value = valeurs[cle.name]
        cible.modifiers.remove(liaison)
        for m, visible in coupes:
            m.show_viewport = visible
