"""Données des objets d'intérieur et des petits objets (#4335) : un GLB par décor `miroir`, `mannequin`,
`mannequin-couturier`, `plante-pot`, `bourse`, `cle`, `lettre` et `tas-or` de `src/data/props.json`, bâti dans
l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au corpus : proportions
d'adaptation, chacune en fraction de la primitive de la recette qui la porte (`modele.py` lit ses cotes par
`gabarit.py`) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y. Chaque table nomme d'abord le rang,
dans la recette, des primitives qu'elle lit.

- `miroir` : une psyché ; deux patins, deux montants à chanfreins arrêtés, une entretoise tournée ; entre les
  montants, un cadre de deux montants et deux traverses, une moulure autour de la glace, la glace devant son dos de
  bois, et un pivot tourné de chaque côté.
- `mannequin` : un socle tourné, un poteau, un bras de bois en travers ; autour du poteau, un sac de toile bourré,
  froncé à la taille et au col par deux liens de corde, cousu devant, la paille en botte sous la taille ; pour tête,
  un pot de laiton cerclé de deux fers que joint un nasal.
- `mannequin-couturier` : un piètement en croix à mi-bois, un fût tourné, un buste de toile à basque godronnée,
  taille, poitrine et épaules, ses piqûres en relief ; un col de bois et son bouton de laiton.
- `plante-pot` : un pot tourné sous son bord, la terre en butte dedans, un tronc, et des feuilles lancéolées en
  couronnes, de la plus couchée à la plus dressée.
- `bourse` : un sac de cuir froncé, sa panse affaissée, son col serré d'un cordon dont deux brins retombent, sa gueule
  en creux ; trois pièces empilées à chaque place que donne la recette.
- `cle` : couchée ; un anneau, une tige tournée à bagues, un panneton découpé de ses gardes.
- `lettre` : pliée à quatre rabats que ferme un sceau godronné ; à côté, un feuillet gondolé.
- `tas-or` : un tas bosselé semé de pièces, des piles à son pied, un calice creux garni de pièces, un coffret de
  planches sous un couvercle de fer, à pentures cloutées et serrure de laiton.

Matières : celles des recettes, sauf celles-ci. Le catalogue `prop` n'a ni verre, ni papier, ni cire, ni terre cuite
(#4423) : la glace du miroir garde `albatre`, la lettre `toile-ecrue` et son sceau `toile-rouge`, le pot `bois-chene`,
que nomment les recettes. Le sac du mannequin, que sa recette ne porte pas, prend `toile-ecrue`, sa botte `paille` et
ses liens `corde` ; la terre de la plante, que sa recette ne porte pas, prend `terre-battue`. Le coffret du trésor,
dont la recette est de `bois-chene` et de `fer-noirci`, prend pour sa serrure le `laiton-dore` du tas.

Écarts aux recettes : le cadre du miroir tient entre ses montants, plus étroit que la boîte de la recette, qui les
traverse ; le feuillet de la lettre s'arrête sous le bord de la lettre, que sa boîte traverse ; le panneton de la clé
s'arrête avant le bout de la tige, que sa boîte dépasse."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
FER = {"fer": ("metal", "fer-noirci")}
LAITON = {"laiton": ("metal2", "laiton-dore")}
CORDE = {"corde": ("accent", "corde")}
MATERIAUX = {
    "miroir": {**BOIS, "glace": ("corps", "albatre")},
    "mannequin": {**BOIS, "toile": ("vet1", "toile-ecrue"), "paille": ("vegetal", "paille"), **CORDE, **LAITON, **FER},
    "mannequin-couturier": {**BOIS, "toile": ("vet1", "toile-rouge"), **LAITON},
    "plante-pot": {**BOIS, "terre": ("corps", "terre-battue"), "feuillage": ("vegetal", "feuillage")},
    "bourse": {"cuir": ("cuir", "cuir-tanne"), **CORDE, **LAITON},
    "cle": FER,
    "lettre": {"papier": ("corps", "toile-ecrue"), "cire": ("accent", "toile-rouge")},
    "tas-or": {**LAITON, **BOIS, **FER},
}

BUDGET_TRIANGLES = {"miroir": 1700, "mannequin": 2300, "mannequin-couturier": 1700, "plante-pot": 3300,
                    "bourse": 1400, "cle": 600, "lettre": 600, "tas-or": 6200}

ANGLE_LISSE = {"bois": 40, "fer": 40, "laiton": 40, "glace": 30, "toile": 60, "paille": 30, "corde": 40, "terre": 40,
               "feuillage": 30, "cuir": 60, "papier": 30, "cire": 40}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un chanfrein, un brin de
paille et le limbe d'une feuille gardent leurs arêtes, une pièce tournée et une étoffe sont rondes."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

CLOU = (1.2, 0.35)
"""Tête d'un clou de penture : demi-côté et saillie, en fractions du jeu laissé entre le coffret et sa boîte."""

