"""Revue d'un kit de toit (#4471) : les pièces de son GLB (`faitage.PIECES`), habillées comme le jeu les habille
(`rendu.habiller_le_modele`, projeté), leur surface `corps` teinte de la couleur de faîtière (`ridgeCap`) de la
couverture `--couverture` de `src/data/materials.json`, dont il est le kit, si elle en a une, les autres de la texture de leur matière,
rendues dans le studio de `rendu.py`, de face, de trois-quarts et de dessus (`rendu.vues_de_revue`). `planche.png`
range une ligne par pièce, seule sur son toit d'école ; puis une ligne par faîte de `FAITES` : trois cases bout à bout
sur deux pans de même pente, la faîtière étirée en hauteur à cette pente, sans cisaillement, pour voir son raccord et
son assise ; puis une ligne par toit de `toit/poses.mjs`, une croupe d'école, une croupe en L et une croupe en croix :
les pans que le noyau en sert, et chacune de ses pièces de toit posée comme l'hôte la pose (`pose_de_l_hote`), pour voir
les arêtiers monter, les noues dans leur creux, et leurs rencontres aux nœuds. Le GLB et son manifeste se cherchent par
id dans chaque dossier de `--modeles` (`rendu.trouver`).

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
from mathutils import Matrix, Vector  # noqa: E402

sys.path.insert(0, str(ICI))

import faitage  # noqa: E402
import habillage  # noqa: E402
import rendu  # noqa: E402
from script_node import lancer  # noqa: E402

CORPS = "corps"
CASES = 3
FAITES = {"raide": 1.5, "plat": 0.3}
"""Par ligne de la planche, la pente (m de hauteur par m de travers) des deux pans d'un faîte : un toit raide puis un
toit plat, qui éprouvent l'étirement."""
DEBORD_DES_PANS = 1.6
"""La largeur des pans montrés sous une pièce seule, en parts de sa demi-largeur."""


def couleur_de_faitiere(couverture, kit):
    """La palette que le jeu donne à la faîtière de la `couverture`, matière de `src/data/materials.json` dont le kit de
    toit est `kit` : son `ridgeCap` à l'emplacement `corps`, rien si elle n'en a pas."""
    matieres = json.loads((habillage.DEPOT / "src" / "data" / "materials.json").read_text(encoding="utf-8"))
    matiere = next((m for m in matieres if m["id"] == couverture and m.get("kit") == kit), None)
    if matiere is None:
        raise ValueError(f"couverture {couverture} : absente de materials.json pour le kit {kit}")
    return {CORPS: habillage.couleur_lineaire(matiere["ridgeCap"])} if "ridgeCap" in matiere else {}


def pose(pente, rang, longueur):
    """La pose de la case de `rang` d'un faîte à la `pente` (`FAITES`), dans le repère de Blender (z la hauteur) :
    sa hauteur étirée à la pente."""
    m = Matrix.Translation(((rang - (CASES - 1) / 2) * longueur, 0.0, 0.0))
    m[2][2] = pente
    return m


def pose_de_l_hote(piece, long, metres_par_case):
    """La pose de la pièce de toit posée `piece` (`PieceDeToitPosee`, `src/noyau/monde/piecesDeToit.ts`) d'un modèle long
    de `long` mètres, comme l'hôte la pose (`MiseEnPage.echelle_de_faitiere`, `VolumeDeScene.transform_d_instance`),
    dans le repère de Blender, en mètres, la case (x, y) du noyau en (x, -y) : étirée en longueur à son tronçon en
    plan et en hauteur à l'écart des pentes de ses pans, tournée sur son sens, cisaillée de son gradient, à son milieu
    et à sa cote."""
    sens = Vector((piece["sens"]["x"], -piece["sens"]["y"], 0.0))
    le_long = sens.normalized()
    etiree = Matrix(((le_long.x * sens.length * metres_par_case / long, le_long.y, 0.0, 0.0),
                     (le_long.y * sens.length * metres_par_case / long, -le_long.x, 0.0, 0.0),
                     (0.0, 0.0, piece["ecart"] / metres_par_case, 0.0), (0.0, 0.0, 0.0, 1.0)))
    cisaillee = Matrix.Identity(4)
    cisaillee[2][0], cisaillee[2][1] = piece["gradient"]["x"] / metres_par_case, -piece["gradient"]["y"] / metres_par_case
    milieu = (piece["milieu"]["x"] * metres_par_case, -piece["milieu"]["y"] * metres_par_case, piece["pied"])
    return Matrix.Translation(milieu) @ cisaillee @ etiree


