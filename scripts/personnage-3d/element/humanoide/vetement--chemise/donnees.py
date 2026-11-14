"""Données de `humanoide--vetement--chemise`, repris de son GLB publié (`element/publie.py`, #3761) : champs du
manifeste publié, matériaux lus dans le GLB publié, budget à son compte de triangles."""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'chemise'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['torse', 'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d'],
}
MATERIAUX = {'chemise': ('accent', ((0.6, 0.6, 0.6), 0.0, 0.87))}
BUDGET_TRIANGLES = 1600
