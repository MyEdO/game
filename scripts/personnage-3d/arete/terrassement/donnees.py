"""Données du terrassement (#4471) : le GLB `arete--terrassement`, les pièces que l'hôte pose sur les arêtes des
apparences dont `kit` vaut `terrassement` dans `src/data/structureAppearance.json` : un contrefort de terre (AA
p.120). Sa forme se lit dans ce fichier, aux seuls champs de forme de `TALUS_DE_REFERENCE` (`detail.courses` : `hM`,
`edgeWobble`). Aucune couleur ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte teint de la
couleur de l'apparence posée.

Le talus : de la terre damée par lits de mottes, d'un fruit marqué des deux faces, plus fort au pied, bombée à chaque
lit, couronnée d'un lit arrondi, son pied tenu de chaque côté par un clayonnage de pieux et de perches tressées. La
porte coupe le talus à hauteur d'homme : un passage planchéié entre deux joues de planches, sous un linteau de rondins
qui porte la terre des lits du dessus, que ferme une barrière de planches, qui tourne sur son gond vers le dedans. Un
talus ne porte pas de fenêtre : ses deux pièces sont le talus plein. La brèche l'ouvre : ses lits restent à plat,
tranchés par la trouée, plus large à chaque lit vers la crête ; la terre tombée fait un tas au pied de chaque face, sur
le lit qui reste, le clayonnage rompu.

Matières : la terre prend `terre-battue`, le clayonnage `bois-mort`, les joues, le linteau, le plancher et la barrière
`bois-chene`, les ferrures `fer-noirci`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import apparence, hauteur

KIT = "terrassement"
TALUS_DE_REFERENCE = "terrassement"
"""L'apparence dont le modèle lit la forme de ses lits et sa hauteur."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, TALUS_DE_REFERENCE))
"""La hauteur (m) des arêtes du talus."""
EPAISSEUR = 0.8
"""L'épaisseur (m) du talus à son pied, d'un clayonnage à l'autre."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "terre": ("corps", "terre-battue"),
    "clayonnage": ("bois", "bois-mort"),
    "boisage": ("bois", "bois-chene"),
    "menuiserie": ("accent", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"mur": 2400, "porte-fermee": 2400, "porte-ouverte": 2400,
                    "fenetre": 2400, "fenetre-close": 2400, "breche": 2400}

ANGLE_LISSE = 40
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : la terre s'y fond, le bois garde ses
arêtes."""

# Talus : `lit` : la hauteur (m) d'un lit de mottes et `ondulation` : ce dont sa face s'écarte (m, tiré jusqu'à cette
# borne), lus de l'apparence ; `profil` : la demi-épaisseur (m) du talus à chaque hauteur (fraction de la sienne) ;
# `bombe` : ce dont un lit se bombe à mi-hauteur (m) ; `pas` : l'écart (m) de deux sections le long de l'arête ;
# `epaule` : la demi-épaisseur de l'épaule du lit de couronnement (fraction de celle du talus) et sa hauteur
# (fraction de celle du lit).
TALUS = {
    **{cote: apparence(KIT, TALUS_DE_REFERENCE)["detail"]["courses"][champ]
       for cote, champ in (("lit", "hM"), ("ondulation", "edgeWobble"))},
    "profil": ((0.0, 0.3), (0.19, 0.23), (0.5, 0.13), (1.0, 0.05)),
    "bombe": 0.035, "pas": 0.25, "epaule": (0.7, 0.7),
}

# Clayonnage au pied de chaque face : `pieux` par longueur d'arête, au pas régulier d'une arête à sa voisine, leur
# `section` (m) et leur `hauteur` (m) ; `perches` : la hauteur (m) de l'axe de chacune ; `perche` : leur section
# (largeur, hauteur, m) ; `droit` : la longueur (m) du bout droit d'une perche à chaque bout de son tronçon, où elle
# rejoint sa voisine.
CLAYONNAGE = {
    "pieux": 4, "section": 0.06, "hauteur": 0.72,
    "perches": (0.12, 0.27, 0.42, 0.57), "perche": (0.025, 0.05), "droit": 0.1,
}

