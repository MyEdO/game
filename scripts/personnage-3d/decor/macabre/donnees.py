"""Données du macabre (#4335) : un GLB par décor `cadavre`, `cheval-mort`, `detritus`, `mare-sang` et
`cercle-runique` de `src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`).
Aucune illustration au corpus : proportions d'adaptation, chacune en fraction de la primitive qui la porte (son rang
dans la recette), dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y, z vers le haut). La
station d'un membre couché (`modele.corps`) est `((x, y), rx, rz)` : la place de son dessous, en demi-côtés de sa boîte
depuis son centre, `x` vers le dehors du corps, `y` vers le front de la recette ; ses demi-axes horizontal et vertical,
en demi-hauteurs de la boîte. Un relief (`modele.gisant`) est `(rang, angle, demi-longueur, demi-largeur, part)` : son
milieu au rang d'une station, compté en stations, et à un angle en degrés depuis le dessus de la section ; ce qu'il
couvre de part et d'autre, en stations et en degrés ; la part du rayon qu'il ajoute en son milieu, ou qu'il ôte.

- `cadavre` : un homme couché sur le dos, la tête à l'opposé du front : une tunique des épaules aux cuisses, serrée
  d'une ceinture ; deux jambes de braies, les genoux marqués, dans deux bottes dont le pied retombe vers le dehors ;
  un bras le long du corps, l'autre en travers, chacun une manche et une main ; le cou, la tête et son visage
  (menton, bouche, nez, orbites creusées sous les arcades, pommettes, oreilles), une calotte de cheveux ; une flaque
  sous le flanc.
- `cheval-mort` : un cheval couché sur le flanc, les pattes vers le front : le tronc, de la croupe ronde à la
  hanche saillante, au flanc creusé, au ventre qui retombe, aux côtes et à l'épaule ; l'encolure du garrot à la
  nuque ; la tête posée au sol (front, arcade de l'œil, ganache, chanfrein, naseau, bouche), une oreille dressée,
  l'autre au sol ; la crinière en mèches qui tombent de la crête de l'encolure ; quatre pattes, deux au sol, deux
  en l'air (épaule ou cuisse, genou ou jarret, canon plié, boulet, paturon) et leurs sabots évasés ; la queue en
  mèches ; une flaque sous le dos.
- `detritus` : une butte de terre basse où se prennent : un panneau de trois planches aux bouts inégaux, une cruche
  ventrue à la gueule creuse, une motte, un chiffon gondolé, un cageot défoncé auquel manque un côté, un fémur ; des
  mottes et des éclats de bois semés autour.
- `mare-sang` : trois flaques aux bords lobés, bombées à des hauteurs inégales, leur dessus ridé ; des gouttes semées
  autour de la grande.
- `cercle-runique` : une dalle ronde à glacis, qui porte une étoile à huit flèches autour d'un moyeu ; huit pierres
  plates bosselées, une rune en relief sur chacune ; un cercle tracé au sol qui passe sous les pierres.

Matières : celles des recettes, sauf : le cadavre prend `cuir-tanne`, que sa recette toute de drap ne nomme pas, pour
ses bottes et sa ceinture, qui sont de cuir ; ses cheveux et les sabots du cheval sont du `drap-terne` de leur
recette, la plus sombre de ses matières ; les pierres du cercle, que la recette fait de `rune-chaos`, sont de la
`pierre-chaos` de sa dalle et gardent `rune-chaos` pour leur rune ; la butte du tas est de la `terre-battue` de sa
recette. Le catalogue n'a pas de terre cuite (#4423) : la cruche garde la `terre-battue` que la recette donne à son
cylindre. Il n'a ni crin (`drap-terne` pour la crinière, que la recette donne à la queue), ni cheveux, ni corne, ni
sang frais ni sang séché (`sang-repandu`). Aucun emplacement de palette ne nomme la peau, la terre, l'os ni la
pierre : ils prennent `corps` ; le sang, le crin, la corne, les cheveux et la rune, `accent` ; le drap, `vet1`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
PEAU = {"peau": ("corps", "peau-morte")}
SANG = {"sang": ("accent", "sang-repandu")}
MATERIAUX = {
    "cadavre": {**PEAU, **SANG, "drap": ("vet1", "drap-terne"), "cuir": ("cuir", "cuir-tanne"),
                "cheveux": ("accent", "drap-terne")},
    "cheval-mort": {**PEAU, **SANG, "crin": ("accent", "drap-terne"), "corne": ("accent", "drap-terne")},
    "detritus": {"bois": ("bois", "bois-mort"), "terre": ("corps", "terre-battue"), "drap": ("vet1", "drap-terne"),
                 "os": ("corps", "os")},
    "mare-sang": {**SANG},
    "cercle-runique": {"pierre": ("corps", "pierre-chaos"), "rune": ("accent", "rune-chaos")},
}

BUDGET_TRIANGLES = {"cadavre": 4000, "cheval-mort": 4900, "detritus": 2600, "mare-sang": 2000, "cercle-runique": 1900}

ANGLE_LISSE = {"peau": 60, "drap": 60, "cuir": 50, "cheveux": 60, "crin": 60, "corne": 40, "sang": 60, "bois": 40,
               "terre": 50, "os": 50, "pierre": 30, "rune": 30}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : une chair, une étoffe, une
flaque et une motte sont rondes, une planche, une pierre et une rune gardent leurs arêtes."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`), et où
s'arrête le rayon d'un membre couché (`modele.gisant`)."""

