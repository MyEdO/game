"""Données de l'accastillage (#4335) : un GLB par décor `ancre-de-navire`, `barre-de-navire`, `cabestan`,
`mat-de-navire`, `rouleau-de-cordage`, `ecoutille`, `passerelle-d-embarquement` et `canon-de-pont` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration
au corpus : proportions d'adaptation, chacune en fraction de la primitive qui la porte (son rang dans la recette),
dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le haut) ; un azimut est un angle en
degrés dans le plan du sol, de +x vers +y.

- `ancre-de-navire` : une ancre à jas dressée sur une sole de bois : les deux bras cintrés du diamant aux becs, qui
  s'amincissent ; une patte en écusson sur chaque bras, large au milieu, pointue au bec ; la verge ronde, renflée au
  diamant, percée en tête par l'organeau ; le jas de bois, renflé à la verge, tenu par quatre frettes de fer.
- `barre-de-navire` : une colonne sur sa plinthe, qui s'amincit jusqu'à sa tête derrière le moyeu ; le moyeu de laiton
  de la recette, mouluré, enfoncé dans la colonne ; une roue à huit rayons tournés, sa jante plate, une poignée
  tournée au bout de chaque rayon, une cheville à chaque rayon sur la jante.
- `cabestan` : une embase ronde ; une mèche étranglée que ceignent six taquets, larges au pied ; la cloche de la
  recette entre deux frettes de fer ; quatre barres équarries à la cloche, arrondies vers la poignée, à la place des
  deux barres traversantes de la recette ; un chapeau de fer bombé.
- `mat-de-navire` : l'étambrai de la recette, épaulé, fretté, huit coins enfoncés autour du mât ; le bas-mât qui
  défile jusqu'au-dessus de la hune, quatre frettes de fer et une cinquième à la vergue ; les tours de la rousture ;
  un taquet à cornes de chaque côté ; la vergue en fuseau ; la voile ferlée sous la vergue, un boudin de bourrelets
  inégaux que serrent des rabans de corde ; la hune à huit pans sur quatre jottereaux ; le mât de hune et sa pomme.
- `rouleau-de-cordage` : une glène de quatre lits de cordage, deux par couche de la recette : la spire du dehors et
  celle de l'œil à chaque lit, toutes les spires au lit du dessus, sur un cœur d'ombre ; l'œil ouvert, du rayon de la
  primitive d'ombre de la recette ; le bout qui file de la spire du bas jusqu'au bout de la recette.
- `ecoutille` : une hiloire de quatre pièces, les deux longues en x, chevillées aux angles ; deux panneaux de planches
  inégales posés sur l'hiloire, de part et d'autre du barrot de la recette qui couvre leur joint ; sur chacun un
  anneau de fer couché, pris dans son piton.
- `passerelle-d-embarquement` : trois planches inégales du sol à la tête de la rampe, le pied en biseau ; deux
  longerons dessous ; les quatre tasseaux de la recette et un entre deux voisins, chevillés ; en tête, un chevalet à la
  place de l'appui de la recette, deux pieds, un chapeau sous les planches et une entretoise ; les deux poteaux
  tournés de la recette et un chandelier entre eux, une filière de corde qui pend de l'un à l'autre.
- `canon-de-pont` : un canon de fer sur un affût marin : la culasse à bouton et plate-bande, le fût à deux renforts
  et astragale, le bourrelet de la bouche à l'âme creuse, deux tourillons sous l'axe ; deux flasques à redans, une
  sole et une entretoise entre elles ; un coussin et un coin de mire sous le premier renfort ; deux essieux
  équarris, quatre roues pleines à moyeu, chevillées, aux pans de la recette ; un anneau de brague à chaque flasque.

Matières : celles des recettes, sauf : l'ancre, dont la recette est toute de `fer-noirci`, prend `bois-chene` pour son
jas, de bois comme sur une ancre à jas, et pour la sole qui la présente posée ; le cabestan et l'écoutille prennent
pour leurs frettes et leurs pitons le `fer-noirci` de leur chapeau et de leurs anneaux ; le mât prend `fer-noirci`, que
sa recette ne nomme pas, pour ses frettes ; la passerelle prend `corde` pour sa filière. Le cœur de la glène est
d'`ombre`, que la recette donne à son œil. Le catalogue n'a ni goudron ni chanvre goudronné (`corde` pour tout
cordage), ni fer rouillé (`fer-noirci`). Aucun emplacement de palette ne nomme la corde ni l'ombre : elles prennent
`accent` ; la toile, `vet1`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
FER = {"fer": ("metal", "fer-noirci")}
VIEUX = {"vieux": ("bois", "bois-mort")}
CORDE = {"corde": ("accent", "corde")}
MATERIAUX = {
    "ancre-de-navire": {**BOIS, **FER},
    "barre-de-navire": {**BOIS, "laiton": ("metal", "laiton-dore")},
    "cabestan": {**BOIS, **FER},
    "mat-de-navire": {**BOIS, **FER, **CORDE, "toile": ("vet1", "toile-ecrue")},
    "rouleau-de-cordage": {**CORDE, "ombre": ("accent", "ombre")},
    "ecoutille": {**BOIS, **VIEUX, **FER},
    "passerelle-d-embarquement": {**BOIS, **VIEUX, **CORDE},
    "canon-de-pont": {**BOIS, **FER},
}

BUDGET_TRIANGLES = {"ancre-de-navire": 1500, "barre-de-navire": 2000, "cabestan": 1500, "mat-de-navire": 4000,
                    "rouleau-de-cordage": 3600, "ecoutille": 1500, "passerelle-d-embarquement": 1800,
                    "canon-de-pont": 2800}

ANGLE_LISSE = {"bois": 40, "vieux": 40, "fer": 40, "laiton": 40, "corde": 50, "toile": 60, "ombre": 30}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein garde ses
arêtes, une pièce tournée, un cordage et une toile sont ronds."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête de bois adoucie, en fraction de l'épaisseur de la pièce."""

