"""Données de `humanoide--rigide--dague` (le Sorcier, #3743) : la dague (`src/data/apparences.json`), possession de la
classe Lettrés (LDB 05 l.562), et son fourreau ; Clément, 2026-11-09 : « Et il a aussi une dague » (#3743).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : à la hanche gauche, derrière la liasse de rouleaux, une
dague au fourreau, la poignée au-dessus de la ceinture, le fourreau de cuir sanglé ; la lame reste cachée. Échelle
relevée : le personnage, de la pointe du capuchon aux semelles, environ 960 px pour la hauteur de la base (1,82 m), soit
environ 530 px/m.

Repère de la prise `main` de la base (`element/lame.py`). Mètres.
"""
import runpy
from pathlib import Path

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'dague'},
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

FUSEE = {'longueur': 0.09, 'rayon': 0.011, 'segments': 8}
"""Illustration : environ 45 px de la garde au pommeau, en partie cachée par la liasse ; 9 cm, une pleine main."""

GARDE = {'longueur': 0.07, 'largeur': 0.016, 'epaisseur': 0.012}
"""HYPOTHÈSE : l'illustration cache la garde derrière la liasse ; 7 cm, plus courte que celle de l'épée (10 cm)."""

LAME = {'longueur': 0.25, 'largeur': 0.03, 'largeur_a_la_pointe': 0.018, 'pointe': 0.05, 'epaisseur': 0.006}
"""HYPOTHÈSE : l'illustration cache la lame dans le fourreau ; une lame de 25 cm, 3 cm au talon."""

POMMEAU = {'rayon': 0.015, 'hauteur': 0.025, 'col': 0.009, 'segments': 8}
"""Illustration : un pommeau d'environ 14 px ; 2,5 cm."""

FOURREAU = {'paroi': 0.005, 'saillie': 0.003, 'chape': 0.035, 'bouterolle': 0.035, 'bout': 0.01, 'segments': 8}
"""HYPOTHÈSE : les proportions du fourreau de l'épée (`rigide--epee`), chape et bouterolle ramenées à 3,5 cm."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
