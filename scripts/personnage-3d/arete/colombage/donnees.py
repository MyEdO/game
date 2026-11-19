"""Données du colombage (#4471) : le GLB `arete--colombage`, les pièces que l'hôte pose sur les arêtes des apparences
dont `kit` vaut `colombage` dans `src/data/structureAppearance.json`. Sa forme se lit dans ce fichier, aux seuls champs
de forme de deux apparences : les pans de bois de `MUR` (`detail.timber` : `postEveryM`, `braces`, `wM`) et la baie de
`PORTE` (`door.openingFrac`). Aucune couleur ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte
teint de la couleur de l'apparence posée.

Illustrations directrices (hors dépôt) : la façade de La Diligence (EDO p4, `diligence-plan-et-facade`), poteaux,
entretoises et croisées à petits carreaux ; `decors/exterieur/maison/dev-diary-2_p003_x14`, les croix de Saint-André
sous les baies et les pans enduits ; `decors/exterieur/rue-quartier/LDB_p141_x3666`, les croisées et les sections du
bois.

Le pan : une sole et une sablière, un demi-poteau à chaque bout de l'arête, que le pan voisin complète, des poteaux
espacés d'au plus `ENTRAXE`, deux entretoises, et le torchis en retrait du bois sur ses deux faces. Les écharpes
(`ECHARPES`) garnissent les registres `CROIX_AUX_RANGS`. La porte ouvre une baie entre deux poteaux d'huisserie sous un
linteau ; son vantail de planches barrées tourne sur son gond vers le dedans. La fenêtre perce le registre du milieu
de part en part, entre les deux entretoises : un dormant, un meneau et un croisillon, des petits bois, sans vitre ; ses
volets de planches s'ouvrent à plat sur le dehors ou se ferment devant elle. La brèche garde la sablière et les bouts
du pan autour d'une déchirure du torchis, ses bois rompus, les éclisses de son clayonnage à nu et ses gravats au pied.

Matières : le bois d'ossature et de menuiserie prend `bois-chene`, les ferrures `fer-noirci`, le torchis
`terre-battue`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import apparence, hauteur

KIT = "colombage"
MUR, PORTE = "mur-a-ossature-en-bois", "solide-porte-en-bois"
"""Les apparences dont le modèle lit la forme : celle de ses pans de bois et celle de sa baie de porte."""

# Les pans de bois : le plus grand écart (m) entre deux poteaux ; la largeur (m) d'une écharpe, mesure des sections de
# `SECTIONS` ; la forme des écharpes d'un panneau (`ECHARPES`), `None` sans écharpe.
ENTRAXE, BOIS, CROIX = (apparence(KIT, MUR)["detail"]["timber"].get(champ) for champ in ("postEveryM", "wM", "braces"))
BAIE_DE_PORTE = apparence(KIT, PORTE)["door"]["openingFrac"]
"""La largeur de la baie de la porte, en fraction de la longueur de l'arête."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, MUR))
"""La hauteur (m) des arêtes du mur."""
EPAISSEUR = 0.24
"""L'épaisseur (m) du bois de l'ossature."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "torchis": ("corps", "terre-battue"),
    "ossature": ("bois", "bois-chene"),
    "menuiserie": ("accent", "bois-chene"),
    "croisee": ("vet1", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"mur": 300, "porte-fermee": 450, "porte-ouverte": 450, "fenetre": 620, "fenetre-close": 620,
                    "breche": 700}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : une pièce équarrie garde ses arêtes."""

SECTIONS = {"poteau": 1.6, "sole": 1.8, "sabliere": 1.8, "traverse": 1.2, "echarpe": 1.0, "linteau": 1.5}
"""La section vue de chaque bois, en fractions de `BOIS` : largeur d'un poteau ou d'une écharpe, hauteur d'une sole,
d'une sablière, d'une entretoise ou d'un linteau."""

