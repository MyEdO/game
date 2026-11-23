"""Données de `humanoide--armure--brassards-cloutes` (le Gladiateur, #4394, contrat du 2026-11-22), lues par `modele.py` :
la variante `brassards-cloutes` de la pièce `brassards` de la garde-robe, que porte le preset `gladiateur` (le Soldat
porte la variante `brassards-d-acier`).

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02 (#4394), 773 × 1257 px, hors dépôt.

Ce qu'elle montre (bras droit, poing levé, x ≈ 95-230, y ≈ 270-520 px ; bras gauche sur le manche, x ≈ 520-640,
y ≈ 440-560 px) : sur chaque avant-bras nu, un brassard de cuir fauve du poignet au coude ; au coude, une collerette de
fourrure hirsute, plus large que le cuir, dont les mèches débordent sur lui ; à un quart de la longueur depuis le
poignet, une sangle en relief fermée d'une boucle ronde de métal ; le long du bord extérieur, côté cubitus, une rangée
de pointes courtes de métal sombre, du poignet à la fourrure ; des têtes de clous rondes sur le cuir (bras gauche). Les
mains sont nues. Omis : les stries du cuir (motif peint) et les bandes qui montent sur le dos de la main (détail).
Échelle : ~580 px/m (`vetement--haut-de-chausses-ample`) ; le brassard fait ~150 px, ~0,26 m, l'avant-bras de la base
0,244 m ; la fourrure ~45 px, ~8 cm ; une pointe ~12 px, ~2 cm ; la sangle ~14 px, ~2,5 cm ; la boucle ~28 px, ~5 cm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x), bras à l'horizontale, paumes vers le bas. Les abscisses `s` se comptent le long de l'avant-bras, de la tête de
`lowerarm_*` (le coude, s = 0) vers celle de `hand_*` (le poignet, base : s = 0,244). Les azimuts se comptent autour de
l'avant-bras depuis le dessus (0°) vers l'avant (90°), le dessous (180°) et l'arrière (270°), où pointe le coude et où
court le cubitus. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à
trancher en revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'brassards-cloutes'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': ['avant_bras_g', 'avant_bras_d'],
}
"""Le cuir et la fourrure ferment l'avant-bras de tout côté, du coude au poignet : ils cachent la zone, comme les
brassards d'acier (`armure--brassards-d-acier`)."""

MATERIAUX = {
    'cuir': ('cuir', 'cuir-tanne'),
    'fourrure': ('fourrure', 'fourrure'),
    'clous': ('metal', 'bronze-patine'),
}
"""Illustration : cuir fauve (`cuir`), fourrure fauve (`fourrure`), pointes, clous et boucle d'un bronze sombre
(`metal`, bronze terni au preset `gladiateur`)."""

BUDGET_TRIANGLES = 2000            # procédure du skill, section 7 : armure par pièce

ZONES = {c: [f'bras_haut_{c}', f'avant_bras_{c}', f'main_{c}'] for c in 'gd'}
"""Par bras, les zones que le brassard traverse : ses poids et ses clés en viennent."""

COLONNES = {'cuir': 14, 'fourrure': 20}
"""HYPOTHÈSE de maillage : le tube de cuir, lisse, tous les 26° ; la fourrure, dont une colonne sur deux porte une
mèche, tous les 18° — à 22,5°, son bord se lisait comme les dents d'une couronne de carton (rendu de trois-quarts) —,
l'ensemble sous le budget de l'armure."""
AZIMUT_ARRIERE = 270.0
"""Degrés : le côté où la fourrure monte le plus haut, sur la pointe du coude (base : vers l'arrière au repos)."""
PAS_DES_COUPES = 0.01
"""m : le rayon d'un sommet est celui de la plus large des coupes du bras à son abscisse et à ce pas de part et
d'autre."""

CUIR = {'rangs': [0.035, 0.085, 0.135, 0.180, 0.215, 0.248], 'jeu': [(0.035, 0.007), (0.18, 0.007), (0.248, 0.008)],
        'epaisseur': 0.003}
"""Le canon de cuir : abscisse de ses anneaux, de dessous la fourrure au poignet, écart à l'enveloppe du bras et
épaisseur de la double nappe. Illustration : le cuir serre l'avant-bras jusqu'au poignet. Base : la zone `main` commence
à 0,212-0,244 ; le bas à 0,248, sur le poignet, comme les brassards d'acier, et son jeu de 8 mm sur la main, qui reste
dessinée. HYPOTHÈSE de valeur du jeu sur l'avant-bras, caché : un cuir souple, plus près du bras que l'acier (12 mm)."""

