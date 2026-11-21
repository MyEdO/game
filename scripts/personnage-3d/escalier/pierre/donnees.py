"""Données de l'escalier de pierre (#4471) : le GLB `escalier--pierre`, les pièces que l'hôte pose sur les côtés d'une
case de marches d'un terrain bâti dont le kit d'escalier vaut `pierre` : le `limon`, sur un côté que borde une case
qu'on rejoint à pied ou le vide, et la `rampe`, sur un côté que borde le vide. Les marches restent celles du noyau.

Le limon : une assise de pierres de taille couchée le long du bord des marches, d'un parement à l'autre. La rampe : un
mur d'échiffre bas, ses moellons maçonnés en assises (`maconnerie.Appareil`), coiffé d'un chaperon de dalles à deux
pentes qui déborde de ses deux parements ; une demi-dalle à chaque bout se complète de celle de la case voisine. À
chaque bout de la case, chaque assise finit par une pierre de taille de façon constante, que continue celle de la case
voisine : d'une case à l'autre, les lits et les parements se suivent sans ressaut.

Les deux pièces partagent leur pied, la cote du bord : la rampe ne se pose qu'avec le limon, son mur monté sur
l'assise, plus large que lui.

Au bout d'une suite de rampes, un pilier d'échiffre termine le mur (`rampe--gauche` au bout -X, `rampe--droite` au
bout +X, `rampe--seule` aux deux, `volee.BOUTS`) : un dé de pierres de taille de la largeur du limon, monté sur lui
plus haut que le chaperon, qui s'y arrête, et couronné d'une dalle à pointe. `rampe` est la pièce du milieu, et le bout
qu'une pièce raccorde reste le sien.

Matières : la pierre, son âme et le chaperon prennent `pierre-atre`. Chaque surface nomme son emplacement de palette ;
aucune couleur ne s'y lit, et l'hôte ne leur en impose aucune : elles gardent la texture de leur matière.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""

KIT = "pierre"

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "moellons": ("corps", "pierre-atre"),
    "joint": ("joint", "pierre-atre"),
    "chaperon": ("accent", "pierre-atre"),
}

BUDGET_TRIANGLES = {"limon": 250, "rampe": 1300}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le chanfrein d'une pierre s'y fond,
ses joues gardent leurs arêtes."""

_TAILLE = {"relief": (0.0, 0.0), "chanfrein": (0.01, 0.01), "retrait": (0.015, 0.015)}
"""La façon constante d'une pierre de taille (`maconnerie.Appareil.pierre`), celle des pierres des bouts."""

# Limon : sa `hauteur` (m), son `epaisseur` (m) depuis le plan du bord, et l'`appareil` de son assise unique de pierres
# de taille (`maconnerie`).
LIMON = {
    "hauteur": 0.3, "epaisseur": 0.38,
    "appareil": {
        "assise": 0.3, "inegalite": 0.0, "joint": 0.014, "bloc": (0.5, 0.8), "decalage": 0.0, "ondulation": 0.006,
        "lit": 0.0, "boutisse": 0.0, "cale": (0.0, (0.3, 0.4)),
        "moellon": {"relief": (0.0, 0.006), "chanfrein": (0.008, 0.012), "retrait": (0.012, 0.02)},
        "taille": _TAILLE, "creux": 0.03, "harpe": (0.34, 0.34), "couronnement": None,
    },
}

# Rampe : la `hauteur` (m) du corps du mur d'échiffre, du dessus du limon à son chaperon, son `epaisseur` (m), son `retrait` (m) du
# plan du bord, et son `appareil` de moellons (`maconnerie`) ; `chaperon` : sa `hauteur` (m), ce dont il déborde
# (`debord`, m) de chaque parement, la hauteur de sa `rive` (m) et la demi-largeur de son `faite` (m), la longueur
# (m) d'une `dalle` et le `joint` (m) entre deux dalles.
RAMPE = {
    "hauteur": 0.48, "epaisseur": 0.28, "retrait": 0.05,
    "appareil": {
        "assise": 0.16, "inegalite": 0.2, "joint": 0.018, "bloc": (0.24, 0.52), "decalage": 0.4, "ondulation": 0.022,
        "lit": 0.014, "boutisse": 0.2, "cale": (0.12, (0.3, 0.42)),
        "moellon": {"relief": (0.0, 0.018), "chanfrein": (0.012, 0.026), "retrait": (0.02, 0.045)},
        "taille": _TAILLE, "creux": 0.05, "harpe": (0.3, 0.16), "couronnement": None,
    },
    "chaperon": {"hauteur": 0.12, "debord": 0.035, "rive": 0.06, "faite": 0.05, "dalle": 0.5, "joint": 0.012},
}

# Pilier : son `cote` (m), le long de la case et depuis le plan du bord, la `hauteur` (m) de son dé, du dessus du limon
# à sa couronne, bâti de l'appareil du limon ; `couronne` : l'épaisseur (m) de sa dalle, la hauteur (m) de sa pointe et
# ce dont elle se resserre de chaque côté (m).
PILIER = {"cote": 0.38, "hauteur": 0.66, "couronne": (0.06, 0.1, 0.13)}
