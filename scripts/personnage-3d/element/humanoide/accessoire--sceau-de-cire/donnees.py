"""Données de `humanoide--accessoire--sceau-de-cire` (le Prêtre, #3867) : la pièce `sceau-de-cire` de la garde-robe, cire
et bandes de parchemin, posée à son emplacement `ceinture_avant`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre : une feuille de parchemin écrue glissée sous la cordelière,
devant, un peu à droite du milieu (x ≈ 280 à 440 px, y ≈ 642 à 825 px), le haut pris sous la corde, le bas déchiré, le
coin bas gauche relevé ; au bord droit du personnage, vers le bas, un sceau de cire rouge rond (≈ 30 px), d'où pend une
bande de parchemin écrite (≈ 20 px de large, 125 px de long) qui finit en queue d'aronde. Échelle relevée : environ
433 px/m (`rigide--faux`) ; elle donnerait une feuille de 0,37 × 0,42 m sur un ventre deux fois plus large que celui de la
base : dimensions HYPOTHÈSES, ramenées à la proportion du ventre.

Liaison rigide, comme les accessoires publiés `insigne` et `plumet` : le sceau se pose à un emplacement, et le même
élément servira aux sceaux posés ailleurs sur la tenue (#3874). Repère de la prise `main` de la base, qui est aussi celui
du rangement (`rigide--bourse`) : posé, +Y descend le long du corps, +Z sort sur la normale de l'emplacement, +X va vers la
droite du personnage ; l'origine (la corde) est sur l'emplacement ; le dos se pose sur ce qui est porté dessous. Mètres.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'sceau-de-cire'},
    'liaison': {'mode': 'rigide'},
    'couche': 'armure',
}
"""Couche `armure`, comme les accessoires rigides publiés : par-dessus la bure et la cordelière."""
PRISE = 'main'

MATERIAUX = {
    'parchemin': ('corne', ((0.8, 0.78, 0.72), 0.0, 0.9)),
    'cire': ('accent', ((0.5, 0.5, 0.5), 0.0, 0.5)),
}
"""Illustration : parchemin écru, l'emplacement `corne` des pages du livre (`rigide--livre`) ; cire rouge, l'emplacement
`accent` du preset (`tissu-rouge`). Gris de construction."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

FEUILLE = {'largeur': 0.2, 'hauteur': 0.25, 'au_dessus': 0.025, 'epaisseur': 0.002, 'rayon': 0.22,
           'colonnes': 8, 'rangs': 5}
"""HYPOTHÈSES : la feuille, de `au_dessus` de la corde à `hauteur - au_dessus` dessous ; cintrée autour du ventre (`rayon`,
m, de l'axe vertical) ; une double nappe de `epaisseur`. Illustration : largeur sur hauteur ≈ 0,87."""
DECHIRURES = [0.0, 0.014, 0.004, 0.02, 0.008, 0.0, 0.016, 0.006, 0.012]
"""HYPOTHÈSE : retrait du bord bas, m, à chaque colonne de la feuille (de -X à +X) : le bas déchiré de l'illustration."""
COIN_RELEVE = 0.012
"""HYPOTHÈSE : le coin bas du côté gauche du personnage (-X) se relève vers +Z de cette hauteur, comme dans l'illustration."""

SCEAU = {'x': 0.085, 'y': 0.19, 'rayon': 0.022, 'epaisseur': 0.006, 'segments': 12}
"""Le sceau, au bord droit du personnage, près du bas de la feuille. Illustration : ≈ 30 px pour 160 px de feuille, soit
0,19 de sa largeur (0,04 m de diamètre pour 0,2 m) ; HYPOTHÈSE : un disque bombé de 6 mm, son cachet en creux."""
CACHET = {'rayon': 0.6, 'creux': 0.0015}
"""HYPOTHÈSE : l'empreinte au milieu de la cire, en fraction du rayon, et sa profondeur."""

RUBAN = {'longueur': 0.12, 'largeur': 0.026, 'epaisseur': 0.0015, 'derive': 0.025, 'aronde': 0.012, 'segments': 4}
"""Bande de parchemin qui pend sous le sceau. Illustration : ≈ 20 px de large, 125 px de long, la queue d'aronde en bas ;
HYPOTHÈSE : raccourcie à 0,12 m sous le sceau pour laisser les cuisses, et sa pointe dérive de `derive` vers +X."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
