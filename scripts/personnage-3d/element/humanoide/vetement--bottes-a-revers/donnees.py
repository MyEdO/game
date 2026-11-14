"""Données de `humanoide--vetement--bottes-a-revers`, repris de son GLB publié (`element/publie.py`, #3761) : champs
du manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bottes-a-revers'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['mollet_g', 'mollet_d', 'pied_g', 'pied_d'],
}
MATERIAUX = {'botte': ('cuir', ((0.55, 0.55, 0.55), 0.0, 0.87))}
BUDGET_TRIANGLES = 2040
