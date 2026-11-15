"""Données de `humanoide--armure--plastron`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, `emplacements` compris, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'plastron'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
    'emplacements': {'poitrine': {'os': 'spine_03', 'position': [0, -0.002592, 0.175228], 'rotation': [0.226485, 0, 0]}},
}
MATERIAUX = {'acier': ('metal', 'acier-battu')}
BUDGET_TRIANGLES = 948
