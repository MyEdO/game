"""Données des meubles (#4335) : un GLB par décor `table`, `table-2x1`, `chaise`, `banc`, `tabouret`, `armoire`,
`bureau`, `bureau-2x1`, `etagere`, `lit`, `comptoir-droit`, `comptoir-angle`, `etabli`, `etabli-2x1`, `siege`,
`fauteuil-loge`, `canape`, `coiffeuse`, `table-ronde-4-tabourets` et `table-murale-2-tabourets` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration
au corpus : proportions d'adaptation, du mobilier d'auberge menuisé, chacune en fraction de la primitive qui la porte
(son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le
haut).

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
- `armoire` : une caisse entre quatre montants, sur une plinthe moulurée et quatre pieds en boule, sous une corniche ;
  deux portes à cadre chevillé et deux panneaux à plate-bande chacune, fermées sur le battement de la recette ; trois
  traverses à chaque flanc ; deux pentures de fer par porte, sur leur nœud, et les deux boutons de la recette, chacun
  sur sa platine.
- `bureau`, `bureau-2x1` : le plateau d'une table ; un caisson entre quatre poteaux, ses flancs et son dos à traverses,
  sa façade aux tiroirs de la recette, à plate-bande et à boutons de bois tournés, entre leurs traverses ; à l'autre
  bout deux pieds à chanfreins arrêtés, la traverse basse de la recette, une ceinture chevillée jusqu'au caisson et
  une entretoise.
- `etagere` : quatre poteaux à la place des deux montants de la recette, coiffés en pointe ; les trois tablettes de
  la recette, de planches jointes, chacune sur deux traverses de flanc chevillées et une traverse de dos ; une
  traverse basse à chaque flanc ; une croix de contreventement au dos de chaque travée ; une rangée de livres et une
  pile de livres couchés, et un coffret.
- `lit` : deux poteaux de tête et deux poteaux de pied, deux longerons et deux traverses chevillés ; un chevet haut
  de trois panneaux à plate-bande entre deux traverses et deux montants ; le pied du lit, sa traverse ; un matelas, un
  oreiller, une couverture qui retombe sur les longerons et le drap rabattu sur elle.
- `comptoir-droit`, `comptoir-angle` : un corps plein sur sa plinthe en retrait, sous un plateau de planches égales en
  débord, épaissi d'un chant sous chaque rive de façade ; chaque façade, un cadre chevillé de montants et de deux
  traverses autour des panneaux à plate-bande de la recette ; chaque bout, le même cadre sous la face du corps, en
  retrait de la tête de ses chevilles ; le dos du comptoir droit, côté service, une niche ouverte sur sa tablette ; le
  repose-pied de fer de la recette sur ses supports à manchon. Le comptoir d'angle est deux corps d'onglet : ses
  planches suivent chaque façade et se joignent sur la diagonale. Les rives de bout sont à fleur, les planches de même
  largeur d'un comptoir à l'autre : les comptoirs se suivent.
- `etabli`, `etabli-2x1` : un plateau de madriers ; quatre pieds à chanfreins arrêtés, une ceinture chevillée, une
  traverse basse à chaque bout, l'entretoise de la recette, tenons clavetés, et une tablette basse de planches ; à la
  place de l'étau de la recette, une presse à deux mors de bois dressés sur le plateau, sa vis et son levier de fer ;
  un maillet posé ; sur l'établi long, la scie de la recette, lame à plat et poignée de bois.
- `siege`, `fauteuil-loge` : deux pieds avant tournés sous un dé carré, prolongés d'une console tournée jusqu'à
  l'accoudoir, en dévers vers lui ; deux montants arrière d'une pièce du sol à la lisse, inclinés ; une ceinture
  chevillée, cloutée de laiton devant et aux flancs ; deux barreaux de flanc et l'entretoise qui les joint ; un
  coussin bombé ; un dossier garni devant, à panneau au dos ; la lisse de la recette, tournée, à pommeaux ; deux
  accoudoirs coudés du montant à la console, de bois sur le siège, dorés sur le fauteuil de loge.
- `canape` : six pieds en boule sous un corps plein à trois panneaux de façade ; trois coussins bombés entre deux
  accoudoirs garnis, chacun un flanc évasé sous un rouleau à rosace de laiton ; un dossier de trois travées garnies
  devant, à panneaux au dos ; la lisse de la recette.
- `coiffeuse` : quatre pieds tournés, en dévers jusqu'au corps, sous leurs poteaux ; deux caissons de deux tiroirs et
  un tablier d'un tiroir entre eux, sur le vide des genoux ; un plateau de planches ; un gradin de deux tiroirs ; un
  miroir dans son cadre, ses montants dressés sur le plateau à la place des deux montants de la recette, sa traverse
  haute cintrée ; la glace en retrait dans le cadre, là où la recette la pose devant lui.
- `table-ronde-4-tabourets` : un plateau rond tourné, cerclé de fer ; un fût en balustre bagué de fer, à la place du
  fût de fer de la recette ; quatre patins cambrés dans l'emprise de son socle et quatre goussets sous le plateau, sur
  les diagonales ; quatre tabourets.
- `table-murale-2-tabourets` : un plateau de planches ; à la place de chaque prisme de la recette, une console : un
  montant à chanfreins arrêtés contre le mur, un bras sous le plateau et une jambe de force, chevillés ; une lisse
  entre les montants ; deux tabourets.
- Le tabouret d'une table est celui du décor `tabouret` : une assise ronde creusée, plus étroite que le disque de la
  recette, trois pieds tournés en dévers dans l'emprise de son fût et trois barreaux.

Matières : celles des recettes. L'armoire prend `fer-noirci` pour ses pentures comme pour ses boutons ; les livres de
l'étagère, dont la recette est toute de `bois-chene`, sont de `cuir-tanne` ; l'établi et la table ronde prennent
`fer-noirci`, que leur recette ne nomme pas, l'un pour la vis et le levier de sa presse, l'autre pour le cercle de son
plateau et la bague de son fût ; l'établi long aussi, pour les mêmes pièces de sa presse. Le catalogue n'a ni velours ni
tissu d'ameublement : la garniture des sièges garde `toile-rouge`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
MATERIAUX = {
    **{id_: BOIS for id_ in ("table", "table-2x1", "chaise", "banc", "tabouret", "bureau", "bureau-2x1")},
    "armoire": {**BOIS, "fer": ("metal", "fer-noirci")},
    "etagere": {**BOIS, "cuir": ("cuir", "cuir-tanne")},
    "lit": {**BOIS, "ecru": ("vet1", "toile-ecrue"), "rouge": ("vet2", "toile-rouge")},
    **{id_: {**BOIS, "fer": ("metal", "fer-noirci")}
       for id_ in ("comptoir-droit", "comptoir-angle", "etabli", "table-ronde-4-tabourets")},
    "etabli-2x1": {**BOIS, "fer": ("metal", "fer-noirci"), "acier": ("metal2", "acier-battu")},
    **{id_: {**BOIS, "rouge": ("vet1", "toile-rouge"), "laiton": ("metal", "laiton-dore")}
       for id_ in ("siege", "fauteuil-loge", "canape")},
    "coiffeuse": {**BOIS, "glace": ("corps", "miroir")},
    "table-murale-2-tabourets": BOIS,
}

BUDGET_TRIANGLES = {"table": 1400, "table-2x1": 1400, "chaise": 2000, "banc": 1200, "tabouret": 1300, "armoire": 2400,
                    "bureau": 2000, "bureau-2x1": 2200, "etagere": 2300, "lit": 2200,
                    "comptoir-droit": 2400, "comptoir-angle": 2300, "etabli": 2000, "etabli-2x1": 2100,
                    "siege": 2400, "fauteuil-loge": 2400, "canape": 2000, "coiffeuse": 2600,
                    "table-ronde-4-tabourets": 6000, "table-murale-2-tabourets": 3400}

ANGLE_LISSE = {"bois": 40, "ferrures": 30, "objets": 40, "literie": 50, "fers": 50, "lame": 50, "garniture": 50,
               "dorures": 40, "glace": 30}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein garde ses arêtes,
une pièce tournée est ronde."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête adoucie, en fraction du plus petit demi-côté de la section."""

