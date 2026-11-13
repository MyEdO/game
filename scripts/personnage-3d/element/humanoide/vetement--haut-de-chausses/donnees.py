"""Données de `humanoide--vetement--haut-de-chausses`, repris de son GLB publié (`element/publie.py`, #3761) : champs
du manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'haut-de-chausses'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d'],
}
MATERIAUX = {
    'haut_de_chausses': ('vet1', ((0.62, 0.62, 0.62), 0.0, 0.87)),
    'creves': ('vet2', ((0.62, 0.62, 0.62), 0.0, 0.87)),
}
BUDGET_TRIANGLES = 1596
