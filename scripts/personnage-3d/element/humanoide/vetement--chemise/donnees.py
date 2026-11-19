"""Données de `humanoide--vetement--chemise` (le Soldat, #4318), lues par `modele.py` : la pièce `chemise` de la
garde-robe, de l'ensemble `tenue-uniforme-de-soldat`, seul à la porter.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : une chemise blanche dont on voit le col rouge, droit, qui monte sur le cou au-dessus du plastron, et
les manches, très amples, qui sortent du mancheron du pourpoint au coude et bouffent sur l'avant-bras jusqu'au gant, où
elles se froncent. Le corps de la chemise ne se voit pas (sous le pourpoint) : sa coupe, ajustée et rentrée dans le
haut-de-chausses, est HYPOTHÈSE. Échelle relevée : ~520 px/m (`armure--epaulieres/donnees.py`) ; la manche de
l'avant-bras fait ~85 px de large au plus bouffant, ~16 cm, sur un avant-bras de ~9 cm (base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction), `pourpoint-matelasse` (reprise de
`vetement--pourpoint-matelasse/donnees.py`, même porteur, même kit de manches) ou `HYPOTHÈSE` (à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'chemise'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['torse', 'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d'],
}
"""`couche` : sous le pourpoint (`tenue`). `couvre` : le tronc jusqu'au cou et les bras jusqu'au poignet, où le gant
(`vetement--gants`, dès |x| = 0,65, base) prend le relais. Le col, sur le cou, ne le couvre pas : sa nuque reste ouverte
sous les cheveux."""

MATERIAUX = {
    'chemise': ('vet2', 'toile-ecrue'),
    'col': ('accent', 'toile-ecrue'),
}
"""Illustration : toile blanche, col rouge. `vet2` (écru au preset `soldat`), l'emplacement du pourpoint, la palette
n'ayant que deux emplacements de vêtement et `vet1` portant le noir des crevés et des chausses ; le col prend `accent`
(rouge au preset). La même toile pour le col, teinte par la palette."""

BUDGET_TRIANGLES = 1200
"""Sous les 2 500 d'un vêtement (procédure, section 7) : le budget assemblé du Soldat est à sa limite (16 000) ; seuls
le col et l'avant-bras se voient, le reste est masqué par le pourpoint qui couvre torse et haut des bras."""

# --- Maillage ---
SEGMENTS_CORPS = 10                # HYPOTHÈSE de maillage : le corps est caché sous le pourpoint
SEGMENTS_COL = 14                  # HYPOTHÈSE de maillage : le col se voit tout autour du cou
SEGMENTS_MANCHE = 10               # pourpoint-matelasse
EPAISSEUR = 0.002                  # pourpoint-matelasse
DEGAGEMENT_MIN = 0.004             # HYPOTHÈSE : la toile au plus près, sous le pourpoint
LISSAGE_POIDS = 2                  # pourpoint-matelasse
BORNES_DES_CLES = (0.27, 2.5)      # pourpoint-matelasse

# --- Corps : anneaux horizontaux fermés (ancre, décalage, aisance) ; ancres : `bas` (bas du torse, z = 1,04, base),
# `aisselle` (bas du haut des bras, z = 1,37), `cou` (bas du cou, z = 1,53) ---
CORPS = [('bas', 0.03, 0.003), ('bas', 0.16, 0.006), ('aisselle', -0.05, 0.008), ('aisselle', 0.06, 0.008),
         ('cou', -0.03, 0.006)]
"""HYPOTHÈSE : ajustée, rentrée sous le haut-de-chausses (son haut à 1,085, base) dès 1,07 ; sous le pourpoint, à moins
de son aisance (`vetement--pourpoint`, 7 mm au moins). Elle s'arrête 3 cm sous le bas du cou, sous l'encolure du
pourpoint, où le col prend le relais : montée sur le cou, sa bande du haut s'étirait de 3,8 fois bras levés
(`arete-etiree`, Pistol_Aim)."""

# --- Col : bande droite sur le cou, du haut du corps au bord ---
COL = [('cou', 0.006, 0.005), ('cou', 0.030, 0.008), ('cou', 0.045, 0.010)]
"""(ancre, décalage, aisance). Illustration : le col rouge monte d'environ un tiers du cou au-dessus du plastron
(~25 px, ~5 cm) et s'évase un peu à son bord. Base : le cou va de 1,53 à 1,64 ; HYPOTHÈSE : le bord à 4,5 cm du bas
du cou, sous le menton, que le col touchait à 6 cm (`cle-non-suivie` sous `gabarit_head_plus`, 11 mm). Son pied, à 6 mm au-dessus
du bas du cou, sous l'encolure du pourpoint (à 15 mm, `vetement--pourpoint`)."""
ZONES_DU_COL = ['cou']
"""Les zones dont le col prend ses clés : le cou seul. Lié aussi au tronc, il ne suivait pas le cou qui grossit sous
`gabarit_head_plus` (`cle-non-suivie`, 11 mm)."""

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan),
# le kit des robes (`robe.manches`) ; l'épaule à 0, le coude à 1, le poignet du gant à 1,75 (base : gant dès |x| = 0,65) ---
MANCHE = [(-0.10, 0.006, 0.0), (0.30, 0.012, 0.0), (0.75, 0.012, 0.0), (1.00, 0.006, 0.0), (1.30, 0.032, 0.0),
          (1.47, 0.040, 0.0), (1.66, 0.024, 0.0), (1.82, 0.006, 0.0)]
"""Sous le mancheron du pourpoint jusqu'au coude, à 12 mm (le mancheron bouffe à 42 mm et se resserre à 16 mm au
coude) ; le bouffant de l'avant-bras commence au tiers de l'avant-bras : commencé plus près du coude, il passait devant
le bord du mancheron coude plié (`couche-traversee`, 12 à 15 mm, Lourde_Attaque, Melee_Hook) ; au-delà, illustration :
la manche bouffe sur l'avant-bras (~16 cm de large, 4 cm d'aisance) et se fronce au poignet sous le revers du gant
(dernier anneau à 1,82, 1,7 cm sous le bord du gant, à 6 mm)."""
COUPE_MIN = 0.06                   # pourpoint-matelasse
CREUX_DE_LA_RACINE = 0.0           # pourpoint-matelasse
RAYON_DE_COUPE_MAX = 0.12          # pourpoint-matelasse
ANGLE_DU_PAN = 170.0               # pourpoint-matelasse (aucun pan : sans effet)
INCLINAISON_DU_PAN = 20.0          # pourpoint-matelasse (aucun pan : sans effet)
RACCORD_EPAULE = 2.0               # pourpoint-matelasse : la manche entière emprunte au bras, sommet par sommet
COUPE_DES_POIDS = 0.7              # pourpoint-matelasse (sans effet : aucun anneau n'est pris d'un bloc)
