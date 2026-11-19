"""Données de `humanoide--rigide--pilon_et_mortier` (l'Apothicaire, #4261) : le pilon et le mortier
(`src/data/apparences.json`), forme du trapping `pilon-et-mortier` (LDB p. 303), possession d'Apprenti apothicaire
(`careerLevels.json`, `apothicaire-1`).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Apothicaire | apothicaire |
`carrieres/apothicaire.png` | Livre de Base | 87 | certaine » (hors dépôt). Ce qu'elle montre à la hanche gauche, à côté du
sac clouté : un bol rond cerclé de métal et, pendu sous lui, un long cône clair au bout cerclé de métal (HYPOTHÈSE de
lecture, #4261 : le mortier et son pilon). Échelle relevée : environ 600 px/m ; le bol fait ~50 px de large, le cône
~150 px de long. Toutes les autres cotes sont des HYPOTHÈSES.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`rigide--bourse`) : rangé, +Y descend le long du
corps, +Z sort sur la normale de l'emplacement, l'origine (la boucle de la sangle) est sur l'emplacement ; le dos du
mortier se pose sur ce qui est porté dessous. Le mortier pend sous l'origine (y > 0), l'ouverture en haut, le pilon dressé
dedans. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'pilon_et_mortier'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'bois': ('bois', 'bois-chene'),
    'metal': ('metal', 'acier-battu'),
    'cuir': ('cuir', 'cuir-tanne'),
}
"""Le mortier et le pilon de bois tourné (`bois`), leurs cerclages de métal (`metal`), la sangle de cuir (`cuir`). Gris de
construction."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

SEGMENTS = 12

SOUS_L_ORIGINE = 0.035
"""HYPOTHÈSE : l'ouverture du mortier pend 3,5 cm sous la boucle de la sangle."""
MORTIER = [(0.0, 0.040), (0.006, 0.043), (0.050, 0.038), (0.062, 0.030), (0.068, 0.030), (0.070, 0.0)]
"""Profil extérieur (profondeur sous l'ouverture, rayon) : la lèvre, la panse qui se resserre, le pied. Illustration : un
bol de ~8,5 cm de diamètre (50 px) ; HYPOTHÈSE : 7 cm de haut."""
PAROI = 0.008
"""HYPOTHÈSE : épaisseur de la paroi ; le creux descend à `PROFONDEUR_DU_CREUX` sous l'ouverture."""
PROFONDEUR_DU_CREUX = 0.045
CERCLE = {'profondeur': 0.012, 'rayon': 0.0425, 'section': 0.003, 'segments': 16, 'cotes': 4}
"""Illustration : le bol est cerclé de métal sous la lèvre."""

PILON = [(0.0, 0.0), (0.0, 0.016), (0.03, 0.017), (0.09, 0.011), (0.16, 0.009), (0.17, 0.0)]
"""Profil du pilon (le long de son axe depuis la tête qui pile, rayon). Illustration : le cône clair de ~150 px, 25 cm,
dont le bout s'évase ; HYPOTHÈSE : 17 cm, la longueur d'un pilon de mortier de 7 cm, tête de 3,2 cm."""
VIROLE = {'depuis': 0.135, 'jusqu_a': 0.155, 'rayon': 0.0105}
"""Illustration : le bout du cône est cerclé de métal."""
PILON_INCLINE = 25.0
"""HYPOTHÈSE : degrés d'inclinaison du pilon dans le mortier, vers l'avant (+Z) depuis la verticale."""
PILON_ENFONCE = 0.035
"""La tête du pilon repose `PILON_ENFONCE` sous l'ouverture, au fond du creux moins son rayon."""

SANGLE = {'largeur': 0.012, 'epaisseur': 0.003, 'ecart': 0.025}
"""HYPOTHÈSE : deux brins de sangle de cuir montent de la lèvre, de part et d'autre (`ecart` en x), jusqu'à l'origine."""

ANGLE_LISSE = 50                 # degrés : arêtes plus vives que cet angle gardées vives
