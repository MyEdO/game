"""Données des meubles (#4335) : un GLB par décor `table`, `table-2x1`, `chaise`, `banc` et `tabouret` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au
corpus : proportions d'adaptation, du mobilier d'auberge menuisé, chacune en fraction de la primitive qui la porte (son
rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le haut).

- `table`, `table-2x1` : un plateau de planches jointes, rives adoucies, bouts inégaux ; quatre pieds carrés à
  chanfreins arrêtés ; une ceinture de quatre traverses chevillées ; un piétement en H, deux traverses basses et une
  entretoise dont les tenons traversants sont clavetés.
- `banc` : une planche épaisse aux coins arrondis, à peine creusée ; quatre pieds à chanfreins arrêtés, en dévers ; une
  traverse haute et une traverse basse à chaque bout, chevillées ; l'entretoise de la recette, tenons clavetés.
- `chaise` : deux pieds avant tournés sous un dé carré, deux montants arrière d'une pièce du sol à la tête, chanfreinés
  sous l'assise ; une assise creusée aux coins arrondis sur une ceinture chevillée ; quatre barreaux tournés ; un
  dossier à trois lattes entre une traverse basse et une traverse haute cintrée, chevillées aux montants. Le dossier
  est là où la recette le pose.
- `tabouret` : une assise ronde creusée, trois pieds tournés en dévers, trois barreaux tournés à la hauteur du disque
  de la recette.

Matière : `bois-chene`, que nomme chaque recette."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {id_: {"bois": ("bois", "bois-chene")} for id_ in ("table", "table-2x1", "chaise", "banc", "tabouret")}

BUDGET_TRIANGLES = {"table": 1400, "table-2x1": 1400, "chaise": 2000, "banc": 1200, "tabouret": 1300}

ANGLE_LISSE = {"bois": 40}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : un chanfrein garde ses arêtes, une pièce
tournée est ronde."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête adoucie, en fraction du plus petit demi-côté de la section."""

# Cheville : côtés ; part de son rayon enfoncée dans le bois ; saillie de sa tête (fraction de son rayon, tirée) ;
# profil (part de la longueur, part du rayon).
CHEVILLE = {"cotes": 5, "enfonce": 1.0, "saillie": (0.25, 0.45), "profil": ((0.0, 1.0), (1.0, 0.75))}

CUVETTE = (0.82, 0.55, 0.25)
"""Les anneaux du creux d'une assise, chacun la part du contour de l'assise qu'il garde."""

# Profil d'un pied carré à chanfreins arrêtés, du sol à la tête : (part de la longueur, part du demi-côté, chanfrein en
# fraction du demi-côté).
PIED_CARRE = ((0.0, 0.86, 0.08), (0.02, 1.0, 0.08), (0.30, 1.0, 0.08), (0.36, 1.0, 0.38), (0.72, 1.0, 0.38), (0.78, 1.0, 0.08),
              (1.0, 1.0, 0.08))

# Table (`table`, `table-2x1`) : rang du plateau, de la ceinture et des pieds dans la recette.
# `planches` : nombre ; `largeurs` : part de chacune, tirée ; `bouts` : retrait d'un bout (fraction de la demi-largeur
# du plateau, tiré jusqu'à cette borne) ; `affleurement` : ce dont une planche s'enfonce sous le dessus (fraction de son
# épaisseur, tiré) ; `rive` : chanfrein d'une rive (fraction de la demi-épaisseur).
# `pied` : son demi-côté (fraction de celui de la primitive) et son profil.
# `ceinture` : hauteur (fraction de celle de la primitive), demi-épaisseur et retrait de sa face sous celle du pied
# (fractions du demi-côté du pied), hauteurs de ses chevilles (fractions de sa demi-hauteur).
# `cheville` : rayon (fraction du demi-côté du pied).
# `entretoise` : hauteur (fraction de celle du pied) ; `traverse` basse, `corps` et `tenon` : demi-largeur et
# demi-hauteur (fractions du demi-côté du pied) ; `saillie` du tenon au-delà de l'axe de la traverse ; `clavette` :
# sa place sur cette saillie, ses demi-côtés (le long de l'entretoise, en travers), ce qu'elle dépasse sous et sur
# l'axe du tenon (le tout en fractions de la demi-hauteur du tenon), et la part de sa section qu'elle garde en bas.
TABLE = {
    "plateau": 0, "ceinture_lue": 1, "pieds": (2, 3, 4, 5),
    "planches": 5, "largeurs": (0.8, 1.2), "bouts": 0.025, "affleurement": (0.0, 0.05), "rive": 0.14,
    "pied": {"cote": 0.92, "profil": PIED_CARRE},
    "ceinture": {"hauteur": 1.4, "epaisseur": 0.30, "retrait": 0.22, "chevilles": (-0.45, 0.45)},
    "cheville": 0.17,
    "entretoise": {"hauteur": 0.20, "traverse": (0.40, 0.75), "corps": (0.90, 0.40), "tenon": (0.50, 0.28), "saillie": 0.92,
                   "clavette": {"place": 0.72, "demi": (0.10, 0.26), "depasse": (0.75, 1.0), "pointe": 0.55}},
}

