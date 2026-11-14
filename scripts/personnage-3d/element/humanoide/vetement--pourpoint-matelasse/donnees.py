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
`robe` (reprise de `vetement--robe/donnees.py`, où elle est mesurée : même kit, même porteur) ou `HYPOTHÈSE` (valeur
d'adaptation, doctrine #1993, à trancher en revue). Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du
personnage.
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'pourpoint-matelasse'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d'],
    'chaines': ['jupe'],
}
"""`couvre` : les zones que couvre le pourpoint publié ; les hanches, sous ses basques courtes qui s'ouvrent en
marchant, restent à la jupe. `chaines` : ses basques pendent sur le filet `jupe`, comme la jupe dessous."""
MATERIAUX = {'robe': ('vet2', ((0.55, 0.57, 0.6), 0.0, 0.87))}   # l'emplacement du pourpoint publié ; gris de construction

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
SEGMENTS_CORPS = 20                # HYPOTHÈSE de maillage : le budget, tenu par les anneaux des côtes
SEGMENTS_MANCHE = 10               # robe
EPAISSEUR = 0.002                  # robe
DEGAGEMENT_MIN = 0.004             # robe
LISSAGE_POIDS = 2                  # robe
BORNES_DES_CLES = (0.27, 2.5)      # robe

# --- Corsage : (ancre, décalage, aisance, demi-ouverture) ; ancres et sens dans `vetement--robe/donnees.py`. Fermé à
# chaque anneau. Les côtes : un anneau creux (couture, `AISANCE_COUTURE`) puis un anneau gonflé (`AISANCE_COTE`), à
# ~4 cm l'un de l'autre, des basques au col (illustration : ~25 px entre deux coutures) ---
AISANCE_COUTURE = 0.010            # HYPOTHÈSE : la couture piquée, au plus près du corps sous la doublure
AISANCE_COTE = 0.036               # HYPOTHÈSE : la côte gonfle d'environ 25 mm (illustration : les côtes ressortent en
                                   # bourrelets nets au contour des bras et du dos)
CORSAGE = [('bas', 0.0, AISANCE_COTE, 0.0), ('bas', 0.04, AISANCE_COUTURE, 0.0), ('bas', 0.08, AISANCE_COTE, 0.0),
           ('bas', 0.12, AISANCE_COUTURE, 0.0), ('aisselle', -0.12, AISANCE_COTE, 0.0),
           ('aisselle', -0.08, AISANCE_COUTURE, 0.0), ('aisselle', -0.04, AISANCE_COTE, 0.0),
           ('aisselle', 0.0, AISANCE_COUTURE, 0.0), ('aisselle', 0.045, AISANCE_COTE, 0.0),
           ('aisselle', 0.09, AISANCE_COUTURE, 0.0), ('cou', -0.03, 0.026, 0.0), ('cou', 0.0, 0.026, 0.0),
           ('cou', 0.015, 0.026, 0.0)]
# Le col reprend celui de la robe (26 mm au bas du cou : plus serré, le cou le traverse sous `carrure_plus`), sous le
# foulard (`vetement--foulard`).

# --- Basques : rangées sous le corsage, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
Z_HANCHES = 0.90                   # robe
AISANCE_HANCHES = 0.055            # HYPOTHÈSE : au-dessus de la jupe (`vetement--jupe`, 0,04), que le pourpoint couvre
OURLET_ROBE = 0.86                 # illustration : le bas du pourpoint tombe sous le haut des hanches (y ~700 px)
RANGEES_JUPE = [1.00, 0.93]        # HYPOTHÈSE de maillage
OUVERTURE_TAILLE = 0.0             # illustration : fermé
OUVERTURE_OURLET = 0.0

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan) ;
# sens dans `vetement--robe/donnees.py`. Ajustées jusqu'au poignet : chaque anneau emprunte ses poids au bras, sommet par
# sommet (`RACCORD_EPAULE` au-delà du dernier anneau), et suit l'avant-bras plié ---
COUPE_MIN = 0.06                   # robe
CREUX_DE_LA_RACINE = 0.0           # robe
RAYON_DE_COUPE_MAX = 0.12          # robe
_COTES_DE_MANCHE = [-0.10, 0.08, 0.24, 0.40, 0.56, 0.72, 0.88, 1.04, 1.20, 1.36, 1.52, 1.68, 1.80]
"""Fractions de `upperarm` (base : avant-bras ~0,85 fois le bras), une côte puis une couture tous les ~4 cm, de l'épaule
au poignet (1,80, au-dessus de la main)."""
MANCHE = [(f, AISANCE_COTE if k % 2 == 0 else AISANCE_COUTURE, 0.0) for k, f in enumerate(_COTES_DE_MANCHE[:-1])] + \
         [(_COTES_DE_MANCHE[-1], 0.010, 0.0)]
# illustration : la manche se resserre au poignet (dernier anneau à 10 mm).
ANGLE_DU_PAN = 170.0               # robe (aucun pan : sans effet)
INCLINAISON_DU_PAN = 20.0          # robe (aucun pan : sans effet)
RACCORD_EPAULE = 2.0               # au-delà du dernier anneau : la manche entière emprunte au bras, sommet par sommet
COUPE_DES_POIDS = 0.7              # robe (sans effet : aucun anneau n'est pris d'un bloc)