FOURRURE = {
    'rangs': [(-0.090, -0.035), (-0.060, -0.020), (-0.020, 0.0), (0.020, 0.022), (0.055, 0.055)],
    'jeu': [(-0.090, 0.030), (0.0, 0.024), (0.055, 0.013)],
    'gonflement': 0.020,
    'touffes': {'graine': 'brassards-cloutes', 'ampleur': 0.009},
    'meches': {'graine': 'collerette', 'profondeur': 0.013, 'creux': 0.35},
    'epaisseur': 0.004,
}
"""La collerette de fourrure : (s à l'arrière, s au pli du coude) de chaque anneau, entre les deux selon l'azimut
((1 + cos(azimut - `AZIMUT_ARRIERE`)) / 2) ; `jeu` à l'enveloppe du bras, selon l'abscisse ; `gonflement` au milieu de sa hauteur (lobe
sinus, nul aux bords) ; chaque sommet y ajoute sa touffe, tirée au hasard jusqu'à `ampleur` ; ses deux bords en mèches
(`tissu.lambeaux`), qui débordent vers le bras et sur le cuir ; à 28 mm de `profondeur`, le bord se lisait en dents de
couronne plutôt qu'en poil (rendu de trois-quarts). Base : la zone `avant_bras_*` que le brassard cache monte
jusqu'à s = -0,071 derrière le coude, -0,047 dessous, -0,039 dessus et -0,015 au pli : le haut de la fourrure la
dépasse tout autour. Illustration : une collerette de ~8 cm au coude, bombée, hirsute ; elle déborde le cuir de ~1,5 cm
de chaque côté du bras. HYPOTHÈSE : elle couvre la pointe du coude, que l'illustration laisse deviner nue sous elle, pour
cacher la couture de la zone. `jeu`, (s, m) : au-dessus du cuir qu'elle recouvre (7 mm de jeu, 3 mm d'épaisseur, 3 mm
d'air) ; au coude et sur le bras, resté dessiné, 24 à 30 mm : à 13 mm, la peau du bras passait devant la fourrure coude
plié (`couche-traversee`, 6 à 13 mm, 19 clips dont Hampe_Repos_Loop et TreeChopping_Loop), et à 22-24 mm, un sommet du
bras y passait encore sous `carrure_plus` (10 à 12 mm, Hit_Knockback, Sword_Attack), les poids lissés. L'illustration
dessine la collerette épaisse et bombée : elle se tient à 3 cm du bras au coude."""

SANGLE = {'s': (0.180, 0.215), 'relief': 0.005}
"""La sangle du poignet : une bande en relief sur le cuir, entre deux de ses anneaux. Illustration : ~2,5 cm de large, à
un quart du brassard depuis le poignet ; HYPOTHÈSE de relief : lisible en lumière rasante, le cuir de la sangle étant
de la couleur de celui du canon (un seul emplacement `cuir`)."""
BOUCLE = {'azimut': 45.0, 'rayon': 0.020, 'jonc': 0.005, 'cotes': 10, 'saillie': 0.004}
"""La boucle ronde de la sangle : un anneau de métal à plat sur elle, de rayon `rayon` à l'axe de son jonc, de
demi-épaisseur `jonc`, son centre à `saillie` au-dessus de la sangle. Illustration : ~28 px (~5 cm) de diamètre, sur le
dessus de l'avant-bras, vers l'avant (HYPOTHÈSE d'azimut : le bras de l'illustration est plié, poing levé)."""

POINTES = {'azimut': 300.0, 's': [0.075, 0.105, 0.135, 0.165, 0.228], 'rayon': 0.011, 'hauteur': 0.036, 'cotes': 5,
           'ancrage': 0.002}
"""La rangée de pointes : des cônes le long du cubitus, de la fourrure au poignet, la sangle entre les deux dernières,
plantés de `ancrage` dans le cuir. Illustration : six à sept pointes de ~12 px (~2 cm) sur le bord extérieur ;
HYPOTHÈSE de taille : 3,6 cm, car à 2,4 cm elles se lisaient comme des clous (rendu de dos) ; HYPOTHÈSE d'azimut : à
l'arrière, vers le dessus, pour qu'elles se lisent du dehors bras pendants."""
CLOUS = {'azimuts': [350.0, 30.0], 's': [0.095, 0.145], 'rayon': 0.006, 'hauteur': 0.004, 'cotes': 5,
         'ancrage': 0.001}
"""Les têtes de clous : des calottes basses en deux rangées sur le dessus du cuir. Illustration (bras gauche) : des
points ronds de ~6 px (~1 cm) sur le cuir ; HYPOTHÈSE de nombre et de place, quatre par bras pour tenir le budget de
l'armure avec vingt colonnes."""

LISSAGE_POIDS = 5
"""Passes de lissage des poids : à 2, comme les brassards d'acier, les arêtes de la fourrure du coude s'étiraient sous
`carrure_plus` (×3,5 à ×4,4, seuil 3,51), comme la peau du bras sous elle (×3,9 sur la base seule, témoin de la tenue
publiée)."""
ANGLE_VIF = 40                     # degrés : au-delà, une arête de la sangle, d'une pointe ou de la boucle reste vive
