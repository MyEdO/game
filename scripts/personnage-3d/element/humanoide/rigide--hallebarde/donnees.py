"""Données de `humanoide--rigide--hallebarde` (le Soldat, #4318) : la hallebarde (`src/data/apparences.json`, maniement
`hampe`), apparence de l'arme `hallebarde` de `src/data/trappings.json`, que tient la prise `main` du preset `soldat` et
que portent les profils du bestiaire armés d'une hallebarde. Elle reste l'arme générique : le fer à deux tranchants, la
pointe, la douille et le gland sont ceux d'une hallebarde de piquier impérial, que le gland prend la couleur `accent` du
porteur.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : une hallebarde dressée, plus haute que la porteuse, le talon au sol près du pied gauche. Au sommet,
une pointe d'estoc effilée sur une bague ; dessous, le fer à deux tranchants en croissant, une grande lame d'un côté
et une plus petite de l'autre (le contrat d'origine les dit « double fer ») ; leur collet commun est une plaque en croix
cernée d'or, où l'emblème de l'unité (une tête de taureau rouge) est peint ; sous le fer, une douille renflée, et un
gland rouge pendu à sa base, autour de la hampe ; la hampe de bois, guipée de bandes claires en spirale ; un talon de
métal. Échelle relevée : ~520 px/m (du bas des bottes au sommet du casque, ~915 px pour ~1,75 m), le fer vu presque de
face.

L'emblème du collet n'appartient pas à l'arme : un cartouche carré au milieu de chaque face du collet, surface `blason`
(#3111), le reçoit du porteur ; sans emblème, il reste un champ d'acier comme son pourtour.

Omis : la guipure en spirale de la hampe (motif).

Repère de la prise `main` de la base (comme `rigide--baton`) : origine sur la paume, +Y le long de la hampe vers le fer,
+X l'axe de la paume, +Z du poignet vers les jointures, sens du tranchant d'une arme tenue (procédure du skill,
section 5) : la grande lame vers +Z, la petite vers -Z. Le roulis du fer autour de la hampe suit ce tranchant, et non la
vue de l'illustration : dans `Hampe_Attaque`, le centre du fer frappe vers le +Z de la prise (base : de -23 à +37° de
lui aux images les plus rapides, jusqu'à 8,6 m/s) ; tourné de 90° pour se montrer à plat de face dans
`Hampe_Repos_Loop` (base : la normale du fer y est à 77° de l'axe de la vue de face), il frapperait du plat. Mètres.
Chaque cote dit d'où elle vient : `illustration`, `base` ou `HYPOTHÈSE` (à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'hallebarde'},
    # La main libre à 0,5 m au-dessus de la prise, roulis -90° autour du +Y : la seconde prise du maniement `hampe`
    # (`SECONDES` de `scripts/personnage-3d/base/deux_mains.py`), où les clips `Hampe_*` posent la main gauche.
    'liaison': {'mode': 'rigide', 'secondePrise': {'position': [0, 0.5, 0], 'rotation': [0, -1.570796, 0]}},
}
PRISE = 'main'

MATERIAUX = {
    'bois': ('bois', 'bois-chene'),
    'metal': ('metal', 'acier-battu'),
    'dorure': ('metal2', 'laiton-dore'),
    'gland': ('accent', 'laine'),
    'cartouche': ('metal', 'acier-battu'),
}
BLASONS = ('cartouche',)
"""Illustration : hampe de bois brun, fer d'acier (`metal`), collet cerné d'or (`metal2`, le laiton au preset
`soldat`), gland de fils rouges. Le gland est de laine, teint par l'emplacement `accent` (rouge au preset `soldat`). Le cartouche, d'acier comme le champ
du collet, reçoit l'emblème du porteur (`embleme` du preset), ses UV sur le carré [0,1]²."""

BUDGET_TRIANGLES = 1200          # procédure du skill, section 7 : rigide tenu

LONGUEUR = 2.20
"""Du talon à la pointe. Illustration : ~1 145 px du talon à la pointe, en diagonale, soit ~2,2 m sans compter le
raccourci de la hampe penchée vers l'arrière ; hallebarde « plus haute que la porteuse » (signe 1 du contrat)."""

PRISE_DEPUIS_TALON = 0.60
"""HYPOTHÈSE : la main droite près du talon, comme le bâton de combat (`rigide--baton`, mesuré sur la base r24 : le
talon reste au-dessus du sol en `Hampe_Marche_Loop` et `Death01`). L'illustration pose le talon au sol, la main à mi-
hauteur : les clips `Hampe_*` de la base tiennent la hampe plus haut."""

HAMPE = {'rayon': 0.015, 'segments': 10}
"""Illustration : ~12 px de large à la main (2,3 cm) ; 3 cm, le fût du bâton, au meilleur passage du poing de la base
(`AXE_DANS_LA_PRISE`)."""

TALON = {'hauteur': 0.06, 'rayon': 0.017, 'pointe': 0.02}
"""Illustration : un talon de métal effilé d'environ 30 px (6 cm) ; `pointe` : longueur de sa pointe sous la virole."""

