"""Données de `humanoide--pilosite--cheveux-longs` (#4318, refaite #4413), lues par `modele.py` : la coiffure
`cheveux-longs` de la garde-robe.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt. Ce qu'elle montre : des cheveux brun
foncé, longs, que le casque cache sur le crâne ; ils encadrent le visage entre la joue et la plaque du casque, sortent
sous le casque derrière les joues et tombent sur la nuque et les épaules. Le dessus et le dos ne se voient pas.

Contrat (#4413) : à taille de jeu, la masse des cheveux se lit avant le visage. HYPOTHÈSES, à trancher en revue : une
raie au milieu du front au sommet ; les cheveux couvrent les tempes et les oreilles, encadrent le visage jusqu'à la
clavicule, reposent sur le haut des épaules et tombent dans le dos sous la ligne des épaules ; des mèches en volume, le
bas en pointes inégales. Une seule pièce coiffe les têtes humaine, naine, haut-elfe et halfling : elle se pose hors de la
plus extérieure des quatre (`chevelure.py`), les oreilles dessous.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut se compte en degrés autour de la verticale du centre du crâne, 0 devant, positif vers la gauche ; une
élévation, en degrés depuis l'horizontale du centre. Chaque cote dit d'où elle vient : `illustration`, `têtes` (sonde
de construction sur les quatre têtes publiées), `base` ou `HYPOTHÈSE`.
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'cheveux-longs'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', 'chevelure')}
"""La surface des coiffures publiées, `poil`, palette `cheveux`, matière `chevelure` du catalogue."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

CONTOURNE = {'humain': 'humanoide--tete--humain', 'nain': 'humanoide--tete--nain',
             'haut-elfe': 'humanoide--tete--haut-elfe', 'halfling': 'humanoide--tete--halfling',
             'chemise': 'humanoide--vetement--chemise', 'pourpoint': 'humanoide--vetement--pourpoint'}
"""Les têtes publiées que la chevelure coiffe ; la chemise, le pourpoint et le plastron du preset `soldat`, dont les cols
et la dossière montent vers le cou et par-dessus lesquels elle tombe (illustration) : une couche `peau` qui traverse un
col en ressort devant lui (`couche-percee-au-repos`), et à moins de 1 cm devant lui la pile des couches la retient
derrière (`PERCEE_M`, `hotes/godot/asset/pile.ts`)."""
TETES = ['humain', 'nain', 'haut-elfe', 'halfling']
MATIERES_DE_LA_TETE = ['peau']
MATIERES_DES_COLS = {'chemise': ['chemise', 'col'], 'pourpoint': ['pourpoint']}
ZONES_DU_CORPS = ['cou', 'torse']
"""Zones de la base que la chevelure contourne sous la tête : la nuque, les épaules et le haut du dos."""
ZONES_DES_POIDS = ['cou', 'torse']
"""Zones de la base dont le bas de la chevelure emprunte les poids, au plus près : lié au cou seul, il traversait le
pourpoint sur l'épaule quand le cou penche (`couche-traversee`, 6 clips sur 12 essayés, 2 cm)."""
ZONES_DES_CLES = ['tete', 'visage', 'nez', 'cou', 'torse']
"""Zones de la base dont ce qui pend prend ses silhouettes et ses clés `gabarit_*`, au plus près."""
TETE_DES_CLES = 'humain'
ZONES_DE_LA_TETE = ['tete', 'visage', 'nez']
"""La tête publiée, et ses meshes, dont ce qui tient au crâne prend ses clés : sa clé `feminin` rapetisse le crâne plus
que celle de la base (#4413)."""
FONDU_DES_CLES = 24                     # HYPOTHÈSE : passes de moyenne des silhouettes, de la tête au corps
LISSAGE_DES_CLES = 6                    # HYPOTHÈSE : passes de moyenne des silhouettes sur ce qui pend
LISSAGE_DES_POIDS = 2                   # HYPOTHÈSE : passes laplaciennes des poids, de la tête au cou
GRAINE = 'cheveux-longs'

OS_DU_CENTRE = 'Head'
CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os : le centre du crâne. Têtes : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""
PORTEE = 0.30                           # m : départ des visées, au-delà de la peau
POLE = (0.0, 90.0)
"""(azimut, élévation) du pôle des colonnes : le sommet du crâne, où finit la raie."""
THETA_DU_POLE = 12.0                    # degrés : premier anneau autour du pôle
COLONNES = 32                           # HYPOTHÈSE de maillage : une colonne tous les 11,25°
RANGS = 7                               # HYPOTHÈSE de maillage : du premier anneau au bord, sur le crâne

# ---------------------------------------------------------------- crâne
BORD = [(0.0, 40.0), (20.0, 34.0), (40.0, 22.0), (55.0, 14.0), (80.0, 17.0), (105.0, 16.0), (122.0, -8.0),
        (180.0, -20.0)]
