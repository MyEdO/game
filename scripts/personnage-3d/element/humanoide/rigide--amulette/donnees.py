"""Données de `humanoide--rigide--amulette` (le Sorcier, #3743, #4351) : l'amulette (`src/data/apparences.json`), possession
`amulette` (LDB 65 l.9).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : un médaillon rond de cuivre, à bord relevé, un jonc autour du
champ, pendu à un cordon tressé sous le devant de la ceinture, à droite de la boucle. La flèche gravée au champ est un
emblème : elle n'est pas modelée (procédure du skill, section 2), le champ reste uni. Échelle relevée : environ
570 px/m (1,75 m de la semelle au sommet du crâne, HYPOTHÈSE du contrat).

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine (la poignée) est sur l'emplacement ; la face
arrière se pose sur ce qui est porté dessous (`MontageDeComposition._appuyer`). Le médaillon pend sous l'origine (y > 0), sa face vers +Z. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'amulette'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'metal': ('metal', 'laiton-dore'),
    'cordon': ('cuir', 'corde'),
}
"""Illustration : médaillon de cuivre, sans matière de cuivre au catalogue : le laiton, à l'emplacement `metal` ; cordon
tressé (`corde`), à l'emplacement `cuir`."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

RAYON = 0.03
"""Illustration : environ 34 px de diamètre ; 6 cm (contrat : ~6 cm)."""

EPAISSEUR = 0.006
"""HYPOTHÈSE : 6 mm au bord, un médaillon frappé épais, lisible de profil."""

BORD = {'largeur': 0.005, 'creux': 0.0015}
"""Illustration : un bord relevé autour du champ ; le champ en retrait de `creux`."""

JONC = {'rayon': 0.017, 'largeur': 0.003}
"""Illustration : un jonc en relief cerne le signe, à ~10 px du centre (1,7 cm) ; il remonte au niveau du bord."""

SEGMENTS = 16

DESCENTE = 0.12
"""Le centre du médaillon sous l'emplacement. Illustration : environ 68 px (12 cm) sous le bas de la ceinture."""

BELIERE = {'rayon': 0.007, 'section': 0.002, 'segments': 6, 'cotes': 3}
"""HYPOTHÈSE : l'anneau qui passe le cordon au sommet du médaillon, assez large pour lui."""

CORDON = {'brin': 0.0022, 'torsades': 4.5, 'points': 5, 'cotes': 4, 'au_dessus': 0.015}
"""Illustration : un cordon de deux brins tordus, d'environ 5 px (9 mm) de large, monte de la bélière jusqu'à
`au_dessus` de l'emplacement (la ceinture) ; plus fin, il ne se lisait plus à taille de jeu et le médaillon semblait
flotter sous la ceinture (Clément, 2026-11-09 : « a se demander si elles sont fixés dessus ou sur sa robe »). `brin` :
rayon d'un brin, autour de l'axe du cordon à la même distance ; `torsades` tours sur la longueur, `points` par tour
(HYPOTHÈSE de maillage)."""


ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
