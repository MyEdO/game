"""Données des éléments de bâtiment (#4335) : un GLB par décor `cheminee`, `cheminee-interieure`, `clocheton`,
`arche-ruine`, `escalier-bois`, `stalle-ecurie`, `grille` et `paravent` de `src/data/props.json`, bâti dans l'enveloppe
convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au corpus : proportions d'adaptation, chacune
en fraction de la primitive qui la porte (son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le
front de la recette vers -y, z vers le haut).

- `cheminee` : une souche de pierres taillées en assises harpées aux angles ; un couronnement à larmier ; une mitre
  de fer, collier, quatre pieds et chapeau en pointe.
- `cheminee-interieure` : une sole dallée ; deux jambages en assises harpées ; un contrecœur maçonné et sa taque de
  fer à tête cintrée ; un linteau en plate-bande de cinq claveaux à clé pendante ; une tablette moulurée ; deux
  chenets de fer, montant à pomme, barre et talon ; un lit de braises, des charbons et trois bûches ardentes couchées
  sur les chenets.
- `clocheton` : une plinthe à glacis ; une tour en assises harpées, percée sur le front et au dos d'une baie
  d'abat-sons, cadre de fers plats et lames inclinées ; une corniche moulurée ; sur le front, une cloche de laiton et
  son battant, pendus par une chaîne à une potence scellée au-dessus de la baie ; un comble à deux versants
  d'ardoises en rangs croisés, deux pignons de pierre, une faîtière ; une croix de laiton.
- `arche-ruine` : deux piédroits en assises harpées, arasés à la naissance de l'arc ; un arc en plein cintre de neuf
  claveaux dont restent les six premiers, clé comprise, et le sommier d'en face ; un tas de charge de deux pierres
  contre l'extrados ; un claveau tombé au pied.
- `escalier-bois` : deux limons à crémaillère et leurs poteaux de tête ; quatre marches et leurs contremarches ; à
  gauche une lisse basse, deux poteaux à chanfreins arrêtés coiffés d'un pommeau tourné, une main courante et une
  lisse rampantes, six balustres tournés.
- `stalle-ecurie` : une litière de paille ; deux cloisons de planches inégales chevillées sur des poteaux, sous une
  lisse haute ; le poteau cornier à tête taillée et sa patère ; une mangeoire de planches sur deux pieds, garnie de
  foin.
- `grille` : une fosse d'ombre ; un cadre de fers plats rivés ; trois barreaux à trous renflés que traversent trois
  barreaux ronds.
- `paravent` : trois feuilles à deux montants, trois traverses et une toile tendue, liées par des gonds de bois.

Écarts aux recettes, tenus dans leur enveloppe. `cheminee` : le chapeau de la mitre déborde sa boîte, sous l'enveloppe
du couronnement. `cheminee-interieure` : le linteau en plate-bande occupe le haut de l'ouverture, que la recette laisse
vide sous la tablette ; les bûches dépassent la boîte des braises. `clocheton` : la potence et la chaîne de la cloche
sont ajoutées ; les deux versants se rejoignent à mi-chemin de leurs deux crêtes, sous une faîtière. `arche-ruine` : le
linteau droit de la recette est un arc en plein cintre, né au sommet du piédroit le plus bas ; le premier piédroit
s'arrête à cette naissance, un tas de charge le prolonge jusqu'au sommet du linteau ; le sommier suit l'arc et déborde
la boîte de la recette. `escalier-bois` : les marches portent sur deux limons et non sur des massifs pleins ; le poteau
du haut descend jusqu'à la lisse basse, que la recette laisse en l'air ; lisse rampante et balustres ajoutés.
`stalle-ecurie` : la mangeoire est une auge à devant incliné sur deux pieds, non le coin plein de la recette ; son foin
bombe au-dessus de sa boîte et déborde les rives. `paravent` : les deux feuilles de côté s'ouvrent en biais depuis les
montants de celle du milieu, quand la recette les pose parallèles à elle.

Matières : celles des recettes, sans ajout. Les bûches de l'âtre sont de `braises`, la recette n'ayant pas de bois ;
faute de fer dans leur recette, l'escalier, la stalle et le paravent sont chevillés ou sans ferrure."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
PIERRE = {"pierre": ("corps", "pierre-atre")}
FER = {"fer": ("metal", "fer-noirci")}
BOIS = {"bois": ("bois", "bois-chene")}
MATERIAUX = {
    "cheminee": {**PIERRE, **FER},
    "cheminee-interieure": {**PIERRE, **FER, "braises": ("accent", "braises")},
    "clocheton": {**PIERRE, **FER, "laiton": ("metal2", "laiton-dore"), "ardoise": ("corps", "prop-ardoise")},
    "arche-ruine": {**PIERRE},
    "escalier-bois": {**BOIS},
    "stalle-ecurie": {**BOIS, "paille": ("vegetal", "paille")},
    "grille": {**FER, "ombre": ("accent", "ombre")},
    "paravent": {**BOIS, "toile": ("vet1", "toile-ecrue")},
}

BUDGET_TRIANGLES = {"cheminee": 2600, "cheminee-interieure": 5200, "clocheton": 5500, "arche-ruine": 3200,
                    "escalier-bois": 2800, "stalle-ecurie": 3600, "grille": 1400, "paravent": 2000}

ANGLE_LISSE = {"pierre": 40, "fer": 40, "laiton": 40, "ardoise": 30, "bois": 40, "paille": 50, "toile": 30,
               "ombre": 30, "emet": 40}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein garde ses
arêtes, une pièce tournée est ronde."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête adoucie de bois ou de fer, en fraction de l'épaisseur de la pièce."""

