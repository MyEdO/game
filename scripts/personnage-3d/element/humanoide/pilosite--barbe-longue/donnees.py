"""Données de `humanoide--pilosite--barbe-longue` (le Sorcier, #4351, contrat du 2026-11-16), lues par `modele.py` : la
coiffure `barbe-longue` de la garde-robe.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Ce qu'elle montre (tête de trois quarts, tournée vers la droite du personnage) : une barbe
châtain taillée court sur la joue et la mâchoire, plus fournie au menton, une moustache qui rejoint la barbe et cache
la bouche ; sous le menton l'écharpe du capuchon passe devant la barbe, qui ressort sous elle en une masse ondulée
jusqu'au sternum, entre le col de la robe et la bandoulière ; des mèches châtain mi-longues tombent de la tempe le long
de la joue, sous le bord du capuchon, jusqu'à la mâchoire. Tranché par l'utilisateur (2026-11-16, #4351 : « il a une
sacré barbe ») : barbe longue. Le crâne et la nuque ne se voient pas : HYPOTHÈSE, cheveux mi-longs d'une seule
longueur, de la naissance du front à la mâchoire et au bas de la nuque, pour que la coiffure se tienne sans capuchon.
Échelle relevée : ~570 px/m (contrat) ; du menton au bas de la masse ondulée, ~105 px, 0,185 m.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut `phi` se compte en degrés autour d'une verticale, 0 devant, positif vers la gauche ; une élévation, en
degrés depuis l'horizontale d'un centre. Chaque cote dit d'où elle vient : `illustration`, `tête` (sonde de construction
sur la tête publiée `humanoide--tete--humain`), `base` ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'barbe-longue'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': [],
}
"""Couche `manteau` : la barbe tombe par-dessus la tenue. En couche `peau`, ses faces devant la poitrine, de zone
`torse`, sont cachées par tout vêtement qui couvre le torse (`masquer_les_zones_couvertes`,
`hotes/godot/projet/scripts/montage_de_composition.gd`)."""
MATERIAUX = {'poil': ('cheveux', ((0.6, 0.6, 0.6), 0.0, 0.95))}
"""La surface des coiffures publiées : `poil`, palette `cheveux`. Aucune matière de poil au catalogue : gris de
construction."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

CONTOURNE = {'tete': 'humanoide--tete--humain', 'robe': 'humanoide--vetement--robe'}
"""La tête publiée, dont la peau porte le poil, et la robe du Sorcier, sur le col et la poitrine de laquelle tombe la
barbe (illustration)."""
MATIERES = {'tete': ['peau'], 'robe': ['robe', 'galon', 'dessous']}
ZONES_DU_CORPS = ['cou', 'torse']       # zones de la base que barbe et cheveux contournent sous la tête
ZONES_DES_CLES = ['tete', 'visage', 'nez', 'cou', 'torse']
EPAISSEUR = 0.0015                      # HYPOTHÈSE : double nappe, sous la hauteur du bord
PORTEE = 0.30                           # m : départ des visées, au-delà de toute surface
PAS = 0.002                             # m : pas des marches vers une surface
AXE = (0.0, 0.020)
"""(x, y) : la verticale du cou (base : `neck_01` à y 0,041, le centre du crâne à y 0,010), autour de laquelle tombent
barbe et cheveux."""
LISSAGE_DES_POIDS = 2                   # HYPOTHÈSE : passes laplaciennes des poids, de la tête au corps

# ---------------------------------------------------------------- cheveux
CHEVEUX = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0074, 0.1007),   # tête : (0 ; 0,010 ; 1,710) au repos, le centre du crâne, à la hauteur des yeux
    'colonnes': 20,                     # HYPOTHÈSE de maillage : une colonne tous les 18°, de part et d'autre du milieu
    'rangs': 5,                         # HYPOTHÈSE de maillage : du bord de la colonne sur le crâne au dernier rang avant le pôle
    'elevation_haute': 76.0,
    # (azimut, élévation) du bord de chaque colonne sur le crâne : devant, la naissance des cheveux, haute sur le front
    # (HYPOTHÈSE : le capuchon la cache) ; à la tempe et derrière, là où la colonne quitte la peau et tombe (tête :
    # l'oreille va de ~81° à ~100°, son haut à ~10° ; la base du crâne dans le dos)
    'bord': [(0.0, 42.0), (27.0, 38.0), (45.0, 28.0), (63.0, 22.0), (100.0, 12.0), (120.0, -6.0), (180.0, -18.0)],
    'tombee': 54.0,                     # illustration : au-delà de cet azimut la colonne tombe ; la mèche de la tempe est à 63°
    # (azimut, z) du bas de la tombée. Illustration : les mèches de la tempe s'arrêtent à la mâchoire (tête : menton à
    # z 1,584, coin de la mâchoire à ~1,61) ; HYPOTHÈSE : même longueur derrière, au-dessus du col de la robe (z 1,57)
    'bas': [(54.0, 1.615), (81.0, 1.600), (120.0, 1.592), (180.0, 1.590)],
    'rangs_de_tombee': 3,               # HYPOTHÈSE de maillage
    'hauteur': (0.002, 0.009),          # HYPOTHÈSE : m au-dessus de la peau, au bord du front puis au cœur
    'stries': 0.003,                    # HYPOTHÈSE : m, une colonne sur deux plus haute, des mèches
    'jeu': 0.008,                       # HYPOTHÈSE : m, de la tombée à la peau, à l'oreille et au cou
    'meches': {'graine': 'barbe-longue-cheveux', 'profondeur': 0.016, 'creux': 0.3},   # m, pointes inégales
}

