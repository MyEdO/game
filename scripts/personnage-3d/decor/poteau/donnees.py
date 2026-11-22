"""Données des ouvrages dressés sur un poteau ou une hampe (#4335, #4471) : un GLB par décor `gibet`, `pilori`, `cage`,
`enseigne`, `ecu`, `epi-de-faite`, `girouette`, `panneau`, `pieu`, `etendard` et `banniere-chaos` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration
au corpus : proportions d'adaptation, chacune en
fraction de la primitive qui la porte (son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le front
de la recette vers -y, z vers le haut) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y.

- `gibet` : une estrade de planches inégales sur trois lambourdes, dont une sous le poteau ; le poteau à chanfreins
  arrêtés, la tête en pointe, qui traverse le plancher jusqu'à sa lambourde ; la potence qui le traverse, chevillée ;
  un aisselier du poteau à la potence et trois contrefiches de l'estrade au poteau ; la corde, trois tours sur la
  potence, le brin, le nœud coulant à spires et sa boucle.
- `pilori` : une semelle en croix ; le poteau qui la traverse, la tête en pointe ; quatre liens de la semelle au
  poteau ; le carcan, deux planches prises dans le poteau, échancrées à leur joint d'un trou de cou entre deux trous
  de poignet de chaque côté du poteau, serrées à chaque bout entre deux moises chevillées.
- `cage` : un plancher et un toit de tôle, chacun dans son cadre de fers plats ; les seize barreaux de la recette,
  pris dans les deux cadres ; deux ceintures de fers plats rivées à chaque barreau, interrompues sur le front entre
  les montants de la porte, où leurs bouts entrent ; une porte sur le front, deux montants, trois traverses, deux
  gonds et le boîtier de sa serrure ; sur le toit, quatre tirants jusqu'à la tige de l'anneau de suspension.
- `enseigne` : une patte de scellement aux bouts forgés en pointe, rivée ; la potence, un fer carré terminé par un
  bouton ; un tirant de la tête de la patte à la potence ; deux chaînes de cinq maillons, le premier pris dans la
  potence, le dernier dans le tableau ; le tableau, des planches inégales dans un cadre.
- `ecu` : une planche d'un seul tenant au contour de l'enveloppe de ses trois boîtes, un écu à pans ; un cerclage de
  fers plats sur ses rives, un rivet à chaque angle ; deux pitons à œil sur sa rive haute. Son repère est celui de
  l'enseigne : mince en x, large en y, son axe à l'aplomb du milieu du tableau de l'enseigne, ses pitons à l'aplomb
  des chaînes de celle-ci.
- `epi-de-faite` : une embase en jupe, une hampe effilée en pointe, un bulbe et une boule dorée enfilés sur elle.
- `girouette` : une embase, une hampe effilée en pointe, la croix des points cardinaux, deux fers carrés terminés
  chacun de deux losanges découpés ; la flèche, un fer plat, sa pointe et sa banderole à deux queues, découpées, dans
  le plan de la boîte de la recette ; une douille à sa hauteur ; une boule dorée.
- `panneau` : le poteau à chanfreins arrêtés, la tête en pointe ; une flèche de deux planches de bois gris, entaillée
  en queue, taillée en pointe du côté où descend le prisme de la recette ; deux traverses chevillées sur leur face ;
  deux chevilles qui prennent la flèche au poteau.
- `pieu` : un pieu bosselé qui défile et fléchit, taillé à facettes jusqu'à la crête du prisme de la recette ; la
  pierre de la recette, dégrossie ; une pierre de calage contre le pied, du côté de la première.
- `etendard`, `banniere-chaos` : un socle de pierre tourné ; la hampe, fichée dans le socle ; la traverse de la
  recette, qui traverse la hampe entre deux viroles, un bouton à chaque bout ; l'étoffe pendue à la traverse par un
  fourreau froncé, ses plis creusés autant que l'enveloppe le permet, de plus en plus vers le bas ; la ferrure de
  tête. L'étendard finit en deux pointes et porte un fer de lance de laiton entre deux ailettes ; la bannière du Chaos
  finit en lambeaux et porte une pique de fer entre quatre crocs.

Écarts aux recettes, tenus dans leur enveloppe. `gibet` : l'aisselier monte du pied du prisme à la potence, à l'inverse
de son rampant ; la potence repose au bas de sa boîte, pour que les tours de corde tiennent sous l'enveloppe ; la
boucle du nœud pend dans le plan de la potence, plus bas que le cylindre couché de la recette. `pilori` : la semelle
est une croix et non une dalle. `cage` : le toit porte des tirants. `panneau` : la pointe de la flèche est à
mi-hauteur, au centre du prisme, là où son rampant passe à mi-hauteur. `etendard`, `banniere-chaos` : le bas de
l'étoffe est découpé (`bord`) et non coupé en biais comme le prisme.

Matières : celles des recettes, sans ajout. L'écu est de `bois-chene` nu : le catalogue n'a pas de bois peint, et un
décor ne porte pas de surface `blason` (`geometrie.elements`). La boule de l'épi et celle de la girouette sont de
`laiton-dore`, leur nœud `ferrure`. Le catalogue n'a ni chanvre usé (la corde du gibet est de `corde`), ni
fer rouillé (`fer-noirci`) ; faute de fer dans leur recette, le gibet, le pilori et le panneau sont chevillés, sans
clou ni penture. Aucun emplacement de palette ne nomme la corde ni la pierre : elles prennent `accent` et `corps` ;
l'étoffe, `vet1`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
FER = {"fer": ("metal", "fer-noirci")}
PIERRE = {"pierre": ("corps", "pierre-atre")}
DORURE = {"ferrure": ("metal2", "laiton-dore")}
MATERIAUX = {
    "gibet": {**BOIS, "corde": ("accent", "corde")},
    "pilori": BOIS,
    "cage": FER,
    "enseigne": {**FER, **BOIS},
    "ecu": {**FER, **BOIS},
    "epi-de-faite": {**FER, **DORURE},
    "girouette": {**FER, **DORURE},
    "panneau": {**BOIS, "vieux": ("bois", "bois-mort")},
    "pieu": {**BOIS, **PIERRE},
    "etendard": {**PIERRE, **BOIS, "toile": ("vet1", "toile-rouge"), "ferrure": ("metal", "laiton-dore")},
    "banniere-chaos": {**PIERRE, **BOIS, "toile": ("vet1", "toile-chaos"), "ferrure": ("metal", "fer-noirci")},
}

BUDGET_TRIANGLES = {"gibet": 2600, "pilori": 1500, "cage": 2800, "enseigne": 1500, "ecu": 900, "epi-de-faite": 700,
                    "girouette": 1100, "panneau": 500, "pieu": 300,
                    "etendard": 2300, "banniere-chaos": 2300}

ANGLE_LISSE = {"bois": 40, "vieux": 40, "fer": 40, "ferrure": 40, "corde": 50, "toile": 60, "pierre": 35}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein et une pierre
dégrossie gardent leurs arêtes, une pièce tournée, un cordage et une étoffe sont ronds."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête adoucie, en fraction de l'épaisseur de la pièce."""

