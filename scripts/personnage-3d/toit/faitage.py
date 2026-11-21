"""Les communs des kits de toit (#4471) : le repère de la faîtière qu'un hôte pose sur le faîte d'un toit (`REPERE`),
la hauteur d'un pan sous elle (`pan`), la pièce filée de sections qui changent d'un bout à l'autre (`file`), la plaque
couchée sur un pan (`plaque`), les éléments qui se recouvrent le long du faîte (`recouvrants`) et la déclaration de
l'élément d'un kit (`elements`), par les communs des escaliers (`escalier/volee.py`) et la géométrie des arêtes
(`arete/geometrie.py`), que ce module met au chemin des modèles.

Repère. La faîtière se bâtit sur un toit d'école, dont chaque pan descend du faîte d'une pente de 1 : l'hôte étire sa
hauteur, sans la cisailler, à la pente des deux pans qu'elle coiffe. Dans Blender, x le long du faîte,
centré, d'un bout à l'autre de la case ; z la hauteur, 0 sur l'arête du faîte ; y le travers. L'export glTF le place en
(X, Y, Z) = (x, z, -y) : X de -L/2 à +L/2, Y depuis l'arête du faîte, Z en travers. Un point y est `(a, h, c)` : `a`
le long du faîte, `h` en hauteur, `c` en travers ; le pan passe en `h = -|c|`. Rien ne descend sous les pans, et le
dessous de la pièce les suit : une épaisseur se porte en hauteur, jamais d'équerre au pan, pour que l'étirement de
l'hôte la laisse posée. Rien ne passe les bouts, et la section de la pièce est la même aux deux : deux cases voisines
se raccordent bout à bout, sans joint ni face doublée."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "escalier"))

import volee  # noqa: E402
from volee import REPERE, geometrie, profil  # noqa: E402,F401

CATEGORIE = "toit"
FAITIERE = "faitiere"
BRAS = (-1, 1)
"""Les deux bras de la faîtière, par le signe de leur travers."""


def pan(c):
    """La hauteur du pan au travers `c`."""
    return -abs(c)


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


def plaque(m, bras, contour, dessous, dessus, mat):
    """La plaque couchée sur le pan du `bras` (`BRAS`), de `contour` [(a, d)], `d` la distance au faîte en travers,
    entre les levées `dessous(a, d)` et `dessus(a, d)` (m) au-dessus du pan : une coque close."""
    k = len(contour)
    sommets = [REPERE.point(a, pan(d) + levee(a, d), bras * d) for levee in (dessous, dessus) for a, d in contour]
    faces = [list(range(k - 1, -1, -1)), list(range(k, 2 * k))]
    faces += [[i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k)]
    m.ajouter(sommets, faces, mat)


def recouvrants(longueur, nombre):
    """Les éléments qui se recouvrent le long d'une case de `longueur`, au pas `longueur / nombre` : `(a0, a1, u0, u1)`
    par élément, ses abscisses et la part de sa longueur qu'elles bornent, de sa tête (0) à sa queue (1). La case
    coupe un élément en son milieu à chaque bout : la moitié de queue au bout -X, la moitié de tête au bout +X, que
    la case voisine complète."""
    pas, demi = longueur / nombre, longueur / 2
    for k in range(nombre + 1):
        u0, u1 = (0.5 if k == 0 else 0.0), (0.5 if k == nombre else 1.0)
        tete = -demi + (k - 0.5) * pas
        yield tete + u0 * pas, tete + u1 * pas, u0, u1


def elements(D, batir):
    """L'élément du kit de toit de `D` (`geometrie.elements`) : sa clé `toit`, le nœud `faitiere` bâti par `batir`."""
    return geometrie.elements(D, D["KIT"], {FAITIERE: batir}, CATEGORIE)
