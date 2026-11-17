"""Données de `humanoide--accessoire--ruban` (le Soldat, #4318), lues par `modele.py` : la pièce `ruban` de la
garde-robe, emplacement `genou_g`, que seul le preset `soldat` porte.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : un ruban noir noué autour de la jambe gauche, sous le genou, juste sous le bandeau de la culotte ; le
nœud, sur le dehors de la jambe, un peu devant, laisse pendre deux bouts le long du mollet. Échelle relevée sous la
taille : ~453 px/m (`vetement--haut-de-chausses`) ; les bouts pendent ~70 px, ~15 cm, larges ensemble de ~12 px, ~2,7 cm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'accessoire',
    'cle': {'piece': 'ruban'},
    'liaison': {'mode': 'surface'},
    'couche': 'tenue',
}
"""Liaison `surface` : le ruban repose sur le bas, dont il emprunte les poids. Couche `tenue` : par-dessus les bas
(`dessous`)."""

MATERIAUX = {'ruban': ('vet1', 'drap-terne')}
"""Illustration : ruban noir (`vet1`, noir au preset `soldat`). La soie n'a pas de texture au catalogue
(`hotes/godot/projet/textures/`) : le drap, teint par la palette."""

BUDGET_TRIANGLES = 400
"""Sous les 800 d'un accessoire (procédure, section 7) : le budget assemblé du Soldat est à sa limite (16 000)."""

CONTOURNE = {'bas': 'humanoide--vetement--bas-de-chausses'}
"""Le bas du preset `soldat`, sur lequel le ruban se pose, au `JEU`, et dont il emprunte les poids."""
MATIERES = {'bas': ['bas']}
ZONES_DES_CLES = ['genou_g', 'mollet_g']

OS = 'calf_l'
"""L'os de la jambe gauche, de la tête du tibia (z = 0,552) à la cheville (base), le long duquel le ruban se centre."""
BANDE = (0.505, 0.490)
"""(z du bord haut, z du bord bas) de la bande. Illustration : sous le genou, sous le bandeau de la culotte (son bas à
0,585, `vetement--haut-de-chausses`) ; ~1,5 cm de large (~7 px). Base : sous la tête du tibia (0,552) ; posée sur elle,
la bande laissait passer le bas devant elle genou plié (`couche-traversee`, 8 à 9 mm, dix clips)."""
COLONNES = 16                      # HYPOTHÈSE de maillage : la bande fait le tour de la jambe
NOEUD = 75.0
"""Degrés, depuis l'avant vers la gauche du personnage : le nœud et les bouts, sur le dehors de la jambe gauche, un peu
devant (illustration)."""
TAILLE_DU_NOEUD = (0.026, 0.020)   # (large, haut), m ; illustration : ~12 px de large, ~9 px de haut
BOUTS = [(-0.007, 0.350), (0.007, 0.370)]
"""(décalage en travers depuis le nœud, z du bout) de chaque bout. Illustration : deux bouts côte à côte, l'un un peu plus
long, jusqu'à ~15 cm sous le nœud."""
LARGEUR_DU_BOUT = 0.012            # illustration : ~12 px pour les deux, ~2,7 cm
RANGS_DU_BOUT = 4                  # HYPOTHÈSE de maillage : le bout suit le galbe du mollet
JEU = 0.003
"""m, de la face intérieure du ruban au bas. HYPOTHÈSE : sous la retenue du montage (`SERRAGE_M` de
`hotes/godot/asset/pile.ts`, 1 cm)."""
RELIEF_DU_NOEUD = 0.004            # m : le nœud et le haut des bouts devant la bande ; HYPOTHÈSE
EPAISSEUR = 0.002                  # HYPOTHÈSE : ruban lisible à taille de jeu, double nappe
PORTEE = 0.12
"""m : départ des visées, depuis l'axe de la jambe. Base : la jambe fait ~6 cm de rayon sous le genou ; partie de plus
loin, la visée de l'entrejambe partait dans l'autre jambe et s'arrêtait sur son bas."""
LISSAGE_POIDS = 1                  # HYPOTHÈSE : le ruban suit le bas
