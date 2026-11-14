"""Données de `humanoide--vetement--pourpoint`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'pourpoint'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d'],
}
MATERIAUX = {'pourpoint': ('vet2', ((0.8, 0.78, 0.72), 0.0, 0.87))}
BUDGET_TRIANGLES = 1520