CUVETTE = (0.82, 0.55, 0.25)
"""Les anneaux du creux d'une assise, chacun la part du contour de l'assise qu'il garde."""

# Profil d'un pied carré à chanfreins arrêtés, du sol à la tête (`geometrie.profilee`).
PIED_CARRE = ((0.0, 0.86, 0.86, 0.08), (0.02, 1.0, 1.0, 0.08), (0.30, 1.0, 1.0, 0.08), (0.36, 1.0, 1.0, 0.38),
              (0.72, 1.0, 1.0, 0.38), (0.78, 1.0, 1.0, 0.08), (1.0, 1.0, 1.0, 0.08))

# Plateau de planches jointes (`modele.plateau`) : `planches` : nombre ; `largeurs` : part de chacune, tirée ; `bouts` :
# retrait d'un bout (fraction de la demi-largeur du plateau, tiré jusqu'à cette borne) ; `affleurement` : ce dont une
# planche s'enfonce sous le dessus (fraction de son épaisseur, tiré) ; `rive` : chanfrein d'une rive (fraction de la
# demi-épaisseur).
PLANCHES = {"planches": 5, "largeurs": (0.8, 1.2), "bouts": 0.025, "affleurement": (0.0, 0.05), "rive": 0.14}

PANNEAU = {"biseau": 0.24, "champ": 0.55}
"""Plate-bande d'un panneau : largeur de son biseau (fraction de son plus petit demi-côté) et part de sa saillie que le
biseau prend."""

# Table (`table`, `table-2x1`) : rang du plateau, de la ceinture et des pieds dans la recette ; son plateau
# (`PLANCHES`).
# `pied` : son demi-côté (fraction de celui de la primitive) et son profil.
# `ceinture` : hauteur (fraction de celle de la primitive), demi-épaisseur et retrait de sa face sous celle du pied
# (fractions du demi-côté du pied), hauteurs de ses chevilles (fractions de sa demi-hauteur).
# `cheville` : rayon (fraction du demi-côté du pied).
# `entretoise` : hauteur (fraction de celle du pied) ; `traverse` basse, `corps` et `tenon` : demi-largeur et
# demi-hauteur (fractions du demi-côté du pied) ; `saillie` du tenon au-delà de l'axe de la traverse ; `clavette` :
# sa place sur cette saillie, ses demi-côtés (le long de l'entretoise, en travers), ce qu'elle dépasse sous et sur
# l'axe du tenon (le tout en fractions de la demi-hauteur du tenon), et la part de sa section qu'elle garde en bas.
TABLE = {
    "plateau": 0, "ceinture_lue": 1, "pieds": (2, 3, 4, 5), **PLANCHES,
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
    "montant": ((0.0, 0.84, 0.84, 0.10), (0.02, 1.0, 1.0, 0.10), (0.10, 1.0, 1.0, 0.10), (0.14, 1.0, 1.0, 0.40),
                (0.37, 1.0, 1.0, 0.40), (0.41, 1.0, 1.0, 0.10), (0.965, 1.0, 1.0, 0.10), (0.985, 0.90, 0.90, 0.30),
                (1.0, 0.55, 0.55, 0.30)),
    "barreaux": {"rayon": 0.95, "cotes": 6, "profil": ((0.0, 0.70), (0.25, 1.0), (0.44, 0.80), (0.50, 1.15), (0.56, 0.80), (0.75, 1.0), (1.0, 0.70)),
                 "cotes_h": 0.52, "arriere_h": 0.36},
    "dossier": {"epaisseur": 0.50, "lattes": (-2, 0, 2), "latte": (0.85, 0.36), "cintre": 0.85, "stations": 7},
}

