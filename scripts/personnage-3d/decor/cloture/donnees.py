"""Données des clôtures (#4335) : un GLB par décor `barriere`, `cloture`, `palissade`, `balustrade-bois` et
`bastingage` de `src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`).
Aucune illustration au corpus : proportions d'adaptation, chacune en fraction de la primitive qui la porte (son rang
dans la recette), dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le haut).

- `barriere` : deux poteaux carrés à chanfreins arrêtés, la tête en pointe de diamant ; les deux lisses de la recette,
  refendues, de section inégale, qui traversent les poteaux et y sont chevillées ; une écharpe sur leur face avant et
  un montant sur leur face arrière, chevillés aux deux lisses.
- `cloture` : les deux lisses de la recette, refendues ; ses cinq piquets, planches de largeur et de hauteur inégales,
  la tête taillée en pointe désaxée, deux clous à chaque lisse ; un échalas plus étroit et plus bas au milieu de
  chaque travée ; l'un d'eux tous de travers et affaissé.
- `palissade` : les cinq pieux de la recette, jointifs, de section bosselée qui défile vers la tête, l'écorce
  gardée, la tête épointée à la hache jusqu'au bois ; la traverse de la recette et une traverse basse, refendues,
  chevillées à chaque pieu.
- `balustrade-bois` : une lisse basse chanfreinée et une main courante moulurée, d'un poteau à l'autre ; un poteau à
  chanfreins arrêtés sous chaque pommeau tourné de la recette ; un balustre tourné en vase à la place de chaque
  balustre courant de la recette et un autre au milieu de chaque travée.
- `bastingage` : une serre moulurée au pied, la lisse de pavois arrondie en tête ; les trois jambettes de la recette,
  à chanfreins arrêtés ; le bordé de la recette, en virures inégales prises entre les jambettes, une gournable par
  virure sur chaque face de chaque jambette ; le jour de la recette sous la lisse.

Matières : celles des recettes. La clôture, dont la recette est toute de `bois-chene`, prend `fer-noirci` pour ses
clous ; les pieux de la palissade gardent `bois-mort`, dont la texture est une écorce, et leur pointe taillée prend
`bois-chene`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
MATERIAUX = {
    "barriere": BOIS,
    "cloture": {**BOIS, "fer": ("metal", "fer-noirci")},
    "palissade": {**BOIS, "ecorce": ("bois", "bois-mort")},
    "balustrade-bois": BOIS,
    "bastingage": {**BOIS, "vieux": ("bois", "bois-mort")},
}

BUDGET_TRIANGLES = {"barriere": 1000, "cloture": 900, "palissade": 1200, "balustrade-bois": 2500, "bastingage": 1100}

ANGLE_LISSE = {"bois": 40, "clous": 30, "pieux": 35}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein garde ses
arêtes, une pièce tournée et un pieu sont ronds."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête adoucie, en fraction du plus petit demi-côté de la section."""

CLOU = (0.075, 0.04)
"""Tête d'un clou (`geometrie.clou`) : demi-côté et saillie, en fractions de la demi-largeur d'un piquet."""

# Pièce refendue (`modele.refendue`) : `stations` : sections le long de la pièce ; `section` : part de chaque
# demi-côté que garde une section, tirée ; `ecart` : déport de son centre (fraction de chaque demi-côté, tiré jusqu'à
# cette borne) ; `chanfrein` : de ses arêtes (fraction de son plus petit demi-côté, tiré).
REFENDUE = {"stations": 7, "section": (0.60, 0.94), "ecart": 0.06, "chanfrein": (0.22, 0.60)}