# Pièce droite (`modele.contrefiche`) : `section` : ses demi-côtés, en travers puis dans son plan vertical ; `ancrage` :
# ce dont ses bouts s'enfoncent dans ce qu'elle joint ; `chanfrein` de ses arêtes ; en fractions de la cote que nomme
# chaque décor.

RIVET = (0.22, 0.32)
"""Tête d'un rivet (`geometrie.clou`) : demi-côté et hauteur de sa pointe sur le milieu du fer qu'il traverse, en
fractions de la cote qui le porte."""

FUT = ((0.0, 1.0, 1.0, 0.08), (0.04, 1.0, 1.0, 0.08), (0.07, 1.0, 1.0, 0.30), (0.90, 1.0, 1.0, 0.30),
       (0.93, 1.0, 1.0, 0.08), (0.975, 1.0, 1.0, 0.08), (1.0, 0.35, 0.35, 0.08))
"""Le profil d'un poteau à chanfreins arrêtés, la tête en pointe (`modele.poteau`, `geometrie.profilee`)."""

# Gibet : rang de l'estrade, du poteau, de la potence, du lien, du brin de corde et du nœud dans la recette.
# `plancher` : `lambourde` : hauteur des lambourdes (part de celle de l'estrade), `largeur` : leur demi-largeur
# (fraction de la longueur de l'estrade), `portee` : leur demi-longueur (part de la demi-largeur de l'estrade) ;
# `planches` : leur nombre, `ecart` de leurs joints (part de leur largeur), `jour` : demi-jour entre deux planches
# (fraction de la largeur de l'estrade), `bout` : demi-longueur d'une planche (part de celle de l'estrade, tirée),
# `ancrage` : ce dont une planche entre dans les lambourdes (fraction de la hauteur de l'estrade).
# `fut` : le poteau (`modele.poteau`) : demi-côté (part de celui de la primitive).
# `bras` : la potence ; `section` : ses demi-côtés (parts de ceux de la primitive), `profil` (`geometrie.profilee`),
# `chevilles` : leur place en travers du poteau (fractions de son demi-côté).
# `cheville` : rayon (fraction du demi-côté du poteau).
# `aisselier` : `pied` : hauteur de son pied sur le bas du prisme (part de la hauteur du prisme) ; `portee` : place de
# sa tête sous la potence, du centre du prisme vers où il descend (fraction de sa demi-longueur) ; `piece`
# (`modele.contrefiche`), en fractions de la largeur du prisme.
# `contrefiches` : `azimuts` de chacune autour du poteau ; `empattement` : distance de son pied à l'axe du poteau
# (fraction de la demi-largeur de l'estrade) ; `hauteur` : de sa tête sur l'estrade (part de la hauteur du poteau) ;
# `piece`, en fractions du demi-côté du poteau.
# `corde` : `brin` : son rayon (part de celui du cylindre du brin) ; `tours` sur la potence et `tour` : rayon du dedans
# d'un tour (fraction du demi-côté de la potence : il mord ses arêtes abattues et frôle ses faces) ; `segments` du tour
# et de la section ; `cotes` du brin ; `noeud` : ses `spires`, leur `pas` (fraction du diamètre du brin), leur `rayon`
# (fraction de celui du brin) et leur `creux` (part de ce rayon entre deux spires) ; `boucle` : sa demi-largeur
# (fraction du rayon du cylindre du nœud) et sa hauteur (fraction de la hauteur de ce cylindre) ; `anse` : ses points
# (part de la demi-largeur, part de la hauteur sous le nœud), lissés à `pas` points par tronçon.
GIBET = {
    "estrade": 0, "poteau": 1, "potence": 2, "lien": 3, "brin": 4, "noeud": 5,
    "plancher": {"lambourde": 0.60, "largeur": 0.045, "portee": 0.97, "planches": 9, "ecart": 0.22, "jour": 0.003,
                 "bout": (0.955, 0.998), "ancrage": 0.06},
    "fut": {"cote": 0.94, },
    "bras": {"section": (0.80, 0.80),
             "profil": ((0.0, 0.70, 0.70, 0.10), (0.02, 1.0, 1.0, 0.10), (0.14, 1.0, 1.0, 0.10),
                        (0.18, 1.0, 1.0, 0.30), (0.93, 1.0, 1.0, 0.30), (0.96, 1.0, 1.0, 0.10),
                        (0.985, 1.0, 1.0, 0.10), (1.0, 0.72, 0.72, 0.10)),
             "chevilles": (-0.45, 0.45)},
    "cheville": 0.13,
    "aisselier": {"pied": 0.10, "portee": 2.2,
                  "piece": {"section": (0.40, 0.36), "ancrage": 0.55, "chanfrein": 0.06}},
    "contrefiches": {"azimuts": (0, 90, 270), "empattement": 0.44, "hauteur": 0.17,
                     "piece": {"section": (0.55, 0.50), "ancrage": 0.60, "chanfrein": 0.09}},
    "corde": {"brin": 0.70, "tours": 3, "tour": 1.06, "segments": (12, 6), "cotes": 6,
              "noeud": {"spires": 6, "pas": 0.92, "rayon": 2.1, "creux": 0.80},
              "boucle": (0.95, 2.1), "pas": 4,
              "anse": ((0.0, 0.0), (0.50, 0.20), (0.96, 0.58), (0.62, 0.93), (0.0, 1.0), (-0.62, 0.93),
                       (-0.96, 0.58), (-0.50, 0.20), (0.0, 0.0))},
}