# Bureau (`bureau`, `bureau-2x1`) : rang du plateau (`PLANCHES`) et du caisson ; tranche des tiroirs ; rang des pieds et
# de leur traverse basse, comptés de la fin de la recette.
# `pied` : son demi-côté (fraction de celui de la primitive) et son profil ; `poteau` : profil d'un poteau du caisson,
# du même demi-côté.
# `ceinture` : demi-hauteur, demi-épaisseur et retrait de sa face (fractions du demi-côté du pied).
# `entretoise` : demi-largeur et demi-hauteur (fractions de celles de la traverse basse).
# `caisse` : `garde` au sol (part de la hauteur sous le plateau) ; `retrait` de ses faces sous celles des poteaux ;
# `traverse` de flanc et de dos : demi-épaisseur, retrait de sa face, demi-hauteur (le tout en fractions du demi-côté
# du poteau).
# `tiroir` : `largeur` et `hauteur` de sa face (fractions de celles de la primitive) ; `saillie` de sa face (part de
# la distance de la caisse au devant de la primitive) ; `traverse` de façade : part du jour entre deux tiroirs qu'elle
# prend ; `boutons` : leur place par décor (fractions de la demi-largeur de la face) ; `bouton` : rayon (fraction de
# la demi-hauteur de la face), côtés, profil.
BUREAU = {
    "plateau": 0, "caisson": 1, "tiroirs": (2, -3), "pieds": (-3, -2), "traverse": -1, **PLANCHES,
    "pied": {"cote": 0.92, "profil": PIED_CARRE},
    "poteau": ((0.0, 0.84, 0.84, 0.08), (0.03, 1.0, 1.0, 0.08), (1.0, 1.0, 1.0, 0.08)),
    "ceinture": {"hauteur": 1.3, "epaisseur": 0.30, "retrait": 0.22},
    "cheville": 0.20,
    "entretoise": (0.9, 0.8),
    "caisse": {"garde": 0.10, "retrait": 0.42, "traverse": (0.22, 0.10, 0.9)},
    "tiroir": {"largeur": 0.98, "hauteur": 1.28, "saillie": 0.40, "traverse": 0.72,
               "boutons": {"bureau": (0.0,), "bureau-2x1": (-0.5, 0.5)},
               "bouton": {"rayon": 0.27, "cotes": 8, "profil": ((0.0, 0.50), (0.35, 0.42), (0.55, 1.0), (0.85, 0.95), (1.0, 0.55))}},
}

# Armoire : `rangs` du socle, du corps, de la corniche et du battement dans la recette, et ceux de ses deux `boutons`.
# `pied` : hauteur (part de celle du socle), rayon (fraction de la demi-profondeur du socle), côtés, profil.
# `plinthe`, `corniche` : profil (part de la hauteur, part du débord, de 0 au nu du corps à 1 au nu de la primitive) ;
# `bandeau` : ce dont la corniche descend sur le corps (fraction de sa hauteur).
# `montant` : demi-côté (fraction de la largeur du battement) ; `caisse` : retrait de ses flancs et de son dos sous
# les montants (fraction de leur demi-côté).
# `flanc` : hauteurs de ses traverses (parts de celle du corps), leur demi-hauteur, leur demi-épaisseur et le retrait
# de leur face (fractions du demi-côté du montant).
# `porte` : `jeu` autour d'elle (fraction du demi-côté du montant) ; `saillie` de sa face sur celle du corps (part de la
# saillie du battement) ; `cadre` : demi-largeur de ses montants et de ses traverses (fraction du demi-côté du
# montant) ; `traverse` : épaisseur de ses traverses (part de celle de ses montants) ; `milieu` : hauteur de sa
# traverse du milieu (part de celle de la porte) ; `panneau` : sa saillie (part de celle de la porte) ; `cheville` :
# rayon (fraction du demi-côté du montant).
# `penture` : hauteurs (parts de celle de la porte), longueur (part de la largeur de la porte), demi-hauteur et
# épaisseur (fractions du demi-côté du montant), places de ses clous (parts de sa longueur), leur rayon (fraction de
# sa demi-hauteur) ; `noeud` : rayon et demi-hauteur (fractions du demi-côté du montant), côtés.
# `bouton` : `platine` : demi-largeur, demi-hauteur (fractions de la hauteur du bouton de la recette), épaisseur
# (fraction de sa profondeur) ; rayon (fraction de sa demi-hauteur), côtés, profil.
ARMOIRE = {
    "rangs": {"socle": 0, "corps": 1, "corniche": 2, "battement": 3}, "boutons": (4, 5),
    "pied": {"hauteur": 0.55, "rayon": 0.24, "cotes": 8, "profil": ((0.0, 0.55), (0.25, 0.95), (0.55, 1.0), (0.85, 0.70), (1.0, 0.80))},
    "plinthe": ((0.0, 0.85), (0.12, 1.0), (0.55, 1.0), (0.75, 0.55), (1.0, 0.0)),
    "corniche": ((0.0, 0.0), (0.12, 0.10), (0.30, 0.18), (0.55, 0.45), (0.74, 0.92), (0.78, 1.0), (0.95, 1.0), (1.0, 0.90)),
    "bandeau": 0.35,
    "montant": 0.75, "caisse": 0.40,
    "flanc": {"hauteurs": (0.045, 0.5, 0.955), "hauteur": 1.2, "epaisseur": 0.22, "retrait": 0.10},
    "porte": {"jeu": 0.10, "saillie": 0.32, "cadre": 1.05, "traverse": 0.85, "milieu": 0.42, "panneau": 0.45, "cheville": 0.20},
    "penture": {"hauteurs": (0.14, 0.86), "longueur": 0.55, "hauteur": 0.42, "epaisseur": 0.14, "clous": (0.30, 0.70), "clou": 0.42,
                "noeud": (0.26, 1.15), "cotes": 6},
    "bouton": {"platine": (0.40, 1.0, 0.10), "rayon": 0.72, "cotes": 8,
               "profil": ((0.0, 0.45), (0.40, 0.38), (0.60, 1.0), (0.88, 0.90), (1.0, 0.45))},
}

