"""Données des roches (#4335) : un GLB par décor `rocher`, `menhir`, `stalagmite` et `gravats` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au
corpus : proportions d'adaptation, chacune en fraction de la primitive qui la porte (son rang dans la recette), dans le
repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le haut) ; un azimut est un angle en degrés
dans le plan du sol, de +x vers +y.

- `rocher` : un affleurement en trois masses soudées, à pans coupés et bancs en retrait : la masse basse et large, la
  tête qui la dépasse à l'est, l'épaule en dalle inclinée à l'ouest ; un bloc détaché à son pied, et des pierres.
- `menhir` : un monolithe dressé, à pans presque verticaux qui se resserrent vers la tête, taillée de biais en trois
  pans ; ses arêtes éclatées, ses pierres de calage au pied.
- `stalagmite` : une concrétion en bourrelets empilés, chacun sa lèvre en surplomb du précédent, cannelée de coulures,
  qui s'effile en pointe ; sa petite voisine, et des bosses naissantes à leur pied.
- `gravats` : un tas de démolition : un monticule et trois bosses de moellons équarris jetés de travers, mêlés de
  pierres anguleuses et de cailloux, et des moellons tombés à l'écart.

Matière : `pierre-atre`, que nomme chaque recette. Le catalogue n'a ni calcite humide de grotte pour la stalagmite, ni
mousse ou lichen pour le rocher et le menhir, ni mortier pour les gravats. Aucun emplacement de palette ne nomme la
pierre : elle prend `corps`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {id_: {"pierre": ("corps", "pierre-atre")} for id_ in ("rocher", "menhir", "stalagmite", "gravats")}

BUDGET_TRIANGLES = {"rocher": 1000, "menhir": 500, "stalagmite": 3000, "gravats": 4000}

ANGLE_LISSE = {"rocher": 12, "menhir": 12, "stalagmite": 50, "gravats": 12}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : la roche cassée reste à facettes, la
concrétion est polie par l'eau."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle une pièce s'arrête (`eclat`, `Gabarit.rentrer`)."""

# Taille d'un éclat, dans l'espace où son ellipsoïde est la sphère unité : `jeu`, écart de la normale de chacun de ses
# douze pans à sa direction ; `coupe` : distance du pan au centre, tirée entre ces bornes ; `aplomb` : facteur de la
# composante verticale des normales (petit, des pans dressés), `fruit` : ce qui s'y ajoute (positif, des pans qui se
# resserrent vers le haut) ; `arrondi` : demi-côté du cube qui borne ce qu'aucun pan ne coupe ; `ecailles` : nombre de
# coins enlevés et profondeur de chacun (fraction de l'appui de l'éclat dans sa direction, tirée) ; `strates` : épaisseur
# d'un banc, retrait de chaque banc (tiré jusqu'à cette borne), pendage du lit, part de son épaisseur dont un banc
# s'enfonce dans celui qui le porte, part de cette épaisseur sous laquelle un banc ne se bâtit pas ; `ancrage` : part
# de son plus petit demi-côté dont le centre reste sous l'enveloppe.
TAILLES = {
    "masse": {"jeu": 0.35, "coupe": (0.55, 0.95), "aplomb": 1.0, "fruit": 0.10, "arrondi": 1.4, "ecailles": (7, (0.06, 0.20)),
              "strates": (0.27, 0.18, 0.20, 0.15, 0.5), "ancrage": 0.3},
    "bloc": {"jeu": 0.40, "coupe": (0.55, 0.95), "aplomb": 1.0, "fruit": 0.05, "arrondi": 1.4, "ecailles": (5, (0.06, 0.22)),
             "strates": (0.55, 0.10, 0.28, 0.15, 0.5), "ancrage": 0.3},
    "pierre": {"jeu": 0.45, "coupe": (0.55, 0.95), "aplomb": 1.0, "fruit": 0.0, "arrondi": 1.4, "ecailles": (2, (0.10, 0.30)),
               "strates": None, "ancrage": 0.5},
    "caillou": {"jeu": 0.50, "coupe": (0.50, 0.95), "aplomb": 1.0, "fruit": 0.0, "arrondi": 1.4, "ecailles": (0, (0.0, 0.0)),
                "strates": None, "ancrage": 0.5},
    "monolithe": {"jeu": 0.45, "coupe": (0.72, 1.0), "aplomb": 0.30, "fruit": 0.22, "arrondi": 1.4, "ecailles": (14, (0.03, 0.12)),
                  "strates": None, "ancrage": 0.3},
    "monticule": {"jeu": 0.35, "coupe": (0.80, 1.0), "aplomb": 1.0, "fruit": 0.10, "arrondi": 1.4, "ecailles": (4, (0.05, 0.15)),
                  "strates": None, "ancrage": 0.0},
}

