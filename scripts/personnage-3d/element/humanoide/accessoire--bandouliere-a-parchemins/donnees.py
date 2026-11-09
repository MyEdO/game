"""Données de `humanoide--accessoire--bandouliere-a-parchemins` (le Sorcier, #3743), lues par `modele.py` : la variante
`bandouliere-a-parchemins` de la pièce `baudrier` de la garde-robe, dont elle garde l'emplacement `epaule_d`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : une large sangle claire, piquée, qui descend de l'épaule
droite (sous l'écharpe) en travers du buste vers la hanche gauche ; des rouleaux de parchemin glissés en travers de la
sangle sur la poitrine, puis, plus bas, trois fioles bouchées (deux violettes, une verte). Le dos ne se voit pas
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
    'parchemin': ('vet2', ((0.8, 0.78, 0.72), 0.0, 0.9)),
    'fiole': ('accent', ((0.5, 0.5, 0.5), 0.0, 0.3)),
    'bouchon': ('cuir', ((0.45, 0.45, 0.45), 0.0, 0.9)),
}
"""Illustration : sangle et rouleaux écrus comme la robe de dessous (`vet2`) ; fioles de verre teinté, `accent` (le vert de
la capuche du preset `sorcier`, celui de la fiole verte) ; bouchons sombres, `cuir`. Gris de construction."""

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
celles du haut de la robe à cet x : le haut du tronc passe au-dessus de l'encolure, où la sangle ne trouve aucune robe."""

HANCHE = 1.25
"""z du point de hanche, au flanc gauche du tronc à cette hauteur. Illustration : la sangle arrive à la ceinture sur la
hanche gauche ; base : la ceinture publiée monte jusqu'à z = 1,126. HYPOTHÈSE : la sangle s'arrête au-dessus ; la ceinture
la traversait en clip à 1,15 (15 mm sous `carrure_plus`) et à 1,20 (14 mm accroupi, Crouch_Fwd_Loop)."""

LARGEUR = 0.045                   # illustration : ~23 px, soit ~4,5 cm
SEGMENTS = 40                     # colonnes autour du tronc (HYPOTHÈSE de maillage)
JEU = 0.002
"""HYPOTHÈSE : nappe intérieure à 2 mm de la robe, mesurés le long de chaque colonne. La capuche pose son pan à 36-38 mm
du corps (`vetement--capuche/donnees.py`, `PAN`), et le bas de son écharpe à 10 mm au-dessus du col de la robe, qui a
26 mm d'aisance : la sangle et son épaisseur tiennent dessous."""
EPAISSEUR = 0.003                 # HYPOTHÈSE : double nappe d'une sangle de cuir
PORTEE = 0.5                      # m : départ des visées vers la robe, depuis le centre de la coupe, au-delà du tronc
LISSAGE_POIDS = 2                 # HYPOTHÈSE : passes laplaciennes des poids empruntés à la robe, comme le pan de la capuche

# Objets glissés en travers de la sangle, devant. `s` : position le long de la sangle, de l'épaule (0) à la hanche (1),
# par le devant ; `angle` : degrés de l'axe de l'objet sur la perpendiculaire à la sangle, positif vers l'épaule ;
# `decalage` : m de l'axe de l'objet le long de son axe, depuis la sangle (positif vers la gauche du personnage).
ROULEAUX = [
    # (s, angle, decalage, rayon, longueur)
    (0.41, -35, 0.00, 0.016, 0.13),
    (0.49, -30, 0.02, 0.015, 0.12),
    (0.57, -40, -0.01, 0.016, 0.13),
    (0.63, -30, -0.035, 0.014, 0.11),
]
"""Illustration : quatre rouleaux lisibles sur la poitrine, sous l'écharpe ; le premier à s = 0,41 (à 0,30 et 0,36, il
passe assez près du menton pour s'y lier : `suiviDuCorps/cle-inerte` sous `gabarit_head_plus`), ~15-18 px de diamètre (3 cm) et 50-65 px de long (11-13 cm),
qui débordent de la sangle des deux côtés, à peu près à l'horizontale (sur cette sangle de base, à 30-40° de sa
perpendiculaire). Le quatrième, remonté et décalé vers la droite, s'arrête à x = 0,08, à 1 cm du pan de la capuche publiée
(devant, de x = 0,092 à 0,135, au-dessus de z = 1,26) : à s = 0,65, il passait sous lui, sans place entre le pan et la
robe pour ses 3 cm, et le traversait (porte r25)."""
FIOLES = [
    # (s, angle, decalage, rayon, longueur, longueur du bouchon)
    (0.68, -20, -0.05, 0.009, 0.065, 0.018),
    (0.72, -20, -0.06, 0.009, 0.070, 0.018),
    (0.76, -20, -0.06, 0.010, 0.075, 0.020),
]
"""Illustration : trois fioles bouchées sous les rouleaux, en travers de la sangle, ~10 px de diamètre (2 cm), ~40 px de
long bouchon compris. Glissées vers la droite du personnage le long de leur axe, elles pendent sous le dernier rouleau, à
gauche du bas du pan de la capuche publiée (devant, de x = 0,092 à 0,135, au-dessus de z = 1,26) : de s = 0,73 à 0,87 sur
la sangle même, elles le traversaient (porte r25) ; plus bas, sur le ventre (0,80 à 0,88) ou le flanc (0,86 à 0,96), la
manche gauche les cachait dans la tenue du bâton (Clément, 2026-11-09 : « Je vois des "parchemins" sur sa bandouillere
mais pas de fiole »)."""
SEGMENTS_OBJET = 6                # côtés d'un rouleau ou d'une fiole (HYPOTHÈSE de maillage)
JEU_OBJET = 0.002                 # m entre la sangle et un objet glissé dessus