# Porte : `baie` : la largeur du passage (fraction de la longueur de l'arête) ; `lits` : le nombre de lits que coupe
# le passage, depuis le pied ; `joue` : l'épaisseur (m) de ses planches, leur nombre sur la hauteur du passage, ce dont
# elles débordent de la terre (m) ; `poteau` : la section (m) des poteaux d'une joue et leur écart à l'axe de l'arête
# (m) ; `linteau` : le nombre de ses rondins, couchés le long de l'arête d'un rang de poteaux à l'autre, leur rayon
# (m), ce dont ils portent au-delà de chaque joue (m) et les côtés de leur section ; `plancher` : le nombre de ses
# planches, leur épaisseur (m), ce dont une sur deux se relève (m), leur jeu (m) et ce dont il déborde du pied du
# talus (m) ; `garde` : la hauteur (m) du pied de la barrière ; `hauteur` : celle de sa tête (m) ; `jeu` de la barrière
# aux joues (m) ; `barriere` : son vantail (`menuiserie.vantail`).
PORTE = {
    "baie": 0.5, "lits": 4, "joue": (0.05, 7, 0.03), "poteau": (0.1, 0.17), "linteau": (3, 0.07, 0.2, 8),
    "plancher": {"planches": 5, "epaisseur": 0.04, "relief": 0.008, "jeu": 0.012, "debord": 0.05},
    "garde": 0.1, "hauteur": 1.7, "jeu": 0.08,
    "barriere": {
        "planches": 7, "epaisseur": 0.04, "relief": 0.006,
        "barres": (0.18, 0.82), "section": (0.12, 0.025), "marge": 0.05, "echarpe": True,
        "pentures": (0.6, 0.05, 0.008, 0.03),
        "poignee": None,
    },
}

# Brèche : `assise` : le nombre de lits qui restent entiers sous la trouée ; `trouee` : l'abscisse (fraction de la
# demi-longueur de l'arête) de chaque bord de la trouée à chaque hauteur (fraction de celle du talus) ; `saccade` : ce
# dont la tranche d'un lit s'écarte de ce bord (m, tiré jusqu'à cette borne) ; `tas` : la terre tombée au pied de
# chaque face, sa `hauteur` (m), ses `rayons` (m, le long de l'arête puis en travers), le `recul` de son milieu à
# l'axe de l'arête (m), ses `anneaux` (part de sa hauteur, part de ses rayons), leurs `cotes` et ce dont chaque rayon
# s'écarte (`ecart`, fraction tirée jusqu'à cette borne) ; `rompu` : l'abscisse (fraction de la demi-longueur) où
# s'arrête le clayonnage de chaque bout ; `pieux` : les pieux arrachés de chaque face, leur rang depuis le bout gauche
# et leur dévers vers le dehors du talus (m en tête) ; `gravats` (`geometrie.eboulis`), la part de bois parmi eux.
BRECHE = {
    "assise": 1,
    "trouee": (((0.14, -0.3), (0.45, -0.46), (0.75, -0.66), (1.0, -0.92)),
               ((0.14, 0.24), (0.4, 0.4), (0.7, 0.68), (1.0, 0.88))),
    "saccade": 0.035,
    "tas": {"hauteur": 1.1, "rayons": (0.8, 0.8), "recul": 0.32,
            "anneaux": ((0.0, 1.0), (0.32, 0.86), (0.66, 0.62), (0.9, 0.32)), "cotes": 10, "ecart": 0.12},
    "rompu": 0.5,
    "pieux": ((1, 0.3), (2, 0.22)),
    "gravats": {"nombre": 14, "etendue": (0.85, 1.2), "cote": (0.12, 0.3), "ecart": 0.3, "bois": 0.25},
}
