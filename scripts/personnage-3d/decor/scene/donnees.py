"""Données de la scène (#4335) : un GLB par décor `pupitre-chef`, `tribune`, `balustrade-loge`, `rangee-sieges`,
`rideau-scene`, `escalier-loge`, `lustre-opera`, `portant-costumes` et `decor-flat` de `src/data/props.json`, bâti dans
l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au corpus : proportions
d'adaptation, chacune en fraction de la primitive qui la porte (son rang dans la recette), dans le repère de
`gabarit.py` (x à l'est, le front de la recette vers -y, z vers le haut).

- `pupitre-chef` : une estrade de planches sur sa ceinture ; un pied de fer tourné, un fût à bagues ; une tablette de
  fer inclinée, son rebord au bas de la pente ; une partition ouverte, deux pages posées sur la tablette.
- `tribune` : trois degrés de planches, chacun sur ses joues, sa contremarche sous le nez ; quatre poteaux à chanfreins
  arrêtés, deux sablières, des chevrons et une faîtière ; un dais de toile tendu à deux versants, qui retombe à chaque
  égout en lambrequin plissé et festonné.
- `balustrade-loge` : une lisse basse et une main courante moulurées, de deux pièces chacune ; les quatre balustres de
  laiton de la recette et deux entre voisins, tournés en vase ; une tenture plissée et festonnée pendue sous la main
  courante, devant les balustres.
- `rangee-sieges` : neuf fauteuils, trois par travée de la recette ; une joue par accoudoir de la recette et à chaque
  fauteuil, du sol à sa manchette ; deux ceintures sous les assises ; un montant derrière chaque joue ; un coussin et
  un dossier garni par fauteuil, sur un fond de bois ; la lisse dorée de la recette sur le dossier.
- `rideau-scene` : une tringle de fer à pommes et ses anneaux ; une frise plissée et festonnée pendue à la tringle,
  bordée d'un galon doré qui suit ses plis ; deux pans plissés du sol à la frise, serrés à mi-hauteur vers le dehors
  par une embrasse de deux cordons dorés.
- `escalier-loge` : quatre marches de planches sur leurs joues, contremarches sous le nez ; à gauche, sur la lisse
  basse de la recette, deux pilastres à chanfreins arrêtés coiffés d'une boule de laiton, un limon et une main
  courante rampants, des balustres tournés entre eux.
- `lustre-opera` : une chaîne de fer ; une tige à bagues, une corbeille tournée et un cul-de-lampe ; deux couronnes de
  bras cintrés, huit en bas, quatre en haut, liés entre voisins par une tringle ; au bout de chacun une bobèche, une
  bougie et sa flamme.
- `portant-costumes` : deux patins et deux montants de fer, une entretoise basse, une tringle à pommes ; quatre
  costumes pendus à leur crochet, épaules, taille et bas évasé à godets.
- `decor-flat` : un châssis de décor ; deux montants à chanfreins arrêtés, une traverse haute et une basse, deux
  traverses entre elles et une écharpe à chaque angle, derrière la toile ; la toile peinte, prise dans les montants ;
  devant elle, un pilastre doré, base, fût et chapiteau ; derrière, une équerre : jambe dressée contre le châssis,
  semelle au sol, étai de l'une à l'autre.

Écarts aux recettes. Le rideau serre chaque pan vers le dehors, et son embrasse le ceint là, non à sa rive du dedans
où la recette pose une boîte de laiton. La tribune arrête ses poteaux de devant sous le dais, que ceux de la recette
traversent. L'escalier prolonge le pilastre du haut jusqu'à la lisse basse, et ajoute le limon et les balustres. Le
lustre remplace les traverses droites par des bras cintrés et le cadre carré par des tringles entre bras voisins. La
rangée ajoute une joue et une manchette à chaque fauteuil. Le portant ajoute une entretoise basse. Le châssis ajoute
ses traverses du dedans et ses écharpes, et fait de l'étai plein de la recette une équerre de trois pièces.

Matières : celles des recettes. Le catalogue n'a ni velours ni flamme : étoffes en `toile-rouge`, flammes en `braises`.
Le lustre n'a pas de pendeloque : sa recette n'en porte pas. Le décor peint sur la toile du châssis garde le
`laiton-dore` de sa recette."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
FER = {"fer": ("metal", "fer-noirci")}
LAITON = {"laiton": ("metal2", "laiton-dore")}
TOILE = {"toile": ("vet1", "toile-rouge")}
MATERIAUX = {
    "pupitre-chef": {**BOIS, **FER, "papier": ("corps", "papier")},
    "tribune": {**BOIS, **TOILE},
    "balustrade-loge": {**BOIS, **LAITON, **TOILE},
    "rangee-sieges": {**BOIS, **TOILE, **LAITON},
    "rideau-scene": {**FER, **TOILE, **LAITON},
    "escalier-loge": {**BOIS, **LAITON},
    "lustre-opera": {**LAITON, **FER, "cire": ("corps", "cire"), "flamme": ("accent", "braises")},
    "portant-costumes": {**FER, "rouge": ("vet1", "toile-rouge"), "ardoise": ("vet2", "drap-terne"),
                         "blanc": ("corps", "toile-ecrue"), "brun": ("cuir", "cuir-tanne")},
    "decor-flat": {**BOIS, **LAITON, "peinte": ("corps", "toile-peinte")},
}

BUDGET_TRIANGLES = {"pupitre-chef": 1500, "tribune": 4500, "balustrade-loge": 3200, "rangee-sieges": 4500,
                    "rideau-scene": 5000, "escalier-loge": 3000, "lustre-opera": 5000, "portant-costumes": 3000,
                    "decor-flat": 1200}

ANGLE_LISSE = {"bois": 40, "fer": 40, "laiton": 40, "toile": 60, "papier": 30, "cire": 40, "emet": 40, "rouge": 60,
               "ardoise": 60, "blanc": 60, "brun": 60, "peinte": 30}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein garde ses
arêtes, une pièce tournée et une étoffe sont rondes."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête de bois adoucie, en fraction de l'épaisseur de la pièce."""

