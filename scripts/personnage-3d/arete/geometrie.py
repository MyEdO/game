"""La géométrie commune aux modèles des arêtes (#4471) : le repère d'une arête, le repère d'une pièce posée sur elle
(`Repere`), et la déclaration de l'élément d'un kit, un nœud racine par pièce (`PieceDArete`,
`src/noyau/monde/aretes.ts`).

Repère. Dans Blender, x le long de l'arête, centrée ; z depuis le pied ; y l'épaisseur, centrée, la face du dehors vers
-y (`DEHORS`), comme le front d'un décor (`maille.py`). L'export glTF le place en (X, Y, Z) = (x, z, -y) : X le long de
l'arête, Y depuis le pied, Z l'épaisseur, le dehors vers +Z. Chaque pièce garde l'origine de l'arête."""
import random

from mathutils import Vector

import habillage
from maille import Maille, boite, objet, poutre

X, HAUT = Vector((1, 0, 0)), Vector((0, 0, 1))
DEHORS = Vector((0, -1, 0))
"""Le sens de la face du dehors d'une arête, dans le repère de Blender."""


class Repere:
    """Le repère d'une pièce posée sur l'arête : son origine `o`, son sens `u` le long d'elle et sa normale `n`,
    horizontaux et unitaires, portés par les axes. Un point y est `(a, h, c)` : `a` le long de `u`, `h` en hauteur, `c`
    le long de `n`."""

    def __init__(self, o, u, n):
        self.o, self.u, self.n = Vector(o), Vector(u), Vector(n)

    def point(self, a, h, c):
        return self.o + self.u * a + HAUT * h + self.n * c

    def boite(self, m, a, h, c, mat):
        """La boîte des bornes `a`, `h` et `c` (paires) de ce repère."""
        p, q = self.point(a[0], h[0], c[0]), self.point(a[1], h[1], c[1])
        boite(m, tuple(map(min, p, q)), tuple(map(max, p, q)), mat)

    def poutre(self, m, depart, arrivee, largeur, c, mat):
        """La pièce de `largeur` du point `depart` `(a, h)` au point `arrivee`, entre les bornes `c` de la normale."""
        milieu = (c[0] + c[1]) / 2
        poutre(m, self.point(*depart, milieu), self.point(*arrivee, milieu), largeur, abs(c[1] - c[0]), self.n, mat)


def elements(D, kit, batir):
    """L'élément du kit `kit` (`construire.py`) : sa clé `arete`, ses matériaux `D["MATERIAUX"]`, un nœud par pièce de
    `batir` {pièce : `batir(D, maille, aléa)`}, à l'origine de l'arête, lissé sous `D["ANGLE_LISSE"]`, ses triangles
    dans `D["BUDGET_TRIANGLES"][pièce]`. L'aléa d'une pièce est semé de `<kit>/<pièce>`."""
    def construire():
        mats = list(habillage.materiaux(D["MATERIAUX"]).values())
        for piece, bati in batir.items():
            m = Maille(mats)
            bati(D, m, random.Random(f"{kit}/{piece}"))
            triangles = len(objet(piece, m, (0.0, 0.0, 0.0), D["ANGLE_LISSE"]).data.polygons)
            if triangles > D["BUDGET_TRIANGLES"][piece]:
                raise ValueError(f"{kit}/{piece} : {triangles} triangles, budget {D['BUDGET_TRIANGLES'][piece]}")
        return {}
    yield {"glb": kit, "cles": [("arete", {"kit": kit})], "materiaux": D["MATERIAUX"], "blasons": (),
           "construire": construire}
