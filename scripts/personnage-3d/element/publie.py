"""Élément skinné repris de son GLB publié (#3761), pour le `modele.py` d'un élément dont l'atelier d'origine est perdu :
sa pièce suit la base courante (#4002) sans être rebâtie.

Du GLB publié, la reprise garde tout ce qui n'appartient pas à la base : positions au repos, triangles, poids de peau,
normales, découpe en meshes (noms, `extras.zone` présent ou absent), matériaux de chaque primitive dans leur ordre, et
chaque clé de forme qui n'est ni une silhouette déclarée par la base ni une clé `gabarit_*`. De la base courante, elle
reprend ces silhouettes et ces clés `gabarit_*`, transférées (`Base.transferer`) sur la pièce jointe depuis les zones les
plus proches de ses faces ; les anciennes clés de ces noms sont jetées avant. Chaque sommet est son propre jumeau
(`tissu.JUMEAU`).
"""
import bpy
import numpy as np

import tissu
from formes import decalages, poser_la_cle
from glb import lire_accesseur, lire_glb

PRIMITIVE = 'primitive_publiee'
"""Attribut de face : l'indice, parmi les primitives de tous les meshes du GLB publié, de celle qui porte la face."""


def poser_les_normales(objet, normales):
    """Pose sur `objet`, importé d'un GLB dont il garde l'ordre des sommets, les normales `normales` de ses sommets
    (repère glTF Y-haut) en normales libres (attribut de coin `custom_normal`) : l'import les encode dans les espaces de
    normale de Blender, qui les redécodent à quelques 1e-5 près, assez pour que deux coins d'un même sommet ne fusionnent
    plus à l'export au même arrondi (#3865)."""
    me = objet.data
    if len(normales) != len(me.vertices):
        raise ValueError(f'{objet.name} : {len(me.vertices)} sommets importés, {len(normales)} normales publiées')
    coins = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get('vertex_index', coins)
    blender = np.column_stack([normales[:, 0], -normales[:, 2], normales[:, 1]])[coins].astype(np.float32)
    me.attributes.remove(me.attributes['custom_normal'])
    me.attributes.new('custom_normal', 'FLOAT_VECTOR', 'CORNER').data.foreach_set('vector', blender.ravel())


def reprendre(materiaux, base, glb):
    """Les objets de l'élément publié `glb` sur la base au repos `base` (`tissu.Base`), habillés de `materiaux` (par nom,
    `habillage.materiaux`), leurs clés de base transférées."""
    doc, binaire = lire_glb(glb)
    noeuds = [n for n in doc['nodes'] if 'mesh' in n]
    primitives = [(j, doc['materials'][p['material']]['name'].split('.')[0], doc['accessors'][p['indices']]['count'] // 3)
                  for j, n in enumerate(noeuds) for p in doc['meshes'][n['mesh']]['primitives']]
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    nouveaux = [o for o in bpy.data.objects if o not in avant]
    par_nom = {o.name: o for o in nouveaux if o.type == 'MESH'}
    absents = [n['name'] for n in noeuds if n['name'] not in par_nom]
    if absents:
        raise ValueError(f'{glb} : meshes {absents} absents de l\'import')
    pieces = [par_nom[n['name']] for n in noeuds]
    for j, o in enumerate(pieces):
        siennes = [g for g, (k, _, _) in enumerate(primitives) if k == j]
        faces = np.repeat(siennes, [primitives[g][2] for g in siennes])
        noms = [m.name.split('.')[0] for m in o.data.materials]
        if len(faces) != len(o.data.polygons) or any(noms[p.material_index] != primitives[g][1] for p, g in zip(o.data.polygons, faces)):
            raise ValueError(f'{o.name} : faces importées hors de l\'ordre des primitives de {glb}')
        o.data.attributes.new(PRIMITIVE, 'INT', 'FACE').data.foreach_set('value', faces.tolist())
        poser_les_normales(o, np.concatenate([lire_accesseur(doc, binaire, p['attributes']['NORMAL'])
                                              for p in doc['meshes'][noeuds[j]['mesh']]['primitives']]))
        monde = o.matrix_world.copy()
        o.parent = base.rig
        o.matrix_world = monde
        for m in o.modifiers:
            if m.type == 'ARMATURE':
                m.object = base.rig
    for o in nouveaux:
        if o not in pieces:
            bpy.data.objects.remove(o, do_unlink=True)
    jointes = [o.data for o in pieces[1:]]
    piece = tissu.joindre(pieces)
    for donnee in jointes:
        bpy.data.meshes.remove(donnee)
    de_base = set(base.manifeste['silhouettes'])
    blocs = list(piece.data.shape_keys.key_blocks)[1:]
    propres = {k.name: decalages(piece, k.name) for k in blocs if k.name not in de_base and not k.name.startswith('gabarit_')}
    for k in blocs:
        piece.shape_key_remove(k)
    piece.data.attributes.new(tissu.JUMEAU, 'INT', 'POINT')
    base.transferer(piece, sorted(set(base.zones_des_faces(piece))))
    for nom, champ in propres.items():
        poser_la_cle(piece, nom, champ)
    faces = np.empty(len(piece.data.polygons), dtype=np.int64)
    piece.data.attributes[PRIMITIVE].data.foreach_get('value', faces)
    objets = []
    for j, o in tissu.decouper(piece, [primitives[g][0] for g in faces]):
        noeud = noeuds[j]
        o.name = noeud['name']
        o.data.name = doc['meshes'][noeud['mesh']]['name']
        if 'zone' in o:
            del o['zone']
        if 'zone' in noeud.get('extras', {}):
            o['zone'] = noeud['extras']['zone']
        siennes = [g for g, (k, _, _) in enumerate(primitives) if k == j]
        o.data.materials.clear()
        for g in siennes:
            o.data.materials.append(materiaux[primitives[g][1]])
        attribut = o.data.attributes[PRIMITIVE]
        locales = np.empty(len(o.data.polygons), dtype=np.int64)
        attribut.data.foreach_get('value', locales)
        o.data.polygons.foreach_set('material_index', [siennes.index(g) for g in locales])
        o.data.attributes.remove(attribut)
        objets.append(o)
    return objets