BALUSTRE = ((0.0, 0.85), (0.05, 0.85), (0.08, 0.5), (0.14, 0.62), (0.26, 1.0), (0.4, 0.8), (0.72, 0.42), (0.8, 0.42),
            (0.84, 0.75), (0.88, 0.5), (0.95, 0.85), (1.0, 0.85))
"""Le profil d'un balustre en vase, du pied à la tête : (part de la hauteur, part du rayon)."""

COUSSIN = ((0.0, 0.88, 0.5, 0.4), (0.12, 1.0, 1.0, 0.45), (0.88, 1.0, 1.0, 0.45), (1.0, 0.88, 0.5, 0.4))
"""Le profil d'une garniture bombée (`geometrie.profilee`), d'une rive à l'autre."""

# Degrés (`gradins`), en fractions du giron d'un degré : `epaisseur` de ses planches ; leur nombre, l'`ecart` de leur
# partage (`geometrie.partage`), le `jour` entre deux ; contremarche : son `retrait` sous le nez, son épaisseur (part
# de celle des planches) ; `joues`, de tout le giron : leur place (parts de la demi-largeur) ; `ancrage` : part de
# l'épaisseur des planches où entrent joues et contremarche.
DEGRE_DE_TRIBUNE = {"epaisseur": 0.07, "planches": 2, "ecart": 0.1, "jour": 0.006, "retrait": 0.05,
                    "contremarche": 0.6, "joues": (-0.97, -0.33, 0.33, 0.97), "ancrage": 0.3}
DEGRE_D_ESCALIER = {"epaisseur": 0.08, "planches": 1, "ecart": 0.0, "jour": 0.0, "retrait": 0.06,
                    "contremarche": 0.6, "joues": (-0.96, 0.96), "ancrage": 0.3}