ARETE = 0.08
"""Chanfrein d'une arête de bois adoucie, en fraction de l'épaisseur de la pièce."""

# Flaque (`modele.flaque`) : `cotes` de son bord ; `lobes` : (nombre de lobes au tour, poids) de chaque onde de son
# bord, et `creux`, la part du rayon qu'elles ôtent ensemble au plus creux (`modele.lobee`) ; `hauteur` : part de la
# hauteur de son cylindre où elle s'arrête (tirée) ; `anneaux` : (part de sa hauteur, part de son rayon), du bord au
# milieu, le dernier sa pointe (`modele.tas`).
FLAQUE = {"cotes": 20, "lobes": ((2, 0.4), (3, 0.35), (5, 0.25)), "creux": 0.34, "hauteur": (0.6, 1.0),
          "anneaux": ((0.0, 1.0), (0.55, 0.985), (1.0, 0.93), (0.82, 0.66), (1.0, 0.38), (0.86, 0.0))}

# Cadavre : rang du torse et de la flaque dans la recette.
# `membres` (`modele.corps`) : rangs des boîtes, matériau, (côtés d'une section, points par tronçon), fini en pointe,
# reliefs, stations.
CADAVRE = {
    "torse": 0, "sang": 6,
    "membres": {
        # Du col à l'ourlet, évasé sur les cuisses.
        "tunique": ((0,), "drap", (12, 3), False, (),
                    (((0.0, -1.06), 0.9, 0.6), ((0.0, -0.93), 1.75, 0.82), ((0.0, -0.55), 1.95, 0.98),
                     ((0.0, 0.0), 1.65, 0.9), ((0.0, 0.45), 1.8, 0.88), ((0.0, 0.9), 2.0, 0.72),
                     ((0.0, 1.02), 1.95, 0.62))),
        "ceinture": ((0,), "cuir", (12, 1), False, (), (((0.0, -0.06), 1.72, 0.94), ((0.0, 0.06), 1.72, 0.94))),
        # De la hanche, sous la tunique, à la cheville : cuisse, genou, mollet.
        "jambe": ((1, 2), "drap", (8, 3), False, (),
                  (((0.1, -1.3), 1.0, 0.95), ((0.0, -0.6), 1.0, 0.95), ((-0.15, -0.05), 0.78, 0.75),
                   ((-0.3, 0.3), 0.82, 0.72), ((-0.42, 0.6), 0.6, 0.55))),
        # Du mollet au talon, puis le pied retombé vers le dehors.
        "botte": ((1, 2), "cuir", (8, 3), False, (),
                  (((-0.33, 0.36), 0.9, 0.8), ((-0.45, 0.6), 0.72, 0.68), ((-0.5, 0.78), 0.72, 0.82),
                   ((0.1, 0.84), 0.62, 0.66), ((0.82, 0.82), 0.4, 0.45))),
        # Le bras le long du corps : de l'épaule, sous la tunique, au coude et au poignet ; sa main à plat.
        "manche_longue": ((4,), "drap", (8, 3), False, (),
                          (((-2.5, -1.12), 1.0, 1.0), ((-0.9, -1.0), 1.0, 1.0), ((0.0, -0.35), 0.9, 0.9),
                           ((0.1, 0.3), 0.72, 0.72))),
        "main_longue": ((4,), "peau", (8, 2), False, (),
                        (((0.1, 0.22), 0.5, 0.45), ((0.05, 0.55), 0.8, 0.42), ((0.0, 0.85), 0.7, 0.32),
                         ((0.0, 0.99), 0.3, 0.2))),
        # Le bras en travers : de l'épaule, sous la tunique, au coude fléchi et au poignet ; sa main à plat.
        "manche_large": ((5,), "drap", (8, 3), False, (),
                         (((-1.2, 0.3), 1.0, 1.0), ((-0.75, 0.1), 1.0, 1.0), ((-0.1, -0.3), 0.9, 0.9),
                          ((0.5, 0.0), 0.72, 0.72))),
        "main_large": ((5,), "peau", (8, 2), False, (),
                       (((0.45, 0.0), 0.5, 0.45), ((0.7, 0.1), 0.8, 0.42), ((0.9, 0.15), 0.7, 0.32),
                        ((0.99, 0.15), 0.3, 0.2))),
        # Du cou, sous le col, au menton, à la bouche, au nez, aux yeux, aux arcades, au front et au sommet du
        # crâne. Reliefs : le menton, la fente de la bouche, le nez, les deux orbites, les deux arcades, les deux
        # pommettes, les deux oreilles.
        "tete": ((3,), "peau", (20, 3), False,
                 ((2.0, 0, 0.7, 35, 0.14), (3.0, 0, 0.4, 40, -0.09), (4.0, 0, 1.1, 16, 0.3),
                  (5.0, 32, 0.6, 22, -0.22), (5.0, -32, 0.6, 22, -0.22), (5.9, 28, 0.45, 30, 0.08),
                  (5.9, -28, 0.45, 30, 0.08), (4.3, 55, 0.8, 22, 0.06), (4.3, -55, 0.8, 22, 0.06),
                  (4.7, 90, 0.7, 20, 0.22), (4.7, -90, 0.7, 20, 0.22)),
                 (((0.0, 1.3), 0.5, 0.5), ((0.0, 0.95), 0.5, 0.5), ((0.0, 0.66), 0.72, 0.66),
                  ((0.0, 0.42), 0.9, 0.76), ((0.0, 0.15), 0.98, 0.78), ((0.0, -0.12), 1.0, 0.78),
                  ((0.0, -0.3), 1.0, 0.8), ((0.0, -0.55), 0.97, 0.8), ((0.0, -0.85), 0.78, 0.72),
                  ((0.0, -0.99), 0.4, 0.42))),
        # La calotte des cheveux, du haut du front au sommet du crâne.
        "cheveux": ((3,), "cheveux", (20, 3), False, (),
                    (((0.0, -0.5), 1.03, 0.85), ((0.0, -0.66), 1.0, 0.85), ((0.0, -0.86), 0.84, 0.77),
                     ((0.0, -1.0), 0.45, 0.47))),
    },
}

