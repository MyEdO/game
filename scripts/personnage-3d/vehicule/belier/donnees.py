"""Données du bélier (#2987), en mètres : un GLB pour l'engin `belier-ade2` (ADE II p.88) des `armes-de-siege` de
`src/data/trappings.json`, d'empreinte 2 (`siegeFootprint`). Aucune illustration au corpus : proportions d'adaptation
d'après la description (« un tronc d'arbre massif suspendu par des chaînes ou des cordes à une structure en bois avec
des roues. Certains ont un bout métallique pointu ») : une charpente à deux portiques sur quatre roues, le tronc pendu à
deux chaînes, sa tête de fer pointue. Repère de `maille.py` : la tête vers l'avant ; l'emprise est recentrée en x et y,
z = 0 reste le sol."""

DEFINITIONS = ("belier-ade2",)

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci")}

ESSIEU_Z = 0.45                 # hauteur des essieux : rayon de roue
ESSIEUX_Y = (-1.25, 1.25)

ROUE = {
    "voie": 0.92,
    "segments": 18,
    "bandage": (0.42, 0.45, 0.10),      # rayon intérieur, extérieur, largeur (fer)
    "jante": (0.33, 0.42, 0.09),        # rayon intérieur, extérieur, largeur (bois)
    "moyeu": (0.10, -0.16, 0.10),       # rayon, x intérieur et extérieur relatifs au plan (vers l'extérieur positif)
    "chapeau": (0.07, 0.10, 0.14),      # frette de fer au bout du moyeu : rayon, x de début et de fin
    "frette": (0.11, -0.14, -0.11),     # frette de fer côté intérieur du moyeu
    "rayons": 10,
    "rayon_section": (0.05, 0.04),      # largeur tangentielle, épaisseur en x
    "segments_moyeu": 8,
}

CHARPENTE = {
    "longerons": (0.62, 0.09, -1.65, 1.65, 0.48, 0.68),    # x du milieu, demi-largeur, y avant, y arrière, z bas, z haut
    "corps_essieu": (0.74, 0.08, 0.38, 0.50),               # demi-largeur, demi-profondeur, z bas, z haut
    "fusee": (0.05, 1.04),                                  # essieu de fer : rayon, demi-longueur
    "traverses": ([-1.55, -0.85, 0.0, 0.85, 1.55], 0.07, 0.50, 0.66),   # y, demi-profondeur, z bas, z haut
    "portiques": [-0.85, 0.85],                             # y des portiques
    "poteau": (0.08, 2.30),                                 # demi-section, z du sommet
    "chapeau": (0.78, 0.09, 0.16),                          # traverse haute : demi-largeur, demi-profondeur, hauteur
    "contrefiches": (0.55, 1.35, 0.10),                     # pied à distance du poteau en y, z d'appui au poteau, section
    "aisseliers": (0.32, 2.05, 0.08),                       # x d'appui au chapeau, z d'appui au poteau, section
    "faitiere": (0.07, 1.00, 0.12),                         # demi-largeur, demi-longueur, hauteur
}

TRONC = {
    "axe_z": 1.15,
    "segments": 14,
    # profil (y, rayon) de la tête à la queue ; rayon 0 ferme l'axe. Tête de fer pointue emmanchée sur le tronc.
    "tete": [(-2.25, 0.0), (-2.10, 0.06), (-1.95, 0.13), (-1.82, 0.19), (-1.75, 0.215), (-1.60, 0.215), (-1.60, 0.0)],
    "fut": [(-1.62, 0.0), (-1.62, 0.20), (1.55, 0.18), (1.70, 0.16), (1.72, 0.0)],
    "colliers": ([-0.85, 0.85, 1.45], 0.022),               # y des colliers de fer, rayon de section (sur le tronc)
    "maillon": (0.035, 0.009, 0.055),                       # rayon, rayon de section, pas des maillons
}