# --- Le fer : abscisses sur le +Y depuis la prise ---
CENTRE_DU_FER = 1.32
"""Le centre du collet en croix. Illustration : ~146 px sous la pointe (0,28 m)."""
POINTE = {'base': 1.40, 'rayon': 0.015, 'segments': 8}
"""La pointe d'estoc, de sa base à la pointe (`LONGUEUR` - `PRISE_DEPUIS_TALON`). Illustration : ~100 px (0,20 m), ~16 px
de large à la base (3 cm)."""
BAGUE = {'bas': 1.375, 'haut': 1.40, 'rayon': 0.021}
"""La bague sous la pointe. Illustration : ~14 px de haut, ~22 px de large."""
TIGE = {'rayon': 0.014}
"""Le cou entre le collet et la bague. Illustration : ~14 px de large."""
DOUILLE = [(-0.135, 0.0), (-0.135, 0.024), (-0.12, 0.028), (-0.09, 0.026), (-0.055, 0.021), (-0.045, 0.021),
           (-0.045, 0.0)]
"""(h, r) depuis `CENTRE_DU_FER` : la douille renflée sous le collet, profil de révolution, qui s'arrête dans le bas du
collet ; au-dessus du collet, la tige (`TIGE`). Illustration : ~70 px du collet au bas de la douille (0,13 m), ~30 px de
large au plus renflé (5,6 cm) ; rien ne passe devant l'emblème au milieu du collet."""
SEGMENTS_DOUILLE = 10

COLLET = {'h': (-0.05, 0.04), 'r': (-0.075, 0.085), 'epaisseur': 0.016, 'bordure': 0.009, 'relief': 0.002,
          'cartouche': 0.056}
"""La plaque en croix cernée d'or qui joint les deux lames (h le long de la hampe, r vers +Z) : une plaque de laiton, et
sur chaque face un champ d'acier en retrait de la `bordure`, en `relief` de 2 mm. Illustration : ~95 px de large
(0,18 m), ~45 px de haut au milieu (8,5 cm), le champ sombre cerné d'un liseré doré de ~5 px (1 cm). `cartouche` : le
côté du carré qui porte l'emblème, au centre du champ. Illustration : la tête de taureau couvre ~30 px (5,8 cm) au
milieu de la croix."""

LAMES = {
    'grande': {'signe': 1.0, 'pointe_haute': (0.18, 0.165), 'ventre': (0.235, -0.02), 'pointe_basse': (0.19, -0.205),
               'collet_haut': (0.03, 0.035), 'creux_haut': (0.165, 0.015), 'collet_bas': (0.03, -0.07),
               'creux_bas': (0.165, -0.05), 'colonnes': 14},
    'petite': {'signe': -1.0, 'pointe_haute': (0.115, 0.10), 'ventre': (0.15, 0.025), 'pointe_basse': (0.12, -0.055),
               'collet_haut': (0.02, 0.03), 'creux_haut': (0.105, 0.025), 'collet_bas': (0.02, -0.025),
               'creux_bas': (0.105, -0.02), 'colonnes': 10},
}
"""(r, h) dans le plan de la hampe et du tranchant, r depuis l'axe vers +Z (`signe` 1) ou -Z, h depuis `CENTRE_DU_FER`. Le
fil est la courbe des deux pointes par le `ventre`, bombée ; le dos part de chaque pointe en creux profond (point de
contrôle `creux_*`, près du fil) jusqu'au collet : des cornes en croissant. Illustration : la grande lame s'étend à
~110 px de la hampe (0,21 m), ses pointes à +86 et -107 px (+0,165, -0,205 m) ; la petite à ~75 px (0,145 m), ses pointes à +51 et -27 px."""
EPAISSEUR_LAME = {'dos': 0.008, 'biseau': 0.005, 'fil': 0.001, 'largeur_biseau': 0.022}
"""m. Illustration : le biseau du fil se lit comme une bande claire de ~10 px (2 cm). HYPOTHÈSE : 8 mm au collet, 1 mm
au fil."""
RETRAIT_DES_POINTES = 0.004
"""m : le dos s'arrête à 4 mm de chaque pointe, que ferme une petite face (sans triangle dégénéré)."""

GLAND = {'haut': -0.135, 'bas': -0.33, 'rayons': [(0.0, 0.021), (0.06, 0.017), (0.14, 0.024), (0.45, 0.031),
                                                 (0.8, 0.036), (1.0, 0.037)],
         'segments': 16, 'cannelure': 0.82, 'frange': 0.03}
"""Le gland pendu sous la douille, autour de la hampe (h depuis `CENTRE_DU_FER`). Illustration : ~85 à 100 px de long
(0,16 à 0,19 m) sous la douille, ~40 px de large en bas (7,5 cm), un col serré sous la douille, les fils évasés vers
le bas en frange inégale. `rayons` : (part de la hauteur depuis le
haut, rayon) ; `cannelure` : rayon des fils creux en part du rayon, une colonne sur deux ; `frange` : les fils du bas
alternent de cette hauteur. HYPOTHÈSE de maillage."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
