"""Données du canon de campagne (AA p.121, illustration directrice ; #2987 lot V3) : un GLB pour les trois engins
`canon-grand`, `canon-moyen`, `canon-petit` (`armes-de-siege` de `src/data/trappings.json`), en mètres. Repère de
`maille.py` : la bouche vers l'avant ; l'emprise est recentrée en x et y, z = 0 reste le sol."""

DEFINITIONS = ("canon-grand", "canon-moyen", "canon-petit")

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
# Le fût, de bronze, se montre en fer noirci (#2987 : « canon marron », refusé).
MATERIAUX = {"bronze": ("metal", "fer-noirci"), "bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci")}

ESSIEU_Z = 0.65                 # hauteur de l'essieu : rayon de roue

ROUE = {
    "voie": 0.70,               # x du plan de chaque roue
    "segments": 20,
    "bandage": (0.615, 0.650, 0.110),   # rayon intérieur, extérieur, largeur (fer)
    "jante": (0.500, 0.615, 0.095),     # rayon intérieur, extérieur, largeur (bois)
    "moyeu": (0.115, -0.22, 0.11),      # rayon, x intérieur et extérieur relatifs au plan (vers l'extérieur positif)
    "chapeau": (0.080, 0.11, 0.15),     # frette de fer au bout du moyeu : rayon, x de début et de fin
    "frette": (0.125, -0.20, -0.16),    # frette de fer côté intérieur du moyeu
    "rayons": 12,
    "rayon_section": (0.055, 0.040),    # largeur tangentielle, épaisseur en x
    "segments_moyeu": 10,
}

FUT = {
    "axe_z": 1.15,              # axe du fût et des tourillons
    "tourillon_y": 0.0,
    "segments": 16,
    # profil (y, rayon) de la culasse à la bouche ; rayon 0 ferme l'axe. Bouche évasée et cerclée, âme creusée.
    "profil": [
        (1.12, 0.0), (1.11, 0.05), (1.07, 0.07), (1.03, 0.04),            # bouton de culasse
        (0.99, 0.13), (0.95, 0.27), (0.92, 0.310), (0.83, 0.310),         # plate-bande de culasse
        (0.81, 0.290), (0.32, 0.280),
        (0.30, 0.300), (0.22, 0.300), (0.20, 0.275),                      # renfort
        (-0.58, 0.245),
        (-0.60, 0.265), (-0.68, 0.265), (-0.70, 0.242),                   # astragale
        (-1.20, 0.225),
        (-1.25, 0.240), (-1.36, 0.280), (-1.39, 0.300), (-1.40, 0.335), (-1.49, 0.335), (-1.50, 0.310),  # bouche évasée, cercle
        (-1.50, 0.140), (-1.22, 0.130), (-1.22, 0.0),                      # âme
    ],
    "tourillon": (0.075, 0.47),         # rayon, demi-longueur en x
    "embase": (0.110, 0.34),            # embase du tourillon au flanc du fût : rayon, demi-longueur
    # anses (dauphins) : x, y de départ, y d'arrivée, flèche au-dessus du fût, rayon de section
    "anses": [(0.14, -0.14, 0.24, 0.15, 0.030), (-0.14, -0.14, 0.24, 0.15, 0.030)],
    "anse_pied": 0.24,                 # hauteur du pied des anses au-dessus de l'axe,
    "anse_segments": 7,
}

AFFUT = {
    # profil (y, z) d'un flasque, sens trigonométrique vu de +x : bas avant, haut, flèche jusqu'au sol
    "flasque": [
        (-0.62, 0.50), (-0.62, 0.95), (-0.50, 1.05), (-0.13, 1.05), (-0.10, 1.10), (0.10, 1.10), (0.13, 1.05),
        (0.55, 0.98), (1.87, 0.24), (1.95, 0.10), (1.95, 0.0), (1.68, 0.0), (0.45, 0.42), (-0.15, 0.50),
    ],
    "flasque_x": [(-0.62, 0.38), (0.50, 0.38), (1.95, 0.20)],   # x du milieu du flasque selon y
    "flasque_epaisseur": 0.10,
    "entretoises": [(-0.52, 0.62, 0.90, 0.10), (0.70, 0.45, 0.70, 0.12), (1.42, 0.24, 0.44, 0.12), (1.85, 0.02, 0.22, 0.10)],  # y, z bas, z haut, profondeur
    "coin": (0.78, 0.70, 0.85, 0.40, 0.20),       # coin de mire sous la culasse : y, z bas, z haut, largeur, profondeur
    "corps_essieu": (0.70, 0.55, 0.72, 0.16),     # corps d'essieu en bois : demi-largeur, z bas, z haut, profondeur
    "fusee": (0.05, 0.86),                        # essieu de fer : rayon, demi-longueur
    "bandes": [-0.40, 0.30, 1.12],                # y des bandes de fer qui ceinturent les flasques
    "bande": (0.06, 0.012),                       # largeur, épaisseur
    "sus_bande": (0.24, 0.018, 0.04),             # sus-bande sur le tourillon : longueur en y, épaisseur, demi-largeur ajoutée
    "sabot": (1.66, 1.97, 0.03),                  # semelle de fer au bout de la flèche : y début, y fin, épaisseur
    "mascarons": [(-0.30, 0.78)],                 # y, z des mascarons de bronze, sur la face extérieure de chaque flasque
    "mascaron": (0.100, 0.040, 0.065, 0.013),     # rayon, saillie, rayon de l'anneau, rayon de section de l'anneau
}