# Cheval mort : rang du tronc et de la flaque dans la recette.
# `tronc` : ses sections de la croupe au poitrail (part de la longueur du cylindre ; écart de son milieu à l'axe,
# vers le front, demi-axes horizontal et vertical, en parts de son apothème), posées au sol ; (côtés d'une section,
# points par tronçon) ; reliefs (`modele.gisant`, l'angle compté vers le ventre) : la pointe de la hanche, l'épaule,
# cinq côtes.
# `oreille` : celle qui se dresse sur la tête ; rang de la station qui la porte ; ce dont elle s'enfonce, le
# demi-côté de son pied et sa longueur (`geometrie.clou`), en demi-hauteurs de la boîte de la tête ; son sens (part
# vers le haut, part vers le dos).
# `membres` (`modele.corps`) ; l'angle d'un relief de la tête se compte vers la ganache.
# `meche` : une mèche de crin (`modele.gisant`) ; `fuseau` : parts de ses rayons à sa racine, à son milieu et à sa
# pointe ; `onde` : écart de son milieu à son fil (fraction de sa longueur, tiré) ; `taille` ; `pas` : points par
# tronçon de la ligne de ses racines.
# `criniere`, `queue` : `boite` : rang de la boîte qui les porte ; `crete` : la ligne de leurs racines, dans cette
# boîte (comme une station) ; `nombre` de mèches ; `sens` : leur cap, en degrés de +x vers +y de `gabarit.py`
# (tiré) ; `longueur` (tirée) et `rayons` à la racine, horizontal et vertical, en demi-hauteurs de la boîte.
CHEVAL = {
    "corps": 0, "sang": 8,
    "tronc": (((0.0, -0.18, 0.42, 0.36), (0.07, -0.1, 0.74, 0.58), (0.2, -0.02, 0.9, 0.7), (0.34, 0.0, 0.82, 0.62),
               (0.52, 0.1, 0.9, 0.7), (0.7, 0.04, 0.92, 0.7), (0.86, -0.06, 0.86, 0.62), (0.96, -0.05, 0.62, 0.52),
               (1.0, -0.05, 0.42, 0.4)), (16, 4),
              ((2.0, -40, 0.7, 28, 0.09), (6.2, 15, 0.8, 40, 0.06), (4.0, 10, 0.3, 75, 0.045),
               (4.5, 10, 0.3, 75, 0.045), (5.0, 10, 0.3, 75, 0.045), (5.5, 10, 0.3, 75, 0.045),
               (6.0, 10, 0.3, 75, 0.045))),
    "oreille": (1, 0.15, (0.3, 0.9), (0.8, 0.6)),
    "membres": {
        # Du garrot, dans le tronc, à la nuque, dans la tête.
        "encolure": ((1,), "peau", (12, 3), False, (),
                     (((-1.6, 0.0), 0.95, 0.9), ((-0.7, -0.03), 0.9, 0.8), ((0.1, 0.0), 0.75, 0.66),
                      ((0.8, 0.1), 0.6, 0.54), ((1.3, 0.03), 0.5, 0.46))),
        # De la nuque au front, à l'œil et à la ganache, à la joue, au chanfrein, au nez, aux naseaux et au bout
        # des lèvres. Reliefs : la ganache, l'arcade de l'œil, la crête de la joue, le naseau, la fente de la bouche.
        "tete": ((2,), "peau", (16, 3), False,
                 ((2.2, 50, 0.9, 35, 0.1), (2.0, -30, 0.4, 20, 0.1), (3.2, -5, 0.9, 14, 0.05),
                  (6.0, -20, 0.45, 22, -0.14), (6.2, 45, 0.9, 14, -0.1)),
                 (((-1.15, -0.3), 0.6, 0.55), ((-0.8, -0.2), 0.88, 0.68), ((-0.45, -0.08), 0.97, 0.72),
                  ((-0.05, 0.02), 0.84, 0.64), ((0.35, 0.1), 0.62, 0.5), ((0.66, 0.16), 0.52, 0.44),
                  ((0.84, 0.2), 0.56, 0.46), ((0.92, 0.22), 0.36, 0.32))),
        # L'oreille du dessous, couchée au sol vers le dos.
        "oreille": ((2,), "peau", (8, 1), True, (), (((-0.8, -0.8), 0.3, 0.2), ((-0.88, -1.6), 0.05, 0.05))),
        # De l'épaule ou de la cuisse, dans le tronc, à l'avant-bras ou à la jambe, au genou ou au jarret, puis le
        # canon, plié vers le milieu du corps, le boulet et le paturon : les deux pattes au sol, puis les deux en
        # l'air.
        "patte_basse": ((3, 5), "peau", (8, 3), False, (),
                        (((0.3, -1.7), 2.2, 1.5), ((0.25, -0.95), 1.6, 1.15), ((0.2, -0.45), 1.05, 0.95),
                         ((0.15, -0.05), 0.95, 0.9), ((-0.5, 0.3), 0.6, 0.6), ((-1.1, 0.6), 0.75, 0.72),
                         ((-1.35, 0.74), 0.55, 0.55))),
        "patte_haute": ((4, 6), "peau", (8, 3), False, (),
                        (((0.3, -2.4), 2.2, 1.5), ((0.25, -1.5), 1.6, 1.15), ((0.2, -0.85), 1.05, 0.95),
                         ((0.15, -0.4), 0.95, 0.9), ((-0.5, 0.05), 0.6, 0.6), ((-1.1, 0.45), 0.75, 0.72),
                         ((-1.35, 0.64), 0.55, 0.55))),
        # Du paturon à la sole, évasé.
        "sabot_bas": ((3, 5), "corne", (8, 1), False, (), (((-1.3, 0.7), 0.6, 0.6), ((-1.72, 0.9), 0.95, 0.9))),
        "sabot_haut": ((4, 6), "corne", (8, 1), False, (), (((-1.3, 0.6), 0.6, 0.6), ((-1.72, 0.84), 0.95, 0.9))),
    },
    "meche": {"fuseau": ((1.0, 1.0), (0.75, 0.5), (0.3, 0.15)), "onde": (-0.15, 0.15), "taille": (8, 2), "pas": 4},
    "criniere": {"boite": 1, "crete": ((-1.1, -0.8), (-0.3, -0.75), (0.5, -0.5), (1.1, -0.38)), "nombre": 8,
                 "sens": (20, 65), "longueur": (0.35, 0.6), "rayons": (0.2, 0.5)},
    "queue": {"boite": 7, "crete": ((-1.5, 0.35), (-1.35, 0.0), (-1.5, -0.35)), "nombre": 5, "sens": (-7, 7),
              "longueur": (8.0, 11.5), "rayons": (0.5, 0.95)},
}