# Pilori : rang du socle, du poteau et de la planche du carcan dans la recette.
# `semelle` : `largeur` : demi-largeur de chaque bras de la croix (fraction du côté du socle) ; `hauteurs` du bras
# en x puis du bras en y (parts de celle du socle).
# `fut` : le poteau (`modele.poteau`).
# `liens` : `empattement` : distance du pied à l'axe du poteau (part de la demi-longueur du bras de la semelle) ;
# `hauteur` : de la tête sur la semelle (part de la hauteur du poteau) ; `piece` (`modele.contrefiche`), en fractions
# du demi-côté du poteau.
# `carcan` : `epaisseur` : demi-épaisseur des planches (part de celle de la primitive) ; `jour` : demi-jour de leur
# joint (fraction de la hauteur de la primitive) ; `trous` : par trou d'un côté du poteau, sa place (part de la
# demi-longueur de la planche) et son rayon (fraction de sa hauteur) ; `arc` : segments d'un demi-trou.
# `moises` : `place` (part de la demi-longueur de la planche), `largeur` : demi-largeur (fraction de la longueur de la
# planche), `hauteur` : demi-hauteur (part de celle de la planche), `ancrage` : part de la demi-épaisseur des planches
# où commence la moise, `face` : sa face vue (part de la demi-épaisseur de la primitive), `cheville` : rayon (fraction
# de la longueur de la planche).
# `chevilles` : celles du poteau dans le carcan ; leur place en travers du poteau (fractions de son demi-côté), leur
# rayon (fraction de ce demi-côté) ; `hauteur` : de part et d'autre du joint, la leur et celle des chevilles des
# moises (part de la demi-hauteur de la planche).
PILORI = {
    "socle": 0, "poteau": 1, "planche": 2,
    "semelle": {"largeur": 0.17, "hauteurs": (1.0, 0.84)},
    "fut": {"cote": 0.92, },
    "liens": {"empattement": 0.72, "hauteur": 0.23,
              "piece": {"section": (0.46, 0.40), "ancrage": 0.55, "chanfrein": 0.08}},
    "carcan": {"epaisseur": 0.58, "jour": 0.012, "trous": ((0.31, 0.090), (0.60, 0.215), (0.87, 0.090)), "arc": 6},
    "moises": {"place": 0.955, "largeur": 0.026, "hauteur": 0.90, "ancrage": 0.80, "face": 0.93,
               "cheville": 0.011},
    "chevilles": {"places": (-0.5, 0.5), "rayon": 0.14, "hauteur": 0.5},
}

