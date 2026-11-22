"""Données de la diligence (#4471), en mètres : un GLB pour la coque `diligence` de `src/data/vehicles.json` (EDOC
p.26 : « un véhicule fermé, à quatre roues » ; la diligence commerciale, « six passagers à l'intérieur, et leurs bagages
sont arrimés au toit », « un cocher et un assistant »). Aucune illustration au corpus : proportions d'adaptation d'une
voiture du Vieux Monde, 4,4 m du train arrière à la pointe du timon, 1,9 m de moyeu à moyeu, 2,5 m à la galerie.
Repère de `maille.py` : le timon vers l'avant (-y) ; l'emprise est recentrée en x et y, z = 0 reste le sol.

Ses parties. La voiture, modelée ici : châssis de deux longerons et trois traverses, un essieu par train sur ses cales,
quatre roues à rais cerclées de fer, les grandes à l'arrière ; caisse close à membrure, une baie vitrée de chaque
côté de la portière et dans celle-ci, poignée et marchepied ; toit de cuir débordant et sa galerie de fer ; coffre et
siège du cocher, garde-corps, marchepied sur consoles ; plateau à bagages à l'arrière ; timon et palonnier. Hors du GLB :
l'attelage (créatures), les bagages et les lanternes (décors de `src/data/props.json`), le cocher (un personnage).
Aucun poste : un poste monte une pièce de siège à un bord (`postesMontes`, `hotes/godot/pont/atelier.ts`), ce que le
siège du cocher n'est pas.

Matières : `bois-chene` pour le train et la caisse, le catalogue n'ayant pas de bois peint ; la caisse a son
emplacement de palette, `vet1`, pour qu'une couleur d'apparence la peigne sans peindre le train."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "caisse": ("vet1", "bois-chene"), "cuir": ("cuir", "cuir-tanne"),
             "fer": ("metal", "fer-noirci"), "laiton": ("metal2", "laiton-dore"), "vitre": ("vitre", "verre")}

ANGLE_LISSE = 35                # degrés sous lesquels deux faces voisines se lissent (`maille.objet`)

# Triangles de chaque GLB, au plus (`test_vehicule.py`).
BUDGET_TRIANGLES = {"diligence": 6100}

# Les deux trains (`roulant.py`), les grandes roues à l'arrière : nœuds `roue_avg`, `roue_avd`, `roue_arg`, `roue_ard`.
# Les cales montent de l'essieu au milieu des longerons.
TRAIN = {"voie": 0.83, "largeur": 0.07, "essieu": (0.045, 0.004), "fusee": (0.035, 0.12, 8)}
TRAINS = {
    "av": {**TRAIN, "y": -0.55, "rayon": 0.44, "pans": 18, "bandage": 0.03, "moyeu": (0.09, 0.10),
           "cales": (0.40, 0.71, 0.07, 0.05), "tours": 3},
    "ar": {**TRAIN, "y": 1.45, "rayon": 0.66, "pans": 20, "bandage": 0.035, "moyeu": (0.10, 0.10),
           "cales": (0.40, 0.71, 0.07, 0.05), "tours": 2},
}

CHASSIS = {
    "longerons": (0.40, 0.05, -1.30, 2.00, 0.66, 0.76),    # x du milieu, demi-largeur, y avant, y arrière, z bas, z haut
    "traverses": ([-1.25, 0.35, 1.95], 0.05, 0.67, 0.75),  # y, demi-profondeur, z bas, z haut
}

CAISSE = {
    "definitions": ("diligence",),
    "boite": (0.70, -0.50, 1.60, 0.76, 2.15),              # demi-largeur, y avant, y arrière, z bas, z haut
    "paroi": 0.03,                                         # épaisseur des parois et du plancher
    "baies": (1.57, 2.00),                                 # z de l'appui et du linteau des baies
    "portiere": (0.55, 0.27),                              # y de son axe, demi-largeur
    "montant": 0.05,                                       # demi-largeur d'un montant entre deux baies ou d'un poteau d'angle
    "vitre": (0.012, 0.006),                               # retrait du vitrage sous la face de la paroi, épaisseur
    # saillie des ceintures, demi-hauteur d'une ceinture, part de cette saillie que gardent poteaux et montants
    "membrure": (0.02, 0.04, 0.7),
    "ceintures": (0.80, 1.53, 2.11),                       # z de l'axe de la ceinture basse, d'appui, haute
    "poignee": (0.19, 1.42, 0.018, 0.05, 6),               # y depuis l'axe de la portière, z, rayon, saillie, côtés
    "degre": (0.50, 0.16, 0.15, 0.02, 0.012),              # marchepied de fer : z, saillie, demi-longueur, épaisseur, rayon des tirants
}

TOIT = {
    "boite": (0.75, -0.60, 1.70, 2.15, 2.23),              # demi-largeur, y avant, y arrière, z bas, z haut
    "galerie": (0.65, -0.40, 1.50, 0.22),                  # demi-largeur, y avant, y arrière, hauteur de la lisse sur le toit
    "fer": (0.011, 5),                                     # rayon des fers de la galerie, côtés
    "montants": (5, 3),                                    # par long côté, par petit côté, coins compris
}

COCHER = {
    "coffre": (0.60, -1.20, -0.50, 0.76, 1.50),            # demi-largeur, y avant, y arrière, z bas, z haut
    "coussin": (0.58, -1.15, -0.55, 1.50, 1.62),
    "marchepied": (0.55, -1.60, -1.20, 0.97, 1.03),
    "consoles": (0.40, -1.25, 0.76, -1.45, 0.97, 0.04),    # x, puis (y, z) du pied et de la tête, section
    "garde": (0.56, 1.95, -1.08, 1.64, 0.014, 5),          # x, z de la prise sur la caisse, y et z du pied, rayon, côtés
}

PLATEAU = {
    "boite": (0.60, 1.60, 2.00, 0.76, 1.35),               # plateau à bagages de l'arrière : demi-largeur, y, y, z, z
    "sangles": ([-0.30, 0.30], 0.025, 0.006),              # x des ferrures, demi-largeur, saillie
}

TIMON = {
    "pointe": (-2.25, 0.60),                               # y, z de la pointe
    "section": (0.08, 0.08),
    "palonnier": (0.60, -1.45, 0.04, 0.03),                # demi-largeur, y, demi-profondeur, demi-hauteur
}