# Ancre : rang du socle, de la verge, du jas, de l'organeau, des pattes et des bras dans la recette.
# `sole` : sa hauteur, sa demi-longueur et sa demi-largeur (parts de celles du socle).
# `courbe` : un bras, du diamant au bec ; `points` : (part de la portée du diamant à la crête de la patte, part de la
# montée du diamant à cette crête), lissés à `pas` points par tronçon ; `rayons` au diamant et au bec (fractions du
# rayon des bras de la recette) ; `assise` : hauteur de l'axe du diamant sur la sole (fraction de son rayon) ; `cotes`.
# `patte` : `pied` : sa naissance (part des points du bras) ; `bec` : sa pointe, de la crête de la primitive vers
# le bout du bras (part) ; `epaisseur` : demi-épaisseur (fraction du rayon des bras) ; `profil` : (part de sa
# longueur, demi-largeur en part de celle de la primitive) ; `chanfrein` : fraction du plus petit demi-côté.
# `fut` : la verge, de l'axe du diamant à l'axe de l'organeau en son point bas ; profil (part de la longueur, part du
# rayon de la primitive), `cotes`.
# `anneau` : l'organeau ; `petit` : rayon de son fer (part de la demi-épaisseur de la primitive) ; `grand` : rayon de
# son dehors (part de celui de la primitive) ; segments du tour et de la section.
# `traverse` : le jas ; `profil` (`geometrie.profilee`) : (part de la longueur, demi-côtés en parts du rayon de la
# primitive, chanfrein en fraction de ce rayon) ; `frettes` : leur place (parts de la longueur) ; `frette` : demi-côté
# (part de celui du jas à sa place) et demi-largeur (fraction de la longueur du jas) ; `chanfrein` : celui d'une
# frette, en fraction de son demi-côté.
ANCRE = {
    "socle": 0, "verge": 1, "jas": 2, "organeau": 3, "pattes": (4, 5), "bras": 6,
    "sole": {"hauteur": 0.5, "longueur": 0.9, "largeur": 0.8},
    "courbe": {"points": ((0.0, 0.0), (0.5, 0.03), (0.9, 0.22), (1.06, 0.55), (1.02, 0.9)), "pas": 4,
               "rayons": (0.85, 0.2), "assise": 0.8, "cotes": 8},
    "patte": {"pied": 0.62, "bec": 0.12, "epaisseur": 0.2,
              "profil": ((0.0, 0.5), (0.3, 1.25), (0.62, 1.05), (1.0, 0.1)), "chanfrein": 0.4},
    "fut": {"profil": ((0.0, 0.95), (0.05, 0.95), (0.1, 0.75), (0.9, 0.6), (0.95, 0.68), (1.0, 0.35)), "cotes": 8},
    "anneau": {"petit": 0.85, "grand": 0.92, "segments": (16, 6)},
    "traverse": {"profil": ((0.0, 0.5, 0.5, 0.175), (0.02, 0.58, 0.58, 0.203), (0.5, 0.89, 0.89, 0.3115),
                            (0.98, 0.58, 0.58, 0.203), (1.0, 0.5, 0.5, 0.175)),
                 "frettes": (0.12, 0.4, 0.6, 0.88), "frette": (1.07, 0.02), "chanfrein": 0.35},
}

