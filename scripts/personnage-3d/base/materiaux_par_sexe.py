"""Matériaux par sexe de la base humanoïde (#3188) : `parSexe` des `surfaces` de la déclaration (`humanoide.json`,
`hotes/godot/asset/surfaces.ts`).

- `recoucher_les_variantes` : chaque matériau qu'une surface nomme par sexe vient d'une peau d'un donneur (le corps F
  d'Universal Base Characters), peint sur les UV de ce donneur. Il est recouché sur les UV `TEXCOORD_0` des faces de la
  surface : chaque triangle de la surface se lie, par son centre, à la face la plus proche du donneur posé sur le repos
  du squelette (`silhouettes.surface_ramenee`, `formes.lier`), et ses coins, projetés dans le plan de cette face,
  y lisent leurs UV du donneur (`uv_lus`) ; chaque image du matériau devient une image de même taille, peinte texel à
  texel depuis l'image du donneur (`recoucher`). Une normale tangente tourne de la rotation qui amène le repère UV du
  donneur sur celui de la surface (`rotations_tangentes`).
- `declarer_les_variantes` : chaque matériau recouché s'exporte en variante `KHR_materials_variants`, du nom du sexe,
  des primitives de la surface ; le GLB porte ainsi un matériau qu'aucune primitive ne porte par défaut.
"""
import numpy

from formes import barycentres, lier, voisins
from poids import peau_lineaire
from silhouettes import surface_ramenee

UV_EXPORTEE = 0
"""Le calque UV que l'export glTF écrit en `TEXCOORD_0`, que lisent les textures des matériaux du pack et Godot (UV1)."""
DILATATION = 8
"""Texels de marge peints autour de chaque îlot UV recouché, pour que les mipmaps ne mêlent pas le fond à l'îlot."""
NORMALE_PLATE = (0.5, 0.5, 1.0, 1.0)
"""Le fond d'une carte de normales recouchée : la normale tangente nulle."""


def porte(peau, materiau):
    """`peau` porte-t-elle `materiau` à l'un de ses emplacements ?"""
    return materiau is not None and any(s.material == materiau for s in peau.material_slots)


def triangles_uv(peau, materiau):
    """Les triangles de `peau` de son matériau `materiau` : leur masque parmi tous ses triangles (`calc_loop_triangles`),
    leurs sommets (n, 3) et leurs UV du calque `UV_EXPORTEE` (n, 3, 2)."""
    maillage = peau.data
    maillage.calc_loop_triangles()
    slots = [i for i, s in enumerate(peau.material_slots) if s.material == materiau]
    garde = numpy.array([t.material_index in slots for t in maillage.loop_triangles], dtype=bool)
    retenus = [t for t, g in zip(maillage.loop_triangles, garde) if g]
    uv = numpy.empty(len(maillage.loops) * 2, dtype=numpy.float64)
    maillage.uv_layers[UV_EXPORTEE].data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    return (garde, numpy.array([t.vertices[:] for t in retenus], dtype=int).reshape(-1, 3),
            uv[numpy.array([t.loops[:] for t in retenus], dtype=int).reshape(-1, 3)])


def uv_lus(centres_lies, coins, surface, faces, uv_des_faces):
    """Par triangle de coins `coins` (n, 3, 3) dont le centre est lié à la face `centres_lies` (n) du donneur
    (`surface`, `faces`, d'UV `uv_des_faces`) : les UV du donneur de ses trois coins, projetés dans le plan de cette
    face, barycentres hors du triangle compris (n, 3, 2)."""
    a, b, c = (numpy.repeat(surface[faces[centres_lies, k]], 3, axis=0) for k in range(3))
    poids = barycentres(coins.reshape(-1, 3), a, b, c).reshape(-1, 3, 3)
    return numpy.einsum('nck,nkd->ncd', poids, uv_des_faces[centres_lies])


