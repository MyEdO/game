"""Données du campement (#4335) : un GLB par décor `charrette`, `epave-carrosse`, `barque`, `etal-marche`, `tente`,
`tas-foin`, `cargaison-bachee` et `hamac` de `src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa
recette (`gabarit.py`). Aucune illustration au corpus : proportions d'adaptation, chacune en fraction de la primitive
qui la porte (son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z
vers le haut).

- `charrette` : un plateau de planches en travers ; quatre ridelles, chacune de deux lisses sur quatre montants
  chevillés ; deux longerons sous le plateau, qui filent en brancards effilés, une traverse entre eux ; un essieu
  équarri de moyeu à moyeu, une cale sous chaque longeron ; deux roues à douze rais tournés, jante de bois, bandage
  de fer, moyeu de laiton.
- `epave-carrosse` : une caisse de planches debout entre quatre poteaux, entières du côté du toit, brisées à des
  hauteurs inégales au-delà de son faîte, comme les deux poteaux de ce bout ; ceintures basse et haute, plancher ;
  la baie de la porte entre deux montants, fermée d'ombre, une allège dessous ; un pan de toit de voliges aux bouts
  inégaux, relevé vers son faîte sur deux montants ; trois roues aux rais manquants, deux sur l'essieu arrière, une
  sur l'essieu avant dont l'autre bout est un moignon, le coin de caisse de ce côté posé au sol sur son poteau ; la
  quatrième roue couchée, le timon rompu et deux planches au sol.
- `barque` : une barque à fond plat ; une sole, trois virures à clin de chaque bord du tableau à l'étrave, deux
  plats-bords, six membrures d'une varangue et de deux allonges, un payol de planches grises, les deux bancs de la
  recette portés par le bordé, deux tolets à chaque bord derrière chaque banc, un aviron couché sur les bancs, une
  glène de trois lits sur le payol.
- `etal-marche` : un coffre de planches couchées entre les quatre poteaux de la recette, un plateau de trois
  planches ; deux sablières et trois chevrons sous un auvent de toile, qui retombe au front en lambrequin plissé et
  festonné ; sur le plateau, une caissette et trois coupons de toile roulés.
- `tente` : une faîtière sur deux mâts ; une toile d'un seul tenant passée sur la faîtière, qui fléchit, se creuse
  entre les arêtes tendues vers ses points de piquet et se relève au sol entre eux ; un pignon de toile à chaque
  bout, celui de la recette ouvert d'une baie d'ombre, son pan roulé au linteau ; les deux piquets de la recette,
  un hauban de corde de chacun à la faîtière.
- `tas-foin` : huit gerbes jointives dressées en faisceau contre une meule, le pied au sol, chacune évasée au pied,
  serrée par son lien, les épis hérissés ; la meule les coiffe d'un chapeau de foin en pointe, qui retombe sur leurs
  épis en frange épaisse et dentelée.
- `cargaison-bachee` : une palette de neuf planches sur trois semelles ; une bâche d'un seul volume, à deux versants
  et deux croupes, plissée sur ses flancs, étranglée par trois sangles de corde qui en font le tour.
- `hamac` : deux poteaux à chanfreins arrêtés ; deux barres d'écartement tournées ; une toile qui pend de l'une à
  l'autre et se creuse en son milieu ; à chaque bout, un tour de corde noué au poteau et cinq brins en araignée
  jusqu'à la barre.

Écarts aux recettes. La barque : le prisme de proue tombe au sol, si bien que l'enveloppe interdit une étrave plus
haute que le bordé ; la tonture descend vers l'étrave, qui s'arrête au tiers du prisme ; la glène repose sur le
payol et non à la hauteur des bancs ; l'aviron est plus court que son cylindre, pour tenir dans le bordé. La
charrette : les ridelles sont ajourées, les brancards filent sous le plateau en longerons, la jante de bois va
jusqu'au bandage. Le carrosse : la caisse est creuse, ses essieux la traversent ; le toit ne porte que sur deux
montants et la ceinture arrière. L'étal : les poteaux s'arrêtent sous les sablières, ceux de derrière plus haut que
la recette. La tente : deux mâts portent la faîtière ; le pignon est en retrait du bout de la toile, la baie
d'ombre derrière lui, là où la recette la pose. Le tas de foin et la cargaison ne gardent de leurs primitives que
l'encombrement. Le hamac : la toile va d'une barre à l'autre, plus longue que sa boîte.

Matières : celles des recettes, sauf la tente, qui prend `corde` pour ses haubans, que sa recette ne nomme pas : un
hauban n'est ni de toile ni de bois. Le carrosse garde `bois-chene` pour ses roues, ses essieux et son timon,
`bois-mort` pour sa caisse et ses débris. Le catalogue n'a ni foin (`paille` pour le tas, que la recette lui donne),
ni toile goudronnée (`toile-ecrue` pour la bâche), ni fer rouillé. Aucun emplacement de palette ne nomme la corde
ni l'ombre : elles prennent `accent` ; la paille prend `vegetal`, la toile `vet1`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
VIEUX = {"vieux": ("bois", "bois-mort")}
CORDE = {"corde": ("accent", "corde")}
OMBRE = {"ombre": ("accent", "ombre")}
ECRUE = {"toile": ("vet1", "toile-ecrue")}
MATERIAUX = {
    "charrette": {**BOIS, "fer": ("metal", "fer-noirci"), "laiton": ("metal2", "laiton-dore")},
    "epave-carrosse": {**BOIS, **VIEUX, **OMBRE},
    "barque": {**BOIS, **VIEUX, **CORDE},
    "etal-marche": {**BOIS, "toile": ("vet1", "toile-rouge")},
    "tente": {**BOIS, **ECRUE, **OMBRE, **CORDE},
    "tas-foin": {"paille": ("vegetal", "paille")},
    "cargaison-bachee": {**BOIS, **ECRUE, **CORDE},
    "hamac": {**BOIS, **ECRUE, **CORDE},
}

BUDGET_TRIANGLES = {"charrette": 4800, "epave-carrosse": 6400, "barque": 4400, "etal-marche": 3700, "tente": 2100,
                    "tas-foin": 1500, "cargaison-bachee": 2700, "hamac": 1400}

ANGLE_LISSE = {"bois": 40, "vieux": 40, "fer": 40, "laiton": 40, "toile": 60, "corde": 50, "ombre": 30, "paille": 35}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein et une gerbe
gardent leurs arêtes, une pièce tournée, un cordage et une toile sont ronds."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête de bois adoucie, en fraction de l'épaisseur de la pièce."""