# Barre à roue : rang du socle, de la jante, du moyeu et d'un rayon dans la recette.
# `colonne` : `tete` : hauteur de sa tête sur l'axe du moyeu (fraction du rayon du moyeu) ; `enfonce` : ce dont le
# moyeu s'y enfonce (part de sa longueur) ; `profil` : (part de la hauteur, demi-largeur en part de celle du socle,
# demi-profondeur en part de celle du socle, chanfrein en fraction du plus petit demi-côté), sa face avant d'aplomb.
# `moyeu_tourne` : profil de l'avant à l'arrière (part de la longueur, part du rayon), `cotes`.
# `roue` : la jante ; `rayon` : son rayon moyen (part de celui de la primitive) ; `epaisseur` le long de l'axe (part
# de celle de la primitive) ; `largeur` (fraction du rayon de la primitive) ; `segments`.
# `rayons` : leur `nombre` ; `pied` : distance de leur pied à l'axe (fraction du rayon du moyeu) ; `portee` : distance
# du bout des poignées à l'axe (part du rayon de la jante de la recette) ; `profil` du pied à la jante et `poignee` de
# la jante au bout : (part de la longueur, part du rayon du rayon de la recette) ; `cotes` ; `cheville` : rayon
# (fraction de celui du rayon de la recette).
BARRE = {
    "socle": 0, "jante": 1, "moyeu": 2, "rayon": 3,
    "colonne": {"tete": 1.2, "enfonce": 0.25,
                "profil": ((0.0, 0.95, 0.75, 0.06), (0.07, 0.95, 0.75, 0.06), (0.10, 0.72, 0.62, 0.12),
                           (0.62, 0.50, 0.40, 0.12), (0.66, 0.56, 0.44, 0.06), (0.93, 0.42, 0.30, 0.10),
                           (1.0, 0.30, 0.20, 0.10))},
    "moyeu_tourne": {"profil": ((0.0, 0.35), (0.08, 0.6), (0.2, 0.6), (0.28, 0.9), (0.72, 0.9), (0.8, 0.6),
                                (1.0, 0.6)), "cotes": 12},
    "roue": {"rayon": 0.74, "epaisseur": 0.8, "largeur": 0.11, "segments": 24},
    "rayons": {"nombre": 8, "pied": 0.6, "portee": 0.97,
               "profil": ((0.0, 0.9), (0.12, 0.9), (0.18, 0.6), (0.5, 0.85), (0.82, 0.6), (0.88, 0.95), (1.0, 0.95)),
               "poignee": ((0.0, 0.95), (0.22, 0.95), (0.3, 0.55), (0.6, 0.9), (0.9, 0.7), (1.0, 0.35)),
               "cotes": 6, "cheville": 0.5},
}