# Cage : rang du plancher, du toit, du cylindre de l'anneau et des barreaux dans la recette.
# `cadre` : largeur de ses fers (fraction du côté du plateau), `tole` : part de la hauteur du plateau que garde la
# tôle, `chanfrein` : fraction de la hauteur du plateau.
# `barreau` : `rayon` (part de celui de la primitive), `ancrage` dans chaque cadre (fraction de sa longueur), `cotes`.
# `ceinture` : `hauteurs` (parts de la longueur d'un barreau), `hauteur` : demi-hauteur du fer (fraction de la longueur
# d'un barreau), `epaisseur` (part du jeu entre les barreaux et le bord du plancher), `pose` : part de cette épaisseur
# enfoncée dans les barreaux ; un rivet (`RIVET`, en fractions du diamètre d'un barreau) à chaque barreau hors de la
# porte. Sur le front, elle s'arrête à l'axe des barreaux des montants de la porte.
# `porte` : `battant` : rangs, le long du front, des barreaux qui portent ses montants ; `traverses` : leur hauteur
# (parts de la longueur d'un barreau), la première et la dernière bornant les montants ; `largeur` : demi-largeur de
# ses fers (fraction de la longueur d'un barreau) ; `epaisseur` et `pose`, comme la ceinture ; `gonds` : leur hauteur
# (parts de la longueur d'un barreau), `gond` : rayon (fraction de l'épaisseur de la porte) et demi-hauteur (fraction
# de la longueur d'un barreau) ; `serrure` : hauteur (part de la longueur d'un barreau), demi-largeur et demi-hauteur
# (fractions de la demi-largeur des fers), épaisseur (part du jeu).
# `anse` : `petit` : rayon du fer de l'anneau, `grand` : rayon de son dehors (parts du rayon du cylindre) ; `segments`
# du tour et de la section ; `ancrage` de la tige dans le toit (fraction de la hauteur du toit) ; `profil` de la tige
# (part de la longueur, part du rayon du cylindre), `cotes` ; `portee` : pied d'un tirant (part du demi-côté du toit),
# `attache` : sa tête sur la tige (part de la hauteur du cylindre), `tirant` (`modele.contrefiche`), en fractions du
# rayon du cylindre.
CAGE = {
    "plancher": 0, "toit": 1, "anneau": 2, "barreaux": (3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18),
    "cadre": {"largeur": 0.085, "tole": 0.55, "chanfrein": 0.12},
    "barreau": {"rayon": 0.80, "ancrage": 0.012, "cotes": 6},
    "ceinture": {"hauteurs": (0.30, 0.70), "hauteur": 0.011, "epaisseur": 0.34, "pose": 0.30},
    "porte": {"battant": (1, 3), "traverses": (0.08, 0.50, 0.92), "largeur": 0.016, "epaisseur": 0.62, "pose": 0.20,
              "gonds": (0.20, 0.80), "gond": (0.55, 0.030),
              "serrure": (0.50, 1.7, 2.4, 0.97)},
    "anse": {"petit": 0.20, "grand": 0.84, "segments": (12, 6), "ancrage": 0.5,
             "profil": ((0.0, 0.88), (0.10, 0.88), (0.16, 0.50), (0.74, 0.42), (0.80, 0.74), (0.92, 0.74),
                        (1.0, 0.40)),
             "cotes": 8, "portee": 0.86, "attache": 0.24,
             "tirant": {"section": (0.34, 0.11), "ancrage": 0.30, "chanfrein": 0.03}},
}

