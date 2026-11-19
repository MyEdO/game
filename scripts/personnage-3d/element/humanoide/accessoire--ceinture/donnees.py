"""Données de `humanoide--accessoire--ceinture`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ceinture'},
    'liaison': {'mode': 'surface'},
    'couche': 'tenue',
}
MATERIAUX = {
    'cuir': ('cuir', 'cuir-tanne'),
    'metal': ('metal', 'acier-battu'),
}
BUDGET_TRIANGLES = 432