# Barrière : rang des poteaux et des lisses, la basse puis la haute, dans la recette.
# `poteau` : demi-côté (fraction de celui de la primitive) et profil (part de la longueur, part du demi-côté,
# chanfrein en fraction du demi-côté).
# `cheville` : rayon (fraction du demi-côté du poteau).
# `echarpe`, `montant` : demi-épaisseur (fraction de la demi-épaisseur d'une lisse), demi-largeur (fraction de la
# demi-hauteur d'une lisse) ; `pose` : distance de leur face de pose à l'axe des lisses (fraction de la demi-épaisseur
# d'une lisse) ; `portee` de l'écharpe : place de ses bouts (fraction de la place des poteaux) ; `depasse` : ce dont
# le montant dépasse l'axe de chaque lisse (fraction de la hauteur d'une lisse) ; `chevilles` de l'écharpe : leur
# place (parts de sa longueur).
BARRIERE = {
    "poteaux": (0, 1), "lisses": (2, 3),
    "poteau": {"cote": 0.90,
               "profil": ((0.0, 0.88, 0.08), (0.02, 1.0, 0.08), (0.07, 1.0, 0.08), (0.10, 1.0, 0.36), (0.33, 1.0, 0.36),
                          (0.36, 1.0, 0.08), (0.50, 1.0, 0.08), (0.53, 1.0, 0.36), (0.73, 1.0, 0.36), (0.76, 1.0, 0.08),
                          (0.93, 1.0, 0.08), (1.0, 0.30, 0.08))},
    "cheville": 0.20,
    "pose": 0.70,
    "echarpe": {"section": (0.34, 0.85), "portee": 0.84, "chevilles": (0.035, 0.965)},
    "montant": {"section": (0.34, 0.80), "depasse": 0.85},
}

# Clôture : rang des lisses, des piquets et de la tête de chacun dans la recette.
# `piquet` : `largeur` (part de celle de la primitive, tirée), `epaisseur` (part de celle de la primitive), `hauteur`
# (part de celle de la tête de la recette, tirée) ; `pose` : ce dont les lisses avancent vers les piquets (fraction
# de leur demi-épaisseur) ; `pointe` : hauteur de sa tête taillée (fraction de sa largeur) ; `faite` : déport du faîte
# (fraction de sa demi-largeur, tiré jusqu'à cette borne) ; `meplat` : demi-largeur du faîte (fraction de celle du
# piquet) ; `penche` : pente d'un piquet (rapport de son déport à sa hauteur, tirée jusqu'à cette borne) ;
# `travers` : pente du piquet de travers, `affaisse` : part de sa hauteur qu'il garde ; `clous` : leur place en
# travers du piquet (fractions de sa demi-largeur).
# `entre` : échalas ajoutés entre deux piquets ; `echalas` : sa largeur et sa hauteur (parts de celles d'un piquet).
CLOTURE = {
    "lisses": (0, 1), "piquets": (2, 3, 4, 5, 6), "tetes": (7, 8, 9, 10, 11),
    "piquet": {"largeur": (0.74, 0.98), "epaisseur": 0.86, "hauteur": (0.82, 0.94), "pose": 0.25, "pointe": 0.55,
               "faite": 0.5, "meplat": 0.12, "penche": 0.012, "travers": 0.075, "affaisse": 0.93,
               "clous": (-0.42, 0.38)},
    "entre": 1, "echalas": (0.62, 0.86),
}

# Palissade : rang des pieux et de la traverse dans la recette.
# `pieu` : `rayons` en travers et en épaisseur (fractions de celui de la primitive), `cotes`, `rangs` d'anneaux du
# pied à l'épaule ; `bosse` : rayon de chaque côté (part, tirée) ; `defilement` : part du rayon perdue du pied à
# l'épaule ; `flexe` : déport d'un anneau (fraction du rayon, tiré jusqu'à cette borne) ; `pointe` : sa hauteur
# (fraction du rayon, tirée) ; `coupe` : part du rayon de l'épaule où la taille commence, `enfonce` : ce dont elle
# s'ancre sous l'épaule (fraction du rayon) ; `sommet` : déport de la pointe (fraction du rayon, tiré jusqu'à cette
# borne).
# `traverses` : par traverse, hauteur de son axe (part de celle de la traverse de la recette), demi-longueur (part de
# celle de la recette), demi-épaisseur et recul de sa face vue sous celle de la recette (fractions de l'épaisseur de
# la recette), demi-hauteur (part de celle de la recette).
# `cheville` : rayon (fraction de la hauteur de la traverse de la recette).
PALISSADE = {
    "pieux": (0, 1, 2, 3, 4), "traverse": 5,
    "pieu": {"rayons": (0.99, 0.84), "cotes": 9, "rangs": 5, "bosse": (0.93, 1.0), "defilement": 0.07, "flexe": 0.03,
             "pointe": (1.3, 1.8), "coupe": 0.93, "enfonce": 0.06, "sommet": 0.25},
    "traverses": ((1.0, 1.0, 0.50, 0.20, 0.5), (0.38, 0.84, 0.36, 0.50, 0.42)),
    "cheville": 0.17,
}