# Roue (`modele.roue`) : `jante` : son rayon du dedans (part de son rayon du dehors) ; `largeur` : sa largeur (part de
# celle que lui donne le décor) ; `rais` : leur nombre ; `pied` : leur départ (part du rayon du moyeu) ; `tete` : leur
# bout (part du rayon du dedans de la jante, où ils entrent) ; `rai` : leur rayon (part de la demi-largeur donnée) ;
# `fuseau` : leur profil (part de la longueur, part du rayon) ; `pans` : leurs côtés ; `noix` : profil du moyeu, d'un
# bout à l'autre ; `cotes` du moyeu.
ROUE = {
    "jante": 0.86, "largeur": 0.8, "rais": 12, "pied": 0.7, "tete": 1.03, "rai": 0.55,
    "fuseau": ((0.0, 1.0), (0.12, 1.0), (0.2, 0.72), (1.0, 0.6)), "pans": 5,
    "noix": ((0.0, 0.55), (0.08, 0.75), (0.2, 1.0), (0.42, 1.0), (0.5, 0.8), (0.58, 1.0), (0.8, 1.0), (0.92, 0.75),
             (1.0, 0.55)), "cotes": 8,
}

# Charrette : rang du plateau, des ridelles, des roues (bandage, bois, moyeu) et des brancards dans la recette.
# `plancher` : les planches du plateau (`geometrie.bordage`), de toute son épaisseur.
# `ridelle`, en fractions de l'épaisseur de la primitive : `lisse` : épaisseur d'une lisse, au dedans ; `ancrage` :
# part de cette épaisseur où entrent les montants ; `cheville` : son rayon ; `lisses` (`geometrie.bordage`) ;
# `montants` : leur place (parts de la demi-longueur) ; `montant` : sa demi-largeur (fraction de la longueur).
# `bandage` : son épaisseur (fraction de son rayon) ; la jante de bois va jusqu'à son milieu.
# `essieu` : son demi-côté (part du rayon du moyeu de la recette) ; `cale` : demi-longueur d'une cale (part de ce
# demi-côté), de l'axe de l'essieu à celui du longeron.
# `recul` : part de la longueur du plateau dont un longeron s'arrête avant son arrière, où l'enveloppe remonte ;
# `limon` : son profil, de la queue à la pointe (`geometrie.profilee`) ; `traverse` : sa place sur un brancard
# depuis le plateau (part de sa longueur), sa section (part de celle du brancard).
CHARRETTE = {
    "plateau": 0, "ridelles": (1, 2, 3, 4), "roues": ((5, 6, 7), (8, 9, 10)), "brancards": (11, 12),
    "plancher": {"planches": 9, "ecart": 0.25, "jour": 0.002, "bout": (0.0, 0.0)},
    "ridelle": {"lisse": 0.45, "ancrage": 0.15, "cheville": 0.14,
                "lisses": {"planches": 2, "ecart": 0.0, "jour": 0.09, "bout": (0.0, 0.0)},
                "montants": (-0.94, -0.32, 0.32, 0.94), "montant": 0.022},
    "bandage": 0.04,
    "essieu": {"section": 0.5, "cale": 0.9},
    "recul": 0.06,
    "limon": ((0.0, 0.7, 0.7, 0.2), (0.02, 1.0, 1.0, 0.2), (0.6, 1.0, 1.0, 0.2), (0.97, 0.72, 0.72, 0.3),
              (1.0, 0.5, 0.5, 0.3)),
    "traverse": (0.08, 0.8),
}

