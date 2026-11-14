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
SEGMENTS_CORPS = 24                # bure
EPAISSEUR = 0.002                  # bure
DEGAGEMENT_MIN = 0.004             # bure
LISSAGE_POIDS = 2                  # bure
BORNES_DES_CLES = (0.27, 2.5)      # bure : la jupe longue suit le bas de jambe tassé sous `gabarit_legs_moins`

# --- Ceinture : (ancre, décalage, aisance, demi-ouverture) ; ancres et sens dans `vetement--robe/donnees.py`. Deux
# anneaux fermés à la taille, au bas du torse (HYPOTHÈSE : la ceinture de la jupe, cachée sous le pourpoint) ---
CORSAGE = [('bas', 0.0, 0.008, 0.0), ('bas', 0.05, 0.010, 0.0)]

# --- Jupe : rangées horizontales sous la ceinture, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
Z_HANCHES = 0.90                   # bure
AISANCE_HANCHES = 0.04             # bure
OURLET_ROBE = 0.08                 # illustration : les pointes des lambeaux à ~1115 px, 45 px au-dessus des plantes
LAMBEAUX_ROBE = {'profondeur': 0.06, 'creux': 0.15, 'graine': 'humanoide--vetement--jupe'}
"""Illustration : les lambeaux de l'ourlet montent d'environ 35 px au-dessus de leurs pointes, 6 cm (`tissu.lambeaux`)."""
RANGEES_JUPE = [1.00, 0.90, 0.76, 0.60, 0.44, 0.28]   # bure
OUVERTURE_TAILLE = 0.0             # illustration : la jupe est fermée
OUVERTURE_OURLET = 0.0

MANCHE = []                        # une jupe n'a pas de manches