# Enseigne : rang de la patte de scellement, de la potence, des deux chaînes et du tableau dans la recette.
# `scellement` : la patte ; `epaisseur` : sa demi-épaisseur (part de celle de la primitive), `profil`
# (`geometrie.profilee`), `rivets` : leur hauteur (parts de celle de la patte).
# `potence` : son profil, du mur au bouton.
# `tirant` : `pied` : sa hauteur sur la patte (part de celle de la patte), `portee` : sa prise sur la potence (part
# de sa longueur), `rayon` (fraction de la demi-largeur de la potence), `cotes`.
# `chaine` : `maillons` : leur nombre, impair, le premier et le dernier dans le plan du tableau, leur centre à un
# rayon de fer en dedans du dessous de la potence bâtie au droit de la chaîne (son profil) et du haut du tableau :
# chacun y entre d'un rayon de fer de plus que sa moitié ; `petit` : rayon de leur fer (fraction de la demi-largeur de
# la potence) ; `segments` du tour et de la section.
# `cadre` : `largeur` de ses traverses (fraction de la hauteur du tableau) ; `ancrage` : part de cette largeur où
# entrent les planches et les montants ; `montant` : part de la section d'une traverse que garde un montant ;
# `planches` : leur nombre, `ecart` de leurs joints (part de leur hauteur), `jour` : demi-jour (fraction de la hauteur
# du tableau), `epaisseur` (part de celle du tableau, tirée).
ENSEIGNE = {
    "patte": 0, "bras": 1, "chaines": (2, 3), "tableau": 4,
    "scellement": {"epaisseur": 0.36,
                   "profil": ((0.0, 0.10, 0.6, 0.3), (0.05, 0.62, 1.0, 0.3), (0.09, 0.34, 1.0, 0.3),
                              (0.14, 0.80, 1.0, 0.3), (0.86, 0.80, 1.0, 0.3), (0.91, 0.34, 1.0, 0.3),
                              (0.95, 0.62, 1.0, 0.3), (1.0, 0.10, 0.6, 0.3)),
                   "rivets": (0.18, 0.42, 0.66, 0.82)},
    "potence": ((0.0, 0.80, 0.80, 0.12), (0.93, 0.74, 0.74, 0.12), (0.945, 0.46, 0.46, 0.12),
                (0.955, 0.98, 0.98, 0.34), (0.985, 0.98, 0.98, 0.34), (1.0, 0.40, 0.40, 0.12)),
    "tirant": {"pied": 0.955, "portee": 0.62, "rayon": 0.36, "cotes": 6},
    "chaine": {"maillons": 5, "petit": 0.20, "segments": (8, 4)},
    "cadre": {"largeur": 0.085, "ancrage": 0.40, "montant": 0.86, "planches": 3, "ecart": 0.16, "jour": 0.003,
              "epaisseur": (0.50, 0.66)},
}

# Écu : `planche` : rangs, du haut vers la pointe, des boîtes dont l'enveloppe fait son contour, la tête de la première
# puis le pied de chacune ; `pitons` : leurs rangs. `epaisseur` : demi-épaisseur de la planche (part de celle de la
# première boîte) ; `arete` : chanfrein de ses rives (fraction de son épaisseur).
# `cerclage` : `largeur` : demi-largeur de ses fers (fraction de la largeur de la première boîte), posés au dedans des
# rives ; `chanfrein` (fraction de cette demi-largeur) ; `rivet` : son rayon (part de cette demi-largeur), sa saillie
# (part de la demi-épaisseur de la boîte), `cotes`.
# `piton` : `grand` : rayon de son œil (part de la demi-largeur de sa boîte), `petit` : rayon de son fer (part de la
# demi-épaisseur de sa boîte), `prise` : part du rayon de l'œil dont son centre monte sur le bas de sa boîte ;
# `segments` du tour et de la section.
ECU = {
    "planche": (0, 1, 2), "pitons": (3, 4),
    "epaisseur": 0.6, "arete": 0.2,
    "cerclage": {"largeur": 0.022, "chanfrein": 0.3, "rivet": (1.25, 0.98), "cotes": 6},
    "piton": {"grand": 0.72, "petit": 0.45, "prise": 0.75, "segments": (10, 5)},
}