# Pierre taillée, en fractions de la demi-hauteur d'un moellon (`geometrie.moellon`) ou de la demi-épaisseur d'un
# claveau (`modele.claveau`) : `joint`, demi-joint laissé sur son pourtour ; `arete`, chanfrein de ses arêtes ;
# `parement`, recul de sa face (tiré entre ces bornes).
TAILLE = {"joint": 0.04, "arete": 0.08, "parement": (0.0, 0.05)}

# Cheminée : rang de la souche, du couronnement et de la mitre dans la recette.
# `parement` (`geometrie.appareil`) : `assises` de la souche ; `pierres` par face normale à x, puis à y ; `queue` d'une
# pierre (fraction du demi-côté de la souche) ; `ecart` d'un joint (`geometrie.partage`) ; `retrait` du dessus du
# blocage (fraction d'une assise).
# `larmier` : profil du couronnement (`geometrie.profilee`), du dessus du blocage à sa tête : un bandeau, puis le
# larmier de toute la largeur de sa boîte, sa tête en glacis.
# `chapeau`, la mitre, en fractions de sa boîte : `ancrage`, part de sa hauteur dont le collier entre dans le
# couronnement et les pieds dans le collier et le chapeau ; `collier` : son demi-côté (part de celui de la boîte) et
# sa hauteur (part de celle de la boîte) ; `col`, son profil ; `assise`, hauteur du dessous du chapeau (part de celle
# de la boîte) ; `debord`, son demi-côté (part de celui de la boîte) ; `toit`, son profil, en pointe ; `pieds` : leur
# place (part du demi-côté de la boîte), leur rayon (fraction de ce demi-côté), leurs côtés.
CHEMINEE = {
    "souche": 0, "couronnement": 1, "mitre": 2,
    "parement": {"assises": 6, "pierres": (2, 2), "queue": 0.3, "ecart": 0.3, "retrait": 0.1},
    "larmier": ((0.0, 0.86, 0.86, 0.03), (0.3, 0.86, 0.86, 0.03), (0.42, 1.0, 1.0, 0.05), (0.85, 1.0, 1.0, 0.05),
                (1.0, 0.92, 0.92, 0.05)),
    "chapeau": {"ancrage": 0.1, "collier": (0.8, 0.3), "col": ((0.0, 1.0, 1.0, 0.1), (0.8, 1.0, 1.0, 0.1),
                                                              (1.0, 0.85, 0.85, 0.1)),
                "assise": 0.55, "debord": 1.25, "toit": ((0.0, 1.0, 1.0, 0.08), (0.2, 1.0, 1.0, 0.08),
                                                         (1.0, 0.2, 0.2, 0.08)),
                "pieds": (0.6, 0.1, 4)},
}

