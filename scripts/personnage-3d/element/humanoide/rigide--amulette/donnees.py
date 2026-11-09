"""Données de `humanoide--rigide--amulette` (le Sorcier, #3743) : l'amulette (`src/data/apparences.json`), possession
`amulette` (LDB 65 l.9).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : un médaillon rond de bronze, à bord relevé, pendu à un
cordon sous le devant de la ceinture. La flèche gravée au champ est un emblème : elle n'est pas modelée (procédure du
skill, section 2), le champ reste uni. Échelle relevée : le personnage, de la pointe du capuchon aux semelles, environ
960 px pour la hauteur de la base (1,82 m), soit environ 530 px/m.

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
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.6, 0.45)),
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

RAYON = 0.03
"""Illustration : environ 32 px de diamètre ; 6 cm."""

EPAISSEUR = 0.006
"""HYPOTHÈSE : 6 mm au bord, un médaillon frappé épais, lisible de profil."""

BORD = {'largeur': 0.005, 'creux': 0.0015}
"""Illustration : un bord relevé autour du champ ; le champ en retrait de `creux`."""

SEGMENTS = 16

DESCENTE = 0.12
"""Le centre du médaillon sous l'emplacement. Illustration : environ 65 px (12 cm) sous la ceinture."""

BELIERE = {'rayon': 0.005, 'section': 0.0015, 'segments': 6, 'cotes': 3}
"""HYPOTHÈSE : l'anneau qui passe le cordon au sommet du médaillon."""

CORDON = {'rayon': 0.0018, 'cotes': 4, 'au_dessus': 0.015}
"""HYPOTHÈSE : un cordon de cuir monte de la bélière jusqu'à `au_dessus` de l'emplacement (la ceinture)."""


ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
