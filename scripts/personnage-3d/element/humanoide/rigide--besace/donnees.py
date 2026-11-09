"""Données de `humanoide--rigide--besace` (le Sorcier, #3743) : la besace (`src/data/apparences.json`), possession
`besace` (LDB 64 l.10 ; l.25-27 : « considéré comme « porté » si vous le mettez en bandoulière »).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : à la hanche droite, sous la ceinture, une besace de cuir
souple, bombée, à rabat arrondi tombant sur le devant. Échelle relevée : le personnage, de la pointe du capuchon aux
semelles, environ 960 px pour la hauteur de la base (1,82 m), soit environ 530 px/m.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine (la poignée) est sur l'emplacement ; la face
arrière de la boîte se pose à 5 cm de la peau. La besace pend donc sous l'origine (y > 0), son dos sur z = 0. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'besace'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.4, 0.55)),
}

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

LARGEUR = 0.22
"""Illustration : environ 115 px de large à la hanche, vue de trois quarts ; arrondi à 22 cm."""

HAUTEUR = 0.20
"""Illustration : environ 110 px du haut du rabat au fond ; 20 cm de corps sous les pattes d'attache."""

EPAISSEUR = 0.08
"""Illustration : besace bombée, environ 40 px de profil ; 8 cm au plus bombé."""

HAUT = 0.025
"""HYPOTHÈSE : le haut du corps 2,5 cm sous l'emplacement, pour que la besace pende sous la ceinture (illustration)."""

RAYON_DU_FOND = 0.075
"""Illustration : le fond est arrondi en demi-lune ; 7,5 cm de rayon aux coins du bas."""

ARRONDI = {'dos': 0.012, 'devant': 0.022, 'pas': 0.02}
"""HYPOTHÈSE : retraits du contour sur les faces arrière et avant (cuir souple, bords arrondis) ; `pas` : la profondeur sur
laquelle chaque face rejoint le plein contour."""

POINTS_DU_CONTOUR = 20

RABAT = {'tombe': 0.11, 'epaisseur': 0.004, 'debord': 0.004, 'resserre': 0.85}
"""Illustration : le rabat couvre le dessus et tombe sur la moitié haute du devant ; `tombe` sous le haut du corps,
`debord` de chaque côté, `resserre` la largeur à son bord bas."""

BOUTON = {'rayon': 0.008, 'saillie': 0.012, 'segments': 6}
"""HYPOTHÈSE : un bouton de métal au bas du rabat (l'illustration montre une attache, illisible)."""

PATTES = {'ecart': 0.065, 'largeur': 0.025, 'epaisseur': 0.004, 'au_dessus': 0.02}
"""HYPOTHÈSE : deux pattes de cuir montent du dos de la besace jusqu'à `au_dessus` de l'emplacement (la ceinture)."""

ECART = 10
"""Degrés dont le fond s'écarte du corps, autour de l'axe x de l'origine : rangée à `ceinture_d` de la base r24 sur la robe
publiée, une besace droite entre de 1,9 cm dans l'évasement de la robe à 20 cm sous l'emplacement (mesure du repère de
rangement de `mise_en_page.gd` contre la robe au repos) ; une besace pendue s'appuie sur la hanche et s'en écarte."""

ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