def maille(nom, sommets, faces, matiere):
    """L'objet `nom` de `sommets` et de `faces`, de la `matiere`, dans la scène."""
    donnees = bpy.data.meshes.new(nom)
    donnees.from_pydata(sommets, [], faces)
    donnees.materials.append(matiere)
    objet = bpy.data.objects.new(nom, donnees)
    bpy.context.scene.collection.objects.link(objet)
    return objet


def pans(nom, demi_largeur, longueur, versant, matiere):
    """Les deux pans du toit d'école sous une pièce de `versant` (`faitage.VERSANT`) : deux plans de l'arête à
    `demi_largeur`, de pente 1."""
    d = demi_largeur
    return maille(nom, [(x, y, faitage.pan(y, versant)) for x in (-longueur / 2, longueur / 2) for y in (-d, 0.0, d)],
                  [(0, 1, 4, 3), (1, 2, 5, 4)], matiere)


def toit(nom, polygones, metres_par_case, matiere):
    """Les pans d'un toit de `toit/poses.mjs`, ses `polygones` de points `{ x, y, h }` (cases centrées, mètres)."""
    sommets = [(q["x"] * metres_par_case, -q["y"] * metres_par_case, q["h"]) for poly in polygones for q in poly]
    debuts = [sum(len(poly) for poly in polygones[:k]) for k in range(len(polygones))]
    return maille(nom, sommets, [list(range(d, d + len(poly))) for d, poly in zip(debuts, polygones)], matiere)


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
    pieces = {o.name: o for o in pieces}
    sous = habillage.materiau("pans", (0.12, 0.12, 0.13), 0.0, 0.9)
    seules = {}
    for nom in faitage.PIECES:
        bas, hautes = rendu.bornes(bpy, [pieces[nom]])
        seules[nom] = [pieces[nom], pans(f"pans-{nom}", DEBORD_DES_PANS * hautes.y, hautes.x - bas.x, faitage.VERSANT[nom], sous)]
    for modele in seules.values():
        for o in modele:
            o.hide_render = True
    lignes = []

    def ligne(nom, objets):
        """La ligne `nom` de la planche : les `objets`, seuls rendus, dans un studio à leur échelle."""
        avant = set(bpy.data.objects)
        for o in objets:
            o.hide_render = False
        coin, tete = rendu.bornes(bpy, objets)
        rendre = rendu.studio(bpy, coin, (coin + tete) / 2, max(tete - coin), sortie, debut)
        lignes.append(rendu.vues_de_revue(rendre, sortie, nom, (coin + tete) / 2, tete - coin, max(tete - coin)))
        for o in [*objets, *(set(bpy.data.objects) - avant)]:
            o.hide_render = True

    for nom, modele in seules.items():
        ligne(nom, modele)
    faitiere = seules[faitage.FAITIERE]
    longueur = faitiere[0].dimensions.x
    for nom, pente in FAITES.items():
        ligne(f"faite-{nom}", [posee(o, pose(pente, rang, longueur)) for rang in range(CASES) for o in faitiere])
    recus = json.loads(lancer(ICI / "poses.mjs", [args.couverture], ""))
    for nom, recu in recus["toits"].items():
        ligne(nom, [toit(f"pans-{nom}", recu["pans"], recus["metresParCase"], sous),
                    *(posee(pieces[f["piece"]], pose_de_l_hote(f, pieces[f["piece"]].dimensions.x, recus["metresParCase"]))
                      for f in recu["pieces"])])
    rendu.grille(bpy, lignes, sortie / "planche.png")
    print("PLANCHE", sortie / "planche.png", flush=True)


if __name__ == "__main__":
    main()
