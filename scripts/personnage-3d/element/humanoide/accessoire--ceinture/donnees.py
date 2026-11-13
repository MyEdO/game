"""Données de `humanoide--accessoire--ceinture`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ceinture'},
    'liaison': {'mode': 'surface'},
    'couche': 'tenue',
}
MATERIAUX = {
    'cuir': ('cuir', ((0.4, 0.4, 0.4), 0.0, 0.87)),
    'metal': ('metal', ((0.62, 0.62, 0.62), 0.6, 0.87)),
}
BUDGET_TRIANGLES = 432