SPHERE = ((0.0, 0.35), (0.12, 0.70), (0.30, 0.94), (0.5, 1.0), (0.70, 0.94), (0.88, 0.70), (1.0, 0.35))
"""Le profil d'une boule tournée dans son cylindre (`geometrie.tourne`)."""

# Épi de faîtage : rang de l'embase, de la hampe, du bulbe et de la boule dans la recette ; profil de chacun (part de
# la longueur, part de l'apothème de son cylindre), `cotes`.
EPI = {
    "embase": 0, "hampe": 1, "bulbe": 2, "boule": 3,
    "jupe": ((0.0, 1.0), (0.25, 0.96), (0.55, 0.62), (1.0, 0.40)),
    "fut": ((0.0, 0.95), (0.70, 0.80), (0.86, 0.95), (0.88, 0.60), (1.0, 0.12)),
    "oignon": ((0.0, 0.30), (0.10, 0.62), (0.32, 1.0), (0.48, 0.96), (0.70, 0.62), (0.88, 0.36), (1.0, 0.30)),
    "cotes": 10,
}

# Girouette : rang de l'embase, de la hampe, des deux bras de la croix, de la boîte de la flèche et de la boule dans
# la recette ; `pied`, `fut` : profil de l'embase et de la hampe (part de la longueur, part de l'apothème), `cotes`.
# `bras` : profil d'un bras de la croix (`geometrie.profilee`) ; `losange` : sa demi-diagonale (fraction de la
# longueur du bras), le recul de son centre depuis le bout du bras (fraction de cette longueur), sa demi-épaisseur
# (part de celle du bras).
# `aile` : la flèche, dans le plan de sa boîte ; `epaisseur` : demi-épaisseur de ses fers (part de celle de la boîte),
# `arete` : chanfrein des pièces découpées (fraction de la longueur de la boîte) ; `fer` : demi-hauteur du fer plat
# (fraction de la hauteur de la boîte), sa queue et sa tête (parts de la demi-longueur de la boîte) ; `pointe` :
# longueur (part de la demi-longueur) et demi-hauteur (part de la demi-hauteur) ; `banderole` : sa naissance (part de la
# demi-longueur, du côté opposé à la pointe), sa demi-hauteur à la naissance puis au bout (parts de la demi-hauteur),
# l'entaille de ses deux queues (part de la demi-longueur).
# `douille` : son rayon (part de l'apothème de la hampe, qu'il dépasse) et sa demi-hauteur (fraction de la hauteur
# de la boîte de la flèche).
GIROUETTE = {
    "embase": 0, "hampe": 1, "croix": (2, 3), "fleche": 4, "boule": 5,
    "pied": ((0.0, 1.0), (0.35, 0.94), (1.0, 0.45)),
    "fut": ((0.0, 0.95), (0.80, 0.75), (0.94, 0.60), (1.0, 0.12)),
    "cotes": 10,
    "bras": ((0.0, 0.6, 0.6, 0.3), (0.03, 1.0, 1.0, 0.3), (0.97, 1.0, 1.0, 0.3), (1.0, 0.6, 0.6, 0.3)),
    "losange": (0.065, 0.075, 0.5),
    "aile": {"epaisseur": 0.8, "arete": 0.004, "fer": (0.04, 0.80, 0.70), "pointe": (0.36, 0.40),
             "banderole": (0.14, 0.26, 0.96, 0.22)},
    "douille": (1.5, 0.12),
}