# Étagère : rang des deux montants et des trois tablettes (`PLANCHES`) dans la recette.
# `poteau` : demi-côté (fraction de la demi-épaisseur du montant) et profil.
# `traverse` : demi-épaisseur et demi-hauteur (fractions du demi-côté du poteau) ; `basse` : hauteur de la traverse
# basse d'un flanc (part de celle du montant).
# `croix` : demi-épaisseur et demi-largeur d'une écharpe (fractions du demi-côté du poteau), `marge` entre elle et les
# tablettes (part de la hauteur de la travée).
# `livres` : rang de leur tablette ; `depart` et `fin` de la rangée (fractions de la demi-largeur de la tablette) ;
# `fond` : place de leur dos (fraction de la demi-profondeur) ; hauteur, profondeur et épaisseur de chacun (fractions
# de la profondeur de la tablette, tirées) ; `penche` : pente du dernier (rapport de son déport à sa hauteur).
# `pile` : rang de sa tablette, sa place (fraction de la demi-largeur), nombre de livres couchés, leur désordre
# (fraction de leur profondeur, tiré).
# `coffret` : sa place (fraction de la demi-largeur de la tablette), demi-largeur, demi-profondeur, hauteur de la
# caisse et du couvercle (fractions de la profondeur de la tablette), débord du couvercle, son chanfrein (en arêtes).
ETAGERE = {
    "montants": (0, 1), "tablettes": (2, 3, 4), **PLANCHES, "planches": 3,
    "poteau": {"cote": 0.82, "profil": ((0.0, 0.86, 0.86, 0.08), (0.012, 1.0, 1.0, 0.08), (0.975, 1.0, 1.0, 0.08),
                                        (0.988, 0.85, 0.85, 0.25), (1.0, 0.45, 0.45, 0.25))},
    "traverse": (0.42, 0.85), "basse": 0.07,
    "cheville": 0.22,
    "croix": {"section": (0.16, 0.50), "marge": 0.06},
    "livres": {"tablette": 3, "depart": -0.72, "fin": 0.30, "fond": 0.20, "hauteur": (0.58, 0.78), "profondeur": (0.48, 0.60),
               "epaisseur": (0.09, 0.17), "penche": 0.30},
    "pile": {"tablette": 2, "place": -0.42, "livres": 3, "desordre": 0.12},
    "coffret": {"place": 0.38, "demi": (0.36, 0.26), "caisse": 0.34, "couvercle": 0.09, "debord": 1.06, "chanfrein": 4},
}

# Coussin (`modele.coussin`) : `arrondi` de ses coins (fraction de son plus petit demi-côté), `par_coin` : segments
# d'un coin ; `profil` : (part de l'épaisseur, retrait du contour en fraction de l'épaisseur) ; `bombe` : flèche de
# son dessus (fraction de l'épaisseur).
MATELAS = {"arrondi": 0.14, "par_coin": 3, "profil": ((0.0, 0.10), (0.12, 0.0), (0.82, 0.0), (0.94, 0.05), (1.0, 0.16)), "bombe": 0.0}
OREILLER = {"arrondi": 0.55, "par_coin": 3, "profil": ((0.0, 0.50), (0.20, 0.12), (0.50, 0.0), (0.80, 0.12), (1.0, 0.50)), "bombe": 0.22}
COUVERTURE = {"arrondi": 0.08, "par_coin": 3, "profil": ((0.0, 0.06), (0.10, 0.0), (0.84, 0.0), (0.95, 0.05), (1.0, 0.14)), "bombe": 0.0}
RABAT = {"arrondi": 0.40, "par_coin": 2, "profil": ((0.0, 0.0), (0.86, 0.0), (0.96, 0.04), (1.0, 0.12)), "bombe": 0.0}

