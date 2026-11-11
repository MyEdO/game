"""Re-pesée d'un élément skinné publié par le champ de peau de la base (#3842, `champ.py`) : ses meshes skinnés
reçoivent les poids et les clés du champ, géométrie intacte, et le GLB s'exporte comme le construit `construire.py`,
sur l'armature de la base, son manifeste d'élément voisin (`<id>.manifeste.json`) copié à côté sous le même nom. Un
élément rigide, sans mesh skinné, est refusé, comme un élément de couche `peau` (tête, pilosité) : il est le corps.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/element/repeser.py <element.glb> \\
        --base <base.glb> --manifeste <base.manifeste.json> --sortie <dossier neuf hors du dépôt>
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI), str(ICI.parent), str(ICI.parent / "base")]

import bpy  # noqa: E402
import numpy as np  # noqa: E402
import tissu  # noqa: E402
from champ import champ_de, re_peser, skinne  # noqa: E402
from construire import exporter  # noqa: E402
from glb import lire_glb  # noqa: E402
from production import dossier_de_sortie  # noqa: E402


def sans_publies(id_):
    raise ValueError(f"{id_} : la re-pesée ne lit aucun élément publié")


def vider_sauf(rig):
    """Retire de la scène tout sauf `rig`, et les maillages, matériaux et images de la base : les noms de l'élément
    importé ensuite restent les siens."""
    for objet in [o for o in bpy.data.objects if o is not rig]:
        bpy.data.objects.remove(objet, do_unlink=True)
    for donnees in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for bloc in list(donnees):
            donnees.remove(bloc)


def figer_les_normales(objet):
    """Pose à chaque coin de `objet` la normale moyenne de son sommet, en normales libres (attribut de coin
    `custom_normal`) : un sommet glTF importé porte une seule normale, que l'import redécode par coin à quelques 1e-4
    d'écart, refusés par `construire.verifier_les_normales` (#3865)."""
    me = objet.data
    normales = np.empty(len(me.loops) * 3, dtype=np.float32)
    me.corner_normals.foreach_get("vector", normales)
    sommets = np.empty(len(me.loops), dtype=np.int64)
    me.loops.foreach_get("vertex_index", sommets)
    moyenne = np.zeros((len(me.vertices), 3))
    np.add.at(moyenne, sommets, normales.reshape(-1, 3))
    moyenne /= np.linalg.norm(moyenne, axis=1, keepdims=True)
    if "custom_normal" in me.attributes:
        me.attributes.remove(me.attributes["custom_normal"])
    me.attributes.new("custom_normal", "FLOAT_VECTOR", "CORNER").data.foreach_set(
        "vector", moyenne[sommets].astype(np.float32).ravel())


def rendre_les_primitives(objets, doc):
    """Rend à chaque objet de `objets` un emplacement de matériau par primitive de son mesh glTF dans `doc` : l'import
    fond en un seul emplacement les primitives d'un même matériau (les deux nappes et le bord d'une double nappe,
    `tissu.double_nappe`), que l'export rendrait en une seule primitive. Les faces importées suivent l'ordre des
    primitives."""
    par_noeud = {n["name"]: doc["meshes"][n["mesh"]]["primitives"] for n in doc["nodes"] if "mesh" in n}
    for objet in objets:
        primitives = par_noeud[objet.name]
        me = objet.data
        if len(primitives) == len(me.materials):
            continue
        faces = [doc["accessors"][p["indices"]]["count"] // 3 for p in primitives]
        if sum(faces) != len(me.polygons):
            raise ValueError(f"{objet.name} : {len(me.polygons)} faces importées, {sum(faces)} dans ses primitives")
        indices = np.empty(len(me.polygons), dtype=np.int64)
        me.polygons.foreach_get("material_index", indices)
        debuts = np.cumsum([0] + faces[:-1])
        materiaux = [me.materials[int(indices[d])] for d in debuts]
        attendus = [doc["materials"][p["material"]]["name"] for p in primitives]
        if [m.name for m in materiaux] != attendus:
            raise ValueError(f"{objet.name} : matériaux {[m.name for m in materiaux]}, primitives {attendus}")
        me.materials.clear()
        for materiau in materiaux:
            me.materials.append(materiau)
        me.polygons.foreach_set("material_index", np.repeat(np.arange(len(primitives)), faces).astype(np.int32))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("element", type=Path)
    p.add_argument("--base", required=True, type=Path)
    p.add_argument("--manifeste", required=True, type=Path)
    p.add_argument("--sortie", required=True)
    args = p.parse_args()
    voisin = args.element.with_name(args.element.name.removesuffix(".glb") + ".manifeste.json")
    if not voisin.exists():
        raise SystemExit(f"{voisin} : manifeste d'élément voisin absent")
    if json.loads(voisin.read_text(encoding="utf-8")).get("couche") == "peau":
        raise SystemExit(f"{args.element} : élément de couche peau, il est le corps, rien à re-peser")
    base = tissu.Base(args.base, json.loads(args.manifeste.read_text(encoding="utf-8")), sans_publies)
    champ = champ_de(base)
    vider_sauf(base.rig)
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(args.element))
    nouveaux = [o for o in bpy.data.objects if o not in avant]
    pieces = [o for o in nouveaux if skinne(o)]
    if not pieces:
        raise SystemExit(f"{args.element} : élément rigide, aucun mesh skinné à re-peser")
    re_peser(pieces, champ)
    rendre_les_primitives(pieces, lire_glb(args.element)[0])
    for piece in pieces:
        figer_les_normales(piece)
        monde = piece.matrix_world.copy()
        piece.parent = base.rig
        piece.matrix_world = monde
        for m in piece.modifiers:
            if m.type == "ARMATURE":
                m.object = base.rig
    for objet in [o for o in nouveaux if o not in pieces]:
        bpy.data.objects.remove(objet, do_unlink=True)
    sortie = dossier_de_sortie(args.sortie)
    octets = exporter(sortie / args.element.name, base.rig, pieces, skinne=True)
    shutil.copyfile(voisin, sortie / voisin.name)
    print("GLB", sortie / args.element.name, len(octets), "MESHES", len(pieces))


if __name__ == "__main__":
    main()
