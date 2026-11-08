"""Données de la baliste (#2987), en mètres : un GLB pour les engins `baliste` (AA p.122) et `baliste-ade2` (ADE II p.88)
des `armes-de-siege` de `src/data/trappings.json`. Aucune illustration au corpus : proportions d'adaptation d'après les
descriptions (« des arbalètes géantes projetant des carreaux à pointe de fer qui ressemblent à des piquets de clôture »,
AA p.122 ; « attachée à une surface fixe ou est dotée de roues », ADE II p.88) : l'affût fixe à pivot, qui se monte aussi
sur un pont, deux bras dans des écheveaux de torsion, la corde tendue sur la griffe, le treuil à cliquet et un carreau
engagé. Repère de `maille.py` : le carreau vers l'avant ; l'emprise est recentrée en x et y, z = 0 reste le sol."""

DEFINITIONS = ("baliste", "baliste-ade2")

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci"), "cordage": ("cuir", "corde")}

PIVOT_Z = 0.84                  # dessus de la platine : pivot vertical de la baliste

PIED = {
    "croix": (0.85, 0.08, 0.14),        # deux poutres croisées au sol : demi-longueur, demi-largeur, hauteur
    "poteau": (0.10, 0.80),             # demi-côté, z du sommet
    "jambes": (0.70, 0.55, 0.08),       # jambes de force : distance du pied à l'axe, z de l'appui au poteau, section
    "platine": (0.17, 0.04),            # platine de fer du pivot : rayon, épaisseur
}

BALISTE = {
    "sellette": (0.19, 0.18, 0.08),     # sellette tournante : demi-largeur, demi-profondeur, épaisseur
    "joues": (0.13, 0.06, 0.18, 1.10),  # joues de la fourche : x intérieur, épaisseur, demi-profondeur, z du sommet
    "tourillon": (1.04, 0.03, 0.22),    # axe d'élévation : z, rayon, demi-longueur
    "fut": (0.11, -0.80, 1.10, 1.06, 1.20),         # glissière : demi-largeur, y avant, y arrière, z bas, z haut
    "rails": (0.03, 0.05, -0.80, 0.60, 0.04),       # x intérieur, largeur, y avant, y arrière, hauteur
    "chassis": (-0.80, -0.62, 0.42, (0.92, 1.06), (1.40, 1.50)),   # cadre des écheveaux : y avant, y arrière, demi-largeur, traverses basse et haute (z)
    "montants": [(0.11, 0.05, -0.80, -0.62), (0.37, 0.05, -0.80, -0.75)],   # x intérieur, largeur, y avant, y arrière
    "echeveaux": (0.25, -0.71, 0.07, 0.86, 1.56),   # x, y, rayon, z bas, z haut (traversent les traverses)
    "rondelles": (0.10, 0.03),          # rondelles de fer au-dessus et au-dessous du cadre : rayon, épaisseur
    "bras": ((0.95, -0.40), 0.08, 0.06, 0.07),      # bout (x, y), largeur au pied, épaisseur, longueur de la coiffe
    "corde": 0.012,                     # rayon de la corde
    "griffe": (0.05, 0.46, 0.56, 1.20, 1.30),       # demi-largeur, y avant, y arrière, z bas, z haut
    "treuil": {
        "joues": (0.11, 0.04, 0.85, 1.10, 1.06, 1.34),     # x intérieur, épaisseur, y avant, y arrière, z bas, z haut
        "axe": (0.97, 1.22, 0.06, 0.025, 0.30),             # y, z, rayon du tambour, rayon de l'axe de fer, demi-longueur
        "manivelles": (0.17, 0.025, 0.08),                  # longueur du bras, section, longueur de la poignée
        "rochet": (0.16, 0.19, 0.11),                       # x intérieur, x extérieur, rayon
        "cliquet": ((0.175, 1.10, 1.34), (0.175, 1.02, 1.30), 0.03),   # pied et bec du cliquet, section
        "dents": 12,
    },
    "carreau": (0.45, -1.06, -1.30, 0.03, 0.045, 1.23),    # y talon, y de la douille, y de la pointe, rayon du fût, de la douille, z de l'axe
    "empennes": (0.25, 0.43, 0.07, 0.005, (0.0, 60.0, -60.0)),  # y début, y fin, hauteur, épaisseur, angles depuis la verticale
}
