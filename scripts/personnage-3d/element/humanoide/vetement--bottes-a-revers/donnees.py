"""Données de `humanoide--vetement--bottes-a-revers` (le Gladiateur, #4394, contrat du 2026-11-22), lues par `modele.py` :
la variante `bottes-a-revers` de la pièce `bottes` de la garde-robe, que porte le preset `gladiateur` (le Sorcier et
l'Apothicaire gardent la pièce `bottes`).

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02 (#4394), 773 × 1257 px, hors dépôt.

Ce qu'elle montre : des bottes de cuir brun souple, au bout rond, à talon bas, dont la tige s'affaisse en plis
horizontaux à la cheville et monte sous le genou, où elle se rabat en un large revers évasé (jambe gauche) ; à la jambe
droite, la blouse de la culotte retombe sur le haut de la botte. Omis (contrat) : le petit crâne du revers. Échelle :
~580 px/m (`vetement--haut-de-chausses-ample`) ; à la jambe gauche, levée et en raccourci, le revers fait ~85 px de
haut, ~0,15 m, et ~115 à 130 px de large, ~0,20 à 0,22 m, sur un mollet de ~0,125 m (base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bottes-a-revers'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['pied_g', 'pied_d', 'mollet_g', 'mollet_d'],
}
"""Le pied (base : de 0 à 0,147) et le mollet (base : de 0,064 à 0,522), que la tige enferme jusqu'au pli du revers, à
0,493, sous la tête du tibia (base : 0,552) ; au-dessus, le haut du mollet est sous la blouse de la culotte du preset
(`vetement--haut-de-chausses-ample`). Laissé au corps, le mollet passait devant la tige sous `carrure_plus`
(`couche-traversee`, 2 à 4 sommets, 7 à 15 mm, 54 clips dont Walk_Loop)."""

MATERIAUX = {'cuir': ('cuir', 'cuir-tanne')}
"""Illustration : cuir brun (`cuir`, brun au preset `gladiateur`)."""

BUDGET_TRIANGLES = 1550
"""Sous les 2 500 d'un vêtement (procédure, section 7)."""

PORTEUSES = {c: [f'pied_{c}', f'mollet_{c}', f'genou_{c}'] for c in 'gd'}
"""Par pied, les zones que la botte entoure : ses poids et ses clés en viennent. Le genou : sa zone commence à 0,485
(base), sous le haut de la tige."""

COLONNES = 12                      # HYPOTHÈSE de maillage : une colonne tous les 30°
PIED = [(0.004, 0.010), (0.03, 0.013), (0.065, 0.013), (0.10, 0.011), (0.14, 0.014)]
"""(z, aisance en m) des anneaux du pied et de la cheville, chacun autour du centre de sa coupe, sur l'ellipse de sa
boîte ou son appui (`tissu.anneau`) : la semelle débordant de 10 mm, l'empeigne bombée de 13 mm sur les orteils
(illustration : bout rond). HYPOTHÈSE de valeurs, celles des bottines du Soldat (`vetement--bottines`)."""
TIGE = [(0.18, 0.022), (0.215, 0.009), (0.25, 0.021), (0.30, 0.010), (0.36, 0.017), (0.42, 0.010), (0.485, 0.011)]
"""(z, aisance en m) des anneaux de la tige, sur l'enveloppe convexe de leur coupe. Illustration : la tige s'affaisse en
bourrelets au-dessus de la cheville et au mollet, puis monte sous le genou. Base : la tête du tibia (os `calf`) à
0,552, le genou dès 0,485 ; le haut de la tige à 0,485. À 0,515, pli à 0,524, 2 à 4 sommets du haut de la botte
passaient devant la blouse de la culotte (`vetement--haut-de-chausses-ample`) genou plié (`couche-traversee`, 10 mm,
38 clips ; 17 mm sous `carrure_plus`, 56 clips) ; à 0,50, encore 14 mm sous `carrure_plus` (Walk_Loop). HYPOTHÈSE de valeurs des bourrelets."""
PLI_DU_REVERS = (0.493, 0.022)
"""(z, aisance en m) de l'anneau où la tige se rabat. HYPOTHÈSE : le pli à 8 mm au-dessus du haut de la tige."""
REVERS = [(0.465, 0.024), (0.43, 0.034), (0.38, 0.048)]
"""(z, aisance en m) des anneaux du revers, qui redescend par-dehors. Illustration (jambe gauche) : un revers haut de
~0,12 à 0,15 m, évasé vers le bas, ~0,20 à 0,22 m de large sur un mollet de ~0,125 m, décollé de la tige de 3,5 cm à son
bord. Son haut sous la blouse de la culotte (`SUR_LE_REVERS` de `vetement--haut-de-chausses-ample`), son bas dessous."""
SEMELLE = 0.0
"""z du milieu de la semelle, que ferme un éventail sous l'anneau du bas. Base : la plante est à 0. Le talon bas de
l'illustration n'est pas détaché de la semelle : la plante du corps pose à 0, un talon passerait sous le sol."""
DEGAGEMENT_MIN = 0.006
EPAISSEUR = 0.003                  # HYPOTHÈSE : cuir lisible à taille de jeu, double nappe
LISSAGE_POIDS = 2                  # comme les bottines du Soldat (`vetement--bottines`)
BORNES_DES_CLES = (0.27, 2.5)      # comme les bottines du Soldat
