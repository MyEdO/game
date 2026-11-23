"""Données de `humanoide--armure--masque-de-cuir` (le Gladiateur, #4394), lues par `modele.py` : la variante
`masque-de-cuir` de la pièce `casque` de la garde-robe.

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02, 773 × 1257 px, hors dépôt, son
contrat d'éléments (#4394) et la lecture qu'en donne l'utilisateur le 2026-11-22 (#4394).

Ce qu'elle montre : un morceau de cuir rapiécé et cousu qui couvre la tête. Une calotte un peu plus ample que le crâne,
prolongée d'un demi-masque qui couvre le front, les yeux (deux ouvertures en amande, le coin extérieur relevé) et le
haut du nez ; le bas du masque court sous les yeux, d'une pommette à l'autre, le bas du visage reste nu. De chaque
pommette, devant l'oreille, une patte étroite descend le long de la mâchoire et finit en boucle. Les oreilles
restent dégagées ; derrière elles le bord redescend sur la nuque. Des coutures à gros points courent sur le front et la
calotte, des pièces y sont rapportées, dont une au-dessus de l'œil droit. À l'avant-droite, un sceau de pureté, rond, de cire orangée,
accroche un parchemin : une bande beige, écrite, qui pend le long du côté droit de la tête, en queue d'aronde. Un os
en arc passe sur le crâne sous le cuir : on en voit un bout dressé au sommet, terminé par sa tête, et un bout effilé au
côté gauche, vers l'arrière. La plume part du haut du sceau. La croix du front est un motif peint : omise, comme
l'écriture du parchemin. Échelle du contrat : ~580 px/m ; la tête couverte y fait ~125 px de large, 0,21 m.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut se compte en degrés autour de la verticale du centre, 0 devant, positif vers la gauche. Chaque cote dit
d'où elle vient : `illustration`, `tête` (sonde de construction sur la tête publiée `humanoide--tete--humain`) ou
`HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'masque-de-cuir'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
}
"""`couvre` vide : le visage se voit sous le demi-masque et par ses ouvertures, les oreilles sous le bord."""

MATERIAUX = {
    'cuir': ('cuir', 'cuir-use'),
    'parchemin': ('corne', 'papier'),
    'cire': ('accent', 'cire-a-cacheter'),
    'os': ('corne', 'os'),
    'encre': (None, 'encre-noire'),
}
"""Illustration : cuir de la calotte, du masque, des joues, des coutures et des lacets, usé et rapiécé (`cuir-use`,
emplacement `cuir`) ; parchemin beige (`papier`) et os (`os`) à l'emplacement `corne`, celui du parchemin du sceau du Prêtre
(`accessoire--sceau-de-cire`) et des os du collier (`rigide--collier_a_cranes`) ; cire du sceau (`cire-a-cacheter`) à
l'emplacement `accent`, celui de la cire du Prêtre ; encre (`encre-noire`) sans emplacement : sa couleur est celle de
sa matière, cuite au GLB."""

BUDGET_TRIANGLES = 2000                 # procédure du skill, section 7 : armure par pièce

CONTOURNE = {'tete': 'humanoide--tete--humain'}
MATIERES_DE_LA_TETE = ['peau', 'yeux']
ZONES_DES_CLES = ('tete', 'visage', 'nez')
"""La peau de la tête, qu'elle coiffe : la croissance de ses clés porte celle des silhouettes et des clés `gabarit_*`
sur l'écart de chaque sommet au corps (`tete.cles_du_corps`)."""
OS = 'Head'

CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os `OS` : le centre du crâne. Tête : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""

