"""Données de `humanoide--armure--plastron` (le Soldat, #4318), lues par `modele.py` : la pièce `plastron` de la
garde-robe, l'objet `plastron` des possessions de Soldat (LDB 08 l.1366), localisation `corps`.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : un plastron d'acier poli, bombé sur la poitrine, marqué d'une arête médiane verticale, bordé de
laiton doré au bas et à l'encolure, qui descend jusqu'au haut des hanches, où pendent les tassettes ; le pourpoint se
voit aux épaules, sous les épaulières, et le col rouge de la chemise au-dessus de l'encolure. La dossière ne se voit pas
(l'écu la cache) : une plaque de dos lisse, fermée sur les flancs sous les bras et jointe au plastron par une bretelle
d'acier sur chaque épaule, HYPOTHÈSE. Échelle relevée : ~520 px/m (`armure--epaulieres/donnees.py`) ; du menton (y ~350
px) à la plante des pieds (y ~1105 px) pour les ~1,62 m de la base, le bas du plastron, au haut des tassettes (y ~625
px), tombe à ~1,03 m.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'plastron'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
}
"""`couvre` vide : par les emmanchures et au-dessus de l'encolure, le torse du pourpoint se voit ; caché à l'hôte, il
laisserait un trou aux épaules. Les triangles du pourpoint qu'il couvre tout entiers sont retirés au montage (pile)."""

MATERIAUX = {
    'acier': ('metal', 'acier-battu'),
    'dorure': ('metal', 'laiton-dore'),
}
"""Illustration : acier poli, bordures dorées. La bordure prend l'emplacement `metal`, comme celle des tassettes
(`armure--tassettes/donnees.py`) : la palette n'a pas d'emplacement de dorure, sa matière seule la distingue."""

BUDGET_TRIANGLES = 1000
"""Sous les 2 000 d'une armure (procédure, section 7) : le budget assemblé du Soldat est à sa limite (16 000)."""

# --- Maillage : anneaux horizontaux autour du tronc, `COLONNES` colonnes, la première devant (azimut 0, l'arête) ---
COLONNES = 24                      # HYPOTHÈSE de maillage : une colonne tous les 15°, l'arête sur la colonne 0
HAUTEURS = [1.06, 1.085, 1.15, 1.23, 1.30, 1.34, 1.40, 1.46, 1.52]
"""m, du bas à l'encolure. Le bas à 1,06, cote du bord bas du plastron pour les tassettes (illustration : ~1,03 m ;
base : le haut-de-chausses monte à 1,126, le bas du torse est à 1,04). La seconde rangée, à 2,5 cm, ferme la bordure
dorée du bas (illustration : ~12 px, 2,3 cm). L'encolure à 1,52, sous le bas du cou (1,53, base), d'où sort le col de la
chemise (illustration : le col rouge monte ~5 cm au-dessus du plastron)."""
EMMANCHURE = (1.34, 5)
"""Au-dessus de la hauteur 1,34 m, les `5`e à `7`e colonnes de chaque flanc (de 75 à 105° de l'avant) sont l'emmanchure.
Base : l'aisselle est à 1,37 ; illustration : le pourpoint se voit à l'épaule entre le plastron et l'épaulière. Le bord
bas de l'emmanchure, sous l'aisselle, laisse passer le bras qui pend."""
BRETELLE = [3, 4]
"""Colonnes (de l'avant) de la bretelle d'épaule : de la colonne 3 à 4 du plastron (45 à 60°) à leurs symétriques de la
dossière (135 à 120°), de |x| = 0,10 à 0,15 à l'encolure. HYPOTHÈSE : ~5 cm de large sur l'épaule, entre le cou
(|x| = 0,10, base) et l'épaulière (dès |x| = 0,23). Prise dès la colonne 2 (|x| = 0,06), la bretelle passait sur la
naissance du cou, qui la traversait tête penchée (`membre-dans-un-vetement`, 3 cm, 33 clips)."""
TRAVERSE_DE_BRETELLE = [0.3, 0.5, 0.7]
"""Fractions, de l'encolure du plastron à celle de la dossière, des rangées de la bretelle, posées sur l'épaule."""
JEU_DE_BRETELLE = 0.026
"""m, au-dessus de l'épaule de la base. HYPOTHÈSE : au-dessus du pourpoint (12 mm au bas du cou), comme l'encolure."""

# --- Aisance : distance au tronc de la base (enveloppe convexe de la coupe), par anneau et azimut ---
AISANCE = [(1.06, 0.046), (1.15, 0.036), (1.23, 0.028), (1.40, 0.032)]
"""(z, m) : la distance au tronc partout autour, interpolée. HYPOTHÈSE : 14 à 16 mm au-dessus du pourpoint
(`vetement--pourpoint`, 7 à 16 mm) : à 10 mm sur la poitrine, le pourpoint passait devant la plaque bras levés ou
tendus (`couche-traversee`, 5 à 18 mm, Melee_Hook, Pistol_Aim, NinjaJump) ; au bas, 4,6 cm, au-dessus de la ceinture bouffante du haut-de-chausses (son haut à
1,126, base), comme le plastron publié avant lui (4,2 à 4,4 cm de 1,06 à 1,10) ; à 4 cm, la ceinture passait devant lui
sous `carrure_plus` (`couche-traversee`, 7 à 17 mm)."""
BOMBE = [(1.06, 0.004), (1.15, 0.014), (1.23, 0.024), (1.30, 0.030), (1.40, 0.028), (1.46, 0.018), (1.52, 0.008)]
"""(z, m) : ce que le devant s'écarte de plus, au milieu, s'éteignant vers les flancs comme le carré du cosinus de
l'azimut. Illustration : la poitrine est bombée en carène, plus saillante sous les seins, rentrée à la taille et à
l'encolure ; ~3 cm de bombé au plus, HYPOTHÈSE de valeur."""
ARETE = 0.012
"""m : la colonne de l'avant (azimut 0) ressort de plus, de la deuxième rangée à l'encolure, en arête. Illustration :
une arête verticale nette au milieu du plastron ; HYPOTHÈSE de valeur."""
EVASEMENT_DU_BAS = 0.008
"""m : la rangée du bas s'écarte de plus, le bord se relève en rebord sur le haut-de-chausses. HYPOTHÈSE."""
DORURE = {'bas': 1, 'haut': 1}
"""Bandes de la bordure dorée : la première bande du bas, la dernière du haut (l'encolure) ; les bretelles restent d'acier."""
EPAISSEUR = 0.003                  # HYPOTHÈSE : tôle lisible à taille de jeu, double nappe
DEGAGEMENT_MIN = 0.020             # HYPOTHÈSE : jamais à moins de 2 cm de la peau (pourpoint et chemise dessous)
LISSAGE_POIDS = 3
"""Passes de lissage des poids empruntés au tronc : la plaque ne se plisse pas, elle suit le mélange des vertèbres ; le
bord de l'emmanchure garde un peu de l'épaule, que le mancheron soulève bras levé. HYPOTHÈSE de valeur."""
BORNES_DES_CLES = (0.27, 2.5)      # comme le pourpoint

# --- L'emplacement `poitrine` (l'insigne), offert sur la face du plastron ---
POITRINE = (0.085, 1.41)
"""(x, z) du point où l'insigne se pose, sur la gauche de la poitrine. Illustration : l'insigne en écu est sur le sein
gauche, son centre à ~0,7 largeur de cou du milieu (~45 px, 8,5 cm), à mi-hauteur entre l'aisselle et l'épaule
(~1,40 m), à droite de la sangle du baudrier."""
