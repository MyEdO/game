"""Lecture et écriture d'un conteneur glTF binaire (GLB 2.0) sans Blender : la seule implémentation de la chaîne."""
import json
import struct
from pathlib import Path

MAGIE_GLB = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942
COMPOSANTES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}
LISSE_DEG = 0.5
"""Écart de normales de base sous lequel deux sommets de même position sont une même surface lisse
(`souder_les_normales_des_cibles`) : `anatomie.scinder` pose la normale d'avant la découpe, à l'arrondi du flottant
près."""
TYPES_DE_COMPOSANTE = {5120: '<i1', 5121: '<u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}


def lire_glb(path):
    """Rend (document JSON, octets du chunk BIN ou b'') ; refuse un en-tête faux ou un fichier tronqué."""
    data = Path(path).read_bytes()
    if len(data) < 20:
        raise ValueError('Invalid GLB header or incomplete file')
    magic, version, length = struct.unpack_from('<III', data)
    if magic != MAGIE_GLB or version != 2 or length != len(data):
        raise ValueError('Invalid GLB header or incomplete file')
    json_length, json_type = struct.unpack_from('<II', data, 12)
    if json_type != CHUNK_JSON:
        raise ValueError('First GLB chunk is not JSON')
    document = json.loads(data[20:20 + json_length])
    offset = 20 + json_length
    binary = b''
    if offset + 8 <= len(data):
        bin_length, bin_type = struct.unpack_from('<II', data, offset)
        if bin_type != CHUNK_BIN:
            raise ValueError('Second GLB chunk is not BIN')
        binary = data[offset + 8:offset + 8 + bin_length]
    return document, binary


def ecrire_glb(path, document, binary):
    """Écrit le GLB `path` du document JSON et du chunk BIN `binary`, chacun complété à un multiple de 4 octets ; la
    longueur du premier buffer suit le chunk BIN."""
    binary = bytes(binary) + b'\0' * (-len(binary) % 4)
    if document.get('buffers'):
        document['buffers'][0]['byteLength'] = len(binary)
    texte = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    texte += b' ' * (-len(texte) % 4)
    total = 12 + 8 + len(texte) + 8 + len(binary)
    Path(path).write_bytes(struct.pack('<III', MAGIE_GLB, 2, total) + struct.pack('<II', len(texte), CHUNK_JSON) + texte
                           + struct.pack('<II', len(binary), CHUNK_BIN) + binary)


def souder_les_normales_des_cibles(path):
    """#3380. Réécrit le GLB `path` pour que, sous chaque cible de morph, les sommets d'une même surface portent la
    même normale déformée : les sommets de même position et de même normale de base, d'une primitive à l'autre (les
    pièces de `anatomie.scinder`) comme dans une primitive, reçoivent la moyenne de leurs normales déformées. Les cibles
    se reconnaissent par leur nom (`extras.targetNames` du mesh). Chaque normale de cible réécrite devient un accesseur
    dense à la fin du chunk BIN. Rend le plus grand écart corrigé, en degrés."""
    import numpy as np
    document, binary = lire_glb(path)
    primitives = [(m['extras']['targetNames'], p) for m in document.get('meshes', []) for p in m['primitives']
                  if p.get('targets')]
    if not primitives:
        return 0.0
    bases = [(lire_accesseur(document, binary, p['attributes']['POSITION']),
              lire_accesseur(document, binary, p['attributes']['NORMAL'])) for _, p in primitives]
    normales = np.concatenate([nor for _, nor in bases])
    _, premier, groupe = np.unique(np.round(np.concatenate([pos for pos, _ in bases]) * 1e6).astype(np.int64), axis=0,
                                   return_index=True, return_inverse=True)
    groupe = groupe.ravel()
    lisse = (normales * normales[premier[groupe]]).sum(axis=1) > np.cos(np.radians(LISSE_DEG))
    groupe = np.where(lisse, groupe, len(premier) + np.arange(len(groupe)))
    partage = np.bincount(groupe)[groupe] > 1
    bornes = np.cumsum([0, *[len(pos) for pos, _ in bases]])
    binary = bytearray(binary)
    pire = 0.0
    for nom in sorted({n for noms, _ in primitives for n in noms}):
        portees = [(i, noms.index(nom)) for i, (noms, _) in enumerate(primitives) if nom in noms]
        deformees = np.zeros((len(groupe), 3))
        for i, k in portees:
            normale = bases[i][1] + lire_accesseur(document, binary, primitives[i][1]['targets'][k]['NORMAL'])
            deformees[bornes[i]:bornes[i + 1]] = normale / np.linalg.norm(normale, axis=1, keepdims=True)
        somme = np.zeros((groupe.max() + 1, 3))
        np.add.at(somme, groupe, deformees)
        soudees = somme[groupe] / np.linalg.norm(somme[groupe], axis=1, keepdims=True)
        for i, k in portees:
            tranche = slice(bornes[i], bornes[i + 1])
            if not partage[tranche].any():
                continue
            ecart = np.degrees(np.arccos(np.clip((deformees[tranche] * soudees[tranche]).sum(axis=1), -1, 1)))
            pire = max(pire, float(ecart[partage[tranche]].max()))
            delta = np.where(partage[tranche, None], soudees[tranche], deformees[tranche]) - bases[i][1]
            octets = delta.astype('<f4').tobytes()
            binary += b'\0' * (-len(binary) % 4)
            document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(octets)})
            binary += octets
            document['accessors'].append({'bufferView': len(document['bufferViews']) - 1, 'componentType': 5126,
                                          'count': len(delta), 'type': 'VEC3'})
            primitives[i][1]['targets'][k]['NORMAL'] = len(document['accessors']) - 1
    ecrire_glb(path, document, binary)
    return pire


