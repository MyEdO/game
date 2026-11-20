"""Données de la herse (#4471) : le GLB `arete--herse`, les pièces que l'hôte pose sur les arêtes des apparences dont
`kit` vaut `herse` dans `src/data/structureAppearance.json` : une grille de fer (AA p.120), Structure qui ne s'ouvre
pas mais s'abat (`mur`, `breche`). Sa forme se lit dans ce fichier, au seul champ de forme `door.openingFrac` de
`HERSE`. Aucune couleur ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte teint de la couleur de
l'apparence posée.

La herse : une grille de fer forgé baissée dans l'épaisseur de l'arête, ses barreaux verticaux à pointe pris entre
deux rangs de traverses plates rivetées, sous une tête, entre deux montants. Seule sur son arête, elle porte ses deux
montants ; dans une ouverture de deux arêtes, chaque arête de bout porte le sien et la grille court d'un seul tenant.
La grille est à jour : aucune pièce n'en est pleine. La brèche garde la tête et les montants : ses barreaux sont rompus
sous la tête, un pan de grille couché au sol devant elle, le passage libre.

Matières : les barreaux, les montants et les traverses prennent `fer-noirci`, les rivets et les pointes `acier-battu`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import apparence, hauteur

KIT = "herse"
HERSE = "herse"
"""L'apparence dont le modèle lit la hauteur et la part de l'arête que tient la grille."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, HERSE))
"""La hauteur (m) des arêtes de la herse."""
EPAISSEUR = 0.12
"""L'épaisseur (m) de la grille, d'une tête de rivet à l'autre."""
CLAIRE_VOIE = True
"""La grille se voit de part en part : aucune pièce n'est pleine (garde de jour de `test_arete.py`)."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "barreau": ("corps", "fer-noirci"),
    "traverse": ("bois", "fer-noirci"),
    "ferrure": ("metal", "acier-battu"),
}

BUDGET_TRIANGLES = {"mur": 2400, "porte-fermee": 2400, "porte-ouverte": 2400,
                    "fenetre": 2400, "fenetre-close": 2400, "breche": 2400}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : chaque fer garde ses arêtes."""

# Grille : `barreaux` par longueur d'arête, au pas régulier d'une arête à sa voisine ; `section` d'un barreau (m) ;
# `montant` : la largeur (m) du montant d'un bout, ce que la grille laisse de l'arête (`door.openingFrac`), et son
# épaisseur (m) ; `traverses` : la hauteur de chacune (fraction de celle de la herse), leur `plat` (hauteur, épaisseur,
# m), un rang sur chaque face ; `tete` : la hauteur (m) de la tête ; `rivet` : son côté (m) ; `pointe` : la hauteur (m)
# de la pointe d'un barreau, celle de son épaule et le rayon de celle-ci.
GRILLE = {
    "barreaux": 8, "section": 0.045,
    "montant": ((1 - apparence(KIT, HERSE)["door"]["openingFrac"]) / 2 * LONGUEUR, 0.1),
    "traverses": (0.1, 0.25, 0.4, 0.55, 0.7, 0.85), "plat": (0.09, 0.0225),
    "tete": 0.16, "rivet": 0.032,
    "pointe": {"hauteur": 0.28, "epaule": 0.2, "rayon": 0.04},
}

# Brèche : la part des barreaux qui `tiennent` encore sous la tête et la `longueur` qui en reste (m, tirée) ; `tordu` :
# les points (vers le dehors, sous la tête, m) du barreau tordu qui pend encore ; `pan` : le pan de grille couché au
# sol devant la herse, ses `barreaux`, leur `longueur` (m), la distance de son milieu à l'axe de l'arête (`recul`, m),
# son `ecart` à l'axe le long de l'arête (fraction de la demi-longueur, tiré jusqu'à cette borne), son `biais` (degrés,
# tiré jusqu'à cette borne), ce dont son bout proche se lève (`levee`, m) et ses `traverses` (fractions de sa
# longueur) ; `gravats` (`geometrie.eboulis`).
BRECHE = {
    "tiennent": 0.6, "longueur": (0.25, 1.3),
    "tordu": ((0.2, 1.0), (0.5, 1.55)),
    "pan": {"barreaux": 3, "longueur": 1.2, "recul": 0.78, "ecart": 0.2, "biais": 22, "levee": 0.16,
            "traverses": (0.25, 0.7)},
    "gravats": {"nombre": 7, "etendue": (0.7, 0.6), "cote": (0.06, 0.16), "ecart": 0.25},
}
