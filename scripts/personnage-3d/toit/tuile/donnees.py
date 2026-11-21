"""Données du faîtage de tuile (#4471) : le GLB `toit--tuile`, la `faitiere` que l'hôte pose sur chaque case du faîte
d'un toit couvert de tuile.

Des tuiles faîtières demi-rondes de terre cuite, à cheval sur le faîte, chacune plus large à sa queue, qui recouvre la
tête de la suivante et porte un bourrelet. Elles sont scellées : un solin de mortier, filé d'un bout à l'autre de la
case, garnit de chaque côté l'intervalle entre leur bord et le pan.

Le pas des tuiles divise la longueur de la case, qui coupe une tuile en son milieu à chaque bout
(`faitage.recouvrants`) : d'une case à la suivante, les tuiles se suivent sans joint ni tuile doublée.

Matières : la tuile prend `terre-cuite`, à l'emplacement `corps` que l'hôte teint de la couleur de faîtière de la
couverture ; le mortier prend `pierre-atre`, sans couleur imposée.

Cotes d'adaptation, en mètres : aucune ne vient d'une règle."""

KIT = "tuile"

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "tuile": ("corps", "terre-cuite"),
    "mortier": ("joint", "pierre-atre"),
}

BUDGET_TRIANGLES = {"faitiere": 500}

ANGLE_LISSE = 40
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le dos d'une tuile s'arrondit, son
bord et son bourrelet restent vifs."""

# Tuiles : leur `nombre` sur la case ; `rayon` : celui de leur dos (m), à la tête puis à la queue ; `lit` : la hauteur
# (m) de leur bord au-dessus du pan, à la queue ; `pans` : le nombre de facettes de leur dos ; `bourrelet` : sa longueur
# (m) à la queue et ce dont il passe le dos (m).
TUILES = {"nombre": 5, "rayon": (0.15, 0.175), "lit": 0.05, "pans": 10, "bourrelet": (0.045, 0.012)}

# Solin : son `debord` (m) sur le pan au-delà du bord de la tuile la plus large, sa `levee` (m) au-dessus du bord des
# tuiles, et sa `prise` (m) sous la tuile la plus étroite.
SOLIN = {"debord": 0.035, "levee": 0.01, "prise": 0.03}
