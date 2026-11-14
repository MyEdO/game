"""Données de `humanoide--rigide--herbes` (le Prêtre, #3867) : le bouquet d'herbes (`src/data/apparences.json`), forme des
herbes du jeu (`soude-commune`, LDB p. 307, et les six autres), rangé par le preset `pretre` à la hanche droite
(`ceinture_d`).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre : une poignée de brins verts glissés sous la cordelière au
flanc droit (les tiges entrent sous la corde vers x ≈ 336, y ≈ 665 px), qui retombent en éventail vers l'extérieur et le
bas jusqu'à x ≈ 45, y ≈ 830 px ; chaque brin, une tige fine aux feuilles étroites et serrées, alternées, plus courtes vers
la pointe. Échelle relevée : environ 433 px/m (`rigide--faux`) ; elle donnerait des brins de 0,6 m, l'illustration
grandissant ce qu'elle met en avant : longueurs HYPOTHÈSES d'un bouquet tenu en main.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`rigide--bourse`) : rangé, +Y descend le long du
corps, +Z sort sur la normale de l'emplacement, +X va vers l'arrière à la hanche droite ; l'origine (le lien des tiges) est
sur l'emplacement. Tenu, la main serre le lien. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'herbes'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'vegetal': ('vegetal', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}
"""Tiges et feuilles du même vert (`vegetal`, emplacement de palette des herbes, #3867). Gris de construction."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

DEPASSE = 0.03
"""HYPOTHÈSE : les bouts coupés des tiges dépassent au-dessus du lien, sous la corde (y < 0)."""

TIGES = [
    # (longueur, vers l'arrière en degrés, vers l'extérieur en degrés)
    (0.26, 10, 22),
    (0.23, -12, 28),
    (0.21, 28, 18),
    (0.19, -2, 38),
    (0.17, 40, 30),
]
"""Les brins, mesurés du lien : leur direction part de +Y (le bas), tournée vers +X (l'arrière) puis vers +Z (l'extérieur).
Illustration : l'éventail s'ouvre vers l'extérieur et le bas. HYPOTHÈSE : penchés de 18 à 38° seulement, et vers l'arrière,
pour laisser la main qui pend le long de la cuisse."""
COURBURE = 0.12
"""HYPOTHÈSE : la pointe de chaque brin retombe, en fraction de sa longueur, vers +Y."""
RAYON_TIGE = 0.0022
COTES_TIGE = 3
POINTS_TIGE = 4

FEUILLES = {'depuis': 0.3, 'paires': 5, 'longueur': (0.034, 0.018), 'largeur': 0.007, 'epaisseur': 0.0012, 'angle': 50.0}
"""HYPOTHÈSE : `paires` paires de feuilles alternées de `depuis` (fraction du brin) à la pointe, chacune à `angle` degrés de
la tige, de la première longueur à la seconde."""

ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
