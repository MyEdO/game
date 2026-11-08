"""Données des engins à bras de torsion (#2987), en mètres : le châssis et le bras communs, puis ce que porte le bout du
bras, la poche rigide de la catapulte (AA p.122) et du mangonneau (ADE II p.88), ou la fronde de l'onagre (ADE II p.88).
Aucune illustration au corpus : proportions d'adaptation d'après ces descriptions. Repère de `maille.py` : le tir vers
l'avant (-y) ; l'emprise est recentrée en x et y, z = 0 reste le sol."""

CATAPULTE = ("catapulte-petite", "catapulte-moyenne", "catapulte-grande", "mangonneau-ade2")
ONAGRE = ("onagre-ade2",)

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci"), "corde": ("cuir", "corde"),
             "cuir": ("cuir", "cuir-tanne")}

CHASSIS = {
    "longerons": (0.55, -1.40, 2.60, 0.22, 0.26),       # x du milieu, y avant, y arrière, largeur, hauteur
    "traverses": [(-1.25, 0.20), (0.50, 0.26), (2.40, 0.20)],   # y, profondeur ; entre les longerons, z 0.04 à 0.26
    "traverse_z": (0.04, 0.26),
    "bandes": [-1.25, 0.50, 2.40],                      # y des bandes de fer qui ceinturent les longerons
    "bande": (0.06, 0.012),                             # largeur, épaisseur
}

ECHEVEAU = {
    "axe": (0.50, 0.62),                # y, z de l'axe de torsion, pivot du bras
    "montant": (0.40, 0.88),            # profondeur en y, z haut du montant posé sur chaque longeron
    "rayon": 0.15,                      # écheveau de corde tendu entre les montants
    "segments": 14,
    "rondelle": (0.21, 0.04),           # rondelle de fer contre la face extérieure de chaque montant : rayon, épaisseur
    "cheville": (0.035, 0.32),          # levier de fer passé dans la rondelle : demi-section, demi-longueur en y
}

BUTOIR = {
    "y": -0.40,                         # y du milieu des montants du butoir
    "montant": (0.18, 1.95),            # section, z haut
    "traverse": (1.62, 1.92, 0.20, 0.06),   # z bas, z haut, profondeur, débord au-delà des montants
    "coussin": (0.36, 1.58, 1.96, 0.14),  # demi-largeur, z bas, z haut, épaisseur du coussin de cuir, face arrière
    "jambes": [(-1.30, 1.40), (0.25, 1.25)],   # pied en y (sur le longeron), z d'attache au montant : contrefiches
    "jambe": (0.12, 0.14),              # largeur, épaisseur
}

# Temps du coup du tir (`clips.coup`) : la détente du bras jusqu'au butoir, son arrêt, le retour au treuil, en secondes.
TIR = (0.22, 0.30, 1.80)

TREUIL = {
    "y": 1.85, "z": 0.33,               # axe du treuil sous le bras armé, sur deux chevalets posés sur les longerons
    "rayon": 0.08, "demi_longueur": 0.70,
    "chevalet": (0.55, 0.22, 0.20, 0.40),   # |x|, largeur, profondeur, z haut
    "rayons": 4, "barre": (0.035, 0.30),   # barres de manœuvre à chaque bout : demi-section, longueur
}

BRAS = {
    "longueur": 2.20,                   # de l'axe au bout
    "talon": 0.18,                      # prise dans l'écheveau, en avant de l'axe
    "section": (0.15, 0.17),            # largeur, épaisseur
    "repos": 3.0,                       # degrés sous l'horizontale, bras armé couché vers l'arrière
    "bandes": [0.45, 1.20, 1.95],       # distances à l'axe des frettes de fer
    "bande": (0.05, 0.012),
    "taquet": (0.12, 0.10),             # taquet de repos sur la traverse arrière : demi-largeur, demi-profondeur
}

POCHE = {
    "recul": 0.12,                      # distance du centre de la poche au bout du bras
    "segments": 16,
    # profil (hauteur au-dessus du dessus du bras, rayon) : coque extérieure, lèvre, creux
    "profil": [(0.0, 0.0), (0.0, 0.13), (0.06, 0.23), (0.15, 0.29), (0.20, 0.30), (0.20, 0.26), (0.13, 0.21),
               (0.07, 0.11), (0.06, 0.0)],
    "cercle": (0.285, 0.018),           # cercle de fer à la lèvre : rayon, section
}

FRONDE = {
    "poche": (0.40, 0.005),             # centre de la poche posée au sol : recul derrière le bout du bras, z
    "segments": 12,
    "profil": [(0.0, 0.0), (0.0, 0.10), (0.04, 0.17), (0.08, 0.20), (0.07, 0.17), (0.03, 0.10), (0.02, 0.0)],
    "cordes": (0.16, 0.012),            # demi-écart des attaches à la poche, rayon des cordes
    "crochet": (0.05, 0.10),            # demi-section, longueur du crochet de fer au bout du bras
}
