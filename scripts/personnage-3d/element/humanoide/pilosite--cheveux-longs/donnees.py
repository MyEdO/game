"""Données de `humanoide--pilosite--cheveux-longs` (le Soldat, #4318), lues par `modele.py` : la coiffure
`cheveux-longs` de la garde-robe.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : des cheveux brun foncé, longs, que le casque cache sur le crâne ; ils encadrent le visage entre la
joue et la plaque du casque, sortent sous le casque derrière les joues et tombent sur la nuque jusqu'au haut des
épaules. Le dessus et le dos ne se voient pas : HYPOTHÈSE, cheveux tirés en arrière depuis le front, sans raie ni
frange, plaqués sur le crâne, qui tombent droit de la tempe à la nuque, d'une seule longueur, au haut des épaules ;
la coiffure doit se tenir sans casque, sur tout personnage. Échelle relevée : ~520 px/m (du bas des bottes au sommet du
casque, ~915 px pour ~1,75 m).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut `phi` se compte en degrés autour de la verticale du centre du crâne, 0 devant, positif vers la gauche ;
une élévation, en degrés depuis l'horizontale du centre. Chaque cote dit d'où elle vient : `illustration`, `tête`
(sonde de construction sur la tête publiée `humanoide--tete--humain`), `base` ou `HYPOTHÈSE` (rien ne la donne, à
trancher en revue).
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'cheveux-longs'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', ((0.6, 0.6, 0.6), 0.0, 0.95))}
"""La surface des coiffures publiées : `poil`, palette `cheveux`. Aucune matière de poil au catalogue : gris de
construction."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

CONTOURNE = {'tete': 'humanoide--tete--humain', 'chemise': 'humanoide--vetement--chemise',
             'pourpoint': 'humanoide--vetement--pourpoint'}
"""La tête publiée, dont la peau porte la chevelure ; la chemise et le pourpoint du preset `soldat`, dont les cols
montent sur le cou (base : jusqu'à 0,102 et 0,130 sous le centre) et par-dessus lesquels tombe la chevelure
(illustration). HYPOTHÈSE, comme les nattes de `cheveux-nattes` : une chevelure qui tombe aux épaules se pose sur ce qui
y est porté ; une couche `peau` qui traverse un col en ressort devant lui (`couche-percee-au-repos`), et à moins de
1 cm devant lui la pile des couches la retient derrière (`PERCEE_M`, `hotes/godot/asset/pile.ts`)."""
MATIERES_DE_LA_TETE = ['peau']
MATIERES_DES_COLS = {'chemise': ['chemise'], 'pourpoint': ['pourpoint']}
ZONES_DU_CORPS = ['cou', 'torse']
"""Zones de la base que la chevelure contourne sous la tête : la nuque et le haut des épaules."""
ZONES_DES_POIDS = ['cou', 'torse']
"""Zones de la base dont le bas de la chevelure emprunte les poids, au plus près : lié au cou seul, il traversait le
pourpoint sur l'épaule quand le cou penche (`couche-traversee`, 6 clips sur 12 essayés, 2 cm)."""
ZONES_DES_CLES = ['tete', 'visage', 'nez', 'cou', 'torse']
EPAISSEUR = 0.0015                      # HYPOTHÈSE : double nappe, sous la hauteur du bord

OS_DU_CENTRE = 'Head'
CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os : le centre du crâne. Tête : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""
COLONNES = 24                           # HYPOTHÈSE de maillage : une colonne tous les 15°, sous le plafond du personnage assemblé
RANGS = 9                               # HYPOTHÈSE de maillage : du bord bas de la colonne au haut du crâne
ELEVATION_HAUTE = 78.0                  # degrés : dernier rang avant le pôle
PORTEE = 0.30                           # m : départ des visées, au-delà de la peau

