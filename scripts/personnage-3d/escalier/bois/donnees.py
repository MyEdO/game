"""Données de l'escalier de bois (#4471) : le GLB `escalier--bois`, les pièces que l'hôte pose sur les côtés d'une case
de marches d'un terrain bâti dont le kit d'escalier vaut `bois` : le `limon`, sur un côté que borde une case qu'on
rejoint à pied ou le vide, et la `rampe`, sur un côté que borde le vide. Les marches restent celles du noyau.

Le limon : une planche de chêne posée de chant contre le bord des marches, coiffée d'un chapeau mouluré qui déborde
vers le dehors. La rampe : des balustres tournés entre un pied et une tête carrés, dressés d'aplomb à pas régulier,
sous une main courante à pans. Le pas des balustres divise la longueur de la case, le premier et le dernier à un
demi-pas des bouts : d'une case à la suivante, aucun balustre ne double ni ne manque. À chaque bout, une demi-éclisse
de fer clouée sur la joue du limon et sur celle de la main courante se complète de celle de la case voisine.

Les deux pièces partagent leur pied, la cote du bord : la rampe ne se pose qu'avec le limon, ses balustres dressés
sur son chapeau.

Au bout d'une suite de rampes, un poteau termine la main courante (`rampe--gauche` au bout -X, `rampe--droite` au bout
+X, `rampe--seule` aux deux, `volee.BOUTS`) : un pilastre tourné entre un pied et une tête carrés, plus fort qu'un
balustre, coiffé d'une pointe, dressé sur le limon à la place du balustre du bout, de la face de celui-ci au bout de
la case ; la main courante s'arrête dans sa tête, sans éclisse. `rampe` est la pièce du milieu, et le bout qu'une pièce
raccorde reste le sien.

Matières : le bois prend `bois-chene`, les éclisses et leurs clous `fer-noirci`. Chaque surface nomme son emplacement
de palette ; aucune couleur ne s'y lit, et l'hôte ne leur en impose aucune : elles gardent la texture de leur matière.

Cotes d'adaptation, en mètres : aucune ne vient d'une règle."""

KIT = "bois"

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "limon": ("bois", "bois-chene"),
    "balustre": ("planche", "bois-chene"),
    "main-courante": ("accent", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"limon": 140, "rampe": 1050}

ANGLE_LISSE = 40
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le fût tourné d'un balustre
s'arrondit, les pans de la main courante et les arêtes des planches restent vifs."""

# Limon : sa `hauteur` (m) du pied au dessus du chapeau, l'`epaisseur` (m) de sa planche depuis le plan du bord ;
# `chapeau` : sa hauteur, ce dont il déborde de la planche vers le dehors, et son chanfrein (m).
LIMON = {"hauteur": 0.28, "epaisseur": 0.08, "chapeau": (0.04, 0.02, 0.01)}

# Rampe : `balustres`, leur nombre sur la case ; `axe` : leur distance au plan du bord (m) ; `carre` : le côté (m) de
# leur pied et de leur tête, dressés sur le chapeau du limon ; `pied`, `tete` : la hauteur (m) où finit le pied carré
# et celle où commence la tête ;
# `fut` : le profil tourné entre eux, (part de sa hauteur, rayon en m), et le nombre de ses `cotes` ;
# `main_courante` : la hauteur (m) de son dessous et de son dessus, sa largeur (m) depuis le plan du bord et le
# chanfrein (m) de ses quatre arêtes.
RAMPE = {
    "balustres": 8, "axe": 0.04, "carre": 0.045, "pied": 0.4, "tete": 0.8,
    "fut": {"profil": ((0.0, 0.016), (0.16, 0.022), (0.4, 0.014), (0.85, 0.012), (1.0, 0.018)), "cotes": 8},
    "main_courante": {"dessous": 0.88, "dessus": 0.95, "largeur": 0.08, "chanfrein": 0.014},
}

# Poteau : la hauteur (m) où finit son `pied` carré, celle où commence sa `tete`, qui reçoit la main courante, et celle
# de son `dessus` ; `fut` : le profil tourné entre eux, comme celui d'un balustre ; `pointe` : la hauteur (m) de celle
# qui le coiffe et ce dont elle se resserre de chaque côté (m). Son côté n'est pas une cote : le demi-pas des balustres
# et le demi-côté de leur carré.
POTEAU = {
    "pied": 0.46, "tete": 0.82, "dessus": 1.02,
    "fut": {"profil": ((0.0, 0.05), (0.14, 0.068), (0.4, 0.046), (0.85, 0.038), (1.0, 0.056)), "cotes": 10},
    "pointe": (0.06, 0.045),
}

# Éclisse : la demi-plaque de fer de chaque bout, sa `longueur` le long de la pièce, son `epaisseur` (m) ; `clou` : le
# côté et la saillie de sa tête (m), et sa distance au bout de la pièce (m) ; `limon`, `main_courante` : les hauteurs
# (m) entre lesquelles elle tient sur la joue de chacun.
ECLISSE = {"longueur": 0.06, "epaisseur": 0.006, "clou": (0.016, 0.005, 0.035),
           "limon": (0.05, 0.19), "main_courante": (0.897, 0.927)}
