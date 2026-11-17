"""Données de `humanoide--vetement--cape-en-lambeaux` (le Sorcier, #4351, contrat du 2026-11-16), lues par `modele.py` :
la variante `cape-en-lambeaux` de la pièce `cape` de la garde-robe. La pièce commune `cape`, que revêt la possession
`cape` (`trapping-cape`), garde sa forme.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Ce qu'elle montre (signe identitaire 5 du contrat) : une cape vert sombre attachée aux
épaules, sous l'écharpe du capuchon et le rouleau de couchage ; vue de trois quarts, elle déborde largement la hanche
gauche du personnage et tombe jusqu'au mollet ; son bas est en lambeaux profonds, dents irrégulières de 10 à 25 cm, et
elle est percée de quelques trous. Le dos ne se voit pas : HYPOTHÈSE du contrat, cape pleine d'une épaule à l'autre.
Échelle relevée : ~570 px/m (contrat).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Une colonne se repère par `u`, de -1 (bord droit) à 1 (bord gauche), 0 au milieu du dos. Tout jeu est celui de la
nappe intérieure. Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction sur la base ou un
élément publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'cape-en-lambeaux'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': [],
    'chaines': ['cape'],
}
"""`couvre` vide : la cape, ouverte devant, ne cache aucune zone entière. `chaines` : le filet `cape` de la base, qui la
porte sous `HAUT`."""
MATERIAUX = {'cape': ('accent', 'laine')}
"""Illustration : drap vert sombre, distinct du bleu-gris du capuchon. `SLOTS` (`src/lib/palette.ts`) n'a pas
d'emplacement de tissu libre : `accent`, celui de la pièce commune `cape` (HYPOTHÈSE, à trancher : écart à l'image)."""

CONTOURNE = {'robe': 'humanoide--vetement--robe'}
MATIERES_DE_LA_ROBE = ['robe', 'galon', 'dessous']
ZONES_DE_LA_ROBE = ['torse', 'hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d', 'mollet_g', 'mollet_d']
"""La robe du Sorcier, sous la cape, ses matières et les zones de ses meshes : la cape la contourne et en emprunte, au
plus proche, les poids et les clés (procédure, section 3 : transférées du corps, deux couches divergent sous
silhouette)."""
ZONES_DU_CORPS = ['cou', 'torse', 'hanches']
"""Zones de la base contournées avec la robe : le col se pose au pied du cou, que l'encolure de la robe laisse nu (sans
`cou`, les rayons du col sortaient par l'encolure sans rien rencontrer)."""
ZONES_DU_COL = ['cou']                  # zone dont l'empiècement prend aussi ses clés, avec la robe

BUDGET_TRIANGLES = 2500                 # procédure du skill, section 7 : vêtement par pièce
EPAISSEUR = 0.004                       # HYPOTHÈSE : drap de laine, double nappe
PAS = 0.002                             # m : pas des marches vers une surface

X_BRAS = 0.20
Z_BRAS = 1.15
"""Base : au-dessus de `Z_BRAS` (sous les aisselles), les surfaces contournées ne gardent que |x| <= `X_BRAS`, en dedans
des têtes de `upperarm_*` (x ±0,212) : au repos, bras en T, les manches ne portent pas la cape."""

COLONNES = 24                           # HYPOTHÈSE de maillage : intervalles d'un bord à l'autre
HAUT = 1.45
"""Base : hauteur du premier rang horizontal, sous les racines du filet `cape` (z 1,475) ; au-dessus, l'empiècement."""
RANGS = 12                              # HYPOTHÈSE de maillage : intervalles de `HAUT` à `OURLET`
OURLET = 0.30
"""Illustration : les pointes les plus basses, à mi-mollet (contrat : « du dos au mollet » ; base : mollet de z 0,15 à
0,48)."""
DEMI_OUVERTURE = (44.0, 65.0)
"""(à `HAUT`, à l'ourlet), degrés d'azimut de chaque bord depuis le dos. Haut, HYPOTHÈSE : derrière l'épaule, sur
l'omoplate, en dedans de l'emmanchure (x ~0,165) ; à 50° (x ~0,185), le haut de la manche de la robe passait devant la
cape quand le bras bouge (`couche-traversee`, 34 mm en Death01, 17 mm en Sword_Regular_A). Ourlet : en deçà du brin de bord du filet `cape` (67,5°), au-delà duquel rien ne porte la
nappe ; à ce rayon (0,43 m) la cape déborde la hanche de 20 cm, comme sur l'illustration."""
JEU = 0.010                             # HYPOTHÈSE : m, au-delà du rayon du filet
JEU_MIN = 0.008                         # HYPOTHÈSE : m, au plus près de la robe et du corps

LAMBEAUX = {'profondeur': 0.25, 'creux': 0.2, 'graine': 'humanoide--vetement--cape-en-lambeaux'}
"""Contrat : dents irrégulières de 10 à 25 cm. `tissu.lambeaux` : une pointe sur deux descend à 50-100 % de la
profondeur sous le fond des entailles, l'autre est une entaille ; la colonne finit à sa hauteur, son tissu ôté dessous."""
COLONNES_PAR_DENT = 2
"""HYPOTHÈSE : colonnes d'une pointe à l'entaille voisine, la hauteur du bord interpolée entre elles (illustration : des
dents de 10 à 15 cm de large à l'ourlet ; à l'ourlet, une colonne fait ~3,7 cm)."""
TROUS = [(-0.45, 0.78, 0.10, 0.07), (0.30, 0.62, 0.09, 0.06), (0.62, 0.98, 0.08, 0.05)]
"""Contrat : quelques trous. (u, z, demi-largeur en u, demi-hauteur en m) d'ellipses dont les triangles sont ôtés.
HYPOTHÈSE : trois, places et tailles (l'illustration en montre de petits, près du bord gauche et du bas)."""

EMPIECEMENT = {'os': 'neck_01', 'centre': (0.0, -0.020, -0.130), 'demi_ouverture': 60.0, 'polaire': 31.0, 'rangs': 3,
               'jeu': 0.010, 'portee_du_col': 0.30, 'portee': 0.08}
"""Contrat : attachée sous l'écharpe. Le col : un point par colonne, sur `demi_ouverture` degrés d'azimut de chaque côté
du dos, sur la demi-droite d'angle `polaire` (depuis la verticale) partie du centre (depuis la tête de `os` : base, sur
l'axe du cou, dans le torse, celui de l'écharpe de `vetement--capuche`), au `jeu` de la robe : au pied du cou (r ~0,10,
z ~1,57), marché depuis `portee_du_col`, sous l'écharpe, posée à 22 mm de la robe (`vetement--capuche/donnees.py`). Entre lui et `HAUT`, `rangs` - 1
rangs sur la droite du col au point de `HAUT`, chacun visé du centre et arrêté au jeu (`portee` : départ de la marche
au-delà du point visé)."""

LISSAGE_POIDS = 6
OS_REPORTES = {'upperarm_l': 'clavicle_l', 'upperarm_r': 'clavicle_r'}
"""Passes laplaciennes des poids empruntés et os reportés, ceux de la pièce commune `vetement--cape` (mêmes causes
mesurées : la cape ne suit pas le bras, et ses rangs du creux des reins ne se partagent pas entre dos et fesses)."""
