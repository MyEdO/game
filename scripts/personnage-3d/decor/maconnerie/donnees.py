"""Données de la maçonnerie (#4335) : un GLB par décor `puits`, `fontaine`, `abreuvoir`, `autel`, `sarcophage`,
`tombe` et `colonne-brisee` de `src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`). Aucune illustration au corpus : proportions d'adaptation, chacune en fraction de la primitive qui la
porte (son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le
haut) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y.

- `puits` : un mur rond de trois assises de pierres taillées aux joints croisés sur leur blocage, sous une margelle en
  saillie ; la bouche d'ombre en contrebas ; les deux poteaux de la recette, à chanfreins arrêtés, posés sur la
  margelle ; à chaque pignon un entrait, deux liens, un poinçon et deux chevrons, sous un faîtage ; chaque versant, sa
  volige et ses rangs d'ardoises à recouvrement ; le treuil de la recette, son tambour, les spires de la corde, sa
  manivelle de fer ; le seau cerclé à son anse, pendu à la corde.
- `fontaine` : le bassin à huit pans de la recette, une plinthe, deux assises et une margelle de pierres taillées, une
  pierre d'angle à chaque sommet d'une assise sur deux ; l'eau en contrebas de la margelle ; un fût à huit pans en
  balustre sur son socle ; la vasque creuse, son eau ; le pinacle en bouton.
- `abreuvoir` : une auge de planches sur les deux patins de la recette : un fond, deux bords de deux planches, deux
  bouts pris entre eux, trois tasseaux chevillés par bord ; l'eau en contrebas du bord.
- `autel` : un massif de quatre assises de pierres taillées entre une plinthe en talus et une corniche ; la table de
  la recette, aux rives abattues ; ses deux cierges, de hauteurs inégales, la cire coulée au pied, la mèche noire ; le
  sang : une flaque sur la table, des filets sinueux en éventail jusqu'à sa rive de front, leurs coulures sur son
  chant et sur le massif, qui s'arrêtent dans la hauteur de la primitive de sang.
- `sarcophage` : une cuve sur plinthe, à pilastres d'angle et pilastres courants sous un bandeau ; le couvercle de la
  recette, en bâtière basse ; un gisant : le coussin et la tête à la place du carré de la recette, le corps drapé, des
  épaules aux pieds relevés, à la place de sa dalle longue.
- `tombe` : un socle en talus ; une stèle épaulée à tête cintrée, de travers comme le fronton de la recette, un
  cartouche en relief sur sa face ; un tertre de terre bossué.
- `colonne-brisee` : un socle carré, une base à deux tores et une scotie, un fût cannelé de trois tambours inégaux
  qui défile, sa cassure en éclat du côté haut du prisme de la recette ; un tambour tombé, sa cassure ; un éclat.

Matières : celles des recettes. Le puits prend `fer-noirci`, que sa recette ne nomme pas, pour sa manivelle, les
cercles et l'anse de son seau ; l'autel prend `ombre` pour la mèche de ses cierges. Le catalogue n'a ni eau vive ni
eau claire (`eau-dormante` pour les deux bassins et l'auge), ni mortier ou chaux pour les joints (le blocage est de
`pierre-atre`), ni mousse ou lichen, ni cire (`albatre`, que la recette donne aux cierges). Aucun emplacement de
palette ne nomme la pierre, l'ardoise ni la terre : elles prennent `corps` ; l'eau, le sang, l'ombre et la corde,
`accent`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
PIERRE = {"pierre": ("corps", "pierre-atre")}
BOIS = {"bois": ("bois", "bois-chene")}
EAU = {"eau": ("accent", "eau-dormante")}
MARBRE = {"marbre": ("corps", "albatre")}
MATERIAUX = {
    "puits": {**PIERRE, **BOIS, "ardoise": ("corps", "prop-ardoise"), "fer": ("metal", "fer-noirci"),
              "corde": ("accent", "corde"), "ombre": ("accent", "ombre")},
    "fontaine": {**PIERRE, **EAU},
    "abreuvoir": {**BOIS, **EAU},
    "autel": {**PIERRE, **MARBRE, "sang": ("accent", "sang-repandu"), "meche": ("accent", "ombre")},
    "sarcophage": {**PIERRE, **MARBRE},
    "tombe": {**PIERRE, "terre": ("corps", "terre-battue")},
    "colonne-brisee": {**PIERRE, **MARBRE},
}

BUDGET_TRIANGLES = {"puits": 5200, "fontaine": 3600, "abreuvoir": 1500, "autel": 2800, "sarcophage": 1700, "tombe": 700,
                    "colonne-brisee": 2200}

ANGLE_LISSE = {"pierre": 30, "marbre": 35, "bois": 40, "ardoise": 30, "fer": 40, "corde": 50, "ombre": 30, "eau": 30,
               "sang": 40, "meche": 40, "terre": 60}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : une pierre taillée garde ses
arêtes, une pièce tournée et un tertre sont ronds."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête de bois adoucie, en fraction d'une cote pleine : du côté d'un poteau pour toute la charpente
du puits ; à l'abreuvoir, de la largeur d'un patin, de l'épaisseur d'une planche pour les planches de l'auge, de celle
d'un tasseau pour un tasseau."""

