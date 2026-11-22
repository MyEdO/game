"""Données de `humanoide--pilosite--cheveux-attaches` (#4413), lues par `modele.py` : la coiffure `cheveux-attaches` de
la garde-robe.

Aucune illustration directrice : la coiffure répond au besoin de #4413, des cheveux longs attachés qui se lisent à
taille de jeu. Contrat, tout en HYPOTHÈSES à trancher en revue : les cheveux tirés en arrière depuis le front et les
tempes, plaqués, vers un chignon noué à l'arrière du crâne ; l'oreille dégagée, les cheveux passant au-dessus d'elle et
derrière ; la nuque dégagée sous le chignon. Un chignon plutôt qu'une queue : il tient à la tête seule et ne traverse ni
col ni cape. Une seule pièce coiffe les têtes humaine, naine, haut-elfe et halfling : elle se pose hors de la plus
extérieure des quatre (`chevelure.py`).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut se compte en degrés autour de la verticale du centre du crâne, 0 devant, positif vers la gauche ; une
élévation, en degrés depuis l'horizontale du centre. `têtes` : sonde de construction sur les quatre têtes publiées.
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'cheveux-attaches'},
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
GRAINE = 'cheveux-attaches'

OS_DU_CENTRE = 'Head'
CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os : le centre du crâne. Têtes : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""
PORTEE = 0.30                           # m : départ des visées, au-delà de la peau
POLE = (180.0, 22.0)
"""(azimut, élévation) du pôle des colonnes : le chignon, vers lequel tous les cheveux sont tirés."""
THETA_DU_POLE = 13.0                    # degrés : premier anneau autour du pôle, sous le chignon
COLONNES = 28                           # HYPOTHÈSE de maillage
RANGS = 9                               # HYPOTHÈSE de maillage : du premier anneau au bord

BORD = [(0.0, 40.0), (25.0, 37.0), (45.0, 29.0), (58.0, 15.0), (68.0, 9.0), (78.0, 19.0), (106.0, 19.0),
        (114.0, 2.0), (125.0, -16.0), (150.0, -27.0), (180.0, -30.0)]
"""(azimut, élévation) : la naissance des cheveux. Le front, haut ; la tempe ; le dessus de l'oreille, dégagée (têtes :
le pavillon va de 83° à 102° d'azimut, de -28° à +12° d'élévation, la pointe de la haut-elfe la plus haute) ; derrière
elle, la nuque."""
PROFIL = [(0.0, 0.009), (0.5, 0.008), (0.9, 0.007), (1.0, 0.001)]
"""(part du pôle au bord, m) : hauteur au-dessus de la plus extérieure des têtes. Des cheveux tirés, plaqués."""
VOLUME = [(0.0, 1.0), (180.0, 1.0)]
STRIES = 0.003                          # m, une colonne sur deux plus haute : des mèches tirées vers le chignon
MECHES_DU_BORD = {'graine': 'cheveux-attaches-bord', 'profondeur': 2.0, 'creux': 0.3}
"""Degrés : le bord en mèches inégales (`tissu.lambeaux`)."""

CHIGNON = {
    'direction': (180.0, 22.0),         # (azimut, élévation) : l'arrière du crâne, au-dessus de la nuque
    'saillie': 0.020,                   # m, du centre de la boule à la peau
    'rayon': 0.036,                     # m, en travers
    'hauteur': 0.030,                   # m, le long de la sortie du crâne : une boule aplatie
    'meridiens': 10,                    # HYPOTHÈSE de maillage
    'paralleles': 5,
    'ouverture': 125.0,                 # degrés depuis le sommet de la boule : le reste est enfoui dans la calotte
    'vrille': 16.0,                     # degrés par parallèle : des cheveux enroulés
    'stries': 0.10,                     # part du rayon, un méridien sur deux plus gros
}
"""Le chignon (`Chevelure.chignon`) : une boule de 7 cm de large qui dépasse le crâne de 5 cm."""