# Cheminée intérieure : rang de la sole, des jambages, du manteau, du contrecœur, des chenets et des braises.
# `dallage` : `epaisseur` des dalles (part de la hauteur de la sole) ; `socle`, profil du massif qui les porte, du sol
# à leur mi-épaisseur ; `rangs` de dalles en profondeur, `dalles` par rang, `ecart` de leurs joints.
# `jambage` (`geometrie.appareil`) : comme `CHEMINEE["parement"]`, du fond des dalles à la tête du jambage.
# `tablette` : profil du manteau, du dessus du blocage des jambages à sa tête : une assise en retrait, un cavet, le
# bandeau de toute sa boîte.
# `mur`, le contrecœur : `queue` de ses pierres (part de son épaisseur) ; `faces` : assises et pierres de sa face
# tournée vers le foyer, puis de son dos ; `ecart` de leurs joints.
# `taque` : son `epaisseur` en saillie du contrecœur (part de l'épaisseur de celui-ci) ; sa demi-`largeur` (part de
# celle du contrecœur) et sa `hauteur` (part de la sienne) ; `contour` (part de la demi-largeur, part de la hauteur),
# sa tête cintrée.
# `linteau`, une plate-bande entre les jambages, sous le manteau : sa `hauteur` (part de celle du fond des dalles au
# dessous du manteau) ; `profondeur` (part de celle d'un jambage) ; `saillie` de sa face devant celle des jambages
# (part du débord du manteau) ; `foyer` : distance sous l'intrados du point où concourent ses joints (fraction de la
# demi-portée) ; `claveaux` : par claveau, ce dont il pend sous l'intrados (part de la hauteur du linteau) et sa
# demi-profondeur (part de celle du linteau), la clé pendante et saillante.
# `chenet`, en fractions de la largeur de sa boîte : `barre` : hauteur de son dessus (part de celle du chenet sur le
# fond des dalles), demi-côté de sa section, puis de celle du talon, qui la coiffe (parts de la demi-largeur) ;
# `montant`, son profil, pied évasé, col et pomme.
# `feu` : `hauteur` du lit (part de celle de la boîte des braises) et `lit`, son profil ; `semis` : part des
# demi-côtés du lit où tombent les charbons (`geometrie.charbons` : `charbons`, `grosseur`, `enfonce`, `charbon`) ;
# `couche` : débord des bûches au-delà des chenets (fraction de la largeur d'un chenet), hauteur de leur axe sur la
# barre (fraction de leur rayon), leurs côtés ; `buches` : place de chacune le long des chenets (part de leur
# demi-longueur, vers le dos) et rayon (fraction de la largeur d'un chenet) ; `buche`, leur profil
# (`geometrie.tournee`).
ATRE = {
    "sole": 0, "jambages": (1, 2), "manteau": 3, "contrecoeur": 4, "chenets": (5, 6), "braises": 7,
    "dallage": {"epaisseur": 0.5, "socle": ((0.0, 0.985, 0.975, 0.02), (1.0, 0.985, 0.975, 0.02)), "rangs": 2,
                "dalles": 4, "ecart": 0.2},
    "jambage": {"assises": 4, "pierres": (2, 1), "queue": 0.5, "ecart": 0.15, "retrait": 0.08},
    "tablette": ((0.0, 0.95, 0.93, 0.02), (0.3, 0.95, 0.93, 0.02), (0.5, 0.975, 0.965, 0.04), (0.6, 1.0, 1.0, 0.02),
                 (0.92, 1.0, 1.0, 0.02), (1.0, 0.985, 0.975, 0.02)),
    "mur": {"queue": 0.4, "faces": ((5, 3), (3, 2)), "ecart": 0.25},
    "taque": {"epaisseur": 0.12, "largeur": 0.5, "hauteur": 0.5,
              "contour": ((-1.0, 0.0), (1.0, 0.0), (1.0, 0.7), (0.7, 0.9), (0.0, 1.0), (-0.7, 0.9), (-1.0, 0.7))},
    "linteau": {"hauteur": 0.2, "profondeur": 0.3, "saillie": 0.4, "foyer": 1.7,
                "claveaux": ((0.0, 1.0), (0.0, 1.0), (0.12, 1.08), (0.0, 1.0), (0.0, 1.0))},
    "chenet": {"barre": (0.38, 0.3, 0.4),
               "montant": ((0.0, 1.0, 1.0, 0.2), (0.08, 1.0, 1.0, 0.2), (0.2, 0.5, 0.5, 0.2), (0.68, 0.45, 0.45, 0.2),
                           (0.76, 0.9, 0.9, 0.3), (0.94, 0.9, 0.9, 0.3), (1.0, 0.5, 0.5, 0.3))},
    "feu": {"hauteur": 0.45, "lit": ((0.0, 0.95, 0.95, 0.1), (0.6, 0.9, 0.9, 0.15), (1.0, 0.72, 0.7, 0.15)),
            "charbons": 26, "grosseur": (0.093, 0.187), "semis": 0.75, "enfonce": 0.3, "charbon": (1.0, 0.8),
            "couche": (1.0, 0.85, 7), "buches": ((-0.55, 0.5), (-0.05, 0.42), (0.5, 0.55)),
            "buche": ((0.0, 0.8), (0.03, 1.0), (0.3, 0.9), (0.55, 1.0), (0.8, 0.88), (0.97, 0.96), (1.0, 0.75))},
}

