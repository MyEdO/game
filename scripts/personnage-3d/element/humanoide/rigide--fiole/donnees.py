"""Données de `humanoide--rigide--fiole` (le Sorcier, #3844) : la fiole bouchée (`src/data/apparences.json`), forme des
potions (`potion-*`, trappings `herbes-et-potions`).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : trois fioles bouchées sous les rouleaux de la
bandoulière, ~10 px de diamètre (2 cm), ~40 px de long bouchon compris (7,5 cm). Échelle relevée : environ 530 px/m.

Repère de la prise `main` de la base, qui est aussi celui du rangement (section « Atelier 3D » du contrat du pont) :
rangé, +Y suit le bas de l'emplacement, +Z sort sur sa normale, l'origine sur l'emplacement ; la face arrière se pose sur
ce qui est porté dessous. La fiole est centrée sur l'origine, glissée par le milieu dans sa case, le bouchon vers -Y, son
dos sur z = 0. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'fiole'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'fiole': ('accent', ((0.5, 0.5, 0.5), 0.0, 0.3)),
    'bouchon': ('cuir', ((0.45, 0.45, 0.45), 0.0, 0.9)),
}
"""Illustration : verre teinté (`accent`, le vert de la fiole verte), bouchon sombre (`cuir`). Gris de construction."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

RAYON = 0.0095
LONGUEUR = 0.07
BOUCHON = 0.018
"""Illustration : 2 cm de diamètre, 7 cm de long dont 1,8 cm de bouchon."""
COL = 0.6
"""HYPOTHÈSE : le col et le bouchon, en fraction du rayon de la panse."""

SEGMENTS = 8
ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
