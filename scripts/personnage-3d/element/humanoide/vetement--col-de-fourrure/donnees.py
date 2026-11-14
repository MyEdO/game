"""Données de `humanoide--vetement--col-de-fourrure` (le Prêtre, #3867), lues par `modele.py` : la pièce `col-de-fourrure` de
la garde-robe.

Illustration directrice : « Prêtre | pretre | `carrieres/pretre.png` | Livre de Base | 93 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip`), hors dépôt. Elle montre une pèlerine de fourrure rousse épaisse, fermée autour du cou,
posée sur les épaules qu'elle déborde, dont le bord, en mèches pointues, descend en V sur la poitrine jusqu'aux
pectoraux (le symbole religieux pend dessous) ; elle passe sur la bure et sur le baudrier. Le dos ne se voit pas
(HYPOTHÈSE du contrat : plus longue au dos, jusqu'aux omoplates). Échelle relevée : environ 433 px/m (du sommet du crâne,
y ~290 px, aux plantes des pieds, y ~1078 px, pour les 1,82 m de la base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut ψ se compte autour de l'axe vertical du cou, depuis l'avant (-y), positif vers la gauche (+x) ; une
élévation φ, depuis la verticale du `CENTRE`, vers le bas. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde
de construction sur la base r24 ou un élément publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'col-de-fourrure'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': [],
}
"""`couvre` vide : la pèlerine ne cache aucune zone entière (le cou se voit au-dessus, le bas du torse dessous)."""
MATERIAUX = {'fourrure': ('fourrure', ((0.6, 0.6, 0.6), 0.0, 0.95))}   # gris de construction, sans couleur cuite

CONTOURNE = {'bure': 'humanoide--vetement--bure', 'baudrier': 'humanoide--accessoire--baudrier-sur-robe'}
MATIERES = {'bure': ['robe'], 'baudrier': ['sangle']}
"""Les éléments publiés sous la pèlerine (brief de #3867 : elle passe sur la bure et le baudrier) et leurs matières : elle
s'y pose au jeu et emprunte, au plus proche, leurs poids (procédure, section 3)."""
ZONES_DE_LA_BURE = ['cou', 'torse', 'bras_haut_g', 'bras_haut_d']
"""Zones des meshes de la bure sur lesquels la pèlerine repose, dont elle reprend les clés. Le baudrier, posé à 5 mm de la
bure, en porte les clés."""
ZONES_DU_CORPS = ['cou', 'torse']
"""Zones de la base que la pèlerine contourne aussi, et dont elle reprend les clés : le cou, au-dessus du col de la bure, et
le haut du torse entre le cou et ce col, que les visées du trapèze traversent sinon sans rien toucher."""

BUDGET_TRIANGLES = 2500           # procédure, section 7 : vêtement par pièce
EPAISSEUR = 0.006                 # HYPOTHÈSE : double nappe ; l'épaisseur de la fourrure est son `GONFLEMENT` ; à 12 mm, la nappe
                                  # intérieure se repliait sur l'épaule, où les rangs se serrent (triangles retournés)
JEU = [(0.0, 0.034), (50.0, 0.030), (90.0, 0.022), (130.0, 0.030), (180.0, 0.034)]
"""(azimut, jeu) de la nappe intérieure à la bure, interpolés comme `BORD`. HYPOTHÈSES mesurées : 22 mm partout, le torse de la
bure passait devant la fourrure du devant et du dos (7,9 mm, Push_Loop, Zombie_Scratch ; 19 traversées sous `carrure_plus`),
d'où le jeu plus grand au devant et au dos ; à 34 mm devant et 30 mm à 50°, la sangle du baudrier passait devant la fourrure
sous `corpulence` (15,7 mm, Push_Loop) et la bure sous `carrure_plus` (5,6 mm, Death01), que le jeu ne gagnait pas : ces sommets, en haut du profil, gardaient le jeu du `COL` (`RAMPE_DU_JEU`) ; la sangle passe
sur le haut de l'épaule gauche (azimut 75 à 120°, à 1,50–1,56 m), et à 30 mm sur l'épaule, elle passait devant la fourrure
de 19,7 mm (`corpulence`, Push_Loop) au lieu de 14,7 ; à 40 mm de 30 à
60°, avec 40 colonnes, la fourrure de l'aisselle s'étirait (×3,7 en neutre, Pistol_Aim_Down) et la bure la traversait de
12 à 14 mm (Zombie_Scratch) ; sur l'épaule, il reste à 22 mm : à 16 mm, la bure passait devant la fourrure
de l'épaule droite sous `feminin` (14 mm, Zombie_Scratch) ; à 6 mm, le col de la bure perçait la fourrure à la nuque (rendu,
Idle_Loop) ; à 8 mm (celui de la cape sur la robe), le haut de la manche droite, bras levé, passait devant la fourrure de
l'épaule (27 mm, Sword_Regular_B)."""
RAMPE_DU_JEU = [(0.0, 20.0), (30.0, 20.0), (50.0, 7.0), (180.0, 7.0)]
"""(azimut, degrés d'élévation) sur lesquels le jeu des visées passe du `jeu` du `COL` à `JEU`, interpolés comme `BORD`
(HYPOTHÈSE) : devant, d'emblée à 34 mm, la première visée restait à la hauteur du col, sous le menton, et les faces du haut
du devant allaient à la zone `visage` (clé `gabarit_head_plus` inerte) ; ailleurs, à 20°, le haut du profil gardait le jeu
du col et le baudrier passait devant la fourrure (15,7 mm, `corpulence`, Push_Loop)."""
GONFLEMENT = 0.03
"""HYPOTHÈSE : la fourrure gonfle de `GONFLEMENT` au milieu de sa hauteur (lobe sinus, nul au col et au bord), à
l'horizontale de chaque colonne (le long de sa normale, la nappe se pinçait sur l'épaule, ×24) : l'illustration la dessine épaisse et bombée sur les épaules."""

COLONNES = 48                     # intervalles en azimut (HYPOTHÈSE de maillage : une mèche toutes les deux colonnes ; à 40, les
                                  # cordes entre colonnes rentraient dans la bure, 12 à 14 mm, Zombie_Scratch)
COL = {'os': 'neck_01', 'fenetre': 12.0, 'hauteur': 0.015, 'jeu': 0.024}
"""Le col, premier rang : un point par colonne, visé horizontalement de l'axe vertical de la tête de `os` vers le dehors,
posé au `jeu` du cou, à `hauteur` au-dessus du bas de la zone `cou` de la base à ± `fenetre` degrés (base : la couture
cou/torse, de 1,528 m devant à ~1,56 m derrière) ; il couvre le haut du col de la bure (au bas du cou + 0,015 m,
`vetement--bure/donnees.py`).
HYPOTHÈSE : col bas, sous le menton, pour que la tête baissée ne touche ni le visage ni la barbe. `jeu` : celui de la nappe
intérieure au cou (HYPOTHÈSE) ; à 16 mm, le cou le traversait sous `corpulence` (19,5 mm, Sword_Regular_C) ; à 24 mm et
0,02 m de `hauteur`, le devant du col était plus près de la zone `visage`, sous le menton, que du cou."""
CENTRE = {'os': 'neck_01', 'dy': 0.0, 'z': 1.30}
"""Centre des visées des rangs suivants : sur l'axe vertical du cou (tête de `os`, décalée de `dy` en y), à la hauteur `z`
(HYPOTHÈSE : sous les épaules, au niveau des pectoraux et des omoplates, pour que les visées les plus basses y
atteignent le bord)."""
ELEVATION_HAUT = 22.0             # HYPOTHÈSE : élévation de la première visée du profil, sur le trapèze, juste sous le col
BORD = [(0.0, 86.0), (30.0, 78.0), (60.0, 48.0), (90.0, 31.0), (125.0, 45.0), (155.0, 72.0), (180.0, 82.0)]
"""(azimut, élévation) du bord, interpolés linéairement, symétriques. Illustration : devant, la collerette descend en
arrondi sur le haut du torse (presque plate sur ±30°, sans pointe) et remonte vers les épaules ; sur les
côtés, la fourrure couvre l'épaule jusqu'à sa pointe. Ici, HYPOTHÈSE, elle s'arrête en dedans de l'acromion (élévation 31°,
x ≈ 0,17 m sur le haut de l'épaule, au jeu), comme le pan de la capuche et le haut de la cape
(`vetement--capuche/donnees.py`, `vetement--cape/donnees.py`) : plus loin, la manche de la bure qui monte avec le bras la
traverse (à 50°, la fourrure gagnait le bras en T jusqu'à x = 0,37 m et la manche passait devant elle de 51 mm,
Lourde_Attaque) ; son gonflement la fait déborder. Au dos, HYPOTHÈSE du contrat : jusqu'aux omoplates (horizontale du
`CENTRE`), le bord remontant vers l'épaule en dedans de l'arrière du bras (à 50° pour 125°, l'arrière de la manche gauche
passait devant la fourrure, 21 mm, Walk_Loop)."""
RANGS = 4
"""Intervalles du col au bord (HYPOTHÈSE de maillage) : à 6, les arêtes de 4 à 7 mm du profil de l'épaule, le plus court,
s'étiraient au-delà de la porte sous `feminin` et `corpulence` (×4,4)."""
PAS_D_ELEVATION = 2.0             # degrés entre deux visées du profil d'une colonne
PORTEE = 0.45                     # m : départ des visées depuis le `CENTRE`, au-delà de toute surface
PAS = 0.002                       # m : pas des visées
LAMBEAUX = {'profondeur': 6.0, 'creux': 0.2, 'graine': 'humanoide--vetement--col-de-fourrure'}
"""Mèches du bord : chaque colonne descend au-delà du bord de la profondeur que lui laisse `tissu.lambeaux`, ici en degrés
d'élévation (6° ≈ 2,5 cm à 0,25 m du `CENTRE` ; à 9°, les mèches de l'épaule gagnaient le dessus du bras en T).
Illustration : mèches pointues de 2 à 4 cm qui débordent."""
MECHES = [(0.0, 1.6), (45.0, 1.4), (70.0, 0.8), (90.0, 0.5), (125.0, 1.0), (180.0, 1.6)]
"""(azimut, facteur) de la profondeur des mèches, interpolés comme `BORD` : pleines devant et au dos (~4 cm), réduites sur
l'acromion, où une mèche gagnerait le dessus du bras (HYPOTHÈSE)."""
TOUFFES = {'ampleur': 0.008, 'graine': 'humanoide--vetement--col-de-fourrure'}
"""Relief en touffes : chaque sommet sous le col sort à l'horizontale d'un tirage uniforme entre 0 et `ampleur` m, pondéré par son abscisse du col (0) au bord (1) : sans elle, le devant du premier rang avançait sous le menton (faces de la zone `visage`) ; à 15 mm, le baudrier passait devant la fourrure du devant (11,6 mm, Push_Loop) (HYPOTHÈSE :
l'illustration dessine une fourrure irrégulière, en touffes, sur toute sa surface)."""
LISSAGE_POIDS = 2
"""Passes laplaciennes des poids empruntés (HYPOTHÈSES mesurées en passe neutre) : sans lissage, l'arête du col (poids du
cou) au rang suivant (poids de la bure) s'étirait à ×19 (Zombie_Scratch), et les rangs de la poitrine, aux poids du bras
près de l'aisselle, à ×5,6 ; à une passe, à ×4,5 sous le bras droit levé (Sword_Regular_C) ; à 3 passes, les poids de
l'arrière de l'épaule mêlaient le dos au bras et la manche droite de la bure passait devant la fourrure (38 mm,
Pistol_Aim_Up), et l'épaule s'étirait davantage sous `feminin`."""
