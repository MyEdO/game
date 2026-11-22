"""Données de `humanoide--vetement--bandages` (le Sorcier, #3743, #4351), lues par `modele.py` : la pièce `bandages` de la
garde-robe, que revêt la possession `bandages` (`src/data/trappings.json`, LDB p. 308).

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Ce qu'elle montre : les deux avant-bras serrés de bandes de toile ocre, enroulées en spires
qui se recouvrent (4 visibles entre la manche et le poignet du bras droit), puis le poignet et le dos de la main jusqu'à
la base des doigts ; le pouce et les doigts nus. Échelle relevée : 2,0 mm par pixel (semelles à y 1095 px, sommet du
crâne à y ~185 px, pour les 1,82 m de la base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Une fraction `f` se compte le long de l'avant-bras, de la tête de `lowerarm_*` (0, le coude) à celle de `hand_*`
(1, le poignet) ; un rang, entre les deux bouts de la pièce (0 au coude, 1 au poignet) ; un azimut, dans le plan
perpendiculaire, depuis le haut du bras en T.
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bandages'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['avant_bras_g', 'avant_bras_d'],
}
"""`couvre` : l'avant-bras seul ; la main, bandée jusqu'à la base des doigts, garde sa peau, que le pouce et les doigts
montrent."""
MATERIAUX = {'bandages': ('vet2', 'toile-ecrue')}
"""Illustration : bandes de toile ocre, la teinte claire de la tenue ; `vet2`."""

BUDGET_TRIANGLES = 2500           # procédure du skill, section 7 : vêtement par pièce

SEGMENTS = 12                     # colonnes en azimut (HYPOTHÈSE de maillage)
DEBORD = (0.01, 0.0)
"""(au coude, au poignet) : fraction dont chaque bout passe la frontière de la zone `avant_bras_*` de la base, relevée par
colonne (azimut de la colonne ± un pas) ; la pièce couvre la zone entière, que la base masque sous elle, sans couvrir plus
de bras qu'il ne faut, car la peau non masquée du coude la traverse en flexion. Base : la frontière va de f = -0,29
(sous le coude) à +0,05 (dessus), et de f = 0,87 à 1,08 au poignet."""

RANGS_DU_COUDE = [0.0, 0.08, 0.16]
"""Rangs des anneaux du coude, sans spire, serrés où le bras plie (HYPOTHÈSE de maillage). Un anneau à 0,03, sous le pli,
laissait l'arête de 6 mm qui le relie au bout s'écraser en flexion (mesuré au premier Sorcier, #3743)."""
RANGS_DU_POIGNET = [0.93, 1.0]    # rangs des anneaux du poignet, avant ceux de la main (HYPOTHÈSE de maillage)
SPIRES = {'bords': [0.32, 0.52, 0.72], 'marche': 0.012, 'saillie': 0.004, 'biais': 0.03, 'tour': 100.0}
"""Illustration : 4 bords de bande entre la manche et le poignet, chaque tour posé en biais ; 3 ici, espacés de 5 cm, pour
tenir le budget de la pièce avec la bande de main (contrat #4351 : 3 à 4 spires par avant-bras).
`bords` : le rang de chaque bord ; chacun est une marche de deux anneaux, à `marche` de part et d'autre : le tour qui
finit, en saillie de `saillie` (HYPOTHÈSE : 4 mm, plusieurs épaisseurs de toile, lisible de près), recouvre le tour qui
commence. `biais` : ce dont un bord avance d'un côté du bras et recule de l'autre (rang) ; `tour` : l'azimut dont ce
biais tourne d'un bord au suivant (HYPOTHÈSE : des tours croisés)."""

AISANCE = 0.003
"""HYPOTHÈSE : nappe extérieure à 3 mm de l'enveloppe de la coupe du bras."""
EPAISSEUR = 0.0015                # HYPOTHÈSE : double nappe d'un linge serré en plusieurs tours
LISSAGE_AU_COUDE = (0.30, 2)
"""(rang jusqu'où, passes) : passes laplaciennes des poids des anneaux du coude. Sans elles, les arêtes qui passent le
coude par derrière s'étirent au-delà de la porte en clip (mesuré au premier Sorcier, #3743) ; plus loin, les poids lissés
s'écartent de la peau et le poignet la laisse passer."""

MAIN = {'rangs': [(0.25, True), (0.48, True), (0.72, False), (0.88, False)], 'fente': 45.0, 'pouce': 0.25,
        'decalage': 0.004, 'portee': 0.15}
"""Illustration : la bande passe le poignet et couvre le dos de la main et la paume jusqu'à la base des doigts ; le pouce
en sort. Les colonnes de l'avant-bras continuent sur la main, d'un seul tenant. `rangs` : (fraction de la main, de la
tête de `hand_*` à celle de `middle_01_*` ; ouvert ou non dans l'azimut du pouce) de chaque anneau : deux ouverts, au talon
de la main et à la base du pouce (base : `thumb_01_*` à 0,29, `thumb_02_*` à 0,56), deux fermés qui passent entre le
pouce et l'index, le dernier avant les jointures (HYPOTHÈSE : 0,88). `fente` : demi-angle laissé au pouce autour de son
azimut (HYPOTHÈSE). `pouce` : poids des os du pouce au-delà duquel la peau est du pouce, hors de la surface que la bande
habille. `decalage` : écart de la bande à la peau, le long de la visée (HYPOTHÈSE : 4 mm : à 3 mm, la peau
perçait les facettes de la bande, vu au rendu). `portee` : départ
des visées, depuis l'axe de la main (m)."""
