"""Données de `humanoide--vetement--cape` (le Sorcier, #3743), lues par `modele.py` : la pièce `cape` de la garde-robe, que
revêt la possession `cape` (`src/data/trappings.json`, LDB p. 302).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : une cape vert-noir attachée aux épaules, sous l'écharpe
de la capuche et le rouleau de couchage, qui tombe dans le dos jusqu'au mollet ; vue du côté gauche du personnage, elle
s'évase loin de la hanche ; son bas est en lambeaux. Le dos ne se voit pas. Échelle relevée : environ 530 px/m (le
personnage, du capuchon aux semelles, environ 960 px pour les 1,82 m de la base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut `phi` se compte autour d'un axe vertical passant par la tête de l'os `AXE['os']`, depuis le dos (+y), positif
vers la gauche (+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction sur la base r24 ou un
élément publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'cape'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': [],
    'chaines': ['cape'],
}
# `couvre` vide : un manteau masque au montage chaque zone qu'il couvre, sur le corps et sur les éléments de couche
# inférieure (`masquer_les_zones_couvertes`, `hotes/godot/projet/scripts/montage_de_composition.gd`) ; la cape, ouverte
# devant, ne cache aucune zone entière. `chaines` : le filet de la base qui porte la cape sous `HAUT`.
MATERIAUX = {'cape': ('accent', ((0.35, 0.37, 0.36), 0.0, 0.9))}
"""Illustration : drap vert-noir, de la teinte de la capuche en plus sombre ; `SLOTS` (`src/lib/palette.ts`) n'a que deux
emplacements de vêtement, pris par la robe : `accent`, celui de la capuche (HYPOTHÈSE). Gris de construction."""

CONTOURNE = {'robe': 'humanoide--vetement--robe', 'bandouliere': 'humanoide--accessoire--bandouliere-a-parchemins'}
MATIERES = {'robe': ['robe', 'dessous'], 'bandouliere': ['sangle', 'parchemin', 'fiole', 'bouchon']}
ZONES_PUBLIEES = {'robe': ['torse', 'hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d', 'mollet_g', 'mollet_d'],
                  'bandouliere': ['cou', 'torse']}
"""Les éléments publiés sous la cape, leurs matières et les zones de leurs meshes : la cape les contourne et emprunte, au
plus proche, leurs poids et leurs clés, celles-ci de leurs seuls meshes : transférées aussi du corps, deux couches divergent
sous silhouette (procédure, section 3 ; 130 traversées de la robe sous `corpulence`, jusqu'à 17 mm). Brief du ticket : la
cape passe par-dessus la robe et la bandoulière."""
ZONES_DU_CORPS = ['torse', 'hanches']
"""Zones de la base que la cape contourne avec les éléments publiés : base r24, la robe r7 laisse le haut du dos des
épaules découvert (sommet à 1,463 m à x = 0,16, contre 1,541 m pour le torse)."""

BUDGET_TRIANGLES = 2500           # procédure du skill, section 7 : vêtement par pièce
EPAISSEUR = 0.004                 # HYPOTHÈSE : drap de laine épais, double nappe, comme la capuche

X_BRAS = 0.20
"""Base : au repos (bras en T), au-dessus de `Z_BRAS`, les coupes, les visées et les poids empruntés ne gardent que
|x| <= `X_BRAS`, en dedans des têtes de `upperarm_*` (x = ±0,212) : les manches et les bras ne portent pas la cape ; le bord
latéral qui prenait les poids du pan de manche pendu sous le bras en T s'étirait à ×5 (Sword_Dash)."""
Z_BRAS = 1.15                     # base : sous les aisselles (bas de `bras_haut_*` à 1,373 m), au-dessus de la taille

HAUT = 1.45
"""HYPOTHÈSE : hauteur du premier rang horizontal, sur le haut des omoplates ; au-dessus, l'empiècement."""
ZONES_DU_COL = ['cou']
"""Base : zone que le col contourne, avec `CONTOURNE` et `ZONES_DU_CORPS`, et dont l'empiècement prend aussi les clés, avec
les éléments publiés : sans elle, le col ne suit pas `gabarit_head_plus` ni `gabarit_arms_plus` (`cle-non-suivie`)."""
EMPIECEMENT = {'os_du_col': 'neck_01', 'demi_ouverture': 65.0, 'fenetre': 10.0, 'portee_du_col': 0.16, 'jeu_du_col': 0.008,
               'passes_du_col': 3, 'os': 'spine_03', 'centre': (0.06, 0.08), 'portee': 0.08, 'rangs': 3, 'pas': 0.002}
"""Consigne utilisateur (Clément, 2026-11-09, via l'orchestrateur : « J ai l'impression que c'est une cape avec capuche
non ? Après peut être que ce n est pas grave ») : la cape naît sous la capuche, à la nuque et aux épaules, sans jour entre
elles.
Le col : un point par colonne, sur `demi_ouverture` degrés d'azimut de chaque côté du dos autour de l'axe vertical de la
tête de `os_du_col` (HYPOTHÈSE : il tourne sous l'écharpe jusqu'aux côtés du cou ; au-delà de 65°, devant l'épaule, le col
court le long du cou, parallèle aux rangs qui vont au dos, et la nappe s'y retourne : 1 triangle au repos à 75°, 6 à 95°), à
la hauteur du bas de la zone `cou` de la base (la couture, sous le bas de l'écharpe publiée) à ± `fenetre` degrés, visé
horizontalement du dehors (`portee_du_col`) vers l'axe, au jeu `jeu_du_col` de la nappe intérieure (HYPOTHÈSE : sous le bas
de l'écharpe, posé à 10 mm de la robe, `vetement--capuche/donnees.py` ; à 4 mm, la bandoulière passait devant le col, jusqu'à
7,5 mm en Melee_Hook) ; `passes_du_col` passes lissent son rayon, sans passer sous la visée, et sa hauteur d'une colonne à
l'autre : la bandoulière, qui monte à 1,61 m sur l'épaule droite, porte le col au bout de la visée sur trois colonnes, à côté
de colonnes à 8 cm de l'axe, et la nappe s'y retournait (5 triangles au repos). Les `rangs` - 1 rangs suivants, menés en
ligne droite du col au point de `HAUT` de la colonne, chacun visé du dehors (`portee` au-delà) vers l'axe parallèle à x
passant à `centre` (y, z) de la tête de `os`, s'arrêtent au jeu, mené de `jeu_du_col` à
`JEU` ; `pas` (m) des visées."""
OURLET = 0.37
"""Illustration : le bas de la cape, entre les lambeaux, à environ 195 px au-dessus des semelles, mi-mollet."""
DEMI_OUVERTURE = (44.0, 65.0)
"""(à `HAUT`, à l'ourlet), degrés d'azimut de chaque bord latéral depuis le dos. Haut, HYPOTHÈSE : le bord passe derrière
l'épaule (x ≈ 0,15 m), sur l'omoplate, en dedans de l'emmanchure : à 58° (x ≈ 0,19 m), le haut de la manche de la robe
passe devant la cape quand le bras bouge (jusqu'à 24 mm, Death01) ; à 48°, sous `carrure_plus`, où le flanc de la robe
s'élargit vers la manche qui ne bouge pas, jusqu'à 96 mm (LayToIdle) ; à 40°, les arêtes du haut s'étirent sous
`carrure_plus` (garde `etirement`, 13 clips). Ourlet : en deçà du brin de bord du filet `cape` de la base (67,5°), au-delà
duquel aucun brin ne porte la nappe ; au rayon de l'ourlet, la cape déborde la hanche (illustration, vue de trois quarts)."""
COLONNES = 24                     # intervalles en azimut (HYPOTHÈSE de maillage) : quatre par pli
RANGS = 15                        # intervalles de `HAUT` à l'ourlet (HYPOTHÈSE de maillage)

JEU = 0.008
"""HYPOTHÈSE : jeu de la nappe intérieure à l'enveloppe convexe de la coupe (robe et corps) ; plus près, la garde `traversee`
lie la robe sous la cape à moins de 3 cm (`PORTEE_DE_COUVERTURE_M`), et la cape doit la suivre."""
PAS_DU_PROFIL = 0.01              # m : pas vertical des coupes du profil de chaque colonne
PLIS = {'nombre': 6, 'ampleur': 0.035}
"""Illustration : la cape tombe en grands plis verticaux. Lobes du rayon en azimut, nuls à `HAUT`, d'ampleur croissante
jusqu'à l'ourlet ; ajoutés au profil, jamais en dedans (HYPOTHÈSE : nombre et ampleur)."""
PASSES_DE_LISSAGE = 2             # passes qui lissent le rayon entre colonnes voisines, sans passer sous le profil

LAMBEAUX = {'profondeur': 0.08, 'creux': 0.15, 'graine': 'humanoide--vetement--cape'}
"""Illustration : les lambeaux du bas descendent d'environ 40 px sous l'ourlet (8 cm) (`tissu.lambeaux`)."""

LISSAGE_POIDS = 6
"""Passes laplaciennes des poids empruntés (HYPOTHÈSE) : à 2, au creux des reins (1,09 à 1,16 m), loin de la robe, les rangs
prennent les poids du dos et ceux des fesses, et l'arête entre eux s'étirait à ×3,8 sous `corpulence` (Zombie_Scratch)."""
OS_REPORTES = {'upperarm_l': 'clavicle_l', 'upperarm_r': 'clavicle_r'}
"""Os dont la cape reporte le poids emprunté sur un autre : la robe porte `upperarm_*` près de l'emmanchure ; la cape, qui ne
couvre pas le bras, ne le suit pas (avec lui, les arêtes du haut, de 15 mm, s'étiraient à ×3,4 en Sword_Dash)."""
