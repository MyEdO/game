"""Données du mur enduit (#4471) : le GLB `arete--enduit`, les pièces que l'hôte pose sur les arêtes des apparences dont
`kit` vaut `enduit` dans `src/data/structureAppearance.json`. Sa forme se lit dans ce fichier, aux seuls champs de
forme de `MUR` (`detail.courses` : `hM`, `jointW`, `stagger`, `blockWM`, `edgeWobble`), les assises de ses pierres.
Aucune couleur ne s'y lit : chaque surface nomme l'emplacement de palette que l'hôte teint de la couleur de l'apparence
posée.

Illustration directrice (hors dépôt) : la façade de La Diligence (EDO p4, `diligence-plan-et-facade`), son mur de
devant enduit d'ocre, son portail en arc encadré de pierres grises, ses deux vantaux de bois, le petit toit d'ardoise
et l'écu qui le coiffent.

Le mur : un corps d'enduit uni au relief léger, coiffé d'un chaperon arrondi qui le déborde. La porte seule sur son arête est une porte cintrée, son encadrement de pierres de taille en
harpe, piédroits et claveaux, en relief sur l'enduit. Dans une ouverture de deux arêtes (`PORTAIL`), chaque arête de
bout porte la moitié du portail, la clef au joint des deux arêtes : son piédroit, sa moitié de l'arc, du bandeau de
pierre claire qui le suit, de l'écu plaqué sur lui, son champ nu cerné d'une bordure de pierre, et du petit toit d'ardoise à deux pans qui coiffe le
mur, et un vantail gondé à son piédroit. La fenêtre s'ouvre entre deux jambages en harpe, sur un appui saillant et sous
un linteau, sa croisée et ses volets ceux de `menuiserie`. La brèche arrache l'enduit et éventre le mur : sa
maçonnerie à nu, ses pierres au pied.

Matières : l'enduit prend `terre-battue`, la pierre de l'encadrement et de la maçonnerie et ses gravats `pierre-atre`,
le bandeau et le champ de l'écu `albatre`, la couverture `prop-ardoise`, ses chevrons, les vantaux et la croisée `bois-chene`, les
ferrures `fer-noirci`, la vitre `verre`. L'échelle dressée contre l'arête (`menuiserie.echelle`) prend `bois-chene`.
La pierre prend la teinte `joint` de l'apparence, les chevrons celle des barres des vantaux ; l'ardoise, la pierre
claire et le champ de l'écu nomment `vet2`, que la palette d'une arête ne teint pas (`paletteDeLApparence`) : elles gardent la couleur de
leur matière.

Cotes d'adaptation, en mètres ou en fractions nommées : aucune ne vient d'une règle."""
from apparences import MOELLONS_MACONNES, apparence, assises, hauteur

KIT = "enduit"
MUR = "mur-enduit"
"""L'apparence dont le modèle lit la forme des assises de ses pierres."""

LONGUEUR = 2.0
"""`sceneMetresPerTile`, LDB 15 l.12."""
HAUTEUR = hauteur(apparence(KIT, MUR))
"""La hauteur (m) des arêtes du mur."""
EPAISSEUR = 0.5
"""L'épaisseur (m) du mur à son chaperon, d'un bord à l'autre."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "enduit": ("corps", "terre-battue"),
    "moellons": ("joint", "pierre-atre"),
    "pierre-claire": ("vet2", "albatre"),
    "ecu": ("vet2", "albatre"),
    "ardoise": ("vet2", "prop-ardoise"),
    "menuiserie": ("accent", "bois-chene"),
    "barres": ("planche", "bois-chene"),
    "croisee": ("vet1", "bois-chene"),
    "vitre": ("vitre", "verre"),
    "ferrure": ("metal", "fer-noirci"),
    "echelle": ("accent", "bois-chene"),
    "gravats": ("gravats", "pierre-atre"),
}

BUDGET_TRIANGLES = {"mur": 700, "porte-fermee": 3400, "porte-ouverte": 3400,
                    "fenetre": 2600, "fenetre-close": 2600, "breche": 2400, "echelle": 400}

ANGLE_LISSE = 30
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le relief de l'enduit et l'arrondi du
chaperon s'y fondent, les pierres gardent leurs arêtes."""

