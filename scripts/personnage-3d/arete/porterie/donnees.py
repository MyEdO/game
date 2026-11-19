"""Données de la porterie (#4471) : le GLB `arete--porterie`, les pièces que l'hôte pose sur les arêtes des apparences
dont `kit` vaut `porterie` dans `src/data/structureAppearance.json` : une porte de ville, Structure qui ne s'ouvre pas
mais s'abat (`mur`, `breche`). Sa forme se lit dans ce fichier, aux seuls champs de forme de `PORTE` (`detail.courses`
et la herse de `door.herse` : `bars`, `topFrac`, `traverseFracs`). Aucune couleur ne s'y lit : chaque surface nomme
l'emplacement de palette que l'hôte teint de la couleur de l'apparence posée.

Illustration directrice (hors dépôt) : la façade de La Diligence (EDO p4, `diligence-plan-et-facade`), son porche de
pierre voûté et son portail de bois à deux vantaux.

La porte (`maconnerie.Appareil.porche`) : un porche voûté de moellons maçonnés entre deux piédroits, ses vantaux de
planches clos sous un tympan de bois, et sa herse baissée devant eux. Seule sur son arête, elle y tient entière ; dans
une ouverture de deux arêtes, chaque arête de bout en porte la moitié, la clef au joint. La brèche garde le porche :
sa herse est rompue, ses vantaux arrachés, leurs restes aux piédroits et au sol.

Matières : la pierre prend `pierre-atre`, le mortier `terre-battue`, le bois `bois-chene`, le fer `fer-noirci`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import MOELLONS_MACONNES, apparence, assises, hauteur

KIT = "porterie"
PORTE = "porte-de-ville"
"""L'apparence dont le modèle lit la forme de son appareil et de sa herse."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, PORTE))
"""La hauteur (m) des arêtes de la porte."""
EPAISSEUR = 0.5
"""L'épaisseur (m) du mur, d'un parement à l'autre."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "moellons": ("corps", "pierre-atre"),
    "ame": ("bois", "terre-battue"),
    "menuiserie": ("accent", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"mur": 2400, "breche": 2400}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le chanfrein d'une pierre s'y fond,
ses joues gardent leurs arêtes."""

APPAREIL = {**assises(apparence(KIT, PORTE)), **MOELLONS_MACONNES}
"""L'appareil du mur (`maconnerie`)."""

PORCHES = {
    None: {"portee": 0.72, "naissance": 2.1, "fleche": 0.5, "queue": 0.26, "clef": 0.07, "claveaux": 4,
           "saillie": 0.015},
    "ouverture": {"portee": 1.6, "naissance": 2.2, "fleche": 0.9, "queue": 0.36, "clef": 0.08, "claveaux": 5,
                  "saillie": 0.015},
}
"""Le porche (`maconnerie.Appareil.porche`) d'une porte seule sur son arête, puis celui d'une ouverture de deux
arêtes."""

# Herse : `barreaux` par longueur d'arête, `tete` : la hauteur de leur tête (fraction de celle de la clef) et
# `traverses` : celle de chaque traverse (fraction de cette tête), lus de l'apparence ; `section` d'un barreau (m),
# celle d'une traverse (hauteur, épaisseur, m), `axe` : son écart à l'axe du mur, vers le dehors (m).
HERSE = {
    **{cote: apparence(KIT, PORTE)["door"]["herse"][champ]
       for cote, champ in (("barreaux", "bars"), ("tete", "topFrac"), ("traverses", "traverseFracs"))},
    "section": 0.05, "traverse": (0.08, 0.02), "axe": 0.1}

# Vantaux clos derrière la herse : leurs planches (`menuiserie.vantail`), l'`ancrage` de leur rive dans le piédroit
# (m), la `prise` du tympan dans la voûte (m).
VANTAUX = {
    "ancrage": 0.03, "prise": 0.04,
    "vantail": {
        "planches": 7, "epaisseur": 0.07, "relief": 0.008,
        "barres": (0.14, 0.86), "section": (0.16, 0.03), "marge": 0.1, "echarpe": True,
        "pentures": (0.72, 0.07, 0.01, 0.0),
        "poignee": None,
    },
}

# Brèche : la `longueur` qui reste d'un barreau rompu, pendu à la tête de la herse (m, tirée) ; la part des barreaux
# qui `tiennent` encore ; le nombre de `planches` qui restent d'un vantail à son piédroit et leur hauteur (fraction de
# celle du vantail, tirée) ; `gravats` (`geometrie.eboulis`), la part de fer parmi eux.
BRECHE = {
    "longueur": (0.25, 1.1), "tiennent": 0.7, "planches": (2, (0.35, 0.95)),
    "gravats": {"nombre": 12, "etendue": (0.7, 0.8), "cote": (0.1, 0.3), "ecart": 0.25, "fer": 0.3},
}
