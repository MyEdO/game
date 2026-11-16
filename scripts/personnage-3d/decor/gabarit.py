"""Le gabarit de jeu d'un décor (#4335) : les primitives de sa recette (`volume.primitives` de sa fiche dans
`src/data/props.json`), la source unique que lit aussi le noyau (empreinte, dessus, assise, foyer de lumière, rayon du
pointeur). Son modèle se bâtit dans leur enveloppe convexe (`enveloppe`) : il garde l'encombrement de sa recette, sol
compris, sans en recopier les primitives.

Géométrie d'une primitive : `polygonesDePrimitive` de `src/data/props.types.ts`, la seule du catalogue, que
`polygones.mjs` lance sur les primitives de la recette.

Repère. La recette est en mètres, origine à l'ancre, `xM` à l'est, `yM` vers son front au cap d'identité
(`CAP_IDENTITE_PROP`), `hM` vers le haut ; le monde glTF de l'hôte lit (X, Y, Z) = (xM, hM, yM) (`normale` de
`props.types.ts`). Le modèle se bâtit en Blender, z vers le haut, le front vers -y comme l'avant d'un véhicule
(`maille.py`) : (x, y, z) = (xM, -yM, hM), que l'export glTF place en (xM, hM, yM). L'origine reste à l'ancre, jamais
recentrée.
"""
import itertools
import json
from pathlib import Path

import numpy as np

import habillage
from script_node import lancer

ICI = Path(__file__).resolve().parent

PROPS = habillage.DEPOT / "src" / "data" / "props.json"
COPLANAIRE = 1e-9
"""Écart (m) sous lequel un sommet des primitives est tenu pour posé sur une face de leur enveloppe."""
NOEUD_EMISSIF = "emet"
"""Le nœud du GLB d'un décor qui porte ce qui luit, présent si et seulement si sa recette a une primitive `emet`
(`test_decor.py`), que l'hôte allume sur une pose qui éclaire (`NOEUD_EMISSIF`,
`hotes/godot/projet/scripts/montage_des_modeles.gd`)."""


def fiche(id_):
    """La fiche du décor `id_` de `src/data/props.json`."""
    return next(p for p in json.loads(PROPS.read_text(encoding="utf-8")) if p["id"] == id_)


def vers_blender(x, y, h):
    """Le point (xM, yM, hM) de la recette dans le repère de Blender."""
    return (x, -y, h)


def boite(primitive):
    """Le centre et les demi-côtés (x, y, z) de la boîte de `primitive` (boîte, prisme, ou cylindre d'axe vertical),
    dans le repère de Blender."""
    c = primitive["center"]
    if primitive["kind"] == "cylinder":
        demi = (primitive["radiusM"], primitive["radiusM"], primitive["longueurM"] / 2)
    else:
        demi = tuple(primitive["size"][k] / 2 for k in ("xM", "yM", "hM"))
    return vers_blender(c["xM"], c["yM"], c["hM"]), demi


def depuis_gltf(X, Y, Z):
    """Le point (X, Y, Z) d'un GLB exporté dans le repère de la recette (xM, yM, hM)."""
    return (X, Z, Y)


def polygones(primitives):
    """Les faces de chacune des `primitives`, chacune une liste de points `[xM, yM, hM]` : `polygonesDePrimitive` de
    `src/data/props.types.ts`, lancé par `polygones.mjs`."""
    return json.loads(lancer(ICI / "polygones.mjs", [], json.dumps(primitives)))


def enveloppe(faces_des_primitives):
    """L'enveloppe convexe des primitives de faces `faces_des_primitives` (`polygones`), dans le repère de la recette :
    ses faces `(normales (m, 3), bornes (m,))`, normales unitaires vers le dehors ; un point `q` y est quand
    `normales @ q <= bornes`. Chaque face passe par trois sommets des primitives et laisse tous les autres du même côté."""
    points = np.unique(np.round(np.array([q for faces in faces_des_primitives for f in faces for q in f], dtype=np.float64), 9), axis=0)
    i, j, k = np.array(list(itertools.combinations(range(len(points)), 3))).T
    normales = np.cross(points[j] - points[i], points[k] - points[i])
    longueurs = np.linalg.norm(normales, axis=1)
    normales, i = normales[longueurs > COPLANAIRE] / longueurs[longueurs > COPLANAIRE, None], i[longueurs > COPLANAIRE]
    ecarts = normales @ points.T - np.einsum("ij,ij->i", normales, points[i])[:, None]
    faces = np.concatenate([normales[(ecarts <= COPLANAIRE).all(axis=1)], -normales[(ecarts >= -COPLANAIRE).all(axis=1)]])
    faces = np.unique(np.round(faces, 9), axis=0)
    return faces, (faces @ points.T).max(axis=1)


def depassement(points, faces):
    """De combien (m) chaque point `(n, 3)` de la recette sort de l'enveloppe `faces` ; négatif ou nul dedans."""
    normales, bornes = faces
    return (np.asarray(points, dtype=np.float64) @ normales.T - bornes).max(axis=1)


class Gabarit:
    """Les primitives du décor `id_` et leur enveloppe convexe, interrogées dans le repère de Blender."""

    def __init__(self, id_):
        self.id = id_
        self.primitives = fiche(id_)["volume"]["primitives"]
        self.polygones = polygones(self.primitives)
        normales, self.bornes = enveloppe(self.polygones)
        self.normales = normales * (1, -1, 1)

    def rentrer(self, points, retrait):
        """Les points `(n, 3)` de Blender, chacun de ceux qui dépassent une face de l'enveloppe ramené à `retrait` (m)
        sous elle, face après face jusqu'à ce qu'aucun ne dépasse."""
        p = np.array(points, dtype=np.float64)
        bornes = self.bornes - retrait
        while True:
            ecarts = p @ self.normales.T - bornes
            pire = ecarts.argmax(axis=1)
            dehors = ecarts[np.arange(len(p)), pire] > 0
            if not dehors.any():
                return p
            p[dehors] -= self.normales[pire[dehors]] * (ecarts[dehors, pire[dehors]] + COPLANAIRE)[:, None]
