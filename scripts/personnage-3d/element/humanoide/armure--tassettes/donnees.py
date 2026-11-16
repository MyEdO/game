"""Données de `humanoide--armure--tassettes` (le Soldat, #4318), lues par `modele.py` : la pièce `tassettes` de la
garde-robe, pièce d'apparence.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : sous le plastron, sur le devant de chaque cuisse, par-dessus
le haut-de-chausses bouffant, une tassette d'acier faite de trois lames superposées, la plus haute recouvrant la
suivante, plus large en bas qu'en haut, galbée autour de la cuisse ; une bordure dorée court le long de ses côtés et de
son bord bas, et un coin doré, triangle pointe en bas, marque le milieu de chaque lame. Aucune sangle ne se voit : la
tassette sort de sous le plastron, à la taille, et couvre le haut de la cuisse jusqu'au bouffant de la culotte. Omis :
les petits fleurons dorés du bas (détail). Échelle relevée sous la taille : ~453 px/m (`vetement--haut-de-chausses`) ;
la tassette va du bas du plastron (y ~625 px) à y ~745 px, et fait ~90 px de large en haut, ~115 px en bas.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction sur la base ou un élément publié)
ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'tassettes'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
}
"""`couvre` vide, comme le plastron : les tassettes ne cachent que le devant des cuisses."""

MATERIAUX = {
    'acier': ('metal', 'acier-battu'),
    'dorure': ('metal', 'laiton-dore'),
}
"""Illustration : acier des lames, laiton doré de la bordure et des coins. `SLOTS` de `src/lib/palette.ts` n'a qu'un
emplacement de métal : la dorure le partage avec l'acier."""

BUDGET_TRIANGLES = 2000           # procédure du skill, section 7 : armure par pièce

CONTOURNE = {'haut_de_chausses': 'humanoide--vetement--haut-de-chausses'}
"""L'élément publié du preset `soldat` sur lequel les tassettes se posent, au `JEU`, et dont elles empruntent les
poids."""
MATIERES = {'haut_de_chausses': ['drap', 'toile']}
ZONES_DES_CLES = ['hanches', 'cuisse_g', 'cuisse_d']

