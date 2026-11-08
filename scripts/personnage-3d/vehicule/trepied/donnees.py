"""Données des pièces sur trépied à pivot (#2987), en mètres : le trépied de bois ferré et son pivot vertical, puis la
pièce que chacun porte dans sa fourche, un GLB par pièce pour les engins `armes-de-siege` de `src/data/trappings.json`
que nomment ses `definitions`. Aucune illustration au corpus : proportions d'adaptation d'après les descriptions de AA
p.123, le pierrier « monté sur un pivot ou sur un trépied », le canon à répétition, arme d'épaule (« s'enfonce
violemment dans son épaule »), posé sur le même trépied parce que le jeu le place seul comme emplacement d'engin, sans
porteur. Repère de `maille.py` : la bouche vers l'avant ; l'emprise est recentrée en x et y, z = 0 reste le sol."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) des matériaux du trépied et de la
# fourche (`habillage.py`), communs aux deux pièces. Le bronze se montre en fer noirci (#2987 : « canon marron », refusé).
MATERIAUX = {"bronze": ("metal", "fer-noirci"), "bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci")}

# Temps du coup de chaque tir (`clips.coup`) : départ, tenue, retour, en secondes. La pièce ne recule pas sur son pivot.
TIR = (0.05, 0.05, 0.50)

TREPIED = {
    "moyeu": (0.10, 0.70, 0.90),        # tête de bois : rayon, z bas, z haut
    "frettes": [0.74, 0.86],            # z des frettes de fer qui ceinturent la tête
    "frette": (0.012, 0.016),           # rayon de section, saillie sur la tête
    "pieds": [90, 210, 330],            # azimut de chaque pied (degrés depuis +x) : un en arrière, deux en avant
    "pied_haut": (0.08, 0.80),          # attache d'un pied sous la tête : rayon, z
    "pied_bas": (0.62, 0.03),           # bout d'un pied : rayon, z
    "pied_section": (0.075, 0.060),     # largeur, épaisseur
    "sabot": (0.10, 0.03),              # semelle de fer sous chaque pied : côté, épaisseur
    "pivot": (0.032, 0.90, 1.00),       # broche de fer de la fourche dans la tête : rayon, z bas, z haut
    "segments": 12,
}

FOURCHE = {
    "tourillons_z": 1.12,               # axe des tourillons, pivot de la pièce
    "traverse": (0.135, 1.00, 1.04, 0.05),   # demi-largeur, z bas, z haut, profondeur
    "bras": (0.110, 0.135, 1.16, 0.05),      # x intérieur, x extérieur, z haut, profondeur
}

# Le pierrier (AA p.123) : un tromblon massif de bronze, sa queue de manœuvre vers l'arrière.
PIERRIER = {
    "definitions": ("pierrier",),
    "segments": 14,
    # profil (y, rayon) de la culasse à la bouche, relatif aux tourillons ; rayon 0 ferme l'axe, bouche évasée creusée
    "profil": [
        (0.30, 0.0), (0.29, 0.030), (0.26, 0.036), (0.24, 0.060), (0.20, 0.076), (0.15, 0.076),   # bouton, culasse
        (0.13, 0.066), (-0.40, 0.058),
        (-0.42, 0.068), (-0.46, 0.068), (-0.48, 0.060),                                           # renfort
        (-0.66, 0.068), (-0.78, 0.098), (-0.85, 0.122), (-0.88, 0.122),                           # bouche évasée
        (-0.88, 0.092), (-0.70, 0.050), (-0.70, 0.0),                                             # âme
    ],
    "tourillon": (0.024, 0.135),        # rayon, demi-longueur en x
    "queue": [(0.27, 0.0), (0.52, -0.035), (0.80, -0.090)],   # chemin (y, z) de la queue de fer
    "queue_section": 0.022,
    "pommeau": (0.040, 0.06),           # boule de la queue : rayon, longueur en y
    "tir": {"recul": 0.0, "ressaut": 6},   # bouche levée au départ (degrés) : `clips.tirer`
}

# Le canon à répétition (AA p.123) : sept canons en barillet hexagonal, manivelle circulaire, leviers, crosse d'épaule.
CANON_A_REPETITION = {
    "definitions": ("canon-a-repetition",),
    "materiaux": {"laiton": ("accent", "laiton-dore")},
    "canons": (0.044, 0.018, -0.13, -1.05, 10),   # rayon du barillet, rayon d'un canon, y culasse, y bouche, segments
    "plaques": [(-0.96, 0.025), (-0.58, 0.025), (-0.16, 0.035)],   # y et demi-épaisseur des plaques hexagonales
    "plaque_rayon": 0.076,              # rayon circonscrit d'une plaque (six pans, sommets face aux canons)
    "boite": (0.052, 0.065, -0.13, 0.12),   # boîte de culasse : demi-largeur, demi-hauteur, y avant, y arrière
    "tourillon": (0.020, 0.135),
    "manivelle": (-0.11, 0.105, 0.008, 3),  # roue de manivelle : y, rayon, rayon de section, rais
    "poignee": (0.012, 0.07),           # poignée de la roue : rayon, longueur vers l'avant
    "leviers": [(0.06, 0.02, 0.10, 0.09), (0.09, -0.01, 0.15, 0.06)],   # y, z de pied, y, z de tête (flanc droit)
    "levier_section": (0.014, 0.010),
    # profil (y, z) de la crosse, relatif aux tourillons, extrudé sur sa demi-épaisseur
    "crosse": [(0.10, 0.04), (0.30, 0.0), (0.70, -0.06), (0.73, -0.08), (0.73, -0.23), (0.69, -0.24),
               (0.40, -0.13), (0.18, -0.08), (0.10, -0.07)],
    "crosse_epaisseur": 0.030,
    "plaque_de_couche": (0.70, 0.74),   # y de la plaque de fer au talon de la crosse
    "tir": {"recul": 0.0, "ressaut": 2, "tourne": "barillet", "tours": 2},   # le barillet tourne à la manivelle
}
