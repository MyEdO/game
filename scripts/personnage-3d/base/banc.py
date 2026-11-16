"""Banc de la pose des bras de la base humanoïde (#3810, #4318) : la base publiée importée dans bpy, les clips demandés
rejoués avec le code de l'arbre, puis les rotations des os des bras, des clavicules et du dos de ces clips réécrites en
place dans une copie du GLB, aux instants de ses clés, sans réexport Blender. La copie reçoit à côté d'elle le manifeste
de la base à son empreinte ; la mesure reste celle de l'évaluateur, dont l'outil imprime la commande.

- `--pack <clip,…|tous>` : `membres.ecarter_les_membres` sur ces clips du pack (`tous` : les clips de la base hors
  `deux_mains.CLIPS`) ;
- `--deux-mains <clip,…>` : ces clips de `deux_mains.CLIPS`, retirés de la scène puis dérivés (`deux_mains.deriver`).
Les deux options ensemble jouent la passe du pack d'abord, comme la construction (`humanoide.py`).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/base/banc.py <base.glb> <base.manifeste.json> \\
        --sortie <dossier neuf hors du dépôt> [--pack <clip,…|tous>] [--deux-mains <clip,…>]
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bpy  # noqa: E402
import numpy  # noqa: E402

import deux_mains  # noqa: E402
import membres  # noqa: E402
from anatomie import reperes_des_prises  # noqa: E402
from animation import assign_action  # noqa: E402
from glb import ecrire_glb, lire_accesseur, lire_glb  # noqa: E402
from pistes import aller_a  # noqa: E402
from poids import cadence  # noqa: E402
from portage import OS_DES_SILHOUETTES, ecrire_os_des_silhouettes  # noqa: E402
from production import dossier_de_sortie, ecrire_json  # noqa: E402
from seuils import IMAGES_PAR_SECONDE  # noqa: E402
from tronc import BRAS  # noqa: E402

OS_REECRITS = (*(n for os in BRAS.values() for n in os), *deux_mains.CLAVICULES, *deux_mains.DOS)
"""Les os dont les rotations se réécrivent : ceux que posent `deux_mains.deriver` et `membres.ecarter_les_membres`."""
SAMPLER_LINEAIRE = 'LINEAR'
FLOTTANT = 5126


def empreinte(octets):
    return {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)}


def charger(glb, manifeste):
    """Importe `glb` dans une scène vide à `IMAGES_PAR_SECONDE`, réglée avant l'import, qui convertit les secondes des
    clés à la cadence courante ; pose sur l'armature la table `gabarit.osDesSilhouettes` de `manifeste`. Refuse un
    manifeste d'une autre empreinte que `glb` et une scène à plus d'une armature. Rend l'armature."""
    if manifeste['glb'] != empreinte(Path(glb).read_bytes()):
        raise ValueError(f'{glb} : empreinte différente de celle du manifeste {manifeste["glb"]}')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = IMAGES_PAR_SECONDE, 1.0
    bpy.ops.import_scene.gltf(filepath=str(glb))
    rigs = [o for o in scene.objects if o.type == 'ARMATURE']
    if len(rigs) != 1:
        raise ValueError(f'{glb} : {len(rigs)} armature(s), une attendue')
    ecrire_os_des_silhouettes(rigs[0], manifeste['gabarit'][OS_DES_SILHOUETTES])
    return rigs[0]


def rejouer_le_pack(rig, clips):
    """`membres.ecarter_les_membres` sur les actions `clips` du rig `rig` ; `tous` : celles hors de `deux_mains.CLIPS`.
    Rend les noms rejoués."""
    noms = sorted(a.name for a in bpy.data.actions if a.name not in deux_mains.CLIPS) if clips == ['tous'] else clips
    membres.ecarter_les_membres(bpy, rig, [bpy.data.actions[n] for n in noms])
    return noms


def deriver_a_deux_mains(rig, clips):
    """Les clips `clips` de `deux_mains.CLIPS` retirés des actions puis dérivés sur `rig` par `deux_mains.deriver`, les
    autres clips à deux mains laissés tels qu'importés. Rend les noms dérivés."""
    inconnus = [n for n in clips if n not in deux_mains.CLIPS]
    if inconnus:
        raise ValueError(f'{", ".join(inconnus)} : hors de deux_mains.CLIPS')
    for nom in clips:
        bpy.data.actions.remove(bpy.data.actions[nom])
    tous = deux_mains.CLIPS
    deux_mains.CLIPS = {n: tous[n] for n in clips}
    try:
        derivees = [a.name for a in deux_mains.deriver(bpy, rig, reperes_des_prises(rig))]
    finally:
        deux_mains.CLIPS = tous
    if derivees != clips:
        raise ValueError(f'actions dérivées {derivees}, {clips} attendues')
    return derivees


def rotation_locale(rig, os):
    """La rotation glTF (x, y, z, w) du nœud de l'os `os` à la pose courante, `parent.matrix⁻¹ @ os.matrix` : l'import
    garde les axes locaux des os."""
    pose = rig.pose.bones[os]
    q = (pose.parent.matrix.inverted() @ pose.matrix).decompose()[1]
    return numpy.array([q.x, q.y, q.z, q.w])