APPAREIL = {
    **assises(apparence(KIT, MUR)), **MOELLONS_MACONNES,
    "moellon": {"relief": (0.0, 0.008), "chanfrein": (0.012, 0.02), "retrait": (0.025, 0.05)}}
"""L'appareil des pierres du mur (`maconnerie`) ; `moellon` : la façon d'une pierre à nu dans sa brèche."""

# Enduit : `retrait` : ce dont son nu recule sous le bord du chaperon, de chaque côté (m) ; `relief` : ce dont il se
# creuse encore par endroits (m, tiré jusqu'à cette borne) ; `pas` : le plus grand côté d'une de ses mailles (m) ;
# `cintre` : ce pas le long d'un arc (m) ; `a_nu` : ce dont une pierre à nu recule sous le bord du chaperon (m).
ENDUIT = {"retrait": 0.09, "relief": 0.012, "pas": 0.34, "cintre": 0.13, "a_nu": 0.07}

# Chaperon : sa `hauteur` (m), dont celle de sa `bande` droite (m) sous son arrondi, et les `segments` de celui-ci.
CHAPERON = {"hauteur": 0.36, "bande": 0.08, "segments": 8}

# Encadrement de pierres de taille d'une baie : sa `saillie` sur le nu de l'enduit (m) ; l'âme de pierre qui double
# le tableau de la baie derrière ses joints : son `creux` sous le parement des pierres (m), son `retrait` sous le bout
# de la plus courte (m), le `jeu` dont elle avance dans la baie devant elles et dont l'enduit entre sous elle (m).
ENCADREMENT = {"saillie": 0.09, "creux": 0.02, "retrait": 0.02, "jeu": 0.003}

# Porche d'une porte cintrée (`modele.Enduit.porche`) : `portee` (m) ; `naissance` et `fleche` de l'arc (m) ; ses
# `claveaux` par côté, leur `queue` (m), un sur deux la première puis la seconde, sa `clef` plus haute (m) ; `harpe` :
# la longueur (m) des pierres d'un piédroit, une assise sur deux la première puis la seconde ; `tete` : la hauteur (m)
# où le corps du mur s'arrête sous un toit, `None` sous son chaperon ; `bandeau` : la pierre claire qui suit l'arc
# au-dessus de la clef, sa distance à l'intrados et son épaisseur (m), la part de l'arc qu'elle couvre de chaque côté,
# ses `segments` et sa saillie (m), `None` sans bandeau.
# Porte seule sur son arête : `seuil` : sa hauteur (m) ; `jeu` du vantail à la pierre (m).
PORTE = {
    "porche": {"portee": 0.5, "naissance": 1.8, "fleche": 0.3, "claveaux": 3, "queue": (0.22, 0.15), "clef": 0.05,
               "harpe": (0.28, 0.17), "tete": None, "bandeau": None},
    "seuil": 0.04, "jeu": 0.008,
}

