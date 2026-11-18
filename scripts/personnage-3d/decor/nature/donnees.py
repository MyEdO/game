"""Données des petites choses vivantes du sol et des marais (#4335) : un GLB par décor `terrier`, `cocon`, `toile`,
`champignon`, `nenuphars` et `roseaux` de `src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa
recette (`gabarit.py`). Aucune illustration au corpus : proportions d'adaptation, chacune en fraction de la primitive
de la recette qui la porte (`modele.py` lit ses cotes par `gabarit.py`), dans le repère de `gabarit.py` (x à l'est, le
front de la recette vers -y, z vers le haut) ; un azimut est un angle en degrés autour de l'axe d'un cylindre de la
recette, du premier vecteur de son repère vers le second (`geometrie.repere`). Chaque table nomme d'abord le rang, dans
la recette, des primitives qu'elle lit.

- `terrier` : une butte de terre bosselée, semée de mottes ; à son front, un porche voûté qui en sort, sa lèvre
  arrondie, sa gueule creusée jusqu'à un fond d'ombre ; des tas de déblais à son pied.
- `cocon` : un fuseau de soie posé au sol, sa panse cordée de trois torons en hélice ; un câble torsadé le pend par
  sa pointe, des fils montent de son épaule au câble, des haubans descendent de sa panse à des attaches au sol.
- `toile` : seize rayons tendus du moyeu, un sur deux jusqu'à son point d'attache au bord de l'enveloppe, les autres
  jusqu'au carré du dehors de la recette ; un fil de cadre qui joint les rayons sur ce carré ; une spirale qui
  fléchit vers le moyeu entre deux rayons ; une araignée tête en bas, le bout de chacune de ses huit pattes coudées
  sur un nœud de la spirale.
- `champignon` : trois champignons ; chacun un pied bulbeux, une collerette, un chapeau bombé semé de verrues, et
  dessous un entonnoir de lamelles du bord du chapeau au pied.
- `nenuphars` : trois feuilles rondes fendues jusqu'au cœur, le bord ondulé, des nervures rayonnantes ; sur deux
  d'entre elles, une fleur de trois couronnes de pétales, de la plus ouverte à la plus dressée, autour d'un cœur.
- `roseaux` : sept chaumes à nœuds, chacun sa massette et son épi ; au pied de chacun, des feuilles en lame qui
  montent vers le cœur de la touffe et retombent du bout.

Écarts aux recettes. Le terrier pose son ombre au fond de la gueule du porche, en retrait du front où la recette la
plaque. La toile fait des trois carrés le cadre et les tours de la spirale, et de la croix de la recette deux de ses
rayons, dans la même enveloppe. Le cocon ajoute ses fils et ses haubans. Les roseaux ajoutent leurs feuilles.

Matières : celles des recettes. Le catalogue n'a ni chitine pour l'araignée, que la recette fait d'`ombre`, ni pétale
ni étamine pour la fleur du nénuphar, tout entière d'`albatre` ; les lamelles, la collerette et les verrues du
champignon prennent l'`os` de son pied."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
SOIE = {"soie": ("corps", "soie")}
OMBRE = {"ombre": ("accent", "ombre")}
MATERIAUX = {
    "terrier": {"terre": ("corps", "terre-battue"), **OMBRE},
    "cocon": SOIE,
    "toile": {**SOIE, **OMBRE},
    "champignon": {"chair": ("corps", "os"), "chapeau": ("vegetal", "chapeau-rouge")},
    "nenuphars": {"feuille": ("vegetal", "feuillage"), "fleur": ("corps", "albatre")},
    "roseaux": {"roseau": ("vegetal", "roseau"), "massette": ("corps", "terre-battue")},
}

BUDGET_TRIANGLES = {"terrier": 1600, "cocon": 1400, "toile": 2500, "champignon": 2600, "nenuphars": 2900,
                    "roseaux": 3900}

ANGLE_LISSE = {"terre": 35, "ombre": 30, "soie": 50, "chair": 40, "chapeau": 50, "feuille": 30, "fleur": 30,
               "roseau": 30, "massette": 50}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : la terre, un limbe et un
pétale gardent leurs arêtes, la soie, un chapeau et une massette sont ronds."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

# Bosses semées sur une coque (`semis`), en fractions de la taille que donne l'appelant : `rayon`, tiré entre ces
# bornes ; `enfonce` et `saillie` : ce dont la bosse entre dans la face qui la porte et en sort (parts de son rayon) ;
# `profil` (part de sa hauteur, part de son rayon) ; `cotes`.
MOTTE = {"rayon": (0.04, 0.08), "enfonce": 0.7, "saillie": 0.4, "profil": ((0.0, 1.0), (0.6, 0.9), (0.85, 0.6),
                                                                           (1.0, 0.25)), "cotes": 7}
VERRUE = {"rayon": (0.035, 0.06), "enfonce": 0.8, "saillie": 0.4, "profil": ((0.0, 1.0), (0.7, 0.85), (1.0, 0.4)),
          "cotes": 5}

# Terrier : rang du talus (le cylindre bas), de la butte (le cylindre haut), du porche et de son ombre.
# `cotes` et `bosse` : côtés de la butte, et part de son rayon que garde chaque côté (`geometrie.bosselee`, tirée) ;
# `profil` : (part de la hauteur du sol au dessus de la butte, part de l'apothème du talus) ; la pointe au dessus.
# `mottes` : leur nombre sur la butte (`MOTTE`, en fractions de l'apothème du talus) ; `semis` : rangs des anneaux de
# la butte entre lesquels elles se sèment.
# `deblais` : par tas, sa place (x, y) depuis l'axe du talus, son rayon et sa hauteur, en parts de l'apothème du
# talus ; `cotes_des_tas` ; `tas` : son profil (part de sa hauteur, part de son rayon), la pointe au dessus.
# `voute` : le dehors du porche, du fond au front : (part de la longueur de sa boîte depuis son arrière, négative dans
# la butte ; demi-largeur et hauteur en parts de celles de la boîte). `gueule` : son dedans, du front au fond : (même
# part de la longueur, part de la demi-largeur et de la hauteur de l'ombre de la recette), sur un seuil à la hauteur
# du bas de cette ombre. `pas` : côtés d'un cintre. `arete` : chanfrein de la plaque d'ombre (part de son épaisseur),
# posée à cheval sur le fond de la gueule, aux cotes de l'ombre de la recette.
TERRIER = {
    "talus": 0, "butte": 1, "porche": 2, "ombre": 3,
    "cotes": 14, "bosse": (0.8, 1.0),
    "profil": ((0.0, 0.84), (0.12, 0.82), (0.3, 0.74), (0.52, 0.60), (0.72, 0.44), (0.88, 0.26)),
    "mottes": 9, "semis": (1, 5),
    "deblais": ((0.52, -0.56, 0.19, 0.19), (-0.50, -0.60, 0.16, 0.16), (0.78, -0.10, 0.15, 0.15),
                (-0.74, 0.22, 0.17, 0.17), (0.32, 0.74, 0.14, 0.13), (-0.76, -0.24, 0.12, 0.12),
                (0.44, -0.74, 0.09, 0.07), (-0.46, -0.72, 0.10, 0.07)),
    "cotes_des_tas": 9, "tas": ((0.0, 1.0), (0.3, 0.92), (0.6, 0.7), (0.85, 0.4)),
    "voute": ((-0.8, 0.80, 0.85), (0.5, 0.86, 0.90), (0.85, 0.94, 0.96), (0.94, 1.0, 1.0), (1.0, 0.93, 0.95)),
    "gueule": ((1.0, 0.98), (0.93, 0.90), (0.6, 0.86)),
    "pas": 10, "arete": 0.2,
}

# Cocon : rang du pied, de la panse, de l'épaule, du col et du fil de la recette.
# `fuseau` : son profil, du sol à la pointe : (primitive, part de sa hauteur, part de son apothème).
# `torons`, `tours`, `pas`, `cotes`, `creux` : le fuseau est cordé de `torons` sillons en hélice qui font `tours` tours
# du sol à la pointe, `pas` anneaux par tour, `cotes` côtés par anneau, le fond d'un sillon ramené de la part `creux`
# du rayon.
# `cable` : profil du câble qui le pend (`geometrie.profilee`), d'un bout à l'autre du fil de la recette ; `ancrage` :
# part de la longueur du fil dont il entre dans la pointe.
# `brin` : rayon d'un fil ou d'un hauban (part du demi-côté du fil de la recette) ; `brin_cotes`.
# `fils` : leur nombre ; chacun part du dedans du fuseau à la part `depart` de sa hauteur, à la part `dedans` de son
# rayon, et rejoint le câble à la part `arrivee` de sa longueur.
# `haubans` : leur nombre ; chacun part du fuseau de même, à la part `prise` de sa hauteur, et descend à une attache
# posée au sol à la part `portee` de l'apothème du pied ; `ecart` : écart tiré de leur azimut (degrés).
# `attache` : son rayon et sa hauteur (parts de l'apothème du pied), son profil, ses côtés.
COCON = {
    "pied": 0, "panse": 1, "epaule": 2, "col": 3, "fil": 4,
    "fuseau": (("pied", 0.0, 0.30), ("pied", 0.5, 0.55), ("pied", 1.0, 0.80), ("panse", 0.2, 0.86),
               ("panse", 0.5, 0.97), ("panse", 0.8, 0.90), ("epaule", 0.3, 0.92), ("epaule", 0.8, 0.68),
               ("col", 0.4, 0.80), ("col", 1.0, 0.30)),
    "torons": 3, "tours": 5, "pas": 6, "cotes": 12, "creux": 0.16,
    "cable": ((0.0, 0.9, 0.5, 0.3), (0.12, 0.5, 0.9, 0.3), (0.25, 0.9, 0.5, 0.3), (0.37, 0.5, 0.9, 0.3),
              (0.5, 0.9, 0.5, 0.3), (0.62, 0.5, 0.9, 0.3), (0.75, 0.9, 0.5, 0.3), (0.87, 0.5, 0.9, 0.3),
              (1.0, 0.9, 0.5, 0.3)),
    "ancrage": 0.05,
    "brin": 0.4, "brin_cotes": 4, "dedans": 0.5,
    "fils": 5, "depart": 0.80, "arrivee": 0.45,
    "haubans": 6, "prise": 0.34, "portee": 0.84, "ecart": 12,
    "attache": {"rayon": 0.11, "hauteur": 0.06, "profil": ((0.0, 1.0), (0.5, 0.8), (1.0, 0.3)), "cotes": 6},
}

# Toile : rang du rayon vertical et du rayon horizontal de la recette, qui se croisent au moyeu, et de l'araignée.
# `carres` : rangs des quatre côtés de chaque carré de la recette, du dedans au dehors ; le fil de cadre passe sur
# celui du dehors, où s'arrêtent les rayons qui ne vont pas à l'enveloppe.
# `rayons` : leur nombre, un sur deux tendu jusqu'à l'enveloppe ; `ecart` : écart tiré de l'azimut de chacun (part de
# l'angle entre deux rayons).
# `fil` : rayon d'un rayon de la toile et du fil de cadre ; `soie` : rayon du fil de la spirale (parts de la
# demi-épaisseur du rayon vertical de la recette) ; `fil_cotes`, `soie_cotes`.
# `tours` de la spirale, qui va du carré du dedans à celui du dehors et croise chaque rayon là où le croisent les
# carrés, à parts égales de son cours ; `fleche` : ce dont son fil fléchit vers le moyeu entre deux rayons (part de sa
# corde) ; `jeu` : écart tiré de chacun de ses points (part de son cours).
# `corps` : l'araignée, du bas en haut : (hauteur, demi-largeur, demi-profondeur) en parts des demi-côtés de sa boîte,
# le céphalothorax sous l'abdomen ; `corps_cotes`.
# `pattes` : par patte d'un côté, la place que vise son bout (largeur, hauteur, en parts des demi-côtés de la boîte),
# posé devant le nœud de la spirale le plus proche qu'aucune autre patte n'a pris, à un rayon de son fil ; `hanche` :
# hauteur de leur départ dans le céphalothorax ; `genou` : ce dont une patte s'avance vers le front à mi-longueur
# (part de la demi-profondeur de la boîte) ; `patte` : ses rayons au départ et au bout (parts de la demi-largeur de la
# boîte) ; `patte_pas` : points par tronçon ; elle a les côtés du fil de la spirale.
TOILE = {
    "montant": 0, "traverse": 1, "araignee": 14,
    "carres": ((2, 3, 4, 5), (6, 7, 8, 9), (10, 11, 12, 13)),
    "rayons": 16, "ecart": 0.12,
    "fil": 0.85, "soie": 0.55, "fil_cotes": 4, "soie_cotes": 3,
    "tours": 7, "fleche": 0.10, "jeu": 0.012,
    "corps": ((-0.92, 0.0, 0.0), (-0.82, 0.25, 0.3), (-0.6, 0.48, 0.55), (-0.3, 0.5, 0.55), (-0.08, 0.26, 0.3),
              (0.2, 0.74, 0.85), (0.5, 0.86, 0.95), (0.8, 0.55, 0.6), (0.95, 0.0, 0.0)),
    "corps_cotes": 8,
    "pattes": ((0.95, 0.85), (1.0, 0.3), (1.0, -0.4), (0.85, -0.95)),
    "hanche": -0.45, "genou": 0.75, "patte": (0.09, 0.04), "patte_pas": 2,
}

# Champignon : `sujets` : par champignon, rang de son pied, rangs du bord et du sommet de son chapeau (le même
# cylindre quand la recette n'en donne qu'un), nombre de ses lamelles, nombre de ses verrues.
# `pied` : son profil (part de la hauteur, part de l'apothème) ; `cotes` du pied et de la collerette ; `ancrage` :
# part de sa hauteur dont il entre dans le chapeau.
# `collerette` : sa place sur le pied (parts de sa hauteur, du bas en haut) et son profil (part de sa hauteur, part de
# l'apothème du pied).
# `dome` : le chapeau (part de sa hauteur, part de l'apothème de son bord), et la hauteur de sa pointe (`pointe`) ;
# `pans` et `bosse` : ses côtés, et la part de son rayon que garde chacun (`geometrie.bosselee`, tirée).
# `semis` : rangs des anneaux du chapeau entre lesquels se sèment ses verrues (`VERRUE`, en fractions de l'apothème
# du bord).
# `lamelles` : l'entonnoir, du pied au bord : (hauteur sous le dessous du chapeau, rayon, en parts de l'apothème du
# bord ; creux des plis) ; `pas` : points par lamelle.
CHAMPIGNON = {
    "sujets": ((0, (1, 2), 28, 10), (3, (4, 4), 18, 6), (5, (6, 6), 14, 4)),
    "pied": ((0.0, 0.75), (0.04, 1.0), (0.1, 0.95), (0.2, 0.7), (0.5, 0.6), (0.9, 0.62), (1.0, 0.8)),
    "cotes": 8, "ancrage": 0.04,
    "collerette": ((0.52, 0.60), ((0.0, 1.9), (0.15, 1.7), (1.0, 0.7))),
    "dome": ((0.0, 0.84), (0.07, 0.95), (0.22, 0.97), (0.42, 0.88), (0.62, 0.70), (0.78, 0.48), (0.90, 0.24)),
    "pointe": 0.96, "pans": 16, "bosse": (0.94, 1.0),
    "semis": (2, 6),
    "lamelles": ((0.42, 0.26, 0.0), (0.16, 0.55, 0.5), (-0.02, 0.78, 0.6)), "pas": 2,
}

# Nénuphars : rangs des feuilles ; `fleurs` : rang de chaque fleur et de la feuille qui la porte.
# `limbe` : rayon d'une feuille (part de l'apothème de son cylindre) ; `onde` : écart tiré du rayon de chaque point de
# son bord ; `pans` : points de son bord ; `fente` : demi-ouverture de sa fente (degrés) ; `coeur` : distance de la
# pointe de la fente à l'axe (part du rayon) ; `epais` : son épaisseur (part de la hauteur de son cylindre) ; `arete` :
# chanfrein de ses rives (part de son épaisseur).
# `nervures` : leur nombre, leur longueur (part du rayon de la feuille), leur rayon (part de son épaisseur), leurs
# côtés.
# `couronnes` : par couronne de pétales, leur nombre, leur élévation (degrés), leur longueur (part de l'apothème de la
# fleur), leur demi-largeur (fraction de leur longueur) ; `petale` : sa demi-épaisseur, et la hauteur de son départ sur
# la feuille (fraction de l'apothème de la fleur).
# `bouton` : le cœur ; son rayon (part de l'apothème de la fleur), sa hauteur et ce dont il entre dans la feuille (parts
# de son rayon), son profil, ses côtés.
NENUPHARS = {
    "feuilles": (0, 1, 2), "fleurs": ((3, 1), (4, 0)),
    "limbe": 0.96, "onde": 0.015, "pans": 28, "fente": 9, "coeur": 0.14, "epais": 0.5, "arete": 0.3,
    "nervures": (9, 0.88, 0.3, 3),
    "couronnes": ((8, 14, 1.7, 0.26), (6, 38, 1.25, 0.28), (4, 66, 0.85, 0.30)),
    "petale": 0.04,
    "bouton": {"rayon": 0.42, "hauteur": 0.9, "ancrage": 0.3,
               "profil": ((0.0, 1.0), (0.4, 1.0), (0.75, 0.75), (1.0, 0.3)), "cotes": 7},
}

# Feuille en lame (`feuille`) : `nervure` : son fil (part de la longueur, flèche au-dessus de sa corde en fraction de
# la longueur) ; `pas` : points par tronçon ; `limbe` : sa demi-largeur le long du fil (part du fil, part de la
# demi-largeur) ; `biseau` : chanfrein de ses rives (part de sa demi-épaisseur).
PETALE = {"nervure": ((0.0, 0.0), (0.5, -0.07), (1.0, 0.05)), "pas": 1,
          "limbe": ((0.0, 0.4), (0.5, 1.0), (1.0, 0.2)), "biseau": 0.6}
LAME = {"nervure": ((0.0, 0.0), (0.45, 0.0), (0.8, -0.05), (1.0, -0.17)), "pas": 2,
        "limbe": ((0.0, 0.8), (0.3, 1.0), (0.7, 0.8), (1.0, 0.3)), "biseau": 0.5}

# Roseaux : `tiges` : rang du chaume et de la massette de chacune.
# `chaume` et `epi` : profils du chaume à nœuds, et de la massette sous son épi (part de la hauteur, part de
# l'apothème) ; `cotes` ; `ancrage` : part de sa hauteur dont le chaume entre dans la massette.
# `feuilles` : leur nombre par tige ; `ouverture` : écart tiré de leur azimut autour du sens du cœur de la touffe
# (degrés) ; `elevation` (degrés) et `longueur` (part de la plus grande longueur où chaque point de sa nervure reste à
# sa demi-largeur sous l'enveloppe), tirées entre ces bornes ; `largeur` et `epais` : sa demi-largeur et sa
# demi-épaisseur (parts de l'apothème du chaume).
ROSEAUX = {
    "tiges": ((0, 1), (2, 3), (4, 5), (6, 7), (8, 9), (10, 11), (12, 13)),
    "chaume": ((0.0, 1.0), (0.3, 0.8), (0.31, 0.95), (0.33, 0.8), (0.62, 0.66), (0.63, 0.8), (0.65, 0.66),
               (1.0, 0.5)),
    "epi": ((0.0, 0.4), (0.05, 0.92), (0.4, 1.0), (0.72, 0.95), (0.78, 0.5), (0.8, 0.2), (1.0, 0.12)),
    "cotes": 6, "ancrage": 0.03,
    "feuilles": 3, "ouverture": 70, "elevation": (72, 84), "longueur": (0.5, 0.85), "largeur": 0.6, "epais": 0.09,
}
