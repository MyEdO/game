"""Données de `humanoide--accessoire--plumet-simple` (le Gladiateur, #4394), lues par `element/plume.py` : la variante
`plumet-simple` de la pièce `plumet` de la garde-robe, posée sur l'emplacement `cimier`.

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02, 773 × 1257 px, hors dépôt, et son
contrat d'éléments du 2026-11-22 (#4394).

Ce qu'elle montre : une seule longue plume rousse plantée derrière le sceau du masque de cuir, à l'avant-droite de la
calotte, qui part vers l'arrière et la droite du personnage. #4394 : une grande plume nette, un étendard lisse de
~30 cm, large de 6 à 7 cm au milieu, la pointe arrondie, une hampe visible, nue au pied, une courbe qui se couche vers
l'arrière ; les mèches effilochées du dessin ne sont pas reprises. Échelle du contrat : ~580 px/m.

Repère : celui de l'emplacement `cimier` qu'offre le masque (`armure--masque-de-cuir`, `CIMIER`), mètres : l'origine
sur la coque, +X la gauche du personnage, +Y la verticale inclinée vers l'arrière, +Z vers l'avant. Chaque cote dit d'où
elle vient : `illustration` ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'plumet-simple'},
    'liaison': {'mode': 'rigide'},
    'couche': 'armure',
}
MATERIAUX = {
    'plume': ('plume', 'plume'),
    'hampe': ('corne', 'os'),
}
"""Illustration : des barbes rousses (`plume`, emplacement `plume`) sur une hampe claire (`os`, emplacement `corne`,
celui des os du masque)."""

BUDGET_TRIANGLES = 400                  # #4394 : plumet du Gladiateur

EMPLACEMENT = 'cimier'
OFFRANT = 'humanoide--armure--masque-de-cuir'
"""L'élément dont le manifeste offre cet emplacement et donne son repère."""
ANGLE_LISSE = 50.0                      # HYPOTHÈSE : degrés, les barbes restent lisses, les franges marquées

# Une plume : une hampe (`chemin`, points de passage d'une courbe) habillée de sections en lentille, la face tournée
# vers l'avant au pied ; `largeurs` et `epaisseurs` donnent, par part de la longueur, la demi-largeur des barbes et la
# demi-épaisseur au droit de la hampe ; `surface`, le matériau de `MATERIAUX` qu'elle prend.
PLUMES = {
    'etendard': {
        'surface': 'plume',
        # #4394 : monte à ~40° vers l'arrière-droite et se couche vers l'arrière ; ~36 cm, dont ~31 de barbes
        'chemin': [(0.0, 0.0, 0.0), (-0.008, 0.040, -0.006), (-0.028, 0.090, -0.030), (-0.056, 0.138, -0.070),
                   (-0.088, 0.176, -0.122), (-0.116, 0.200, -0.180), (-0.136, 0.210, -0.232)],
        # #4394 : hampe nue sur ~5 cm, des barbes de 6,5 cm de large au milieu, la pointe arrondie ; une encoche dans
        # les barbes aux deux tiers (HYPOTHÈSE : sa place, sur une section du maillage)
        'largeurs': [(0.0, 0.002), (0.12, 0.003), (0.2143, 0.018), (0.45, 0.033), (0.5714, 0.032), (0.6429, 0.022),
                     (0.7143, 0.030), (0.9, 0.022), (1.0, 0.014)],
        'epaisseurs': [(0.0, 0.002), (0.12, 0.003), (1.0, 0.003)],   # HYPOTHÈSE : étendard plat
        'sections': 15,                 # HYPOTHÈSE de maillage
    },
    # La hampe : le même chemin, étroite, plus épaisse que l'étendard qu'elle dépasse sur ses deux faces.
    'hampe': {
        'surface': 'hampe',
        'chemin': [(0.0, 0.0, 0.0), (-0.008, 0.040, -0.006), (-0.028, 0.090, -0.030), (-0.056, 0.138, -0.070),
                   (-0.088, 0.176, -0.122), (-0.116, 0.200, -0.180), (-0.136, 0.210, -0.232)],
        'largeurs': [(0.0, 0.0035), (0.6, 0.0025), (1.0, 0.0012)],   # illustration : ~7 mm au pied, effilée
        'epaisseurs': [(0.0, 0.007), (0.6, 0.006), (1.0, 0.0045)],   # HYPOTHÈSE : 2 à 3 mm au-dessus des barbes
        'sections': 8,                  # HYPOTHÈSE de maillage
    },
}
FRANGE = 0.0                            # #4394 : un bord de barbes lisse
RETOMBEE = 0.2
"""HYPOTHÈSE : part de la demi-largeur dont le bord des barbes retombe derrière la face de la plume (barbes arquées)."""