# Lit : `rangs` du cadre, du matelas, de l'oreiller, de la couverture et du chevet dans la recette.
# `poteau` : demi-côté (fraction de la demi-épaisseur du chevet) ; `tete`, `pied` : profil des poteaux.
# `longeron` : hauteur de son axe (part de celle du cadre), demi-hauteur (part de la hauteur du cadre), demi-épaisseur
# et retrait de sa face (fractions du demi-côté du poteau), hauteurs de ses chevilles (fractions de sa demi-hauteur).
# `chevet` : hauteur de l'axe de sa traverse basse et de sa traverse haute (parts de la hauteur du chevet), leur
# demi-hauteur et leur demi-épaisseur (fractions du demi-côté du poteau) ; `panneaux` : nombre ; `montant` :
# demi-largeur et demi-épaisseur (fractions du demi-côté du poteau) ; `saillie` d'un panneau (fraction du demi-côté du
# poteau).
# `matelas` : `enfonce` : ce dont il descend dans le cadre, `dessus` : hauteur qu'il garde (parts de l'épaisseur de
# sa primitive) ; `demi` : sa demi-largeur (fraction de celle de la primitive).
# `oreiller` : `enfonce` dans le matelas (part de l'épaisseur de sa primitive).
# `couverture` : `tombee` sous son dessous (part de l'épaisseur du matelas), `dessus` : part de son épaisseur qu'elle
# garde sous le drap ; `rabat` : demi-largeur du drap rabattu (part de la longueur de la couverture).
LIT = {
    "rangs": {"cadre": 0, "matelas": 1, "oreiller": 2, "couverture": 3, "chevet": 4},
    "poteau": 0.92,
    "tete": ((0.0, 0.86, 0.86, 0.08), (0.015, 1.0, 1.0, 0.08), (0.46, 1.0, 1.0, 0.08), (0.50, 1.0, 1.0, 0.36),
             (0.88, 1.0, 1.0, 0.36), (0.92, 1.0, 1.0, 0.08), (0.97, 1.0, 1.0, 0.08), (0.985, 0.88, 0.88, 0.25),
             (1.0, 0.50, 0.50, 0.25)),
    "pied": ((0.0, 0.86, 0.86, 0.08), (0.035, 1.0, 1.0, 0.08), (0.93, 1.0, 1.0, 0.08), (0.965, 0.88, 0.88, 0.25),
             (1.0, 0.50, 0.50, 0.25)),
    "longeron": {"hauteur": 0.66, "demi": 0.27, "epaisseur": 0.40, "retrait": 0.18, "chevilles": (-0.5, 0.5)},
    "cheville": 0.20,
    "chevet": {"basse": 0.50, "haute": 0.905, "traverse": (1.0, 0.42), "panneaux": 3, "montant": (0.55, 0.42), "saillie": 0.30},
    "matelas": {"enfonce": 0.40, "dessus": 0.90, "demi": 0.985},
    "oreiller": {"enfonce": 0.12},
    "couverture": {"tombee": 0.55, "dessus": 0.93, "rabat": 0.065},
}

# Comptoir (`comptoir-droit`, `comptoir-angle`) : `rangs` dans la recette du corps, du socle, du plateau (`PLANCHES`),
# d'un panneau de devant qui donne leur mesure aux cadres, des barres du repose-pied et de leurs supports ; `faces` :
# ses quatre faces dans l'ordre de `modele.CAPS`, chacune son genre (`facade` en saillie sur le corps, `bout` sous sa
# face, `niche` ouverte) et le rang des panneaux que la recette y pose, dans le sens de la face.
# `cadre` : son épaisseur (part de celle d'un panneau de la recette) ; `traverse` : épaisseur de ses traverses (part
# de la sienne) ; `panneau` : saillie d'un panneau (part de l'épaisseur du cadre) ; `cheville` : rayon (fraction de
# l'épaisseur du cadre).
# `jours` : nombre de panneaux d'un bout ou de jours d'une niche ; `bord`, `montant` : largeur de ses montants de rive
# et de ses montants du milieu (parts de celle d'un panneau de la recette).
# `niche` : sa profondeur (part de celle du corps) ; `tablette` : sa hauteur (part de celle du corps) et sa
# demi-épaisseur (fraction de l'épaisseur du cadre).
# `chant` : sa largeur (part du débord du plateau sur le cadre), sa hauteur (part de celle de la traverse haute), son
# chanfrein (fraction de sa demi-largeur).
# `barre` : rayon (fraction de la demi-hauteur de sa primitive), côtés.
# `support` : rayon (fraction du plus petit demi-côté de sa primitive), côtés, `tete` : ce dont il dépasse l'axe de
# la barre (en rayons de la barre), profil (part de la longueur, part du rayon).
COMPTOIR = {
    "rangs": {
        "comptoir-droit": {"corps": 0, "socle": 1, "plateau": 6, "panneau": 2, "barres": (7,), "supports": (8, 9),
                           "faces": (("facade", (5, 4, 3, 2)), ("bout", ()), ("niche", ()), ("bout", ()))},
        "comptoir-angle": {"corps": 0, "socle": 1, "plateau": 6, "panneau": 2, "barres": (7, 8), "supports": (9,),
                           "faces": (("facade", (3, 2)), ("facade", (4, 5)), ("bout", ()), ("bout", ()))},
    },
    **PLANCHES, "planches": 6, "largeurs": (1.0, 1.0), "bouts": 0.0,
    "cadre": 0.75, "traverse": 0.8, "panneau": 0.55, "cheville": 0.28,
    "jours": 2, "bord": 0.28, "montant": 0.34,
    "niche": 0.30, "tablette": (0.52, 0.40),
    "chant": (0.80, 0.42, 0.30),
    "barre": {"rayon": 1.0, "cotes": 10},
    "support": {"rayon": 0.55, "cotes": 10, "tete": 1.9,
                "profil": ((0.0, 1.7), (0.05, 1.7), (0.10, 1.0), (0.60, 1.0), (0.64, 1.65), (0.92, 1.65), (0.96, 1.1),
                           (1.0, 0.6))},
}

