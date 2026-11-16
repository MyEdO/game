"""Données de `humanoide--armure--epaulieres` (le Soldat, #4318), lues par `modele.py` : la pièce `epaulieres` de la
garde-robe, pièce d'apparence.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : sur chaque épaule, par-dessus la manche bouffante blanche du
pourpoint, une épaulière d'acier noirci faite de lames superposées, bombées, au bord arrondi, la plus haute coiffant
l'épaule en dehors des sangles du baudrier, les suivantes descendant sur le haut du bras. Les lames noires du coude,
dessinées plus bas sur la manche, sont une autre pièce (cubitières), omise. Le dos des épaulières ne se voit pas : il
est le symétrique du devant, HYPOTHÈSE. Échelle relevée : ~520 px/m (du bas des bottes au sommet du casque, ~915 px
pour ~1,75 m).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x), bras à l'horizontale. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction sur la base
ou un élément publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'epaulieres'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
}
"""`couvre` vide, comme le plastron : entre deux lames et sous leur arc ouvert, la manche se voit."""

MATERIAUX = {'acier': ('vet1', 'fer-noirci')}
"""Illustration : acier noirci, presque noir, aux reflets clairs, du ton des crevés et des chausses noires, nettement
plus sombre que le plastron et les brassards d'acier poli. Matière `fer-noirci` du catalogue. Les emplacements de
métal de `SLOTS` (`src/lib/palette.ts`) portent l'acier poli (`metal`) et le laiton des dorures (`metal2`) : l'acier
noirci prend la teinte de `vet1` (noir au preset `soldat`), la couleur sombre de la tenue. HYPOTHÈSE d'emplacement."""

BUDGET_TRIANGLES = 2000           # procédure du skill, section 7 : armure par pièce

CONTOURNE = {'pourpoint': 'humanoide--vetement--pourpoint'}
"""L'élément publié du preset `soldat` sur lequel les lames se posent, au `JEU`, et dont chaque sommet emprunte les
poids, au plus près : les lames suivent la manche qu'elles coiffent. Base : le plastron publié s'arrête à |x| = 0,205,
en deçà de la première lame."""
MATIERES = {'pourpoint': ['pourpoint']}
ZONES_DES_CLES = ['torse', 'bras_haut_g', 'bras_haut_d']

# --- Les lames : arcs autour de l'axe du bras, de l'épaule vers le coude, chacune recouvrant la suivante ---
OS = ('upperarm', 'lowerarm')
"""L'axe des lames : de la tête du premier os à celle du second, du côté `_l` ou `_r` ; les abscisses se comptent de la
tête du premier, vers le coude."""
DEBUT = 0.015
"""m : abscisse du bord haut de la première lame, 1,5 cm au-delà de la tête de `upperarm_*` (base : |x| = 0,212).
Illustration : l'épaulière coiffe la pointe de l'épaule, en dehors des sangles du baudrier (base : le baudrier sur
armure publié passe sur l'épaule droite jusqu'à |x| = 0,172). Commencée 3 cm plus près du cou, sa première lame, sur
le trapèze, laissait passer le pourpoint devant elle de 9 à 11 mm bras levé (`couche-traversee`, Lourde_Attaque,
Hampe_Attaque, Roll) ; commencée à la tête de l'os, le pourpoint retenu sous son bord s'écrasait (`arete-ecrasee`,
0,7 % de sa longueur, Lourde_Attaque)."""
PAS = 0.036
"""m : d'une lame à la suivante. Illustration : la partie visible d'une lame fait ~18 px, ~3,5 cm."""
LONGUEUR = 0.050
"""m : d'un bord à l'autre d'une lame ; elle recouvre la suivante de `LONGUEUR` - `PAS`. HYPOTHÈSE : 1,4 cm de
recouvrement."""
DEMI_ARCS = [90.0, 100.0, 105.0, 100.0]
"""Degrés : pour chaque lame, de l'épaule vers le coude, le demi-arc qu'elle couvre de part et d'autre du dessus du
bras (le dehors du bras pendant). Illustration : quatre à cinq lames se comptent sur l'épaule gauche, la première
plus courte, les suivantes enveloppent le devant et le dehors de la manche ; le dos est HYPOTHÈSE. Quatre lames
couvrent le haut du bras jusqu'à 17 cm de l'épaule, au-dessus du coude (base : 25 cm)."""
COLONNES = 12                     # HYPOTHÈSE de maillage : intervalles le long de l'arc, un tous les ~3 cm
PROFIL = [(0.0, 0.0), (0.45, 0.013), (1.0, 0.014)]
"""(t, m) : du bord haut (t = 0) au bord bas (t = 1) d'une lame, ce qu'elle s'écarte de la manche au-delà du `JEU`.
Illustration : lames franchement bombées, en bourrelets, le bord bas relevé par-dessus la lame suivante. HYPOTHÈSE :
1,3 cm de bombé, 1,4 cm au bord bas, qui laisse la lame suivante (au jeu, puis bombée : 1,2 cm sous ce bord, épaisseur
comprise) passer sous son épaisseur ; à 9 mm de bombé, les lames se lisaient plates au rendu."""
ARRONDI = [0.12, 0.03]
"""Part de la demi-longueur de la lame retirée à sa première et à sa deuxième colonne depuis chaque bout de l'arc.
Illustration : le bord des lames est arrondi aux coins. HYPOTHÈSE de valeur : à 0,28, les bouts des lames se lisaient
au rendu comme des doigts séparés."""
JEU = 0.008
"""m, de la nappe intérieure des lames au pourpoint. HYPOTHÈSE : sous la distance jusqu'à laquelle le
montage retient tout entière la couche couverte (`SERRAGE_M` de `hotes/godot/asset/pile.ts`, 1 cm), pour que la manche
suive la lame qui la coiffe ; à 12 mm, le pourpoint à demi retenu s'écrasait sous la lame (`arete-ecrasee`,
Lourde_Attaque). Poids lissés, liés à un seul os par lame, ou tenus loin du mélange à parts égales de deux os : la
manche passait devant l'épaulière de 9 à 16 mm bras levé (`couche-traversee`, Lourde_Attaque), ou le pourpoint
retenu sous une lame rigide s'étirait de 4,3 fois."""
EPAISSEUR = 0.004                 # HYPOTHÈSE : lame d'acier lisible à taille de jeu, double nappe
PORTEE = 0.30
"""m : départ des visées vers l'axe du bras. Base : la manche du pourpoint s'écarte d'au plus 0,13 m de l'axe."""
