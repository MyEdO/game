"""Shape keys d'un mesh (#2972, L1d #3101) : lecture et écriture des décalages d'une clé, rabot d'un champ de
décalages jusqu'à ce qu'aucune arête ne soit hors bornes, liaison des sommets d'un corps à la surface d'un donneur (`lier`, `transporter`)
et transfert des clés d'une source vers une cible par liaison de surface (modificateur Surface Deform), pour les peaux
secondaires de la base comme pour les éléments posés sur elle.
"""
import bpy
import numpy
from mathutils.bvhtree import BVHTree

RABOT = 0.9
"""Facteur dont une passe de `raboter` multiplie une clé de force 1 aux nœuds de ses arêtes marquées, `RABOT ** s` à
force s : valeur d'ingénierie #3104 (capture r9 du 2026-11-04 : 53 passes, `feminin` garde 85 % de son amplitude et
5 cm au sein, contre 68 % et 3,4 cm à 0,7)."""
PENTE_DU_RABOT = 3
"""Anneaux de nœuds autour de la région rabotée d'une clé où une passe de `raboter` descend en pente de `RABOT ** s`
à 1 (#4002). Une marche, la région à `RABOT ** s` contre des voisins à 1, creuse passe après passe un sillon d'un
nœud de large, que la clé montre en pli au repos ; la pente répartit la même baisse sur une bande, que la clé montre
en creux doux."""
STAGNATION_M = 1e-3
"""Baisse par passe du plus grand décalage mesuré sous laquelle la région de rabot d'une clé gagne un anneau
(`raboter`) : valeur d'ingénierie #3104 (constructions du 2026-11-04 : sans anneau, r16 garde 80 arêtes par clé en
défaut après 39 passes ; r18, où la correction rend aux nœuds rabotés ce que la passe leur ôte, en garde 100 après 13)."""


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


def retournees_par(x, champ, aretes):
    """Par arête, vrai si les sommets `x` décalés de `champ` la retournent, sens opposé ou nul à celui sous `x` : (arêtes,)."""
    y = x + champ
    return numpy.einsum('ij,ij->i', y[aretes[:, 1]] - y[aretes[:, 0]], x[aretes[:, 1]] - x[aretes[:, 0]]) <= 0


def aux_noeuds(champ, noeud):
    """Le champ par sommet `champ` (sommets, …) moyenné sur chaque nœud `noeud` (`poids.jumeaux`) : (nœuds, …)."""
    n = noeud.max() + 1
    valeur = numpy.zeros((n, *champ.shape[1:]))
    numpy.add.at(valeur, noeud, champ)
    return valeur / numpy.maximum(numpy.bincount(noeud, minlength=n), 1).reshape(-1, *[1] * (champ.ndim - 1))


def anneaux_des_marquees(aretes, force, profondeur, n):
    """Par nœud (`n` nœuds), sa distance en arêtes aux extrémités des arêtes de `aretes` de `force` non nulle, -1
    au-delà de `profondeur`, et la force de l'extrémité la plus proche, la plus forte à égalité, 0 au-delà :
    (nœuds,) entier, (nœuds,) réel."""
    distance = numpy.full(n, -1)
    proche = numpy.zeros(n)
    marquees = force > 0
    numpy.maximum.at(proche, aretes[marquees].ravel(), numpy.repeat(force[marquees], 2))
    distance[proche > 0] = 0
    for r in range(1, profondeur + 1):
        front = distance == r - 1
        for depuis, vers in ((0, 1), (1, 0)):
            pas = front[aretes[:, depuis]] & (distance[aretes[:, vers]] < 0)
            numpy.maximum.at(proche, aretes[pas, vers], proche[aretes[pas, depuis]])
        distance[(distance < 0) & (proche > 0)] = r
    return distance, proche


def region_locale(aretes, masque, anneaux, n):
    """Par nœud (`n` nœuds), s'il est extrémité d'une arête de `aretes` que marque `masque`, ou à au plus `anneaux`
    arêtes d'une telle extrémité (`anneaux_des_marquees`) : (nœuds,) booléen."""
    return anneaux_des_marquees(aretes, numpy.asarray(masque, dtype=float), anneaux, n)[0] >= 0


