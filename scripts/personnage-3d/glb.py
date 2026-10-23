"""Lecture d'un conteneur glTF binaire (GLB 2.0) sans Blender : la seule implémentation de la chaîne."""
import json
import struct
from pathlib import Path

MAGIE_GLB = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


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


def resume_glb(path):
    """Ce qu'un GLB déclare : taille, peaux, animations, images."""
    document, _ = lire_glb(path)
    return {'bytes': Path(path).stat().st_size, 'skins': len(document.get('skins', [])),
            'skin_joint_counts': [len(skin['joints']) for skin in document.get('skins', [])],
            'animation_names': [action.get('name') for action in document.get('animations', [])],
            'images': [{'name': image.get('name'), 'mimeType': image.get('mimeType'),
                        'embedded': 'bufferView' in image} for image in document.get('images', [])]}
