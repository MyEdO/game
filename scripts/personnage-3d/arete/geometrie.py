"""La géométrie commune aux modèles des arêtes (#4471) : le repère d'une arête, le repère d'une pièce posée sur elle
(`Repere`), les pièces de biais et les gravats d'une brèche (`biais`, `eboulis`), et la déclaration de l'élément d'un
kit, un nœud racine par pièce (`PieceDArete`, `src/noyau/monde/aretes.ts`).

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
SEPARATEUR = "--"
GRAVATS = "gravats"
GAUCHE, MILIEU, DROITE = "gauche", "milieu", "droite"
"""La position d'une arête dans une ouverture de plusieurs arêtes : son nœud est `<pièce>--<position>`, `gauche` au
bout -X de l'ouverture, `droite` à son bout +X ; l'arête d'une ouverture d'une seule arête prend le nœud `<pièce>`."""


def noeud(piece, position=None):
    """Le nom du nœud de `piece` à la `position` d'une ouverture, `piece` seule sans position."""
    return f"{piece}{SEPARATEUR}{position}" if position else piece


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


def biais(m, a, h_gauche, h_droite, c, mat):
    """Une pièce de l'arête entre les abscisses `a` et les bornes `c` de son épaisseur (vers le dehors), dont le
    dessous et le dessus sont aux hauteurs `h_gauche` à son bout gauche et `h_droite` à son bout droit."""
    boite(m, (a[0], -c[1], 0.0), (a[1], -c[0], 1.0), mat)
    hauteurs = (h_gauche, h_droite)
    m.v[-8:] = [(x, y, hauteurs[k // 4][k % 2]) for k, (x, y, _) in enumerate(m.v[-8:])]


def eboulis(m, R, alea, G, demi):
    """Les gravats au pied d'une brèche, d'après `G` : leur `nombre`, leur `etendue` (fraction de la demi-longueur
    `demi`, puis mètres de part et d'autre du mur), leur `cote` (m, tiré), ce dont chaque coin s'écarte (`ecart`,
    fraction du côté, tirée jusqu'à cette borne), du matériau `GRAVATS`, que le kit déclare."""
    for _ in range(G["nombre"]):
        cote = alea.uniform(*G["cote"])
        ca = demi * alea.uniform(-G["etendue"][0], G["etendue"][0])
        cc = alea.uniform(-G["etendue"][1], G["etendue"][1])
        R.boite(m, (ca - cote / 2, ca + cote / 2), (0.0, cote * 0.6), (cc - cote / 2, cc + cote / 2), GRAVATS)
        ecart = cote * G["ecart"]
        m.v[-8:] = [(px + alea.uniform(-ecart, ecart), py + alea.uniform(-ecart, ecart),
                     pz + (k % 2) * alea.uniform(-ecart, ecart)) for k, (px, py, pz) in enumerate(m.v[-8:])]


def elements(D, kit, batir, categorie="arete"):
    """L'élément du kit `kit` (`construire.py`) : sa clé `categorie`, ses matériaux `D["MATERIAUX"]`, un nœud par pièce de
    `batir` {pièce : `batir(D, maille, aléa)`}, à l'origine de l'arête, lissé sous `D["ANGLE_LISSE"]`, ses triangles
    dans `D["BUDGET_TRIANGLES"][pièce]`, celui de `<pièce>` pour un nœud `<pièce>--<position>`. L'aléa d'un nœud est
    semé de `<kit>/<nœud>`."""
    def construire():
        mats = list(habillage.materiaux(D["MATERIAUX"]).values())
        for piece, bati in batir.items():
            m = Maille(mats)
            bati(D, m, random.Random(f"{kit}/{piece}"))
            triangles = len(objet(piece, m, (0.0, 0.0, 0.0), D["ANGLE_LISSE"]).data.polygons)
            budget = D["BUDGET_TRIANGLES"][piece.split(SEPARATEUR)[0]]
            if triangles > budget:
                raise ValueError(f"{kit}/{piece} : {triangles} triangles, budget {budget}")
        return {}
    yield {"glb": kit, "cles": [(categorie, {"kit": kit})], "materiaux": D["MATERIAUX"], "blasons": (),
           "construire": construire}