# Pièce de monnaie (`pile`) : `profil` tourné (part de l'épaisseur, part du rayon), `cotes` ; `epaisseur` (fraction du
# rayon) ; `assise` : part de son épaisseur dont une pièce entre dans celle qui la porte ; `ecart` : ce dont chacune se
# décale au plus (fraction du rayon).
PIECE = {"profil": ((0.0, 1.0), (0.7, 1.0), (1.0, 0.8)), "cotes": 8, "epaisseur": 0.16, "assise": 0.1, "ecart": 0.15}

# Miroir.
# `patin` : profil d'un patin (`geometrie.profilee`), d'un bout à l'autre, ses bouts amincis et relevés.
# `montant` : demi-côté d'un montant (part de celui de sa boîte), plus mince qu'elle pour que le pivot dépasse.
# `balustre` : profil de l'entretoise tournée, de l'axe d'un montant à l'autre (part de la longueur, part de la
# demi-épaisseur de sa boîte), et côtés de l'entretoise et des pivots.
# `jeu` : jour entre le cadre et un montant (fraction de la largeur de la boîte du cadre).
# `feuillure` : ce dont le cadre recouvre la glace (fraction de la largeur de la glace).
# `traverse` : demi-épaisseur d'une traverse du cadre (part de celle de ses montants), en retrait d'eux.
# `arete` : chanfrein des pièces du cadre, de la glace et du dos (fraction de l'épaisseur du cadre).
# `moulure` : largeur de la moulure autour de la glace (fraction de la largeur de la glace) ; `quart` : son chanfrein
# (fraction de sa largeur). Elle va du milieu du cadre au devant de la glace de la recette.
# `tain` : devant de la glace (part de la saillie de la moulure) ; `dos` : épaisseur du dos de bois (part de la
# demi-épaisseur du cadre).
# `pivot` : `rayon` (fraction du demi-côté du montant) ; `portee` : son bout (part de la portée dans l'enveloppe, de
# l'axe du montant vers le dehors) ; `profil` : son bouton au bout.
MIROIR = {
    "patins": (0, 1), "montants": (2, 3), "entretoise": 4, "cadre": 5, "glace": 6,
    "patin": ((0.0, 0.7, 0.45, 0.2), (0.05, 0.85, 0.7, 0.25), (0.3, 1.0, 1.0, 0.25), (0.7, 1.0, 1.0, 0.25),
              (0.95, 0.85, 0.7, 0.25), (1.0, 0.7, 0.45, 0.2)),
    "montant": 0.86,
    "balustre": {"profil": ((0.0, 0.5), (0.08, 0.5), (0.1, 0.95), (0.13, 0.95), (0.15, 0.55), (0.3, 0.78),
                            (0.47, 0.55), (0.48, 1.0), (0.52, 1.0), (0.53, 0.55), (0.7, 0.78), (0.85, 0.55),
                            (0.87, 0.95), (0.9, 0.95), (0.92, 0.5), (1.0, 0.5)), "cotes": 8},
    "jeu": 0.008,
    "feuillure": 0.02,
    "traverse": 0.85,
    "arete": 0.1,
    "moulure": 0.035, "quart": 0.3,
    "tain": 0.5, "dos": 0.8,
    "pivot": {"rayon": 0.4, "portee": 0.97, "profil": ((0.0, 0.6), (0.92, 0.6), (0.94, 1.0), (0.98, 1.0), (1.0, 0.7))},
}