MINCE = 0.5
"""Chanfrein d'une pièce mince (la volige du puits, l'eau de l'auge, un filet et une coulure de sang), en fraction de
sa demi-épaisseur."""

# Pierre taillée (`modele.claveau`, `modele.autel`), en fractions de la hauteur de son assise : `joint`, demi-joint
# laissé à chaque bout et à chaque lit ; `arete`, chanfrein de ses arêtes ; `parement`, recul de sa face (tiré entre
# ces bornes).
TAILLE = {"joint": 0.035, "arete": 0.07, "parement": (0.0, 0.035)}

PLINTHE = ((0.0, 0.05, 0.05), (0.10, 0.0, 0.08), (0.60, 0.0, 0.08), (1.0, 0.32, 0.05))
"""Profil d'une plinthe en talus (`modele.dalle`) : (part de sa hauteur, retrait et chanfrein en fractions d'elle)."""
PAVE = ((0.0, 0.0, 0.03), (1.0, 0.0, 0.03))
"""Profil d'un bloc droit (`modele.dalle`)."""

# Puits : rangs du mur, des poteaux, de l'arbre du treuil, des versants, du seau et de la corde dans la recette.
PUITS = {
    "mur": 0, "poteaux": (2, 3), "arbre": 4, "versants": (5, 6), "seau": 7, "corde": 8,
    # Mur (`modele.mur_rond`), en fractions de sa hauteur et de son rayon : par assise, son lit et sa tête, le rayon
    # de son parement et celui de sa queue, son nombre de pierres, le décalage de ses joints (en côtés du polygone) ;
    # `ecart` : celui d'un joint (fraction d'une pierre, tiré jusqu'à cette borne) ; `blocage` : lit, tête, rayon du
    # dehors et du dedans de l'anneau plein derrière les pierres.
    "maconnerie": {
        "assises": ((0.0, 0.27, 0.975, 0.80, 6, 0.0), (0.27, 0.54, 0.975, 0.80, 6, 1.3),
                    (0.54, 0.80, 0.975, 0.80, 6, 0.5), (0.80, 1.0, 0.998, 0.765, 7, 1.7)),
        "ecart": 0.16, "blocage": (0.0, 0.97, 0.955, 0.82)},
    # Bouche d'ombre : dessous et dessus (fractions de la hauteur du mur), rayon (fraction du sien).
    "bouche": (0.50, 0.56, 0.84),
    # Poteau : demi-côté (fraction du sien), part de sa hauteur enfoncée dans la margelle.
    "poteau": {"cote": 0.92, "ancrage": 0.015},
    # Charpente, en fractions du côté d'un poteau sauf mention : `entrait` : demi-portée (fraction de la profondeur (yM)
    # d'un versant), demi-hauteur, demi-épaisseur ; `lien` : hauteur de son pied sous la tête du poteau (fraction de la
    # hauteur du poteau), portée de sa tête (fraction de la demi-portée de l'entrait), demi-largeur, demi-épaisseur ;
    # `poincon` : demi-côté ; `faitage` : profondeur de son axe sous le faîte (fraction de la hauteur d'un versant),
    # demi-hauteur, demi-épaisseur.
    "entrait": (0.70, 0.36, 0.34), "lien": (0.30, 0.75, 0.30, 0.22), "poincon": 0.30, "faitage": (0.46, 0.34, 0.28),
    # Versant, en fractions de sa hauteur sauf mention : `chevron` : profondeur de son axe sous le plan du toit,
    # demi-hauteur, demi-largeur (fraction du côté d'un poteau), part de la pente qu'il laisse à l'égout ; `volige` :
    # profondeur de son axe, demi-épaisseur, demi-largeur (fraction de celle du versant), part de la pente laissée à
    # chaque bout ; `ardoises` : rangs, nombre par rang, écart d'un joint (`geometrie.partage`), épaisseur, jeu sous le
    # plan du toit, recouvrement (fraction d'un rang), jour entre deux ardoises (fraction de la largeur du versant),
    # `bascule` : ce dont sa tête s'enfonce sous le plan du toit plus que son pied (en épaisseurs d'ardoise).
    "chevron": (0.18, 0.07, 0.26, 0.04), "volige": (0.090, 0.022, 0.975, 0.015),
    "ardoises": {"rangs": 5, "nombre": 6, "ecart": 0.22, "epaisseur": 0.03, "jeu": 0.012, "recouvrement": 0.35,
                 "jour": 0.004, "bascule": 1.0},
    # Treuil, en fractions du rayon de l'arbre sauf mention : `depasse` : ce dont il dépasse l'axe de chaque poteau
    # (fraction du côté d'un poteau) ; son profil, tourillons et tambour ; `spires` : nombre de tours de corde, leur
    # creux (fraction de leur rayon), leur demi-largeur (fraction du rayon du seau).
    "treuil": {"depasse": 0.75, "cotes": 10,
               "profil": ((0.0, 0.75), (0.13, 0.75), (0.15, 1.45), (0.85, 1.45), (0.87, 0.75), (1.0, 0.75)),
               "tambour": 1.45, "spires": (5, 0.84, 0.75)},
    # Manivelle, en fractions du côté d'un poteau : écart de son bras à la face du poteau, épaisseur et largeur du bras,
    # son bout (y, z) depuis l'arbre, longueur et rayon de la poignée.
    "manivelle": {"ecart": 0.17, "bras": (0.14, 0.26), "bout": (-0.75, 1.0), "poignee": (0.40, 0.11), "cotes": 6},
    # Douves du seau, en fractions de son rayon et de sa hauteur : profil, du pied à la tête du dehors puis du dedans
    # (`geometrie.tournee`) ; `cercles` : hauteur de chacun (part de celle du seau), puis demi-hauteur, rayon du dedans
    # et du dehors (fractions du rayon du seau à cette hauteur) ; `anse` : flèche (fraction du rayon), rayon du fer
    # (fraction de celui de la corde), nombre de tronçons.
    "douves": {"cotes": 10, "profil": ((0.0, 0.76), (1.0, 0.97), (1.0, 0.85), (0.14, 0.68)),
             "cercles": ((0.22, 0.72), 0.045, 0.90, 1.04), "anse": (0.85, 0.55, 8)},
    "cotes_corde": 6,
}

