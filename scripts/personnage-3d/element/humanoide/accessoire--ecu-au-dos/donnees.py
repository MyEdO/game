"""Données de `humanoide--accessoire--ecu-au-dos` (le Soldat, #4318), lues par `modele.py` : la pièce `ecu-au-dos` de
la garde-robe, portée au `dos`, pièce d'apparence.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : derrière l'épaule gauche du personnage (à droite de
l'image), le revers d'un écu de bois porté dans le dos, penché, son bord haut descendant de derrière le casque vers une
corne à hauteur du menton ; sous la corne, une échancrure en arc de cercle, puis une pointe de flanc à hauteur de
l'aisselle, d'où le bord repart vers la pointe basse, cachée par le bras. Des planches jointives, dans la hauteur de
l'écu ; une large bordure d'acier rivetée. Omis : les rivets (détail). Le reste de l'écu, sa face tournée vers
l'arrière et ce qui le tient au dos ne se voient pas : leurs cotes sont des HYPOTHÈSES, et aucune sangle n'est
modelée, celles de la poitrine étant le baudrier. Échelle relevée : ~520 px/m (du bas des bottes au sommet du casque,
~915 px pour ~1,75 m).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction sur la base ou un élément publié)
ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ecu-au-dos'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, comme la hotte : l'écu se pose derrière le pourpoint (`tenue`) et le baudrier."""

MATERIAUX = {
    'bois': ('bois', 'bois-chene'),
    'cerclage': ('metal', 'acier-battu'),
}
"""Illustration : les planches de bois blond, la bordure d'acier."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

CONTOURNE = {
    'pourpoint': 'humanoide--vetement--pourpoint',
    'baudrier': 'humanoide--accessoire--baudrier-sur-armure',
}
"""Les éléments publiés du preset `soldat` derrière lesquels l'écu se pose, au `JEU` : le dos et les manches du
pourpoint, la sangle du baudrier dans le dos."""
MATIERES = {'pourpoint': ['pourpoint'], 'baudrier': ['cuir', 'metal']}
PORTEUR = 'pourpoint'
ZONES_DU_CORPS = ['torse', 'cou', 'tete']
"""Zones de la base derrière lesquelles l'écu se pose aussi : son bord haut monte derrière la tête."""
ZONES_DES_CLES = ZONES_DU_CORPS + ['bras_haut_g', 'bras_haut_d']
"""Zones de la base dont l'écu reprend ses clés, au plus près : il passe derrière le haut du bras gauche, comme la
hotte (`accessoire--hotte/donnees.py`)."""
BORNES_DES_CLES = (0.25, 4.0)
"""Rapport de longueur d'arête sous une clé (clé / repos) hors duquel elle est lissée (`Base.transferer`) : la porte
d'étirement de l'évaluateur. L'écu passe à 10 cm derrière la tête et le haut du bras, qui bougent de 15 et 18 cm sous
`gabarit_head_plus` et `carrure_plus` quand le dos ne bouge pas ; aux bornes par défaut, le lissage gagnait ses 320
sommets et la clé devenait inerte (`suiviDuCorps/cle-inerte`, 5,6 cm pour 15)."""

# --- Le contour : symétrique, du bord haut à la pointe basse ---
CONTOUR = [(0.205, 0.000), (0.180, 0.050), (0.172, 0.100), (0.190, 0.150), (0.240, 0.190), (0.236, 0.300),
           (0.205, 0.420), (0.135, 0.560), (0.000, 0.700)]
"""(demi-largeur, profondeur sous le bord haut), m : la moitié du contour, de la corne à la pointe basse. Illustration :
de la corne à la pointe de flanc, ~100 px, ~0,19 m, l'échancrure creusée de ~3 cm entre elles ; la pointe de flanc
déborde la corne. La corne garde un angle assez ouvert pour que le cerclage, rentré de `BORDURE`, y laisse du bois.
HYPOTHÈSES : la demi-largeur (0,24 m, un écu qui couvre le dos d'une épaule à l'autre), la hauteur (0,70 m, de la
nuque aux reins) et le bas du contour, cachés par le corps ; la symétrie, l'autre flanc étant caché."""
BORDURE = 0.035                   # m : largeur du cerclage. Illustration : ~18 px
PLANCHE = 0.09
"""m : largeur d'une planche, un joint au milieu de l'écu. Illustration : planches de ~45 px, ~9 cm. Base : à cette
largeur, aucun joint ne tombe à moins de 8 mm d'un sommet du contour rentré, où il laisserait une arête de moins
d'un millimètre que le lissage des clés ne résout pas."""
EPAISSEUR_DU_BOIS = 0.014         # HYPOTHÈSE : planches d'un écu de guerre
RELIEF = 0.005
"""m : le cerclage au-dessus du bois, sur chaque face. Illustration : bordure en nette saillie."""
RESSAUT = 0.003
"""m : une planche sur deux en retrait de sa voisine. HYPOTHÈSE : des planches jointives lisibles sans texture."""
ANGLE_LISSE = 30.0                # degrés : au-delà, une arête est vive

# --- La pose : contre le dos, penché ---
ORIGINE = (0.20, 1.70)
"""(x, z) du milieu du bord haut. Illustration : la corne est à ~0,40 m de l'axe du corps, à hauteur du menton
(z = 1,60), et le bord haut monte derrière le casque."""
ROULIS = 28.0
"""Degrés dont l'écu penche, son haut vers la gauche du personnage. Illustration : le bord haut descend de ~37° vers
la corne dans la vue de trois-quarts, qui raccourcit l'horizontale ; ~28° de face."""
TANGAGE = 5.0
"""Degrés dont le haut de l'écu s'écarte vers l'arrière. HYPOTHÈSE : la pente du dos du pourpoint, des reins
(y = 0,15) aux omoplates (y = 0,19), pour que la pointe basse reste près des reins."""
LACET = 15.0
"""Degrés dont l'écu tourne autour de la verticale, son flanc gauche vers l'arrière. HYPOTHÈSE : pendu en travers du
dos, il s'appuie sur l'omoplate et s'écarte derrière l'épaule ; bras à l'horizontale, il passe ainsi à plus de 3 cm
(`PORTEE_DE_COUVERTURE_M` de `hotes/godot/asset/pile.ts`) derrière la manche et les épaulières, que le montage
tenait sinon pour couvertes par lui (`couche-traversee` de l'épaulière gauche, jusqu'à 46 mm, à plat sur le dos)."""
JEU = 0.012
"""m, de la face avant du cerclage à tout ce qui est sous l'écu (éléments contournés et corps). HYPOTHÈSE : l'écu
repose sur le dos, sans le toucher bras à l'horizontale, où la manche bouffante passe sous lui."""
MARGE = 0.01                      # m : autour du contour, ce qui compte comme sous l'écu
POINT_DES_POIDS = (0.0, 0.30, 1.40)
"""Le point, derrière le dos, dont le plus proche du pourpoint donne ses poids à l'écu entier : un écu rigide qui suit
le haut du dos. HYPOTHÈSE : le milieu des omoplates, comme la hotte."""