# Banc : rang de l'assise, des pieds et de l'entretoise dans la recette.
# `arrondi` : rayon d'un coin de l'assise (fraction de sa demi-profondeur), `par_coin` : segments d'un coin ;
# `chanfrein` : fraction de sa demi-épaisseur ; `creux` : fraction de son épaisseur.
# `devers` : ce dont la tête d'un pied rentre vers l'axe du banc, en x et en y (fractions de la position de son pied).
# `traverse` haute, `traverse_basse` : demi-épaisseur et demi-hauteur (fractions du demi-côté du pied).
# `tenon` : sa demi-largeur et sa demi-hauteur (fractions de celles de l'entretoise) ; `clavette` : comme celle d'une
# table.
BANC = {
    "assise": 0, "pieds": (1, 2, 3, 4), "entretoise": 5,
    "arrondi": 0.22, "par_coin": 3, "chanfrein": 0.22, "creux": 0.10,
    "devers": (0.07, 0.10),
    "pied": {"cote": 0.82, "profil": PIED_CARRE},
    "traverse": (0.38, 1.0), "traverse_basse": (0.38, 0.62),
    "cheville": 0.20,
    "tenon": (0.55, 0.70), "clavette": {"place": 0.62, "demi": (0.32, 1.1), "depasse": (2.7, 3.4), "pointe": 0.55},
}

# Tabouret : rang de l'assise, des pieds et du disque dans la recette.
# `rayon` de l'assise (fraction de celui de la primitive), ses `cotes` ; `chanfrein` : fraction de sa demi-épaisseur ;
# `creux` : fraction de son épaisseur.
# `devers` : ce dont la tête d'un pied rentre vers l'axe (fraction de la distance de son pied) ; `pied` : son rayon
# (fraction du demi-côté de la primitive), ses côtés, son profil (part de la longueur, part du rayon).
# `barreau` : rayon (fraction de la demi-épaisseur du disque), côtés, profil.
TABOURET = {
    "assise": 0, "pieds": (1, 2, 3), "disque": 4,
    "rayon": 0.975, "cotes": 24, "chanfrein": 0.25, "creux": 0.16,
    "devers": 0.30,
    "pied": {"rayon": 0.92, "cotes": 10,
             "profil": ((0.0, 0.55), (0.03, 0.68), (0.09, 0.60), (0.14, 0.86), (0.19, 0.60), (0.28, 0.95), (0.42, 1.0), (0.50, 0.72),
                        (0.54, 0.90), (0.58, 0.70), (0.84, 0.92), (1.0, 0.80))},
    "barreau": {"rayon": 1.0, "cotes": 6, "profil": ((0.0, 0.70), (0.30, 1.0), (0.70, 1.0), (1.0, 0.70))},
}

# Chaise : rang dans la recette des pieds avant, des pieds arrière (chacun avec le montant qui le prolonge), de
# l'assise, des traverses haute et basse du dossier, d'une latte et du barreau avant.
# `arrondi` : rayon d'un coin de l'assise (fraction de son demi-côté) ; `chanfrein` : fraction de sa demi-épaisseur ;
# `creux` : fraction de son épaisseur.
# `ceinture` : demi-hauteur, demi-épaisseur et retrait de sa face (fractions du demi-côté du pied).
# `pied` avant : côtés, profil (part de sa longueur sous le dé, part du demi-côté). `montant` : profil d'un pied carré.
# `barreaux` : rayon (fraction de la demi-épaisseur du barreau de la recette), côtés, profil ; hauteur de ceux des
# côtés et de l'arrière (fractions de celle du dessous de l'assise).
# `dossier` : demi-épaisseur des traverses et des lattes (fractions de celle de leur primitive) ; `lattes` : leur
# place (multiples de l'écart de la latte lue à l'axe) et leur demi-largeur (fraction de celle de la latte lue) ;
# `cintre` : part de la hauteur libre sous la tête des montants que prend la flèche de la traverse haute, et ses
# stations.
CHAISE = {
    "avant": (0, 1), "arriere": ((2, 5), (3, 6)), "assise": 4, "haute": 7, "basse": 8, "latte": 9, "barreau": 11,
    "arrondi": 0.14, "par_coin": 3, "chanfrein": 0.28, "creux": 0.22,
    "ceinture": {"hauteur": 1.1, "epaisseur": 0.36, "retrait": 0.20},
    "cheville": 0.22,
    "pied": {"cotes": 10,
             "profil": ((0.0, 0.58), (0.03, 0.74), (0.09, 0.62), (0.13, 0.92), (0.17, 0.62), (0.30, 0.86), (0.44, 0.94), (0.52, 0.70),
                        (0.56, 0.92), (0.60, 0.70), (0.86, 0.96), (0.95, 0.80), (1.0, 0.80))},
    "montant": ((0.0, 0.84, 0.10), (0.02, 1.0, 0.10), (0.10, 1.0, 0.10), (0.14, 1.0, 0.40), (0.37, 1.0, 0.40), (0.41, 1.0, 0.10),
                (0.965, 1.0, 0.10), (0.985, 0.90, 0.30), (1.0, 0.55, 0.30)),
    "barreaux": {"rayon": 0.95, "cotes": 6, "profil": ((0.0, 0.70), (0.25, 1.0), (0.44, 0.80), (0.50, 1.15), (0.56, 0.80), (0.75, 1.0), (1.0, 0.70)),
                 "cotes_h": 0.52, "arriere_h": 0.36},
    "dossier": {"epaisseur": 0.50, "lattes": (-2, 0, 2), "latte": (0.85, 0.36), "cintre": 0.85, "stations": 7},
}
