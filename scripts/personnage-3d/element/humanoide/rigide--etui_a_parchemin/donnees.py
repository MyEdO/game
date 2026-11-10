"""Données de `humanoide--rigide--etui_a_parchemin` (le Sorcier, #3743) : l'étui à parchemin (`src/data/apparences.json`),
possession `etui-a-parchemin` (LDB 64 l.14).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : à la hanche gauche, pendue à la ceinture, une liasse de
rouleaux de parchemin serrés par deux sangles de cuir, inclinée le haut vers l'avant, et une chaîne qui pend en boucle
sous la liasse. Échelle relevée : le personnage, de la pointe du capuchon aux semelles, environ 960 px pour la hauteur de
la base (1,82 m), soit environ 530 px/m.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine (la poignée) est sur l'emplacement ; la face
arrière se pose sur ce qui est porté dessous (`MontageDeComposition._appuyer`). À `ceinture_g`, le +X de ce repère est l'avant du personnage. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'etui_a_parchemin'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'parchemin': ('vet2', ((0.75, 0.75, 0.75), 0.0, 0.9)),
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.5, 0.5)),
}
"""`SLOTS` n'a pas d'emplacement de parchemin : `vet2`, l'écru du dessous de la robe du preset `sorcier`, comme sur
l'illustration."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

CENTRE = 0.17
"""Illustration : le haut des rouleaux à environ 30 px sous la ceinture, la liasse longue d'environ 150 px ; son milieu à
17 cm sous l'emplacement."""

INCLINAISON = 20
"""Illustration : la liasse penche d'environ 20° sur la verticale, le haut vers l'avant (+X)."""

ROULEAUX = [
    # (u, w, rayon, longueur, décalage le long de la liasse) ; u latéral, w sortant, avant inclinaison
    (-0.023, 0.024, 0.022, 0.27, -0.010),
    (0.023, 0.024, 0.024, 0.30, 0.015),
    (0.0, 0.062, 0.020, 0.24, -0.025),
]
"""Illustration : deux rouleaux lisibles, un troisième derrière ; environ 25 px de diamètre (4,5 cm) et 130 à 160 px de long."""

SEGMENTS_ROULEAU = 8

SANGLES = {'positions': (-0.07, 0.06), 'rayon': 0.053, 'epaisseur': 0.003, 'largeur': 0.025, 'segments': 8,
           'centre': (0.0, 0.040)}
"""Illustration : deux sangles de cuir autour de la liasse, l'une au tiers haut, l'autre au tiers bas ; `centre` (u, w) de
la liasse, `rayon` qui l'enserre."""

CHAINE = {'depart': (0.045, 0.27, 0.03), 'controle': (-0.01, 0.40, 0.03), 'arrivee': (-0.075, 0.16, 0.03),
          'maillon': 0.012, 'section': 0.0022, 'pas': 0.024, 'segments': 6, 'cotes': 3}
"""Illustration : une chaîne pend en boucle sous la liasse, d'un point bas à l'avant vers l'arrière ; courbe de Bézier
(départ, contrôle, arrivée) après inclinaison. HYPOTHÈSE : maillons de 2,4 cm, grossis pour rester lisibles à taille de
jeu, alternés de 90°."""

ATTACHE = {'depuis': 0.06, 'au_dessus': 0.02, 'largeur': 0.022, 'epaisseur': 0.004}
"""HYPOTHÈSE : une patte de cuir monte de la sangle haute (`depuis` sous l'origine) jusqu'à `au_dessus` de l'emplacement
(la ceinture), où l'illustration montre la liasse glissée."""


ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
