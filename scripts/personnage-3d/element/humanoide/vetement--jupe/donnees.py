"""Données de `humanoide--vetement--jupe` (l'Apothicaire, #4261), lues par le kit des robes (`element/robe.py`) : la pièce
`jupe` de la garde-robe.

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Elle montre une jupe brune d'un seul pan, fermée, ample,
qui tombe de la taille, sous le pourpoint matelassé, jusqu'au cou-de-pied, l'ourlet effiloché en lambeaux irréguliers
au-dessus des chaussures. Le dos ne se voit pas (HYPOTHÈSE : fermé d'un seul pan, comme le devant). Échelle relevée :
environ 600 px/m (de la plante des pieds, y ~1160 px, au bas du ventre, y ~640 px, pour les 0,87 m de la base sous la
ceinture, personnage voûté).

Chaque dimension est nommée, en mètres ou en degrés, avec sa source : `illustration`, `base` (sonde de construction),
`bure` (reprise de `vetement--bure/donnees.py`, où elle est mesurée : même kit, même filet) ou `HYPOTHÈSE` (valeur
d'adaptation, doctrine #1993, à trancher en revue). Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du
personnage.
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'jupe'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d'],
    'chaines': ['jupe'],
}
"""`couche` : la jupe passe sous le pourpoint, qui la couvre de la taille aux hanches (illustration) ; à couche égale,
deux pièces sur le même filet se confondraient. `couvre` : sous l'ourlet effiloché, pieds écartés, le mollet se voit
(procédure, section 2) ; le haut de la jupe, sous le pourpoint, ne cache pas le torse."""
MATERIAUX = {'robe': ('vet1', ((0.55, 0.57, 0.6), 0.0, 0.87))}   # gris de construction, sans couleur cuite

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
SEGMENTS_CORPS = 20                # HYPOTHÈSE de maillage : les colonnes du pourpoint (`vetement--pourpoint-matelasse`), que ses
                                   # basques couvrent facette pour facette, sans corde qui rentre entre deux colonnes
EPAISSEUR = 0.002                  # bure
DEGAGEMENT_MIN = 0.004             # bure
LISSAGE_POIDS = 2                  # bure
BORNES_DES_CLES = (0.27, 2.5)      # bure : la jupe longue suit le bas de jambe tassé sous `gabarit_legs_moins`

# --- Ceinture : (ancre, décalage, aisance, demi-ouverture) ; ancres et sens dans `vetement--robe/donnees.py`. Deux
# anneaux fermés à la taille, au bas du torse (HYPOTHÈSE : la ceinture de la jupe, cachée sous le pourpoint). Le bas
# 2 cm sous le premier anneau du pourpoint : quand la cuisse monte, la bande qui descend de cet anneau aux basques se
# plie autour de lui ; posé à sa hauteur, l'anneau de la jupe passait devant elle (`couche-traversee` jusqu'à 15 mm,
# Melee_Hook sous `carrure_plus`). Le haut à 4 cm, entre la côte et la première couture du pourpoint (2 et 6 cm) : à
# 5 cm et 10 mm d'aisance, au ras de cette couture, il en sortait sous `corpulence` ; à 3 cm, la bande qui le joint au bas
# s'écrasait dans le dos penché (`arete-ecrasee`, Melee_Hook sous `carrure_moins`) ---
CORSAGE = [('bas', 0.0, 0.008, 0.0), ('bas', 0.04, 0.008, 0.0)]

# --- Jupe : rangées horizontales sous la ceinture, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
OURLET_ROBE = 0.08                 # illustration : les pointes des lambeaux à ~1115 px, 45 px au-dessus des plantes
LAMBEAUX_ROBE = {'profondeur': 0.06, 'creux': 0.15, 'graine': 'humanoide--vetement--jupe'}
"""Illustration : les lambeaux de l'ourlet montent d'environ 35 px au-dessus de leurs pointes, 6 cm (`tissu.lambeaux`)."""
RANGEES_JUPE = [1.00, 0.93, 0.86, 0.76, 0.60, 0.44, 0.28]
"""HYPOTHÈSE de maillage : celles de la bure, 0,90 remplacée par les rangées des basques du pourpoint (0,93 et son ourlet
0,86), que la jupe suit dessous sommet pour sommet ; aux rangées de la bure, la jupe passait devant les basques (porte,
`couche-traversee`)."""
OUVERTURE_TAILLE = 0.0             # illustration : la jupe est fermée
OUVERTURE_OURLET = 0.0

MANCHE = []                        # une jupe n'a pas de manches