# Éclats nommés d'un décor : la primitive qui le porte, son centre et ses demi-côtés en fractions des demi-côtés de
# cette primitive, sa taille (`TAILLES`), ses plans nommés (normale dans le repère du décor, distance au centre
# dans l'espace où l'ellipsoïde est la sphère unité).
BLOCS = {
    "rocher": [
        {"porte": 0, "centre": (0.08, 0.06, -0.50), "demi": (0.86, 0.84, 2.35), "taille": "masse"},
        {"porte": 1, "centre": (0.10, 0.0, -1.90), "demi": (1.10, 1.05, 2.90), "taille": "bloc"},
        {"porte": 2, "centre": (0.10, 0.10, -3.50), "demi": (1.00, 1.00, 3.90), "taille": "bloc",
         "plans": [((-0.45, 0.10, 1.0), 0.72)]},
        {"porte": 3, "centre": (0.0, 0.0, -0.45), "demi": (0.90, 0.88, 1.30), "taille": "bloc"},
        {"porte": 0, "centre": (0.60, -0.82, -0.93), "demi": (0.16, 0.18, 0.20), "taille": "pierre"},
        {"porte": 0, "centre": (0.86, 0.35, -0.95), "demi": (0.12, 0.20, 0.16), "taille": "pierre"},
        {"porte": 0, "centre": (-0.10, -0.86, -0.96), "demi": (0.13, 0.12, 0.13), "taille": "pierre"},
        {"porte": 0, "centre": (-0.55, 0.84, -0.95), "demi": (0.20, 0.14, 0.17), "taille": "pierre"},
    ],
    "menhir": [
        {"porte": 0, "centre": (0.04, 0.0, 0.22), "demi": (0.86, 0.84, 1.36), "taille": "monolithe",
         "plans": [((0.50, 0.08, 1.0), 0.88), ((-0.75, 0.25, 1.0), 0.97), ((0.10, -0.60, 1.0), 0.93), ((0.15, 0.70, 1.0), 0.95)]},
        {"porte": 0, "centre": (0.74, -0.60, -0.96), "demi": (0.26, 0.36, 0.11), "taille": "pierre"},
        {"porte": 0, "centre": (-0.72, 0.55, -0.97), "demi": (0.28, 0.40, 0.09), "taille": "pierre"},
        {"porte": 0, "centre": (-0.30, -0.80, -0.97), "demi": (0.30, 0.18, 0.05), "taille": "pierre"},
        {"porte": 0, "centre": (0.35, 0.82, -0.975), "demi": (0.26, 0.16, 0.045), "taille": "pierre"},
    ],
}

# Concrétions d'un décor : les primitives empilées qui portent la colonne, la part de leur rayon qu'elle prend ; ses
# bosses (azimut, distance, rayon, hauteur, en fractions du rayon de sa première primitive) et la part de son rayon
# qu'une bosse garde à mi-hauteur.
CONCRETIONS = {
    "stalagmite": [
        {"primitives": (0, 1, 2, 3), "part": 0.62, "taille_de_bosse": 0.70,
         "bosses": [(150, 0.62, 0.20, 0.70), (255, 0.66, 0.16, 0.44), (40, 0.60, 0.17, 0.52)]},
        {"primitives": (4, 5), "part": 0.62, "taille_de_bosse": 0.70,
         "bosses": [(170, 1.25, 0.50, 1.50)]},
    ],
}