# Cabestan : rang de l'embase, du fût, de la tête, des barres et du chapeau dans la recette.
# `socle`, `cloche`, `coiffe` : l'embase, la tête et le chapeau tournés ; profil (part de la hauteur, part du rayon de
# la primitive), `cotes`.
# `frette` : cercles de fer de la cloche ; `places` (parts de sa hauteur), rayon moyen et épaisseur (fractions du
# rayon de la tête), hauteur (part de celle de la tête).
# `meche` : le fût tourné, ancré d'`ancrage` (part de sa hauteur) dans l'embase et dans la cloche ; profil, `cotes`.
# `taquets` : leur `nombre` ; `dedans` : rayon de leur face du dedans (fraction du rayon du fût) ; `profil` : (part
# de la hauteur de la mèche, rayon de leur face du dehors en fraction du rayon du fût) ; `largeur` : demi-largeur,
# `chanfrein` (fractions du rayon du fût).
# `barre` : `pied` : distance de son pied à l'axe (fraction du rayon de la tête) ; `portee` : distance de son bout à
# l'axe (part de la demi-longueur de la primitive) ; `profil` (`geometrie.profilee`) : (part de la longueur,
# demi-côtés en parts de la demi-hauteur de la primitive, chanfrein en fraction de cette demi-hauteur).
CABESTAN = {
    "embase": 0, "fut": 1, "tete": 2, "barres": (3, 4), "chapeau": 5,
    "socle": {"profil": ((0.0, 0.91), (0.6, 0.91), (1.0, 0.82)), "cotes": 16},
    "cloche": {"profil": ((0.0, 0.8), (0.12, 0.9), (0.88, 0.9), (1.0, 0.84)), "cotes": 16},
    "coiffe": {"profil": ((0.0, 0.95), (0.4, 0.9), (0.75, 0.6), (1.0, 0.2)), "cotes": 8},
    "frette": {"places": (0.24, 0.76), "rayon": 0.905, "epaisseur": 0.03, "hauteur": 0.2},
    "meche": {"ancrage": 0.03, "profil": ((0.0, 0.8), (0.5, 0.62), (1.0, 0.72)), "cotes": 12},
    "taquets": {"nombre": 6, "dedans": 0.5,
                "profil": ((0.0, 1.25), (0.15, 1.2), (0.5, 0.92), (0.85, 0.92), (1.0, 1.0)),
                "largeur": 0.14, "chanfrein": 0.03},
    "barre": {"pied": 0.5, "portee": 0.98,
              "profil": ((0.0, 0.9, 0.9, 0.135), (0.35, 0.9, 0.9, 0.135), (0.45, 0.75, 0.75, 0.3375),
                         (0.97, 0.55, 0.55, 0.2475), (1.0, 0.4, 0.4, 0.18))},
}