# Clocheton : rang du socle, de la tour, de la corniche, des abat-sons, de la cloche, des versants, de la hampe et de
# la traverse de la croix.
# `plinthe` : profil du socle, sa tête en glacis. `ancrage` : part de la hauteur du socle dont la tour y entre.
# `parement` (`geometrie.appareil`) : comme `CHEMINEE["parement"]`. `moulure` : profil de la corniche, du dessus du
# blocage de la tour à l'égout : un bandeau, un cavet, le larmier de toute sa boîte.
# `abat_son`, en fractions de sa boîte : `ancrage`, part de sa profondeur dont son cadre entre dans le blocage de la
# tour ; `fer`, demi-largeur d'un fer du cadre (part de la largeur de la baie) ; `traverse` : sa demi-profondeur
# (part de celle d'un montant) ; `lames` : leur nombre ; `pente` : ce dont une lame descend vers le dehors (part de
# son pas) ; `portee` : sa largeur (part de la profondeur du cadre) ; `tole`, son épaisseur (part de la profondeur
# de la boîte).
# `sonnerie`, en fractions de l'apothème et de la hauteur du cylindre de la cloche : `levre`, hauteur du bas de la
# robe ; `robe`, son profil (`geometrie.tournee`), de la lèvre au cerveau ; `cotes` ; `battant` : son rayon et sa
# hauteur, et `poire`, son profil ; `potence` : sa hauteur (part de celle du haut de la baie à la tête de la tour), sa
# portée au-delà de l'axe de la cloche et le demi-côté de son fer (parts de l'apothème) ; `maillons` : rayon moyen et
# rayon du fer (parts de l'apothème), part de leur jeu dont ils se serrent, segments du tour et de la section.
# `toit`, en fractions de la largeur d'un versant : `epaisseur` d'une ardoise et `jeu` laissé sous la pente de la
# recette ; les ardoises (`geometrie.ardoises` : `rangs`, `recouvrement`, `nombre`, une de plus aux rangs impairs,
# `ecart`, `jour`, `bascule`), de la ligne où les deux versants se rejoignent à l'égout ; `lit` :
# profondeur du massif sous la pente (jeu compté, en épaisseurs d'ardoise) ; `faitiere` : son rayon (fraction de
# l'écart des deux crêtes de la recette) et ses `pans`.
# `pignon` : son `epaisseur` (part de la largeur d'un versant) ; `ancrage` : part de cette épaisseur dont le massif
# du comble y entre ; `tete` : part de la hauteur du massif où s'arrêtent ses assises ; `assises` : pierres de
# chacune, de l'égout vers le faîte ; `ecart` de leurs joints.
# `croix` : profil de la hampe, de l'axe de la faîtière à sa tête, taillée en pointe ; `bras` : demi-profondeur de
# la traverse (part de celle de sa boîte), en retrait des faces de la hampe.
CLOCHETON = {
    "socle": 0, "tour": 1, "corniche": 2, "abat_sons": (3, 4), "cloche": 5, "versants": (6, 7), "hampe": 8,
    "traverse": 9,
    "plinthe": ((0.0, 1.0, 1.0, 0.02), (0.6, 1.0, 1.0, 0.02), (1.0, 0.93, 0.93, 0.02)),
    "ancrage": 0.1,
    "parement": {"assises": 8, "pierres": (2, 2), "queue": 0.24, "ecart": 0.3, "retrait": 0.08},
    "moulure": ((0.0, 0.89, 0.89, 0.02), (0.25, 0.89, 0.89, 0.02), (0.5, 0.95, 0.95, 0.04), (0.6, 1.0, 1.0, 0.02),
                (0.92, 1.0, 1.0, 0.02), (1.0, 0.97, 0.97, 0.02)),
    "abat_son": {"ancrage": 0.2, "fer": 0.035, "traverse": 0.85, "lames": 5, "pente": 0.7, "portee": 0.95,
                 "tole": 0.12},
    "sonnerie": {"levre": 0.14,
                 "robe": ((0.0, 0.92), (0.05, 1.0), (0.1, 0.95), (0.16, 0.84), (0.42, 0.62), (0.72, 0.52),
                          (0.86, 0.44), (0.94, 0.24), (1.0, 0.16)),
                 "cotes": 8, "battant": (0.22, 0.3), "poire": ((0.0, 0.6), (0.2, 1.0), (0.45, 0.9), (0.6, 0.4),
                                                               (1.0, 0.3)),
                 "potence": (0.2, 0.35, 0.12), "maillons": (0.24, 0.06, 0.8, (8, 4))},
    "toit": {"epaisseur": 0.015, "jeu": 0.004, "rangs": 6, "recouvrement": 0.35, "nombre": (4, 5), "ecart": 0.2,
             "bascule": 0.9, "jour": 0.008, "lit": 1.5, "faitiere": 0.75, "pans": 6,
             "pignon": {"epaisseur": 0.1, "ancrage": 0.3, "tete": 0.9, "assises": (2, 2, 1, 1), "ecart": 0.2}},
    "croix": ((0.0, 1.0, 1.0, 0.15), (0.92, 1.0, 1.0, 0.15), (1.0, 0.4, 0.4, 0.15)), "bras": 0.8,
}