# Pupitre : rang de l'estrade, du pied, du fût, de la tablette et de la partition dans la recette.
# `plancher` : épaisseur des planches de l'estrade (part de sa hauteur), leur nombre, écart de leur partage, jour
# entre deux (fraction de la profondeur). `ceinture` : son retrait sous le bord (fraction de la hauteur de l'estrade),
# sa demi-épaisseur (fraction de cette hauteur), part de l'épaisseur des planches où elle entre.
# `pied_tourne` et `fut_tourne` : profils (part de la hauteur, part du demi-côté de la primitive), `cotes` ;
# `ancrage` : part de la hauteur du pied dont le pied entre dans l'estrade et le fût dans le pied.
# `plaque` : la tablette ; son épaisseur et le `jeu` laissé sous la pente pour les pages (parts de la hauteur du
# prisme) ; sa longueur et sa demi-largeur (parts de celles du prisme) ; `rebord` : sa demi-épaisseur (fraction de la
# hauteur du prisme), sa hauteur celle du jeu. `pages` : leur longueur (part de celle de la tablette), leur
# épaisseur (part du jeu), le jour entre les deux (fraction de la largeur de la partition).
PUPITRE = {
    "estrade": 0, "pied": 1, "fut": 2, "tablette": 3, "partition": 4,
    "plancher": {"epaisseur": 0.28, "planches": 5, "ecart": 0.15, "jour": 0.004},
    "ceinture": {"retrait": 0.25, "epaisseur": 0.09, "ancrage": 0.3},
    "pied_tourne": {"profil": ((0.0, 0.92), (0.45, 0.96), (0.5, 0.78), (0.72, 0.7), (0.76, 0.4), (1.0, 0.3)),
                    "cotes": 12},
    "fut_tourne": {"profil": ((0.0, 0.8), (0.04, 1.0), (0.07, 1.0), (0.1, 0.7), (0.48, 0.6), (0.5, 1.0), (0.53, 1.0),
                              (0.55, 0.6), (0.92, 0.7), (0.95, 1.0), (1.0, 1.0)), "cotes": 8},
    "ancrage": 0.5,
    "plaque": {"epaisseur": 0.1, "jeu": 0.06, "longueur": 0.96, "largeur": 0.98, "rebord": 0.03},
    "pages": {"longueur": 0.72, "epaisseur": 0.45, "jour": 0.02},
}

# Tribune : rangs des degrés, du plus bas au plus haut ; `versants` : rang du prisme de chaque versant du dais et de
# ses deux poteaux.
# `dais`, en fractions de la largeur du prisme : `epais`, épaisseur de la toile ; `creux` de son onde sur la pente,
# moindre que l'épaisseur pour que la toile porte partout sur les chevrons ; `pli` de son lambrequin ; `tombee` du
# lambrequin sous l'égout ; `largeur` : sa demi-largeur (part de celle du prisme) ; `pente` : ses rangs de la crête à
# l'égout (parts de la pente) ; `lambrequin` : ses rangs sous l'égout (part de la tombée, part du feston) ; `plis` par
# versant, `pas` : points par pli ; `festons` : leur nombre, et ce dont le lambrequin tombe encore au milieu de chacun
# (`feston`).
# `charpente`, en fractions du rayon d'un poteau : `poteau`, son demi-côté ; `ancrage` : ce dont il entre dans le
# degré et dans la sablière ; `sabliere` : sa demi-largeur et sa hauteur ; `deport` : ce dont elle recule vers la
# crête, pour passer derrière le lambrequin ; `debord` de ses bouts au-delà des poteaux ; `chevrons` : leur place
# (parts de la sablière) ; `chevron` : sa demi-largeur et sa hauteur (fractions de la largeur du prisme) ; `entaille` :
# part de sa hauteur dont il entre dans la sablière ; `faitiere` : sa demi-largeur (fraction de sa demi-longueur) ;
# elle va du dessous des chevrons à la crête, entre les deux versants.
TRIBUNE = {
    "gradins": (0, 1, 2), "versants": ((7, (3, 4)), (8, (5, 6))),
    "dais": {"epais": 0.002, "creux": 0.001, "pli": 0.0024, "tombee": 0.014, "largeur": 0.99,
             "pente": (0.0, 0.5, 1.0), "lambrequin": ((0.2, 0.0), (1.0, 1.0)), "plis": 12, "pas": 4, "festons": 6,
             "feston": 0.012},
    "charpente": {"poteau": 0.6, "ancrage": 0.3, "sabliere": (0.65, 1.3), "deport": 0.5, "debord": 1.2,
                  "chevrons": (0.0, 0.25, 0.5, 0.75, 1.0), "chevron": (0.005, 0.012), "entaille": 0.15,
                  "faitiere": 0.011},
}