# ---------------------------------------------------------------- coque
DEMI_AXES = {'cote': 0.094, 'avant': 0.114, 'arriere': 0.108, 'haut': 0.122}
"""m. Tête : la peau est à 0,069-0,077 du centre sur les côtés (0,085 à l'oreille), 0,100-0,104 au front, 0,094-0,096
derrière, 0,109 au sommet. Illustration : un cuir épais, un peu plus ample que le crâne, ~1,5 cm de plus de chaque
côté."""
JEU = 0.005
"""m : distance minimale de la nappe intérieure à la peau. HYPOTHÈSE : le cuir posé sur le crâne nu (la tenue du
Gladiateur ne porte que la barbe)."""
EPAISSEUR = 0.003                       # HYPOTHÈSE : cuir épais, lisible à taille de jeu, double nappe
AZIMUTS = [0.0, 5.0, 10.0, 16.0, 22.0, 28.0, 34.0, 40.0, 47.0, 54.0, 62.0, 75.0, 90.0, 105.0, 120.0, 140.0, 160.0, 180.0]
"""Degrés : les colonnes de la coque d'un côté, reprises en miroir de l'autre. HYPOTHÈSE de maillage : serrées devant,
où le masque épouse le nez et s'ouvre aux yeux, tous les 15 à 20° derrière."""
BORD = [(0.0, -0.036), (5.0, -0.036), (10.0, -0.035), (40.0, -0.035), (54.0, -0.030), (62.0, -0.015), (75.0, 0.034),
        (105.0, 0.034), (120.0, 0.0), (140.0, -0.050), (180.0, -0.055)]
"""(azimut, m) : la hauteur du bord au-dessus du centre. Illustration : un demi-masque, dont le bas court sous les yeux
d'une pommette à l'autre et s'arrête à mi-nez (tête : la racine du nez au centre, son bas à -0,059) ; le bord remonte
par-dessus l'oreille, qu'il dégage (tête : le haut de l'oreille à ~+0,025), puis redescend sur la nuque. HYPOTHÈSE : la
nuque couverte jusqu'à 5 cm sous le centre, à la base du crâne."""
PROFIL_BAS = [(0.0, 0.0), (0.4, -0.004), (0.7, -0.020), (0.9, -0.045), (1.0, -0.060)]
"""(part de la descente, m) : sous le centre, ce que le rayon gagne sur celui de l'équateur, de l'équateur (0) à
`DESCENTE` (1). Tête : sous la pommette la mâchoire rentre vers le menton (peau à 0,044-0,049 du centre à -0,12) ; les
joues la suivent."""
DESCENTE = 0.135                        # m : la hauteur sous le centre où finit `PROFIL_BAS`, la pointe des joues
ANCRE = 0.050
"""m : l'abscisse du méridien, au-dessus du plus haut point du bord, où finissent les rangs du bas."""
RANGS_DU_BAS = [0.0, 0.275, 0.44, 0.61, 1.0]
"""Parts du trajet du bord à `ANCRE` où passent les rangs du bas. HYPOTHÈSE de maillage : devant, où le bord est à
-0,035, trois rangs à -0,012, +0,002 et +0,017 encadrent l'ouverture de l'œil."""
RANGS_DU_HAUT = [0.087, 0.124]
"""m : les abscisses de méridien des rangs entre `ANCRE` et le dernier rang avant le pôle. HYPOTHÈSE de maillage."""
ELEVATION_HAUTE = 76.0                  # degrés : dernier rang avant le pôle

# ---------------------------------------------------------------- yeux
OEIL = {
    'azimut': 19.5,                     # tête : le globe à x = ±0,032, 0,090 devant le centre
    'hauteur': 0.002,                   # tête : le globe de -0,011 à +0,016
    'demi_largeur': 9.5,                # degrés ; illustration : l'ouverture déborde le globe (tête : de 12,5 à 26°)
    'demi_hauteur': 0.013,              # illustration : amande ~deux fois plus large que haute
    'coin': 0.005,                      # HYPOTHÈSE de maillage : demi-hauteur gardée aux coins de l'amande
    'releve': 0.004,                    # illustration : le coin extérieur plus haut que l'intérieur, de 4 mm par demi-largeur
}

# ---------------------------------------------------------------- joues
JOUE = {
    # (azimut, hauteur, demi-largeur en m) le long de la patte, de la pommette à sa pointe sous le menton.
    # Illustration : de chaque pommette une patte de cuir étroite, ~1,8 cm, descend le long de la mâchoire par-dessus la
    # barbe. Tête : l'oreille commence à ~70° ; la mâchoire rentre de 55° à la pommette à ~30° au menton (-0,126).
    'trace': [(56.0, -0.020, 0.009), (55.0, -0.036, 0.009), (53.0, -0.055, 0.009), (48.0, -0.080, 0.009),
              (41.5, -0.102, 0.009), (35.0, -0.120, 0.007), (31.0, -0.133, 0.0025)],
    'stations': 9,                      # HYPOTHÈSE de maillage : points le long de la patte
    'saillie': 0.002,                   # HYPOTHÈSE : la patte est cousue par-dessus le bord de la coque
}