# Épave de carrosse : rang de la caisse, du toit, de la porte, des roues et du timon dans la recette ; `essieux` :
# rangs, parmi `roues`, des deux roues de l'essieu arrière puis de celle de l'essieu avant ; `tombee` : rang, parmi
# `roues`, de la roue couchée.
# `planche` : son épaisseur (fraction de la largeur de la caisse), sa largeur (fraction de la longueur de la
# caisse) ; `saine` et `ruine` : part de sa hauteur dont une planche s'arrête sous la tête de la caisse, tirée
# (`bout` de `geometrie.bordage`). `bardage` : `ecart` et `jour` d'un pan (`geometrie.bordage`).
# `poteau` : son demi-côté (fraction de la largeur de la caisse) ; `casse` : hauteur d'un poteau brisé (part de
# celle de la caisse, tirée) ; celui du coin sans roue descend au sol. `ombre` : demi-épaisseur de l'ombre de la
# baie (part de celle d'une planche).
# `ceinture` : sa demi-hauteur (fraction de la hauteur de la caisse), sa demi-épaisseur (part du demi-côté d'un
# poteau). `plancher`, `voliges` : les planches du plancher et du pan de toit (`geometrie.bordage`) ; `toit_large` :
# largeur du pan de toit (part de celle du prisme).
# `brises` : rais manquants par roue ; `moyeu` : son rayon (part de celui de la roue), sa demi-longueur (part de la
# demi-épaisseur de la roue) ; `essieu` : son demi-côté (part du rayon d'une roue) ; `moignon` : longueur de
# l'essieu avant au-delà de l'axe de la caisse (part de la distance de sa roue à cet axe).
# `fleche` : profil du timon, de son bout entier à sa cassure (`geometrie.profilee`) ; `debris` : par planche au
# sol, la part du chemin de chaque bout du timon à la roue couchée où posent ses deux bouts.
CARROSSE = {
    "caisse": 0, "toit": 1, "porte": 2, "roues": (3, 4, 5, 6), "essieux": (0, 2, 1), "tombee": 3, "timon": 7,
    "planche": {"epaisseur": 0.02, "largeur": 0.1, "saine": (0.0, 0.04), "ruine": (0.3, 0.72)},
    "bardage": {"ecart": 0.2, "jour": 0.004},
    "poteau": 0.032, "casse": (0.35, 0.6), "ombre": 0.25,
    "ceinture": {"hauteur": 0.035, "epaisseur": 0.8},
    "plancher": {"planches": 5, "ecart": 0.2, "jour": 0.003, "bout": (0.0, 0.0)},
    "toit_large": 0.97, "voliges": {"planches": 6, "ecart": 0.2, "jour": 0.004, "bout": (0.0, 0.22)},
    "brises": 3, "moyeu": (0.2, 1.0), "essieu": {"section": 0.09, "moignon": 0.97},
    "fleche": ((0.0, 0.6, 0.6, 0.25), (0.05, 1.0, 1.0, 0.25), (0.7, 0.9, 0.9, 0.25), (0.92, 0.7, 0.5, 0.3),
               (1.0, 0.3, 0.25, 0.3)),
    "debris": ((0.2, 0.3), (0.55, 0.62)),
}

