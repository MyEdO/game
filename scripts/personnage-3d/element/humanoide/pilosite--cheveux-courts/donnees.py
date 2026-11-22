"""Données de `humanoide--pilosite--cheveux-courts` (#4413), lues par `modele.py` : la coiffure `cheveux-courts` de la
garde-robe.

Aucune illustration directrice : la coiffure répond au besoin de #4413, une coupe courte qui se lise à taille de jeu,
pour un homme comme pour une femme. Contrat, tout en HYPOTHÈSES à trancher en revue : des cheveux courts en volume sur
le dessus, coiffés depuis l'épi de l'arrière du crâne vers le front, où des mèches retombent en frange courte ; les
tempes couvertes jusque devant l'oreille ; l'oreille dégagée, la coupe passant au-dessus d'elle et derrière ; la nuque
courte. Une seule pièce coiffe les têtes humaine, naine, haut-elfe et halfling : elle se pose hors de la plus
extérieure des quatre (`chevelure.py`).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut se compte en degrés autour de la verticale du centre du crâne, 0 devant, positif vers la gauche ; une
élévation, en degrés depuis l'horizontale du centre. `têtes` : sonde de construction sur les quatre têtes publiées.
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'cheveux-courts'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', 'chevelure')}
"""La surface des coiffures publiées, `poil`, palette `cheveux`, matière `chevelure` du catalogue."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

CONTOURNE = {'humain': 'humanoide--tete--humain', 'nain': 'humanoide--tete--nain',
             'haut-elfe': 'humanoide--tete--haut-elfe', 'halfling': 'humanoide--tete--halfling'}
"""Les têtes publiées que la chevelure coiffe."""
TETES = ['humain', 'nain', 'haut-elfe', 'halfling']
MATIERES_DE_LA_TETE = ['peau']
ZONES_DES_CLES = ['tete', 'visage', 'nez']
"""Zones de la base dont la coiffure prend ses clés `gabarit_*`, au plus près."""
TETE_DES_CLES = 'humain'
ZONES_DE_LA_TETE = ['tete', 'visage', 'nez']
"""La tête publiée, et ses meshes, dont la coiffure prend ses silhouettes : sa clé `feminin` rapetisse le crâne plus que
celle de la base (#4413)."""
FONDU_DES_CLES = 0
LISSAGE_DES_CLES = 0
"""Rien ne pend : aucune silhouette à fondre de la tête au corps."""
LISSAGE_DES_POIDS = 0
GRAINE = 'cheveux-courts'

OS_DU_CENTRE = 'Head'
CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os : le centre du crâne. Têtes : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""
PORTEE = 0.30                           # m : départ des visées, au-delà de la peau
POLE = (180.0, 62.0)
"""(azimut, élévation) du pôle des colonnes : l'épi, à l'arrière du sommet du crâne, d'où rayonnent les cheveux."""
THETA_DU_POLE = 10.0                    # degrés : premier anneau autour du pôle
COLONNES = 28                           # HYPOTHÈSE de maillage
RANGS = 8                               # HYPOTHÈSE de maillage : du premier anneau au bord

BORD = [(0.0, 37.0), (25.0, 34.0), (45.0, 27.0), (58.0, 12.0), (68.0, 1.0), (75.0, 4.0), (80.0, 19.0),
        (106.0, 19.0), (113.0, 2.0), (122.0, -14.0), (145.0, -25.0), (180.0, -28.0)]
"""(azimut, élévation) : la naissance des cheveux. Le front ; la tempe, couverte jusque devant l'oreille ; le dessus
de l'oreille, que la coupe dégage (têtes : le pavillon va de 83° à 102° d'azimut, de -28° à +12° d'élévation, la pointe
de la haut-elfe la plus haute) ; derrière elle, la nuque, courte."""
PROFIL = [(0.0, 0.013), (0.45, 0.016), (0.85, 0.011), (1.0, 0.001)]
"""(part du pôle au bord, m) : hauteur au-dessus de la plus extérieure des têtes ; le bord se pose sur la peau."""
VOLUME = [(0.0, 1.15), (70.0, 0.85), (180.0, 0.9)]
"""(azimut, facteur de la hauteur) : plus de volume au-dessus du front, des côtés plus ras."""
STRIES = 0.005                          # m, une colonne sur deux plus haute : des mèches
MECHES_DU_BORD = {'graine': 'cheveux-courts-bord', 'profondeur': 5.0, 'creux': 0.35}
"""Degrés : le bord en mèches inégales (`tissu.lambeaux`)."""

MECHES = [
    # la frange : des mèches courtes qui dépassent la naissance des cheveux sur le front
    {'graine': 'cheveux-courts-frange', 'nombre': 4, 'azimuts': (2.0, 62.0), 'demi': (6.0, 9.0), 'depart': 3,
     'allonge': (0.010, 0.022), 'hauteur': (0.004, 0.008)},
    # des épis sur les côtés et l'arrière
    {'graine': 'cheveux-courts-epis', 'nombre': 5, 'azimuts': (70.0, 176.0), 'demi': (8.0, 12.0), 'depart': 2,
     'allonge': (0.004, 0.010), 'hauteur': (0.004, 0.007)},
]
"""Azimuts autour du pôle, 0 vers le front. Mèches en ruban par-dessus la masse (`Chevelure.meches`)."""