# Mât : rang de l'étambrai, du mât, de la vergue, de la voile, de la hune et de la rousture dans la recette.
# `fut` : le bas-mât, du sol au-dessus de la hune ; `rayons` au pied et en tête (parts de celui de la primitive),
# `cotes` ; `frettes` : leur place (parts de sa hauteur) ; `frette` : hauteur et demi-épaisseur (fractions du rayon de
# la primitive) ; `racage` : hauteur de la frette posée à la vergue (fraction du rayon de la vergue).
# `mat_de_hune` : du dessous de la hune à la cime ; profil (part de la longueur, part du rayon de la primitive).
# `collier` : l'étambrai tourné ; profil (part de la hauteur, part du rayon de la primitive), `cotes` ; `frette` :
# sa place (part de la hauteur), son rayon moyen (part du rayon), sa hauteur (part de la hauteur), son épaisseur
# (fraction du rayon).
# `coins` : leur `nombre` ; `dedans` : rayon de leur face du dedans (part du rayon du mât à la tête de l'étambrai) ;
# `profil` : (hauteur sur la tête de l'étambrai en part de sa hauteur, rayon de leur face du dehors en part du rayon
# de l'étambrai) ; `largeur` : demi-largeur, `chanfrein` (fractions du rayon de l'étambrai).
# `tours` : la rousture ; `etendue` : son pied et sa tête depuis le milieu de la primitive (parts de sa hauteur) ;
# `rayon` : du dehors des tours (part de celui de la primitive) ; `creux` : entre deux tours (part du rayon du
# dehors) ; `nombre` de tours ; `cotes`.
# `taquet` : `hauteur` de son milieu (part de la hauteur du mât) ; `profil` : (hauteur depuis son milieu, rayon de sa
# face du dedans, rayon de sa face du dehors), en fractions du rayon du mât de la recette ; `largeur` : demi-largeur,
# `chanfrein` (fractions du même rayon).
# `espar` : la vergue ; profil (part de la longueur, part du rayon de la primitive), `cotes`.
# `ferlee` : la voile, ses sections ovales pendues par leur tête ; `longueur` (part de celle de la primitive) ;
# `avance` : place de son axe de la vergue vers le milieu de la primitive (part) ; `sous` : hauteur de sa tête sous
# l'axe de la vergue (fraction du rayon de la vergue) ; `epais` (part de la demi-épaisseur de la primitive) et `haut`
# (fraction du rayon de la vergue) : demi-axes de sa section ; `bourrelets` : leur nombre ; `gonfle` : part de ces
# demi-axes que garde un bourrelet (tirée) ; `serre` : celle que garde la voile sous un raban ; `galbe` : (part de la
# longueur d'un bourrelet, part de son gonflement au-delà du raban) ; `segments` ; `raban` : sa demi-largeur
# (fraction du rayon de la vergue) et ses demi-axes (parts de ceux de la voile qu'il serre).
# `plateau` : la hune ; profil (part de la hauteur, part du rayon de la primitive), `cotes`.
# `jottereau` : leur `nombre` ; `dedans` : rayon de sa face du dedans (part du rayon du mât sous la hune) ;
# `profil` : (hauteur depuis le dessous de la hune en part de sa hauteur, rayon de sa face du dehors en part du rayon
# de la hune) ; `largeur` : demi-largeur, `chanfrein` (fractions du rayon de la hune).
MATURE = {
    "etambrai": 0, "mat": 1, "vergue": 2, "voile": 3, "hune": 4, "rousture": 5,
    "fut": {"rayons": (0.9, 0.68), "cotes": 12, "frettes": (0.2, 0.36, 0.52, 0.86), "frette": (0.35, 0.035),
            "racage": 2.6},
    "mat_de_hune": {"profil": ((0.0, 0.5), (0.86, 0.4), (0.9, 0.62), (0.96, 0.62), (1.0, 0.25))},
    "collier": {"profil": ((0.0, 0.9), (0.5, 0.9), (0.56, 0.72), (1.0, 0.66)), "cotes": 16,
                "frette": (0.78, 0.7, 0.2, 0.025)},
    "coins": {"nombre": 8, "dedans": 0.8, "profil": ((-0.35, 0.6), (0.0, 0.6), (0.3, 0.52)), "largeur": 0.07,
              "chanfrein": 0.012},
    "tours": {"etendue": (-0.3, 0.32), "rayon": 0.9, "creux": 0.86, "nombre": 12, "cotes": 12},
    "taquet": {"hauteur": 0.18,
               "profil": ((-0.6, 1.1, 1.2), (-0.26, 1.08, 1.3), (-0.16, 0.7, 1.3), (0.16, 0.7, 1.3),
                          (0.26, 1.08, 1.3), (0.6, 1.1, 1.2)),
               "largeur": 0.13, "chanfrein": 0.03},
    "espar": {"profil": ((0.0, 0.45), (0.02, 0.55), (0.1, 0.9), (0.9, 0.9), (0.98, 0.55), (1.0, 0.45)), "cotes": 8},
    "ferlee": {"longueur": 0.94, "avance": 0.55, "sous": 0.3, "epais": 0.9, "haut": 1.7, "bourrelets": 6,
               "gonfle": (0.9, 1.0), "serre": 0.8, "galbe": ((0.2, 0.7), (0.5, 1.0), (0.8, 0.7)), "segments": 12,
               "raban": (0.25, 1.08)},
    "plateau": {"profil": ((0.0, 0.8), (0.25, 0.97), (1.0, 0.97)), "cotes": 8},
    "jottereau": {"nombre": 4, "dedans": 0.6, "profil": ((-2.5, 0.5), (-1.2, 0.55), (0.0, 0.85), (0.3, 0.85)),
                  "largeur": 0.09, "chanfrein": 0.015},
}