def rotations_tangentes(uv_cible, uv_source):
    """Par triangle, la rotation (2, 2), réflexion comprise, qui exprime dans le repère UV de la cible un vecteur
    tangent donné dans le repère UV de la source : la partie orthogonale (décomposition polaire) de l'application
    linéaire de la source vers la cible ; l'identité sur un triangle dégénéré."""
    cible = numpy.stack([uv_cible[:, 1] - uv_cible[:, 0], uv_cible[:, 2] - uv_cible[:, 0]], axis=2)
    source = numpy.stack([uv_source[:, 1] - uv_source[:, 0], uv_source[:, 2] - uv_source[:, 0]], axis=2)
    rotations = numpy.tile(numpy.eye(2), (len(cible), 1, 1))
    sains = (numpy.abs(numpy.linalg.det(cible)) > 1e-12) & (numpy.abs(numpy.linalg.det(source)) > 1e-12)
    u, _, vt = numpy.linalg.svd(cible[sains] @ numpy.linalg.inv(source[sains]))
    rotations[sains] = u @ vt
    return rotations


def texels(uv, largeur, hauteur):
    """Les texels (centres) couverts par les triangles UV `uv` (n, 3, 2) d'une image `largeur` × `hauteur` : leurs
    colonnes, leurs lignes (depuis le bas, comme les UV), leur triangle et leurs barycentres (m, 3) ; un texel de deux
    triangles revient au dernier."""
    coins = uv * (largeur, hauteur) - 0.5
    colonnes, lignes, triangles, poids = [], [], [], []
    for t, (p0, p1, p2) in enumerate(coins):
        matrice = numpy.array([p1 - p0, p2 - p0]).T
        if abs(numpy.linalg.det(matrice)) < 1e-12:
            continue
        bas = numpy.maximum(numpy.ceil(numpy.minimum(numpy.minimum(p0, p1), p2)), 0).astype(int)
        haut = numpy.minimum(numpy.floor(numpy.maximum(numpy.maximum(p0, p1), p2)), (largeur - 1, hauteur - 1)).astype(int)
        if (haut < bas).any():
            continue
        x, y = numpy.meshgrid(numpy.arange(bas[0], haut[0] + 1), numpy.arange(bas[1], haut[1] + 1))
        x, y = x.ravel(), y.ravel()
        beta, gamma = numpy.linalg.solve(matrice, numpy.stack([x - p0[0], y - p0[1]]))
        dedans = (beta >= -1e-9) & (gamma >= -1e-9) & (beta + gamma <= 1 + 1e-9)
        colonnes.append(x[dedans])
        lignes.append(y[dedans])
        triangles.append(numpy.full(int(dedans.sum()), t))
        poids.append(numpy.stack([1 - beta[dedans] - gamma[dedans], beta[dedans], gamma[dedans]], axis=1))
    if not colonnes:
        return (numpy.empty(0, dtype=int),) * 3 + (numpy.empty((0, 3)),)
    return numpy.concatenate(colonnes), numpy.concatenate(lignes), numpy.concatenate(triangles), numpy.concatenate(poids)


def echantillonner(pixels, uv):
    """`pixels` (hauteur, largeur, canaux), ligne 0 en bas, lus en bilinéaire aux UV `uv` (m, 2), bords tenus."""
    hauteur, largeur = pixels.shape[:2]
    x = numpy.clip(uv[:, 0] * largeur - 0.5, 0, largeur - 1)
    y = numpy.clip(uv[:, 1] * hauteur - 0.5, 0, hauteur - 1)
    x0, y0 = numpy.minimum(x.astype(int), largeur - 2), numpy.minimum(y.astype(int), hauteur - 2)
    fx, fy = (x - x0)[:, None], (y - y0)[:, None]
    return ((pixels[y0, x0] * (1 - fx) + pixels[y0, x0 + 1] * fx) * (1 - fy)
            + (pixels[y0 + 1, x0] * (1 - fx) + pixels[y0 + 1, x0 + 1] * fx) * fy)


