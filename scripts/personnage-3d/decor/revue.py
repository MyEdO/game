"""Revue d'un décor (#4335) : AVANT, les primitives de sa recette (`Gabarit.polygones`), APRÈS, son GLB, chacun habillé
comme le jeu l'habille (`rendu.habiller_le_modele`, projeté : la texture de chaque `matiere` que porte le catalogue
`rendu.CATALOGUE`, la couleur de son matériau sinon), rendus dans le même studio (`rendu.studio`) au même cadrage, celui
du gabarit, élargi à la vue qui le déborde (`rendu.vues_de_revue`) : de face, de trois-quarts et de dessus.
`planche.png` les range en deux lignes, AVANT au-dessus d'APRÈS.
Un GLB et son manifeste se cherchent par id dans chaque dossier de `--modeles` (`rendu.trouver`). `--saison` (une saison de
`src/data/weather.json`) montre APRÈS comme le jeu en cette saison : ses nœuds `sans-<saison>` cachés, ses nœuds `avec-<autre saison>` aussi, teint de
la palette que son `selon` donne à la saison ; sans elle, le décor tel que bâti, tout nœud `avec-<saison>` caché.

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/decor/revue.py <prop> --modeles <dossier> --sortie <dossier neuf> [--saison <saison>]
"""
import argparse
import json
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path[:0] = [str(ICI), str(ICI.parent)]

import habillage  # noqa: E402
import rendu  # noqa: E402
from gabarit import Gabarit, vers_blender  # noqa: E402


def primitives(bpy, G):
    """Les primitives du gabarit `G`, un objet par primitive, chacun du matériau de sa matière ; et leur manifeste."""
    matieres = habillage.catalogue()
    objets = []
    for i, (p, faces) in enumerate(zip(G.primitives, G.polygones)):
        sommets = [vers_blender(*q) for f in faces for q in f]
        debuts = [sum(len(f) for f in faces[:k]) for k in range(len(faces))]
        mesh = bpy.data.meshes.new(f"primitive-{i}")
        mesh.from_pydata(sommets, [], [list(range(d, d + len(f))) for d, f in zip(debuts, faces)])
        nom = p["material"]
        mat = bpy.data.materials.get(nom) or habillage.materiau_de(nom, matieres[nom])
        mesh.materials.append(mat)
        obj = bpy.data.objects.new(f"primitive-{i}", mesh)
        bpy.context.scene.collection.objects.link(obj)
        objets.append(obj)
    return objets, {"surfaces": [{"nom": m, "palette": None, "matiere": f"prop--{m}"} for m in sorted({p["material"] for p in G.primitives})]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("prop")
    p.add_argument("--modeles", action="append", required=True, type=Path)
    p.add_argument("--sortie", required=True, type=Path)
    p.add_argument("--saison")
    args = p.parse_args()
    sortie = args.sortie.resolve()
    if sortie.exists() and any(sortie.iterdir()):
        raise ValueError(f"{sortie} : dossier de sortie neuf ou vide attendu")
    sortie.mkdir(parents=True, exist_ok=True)
    import bpy
    debut = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    G = Gabarit(args.prop)
    avant, manifeste_avant = primitives(bpy, G)
    glb, manifeste = rendu.trouver([d.resolve() for d in args.modeles], f"decor--{args.prop}")
    selon = manifeste.get("selon", {})
    saisons = [s["id"] for s in json.loads((habillage.DEPOT / "src" / "data" / "weather.json").read_text(encoding="utf-8"))["seasons"]]
    if args.saison is not None and args.saison not in saisons:
        raise ValueError(f"--saison {args.saison} : {saisons} attendue")
    caches = {f"sans-{args.saison}"} | {f"avec-{s}" for s in selon if s != args.saison}
    importes = [o for o in rendu.importer(bpy, glb) if o.type == "MESH"]
    apres = [o for o in importes if o.name not in caches]
    for o in importes:
        o.hide_render = True
    palette = {e: habillage.couleur_lineaire(c) for e, c in selon.get(args.saison, {}).get("palette", {}).items()}
    rendu.habiller_le_modele(bpy, avant, manifeste_avant, None, False, {})
    rendu.habiller_le_modele(bpy, apres, manifeste, None, False, palette)
    bas, hautes = rendu.bornes(bpy, avant)
    etendue = max(hautes.x - bas.x, hautes.y - bas.y, hautes.z - bas.z)
    rendre = rendu.studio(bpy, bas, (bas + hautes) / 2, etendue, sortie, debut)
    lignes = []
    for nom, montres, caches in (("avant", avant, apres), ("apres", apres, avant)):
        for o in montres:
            o.hide_render = False
        for o in caches:
            o.hide_render = True
        lignes.append(rendu.vues_de_revue(rendre, sortie, nom, (bas + hautes) / 2, hautes - bas, etendue))
    rendu.grille(bpy, lignes, sortie / "planche.png")
    print("PLANCHE", sortie / "planche.png", flush=True)


if __name__ == "__main__":
    main()