# Mannequin d'entraînement.
# `tournes` : profils du socle et du casque, tournés dans leur cylindre (part de la hauteur, part de l'apothème) ;
# `cotes` de l'un, de l'autre et des cercles du casque.
# `ancrage` : ce dont le poteau entre dans le socle et dans le casque (part de la hauteur de chacun).
# `cote` : demi-côté du poteau (part de celui de sa boîte), mince sous le sac.
# `bras_section` : demi-largeur et demi-hauteur du bras (parts de celles de sa boîte) ; `main` : son profil, ses bouts
# amincis.
# `sac`, `botte` : stations d'une étoffe autour du poteau (`geometrie.froncee`) : part de la hauteur du socle au
# casque, demi-profondeur (part de la portée dans l'enveloppe, de l'axe vers +y), creux de ses plis ; `carrure` : sa
# largeur (en profondeurs) ; `plis` et `pas` du sac puis de la botte.
# `liens` : rangs des stations du sac que serre une corde ; `corde` : rayon de la corde (fraction de la demi-largeur
# du sac à sa station) ; `tore` : segments de son tour et de sa section, celle-ci aussi celle de la couture.
# `couture` : rayon de la couture du devant (fraction du demi-côté de la boîte du poteau).
# `nasal` : demi-largeur du nasal (fraction de l'apothème du casque) et son chanfrein (fraction de son épaisseur).
MANNEQUIN = {
    "socle": 0, "poteau": 1, "bras": 2, "tete": 3, "cercles": (4, 5),
    "tournes": {"socle": ((0.0, 0.94), (0.35, 1.0), (0.55, 1.0), (0.7, 0.86), (1.0, 0.8)),
                "casque": ((0.0, 0.86), (0.06, 1.0), (0.8, 1.0), (0.9, 0.82), (0.97, 0.45), (1.0, 0.15))},
    "cotes": 16,
    "ancrage": 0.5,
    "cote": 0.5,
    "bras_section": (0.5, 0.55),
    "main": ((0.0, 0.7, 0.7, 0.2), (0.03, 1.0, 1.0, 0.25), (0.97, 1.0, 1.0, 0.25), (1.0, 0.7, 0.7, 0.2)),
    "sac": ((0.36, 0.3, 0.3), (0.4, 0.34, 0.3), (0.5, 0.52, 0.15), (0.65, 0.64, 0.08), (0.8, 0.85, 0.06),
            (0.9, 0.88, 0.1), (0.96, 0.6, 0.3), (1.0, 0.5, 0.3)),
    "carrure": 1.4,
    "botte": ((0.25, 0.5, 0.75), (0.31, 0.42, 0.6), (0.39, 0.3, 0.4)),
    "plis": (9, 13), "pas": (3, 2),
    "liens": (1, 6), "corde": 0.07, "tore": (16, 6),
    "couture": 0.05,
    "nasal": 0.14,
}