# Portail d'une ouverture de deux arêtes, un vantail par arête : `vantail` : ses planches (`menuiserie.vantail`).
# `ecu` : son `pied` (m), sa demi-largeur et sa hauteur (`taille`, m), l'`epaisseur` de sa bordure et son `ecart` à
# l'encadrement (m), son demi-`contour` de la tête à la pointe (fractions de sa taille), et son `champ` : la `marge`
# que la bordure garde autour de lui et son `relief` sur elle (m).
# `toit` : la hauteur (m) de son `egout` et son `debord` sur le bord du chaperon (m) ; sa `faitiere` (largeur,
# hauteur, m) ; ses `rangs` d'ardoises par pan, leur `largeur` (m), leur `epaisseur` (m), leur `recouvrement` (longueur
# en pureaux) et le `jeu` dont leur pied descend (m, tiré jusqu'à cette borne) ; ses `chevrons` par arête et leur
# `section` (largeur, hauteur, m).
PORTAIL = {
    "porche": {"portee": 1.15, "naissance": 2.3, "fleche": 0.5, "claveaux": 5, "queue": (0.34, 0.24), "clef": 0.08,
               "harpe": (0.42, 0.26), "tete": 3.62,
               "bandeau": {"rayon": 0.35, "epaisseur": 0.09, "part": 0.9, "segments": 5, "saillie": 0.02}},
    "seuil": 0.04, "jeu": 0.012,
    "vantail": {
        "planches": 6, "epaisseur": 0.06, "relief": 0.008,
        "barres": (0.14, 0.86), "section": (0.16, 0.03), "marge": 0.1, "echarpe": True,
        "pentures": (0.72, 0.07, 0.01, 0.04),
        "poignee": {"platine": (0.07, 0.16, 0.01), "rive": 0.12, "hauteur": 0.5, "saillie": 0.035},
    },
    "ecu": {"pied": 2.92, "taille": (0.25, 0.58), "epaisseur": 0.03, "ecart": 0.025,
            "contour": ((0.0, 1.0), (1.0, 1.0), (1.0, 0.52), (0.93, 0.36), (0.74, 0.2), (0.42, 0.08), (0.0, 0.0)),
            "champ": {"marge": 0.04, "relief": 0.012}},
    "toit": {"egout": 3.55, "debord": 0.16, "faitiere": (0.12, 0.07),
             "rangs": 3, "largeur": 0.25, "epaisseur": 0.022, "recouvrement": 1.5, "jeu": 0.025,
             "chevrons": 4, "section": (0.06, 0.07)},
}

# Fenêtre : `baie` : sa largeur (fraction de la longueur de l'arête) ; `appui`, `tete` : les hauteurs (m) du dessus de
# son appui et du dessous de son linteau ; `pierre_d_appui` : sa hauteur, sa saillie sur le bord du chaperon et sa
# portée sur chaque jambage (m) ; `linteau` : sa hauteur et sa portée sur chaque jambage (m) ; `harpe` : la longueur
# (m) des pierres d'un jambage ; `jour` : ce dont un volet clos reste au-dessus de l'appui (m) ; `recouvrement` : ce
# dont il déborde la baie sur le linteau (m) ; `volets` : leur écart à l'encadrement (m).
FENETRE = {"baie": 0.36, "appui": 1.2, "tete": 2.4, "pierre_d_appui": (0.14, 0.08, 0.06), "linteau": (0.26, 0.2),
           "harpe": (0.24, 0.15), "jour": 0.01, "recouvrement": 0.03, "volets": 0.004}

# Brèche : `contour`, à chaque abscisse (fraction de la demi-longueur, d'un bout à l'autre de l'arête), la hauteur
# (fraction de celle du mur) où sa maçonnerie s'arrête ; `plancher` : la hauteur (m) qu'elle garde au moins ;
# `enduit` : les abscisses (fractions) entre lesquelles l'enduit est tombé ; `ame` : ce dont le cœur de la maçonnerie
# recule sous le nu de l'enduit (m) ; `gravats` (`geometrie.eboulis`).
BRECHE = {
    "contour": ((-1.0, 1.0), (-0.62, 1.0), (-0.50, 0.70), (-0.36, 0.42), (-0.14, 0.12), (0.18, 0.08), (0.40, 0.30),
                (0.52, 0.60), (0.66, 1.0), (1.0, 1.0)),
    "plancher": 0.04,
    "enduit": (-0.78, 0.8),
    "ame": 0.03,
    "gravats": {"nombre": 14, "etendue": (0.7, 0.75), "cote": (0.14, 0.34), "ecart": 0.22},
}