# Établi (`etabli`, `etabli-2x1`) : `rangs` dans la recette du plateau (`PLANCHES`), des pieds, de l'entretoise et de
# l'étau ; `scie` : par décor qui en a une, le rang de sa lame et de sa poignée.
# `pied` : son demi-côté (fraction de celui de la primitive) et son profil.
# `ceinture` : demi-hauteur, demi-épaisseur et retrait de sa face (fractions du demi-côté du pied), hauteurs de ses
# chevilles (fractions de sa demi-hauteur) ; `cheville` : rayon (fraction du demi-côté du pied).
# `basse` : demi-épaisseur et demi-hauteur de la traverse basse (fractions du demi-côté du pied).
# `tenon` : sa demi-largeur et sa demi-hauteur (fractions de celles de l'entretoise), `saillie` au-delà de l'axe de la
# traverse (fraction du demi-côté du pied) ; `clavette` : comme celle d'une table.
# `tablette` : nombre de planches, leur demi-épaisseur (fraction du demi-côté du pied), part du jour entre les pieds
# qu'elles prennent.
# `presse` : place de ses deux mors le long de la primitive (parts de sa longueur) ; `mors` : demi-épaisseur (part de
# la longueur de la primitive), demi-largeur (part de la largeur de la primitive), ce dont il s'enfonce dans le
# plateau (part de sa hauteur au-dessus), chanfrein (fraction de sa demi-épaisseur) ; `vis` : hauteur de son axe et
# rayon (parts de la hauteur de la primitive au-dessus du plateau), départ (part de la longueur de la primitive),
# côtés, profil jusqu'au bout de la primitive ; `levier` : sa place sur la vis (part de sa longueur), sa
# demi-longueur (part de la largeur de la primitive), sa pente, son rayon (fraction de celui de la vis), côtés,
# profil.
# `maillet` : sa place (fractions de la demi-longueur et de la demi-profondeur du plateau) ; `tete` : demi-longueur,
# demi-largeur, demi-hauteur (parts de l'épaisseur du plateau) ; `manche` : sa direction (x, y), sa longueur et son
# rayon (parts de l'épaisseur du plateau), côtés.
# `lame` : demi-épaisseur (part de la hauteur de sa primitive), demi-largeur au talon et à la pointe (parts de celle
# de sa primitive) ; `poignee` : demi-largeur (part de la demi-largeur de sa primitive), demi-épaisseur (part de la
# hauteur de sa primitive), chanfrein (fraction de sa demi-épaisseur).
ETABLI = {
    "rangs": {"plateau": 0, "pieds": (1, 2, 3, 4), "entretoise": 5, "etau": 6}, "scie": {"etabli-2x1": (8, 9)},
    **PLANCHES, "planches": 4,
    "pied": {"cote": 0.92, "profil": PIED_CARRE},
    "ceinture": {"hauteur": 1.0, "epaisseur": 0.30, "retrait": 0.22, "chevilles": (-0.45, 0.45)},
    "cheville": 0.17,
    "basse": (0.45, 0.85),
    "tenon": (0.55, 0.60), "saillie": 1.1,
    "clavette": {"place": 0.62, "demi": (0.30, 0.60), "depasse": (1.6, 2.0), "pointe": 0.55},
    "tablette": {"planches": 3, "epaisseur": 0.22, "largeur": 0.96},
    "presse": {"places": (0.20, 0.60),
               "mors": {"epaisseur": 0.085, "largeur": 0.46, "enfonce": 0.25, "chanfrein": 0.30},
               "vis": {"hauteur": 0.46, "rayon": 0.24, "depart": 0.06, "cotes": 10,
                       "profil": ((0.0, 0.8), (0.80, 0.8), (0.82, 1.5), (0.95, 1.5), (0.97, 1.0), (1.0, 0.7))},
               "levier": {"place": 0.885, "demi": 0.44, "pente": 0.18, "rayon": 0.42, "cotes": 6,
                          "profil": ((0.0, 1.2), (0.03, 1.9), (0.07, 1.9), (0.10, 1.0), (0.90, 1.0), (0.93, 1.9),
                                     (0.97, 1.9), (1.0, 1.2))}},
    "maillet": {"place": (0.30, -0.42),
                "tete": (0.32, 0.19, 0.16),
                "manche": {"direction": (-0.92, 0.38), "longueur": 1.35, "rayon": 0.06, "cotes": 6}},
    "lame": (0.06, 1.0, 0.55), "poignee": (0.90, 0.14, 0.60),
}

# Tabouret d'une table (`table-ronde-4-tabourets`, `table-murale-2-tabourets`), d'après `TABOURET` : `assise` : son
# rayon (fraction de celui du disque de la recette) ; `azimuts` de ses pieds (degrés) ; `ecart` : distance de leur
# pied à l'axe, `pied` : leur rayon (fractions du rayon du fût de la recette) ; `barreaux` : leur hauteur (part de
# celle du fût) ; `barreau` : son rayon (fraction de l'épaisseur de l'assise).
TABOURETS = {"assise": 0.62, "azimuts": (270, 30, 150), "ecart": 0.70, "pied": 0.21, "barreaux": 0.375, "barreau": 0.18}

