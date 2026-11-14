"""Données de `humanoide--rigide--faux` (le Prêtre, #3867) : la faux (`src/data/apparences.json`, forme `improvisee`),
apparence de l'objet `arme-improvisee` du preset `pretre`, rangé à l'épaule droite (`epaule_d`) avec le bâton de combat.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre (lecture de Laurent, 2026-11-10, #3867 : « C est une
faux ça, elle commence en haut à gauche et fini au milieu à droite non ? ») : une faux portée en travers du dos, un manche
droit de bois sombre, nu, dont le bout dépasse en haut à gauche (x ≈ 15, y ≈ 265 px) derrière le rouleau de couchage,
jusqu'à une virole claire à la hanche gauche (x ≈ 630, y ≈ 640 px), d'où remonte une lame mince en croissant, le creux
tourné vers le manche. Aucune poignée ne se lit sur le manche : aucune n'est modelée. Échelle relevée : environ 433 px/m
(du sommet du crâne, y ~290 px, aux plantes, y ~1078 px, pour les 1,82 m de la base).

Repère de la prise `main` de la base (comme `rigide--baton`) : origine sur la paume, +Y le long du manche vers le fer, +X
l'axe de la paume, +Z du poignet vers les jointures, sens du tranchant d'une arme tenue (procédure du skill, section 5) :
la lame part du haut du manche vers +Z. Rangée, l'hôte la pose au dos sans écart cuit. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'faux'},
    'liaison': {'mode': 'rigide'},
}
"""Sans seconde prise : la forme `improvisee` n'a pas de maniement à deux mains dans les clips de la base
(`SECONDES` de `scripts/personnage-3d/base/deux_mains.py`)."""
PRISE = 'main'

MATERIAUX = {
    'bois': ('bois', ((0.46, 0.46, 0.46), 0.0, 0.87)),
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.6, 0.4)),
}

BUDGET_TRIANGLES = 1200          # procédure du skill, section 7 : rigide tenu

LONGUEUR = 1.5
"""Manche, virole comprise. Brief (HYPOTHÈSE de l'orchestrateur) : environ 1,5 m ; l'illustration en montre environ 720 px
du bout nu à la virole (1,66 m), vu en travers du dos, en perspective."""

PRISE_DEPUIS_TALON = 0.12
"""HYPOTHÈSE : la main près du bout nu, le fer à l'autre bout, comme on brandit une faux d'une main ; tenue au tiers
(0,55 m), le bout nu passait derrière la main dans la hanche en `Idle_Loop`."""

AXE_DANS_LA_PRISE = (-0.015, 0.015)
"""(x, z) du centre du plus grand passage libre du poing fermé de la base r24, mesuré pour le bâton
(`rigide--baton/donnees.py`)."""

MANCHE = {'rayon': 0.015, 'segments': 10}
"""Illustration : environ 12 px de diamètre (2,8 cm) ; 3 cm, le fût du bâton, qui tient dans le poing de la base."""

VIROLE = {'rayon': 0.018, 'hauteur': 0.04}
"""Illustration : une virole claire au bout du manche, environ 15 px de large et 18 px de long ; 3,6 × 4 cm."""

LAME = {'longueur': 0.57, 'rayon': 0.38, 'angle': 80, 'largeur': 0.06, 'pointe': 0.006, 'epaisseur': 0.003,
        'segments': 16, 'ancrage': 0.02}
"""Brief : une lame en croissant d'environ 55 à 60 cm qui remonte depuis la virole. HYPOTHÈSE : `longueur` d'arc sur un
cercle de `rayon` 38 cm (environ 86°), partie d'`ancrage` sous le haut du manche à `angle` degrés du manche (vers +Z,
penchée vers le talon), son creux, le fil, tourné vers le manche ; `largeur` au talon de la lame, effilée jusqu'à
`pointe` ; illustration : environ 25 px de large près de la virole (6 cm)."""


ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