# Arche en ruine : rangs des piédroits, celui que le tas de charge prolonge puis celui qui garde son sommier ; rang
# du linteau, du bloc tombé et du sommier.
# `parement` (`geometrie.appareil`) : comme `CHEMINEE["parement"]`, du sol à la naissance de l'arc.
# `extrados` : son rayon (part de la hauteur de la naissance au sommet du linteau). `prise` : profondeur sous la
# naissance où l'intrados du sommier et celui du blocage entrent dans le blocage de leur piédroit (en retraits du
# dessus de ce blocage sous la naissance). `claveaux` : leur nombre dans
# l'arc entier, ceux qui restent depuis le premier piédroit, ceux que le tas de charge épaule. `pas` : segments d'un
# claveau le long du blocage et d'une pierre du tas de charge le long de l'extrados.
# `tas_de_charge` : lits de ses assises (parts de la hauteur de la naissance au sommet du linteau).
# `blocage` : son retrait sous l'intrados, l'extrados, le sommet et la rive (part de l'épaisseur de l'arc) et sa
# demi-épaisseur (part de celle des claveaux).
# `tombe` : contour du claveau tombé (parts des demi-côtés de sa boîte, x puis y).
# `taille` : celle des pierres de la ruine (comme `TAILLE`), aux joints ouverts, aux arêtes et aux parements usés.
ARCHE = {
    "piedroits": (0, 1), "linteau": 2, "bloc": 3, "sommier": 4,
    "parement": {"assises": 6, "pierres": (1, 1), "queue": 0.4, "ecart": 0.1, "retrait": 0.08},
    "extrados": 0.96, "prise": 2.0, "claveaux": (9, 6, 3), "pas": 3,
    "tas_de_charge": (0.0, 0.5, 1.0),
    "blocage": (0.2, 0.8),
    "tombe": ((-0.95, -0.7), (0.9, -0.95), (0.95, 0.55), (-0.75, 0.95)),
    "taille": {"joint": 0.05, "arete": 0.14, "parement": (0.0, 0.1)},
}

