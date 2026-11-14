"""Données de `humanoide--accessoire--cordeliere` (le Prêtre, #3867), lues par `modele.py` : la variante `cordeliere` de
la pièce `ceinture` de la garde-robe, liée en surface comme la ceinture publiée (`humanoide--accessoire--ceinture`).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre : une corde ronde, claire, serrée à la taille sur la bure,
sous le ventre, nouée devant ; le livre et la feuille de parchemin y pendent. Le dos ne se voit pas (HYPOTHÈSE : la
corde fait le tour, nue). Échelle relevée : environ 433 px/m (du sommet du crâne, y ~290 px, aux plantes, y ~1078 px,
pour les 1,82 m de la base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). La corde suit la coupe de la bure publiée par un plan presque horizontal, `PENTE` vers l'avant.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'cordeliere'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, la première au-dessus de `tenue` : la corde se porte par-dessus la bure, dont l'évaluateur mesure alors
qu'elle ne la traverse pas (comme `accessoire--bandouliere-a-parchemins` sur la robe)."""

MATERIAUX = {
    'corde': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}
"""Brief : palette `cuir`. Gris de construction."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

CONTOURNE = {'bure': 'humanoide--vetement--bure'}
"""La corde repose sur la bure du preset `pretre` : elle en emprunte les poids et les clés (ses meshes des zones
`ZONES_DE_LA_BURE`), comme la bandoulière sur la robe (`accessoire--bandouliere-a-parchemins/donnees.py`)."""
MATIERES_DE_LA_BURE = ['robe']
ZONES_DE_LA_BURE = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']
ZONES = ['torse', 'hanches', 'cuisse_g', 'cuisse_d']   # zones du corps que la corde et ses bouts traversent

EMPLACEMENT = 'ceinture_avant'
"""L'emplacement de la garde-robe que la corde offre, sur elle, au milieu du devant : la bourse du preset y pend ; offert
aussi par la bure dessous, il vient de la pièce montée la plus extérieure (procédure du skill, section 4)."""

HAUTEUR = 1.02
"""z du milieu de la corde sur le flanc. Illustration : la corde à environ 645 px, 0,82 m sous le sommet du crâne
(1,82 m) ; sous le ventre."""

PENTE = 0.03
"""HYPOTHÈSE : la corde descend de `PENTE` mètres de l'arrière à l'avant, sous le ventre rond (illustration : elle passe
sous lui)."""

RAYON = 0.0075                    # brief : corde ronde d'environ 1,5 cm de diamètre
COTES = 6                         # côtés de la section (HYPOTHÈSE de maillage)
SEGMENTS = 32                     # sections autour de la taille (HYPOTHÈSE de maillage)
JEU = 0.006
"""HYPOTHÈSE : l'intérieur de la corde à 6 mm de la bure, mesurés le long de chaque rayon de la coupe."""
LISSAGE_POIDS = 0
"""Les poids empruntés à la bure, sans lissage : sur la base #4002, la bure pend au filet `jupe` sous la taille, et ses
sommets passaient devant une corde aux poids lissés quand la hanche plie (porte, 7 clips accroupis ou roulés : 24 lignes
`couche-traversee` jusqu'à 19 mm à 2 passes, 17 lignes jusqu'à 12 mm sans lissage, 24 jusqu'à 14 mm à une passe)."""
PORTEE = 0.6                      # m : départ des visées vers la bure, depuis l'axe du corps

NOEUD = {'rayon': 0.016, 'longueur': 0.03, 'segments': 8, 'angle': 45}
"""Illustration : le nœud, un renflement d'environ 14 px (3,2 cm) ; HYPOTHÈSE : un fuseau de 3 cm de long, 1,6 cm de rayon,
couché le long de la corde, noué devant à gauche, `angle` degrés depuis le milieu du devant vers la gauche du personnage.
Au milieu du devant, les bouts pendaient sur le pli de l'aine : la bure les perçait (7 à 21 mm) quand la jambe monte, et
leurs arêtes s'y écrasaient (`Roll`, `Slide_Start`, l_c/l_b 0,003 à 0,005)."""

BOUTS = [(-0.008, -0.02), (0.008, 0.02)]
"""Les deux bouts qui pendent du nœud : (écart le long de la corde au départ, écart à la pointe), m. Brief : courts,
environ 15 cm ; HYPOTHÈSE : légèrement écartés l'un de l'autre."""
LONGUEUR_DES_BOUTS = 0.15
JEU_DES_BOUTS = 0.018
"""HYPOTHÈSE : les bouts pendent à 1,8 cm de la bure, lâches sous le nœud."""
PAS_DES_BOUTS = 6                 # sections le long de chaque bout
EPAISSEUR_DU_BOUT = 1.4
"""HYPOTHÈSE : la pointe de chaque bout renflée de 40 % (le nœud d'arrêt d'une cordelière)."""

ANGLE_LISSE = 70                  # degrés : la section hexagonale lissée (60° entre faces), les bouchons gardés vifs
