"""Données de `humanoide--accessoire--hotte` (l'Apothicaire, #4261), lues par `modele.py` : la pièce `hotte` de la
garde-robe, portée au `dos`.

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Ce qu'elle montre : un panier d'osier tressé porté haut
sur le dos, plus large en haut qu'en bas, ouvert en haut, d'où dépassent les goulots de nombreuses fioles ; vu de
trois-quarts, il déborde derrière l'épaule droite du personnage (à gauche de l'image) et monte jusqu'à la hauteur du
haut de la coiffe. Une bretelle de cuir sombre passe sur l'épaule. Les fioles sont des objets (`potion-de-guerison`),
rangés dans les cases que la hotte offre (`CASES`, #3844), jamais cuits dans la hotte. Omis : la fourrure gris-vert
sous les bretelles (#4261). Le dos du panier, son fond et le trajet des bretelles sous les bras ne se voient pas : leurs
cotes sont des HYPOTHÈSES. Échelle relevée : environ 640 px/m (la tête, du menton au sommet de la coiffe, ~150 px pour
les 0,235 m de la tête publiée, comme `vetement--foulard/donnees.py`).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction sur la base ou un élément publié)
ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'hotte'},
    'liaison': {'mode': 'surface'},
    'couche': 'armure',
}
"""Couche `armure`, la première au-dessus de `tenue` : les bretelles se posent sur le pourpoint, sous le foulard
(`manteau`), comme la bandoulière du Sorcier sous l'écharpe de sa capuche."""

MATERIAUX = {
    'osier': ('bois', ((0.55, 0.55, 0.55), 0.0, 0.9)),
    'cuir': ('cuir', ((0.4, 0.4, 0.4), 0.0, 0.87)),
}
"""Illustration : l'osier brun du panier (`bois`), le cuir sombre des bretelles (`cuir`). Gris de construction."""

BUDGET_TRIANGLES = 800            # procédure du skill, section 7 : accessoire

CONTOURNE = {
    'pourpoint': 'humanoide--vetement--pourpoint-matelasse',
    'foulard': 'humanoide--vetement--foulard',
    'bonnet': 'humanoide--vetement--bonnet',
    'coiffure': 'humanoide--pilosite--cheveux-nattes',
    'tete': 'humanoide--tete--humain',
}
"""Les éléments publiés du preset `apothicaire` derrière lesquels le panier se pose, au `JEU_DU_PANIER` : le pourpoint
et le foulard sur le haut du dos, la coiffe, les nattes et la tête derrière lesquelles il monte. Les bretelles reposent
sur le pourpoint, dont elles empruntent les poids et reprennent les clés, sous le foulard."""
MATIERES = {'pourpoint': ['robe'], 'foulard': ['foulard'], 'bonnet': ['bonnet'], 'coiffure': ['poil'], 'tete': ['peau']}
ZONES_DU_CORPS = ['torse', 'cou', 'tete']
"""Zones de la base derrière lesquelles le panier se pose aussi : il monte du milieu du dos jusque derrière la tête."""
ZONES_DES_CLES = ZONES_DU_CORPS + ['bras_haut_g', 'bras_haut_d']
"""Zones de la base dont le panier reprend ses clés, au plus près : son ventre passe derrière le haut des bras ; repris
du seul tronc, il ne suivait pas le bras qui grandit sous `gabarit_arms_plus` (`suiviDuCorps/cle-inerte`, 1,8 mm pour
5,4)."""

