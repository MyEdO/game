"""Données de `humanoide--rigide--livre` (le Prêtre, #3867) : le livre (`src/data/apparences.json`), apparence de tous les
objets livre et grimoires ; ici `livre-religion` (LDB 304), rangé à la hanche gauche (`ceinture_g`, `rangementsObjets` du
preset `pretre`).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` |
Livre de Base | 93 | certaine » (hors dépôt). Ce qu'elle montre : à la hanche gauche, à hauteur de la ceinture, un livre
relié couché sur le côté, plus large que haut, couverture bleu-gris à coins et ferrures dorés, la tranche claire des pages
visible à son bout avant, une sangle de cuir qui monte de son dos vers la ceinture. Les bandes rouges et blanches et le
médaillon doré du plat sont un décor peint : omis (contrat, SIMPLIFIER). Échelle relevée : de la tête aux plantes,
environ 800 px pour la hauteur de la base (1,82 m), soit environ 440 px/m.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangée,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine est sur l'emplacement ; la face arrière se
pose sur ce qui est porté dessous (`MontageDeComposition._appuyer`). À `ceinture_g`, le +X de ce repère est l'avant du
personnage. Le livre pend sous l'origine (y > 0), son plat arrière sur z = 0, le dos vers l'arrière (-X), la tranche
avant vers +X. Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'livre'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'couverture': ('cuir', ((0.45, 0.45, 0.45), 0.0, 0.8)),
    'plat': ('cuir', ((0.45, 0.45, 0.45), 0.0, 0.8)),
    'pages': ('corne', ((0.75, 0.75, 0.75), 0.0, 0.9)),
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.6, 0.45)),
    'cuir': ('cuir', ((0.5, 0.5, 0.5), 0.0, 0.9)),
}
"""La couverture prend `cuir`, une reliure de cuir : `vet2` habille aussi les bandages et le rouleau de couchage, sable dans
l'illustration, et le bleu-gris de la couverture n'a aucun emplacement libre dans le preset `pretre`. `SLOTS` n'a pas
d'emplacement de parchemin : la tranche des pages prend `corne`, l'ivoire de l'os et de la corne, le plus proche de la
tranche claire de l'illustration ; un preset qui ne le colore pas lui laisse son gris clair de construction. `plat` : le
champ carré du plat avant, seule face du matériau, qui reçoit l'emblème du porteur (`BLASONS`)."""

BLASONS = ('plat',)
"""Arbitrage de Laurent, 2026-11-10 (#3867) : « Oui y a l amulette qui a une forme et son livre de prière avec le
symbole du dieu qui lui peut être un emblème »."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

LARGEUR = 0.20
HAUTEUR = 0.14
EPAISSEUR = 0.05
"""Illustration : environ 105 × 80 px vu de trois quarts, soit 24 × 18 cm ; brief et contrat : 20 × 14 × 5 cm, retenus
(un livre de prières de poche ; HYPOTHÈSE à trancher en revue)."""

HAUT = 0.01
"""HYPOTHÈSE : le haut du livre 1 cm sous l'emplacement ; l'illustration le montre à hauteur de la ceinture, pendu à sa
sangle."""

PLAT = {'epaisseur': 0.004, 'debord': 0.004}
"""HYPOTHÈSE : plats de 4 mm qui débordent des pages de 4 mm sur le haut, le bas et la tranche avant."""

COINS = {'cote': 0.022, 'epaisseur': 0.0025}
"""Illustration : des coins de métal aux quatre coins du plat avant ; 2,2 cm de côté, en équerre."""

FERMOIR = {'largeur': 0.024, 'epaisseur': 0.003, 'sur_le_plat': 0.03, 'boucle': (0.016, 0.02, 0.004)}
"""Illustration : une ferrure sur la tranche avant ; HYPOTHÈSE : un fermoir, patte de cuir qui passe la tranche avant au
milieu de la hauteur et revient de `sur_le_plat` sur chaque plat, une boucle de métal (largeur, hauteur, épaisseur) sur
le plat avant."""

CHAMP = {'cote': 0.11, 'x': 0.001, 'relief': 0.0015}
"""Le champ carré du plat avant qui reçoit l'emblème : `cote` 11 cm, centré en `x` entre la sangle et le fermoir, en
relief de `relief` sur le plat. L'illustration y montre un médaillon doré : un emblème, posé au montage (#3111)."""

SANGLE = {'x': -0.068, 'largeur': 0.018, 'epaisseur': 0.003, 'au_dessus': 0.02}
"""Illustration : une sangle de cuir ceint le livre sur sa hauteur et monte de son dos jusqu'à `au_dessus` de
l'emplacement (la ceinture) ; `x` : son milieu, vers le dos du livre, hors du champ et des coins ; HYPOTHÈSE : 1,8 cm
de large."""


ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
