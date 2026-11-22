"""Données de `humanoide--tete--gobelin` (#4379), lues par `element/tete.py` : la tête `gobelin` de la garde-robe.

Illustration directrice : le Gobelin du Livre de Base, page 328 (bestiaire), hors dépôt, avec son contrat de tête. Ce
qu'elle montre de la tête : un crâne étroit au front bas, des arcades froncées en V, un long nez crochu, de très grandes
oreilles pointues écartées vers le haut et l'arrière, deux anneaux à l'oreille qu'on voit (la gauche : le gobelin
regarde à gauche de l'image, il montre son côté gauche), une bouche large à dents fines et pointues, un menton pointu,
des joues creuses, des yeux rouge-orangé. La gueule ouverte de l'illustration est une expression : au repos, la bouche
est fermée, les deux rangées de dents croisées devant les lèvres (HYPOTHÈSE de repos). La nuque ne
se voit pas (HYPOTHÈSE : crâne lisse, allongé vers l'arrière).

Repère (`element/tete.py`) : mètres, depuis la tête de l'os `Head` au repos, (0 ; 0,0174 ; 1,6093) dans la base ;
l'avant vers -y, la gauche du personnage vers +x. Les cotes se donnent à l'échelle de la tête humaine : le facteur
`head` du gabarit `gremlin` (1,3) agrandit la tête montée. Chaque cote dit d'où elle vient : `illustration` (proportion
relevée sur la tête dessinée), `base` (relevée sur la tête de la base) ou `HYPOTHÈSE`.
"""

