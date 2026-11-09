"""Données de `humanoide--rigide--sac_de_couchage` (le Sorcier, #3743) : le sac de couchage (`src/data/apparences.json`),
possession `sac-de-couchage` (LDB 74 l.37, l.60).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : un rouleau de couchage en travers du haut du dos, posé
derrière les épaules, son bout gauche visible au-dessus de l'épaule, serré par des liens. Échelle relevée : le personnage,
de la pointe du capuchon aux semelles, environ 960 px pour la hauteur de la base (1,82 m), soit environ 530 px/m.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine (la poignée) est sur l'emplacement ; la face
arrière de la boîte se pose à 5 cm de la peau. À `dos`, le +X de ce repère est la gauche du personnage : le rouleau
couché suit l'axe x. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'sac_de_couchage'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'toile': ('vet2', ((0.7, 0.7, 0.7), 0.0, 0.92)),
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}
"""`SLOTS` n'a pas d'emplacement de couverture : `vet2`, l'écru du preset `sorcier`, proche du rouleau de l'illustration."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

LONGUEUR = 0.56
"""HYPOTHÈSE : la largeur des épaules de la base (articulations des bras à ±0,21 m) et un débord de chaque côté ;
l'illustration ne montre qu'un bout."""

RAYON = 0.085
"""Illustration : le bout du rouleau fait environ 90 px de diamètre ; 17 cm."""

HAUTEUR = -0.11
"""L'axe du rouleau 11 cm au-dessus de l'emplacement `dos` (y < 0 monte) : l'illustration le pose sur le haut du dos,
derrière les épaules. Mesuré au repos, rangé à `dos` de la base r24 (repère de rangement de `mise_en_page.gd`) : le
rouleau ne touche ni la robe ni la capuche publiées, son dos à 4,4 cm de la robe au plus près ; plus bas (-0,04 m), ce jeu
tombe à 2,1 cm mais le rouleau quitte les épaules."""

BOUT = {'creux': 0.012, 'bord': 0.92, 'cœur': 0.35, 'chanfrein': 0.01}
"""HYPOTHÈSE : chaque bout est légèrement creusé (`creux` au cœur, à `cœur` du rayon), son bord chanfreiné, pour lire
l'enroulement à taille de jeu sans spirale modelée."""

SEGMENTS = 12

LIENS = {'positions': (-0.18, 0.18), 'largeur': 0.025, 'epaisseur': 0.005, 'segments': 12}
"""Illustration : le rouleau serré par des liens ; deux sangles de cuir à 18 cm du milieu."""

ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
