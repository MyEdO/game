"""Données de `humanoide--pilosite--barbe-courte` (le Gladiateur, #4394 ; le Sorcier la porte aussi), lues par
`modele.py` : la coiffure `barbe-courte` de la garde-robe.

Illustrations directrices, hors dépôt : celle du Gladiateur, fournie par l'utilisateur le 2026-11-02 (contrat du
Gladiateur, signe identitaire 3 : « la barbe sombre et courte, et la moustache tombante, sur un visage large »), et la
ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` | Livre de Base | 94 |
certaine ». Ce qu'elles montrent. Gladiateur (trois-quarts) : une barbe sombre, courte et dense, qui couvre la mâchoire,
le menton, le dessous du menton et la lèvre supérieure ; la moustache rejoint la barbe aux coins de la bouche ; le menton
reste un volume lisible ; les lèvres et le nez sont nus ; le haut des joues est sous le masque. Sorcier (profil) : une
barbe courte qui épouse la mâchoire du favori au menton, la moustache sous le nez, la pommette nue. Épaisseur relevée sur
le Gladiateur : de 1 à 2,5 cm au menton (la tête, du menton au haut du masque, environ 190 px pour 0,235 m, soit environ
800 px/m ; la barbe dépasse le menton de 10 à 20 px).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Le poil est la peau de la tête publiée sous un masque, décalée le long de sa normale lissée. Un sommet de la peau se
repère depuis le centre de la barbe par son azimut `phi` (degrés, 0 devant, positif vers la gauche +x) et son élévation
(degrés depuis l'horizontale du centre) ; le masque est une bande entre un bord bas et un bord haut (tables
`(|phi|, élévation)` interpolées), chaque bord découpé en mèches (`tissu.lambeaux`). Chaque cote dit d'où elle vient :
`illustration`, `tête` (relevée sur la tête publiée `humanoide--tete--humain`), `adaptation` (valeur d'adaptation du
lot, doctrine #1993) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'barbe-courte'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', 'chevelure')}
BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

# La tête publiée, dont la peau porte le poil : la barbe en prend les sommets, les normales et les poids, tels quels.
CONTOURNE = {'tete': 'humanoide--tete--humain'}
MATIERES_DE_LA_TETE = ['peau']
ZONES_DES_CLES = ['tete', 'visage', 'nez']   # les zones de la base que la tête publiée recouvre, sous la barbe
SOMMETS_PAR_FACE = 2                    # adaptation : une face de la peau est au poil si deux de ses sommets le sont
CAVITE = 0.012                          # adaptation : m, portée de la normale d'un sommet au creux d'une cavité (l'intérieur des lèvres)
SOUDURE = 1e-5                          # adaptation : m, deux sommets de la peau plus proches sont un seul (coutures d'UV)

# Épaisseur : la hauteur du poil au-dessus de la peau part de `BORD` au bord du masque et monte de `PENTE` par mètre
# d'éloignement de ce bord, jusqu'au plafond de l'endroit : `PLAFOND` selon l'élévation, fois `PART` selon l'azimut, plus
# un `GRAIN` tiré par sommet hors du bord. HYPOTHÈSE : une nappe simple, sans envers ; son bord est à `BORD` de la peau,
# rien ne montre son dessous, et la peau de la tête sous le masque, en double nappe, dépasserait le budget (850 faces).
BORD = 0.0005                           # adaptation : m, comme le chaume de `calvitie-et-barbe-rase`
PENTE = 1.0                             # adaptation : le flanc de la barbe à 45 degrés, sans marche au pourtour
PLAFOND = [                             # (élévation, m)
    (-75.0, 0.008),                     # adaptation : vers le cou, la barbe s'amincit (le col d'une capuche y monte)
    (-55.0, 0.014),                     # illustration : sous le menton
    (-32.0, 0.016),                     # illustration : la pointe du menton (tête : z 1,615 devant), de 1 à 2,5 cm
    (-24.0, 0.009),                     # adaptation : sous la lèvre inférieure, pour que le menton reste un volume
    (-12.0, 0.006),                     # illustration : la moustache, sur la lèvre supérieure
    (-2.0, 0.004),                      # tête : sous la narine, le bout du nez reste nu et devant
    (10.0, 0.006),                      # illustration : la joue, plus rase que la mâchoire
    (30.0, 0.004),                      # illustration : le favori, ras devant l'oreille
]
PART = [(0.0, 1.0), (40.0, 0.9), (65.0, 0.7), (84.0, 0.5)]   # illustration : (|phi|, part) la mâchoire s'amincit vers l'oreille
GRAIN = 0.0012                          # adaptation : m, écart tiré par sommet (une barbe dense ne lisse pas sa surface)
LISSAGE_DES_NORMALES = 6                # adaptation : passes ; sans elles, la normale de la peau croise ses voisines aux
                                        # creux (sillon sous la lèvre, angle de la mâchoire) à plus de 1 cm
GRAINE = 'barbe-courte'

BARBE = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0344, 0.0507),   # tête : (0 ; -0,017 ; 1,660) au repos, à la hauteur du bout du nez, derrière la bouche
    # favori : devant l'oreille (tête : avant de l'oreille à y -0,002), jusqu'à la tempe
    'phi_max': [(-20.0, 74.0), (30.0, 82.0)],
    # bord bas : sous le menton (tête : sa peau s'arrête à z 1,584), puis le long de la mâchoire jusque sous l'oreille
    'bas': [(0.0, -70.0), (30.0, -66.0), (50.0, -56.0), (66.0, -40.0), (84.0, -20.0)],
    # bord haut : sous le nez, puis la ligne de joue sous la pommette (illustrations), jusqu'au favori
    'haut': [(0.0, -1.0), (14.0, -2.0), (24.0, 2.0), (40.0, 6.0), (60.0, 12.0), (84.0, 26.0)],
    # Lèvres nues : une ellipse d'azimut et d'élévation. Tête : lèvres de z 1,627 à 1,641 à y -0,093, coins à x ±0,022,
    # soit de -19,5 à -11,5 degrés et 18 degrés d'azimut depuis le centre ; illustration : la barbe remonte sous la lèvre
    # inférieure.
    'bouche': {'phi': 21.0, 'elevation': (-21.5, -12.0)},
    # Coins de la bouche nus : un disque d'azimut et d'élévation (degrés). Tête : le coin, à x ±0,022, z 1,643, y -0,088,
    # soit 17,8 et -13,4 degrés depuis le centre, est un pli d'arêtes de 0,6 mm ; sous le poil, le montage y donne à un
    # sommet sur deux les poids du poil voisin, et l'arête s'écrase quand la tête penche (`etirement/arete-ecrasee`,
    # `Sword_Regular_C` et `Sword_Regular_Combo`). adaptation : 1,2 degré, soit 1,5 mm autour du coin ; à 3 degrés, la
    # bouche nue s'élargissait à vue.
    'coin_de_la_bouche': {'phi': 17.8, 'elevation': -13.4, 'rayon': 1.2},
    'meches': {'graine': 'barbe-courte', 'profondeur': 2.0, 'creux': 0.35},   # degrés
    'pas_des_meches': 6.0,
}