# Fontaine : rangs du bassin, du fût, de la vasque et du pinacle dans la recette.
FONTAINE = {
    "bassin": 0, "fut": 2, "vasque": 3, "pinacle": 5,
    "maconnerie": {
        "assises": ((0.0, 0.22, 0.998, 0.80, 8, 0.0), (0.22, 0.52, 0.955, 0.82, 8, 0.5),
                    (0.52, 0.80, 0.955, 0.82, 8, 0.0), (0.80, 1.0, 0.998, 0.79, 8, 0.5)),
        "ecart": 0.05, "blocage": (0.0, 0.97, 0.935, 0.84)},
    # Eau du bassin : dessous et dessus (fractions de la hauteur du bassin), rayon (fraction du sien).
    "eau": (0.70, 0.80, 0.86),
    # Fût : son pied (fraction de la hauteur du bassin), ses pans, son profil (part de sa longueur, part du rayon).
    "pied": 0.74, "pans": 8,
    "profil": ((0.0, 2.4), (0.07, 2.4), (0.09, 2.05), (0.13, 2.05), (0.16, 1.5), (0.22, 1.05), (0.31, 1.28),
               (0.42, 1.36), (0.60, 1.0), (0.78, 0.76), (0.84, 0.76), (0.86, 1.08), (0.90, 1.08), (0.92, 0.8),
               (1.0, 0.8)),
    # Vasque : ce dont elle descend sous sa primitive (fraction de sa hauteur), ses côtés, son profil du dehors puis
    # du dedans ; son eau : dessous et dessus (parts de la longueur du profil), rayon (fraction du sien).
    "descente": 1.6, "cotes": 16,
    "coupe": ((0.0, 0.30), (0.22, 0.40), (0.52, 0.68), (0.78, 0.90), (0.90, 0.975), (1.0, 0.975), (1.0, 0.89),
              (0.80, 0.76), (0.68, 0.30)),
    "eau_haute": (0.80, 0.87, 0.82),
    # Pinacle : son pied (part de la longueur du profil de la vasque), son profil.
    "pied_du_pinacle": 0.66,
    "bouton": ((0.0, 1.15), (0.30, 1.0), (0.33, 1.7), (0.38, 1.7), (0.42, 0.9), (0.50, 1.5), (0.62, 1.9), (0.76, 1.5),
               (0.90, 0.75), (1.0, 0.2)),
}

