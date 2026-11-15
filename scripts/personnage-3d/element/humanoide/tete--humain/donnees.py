"""Données de `humanoide--tete--humain`, repris de son GLB publié (`element/publie.py`, #3761) : champs du manifeste
publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'humain'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': ['tete', 'visage', 'nez', 'oeil_g', 'oeil_d'],
}
MATERIAUX = {
    'peau': ('peau', ((0.62, 0.62, 0.62), 0.0, 0.87)),
    'cheveux': ('cheveux', ((0.18, 0.18, 0.18), 0.0, 0.87)),
    'yeux': ('yeux', ((0.35, 0.35, 0.35), 0.0, 0.87)),
}
BUDGET_TRIANGLES = 1788
