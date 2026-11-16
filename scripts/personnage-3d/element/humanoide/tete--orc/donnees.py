"""Données de `humanoide--tete--orc` (#4379), lues par `element/tete.py` : la tête `orc` de la garde-robe.

Illustration directrice : l'Orc du Livre de Base, page 327 (bestiaire), hors dépôt, avec son contrat de tête. Ce qu'elle
montre de la tête : un crâne large et bas au front fuyant, des arcades lourdes, de petits yeux rouges enfoncés, un nez
court épaté, une mâchoire inférieure massive et avancée d'où montent deux crocs, de petites oreilles pointues couchées
vers l'arrière, un cou épais. La gueule hurlante de l'illustration est une expression : au repos, la gueule est fermée,
la mâchoire en avant de la lèvre, les défenses et les dents du bas dehors (HYPOTHÈSE de repos).
La nuque et le dos du crâne ne se voient pas (HYPOTHÈSE : crâne lisse et rond).

Repère (`element/tete.py`) : mètres, depuis la tête de l'os `Head` au repos, (0 ; 0,0174 ; 1,6093) dans la base ;
l'avant vers -y, la gauche du personnage vers +x. Chaque cote dit d'où elle vient : `illustration` (proportion relevée
sur la tête dessinée, rapportée à la tête humaine publiée), `base` (relevée sur la tête de la base) ou `HYPOTHÈSE`.
"""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'orc'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': ['tete', 'visage', 'nez', 'oeil_g', 'oeil_d'],
}
MATERIAUX = {                            # gris de construction, sans couleur cuite
    'peau': ('peau', ((0.62, 0.62, 0.62), 0.0, 0.8)),
    'yeux': ('yeux', ((0.35, 0.35, 0.35), 0.0, 0.3)),
    'dents': ('corne', ((0.78, 0.78, 0.78), 0.0, 0.6)),   # aucune texture d'os au catalogue : gris de construction
}
BUDGET_TRIANGLES = 2500                  # procédure, section 7 : tête
NOM = 'tete_orc'
ZONES_DES_CLES = ['tete', 'visage', 'nez']
"""Zones de peau de la base que la tête remplace : ses poids au plus près, ses clés par visée depuis le centre."""

CENTRE = (0.0, -0.0054, 0.0807)          # base : milieu de la boîte de la tête, sous les yeux
COLONNES = 48                            # 7,5° en moyenne
SERRAGE_DEVANT = 0.45                    # colonnes à 4,1° devant, 10,9° derrière
RANGS = [0.045, 0.095, 0.14, 0.18, 0.215, 0.25, 0.285, 0.32, 0.355, 0.39, 0.425, 0.46, 0.495, 0.53, 0.565, 0.605,
         0.66, 0.74, 0.83, 0.92]
"""Part de l'arc de la couture au pôle par rang : serrés de la gorge au front (devant, 5,4° par rang de -42° à +29°
d'élévation, la hauteur du menton aux arcades)."""
FONDU_DU_COU = 0.2
"""Part de l'arc sur laquelle le rayon passe de la couture du cou à la forme : le cou épais monte dans la nuque."""
AXE_DU_VISAGE = 0.05                     # z du milieu des arcades au menton, axe du retournement de `visage_inverse`