# Table ronde : `rangs` du plateau, du fût et du socle dans la recette ; `tabourets` : rang de l'assise et du fût de
# chacun.
# `plateau` : rayon (fraction de celui de la primitive), côtés, profil (part de l'épaisseur, part du rayon) ;
# `cercle` : rayon (fraction de celui de la primitive), hauteur (part de l'épaisseur du plateau).
# `fut` : `depart` (part de la hauteur de la primitive), rayon (fraction de celui de la primitive), côtés, profil ;
# `bague` : ses hauteurs (parts de la longueur du fût) et son rayon (fraction de celui du fût).
# `azimuts` des patins et des goussets (degrés).
# `patin` : demi-épaisseur (fraction du rayon du socle), stations (distance à l'axe en fraction du rayon du socle,
# hauteur de l'axe et demi-hauteur en parts de la hauteur du fût de la recette).
# `gousset` : `pied` : distance à l'axe (fraction du rayon du fût de la recette) et hauteur sous le plateau (part de
# celle du fût) ; `tete` : distance à l'axe (fraction du rayon du plateau) ; `section` : demi-épaisseur et
# demi-hauteur (fractions du rayon du fût de la recette).
TABLE_RONDE = {
    "rangs": {"plateau": 0, "fut": 1, "socle": 2}, "tabourets": ((3, 4), (5, 6), (7, 8), (9, 10)),
    "plateau": {"rayon": 0.96, "cotes": 32, "profil": ((0.0, 0.93), (0.30, 1.0), (0.80, 1.0), (1.0, 0.975))},
    "cercle": {"rayon": 0.972, "hauteur": 0.35},
    "fut": {"depart": 0.12, "rayon": 0.50, "cotes": 12,
            "profil": ((0.0, 0.75), (0.04, 0.80), (0.08, 0.55), (0.14, 0.95), (0.30, 1.0), (0.42, 0.70), (0.47, 0.82),
                       (0.52, 0.62), (0.80, 0.48), (0.90, 0.60), (0.95, 0.95), (1.0, 0.95))},
    "bague": {"hauteurs": (0.455, 0.49), "rayon": 0.88},
    "azimuts": (45, 135, 225, 315),
    "patin": {"epaisseur": 0.06,
              "stations": ((0.10, 0.30, 0.12), (0.45, 0.22, 0.09), (0.78, 0.10, 0.06), (0.94, 0.041, 0.04))},
    "gousset": {"pied": (0.30, 0.26), "tete": 0.55, "section": (0.10, 0.14)},
}

# Table murale : rang du plateau (`PLANCHES`) et des deux consoles dans la recette ; `tabourets` : rang de l'assise et
# du fût de chacun.
# `montant` : demi-côté (fraction de la demi-largeur de la console) et profil.
# `bras` : demi-épaisseur et demi-hauteur (fractions du demi-côté du montant), `portee` : son bout (fraction de la
# demi-profondeur de la console, de son milieu vers l'avant).
# `jambe` de force : demi-épaisseur et demi-hauteur (fractions du demi-côté du montant), hauteur de son pied sur le
# montant (part de celle du dessous du plateau), place de sa tête sur le bras (part de sa longueur).
# `lisse` : demi-épaisseur et demi-hauteur (fractions du demi-côté du montant) ; `cheville` : rayon (fraction du
# demi-côté du montant).
TABLE_MURALE = {
    "plateau": 0, "consoles": (1, 2), "tabourets": ((3, 4), (5, 6)), **PLANCHES, "planches": 6,
    "montant": {"cote": 0.45, "profil": PIED_CARRE},
    "bras": {"section": (0.8, 1.2), "portee": 0.80},
    "jambe": {"section": (0.7, 0.9), "pied": 0.18, "tete": 0.62},
    "lisse": (0.5, 1.2),
    "cheville": 0.22,
}

GARNI = {"coin": 0.22, "profil": ((0.0, 0.0), (0.55, 0.0), (0.85, 0.25), (1.0, 0.80))}
"""Garniture (`modele.dossier_garni`) : `coin` : chanfrein de ses coins (fraction de son plus petit demi-côté) ;
`profil` : (part de la saillie, retrait du contour en fraction de la saillie)."""

# Coussin d'assise (`modele.coussin`).
ASSISE = {"arrondi": 0.22, "par_coin": 3, "bombe": 0.25,
          "profil": ((0.0, 0.12), (0.25, 0.0), (0.70, 0.0), (0.90, 0.10), (1.0, 0.30))}

# Lisse (`modele.lisse`) : rayon (fraction de la demi-hauteur de sa primitive), côtés, profil (part de la longueur,
# part du rayon).
LISSE = {"rayon": 0.72, "cotes": 8,
         "profil": ((0.0, 0.6), (0.02, 1.35), (0.06, 1.35), (0.08, 1.0), (0.92, 1.0), (0.94, 1.35), (0.98, 1.35),
                    (1.0, 0.6))}

# Siège garni (`siege`, `fauteuil-loge`) : `rangs` dans la recette de la caisse, du coussin, du dossier, de la lisse
# et des accoudoirs ; `travees` de son dossier.
# `pied` avant : demi-côté (fraction de la demi-largeur de la caisse), côtés, profil ; `montant` : profil d'un pied
# carré ; `console` : côtés, profil (part de sa longueur, part du demi-côté).
# `ceinture` : demi-hauteur, demi-épaisseur et retrait de sa face (fractions du demi-côté du pied) ; `cheville` :
# rayon (fraction du demi-côté du pied).
# `barreaux` : rayon (fraction du demi-côté du pied), hauteur (part de celle de la caisse), côtés, profil.
# `clous` : leur nombre devant et à chaque flanc, `marge` à chaque bout de leur rang (part de sa longueur), `clou` :
# demi-côté et saillie (fractions de la demi-hauteur de la ceinture).
# `dossier` (`modele.dossier_garni`) : `ame` : demi-épaisseur (fraction de la demi-profondeur du dossier de la
# recette) ; `garni`, `panneau` : demi-largeur (fraction de celle de la travée), demi-hauteur (fraction de celle de
# l'âme), saillie sur l'axe de l'âme (fraction de la demi-profondeur du dossier de la recette).
# `accoudoir` : nœud et matériau par décor ; `section` : demi-largeur et demi-hauteur (fractions de celles de sa
# primitive) ; `coude` : distance du montant à son coude (part de sa longueur) ; `bout` : part de sa section qu'il
# garde au bout.
DOSSIER = {"ame": 0.30, "garni": (0.80, 0.86, 1.0), "panneau": (0.72, 0.80, 0.70)}
SIEGE = {
    "rangs": {"caisse": 0, "coussin": 1, "dossier": 2, "lisse": 3, "accoudoirs": (4, 5)}, "travees": 1,
    "pied": {"cote": 0.13, **CHAISE["pied"]},
    "montant": CHAISE["montant"],
    "console": {"cotes": 8,
                "profil": ((0.0, 0.80), (0.10, 0.95), (0.18, 0.62), (0.45, 0.88), (0.80, 0.60), (0.88, 0.92),
                           (1.0, 0.92))},
    "ceinture": {"hauteur": 1.3, "epaisseur": 0.36, "retrait": 0.20},
    "cheville": 0.22,
    "barreaux": {"rayon": 0.42, "hauteur": 0.36, "cotes": 6, "profil": CHAISE["barreaux"]["profil"]},
    "clous": {"devant": 7, "flanc": 5, "marge": 0.14, "clou": (0.18, 0.16)},
    "dossier": DOSSIER,
    "accoudoir": {"noeud": {"siege": ("bois", "bois"), "fauteuil-loge": ("dorures", "laiton")},
                  "section": (0.9, 0.6), "coude": 0.35, "bout": 0.6},
}