RETRAITS = {"torchis": 0.03, "traverse": 0.006, "echarpes": (0.012, 0.016)}
"""Ce dont la face d'une pièce recule (m) sous le nu du bois, de chaque côté ; les écharpes d'un panneau l'une puis
l'autre."""

TRAVERSES = (1 / 3, 2 / 3)
"""La hauteur de l'axe de chaque entretoise, en fraction de `HAUTEUR` : elles bornent les registres du pan."""

ECHARPES = {"X": (((0, 0), (1, 1)), ((0, 1), (1, 0))), "V": (((0, 1), (0.5, 0)), ((1, 1), (0.5, 0)))}
"""Par `braces` de l'apparence, les écharpes d'un panneau : leurs deux bouts, en fractions de son jour (largeur,
hauteur)."""

CROIX_AUX_RANGS = (0,)
"""Les registres du pan, du pied à la tête, dont les panneaux portent des écharpes."""

# Porte : `hauteur` de la baie (m) ; `seuil` : sa hauteur (m) ; `jeu` du vantail à l'huisserie (m).
PORTE_DE_PAN = {"hauteur": 2.1, "seuil": 0.04, "jeu": 0.008}

# Fenêtre : `largeur` de la baie (fraction de la longueur de l'arête) ; `recouvrement` : ce dont un volet déborde la
# baie en hauteur (m).
FENETRE = {"largeur": 0.45, "recouvrement": 0.03}

# Brèche, en fractions de la demi-longueur de l'arête (abscisses) et de `HAUTEUR` (hauteurs).
# `contour` : à chaque abscisse, la hauteur où le torchis du pied s'arrête et celle où celui de la tête reprend ;
# `plancher` : la hauteur (m) qu'une crête du pied garde au moins ; `sole`, `traverses` : les abscisses entre
# lesquelles la sole puis chaque entretoise sont emportées ; `poteau` : la hauteur où pend le bout rompu d'un poteau ;
# `echarpes` : les deux bouts (abscisse, hauteur) de chaque écharpe rompue ; `eclisses` : leur `section` (m), leurs
# `places` (abscisse, 1 pendue à la déchirure de tête, -1 dressée sur celle du pied), leur `longueur` à nu (m, tirée),
# leur `ancrage` dans le torchis (m), leur écart à l'axe du mur (m, tiré jusqu'à cette borne) ; `gravats` : leur
# `nombre`, leur `etendue` (abscisse, puis mètres de part et d'autre du mur), leur `cote` (m, tiré), ce dont chaque
# coin s'écarte (fraction du côté, tirée jusqu'à cette borne), la part de bois ; `debris` : les deux bouts (abscisse,
# mètres en travers du mur) de chaque bois tombé.
BRECHE = {
    "contour": ((-0.96, 0.40, 0.40), (-0.70, 0.27, 0.58), (-0.45, 0.09, 0.76), (-0.15, 0.0, 0.83), (0.20, 0.0, 0.72),
                (0.45, 0.06, 0.79), (0.68, 0.22, 0.55), (0.96, 0.43, 0.43)),
    "plancher": 0.04,
    "sole": (-0.42, 0.52),
    "traverses": ((-0.72, 0.70), (-0.50, 0.50)),
    "poteau": 0.70,
    "echarpes": (((-0.92, 0.045), (-0.62, 0.22)), ((0.92, 0.045), (0.70, 0.18))),
    "eclisses": {"section": 0.022, "longueur": (0.10, 0.32), "ancrage": 0.08, "ecart": 0.035,
                 "places": ((-0.55, 1), (-0.36, 1), (-0.08, 1), (0.10, 1), (0.31, 1), (0.55, 1), (-0.58, -1),
                            (0.60, -1))},
    "gravats": {"nombre": 9, "etendue": (0.62, 0.45), "cote": (0.08, 0.22), "ecart": 0.3, "bois": 0.25},
    "debris": (((-0.35, -0.30), (0.25, -0.42)), ((0.05, 0.22), (0.50, 0.40))),
}
