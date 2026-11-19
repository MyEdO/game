"""Données de la clôture de clayonnage (#4471) : le GLB `arete--cloture`, les pièces que l'hôte pose sur les arêtes
des apparences dont `kit` vaut `cloture` dans `src/data/structureAppearance.json`. Sa forme se lit dans ce fichier, aux
seuls champs de forme de `MUR` (`wallHeightM`, `detail.courses` : `hM`, `edgeWobble` ; `detail.timber` : `postEveryM`,
`wM`). Aucune couleur ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte teint de la couleur de
l'apparence posée.

La clôture : des pieux fichés en terre, espacés d'au plus `ENTRAXE`, un demi-pieu à chaque bout de l'arête, que la
pièce voisine complète, et des baguettes tressées d'un bout à l'autre, chacune devant un pieu puis derrière le
suivant, un lit sur deux à contre-sens, serrées lit sur lit sans laisser de jour ; la tête taillée des pieux dépasse
du dernier lit. La porte ouvre un passage entre deux pieux forts, sur un seuil de bois : une barrière de lisses, à
écharpe, pentures et loquet, y tourne sur son gond vers le dedans. Une clôture ne porte pas de fenêtre : ses deux
pièces sont le mur plein. La brèche arrache la claie d'un pieu rompu à l'autre, un pieu et des baguettes couchés au
pied, le passage libre.

Matières : les baguettes prennent `bois-mort`, les pieux `ecorce`, la barrière `bois-chene`, ses ferrures
`fer-noirci`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import apparence, hauteur

KIT = "cloture"
MUR = "cloture-en-clayonnage"
"""L'apparence dont le modèle lit la forme de sa claie et sa hauteur."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, MUR))
"""La hauteur (m) des arêtes de la clôture, à la tête de ses pieux."""
ENTRAXE, PIEU = (apparence(KIT, MUR)["detail"]["timber"][champ] for champ in ("postEveryM", "wM"))
"""Le plus grand écart (m) entre deux pieux ; le diamètre (m) d'un pieu."""
BAGUETTE = 0.04
"""L'épaisseur (m) d'une baguette, en travers de la clôture."""
EPAISSEUR = PIEU + 2 * BAGUETTE
"""L'épaisseur (m) de la clôture, d'une baguette devant un pieu à une baguette derrière lui."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "clayonnage": ("corps", "bois-mort"),
    "pieux": ("bois", "ecorce"),
    "menuiserie": ("accent", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"mur": 1300, "porte-fermee": 1200, "porte-ouverte": 1200,
                    "fenetre": 1300, "fenetre-close": 1300, "breche": 1000}

ANGLE_LISSE = 50
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le dos d'une baguette et le fût d'un
pieu s'arrondissent, le creux entre deux lits et la tête d'un pieu gardent leurs arêtes."""

# La claie : `assise`, la hauteur (m) d'un lit de baguettes ; `ondulation` : l'étendue (m) où la limite de deux lits
# s'écarte de sa place ; `recouvrement` : ce dont deux lits voisins se recouvrent (m) ; `embrasse` : la distance (m),
# de part et d'autre de l'axe d'un pieu, où une baguette reste plaquée contre lui ; `couronnement` : sa `hauteur`
# (m), ce dont la tête des pieux dépasse du dernier lit, où le jour passe entre eux.
_assises = apparence(KIT, MUR)["detail"]["courses"]
APPAREIL = {
    "assise": _assises["hM"], "ondulation": _assises["edgeWobble"], "recouvrement": 0.002, "embrasse": 0.09,
    "couronnement": {"hauteur": 0.08},
}

# Pieu : `cotes` de son fût ; `pointe` : la hauteur (m) de sa tête taillée ; `meplat` : le rayon de son sommet
# (fraction de celui du fût) ; `chute` : ce dont la tête d'un pieu courant s'abaisse (m, tirée jusqu'à cette borne) ;
# `fort` : le rayon d'un pieu de barrière (fraction de celui d'un pieu courant).
PIEUX = {"cotes": 8, "pointe": 0.045, "meplat": 0.45, "chute": 0.03, "fort": 1.9}

# Porte : `baie` : l'écart des axes des deux pieux forts (fraction de la longueur de l'arête) ; `garde`, `hauteur` :
# le pied et la tête de la barrière (m) ; `jeu` de la barrière au pieu (m) ; `seuil` : sa hauteur et sa largeur (m) ;
# `barriere` : son `epaisseur` (m), la largeur de ses `montants` (m), la hauteur de l'axe de chaque lisse (`lisses`,
# fractions de la hauteur de la barrière), leur `section` (hauteur, m, puis retrait sous le nu des montants, m),
# l'`echarpe` (largeur, épaisseur, m) au dos, les `pentures` (longueur, hauteur, épaisseur, dépassement vers le gond,
# m) sur la première et la dernière lisse, le `loquet` (longueur, hauteur, épaisseur, m ; sa hauteur, fraction de
# celle de la barrière).
PORTE = {
    "baie": 0.5, "garde": 0.1, "hauteur": 1.12, "jeu": 0.012, "seuil": (0.03, 0.07),
    "barriere": {
        "epaisseur": 0.04, "montants": 0.07, "lisses": (0.1, 0.37, 0.63, 0.9), "section": (0.075, 0.007),
        "echarpe": (0.065, 0.02), "pentures": (0.24, 0.035, 0.006, 0.05), "loquet": (0.16, 0.03, 0.008, 0.63),
    },
}

# Brèche, en fractions de la demi-longueur de l'arête (abscisses) et de `HAUTEUR` (hauteurs). `portees` : pour le
# reste de claie de chaque bout, la table (hauteur, abscisse) où s'arrête une baguette de cette hauteur ; `frange` :
# ce dont chacune s'en écarte (m, tiré jusqu'à cette borne) ; `affaissement` : ce dont son bout libre tombe et dévie
# (m, tiré jusqu'à cette borne) ; `rompus` : les pieux restés debout (abscisse, hauteur de leur cassure) ; `eclat` :
# ce dont chaque bord d'une cassure s'en écarte (m) ; `couche` : les deux bouts (abscisse, mètres vers le dedans) du
# pieu couché ; `claie` : les baguettes couchées, leurs deux bouts de même, leur `largeur` (m) ; `gravats`
# (`geometrie.eboulis`), `eclisses` : la part de baguettes parmi eux.
BRECHE = {
    "portees": (((0.0, -0.37), (0.36, -0.42), (0.5, -0.6), (0.8, -0.8), (1.0, -0.93)),
                ((0.0, 0.38), (0.2, 0.44), (0.32, 0.62), (0.7, 0.82), (1.0, 0.94))),
    "frange": 0.05, "affaissement": 0.07,
    "rompus": ((-0.5, 0.5), (0.5, 0.27)),
    "eclat": 0.035,
    "couche": ((-0.12, 0.16), (0.42, 1.15)),
    "claie": {"largeur": 0.06,
              "bouts": (((-0.42, 0.3), (0.3, 0.42)), ((-0.36, 0.42), (0.38, 0.5)), ((-0.4, 0.52), (0.28, 0.66)),
                        ((-0.3, 0.66), (0.4, 0.72)), ((-0.36, 0.78), (0.3, 0.86)))},
    "gravats": {"nombre": 7, "etendue": (0.4, 0.5), "cote": (0.04, 0.09), "ecart": 0.3, "eclisses": 0.6},
}
