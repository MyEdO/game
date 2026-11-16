"""Données de `humanoide--vetement--bottines` (le Soldat, #4318), lues par `modele.py` : la variante `bottines` de la
pièce `bottes` de la garde-robe, que le preset `soldat` porte (le Sorcier et l'Apothicaire gardent la pièce `bottes`, le
Gladiateur sa variante `bottes-a-revers`).

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : des bottines basses de cuir fauve, au bout rond et bombé, à semelle mince, dont la tige souple monte
juste au-dessus de la cheville et s'affaisse en plis lâches, le bord roulé. Coutures et salissures omises (détail).
Échelle relevée sous la taille : ~453 px/m (`vetement--haut-de-chausses`) ; la tige monte ~80 px au-dessus du sol, ~0,18
m, la bottine fait ~60 px de large à la tige, ~13 cm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bottines'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['pied_g', 'pied_d'],
}
"""Le pied (base : de 0 à 0,147), que la bottine enferme ; le bas du mollet, qu'elle entoure aussi, reste aux bas."""

MATERIAUX = {'cuir': ('cuir', 'cuir-tanne')}
"""Illustration : cuir fauve (`cuir`, fauve au preset `soldat`)."""

BUDGET_TRIANGLES = 1200
"""Sous les 2 500 d'un vêtement (procédure, section 7) : le budget assemblé du Soldat est à sa limite (16 000)."""

PORTEUSES = {c: [f'pied_{c}', f'mollet_{c}'] for c in 'gd'}
"""Par pied, les zones que la bottine entoure : ses poids et ses clés en viennent."""

COLONNES = 14                      # HYPOTHÈSE de maillage : une colonne tous les ~26°, plis de la tige compris
RANGEES = [(0.004, 0.011), (0.02, 0.013), (0.045, 0.013), (0.07, 0.012), (0.095, 0.011), (0.12, 0.014),
           (0.145, 0.015), (0.165, 0.016), (0.18, 0.017)]
"""(z, aisance en m) des anneaux horizontaux, chacun autour du centre de sa coupe du pied et de la cheville : du bas, la
semelle débordant de 11 mm, l'empeigne bombée de 13 mm sur les orteils (illustration : bout rond et gros), au bord de la
tige à 0,18 (illustration : ~0,18 m). L'aisance de la tige passe au-dessus des
bas (`vetement--bas-de-chausses`, 4 mm et 2 mm d'épaisseur) et s'évase à peine vers le bord, qui s'affaisse
(illustration), pour que le bord retienne le bas à moins d'1 cm (`SERRAGE_M` de `hotes/godot/asset/pile.ts`) : évasé à
2,6 cm, il le laissait passer devant lui cheville fléchie (`couche-traversee`, 10 à 17 mm). HYPOTHÈSE de valeurs."""
SEMELLE = 0.0
"""z du milieu de la semelle, que ferme un éventail sous l'anneau du bas. Base : la plante est à 0."""
PLIS = (0.12, 0.004)
"""(z dès lequel, m) : les plis de la tige, une colonne sur deux rentrée de 4 mm vers la cheville. Illustration : la tige
souple s'affaisse en plis lâches ; HYPOTHÈSE de valeurs. Rentrée de 6 mm, la nappe intérieure passait sous le bas, qui
perçait la tige à la malléole."""
DEGAGEMENT_MIN = 0.006
EPAISSEUR = 0.003                  # HYPOTHÈSE : cuir lisible à taille de jeu, double nappe
LISSAGE_POIDS = 2                  # comme le pourpoint (`vetement--pourpoint`)
BORNES_DES_CLES = (0.27, 2.5)      # comme le pourpoint
