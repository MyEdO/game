"""Données de `humanoide--armure--brassards-d-acier` (le Soldat, #4318), lues par `modele.py` : la variante
`brassards-d-acier` de la pièce `brassards` de la garde-robe (le Gladiateur garde la pièce `brassards`, de cuir et de
fourrure).

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre (avant-bras gauche, au premier plan, x ≈ 400-700, y ≈ 560-640 px) : un canon d'avant-bras d'acier
poli, tube fermé du poignet au coude, sur le gant ; son bord du coude s'évase par-dessus la fin de la manche bouffante ;
ses deux bords portent un liseré doré en relief (~5 px), et une croix dorée est gravée sur le dehors (motif, omis). La
cubitière n'est pas dessinée à part : le canon monte sur le coude par l'arrière, où son bord descend le plus bas. Le
bras droit, caché derrière la hampe, est le symétrique, HYPOTHÈSE. Échelle relevée : ~520 px/m.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x), bras à l'horizontale. Les abscisses `s` se comptent le long de l'avant-bras, de la tête de `lowerarm_*` (le coude,
s = 0) vers celle de `hand_*` (le poignet, base : s = 0,244). Les azimuts se comptent autour de l'avant-bras depuis le
dessus (0°) vers l'avant (90°), le dessous (180°) et l'arrière (270°), où pointe le coude. Chaque cote dit d'où elle vient :
`illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'brassards-d-acier'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': ['avant_bras_g', 'avant_bras_d'],
}
"""Le canon ferme l'avant-bras de tout côté, du coude au poignet : il cache la zone, et sous lui la manche de la
chemise et la fin de celle du pourpoint (leurs meshes `avant_bras_*`), et la manchette des gants."""

MATERIAUX = {
    'acier': ('metal', 'acier-battu'),
    'dorure': ('metal', 'laiton-dore'),
}
"""Illustration : acier poli, liserés dorés. `SLOTS` de `src/lib/palette.ts` n'a qu'un emplacement de métal : la dorure
le partage avec l'acier (comme `armure--tassettes`)."""

BUDGET_TRIANGLES = 1100
"""Sous les 2 000 d'une armure (procédure, section 7) : le budget assemblé du Soldat est à sa limite (16 000) ; le canon
cache les meshes `avant_bras_*` du corps, de la chemise, du pourpoint et des gants, qui sortent du compte."""

CONTOURNE = {'chemise': 'humanoide--vetement--chemise', 'pourpoint': 'humanoide--vetement--pourpoint'}
"""Les manches publiées du preset `soldat` que le bord évasé du coude enveloppe : leurs meshes `bras_haut_*`, qui
restent dessinés, finissent à s ≤ 0,016 (base)."""
MATIERES = {'chemise': ['chemise'], 'pourpoint': ['pourpoint', 'creves']}
FIN_DES_MANCHES = 0.02
"""m : abscisse au-delà de laquelle aucun sommet des manches ne compte (base : 0,016)."""

POIDS_DE_LA_MANCHE = 'pourpoint'
"""Les sommets du canon en deçà de `FIN_DES_MANCHES` (le bord du coude) prennent les poids du point de cette manche
publiée le plus proche, comme les lames des épaulières (`armure--epaulieres`) : ils bougent avec la manche qu'ils
enveloppent ; liés au corps, la manche bouffante passait devant le bord de 5 à 7 mm en clip (`couche-traversee`,
Hampe_Attaque, Lourde_Attaque, Hampe_Mort). Le reste du canon prend ceux du corps, et le lissage fond les deux."""
ZONES = {c: [f'bras_haut_{c}', f'avant_bras_{c}', f'main_{c}'] for c in 'gd'}
"""Par bras, les zones que le canon traverse : ses poids et ses clés en viennent."""

RANGEES = [(-0.108, -0.035), (-0.097, -0.026), (-0.078, -0.015), (-0.055, -0.003), (0.0, 0.02), (0.11, 0.11),
           (0.20, 0.20), (0.236, 0.236), (0.248, 0.248)]
"""(s à l'arrière, s au pli du coude) de chaque anneau, du coude au poignet ; entre les deux, selon l'azimut
(`AZIMUT_ARRIERE`, `POINTE`). Base : les meshes `avant_bras_*` que le canon cache montent jusqu'à s = -0,101 derrière le
coude (pourpoint, à 270°), -0,067 dessous et dessus (chemise, cachée aussi sous le pourpoint), -0,071 pour le corps ;
le pourpoint resté dessiné descend jusqu'à s = -0,033 dessus et dessous et 0,016 devant : le haut du canon passe sous
lui partout, sans trou ; les anneaux du coude serrés, que la bouffe de la manche (base : rayon jusqu'à 0,13 à
s = -0,10..-0,04) ne passe pas entre deux. Le bas à 0,248, sur le poignet (base : la zone `main` commence à
0,212-0,244). Illustration : le canon couvre l'avant-bras entier, son bord du coude évasé."""
AZIMUT_ARRIERE = 270.0
"""Degrés : le côté où le canon monte le plus haut, sur la pointe du coude (base : vers l'arrière au repos)."""
POINTE = 2.0
"""L'exposant de la part de l'arrière, ((1 + cos(azimut - `AZIMUT_ARRIERE`)) / 2) ** `POINTE` : le bord monte en pointe
sur le coude et reste bas sur les côtés, sous la dernière lame des épaulières (base : s ≤ -0,071, à 225-270°). C'est la
cubitière que le canon porte."""
LISERES = {'haut': 1, 'bas': 1}
"""Nombre de bandes d'anneaux dorées à chaque bord. Illustration : un liseré doré à chaque bord."""
RELIEF_DU_LISERE = 0.003
"""m : le liseré au-dessus de l'acier. HYPOTHÈSE : lisible en lumière rasante."""
COLONNES = 12                      # HYPOTHÈSE de maillage : un sommet tous les 30°, acier sans relief
JEU = [(-0.09, 0.009), (0.0, 0.009), (0.06, 0.012), (0.25, 0.008)]
"""(s, m) : écart du canon à l'enveloppe des coupes (corps, et manches jusqu'à `FIN_DES_MANCHES`). HYPOTHÈSE : sous la
distance où le montage retient tout entière la couche couverte (`SERRAGE_M` de `hotes/godot/asset/pile.ts`, 1 cm) au
coude ; 1,2 cm sur l'avant-bras, un tube d'acier rigide sur le muscle qui roule."""
PENTE = 0.9
"""Le rayon du canon descend d'au plus `PENTE` m par mètre de part et d'autre d'une coupe large : le bord du coude
s'évase sur la manche et se resserre en cône vers l'avant-bras. Illustration : le bord du coude évasé ; HYPOTHÈSE de
valeur."""
PAS_DES_COUPES = 0.01               # m, entre deux coupes de l'enveloppe
EPAISSEUR = 0.003                   # HYPOTHÈSE : tôle lisible à taille de jeu, double nappe
LISSAGE_POIDS = 2                   # comme le bas de chausses