# Barque : rang de la coque, de la proue, d'un plat-bord, du tableau, des bancs, de l'aviron et de la glène dans la
# recette. Le creux est la hauteur du sol au dessus du plat-bord de la recette.
# `etrave` : sa place sur le prisme de proue (part de sa longueur) ; `couples` : du tableau à l'étrave, (part de la
# longueur, demi-largeur au livet et au bouchain en parts de celle de la coque, hauteur du livet et du bouchain en
# parts du creux), lissés à `pas` points par tronçon ; le premier en avant du tableau de la recette, de ce dont le
# bordé qui s'évase déborderait derrière lui.
# `borde`, en fractions du creux : `epaisseur` d'une virure ; leur nombre ; `recouvre` : part d'une virure que
# couvre celle du dessus ; `clin` : saillie de son can bas (part de l'épaisseur).
# `liston` : largeur et hauteur du plat-bord (fractions du creux).
# `membrures` : leurs rangs parmi les points lissés ; `membrure` : demi-largeur et demi-épaisseur d'une allonge
# (fractions du creux), part dont une pièce entre dans celle qui la porte, hauteur de la varangue (fraction du
# creux).
# `tableau_epais` : son épaisseur (part de celle de la primitive). `etrave_piece` : ses demi-côtés, en travers et
# en long (fractions du creux) ; `tete` : sa hauteur (part de celle que l'enveloppe laisse à sa face avant).
# `payol` : son épaisseur (fraction du creux), son étendue (parts de la longueur), sa largeur (part de celle de la
# sole à son bout le plus étroit), ses planches (`geometrie.bordage`).
# `tolet` : `places` : leur avance depuis l'axe d'un banc (en largeurs de banc, négative vers le tableau) ; hauteur
# et rayon (fractions du creux) ; profil (part de la hauteur, part du rayon) ; `cotes`.
# `rame` : sa longueur (part de celle du cylindre) ; `pale` : sa part de la longueur ; `emmanche` : part de la
# pale où naît le manche ; `section` : demi-largeur et demi-épaisseur de la pale (en apothèmes du cylindre) ;
# `profil` de la pale, du bout au collet (`geometrie.profilee`) ; `manche` : son rayon (part de l'apothème) ;
# `fuseau` : son profil, du collet à la poignée ; `cotes`.
# `love` : la glène ; `brin` : rayon du cordage (fraction de la hauteur du cylindre) ; `lits`, `spires` par lit ;
# `pose` : hauteur de l'axe du premier lit sur le payol, `pas` : d'un lit au suivant et d'une spire à sa voisine
# (en rayons du cordage) ;
# segments du tour et de la section.
BARQUE = {
    "coque": 0, "proue": 1, "plat_bord": 2, "tableau": 4, "bancs": (5, 6), "aviron": 7, "glene": 8,
    "etrave": 0.33, "pas": 3,
    "couples": ((0.002, 0.80, 0.60, 0.90, 0.0), (0.15, 0.90, 0.72, 0.885, 0.0), (0.35, 0.93, 0.77, 0.87, 0.0),
                (0.55, 0.92, 0.76, 0.855, 0.0), (0.7, 0.86, 0.68, 0.835, 0.0), (0.82, 0.72, 0.52, 0.80, 0.02),
                (0.92, 0.45, 0.28, 0.72, 0.06), (1.0, 0.05, 0.05, 0.56, 0.12)),
    "borde": {"epaisseur": 0.03, "virures": 3, "recouvre": 0.12, "clin": 0.6},
    "liston": {"section": (0.07, 0.045)},
    "membrures": (2, 5, 8, 11, 14, 16),
    "membrure": {"section": (0.035, 0.03), "ancrage": 0.25, "varangue": 0.06},
    "tableau_epais": 0.5,
    "etrave_piece": {"section": (0.06, 0.07), "tete": 0.96},
    "payol": {"epaisseur": 0.03, "etendue": (0.06, 0.74), "largeur": 0.9,
              "planches": {"planches": 5, "ecart": 0.2, "jour": 0.006, "bout": (0.0, 0.05)}},
    "tolet": {"places": (-1.0, -1.3), "hauteur": 0.09, "rayon": 0.022,
              "profil": ((0.0, 1.0), (0.7, 1.0), (0.85, 1.25), (1.0, 0.9)), "cotes": 5},
    "rame": {"longueur": 0.88, "pale": 0.26, "emmanche": 0.7, "section": (2.6, 0.3),
             "profil": ((0.0, 0.7, 0.6, 0.3), (0.08, 1.0, 1.0, 0.3), (0.7, 1.0, 1.0, 0.3), (1.0, 0.35, 1.6, 0.3)),
             "manche": 0.8, "fuseau": ((0.0, 1.0), (0.75, 0.9), (0.9, 0.8), (0.91, 1.1), (1.0, 1.1)), "cotes": 6},
    "love": {"brin": 0.11, "lits": 3, "spires": 2, "pose": 0.85, "pas": 1.4, "segments": (12, 5)},
}