# Rouleau de cordage : rang des couches, du pied à la tête, de l'œil et du bout dans la recette.
# `lits` : lits de cordage par couche ; `gras` : rayon du cordage (part de la demi-hauteur d'un lit), ce dont deux
# lits voisins se pénètrent ; `spires` : spires du lit du dessus ; `jeu` : déport d'une spire (fraction du rayon du
# cordage, tiré jusqu'à cette borne) ; `segments` du tour et de la section d'une spire.
# `coeur` : ce dont il s'arrête sous la tête et sur le pied de sa couche (fraction du rayon du cordage) ; segments.
# `filant` : le bout ; `depart` : écart d'azimut, en degrés, entre le point où il quitte la spire du bas et l'azimut
# du bout de la recette ; `amorce` : azimut de son premier point, en amont (part de `depart`) ; `milieu`, `fin` : ses
# points sur l'axe du bout de la recette, depuis son milieu (parts de sa demi-longueur) ; `pas` ; `cotes`.
ROULEAU = {
    "couches": (0, 1), "oeil": 2, "bout": 3,
    "lits": 2, "gras": 1.2, "spires": 3, "jeu": 0.08, "segments": (24, 6),
    "coeur": {"retrait": 0.9, "segments": 24},
    "filant": {"depart": 40, "amorce": 1.3, "milieu": -0.6, "fin": 0.92, "pas": 4, "cotes": 6},
}

# Écoutille : rang de l'hiloire, du panneau, du barrot et des anneaux dans la recette.
# `piece` : largeur d'une pièce d'hiloire (part du côté de la primitive) ; `ancrage` : ce dont une pièce courte entre
# dans une longue (part de cette largeur) ; `cheville` : rayon (fraction de cette largeur).
# `planches` : leur nombre par panneau ; `ecart` de leurs joints (part de leur largeur) ; `epaisseur` (part de celle
# de la primitive, tirée) ; `pose` : ce dont un panneau entre dans l'hiloire (part de son épaisseur) ; `jour` :
# demi-jour entre deux planches et au joint des panneaux (fraction du côté de la primitive) ; `chanfrein` : fraction
# de l'épaisseur de la primitive.
# `couvre_joint` : le barrot, du dessus de la primitive jusque sous le plus bas des dessus des planches qu'il
# couvre ; demi-largeur et longueur (parts de celles de la primitive) ; ce dont il entre sous ce dessus (part de la
# hauteur de la primitive).
# `anneau` : `petit` : rayon de son fer (part de la hauteur de la primitive) ; `grand` : rayon de son dehors (part de
# celui de la primitive) ; `pose` : ce dont il s'enfonce dans la planche qui le porte (part de `petit`) ; segments du
# tour et de la section ; `piton` : demi-côté (fraction de `petit`) et chanfrein (fraction de ce demi-côté).
ECOUTILLE = {
    "hiloire": 0, "panneau": 1, "barrot": 2, "anneaux": (3, 4),
    "piece": 0.12, "ancrage": 0.1, "cheville": 0.09,
    "planches": {"nombre": 5, "ecart": 0.14, "epaisseur": (0.86, 1.0), "pose": 0.08, "jour": 0.002,
                 "chanfrein": 0.12},
    "couvre_joint": (0.95, 0.99, 0.3),
    "anneau": {"petit": 0.4, "grand": 0.85, "pose": 0.2, "segments": (14, 5), "piton": (1.5, 0.3)},
}