def raboter(champ, noeud, aretes, facteur, mesurer, passes_max, cumul=None):
    """Les champs de décalages `champ` (sommets, clés, 3) multipliés par `facteur` (sommets,) et par le rabot cumulé
    `cumul` (sommets, clés) d'un rabot précédent (par défaut 1), rabotés passe après passe jusqu'à ce que `mesurer`
    (champs complets, rabot cumulé de chaque sommet et clé -> (champs mesurés, force (arêtes, clés) dans [0, 1])) ne
    marque plus aucune arête, une arête marquée pour une clé quand sa force y est non nulle (#4002). Chaque passe
    repart des champs mesurés : une projection, comme la correction des silhouettes, s'y applique avant le rabot
    suivant. Une passe multiplie chaque clé marquée par `RABOT ** s` sur les nœuds `noeud` de ses arêtes `aretes`
    marquées, s la plus grande force de leurs arêtes marquées ; la région d'une clé gagne un anneau de voisins dès que
    le plus grand décalage mesuré de la clé y baisse de moins de `STAGNATION_M` sur une passe, ses nœuds à la force de
    l'extrémité marquée la plus proche (`anneaux_des_marquees`). Les nœuds à r anneaux de la région, 1 ≤ r ≤
    `PENTE_DU_RABOT`, reçoivent `RABOT ** (s · (1 − r / (PENTE_DU_RABOT + 1)))`, s la force du nœud raboté le plus
    proche ; la clé reste intacte ailleurs. Un sommet de `facteur` nul reste nul. Les sommets d'un même nœud
    reçoivent la même valeur. Rend les champs mesurés de la dernière passe, le nombre de passes et le rabot cumulé.
    Une arête marquée dont les deux extrémités ont un `facteur` nul, qu'aucune passe ne change, ou une arête marquée
    au-delà de `passes_max` passes, arrête la construction."""
    libre = (facteur > 0)[:, None, None]
    cumul = aux_noeuds(numpy.ones(champ.shape[:2]) if cumul is None else cumul, noeud)
    valeur = aux_noeuds(champ * facteur[:, None, None], noeud) * cumul[:, :, None]
    anneaux = numpy.zeros(valeur.shape[1], dtype=int)
    rabotees = {}
    for passe in range(passes_max + 1):
        mesures, forces = mesurer(valeur[noeud] * libre, cumul[noeud])
        forces = numpy.asarray(forces, dtype=float)
        marquees = forces > 0
        if not marquees.any():
            return mesures, passe, cumul[noeud]
        tenues = marquees & (facteur[aretes] == 0).all(axis=1)[:, None]
        if tenues.any():
            raise RuntimeError(f'{int(tenues.any(axis=1).sum())} arête(s) hors bornes aux deux extrémités tenues : aucune passe de '
                               'rabot ne les change')
        if passe == passes_max:
            raise RuntimeError(f'{int(marquees.any(axis=1).sum())} arête(s) hors bornes après {passes_max} passes de rabot')
        valeur = aux_noeuds(mesures, noeud)
        for cle, (dans, avant) in rabotees.items():
            if avant - numpy.linalg.norm(valeur[dans, cle], axis=-1).max() < STAGNATION_M:
                anneaux[cle] += 1
        rabotees = {}
        for cle in numpy.flatnonzero(marquees.any(axis=0)):
            distance, s = anneaux_des_marquees(aretes, forces[:, cle], anneaux[cle] + PENTE_DU_RABOT, len(valeur))
            touches = distance >= 0
            dans = touches & (distance <= anneaux[cle])
            pente = numpy.clip(distance[touches] - anneaux[cle], 0, None) / (PENTE_DU_RABOT + 1)
            rabot = RABOT ** (s[touches] * (1 - pente))
            rabotees[cle] = (dans, numpy.linalg.norm(valeur[dans, cle], axis=-1).max())
            valeur[touches, cle] *= rabot[:, None]
            cumul[touches, cle] *= rabot


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
    return face, barycentres(points, *(surface[faces[face, k]] for k in range(3))), distances


def barycentres(points, a, b, c):
    """Les coordonnées barycentriques (points, 3) de chaque point de `points` projeté dans le plan du triangle (`a`,
    `b`, `c`, chacun (points, 3)), hors du triangle comprises."""
    u, v, q = b - a, c - a, points - a
    uu, uv, vv = (u * u).sum(1), (u * v).sum(1), (v * v).sum(1)
    qu, qv = (q * u).sum(1), (q * v).sum(1)
    det = uu * vv - uv * uv
    beta, gamma = (vv * qu - uv * qv) / det, (uu * qv - uv * qu) / det
    return numpy.stack([1.0 - beta - gamma, beta, gamma], axis=1)


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
