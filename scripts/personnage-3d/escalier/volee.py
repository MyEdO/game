"""Les communs des kits d'escalier (#4471) : le repère d'une pièce posée sur le côté d'une case de marches (`REPERE`),
le profil filé d'un bout à l'autre de la case (`profil`), la pose d'une maille bâtie au pied et à cheval sur le plan du
bord (`poser`) et la déclaration de l'élément d'un kit (`elements`), par la géométrie des arêtes
(`arete/geometrie.py`), que ce module met au chemin des modèles.

Repère. Une pièce (`limon`, `rampe`) se bâtit à plat, sans pente : l'hôte la cisaille, la hauteur selon l'abscisse, à la
pente du bord qu'elle longe. Dans Blender, x le long de l'axe montant, centré, d'un bout à l'autre de la case ; z depuis
le pied du limon, la cote du bord ; y vers le dedans, le plan du bord de la case à 0, le dehors vers -y (`geometrie.DEHORS`). L'export
glTF le place en (X, Y, Z) = (x, z, -y) : X de -L/2 à +L/2, Y depuis le pied, Z vers le dehors depuis le plan du bord.
Rien ne passe les bouts ni le plan du bord, et la section d'une pièce est la même à ses deux bouts : deux cases voisines
se raccordent bout à bout, quelle que soit la pente de chacune. La rampe ne se pose qu'avec le limon, sur le même
pied : elle se dresse sur son dessus, sans rien sous lui, pour qu'aucune de leurs faces ne se double au bout d'une
volée."""
import sys
from pathlib import Path

from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "arete"))

import geometrie  # noqa: E402
from geometrie import DEHORS, HAUT, X, Repere  # noqa: E402

CATEGORIE = "escalier"
REPERE = Repere((0, 0, 0), X, DEHORS)
"""Le repère d'une pièce : un point y est `(a, h, c)`, `a` le long de l'axe montant, `h` en hauteur depuis le pied,
`c` vers le dehors depuis le plan du bord."""


def profil(m, a, contour, mat):
    """La pièce filée entre les abscisses `a`, de section `contour` [(h, c)], dans le sens trigonométrique vu du bout
    +X : une coque close."""
    k = len(contour)
    sommets = [REPERE.point(x, h, c) for x in a for h, c in contour]
    faces = [list(range(k - 1, -1, -1)), list(range(k, 2 * k))]
    faces += [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)]
    m.ajouter(sommets, faces, mat)


def poser(m, depuis, h, c):
    """Hausse de `h` (m) et décale de `c` (m) vers le dehors les sommets de la maille `m` posés depuis le rang
    `depuis`."""
    m.v[depuis:] = [tuple(Vector(p) + HAUT * h + DEHORS * c) for p in m.v[depuis:]]


def elements(D, batir):
    """L'élément du kit d'escalier de `D` (`geometrie.elements`) : sa clé `escalier`, un nœud par pièce de `batir`."""
    return geometrie.elements(D, D["KIT"], batir, CATEGORIE)