# Escalier : rangs des marches, de la plus basse à la plus haute ; `rampe` (`geometrie.rampe`) : rang de la lisse
# basse ; `poteaux` : rang du poteau et de son pommeau, celui du bas puis celui du haut ; le profil du pommeau en
# parts du rayon de son cylindre, à son apothème.
# `marche`, en fractions du giron : `epaisseur` de la marche ; épaisseur de la `contremarche` ; son `retrait` sous
# le nez ; `ancrage` : part de l'épaisseur de la marche dont le limon et la contremarche y entrent, et part de celle
# de la contremarche dont le limon y entre ; `largeur` de la contremarche (part de celle de la marche).
# `limon` : `gorge`, ce qu'il garde de bois sous le fond d'un cran (part de la hauteur d'une marche) ; sa
# demi-`epaisseur` et le demi-côté de son `poteau` de tête (fractions du giron), où il finit ; sa `place` (part de la
# demi-largeur des marches).
ESCALIER = {
    "marches": (0, 1, 2, 3),
    "marche": {"epaisseur": 0.09, "contremarche": 0.05, "retrait": 0.06, "ancrage": 0.3, "largeur": 0.97},
    "limon": {"gorge": 0.6, "epaisseur": 0.045, "poteau": 0.075, "place": 0.93},
    "rampe": {"lisse": 4, "poteaux": ((5, 7), (6, 8)), "poteau": {"cote": 0.65, "ancrage": 0.3},
              "pommeau": {"profil": ((0.0, 0.462), (0.1, 0.462), (0.16, 0.739), (0.24, 0.508), (0.32, 0.739),
                                     (0.5, 0.923), (0.7, 0.878), (0.88, 0.601), (1.0, 0.231)), "cotes": 10,
                          "ancrage": 0.3},
              "main": 0.1, "rampante": 0.12, "section": (0.75, 0.6),
              "balustres": {"nombre": 6, "rayon": 0.6, "cotes": 6,
                            "profil": ((0.0, 0.8), (0.06, 0.8), (0.1, 0.5), (0.2, 0.7), (0.34, 1.0), (0.5, 0.75),
                                       (0.78, 0.45), (0.86, 0.45), (0.9, 0.75), (0.94, 0.5), (1.0, 0.8))}},
}

