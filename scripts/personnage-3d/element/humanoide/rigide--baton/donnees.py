"""Données de `humanoide--rigide--baton` (le Sorcier, #3743) : le bâton de combat (`src/data/apparences.json`, maniement
`hampe`), possession `baton-de-combat` de Sorcier novice (LDB 08 l.2448).

Repère de la prise `main` de la base : origine sur la paume, +Y le long du fût vers la seconde prise, +X l'axe de la paume,
+Z du poignet vers les jointures. Toute dimension est en mètres et dit d'où elle vient ; l'illustration du Sorcier
(recueil `illustrations-wfrp`, `carrieres/sorcier.png`) ne montre pas de bâton : aucune mesure n'y est relevée.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'baton'},
    # La main libre à 0,5 m au-dessus de la prise, roulis -90° autour du +Y : la seconde prise du maniement `hampe`
    # (`SECONDES` de `scripts/personnage-3d/base/deux_mains.py`), où les clips `Hampe_*` posent la main gauche.
    'liaison': {'mode': 'rigide', 'secondePrise': {'position': [0, 0.5, 0], 'rotation': [0, -1.570796, 0]}},
}
PRISE = 'main'

MATERIAUX = {
    'bois': ('bois', ((0.46, 0.46, 0.46), 0.0, 0.87)),
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.4, 0.55)),
}

BUDGET_TRIANGLES = 1200          # procédure du skill, section 7 : rigide tenu

LONGUEUR = 1.80
"""HYPOTHÈSE : la hauteur du porteur environ (base humanoïde : 1,82 m) ; la possession ne donne pas de longueur."""

PRISE_DEPUIS_TALON = 0.60
"""HYPOTHÈSE : la main droite au tiers du fût. Mesuré sur la base r24 : le talon reste à 0,41 m du sol au plus bas en
`Hampe_Marche_Loop` et à 0,11 m en `Death01` ; à 0,80 m il passerait sous le sol en `Death01`."""

AXE_DANS_LA_PRISE = (-0.015, 0.015)
"""(x, z) du centre du plus grand passage libre commun aux deux poings fermés de la base r24, en `Hampe_Repos_Loop`, la
main gauche sur la seconde prise ; sur l'axe de la prise, la paume touche le fût."""

FUT = {'rayon': 0.015, 'segments': 12}
"""HYPOTHÈSE : 30 mm de diamètre, un bâton tenu à pleine main (hampe de la hallebarde : 35 mm, manche de la grande
hache : 40 mm)."""

BAGUES = {'rayon': 0.0175, 'hauteur': 0.04, 'recouvrement': 0.005, 'segments': 12}
"""HYPOTHÈSE : deux bagues de métal aux extrémités (contrat du Sorcier), 2,5 mm plus larges que le fût, 4 cm de haut ; le
bois entre de `recouvrement` dans chaque bague."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
