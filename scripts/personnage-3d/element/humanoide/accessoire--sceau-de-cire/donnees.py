"""Données de `humanoide--accessoire--sceau-de-cire` (le Prêtre, #3867) : la pièce `sceau-de-cire` de la garde-robe, cire
et bandes de parchemin, posée sur la bure sous la cordelière.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre : une feuille de parchemin écrue glissée sous la cordelière,
devant, un peu à droite du milieu (x ≈ 280 à 440 px, y ≈ 642 à 825 px), le haut pris sous la corde, le bas déchiré, le
coin bas gauche relevé ; au bord droit du personnage, vers le bas, un sceau de cire rouge rond (≈ 30 px), d'où pend une
bande de parchemin écrite (≈ 20 px de large, 125 px de long) qui finit en queue d'aronde. Échelle relevée : environ
433 px/m (`rigide--faux`) ; elle donnerait une feuille de 0,37 × 0,42 m sur un ventre deux fois plus large que celui de la
base : dimensions HYPOTHÈSES, ramenées à la proportion du ventre.

Liaison de surface, comme les bouts de la cordelière : feuille et bande couchées sur la bure publiée, sous la corde, chaque
sommet aux poids de la bure sous lui ; le sceau prend en bloc ceux de la bure sous son centre. Pendue rigide à un os de la
jupe, la feuille entrait dans la bure qui s'évase sous la corde (capture du preset `pretre`, corpulence 0,6), sceau et
bande cachés dedans. Silhouettes et clés `gabarit_*` transférées de la bure publiée.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x) ; un azimut se compte depuis le devant, positif vers la gauche du personnage, autour de l'axe du corps à la corde.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'sceau-de-cire'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, celle de la cordelière : par-dessus la bure, qui lui cède."""

MATERIAUX = {
    'parchemin': ('corne', ((0.8, 0.78, 0.72), 0.0, 0.9)),
    'cire': ('accent', ((0.5, 0.5, 0.5), 0.0, 0.5)),
    'encre': (None, ((0.02, 0.015, 0.01), 0.0, 0.8)),
}
"""Illustration : parchemin écru, l'emplacement `corne` des pages du livre (`rigide--livre`) ; cire rouge, l'emplacement
`accent` du preset (`tissu-rouge`). Gris de construction. L'encre, brun noir, n'a pas d'emplacement : sa couleur est
celle du GLB."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire

CONTOURNE = {'bure': 'humanoide--vetement--bure', 'cordeliere': 'humanoide--accessoire--cordeliere'}
"""La bure publiée porte la pièce (poids et clés) ; la corde publiée en donne la hauteur."""
MATIERES = {'bure': ['robe'], 'cordeliere': ['corde']}
ZONES = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']   # comme la cordelière : zones que la feuille et la bande couvrent
ZONES_DE_LA_BURE = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']

EMPLACEMENT = 'ceinture_avant_d'
"""L'emplacement de la pièce (`src/data/garde-robe.json`), offert (`Base.offrir`) sur la face extérieure de la corde, au
milieu de la feuille : +Y vers le haut, +Z sortant, +X vers la gauche du personnage."""
AZIMUT = -20.0
"""Degrés : le milieu de la feuille, un peu à droite du milieu du devant, comme dans l'illustration."""
TRANCHE = 10.0                   # degrés : les sommets de la corde, de part et d'autre de `AZIMUT`, qui en donnent la hauteur
TRANCHE_DU_CORPS = 0.02
"""m : la coupe du corps, autour de la hauteur médiane de la corde, dont le milieu est le centre des azimuts, comme l'axe
de la cordelière (le milieu de ses sommets, nœud et bouts compris, tombait à 8 cm à gauche)."""
PORTEE = 0.6                     # m : départ des visées vers la bure, depuis le centre de la corde (comme la cordelière)

FEUILLE = {'largeur': 0.2, 'hauteur': 0.25, 'au_dessus': 0.025, 'epaisseur': 0.002, 'jeu': 0.002,
           'colonnes': 8, 'rangs': 10}