# Mannequin de couturier.
# `patin` : profil d'une branche du piètement (`geometrie.profilee`), ses bouts amincis.
# `tournes` : les pièces tournées dans leur cylindre (`geometrie.tourne`) : rang, profil (part de la hauteur, part de
# l'apothème), ancrage sous le pied et au-dessus de la tête (parts de sa hauteur), matériau ; `cotes`.
# `basque` : la station du bas du buste, au pied des hanches : demi-largeur (part de la demi-distance entre les
# égouts des deux basques), demi-profondeur (part de celle des hanches), creux de ses godets.
# `coupe` : les stations du buste (`geometrie.froncee`) : rang de la boîte, part de sa hauteur, parts de sa
# demi-largeur et de sa demi-profondeur ; `plis`, `pas`.
# `piqures` : azimuts des piqûres ; `piqure` : leur rayon (fraction de la profondeur des hanches), leurs côtés.
COUTURIER = {
    "pieds": (0, 1), "hanches": 3, "basques": (4, 5),
    "patin": ((0.0, 0.6, 0.5, 0.25), (0.06, 0.8, 0.8, 0.25), (0.38, 1.0, 1.0, 0.25), (0.62, 1.0, 1.0, 0.25),
              (0.94, 0.8, 0.8, 0.25), (1.0, 0.6, 0.5, 0.25)),
    "tournes": (
        (2, ((0.0, 1.0), (0.05, 1.0), (0.07, 0.7), (0.3, 0.6), (0.33, 1.0), (0.37, 1.0), (0.4, 0.6), (0.9, 0.7),
             (0.93, 1.0), (1.0, 1.0)), (0.0, 0.04), "bois"),
        (10, ((0.0, 0.7), (0.2, 0.7), (0.3, 0.55), (0.75, 0.6), (0.85, 1.0), (1.0, 1.0)), (0.3, 0.0), "bois"),
        (11, ((0.0, 0.5), (0.2, 0.5), (0.35, 0.9), (0.6, 1.0), (0.85, 0.75), (1.0, 0.3)), (0.5, 0.0), "laiton")),
    "cotes": 8,
    "basque": (0.93, 0.92, 0.25),
    "coupe": ((3, 1.0, 0.92, 0.92), (6, 0.5, 0.92, 0.92), (7, 0.5, 0.94, 0.94), (8, 0.3, 0.95, 0.95),
              (8, 0.8, 0.96, 0.9), (9, 0.4, 0.95, 0.94), (9, 0.85, 0.8, 0.85), (9, 1.0, 0.3, 0.5)),
    "plis": 10, "pas": 3,
    "piqures": (-90, -55, -125, 90, 0, 180), "piqure": (0.028, 4),
}

# Plante en pot.
# `pot_tourne` : profil du pot dans son cylindre (part de la hauteur, part de l'apothème) ; `cotes` du pot, de son
# bord et de la terre.
# `levre` : rayon du dedans du bord (part de l'apothème du pot).
# `terre` : son rayon (part de l'apothème du pot), plus grand que le dedans du bord où elle entre ; `butte` : ce dont
# elle monte au-dessus du bord (part de la hauteur du bord) ; `motte` : son profil.
# `fut` : profil du tronc, ses côtés, ce dont il entre dans la terre (part de sa hauteur).
# `attache` : départ des feuilles sous la cime du tronc (part de sa hauteur).
# `couronnes` : nombre de feuilles, azimut de la première, élévation (degrés), longueur (part de la portée dans
# l'enveloppe, du départ dans le sens de la feuille), demi-largeur (fraction de la longueur) ; `jeu` : écarts tirés de
# l'azimut et de l'élévation (degrés).
# `nervure` : le fil d'une feuille (part de la longueur, flèche au-dessus de sa corde en fraction de la longueur) ;
# `pas` : points par tronçon ; `limbe` : sa demi-largeur le long du fil (part du fil, part de la demi-largeur) ;
# `epais` : sa demi-épaisseur (fraction de l'apothème du tronc) ; `biseau` : chanfrein de ses rives (part de `epais`).
PLANTE = {
    "pot": 0, "bord": 1, "tronc": 2,
    "pot_tourne": ((0.0, 0.7), (0.03, 0.76), (0.1, 0.78), (0.5, 0.9), (0.9, 1.0), (1.0, 1.0)), "cotes": 16,
    "levre": 0.86,
    "terre": 0.9, "butte": 0.4, "motte": ((0.0, 1.0), (0.55, 1.0), (0.8, 0.75), (1.0, 0.25)),
    "fut": {"profil": ((0.0, 1.0), (0.15, 0.8), (0.5, 0.7), (0.9, 0.72), (1.0, 0.9)), "cotes": 6, "ancrage": 0.1},
    "attache": 0.05,
    "couronnes": ((4, 0, 42, 0.9, 0.11), (4, 45, 30, 0.9, 0.14), (8, 22.5, 58, 0.85, 0.12), (5, 10, 78, 0.85, 0.11)),
    "jeu": (6, 4),
    "nervure": ((0.0, 0.0), (0.3, 0.05), (0.65, 0.04), (1.0, -0.1)), "pas": 2,
    "limbe": ((0.0, 0.25), (0.25, 1.0), (0.6, 0.85), (1.0, 0.1)), "epais": 0.07, "biseau": 0.6,
}

