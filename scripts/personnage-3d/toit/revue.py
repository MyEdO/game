"""Revue d'un kit de toit (#4471) : la `faitiere` de son GLB, habillée comme le jeu l'habille
(`rendu.habiller_le_modele`, projeté), sa surface `corps` teinte de la couleur de faîtière (`ridgeCap`) de la
couverture `--couverture` de `src/data/materials.json`, dont il est le kit, si elle en a une, les autres de la texture de leur matière,
rendue seule sur le toit d'école dans le studio de `rendu.py`, de face, de trois-quarts et de dessus
(`rendu.vues_de_revue`). `planche.png` range la ligne `faitiere`, puis une ligne par faîte de `FAITES` : trois cases
bout à bout sur deux pans de pentes inégales, la pièce étirée en hauteur de la demi-somme des pentes et cisaillée selon
le travers de leur demi-écart, comme l'hôte la pose, sur les deux pans qu'elle coiffe, pour voir son raccord et son
assise. Le GLB et son manifeste se cherchent par id dans chaque dossier de `--modeles` (`rendu.trouver`).

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/toit/revue.py <kit> --couverture <id> \\
        --modeles <dossier> --sortie <dossier neuf>
"""
import argparse
import json
import sys
import time
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI.parent))

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

import habillage  # noqa: E402
import rendu  # noqa: E402

CORPS = "corps"
CASES = 3
FAITES = {"raide": (1.5, 0.9), "plat": (0.3, 0.7)}
"""Par ligne de la planche, les pentes (m de hauteur par m de travers) des deux pans d'un faîte, celui du travers
négatif puis celui du travers positif : un toit raide puis un toit plat, chacun aux pans inégaux, qui éprouvent
l'étirement et le cisaillement."""
DEBORD_DES_PANS = 1.6
"""La largeur des pans montrés sous la pièce, en parts de sa demi-largeur."""


def couleur_de_faitiere(couverture, kit):
    """La palette que le jeu donne à la faîtière de la `couverture`, matière de `src/data/materials.json` dont le kit de
    toit est `kit` : son `ridgeCap` à l'emplacement `corps`, rien si elle n'en a pas."""
    matieres = json.loads((habillage.DEPOT / "src" / "data" / "materials.json").read_text(encoding="utf-8"))
    matiere = next((m for m in matieres if m["id"] == couverture and m.get("kit") == kit), None)
    if matiere is None:
        raise ValueError(f"couverture {couverture} : absente de materials.json pour le kit {kit}")
    return {CORPS: habillage.couleur_lineaire(matiere["ridgeCap"])} if "ridgeCap" in matiere else {}


def pose(pentes, rang, longueur):
    """La pose de la case de `rang` d'un faîte aux `pentes` (`FAITES`), dans le repère de Blender (z la hauteur, y
    l'opposé du travers)."""
    negatif, positif = pentes
    m = Matrix.Translation(((rang - (CASES - 1) / 2) * longueur, 0.0, 0.0))
    m[2][2] = (negatif + positif) / 2
    m[2][1] = (positif - negatif) / 2
    return m


def pans(nom, demi_largeur, longueur, matiere):
    """Les deux pans du toit d'école sous une case : deux plans du faîte à `demi_largeur`, de pente 1."""
    d = demi_largeur
    donnees = bpy.data.meshes.new(nom)
    donnees.from_pydata([(x, y, -abs(y)) for x in (-longueur / 2, longueur / 2) for y in (-d, 0.0, d)], [],
                        [(0, 1, 4, 3), (1, 2, 5, 4)])
    donnees.materials.append(matiere)
    objet = bpy.data.objects.new(nom, donnees)
    bpy.context.scene.collection.objects.link(objet)
    return objet


def posee(objet, matrice):
    """Une copie de `objet` dont la maille est transformée par `matrice`."""
    copie = objet.copy()
    copie.data = objet.data.copy()
    copie.data.transform(matrice @ objet.matrix_world)
    copie.matrix_world = Matrix.Identity(4)
    bpy.context.scene.collection.objects.link(copie)
    return copie


def main():
    p = argparse.ArgumentParser()
    p.add_argument("kit")
    p.add_argument("--couverture", required=True)
    p.add_argument("--modeles", action="append", required=True, type=Path)
    p.add_argument("--sortie", required=True, type=Path)
    args = p.parse_args()
    sortie = args.sortie.resolve()
    if sortie.exists() and any(sortie.iterdir()):
        raise ValueError(f"{sortie} : dossier de sortie neuf ou vide attendu")
    sortie.mkdir(parents=True, exist_ok=True)
    palette = couleur_de_faitiere(args.couverture, args.kit)
    debut = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    glb, manifeste = rendu.trouver([d.resolve() for d in args.modeles], f"toit--{args.kit}")
    pieces = [o for o in rendu.importer(bpy, glb) if o.type == "MESH"]
    rendu.colorer(pieces, {s["nom"]: s["palette"] for s in manifeste["surfaces"]}, palette)
    rendu.habiller_le_modele(bpy, pieces, manifeste, None, False, palette)
    bas, hautes = rendu.bornes(bpy, pieces)
    longueur = hautes.x - bas.x
    toit = pans("pans", DEBORD_DES_PANS * hautes.y, longueur, habillage.materiau("pans", (0.12, 0.12, 0.13), 0.0, 0.9))
    modele = [*pieces, toit]
    bas, hautes = rendu.bornes(bpy, modele)
    rendre = rendu.studio(bpy, bas, (bas + hautes) / 2, max(hautes - bas), sortie, debut)
    lignes = [rendu.vues_de_revue(rendre, sortie, pieces[0].name, (bas + hautes) / 2, hautes - bas, max(hautes - bas))]
    for o in modele:
        o.hide_render = True
    for nom, pentes in FAITES.items():
        faite = [posee(o, pose(pentes, rang, longueur)) for rang in range(CASES) for o in modele]
        for o in faite:
            o.hide_render = False
        coin, tete = rendu.bornes(bpy, faite)
        lignes.append(rendu.vues_de_revue(rendre, sortie, f"faite-{nom}", (coin + tete) / 2, tete - coin, max(tete - coin)))
        for o in faite:
            o.hide_render = True
    rendu.grille(bpy, lignes, sortie / "planche.png")
    print("PLANCHE", sortie / "planche.png", flush=True)


if __name__ == "__main__":
    main()