FORME = [
    # Crâne : dôme rond derrière les arcades (illustration), à 3 cm sous le sommet du crâne humain et 1 cm de ses côtés
    # (base : sommet z 0,21, demi-largeur 0,075 à z 0,14) pour qu'un couvre-chef de la tête humaine s'y ajuste ; front
    # fuyant dès les arcades ; l'arrière sur la nuque de la base (HYPOTHÈSE : le dos ne se voit pas).
    {'forme': 'ellipsoide', 'centre': (0.0, 0.0, 0.105), 'rayons': (0.084, 0.088, 0.074), 'lissage': 0.0},
    # Nuque épaisse : le cou de la base monte dans le crâne sans marche (base : nuque à y 0,06 à 0,08).
    {'forme': 'ellipsoide', 'centre': (0.0, 0.016, 0.04), 'rayons': (0.074, 0.058, 0.07), 'lissage': 0.03},
    # Arcades : un bourrelet continu d'une tempe à l'autre, froncé au milieu, qui surplombe les yeux (illustration).
    {'forme': 'tube', 'points': [(-0.078, -0.06, 0.098), (-0.056, -0.108, 0.114), (-0.026, -0.132, 0.111),
                                 (0.0, -0.13, 0.1), (0.026, -0.132, 0.111), (0.056, -0.108, 0.114),
                                 (0.078, -0.06, 0.098)],
     'rayons': [0.014, 0.021, 0.022, 0.017, 0.022, 0.021, 0.014], 'lissage': 0.022, 'visage': True},
    # Mâchoire supérieure : museau court (illustration), sous les arcades.
    {'forme': 'ellipsoide', 'centre': (0.0, -0.082, 0.064), 'rayons': (0.062, 0.056, 0.04), 'lissage': 0.02,
     'visage': True},
    # Pommettes saillantes.
    {'forme': 'ellipsoide', 'centre': (0.066, -0.08, 0.074), 'rayons': (0.024, 0.032, 0.018), 'lissage': 0.012,
     'visage': True, 'miroir': True},
    # Nez court, épaté et retroussé (illustration), ailes larges.
    {'forme': 'ellipsoide', 'centre': (0.0, -0.138, 0.076), 'rayons': (0.022, 0.02, 0.016), 'lissage': 0.01,
     'visage': True},
    {'forme': 'ellipsoide', 'centre': (0.023, -0.134, 0.067), 'rayons': (0.013, 0.013, 0.012), 'lissage': 0.008,
     'visage': True, 'miroir': True},
    # Lèvre supérieure, en retrait de la lèvre inférieure.
    {'forme': 'tube', 'points': [(-0.066, -0.082, 0.052), (-0.04, -0.124, 0.052), (0.0, -0.138, 0.053),
                                 (0.04, -0.124, 0.052), (0.066, -0.082, 0.052)],
     'rayons': [0.007, 0.009, 0.009, 0.009, 0.007], 'lissage': 0.01, 'visage': True},
    # Mâchoire inférieure énorme, plus large que le crâne, avancée de 3,5 cm devant la lèvre supérieure (illustration :
    # la mâchoire porte les défenses loin devant le museau) ; son dessous remonte à la couture de la gorge (base :
    # z 1,589).
    {'forme': 'ellipsoide', 'centre': (0.0, -0.092, 0.002), 'rayons': (0.094, 0.078, 0.046), 'lissage': 0.014,
     'visage': True},
    # Angles de la mâchoire, sous les oreilles.
    {'forme': 'ellipsoide', 'centre': (0.074, -0.03, 0.028), 'rayons': (0.03, 0.046, 0.042), 'lissage': 0.014,
     'visage': True, 'miroir': True},
    # Menton carré.
    {'forme': 'ellipsoide', 'centre': (0.0, -0.152, -0.014), 'rayons': (0.042, 0.02, 0.024), 'lissage': 0.012,
     'visage': True},
    # Lèvre inférieure épaisse, en bourrelet sur le bord de la mâchoire.
    {'forme': 'tube', 'points': [(-0.076, -0.07, 0.04), (-0.052, -0.138, 0.036), (0.0, -0.166, 0.034),
                                 (0.052, -0.138, 0.036), (0.076, -0.07, 0.04)],
     'rayons': [0.009, 0.012, 0.012, 0.012, 0.009], 'lissage': 0.008, 'visage': True},
    # Fente de la bouche fermée, entre les deux lèvres.
    {'forme': 'tube', 'points': [(-0.076, -0.072, 0.052), (-0.05, -0.128, 0.047), (0.0, -0.15, 0.046),
                                 (0.05, -0.128, 0.047), (0.076, -0.072, 0.052)],
     'rayons': [0.006] * 5, 'lissage': 0.004, 'creux': True, 'visage': True},
    # Pli du museau, de l'aile du nez au coin de la bouche (illustration).
    {'forme': 'tube', 'points': [(0.036, -0.134, 0.078), (0.052, -0.12, 0.064), (0.068, -0.096, 0.052)],
     'rayons': [0.007] * 3, 'lissage': 0.008, 'creux': True, 'visage': True, 'miroir': True},
    # Pli de la joue, du coin de l'œil à l'angle de la mâchoire, sous la pommette (illustration).
    {'forme': 'tube', 'points': [(0.058, -0.112, 0.068), (0.076, -0.08, 0.05), (0.084, -0.046, 0.034)],
     'rayons': [0.008] * 3, 'lissage': 0.008, 'creux': True, 'visage': True, 'miroir': True},
    # Sillons du crâne, des arcades vers l'arrière (illustration : crâne bosselé de crêtes), sur une colonne de la
    # grille chacun.
    {'forme': 'tube', 'points': [(0.0, -0.118, 0.13), (0.0, -0.085, 0.164), (0.0, -0.035, 0.182)],
     'rayons': [0.009] * 3, 'lissage': 0.005, 'creux': True, 'visage': True},
    {'forme': 'tube', 'points': [(0.0253, -0.118, 0.13), (0.0179, -0.085, 0.164), (0.0067, -0.035, 0.182)],
     'rayons': [0.009] * 3, 'lissage': 0.005, 'creux': True, 'visage': True, 'miroir': True},
    {'forme': 'tube', 'points': [(0.059, -0.1, 0.128), (0.045, -0.078, 0.158), (0.017, -0.035, 0.18)],
     'rayons': [0.009] * 3, 'lissage': 0.005, 'creux': True, 'visage': True, 'miroir': True},
    # Pli du menton, sous la lèvre inférieure.
    {'forme': 'tube', 'points': [(-0.044, -0.146, 0.016), (0.0, -0.172, 0.014), (0.044, -0.146, 0.016)],
     'rayons': [0.004] * 3, 'lissage': 0.008, 'creux': True, 'visage': True},
    # Orbites creusées sous les arcades.
    {'forme': 'ellipsoide', 'centre': (0.038, -0.124, 0.088), 'rayons': (0.019, 0.026, 0.012), 'lissage': 0.008,
     'creux': True, 'visage': True, 'miroir': True},
]

