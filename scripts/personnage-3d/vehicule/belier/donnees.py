"""Données du bélier (#2987), en mètres : un GLB pour l'engin `belier-ade2` (ADE II p.88) des `armes-de-siege` de
`src/data/trappings.json`, d'empreinte 2 (`siegeFootprint`). Aucune illustration au corpus : proportions d'adaptation
d'après la description (« un tronc d'arbre massif suspendu par des chaînes ou des cordes à une structure en bois avec
des roues. Certains ont un bout métallique pointu ») : une charpente à deux portiques sur quatre roues, le tronc pendu à
deux chaînes, sa tête de fer pointue. Repère de `maille.py` : la tête vers l'avant ; l'emprise est recentrée en x et y,
z = 0 reste le sol."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci")}

ANGLE_LISSE = 35                # degrés sous lesquels deux faces voisines se lissent (`maille.objet`)

# Triangles de chaque GLB, au plus (`test_vehicule.py`).
BUDGET_TRIANGLES = {"belier": 7400}

# Les deux trains de la charpente (`roulant.py`), les mêmes : nœuds `roue_avg`, `roue_avd`, `roue_arg`, `roue_ard`.
TRAIN = {
    "voie": 0.92, "rayon": 0.45, "largeur": 0.10, "pans": 18, "bandage": 0.03, "moyeu": (0.10, 0.13),
    "essieu": (0.06, 0.005), "fusee": (0.05, 0.15, 8), "tours": 1,
}
TRAINS = {"av": {**TRAIN, "y": -1.25}, "ar": {**TRAIN, "y": 1.25}}

CHARPENTE = {
    "longerons": (0.62, 0.09, -1.65, 1.65, 0.48, 0.68),    # x du milieu, demi-largeur, y avant, y arrière, z bas, z haut
    "traverses": ([-1.55, -0.85, 0.0, 0.85, 1.55], 0.07, 0.50, 0.66),   # y, demi-profondeur, z bas, z haut
    "portiques": [-0.85, 0.85],                             # y des portiques
    "poteau": (0.08, 2.30),                                 # demi-section, z du sommet
    "chapeau": (0.78, 0.09, 0.16),                          # traverse haute : demi-largeur, demi-profondeur, hauteur
    "contrefiches": (0.55, 1.35, 0.10),                     # pied à distance du poteau en y, z d'appui au poteau, section
    "aisseliers": (0.32, 2.05, 0.08),                       # x d'appui au chapeau, z d'appui au poteau, section
    "faitiere": (0.07, 1.00, 0.12),                         # demi-largeur, demi-longueur, hauteur
}

TRONC = {
    "definitions": ("belier-ade2",),
    "axe_z": 1.15,
    "segments": 14,
    # profil (y, rayon) de la tête à la queue ; rayon 0 ferme l'axe. Tête de fer pointue emmanchée sur le tronc.
    "tete": [(-2.25, 0.0), (-2.10, 0.06), (-1.95, 0.13), (-1.82, 0.19), (-1.75, 0.215), (-1.60, 0.215), (-1.60, 0.0)],
    "fut": [(-1.62, 0.0), (-1.62, 0.20), (1.55, 0.18), (1.70, 0.16), (1.72, 0.0)],
    "colliers": ([-0.85, 0.85, 1.45], 0.022),               # y des colliers de fer, rayon de section (sur le tronc)
    "maillon": (0.035, 0.009, 0.055),                       # rayon, rayon de section, pas des maillons
    "balance": (20, 12, (0.70, 0.15, 0.60)),                # degrés en arrière, en avant, temps de chaque mouvement (s)
}