def lire_accesseur(document, binary, index):
    """Valeurs d'un accesseur en tableau numpy float64 (count, composantes), normalisation glTF appliquée ; un
    accesseur sans bufferView vaut zéro. Refuse un accesseur hors du chunk BIN."""
    import numpy as np
    accessor = document['accessors'][index]
    width = COMPOSANTES[accessor['type']]
    dtype = np.dtype(TYPES_DE_COMPOSANTE[accessor['componentType']])
    count = accessor['count']
    def lire(view_index, byte_offset, nombre, largeur, type_valeur):
        view = document['bufferViews'][view_index]
        if view.get('buffer', 0) != 0:
            raise ValueError(f'Accessor outside the GLB BIN chunk: {index}')
        stride = view.get('byteStride') or largeur * type_valeur.itemsize
        offset = view.get('byteOffset', 0) + byte_offset
        fin = byte_offset + ((nombre - 1) * stride + largeur * type_valeur.itemsize if nombre else 0)
        if byte_offset < 0 or fin > view['byteLength'] or offset + max(0, fin - byte_offset) > len(binary):
            raise ValueError(f'Accessor overruns the BIN chunk: {index}')
        return np.ndarray((nombre, largeur), type_valeur, buffer=binary, offset=offset,
                          strides=(stride, type_valeur.itemsize)).astype(np.float64)

    values = (lire(accessor['bufferView'], accessor.get('byteOffset', 0), count, width, dtype)
              if 'bufferView' in accessor else np.zeros((count, width)))
    if 'sparse' in accessor:
        sparse = accessor['sparse']
        indices = sparse['indices']
        if indices['componentType'] not in (5121, 5123, 5125) or not 0 <= sparse['count'] <= count:
            raise ValueError(f'Invalid sparse accessor: {index}')
        ids = lire(indices['bufferView'], indices.get('byteOffset', 0), sparse['count'], 1,
                   np.dtype(TYPES_DE_COMPOSANTE[indices['componentType']])).ravel().astype(np.int64)
        if (ids >= count).any() or (np.diff(ids) <= 0).any():
            raise ValueError(f'Invalid sparse indices: {index}')
        data = sparse['values']
        values[ids] = lire(data['bufferView'], data.get('byteOffset', 0), sparse['count'], width, dtype)
    if accessor.get('normalized') and dtype.kind in 'iu':
        values = np.maximum(values / np.iinfo(dtype).max, -1.)
    return values


def resume_glb(path):
    """Ce qu'un GLB déclare : taille, peaux, animations, images."""
    document, _ = lire_glb(path)
    return {'bytes': Path(path).stat().st_size, 'skins': len(document.get('skins', [])),
            'skin_joint_counts': [len(skin['joints']) for skin in document.get('skins', [])],
            'animation_names': [action.get('name') for action in document.get('animations', [])],
            'images': [{'name': image.get('name'), 'mimeType': image.get('mimeType'),
                        'embedded': 'bufferView' in image} for image in document.get('images', [])]}