# Balustrade : rang de la lisse basse, de la main courante, des balustres et de la tenture dans la recette.
# `moulures` : par lisse, ses pièces superposées (bas et haut en parts de sa hauteur, demi-largeur en part de la
# sienne). `entre` : balustres ajoutés entre deux voisins de la recette ; `ancrage` : part de leur hauteur dont ils
# entrent dans chaque lisse ; `cotes`.
# `drape`, en fractions de l'épaisseur de la tenture de la recette : `recul` de son fil derrière le milieu de la
# primitive, `epais`, épaisseur de l'étoffe ; `prise` : hauteur où elle entre dans la main courante (part de sa
# hauteur) et place de cette prise (part de sa demi-profondeur, vers le front) ; `rangs` : (part de la hauteur de la
# prise aux pointes des festons, dont le milieu tombe au bas de la primitive ; part du chemin de la prise au fil,
# creux des plis, part du feston) ; `plis`, `pas` : points par pli ;
# `festons` : leur nombre, et ce dont la tenture tombe au milieu de chacun (`feston`, part de sa hauteur).
BALUSTRADE = {
    "lisse": 0, "main": 1, "balustres": (2, 3, 4, 5), "tenture": 6,
    "moulures": {"lisse": ((0.0, 0.65, 1.0), (0.5, 1.0, 0.78)), "main": ((0.0, 0.5, 0.74), (0.35, 1.0, 1.0))},
    "entre": 2, "ancrage": 0.02, "cotes": 8,
    "drape": {"recul": 0.75, "epais": 0.4, "prise": (0.2, 0.8),
              "rangs": ((0.0, 0.0, 0.1, 0.0), (0.12, 1.0, 0.45, 0.0), (0.6, 1.0, 0.6, 0.2), (1.0, 1.0, 0.6, 1.0)),
              "plis": 15, "pas": 4, "festons": 5, "feston": 0.3},
}

# Rangée de fauteuils : rang du socle, de l'assise, du dossier, de la lisse dorée et des accoudoirs (d'ouest en est).
# `places` : fauteuils par travée de la recette.
# `joue` : sa demi-épaisseur (fraction de la profondeur d'un accoudoir) ; `profil` : (part de la hauteur du sol à la
# manchette, demi-profondeur en part de celle de l'accoudoir, chanfrein en fraction de la demi-épaisseur) ; `appui` :
# part de la hauteur de la manchette où la joue entre ; son pied reste dans le socle, sa tête sous la manchette.
# `ceinture` : sa place (part de la demi-profondeur du socle), sa demi-largeur (fraction de cette profondeur), sa
# hauteur (part de celle du socle), part de cette hauteur dont elle entre dans les coussins.
# `montant` : son pied (part de la hauteur du socle), son demi-côté (part de la demi-profondeur du dossier).
# `coussin` : jour entre un coussin et l'axe de la joue (fraction de la largeur d'un fauteuil).
# `garni` : épaisseur du dossier garni et du fond de bois (parts de la profondeur du dossier, qui se recouvrent).
RANGEE = {
    "socle": 0, "assise": 1, "dossier": 2, "galon": 3, "accoudoirs": (4, 5, 6, 7),
    "places": 3,
    "joue": {"epaisseur": 0.055, "profil": ((0.0, 0.9, 0.3), (0.06, 0.94, 0.3), (0.58, 0.94, 0.3), (0.68, 0.7, 0.3),
                                            (1.0, 0.62, 0.3)), "appui": 0.3},
    "ceinture": {"place": 0.82, "largeur": 0.05, "hauteur": 0.2, "ancrage": 0.15},
    "montant": {"pied": 0.8, "cote": 0.45},
    "coussin": {"jour": 0.06},
    "garni": {"etoffe": 0.75, "fond": 0.35},
}

