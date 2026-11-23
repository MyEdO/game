"""Données de `humanoide--accessoire--baudrier-sur-torse-nu` (le Gladiateur, #4394, contrat du 2026-11-22), lues par
`modele.py` : la variante `baudrier-sur-torse-nu` de la pièce `baudrier` de la garde-robe, que porte le preset
`gladiateur`.

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02 (#4394), 773 × 1257 px, hors dépôt.

Ce qu'elle montre : sur le torse nu, une seule sangle de cuir brun qui part de l'épaule gauche, près du cou, descend en
travers de la poitrine et rejoint le flanc droit au-dessus de la ceinture, où elle passe derrière le bras ; une boucle
carrée de métal doré la ferme sur le haut du pectoral gauche, un ardillon en son milieu. Le dos ne se voit pas : la
sangle y remonte du flanc droit à l'épaule gauche, nue, HYPOTHÈSE du contrat. Échelle : ~580 px/m
(`vetement--haut-de-chausses-ample`) ; la sangle fait ~28 px de large, ~5 cm, la boucle ~35 px, ~6 cm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). La sangle suit la coupe du torse par le plan oblique qui passe par le point d'épaule `EPAULE` et le point de flanc
`FLANC` et contient l'axe avant-arrière. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de
construction) ou `HYPOTHÈSE` (à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'baudrier-sur-torse-nu'},
    'liaison': {'mode': 'surface'},
    'couche': 'tenue',
}
"""Couche `tenue`, celle de la culotte et de la ceinture : la sangle se porte sur la peau, au-dessus d'elles."""

MATERIAUX = {
    'cuir': ('cuir', 'cuir-tanne'),
    'boucle': ('metal', 'laiton-dore'),
}
"""Illustration : cuir brun (`cuir`), boucle d'un métal doré (`metal`), comme les plaques de la ceinture
(`accessoire--ceinture-large`)."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

ZONES = ['torse']
"""La zone du corps que la sangle ceint : ses poids et ses clés en viennent. Base : le torse de 1,04 à 1,575 ; la sangle
reste au-dessus de la culotte et de la ceinture du preset (leur haut à 1,13, `accessoire--ceinture-large`)."""

EPAULE = (0.125, 1.553)
"""(x, z) du point d'épaule, sur le trapèze gauche. Illustration : la sangle passe sur l'épaule près du cou. Base : le
cou jusqu'à |x| = 0,099, la tête de `upperarm_l` à x = 0,212 ; le dessus du torse à x = 0,12 est à 1,558."""
FLANC = (-0.150, 1.245)
"""(x, z) du point de flanc, à droite. Illustration : la sangle atteint le flanc droit ~50 px (~9 cm) au-dessus de la
ceinture. Base : le flanc à |x| = 0,147 à 1,24 ; le haut de la ceinture à 1,13. À 1,185, la poignée de la dague rangée à
la hanche droite s'enfonçait derrière la sangle au repos (`rigideRange`, 21,8 mm)."""

LARGEUR = 0.05                    # illustration : ~28 px, ~5 cm
EPAISSEUR = 0.003                 # comme le kit des sangles (`accessoire--bandouliere-a-parchemins`)
SEGMENTS = 48                     # HYPOTHÈSE de maillage : une section tous les ~3 cm du tour
JEU = 0.002
"""Comme le kit des sangles : l'envers du cuir à 2 mm de la peau, mesurés le long de chaque rayon, au plus loin de ses
deux bords et de son milieu ; jamais plus près du centre que la corde de ses deux sections voisines, en `PASSES_DE_PONT`
passe : la sangle ponte le sillon des pectoraux et celui du dos sans s'y plier. À 4 mm de jeu, 4 mm d'épaisseur et trois
passes, les mains des bras croisés passaient derrière la sangle (`membre-dans-un-vetement`, Idle_FoldArms_Loop)."""
PASSES_DE_PONT = 1
PORTEE = 0.5                      # m : départ des visées vers le torse, depuis le centre de la coupe

BOUCLE_Z = 1.415
"""z du centre de la boucle, sur le brin de devant. Illustration : sur le haut du pectoral gauche, à mi-chemin de
l'épaule au sternum."""
BOUCLE = {'longueur': 0.058, 'largeur': 0.064, 'barre': 0.010, 'epaisseur': 0.006, 'ardillon': 0.006}
"""Le cadre carré : sa longueur le long de la sangle, sa largeur en travers (il déborde la sangle), la largeur de ses
barres, son épaisseur, et la largeur de l'ardillon couché le long de la sangle en son milieu. Illustration : ~35 px
(~6 cm) de côté, les barres ~6 px."""

ANGLE_VIF = 40                    # degrés : au-delà, une arête reste vive (chants du cuir, arêtes de la boucle)
