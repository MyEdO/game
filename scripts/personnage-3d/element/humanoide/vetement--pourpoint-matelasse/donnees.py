"""Données de `humanoide--vetement--pourpoint-matelasse` (l'Apothicaire, #4261), lues par le kit des robes
(`element/robe.py`) : la variante `pourpoint-matelasse` de la pièce `pourpoint` de la garde-robe, le « pourpoint » des
possessions d'Apprenti apothicaire (LDB 08 l.2019).

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Elle montre une veste vieux rose matelassée, fermée
devant, qui descend sur les hanches par-dessus la jupe, piquée de côtes horizontales régulières qui gonflent entre les
coutures, du col au bas et des épaules aux poignets ; les manches, amples, bouffent sur tout le bras et se resserrent
au poignet. Le col se perd sous le foulard. Le dos ne se voit pas (HYPOTHÈSE : fermé d'un seul pan, matelassé comme le
devant). Échelle relevée : environ 600 px/m (personnage voûté, de la plante des pieds, y ~1160 px, au bas du ventre,
y ~640 px, pour les 0,87 m de la base sous la ceinture) ; les côtes se suivent tous les ~25 px, 4 cm.

Chaque dimension est nommée, en mètres ou en degrés, avec sa source : `illustration`, `base` (sonde de construction),
`#3743` (mesurée sur la robe du premier Sorcier : même kit, même porteur) ou `HYPOTHÈSE` (valeur d'adaptation, doctrine
#1993, à trancher en revue). Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du
personnage.
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'pourpoint-matelasse'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'hanches', 'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d'],
    'chaines': ['jupe'],
}
"""`couvre` : les hanches avec le torse, comme la bure (`vetement--bure`) : les basques, fermées, les couvrent jusqu'à
leur ourlet (0,86 m), où s'arrête le mesh `hanches` de la jupe (0,86 à 1,08 m), masqué dessous au montage. Laissé à la
jupe, ce mesh passait devant la bande qui joint le corsage aux basques, là où elle se plie quand la cuisse monte
(`couche-traversee` de 6 à 18 mm sous `corpulence` et `carrure_plus`, ClimbUp_1m, Melee_Hook, Sword_Heavy_Combo).
`chaines` : ses basques pendent sur le filet `jupe`, comme la jupe dessous."""
MATERIAUX = {'robe': ('vet2', 'drap-terne')}   # l'emplacement du pourpoint publié

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
SEGMENTS_CORPS = 20                # HYPOTHÈSE de maillage : le budget, tenu par les anneaux des côtes
SEGMENTS_MANCHE = 10               # HYPOTHÈSE de maillage
EPAISSEUR = 0.002                  # HYPOTHÈSE : double nappe d'un drap de laine
DEGAGEMENT_MIN = 0.010             # HYPOTHÈSE : les basques posées 6 mm au-dessus de la jupe (`vetement--jupe`, 0,004)
"""Sous la charnière du filet `jupe` (1,04 m, base), basques et jupe se posent sur le filet au même jeu, dégagement plus
épaisseur (`robe.py`, `rayon`) : à 0,004 comme la jupe, la jupe sortait devant les basques (porte, `couche-traversee`
18 à 150 par passe, `couche-percee-au-repos` à 13 mm). 0,010 ne touche rien d'autre : chaque anneau du corsage et des
manches a déjà au moins 10 mm d'aisance."""
LISSAGE_POIDS = 2                  # passes laplaciennes des poids du corsage et des manches (les basques ne sont pas lissées)
BORNES_DES_CLES = (0.27, 2.5)      # #3743 : rapport d'arête sous une clé transférée hors duquel `tissu` lisse la clé ; marge
                                   # prise sur la porte d'étirement au repos de l'évaluateur ([0,25 ; 4])

