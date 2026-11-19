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
    'cuir': ('cuir', 'cuir-tanne'),
    'fourrure': ('fourrure', 'fourrure'),
    'clous': ('metal', 'acier-battu'),
}
BUDGET_TRIANGLES = 1824
