"""Données de `humanoide--armure--casque-a-cornes`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, `emplacements` compris, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'casque-a-cornes'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
    'emplacements': {'cimier': {'os': 'Head', 'position': [0, 0.215487, -0.006071], 'rotation': [-0.02897, 0, 0]}},
}
MATERIAUX = {
    'metal': ('metal', ((0.55, 0.55, 0.55), 0.0, 0.87)),
    'corne': ('corne', ((0.78, 0.78, 0.78), 0.0, 0.87)),
}
BUDGET_TRIANGLES = 1564
