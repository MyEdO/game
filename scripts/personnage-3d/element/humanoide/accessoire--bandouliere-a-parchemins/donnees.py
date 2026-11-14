"""Données de `humanoide--accessoire--bandouliere-a-parchemins` (le Sorcier, #3743), lues par `modele.py` : la variante
`bandouliere-a-parchemins` de la pièce `baudrier` de la garde-robe, dont elle garde l'emplacement `epaule_d`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : une large sangle claire, piquée, qui descend de l'épaule
droite (sous l'écharpe) en travers du buste vers la hanche gauche ; des rouleaux de parchemin glissés en travers de la
sangle sur la poitrine, puis, plus bas, trois fioles bouchées (deux violettes, une verte) : ce sont des objets, rangés
dans les cases que la sangle offre (`CASES`, #3844), jamais cuits dans la sangle. Le dos ne se voit pas
(HYPOTHÈSE : la sangle remonte du flanc gauche à l'épaule droite par le dos, nue). Échelle relevée : environ 530 px/m (le
personnage, du capuchon aux semelles, environ 960 px pour les 1,82 m de la base).

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
    'sangle': ('vet2', ((0.75, 0.73, 0.68), 0.0, 0.9)),
}
"""Illustration : sangle écrue comme la robe de dessous (`vet2`). Gris de construction."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

ZONES = ['torse', 'hanches']      # zones du tronc que la sangle ceint

CONTOURNE = {'robe': 'humanoide--vetement--robe'}
"""La sangle repose sur la robe publiée du preset `sorcier` : elle en emprunte les poids et les clés (ses meshes des zones
`ZONES_DE_LA_ROBE`), comme le pan et le bas de l'écharpe de la capuche, posés sur la même robe
(`vetement--capuche/donnees.py`, `MATIERES_DE_LA_ROBE`) ; elle passe sous ce pan et sous l'écharpe. Liée au seul tronc et
posée à 4,4 cm de lui, elle passait devant l'écharpe et le pan (jusqu'à 19,8 mm en ClimbUp_1m, porte r25)."""
MATIERES_DE_LA_ROBE = ['robe', 'dessous', 'poitrine']
ZONES_DE_LA_ROBE = ['torse', 'hanches', 'bras_haut_d']

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

LARGEUR = 0.045                   # illustration : ~23 px, soit ~4,5 cm
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
CASES = [
    # (s, angle, decalage)
    (0.41, -35, 0.00),
    (0.49, -30, 0.02),
    (0.57, -40, -0.01),
    (0.63, -30, -0.035),
    (0.68, -20, -0.05),
    (0.72, -20, -0.06),
    (0.76, -20, -0.06),
]
"""Les cases offertes devant, dans l'ordre des rangs. `s` : position le long de la sangle, de l'épaule (0) à la hanche (1),
par le devant ; `angle` : degrés de l'axe de l'objet glissé sur la perpendiculaire à la sangle, positif vers l'épaule ;
`decalage` : m du point de la case le long de cet axe, depuis le milieu de la sangle, positif vers la gauche du
personnage. Illustration : quatre rouleaux lisibles sur la poitrine, sous l'écharpe, à peu près à l'horizontale (sur
cette sangle de base, à 30-40° de sa perpendiculaire) ; le premier à s = 0,41 (à 0,30 et 0,36, il passait assez près du
menton pour s'y lier : `suiviDuCorps/cle-inerte` sous `gabarit_head_plus`) ; le quatrième, remonté et décalé vers la
droite, à 1 cm du pan de la capuche publiée (devant, de x = 0,092 à 0,135, au-dessus de z = 1,26). Puis trois fioles
sous le dernier rouleau, glissées vers la droite du personnage, à gauche du bas du pan : de s = 0,73 à 0,87 sur la
sangle même, elles le traversaient (porte r25) ; plus bas, sur le ventre (0,80 à 0,88) ou le flanc (0,86 à 0,96), la
manche gauche les cachait dans la tenue du bâton (Clément, 2026-11-09 : « Je vois des "parchemins" sur sa
bandouillere mais pas de fiole »)."""
