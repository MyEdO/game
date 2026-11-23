"""Données de `humanoide--rigide--grande_hache` (le Gladiateur, #4394) : la grande hache (`src/data/apparences.json`,
maniement `lourde2m`), apparence de l'arme `grande-hache` de `src/data/trappings.json`, que tient la prise `main` du
preset `gladiateur` et que portent les profils du bestiaire armés d'une grande hache.

Illustration directrice : celle du Gladiateur fournie le 2026-11-02 (note de `source` du preset `gladiateur`,
`src/data/presets-de-personnage.json`), hors dépôt, et son contrat d'éléments du 2026-11-22.

Ce qu'elle montre : une hache dressée, le talon vers le sol, tenue d'une main à mi-manche. Un fer unique en grand
croissant, sa corne haute recourbée par-dessus la douille, sa corne basse effilée vers le manche, tenu à la douille par
un collet ; une douille cylindrique ; à son dos un bloc hérissé de trois pointes ; un petit crâne posé sur son sommet ;
un manche de bois guipé de lanières sombres en spirale, par groupes, d'où s'échappent des bouts libres ; au talon, une
virole et une pointe en fer de lance à deux crochets recourbés. Échelle relevée : ~600 px/m, la hache entière sur
~930 px pour les ~1,55 m du contrat ; le fer, ~320 px, y fait ~0,53 m.

Écarts à l'illustration, tracés : le manche y est arqué, il est droit ici (un manche de bois tenu des deux mains sur un
axe, `AXE_DANS_LA_PRISE`) ; le petit crâne y porte un anneau, omis ; le métal y est taché de sang et de rouille, la
matière `fer-rouille` du catalogue le rend (aucune couleur cuite) ; la main y tient le manche à ~0,66 m sous le sommet du fer, les
clips `Lourde_*` de la base le tiennent plus bas (`PRISE_DEPUIS_TALON`).

Repère de la prise `main` de la base (comme `rigide--hallebarde`) : origine sur la paume, +Y le long du manche vers le
fer, +X l'axe de la paume, +Z du poignet vers les jointures, sens du tranchant d'une arme tenue (procédure du skill,
section 5) : le croissant vers +Z, le bloc à pointes vers -Z. Fer identique des deux côtés (hypothèse du dos du
contrat). Mètres. Chaque cote dit d'où elle vient : `illustration`, `contrat`, `base` ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'grande_hache'},
    # La main libre à 0,35 m sous la prise, vers le talon, sans roulis : la seconde prise du maniement `lourde2m`
    # (`SECONDES` de `scripts/personnage-3d/base/deux_mains.py`), où les clips `Lourde_*` posent la main gauche.
    'liaison': {'mode': 'rigide', 'secondePrise': {'position': [0, -0.35, 0], 'rotation': [0, 0, 0]}},
}
PRISE = 'main'

MATERIAUX = {
    'metal': ('metal', 'fer-rouille'),
    'bois': ('bois', 'bois-chene'),
    'cuir': ('cuir', 'cuir-tanne'),
    'os': ('corne', 'os'),
}
"""Illustration : fer, douille, bloc, virole et pointe d'un même métal terni, taché de sang et de rouille : le fer rouillé
du catalogue (`metal`, le bronze terni au preset `gladiateur`) ; manche de bois brun ; lanières de cuir sombre ; petit crâne d'os clair, sur `corne` comme le crâne du
collier (`rigide--collier_a_cranes`)."""

BUDGET_TRIANGLES = 1200          # procédure du skill, section 7 : rigide tenu

LONGUEUR = 1.55
"""De la pointe du talon au sommet du fer. Contrat : « ≈ 1,55 m au total » ; illustration : ~930 px à ~600 px/m."""

PRISE_DEPUIS_TALON = 0.55
"""HYPOTHÈSE : la main droite à 0,55 m de la pointe du talon. La seconde prise est à 0,35 m sous elle (`SECONDES`), un
poing y couvre ±5 cm : la virole et la pointe du talon (`TALON`) tiennent dans les 15 cm qui restent dessous. Le sommet
du fer est alors à 1,00 m au-dessus de la main. L'illustration tient le manche plus haut, d'une seule main."""

MANCHE = {'rayon': 0.015, 'segments': 8}
"""Illustration : ~22 px de large (3,7 cm) ; 3 cm, le fût du bâton et de la hallebarde, au meilleur passage du poing de
la base (`AXE_DANS_LA_PRISE`)."""

# --- Le fer : cotes h le long du +Y depuis `CENTRE_DU_FER`, r depuis l'axe du manche vers +Z ---
CENTRE_DU_FER = 0.728
"""Le milieu de la douille, sur le +Y depuis la prise : le sommet du fer (`COLONNES`, h = 0,272) y tombe à
`LONGUEUR` - `PRISE_DEPUIS_TALON`."""

DOUILLE = {'profil': [(-0.10, 0.0), (-0.10, 0.030), (-0.092, 0.035), (0.092, 0.035), (0.10, 0.030), (0.10, 0.0)],
           'segments': 8}
"""(h, r), profil de révolution. Illustration : un cylindre de ~120 px de haut (0,20 m) et ~42 px de large (7 cm), à
lèvres rabattues."""

COLONNES = [
    ((-0.052, 0.266), (-0.057, 0.272)),
    ((-0.020, 0.215), (0.005, 0.265)),
    ((0.012, 0.160), (0.070, 0.240)),
    ((0.030, 0.115), (0.130, 0.205)),
    ((0.030, 0.075), (0.180, 0.165)),
    ((0.030, 0.035), (0.215, 0.110)),
    ((0.030, -0.005), (0.235, 0.050)),
    ((0.030, -0.040), (0.240, -0.015)),
    ((0.100, -0.045), (0.236, -0.070)),
    ((0.130, -0.075), (0.225, -0.115)),
    ((0.150, -0.115), (0.208, -0.155)),
    ((0.158, -0.160), (0.190, -0.190)),
    ((0.153, -0.205), (0.168, -0.225)),
    ((0.140, -0.240), (0.148, -0.248)),
    ((0.130, -0.258), (0.132, -0.262)),
]
"""Le croissant, de sa corne haute à sa corne basse : par colonne, le point du dos puis celui du fil, (r, h).
Illustration (à ~600 px/m, depuis l'axe de la douille) : la corne haute à -34 px de l'axe et +161 px du milieu de la
douille, recourbée par-dessus elle ; le fil bombé jusqu'à +144 px de l'axe (0,24 m) ; la corne basse à +79 px de l'axe
et -154 px ; le dos longe la douille sur son collet (de +58 à -20 px), puis se creuse en croissant jusqu'à la corne
basse, large de ~25 px (4 cm). Contrat : « ≈ 0,55 m de haut » ; ici 0,534 m."""

EPAISSEUR_FER = {'dos': 0.010, 'biseau': 0.006, 'fil': 0.001, 'largeur_biseau': 0.030, 'pleine_largeur': 0.03}
"""m. Illustration : le biseau du fil se lit comme une bande claire de ~18 px (3 cm). HYPOTHÈSE : 10 mm au dos, 1 mm
au fil ; une colonne plus étroite que `pleine_largeur` (les cornes) s'amincit d'autant."""

BLOC = {'h': (-0.07, 0.07), 'r': (-0.075, -0.026), 'demi_largeur': 0.028}
"""Le bloc au dos de la douille (r négatif : vers -Z). Illustration : ~85 px de haut (0,14 m), ~27 px de saillie
(4,5 cm) ; `demi_largeur` : HYPOTHÈSE, un peu moins que la douille."""

POINTES = {'h': (-0.05, 0.0, 0.05), 'longueur': 0.05, 'rayon': 0.011, 'segments': 5}
"""Les trois pointes du bloc, vers -Z. Illustration : trois pointes de ~30 px (5 cm), ~12 px à la base, à ~30 px l'une
de l'autre."""

CRANE = {'hauteur': 0.045, 'largeur': 0.034, 'profondeur': 0.040, 'segments': 6,
         'profil': [(0.0, 0.0), (0.12, 0.50), (0.38, 0.62), (0.62, 1.0), (0.86, 0.80), (1.0, 0.0)]}
"""Le petit crâne posé sur le sommet de la douille. Illustration : ~27 px de haut (4,5 cm), ~20 px de large ;
`profondeur` : HYPOTHÈSE. `profil` : (part de la hauteur depuis la mâchoire, part de la demi-largeur), révolution
elliptique : mâchoire étroite, voûte large."""

# --- Le talon : cotes sur le +Y depuis la prise ---
TALON = {'virole': (-0.44, -0.40), 'rayon': 0.019, 'pointe': -0.55, 'epaule': -0.47, 'demi_largeur': 0.020,
         'collet': 0.008, 'epaisseur': 0.006,
         'crochet': [(-0.452, 0.010), (-0.468, 0.030), (-0.463, 0.046), (-0.447, 0.050), (-0.436, 0.042)],
         'rayon_crochet': 0.0035, 'cotes_crochet': 4, 'pas_crochet': 2}
"""La virole, la pointe en fer de lance (une plaque dans le plan du tranchant, de son `collet` sous la virole à son
`epaule` puis à sa `pointe`) et un crochet (y, r), répété de l'autre côté : il part du collet, s'écarte et se recourbe
vers le fer, sa ligne adoucie en `pas_crochet` points par tronçon. Illustration : virole de ~30 px (5 cm), pointe et virole ensemble ~130 px (0,22 m), crochets à ±28 px de
l'axe (4,6 cm). Ici 0,15 m en tout : la seconde prise (`PRISE_DEPUIS_TALON`) borne le talon."""

GUIPURES = {'groupes': [(0.40, 0.61), (0.09, 0.25), (-0.25, -0.09)], 'pas': 0.055, 'largeur': 0.020,
            'rayon': 0.019, 'fond': 0.010, 'segments_par_tour': 6}
"""Les lanières en spirale, par groupe (du bas au haut sur le +Y depuis la prise). Illustration : trois groupes de
spires sombres, sous la douille, au milieu et vers le bas du manche, ~18 px de pas (3 cm) ; ici un pas de 5,5 cm et une
lanière de 2 cm, lisibles à la taille du jeu. Les groupes laissent nus la prise (±5 cm autour de l'origine) et la
seconde prise (de -0,40 à -0,30) : une lanière sous le poing fermé de la base y ferait traverser les doigts.
`rayon` : celui des arêtes de la lanière, dont le milieu des pans (× cos 30°) reste au-dessus du bois ; `fond` : son
arête noyée dans le manche."""

BOUTS_LIBRES = {
    'bouts': [
        {'groupe': 0, 'vrille': 20,
         'chemin': [(1.10, 0.004, 0.034), (1.42, -0.010, 0.056), (1.48, -0.042, 0.068), (1.48, -0.078, 0.060),
                    (1.48, -0.108, 0.058), (1.48, -0.128, 0.070), (1.48, -0.126, 0.086)]},
        {'groupe': 1, 'vrille': -20,
         'chemin': [(1.10, 0.011, 0.034), (1.42, 0.008, 0.060), (1.48, -0.012, 0.076), (1.48, -0.040, 0.080),
                    (1.48, -0.065, 0.090), (1.48, -0.078, 0.104), (1.48, -0.072, 0.116)]},
    ],
    'epaisseur': 0.003, 'amorce': 0.55, 'pas': 2}
"""Les deux bouts de lanière libres du contrat : la fin d'une lanière de la guipure qui s'est défaite, de la même
section plate (`GUIPURES['largeur']`, `epaisseur` : HYPOTHÈSE, un cuir de 3 mm). Le bout part de l'extrémité haute de
son `groupe` (rang dans `GUIPURES['groupes']`), prolonge la spire sur `amorce` radians, puis suit son `chemin` de
points (angle autour du manche depuis la fin de la spire en radians, y depuis la fin de la spire, distance à l'axe du
manche) ; `vrille` : degrés dont la lanière tourne sur elle-même de son départ à sa pointe ; `pas` : sections par
tronçon de la ligne adoucie.
Illustration : un bout qui retombe en S sous le fer, un autre au milieu du manche, finis en crosse ; ici 20 cm et
18 cm. Écarts tracés : ils y sont des fils fins, ils ont ici la largeur de la lanière dont ils sortent ; ils y sont du
côté du tranchant, ils sortent ici du côté du bloc à pointes (-Z), où la spire finit et où va sa tangente ; celui du
milieu s'y envole vers le haut, il s'écarte et retombe vers le talon ici (ce qui pend pend). Les deux restent
au-dessus de la prise (le plus bas descend à y = 0,15), dans la boîte de la hache, et du côté -X de l'axe du manche :
le jeu range la hache à plat, son côté +X contre le dos, et l'appuie par ses sommets (`MontageDeComposition._ranger`)."""

ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