# --- Corsage : (ancre, décalage, aisance) ; ancres lues sur la base (`robe.ancres_du_corps`) : `bas` =
# bas de la zone `torse`, `aisselle` = bas des zones `bras_haut_*`, `cou` = bas de la zone `cou`. Fermé à
# chaque anneau. Les côtes : un anneau creux (couture, `AISANCE_COUTURE`) puis un anneau gonflé (`AISANCE_COTE`), à
# ~4 cm l'un de l'autre, des basques au col (illustration : ~25 px entre deux coutures). La première côte à 2 cm au-dessus
# du bas du torse (HYPOTHÈSE) : posée au bas même, à 4 cm de la première rangée des basques, la bande qui les joint
# devant s'étirait jusqu'à 4,05 fois sa longueur quand la cuisse monte (porte, ClimbUp_1m, seuil 3,51) ---
AISANCE_COUTURE = 0.010            # HYPOTHÈSE : la couture piquée, au plus près du corps sous la doublure
AISANCE_COTE = 0.036               # HYPOTHÈSE : la côte gonfle d'environ 25 mm (illustration : les côtes ressortent en
                                   # bourrelets nets au contour des bras et du dos)
CORSAGE = [('bas', 0.02, AISANCE_COTE), ('bas', 0.06, AISANCE_COUTURE), ('bas', 0.10, AISANCE_COTE),
           ('bas', 0.14, AISANCE_COUTURE), ('aisselle', -0.12, AISANCE_COTE),
           ('aisselle', -0.08, AISANCE_COUTURE), ('aisselle', -0.04, AISANCE_COTE),
           ('aisselle', 0.0, AISANCE_COUTURE), ('aisselle', 0.045, AISANCE_COTE),
           ('aisselle', 0.09, AISANCE_COUTURE), ('cou', -0.03, 0.026), ('cou', 0.0, 0.026),
           ('cou', 0.015, 0.026)]
# Le col, à 26 mm au bas du cou (#3743 : plus serré, le cou le traverse sous `carrure_plus`), sous le foulard
# (`vetement--foulard`).

# --- Basques : rangées sous le corsage, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
OURLET_ROBE = 0.86                 # illustration : le bas du pourpoint tombe sous le haut des hanches (y ~700 px)
RANGEES_JUPE = [1.00, 0.93]        # HYPOTHÈSE de maillage

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan :
# longueur ajoutée en lobe sous le bras, nulle ici). Ajustées jusqu'au poignet : chaque anneau emprunte ses poids au bras, sommet par
# sommet (`RACCORD_EPAULE` au-delà du dernier anneau), et suit l'avant-bras plié ---
COUPE_MIN = 0.06                   # #3743 : fraction de `upperarm` en deçà de laquelle la coupe du bras se prend là (épaule)
RAYON_DE_COUPE_MAX = 0.12          # #3743 : rayon au-delà duquel un point de la coupe n'est pas du bras (tronc)
_COTES_DE_MANCHE = [-0.10, 0.08, 0.24, 0.40, 0.56, 0.72, 0.88, 1.04, 1.20, 1.36, 1.52, 1.68, 1.80]
"""Fractions de `upperarm` (base : avant-bras ~0,85 fois le bras), une côte puis une couture tous les ~4 cm, de l'épaule
au poignet (1,80, au-dessus de la main)."""
MANCHE = [(_COTES_DE_MANCHE[0], AISANCE_COUTURE, 0.0)] + \
         [(f, AISANCE_COTE if k % 2 == 0 else AISANCE_COUTURE, 0.0) for k, f in enumerate(_COTES_DE_MANCHE[1:-1], 1)] + \
         [(_COTES_DE_MANCHE[-1], 0.010, 0.0)]
# illustration : la manche se resserre au poignet (dernier anneau à 10 mm). HYPOTHÈSE : l'anneau d'emmanchure, dans
# l'épaule, est la couture qui joint la manche au corps ; gonflé en côte (36 mm), la bande qui le joint au corsage
# s'écrasait derrière l'aisselle droite quand le bras frappe (`arete-ecrasee` 0,006 pour un seuil de 0,01, Melee_Hook sous
# `feminin`). À 20 mm, ou en côte à -0,05 de `upperarm`, l'emmanchure s'étirait sous la hotte (`accessoire--hotte`)
# jusqu'à 4,8 fois sa longueur.
RACCORD_EPAULE = 2.0               # au-delà du dernier anneau : la manche entière emprunte au bras, sommet par sommet
COUPE_DES_POIDS = 0.7              # #3743 (sans effet : aucun anneau n'est pris d'un bloc)
