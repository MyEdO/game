"""Données de `humanoide--accessoire--baudrier-sur-robe` (le Prêtre, #3867), lues par le kit des sangles
(`element/sangle.py`) : la variante `baudrier-sur-robe` de la pièce `baudrier` de la garde-robe, dont elle garde
l'emplacement `epaule_d`.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Inventaire de #3867 : une bandoulière de cuir sur l'épaule droite. Le
baudrier publié (`humanoide--accessoire--baudrier`), taillé pour le pourpoint, est percé par la bure au repos (porte de la
tenue du Prêtre, `couche-percee-au-repos`, 12,9 mm) : cette variante pose la même sangle sur la bure publiée.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). La sangle suit la coupe du tronc par le plan oblique qui passe par le point d'épaule `EPAULE` et le point de hanche
`HANCHE` et contient l'axe avant-arrière.
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'baudrier-sur-robe'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, la première au-dessus de `tenue` : la sangle se porte par-dessus la bure, et sous le col de fourrure
(`manteau`)."""

MATERIAUX = {
    'sangle': ('cuir', ((0.4, 0.4, 0.4), 0.0, 0.87)),
}
"""La surface `sangle` du kit, à l'emplacement `cuir` du baudrier publié. HYPOTHÈSE : sans la boucle de métal du baudrier publié, que
l'inventaire de l'illustration ne relève pas. Gris de construction."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

ZONES = ['torse', 'hanches']      # zones du tronc que la sangle ceint

CONTOURNE = {'bure': 'humanoide--vetement--bure'}
"""La sangle repose sur la bure publiée du preset `pretre` : elle en emprunte les poids et les clés (ses meshes des zones
`ZONES_DU_SUPPORT`), comme la bandoulière à parchemins sur la robe du Sorcier."""
MATIERES_DU_SUPPORT = ['robe']
ZONES_DU_SUPPORT = ['torse', 'hanches', 'bras_haut_d']

EPAULE = -0.16
"""x du point d'épaule (HYPOTHÈSE) : entre le cou (x = ±0,10) et la tête de `upperarm_r` (x = -0,21). Le col de la bure
s'arrête au bas du cou, sans couvrir le trapèze comme la robe : à -0,12 et -0,14, la colonne qui monte au-dessus de
l'épaule passait par l'encolure sans toucher la bure."""
CRETE = 0.001                     # m : comme la bandoulière à parchemins
TRANCHE_EPAULE = 0.015            # m : comme la bandoulière à parchemins

HANCHE = 1.25
"""z du point de hanche, au flanc gauche, comme la bandoulière à parchemins. HYPOTHÈSE : à 1,10, au-dessus de la
cordelière, la bure passait devant la sangle à la hanche quand la jambe monte (ClimbUp_1m, Crouch_Fwd_Loop)."""
TRANCHE_HANCHE = 0.01             # m : comme la bandoulière à parchemins

LARGEUR = 0.05
"""Baudrier publié : sa bande coupe la verticale x = 0 sur 10,4 cm devant, à environ 60° de l'horizontale, soit 5 cm de
large."""
SEGMENTS = 40                     # comme la bandoulière à parchemins
JEU = 0.002                       # comme la bandoulière à parchemins
EPAISSEUR = 0.003                 # comme la bandoulière à parchemins
PORTEE = 0.5                      # comme la bandoulière à parchemins
LISSAGE_POIDS = 0
"""Les poids empruntés à la bure, sans lissage, comme la cordelière : le col de fourrure emprunte ceux de la sangle sous
lui, et lissés, la bure passait devant la fourrure du torse bras tendus (Push_Loop, Zombie_Scratch, Sword_Regular_B :
5,3 à 8,0 mm, contre 5,1 à 6,7 mm sur deux clips sans lissage)."""
