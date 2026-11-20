"""Données de `humanoide--tete--haut-elfe` (#4413), lues par `element/tete_makehuman.py` : la tête `haut-elfe` de la garde-robe.

LDB 05 l.121 : « Grands et élancés, avec de délicates oreilles pointues ».
"""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'haut-elfe'},
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
NOM = 'tete_haut_elfe'
CUITES = (
    # « délicates oreilles pointues ».
    ('ears/l-ear-shape-pointed', 1.0), ('ears/r-ear-shape-pointed', 1.0),
    # « élancés » : visage ovale, plus fin (HYPOTHÈSE : cible et poids).
    ('head/head-oval', 0.5),
)