# Rideau : rang de la tringle, de la frise, du galon, des pans et des embrasses (dans l'ordre des pans).
# `barre` : la tringle ; `profil` (part de la longueur, part de la demi-hauteur de la primitive), `cotes` ; `anneaux` :
# leur nombre, leur rayon moyen, leur largeur le long de la tringle et leur épaisseur (parts de cette demi-hauteur),
# segments.
# `lambrequin` : la frise ; `largeur` : sa demi-largeur (part de celle de la primitive) ; `epais` : épaisseur de
# l'étoffe (part de la profondeur de la primitive) ; `rangs` : (part de la hauteur de l'axe de la tringle aux pointes
# des festons, dont le milieu tombe au milieu du galon ; part du chemin de l'aplomb de la tringle à celui de la
# frise, creux des plis en part de la demi-profondeur, part du feston) ; `plis`, `pas` : points par pli ; `festons` :
# leur nombre, et ce dont la frise tombe au milieu de chacun (`feston`, part de la hauteur de la primitive).
# `frange` : le galon ; épaisseur (part de la profondeur de la frise).
# `pan` : `epais` (part de sa profondeur) ; `rangs` : (hauteur : 0 au sol, 1 à l'embrasse, 2 en tête ; ouverture : 0
# serré dans l'embrasse, 1 de toute la largeur ; creux des plis en part de la demi-profondeur) ; `serre` : sa
# demi-largeur dans l'embrasse (part du rayon du dedans des cordons), où son milieu se pose sur l'axe de l'embrasse,
# le rayon du dehors des cordons et `RETRAIT` en deçà de la rive du dehors du pan ; `plis`, `pas`.
# `cordon` : l'embrasse ; rayon du dehors (part de la demi-profondeur du pan), rayon du cordon (part de la demi-hauteur
# de la primitive), segments du tour et de la section.
RIDEAU = {
    "tringle": 0, "frise": 1, "galon": 2, "pans": (3, 4), "embrasses": (5, 6),
    "barre": {"profil": ((0.0, 0.5), (0.004, 0.9), (0.012, 0.95), (0.02, 0.55), (0.98, 0.55), (0.988, 0.95),
                         (0.996, 0.9), (1.0, 0.5)), "cotes": 8,
              "anneaux": {"nombre": 10, "rayon": 0.76, "largeur": 0.4, "epaisseur": 0.3, "segments": 8}},
    "lambrequin": {"largeur": 0.995, "epais": 0.09,
                   "rangs": ((0.0, 0.0, 0.1, 0.0), (0.12, 0.6, 0.35, 0.0), (0.35, 1.0, 0.62, 0.0),
                             (1.0, 1.0, 0.7, 1.0)),
                   "plis": 20, "pas": 3, "festons": 5, "feston": 0.3},
    "frange": {"epais": 0.2},
    "pan": {"epais": 0.1, "serre": 0.9,
            "rangs": ((0.0, 0.92, 0.8), (0.35, 0.8, 0.75), (0.8, 0.25, 0.6), (1.0, 0.0, 0.5), (1.2, 0.2, 0.55),
                      (1.6, 0.8, 0.7), (1.9, 1.0, 0.75), (2.0, 1.0, 0.75)), "plis": 7, "pas": 4},
    "cordon": {"rayon": 0.95, "brin": 0.28, "segments": (14, 5)},
}

# Escalier : rangs des marches, de la plus basse à la plus haute ; `rampe` (`geometrie.rampe`) : rang de la lisse
# basse ; `poteaux` : rang du pilastre et de sa boule, celui du bas puis celui du haut ; la boule de laiton.
ESCALIER = {
    "marches": (0, 1, 2, 3),
    "rampe": {"lisse": 4, "poteaux": ((5, 7), (6, 8)), "poteau": {"cote": 0.9, "ancrage": 0.3},
              "pommeau": {"profil": ((0.0, 0.5), (0.08, 0.5), (0.14, 0.72), (0.3, 0.95), (0.5, 1.0), (0.72, 0.9),
                                     (0.9, 0.6), (1.0, 0.25)), "cotes": 10, "ancrage": 0.15},
              "main": 0.1, "rampante": 0.1, "section": (0.75, 0.6),
              "balustres": {"nombre": 7, "rayon": 0.62, "profil": BALUSTRE, "cotes": 6}},
}

