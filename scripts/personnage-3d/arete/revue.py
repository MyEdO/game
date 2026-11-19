"""Revue d'un kit d'arêtes (#4471) : chaque pièce de son GLB (un nœud racine par pièce), habillée comme le jeu
l'habille (`rendu.habiller_le_modele`, projeté), teinte de la palette que le jeu donne aux arêtes d'une apparence de
`src/data/structureAppearance.json` (`palette_du_jeu`), rendue seule dans le studio de `rendu.py`, de face, de
trois-quarts et de dessus (`rendu.vues_de_revue`), au cadrage du kit entier. `planche.png` range une ligne par
pièce, dans l'ordre du GLB. Le GLB et son manifeste se cherchent par id dans chaque dossier de `--modeles`
(`rendu.trouver`).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/arete/revue.py <kit> --apparence <id> \\
        --modeles <dossier> --sortie <dossier neuf>
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))

import habillage  # noqa: E402
import rendu  # noqa: E402

PALETTE_DU_JEU = (
    "import { paletteDeLApparence } from './src/noyau/monde/aretes.ts';"
    "import { structureAppearance } from './src/noyau/monde/volume/structures.ts';"
    "console.log(JSON.stringify(paletteDeLApparence(structureAppearance(process.env.APPARENCE))));"
)
"""Le module qui écrit la palette du jeu de l'apparence `APPARENCE` (`paletteDeLApparence`)."""


def palette_du_jeu(apparence):
    """Par emplacement, la couleur linéaire que le jeu donne aux arêtes de l'apparence d'id `apparence`
    (`paletteDeLApparence`, `src/noyau/monde/aretes.ts`, joué par le `tsx` de l'arbre)."""
    lanceur = [shutil.which("node"), str(habillage.DEPOT / "scripts" / "lancer-local.mjs"), "tsx", "--", "tsx"]
    lu = subprocess.run([*lanceur, "-e", PALETTE_DU_JEU], cwd=habillage.DEPOT, capture_output=True, text=True,
                        env={**os.environ, "APPARENCE": apparence})
    if lu.returncode != 0:
        raise RuntimeError(f"palette de l'apparence {apparence} : tsx rend {lu.returncode}\n{lu.stderr}")
    return {e: habillage.couleur_lineaire(c) for e, c in json.loads(lu.stdout).items()}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("kit")
    p.add_argument("--apparence", required=True)
    p.add_argument("--modeles", action="append", required=True, type=Path)
    p.add_argument("--sortie", required=True, type=Path)
    args = p.parse_args()
    sortie = args.sortie.resolve()
    if sortie.exists() and any(sortie.iterdir()):
        raise ValueError(f"{sortie} : dossier de sortie neuf ou vide attendu")
    sortie.mkdir(parents=True, exist_ok=True)
    apparences = json.loads((habillage.DEPOT / "src" / "data" / "structureAppearance.json").read_text(encoding="utf-8"))
    if not any(a["id"] == args.apparence and a.get("kit") == args.kit for a in apparences):
        raise ValueError(f"apparence {args.apparence} : absente de structureAppearance.json pour le kit {args.kit}")
    palette = palette_du_jeu(args.apparence)
    import bpy
    debut = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    glb, manifeste = rendu.trouver([d.resolve() for d in args.modeles], f"arete--{args.kit}")
    pieces = [o for o in rendu.importer(bpy, glb) if o.type == "MESH"]
    rendu.colorer(pieces, {s["nom"]: s["palette"] for s in manifeste["surfaces"]}, palette)
    rendu.habiller_le_modele(bpy, pieces, manifeste, None, False, palette)
    bas, hautes = rendu.bornes(bpy, pieces)
    etendue = max(hautes.x - bas.x, hautes.y - bas.y, hautes.z - bas.z)
    rendre = rendu.studio(bpy, bas, (bas + hautes) / 2, etendue, sortie, debut)
    lignes = []
    for piece in pieces:
        for o in pieces:
            o.hide_render = o is not piece
        lignes.append(rendu.vues_de_revue(rendre, sortie, piece.name, (bas + hautes) / 2, hautes - bas, etendue))
    rendu.grille(bpy, lignes, sortie / "planche.png")
    print("PLANCHE", sortie / "planche.png", flush=True)


if __name__ == "__main__":
    main()
