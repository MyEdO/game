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
CONCOURANT = 1e-9
"""Écart d'angle (rad) sous lequel deux points sont touchés ensemble par le plan d'appui qui tourne autour d'une arête
(`_pivot`)."""
VOISINAGE = 1e-6
"""Écart (m) sous lequel un sommet est tenu pour posé sur le plan d'une face de l'enveloppe, ou sur le bord de son
contour, en la cherchant (`_faces_planes`) : large devant `COPLANAIRE` et l'arrondi des sommets, pour que chaque triplet
qui porte une face soit essayé."""
LOT = 20000
"""Le nombre de triplets essayés ensemble par `enveloppe`."""
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


VERSANTS = {"x+": vers_blender(1, 0, 0), "x-": vers_blender(-1, 0, 0), "y+": vers_blender(0, 1, 0),
            "y-": vers_blender(0, -1, 0)}
"""Le sens (x, y, z) de Blender où descend un prisme de la recette, par `slope` (`polygonesDePrimitive`,
`src/data/props.types.ts`)."""


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


def _sur_le_plan(points, normale, origine):
    """Les rangs des `points` à moins de `VOISINAGE` du plan de `normale` unitaire passant par `origine`."""
    return np.flatnonzero(np.abs((points - origine) @ normale) <= VOISINAGE)


def _contour(points, groupe, normale):
    """Les rangs des sommets du contour convexe des points `groupe` d'un plan de `normale`, dans l'ordre, les sommets
    alignés ôtés : moins de trois quand le groupe est aligné."""
    u = np.cross(normale, (1.0, 0.0, 0.0) if abs(normale[0]) < 0.9 else (0.0, 1.0, 0.0))
    u /= np.linalg.norm(u)
    q = points[groupe] @ np.stack([u, np.cross(normale, u)]).T
    ordre = np.lexsort((q[:, 1], q[:, 0]))

    def demi(rangs):
        pile = []
        for r in rangs:
            while len(pile) >= 2:
                (ux, uy), (vx, vy) = q[pile[-1]] - q[pile[-2]], q[r] - q[pile[-2]]
                if ux * vy - uy * vx > 0:
                    break
                pile.pop()
            pile.append(r)
        return pile[:-1]
    return groupe[demi(ordre) + demi(ordre[::-1])]


def _pivot(points, groupe, a, b, normale):
    """La normale du plan d'appui qui passe par la droite de `a` à `b`, posée sur le plan de `normale` qui porte le
    `groupe`, tourné autour d'elle vers le dehors jusqu'au premier des autres points : le plus loin de la droite parmi
    ceux qu'il touche ensemble."""
    e = (b - a) / np.linalg.norm(b - a)
    dehors = np.cross(e, normale)
    if dehors @ (points[groupe].mean(axis=0) - a) > 0:
        dehors = -dehors
    w = np.delete(points, groupe, axis=0) - a
    x, y = w @ dehors, w @ normale
    angle = np.arctan2(-y, x)
    loin = np.where(angle <= angle.min() + CONCOURANT, np.hypot(x, y), -1.0).argmax()
    n = -y[loin] * dehors + x[loin] * normale
    return n / np.linalg.norm(n)


def _bord(points, groupe, contour):
    """Les rangs des points du `groupe` à moins de `VOISINAGE` du bord de son `contour` : les seuls qui puissent porter
    une face de l'enveloppe quand le groupe est plan à `COPLANAIRE` près."""
    p, a = points[groupe], points[contour]
    e = np.roll(a, -1, axis=0) - a
    t = np.clip(((p[:, None] - a[None]) * e[None]).sum(-1) / (e * e).sum(-1)[None], 0, 1)
    return groupe[np.linalg.norm(p[:, None] - (a[None] + t[..., None] * e[None]), axis=-1).min(axis=1) <= VOISINAGE]


def _faces_planes(points):
    """Par face plane de l'enveloppe convexe des `points`, les rangs de ses points posés sur le bord de son contour
    (`_bord`), ou de tous ses points quand ils ne sont plans qu'à `VOISINAGE` près, trouvés de proche en proche : un plan d'appui tourné autour de chaque arête du contour d'une face
    (`_pivot`), une face nouvelle quand l'ensemble des points posés sur son plan (`_sur_le_plan`) n'a pas encore été vu.
    La première est la face du dessous ; quand les points du plus bas sont alignés, le plan d'appui tourne une fois
    autour de leur droite."""
    a = points[np.argmin(points[:, 2])]
    normale = np.array((0.0, 0.0, -1.0))
    groupe = _sur_le_plan(points, normale, a)
    contour = _contour(points, groupe, normale)
    if len(contour) == 2:
        normale = _pivot(points, groupe, *points[contour], normale)
        groupe = _sur_le_plan(points, normale, a)
        contour = _contour(points, groupe, normale)
    faces, vues, rang = [(groupe, contour, normale)], {frozenset(groupe.tolist())}, 0
    while rang < len(faces):
        groupe, contour, normale = faces[rang]
        for i, j in zip(contour, np.roll(contour, -1)):
            voisine = _pivot(points, groupe, points[i], points[j], normale)
            autre = _sur_le_plan(points, voisine, points[i])
            if frozenset(autre.tolist()) not in vues:
                vues.add(frozenset(autre.tolist()))
                faces.append((autre, _contour(points, autre, voisine), voisine))
        rang += 1
    return [groupe if np.ptp(points[groupe] @ normale) > COPLANAIRE else _bord(points, groupe, contour) for groupe, contour, normale in faces]


def enveloppe(faces_des_primitives):
    """L'enveloppe convexe des primitives de faces `faces_des_primitives` (`polygones`), dans le repère de la recette :
    ses faces `(normales (m, 3), bornes (m,))`, normales unitaires vers le dehors ; un point `q` y est quand
    `normales @ q <= bornes`. Chaque face passe par trois sommets des primitives et laisse tous les autres du même côté :
    les triplets essayés sont ceux des points que rend chaque face plane de l'enveloppe (`_faces_planes`), les seuls
    qui puissent porter une face, par lots de `LOT`."""
    points = np.unique(np.round(np.array([q for faces in faces_des_primitives for f in faces for q in f], dtype=np.float64), 9), axis=0)
    triplets = np.array([t for bord in _faces_planes(points) for t in itertools.combinations(bord, 3)])
    faces = np.unique(np.round(np.concatenate([_faces_des_triplets(points, lot) for lot in np.array_split(triplets, -(-len(triplets) // LOT))]), 9), axis=0)
    return faces, (faces @ points.T).max(axis=1)


def _faces_des_triplets(points, triplets):
    """Les normales unitaires, vers le dehors, des plans des `triplets` de `points` qui laissent tous les autres du même
    côté, à `COPLANAIRE` près."""
    i, j, k = triplets.T
    normales = np.cross(points[j] - points[i], points[k] - points[i])
    longueurs = np.linalg.norm(normales, axis=1)
    normales, i = normales[longueurs > COPLANAIRE] / longueurs[longueurs > COPLANAIRE, None], i[longueurs > COPLANAIRE]
    ecarts = normales @ points.T - np.einsum("ij,ij->i", normales, points[i])[:, None]
    return np.concatenate([normales[(ecarts <= COPLANAIRE).all(axis=1)], -normales[(ecarts >= -COPLANAIRE).all(axis=1)]])


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