# Abreuvoir : rangs de l'auge et des patins dans la recette. En fractions de la largeur de l'auge sauf mention.
ABREUVOIR = {
    "auge": 0, "patins": (2, 3),
    # `planche` : épaisseur ; `tasseau` : épaisseur, demi-largeur ; `parement` : plan de la face des tasseaux et des
    # bouts des bords (fraction du demi-côté de l'auge) ; `bords` : planches par bord, écart de leur joint, jour entre
    # elles (fraction de la hauteur du bord) ; `bout` : son recul depuis le bout des bords (en épaisseurs de planche) ;
    # `chevilles` : leur rayon, leurs hauteurs dans chaque planche (parts de sa hauteur) ; `eau` : dessus (fraction de
    # la hauteur de l'auge), demi-épaisseur ; `prise` : ce dont les bouts et l'eau entrent dans les bords (fraction de
    # l'épaisseur d'une planche).
    "planche": 0.05, "tasseau": (0.035, 0.055), "parement": 0.985, "bords": (2, 0.10, 0.012), "bout": 1.6,
    "chevilles": (0.014, (0.5,)), "eau": (0.86, 0.02), "prise": 0.25,
}

# Autel : rangs du massif, de la table, des cierges et du sang dans la recette.
AUTEL = {
    "massif": 0, "table": 1, "cierges": (2, 3), "sang": 4,
    # Massif, en fractions de sa hauteur : `plinthe` : sa tête ; `assises` : lit et tête du parement, retrait de sa
    # face, puis le nombre de pierres de chaque assise et l'écart d'un joint ; `noyau` : son retrait derrière le
    # parement ; `corniche` : son lit et son profil (`modele.dalle`).
    "plinthe": 0.13, "assises": (0.13, 0.86, 0.03, (3, 2, 3, 2), 0.14), "noyau": 0.018,
    "corniche": (0.85, ((0.0, 0.20, 0.06), (0.40, 0.20, 0.06), (0.78, -0.14, 0.07), (1.0, -0.14, 0.07))),
    "tablette": ((0.0, 0.45, 0.10), (0.32, 0.06, 0.14), (0.80, 0.06, 0.14), (1.0, 0.22, 0.08)),
    # Cierge : part de sa hauteur qu'il garde (tirée), ses côtés, son profil de cire (dehors puis cuvette), sa mèche :
    # pied et tête (parts de sa hauteur), rayon (fraction du sien).
    "cierge": {"hauteur": (0.68, 1.0), "cotes": 8,
               "profil": ((0.0, 1.75), (0.025, 1.6), (0.07, 0.98), (0.45, 0.92), (0.86, 0.90), (0.86, 0.62),
                          (0.81, 0.3)),
               "meche": (0.78, 0.97, 0.13)},
    # Sang, en fractions de la demi-largeur de sa primitive sauf mention : `flaque` : demi-côtés (le second en fraction
    # de la demi-profondeur de la table), côtés, exposant de son ovale, jeu de son bord, épaisseur (fraction de celle de
    # la table), part de son épaisseur enfoncée sous le dessus de la table, part qu'en garde son dessus ; `coulures` :
    # leur nombre, vers la rive du front, réparties jusqu'à `place`, chacune écartée d'au plus `ecart` de sa part,
    # demi-largeur (tirée), demi-épaisseur (fraction de l'épaisseur de la table), chute sur le chant de la table
    # (fraction de son épaisseur, tirée) ; `filet` : part de sa largeur que garde une coulure le long de sa chute (part
    # de la chute, part de la largeur) ; `filets`, de la flaque à la rive : `depart`, part de la place de sa coulure où
    # il quitte l'axe de la flaque (tirée) ; `meandres`, ses tronçons, lissés à `pas` points chacun (`geometrie.lisse`)
    # ; `sinuosite`, son écart à la droite (fraction de la demi-largeur du sang, tiré jusqu'à cette borne, nul aux deux
    # bouts) ; `evase`, ce dont il s'élargit vers la flaque (fraction de sa largeur).
    "flaque": {"demi": (0.95, 0.50), "cotes": 20, "exposant": 2.0, "jeu": 0.20, "epaisseur": 0.10, "enfonce": 0.5,
               "dessus": 0.88},
    "coulures": {"nombre": 4, "place": 0.95, "ecart": 0.30, "largeur": (0.035, 0.11), "epaisseur": 0.035,
                 "chant": (0.45, 0.95)},
    "filets": {"depart": (0.35, 0.60), "meandres": 4, "pas": 3, "sinuosite": 0.40, "evase": 0.5},
    "filet": ((0.0, 1.0), (0.55, 0.78), (0.92, 0.50), (1.0, 0.22)),
}