# Canapé : `rangs` comme ceux d'un siège garni ; `travees` : nombre de ses coussins et des travées de son dossier.
# `pied` : ses places le long de la caisse (-1 : un bout, 1 : l'autre), hauteur (part de celle de la caisse), rayon
# (fraction de la demi-profondeur de la caisse), côtés, profil.
# `corps` : ses demi-côtés (x, y, fractions de ceux de la caisse) ; `facade` : par travée, un panneau à plate-bande,
# sa demi-largeur (fraction de celle de la travée), sa demi-hauteur (fraction de celle du corps) et sa saillie (part
# du retrait du corps sous le devant de la caisse).
# `dossier` : comme celui d'un siège garni.
# `accoudoir` : `flanc` : sa demi-épaisseur (fraction de la demi-largeur de sa primitive), `coin` : son chanfrein
# (fraction de sa demi-épaisseur), `profil` : (part de sa hauteur, part de sa demi-épaisseur, sa face du dedans
# droite) ; `rouleau` : rayon (fraction de la demi-largeur de sa primitive), côtés, profil ;
# `rosace` : demi-côté et saillie (fractions du rayon du rouleau).
CANAPE = {
    "rangs": SIEGE["rangs"], "travees": 3,
    "pied": {**ARMOIRE["pied"], "places": (-1, 0, 1), "hauteur": 0.30, "rayon": 0.11},
    "corps": (0.99, 0.96), "facade": (0.86, 0.66, 0.80),
    "dossier": {"ame": 0.30, "garni": (0.94, 0.90, 1.0), "panneau": (0.84, 0.80, 0.60)},
    "accoudoir": {"flanc": 0.70, "coin": 0.35, "profil": ((0.0, 0.5), (0.4, 1.0), (1.0, 1.0)),
                  "rouleau": {"rayon": 0.96, "cotes": 10,
                              "profil": ((0.0, 0.80), (0.03, 1.0), (0.97, 1.0), (1.0, 0.80))},
                  "rosace": (0.40, 0.22)},
}

# Coiffeuse : `rangs` des deux pieds, de la caisse, du plateau (`PLANCHES`), du cadre du miroir et de sa glace dans la
# recette.
# `pied` : demi-côté (fraction de la demi-largeur de sa primitive), côtés, profil.
# `garde` : hauteur du dessous des caissons (part de la hauteur de la caisse sous le plateau) ; `retrait` de leurs
# faces sous celles des poteaux (fraction du demi-côté du pied) ; `caisson` : largeur de chacun (part de celle du
# corps) ; `tablier` : sa hauteur (part de celle des caissons), `recul` : sa demi-profondeur (fraction de celle des
# caissons).
# `tiroir` : `largeur` et `hauteur` de sa face (fractions de celles de sa place), `saillie` de sa face (part de la
# distance de la façade au devant de la primitive), `bouton` comme celui d'un bureau ; `boutons` : place de ceux d'un
# tiroir de caisson ou de gradin et de ceux du tiroir du tablier (fractions de sa demi-largeur).
# `miroir` : `montant` : demi-largeur de son cadre (fraction du quart de ce dont le cadre de la recette dépasse sa
# glace) ; `epaisseur` : sa demi-épaisseur (fraction de celle de la primitive) ; `traverse` : épaisseur de ses
# traverses (part de la sienne) ; `oreille` : ce dont la tête d'un montant reste sous le sommet du cadre (part de la
# flèche) ; `cintre` : flèche de sa traverse haute (part de la hauteur du cadre), ses `stations` ; `glace` : sa
# demi-épaisseur (fraction de celle du cadre).
# `gradin` : demi-largeur (fraction de celle du cadre), profondeur (part de celle du plateau), hauteur (part du jour
# sous le cadre de la recette) ; `face` : ce dont les boutons de ses tiroirs dépassent sa face (fraction de la
# demi-épaisseur du cadre).
COIFFEUSE = {
    "rangs": {"pieds": (0, 1), "caisse": 2, "plateau": 3, "cadre": 6, "glace": 7}, **PLANCHES, "planches": 3,
    "pied": {"cote": 0.90, "cotes": 8, "profil": CHAISE["pied"]["profil"]},
    "garde": 0.25, "retrait": 0.95, "caisson": 0.30, "tablier": 0.40, "recul": 0.94,
    "tiroir": {"largeur": 0.84, "hauteur": 0.78, "saillie": 0.25, "bouton": BUREAU["tiroir"]["bouton"],
               "boutons": {"caisson": (0.0,), "tablier": (-0.5, 0.5)}},
    "miroir": {"montant": 1.2, "epaisseur": 0.90, "traverse": 0.85, "oreille": 0.5, "cintre": 0.07, "stations": 7,
               "glace": 0.60},
    "gradin": {"largeur": 0.92, "profondeur": 0.22, "hauteur": 0.85, "face": 1.0},
}