# Balustrade : rang de la lisse basse, de la lisse haute, des balustres courants et, par poteau, de son balustre et
# de son pommeau dans la recette.
# `plinthe`, `main_courante` : demi-profil du pied à la tête (part de la demi-largeur, part de la hauteur).
# `entre` : balustres ajoutés par travée ; `balustre` : rayon (fraction de celui de la primitive), côtés, ancrage
# dans chaque lisse (part de la hauteur de la lisse basse), profil (part de la longueur, part du rayon).
# `poteau` : demi-côté (fraction du rayon du pommeau), profil ; `pommeau` : rayon (fraction de celui de la
# primitive), côtés, profil.
# `cheville` : rayon (fraction du demi-côté du poteau), hauteur sur la lisse basse et sur la main courante (parts de
# leur hauteur), place de sa tête (fraction de la demi-largeur de la lisse).
BALUSTRADE = {
    "lisse_basse": 0, "lisse_haute": 1, "balustres": (3, 4, 5, 6, 7, 8, 9), "poteaux": ((2, 11), (10, 12)),
    "plinthe": ((0.86, 0.0), (0.92, 0.12), (0.92, 0.58), (0.78, 0.80), (0.56, 1.0)),
    "main_courante": ((0.62, 0.0), (0.68, 0.20), (0.91, 0.32), (0.93, 0.50), (0.87, 0.72), (0.71, 0.90), (0.45, 1.0)),
    "entre": 1,
    "balustre": {"rayon": 0.98, "cotes": 6, "ancrage": 0.10,
                 "profil": ((0.0, 1.0), (0.06, 1.0), (0.08, 0.62), (0.16, 0.55), (0.32, 0.98), (0.46, 0.86),
                            (0.76, 0.42), (0.86, 0.50), (0.89, 0.95), (1.0, 0.95))},
    "poteau": {"cote": 0.97,
               "profil": ((0.0, 1.0, 0.08), (0.14, 1.0, 0.08), (0.18, 1.0, 0.34), (0.84, 1.0, 0.34), (0.88, 1.0, 0.08),
                          (1.0, 1.0, 0.08))},
    "pommeau": {"rayon": 0.90, "cotes": 8,
                "profil": ((0.0, 0.78), (0.12, 0.78), (0.20, 0.45), (0.30, 0.50), (0.45, 0.90), (0.62, 1.0),
                           (0.80, 0.85), (0.93, 0.50), (1.0, 0.15))},
    "cheville": {"rayon": 0.18, "hauteurs": (0.35, 0.42), "tete": 0.90},
}

# Bastingage : rang de la serre, du bordé, de la lisse de pavois et des jambettes dans la recette.
# `profil_serre`, `profil_lisse` : demi-profil du pied à la tête (part de la demi-largeur, part de la hauteur).
# `jambette` : demi-côtés (fractions de ceux de la primitive) et profil.
# `virures` : leur `nombre` ; `ecart` de leurs joints (part de leur hauteur) ; `epaisseur` (part de celle du bordé,
# tirée) ; `jour` : demi-jour entre deux virures (part de la hauteur du bordé) ; `chanfrein` : fraction de la
# demi-épaisseur du bordé.
# `gournable` : rayon (fraction de la demi-largeur d'une jambette), déport en travers de la jambette (fraction de sa
# demi-largeur, tiré jusqu'à cette borne).
BASTINGAGE = {
    "serre": 0, "borde": 1, "lisse": 2, "jambettes": (3, 4, 5),
    "profil_serre": ((0.99, 0.0), (0.99, 0.52), (0.90, 0.78), (0.64, 1.0)),
    "profil_lisse": ((0.78, 0.0), (0.85, 0.18), (0.99, 0.30), (0.99, 0.60), (0.93, 0.84), (0.76, 1.0)),
    "jambette": {"cotes": (0.94, 0.97),
                 "profil": ((0.0, 1.0, 0.08), (0.08, 1.0, 0.08), (0.12, 1.0, 0.30), (0.88, 1.0, 0.30),
                            (0.92, 1.0, 0.08), (1.0, 1.0, 0.08))},
    "virures": {"nombre": 4, "ecart": 0.14, "epaisseur": (0.78, 0.98), "jour": 0.006, "chanfrein": 0.22},
    "gournable": {"rayon": 0.26, "deport": 0.40},
}
