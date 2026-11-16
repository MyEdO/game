"""Données des feux (#4335) : un GLB par décor `feu-camp`, `brasero` et `lampadaire` de `src/data/props.json`, bâti dans
l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au corpus : proportions
d'adaptation, chacune en fraction de la primitive de la recette qui la porte (`modele.py` lit ses cotes par
`gabarit.py`) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y.

- `feu-camp` : un cercle de pierres inégales, jointives, posées de chant ; au milieu un lit de braises en dôme bas,
  semé de morceaux ; dessus, deux bûches couchées et deux autres en travers, à l'écorce striée et aux bouts sciés, et
  trois rondins dressés en faisceau au-dessus du foyer.
- `brasero` : un trépied forgé, trois fers carrés posés sur des patins, cintrés vers une ceinture à mi-hauteur puis
  ouverts sous la cuve, dont ils sont trois des montants ; la cuve à claire-voie, trois cercles et des lames entre
  eux, sur une coupelle ; les braises en tas, qui dépassent du bord et se voient entre les lames.
- `lampadaire` : un socle de pierre taillée à deux assises ; un fût de fer à sabot, bagues et barre d'allumeur ;
  quatre consoles cintrées sous un plateau ; la lanterne évasée, quatre montants d'angle, traverses, petits-bois en
  croix sur chaque vitre ; un chapeau à corniche de laiton, toit à quatre pans, lanterneau et épi.

Partie émissive : le nœud `emet` de chaque GLB (`NOEUD_EMISSIF` de `gabarit.py`), en matière `braises`, tient à
l'aplomb du centre de la primitive `emet` de la recette, où le noyau pose le foyer de la lumière : le lit et les
morceaux de braises du feu de camp, le tas du brasero, les vitres du lampadaire.

Matières : l'écorce des bûches prend `bois-mort`, dont la texture est une écorce, et leurs bouts sciés `bois-chene`,
que la recette nomme pour la bûche entière. Le catalogue n'a ni verre ni cendre : les vitres du lampadaire prennent
`braises`, la matière que la recette donne au corps de sa lanterne, et le lit du feu de camp est tout de braises."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "feu-camp": {"pierre": ("corps", "pierre-atre"), "ecorce": ("bois", "bois-mort"), "coupe": ("bois", "bois-chene"),
                 "braises": ("accent", "braises")},
    "brasero": {"fer": ("metal", "fer-noirci"), "braises": ("accent", "braises")},
    "lampadaire": {"pierre": ("corps", "pierre-atre"), "fer": ("metal", "fer-noirci"), "laiton": ("metal2", "laiton-dore"),
                   "vitres": ("accent", "braises")},
}

BUDGET_TRIANGLES = {"feu-camp": 2400, "brasero": 2400, "lampadaire": 1600}

ANGLE_LISSE = {"pierres": 25, "buches": 40, "trepied": 35, "cuve": 35, "socle": 20, "fut": 35, "lanterne": 20, "emet": 25}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : la pierre, la braise et la
lanterne restent facettées."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

# Un caillou, pierre ou morceau de braise : côtés ; anneaux (part de sa hauteur, part de ses demi-axes) ; écart de
# chaque sommet (fraction du rayon) ; écart de sa pointe (fraction de ses demi-axes).
CAILLOUX = {
    "pierre": {"cotes": 7, "profil": ((0.0, 0.80), (0.28, 1.0), (0.70, 0.90), (0.95, 0.52)), "grain": 0.15, "pointe": 0.22},
    "braise": {"cotes": 5, "profil": ((0.0, 0.85), (0.55, 1.0)), "grain": 0.22, "pointe": 0.35},
}

FEU_CAMP = {
    # Cercle de pierres, en fractions de la boîte de pierre de la recette : nombre ; écart d'azimut (part du pas) ;
    # distance au centre (fraction du rayon du cercle des boîtes) ; demi-longueur le long du cercle, demi-épaisseur,
    # hauteur (fractions du côté et de la hauteur de la boîte) ; écart de cap (degrés).
    "pierres": {"nombre": 13, "pas": 0.16, "distance": (0.93, 0.98), "demi_longueur": (0.48, 0.66),
                "demi_epaisseur": (0.36, 0.46), "hauteur": (0.62, 0.99), "cap": 18},
    # Bûche, en fractions du rondin de la recette : côtés, tronçons ; stries (écart de rayon par côté), grain (par
    # sommet), flèche (écart de côté des anneaux du milieu, fraction du rayon) ; l'aubier du bout scié (fraction du
    # rayon) et sa saillie (fraction du rayon).
    "buche": {"cotes": 8, "troncons": 3, "stries": 0.13, "grain": 0.05, "fleche": 0.10, "aubier": 0.84, "saillie": 0.03},
    # Les bûches couchées puis celles en travers : (écartement de l'axe du foyer, longueur, rayon) en fractions de la
    # longueur et du rayon du rondin ; écart de chaque bout (fraction du rayon).
    "couchees": ((0.19, 0.90, 0.93), (-0.20, 0.86, 0.88)),
    "travers": ((0.18, 0.88, 0.86), (-0.19, 0.92, 0.90)),
    "jeu": 0.30,
    "appui": 0.88,                          # part de la somme des rayons dont une bûche en travers monte sur les couchées
    # Rondins dressés : (azimut du pied, distance du pied, azimut de la tête, distance de la tête) en fractions de la
    # longueur du rondin ; hauteurs du pied et de la tête (fractions de la hauteur du foyer) ; rayon (fraction).
    "dresses": ((48, 0.47, 215, 0.05), (168, 0.46, 0, 0.06), (290, 0.47, 95, 0.04)),
    "dresse": {"pied": 0.09, "tete": 0.86, "rayon": 0.55, "cotes": 6},
    # Lit de braises : côtés ; anneaux (fraction du rayon du foyer, part de la hauteur de son dessous) ; pointe ; grain.
    "lit": {"cotes": 12, "profil": ((1.70, 0.0), (1.42, 0.42), (0.85, 0.78), (0.36, 0.96)), "pointe": 1.0, "grain": 0.10},
    # Morceaux de braise : nombre ; distance au centre, demi-axes et hauteur (fractions du rayon du foyer) ; part de
    # leur hauteur enfouie dans le lit.
    "morceaux": {"nombre": 24, "distance": (0.20, 1.60), "demi_axe": (0.18, 0.32), "hauteur": (0.22, 0.36), "enfoui": 0.35},
}

BRASERO = {
    # Pied : fer carré (fraction du côté du pied de la recette) ; son chemin du patin au pied de la cuve, (distance à
    # l'axe en fraction de celle du pied, hauteur en fraction de celle du dessous de la cuve) ; anneaux par tronçon ;
    # patin : rayon et hauteur (fractions du côté).
    "fer": 0.52,
    "chemin": ((1.0, 0.0), (0.97, 0.14), (0.76, 0.44), (0.66, 0.62), (0.74, 0.84)),
    "pas": 3,
    "patin": (0.47, 0.28),
    "ceinture": (3, 0.32, 0.28, 16),        # rang du chemin où elle passe ; hauteur et épaisseur (fractions du côté) ; segments
    # Cuve, en fractions de son cylindre : (rayon, part de sa hauteur) de son pied, de son bord, et du bout des
    # montants ; cercles : parts de la course du pied au bord, hauteur et épaisseur (fractions de sa hauteur), segments ;
    # lames par secteur entre deux pieds, leur largeur (fraction du rayon) et leur épaisseur (fraction de la hauteur).
    "pied_de_cuve": (0.63, 0.09),
    "bord": (0.885, 0.93),
    "bout": (0.885, 0.99),
    "cercles": ((0.0, 0.52, 1.0), 0.10, 0.045, 16),
    "lames": (3, 0.070, 0.028),
    # Coupelle : (part de la hauteur de la cuve, fraction de son rayon), tournée ; segments.
    "coupelle": (((0.02, 0.0), (0.02, 0.58), (0.11, 0.66), (0.16, 0.63), (0.10, 0.0)), 12),
    # Tas de braises : côtés ; anneaux (fraction du rayon de la primitive `emet`, part de la course du dessous de la
    # cuve au dessus de la primitive `emet`) ; pointe ; grain.
    "tas": {"cotes": 12, "profil": ((0.66, 0.12), (0.82, 0.40), (0.93, 0.63), (0.84, 0.78), (0.55, 0.86), (0.22, 0.895)),
            "pointe": 0.905, "grain": 0.12},
    "morceaux": {"nombre": 40, "distance": (0.08, 0.90), "demi_axe": (0.13, 0.21), "hauteur": (0.11, 0.17), "enfoui": 0.35},
}

LAMPADAIRE = {
    # Socle, deux assises : (part de la hauteur de sa boîte, fraction de son demi-côté) ; pan coupé des angles (fraction
    # du demi-côté de l'anneau) ; grain de taille (m).
    "assises": (((0.0, 0.975), (0.46, 0.975), (0.59, 0.88)), ((0.59, 0.72), (0.87, 0.72), (1.0, 0.60))),
    "pan": 0.16,
    "taille": 0.003,
    # Fût, tourné : (part de sa longueur, fraction de son rayon, matériau du tronçon qui suit) ; segments.
    "fut": ((0.080, 0.0, "fer"), (0.080, 1.25, "fer"), (0.098, 1.25, "fer"), (0.106, 0.86, "fer"), (0.200, 0.74, "fer"),
            (0.206, 0.92, "laiton"), (0.220, 0.92, "fer"), (0.226, 0.72, "fer"), (0.590, 0.64, "fer"), (0.596, 0.84, "laiton"),
            (0.612, 0.84, "fer"), (0.618, 0.62, "fer"), (0.915, 0.52, "fer"), (0.921, 0.74, "fer"), (0.940, 0.74, "fer"),
            (0.946, 0.52, "fer"), (1.0, 0.52, "fer"), (1.0, 0.0, "fer")),
    "segments": 10,
    # Barre d'allumeur : part de la longueur du fût, demi-portée (fraction du demi-côté du socle), rayon (fraction du
    # rayon du fût), boule du bout (rayon, longueur, en fractions du rayon du fût).
    "barre": (0.880, 0.86, 0.16, (0.26, 0.36)),
    # Console : son chemin, (distance à l'axe en fraction du demi-côté du plateau, hauteur en part de la longueur du
    # fût) ; fer carré (fraction du rayon du fût) ; anneaux par tronçon.
    "console": (((0.16, 0.918), (0.36, 0.940), (0.66, 0.962), (0.80, 0.984), (0.76, 1.0)), 0.20, 3),
    # Plateau : (part de sa hauteur, fraction de son demi-côté) ; pan coupé.
    "plateau": (((0.0, 0.66), (0.5, 0.74), (0.5, 0.58), (1.0, 0.58)), 0.12),
    # Lanterne, en fractions de la boîte `emet` : demi-côté au pied et en tête ; fer carré des montants et des
    # traverses, des petits-bois ; hauteur de la traverse des petits-bois (part de la hauteur) ; retrait et épaisseur
    # de la vitre.
    "lanterne": {"pied": 0.70, "tete": 0.98, "montant": 0.14, "petit_bois": 0.055, "croisee": 0.58, "retrait": 0.035, "vitre": 0.03},
    # Chapeau, du dessous de la corniche au faîte des toits : (part de cette hauteur, fraction du demi-côté de la
    # corniche) de la corniche, du toit, du lanterneau et de l'épi ; pan coupé.
    "corniche": ((0.0, 0.76), (0.05, 0.97), (0.11, 0.97), (0.16, 0.86)),
    "toit": ((0.16, 0.88), (0.30, 0.64), (0.47, 0.42), (0.63, 0.27)),
    "lanterneau": ((0.63, 0.30), (0.69, 0.30), (0.76, 0.24), (0.80, 0.13)),
    "epi": ((0.80, 0.07), (0.86, 0.10), (0.91, 0.06)),
    "pointe": 0.955,
    "pan_du_chapeau": 0.10,
}
