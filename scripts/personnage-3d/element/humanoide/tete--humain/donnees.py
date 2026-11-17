"""Données de `humanoide--tete--humain` (#4413), lues par `element/tete_makehuman.py` : la tête `humain` de la garde-robe.

Aucune cible cuite : l'homme jeune moyen de MakeHuman, à la taille de la tête humaine publiée (#3761), à laquelle sont
bâties les coiffures et les couvre-chefs.
"""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'humain'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': ['tete', 'visage', 'nez', 'oeil_g', 'oeil_d'],
}
MATERIAUX = {                            # gris de construction, sans couleur cuite
    'peau': ('peau', ((0.62, 0.62, 0.62), 0.0, 0.8)),
    'yeux': ('yeux', ((0.35, 0.35, 0.35), 0.0, 0.3)),
}
BUDGET_TRIANGLES = 8200                  # #4413 : tête de `body` de MakeHuman
NOM = 'tete_humain'
CUITES = ()