# Colonne de concrétion : côtés ; écart de rayon de chaque côté sur toute la colonne (cannelures), la part `propre` qui
# s'y ajoute à chaque bourrelet, et celui de chaque sommet (grain) ; hauteur d'un bourrelet (fraction du rayon au pied
# de la colonne, tirée entre ces bornes) ; sa saillie (tirée) et son galbe, (part de sa hauteur, part de sa saillie) de
# chacun de ses anneaux ; `pente` : dévers du joint de deux bourrelets (m par m, tiré) ; `desaxe` : écart de son axe (fraction du
# rayon) ; `evasement` du pied : saillie, hauteur de décroissance (fraction du rayon du pied) ; `pointe` : part de la
# hauteur de la colonne que prend son cône final.
CONCRETION = {"cotes": 10, "cannelures": 0.10, "propre": 0.35, "grain": 0.015, "bourrelet": (0.60, 1.20),
              "saillie": (0.04, 0.13), "galbe": ((0.0, 0.15), (0.35, 1.0), (0.75, 0.55), (1.0, -0.10)), "pente": 0.12,
              "desaxe": 0.07, "evasement": (0.10, 0.35), "pointe": 0.03}

# Tas que porte une primitive : `etale`, élargissement de son emprise ; `coeur` : part de l'emprise et de la hauteur que
# prend son cœur, et sa taille (`TAILLES`) ; ses pierres, par classe : nombre, taille (fraction du plus petit demi-côté
# de la primitive, tirée) et taille d'éclat ; nombre de moellons et leur taille ; `niveau` : part de la hauteur de la
# pente où une pièce se pose.
TAS = {
    "gravats": [
        {"porte": 0, "etale": 1.0, "coeur": (0.84, 0.60), "taille_du_coeur": "monticule", "niveau": (0.60, 1.10),
         "pierres": [(8, (0.14, 0.26), "pierre"), (20, (0.06, 0.12), "caillou")], "moellons": 22, "tailles_des_moellons": (0.15, 0.26)},
        {"porte": 1, "etale": 1.4, "coeur": (0.80, 0.66), "taille_du_coeur": "monticule", "niveau": (0.75, 1.25),
         "pierres": [(3, (0.28, 0.46), "pierre"), (6, (0.12, 0.22), "caillou")], "moellons": 12, "tailles_des_moellons": (0.32, 0.50)},
        {"porte": 2, "etale": 1.5, "coeur": (0.80, 0.66), "taille_du_coeur": "monticule", "niveau": (0.75, 1.25),
         "pierres": [(2, (0.35, 0.60), "pierre"), (5, (0.15, 0.30), "caillou")], "moellons": 8, "tailles_des_moellons": (0.42, 0.64)},
        {"porte": 5, "etale": 1.4, "coeur": (0.80, 0.66), "taille_du_coeur": "monticule", "niveau": (0.75, 1.25),
         "pierres": [(2, (0.32, 0.55), "pierre"), (5, (0.15, 0.30), "caillou")], "moellons": 8, "tailles_des_moellons": (0.40, 0.60)},
        {"porte": 3, "etale": 1.0, "coeur": (0.55, 0.60), "taille_du_coeur": "pierre", "niveau": (0.5, 1.0),
         "pierres": [(1, (0.30, 0.50), "pierre"), (3, (0.15, 0.28), "caillou")], "moellons": 2, "tailles_des_moellons": (0.50, 0.70)},
        {"porte": 4, "etale": 1.0, "coeur": (0.55, 0.60), "taille_du_coeur": "pierre", "niveau": (0.5, 1.0),
         "pierres": [(1, (0.30, 0.50), "pierre"), (3, (0.15, 0.28), "caillou")], "moellons": 2, "tailles_des_moellons": (0.50, 0.70)},
    ],
}

PIERRE = ((0.8, 1.3), (0.8, 1.3), (0.5, 0.9))
"""Les demi-côtés (x, y, z) d'une pierre de tas, en fractions de sa taille, chacun tiré entre ses bornes."""

MOELLON = (0.30, 0.10, ((1.0, 1.5), (0.6, 0.85), (0.4, 0.6)))
"""Un moellon de tas : dévers de son lit, jeu de chaque coin (fraction du demi-côté), et ses demi-côtés (longueur,
largeur, hauteur) en fractions de sa taille, chacun tiré entre ses bornes."""
