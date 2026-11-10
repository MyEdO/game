"""Données de `humanoide--rigide--parchemin` (le Sorcier, #3844) : le parchemin roulé (`src/data/apparences.json`), forme des
trappings `parchemin` (LDB p.304) et `parchemin-de-sort`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : des rouleaux écrus glissés en travers de la bandoulière,
~15-18 px de diamètre (3 cm) et 50-65 px de long (11-13 cm). Échelle relevée : environ 530 px/m.

Repère de la prise `main` de la base, qui est aussi celui du rangement (section « Atelier 3D » du contrat du pont) :
rangé, +Y suit le bas de l'emplacement, +Z sort sur sa normale, l'origine sur l'emplacement ; la face arrière se pose sur
ce qui est porté dessous. Le rouleau est centré sur l'origine, le long de +Y, son dos sur z = 0. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'parchemin'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'parchemin': ('vet2', ((0.8, 0.78, 0.72), 0.0, 0.9)),
}
"""Illustration : rouleaux écrus comme la robe de dessous du Sorcier (`vet2`). Gris de construction."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

RAYON = 0.015
LONGUEUR = 0.12
"""Illustration : 3 cm de diamètre, 12 cm de long (moyenne des quatre rouleaux lisibles)."""

ENROULEMENT = 0.4
"""HYPOTHÈSE : le cœur du rouleau, en fraction du rayon, en retrait de `RETRAIT` aux deux bouts : il se lit roulé."""
RETRAIT = 0.003

SEGMENTS = 8
ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