# Stalle : rang de la litière ; rangs des cloisons et, pour chacune, `poteaux` : places de ses poteaux le long
# d'elle (parts de sa demi-longueur entre axes de poteaux de bout), le poteau d'angle compté à la première ; rang du
# poteau cornier et de l'auge.
# `lit` : `hauteur` de la couche de paille (part de celle de la litière) et son `profil` ; `brins` (`modele.brins`),
# en parts de la couche.
# `cloison`, en fractions de son épaisseur : `poteau`, son demi-côté (part de la demi-épaisseur) ; `lisse` : sa
# largeur, sa hauteur et ce dont son dessus reste sous la tête des poteaux ; `planche`, son épaisseur ; `planches`,
# du sol à la lisse (`geometrie.bordage`) ; `cheville`, son rayon.
# `tete` : profil du poteau cornier : chanfreins arrêtés, gorge, tête en pointe.
# `patere` : sa hauteur (part de celle du poteau cornier) ; ce dont elle y entre, sa longueur et son rayon (fractions
# du côté du poteau) ; ses côtés ; `crochet`, son profil, un bouton au bout.
# `mangeoire`, en fractions de la profondeur du prisme de la recette : `epaisseur` de ses planches ; `joue` :
# contour d'une joue (part de la profondeur depuis le dos, part de la hauteur depuis le fond) ; `planches` : le
# fond, le devant incliné et le dos, chacun entre deux points de la coupe ; `pied` : sa place (part de la profondeur
# depuis le dos) et son demi-côté (fraction de l'épaisseur d'une planche).
# `foin`, un tas sur les rives, ramené sous elles entre les planches de l'auge : `devant`, rang parmi `planches` de
# celle du devant ; `place` de son axe (part de la profondeur) ; `debord` : sa demi-largeur (part de la profondeur),
# au-delà des rives ; `bombe` : sa hauteur sur les rives (part de celle de l'auge) ; `profil`, d'une joue à l'autre
# (part de la longueur, part de sa section) ; sa section (`geometrie.bosselee`), tirée à chaque rang, ses sommets
# comptés depuis le devant : `cotes`, `bosse` ; ses `brins` (`modele.brins`), en parts de sa hauteur.
STALLE = {
    "litiere": 0, "cloisons": (1, 2), "poteaux": ((-1, 0, 1), (0, 1)), "cornier": 3, "auge": 4,
    "lit": {"hauteur": 0.6, "profil": ((0.0, 0.99, 0.99, 0.01), (1.0, 0.97, 0.97, 0.01)),
            "brins": {"nombre": 46, "longueur": (0.1, 0.22), "largeur": 0.016, "epaisseur": 0.42,
                      "pose": (0.75, 1.13)}},
    "cloison": {"poteau": 0.95, "lisse": (0.8, 0.9, 0.3), "planche": 0.4,
                "planches": {"planches": 5, "ecart": 0.2, "jour": 0.004, "bout": (0.0, 0.0)}, "cheville": 0.12},
    "tete": ((0.0, 1.0, 1.0, 0.08), (0.04, 1.0, 1.0, 0.08), (0.07, 1.0, 1.0, 0.3), (0.82, 1.0, 1.0, 0.3),
             (0.85, 1.0, 1.0, 0.08), (0.9, 1.0, 1.0, 0.08), (0.915, 0.8, 0.8, 0.08), (0.93, 1.0, 1.0, 0.08),
             (0.96, 1.0, 1.0, 0.08), (1.0, 0.45, 0.45, 0.08)),
    "patere": (0.78, 0.3, 0.8, 0.12, 6),
    "crochet": ((0.0, 0.8), (0.75, 0.6), (0.8, 1.0), (0.95, 1.0), (1.0, 0.6)),
    "mangeoire": {"epaisseur": 0.08, "joue": ((0.0, 0.0), (0.7, 0.0), (1.0, 1.0), (0.0, 1.0)),
                  "planches": (((0.0, 0.0), (0.7, 0.0)), ((0.7, 0.0), (1.0, 1.0)), ((0.0, 0.0), (0.0, 1.0))),
                  "pied": (0.6, 0.9),
                  "foin": {"devant": 1, "place": 0.5, "debord": 0.6, "bombe": 0.28,
                           "profil": ((0.0, 0.75), (0.08, 0.95), (0.2, 0.85), (0.33, 1.0), (0.47, 0.8), (0.6, 1.0),
                                      (0.74, 0.88), (0.86, 1.0), (0.94, 0.9), (1.0, 0.75)),
                           "cotes": 14, "bosse": (0.6, 1.0),
                           "brins": {"nombre": 22, "longueur": (0.8, 1.3), "largeur": 0.06, "epaisseur": 0.15,
                                     "pose": (0.5, 0.95)}}},
}

