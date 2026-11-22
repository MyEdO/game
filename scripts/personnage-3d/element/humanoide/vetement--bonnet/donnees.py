"""Données de `humanoide--vetement--bonnet` (l'Apothicaire, #4261), lues par `modele.py` : la pièce `bonnet` de la
garde-robe.

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Ce qu'elle montre : une coiffe de cuir fauve ajustée, une
calotte serrée sur le crâne, le front dégagé jusqu'à mi-front, des oreillettes qui descendent sur les oreilles jusqu'à
la mâchoire, une couture qui court au milieu du crâne de l'avant à l'arrière ; les nattes sortent dessous, aux tempes,
devant les oreillettes. Omis (#4261) : le rouleau et la plume glissés dessus, les lacets. Le dos ne se voit pas
(HYPOTHÈSE : la calotte descend sur la nuque, au bas de l'occiput). Échelle relevée : environ 640 px/m (la tête, du
menton, y ~225 px, au sommet de la coiffe, y ~75 px, pour les 0,235 m de la tête publiée).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Toute position se donne depuis un os de la base (tête de l'os). Un azimut `phi` se compte en degrés autour de la
verticale du centre, 0 devant, positif vers la gauche (+x) ; une élévation `e`, en degrés depuis l'horizontale du
centre. Chaque cote dit d'où elle vient : `illustration`, `tête` (relevée sur la tête publiée `humanoide--tete--humain`),
`adaptation` (valeur d'adaptation du lot, doctrine #1993) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bonnet'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': [],
}
MATERIAUX = {'bonnet': ('cuir', 'cuir-tanne')}   # gris de construction, sans couleur cuite

BUDGET_TRIANGLES = 2500                 # procédure, section 7 : vêtement par pièce
EPAISSEUR = 0.003                       # HYPOTHÈSE : cuir souple, double nappe

# Ce que la coiffe contourne : la tête publiée et la coiffure du preset `apothicaire`, leurs matières visibles.
CONTOURNE = {'tete': 'humanoide--tete--humain', 'coiffure': 'humanoide--pilosite--cheveux-nattes'}
MATIERES_DE_LA_TETE = ['peau']
MATIERES_DE_LA_COIFFURE = ['poil']
ZONES_DES_CLES = ['tete', 'visage', 'nez', 'cou']
"""Zones de la base dont la coiffe prend ses clés, au plus près de chaque sommet."""
BORNES_DES_CLES = (0.05, 20.0)
"""Bornes des rapports d'arête sous une clé transférée au-delà desquelles `Base.transferer` lisse la clé (adaptation). Aux
bornes du kit, (0,4 ; 2,5), des arêtes de la coiffe sortaient des bornes sous `gabarit_head_plus`, et le lissage portait
le déplacement du crâne jusqu'au bas des oreillettes et au bord du front : ils s'écartaient de 68 à 73 mm du corps
(`suiviDuCorps/cle-non-suivie`) ; une arête retournée reste lissée."""

# Rayons visés du dehors vers un centre de la tête ; colonnes en azimut (une colonne tombe sur le bord avant des
# oreillettes et sur la couture), rangs en élévation, éventail au sommet. Chaque rayon s'arrête sur la plus extérieure des
# surfaces contournées, au jeu près ; l'ouverture du visage et le dessous des oreillettes sont retirés.
COIFFE = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0074, 0.1007),   # tête : (0 ; 0,010 ; 1,710) au repos, milieu de la boîte du crâne au-dessus de l'oreille
    'colonnes': 40,                     # adaptation : 9° ; une ligne de colonne à ±72° (bord des oreillettes), à 0 et 180° (couture)
    'rangs': 19,                        # adaptation : 8° d'élévation par rang
    'elevation_bas': -60.0,
    'elevation_haut': 84.0,
    'portee': 0.25,                     # m : départ des visées, au-delà de toute surface de la tête
    'pas': 0.0015,                      # m : pas de la visée du dehors vers le centre
    # jeu de la nappe intérieure à la surface contournée selon |phi| (degrés, m) : serrée sur le crâne, un peu plus
    # ample sur les oreillettes, qui couvrent l'oreille (illustration)
    'jeu': [(0.0, 0.004), (60.0, 0.004), (90.0, 0.006), (180.0, 0.005)],
    'passes_de_lissage': 2,
    # Bord (|phi|, e) : une cellule est gardée si son élévation au milieu est au-dessus du bord à son azimut au milieu.
    # Devant, le front dégagé jusqu'à mi-front (illustration ; tête : sourcils à e ~0°, haut du front à e ~40°) ; à la
    # tempe, le bord descend vers l'oreillette ; à ±72°, le bord avant des oreillettes, vertical, devant l'oreille (tête :
    # l'avant de l'oreille est à phi ~81°), derrière les nattes (à ±60°, `pilosite--cheveux-nattes/donnees.py`) ;
    # l'oreillette descend jusqu'à la mâchoire (illustration : tête, angle de la mâchoire à z ~1,61, e ~-58° ; à -44°,
    # elle s'arrêtait au lobe de l'oreille ; à -58°, son bas, plus près du cou que de la tête, ne suivait pas le cou sous
    # `gabarit_head_plus`, 72 mm, `suiviDuCorps/cle-non-suivie`) ; derrière, la calotte descend sur la nuque (HYPOTHÈSE).
    'bord': [(0.0, 28.0), (30.0, 25.0), (50.0, 16.0), (71.9, 8.0), (72.1, -42.0), (90.0, -50.0), (110.0, -48.0),
             (125.0, -34.0), (180.0, -26.0)],
    'couture': 0.004,                   # HYPOTHÈSE : m, relief de la couture centrale au-dessus du cuir
}
