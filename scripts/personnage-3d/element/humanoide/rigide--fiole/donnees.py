"""Données de `humanoide--rigide--fiole` (le Sorcier, #3844, #4351) : la fiole bouchée (`src/data/apparences.json`), forme des
potions (`potion-*`, trappings `herbes-et-potions`).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : trois fioles sous les rouleaux de la bandoulière, des
tubes de verre droits (deux verts, un sombre) fermés à chaque bout d'une pièce sombre, bouchon d'un côté et culot de
l'autre, une bague sous le bouchon ; la plus lisible fait ~73 px de long (12,8 cm) et ~16 px de diamètre (2,8 cm), vue de
biais. Échelle relevée : environ 570 px/m (1,75 m de la semelle au sommet du crâne, HYPOTHÈSE du contrat).

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
    'fiole': ('accent', ((0.5, 0.5, 0.5), 0.0, 0.15)),
    'bouchon': ('cuir', 'cuir-tanne'),
}
"""Illustration : verre teinté (`accent`), sans matière de verre au catalogue : gris de construction, lisse. Bouchon,
bague et culot sombres (`cuir`)."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

RAYON = 0.012
LONGUEUR = 0.11
"""Contrat : tube de verre d'environ 10 cm ; illustration : 12,8 cm bouchon compris, 2,8 cm de diamètre, lus de biais.
HYPOTHÈSE : 11 cm bouchon et culot compris, 2,4 cm de diamètre."""

BOUCHON = {'longueur': 0.014, 'rayon': 0.75}
"""Illustration : un bouchon plus étroit que le tube dépasse de ~8 px (1,4 cm) ; `rayon` en fraction de celui du tube."""
BAGUE = {'longueur': 0.012, 'rayon': 1.15}
"""Illustration : une bague sombre de ~7 px (1,2 cm) sous le bouchon, et un culot de même au fond, qui débordent le
verre ; `rayon` en fraction de celui du tube (HYPOTHÈSE pour le débord)."""

SEGMENTS = 10
ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
