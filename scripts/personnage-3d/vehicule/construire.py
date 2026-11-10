"""Construction d'un véhicule ou d'un engin et de ses éléments (#2987) : lit `vehicule/<modele>/donnees.py`, bâtit chaque
élément que déclare `elements(D)` de `vehicule/<modele>/modele.py`, l'exporte en GLB et écrit, pour chaque clé de
l'élément, son dossier de production `<sortie>/<id>/` :

- `<id>.glb` et `<id>.element.json`, le manifeste schéma 3 que valide `npm run godot:valider -- <element.json> <glb>` ;
- `manifest.json` et `LICENSE-CC0-1.0.txt`, l'enveloppe que lit `node hotes/godot/importer.mjs <sortie>/<id> <id>`.

L'id est `<categorie>--<valeur de la clé>` (`vehicule--caraque`, `amelioration--sabord`). Un élément est un dict :
`glb` (nom de la scène), `cles` [(categorie, cle)], `materiaux` (table `{nom: (emplacement, matière)}`, `habillage.py`),
`blasons` (matériaux qui reçoivent l'emblème, exportés avec leurs UV), `construire` (bâtit la scène vide, rend les
champs du manifeste propres à l'élément : `postes`, `selon`, `ancrages`, `montage`, `clips` (`clips.py`)).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/vehicule/construire.py <modele> --sortie <dossier neuf hors du dépôt>
"""
import argparse
import importlib
import runpy
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI), str(ICI.parent)]

import bpy  # noqa: E402
import habillage  # noqa: E402
from production import MODELES, dossier_de_sortie, ecrire_le_dossier  # noqa: E402

LICENCES = {"LICENSE-CC0-1.0.txt": MODELES / "LICENSE-CC0-1.0-f6089cba01cb570a.txt"}


def identifiant(categorie, cle):
    return f"{categorie}--{next(iter(cle.values()))}"


def exporter(chemin, avec_uv):
    bpy.ops.export_scene.gltf(
        filepath=str(chemin), export_format="GLB", export_yup=True, export_apply=True, export_animations=True,
        export_animation_mode="NLA_TRACKS", export_optimize_animation_keep_anim_object=True,
        export_skins=False, export_morph=False, export_texcoords=avec_uv, export_normals=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False, export_extras=False, use_selection=False,
    )
    return chemin.read_bytes()


def produire(element, sortie):
    """Bâtit `element`, l'exporte et écrit le dossier de production de chacune de ses clés ; rend leurs ids."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    champs = element["construire"]()
    ids = [identifiant(categorie, cle) for categorie, cle in element["cles"]]
    temporaire = sortie / f"{element['glb']}.glb"
    octets = exporter(temporaire, bool(element["blasons"]))
    utilises = {m.name for o in bpy.data.objects if o.type == "MESH" for m in o.data.materials}
    for id_, (categorie, cle) in zip(ids, element["cles"]):
        manifeste = {"schema": 3, "categorie": categorie, "cle": cle, "liaison": {"mode": "rigide"}, **champs,
                     "surfaces": habillage.surfaces(utilises, element["materiaux"], element["blasons"])}
        empreinte = ecrire_le_dossier(sortie / id_, id_, octets, manifeste, LICENCES)["glb"]["sha256"]
    temporaire.unlink()
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    print("GLB", element["glb"], len(octets), empreinte, "TRIANGLES", sum(len(o.data.polygons) for o in meshes), "->", ", ".join(ids))
    for o in meshes:
        print("  NOEUD", o.name, tuple(round(v, 3) for v in o.location), len(o.data.polygons), [m.name for m in o.data.materials])
    return ids


def main():
    p = argparse.ArgumentParser()
    p.add_argument("modele", choices=sorted(d.parent.name for d in ICI.glob("*/donnees.py")))
    p.add_argument("--sortie", required=True)
    args = p.parse_args()
    D = runpy.run_path(str(ICI / args.modele / "donnees.py"))
    modele = importlib.import_module(f"{args.modele}.modele")
    sortie = dossier_de_sortie(args.sortie)
    for element in modele.elements(D):
        produire(element, sortie)


if __name__ == "__main__":
    main()
