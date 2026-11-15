"""Données de `humanoide--vetement--foulard` (l'Apothicaire, #4261), lues par `modele.py` : la pièce `foulard` de la
garde-robe.

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Ce qu'elle montre : un foulard vert sauge enroulé au cou,
assez lâche, haut sous le menton, roulé en un bourrelet plissé autour du cou, qui retombe en pans courts sur le haut de
la poitrine, par-dessus le col du pourpoint matelassé ; les nattes passent par-dessus lui. Le dos ne se voit pas
(HYPOTHÈSE : le foulard fait le tour du cou et couvre le haut du dos jusqu'au bas de la nuque). Échelle relevée :
environ 640 px/m (la tête, du menton, y ~225 px, au sommet de la coiffe, y ~75 px, pour les 0,235 m de la tête
publiée) ; les pans descendent ~80 px sous le menton, 12 cm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut ψ se compte autour de l'axe vertical du cou, depuis l'avant (-y), positif vers la gauche (+x) ; une
élévation φ, depuis la verticale du `CENTRE`, vers le bas. Chaque cote dit d'où elle vient : `illustration`, `base`
(sonde de construction sur la base ou un élément publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'foulard'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': [],
}
"""`couvre` vide : le foulard ne cache aucune zone entière (le haut du cou se voit au-dessus de lui, sous la nuque)."""
MATERIAUX = {'foulard': ('accent', 'toile-ecrue')}   # gris de construction, sans couleur cuite

BUDGET_TRIANGLES = 2500                 # procédure, section 7 : vêtement par pièce
EPAISSEUR = 0.004                       # HYPOTHÈSE : drap de laine, double nappe

CONTOURNE = {'tete': 'humanoide--tete--humain', 'pourpoint': 'humanoide--vetement--pourpoint-matelasse'}
MATIERES = {'tete': ['peau'], 'pourpoint': ['robe']}
"""La tête publiée, sous le menton de laquelle le foulard monte, et le pourpoint publié, dont il couvre le col ouvert
(#4261 : on y voyait l'intérieur au-dessus des épaules) : il s'y pose au jeu et emprunte, au plus proche, les poids du
pourpoint et du corps (procédure, section 3)."""
ZONES_DU_POURPOINT = ['torse', 'bras_haut_g', 'bras_haut_d']
"""Zones des meshes du pourpoint sur lesquels le foulard repose, dont il reprend les clés."""
ZONES_DU_CORPS = ['cou', 'torse']
"""Zones de la base que le foulard contourne aussi, et dont il reprend les clés : le cou, au-dessus du col du pourpoint."""

COLONNES = 40                           # HYPOTHÈSE de maillage : intervalles en azimut ; à 32, le haut de la manche du
                                        # pourpoint passait entre deux colonnes sur l'épaule (rendu Idle_Loop)
# Le bourrelet : des anneaux autour du cou, chacun visé horizontalement de l'axe vertical de la tête de `os` vers le
# dehors jusqu'au cou, posé à `hauteur` au-dessus du bas de la zone `cou` à ± `fenetre` degrés (base : la couture
# cou/torse, de 1,528 m devant à ~1,56 m derrière), au jeu (devant, derrière) du cou, plus un pli (lobes de
# `plis` autour du cou, `ampleur`), et jamais à moins de `jeu_min` du pourpoint ou de la tête ; du haut vers le bas.
BOURRELET = {
    'os': 'neck_01',
    'fenetre': 12.0,
    'anneaux': [
        # (hauteur devant, hauteur derrière, jeu devant, jeu derrière) en m. Le haut : sous le menton (illustration),
        # HYPOTHÈSE : à 4,5 cm devant, sous le menton (tête : menton à z 1,584) ; derrière, haut sur la nuque.
        (0.045, 0.075, 0.018, 0.016),
        # le bas du rouleau, renflé (illustration : le foulard est roulé lâche) ; le tombant part de lui. Un troisième
        # anneau posé sur le col du pourpoint laissait sous lui des arêtes de 6 mm vers le tombant, étirées ×3,8 à ×5,7
        # sous `carrure_plus` (Idle_Loop)
        (0.026, 0.050, 0.040, 0.034),
    ],
    'plis': 5,                          # HYPOTHÈSE : plis du rouleau autour du cou
    'ampleur': 0.012,
    'phase': 1.1,                       # HYPOTHÈSE : radians de décalage des plis d'un anneau au suivant
    'jeu_min': 0.008,                   # HYPOTHÈSE : m, de la nappe intérieure au pourpoint et à la tête
}
CENTRE = {'os': 'neck_01', 'dy': 0.0, 'z': 1.30}
"""Centre des visées du tombant : sur l'axe vertical du cou, à la hauteur `z` (base : au niveau des pectoraux, comme
`vetement--col-de-fourrure`), pour que les visées les plus basses atteignent le bas des pans."""
ELEVATION_HAUT = 26.0                   # HYPOTHÈSE : élévation de la première visée du tombant, sous le bourrelet
BORD = [(0.0, 48.0), (12.0, 47.0), (22.0, 38.0), (40.0, 35.0), (90.0, 38.0), (120.0, 40.0), (150.0, 41.0), (180.0, 42.0)]
"""(azimut, élévation) du bas du tombant, interpolés linéairement, symétriques. Illustration : devant, deux pans courts
tombent sur le haut de la poitrine (~12 cm sous le menton), entre les nattes ; sur les côtés, le foulard couvre l'encolure
ouverte du pourpoint jusqu'au haut de sa manche bouffante (base : le haut du pourpoint, de r 0,08 m de l'axe du cou
devant, à e ~19°, à r 0,19 m sur l'épaule, z 1,56 à 1,58, e ~34 à 39° ; à 27° pour 90°, on voyait l'intérieur du
pourpoint entre le foulard et l'épaule, rendu Idle_Loop) ; derrière (HYPOTHÈSE), il descend sur le haut du dos (à 33° pour
150°, le tombant tenait sous le bourrelet en arêtes de 6 mm, étirées ×4,7 sous `carrure_plus`, Idle_Loop)."""
JEU = 0.020                             # HYPOTHÈSE : m, de la nappe intérieure aux surfaces dessous (pourpoint, cou, torse) ;
                                        # à 12 mm, le haut de la manche du pourpoint, bras levé, passait devant le foulard
                                        # sous `carrure_plus` (9,7 mm, Death01, OverhandThrow) ; à 16 mm, le torse du
                                        # pourpoint sous `carrure_moins` (8 mm, Death01, Push_Loop)
RANGS = 6                               # HYPOTHÈSE de maillage : intervalles du bourrelet au bord du tombant ; à 4, le haut
                                        # de la manche du pourpoint passait entre deux rangs sur l'épaule (rendu Idle_Loop)
PAS_D_ELEVATION = 2.0                   # degrés entre deux visées du profil d'une colonne
PORTEE = 0.45                           # m : départ des visées depuis le `CENTRE`, au-delà de toute surface
PAS = 0.002                             # m : pas des visées
PANS = {'profondeur': 3.0, 'creux': 0.3, 'graine': 'humanoide--vetement--foulard'}
"""Bord du tombant, irrégulier : chaque colonne descend au-delà du `BORD` de la profondeur que lui laisse `tissu.lambeaux`,
en degrés d'élévation (HYPOTHÈSE : l'illustration dessine un bord flottant, en plis qui retombent)."""
ZONES_DES_CLES = ['cou', 'torse', 'visage', 'tete']
"""Zones de la base dont le foulard reprend ses clés, avec le pourpoint : le haut du bourrelet, sous le menton, est plus
près du visage que du cou ; repris du cou seul, il ne suivait pas le visage qui grandit sous `gabarit_head_plus`
(`suiviDuCorps/cle-inerte`, 24 mm pour 30)."""
OS_REPORTES = {'Head': 'neck_01', 'upperarm_l': 'clavicle_l', 'upperarm_r': 'clavicle_r'}
"""Os dont le foulard reporte le poids emprunté : il s'enroule autour du cou, il ne suit pas la tête (la peau du cou
porte `Head` sous le menton), comme l'écharpe de `vetement--capuche` ; avec lui, les arêtes du bourrelet s'étiraient
×3,6 quand la tête tourne. Il repose sur l'épaule, il ne suit pas le bras (le haut de la manche du pourpoint porte
`upperarm_*`) : avec lui, l'épaule du tombant s'étirait ×4,5 bras levé sous `carrure_plus` (Sword_Regular_C)."""
LISSAGE_POIDS = 8                       # HYPOTHÈSE : passes laplaciennes des poids empruntés ; à 2, ×3,6 (même cause) ; à 4,
                                        # ×3,6 sous `carrure_plus` (Sword_Regular_C, Sword_Regular_Combo)