"""HYPOTHÈSES : la feuille, de `au_dessus` de la corde à `hauteur - au_dessus` dessous, sa face à `jeu + epaisseur` de la
bure, sous la corde (la cordelière à 6 mm, `JEU`). Illustration : largeur sur hauteur ≈ 0,87."""
DECHIRURES = [0.0, 0.014, 0.004, 0.02, 0.008, 0.0, 0.016, 0.006, 0.012]
"""HYPOTHÈSE : retrait du bord bas, m, à chaque colonne de la feuille, de la gauche du personnage à sa droite : le bas
déchiré de l'illustration."""
COIN_RELEVE = 0.012
"""HYPOTHÈSE : le coin bas du côté gauche du personnage s'écarte de la bure de cette hauteur, comme dans l'illustration."""

SCEAU = {'droite': 0.085, 'sous': 0.19, 'rayon': 0.022, 'epaisseur': 0.006, 'segments': 12}
"""Le sceau, au bord droit de la feuille (`droite`, m, le long de la bure depuis son milieu), `sous` la corde.
Illustration : ≈ 30 px pour 160 px de feuille, soit 0,19 de sa largeur (0,04 m de diamètre pour 0,2 m) ; HYPOTHÈSE : un
disque bombé de 6 mm, son cachet en creux."""
CACHET = {'rayon': 0.6, 'creux': 0.0015}
"""HYPOTHÈSE : l'empreinte au milieu de la cire, en fraction du rayon, et sa profondeur."""

RUBAN = {'longueur': 0.12, 'largeur': 0.026, 'epaisseur': 0.0015, 'jeu': 0.001, 'derive': 0.025, 'aronde': 0.012,
         'segments': 4}
"""Bande de parchemin qui pend sous le sceau, à `jeu` sur la feuille. Illustration : ≈ 20 px de large, 125 px de long, la
queue d'aronde en bas ; HYPOTHÈSE : raccourcie à 0,12 m sous le sceau pour laisser les cuisses, et sa pointe dérive de
`derive` vers la droite du personnage."""

ECRITURE = {'sous': 0.035, 'interligne': 0.017, 'trait': 0.0035, 'marge': 0.014, 'espace': 0.006, 'jeu': 0.001,
            'autour': 0.006}
"""Les lignes d'écriture de la feuille et de la bande (Clément, 2026-11-14, #3867 : « Et le papier blanc, il n est pas
sensé avoir des écritures desssu ? ») : chaque mot un trait d'encre de `trait` de haut, à `jeu` au-dessus du parchemin ;
sur la feuille, la première ligne `sous` la corde, une ligne par `interligne`, de la `marge` droite du personnage à sa
`marge` gauche, chaque mot à `espace` du précédent, qui saute le sceau et la bande à `autour` près et s'arrête à la marge.
Illustration : des lignes manuscrites sombres sur toute la feuille et le long de la bande ; HYPOTHÈSE : les longueurs."""
LIGNES = [
    [0.03, 0.018, 0.026, 0.014, 0.03, 0.02],
    [0.022, 0.03, 0.012, 0.026, 0.02, 0.024],
    [0.016, 0.028, 0.02, 0.03, 0.018, 0.022],
    [0.03, 0.014, 0.024, 0.02, 0.026, 0.018],
    [0.02, 0.026, 0.03, 0.016, 0.022, 0.026],
    [0.026, 0.018, 0.022, 0.028, 0.02],
    [0.014, 0.03, 0.02, 0.024, 0.018],
    [0.028, 0.016, 0.026, 0.022],
    [0.02, 0.024, 0.018, 0.026],
]
"""HYPOTHÈSE : la longueur de chaque mot, m, ligne par ligne, de haut en bas ; une ligne s'arrête au premier mot qui passerait
la marge."""
LIGNES_DU_RUBAN = {-0.0055: [0.02, 0.016, 0.022], 0.0055: [0.018, 0.024, 0.014]}
"""HYPOTHÈSE : par décalage (m) depuis le milieu de la bande, vers la gauche du personnage, les mots qui la descendent
depuis le bas du sceau (`ECRITURE['autour']` sous lui), jusqu'à la queue d'aronde."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
