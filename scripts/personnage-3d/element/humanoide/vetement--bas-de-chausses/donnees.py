"""Données de `humanoide--vetement--bas-de-chausses` (le Soldat, #4318), lues par `modele.py` : la variante
`bas-de-chausses` de la pièce `bas` de la garde-robe, que le preset `soldat` porte (le Sorcier et l'Apothicaire gardent
la pièce `bas`).

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : des bas blancs, ajustés, du bandeau de la culotte au-dessus du genou jusqu'à la cheville, où ils
entrent dans les bottines ; un ruban noir les noue sous le genou gauche (`accessoire--ruban`). Plis d'usure et salissures
omis (détail, la couleur vient de la palette). Échelle relevée sous la taille : ~453 px/m (`vetement--haut-de-chausses`).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bas-de-chausses'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['genou_g', 'genou_d', 'mollet_g', 'mollet_d'],
}
"""Sous la culotte et les bottines (`tenue`). Le genou et le mollet (base : le mollet descend à 0,064, dans la bottine) ;
le pied est aux bottines."""

MATERIAUX = {'bas': ('vet2', 'laine')}
"""Illustration : laine blanche (`vet2`, écru au preset `soldat`)."""

BUDGET_TRIANGLES = 1200
"""Sous les 2 500 d'un vêtement (procédure, section 7) : le budget assemblé du Soldat est à sa limite (16 000)."""

PORTEUSES = {c: [f'cuisse_{c}', f'genou_{c}', f'mollet_{c}', f'pied_{c}'] for c in 'gd'}
"""Par jambe, les zones que le bas traverse : ses poids et ses clés en viennent."""

COLONNES = 14                      # HYPOTHÈSE de maillage : le bas est ajusté, sans relief
RANGEES = [0.68, 0.625, 0.57, 0.52, 0.44, 0.34, 0.25, 0.185, 0.14, 0.10]
"""z des anneaux horizontaux. Le haut à 0,68 : sous la culotte, 7 cm au-dessus de son bandeau (0,585 à 0,607,
`vetement--haut-de-chausses`), pour qu'il reste dessous genou plié. Le bas à 0,10 : dans la bottine (sa tige monte à
0,18, `vetement--bottines`), sous la cheville (base : tête du pied à 0,096). Rangées serrées au genou, qui plie, et
sous la tige de la bottine, où une rangée à son bord le retient sous elle cheville fléchie : sans elle, il passait
devant la tige (`couche-traversee`, 10 à 17 mm, Fixing_Kneeling, Slide_Exit)."""
AISANCE = 0.004
"""m, du corps (enveloppe convexe de la coupe). Illustration : bas tendus sur la jambe ; HYPOTHÈSE de valeur, au-dessus
de l'épaisseur."""
DEGAGEMENT_MIN = 0.004
EPAISSEUR = 0.002                  # HYPOTHÈSE : laine fine, double nappe
LISSAGE_POIDS = 2                  # comme le pourpoint (`vetement--pourpoint`)
BORNES_DES_CLES = (0.27, 2.5)      # comme le pourpoint