# Bourse.
# `sac` : stations du sac (`geometrie.froncee`), du pied de la panse à la tête du col : son cylindre, part de sa
# hauteur, rayon (part de son apothème), creux de ses plis ; `levre` : ses stations dans la boîte du lien, au-dessus :
# part de sa hauteur, rayon (part de son demi-côté), creux ; `plis`, `pas`, celui-ci aussi les points par tronçon d'un
# brin ; `gueule` : hauteur de la pointe qui creuse sa gueule (part de la hauteur du lien).
# `noeud` : rang, parmi celles du sac, de la station que serre le cordon ; `cordon` : son rayon (fraction de
# l'apothème de la panse) ;
# `tore` : segments de son tour et de sa section.
# `brins` : azimuts des deux brins qui retombent du cordon ; `chute` : rang de la station où ils s'arrêtent ;
# `effile` : rayons d'un brin au cordon et à son bout (parts du rayon du cordon) ; `brin_cotes`.
# `piece` : rayon d'une pièce (part du demi-côté de sa boîte) ; `nombre` de pièces par boîte.
BOURSE = {
    "panse": 0, "col": 1, "lien": 2, "pieces": (3, 4),
    "sac": (("panse", 0.0, 0.6, 0.0), ("panse", 0.1, 0.9, 0.04), ("panse", 0.4, 1.0, 0.08), ("panse", 0.8, 0.95, 0.12),
            ("col", 0.27, 1.0, 0.25), ("col", 0.73, 0.63, 0.45), ("col", 1.0, 0.38, 0.55)),
    "levre": ((0.3, 0.82, 0.55), (0.65, 1.0, 0.5), (1.0, 0.93, 0.45)),
    "plis": 8, "pas": 3, "gueule": 0.5,
    "noeud": 6, "cordon": 0.05, "tore": (12, 6),
    "brins": (-70, -118), "chute": 3, "effile": (0.8, 1.3), "brin_cotes": 5,
    "piece": 0.8, "nombre": 3,
}

# Clé.
# `fer` : rayon du fer de l'anneau (part de la demi-hauteur de sa boîte) ; `dehors` : rayon du dehors de l'anneau
# (part du demi-côté de sa boîte) ; `tore` : segments de son tour et de sa section, celle-ci multiple de quatre pour
# qu'un sommet touche le sol.
# `tournee` : profil de la tige, de l'anneau à son bout (part de la longueur, part du rayon du fer), et ses côtés.
# `bout` : ce dont la tige dépasse le panneton (fraction de la longueur de sa boîte).
# `dents` : le contour du panneton (part de sa longueur depuis l'anneau, part de la portée dans l'enveloppe depuis
# l'axe de la tige) ; `lame` : sa demi-épaisseur ; `arete` : son chanfrein (parts du rayon du fer).
CLE = {
    "tige": 0, "anneau": 1, "panneton": 2,
    "fer": 0.8, "dehors": 0.97, "tore": (16, 8),
    "tournee": {"profil": ((0.0, 0.6), (0.05, 0.6), (0.07, 1.0), (0.11, 1.0), (0.13, 0.62), (0.16, 0.62), (0.18, 0.85),
                           (0.2, 0.62), (0.93, 0.62), (0.95, 0.85), (0.98, 0.75), (1.0, 0.4)), "cotes": 8},
    "bout": 0.05,
    "dents": ((0.0, 0.0), (1.0, 0.0), (1.0, 0.96), (0.7, 0.96), (0.7, 0.6), (0.48, 0.6), (0.48, 0.96), (0.0, 0.96),
              (0.0, 0.72), (0.22, 0.72), (0.22, 0.45), (0.0, 0.45)),
    "lame": 0.8, "arete": 0.15,
}

