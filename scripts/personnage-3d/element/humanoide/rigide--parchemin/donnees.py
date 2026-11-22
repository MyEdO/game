"""Données de `humanoide--rigide--parchemin` (le Sorcier, #3844, #4351) : le parchemin roulé (`src/data/apparences.json`), forme des
trappings `parchemin` (LDB p.304) et `parchemin-de-sort`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : quatre rouleaux écrus glissés en travers de la
bandoulière, la feuille enroulée en spirale lisible en bout, chacun lié en son milieu d'une bande sombre ; le plus
lisible fait ~118 px de long et ~25 px de diamètre. Échelle relevée : environ 570 px/m (1,75 m de la semelle au sommet du
crâne, HYPOTHÈSE du contrat).

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
    'lien': ('cuir', 'cuir-tanne'),
}
"""Illustration : rouleaux écrus comme la robe de dessous du Sorcier (`vet2`), sans matière de parchemin au catalogue :
gris de construction. Le lien est une bande brun sombre (`cuir`)."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

RAYON = 0.02
LONGUEUR = 0.20
"""Illustration : ~118 px de long (20,7 cm), ~25 px de diamètre (4,4 cm) ; contrat : ~20 cm × 4 cm."""

SPIRE = {'tours': 3, 'coeur': 0.4, 'feuille': 0.002, 'segments': 10}
"""La feuille enroulée, vue en bout : `tours` spires du `coeur` (fraction du rayon) au rayon, d'une feuille épaisse de
`feuille`, `segments` côtés par tour. Illustration : deux à trois spires lisibles en bout ; HYPOTHÈSE pour l'épaisseur,
la moitié du pas, pour que la spirale se lise."""

LIEN = {'largeur': 0.016, 'saillie': 0.0015, 'segments': 10}
"""Illustration : une bande de ~9 px (1,6 cm) ceint le milieu du rouleau ; HYPOTHÈSE pour sa saillie sur la feuille."""

ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
