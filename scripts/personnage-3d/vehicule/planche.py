"""Revue d'un véhicule sans ponts (#4471), engin de siège ou coque terrestre : son GLB habillé comme le jeu l'habille
(`rendu.habiller_le_modele`, projeté), sans palette, de la texture de chaque `matiere` que porte le catalogue
`rendu.CATALOGUE`, au repos de ses clips, rendu dans le studio de `rendu.py` (`rendu.vues_de_revue`) tourné d'un quart
de tour, son flanc à la caméra : de profil, de trois-quarts et de dessus. `planche.png` range ces trois vues ; avec
`--avant`, le même véhicule cherché dans ce dossier (le GLB publié, une construction d'avant la retouche) au-dessus, au
même cadrage, AVANT au-dessus d'APRÈS. Un GLB et son manifeste se cherchent par id dans chaque dossier (`rendu.trouver`).
Un navire à ponts se regarde par `revue.py` et `cote_a_cote.py`.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/vehicule/planche.py <definition> \\
        --modeles <dossier> --sortie <dossier neuf> [--avant <dossier>]
"""
import argparse
import math
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))

import bpy  # noqa: E402

import rendu  # noqa: E402


def charger(dossier, id_):
    """Les meshes du véhicule `id_` de `dossier`, habillés, tournés d'un quart de tour autour de la verticale."""
    glb, manifeste = rendu.trouver([dossier.resolve()], id_)
    importes = rendu.importer(bpy, glb)
    pivot = bpy.data.objects.new(f"pivot-{len(bpy.data.objects)}", None)
    bpy.context.scene.collection.objects.link(pivot)
    for o in importes:
        if o.parent is None:
            o.parent = pivot
    pivot.rotation_euler = (0.0, 0.0, math.pi / 2)
    meshes = [o for o in importes if o.type == "MESH"]
    rendu.habiller_le_modele(bpy, meshes, manifeste, None, False, {})
    return meshes


def main():
    p = argparse.ArgumentParser()
    p.add_argument("definition")
    p.add_argument("--modeles", required=True, type=Path)
    p.add_argument("--sortie", required=True, type=Path)
    p.add_argument("--avant", type=Path)
    args = p.parse_args()
    sortie = args.sortie.resolve()
    if sortie.exists() and any(sortie.iterdir()):
        raise ValueError(f"{sortie} : dossier de sortie neuf ou vide attendu")
    sortie.mkdir(parents=True, exist_ok=True)
    debut = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    id_ = f"vehicule--{args.definition}"
    etats = [(nom, charger(dossier, id_)) for nom, dossier in (("avant", args.avant), ("apres", args.modeles)) if dossier]
    bas, hautes = rendu.bornes(bpy, [o for _, meshes in etats for o in meshes])
    etendue = max(hautes - bas)
    rendre = rendu.studio(bpy, bas, (bas + hautes) / 2, etendue, sortie, debut)
    lignes = []
    for nom, meshes in etats:
        for _, autres in etats:
            for o in autres:
                o.hide_render = autres is not meshes
        lignes.append(rendu.vues_de_revue(rendre, sortie, nom, (bas + hautes) / 2, hautes - bas, etendue))
    rendu.grille(bpy, lignes, sortie / "planche.png")
    print("PLANCHE", sortie / "planche.png", flush=True)


if __name__ == "__main__":
    main()