MANIFESTE = {
    'categorie': 'tete',
    'cle': {'tete': 'gobelin'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': ['tete', 'visage', 'nez', 'oeil_g', 'oeil_d'],
}
MATERIAUX = {                            # peau et yeux : gris de construction, sans couleur cuite
    'peau': ('peau', ((0.62, 0.62, 0.62), 0.0, 0.8)),
    'yeux': ('yeux', ((0.35, 0.35, 0.35), 0.0, 0.3)),
    'dents': ('corne', 'os'),
    'anneaux': ('metal', 'acier-battu'),
}
BUDGET_TRIANGLES = 2500                  # procédure, section 7 : tête
NOM = 'tete_gobelin'
ZONES_DES_CLES = ['tete', 'visage', 'nez']
"""Zones de peau de la base que la tête remplace : ses poids au plus près, ses clés par visée depuis le centre."""

CENTRE = (0.0, -0.0024, 0.0857)          # base : milieu de la boîte de la tête, sous les yeux
COLONNES = 44                            # 8,2° en moyenne
SERRAGE_DEVANT = 0.45                    # colonnes à 4,5° devant, 11,9° derrière
RANGS = [0.05, 0.11, 0.165, 0.205, 0.24, 0.275, 0.31, 0.345, 0.38, 0.415, 0.45, 0.485,
         0.515, 0.547, 0.579, 0.611, 0.643, 0.675, 0.75, 0.84, 0.93]
"""Part de l'arc de la couture au pôle par rang : serrés de la gorge aux arcades (devant, 5,4° par rang), plus encore
sur le front (4,9° par rang de +15° à +40° d'élévation), que rident deux plis."""
FONDU_DU_COU = 0.2
"""Part de l'arc sur laquelle le rayon passe de la couture du cou à la forme."""
AXE_DU_VISAGE = 0.045                    # z du milieu des arcades au menton, axe du retournement de `visage_inverse`

LEVRES = ((0.0, -0.134), (0.048, -0.106), (0.07, -0.048))
"""La ligne des lèvres vue de dessus, du milieu au coin gauche de la bouche (x, y) : bouche très large, fendue jusque
sous les oreilles (illustration)."""
Z_DE_LA_FENTE = 0.035


def sur_les_levres(x, saillie):
    """Le point (x, y) de la ligne des lèvres à l'abscisse `x`, sorti de `saillie` depuis le fond de la bouche."""
    (x0, y0), (x1, y1) = next(s for s in zip(LEVRES[:-1], LEVRES[1:]) if abs(x) <= s[1][0])
    y = y0 + (y1 - y0) * (abs(x) - x0) / (x1 - x0)
    recul = (x * x + (y + 0.04) ** 2) ** 0.5
    return x * (1 + saillie / recul), -0.04 + (y + 0.04) * (1 + saillie / recul)


FORME = [
    # Crâne étroit (illustration : ~0,9 fois la largeur humaine), allongé vers l'arrière de 3 cm au-delà de la nuque
    # humaine (HYPOTHÈSE : la nuque ne se voit pas), front bas et fuyant.
    {'forme': 'ellipsoide', 'centre': (0.0, 0.012, 0.108), 'rayons': (0.07, 0.106, 0.066), 'lissage': 0.0},
    # Nuque : le cou de la base monte sous le crâne sans marche (base : nuque à y 0,06 à 0,08).
    {'forme': 'ellipsoide', 'centre': (0.0, 0.02, 0.04), 'rayons': (0.064, 0.056, 0.07), 'lissage': 0.03},
    # Arcades froncées en V, plus basses au-dessus du nez (illustration), qui surplombent les yeux.
    {'forme': 'tube', 'points': [(-0.056, -0.06, 0.114), (-0.044, -0.096, 0.118), (-0.02, -0.116, 0.106),
                                 (0.0, -0.12, 0.098), (0.02, -0.116, 0.106), (0.044, -0.096, 0.118),
                                 (0.056, -0.06, 0.114)],
     'rayons': [0.007, 0.015, 0.017, 0.015, 0.017, 0.015, 0.007], 'lissage': 0.022, 'visage': True},
    # Face sous les arcades.
    {'forme': 'ellipsoide', 'centre': (0.0, -0.066, 0.066), 'rayons': (0.058, 0.052, 0.046), 'lissage': 0.016,
     'visage': True},
    # Pommettes hautes et saillantes.
    {'forme': 'ellipsoide', 'centre': (0.05, -0.078, 0.078), 'rayons': (0.02, 0.028, 0.015), 'lissage': 0.018,
     'visage': True, 'miroir': True},
    # Racine du nez, large entre les yeux, d'où part le nez crochu (`NEZ`), et ailes du nez.
    {'forme': 'tube', 'points': [(0.0, -0.1, 0.1), (0.0, -0.13, 0.086)], 'rayons': [0.017, 0.02],
     'lissage': 0.01, 'visage': True},
    {'forme': 'ellipsoide', 'centre': (0.016, -0.124, 0.07), 'rayons': (0.011, 0.012, 0.01), 'lissage': 0.006,
     'visage': True, 'miroir': True},
    # Bas du visage, large pour la bouche fendue jusque sous les oreilles (illustration) ; dessous remontant à la
    # couture de la gorge (base : z 1,589).
    {'forme': 'ellipsoide', 'centre': (0.0, -0.066, 0.026), 'rayons': (0.064, 0.064, 0.034), 'lissage': 0.012,
     'visage': True},
    # Menton pointu, en galoche, qui avance devant la bouche (illustration).
    {'forme': 'tube', 'points': [(0.0, -0.1, 0.004), (0.0, -0.14, -0.014)], 'rayons': [0.022, 0.015],
     'lissage': 0.014, 'visage': True},
    # Lèvres minces, de part et d'autre de la fente.
    {'forme': 'tube', 'points': [(-LEVRES[2][0], LEVRES[2][1], 0.054), (-LEVRES[1][0], LEVRES[1][1], 0.05),
                                 (0.0, LEVRES[0][1], 0.049), (LEVRES[1][0], LEVRES[1][1], 0.05),
                                 (LEVRES[2][0], LEVRES[2][1], 0.054)],
     'rayons': [0.006, 0.008, 0.008, 0.008, 0.006], 'lissage': 0.008, 'visage': True},
    {'forme': 'tube', 'points': [(-LEVRES[2][0], LEVRES[2][1], 0.03), (-LEVRES[1][0], LEVRES[1][1], 0.022),
                                 (0.0, LEVRES[0][1], 0.02), (LEVRES[1][0], LEVRES[1][1], 0.022),
                                 (LEVRES[2][0], LEVRES[2][1], 0.03)],
     'rayons': [0.006, 0.008, 0.008, 0.008, 0.006], 'lissage': 0.008, 'visage': True},
    # Bouche très large, fendue jusque sous les oreilles (illustration), fermée.
    {'forme': 'tube', 'points': [(-LEVRES[2][0], LEVRES[2][1], 0.042), (-LEVRES[1][0], LEVRES[1][1], 0.036),
                                 (0.0, LEVRES[0][1] - 0.004, Z_DE_LA_FENTE), (LEVRES[1][0], LEVRES[1][1], 0.036),
                                 (LEVRES[2][0], LEVRES[2][1], 0.042)],
     'rayons': [0.007] * 5, 'lissage': 0.004, 'creux': True, 'visage': True},
    # Rides du front, deux plis froncés en V au-dessus des arcades (illustration : front ridé).
    {'forme': 'tube', 'points': [(-0.046, -0.086, 0.136), (-0.022, -0.106, 0.124), (0.0, -0.11, 0.119),
                                 (0.022, -0.106, 0.124), (0.046, -0.086, 0.136)],
     'rayons': [0.007] * 5, 'lissage': 0.004, 'creux': True, 'visage': True},
    {'forme': 'tube', 'points': [(-0.046, -0.068, 0.153), (-0.022, -0.09, 0.143), (0.0, -0.096, 0.138),
                                 (0.022, -0.09, 0.143), (0.046, -0.068, 0.153)],
     'rayons': [0.007] * 5, 'lissage': 0.004, 'creux': True, 'visage': True},
    # Pli du museau, de l'aile du nez au coin de la bouche (illustration).
    {'forme': 'tube', 'points': [(0.024, -0.122, 0.078), (0.042, -0.108, 0.064), (0.058, -0.082, 0.052)],
     'rayons': [0.005] * 3, 'lissage': 0.007, 'creux': True, 'visage': True, 'miroir': True},
    # Joues creuses, sous les pommettes (illustration).
    {'forme': 'ellipsoide', 'centre': (0.066, -0.07, 0.06), 'rayons': (0.014, 0.026, 0.012), 'lissage': 0.012,
     'creux': True, 'visage': True, 'miroir': True},
    # Orbites creusées sous les arcades.
    {'forme': 'ellipsoide', 'centre': (0.033, -0.112, 0.088), 'rayons': (0.017, 0.024, 0.012), 'lissage': 0.01,
     'creux': True, 'visage': True, 'miroir': True},
]

NEZ = {                                  # long nez crochu et épais, ~1/3 de la longueur de la tête, en bec tombant devant la bouche (illustration)
    'base': (0.0, -0.104, 0.088),        # dans la racine du nez
    'inflexion': (0.0, -0.2, 0.1),
    'pointe': (0.0, -0.186, 0.034),
    'rayon': 0.024,                      # épais à la racine
    'effilement': 2.6,                   # en bec : épais jusque près de la pointe
    'segments': 6,
    'cotes': 6,
}
OEIL = {'centre': (0.033, -0.087, 0.089), 'rayon': 0.0095, 'cotes': 8, 'rangs': 4}   # au fond de l'orbite
OREILLE = {                              # très grande, en lame pointue, écartée vers le haut et l'arrière (illustration)
    'base': (0.058, 0.004, 0.1),         # 1 cm dans le crâne
    'direction': (1.0, 0.4, 0.75),
    'normale': (0.35, -0.9, 0.2),
    'longueur': 0.135,                   # illustration : la longueur de l'oreille vaut la hauteur du crâne au-dessus du nez
    'largeur': (0.022, 0.034, 0.3),      # demi-largeur au départ, au plus large, part de la longueur au plus large
    'epaisseur': (0.011, 0.002),         # demi-épaisseur à la racine, à la pointe
    'creux': 0.45,
    'cambrure': 0.06,
    'rangs': 6,
    'cotes': 8,
}
DENTS = [                                # longues, fines et serrées, deux rangées croisées devant les lèvres (illustration)
    *({'base': (*sur_les_levres(x, 0.006), Z_DE_LA_FENTE + 0.008), 'direction': (0.0, -0.12, -1.0),
       'longueur': longueur, 'rayon': 0.004, 'cotes': 3}
      for x, longueur in ((-0.062, 0.014), (-0.051, 0.018), (-0.039, 0.015), (-0.026, 0.02), (-0.013, 0.016),
                          (0.0, 0.019), (0.013, 0.016), (0.026, 0.02), (0.039, 0.015), (0.051, 0.018), (0.062, 0.014))),
    *({'base': (*sur_les_levres(x, 0.006), Z_DE_LA_FENTE - 0.008), 'direction': (0.0, -0.12, 1.0),
       'longueur': longueur, 'rayon': 0.004, 'cotes': 3}
      for x, longueur in ((-0.057, 0.014), (-0.045, 0.017), (-0.0325, 0.019), (-0.0195, 0.015), (-0.0065, 0.018),
                          (0.0065, 0.018), (0.0195, 0.015), (0.0325, 0.019), (0.045, 0.017), (0.057, 0.014))),
]
ANNEAUX = [                              # deux gros anneaux dans le bord bas de l'oreille gauche (illustration)
    {'cote': 1.0, 'part': part, 'grand_rayon': grand, 'petit_rayon': 0.003, 'prise': 0.006, 'segments': 8, 'cotes': 3}
    for part, grand in ((0.2, 0.017), (0.42, 0.012))
]
