"""Données de `humanoide--armure--brassards`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'brassards'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': ['avant_bras_g', 'avant_bras_d'],
}
MATERIAUX = {
    'cuir': ('cuir', ((0.45, 0.45, 0.45), 0.0, 0.87)),
    'fourrure': ('fourrure', ((0.7, 0.7, 0.7), 0.0, 0.87)),
    'clous': ('metal', ((0.8, 0.8, 0.8), 0.6, 0.87)),
}
BUDGET_TRIANGLES = 1824
