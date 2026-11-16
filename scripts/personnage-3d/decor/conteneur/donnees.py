"""Données des conteneurs (#4335) : un GLB par décor `tonneau`, `tonneaux-pile`, `caisse` et `coffre` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au
corpus : proportions d'adaptation, chacune en fraction de la primitive de la recette qui la porte (`modele.py` lit ses
cotes par `gabarit.py`) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y.

- `tonneau` : autant de douves que le fût de la recette a de pans, bombées du pied au ventre et du ventre à la tête,
  chanfreinées à leurs joints ; quatre cercles de fer, les deux de la recette au ventre et un à chaque bout, chacun
  fermé d'une agrafe ; le fond en retrait dans le jable, de planches inégales ; une bonde au ventre.
- `tonneaux-pile` : les trois fûts de la recette, deux debout et le troisième posé sur eux, chacun un tonneau.
- `caisse` : quatre faces de planches debout, tenues par les deux ceintures de traverses de la recette et une écharpe
  entre elles ; un couvercle de planches sous deux barres ; un clou à chaque croisement.
- `coffre` : une caisse de planches couchées sur une plinthe ; un couvercle bombé de douves, à joues droites ; deux
  pentures de fer qui le ceignent, du devant à l'arrière où elles portent les charnières ; des cornières aux quatre
  angles ; une serrure de laiton, son entrée et son moraillon ; une poignée tombante à chaque bout.

Le coffre est modelé fermé : sa fiche n'a pas d'état ouvert.

Matières : celles des recettes. La caisse, dont la recette est toute de `bois-chene`, prend `fer-noirci` pour ses
clous."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS_ET_FER = {"bois": ("bois", "bois-chene"), "fer": ("metal", "fer-noirci")}
MATERIAUX = {
    "tonneau": BOIS_ET_FER,
    "tonneaux-pile": BOIS_ET_FER,
    "caisse": BOIS_ET_FER,
    "coffre": {**BOIS_ET_FER, "laiton": ("metal2", "laiton-dore")},
}

BUDGET_TRIANGLES = {"tonneau": 1850, "tonneaux-pile": 5550, "caisse": 1500, "coffre": 1500}

ANGLE_LISSE = {"douves": 12, "cercles": 30, "planches": 12, "clous": 30, "coffre": 10, "ferrures": 30}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : les douves et les planches
gardent leurs chanfreins vifs."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

CLOU = (0.016, 0.006)
"""Tête d'un clou ou d'un rivet : demi-côté et saillie, en fractions du demi-côté court du corps de la recette."""

TONNEAU = {
    "rangs": 6,                             # anneaux de douves du pied à la tête
    # Rayon des douves au ventre et aux bouts (fractions du rayon du fût le plus long de la recette), bombé en parabole.
    "ventre": 0.975,
    "bout": 0.79,
    # Joint entre deux douves : distance de l'épaule au joint (part du pas des douves), creux du joint (fraction du
    # rayon), écart d'azimut du joint (part du pas) ; écart de rayon d'une douve à l'autre (fraction).
    "joint": {"epaule": 0.28, "creux": 0.035, "ecart": 0.07},
    "jeu": 0.005,
    "epaisseur": 0.07,                      # d'une douve, fraction du rayon du fût
    "jable": 0.045,                         # retrait du fond sous la tête, part de la hauteur du tonneau
    # Fond : planches ; écart de leurs joints (part de leur largeur) ; points par arc de rive ; saillie de chacune sur
    # le jable et profondeur sous lui (parts du retrait du fond).
    "fond": {"planches": 5, "ecart": 0.14, "arc": 3, "saillie": (0.04, 0.24), "dessous": 0.1},
    # Cercles : épaisseur sur la douve et ancrage dans elle (fractions du rayon du fût), segments ; les cercles de bout,
    # leur milieu (parts de la hauteur) et leur largeur (fraction de celle des cercles de la recette) ; l'agrafe,
    # longueur (fraction du rayon), hauteur (part de la largeur du cercle), saillie (fraction du rayon).
    "cercle": {"epaisseur": 0.018, "ancrage": 0.035, "segments": 24, "bouts": (0.068, 0.932), "largeur_des_bouts": 0.8,
               "agrafe": (0.13, 0.78, 0.007)},
    # Bonde : azimuts entre lesquels sa douve se tire, hauteur (part de celle du tonneau), rayon, saillie et ancrage
    # (fractions du rayon du fût), rayon de son bout (fraction du sien), côtés.
    "bonde": {"azimuts": (240, 340), "hauteur": 0.5, "rayon": 0.068, "saillie": 0.03, "ancrage": 0.03, "cone": 0.78, "cotes": 8},
}

CAISSE = {
    # Faces, en fractions du demi-côté du corps de la recette : plan de leur parement ; épaisseur d'une planche, son
    # chanfrein ; planches par face ; écart de leurs joints (part de leur largeur) ; jour entre deux planches ; retrait
    # d'une planche sous le parement (part de son épaisseur).
    "parement": 0.955,
    "epaisseur": 0.045,
    "chanfrein": 0.012,
    "planches": 6,
    "ecart": 0.12,
    "jour": 0.008,
    "retrait": 0.22,
    # Traverses : parement (fraction du demi-côté de leur ceinture), chanfrein (fraction du demi-côté du corps).
    "traverse": {"parement": 0.992, "chanfrein": 0.016},
    # Écharpe : demi-portée (fraction du parement des faces), largeur (fraction du demi-côté du corps), épaisseur
    # (part de celle des traverses), place de ses clous (part de sa longueur).
    "echarpe": {"portee": 0.80, "largeur": 0.17, "epaisseur": 0.62, "clous": (0.12, 0.88)},
    # Couvercle, en fractions de sa boîte : demi-côté ; planches ; épaisseur des planches (part de sa hauteur) ; barres :
    # place (fraction du demi-côté), demi-longueur (fraction), largeur (fraction du demi-côté), dessus (part de la hauteur).
    "couvercle": {"demi": 0.99, "planches": 5, "epaisseur": 0.66, "barres": (0.62, 0.93, 0.17, 0.94)},
}

COFFRE = {
    # Caisse, en fractions du corps de la recette : parement des bouts et des longs côtés (fractions de ses demi-côtés) ;
    # joint du couvercle (part de sa hauteur) et demi-jour de ce joint (part) ; épaisseur d'une planche et son chanfrein
    # (fractions du demi-côté court) ; planches par face, écart de leurs joints (part de leur hauteur), jour entre elles
    # (part de la hauteur du corps).
    "parement": (0.955, 0.965),
    "joint": 0.90,
    "jour_du_joint": 0.009,
    "epaisseur": 0.075,
    "chanfrein": 0.016,
    "planches": 3,
    "ecart": 0.10,
    "jour": 0.008,
    # Plinthe : hauteur (part de celle du corps), parement (fraction des demi-côtés du corps).
    "plinthe": (0.13, 0.995),
    # Couvercle : flèche (part de la hauteur des rampants de la recette, la moitié donnant la parabole tangente aux
    # rampants), douves, épaule et creux de leurs joints (part de leur pas ; fraction du demi-côté court).
    "couvercle": {"fleche": 0.5, "douves": 7, "epaule": 0.20, "creux": 0.03},
    # Ferrures : largeur d'une penture (fraction de celle de la bande de la recette), épaisseur du fer (fraction du
    # demi-côté court), points de la penture sur le bombé ; rivets : parts de la hauteur d'une bande droite, places sur
    # le bombé (de -1 devant à 1 derrière) ; cornière : largeur d'une aile (fraction du demi-côté court) ; charnière :
    # rayon (fraction du demi-côté court), côtés.
    "penture": {"largeur": 0.88, "fer": 0.02, "points": 12},
    "rivets": {"bande": (0.25, 0.75), "bombe": (-0.72, -0.36, 0.0, 0.36, 0.72)},
    "corniere": 0.14,
    "charniere": (0.034, 6),
    # Serrure, en fractions de sa boîte : largeur de la platine, son épaisseur (fraction du demi-côté court du corps),
    # son chanfrein ; entrée : hauteur (part de la platine), rayon (fraction de sa largeur), saillie (fraction du
    # demi-côté court), côtés, longueur de sa fente sous elle (fraction de son rayon) ; moraillon : largeur (fraction de celle de la platine), pied (part de la hauteur de la platine),
    # tête (part de la joue du couvercle), épaisseur (fraction du demi-côté court).
    "serrure": {"largeur": 0.90, "epaisseur": 0.04, "chanfrein": 0.012, "entree": (0.36, 0.085, 0.008, 6, 2.4),
                "moraillon": (0.30, 0.66, 0.75, 0.022)},
    # Poignée : hauteur de ses attaches (part de celle de la caisse), demi-écartement, chute (fractions du demi-côté
    # court), rayon du fer, jeu au parement (fractions du demi-côté court), côtés ; ses coudes (part de la chute et du
    # demi-écartement) ; demi-côté de la patte de chaque attache (fraction du rayon du fer).
    "poignee": {"hauteur": 0.66, "ecartement": 0.30, "chute": 0.24, "rayon": 0.022, "jeu": 0.006, "cotes": 5, "coude": 0.6, "patte": 2},
}
