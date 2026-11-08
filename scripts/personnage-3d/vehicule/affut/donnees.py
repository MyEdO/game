"""Données des pièces sur l'affût de campagne (#2987), en mètres : l'affût et ses roues (canon de AA p.121, illustration
directrice, lot V3), puis la pièce que chacun porte sur ses tourillons, un GLB par pièce pour les engins `armes-de-siege`
de `src/data/trappings.json` que nomment ses `definitions`, (x, y, z) d'une pièce relatifs à l'axe des tourillons. Les
photographies citées sont rangées hors dépôt avec leur source (`vehicules-3d/references-armes-de-siege/` du dossier du
projet). Repère de `maille.py` : la bouche vers l'avant ; l'emprise est recentrée en x et y, z = 0 reste le sol."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) des matériaux de l'affût et de ses roues
# (`habillage.py`), communs à toutes les pièces. Le bronze se montre en fer noirci (#2987 : « canon marron », refusé).
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

# Le canon (AA p.121) ; `canon-ade2` (ADE II p.88) est le même engin.
CANON = {
    "definitions": ("canon-grand", "canon-moyen", "canon-petit", "canon-ade2"),
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
    "embase": (0.110, 0.34),            # embase du tourillon au flanc du fût : rayon, demi-longueur
    # anses (dauphins) : x, y de départ, y d'arrivée, flèche au-dessus du fût, rayon de section
    "anses": [(0.14, -0.14, 0.24, 0.15, 0.030), (-0.14, -0.14, 0.24, 0.15, 0.030)],
    "anse_pied": 0.24,                 # hauteur du pied des anses au-dessus de l'axe,
    "anse_segments": 7,
}

AFFUT = {
    "tourillons": (0.0, 1.15),                    # y, z de l'axe des tourillons, pivot de la pièce
    "tourillon": (0.075, 0.47),                   # rayon, demi-longueur en x
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

# AA p.123 ; ADE II p.88 ; d'après la photographie des Cannons & Mortars de Games Workshop : fût court et large,
# bouche presque à la verticale, sur l'affût à roues.
MORTIER = {
    "definitions": ("mortier", "mortier-ade2"),
    "elevation": 70,                    # degrés de la bouche au-dessus de l'horizontale
    "segments": 18,
    # profil (y, rayon) de la culasse à la bouche, relatif aux tourillons ; rayon 0 ferme l'axe. Âme creusée.
    "profil": [
        (0.30, 0.0), (0.29, 0.12), (0.25, 0.23), (0.18, 0.29),            # culasse en cul-de-lampe
        (-0.05, 0.29), (-0.07, 0.31), (-0.13, 0.31), (-0.15, 0.285),      # renfort
        (-0.50, 0.295),
        (-0.53, 0.335), (-0.62, 0.335),                                    # bourrelet de bouche
        (-0.62, 0.22), (-0.18, 0.21), (-0.18, 0.0),                        # âme
    ],
    "embase": (0.105, 0.31),            # rayon, demi-longueur
    "anses": [(0.12, -0.02, -0.30, 0.10, 0.025), (-0.12, -0.02, -0.30, 0.10, 0.025)],  # comme celles du canon
    "anse_pied": 0.28,
    "anse_segments": 6,
}

# AA p.123 ; ADE II p.88 ; d'après la photographie du Helblaster Volley Gun de Games Workshop : trois rangées de trois
# canons autour de l'arbre de la manivelle.
FEU_D_ENFER = {
    "definitions": ("canon-a-repetition-feu-d-enfer", "canon-a-repetition-feu-d-enfer-ade2"),
    "rangees": (90, 210, 330),             # angle de chaque rangée autour de l'arbre, en degrés depuis +x vers +z
    "rangee_rayon": 0.17,                  # distance de l'arbre au canon du milieu de chaque rangée
    "canons_t": (-0.125, 0.0, 0.125),      # décalage tangent des trois canons d'une rangée
    "segments": 10,
    # profil (y, rayon) d'un canon, de la culasse à la bouche cerclée, âme creusée
    "profil": [(0.30, 0.0), (0.30, 0.055), (-0.95, 0.048), (-0.97, 0.062), (-1.08, 0.062), (-1.10, 0.050),
               (-1.10, 0.026), (-0.98, 0.024), (-0.98, 0.0)],
    "frettes": [(-0.90, 0.06), (-0.50, 0.05), (0.20, 0.08)],   # y, largeur des frettes qui serrent chaque rangée
    "frette": (0.40, 0.15),                # longueur tangente, épaisseur radiale
    "tambour": (0.275, 0.16),              # rayon, longueur du tambour de fer que traversent les tourillons
    "embase": (0.090, 0.33),               # rayon, demi-longueur
    "arbre": (0.050, -1.02, 0.44),         # arbre de la manivelle : rayon, y de début et de fin
    "volant": (0.44, 0.20, 0.020, 24, 6),  # manivelle circulaire : y, rayon, rayon de section, segments, rayons
    "poignee": (0.022, 0.12),              # poignée au bord du volant : rayon, longueur vers l'arrière
}

# AA p.122 ; ADE II p.88 ; d'après l'illustration de AA p.129 (scène du gnome artilleur, INDEX.md des illustrations)
# et la photographie du Helstorm Rocket Battery de Games Workshop : neuf fusées à ogive rouge sur un cadre levé.
BATTERIE = {
    "definitions": ("batterie-tonnerre-de-feu", "batterie-tonnerre-de-feu-ade2"),
    "materiaux": {"pointe": ("accent", "toile-rouge")},
    "elevation": 20,                       # degrés, bouche levée
    "cadre": (0.30, -0.82, 0.50),          # demi-largeur, y avant, y arrière
    "fond": 0.025,                         # épaisseur du fond
    "etageres_z": (-0.20, -0.05, 0.10),    # z du fond et des barreaux qui portent chaque rangée de fusées
    "haut": 0.25,                          # z du haut du cadre
    "traverses_y": (-0.795, -0.20, 0.475),   # y des échelles (montants et barreaux) du cadre
    "traverse": (0.05, 0.025, 0.035),      # profondeur, épaisseur des barreaux, côté des montants
    "longeron": 0.035,                     # côté des longerons qui lient le haut des échelles
    "fusees_x": (-0.18, 0.0, 0.18),
    "fusee": (0.055, 0.45, -0.80, -1.10),  # rayon, y du culot, de la base de l'ogive, de la pointe
    "segments": 10,
    "embase": (0.090, 0.33),
}

# ADE II p.88 ; la photographie du Flame Cannon de Games Workshop montre un réservoir de cuivre à manomètres sur
# l'affût : proportions d'adaptation.
FLAMMES = {
    "definitions": ("canon-a-flammes-nain-ade2",),
    "materiaux": {"cuivre": ("accent", "laiton-dore")},
    "segments": 18,
    # profil (y, rayon) du réservoir à bouts bombés
    "reservoir": [(0.80, 0.0), (0.78, 0.13), (0.73, 0.22), (0.66, 0.27), (-0.25, 0.27), (-0.31, 0.22),
                  (-0.36, 0.13), (-0.38, 0.0)],
    "cercles_y": (-0.18, 0.22, 0.58),      # y des cercles de fer du réservoir
    "cercle": 0.018,                       # rayon de section
    # profil (y, rayon) de la lance, du réservoir à la buse évasée, âme creusée
    "lance": [(-0.30, 0.0), (-0.30, 0.11), (-0.44, 0.11), (-0.46, 0.085), (-1.12, 0.072), (-1.18, 0.092),
              (-1.30, 0.130), (-1.34, 0.130), (-1.34, 0.060), (-1.22, 0.050), (-1.22, 0.0)],
    "embase": (0.090, 0.33),
    "manometre": (0.30, 0.055, 0.24, 0.36),    # y, rayon, z bas et haut du manomètre sur le réservoir
    "vanne": (0.55, 0.020, 0.24, 0.36, 0.085, 0.014),  # y, rayon de la tige, z bas et haut, rayon et section du volant
    # tuyau du réservoir au talon de la lance : points (x, y, z), rayon
    "tuyau": ([(0.10, -0.05, 0.25), (0.13, -0.30, 0.24), (0.13, -0.50, 0.14), (0.08, -0.60, 0.07)], 0.025),
}