# Lustre : rang du cul-de-lampe, de la corbeille, de la tige et de la chaîne ; `etages` : par couronne, rang d'une
# traverse de la recette, qui donne la hauteur du départ des bras, et rangs de ses bougies.
# `tournes` : profil de chacun des trois (part de la hauteur, part de l'apothème de la primitive) ; `cotes`.
# `bras` : `chemin` : (distance à l'axe en part de la portée, hauteur sur le départ en fraction de la portée), puis
# le pied de la bougie ; `pas` : points par tronçon ; `rayons` au départ et au bout (fractions du rayon de la tige) ;
# `cotes` ; `lien` : rang du point du chemin où une tringle lie deux bras voisins ; `tringle` : son rayon (fraction du
# rayon de la tige).
# `bougie` (`geometrie.bougie`), en fractions du demi-côté de sa boîte, sur le bas de la boîte au bout du bras :
# `bobeche` : bobèche et binet tournés, (hauteur sur ce bas, rayon), la cire partant d'un demi-côté sur ce bas ;
# `cire` : son rayon ; `flamme` : sa hauteur, puis (part de cette hauteur, rayon) ; segments de la bobèche et de la
# cire, de la flamme. `meche` : part de la hauteur de la boîte où s'arrête la cire.
# `maillons` : leur nombre, serrés pour s'engager l'un dans l'autre ; rayon du dehors et rayon du fer (parts du
# demi-côté de la primitive) ; segments du tour et de la section.
LUSTRE = {
    "culot": 0, "corbeille": 1, "tige": 2, "chaine": 23,
    "etages": ({"traverse": 3, "bougies": (5, 6, 7, 8, 13, 14, 15, 16)}, {"traverse": 17, "bougies": (19, 20, 21, 22)}),
    "tournes": {
        "culot": ((0.0, 0.25), (0.1, 0.6), (0.28, 0.98), (0.45, 0.7), (0.65, 0.4), (0.85, 0.55), (1.0, 0.95)),
        "corbeille": ((0.0, 0.26), (0.12, 0.55), (0.45, 0.92), (0.7, 1.0), (0.8, 0.9), (0.9, 0.5), (1.0, 0.2)),
        "tige": ((0.0, 1.0), (0.03, 1.0), (0.05, 0.6), (0.06, 0.6), (0.075, 1.0), (0.1, 1.0), (0.12, 0.5),
                 (0.52, 0.42), (0.54, 0.95), (0.6, 0.95), (0.62, 0.42), (0.94, 0.36), (0.96, 0.7), (1.0, 0.7))},
    "cotes": 10,
    "bras": {"chemin": ((0.0, 0.0), (0.3, -0.1), (0.62, -0.09), (0.9, -0.035)), "pas": 3, "rayons": (0.32, 0.2),
             "cotes": 5, "lien": 2, "tringle": 0.16},
    "bougie": {"bobeche": ((-0.5, 0.0), (-0.5, 0.25), (-0.15, 0.4), (0.25, 0.95), (0.4, 0.95), (0.4, 0.68),
                           (1.25, 0.68), (1.25, 0.0)),
               "cire": 0.55,
               "flamme": (1.4, ((0.0, 0.0), (0.0, 0.2), (0.3, 0.42), (0.6, 0.3), (1.0, 0.0))),
               "segments": (8, 5)},
    "meche": 0.72,
    "maillons": {"nombre": 9, "dehors": 0.96, "fer": 0.24, "segments": (8, 4)},
}

