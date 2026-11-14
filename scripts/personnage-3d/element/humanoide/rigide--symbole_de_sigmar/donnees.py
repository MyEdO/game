"""Données de `humanoide--rigide--symbole_de_sigmar` (le Prêtre, #3867) : le marteau de Sigmar
(`src/data/apparences.json`, forme `symbole_religieux`), apparence de l'objet `symbole-religieux` (LDB 302) du preset
`pretre`, rangé au cou (`cou`, rangement de son trapping). Arbitrage de Laurent, 2026-11-10 (#3867) : « Oui y a
l amulette qui a une forme et son livre de prière avec le symbole du dieu qui lui peut être un emblème » : le pendentif
est modelé, l'emblème va au livre.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre (x 300-480, y 380-460 px) : au milieu de la poitrine,
sous le col de fourrure, une tête de marteau d'argent à deux pans évasés en nœud papillon, un médaillon gravé au centre,
le bout du manche qui dépasse au-dessus et le manche qui pend dessous, sur un cordon qui monte vers le cou. Échelle
relevée : environ 433 px/m (du sommet du crâne, y ~290 px, aux plantes, y ~1078 px, pour les 1,82 m de la base).

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine est sur l'emplacement ; la face arrière se
pose sur ce qui est porté dessous (`MontageDeComposition._appuyer`). Le marteau pend sous l'origine (y > 0), sa face vers
+Z, son dos sur z = 0. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'symbole_de_sigmar'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.6, 0.45)),
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

TETE = {'largeur': 0.13, 'hauteur': 0.07, 'taille': 0.04, 'col': 0.022, 'epaisseur': 0.02}
"""Illustration et brief : la tête fait environ 13 × 7 cm ; ses deux pans s'évasent depuis un col central de `taille` de
haut et `col` de demi-largeur (HYPOTHÈSE, lu à environ 40 % de la hauteur des pans) ; `epaisseur` : HYPOTHÈSE, 2 cm, un
bloc lisible de profil."""

MEDAILLON = {'cote': 0.026, 'relief': 0.003}
"""Illustration : un médaillon gravé au centre de la tête ; simplifié en un carré de `cote` en relief léger."""

DESCENTE = 0.15
"""Le centre de la tête sous l'emplacement. Illustration : environ 65 px (15 cm) sous la base du cou."""

MANCHE = {'longueur': 0.08, 'depasse': 0.015, 'rayon': 0.008, 'pommeau': (0.011, 0.012), 'segments': 8}
"""Brief : un manche court d'environ 8 cm pend sous la tête ; illustration : son bout dépasse d'environ 7 px (1,5 cm)
au-dessus ; HYPOTHÈSE : 1,6 cm de diamètre, un pommeau (rayon, longueur) au bout bas."""

CORDON = {'rayon': 0.003, 'cotes': 5, 'ecart_haut': 0.06, 'au_dessus': 0.01}
"""Illustration : un cordon fin monte du bout du manche vers les côtés du cou, sous le col ; ses bouts à `ecart_haut` de
l'axe, `au_dessus` de l'emplacement. HYPOTHÈSE : 6 mm de diamètre, lisible à taille de jeu. Il ne fait pas le tour du
cou : l'hôte pose le marteau sur ce qui est porté (`_appuyer`), et une boucle derrière le cou le repousserait loin de la
poitrine."""


ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