# Étal : rang du coffre, du plateau, des poteaux, de l'auvent et du lambrequin dans la recette.
# `table` : les planches du plateau (`geometrie.bordage`) ; `panneau` : épaisseur d'une face du coffre (fraction de sa
# profondeur), ses planches couchées (`geometrie.bordage`).
# `toile`, en fractions de la largeur du prisme : `epais`, épaisseur de la toile ; `creux` de son onde sur la
# pente, moindre que l'épaisseur pour qu'elle porte partout sur les chevrons ; `pli` de son lambrequin ; `largeur` :
# sa demi-largeur (part de celle du prisme) ; `pente` : ses rangs de la crête à l'égout (parts de la pente) ;
# `lambrequin` : ses rangs sous l'égout (part de la tombée, part du feston) ; `plis`, `pas` : points par pli ;
# `festons` : leur nombre, et ce dont le lambrequin tombe encore au milieu de chacun (`feston`, part de la hauteur
# de sa primitive, dont il atteint le bas).
# `charpente`, en fractions du côté d'un poteau : `poteau`, son côté ; `ancrage` : part de la hauteur de la
# sablière, sous son dessus, où s'arrête la tête du poteau ; `sabliere` : sa demi-largeur et sa hauteur ; `debord`
# de ses bouts au-delà des poteaux, et des chevrons au-delà des sablières ; `chevrons` : leur place (parts de la
# sablière) ; `chevron` : sa demi-largeur et sa hauteur (fractions de la largeur du prisme) ; `entaille` : part de
# sa hauteur dont il entre dans la sablière.
# `caissette` : sa place sur le plateau (parts de ses demi-côtés), ses demi-côtés (fractions des côtés du plateau),
# sa hauteur et l'épaisseur de ses ais (en épaisseurs du plateau) ; `pose` : hauteur de l'axe de son fond sur le
# plateau, et ce dont ses petits côtés s'arrêtent avant la face du dehors des grands (part de l'épaisseur d'un ais).
# `coupons` : leur place en x (part de la demi-longueur du plateau) ; `rayon` (en épaisseurs du plateau) ; `serre` :
# part du rayon que gardent le demi-écart de deux axes voisins et la hauteur d'un axe du bas sur le plateau ;
# demi-longueur (part de la demi-profondeur du plateau, tirée) ; profil (part de la longueur, part du rayon) ; `cotes`.
ETAL = {
    "coffre": 0, "plateau": 1, "poteaux": (2, 3, 4, 5), "auvent": 6, "lambrequin": 7,
    "table": {"planches": 3, "ecart": 0.15, "jour": 0.004, "bout": (0.0, 0.0)},
    "panneau": {"epaisseur": 0.035, "planches": {"planches": 5, "ecart": 0.2, "jour": 0.004, "bout": (0.0, 0.0)}},
    "toile": {"epais": 0.003, "creux": 0.0025, "pli": 0.006, "largeur": 0.99, "pente": (0.02, 0.5, 1.0),
              "lambrequin": ((0.25, 0.0), (1.0, 1.0)), "plis": 12, "pas": 4, "festons": 6, "feston": 0.3},
    "charpente": {"poteau": 0.9, "ancrage": 0.7, "sabliere": (0.45, 1.0), "debord": 1.2, "chevrons": (0.0, 0.5, 1.0),
                  "chevron": (0.012, 0.022), "entaille": 0.2},
    "caissette": {"place": (-0.5, 0.1), "cotes": (0.12, 0.2), "hauteur": 2.2, "ais": 0.3, "pose": 0.4},
    "coupons": {"place": 0.45, "rayon": 1.0, "serre": 0.9, "longueur": (0.5, 0.68),
                "profil": ((0.0, 0.25), (0.012, 1.0), (0.988, 1.0), (1.0, 0.25)), "cotes": 8},
}