# Sarcophage : rangs de la cuve, du couvercle, du coussin et du gisant dans la recette.
SARCOPHAGE = {
    "cuve": 0, "couvercle": 1, "coussin": 2, "gisant": 3,
    # Cuve, en fractions de sa hauteur : tête de la plinthe ; lit et tête du corps, son retrait ; lit du bandeau et son
    # profil ; `pilastre` : demi-côté d'un pilastre d'angle (fraction de la largeur de la cuve), demi-largeur d'un
    # pilastre courant (fraction de celui d'angle), travées d'un long côté ; `fut` : profil d'un pilastre d'angle, à
    # chanfreins arrêtés (`modele.dalle`).
    "plinthe": 0.16, "corps": (0.14, 0.90, 0.04),
    "bandeau": (0.87, ((0.0, 0.14, 0.05), (0.30, 0.0, 0.08), (1.0, 0.0, 0.08))),
    "pilastre": (0.075, 0.80, 3),
    "fut": ((0.0, 0.0, 0.012), (0.08, 0.0, 0.012), (0.12, 0.0, 0.045), (0.88, 0.0, 0.045), (0.92, 0.0, 0.012),
            (1.0, 0.0, 0.012)),
    "batiere": ((0.0, 0.25, 0.08), (0.20, 0.04, 0.12), (0.52, 0.04, 0.12), (1.0, 0.95, 0.05)),
    # Coussin : demi-côté (fraction du sien), hauteur (fraction de la sienne), profil ; tête : rayon (fraction du côté
    # du coussin), recul vers le corps (fraction de ce côté), côtés, profil de boule.
    "coussin_forme": (0.94, 0.55, ((0.0, 0.40, 0.20), (0.30, 0.0, 0.32), (0.70, 0.0, 0.32), (1.0, 0.40, 0.20))),
    "tete": (0.225, 0.10, 10,
             ((0.0, 0.30), (0.10, 0.60), (0.25, 0.87), (0.50, 1.0), (0.75, 0.87), (0.90, 0.60), (1.0, 0.30))),
    # Gisant : points de sa section en arc ; ses sections des épaules aux pieds (part de la longueur de sa primitive,
    # demi-largeur en fraction de la sienne, hauteur en fraction de la sienne).
    "arc": 9,
    "corps_du_gisant": ((-0.13, 0.50, 0.50), (-0.06, 1.40, 0.72), (0.06, 1.50, 1.0), (0.28, 1.42, 0.97),
                        (0.42, 1.24, 0.84), (0.52, 1.30, 0.86), (0.72, 1.10, 0.72), (0.88, 0.92, 0.60),
                        (0.93, 0.90, 1.0), (1.0, 0.84, 0.94)),
}

