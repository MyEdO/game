"""Revue d'un kit d'escalier (#4471) : chaque pièce de son GLB (un nœud racine par pièce), habillée comme le jeu
l'habille (`rendu.habiller_le_modele`, projeté), sans palette, de la texture de sa matière, rendue seule et à plat dans
le studio de `rendu.py`, de face, de trois-quarts et de dessus (`rendu.vues_de_revue`), au cadrage du kit entier.
`planche.png` range une ligne par pièce, dans l'ordre du GLB, puis la ligne `volee` : deux cases bout à bout, toutes
leurs pièces posées, chaque case cisaillée à sa pente (`PENTES`), la hauteur selon l'abscisse comme l'hôte la
cisaille, pour voir leur raccord. Le GLB et son manifeste se cherchent par id dans chaque dossier de `--modeles`
(`rendu.trouver`).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/escalier/revue.py <kit> \\
        --modeles <dossier> --sortie <dossier neuf>
"""
import argparse
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))

import rendu  # noqa: E402

PENTES = (0.5, 0.2)
"""La pente (m de hauteur par m d'abscisse) de chacune des deux cases de la ligne `volee` : deux pentes inégales
éprouvent le raccord."""


def main():
    p = argparse.ArgumentParser()
    p.add_argument("kit")
    p.add_argument("--modeles", action="append", required=True, type=Path)
    p.add_argument("--sortie", required=True, type=Path)
    args = p.parse_args()
    sortie = args.sortie.resolve()
    if sortie.exists() and any(sortie.iterdir()):
        raise ValueError(f"{sortie} : dossier de sortie neuf ou vide attendu")
    sortie.mkdir(parents=True, exist_ok=True)
    import bpy
    from mathutils import Matrix
    debut = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    glb, manifeste = rendu.trouver([d.resolve() for d in args.modeles], f"escalier--{args.kit}")
    pieces = [o for o in rendu.importer(bpy, glb) if o.type == "MESH"]
    rendu.habiller_le_modele(bpy, pieces, manifeste, None, False, {})
    bas, hautes = rendu.bornes(bpy, pieces)
    etendue = max(hautes - bas)
    rendre = rendu.studio(bpy, bas, (bas + hautes) / 2, etendue, sortie, debut)
    lignes = []
    for piece in pieces:
        for o in pieces:
            o.hide_render = o is not piece
        lignes.append(rendu.vues_de_revue(rendre, sortie, piece.name, (bas + hautes) / 2, hautes - bas, etendue))
    longueur, pied, volee = hautes.x - bas.x, 0.0, []
    for rang, pente in enumerate(PENTES):
        cisaillement = Matrix.Translation(((rang - (len(PENTES) - 1) / 2) * longueur, 0.0, pied + pente * longueur / 2))
        cisaillement[2][0] = pente
        pied += pente * longueur
        for piece in pieces:
            posee = piece.copy()
            posee.data = piece.data.copy()
            posee.data.transform(cisaillement @ piece.matrix_world)
            posee.matrix_world = Matrix.Identity(4)
            posee.hide_render = False
            bpy.context.scene.collection.objects.link(posee)
            volee.append(posee)
    for piece in pieces:
        piece.hide_render = True
    coin, tete = rendu.bornes(bpy, volee)
    lignes.append(rendu.vues_de_revue(rendre, sortie, "volee", (coin + tete) / 2, tete - coin, max(tete - coin)))
    rendu.grille(bpy, lignes, sortie / "planche.png")
    print("PLANCHE", sortie / "planche.png", flush=True)


if __name__ == "__main__":
    main()