# ---------------------------------------------------------------- lacets
CORDON = {
    # Illustration : la patte se prolonge jusqu'aux clavicules et finit en boucle. HYPOTHÈSE : il n'en reste qu'un bout
    # de ~2 cm, sans boucle. Rigide avec la tête, un bout pendu entre dans le cou ou le torse dès que la tête se penche
    # (mesures de #4394 : 8 cm pendus, 3,5 cm pendus, 3,5 cm vers l'avant, tous traversés ; une boucle de 1 cm au bout,
    # le cou passe devant elle sous `carrure_plus`).
    # (vers le dehors, vers l'avant, vers le haut) en m depuis la pointe de la patte.
    'trace': [(0.0, 0.0, 0.004), (0.003, 0.004, -0.006), (0.006, 0.007, -0.014)],
    'rayon': 0.003,                     # illustration : ~3 px, 5 mm de diamètre
    'cotes': 4,                         # HYPOTHÈSE de maillage
}

# ---------------------------------------------------------------- coutures
COUTURES = {
    # (azimut, hauteur) des points de passage de chaque couture, sur la coque. Illustration : une couture à gros points
    # monte du coin de l'œil droit vers le sommet, une autre de la tempe gauche ; une troisième barre le front au-dessus
    # des yeux, d'une tempe à l'autre. HYPOTHÈSE : leur tracé exact, lu à ~1 cm près, et la couture de l'arrière, du
    # sommet à la nuque, que l'illustration ne montre pas.
    'traces': [
        [(-34.0, 0.030), (-30.0, 0.055), (-24.0, 0.078), (-14.0, 0.098), (0.0, 0.112)],
        [(-50.0, 0.034), (-28.0, 0.040), (0.0, 0.043), (28.0, 0.040), (50.0, 0.034)],
        [(62.0, 0.036), (56.0, 0.062), (44.0, 0.086), (26.0, 0.104), (0.0, 0.114)],
        [(172.0, 0.108), (168.0, 0.080), (176.0, 0.045), (170.0, 0.005), (178.0, -0.040)],
    ],
    'rayon': 0.0045,                    # illustration : bourrelet de ~5 px, 9 mm
    'cotes': 3,                         # HYPOTHÈSE de maillage : un bourrelet à trois pans, à demi noyé dans le cuir
    'points': 7,                        # HYPOTHÈSE de maillage : sections par couture
}

# ---------------------------------------------------------------- pièces rapportées
PIECES = [
    # Des pièces de cuir cousues par-dessus la calotte, chacune entre deux azimuts et deux hauteurs, en saillie de
    # l'épaisseur d'un second cuir ; `biais` : degrés dont le haut de la pièce est décalé de son bas, pour une pièce de
    # travers. Illustration : une pièce au-dessus de l'œil droit, ~4 cm sur 3, entre les coutures ; des pièces de tailles
    # inégales sur la calotte. HYPOTHÈSE : la place des autres, que la vue de face ne donne pas.
    {'azimuts': (-27.0, -6.0), 'hauteurs': (0.048, 0.080), 'saillie': 0.003, 'biais': 0.0},
    {'azimuts': (12.0, 40.0), 'hauteurs': (0.050, 0.092), 'saillie': 0.004, 'biais': 7.0},
    {'azimuts': (80.0, 118.0), 'hauteurs': (0.052, 0.098), 'saillie': 0.0035, 'biais': -9.0},
    {'azimuts': (-150.0, -112.0), 'hauteurs': (0.040, 0.094), 'saillie': 0.004, 'biais': 8.0},
    {'azimuts': (130.0, 166.0), 'hauteurs': (-0.034, 0.030), 'saillie': 0.003, 'biais': -6.0},
]