# Portant : rangs des patins et des montants (d'ouest en est), de la tringle ; `costumes` : rang et matériau de chacun.
# `patin` : profil (`geometrie.profilee`) le long de sa longueur. `fut` : profil du montant (part de la hauteur, part
# du rayon), `cotes`. `barre` : profil de la tringle (part de la longueur, part de la demi-hauteur de la primitive).
# `entretoise` : sa hauteur (part de celle d'un montant), son rayon (part de celui d'un montant).
# `crochet` : un anneau dont l'axe du fer suit le dehors de la tringle, et sa tige ; rayon de son fer (part de la
# demi-hauteur de la tringle de la recette), segments du tour et de la section, part de la hauteur du costume où sa
# tige descend.
# `coupe` : un costume, du col au bas : (part de la hauteur, demi-largeur et demi-épaisseur en parts de celles de sa
# boîte, part du godet) ; `godet` : creux des godets au bas (fraction du rayon, tirée par costume) ; `plis` autour,
# `pas` : points par pli.
PORTANT = {
    "pieds": (0, 1), "montants": (2, 3), "tringle": 4,
    "costumes": ((5, "rouge"), (6, "ardoise"), (7, "blanc"), (8, "brun")),
    "patin": ((0.0, 0.55, 0.6, 0.3), (0.06, 0.8, 1.0, 0.3), (0.42, 1.0, 1.0, 0.3), (0.58, 1.0, 1.0, 0.3),
              (0.94, 0.8, 1.0, 0.3), (1.0, 0.55, 0.6, 0.3)),
    "fut": {"profil": ((0.0, 1.0), (0.03, 1.0), (0.04, 0.7), (0.97, 0.7), (0.98, 1.0), (1.0, 1.0)), "cotes": 8},
    "barre": ((0.0, 0.9), (0.02, 0.9), (0.03, 0.6), (0.97, 0.6), (0.98, 0.9), (1.0, 0.9)),
    "entretoise": (0.12, 0.6),
    "crochet": {"fer": 0.18, "segments": (8, 4), "col": 0.03},
    "coupe": ((0.0, 0.14, 0.3, 0.0), (0.03, 0.5, 0.45, 0.0), (0.08, 0.98, 0.6, 0.0), (0.2, 0.88, 0.7, 0.1),
              (0.4, 0.62, 0.62, 0.3), (0.7, 0.86, 0.85, 0.8), (1.0, 1.0, 1.0, 1.0)),
    "godet": (0.25, 0.4), "plis": 7, "pas": 4,
}

# Châssis : rang de la toile peinte, des montants, de la traverse haute, de la traverse basse, du motif doré et de
# l'étai dans la recette.
# `traverse` : demi-profondeur de la traverse haute et de la basse (part de celle de leur boîte), en retrait des faces
# des montants.
# `etoffe` : épaisseur de la toile (part de la profondeur de sa boîte), plaquée au front de cette boîte ; `feuillure` :
# ce dont elle entre dans chaque montant (part de sa largeur).
# `dedans` : les pièces derrière la toile, du dos des traverses à la toile ; `section` : leur demi-hauteur (part de la
# largeur d'un montant) ; `mediane` : hauteur de la seconde traverse du dedans (part de la hauteur de la tête de
# l'équerre, où passe la première, à la traverse haute) ; `echarpe` : côté de l'angle que coupe une écharpe (part de la
# largeur de la toile).
# `pilastre` : profil du motif doré (`geometrie.profilee`), du bas en haut, de la toile au front de sa boîte.
# `equerre`, en parts de la demi-largeur du prisme : `largeur` de la jambe et de la semelle, `etai` : celle de l'étai,
# `epaisseur` : demi-épaisseur des trois pièces.
CHASSIS = {
    "toile": 0, "montants": (1, 2), "haute": 3, "basse": 4, "motif": 5, "etai": 6,
    "traverse": 0.9, "etoffe": 0.3, "feuillure": 0.25,
    "dedans": {"section": 0.45, "mediane": 0.5, "echarpe": 0.22},
    "pilastre": ((0.0, 1.0, 1.0, 0.1), (0.05, 1.0, 1.0, 0.1), (0.06, 0.8, 0.9, 0.1), (0.09, 0.8, 0.9, 0.1),
                 (0.1, 0.62, 0.75, 0.1), (0.88, 0.55, 0.75, 0.1), (0.89, 0.8, 0.9, 0.1), (0.93, 0.8, 0.9, 0.1),
                 (0.94, 1.0, 1.0, 0.1), (1.0, 1.0, 1.0, 0.1)),
    "equerre": {"largeur": 0.9, "etai": 0.6, "epaisseur": 0.4},
}
