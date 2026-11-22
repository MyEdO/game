"""Données du kit de toit de chaume (#4471) : le GLB `toit--chaume`, la `faitiere`, l'`aretier` et la `noue` que l'hôte
pose sur les faîtes, les arêtes saillantes montantes et les arêtes rentrantes d'un toit couvert de chaume.

Sur le faîte et l'arêtier, une selle de paille épaisse, à cheval sur l'arête, au dos arrondi, dont le bord de chaque
bras est taillé en dents. Sur chaque bras, deux baguettes de noisetier la tiennent, filées d'un bout à l'autre de la
pièce, et des baguettes croisées vont en zigzag de l'une à l'autre. Sur le dos de la faîtière court une tresse de
paille à trois brins, qui s'arrête au faîte : l'arêtier n'en porte pas. La noue est un bourrage de paille couché au
fond du creux, au dessus arrondi en chéneau, au bord en dents plus fines, sans baguette ni tresse.

Le pas des dents, celui du zigzag et celui de la tresse divisent la longueur de la pièce : d'une pièce à la suivante,
la selle, les baguettes et les brins se suivent sans joint.

Matières : la selle prend `paille`, à l'emplacement `corps` que l'hôte teint de la couleur de faîtière de la
couverture ; la tresse prend `paille` et les baguettes `bois-mort`, sans couleur imposée.

Cotes d'adaptation, en mètres : aucune ne vient d'une règle."""

KIT = "chaume"

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "selle": ("corps", "paille"),
    "tresse": ("accent", "paille"),
    "baguette": ("bois", "bois-mort"),
}

BUDGET_TRIANGLES = {"faitiere": 1400, "aretier": 960, "noue": 620}

ANGLE_LISSE = 80
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le dos de la selle et les brins
s'arrondissent, les bouts de la case et les baguettes gardent leurs arêtes."""

# Selle, par pièce : `dos`, son dessus de l'arête vers le bord, (distance à l'arête en travers, levée au-dessus du pan)
# en mètres ; `dents` : leur nombre sur la pièce ; `portee` : la largeur (m) d'un bras au creux d'une dent puis à sa
# pointe ; `bord` : la levée (m) de son bord.
SELLE = {
    "faitiere": {"dos": ((0.0, 0.15), (0.07, 0.19), (0.2, 0.13), (0.33, 0.11)), "dents": 8, "portee": (0.38, 0.47),
                 "bord": 0.05},
    "aretier": {"dos": ((0.0, 0.15), (0.07, 0.19), (0.2, 0.13), (0.33, 0.11)), "dents": 11, "portee": (0.38, 0.47),
                "bord": 0.05},
    "noue": {"dos": ((0.0, 0.17), (0.1, 0.11), (0.24, 0.07), (0.34, 0.05)), "dents": 11, "portee": (0.4, 0.45),
             "bord": 0.035},
}

# Tresse, sur les `pieces` qui la portent : `periodes`, leur nombre sur la pièce ; `pas` : le nombre de sections d'une
# période ; `rayon` : celui d'un brin (m), et `cotes`, le nombre de ceux de sa section ; `ecart` : ce dont un brin
# s'écarte de l'arête en travers (m) ; `passe` : ce dont il monte et descend pour croiser les deux autres (m) ;
# `assise` : la hauteur (m) de l'axe de la tresse au-dessus du dos de la selle.
TRESSE = {"pieces": ("faitiere",), "periodes": 4, "pas": 6, "rayon": 0.03, "cotes": 5, "ecart": 0.06, "passe": 0.018,
          "assise": 0.012}

# Baguettes : `places`, la distance à l'arête en travers (m) de chacune des deux baguettes d'un bras ; `cotes` : le côté
# (m) de la section d'une baguette filée, puis d'une baguette croisée ; `croisees` : le nombre de celles-ci sur chaque
# pièce qui porte des baguettes, pair, pour que le zigzag finisse où il commence.
BAGUETTES = {"places": (0.2, 0.31), "cotes": (0.022, 0.018), "croisees": {"faitiere": 8, "aretier": 12}}
