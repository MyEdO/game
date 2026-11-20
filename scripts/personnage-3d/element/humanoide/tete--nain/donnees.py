"""Données de `humanoide--tete--nain` (#4413), lues par `element/tete_makehuman.py` : la tête `nain` de la garde-robe.

LDB 05 l.46 : « Les nains sont trapus, musclés, épais avec un large torse. Leurs traits sont rudes et leurs chevelures
épaisses. »
"""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'nain'},
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
NOM = 'tete_nain'
CUITES = (
    # « trapus », « épais » : tête carrée, plus large et plus basse (HYPOTHÈSE : poids).
    ('head/head-square', 0.7), ('head/head-scale-horiz-incr', 0.6), ('head/head-scale-vert-decr', 0.5),
    # « traits rudes » : nez fort, arcades avancées (HYPOTHÈSE : cibles et poids).
    ('nose/nose-volume-incr', 0.6), ('eyebrows/eyebrows-trans-forward', 0.4),
    # HYPOTHÈSE : visage mûr, que le livre ne décrit pas.
    ('head/head-age-incr', 0.5),
)
