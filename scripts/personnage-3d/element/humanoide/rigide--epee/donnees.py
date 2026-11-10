"""Données de `humanoide--rigide--epee` (le Sorcier, #3743) : l'épée (`src/data/apparences.json`), forme de l'arme simple
(`arme-simple`), et son fourreau ; Clément, 2026-11-09 : « Il a aussi une épée longue non ? » (#3743).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : à la hanche droite, une épée au fourreau, la poignée
au-dessus de la ceinture : pommeau de laiton en losange, fusée bandée, petite garde droite, fourreau clair à chape de
laiton ; la lame reste cachée. Échelle relevée : le personnage, de la pointe du capuchon aux semelles, environ 960 px pour
la hauteur de la base (1,82 m), soit environ 530 px/m.

Repère de la prise `main` de la base (`element/lame.py`). Mètres.
"""
import runpy
from pathlib import Path

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'epee'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.6, 0.4)),
}

BUDGET_TRIANGLES = 1200          # procédure du skill, section 7 : rigide tenu

AXE_DANS_LA_PRISE = runpy.run_path(str(Path(__file__).parent.parent / 'rigide--baton' / 'donnees.py'))['AXE_DANS_LA_PRISE']
"""Le passage libre du poing fermé de la base, mesuré pour le bâton : la fusée y passe comme le fût."""

FUSEE = {'longueur': 0.11, 'rayon': 0.012, 'segments': 8}
"""Illustration : environ 60 px de la garde au pommeau, 12 px de large ; 11 cm, 24 mm de diamètre."""

GARDE = {'longueur': 0.10, 'largeur': 0.02, 'epaisseur': 0.015}
"""Illustration : environ 55 px d'un quillon à l'autre ; 10 cm, sur le tranchant (Z)."""

LAME = {'longueur': 0.75, 'largeur': 0.035, 'largeur_a_la_pointe': 0.022, 'pointe': 0.06, 'epaisseur': 0.006}
"""HYPOTHÈSE : l'illustration cache la lame dans le fourreau (environ 22 px de large, 4 cm) ; une lame de 75 cm, 35 mm au
talon, pour une épée tenue à une main."""

POMMEAU = {'rayon': 0.018, 'hauteur': 0.035, 'col': 0.01, 'segments': 8}
"""Illustration : un pommeau d'environ 18 px de haut, 20 px de large ; 3,5 cm sur 3,6 cm."""

FOURREAU = {'paroi': 0.005, 'saillie': 0.003, 'chape': 0.055, 'bouterolle': 0.05, 'bout': 0.01, 'segments': 8}
"""Illustration : la chape de laiton, environ 30 px sous la garde, 5,5 cm ; HYPOTHÈSE : paroi de cuir de 5 mm, garnitures
de 3 mm plus saillantes, bouterolle de 5 cm, 1 cm de fourreau sous la pointe."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
