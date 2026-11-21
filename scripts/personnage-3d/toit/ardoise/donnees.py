"""Données du faîtage d'ardoise (#4471) : le GLB `toit--ardoise`, la `faitiere` que l'hôte pose sur chaque case du faîte
d'un toit couvert d'ardoise.

La façade de La Diligence (EDO, p. 4) montre un faîte sombre, en écailles, de la matière des pans, sans bande de métal
clair : le faîtage est d'ardoises, non de zinc ni de plomb. Une ardoise par bras, couchée sur son pan, les deux jointes
sur l'arête du faîte ; chaque paire recouvre la suivante le long du faîte, sa queue levée de l'épaisseur du recouvrement,
ses coins de queue abattus en écaille. Un crochet de fer retient la queue de chaque ardoise.

Le pas des ardoises divise la longueur de la case, qui coupe une paire en son milieu à chaque bout
(`faitage.recouvrants`) : d'une case à la suivante, les ardoises se suivent sans joint ni ardoise doublée.

Matières : l'ardoise prend `prop-ardoise`, à l'emplacement `corps` que l'hôte teint de la couleur de faîtière de la
couverture ; les crochets prennent `fer-noirci`, sans couleur imposée.

Cotes d'adaptation, en mètres : aucune ne vient d'une règle."""

KIT = "ardoise"

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "ardoise": ("corps", "prop-ardoise"),
    "crochet": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"faitiere": 520}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : les chants d'une ardoise restent vifs."""

# Ardoises : leur `nombre` de paires sur la case ; `portee` : la largeur (m) d'un bras, en travers, du faîte à son bord ;
# `levee` : la hauteur (m) du dessus d'une ardoise au-dessus du pan, à sa tête puis à sa queue ; `coin` : le côté (m)
# du coin abattu de sa queue.
ARDOISES = {"nombre": 8, "portee": 0.27, "levee": (0.014, 0.046), "coin": 0.07}

# Crochet : sa `longueur` (m) sur la queue de l'ardoise, son `retour` (m) au-delà d'elle, sa `largeur` (m), sa
# `saillie` (m) au-dessus de l'ardoise, et sa `place`, la part de la portée où il se pose.
CROCHET = {"longueur": 0.045, "retour": 0.01, "largeur": 0.016, "saillie": 0.008, "place": 0.42}