# Tombe : rangs de la stèle, de son fronton, du tertre et du socle dans la recette.
TOMBE = {
    "stele": 0, "fronton": 1, "tertre": 2, "socle": 3,
    # Stèle : `contour` (part de sa demi-largeur, part de sa hauteur à cet aplomb, fronton compris) ; `largeur` :
    # fraction de sa demi-largeur ; `corps` : part de son épaisseur, depuis le dos ; `arete` : chanfrein (fraction de
    # son épaisseur) ; `cartouche` : part du contour qu'il garde, parts de l'épaisseur, depuis le dos, où commencent son
    # dos et où s'arrête sa face.
    "contour": ((-1.0, 0.0), (1.0, 0.0), (1.0, 0.74), (0.84, 0.75), (0.83, 0.82), (0.74, 0.90), (0.58, 0.96),
                (0.32, 0.99), (0.0, 1.0), (-0.32, 0.99), (-0.58, 0.96), (-0.74, 0.90), (-0.83, 0.82), (-0.84, 0.75),
                (-1.0, 0.74)),
    "largeur": 0.97, "corps": 0.78, "arete": 0.08, "cartouche": (0.78, 0.16, 0.92),
    # Tertre : côtés, exposant de son ovale, jeu de son bord, ses anneaux (part de la hauteur, part des demi-côtés),
    # son sommet (part de la hauteur).
    "tertre_forme": {"cotes": 14, "exposant": 2.8, "jeu": 0.07,
                     "anneaux": ((0.0, 0.98), (0.30, 0.94), (0.62, 0.76), (0.84, 0.48), (0.95, 0.20)), "sommet": 0.99},
}

# Colonne brisée : rangs du socle, de la base, du fût, de sa cassure, du tambour tombé et de l'éclat dans la recette.
COLONNE = {
    "socle": 0, "base": 1, "fut": 2, "cassure": 3, "tambour": 4, "eclat": 5,
    # Base : fraction de son rayon, côtés, profil (`geometrie.tournee`).
    "moulure": (0.975, 24, ((0.0, 0.93), (0.07, 1.0), (0.27, 1.0), (0.35, 0.93), (0.42, 0.86), (0.58, 0.86),
                            (0.64, 0.90), (0.72, 0.94), (0.86, 0.94), (0.94, 0.88), (1.0, 0.84))),
    # Fût : tambours, écart de leurs joints (`geometrie.partage`), rayon au pied et en tête (fractions du sien).
    "tambours": (3, 0.14), "defilement": (0.975, 0.90),
    # Tambour (`modele.tambour`) : cannelures, rayon de leur creux et chanfrein de ses lits (fractions de son rayon).
    "cannele": {"cannelures": 12, "creux": 0.88, "arete": 0.035},
    # Cassure (`modele.cassure`) : ses anneaux (part du rayon, part de sa hauteur), son cœur (part de sa hauteur),
    # `bas` : part de la hauteur que garde le côté bas, `jeu` : part de sa hauteur que garde un sommet (tirée).
    "eclatee": {"anneaux": ((1.0, 0.0), (0.72, 1.0), (0.40, 0.50)), "coeur": 0.30, "bas": 0.12, "jeu": (0.70, 1.0)},
    # Tambour tombé : part de sa hauteur qu'il garde sous sa cassure, azimut du côté bas de celle-ci.
    "tombe": (0.72, 200),
    # Éclat : côtés, exposant, jeu de son pied ; anneau médian (part de la hauteur, part des demi-côtés, déport vers
    # le côté haut en fraction du demi-côté) ; pointe (déport).
    "eclat_forme": {"cotes": 7, "exposant": 2.0, "jeu": 0.18, "median": (0.45, 0.72, 0.22), "pointe": 0.80},
}