# Passerelle : rang de la rampe, des tasseaux, de l'appui et des poteaux, celui du pied puis celui de la tête, dans
# la recette.
# `planches` : leur `nombre` ; `ecart` de leurs joints (part de leur largeur) ; `largeur` du tablier (part de celle
# de la rampe) ; `epaisseur` (fraction de la hauteur de la rampe) ; `jour` : demi-jour entre deux planches (fraction
# de la largeur de la rampe) ; `pied` : place de leur première section sur le biseau (part de sa longueur) ; `bout` :
# retrait de leur tête sous celle de la rampe (fraction de la longueur de la rampe, tiré).
# `longeron` : `place` de son axe (part de la demi-largeur de la rampe) ; `depart` (part de la longueur du
# rampant) ; demi-largeur (fraction de la largeur de la rampe) ; hauteur (fraction de celle de la rampe) ; `ancrage` :
# ce dont il entre dans les planches (part de leur épaisseur).
# `tasseau` : `entre` : tasseaux ajoutés entre deux voisins de la recette ; longueur, demi-largeur et hauteur (parts
# de celles de la primitive) ; `ancrage` dans les planches (part de sa hauteur) ; `chevilles` : leur place (parts de
# sa demi-longueur) et leur rayon (fraction de sa largeur).
# `chevalet` : `pieds` : leur place (part de la demi-largeur de l'appui) et leur demi-côté (fraction de la longueur
# de l'appui) ; `chapeau` : demi-longueur (part de la demi-largeur de l'appui), demi-largeur (part de la
# demi-longueur de l'appui), hauteur (part de celle de l'appui), ce dont il entre dans les planches (part de leur
# épaisseur) ; `entretoise` : hauteur de son axe (part de celle de l'appui) et demi-côté (part de celui d'un pied).
# `poteau` : profil (part de la hauteur, part du rayon de la primitive), `cotes` ; `entre` : chandeliers ajoutés
# entre les deux poteaux ; `ancrage` : ce dont un pied entre dans les planches (part de leur épaisseur).
# `filiere` : `rayon` (fraction de celui d'un poteau) ; `tete` : sa hauteur sous la tête d'un poteau (part de la
# hauteur d'un poteau de la recette) ; `fleche` : ce dont elle pend entre deux poteaux (fraction de leur distance) ;
# `pas` ; `cotes`.
PASSERELLE = {
    "rampe": 0, "tasseaux": (1, 2, 3, 4), "appui": 5, "poteaux": (6, 7),
    "planches": {"nombre": 3, "ecart": 0.12, "largeur": 0.98, "epaisseur": 0.065, "jour": 0.003, "pied": 0.05,
                 "bout": (0.004, 0.02)},
    "longeron": {"place": 0.66, "depart": 0.32, "largeur": 0.04, "hauteur": 0.11, "ancrage": 0.15},
    "tasseau": {"entre": 1, "longueur": 0.97, "largeur": 0.42, "hauteur": 0.8, "ancrage": 0.2,
                "chevilles": ((-0.6, 0.55), 0.16)},
    "chevalet": {"pieds": (0.8, 0.2), "chapeau": (0.97, 0.5, 0.16, 0.2), "entretoise": (0.3, 0.6)},
    "poteau": {"profil": ((0.0, 0.9), (0.84, 0.72), (0.88, 0.95), (0.95, 0.95), (1.0, 0.5)), "cotes": 8, "entre": 1,
               "ancrage": 0.5},
    "filiere": {"rayon": 0.4, "tete": 0.1, "fleche": 0.04, "pas": 4, "cotes": 6},
}

PIED_DE_CHEVALET = ((0.0, 1.0, 1.0, 0.08), (0.9, 1.0, 1.0, 0.08), (1.0, 0.85, 0.85, 0.08))
"""Profil d'un pied du chevalet de la passerelle (`geometrie.profilee`)."""

