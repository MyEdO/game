"""Données du mur de pierres sèches (#4471) : le GLB `arete--pierres-seches`, les pièces que l'hôte pose sur les
arêtes des apparences dont `kit` vaut `pierres-seches` dans `src/data/structureAppearance.json`. Sa forme se lit dans
ce fichier, aux seuls champs de forme de `MUR` (`wallHeightM`, `detail.courses` : `hM`, `jointW`, `stagger`,
`blockWM`, `edgeWobble`). Aucune couleur ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte teint
de la couleur de l'apparence posée.

Le mur (`maconnerie.Appareil`) : un muret à hauteur d'appui, ses pierres brutes montées à sec, serrées et inégales,
sans chaîne ni mortier, l'ombre de leurs vides tenue par une âme en retrait, et un couronnement de pierres posées de
chant. La porte y ouvre un passage que ferme un portillon de planches, qui tourne sur son gond vers le dedans. Un muret
ne porte pas de fenêtre : ses deux pièces sont le mur plein. La brèche l'éboule jusqu'au pied.

Matières : la pierre prend `pierre-atre`, l'âme `terre-battue`, le bois `bois-chene`, les ferrures `fer-noirci`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import apparence, hauteur

KIT = "pierres-seches"
MUR = "mur-en-pierres-seches"
"""L'apparence dont le modèle lit la forme de son appareil et sa hauteur."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, MUR))
"""La hauteur (m) des arêtes du mur."""
EPAISSEUR = 0.5
"""L'épaisseur (m) du mur, d'un parement à l'autre."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "moellons": ("corps", "pierre-atre"),
    "ame": ("bois", "terre-battue"),
    "menuiserie": ("accent", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"mur": 520, "porte-fermee": 520, "porte-ouverte": 520, "fenetre": 520, "fenetre-close": 520,
                    "breche": 620}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : une pierre garde ses arêtes."""

APPAREIL = {
    **{cote: apparence(KIT, MUR)["detail"]["courses"][champ] for cote, champ in (
        ("assise", "hM"), ("joint", "jointW"), ("bloc", "blockWM"), ("decalage", "stagger"),
        ("ondulation", "edgeWobble"))},
    "relief": (0.0, 0.06), "creux": 0.09, "harpe": None,
    "couronnement": {"hauteur": 0.22, "largeur": (0.09, 0.17), "chute": 0.07, "relief": (0.0, 0.05),
                     "ondulation": 0.03},
}
"""L'appareil du mur (`maconnerie`)."""

# Porte : `baie` : la largeur du passage (fraction de la longueur de l'arête) ; `garde` : la hauteur (m) du pied du
# portillon ; `hauteur` : celle de sa tête (m) ; `jeu` du portillon à la pierre (m) ; `portillon` : son vantail
# (`menuiserie.vantail`).
PORTE = {
    "baie": 0.5, "garde": 0.07, "hauteur": 0.96, "jeu": 0.02,
    "portillon": {
        "planches": 6, "epaisseur": 0.03, "relief": 0.005,
        "barres": (0.2, 0.8), "section": (0.08, 0.022), "marge": 0.04, "echarpe": True,
        "pentures": (0.55, 0.04, 0.006, 0.03),
        "poignee": None,
    },
}

# Brèche : `contour`, `plancher` (`maconnerie.Appareil.breche`) ; `gravats` (`geometrie.eboulis`).
BRECHE = {
    "contour": ((-1.0, 1.0), (-0.72, 1.0), (-0.52, 0.55), (-0.20, 0.16), (0.16, 0.10), (0.44, 0.38), (0.64, 1.0),
                (1.0, 1.0)),
    "plancher": 0.05,
    "gravats": {"nombre": 16, "etendue": (0.6, 0.8), "cote": (0.12, 0.3), "ecart": 0.25},
}
