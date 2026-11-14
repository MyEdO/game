"""Données de `humanoide--accessoire--ruban`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ruban'},
    'liaison': {'mode': 'surface'},
    'couche': 'tenue',
}
MATERIAUX = {'ruban': ('vet1', ((0.15, 0.15, 0.15), 0.0, 0.87))}
BUDGET_TRIANGLES = 580