# Canon de pont : rang de l'affût, des roues (par essieu), du fût, de la culasse et de la bouche dans la recette.
# `tournes` : les pièces du tube, chacune tournée dans son cylindre, de la culasse vers la bouche : son profil (part
# de sa longueur, part de son apothème) ; celui de la bouche revient au fond de l'âme ; `cotes`.
# `tourillon` : `place` (part de la longueur du fût depuis la culasse) ; `bas` : ce dont son axe est sous celui du
# fût, et `rayon` (parts de l'apothème du fût) ; `cotes` ; il file de chaque côté jusqu'à sa portée sous l'enveloppe.
# `flasque` : `place` de son milieu (part de la demi-largeur de l'affût) ; `epais` (part de cette largeur) ;
# `contour` : (part de la longueur de l'affût depuis l'arrière, hauteur en part de celle de l'axe des tourillons
# sur le dessous de l'affût).
# `sole` : son épaisseur (part de la hauteur de l'affût), ses bouts (parts de sa longueur depuis l'arrière).
# `entretoise` : sa place (part de la longueur de l'affût), sa demi-épaisseur (fraction de cette longueur), sa
# tête (part de la hauteur des flasques) ; `ancrage` : ce dont l'entretoise, le coussin et le coin entrent dans ce
# qui les porte (part de l'épaisseur de la sole).
# `coin` : ses bouts, le gros puis le mince (parts de la longueur de l'affût depuis l'arrière) ; leur épaisseur
# (parts de la hauteur entre la sole et le dessous du fût) ; sa demi-largeur (part de celle d'une flasque à
# l'autre) ; `coussin` : sa demi-épaisseur (fraction de la longueur de l'affût).
# `essieu` : son demi-côté (part du rayon d'une roue).
# `roue` : son profil du dedans au dehors (part de son épaisseur, part de son rayon) ; `chevilles` : leur nombre,
# la place de leur face (part de l'épaisseur de la roue), leur distance à l'axe et leur rayon (parts du rayon).
# `anneau` (`modele.anneau_de_fer`) : `place` (part de la longueur de l'affût, part de la hauteur des flasques) ;
# `grand` : rayon de son dehors, `petit` : rayon de son fer (parts du rayon d'une roue) ; `pose` : ce dont il
# s'enfonce dans la flasque (part de `petit`) ; segments du tour et de la section.
CANON = {
    "affut": 0, "roues": ((1, 2), (3, 4)), "fut": 5, "culasse": 6, "bouche": 7,
    "tournes": (("culasse", ((0.0, 0.16), (0.08, 0.27), (0.2, 0.27), (0.3, 0.15), (0.38, 0.15), (0.42, 0.55),
                             (0.5, 0.92), (0.62, 1.0), (0.78, 1.0), (0.84, 0.86), (1.0, 0.86))),
                ("fut", ((0.0, 0.98), (0.29, 0.94), (0.3, 1.0), (0.33, 1.0), (0.34, 0.88), (0.54, 0.84), (0.55, 0.92),
                         (0.575, 0.92), (0.585, 0.78), (0.93, 0.66), (0.94, 0.74), (0.96, 0.74), (0.97, 0.66),
                         (1.0, 0.66))),
                ("bouche", ((0.0, 0.6), (0.25, 0.86), (0.55, 1.0), (0.8, 1.0), (1.0, 0.82), (1.0, 0.42),
                            (0.4, 0.42)))),
    "cotes": 16,
    "tourillon": {"place": 0.42, "bas": 0.6, "rayon": 0.24, "cotes": 8},
    "flasque": {"place": 0.59, "epais": 0.125,
                "contour": ((0.0, 0.0), (0.0, 0.3), (0.12, 0.3), (0.12, 0.52), (0.26, 0.52), (0.26, 0.76),
                            (0.42, 0.76), (0.42, 1.0), (0.88, 1.0), (0.97, 0.7), (0.97, 0.0))},
    "sole": (0.25, (0.03, 0.95)),
    "entretoise": (0.9, 0.03, 0.8), "ancrage": 0.3,
    "coin": {"bouts": (0.14, 0.44), "epais": (0.42, 0.14), "largeur": 0.5}, "coussin": 0.045,
    "essieu": 0.28,
    "roue": {"profil": ((0.0, 0.9), (0.06, 1.0), (0.62, 1.0), (0.68, 0.92), (0.68, 0.36), (0.92, 0.3), (1.0, 0.22)),
             "chevilles": (4, 0.68, 0.66, 0.07)},
    "anneau": {"place": (0.34, 0.45), "grand": 0.24, "petit": 0.035, "pose": 0.5, "segments": (12, 5)},
}