# Tas d'immondices : rang du panneau de planches, de la cruche, de la motte, du chiffon, du cageot et de l'os dans la
# recette.
# `planche` : épaisseur des planches du panneau (part de la hauteur de sa boîte) ; `bordage` (`geometrie.bordage`).
# `cruche` : son profil, du cul à la lèvre puis au fond de sa gueule (`geometrie.tourne`), et ses côtés.
# `motte` : la motte de la recette (`modele.tas`) ; ses `cotes`, ses `lobes` et son `creux` (`modele.lobee`) ; sa
# `hauteur` (part de son rayon) ; ses `anneaux`.
# `etoffe` : le chiffon (`geometrie.onde`) ; `epais` (part de la hauteur de sa boîte) ; `creux` de ses plis (part de
# ce qui reste de cette hauteur, tirée par rang) ; `plis`, `pas` ; `rangs` : (place sur le petit axe de la boîte en
# demi-côtés, demi-largeur en part de celle de la boîte), chacun déporté au plus de ce qu'il laisse libre.
# `caisse` : le cageot ; `epais` de ses planches (part de la hauteur de sa boîte) ; `parois` : celles qui restent
# des quatre ; `hauteur` où chacune est brisée (part de ce qui reste de cette hauteur, tirée) ; `ancrage` : ce dont
# une paroi entre dans le fond (part de son épaisseur).
# `femur` : profil de l'os (`geometrie.tournee` : part de sa longueur, part de la demi-hauteur de sa boîte) ; ses
# `pans`.
# `butte` : `hauteur` (part de celle de la cruche) ; `rayon` (part de la plus courte portée sous l'enveloppe, à cette
# hauteur, depuis le milieu des primitives, sur `caps` caps) ; `cotes`, `lobes`, `creux`, `anneaux`.
# `semis` (`modele.semis`) : `part` de la portée où tombe un débris (tirée) ; `mottes` : leur nombre et leur rayon
# (part de celui de la motte de la recette, tiré) ; `eclats` : leur nombre, leur demi-longueur (part de celle du
# panneau, tirée), leur demi-largeur et leur épaisseur (parts de celles d'une planche du panneau).
DETRITUS = {
    "planches": 0, "cruche": 1, "motte_de_terre": 2, "chiffon": 3, "cageot": 4, "os": 5,
    "planche": 0.6, "bordage": {"planches": 3, "ecart": 0.2, "jour": 0.012, "bout": (0.0, 0.3)},
    "cruche_tournee": (((0.0, 0.5), (0.04, 0.62), (0.28, 0.94), (0.48, 1.0), (0.7, 0.8), (0.84, 0.52), (0.93, 0.5),
                        (1.0, 0.62), (1.0, 0.46), (0.78, 0.4)), 12),
    "motte": {"cotes": 10, "lobes": ((2, 0.5), (3, 0.5)), "creux": 0.3, "hauteur": 1.1,
              "anneaux": ((0.0, 1.0), (0.3, 0.92), (0.7, 0.6), (0.92, 0.28), (1.0, 0.0))},
    "etoffe": {"epais": 0.14, "creux": (0.5, 1.0), "plis": 4, "pas": 4,
               "rangs": ((-0.96, 0.6), (-0.7, 0.86), (-0.3, 0.92), (0.1, 0.8), (0.5, 0.94), (0.8, 0.7), (0.97, 0.45))},
    "caisse": {"epais": 0.12, "parois": 3, "hauteur": (0.45, 1.0), "ancrage": 0.3},
    "femur": ((0.0, 0.55), (0.03, 0.92), (0.07, 1.0), (0.12, 0.84), (0.2, 0.5), (0.5, 0.42), (0.8, 0.5),
              (0.87, 0.82), (0.92, 1.0), (0.97, 0.92), (1.0, 0.55)),
    "pans": 8,
    "butte": {"hauteur": 0.42, "rayon": 0.6, "caps": 12, "cotes": 14, "lobes": ((2, 0.6), (5, 0.4)), "creux": 0.25,
              "anneaux": ((0.0, 1.0), (0.35, 0.8), (0.75, 0.5), (0.95, 0.22), (1.0, 0.0))},
    "semis": {"part": (0.35, 0.95), "mottes": (7, (0.25, 0.5)), "eclats": (5, (0.1, 0.22), 0.55, 0.7)},
}

