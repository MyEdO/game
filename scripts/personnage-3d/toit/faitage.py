"""Les communs des kits de toit (#4471) : le repère des pièces qu'un hôte pose sur les arêtes d'un toit (`REPERE`), la
faîtière d'un faîte, l'arêtier d'une arête saillante montante et la noue d'une arête rentrante (`PIECES`), la longueur
de chacune (`longueur`), la hauteur d'un pan sous elle (`pan`), la pièce filée de sections qui changent d'un bout à
l'autre (`file`), la plaque couchée sur un pan (`plaque`), les éléments qui se recouvrent le long de l'arête
(`recouvrants`) et la déclaration de l'élément d'un kit (`elements`), par les communs des escaliers
(`escalier/volee.py`) et la géométrie des arêtes (`arete/geometrie.py`), que ce module met au chemin des modèles.

Repère. Une pièce se bâtit sur un toit d'école, dont chaque pan descend de l'arête d'une pente de 1, ou en monte pour
la noue (`VERSANT`) : l'hôte étire sa hauteur à l'écart des pentes des deux pans qu'elle coiffe, et la cisaille de
leur gradient moyen, montants verticaux. Dans Blender, x le long de l'arête, centré, d'un bout à l'autre de la pièce ; z
la hauteur, 0 sur l'arête ; y le travers. L'export glTF le place en (X, Y, Z) = (x, z, -y) : X de -L/2 à +L/2, Y depuis
l'arête, Z en travers. Un point y est `(a, h, c)` : `a` le long de l'arête, `h` en hauteur, `c` en travers ; le pan
passe en `h = VERSANT × |c|`. Rien ne descend sous les pans, et le dessous de la pièce les suit : une épaisseur se
porte en hauteur, jamais d'équerre au pan, pour que l'étirement de l'hôte la laisse posée. Rien ne passe les bouts, et
la section de la pièce est la même aux deux : deux pièces voisines se raccordent bout à bout, sans joint ni face
doublée.

L'arêtier et la noue se bâtissent à plat, longs de la diagonale d'une case, -X leur bas et +X leur haut : le
cisaillement de l'hôte les fait monter. Ce qui s'y recouvre recouvre vers le bas (`VERS_LE_BAS`), l'élément du haut
sur celui du bas ; une levée, verticale, et un joint, dans un plan d'abscisse constante, restent ce qu'ils sont sous le
cisaillement, qui n'ouvre donc aucun joint."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "escalier"))

import volee  # noqa: E402
from volee import REPERE, geometrie, profil  # noqa: E402,F401

CATEGORIE = "toit"
FAITIERE, ARETIER, NOUE = "faitiere", "aretier", "noue"
PIECES = (FAITIERE, ARETIER, NOUE)
BRAS = (-1, 1)
"""Les deux bras d'une pièce, par le signe de leur travers."""
VERSANT = {FAITIERE: -1, ARETIER: -1, NOUE: 1}
"""Par pièce, la pente de ses pans depuis son arête : ils en descendent, ou en montent dans le creux d'une noue."""
VERS_LE_BAS = {FAITIERE: False, ARETIER: True, NOUE: True}
"""Par pièce, si ce qui s'y recouvre recouvre vers son bout -X, le bas d'une arête montante."""


def longueur(D, piece):
    """La longueur (m) de la `piece` : la case pour la faîtière, sa diagonale pour l'arêtier et la noue."""
    return D["LONGUEUR"] * (1.0 if piece == FAITIERE else math.sqrt(2.0))


def pan(c, versant=-1):
    """La hauteur du pan au travers `c`, sous une pièce de `versant` (`VERSANT`)."""
    return versant * abs(c)


def file(m, sections, mat):
    """La pièce filée de section en section, `sections` [(a, contour [(h, c)])] aux abscisses croissantes, chaque
    contour du même nombre de points et dans le sens de ceux de `volee.profil` : une coque close."""
    k = len(sections[0][1])
    sommets = [REPERE.point(a, h, c) for a, contour in sections for h, c in contour]
    dernier = (len(sections) - 1) * k
    faces = [list(range(k - 1, -1, -1)), list(range(dernier, dernier + k))]
    faces += [[r + i, r + (i + 1) % k, r + k + (i + 1) % k, r + k + i]
              for r in range(0, dernier, k) for i in range(k)]
    m.ajouter(sommets, faces, mat)


def plaque(m, bras, contour, dessous, dessus, mat, versant=-1):
    """La plaque couchée sur le pan du `bras` (`BRAS`) d'une pièce de `versant` (`VERSANT`), de `contour` [(a, d)], `d`
    la distance à l'arête en travers, entre les levées `dessous(a, d)` et `dessus(a, d)` (m) au-dessus du pan : une
    coque close."""
    k = len(contour)
    sommets = [REPERE.point(a, pan(d, versant) + levee(a, d), bras * d) for levee in (dessous, dessus) for a, d in contour]
    faces = [list(range(k - 1, -1, -1)), list(range(k, 2 * k))]
    faces += [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)]
    m.ajouter(sommets, faces, mat)


def recouvrants(longueur, nombre, vers_le_bas=False):
    """Les éléments qui se recouvrent le long d'une pièce de `longueur`, au pas `longueur / nombre` : `(a0, a1, u0, u1)`
    par élément, ses abscisses et la part de sa longueur à chacune, de sa tête (0) à sa queue (1), qui recouvre la tête
    du suivant : vers +X, ou vers -X si `vers_le_bas` (`VERS_LE_BAS`). La pièce coupe un élément en son milieu à chaque
    bout, que la pièce voisine complète."""
    pas, demi = longueur / nombre, longueur / 2
    for k in range(nombre + 1):
        debut, fin = (0.5 if k == 0 else 0.0), (0.5 if k == nombre else 1.0)
        bout = -demi + (k - 0.5) * pas
        a0, a1 = bout + debut * pas, bout + fin * pas
        yield (a0, a1, 1.0 - debut, 1.0 - fin) if vers_le_bas else (a0, a1, debut, fin)


def part(a, a0, a1, u0, u1):
    """La part de sa longueur où en est, à l'abscisse `a`, l'élément `(a0, a1, u0, u1)` de `recouvrants`."""
    return u0 + (u1 - u0) * (a - a0) / (a1 - a0)


def elements(D, batir):
    """L'élément du kit de toit de `D` (`geometrie.elements`) : sa clé `toit`, un nœud par pièce de `PIECES`, chacun
    bâti par `batir(pièce)`."""
    return geometrie.elements(D, D["KIT"], {piece: batir(piece) for piece in PIECES}, CATEGORIE)
