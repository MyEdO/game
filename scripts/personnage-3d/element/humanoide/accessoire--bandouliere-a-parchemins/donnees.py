"""Données de `humanoide--accessoire--bandouliere-a-parchemins` (le Sorcier, #3743, #4351), lues par le kit des sangles (`element/sangle.py`) : la variante
`bandouliere-a-parchemins` de la pièce `baudrier` de la garde-robe, dont elle garde l'emplacement `epaule_d`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : une sangle de cuir brun olive, piquée, qui descend de
l'épaule droite (sous l'écharpe) en travers du buste vers la hanche gauche ; quatre rouleaux de parchemin tenus en
travers de la sangle par des passants de cuir, sur la poitrine, puis, plus bas, trois fioles bouchées (deux vertes, une
sombre) dans leurs passants : ce sont des objets, rangés dans les cases que la sangle offre (`CASES`, #3844), jamais
cuits dans la sangle. Le dos ne se voit pas (HYPOTHÈSE : la sangle remonte du flanc gauche à l'épaule droite par le dos,
nue). Échelle relevée : environ 570 px/m (1,75 m de la semelle au sommet du crâne, HYPOTHÈSE du contrat).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). La sangle suit la coupe du tronc par un plan oblique : celui qui passe par le point d'épaule `EPAULE` et le point de
hanche `HANCHE` et contient l'axe avant-arrière.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'bandouliere-a-parchemins'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, la première au-dessus de `tenue` : la sangle se porte par-dessus la robe, dont l'évaluateur mesure
alors qu'elle ne la traverse pas, et sous l'écharpe de la capuche (`manteau`)."""

MATERIAUX = {
    'sangle': ('cuir', 'cuir-tanne'),
}
"""Illustration : sangle de cuir brun olive, comme la ceinture (`cuir`)."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

ZONES = ['torse', 'hanches']      # zones du tronc que la sangle ceint

CONTOURNE = {'robe': 'humanoide--vetement--robe'}
"""La sangle repose sur la robe publiée du preset `sorcier` : elle en emprunte les poids et les clés (ses meshes des zones
`ZONES_DU_SUPPORT`), comme le pan et le bas de l'écharpe de la capuche, posés sur la même robe
(`vetement--capuche/donnees.py`, `MATIERES_DE_LA_ROBE`) ; elle passe sous ce pan et sous l'écharpe. Liée au seul tronc et
posée à 4,4 cm de lui, elle passait devant l'écharpe et le pan (jusqu'à 19,8 mm en ClimbUp_1m, porte r25)."""
MATIERES_DU_SUPPORT = ['robe', 'dessous']
ZONES_DU_SUPPORT = ['torse', 'hanches', 'bras_haut_d']

EPAULE = -0.12
"""x du point d'épaule (HYPOTHÈSE) : l'illustration passe la sangle sur l'épaule droite, entre le cou et la pointe de
l'épaule ; base : le cou va jusqu'à x = ±0,10, la tête de `upperarm_r` est à x = -0,21. Sa hauteur et sa profondeur sont
celles du milieu de la crête de la robe à cet x (`CRETE`) : le haut du tronc passe au-dessus de l'encolure, où la sangle
ne trouve aucune robe."""
CRETE = 0.001
"""m : les points de la robe à x = `EPAULE` qui sont à moins de `CRETE` du plus haut forment sa crête, dont le point
d'épaule prend le milieu. Le bord de l'encolure y est à plat (robe publiée : trois points à z = 1,5576, de y = 0,011 à
0,114) : le seul plus haut s'y départage par le bruit du flottant, qui change d'un export de la robe à l'autre."""
TRANCHE_EPAULE = 0.015            # m : demi-largeur, en x, de la tranche de robe où se cherche la crête autour d'`EPAULE`

HANCHE = 1.25
"""z du point de hanche, au flanc gauche du tronc à cette hauteur. Illustration : la sangle arrive à la ceinture sur la
hanche gauche ; base : la ceinture publiée monte jusqu'à z = 1,126. HYPOTHÈSE : la sangle s'arrête au-dessus ; la ceinture
la traversait en clip à 1,15 (15 mm sous `carrure_plus`) et à 1,20 (14 mm accroupi, Crouch_Fwd_Loop)."""
TRANCHE_HANCHE = 0.01             # m : demi-hauteur, en z, de la tranche du tronc où se prend le flanc autour d'`HANCHE`

