"""Données du mur de moellons maçonnés (#4471) : le GLB `arete--pierre`, les pièces que l'hôte pose sur les arêtes des
apparences dont `kit` vaut `pierre` dans `src/data/structureAppearance.json`. Sa forme se lit dans ce fichier, aux
seuls champs de forme de `MUR` (`detail.courses` : `hM`, `jointW`, `stagger`, `blockWM`, `edgeWobble`). Aucune couleur
ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte teint de la couleur de l'apparence posée.

Illustration directrice (hors dépôt) : la façade de La Diligence (EDO p4, `diligence-plan-et-facade`), son mur
d'enceinte de moellons assisés, les pierres de taille de son porche.

L'appareil (`maconnerie.Appareil`) : des assises de moellons en léger relief sur une âme de mortier en retrait, une
chaîne de pierres de taille en harpe à chaque bout de l'arête, que celle du mur voisin complète. La porte ouvre une
baie entre deux piédroits harpés, sous un linteau monolithe et sur un seuil ; son vantail de planches barrées tourne
sur son gond vers le dedans. La fenêtre s'ouvre de même entre un appui saillant et un linteau, sa croisée et ses volets
ceux de `menuiserie`. La brèche éventre le mur jusqu'à sa tête, son âme à nu, ses pierres au pied.

Matières : la pierre prend `pierre-atre`, le mortier `terre-battue`, le bois `bois-chene`, les ferrures `fer-noirci`.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import apparence, hauteur

KIT = "pierre"
MUR = "mur-en-pierre"
"""L'apparence dont le modèle lit la forme de son appareil."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, MUR))
"""La hauteur (m) des arêtes du mur."""
EPAISSEUR = 0.4
"""L'épaisseur (m) du mur, d'un parement à l'autre."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "moellons": ("corps", "pierre-atre"),
    "ame": ("bois", "terre-battue"),
    "menuiserie": ("accent", "bois-chene"),
    "croisee": ("vet1", "bois-chene"),
    "ferrure": ("metal", "fer-noirci"),
}

BUDGET_TRIANGLES = {"mur": 700, "porte-fermee": 900, "porte-ouverte": 900, "fenetre": 1300, "fenetre-close": 1300,
                    "breche": 900}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : une pierre garde ses arêtes."""

APPAREIL = {
    **{cote: apparence(KIT, MUR)["detail"]["courses"][champ] for cote, champ in (
        ("assise", "hM"), ("joint", "jointW"), ("bloc", "blockWM"), ("decalage", "stagger"),
        ("ondulation", "edgeWobble"))},
    "relief": (0.006, 0.028), "creux": 0.04, "harpe": (0.32, 0.18), "couronnement": None,
}
"""L'appareil du mur (`maconnerie`)."""

# Porte : `baie` : sa largeur (fraction de la longueur de l'arête) ; `hauteur` de la baie (m) ; `seuil` : sa hauteur
# (m) ; `linteau` : sa hauteur et sa portée sur chaque piédroit (m) ; `jeu` du vantail à la pierre (m).
PORTE = {"baie": 0.5, "hauteur": 2.1, "seuil": 0.04, "linteau": (0.32, 0.18), "jeu": 0.008}

# Fenêtre : `baie` : sa largeur (fraction de la longueur de l'arête) ; `appui`, `tete` : les hauteurs (m) du dessus de
# son appui et du dessous de son linteau ; `pierre_d_appui` : sa hauteur et sa saillie sur le parement du dehors (m) ;
# `linteau` : sa hauteur et sa portée sur chaque piédroit (m) ; `jour` : ce dont un volet clos reste au-dessus de
# l'appui (m) ; `recouvrement` : ce dont il déborde la baie sur le linteau (m).
FENETRE = {"baie": 0.36, "appui": 1.2, "tete": 2.4, "pierre_d_appui": (0.14, 0.05), "linteau": (0.28, 0.18),
           "jour": 0.01, "recouvrement": 0.03}

# Brèche : `contour`, `plancher` (`maconnerie.Appareil.breche`) ; `gravats` (`geometrie.eboulis`).
BRECHE = {
    "contour": ((-1.0, 1.0), (-0.62, 1.0), (-0.50, 0.70), (-0.36, 0.42), (-0.14, 0.12), (0.18, 0.08), (0.40, 0.30),
                (0.52, 0.60), (0.66, 1.0), (1.0, 1.0)),
    "plancher": 0.04,
    "gravats": {"nombre": 14, "etendue": (0.7, 0.75), "cote": (0.14, 0.34), "ecart": 0.22},
}