# --- Le panier : sections elliptiques, d'anneaux horizontaux, fermé en bas, ouvert en haut ---
Z_HAUT = 1.715
"""z du bord au repos de la base. Illustration : le bord arrive au haut de la coiffe, les fioles dépassent. Base : la
coiffe publiée culmine à z = 1,836 au repos et à 1,803 dans Idle_Loop (image 1), où le panier, pendu au haut du dos,
monte de ~9 cm au-dessus de son repos ; un bord à 1,80 au repos passait 9 cm au-dessus de la coiffe en jeu (captures
Godot du preset). La cote est choisie pour que le bord arrive au haut de la coiffe dans Idle_Loop."""
Z_BAS = 1.22
"""z du fond. HYPOTHÈSE : caché par le dos ; le panier descend jusqu'au milieu du dos, au-dessus des basques du
pourpoint (base : son dos s'évase sous z = 1,15)."""
LARGEUR = [(0.0, 0.12), (0.5, 0.19), (1.0, 0.17)]
"""(t, m) : demi-axe en x de la section, de t = 0 au fond à t = 1 au bord, interpolé. Illustration : le bord, vu de
trois-quarts, couvre ~225 px, ~0,35 m, et l'osier gonfle sous lui ; HYPOTHÈSE au fond, caché, plus étroit."""
PROFONDEUR = [(0.0, 0.085), (0.5, 0.135), (1.0, 0.12)]
"""(t, m) : demi-axe en y de la section. HYPOTHÈSE : le dos du panier ne se voit pas ; ~2/3 de la largeur, comme une
hotte de colporteur, avec le même ventre."""
INCLINAISON = 10.0
"""Degrés dont l'axe du panier penche vers l'arrière, du fond au bord. Illustration : le bord s'écarte du dos au-dessus
de l'épaule."""
JEU_DU_PANIER = 0.03
"""m, de la paroi avant (ses rangs gonflés et son bord compris) aux éléments contournés et au corps. HYPOTHÈSE : les
bretelles (`BRETELLE`, 5 mm au-dessus du pourpoint) passent dessous, et la fourrure omise y tenait."""
EPAISSEUR = 0.01                  # HYPOTHÈSE : paroi d'osier tressé, double nappe
COLONNES = 12                     # HYPOTHÈSE de maillage : intervalles en azimut, le budget tenu
RANGS = 10
"""Intervalles entre anneaux, du fond au bord : un anneau tous les ~5 cm (illustration : les rangs d'osier se suivent
serrés ; le pourpoint matelassé en pose un tous les 4 cm, `vetement--pourpoint-matelasse/donnees.py`)."""
RELIEF = 0.022
"""m : les rangs d'osier, un anneau sur deux gonflé d'autant au-dessus de ses voisins creux, en partant du bord.
HYPOTHÈSE : un relief qui se lit en silhouette à taille de jeu, sans texture, celui des côtes du pourpoint matelassé
(26 mm de la couture à la côte, `vetement--pourpoint-matelasse/donnees.py`) ; à 12 mm, il ne marquait pas le contour
du panier au rendu de 128 px."""
BORD = 0.022                      # m : le bord, roulé, déborde d'autant de la section (illustration, bourrelet épais)
Z_DES_POIDS = 1.42
"""z du point du dos, au milieu, dont le panier entier prend les poids (emprunté au pourpoint) : un panier rigide qui
suit le haut du dos, sans se déformer avec les bras. HYPOTHÈSE : le milieu des omoplates, où il s'appuie."""

