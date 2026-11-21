"""Données de `humanoide--vetement--haut-de-chausses` (le Soldat, #4318), lues par `modele.py` : la pièce
`haut-de-chausses` de la garde-robe, de l'ensemble `tenue-uniforme-de-soldat`, seul à la porter (le Gladiateur porte sa
variante `haut-de-chausses-ample`).

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : une culotte bouffante mi-partie, fendue de crevés verticaux, qui sort de sous le plastron et les
tassettes et se serre au-dessus du genou par un bandeau noir. La jambe droite est noire, de larges pans noirs que
séparent d'étroits crevés blancs ; la jambe gauche est blanche, de larges pans blancs bombés que séparent d'étroits
crevés noirs. Le bouffant est plus gros au dehors qu'à l'entrejambe. Omis : la couture horizontale qui partage les pans
de la jambe gauche en deux étages, et la frange du bandeau (détails). Le dos ne se voit pas : symétrique du devant,
HYPOTHÈSE. Échelle relevée sous la taille : ~453 px/m, du bas du plastron (y ~625 px, 1,06 m, `armure--plastron`) à la
plante des pieds (y ~1105 px) ; le bandeau du genou à y ~845 px, ~0,58 m ; une jambe de culotte fait ~110 à 150 px de
large au plus bouffant, ~0,24 à 0,33 m, sur une cuisse de ~0,18 m (base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'haut-de-chausses'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['hanches', 'cuisse_g', 'cuisse_d'],
}
"""Les hanches et les cuisses (base : la cuisse descend à 0,576, sous le bandeau). Le genou reste aux bas : le bandeau
s'arrête au-dessus de lui."""

MATERIAUX = {
    'drap': ('vet1', 'drap-terne'),
    'toile': ('vet2', 'toile-ecrue'),
}
"""Illustration : le noir (`vet1`, noir au preset `soldat`) des pans de la jambe droite, des crevés de la jambe gauche et
du bandeau, en drap ; le blanc (`vet2`, écru au preset) des pans de la jambe gauche et des crevés de la jambe droite, en
toile. Deux emplacements de palette, une matière chacun."""

BUDGET_TRIANGLES = 2000
"""Sous les 2 500 d'un vêtement (procédure, section 7)."""

PORTEUSES = ['hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d']
"""Les zones que la culotte traverse : ses poids et ses clés en viennent."""

# --- Colonnes : par jambe, `COLONNES_JAMBE` azimuts autour de l'axe de la jambe (degrés, depuis l'avant vers la gauche
# du personnage, à la jambe gauche ; en miroir à la droite) ---
COLONNES_JAMBE = 24                # HYPOTHÈSE de maillage : huit pans de trois colonnes autour de la jambe
COUTURE_DEVANT = 22
"""Colonne (334°, devant, côté entrejambe) où la jambe rejoint la couture du milieu devant ; les colonnes de l'entrejambe
vont de `COUTURE_DOS` à elle, celles du dehors d'elle à `COUTURE_DOS` par l'avant."""
COUTURE_DOS = 14                   # 218°, derrière, côté entrejambe
PAN = 3
"""Colonnes par pan : la première et la dernière en creux (le crevé entre deux pans, d'une colonne de large), celle du
milieu bombée. Illustration : six à sept pans se comptent sur la face visible de chaque jambe."""
LARGEUR_DU_CREVE = 8.0
"""Degrés du crevé, sur les 45° d'un pan. Illustration : le crevé est un filet, ~5 à 6 fois plus étroit que le pan ; à
la largeur d'une colonne (15°), noir et blanc se partageaient la jambe et le mi-parti ne se lisait plus."""