# ---------------------------------------------------------------- crâne
NAISSANCE = [(0.0, 40.0), (25.0, 37.0), (45.0, 26.0), (58.0, 8.0), (72.0, 8.0)]
"""(azimut, élévation) : le bord bas des colonnes qui s'arrêtent sur la tête. Devant, la naissance des cheveux, haute
sur le front (HYPOTHÈSE : le casque la cache) ; elle descend à la tempe jusqu'à la hauteur des yeux, où commence la
tombée."""
HAUTEUR = (0.002, 0.009)
"""m : hauteur au-dessus de la peau, au bord puis au cœur. HYPOTHÈSE : chevelure plaquée, sous le jeu du casque
(`armure--casque`, `JEU` 14 mm) avec ses stries."""
STRIES = 0.003                          # HYPOTHÈSE : m, une colonne sur deux plus haute, des mèches tirées vers la nuque

# ---------------------------------------------------------------- tombée
TOMBEE = {
    # au-delà de cet azimut, la colonne quitte le crâne et tombe. Illustration : les cheveux tombent dès la tempe,
    # entre la joue et la plaque du casque (tête : l'oreille va de ~81° à ~100°)
    'azimut': 72.0,
    # (azimut, élévation) : où la colonne quitte la peau. Tête : au-dessus de l'oreille (son haut à ~10°), puis la
    # base du crâne dans le dos
    'depart': [(72.0, 8.0), (100.0, 6.0), (118.0, -14.0), (180.0, -26.0)],
    'echantillons': 17,                 # HYPOTHÈSE : hauteurs où la descente est tenue au jeu, un tous les ~1 cm
    'rangs': 4,                         # HYPOTHÈSE de maillage : rangs de la colonne sous le départ
    # (azimut, m sous le centre) : le bas de la chevelure. Illustration : au haut des épaules (base : le haut du
    # trapèze est à 0,135 sous le centre, le pourpoint publié du Soldat monte à 0,130). Derrière l'oreille elle dépasse
    # le bas de la joue du casque (`armure--casque`, 0,112 sous le centre) de 2 à 4 cm ; HYPOTHÈSE : devant l'oreille,
    # la première mèche s'arrête à la pommette et le bord de la chevelure descend en biais vers la mâchoire.
    'bas': [(72.0, 0.070), (90.0, 0.136), (105.0, 0.148), (150.0, 0.154), (180.0, 0.156)],
    'meches': {'graine': 'cheveux-longs', 'profondeur': 0.022, 'creux': 0.3},   # m, pointes inégales (`tissu.lambeaux`)
    # (x, y) depuis le centre : l'axe du cou, autour duquel tombent les colonnes (base : `neck_01` à y 0,041)
    'axe': (0.0, 0.020),
    # (azimut, m) : ce dont le bas s'écarte de l'axe par rapport au départ. HYPOTHÈSE : sur les côtés la chevelure
    # rentre vers la mâchoire et le cou, sous la joue du casque ; dans le dos elle s'évase
    'evasement': [(72.0, -0.008), (100.0, -0.004), (125.0, 0.010), (180.0, 0.018)],
    'stries': 0.004,                    # HYPOTHÈSE : m, au bas, une colonne sur deux plus écartée de l'axe : des mèches
    # m, de la chevelure à la peau de la tête (HYPOTHÈSE : par-dessus l'oreille, sous le jeu du casque), puis au cou, aux
    # épaules et aux cols. HYPOTHÈSE : 2,6 cm, une chevelure épaisse ; à 1,4 cm (`PERCEE_M` de la pile, 1 cm, et 4 mm),
    # sous le casque du Soldat, dont elle reprend les poids, elle traversait le pourpoint à l'épaule quand la tête
    # penche (`couche-traversee`, 11 clips, 1,9 cm)
    'jeu': (0.006, 0.026),
    # HYPOTHÈSE : m, ce dont la chevelure accepte de s'écarter de l'axe au-delà de son départ ; plus loin, c'est l'épaule,
    # au-dessus de laquelle elle s'arrête
    'debord': 0.040,
    # m sous le centre : la hauteur où la chevelure cesse de suivre la tête seule, et celle où elle suit le corps seul
    # (`ZONES_DES_POIDS`). HYPOTHÈSE : fondu sur les 4 derniers centimètres, sous la mâchoire (tête : 0,095) ; commencé à
    # la mâchoire, la tête traversait la chevelure dans un clip de plus (`couche-traversee`, Jog_Fwd_Loop)
    'poids': (0.110, 0.150),
}
LISSAGE_DES_POIDS = 2                   # HYPOTHÈSE : passes laplaciennes des poids, de la tête au cou
