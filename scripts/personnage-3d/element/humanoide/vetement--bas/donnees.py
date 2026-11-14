"""Données de `humanoide--vetement--bas`, repris de son GLB publié (`element/publie.py`, #3761) : champs du manifeste
publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bas'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['genou_g', 'genou_d', 'mollet_g', 'mollet_d', 'pied_g', 'pied_d'],
}
MATERIAUX = {'bas': ('vet2', ((0.8, 0.8, 0.8), 0.0, 0.87))}
BUDGET_TRIANGLES = 1656