# Mare de sang : rangs des flaques dans la recette, la grande d'abord. `gouttes` : leur nombre ; leur rayon (part de
# l'apothème de la grande, tiré) ; `part` de la portée sous l'enveloppe, depuis le milieu de la grande, où elles
# tombent (tirée, `modele.semis`).
MARE = {"flaques": (0, 1, 2), "gouttes": {"nombre": 6, "rayon": (0.04, 0.1), "part": (0.9, 1.0)}}

# Cercle runique : rangs des pierres, de la dalle et des deux barres de la croix dans la recette.
# `dalle_tournee` : son profil (`geometrie.tourne`).
# `etoile` : `fleches` : les flèches que porte chaque barre, leur azimut (degrés) depuis celui du grand côté de la
# barre ; `fleche` : contour d'une flèche (part de la demi-longueur de sa barre depuis le milieu de la dalle, écart à
# son axe en demi-largeurs de sa barre) ; `relief` : sa saillie sur la dalle (part de ce dont sa barre la dépasse) ;
# `ancrage` : ce dont elle y entre (part de cette saillie) ; `arete` : chanfrein de sa rive (part de la même) ;
# `moyeu` : rayon (en demi-largeurs de la première barre), saillie (en saillies d'une de ses flèches), profil et
# côtés (`geometrie.tournee`).
# `pierre` : `hauteur` (part de celle de sa boîte) ; `cotes` et `bosse` (`geometrie.bosselee`) ; `anneaux`
# (`modele.tas`) ; `trait` : demi-largeur d'un trait de rune (fraction du demi-côté de la boîte) ; `ancrage` : ce dont
# un trait entre dans la pierre (part de sa hauteur) ; `degre` : ce dont chaque trait d'une rune est plus bas que le
# précédent (part de sa saillie).
# `glyphes` : les runes, une par pierre, reprises à leur tour ; les traits de chacune, d'un point à l'autre (vers le
# dehors du cercle, en travers), en demi-côtés de la boîte de la pierre.
# `trace` : le cercle tracé ; hauteur (part de celle d'une pierre), largeur (en largeurs d'une barre), segments.
CERCLE = {
    "pierres": (0, 1, 2, 3, 4, 5, 6, 7), "dalle": 8, "croix": (9, 10),
    "dalle_tournee": ((0.0, 0.99), (0.6, 0.99), (1.0, 0.95)),
    "etoile": {"fleches": (0, 45, 180, 225),
               "fleche": ((0.1, -1.0), (0.66, -1.0), (0.62, -2.9), (1.0, 0.0), (0.62, 2.9), (0.66, 1.0), (0.1, 1.0)),
               "relief": 0.6, "ancrage": 0.3, "arete": 0.15,
               "moyeu": (2.6, 1.5, ((0.0, 1.0), (0.75, 1.0), (1.0, 0.8)), 12)},
    "pierre": {"hauteur": 0.62, "cotes": 9, "bosse": (0.84, 1.0),
               "anneaux": ((0.0, 0.97), (0.7, 1.0), (1.0, 0.9), (1.0, 0.0)), "trait": 0.06, "ancrage": 0.2,
               "degre": 0.1},
    "glyphes": ((((-0.5, 0.0), (0.5, 0.0)), ((0.5, 0.0), (0.1, 0.38)), ((0.5, 0.0), (0.1, -0.38))),
                (((-0.5, -0.3), (0.5, -0.3)), ((0.5, -0.3), (0.0, 0.3)), ((0.0, 0.3), (-0.5, 0.3))),
                (((-0.5, 0.0), (0.5, 0.0)), ((-0.1, -0.4), (0.3, 0.0)), ((0.3, 0.0), (-0.1, 0.4)),
                 ((-0.5, -0.25), (-0.5, 0.25))),
                (((-0.5, -0.35), (0.5, 0.0)), ((0.5, 0.0), (-0.5, 0.35)), ((0.0, -0.18), (0.0, 0.18)))),
    "trace": (0.4, 0.6, 48),
}