# Panneau : rang du poteau, du tableau et de sa pointe dans la recette.
# `fut` : le poteau (`modele.poteau`).
# `fleche` : `epaisseur` : demi-épaisseur d'une planche (part de celle du tableau), `usure` : part de cette épaisseur
# que garde une planche, tirée ; `jour` : demi-jour entre les deux planches, `meplat` : hauteur de la pointe d'une
# planche (fractions de la hauteur du tableau) ; `entaille` : profondeur de la queue (fraction de la longueur du
# tableau) et demi-hauteur de son ouverture (part de celle du tableau) ; `chanfrein` : fraction de la demi-épaisseur.
# `traverse` : `places` (parts de la demi-longueur du tableau), `largeur` : demi-largeur (fraction de la longueur du
# tableau), `hauteur` : demi-hauteur (part de celle du tableau), `ancrage` : ce dont elle entre dans les planches
# (part de leur demi-épaisseur), `face` : sa face vue (part de la demi-épaisseur du tableau).
# `chevilles` : leur `rayon` (fraction de la hauteur du tableau), leur `hauteur` de part et d'autre du joint des
# planches (part de la demi-hauteur du tableau).
PANNEAU = {
    "poteau": 0, "tableau": 1, "pointe": 2,
    "fut": {"cote": 0.90, },
    "fleche": {"epaisseur": 0.55, "usure": (0.80, 1.0), "jour": 0.006, "meplat": 0.035, "entaille": (0.11, 0.56),
               "chanfrein": 0.30},
    "traverse": {"places": (-0.62, 0.66), "largeur": 0.030, "hauteur": 0.86, "ancrage": 0.5, "face": 0.92},
    "chevilles": {"rayon": 0.022, "hauteur": 0.5},
}

# Pieu : rang du fût, du prisme de sa taille et de la pierre dans la recette.
# `tronc` : `rayon` (part de celui du cylindre), `cotes`, `rangs` d'anneaux du pied à l'épaule ; `bosse` : rayon de
# chaque côté (part, tirée) ; `defilement` : part du rayon perdue du pied à l'épaule ; `flexe` : déport de l'anneau
# de l'épaule (fraction du rayon, tiré jusqu'à cette borne), moindre à mesure vers le pied ; `epaule` : distance de
# l'épaule à la tête du cylindre (fraction du rayon) ; `taille` : par anneau de la taille, son avance de l'épaule
# vers la pointe (part) ; `eclat` : part de cette avance que garde chaque sommet, tirée.
# `pierre` : `cotes` ; `bosse` : rayon de chaque côté (part, tirée) ; `profil` : (part de la hauteur, part du rayon) ;
# `cale` : rayon et hauteur de la pierre de calage (fractions de ceux de la pierre de la recette) ; `contre` : distance
# de son centre au flanc du pieu (fraction de son rayon).
PIEU = {
    "fut": 0, "taille": 1, "borne": 2,
    "tronc": {"rayon": 0.90, "cotes": 8, "rangs": 5, "bosse": (0.86, 1.0), "defilement": 0.10, "flexe": 0.05,
              "epaule": 1.6, "taille": (0.30, 0.66), "eclat": (0.80, 1.20)},
    "pierre": {"cotes": 7, "bosse": (0.72, 0.92), "profil": ((0.0, 0.92), (0.40, 1.0), (0.80, 0.78), (1.0, 0.46)),
               "cale": (0.62, 1.7), "contre": 0.45},
}

# Étendard et bannière du Chaos : rang du socle, de la hampe, de la traverse, de l'étoffe, de son pan et de la ferrure
# de tête dans leurs recettes, qui ne diffèrent que par leurs matières.
# `pied` : le socle ; profil (part de la hauteur, part du rayon), `cotes`.
# `fut` : la hampe ; `ancrage` dans le socle (part de la hauteur du socle), profil (part de la longueur, part du
# rayon), `cotes`.
# `virole` : de part et d'autre de la traverse ; `ecart` : distance de son milieu à l'axe de la traverse, `hauteur`
# (fractions du rayon de la traverse), `epaisseur` (fraction du rayon de la hampe).
# `vergue` : la traverse ; profil (part de la longueur, part du rayon), `cotes`.
# `drap` : `colonnes` et `rangs` de sa maille ; `epaisseur` : sa demi-épaisseur (part de celle de la primitive) ;
# `tetiere` : part du creux des plis que garde le haut de l'étoffe ; `fourreau` : ses `fronces` et leur `rayon`
# (part de celui de la traverse, tirée).
BANNIERE = {
    "socle": 0, "hampe": 1, "traverse": 2, "etoffe": 3, "pan": 4, "fleche": 5,
    "pied": {"profil": ((0.0, 0.92), (0.30, 0.92), (0.42, 0.78), (0.72, 0.70), (0.84, 0.52), (1.0, 0.46)), "cotes": 8},
    "fut": {"ancrage": 0.6, "profil": ((0.0, 0.90), (0.5, 0.82), (1.0, 0.74)), "cotes": 8},
    "virole": {"ecart": 1.9, "hauteur": 1.1, "epaisseur": 0.30},
    "vergue": {"profil": ((0.0, 0.50), (0.012, 0.90), (0.05, 0.90), (0.062, 0.62), (0.94, 0.62), (0.952, 0.90),
                          (0.988, 0.90), (1.0, 0.50)), "cotes": 6},
    "drap": {"colonnes": 24, "rangs": 12, "epaisseur": 0.22, "tetiere": 0.25,
             "fourreau": {"fronces": 9, "rayon": (0.74, 0.90)}},
}