# Tente : rang des versants, de la faîtière, de l'entrée et des piquets dans la recette.
# `toile`, en fractions de la longueur de la tente : `epais` ; `creux` dont elle rentre entre deux arêtes tendues du
# faîte à un point de piquet ; `fleche` dont elle fléchit à mi-pente ; `largeur` : sa demi-longueur (part de celle
# des versants) ; `releve` : ce dont son bas remonte la pente entre deux points de piquet ; `pente` : ses rangs du
# faîte au sol (part de la pente, part du creux, part du relevé) ; `festons` : intervalles entre points de piquet ;
# `pas` : points par intervalle.
# `perche` : la faîtière ; `jeu` : part de l'épaisseur de la toile entre son rayon et l'apothème du cylindre ;
# `fuseau` : son profil ; `cotes`, aussi ceux des mâts, du rouleau et des piquets.
# `pignon` : sa place (part de la demi-longueur des versants) ; `mat` : recul du mât derrière lui (en rayons de la
# faîtière) ; `rangs` : points de sa rive sur la pente (parts) ; `rouleau` : rayon du pan roulé (fraction de la
# longueur de la tente) ; `boudin` : son profil.
# `piquet` : son profil, de la pointe à la tête (part de la hauteur, part de l'apothème).
# `hauban` : `prise` sur la faîtière (part de sa demi-longueur) ; `encoche` : hauteur de sa prise sur le piquet
# (part de sa hauteur) ; `brin` : son rayon (fraction du rayon du piquet) ; `cotes`.
TENTE = {
    "versants": (0, 1), "faitiere": 2, "entree": 3, "piquets": (4, 5),
    "toile": {"epais": 0.003, "creux": 0.012, "fleche": 0.02, "largeur": 0.985, "releve": 0.022,
              "pente": ((0.06, 0.1, 0.0), (0.3, 0.4, 0.0), (0.6, 0.8, 0.0), (0.86, 1.0, 0.35), (1.0, 1.0, 1.0)),
              "pas": 6, "festons": 5},
    "perche": {"jeu": 0.7, "fuseau": ((0.0, 0.7), (0.01, 1.0), (0.99, 1.0), (1.0, 0.7)), "cotes": 8},
    "pignon": {"place": 0.955, "mat": 1.2, "rangs": (0.3, 0.65, 1.0), "rouleau": 0.008,
               "boudin": ((0.0, 0.6), (0.06, 1.0), (0.94, 1.0), (1.0, 0.6))},
    "piquet": ((0.0, 0.3), (0.3, 1.0), (0.72, 1.0), (0.78, 0.65), (0.84, 0.65), (0.9, 1.0), (1.0, 0.85)),
    "hauban": {"prise": 0.97, "encoche": 0.81, "brin": 0.22, "cotes": 5},
}

