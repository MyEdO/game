"""Données du trébuchet à contrepoids (#2987), `trebuchet-ade2` (ADE II p.88), en mètres. Aucune illustration au
corpus : proportions d'adaptation d'après cette description. Repère de `maille.py` : le tir vers l'avant (-y) ;
l'emprise est recentrée en x et y, z = 0 reste le sol."""

DEFINITIONS = ("trebuchet-ade2",)

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci"), "corde": ("cuir", "corde"),
             "cuir": ("cuir", "cuir-tanne")}

BASE = {
    "longerons": (0.75, -3.00, 3.10, 0.30, 0.30),       # x du milieu, y avant, y arrière, largeur, hauteur
    "traverses": [(-2.70, 0.28), (1.80, 0.24), (2.85, 0.28)],   # y, profondeur ; entre les longerons
    "traverse_z": (0.02, 0.30),
    "patin": (0.0, 2.10, 0.32, 0.28),   # patin transversal sous les montants : y, demi-longueur en x, profondeur, z haut
    "bandes": [-2.70, 0.0, 2.85],       # y des bandes de fer qui ceinturent les longerons
    "bande": (0.07, 0.014),             # largeur, épaisseur
}

MONTANTS = {
    "section": 0.26,
    "haut": 4.25,                       # z haut des deux montants, posés sur les longerons à y = 0
    "jambes": [(-2.40, 3.30), (2.40, 3.30)],    # pied en y sur le longeron, z d'attache au montant : contrefiches
    "jambe": (0.20, 0.20),              # largeur, épaisseur
    "etais": (1.95, 2.30),              # étais latéraux : |x| du pied sur le patin, z d'attache au montant
    "etai": (0.18, 0.18),
}

AXE = {"z": 4.00, "rayon": 0.09, "demi_longueur": 1.00}   # axe de la verge, à y = 0

VERGE = {
    "court": 1.40,                      # bras du contrepoids, vers l'avant
    "long": 4.40,                       # bras de la fronde, vers l'arrière
    "section": (0.26, 0.30),            # largeur, épaisseur
    "repos": 52.0,                      # degrés : bras long baissé vers l'arrière, armé
    "bandes": [-1.10, -0.35, 0.35, 1.40, 2.70, 3.90],   # distances à l'axe des frettes, vers l'arrière positif
    "bande": (0.07, 0.014),
    "goupille": (0.06, 0.40),           # axe du contrepoids au bout du bras court : rayon, demi-longueur
    "crochet": (0.06, 0.16),            # crochet de la fronde au bout du bras long : demi-section, longueur
}

CONTREPOIDS = {
    "caisse": (0.50, 0.48, 1.30, 0.55),  # demi-largeur x, demi-profondeur y, hauteur, distance sous la goupille
    "planche": 0.06,                    # épaisseur des parois et du couvercle
    "lattes": 4,                        # lattes du couvercle, en travers
    "suspentes": (0.06, 0.05),          # largeur, épaisseur des suspentes de fer
    "cornieres": (0.05, 0.012),         # cornières de fer aux arêtes verticales : largeur, épaisseur
}

AUGET = {
    "y": (-0.10, 2.75),                 # glissière de la fronde, du patin à la traverse arrière
    "demi_largeur": 0.28,
    "z": 0.30,                          # dessus du fond
    "bords": (0.05, 0.12),              # épaisseur, hauteur des rebords
}

FRONDE = {
    "poche": (-1.30, 0.03),             # recul de la poche vers l'avant depuis le bout de la verge, z au-dessus du fond
    "segments": 12,
    "profil": [(0.0, 0.0), (0.0, 0.12), (0.04, 0.20), (0.09, 0.23), (0.08, 0.20), (0.03, 0.12), (0.02, 0.0)],
    "cordes": (0.18, 0.014),            # demi-écart des attaches à la poche, rayon des cordes
}

TREUIL = {
    "y": 1.80, "z": 0.62,               # axe du treuil, sur deux chevalets posés sur la traverse
    "rayon": 0.12, "demi_longueur": 0.52,
    "chevalet": (0.42, 0.16, 0.20, 0.74),   # |x|, largeur, profondeur, z haut
    "rayons": 4, "barre": (0.04, 0.38),    # barres de manœuvre à chaque bout : demi-section, longueur
}