LARGEUR = 0.05
"""Illustration : ~28 px (5 cm) sur le brin visible entre la dernière fiole et la ceinture, à 570 px/m ; le contrat en
donne ~8 cm, sous les rouleaux, où la sangle ne se voit pas."""
SEGMENTS = 40                     # colonnes autour du tronc (HYPOTHÈSE de maillage)
JEU = 0.002
"""HYPOTHÈSE : nappe intérieure à 2 mm de la robe, mesurés le long de chaque colonne. La capuche pose son pan à 36-38 mm
du corps (`vetement--capuche/donnees.py`, `PAN`), et le bas de son écharpe à 10 mm au-dessus du col de la robe, qui a
26 mm d'aisance : la sangle et son épaisseur tiennent dessous."""
EPAISSEUR = 0.003                 # HYPOTHÈSE : double nappe d'une sangle de cuir
PORTEE = 0.5                      # m : départ des visées vers la robe, depuis le centre de la coupe, au-delà du tronc
LISSAGE_POIDS = 2                 # HYPOTHÈSE : passes laplaciennes des poids empruntés à la robe, comme le pan de la capuche

EMPLACEMENT = 'bandouliere'
"""L'emplacement de la garde-robe que la sangle offre : sa première case, puis `bandouliere#<rang>` pour les suivantes."""
PASSANTS = {
    'rouleau': {'rayon': 0.023, 'centre': 0.0265, 'largeur': 0.02, 'segments': 4},
    'fiole': {'rayon': 0.0155, 'centre': 0.019, 'largeur': 0.03, 'segments': 4},
}
"""Les passants de cuir qui tiennent les objets glissés dans les cases (illustration : une boucle de sangle par rouleau,
un fourreau court par fiole). `rayon` : du dedans de la boucle, 1,5 mm de plus que l'objet (`rigide--parchemin` : 21,5 mm
avec son lien ; `rigide--fiole` : 13,8 mm à la bague) ; `centre` : l'axe de l'objet au-dessus de la case, son rayon plus
les 5 mm où l'hôte pose son dos (`JEU_DE_RANGEMENT`, `hotes/godot/projet/scripts/mise_en_page.gd`) ; `largeur` : le long
de l'objet, illustration : ~11 px (2 cm) pour un rouleau, ~17 px (3 cm) pour une fiole ; `segments` : côtés du
demi-cercle (HYPOTHÈSE de maillage)."""

CASES = [
    # (s, angle, decalage, passant)
    (0.41, -15, 0.0, 'rouleau'),
    (0.495, -15, 0.0, 'rouleau'),
    (0.58, -15, 0.0, 'rouleau'),
    (0.665, -15, 0.0, 'rouleau'),
    (0.74, -15, 0.0, 'fiole'),
    (0.80, -15, 0.0, 'fiole'),
    (0.86, -15, 0.0, 'fiole'),
]
"""Les cases offertes devant, dans l'ordre des rangs. `s` : position le long de la sangle, de l'épaule (0) à la hanche (1),
par le devant (63,5 cm sur la robe publiée) ; `angle` : degrés de l'axe de l'objet glissé sur la perpendiculaire à la
sangle, positif vers l'épaule ; `decalage` : m du point de la case le long de cet axe, depuis le milieu de la sangle,
positif vers la gauche du personnage ; `passant` : la boucle de `PASSANTS` qui tient l'objet. Illustration : quatre
rouleaux empilés sur la poitrine, sous l'écharpe, leur bout gauche relevé de 20 à 25° (sur cette sangle, à -15° de sa
perpendiculaire), puis trois fioles de même pente jusqu'au-dessus de la ceinture, tous sur la sangle. Le premier rouleau
à s = 0,41 (à 0,30 et 0,36, il passait assez près du menton pour s'y lier : `suiviDuCorps/cle-inerte` sous
`gabarit_head_plus`) ; les rangs 5 et 6 passent sous le pan de la capuche publiée (devant, de x = 0,092 à 0,135,
au-dessus de z = 1,26), que leurs passants traversent (`couche-percee-au-repos` 15,8 mm, `couche-traversee` sous
`carrure_plus`) ; pas des rouleaux : 5,4 cm (boucle de 5,2 cm de dehors, à 15°), soit 0,085 ; pas des fioles :
3,8 cm, soit 0,06."""