# --- La tassette : des lames galbées, de la taille vers le genou, chacune recouvrant la suivante ---
OS = 'thigh'
"""L'os, du côté `_l` ou `_r`, dont la tête donne l'axe vertical de la tassette. Base : |x| = 0,114, y = 0,036."""
AZIMUT = 22.0
"""Degrés dont la tassette se tourne vers le dehors, depuis l'avant. Illustration : chaque tassette fait face un peu
en dehors, sur le devant de sa cuisse. HYPOTHÈSE de valeur."""
Z_HAUT = 1.045
"""z du bord haut. Illustration : la tassette sort de sous le plastron, à la taille. Base : le plastron descend à 1,06,
son bord à 5 cm du tronc (`armure--plastron`) ; le bord haut, posé sur la culotte à 2 cm du tronc
(`vetement--haut-de-chausses`), est dans l'ombre de ce bord. Le baudrier sur armure, qui se porte par-dessus, descend à
~1,10 sur la hanche gauche : à 1,075, le coin haut de la tassette gauche passait devant lui hanche fléchie
(`couche-traversee`, 5 à 15 mm)."""
RAYON_DE_GALBE = 0.17
"""m : rayon sur lequel la tassette s'enroule autour de l'axe de la cuisse ; une colonne à `u` m en travers du milieu
est sur l'azimut `AZIMUT` + u / `RAYON_DE_GALBE`. Base : la culotte s'écarte de 0,15 à 0,20 m de l'axe de la cuisse
(`vetement--haut-de-chausses`). Illustration : la tassette s'enroule sur le devant et le dehors de la cuisse ; posée en
plaque, ses bords ne trouvaient plus la culotte à la taille, plus étroite qu'elle."""
LAMES = 3                         # illustration : trois lames par tassette
PAS = 0.080
"""m : d'une lame à la suivante. Illustration : la tassette couvre ~120 px, ~0,26 m, du plastron au haut du bouffant de
la culotte (bas à 0,785)."""
LONGUEUR = 0.100                  # m : hauteur d'une lame ; HYPOTHÈSE : 1,5 cm de recouvrement
LARGEUR = [(0.0, 0.20), (1.0, 0.25)]
"""(t, m) : largeur de la tassette, de t = 0 au bord haut à t = 1 au bord bas, interpolée. Illustration : ~90 px en
haut, ~115 px en bas, plaque trapézoïdale, galbée sur le bouffant de la culotte."""
PROFIL = [(0.0, 0.0), (0.5, 0.002), (0.89, 0.004), (1.0, 0.006)]
"""(t, m) : du bord haut (t = 0) au bord bas (t = 1) d'une lame, ce qu'elle s'écarte de son fond au-delà du `JEU`.
Illustration : le bord bas relevé par-dessus la lame suivante, de plus que l'épaisseur de celle-ci ; le rang t = 0,89
borde la dorure du bas (`BORDURE` rapportée à `LONGUEUR`). Le montage ne retient tout entière la culotte qu'à 1 cm de
l'endroit de la lame (`SERRAGE_M` de `hotes/godot/asset/pile.ts`) : relevé de 1,5 cm, le bas de chaque lame laissait
la culotte à demi retenue, qui passait devant elle cuisse levée (`couche-traversee`, 6 à 14 mm). HYPOTHÈSE de valeurs."""
BORDURE = 0.011
"""m : largeur de la bordure dorée des côtés et du bas. Illustration : ~6 px."""
COIN = 0.24
"""Demi-largeur du coin doré d'une lame, en part de sa demi-largeur ; il va du rang du milieu au rang de la bordure.
Illustration : triangle de ~20 px de large, pointe en bas, au milieu de chaque lame."""
RELIEF = 0.0025
"""m : la dorure au-dessus de l'acier. HYPOTHÈSE : une bordure rapportée, lisible en lumière rasante."""
EPAISSEUR_DE_LA_DORURE = 0.0015   # HYPOTHÈSE : sa double nappe reste au-dessus de l'acier
JEU = 0.002
"""m, de la nappe intérieure des lames au point le plus avancé du haut-de-chausses sous chaque nœud. HYPOTHÈSE : avec
l'`EPAISSEUR` et le `PROFIL`, sous la distance à l'endroit de la lame jusqu'à laquelle le montage retient tout entière
la couche couverte (`SERRAGE_M` de `hotes/godot/asset/pile.ts`, 1 cm). Une plaque au galbe imposé, posée au jeu du seul point le plus avancé de chaque
rang, laissait le haut-de-chausses à plus d'un centimètre sous ses bords : à demi retenu, il passait devant elle de 7
à 9 mm (`couche-traversee`, seuil 5 mm), à 6 comme à 15 mm de jeu. Les poids ne s'empruntent qu'aux deux bords de
chaque lame : empruntés rang par rang ou sommet par sommet, ils étiraient de plus de 3,51 fois les arêtes courtes de
la bordure au pli de l'aine (`etirement/arete-etiree`, Roll, Crouch_Fwd_Loop)."""
EPAISSEUR = 0.003                 # HYPOTHÈSE : lame d'acier lisible à taille de jeu, double nappe
PORTEE = 0.40
"""m : départ des visées, devant l'axe de la cuisse. Base : la culotte s'avance d'au plus 0,20 m de l'axe."""
VISEES = 5
"""Visées par nœud, en travers et en hauteur, jusqu'à mi-chemin de ses colonnes et de ses rangs voisins : une tous les
~5 mm. Aux seuls nœuds, un crevé du haut-de-chausses passait entre deux visées et perçait la lame du bas au rendu ;
jusqu'aux voisins, la lame se posait sur le bouffant d'un rang plus bas et laissait la culotte à plus d'1 cm sous elle,
hors de sa retenue (`couche-traversee`)."""
