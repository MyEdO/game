"""Shape keys d'un mesh (#2972, L1d #3101) : lecture et écriture des décalages d'une clé, lissage d'un champ de
décalages jusqu'à des étirements bornés, et transfert des clés d'une source vers une cible par liaison de surface
(modificateur Surface Deform), pour les peaux secondaires de la base comme pour les éléments posés sur elle.
"""
import bpy
import numpy


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


def lisser(champ, x, noeud, aretes, facteur, bornes, passes_max):
    """Le champ de décalages `champ` (sommets, 3) des sommets `x`, lissé (laplacien, pas 1/2, sur les nœuds `noeud` et
    leurs arêtes `aretes`, `aretes_des_triangles`) puis multiplié par `facteur` (sommets,), jusqu'à ce que le rapport de
    chaque arête, sous le champ et contre `x` (`rapports`), tienne dans `bornes` ; les sommets d'un même nœud reçoivent
    la même valeur. Rend le champ et le nombre de passes ; au-delà de `passes_max`, la construction s'arrête."""
    n = noeud.max() + 1
    valeur = numpy.zeros((n, 3))
    numpy.add.at(valeur, noeud, champ)
    valeur /= numpy.maximum(numpy.bincount(noeud, minlength=n), 1)[:, None]
    a, b = numpy.concatenate([aretes[:, 0], aretes[:, 1]]), numpy.concatenate([aretes[:, 1], aretes[:, 0]])
    voisins = numpy.maximum(numpy.bincount(a, minlength=n), 1)[:, None]
    for passe in range(passes_max + 1):
        resultat = valeur[noeud] * facteur[:, None]
        r = rapports(x, resultat, aretes)
        hors = (r < bornes[0]) | (r > bornes[1])
        if not hors.any():
            return resultat, passe
        if passe == passes_max:
            raise RuntimeError(f'{int(hors.sum())} arête(s) hors de {bornes} après {passes_max} passes de lissage')
        somme = numpy.zeros((n, 3))
        numpy.add.at(somme, a, valeur[b])
        valeur = 0.5 * valeur + 0.5 * somme / voisins


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
