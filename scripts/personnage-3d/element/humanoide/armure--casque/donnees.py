"""Données de `humanoide--armure--casque`, repris de son GLB publié (`element/publie.py`, #3761) : champs du manifeste
publié, `emplacements` compris, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'casque'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
    'emplacements': {'cimier': {'os': 'Head', 'position': [0, 0.215487, -0.006071], 'rotation': [-0.02897, 0, 0]}},
}
MATERIAUX = {
    'metal': ('metal', ((0.55, 0.55, 0.55), 0.0, 0.87)),
    'fleuron': ('accent', ((0.3, 0.3, 0.3), 0.0, 0.87)),
}
BUDGET_TRIANGLES = 1470