"""(azimut, élévation) : où finit la calotte. Devant, la naissance des cheveux, haute au milieu du front (HYPOTHÈSE,
comme la coiffure publiée) et plus basse vers la tempe : la raie ouvre le front en pointe. Au-delà de l'azimut de la
tombée, la ligne où la colonne quitte la tête : au-dessus de l'oreille (têtes : le pavillon va de 83° à 102° d'azimut,
de -28° à +12° d'élévation, la pointe de la haut-elfe la plus haute), puis la base du crâne dans le dos."""
PROFIL = [(0.0, 0.010), (0.5, 0.013), (0.9, 0.014), (1.0, 0.002)]
"""(part du pôle au bord, m) : hauteur au-dessus de la plus extérieure des têtes. HYPOTHÈSE : une chevelure en volume ;
sur la tête humaine, la plus étroite, elle est à 2 cm de la peau au-dessus de l'oreille (têtes : la naine y est plus
large de 8 mm), au jeu du casque du Soldat près (`armure--casque`, `JEU` 14 mm), que la pile des couches retient sous
lui (`PERCEE_M`, 1 cm)."""
VOLUME = [(0.0, 0.8), (60.0, 1.0), (180.0, 1.15)]
"""(azimut, facteur de la hauteur). HYPOTHÈSE : plus de volume derrière que sur le front."""
RAIE = {'x': 0.0, 'largeur': 0.011, 'profondeur': 0.8, 'fin': 0.030, 'fondu': 0.025}
"""La raie : à l'abscisse `x`, large de `largeur` (m, écart type), où la hauteur perd `profondeur` ; elle va du front à
`fin` (m derrière le centre, le sommet) et s'efface sur `fondu`. HYPOTHÈSE : raie au milieu."""
STRIES = 0.004                          # HYPOTHÈSE : m, une colonne sur deux plus haute : des mèches
MECHES_DU_BORD = {'graine': 'cheveux-longs-front', 'profondeur': 3.0, 'creux': 0.3}
"""Degrés : le bord du front en mèches inégales (`tissu.lambeaux`)."""

# ---------------------------------------------------------------- tombée
TOMBEE = {
    # au-delà de cet azimut, la colonne quitte la tête et tombe : dès la tempe, devant l'oreille (illustration)
    'azimut': 50.0,
    'echantillons': 21,                 # HYPOTHÈSE : hauteurs où la descente est tenue au jeu
    'rangs': 6,                         # HYPOTHÈSE de maillage : rangs de la colonne sous son départ
    # (azimut, m sous le centre) : le bas de la chevelure. HYPOTHÈSE : devant l'oreille, à la clavicule (base : 0,19
    # sous le centre) ; sur le côté elle s'arrête sur le haut de l'épaule (`debord`) ; dans le dos, sous la ligne des
    # épaules (base : l'acromion à 0,21 sous le centre), au haut des omoplates
    'bas': [(50.0, 0.185), (75.0, 0.195), (105.0, 0.215), (140.0, 0.265), (180.0, 0.285)],
    'meches': {'graine': 'cheveux-longs', 'profondeur': 0.045, 'creux': 0.3},   # m, pointes inégales (`tissu.lambeaux`)
    # (x, y) depuis le centre : l'axe du cou, autour duquel tombent les colonnes (base : `neck_01` à y 0,041)
    'axe': (0.0, 0.020),
    # (azimut, m) : ce dont le bas s'écarte de l'axe par rapport au départ. HYPOTHÈSE : devant l'oreille la chevelure
    # longe la joue ; dans le dos elle s'évase
    'evasement': [(50.0, -0.004), (100.0, 0.004), (125.0, 0.012), (180.0, 0.020)],
    'stries': 0.006,                    # HYPOTHÈSE : m, au bas, une colonne sur deux plus écartée de l'axe : des mèches
    # m, de la chevelure à la plus extérieure des têtes (par-dessus les oreilles), puis au cou, aux épaules et aux cols.
    # HYPOTHÈSE : 2,2 cm, une chevelure épaisse, au-delà de `PERCEE_M` de la pile (1 cm) devant un col
    'jeu': (0.007, 0.022),
    # (azimut, m) : ce dont la chevelure accepte de s'écarter de l'axe au-delà de son départ ; plus loin, c'est l'épaule,
    # au-dessus de laquelle elle s'arrête. HYPOTHÈSE : dans le dos, elle suit le haut des omoplates et la dossière
    'debord': [(50.0, 0.055), (110.0, 0.055), (140.0, 0.110), (180.0, 0.110)],
}
POIDS = (0.105, 0.165)
"""m sous le centre : la hauteur où la chevelure cesse de suivre la tête seule, et celle où elle suit le corps seul
(`ZONES_DES_POIDS`). HYPOTHÈSE : fondu de sous la mâchoire (têtes : 0,095) au haut des épaules."""

# ---------------------------------------------------------------- mèches
MECHES = [{
    'graine': 'cheveux-longs-meches',
    'nombre': 9,                        # HYPOTHÈSE : par côté
    'azimuts': (60.0, 178.0),           # de la tempe à la nuque
    'demi': (3.5, 6.5),                 # degrés
    'depart': 3,                        # rang de la colonne où la mèche sort de la masse, au-dessus de l'oreille
    'allonge': (0.020, 0.060),          # m : ce dont la pointe dépasse le bas
    'hauteur': (0.004, 0.009),          # m au-dessus de la masse
}]
"""HYPOTHÈSE : des mèches en ruban par-dessus la masse, inégales, pour le volume et le bas déchiqueté."""
