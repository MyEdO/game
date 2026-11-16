"""Le gabarit de jeu d'un décor (#4335) : les primitives de sa recette (`volume.primitives` de sa fiche dans
`src/data/props.json`), la source unique que lit aussi le noyau (empreinte, dessus, assise, foyer de lumière, rayon du
pointeur). Son modèle se bâtit dans leur enveloppe convexe (`enveloppe`) : il garde l'encombrement de sa recette, sol
compris, sans en recopier les primitives.

Géométrie d'une primitive : `polygonesDePrimitive` de `src/data/props.types.ts`. Une caisse, centrée, de côtés `size` ;
un cylindre, le polygone régulier de `sides` sommets au rayon `radiusM` (le premier sur `a`), étiré de `longueurM` le long
de son axe, `(a, b, t)` par `REPERE_D_AXE` ; un prisme, sa semelle et son rampant qui descend vers le côté `slope`.

Repère. La recette est en mètres, origine à l'ancre, `xM` à l'est, `yM` vers son front au cap d'identité
(`CAP_IDENTITE_PROP`), `hM` vers le haut ; le monde glTF de l'hôte lit (X, Y, Z) = (xM, hM, yM) (`normale` de
`props.types.ts`). Le modèle se bâtit en Blender, z vers le haut, le front vers -y comme l'avant d'un véhicule
(`maille.py`) : (x, y, z) = (xM, -yM, hM), que l'export glTF place en (xM, hM, yM). L'origine reste à l'ancre, jamais
recentrée.
"""
import itertools
import json
import math

import numpy as np

import habillage

PROPS = habillage.DEPOT / "src" / "data" / "props.json"
COPLANAIRE = 1e-9
"""Écart (m) sous lequel un sommet des primitives est tenu pour posé sur une face de leur enveloppe."""


def fiche(id_):
    """La fiche du décor `id_` de `src/data/props.json`."""
    return next(p for p in json.loads(PROPS.read_text(encoding="utf-8")) if p["id"] == id_)


def vers_blender(x, y, h):
    """Le point (xM, yM, hM) de la recette dans le repère de Blender."""
    return (x, -y, h)


def depuis_gltf(X, Y, Z):
    """Le point (X, Y, Z) d'un GLB exporté dans le repère de la recette (xM, yM, hM)."""
    return (X, Z, Y)


def polygones(p):
    """Les faces de la primitive `p`, chacune une liste de points (xM, yM, hM), comme `polygonesDePrimitive`."""
    cx, cy, ch = p["center"]["xM"], p["center"]["yM"], p["center"]["hM"]
    if p["kind"] == "cylinder":
        poser = {"h": lambda a, b, t: (cx + a, cy + b, ch + t), "x": lambda a, b, t: (cx + t, cy + a, ch + b),
                 "y": lambda a, b, t: (cx + a, cy + t, ch + b)}[p["axis"]]
        n, r, t = p["sides"], p["radiusM"], p["longueurM"] / 2
        anneau = [(r * math.cos(2 * math.pi * k / n), r * math.sin(2 * math.pi * k / n)) for k in range(n)]
        cotes = [[poser(*anneau[k], -t), poser(*anneau[(k + 1) % n], -t), poser(*anneau[(k + 1) % n], t), poser(*anneau[k], t)]
                 for k in range(n)]
        return cotes + [[poser(a, b, -t) for a, b in anneau], [poser(a, b, t) for a, b in anneau]]
    s = p["size"]
    dx, dy, dh = s["xM"] / 2, s["yM"] / 2, s["hM"] / 2
    if p["kind"] == "box":
        return [[(cx + i * dx, cy + j * dy, ch + k * dh) for i, j, k in face] for face in (
            [(-1, -1, -1), (-1, 1, -1), (-1, 1, 1), (-1, -1, 1)], [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)],
            [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)], [(-1, 1, -1), (1, 1, -1), (1, 1, 1), (-1, 1, 1)],
            [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1)], [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)])]
    coins = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    bas = lambda i, j: (i if p["slope"][0] == "x" else j) == (1 if p["slope"][1] == "+" else -1)  # noqa: E731
    semelle = [(cx + i * dx, cy + j * dy, ch - dh) for i, j in coins]
    rampant = [(cx + i * dx, cy + j * dy, ch - dh if bas(i, j) else ch + dh) for i, j in coins]
    hauts = [(i, j) for i, j in coins if not bas(i, j)]
    dosseret = [(cx + hauts[0][0] * dx, cy + hauts[0][1] * dy, ch - dh), (cx + hauts[1][0] * dx, cy + hauts[1][1] * dy, ch - dh),
                (cx + hauts[1][0] * dx, cy + hauts[1][1] * dy, ch + dh), (cx + hauts[0][0] * dx, cy + hauts[0][1] * dy, ch + dh)]
    joues = []
    for i, j in hauts:
        i0, j0 = next((a, b) for a, b in coins if bas(a, b) and (a == i or b == j))
        joues.append([(cx + i * dx, cy + j * dy, ch - dh), (cx + i0 * dx, cy + j0 * dy, ch - dh), (cx + i * dx, cy + j * dy, ch + dh)])
    return [semelle, rampant, dosseret, *joues]


def enveloppe(primitives):
    """L'enveloppe convexe des `primitives`, dans le repère de la recette : ses faces `(normales (m, 3), bornes (m,))`,
    normales unitaires vers le dehors ; un point `q` y est quand `normales @ q <= bornes`. Chaque face passe par trois
    sommets des primitives et laisse tous les autres du même côté."""
    points = np.unique(np.round(np.array([q for p in primitives for f in polygones(p) for q in f], dtype=np.float64), 9), axis=0)
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
        normales, self.bornes = enveloppe(self.primitives)
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