# Grille : rang de la fosse, des fers du cadre et des barreaux.
# `fond` : hauteur du dessus de la plaque d'ombre (part de celle de la fosse) et `plaque`, son profil.
# `fers`, le cadre : `hauteur` d'un longeron, puis d'une traverse (parts de celle de leur boîte) ; `ancrage` : part
# de la largeur d'un longeron dont une traverse y entre ; `profil` d'un fer le long de lui ; `rivets` : leurs places
# (parts de sa demi-longueur) ; `rivet` (`geometrie.clou` : demi-côté et hauteur, fractions de la demi-largeur du
# fer).
# `barreau`, en fractions de l'apothème de son cylindre : rayon d'un barreau `passant` ; rayon du `corps` d'un
# barreau percé ; `renflement` autour de chaque barreau qui le traverse : (distance à celui-ci le long du barreau,
# en apothèmes ; rayon).
GRILLE = {
    "fosse": 0, "cadre": (1, 2, 3, 4), "barreaux": (5, 6, 7, 8, 9, 10),
    "fond": 0.7, "plaque": ((0.0, 0.99, 0.99, 0.01), (1.0, 0.99, 0.99, 0.01)),
    "fers": {"hauteur": (0.96, 0.9), "ancrage": 0.5,
             "profil": ((0.0, 1.0, 0.92, 0.1), (0.008, 1.0, 1.0, 0.12), (0.992, 1.0, 1.0, 0.12),
                        (1.0, 1.0, 0.92, 0.1)),
             "rivets": (-0.8, -0.27, 0.27, 0.8), "rivet": (0.26, 0.1)},
    "barreau": {"passant": 0.5, "corps": 0.55,
                "renflement": ((-2.6, 0.55), (-1.3, 1.0), (1.3, 1.0), (2.6, 0.55))},
}

# Paravent : rangs des montants de rive (gauche, droite), des panneaux (de gauche à droite) et des montants de
# charnière (gauche, droite), dont celui de la feuille du milieu prend l'axe, dans le plan de son panneau.
# `epaisseur` : demi-épaisseur d'un montant (part de la demi-profondeur d'un montant de rive). `retraits` : par
# feuille, ce dont l'axe de chacun de ses deux montants recule vers elle depuis son nœud (fractions de la
# demi-largeur d'un montant) : celui de rive pour tenir dans l'enveloppe, celui de charnière pour laisser sa place
# au montant de la feuille du milieu.
# `montant` : son profil, pied et tête dégagés, tête en pointe. `traverses` : bas et haut de chacune (parts de la
# hauteur du panneau) ; `traverse` : sa demi-épaisseur (part de celle d'un montant). `toile` : sa demi-épaisseur
# (part de celle du panneau de la recette).
# `gond` : son rayon et sa demi-hauteur (fractions de la demi-largeur d'un montant), ses côtés ; `gonds` : leurs
# hauteurs (parts de celle d'un montant) ; `broche`, leur profil.
PARAVENT = {
    "montants": (3, 6), "panneaux": (0, 1, 2), "charnieres": (4, 5),
    "epaisseur": 0.5, "retraits": ((0.5, 2.2), (0.0, 0.0), (2.2, 0.5)),
    "montant": ((0.0, 0.8, 0.8, 0.1), (0.012, 1.0, 1.0, 0.1), (0.03, 1.0, 1.0, 0.25), (0.955, 1.0, 1.0, 0.25),
                (0.968, 1.0, 1.0, 0.1), (0.985, 1.0, 1.0, 0.1), (1.0, 0.55, 0.55, 0.1)),
    "traverses": ((0.0, 0.05), (0.48, 0.52), (0.95, 1.0)), "traverse": 0.8, "toile": 0.3,
    "gond": (0.45, 1.6, 6), "gonds": (0.14, 0.5, 0.86),
    "broche": ((0.0, 0.7), (0.15, 1.0), (0.85, 1.0), (1.0, 0.7)),
}