OEIL = {'centre': (0.037, -0.098, 0.088), 'rayon': 0.0105, 'cotes': 8, 'rangs': 4}   # petits, au fond de l'orbite
OREILLE = {                              # petite, pointue, couchée vers l'arrière et le haut (illustration)
    'base': (0.076, 0.004, 0.095),       # 8 mm dans le crâne
    'direction': (0.6, 0.7, 0.45),
    'normale': (0.6, -0.75, 0.1),
    'longueur': 0.075,
    'largeur': (0.016, 0.022, 0.3),      # demi-largeur au départ, au plus large, part de la longueur au plus large
    'epaisseur': (0.009, 0.002),         # demi-épaisseur à la racine, à la pointe
    'creux': 0.3,
    'cambrure': 0.05,
    'rangs': 5,
    'cotes': 8,
}
CROCS = [{                               # deux défenses de la mâchoire inférieure, devant la lèvre supérieure (illustration)
    'base': (0.044, -0.142, 0.028),      # dans la lèvre inférieure
    'inflexion': (0.05, -0.176, 0.058),
    'pointe': (0.064, -0.162, 0.1),
    'rayon': 0.014,                      # épaisses à la base
    'effilement': 1.4,
    'segments': 5,
    'cotes': 6,
}]
DENTS = [                                # dents courtes et inégales de la mâchoire inférieure, entre les défenses (HYPOTHÈSE)
    {'base': (x, y, 0.044), 'direction': (dx, -0.2, 1.0), 'longueur': longueur, 'rayon': rayon, 'cotes': 4}
    for x, y, dx, longueur, rayon in ((-0.027, -0.157, -0.1, 0.015, 0.0052), (-0.015, -0.162, 0.08, 0.01, 0.0045),
                                      (-0.004, -0.164, -0.05, 0.014, 0.005), (0.008, -0.163, 0.1, 0.009, 0.0044),
                                      (0.019, -0.16, -0.06, 0.016, 0.0052), (0.03, -0.155, 0.1, 0.01, 0.0045))
]