# Tas de foin : rang des assises, du sol au sommet. Un niveau est (rang d'une assise, part de sa hauteur).
# `meule` : `profil`, du sol au sommet : (niveau, rayon en part de l'apothème de cette assise, dent : ce dont un
# sommet de l'anneau descend au plus, en part de la hauteur de cette assise, tiré par sommet dans `dentelure`) ; la
# frange est le rebord du chapeau, son dessous qui s'évase et descend, puis son dehors qui remonte ; `pointe` :
# niveau de son sommet ; sa section (`geometrie.bosselee`) : `cotes`, `bosse`.
# `gerbes` : leur nombre ; `ecart` d'azimut de chacune (part de l'intervalle, tiré) ; `pied` et `tete` : (niveau,
# distance à l'axe en part de l'apothème de cette assise) ; `grosseur` : son rayon (fraction de l'apothème de
# l'assise de son pied), d'au moins π·pied/nombre (et de l'écart tiré) pour que les gerbes se touchent ; `brins` : ses
# côtés ; `epi` : part, tirée par côté, dont un sommet hérissé rentre vers
# l'axe ; `profil`, du pied aux épis : (part de la longueur, part de sa grosseur, part du hérissement), le lien
# en bourrelet.
FOIN = {
    "assises": (0, 1, 2),
    "meule": {"profil": (((0, 0.0), 0.6, 0.0), ((0, 0.7), 0.5, 0.0), ((1, 0.5), 0.6, 0.0), ((1, 0.9), 0.5, 0.0),
                         ((1, 0.82), 0.72, 0.12), ((1, 0.7), 0.82, 0.3), ((1, 0.97), 0.84, 0.06),
                         ((2, 0.3), 0.88, 0.0), ((2, 0.75), 0.55, 0.0)),
              "dentelure": (0.2, 1.0), "pointe": (2, 1.0), "cotes": 14, "bosse": (0.86, 1.0)},
    "gerbes": {"nombre": 8, "ecart": (-0.05, 0.05), "pied": ((0, 0.0), 0.68), "tete": ((1, 0.75), 0.5),
               "grosseur": 0.3, "brins": 8, "epi": (0.0, 1.0),
               "profil": ((0.0, 1.0, 0.15), (0.1, 0.9, 0.0), (0.45, 0.62, 0.0), (0.55, 0.5, 0.0), (0.57, 0.62, 0.0),
                          (0.62, 0.62, 0.0), (0.64, 0.5, 0.0), (0.8, 0.75, 0.3), (1.0, 1.0, 0.7))},
}

