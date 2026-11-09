"""Données de `humanoide--rigide--bourse` (le Sorcier, #3743) : la bourse (`src/data/apparences.json`), possession
`bourse` (LDB 64 l.11).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Elle ne montre aucune bourse lisible : la forme est celle d'une bourse à
cordon, petite poche de cuir froncée au col, toutes dimensions HYPOTHÈSES à trancher en revue.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine (la poignée) est sur l'emplacement ; la face
arrière de la boîte se pose à 5 cm de la peau. La bourse pend sous l'origine (y > 0), son dos sur z = 0. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'bourse'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

PROFIL = [(0.012, 0.0), (0.014, 0.016), (0.026, 0.011), (0.032, 0.012), (0.055, 0.034), (0.085, 0.042), (0.112, 0.036),
          (0.127, 0.018), (0.132, 0.0)]
"""HYPOTHÈSE : profil de révolution (y sous l'origine, rayon) : la fronce évasée au-dessus du col, le col serré à 2,6 cm,
la panse de 8,4 cm de diamètre, le fond arrondi ; 12 cm de haut sous l'emplacement."""

APLATI = 0.7
"""HYPOTHÈSE : la panse aplatie contre le corps (épaisseur sur z = 70 % du diamètre)."""

SEGMENTS = 10

CORDON = {'y': 0.029, 'rayon': 0.0125, 'section': 0.0025, 'segments': 8, 'cotes': 4}
"""HYPOTHÈSE : le cordon noué autour du col."""

ATTACHE = {'ecart': 0.008, 'largeur': 0.006, 'epaisseur': 0.003, 'au_dessus': 0.02}
"""HYPOTHÈSE : la boucle du cordon qui monte du col jusqu'à `au_dessus` de l'emplacement (la ceinture)."""

ECART = 8
"""Degrés dont le fond s'écarte du corps, autour de l'axe x de l'origine : rangée droite à `ceinture_avant` de la base r24
sur la robe publiée, la panse affleure la robe (jeu 1 mm à 8 cm sous l'emplacement, repère de rangement de
`mise_en_page.gd` contre la robe au repos)."""

ANGLE_LISSE = 60                 # degrés : arêtes plus vives que cet angle gardées vives
