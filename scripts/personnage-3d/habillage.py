"""Habillage d'un élément rigide, véhicule, Amélioration ou objet tenu (#2987, #3743) : les matériaux du GLB et les `surfaces` de son manifeste, lus
dans la table `MATERIAUX` des données du modèle, `{nom: (emplacement de palette, matière)}`.

La matière est l'id d'une matière du domaine `prop` de `src/data/materials.json` : la surface du manifeste la déclare
`"matiere": "prop--<id>"`, et l'hôte l'habille de sa texture et de son relief du catalogue
(`hotes/godot/projet/textures/`) ; le GLB n'embarque aucune texture, son matériau porte la couleur, la rugosité et le
métal de la matière. À défaut de matière, `(couleur linéaire, métal, rugosité)` ; un emplacement `None` laisse le
matériau hors des `surfaces`.
"""
import json
from pathlib import Path

DOMAINE = "prop"
DEPOT = Path(__file__).resolve().parents[2]


def catalogue():
    """Les matières du domaine `prop` de `src/data/materials.json`, par id."""
    chemin = DEPOT / "src" / "data" / "materials.json"
    return {m["id"]: m for m in json.loads(chemin.read_text(encoding="utf-8")) if m.get("domain") == DOMAINE}


def couleur_lineaire(hexa):
    """La couleur `#rrggbb` (sRVB) en composantes linéaires."""
    def canal(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(canal(int(hexa[i:i + 2], 16) / 255) for i in (1, 3, 5))


def materiau(nom, couleur, metal, rugosite):
    """Matériau `nom` du GLB, de couleur linéaire `couleur`."""
    import bpy
    mat = bpy.data.materials.new(nom)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    mat.diffuse_color = (*couleur, 1)
    bsdf.inputs["Base Color"].default_value = (*couleur, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rugosite
    mat.use_backface_culling = False
    return mat


def materiaux(table):
    """Les matériaux de `table`, par nom, dans son ordre."""
    matieres = catalogue()
    sortie = {}
    for nom, (_, matiere) in table.items():
        if isinstance(matiere, str):
            m = matieres[matiere]
            sortie[nom] = materiau(nom, couleur_lineaire(m["color"]), m["metalness"], m["roughness"])
        else:
            sortie[nom] = materiau(nom, *matiere)
    return sortie


def surfaces(utilises, table, blasons):
    """Les `surfaces` du manifeste : chaque matériau de `table` utilisé par le GLB et doté d'un emplacement, sa
    `matiere` s'il en a une, `blason` s'il est dans `blasons`."""
    return [{"nom": nom, "palette": palette,
             **({"matiere": f"{DOMAINE}--{matiere}"} if isinstance(matiere, str) else {}),
             **({"blason": True} if nom in blasons else {})}
            for nom, (palette, matiere) in table.items() if palette and nom in utilises]


def pieces(D, pieces, construire):
    """Un élément par pièce `(glb, cle, piece)` de `pieces` : une clé `vehicule` par engin des `definitions` de `D[cle]`,
    les matériaux communs `D["MATERIAUX"]` complétés des siens, bâti par `construire(D, materiaux, piece)`."""
    for glb, cle, piece in pieces:
        materiaux = {**D["MATERIAUX"], **D[cle].get("materiaux", {})}
        yield {"glb": glb, "cles": [("vehicule", {"definition": d}) for d in D[cle]["definitions"]],
               "materiaux": materiaux, "blasons": (),
               "construire": lambda piece=piece, materiaux=materiaux: construire(D, materiaux, piece)}