# ---------------------------------------------------------------- barbe
BARBE = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0344, 0.0507),   # tête : (0 ; -0,017 ; 1,660) au repos, à la hauteur du bout du nez, derrière la bouche
    'colonnes': 13,                     # HYPOTHÈSE de maillage : d'un favori à l'autre
    'demi_ouverture': 80.0,             # illustration : le favori monte devant l'oreille (tête : avant de l'oreille à ~81°)
    # (azimut, élévation) du bord haut : la moustache, sous le nez (tête : narines à z 1,656, soit -1° ; à -1°, la barbe
    # masquait le bas du nez, rendu de face), puis la ligne de la joue
    'haut': [(0.0, -10.0), (14.0, -9.0), (24.0, -3.0), (40.0, 6.0), (60.0, 14.0), (80.0, 26.0)],
    # (azimut, élévation) du bord de la mâchoire, d'où la barbe tombe (tête : devant du menton à -41°, son dessous à -56°)
    'machoire': [(0.0, -48.0), (30.0, -46.0), (50.0, -40.0), (66.0, -30.0), (80.0, -14.0)],
    'rangs': 5,                         # HYPOTHÈSE de maillage : intervalles du bord haut à la mâchoire
    'hauteur': (0.003, 0.020),          # illustration : m au-dessus de la peau, rase à la joue, fournie au menton
    # (azimut, m) : longueur de la tombée sous la mâchoire. Illustration : 0,185 m au milieu, jusqu'au sternum (base : z
    # ~1,40) ; HYPOTHÈSE : 0,21 m, pour que la masse qui ressort sous l'écharpe du capuchon garde ses ~10 cm, bras en T
    # comme en pose ; elle se resserre en pointe, les favoris ne tombent pas
    'longueur': [(0.0, 0.210), (27.0, 0.185), (40.0, 0.120), (53.0, 0.060), (67.0, 0.020), (80.0, 0.0)],
    'rangs_de_tombee': 6,               # HYPOTHÈSE de maillage
    'resserrement': 0.45,               # illustration : la masse perd ~45 % de sa largeur de la mâchoire à la pointe
    'recul': 0.030,                     # HYPOTHÈSE : m, ce dont la pointe se rapproche de l'axe du cou, avant le jeu
    # HYPOTHÈSE : m, de la barbe à la robe, au cou et au torse ; au-delà de `PERCEE_M` (1 cm, `hotes/godot/asset/pile.ts`),
    # en deçà duquel la pile des couches retient une couche derrière sa voisine
    'jeu': 0.016,
    # illustration : une masse ondulée. Écart au-delà du jeu, nul à la mâchoire : `periodes` ondes le long de la tombée,
    # décalées de `dephasage` période d'une colonne à la suivante (HYPOTHÈSE : ampleur et nombre)
    'ondes': {'ampleur': 0.007, 'periodes': 1.5, 'dephasage': 0.25},
    # HYPOTHÈSE : m, au bas, une colonne sur deux plus écartée de l'axe : des mèches ; à 8 mm et des ondes en opposition
    # d'une colonne à l'autre, les plis se retournaient (`enroulement/triangle-retourne`, 11 triangles)
    'stries': 0.004,
    'ventre': 0.012,                    # HYPOTHÈSE : m, ce dont la masse s'épaissit à mi-longueur
    'meches': {'graine': 'barbe-longue-barbe', 'profondeur': 0.050, 'creux': 0.2},   # m, pointes inégales du bas
    # m sous la mâchoire : où la tombée cesse de suivre la tête seule, et où elle suit ce sur quoi elle repose seul (la
    # robe, le cou, le torse : liée au seul corps, la robe passait devant elle, 27 mm en Sword_Regular_A).
    # HYPOTHÈSE : la barbe repose sur la poitrine, sa pointe ne balaie pas la robe quand la tête tourne
    'poids': (0.015, 0.090),
}