# --- Rangées : anneaux horizontaux, de la ceinture à l'entrejambe autour des hanches, puis autour de chaque jambe ---
CEINTURE = [1.085, 1.04, 0.97, 0.90]
"""z des anneaux autour des hanches. La ceinture à 1,085 : au-dessus du bas du plastron (1,06, `armure--plastron`),
cachée sous lui, et du bas de la chemise (1,07, `vetement--chemise`), pour qu'aucune peau ne se voie entre eux ; plus
bas, la taille s'ouvre sous le plastron et la culotte se voit. HYPOTHÈSE : la consigne d'une ceinture sous 1,06 qui
laisse voir le pourpoint ne tient pas, le pourpoint s'arrêtant à 1,14 (`vetement--pourpoint`)."""
ENTREJAMBE = 0.845
"""z de la rangée où les deux jambes se séparent. Base : les cuisses se touchent jusqu'à ~0,85 (écart de 2 cm), le bas
des hanches est à 0,885."""
JAMBE = [0.78, 0.715, 0.66, 0.628, 0.607, 0.585]
"""z des anneaux de chaque jambe, sous l'entrejambe. Illustration : le bouffant le plus gros à mi-cuisse, le bandeau du
genou de 0,607 à 0,585 (~22 mm, ~10 px), au-dessus du genou (base : tête du tibia à 0,552)."""
BANDEAU = 1
"""Bandes d'anneaux du bas de la jambe en drap, le bandeau, quelle que soit la jambe (illustration : le bandeau est
noir aux deux genoux)."""

# --- Volume ---
AISANCE = [(1.085, 0.010), (1.04, 0.020), (0.97, 0.032), (0.90, 0.036), (0.845, 0.040), (0.78, 0.068), (0.715, 0.066),
           (0.66, 0.040), (0.628, 0.016), (0.607, 0.008), (0.585, 0.008)]
"""(z, m) : distance au corps (enveloppe convexe de la coupe) des colonnes bombées, au dehors de la jambe. Illustration :
~5 à 7 cm d'aisance au plus bouffant ; ajustée à la ceinture, sous le plastron (son bas à 4,6 cm du tronc,
`armure--plastron`) ; serrée au bandeau, à 8 mm, sur le bas (`vetement--bas-de-chausses`, 4 mm). Sous les tassettes
(jusqu'à 0,785, `armure--tassettes`), presque égale de rang en rang : posées sur le point le plus avancé de leur
voisinage, elles laissaient à plus d'1 cm sous elles la culotte qui bouffait dès la taille, hors de leur retenue
(`SERRAGE_M` de `hotes/godot/asset/pile.ts`), qui passait devant elles cuisse levée (`couche-traversee`, 6 à 19 mm)."""
VERS_L_ENTREJAMBE = [(0.0, 1.0), (90.0, 0.85), (140.0, 0.35), (180.0, 0.15)]
"""(angle depuis le dehors de la jambe, degrés ; part de l'aisance) : le bouffant s'éteint vers l'entrejambe, où les deux
jambes se touchent. Illustration : la culotte bouffe au dehors et devant ; HYPOTHÈSE de valeurs."""
CREUX = [(1.085, 0.0), (0.95, 0.002), (0.80, 0.005), (0.75, 0.026), (0.715, 0.026), (0.66, 0.016), (0.628, 0.0)]
"""(z, m) : ce dont les colonnes d'un crevé rentrent sous les colonnes bombées. Illustration : les pans bombent nettement
entre les crevés sous les tassettes ; HYPOTHÈSE de valeurs. Nul à la ceinture et au bandeau, où les pans se froncent ; à
peine sous les tassettes (jusqu'à 0,785, `armure--tassettes`), qui retiennent ce qu'elles couvrent à moins d'1 cm
(`SERRAGE_M` de `hotes/godot/asset/pile.ts`) : rentrés de 1,6 cm, les crevés passaient devant elles cuisse levée
(`couche-traversee`, 5 à 9 mm)."""
DEGAGEMENT_MIN = 0.006
"""m : jamais à moins de la peau, au-dessus de la chemise (4 à 8 mm à la taille, `vetement--chemise`) et des bas."""
EPAISSEUR = 0.003                  # HYPOTHÈSE : drap lisible à taille de jeu, double nappe
LISSAGE_POIDS = 5
"""HYPOTHÈSE : le bouffant suit le mélange des os, sans plis aux crevés ; à 3 passes, une arête de l'entrejambe s'étirait
de 3,7 fois jambes écartées (`etirement/arete-etiree`, Sword_Heavy_Combo)."""
BORNES_DES_CLES = (0.5, 1.8)
"""Rapport de longueur d'arête sous une clé transférée hors duquel la clé se lisse (`tissu.Base.transferer`). HYPOTHÈSE :
plus serré que le pourpoint (0,27 ; 2,5) ; les colonnes du milieu, liées à la cuisse la plus proche, étiraient leurs
arêtes sous `carrure_plus`, et le mouvement les portait au-delà de la porte (`etirement/arete-etiree`, 3,6 à 5,2)."""