# Cargaison bâchée : rang de la palette, du ballot, des versants et des cordes dans la recette.
# `plateau` : la palette ; épaisseur de ses planches (part de sa hauteur) ; `ancrage` : part de cette épaisseur où
# entrent les semelles et le bas de la bâche ; ses planches (`geometrie.bordage`) ; `semelles` : leur place (parts de
# la demi-largeur), leur longueur (part de celle de la palette), leur demi-largeur (fraction de sa largeur).
# `bache` : `brin` : rayon d'une sangle (part de la demi-largeur de sa primitive) ; `sangle` : largeur de
# l'étranglement (fraction de la longueur des versants) ; `plis` sur la longueur, `pas` : sections par pli ;
# `marge`, `creux`, `serre` : ce dont la bâche rentre sous l'enveloppe partout, au fond d'un pli et sous une sangle
# (fractions de la largeur du ballot) ; `pose` : saillie de l'axe d'une sangle sur la bâche (part de son rayon) ;
# `cotes` d'une sangle ; `contour` : un demi-contour, du bas du flanc au faîte : (niveau : 0 au bas, 1 à l'égout,
# 2 au faîte ; part du creux des plis).
CARGAISON = {
    "palette": 0, "ballot": 1, "versants": (2, 3), "cordes": (4, 5, 6),
    "plateau": {"epaisseur": 0.3, "ancrage": 0.2,
                "planches": {"planches": 9, "ecart": 0.2, "jour": 0.006, "bout": (0.0, 0.0)},
                "semelles": (-0.84, 0.0, 0.84), "longueur": 0.98, "largeur": 0.07},
    "bache": {"brin": 0.4, "sangle": 0.035, "plis": 9, "pas": 4, "marge": 0.004, "creux": 0.055, "serre": 0.045,
              "pose": 0.6, "cotes": 6,
              "contour": ((0.0, 1.0), (0.12, 1.0), (0.45, 0.7), (0.8, 0.35), (1.0, 0.12), (1.3, 0.0), (1.65, 0.0),
                          (1.95, 0.0))},
}

# Hamac : `bouts` : par bout, rang du poteau, de la barre d'écartement et de la corde ; rang de la toile et de son
# creux.
# `poteau` : son côté (part de celui de la boîte) ; `barre` : profil d'une barre d'écartement, d'un bout à l'autre
# (part de la longueur, part du demi-petit côté de sa boîte) ; `cotes`, aussi ceux des brins.
# `araignee` : `brin` : rayon du tour de corde au poteau (fraction de l'épaisseur de la toile de la recette) ;
# `fin` : rayon d'un brin (part de celui du tour) ; segments du tour et de sa section ; `brins` : leur prise sur la
# barre (parts de sa demi-longueur).
# `lit` : `epais` de la toile (fraction de l'épaisseur de sa boîte) ; `largeur` (part de celle de la boîte) ;
# `ventre` : part de la hauteur de sa rive au fond du creux de la recette dont son milieu descend ; `plis`, `pas` ;
# `rangs` : d'une barre à l'autre, (part de la portée, creux des plis en fraction de l'épaisseur de la boîte).
HAMAC = {
    "bouts": ((0, 4, 6), (1, 5, 7)), "toile": 2, "creux": 3,
    "poteau": 0.8, "cotes": 6,
    "barre": ((0.0, 0.6), (0.02, 1.0), (0.05, 1.0), (0.07, 0.7), (0.93, 0.7), (0.95, 1.0), (0.98, 1.0), (1.0, 0.6)),
    "araignee": {"brin": 0.1, "fin": 0.5, "segments": (10, 5), "brins": (-0.88, -0.44, 0.0, 0.44, 0.88)},
    "lit": {"epais": 0.12, "largeur": 0.9, "ventre": 0.82, "plis": 6, "pas": 3,
            "rangs": ((0.0, 0.03), (0.06, 0.05), (0.25, 0.07), (0.5, 0.08), (0.75, 0.07), (0.94, 0.05), (1.0, 0.03))},
}