# Par bannière : `bord` : le bas de l'étoffe, de la hampe au bout de la traverse (part de la largeur, part de la
# hauteur du pan qu'elle descend sous la boîte de l'étoffe) ; `plis` : `ondes` : leur nombre en travers de l'étoffe,
# `derive` : ce dont ils dévient du haut au bas (en ondes), `creux` : leur creux au plus (fraction de la largeur de
# l'étoffe), `part` : part du jeu de l'enveloppe qu'ils prennent.
# `ferrure` : `ancrage` sur la tête de la hampe (part de la hauteur du cylindre) ; `douille` : sa tête (part de la
# hauteur du cylindre), son profil (part de sa longueur, part du rayon du cylindre), `cotes` ; `fer` : ses sections
# (part de la hauteur du cylindre, demi-largeur dans le plan de l'étoffe et demi-épaisseur en fractions du rayon),
# `chanfrein` (fraction de son plus petit demi-côté) ; `crocs` : `azimuts`, `pied` : leur hauteur sur la douille (part
# de celle du cylindre), `portee` (part du rayon), `montee` (part de la hauteur du cylindre), `rayon` (part du rayon),
# `profil` (part de la longueur, part du rayon du croc), `cotes`.
ETOFFES = {
    "etendard": {
        "bord": ((0.0, 0.30), (0.25, 1.0), (0.5, 0.0), (0.75, 1.0), (1.0, 0.30)),
        "plis": {"ondes": 3.5, "derive": 0.35, "creux": 0.030, "part": 0.92},
        "ferrure": {"ancrage": 0.30, "douille": 0.42,
                    "profil": ((0.0, 0.70), (0.18, 0.74), (0.24, 0.58), (0.52, 0.52), (0.60, 0.80), (0.78, 0.86),
                               (0.90, 0.62), (1.0, 0.30)),
                    "cotes": 8,
                    "fer": ((0.36, 0.18, 0.12), (0.50, 0.50, 0.14), (0.62, 0.56, 0.12), (0.84, 0.30, 0.08),
                            (0.995, 0.04, 0.03)),
                    "chanfrein": 0.6,
                    "crocs": {"azimuts": (0, 180), "pied": 0.30, "portee": 0.80, "montee": 0.0, "rayon": 0.16,
                              "profil": ((0.0, 1.0), (0.80, 0.70), (0.86, 1.25), (0.95, 1.25), (1.0, 0.5)),
                              "cotes": 6}},
    },
    "banniere-chaos": {
        "bord": ((0.0, 0.85), (0.0833, 0.30), (0.125, 1.0), (0.2083, 0.45), (0.25, 0.10), (0.3333, 0.70),
                 (0.375, 0.95), (0.4583, 0.20), (0.5, 0.55), (0.5417, 1.0), (0.625, 0.35), (0.7083, 0.0),
                 (0.75, 0.60), (0.7917, 0.90), (0.875, 0.25), (0.9583, 0.75), (1.0, 0.40)),
        "plis": {"ondes": 4.5, "derive": 0.70, "creux": 0.034, "part": 0.96},
        "ferrure": {"ancrage": 0.30, "douille": 0.34,
                    "profil": ((0.0, 0.72), (0.30, 0.76), (0.40, 0.90), (0.60, 0.90), (0.72, 0.56), (1.0, 0.40)),
                    "cotes": 8,
                    "fer": ((0.26, 0.26, 0.26), (0.40, 0.34, 0.34), (0.52, 0.22, 0.22), (0.995, 0.03, 0.03)),
                    "chanfrein": 0.2,
                    "crocs": {"azimuts": (45, 135, 225, 315), "pied": 0.20, "portee": 0.86, "montee": 0.50,
                              "rayon": 0.20, "profil": ((0.0, 1.0), (0.55, 0.75), (1.0, 0.06)), "cotes": 4}},
    },
}