def ecrire(glb_source, glb_sortie, rig, clips, os):
    """Écrit `glb_sortie`, copie de `glb_source` où les sorties des samplers `rotation` des os `os` dans les animations
    `clips` sont réécrites en place depuis l'action de même nom du rig `rig`, évaluée à chaque instant d'entrée du
    sampler. Refuse : clip absent du GLB, os sans piste de rotation, sampler non linéaire, sortie qui n'est pas un VEC4
    float32 dense, accesseur de sortie partagé. Rend, par clip et par os, l'écart max aux quaternions d'origine, au
    signe près."""
    document, binaire = lire_glb(glb_source)
    binaire = bytearray(binaire)
    noeuds = {document['nodes'][j]['name']: j for peau in document['skins'] for j in peau['joints']}
    animations = {a['name']: a for a in document['animations']}
    usages = {}
    for a in document['animations']:
        for i, s in enumerate(a['samplers']):
            usages.setdefault(s['output'], []).append((a['name'], i))
    ecarts = {}
    for clip in clips:
        if clip not in animations:
            raise ValueError(f'{clip} : animation absente de {glb_source}')
        animation = animations[clip]
        samplers = {c['target']['node']: c['sampler'] for c in animation['channels'] if c['target']['path'] == 'rotation'}
        assign_action(rig, bpy.data.actions[clip])
        ecarts[clip] = {}
        for nom in os:
            if noeuds.get(nom) not in samplers:
                raise ValueError(f'{clip} : os « {nom} » sans piste de rotation')
            indice = samplers[noeuds[nom]]
            sampler = animation['samplers'][indice]
            if sampler.get('interpolation', SAMPLER_LINEAIRE) != SAMPLER_LINEAIRE:
                raise ValueError(f'{clip} {nom} : interpolation {sampler["interpolation"]}, {SAMPLER_LINEAIRE} attendue')
            accesseur = document['accessors'][sampler['output']]
            if (accesseur['componentType'], accesseur['type']) != (FLOTTANT, 'VEC4') or 'sparse' in accesseur or 'bufferView' not in accesseur:
                raise ValueError(f'{clip} {nom} : sortie de rotation qui n\'est pas un VEC4 float32 dense')
            if usages[sampler['output']] != [(clip, indice)]:
                raise ValueError(f'{clip} {nom} : accesseur de sortie partagé {usages[sampler["output"]]}')
            origine = lire_accesseur(document, binaire, sampler['output'])
            q = []
            for t in lire_accesseur(document, binaire, sampler['input'])[:, 0]:
                aller_a(bpy.context.scene, float(t) * cadence())
                q.append(rotation_locale(rig, nom))
            q = numpy.array(q)
            for i in range(len(q)):
                if q[i] @ (origine[0] if i == 0 else q[i - 1]) < 0:
                    q[i] = -q[i]
            ecarts[clip][nom] = float(numpy.abs(q - origine).max())
            vue = document['bufferViews'][accesseur['bufferView']]
            pas = vue.get('byteStride') or 16
            depart = vue.get('byteOffset', 0) + accesseur.get('byteOffset', 0)
            for i, valeur in enumerate(q.astype('<f4')):
                binaire[depart + i * pas:depart + i * pas + 16] = valeur.tobytes()
    ecrire_glb(glb_sortie, document, binaire)
    return ecarts


def ecrire_le_manifeste(manifeste, glb, chemin):
    """Écrit sous `chemin` le manifeste `manifeste` à l'empreinte de `glb`, sans laquelle l'évaluateur le refuse."""
    ecrire_json(chemin, {**manifeste, 'glb': empreinte(Path(glb).read_bytes())})


def principal():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('glb', type=Path)
    p.add_argument('manifeste', type=Path)
    p.add_argument('--sortie', required=True, help='dossier neuf ou vide, hors du dépôt')
    p.add_argument('--pack', type=lambda v: v.split(','), default=[], help='clips du pack, ou « tous »')
    p.add_argument('--deux-mains', type=lambda v: v.split(','), default=[], help='clips de deux_mains.CLIPS')
    args = p.parse_args()
    if not args.pack and not args.deux_mains:
        p.error('--pack ou --deux-mains requis')
    sortie = dossier_de_sortie(args.sortie)
    manifeste = json.loads(args.manifeste.read_text(encoding='utf-8'))
    rig = charger(args.glb, manifeste)
    clips = (rejouer_le_pack(rig, args.pack) if args.pack else []) + (deriver_a_deux_mains(rig, args.deux_mains) if args.deux_mains else [])
    glb = sortie / f'{manifeste["base"]}.glb'
    for clip, par_os in ecrire(args.glb, glb, rig, clips, OS_REECRITS).items():
        print('PISTES', clip, ' '.join(f'{n}={e:.2e}' for n, e in par_os.items()), flush=True)
    chemin = sortie / f'{manifeste["base"]}.manifeste.json'
    ecrire_le_manifeste(manifeste, glb, chemin)
    print('ECRIT', glb, empreinte(glb.read_bytes())['sha256'], chemin)
    print('MESURE', 'npm run godot:evaluer --', glb, '--manifeste', chemin, '--clips', ','.join(clips))


if __name__ == '__main__':
    principal()