# --- Les bretelles : de chaque côté, du haut du panier sur l'épaule, devant, sous l'aisselle et au bas du panier ---
BRETELLE = {
    'plan': 0.21,
    'arc': (135.0, 405.0),
    'pas': 22.5,
    'attache_x': 0.6,
    'attache_haut': 1.55,
    'attache_bas': 1.27,
    'largeur': 0.04,
    'jeu': 0.002,
    'epaisseur': 0.003,
    'portee': 0.2,
}
"""Sur l'épaule, la bretelle suit, au `jeu`, le pourpoint coupé par le plan vertical |x| = `plan`, perpendiculaire à
l'axe gauche-droite, visé tous les `pas` degrés depuis le centre de la coupe de l'épaule, de `arc[0]` à `arc[1]` (0 :
vers le bas, 90 : vers l'arrière, 180 : vers le haut, 270 : vers l'avant) : de derrière l'épaule, par-dessus, devant,
puis sous l'aisselle et derrière elle. Ses deux bouts rejoignent la paroi avant du panier, à |x| = `attache_x` fois
son demi-axe, en haut à z = `attache_haut`, en bas à z = `attache_bas`. `plan` : HYPOTHÈSE ; base : l'encolure du
pourpoint publié monte jusqu'à |x| = 0,16 (à 0,12, la bretelle tombait dans l'encolure), la tête de `upperarm_*` est
à |x| = 0,21, et sous elle, l'aisselle du pourpoint à z = 1,32. Attaches : HYPOTHÈSES, cachées par le dos ; le haut à
la hauteur de l'épaule, en haut de la part du panier qui repose sur le dos (à 1,62, au-dessus d'elle, le brin montait
derrière l'épaule comme une planche en l'air et passait sur le foulard), le bas à 5 cm du fond. `largeur` :
illustration, ~25 px, ~4 cm. `jeu` et `epaisseur` : HYPOTHÈSES, ceux de la bandoulière du Sorcier, cuir en double
nappe à 2 mm du pourpoint. `portee` : m, départ des visées vers le pourpoint depuis le centre de la coupe de
l'épaule ; à 0,5, la visée du bas touchait les basques du pourpoint (z ~ 1,0) avant l'aisselle."""
ZONES_DE_L_EPAULE = ['torse', 'bras_haut']
"""Zones de la base dont la coupe par le plan centre la bretelle ; `bras_haut` reçoit le côté (`_g`, `_d`)."""
MATIERES_DU_SUPPORT = ['robe']
ZONES_DU_SUPPORT = ['torse', 'bras_haut_g', 'bras_haut_d']
"""Zones de la base, et des meshes du pourpoint, dont les bretelles reprennent les clés."""
OS_REPORTES = {'upperarm_l': 'clavicle_l', 'upperarm_r': 'clavicle_r'}
"""Os dont les bretelles reportent le poids emprunté : elles reposent sur l'épaule, elles ne suivent pas le bras (le
haut de la manche du pourpoint porte `upperarm_*`), comme le foulard (`vetement--foulard/donnees.py`). Avec les poids
du bras, les arêtes de la bretelle sous l'aisselle s'écrasaient ou s'étiraient hors de [0,01 ; 3,51] et le pourpoint
passait devant elle sous `carrure_plus` (`etirement`, `couche-traversee`, jusqu'à 14 mm en Sword_Dash)."""
LISSAGE_POIDS = 2                 # HYPOTHÈSE : passes laplaciennes des poids empruntés, comme la bandoulière

# --- Les cases : l'emplacement `charge_dos`, puis `charge_dos#<rang>`, dans l'ouverture du panier ---
EMPLACEMENT = 'charge_dos'
RAYON_DE_LA_FIOLE = 0.0095
"""m : le rayon de la fiole publiée (`rigide--fiole/donnees.py`, `RAYON`), dont le dos se pose sur la case : la case
recule d'autant pour que l'axe de la fiole tombe au point voulu."""
CASES = [
    # (u, v, dz)
    (-0.55, -0.35, -0.015),
    (-0.20, -0.45, -0.007),
    (0.15, -0.40, -0.019),
    (0.50, -0.30, -0.011),
    (-0.40, 0.35, -0.009),
    (-0.05, 0.30, -0.017),
    (0.30, 0.40, -0.005),
    (0.62, 0.20, -0.021),
]
"""Les huit cases, une par décoction de guérison du preset, dans l'ordre des rangs. `u`, `v` : l'axe de la fiole dans
l'ouverture, en fraction du demi-axe intérieur du bord, en x (positif vers la gauche du personnage) et en y (positif
vers l'arrière) ; `dz` : m du milieu de la fiole sous (négatif) ou au-dessus du bord. Illustration : une grappe serrée
de goulots dépasse du bord sur toute l'ouverture ; les fioles de 7 cm, centrées ~1,5 cm sous le bord, y laissent
dépasser leur bouchon et le haut de leur panse (~2 cm). HYPOTHÈSE : deux rangées de quatre, décalées, en hauteur
irrégulière. L'axe de chaque case est celui que lui donne l'hôte (`MiseEnPage.axe_de_rangement`) : +Z sur la normale
sortante, hors de l'axe de l'os, +Y vers le haut ; la fiole y pend goulot en haut."""