# Lettre.
# `marge` : demi-côtés de la lettre et du feuillet (parts de ceux de leur boîte).
# `corps` : épaisseur de la lettre pliée, sous ses rabats (part de la hauteur de sa boîte) ; `arete` : chanfrein de la
# lettre et de ses rabats (fraction de cette hauteur).
# `rabats` : dessus de chacun des quatre rabats, dans l'ordre des côtés (+y, -x, -y, +x), le plus haut plié le dernier
# (parts de la hauteur de la boîte) ; `charniere` : leur dessous (part de l'épaisseur du corps).
# `cire` : stations du sceau (`geometrie.froncee`), du dessus du corps au dessus de sa boîte : part de cette hauteur,
# rayon (part du demi-côté de sa boîte), creux de ses godrons ; `plis`, `pas`.
# `feuille`, en fractions de la hauteur de la boîte du feuillet : `epais`, `creux` de son onde ; `plis`, `pas`
# (`geometrie.onde`) ; `glisse` : ce dont le feuillet entre sous la lettre (fraction de la largeur de la lettre).
LETTRE = {
    "pli": 0, "sceau": 1, "feuillet": 2,
    "marge": 0.98,
    "corps": 0.55, "arete": 0.08,
    "rabats": (0.82, 0.66, 0.74, 0.66), "charniere": 0.5,
    "cire": ((0.0, 0.92, 0.3), (0.42, 0.97, 0.3), (0.6, 0.88, 0.22), (0.68, 0.6, 0.0), (0.9, 0.55, 0.0),
             (0.96, 0.4, 0.0)),
    "plis": 7, "pas": 3,
    "feuille": {"epais": 0.2, "creux": 0.25, "plis": 2, "pas": 6},
    "glisse": 0.01,
}

# Trésor.
# `talus` : les anneaux du tas, du sol à sa cime : rang du disque, part de sa hauteur, rayon (part de son apothème) ;
# `cotes` du tas et du calice ; `bosse` : part du rayon tirée pour chaque sommet d'un anneau.
# `piece` : rayon d'une pièce (part de l'apothème du disque des pièces éparses).
# `semis` : nombre de pièces semées sur le tas, plus nombreuses où son tour est plus grand ; `depuis` : rang du
# premier anneau qui en porte, au-dessus du sol ;
# `enfonce` : ce dont chacune entre dans le tas (part de son épaisseur) ; `penche` : écart tiré de sa normale.
# `piles` : rang de la primitive visée, part du chemin du centre du tas à son centre, nombre de pièces.
# `coupe` : profil du calice creux (part de la hauteur de son cylindre, part de son apothème), du pied au fond de la
# coupe ; `garni` : nombre de pièces empilées sur ce fond.
# `coffre` : `corps` : demi-côtés du coffret (parts de ceux de sa boîte), en retrait pour ses ferrures ; `planches`
# couchées ; `arete` : chanfrein d'une planche et du couvercle (fraction de sa hauteur) ; `fer` : épaisseur d'une
# penture (part du jeu entre le coffret et sa boîte) ; `pentures` : leur place (fractions de la longueur du coffret) ;
# `bande` : leur demi-largeur (fraction de cette longueur) ; `clous` : leurs hauteurs (parts de celle du coffret) ;
# `serrure` : sa demi-largeur (fraction de la longueur), son pied et sa tête (parts de la hauteur).
TRESOR = {
    "tas": 0, "calice": 3, "caisse": 4, "couvercle": 5, "eparses": 6,
    "talus": ((0, 0.0, 0.96), (0, 0.45, 0.93), (0, 1.0, 0.8), (1, 0.6, 0.86), (1, 1.0, 0.72), (2, 0.5, 0.85),
              (2, 0.8, 0.3)),
    "cotes": 16, "bosse": (0.84, 1.0),
    "piece": 0.4,
    "semis": 120, "depuis": 1, "enfonce": 0.3, "penche": 0.35,
    "piles": ((3, 0.77, 8), (6, 1.0, 4), (6, 0.86, 2), (6, 0.74, 7)),
    "coupe": ((0.0, 0.0), (0.0, 0.62), (0.04, 0.66), (0.07, 0.3), (0.3, 0.15), (0.36, 0.3), (0.42, 0.16), (0.52, 0.3),
              (0.62, 0.75), (0.8, 0.95), (0.99, 1.0), (0.99, 0.9), (0.7, 0.6), (0.66, 0.0)),
    "garni": 5,
    "coffre": {"corps": 0.94, "planches": 3, "arete": 0.1, "fer": 0.6, "pentures": (-0.3, 0.3), "bande": 0.05,
               "clous": (0.15, 0.5, 0.85), "serrure": (0.07, 0.62, 0.95)},
}
