"""Données de `humanoide--vetement--bandages` (le Sorcier, #3743), lues par `modele.py` : la pièce `bandages` de la
garde-robe, que revêt la possession `bandages` (`src/data/trappings.json`, LDB p. 308).

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` |
Livre de Base | 94 | certaine » (hors dépôt). Ce qu'elle montre : les deux avant-bras serrés de bandes de tissu clair, du
poignet jusque sous la manche ; la main nue. Échelle relevée : environ 530 px/m (le personnage, du capuchon aux semelles,
environ 960 px pour les 1,82 m de la base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Une fraction `f` se compte le long de l'avant-bras, de la tête de `lowerarm_*` (0, le coude) à celle de `hand_*`
(1, le poignet) ; un azimut, dans le plan perpendiculaire, depuis le haut du bras en T.
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bandages'},
    'liaison': {'mode': 'squelette'},
    'couche': 'dessous',
    'couvre': ['avant_bras_g', 'avant_bras_d'],
}
MATERIAUX = {'bandages': ('vet2', ((0.8, 0.78, 0.72), 0.0, 0.9))}
"""Illustration : bandes écrues, la teinte de la robe de dessous ; `vet2`, en gris de construction."""

BUDGET_TRIANGLES = 2500           # procédure du skill, section 7 : vêtement par pièce

SEGMENTS = 12                     # colonnes en azimut (HYPOTHÈSE de maillage)
DEBORD = (0.01, 0.0)
"""(au coude, au poignet) : fraction dont chaque bout passe la frontière de la zone `avant_bras_*` de la base, relevée par
colonne (azimut de la colonne ± un pas) ; la pièce couvre la zone entière, que la base masque sous elle, sans couvrir plus
de bras ni de main qu'il ne faut, car la peau non masquée du coude et du poignet la traverse en flexion (au poignet,
0,01 de débord laissait la main la traverser de 7 mm sous `corpulence`). Base r24 : la frontière va de f = -0,29 (sous
le coude) à +0,05 (dessus), et de f = 0,87 à 1,08 au poignet. Illustration : les bandes vont du poignet jusque sous la
manche ; le coude, couvert par la manche, ne se voit pas."""

RANGS = [0.0, 0.03, 0.08, 0.16, 0.28, 0.42, 0.56, 0.70, 0.82, 0.90, 0.95, 0.98, 1.0]
"""Position de chaque anneau entre le bout du coude (0) et celui du poignet (1), par colonne ; serrés aux bouts, où le
bras plie (HYPOTHÈSE de maillage)."""

AISANCE = 0.003
"""HYPOTHÈSE : nappe extérieure à 3 mm de l'enveloppe de la coupe du bras ; la manche de dessous de la robe publiée, la plus
serrée des tenues du Sorcier, en a 6 (`vetement--robe/donnees.py`, `SOUS_MANCHE`), sa nappe intérieure 4."""
EPAISSEUR = 0.0015                # HYPOTHÈSE : double nappe d'un linge serré en plusieurs tours
LISSAGE_AU_COUDE = (0.30, 2)
"""(rang jusqu'où, passes) : passes laplaciennes des poids des anneaux du coude. Sans elles, les arêtes qui passent le
coude par derrière s'étirent jusqu'à 3,6 fois en flexion (Melee_Hook, LayToIdle), au-delà de la porte en clip (3,51) ;
plus loin, les poids lissés s'écartent de la peau et le poignet la laisse passer."""