# ---------------------------------------------------------------- sceau et bande (`element/sceau.py`)
SCEAU = {
    'azimut': -50.0,                    # illustration : à l'avant-droite de la calotte, au-dessus de la tempe
    'hauteur': 0.066,                   # m au-dessus du centre ; illustration : sur le haut du front
    'rayon': 0.015,                     # #4394 : une galette de cire de ~3 cm
    'epaisseur': 0.006,                 # #4394 : 5 à 8 mm
    'segments': 10,                     # HYPOTHÈSE de maillage
}
CACHET = {'rayon': 0.55, 'creux': 0.001}
"""HYPOTHÈSE : l'empreinte au milieu de la cire, en fraction du rayon, et sa profondeur."""

RUBAN = {
    'longueur': 0.125,                  # #4394 : 12 à 18 cm pendus sous le sceau
    'largeur': 0.045,                   # illustration : ~4,5 cm
    'epaisseur': 0.0015,                # #4394 : 1 à 2 mm
    'jeu': 0.001,                       # HYPOTHÈSE : au-dessus du cuir, de ses coutures et de ses pièces
    'derive': 0.0,                      # la bande pend droit
    'aronde': 0.014,                    # HYPOTHÈSE : la queue d'aronde, comme la bande du Prêtre
    'segments': 8,                      # HYPOTHÈSE de maillage
}
"""La bande de parchemin prise sous le sceau : couchée sur le cuir, puis pendue à la verticale du point le plus saillant
au-dessus d'elle (`pendre`)."""

ECRITURE = {'trait': 0.004, 'espace': 0.006, 'jeu': 0.001, 'autour': 0.006}
"""Les mots de la bande : un trait d'encre de `trait` de large par mot, à `jeu` au-dessus du parchemin, à `espace` du
précédent, à `autour` du sceau et de la queue d'aronde. Illustration : une bande écrite ; HYPOTHÈSE : les valeurs."""
LIGNES_DU_RUBAN = {-0.010: [0.022, 0.016, 0.024], 0.010: [0.018, 0.026, 0.014]}
"""HYPOTHÈSE : par décalage (m) depuis le milieu de la bande, vers la gauche du personnage, les longueurs des mots qui
la descendent."""

PORTEE = 0.3                            # m : distance à l'axe de la tête d'où part chaque visée vers le cuir
ANGLE_LISSE = 40                        # degrés : arêtes du sceau plus vives que cet angle gardées vives

# ---------------------------------------------------------------- os
OS_DU_SOMMET = {
    'azimut': 70.0,                     # illustration : au sommet, un peu à gauche et en arrière de la croix du front
    'elevation': 72.0,
    'direction': (0.22, -0.10, 1.0),    # (vers la gauche, vers l'avant, vers le haut) : dressé, à peine penché
    'longueur': 0.060,                  # illustration : ~35 px, 6 cm
    'rayon': 0.006,                     # illustration : diaphyse de ~7 px, 1,2 cm
    'bouton': 0.011,                    # illustration : tête de l'os, ~2,2 cm
    'cotes': 5,                         # HYPOTHÈSE de maillage
}
OS_DU_COTE = {
    'azimut': 100.0,                    # illustration : au côté gauche, derrière la tempe
    'hauteur': 0.040,                   # illustration : à la hauteur du front
    'direction': (0.80, -0.55, 0.12),   # (vers la gauche, vers l'avant, vers le haut) : vers le dehors et l'arrière
    'longueur': 0.070,                  # illustration : ~40 px, 7 cm
    'rayon': 0.007,                     # illustration : ~1,4 cm de diamètre au sortir du cuir, effilé
    'enfoncement': 0.008,               # HYPOTHÈSE : l'os passe sous le cuir
    'cotes': 5,                         # HYPOTHÈSE de maillage
}
"""Les deux bouts visibles de l'os en arc qui passe sur le crâne sous le cuir ; entre eux il est caché et n'est pas
modelé."""

# ---------------------------------------------------------------- cimier
CIMIER = {
    'azimut': -56.0,
    'elevation': 47.0,
    'inclinaison': 12.0,
}
"""L'emplacement `cimier` qu'offre la pièce : sur la coque, à cet azimut et à cette élévation depuis le centre.
Illustration : la plume sort de derrière le haut du sceau (dont le centre est à ~35° d'élévation). Son axe Y est la verticale
inclinée de `inclinaison` degrés vers l'arrière, son axe X la gauche du personnage. HYPOTHÈSE de valeur : 12°
d'inclinaison, celle du casque du Soldat."""