def dilater(pixels, couverts, passes):
    """`pixels` peints hors de `couverts`, par `passes` anneaux : chaque texel non couvert voisin (huit voisins) d'un
    couvert prend la moyenne de ses voisins couverts, puis compte pour couvert."""
    hauteur, largeur = couverts.shape
    for _ in range(passes):
        somme = numpy.zeros_like(pixels)
        nombre = numpy.zeros(couverts.shape)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                cible = (slice(max(dy, 0), hauteur + min(dy, 0)), slice(max(dx, 0), largeur + min(dx, 0)))
                source = (slice(max(-dy, 0), hauteur + min(-dy, 0)), slice(max(-dx, 0), largeur + min(-dx, 0)))
                somme[cible] += pixels[source] * couverts[source][..., None]
                nombre[cible] += couverts[source]
        neufs = ~couverts & (nombre > 0)
        if not neufs.any():
            break
        pixels[neufs] = somme[neufs] / nombre[neufs][:, None]
        couverts = couverts | neufs
    return pixels, couverts


def recoucher(pixels, uv_cible, uv_source, normales):
    """L'image `pixels` (hauteur, largeur, 4) du donneur, peinte sur ses UV, recouchée à la même taille sur les UV
    `uv_cible` (n, 3, 2) des triangles dont `uv_source` (n, 3, 2) donne les UV du donneur : chaque texel couvert lit
    le donneur au point de mêmes barycentres ; `normales` dit une carte de normales tangentes, dont chaque texel tourne
    de `rotations_tangentes`. Marge `DILATATION`, puis un fond : la normale nulle, ou la moyenne des texels couverts."""
    hauteur, largeur = pixels.shape[:2]
    colonnes, lignes, triangles, poids = texels(uv_cible, largeur, hauteur)
    lus = echantillonner(pixels, numpy.einsum('mk,mkd->md', poids, uv_source[triangles]))
    if normales:
        n = lus[:, :3] * 2 - 1
        n[:, :2] = numpy.einsum('mij,mj->mi', rotations_tangentes(uv_cible, uv_source)[triangles], n[:, :2])
        n /= numpy.maximum(numpy.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        lus[:, :3] = (n + 1) / 2
    sortie = numpy.zeros_like(pixels)
    couverts = numpy.zeros((hauteur, largeur), dtype=bool)
    sortie[lignes, colonnes] = lus
    couverts[lignes, colonnes] = True
    sortie, couverts = dilater(sortie, couverts, DILATATION)
    sortie[~couverts] = NORMALE_PLATE if normales else (lus.mean(axis=0) if len(lus) else 0)
    return sortie


def cartes_de_normales(materiau):
    """Les nœuds image de `materiau` qui alimentent un nœud de carte de normales."""
    return {n for n in materiau.node_tree.nodes if n.type == 'TEX_IMAGE'
            and any(l.to_node.type == 'NORMAL_MAP' for s in n.outputs for l in s.links)}


def recoucher_le_materiau(bpy, materiau, uv_cible, uv_source):
    """Chaque image des nœuds de `materiau` remplacée par sa recouche (`recoucher`), sous le même nom, empaquetée en
    PNG ; l'image du donneur reste, renommée."""
    normales = cartes_de_normales(materiau)
    for noeud in [n for n in materiau.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]:
        source = noeud.image
        largeur, hauteur = source.size
        if not largeur or not hauteur:
            raise RuntimeError(f'{materiau.name} : image « {source.name} » sans pixels ({source.filepath})')
        pixels = numpy.empty(largeur * hauteur * 4, dtype=numpy.float32)
        source.pixels.foreach_get(pixels)
        recouche = recoucher(pixels.reshape(hauteur, largeur, 4).astype(numpy.float64), uv_cible, uv_source,
                             noeud in normales)
        nom = source.name
        source.name = f'{nom}--donneur'
        image = bpy.data.images.new(nom, largeur, hauteur, alpha=True)
        image.colorspace_settings.name = source.colorspace_settings.name
        image.pixels.foreach_set(recouche.astype(numpy.float32).ravel())
        image.file_format = 'PNG'
        image.pack()
        noeud.image = image
        print('RECOUCHE', materiau.name, nom, f'{largeur}x{hauteur}', 'normales' if noeud in normales else '', flush=True)


def recoucher_les_variantes(bpy, squelette, peaux, squelette_donneur, donneurs, surfaces):
    """Par surface de la déclaration `surfaces` qui nomme un matériau par sexe (`parSexe`), chacun recouché des peaux
    `donneurs` (skinnées à `squelette_donneur`) sur les faces de la surface des `peaux` (skinnées à `squelette`) :
    rend {nom de la surface : {sexe : matériau}}. Un matériau absent des donneurs, ou une surface absente des peaux,
    arrête la construction."""
    noms = [b.name for b in squelette.data.bones]
    voisinage = voisins(squelette, noms)
    variantes = {}
    for surface in surfaces:
        for sexe, nom in surface.get('parSexe', {}).items():
            materiau = bpy.data.materials.get(nom)
            donneur = next((d for d in donneurs if porte(d, materiau)), None)
            if donneur is None:
                raise RuntimeError(f'surface « {surface["nom"]} », sexe {sexe} : aucun donneur ne porte le matériau « {nom} »')
            ramenee, faces, os_des_faces = surface_ramenee(squelette, squelette_donneur, donneur, noms)
            garde, faces_uv, uv_des_faces = triangles_uv(donneur, materiau)
            if not numpy.array_equal(faces_uv, faces[garde]):
                raise RuntimeError(f'{donneur.name} : triangles UV et triangles de la surface différents')
            faces, os_des_faces = faces[garde], os_des_faces[garde]
            cible = bpy.data.materials.get(surface['nom'])
            coins, uv_cible = [], []
            for peau in [p for p in peaux if porte(p, cible)]:
                x, w = peau_lineaire(peau, noms)
                _, sommets, uv = triangles_uv(peau, cible)
                coins.append((x[:, :3][sommets], w[sommets].sum(axis=1).argmax(axis=1)))
                uv_cible.append(uv)
            if not coins:
                raise RuntimeError(f'surface « {surface["nom"]} » : aucune peau ne porte ce matériau')
            positions = numpy.concatenate([c for c, _ in coins]).astype(numpy.float64)
            os_des_centres = numpy.concatenate([o for _, o in coins])
            lies, _, distances = lier(positions.mean(axis=1), os_des_centres, ramenee, faces, os_des_faces, voisinage)
            print('RECOUCHE liaison', surface['nom'], '->', nom, 'triangles', len(lies), 'distances',
                  numpy.percentile(distances, [50, 90, 99, 100]).round(4).tolist(), flush=True)
            recoucher_le_materiau(bpy, materiau, numpy.concatenate(uv_cible),
                                  uv_lus(lies, positions, ramenee, faces, uv_des_faces))
            materiau.use_fake_user = True
            variantes.setdefault(surface['nom'], {})[sexe] = materiau
    return variantes


def declarer_les_variantes(bpy, objets, variantes):
    """Chaque matériau de `variantes` ({nom d'un matériau : {variante : matériau}}) déclaré variante
    `KHR_materials_variants` de chaque emplacement de matériau des `objets` qui porte le matériau nommé."""
    bpy.context.preferences.addons['io_scene_gltf2'].preferences.KHR_materials_variants_ui = True
    liste = bpy.data.scenes[0].gltf2_KHR_materials_variants_variants
    index = {}
    for nom in sorted({v for par in variantes.values() for v in par}):
        entree = liste.add()
        entree.name, entree.variant_idx = nom, len(liste) - 1
        index[nom] = entree.variant_idx
    for objet in objets:
        for rang, slot in enumerate(objet.material_slots):
            for variante, materiau in sorted(variantes.get(slot.material.name if slot.material else None, {}).items()):
                donnee = objet.data.gltf2_variant_mesh_data.add()
                donnee.material_slot_index, donnee.material = rang, materiau
                donnee.variants.add().variant.variant_idx = index[variante]
