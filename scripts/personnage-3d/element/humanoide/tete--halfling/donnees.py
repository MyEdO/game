"""Données de `humanoide--tete--halfling` (#4413), lues par `element/tete_makehuman.py` : la tête `halfling` de la garde-robe.

LDB 05 l.89 : « Les halflings sont de petite taille, arborent des joues roses et imberbes, semblables à des enfants
humains aux grands yeux et au visage (et corps) potelé ».
"""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'halfling'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': ['tete', 'visage', 'nez', 'oeil_g', 'oeil_d'],
}
MATERIAUX = {                            # gris de construction, sans couleur cuite
    'peau': ('peau', ((0.62, 0.62, 0.62), 0.0, 0.8)),
    'yeux': ('yeux', ((0.35, 0.35, 0.35), 0.0, 0.3)),
    'cheveux': ('cheveux', ((0.6, 0.6, 0.6), 0.0, 0.95)),   # les sourcils
}
BUDGET_TRIANGLES = 6500                  # procédure, section 7 : tête humanoïde MakeHuman
NOM = 'tete_halfling'
CUITES = (
    # « semblables à des enfants humains » : tête ronde, visage jeune (HYPOTHÈSE : poids).
    ('head/head-round', 0.8), ('head/head-age-decr', 0.6),
    # « visage potelé » : joues pleines (HYPOTHÈSE : poids).
    ('cheek/l-cheek-volume-incr', 0.7), ('cheek/r-cheek-volume-incr', 0.7), ('head/head-fat-incr', 0.4),
    # « grands yeux » (HYPOTHÈSE : poids).
    ('eyes/l-eye-scale-incr', 0.5), ('eyes/r-eye-scale-incr', 0.5),
)
