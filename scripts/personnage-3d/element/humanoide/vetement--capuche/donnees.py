"""Données de `humanoide--vetement--capuche` (le Sorcier, #4351, contrat du 2026-11-16), lues par `modele.py` : la pièce
`capuche` de la garde-robe.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Ce qu'elle montre (signe identitaire 1 du contrat) : un capuchon ample de drap bleu-gris
tirant sur le vert, rond et souple, loin du crâne au-dessus et derrière, dont le bord avant dépasse le front et
l'ombre, et dont le drap en trop retombe dans le dos ; au bord, l'envers plus clair, ocre-olive, se voit ; une
écharpe du même drap, large, en trois gros plis concentriques, couvre le cou, les épaules jusqu'à leur pointe et le haut
de la poitrine ; le bas du capuchon y entre, la barbe passe sous elle et ressort dessous ; un pan en tombe sur l'avant
gauche du personnage (contrat). Le dos ne se voit pas : HYPOTHÈSE du contrat, le capuchon est cousu à l'écharpe, qui
fait le tour et couvre le haut du dos. Échelle relevée : ~570 px/m (contrat).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut se compte en degrés autour d'une verticale, 0 devant, positif vers la gauche ; une élévation, en degrés
depuis l'horizontale d'un centre ; un angle polaire, en degrés depuis la verticale montante d'un centre. Tout jeu est
celui de la nappe intérieure (l'extérieure est `EPAISSEUR` au-delà). Chaque cote dit d'où elle vient : `illustration`,
`base` (sonde de construction sur la base ou un élément publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'capuche'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': [],
}
"""`couvre` vide : le capuchon, ample et ouvert, laisse voir les tempes, les oreilles et le dessous du menton de face et
de trois quarts ; il ne cache aucune zone sous tout angle (procédure, section 2)."""
MATERIAUX = {'capuche': ('accent', 'laine'), 'doublure': ('vet2', 'toile-ecrue')}
"""Illustration : drap bleu-gris (`accent`) ; l'envers du capuchon, ocre-olive clair, proche de la robe de dessous
(`vet2`, HYPOTHÈSE : aucun emplacement de palette n'est propre à une doublure)."""

CONTOURNE = {'tete': 'humanoide--tete--humain', 'coiffure': 'humanoide--pilosite--barbe-courte',
             'robe': 'humanoide--vetement--robe'}
"""La tête publiée et la coiffure du preset `sorcier`, que le capuchon enveloppe et par-dessus la barbe de laquelle passe
l'écharpe ; la robe du Sorcier, sur les épaules et la poitrine de laquelle l'écharpe repose : elle en emprunte les poids
(procédure, section 3)."""
MATIERES = {'tete': ['peau'], 'coiffure': ['poil'], 'robe': ['robe', 'galon', 'dessous']}
ZONES_DU_CORPS = ['cou', 'torse']       # zones de la base que l'écharpe contourne avec la robe
ZONES_DES_CLES = ['tete', 'visage', 'cou', 'torse', 'bras_haut_g', 'bras_haut_d']
"""Zones de la base dont la pièce prend ses clés, au plus près. Repris par liaison de surface de la tête seule, le
capuchon s'écartait du corps voisin sous `gabarit_head_plus` de plus que son jeu (`suiviDuCorps/cle-non-suivie`, jusqu'à
66 mm pour 52) ; reprise des meshes de la robe, l'écharpe ne suivait pas le corps qui bouge sous elle sous la même clé
(`suiviDuCorps/cle-inerte`, 26 à 34 mm pour 35, quatre partages essayés) : elle tient à 22 mm de la robe, au-delà de
l'écart de deux couches liées au même corps."""

BORNES_DES_CLES = (0.3, 3.3)
"""Rapport de longueur d'arête sous une clé transférée hors duquel elle est lissée (`Base.transferer`), en deçà de la
porte d'étirement de l'évaluateur ([0,25 ; 4]). Sous `gabarit_head_plus`, le devant de l'écharpe est lié au menton, qui
descend de 7 cm (`suiviDuCorps` : D = 70,8 mm) ; aux bornes par défaut (0,4 ; 2,5), le lissage ne lui laissait que 34 mm,
sous la moitié exigée (`cle-inerte`), et écartait la nuque du capuchon du corps de plus que son jeu (`cle-non-suivie`)."""

BUDGET_TRIANGLES = 2500                 # procédure du skill, section 7 : vêtement par pièce
EPAISSEUR = 0.004                       # HYPOTHÈSE : drap de laine, double nappe
PORTEE = 0.40                           # m : départ des marches, au-delà de toute surface contournée
PAS = 0.002                             # m : pas des marches du dehors vers un centre

# ---------------------------------------------------------------- capuchon
CAPUCHON = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0074, 0.1007),   # base : (0 ; 0,010 ; 1,710) au repos, le centre du crâne, à la hauteur des yeux
    'colonnes': 20,                     # HYPOTHÈSE de maillage : intervalles d'un bord de l'ouverture à l'autre
    # élévations des rangs, du bas au dernier avant le sommet. Bas : sous la mâchoire (base : coin de la mâchoire à
    # z ~1,61), dans l'écharpe
    'elevations': (-38.0, -25.5, -13.0, -0.5, 12.0, 24.5, 37.0, 49.5, 62.0, 74.5),
    # Demi-axes (m) de l'ellipsoïde du capuchon autour du centre : la forme du drap, loin du crâne (illustration :
    # un volume, plus large que la tête, profond derrière, dont le bord avance devant le front). Base : la tête a
    # 0,091 de demi-largeur, 0,096 derrière le centre, 0,110 au-dessus, le front à 0,100 devant. `bas` : le capuchon se
    # resserre vers le cou ; à 0,120, sa nuque, à 6 cm du corps, ne le suivait plus sous `gabarit_head_plus`
    # (`suiviDuCorps/cle-non-suivie`, 63 mm pour 59)
    'forme': {'cote': 0.122, 'devant': 0.150, 'derriere': 0.155, 'haut': 0.140, 'bas': 0.090},
    'jeu': 0.012,                       # HYPOTHÈSE : m, au plus près de la tête et de la coiffure, là où la forme les frôle
    # Ouverture du visage : demi-ouverture en azimut jusqu'à l'élévation `milieu`, puis refermée en ellipse jusqu'au
    # bord haut. Illustration : le bord passe devant l'oreille, à la joue, et se ferme au-dessus du front, qu'il ombre
    # (base : sourcils à z ~1,74, soit 17° ; bord haut à 37°, z ~1,79, 2,4 cm devant le front)
    'ouverture': {'demi': 58.0, 'milieu': -0.5, 'haut': 37.0},
    # Retombée, derrière la tête : ce que la forme gagne en rayon par élévation de rang (degrés, m), entier au-delà du
    # second azimut (depuis l'avant), nul en deçà du premier. Illustration : le capuchon est rond et souple, son drap en
    # trop retombe vers le dos ; HYPOTHÈSE (dos non montré) : une poche qui pend sur la nuque jusqu'au haut de l'écharpe
    # (z ~1,59, y ~0,17). Elle s'arrête à plus de 3 cm du col de la cape : plus longue (jusqu'à z 1,50), elle le
    # couvrait, la pile des couches lui donnait ses poids, ceux de la tête (`hotes/godot/asset/pile.ts`), et la cape
    # s'étirait et laissait passer la robe, le cou et la bandoulière (`etirement` 89, `couche-traversee` 73, passe neutre)
    'retombee': {'azimuts': (100.0, 170.0), 'surplus': [(-38.0, 0.090), (-25.5, 0.060), (-13.0, 0.020), (-0.5, 0.0)]},
    'lissage_des_poids': 3,             # HYPOTHÈSE : passes laplaciennes des poids empruntés à la peau de la tête
}

# ---------------------------------------------------------------- écharpe
ECHARPE = {
    'os_du_centre': 'neck_01',
    # base : (0 ; 0,021 ; 1,400), sur l'axe du cou, dans le torse à la hauteur du sternum : de plus haut (1,50), les
    # rayons vers la pointe de l'épaule rasent la robe et la marche part contre elle
    'centre': (0.0, -0.020, -0.130),
    'colonnes': 24,                     # HYPOTHÈSE de maillage : intervalles en azimut
    'rangs': 12,                        # HYPOTHÈSE de maillage : intervalles du haut au bord, quatre par pli
    # (azimut, m au-dessus du centre) du haut, un anneau marché à l'horizontale depuis `portee_du_haut` : devant, sous
    # la barbe du menton (base : menton à z 1,584) ; sur les côtés, autour du bas du capuchon (z 1,636), qu'il enveloppe
    # (illustration) ; derrière, plus haut sur la nuque, sous la retombée (à 0,240, la peau de la nuque se voyait entre
    # le capuchon et l'écharpe, rendu de dos trois quarts)
    'haut': [(0.0, 0.175), (40.0, 0.190), (90.0, 0.240), (120.0, 0.270), (180.0, 0.270)],
    'portee_du_haut': 0.17,             # base : en deçà des épaules
    'sous_la_retombee': 105.0,          # azimut au-delà duquel le haut passe sous la retombée du capuchon, autour du cou
    'passes_du_haut': 2,                # passes qui étalent le rayon du haut d'une colonne à l'autre, sans le réduire : à
                                        # ce passage, il saute de 3 cm et un triangle s'y retournait (`enroulement`)
    # (azimut, angle polaire) du bord : devant, sur le haut de la poitrine (illustration : ~55 px sous le menton,
    # z ~1,49) ; sur les côtés, à la pointe de l'épaule (`x_max`) ; derrière (HYPOTHÈSE), sur le haut du dos
    'bord': [(0.0, 66.0), (40.0, 62.0), (60.0, 48.0), (90.0, 41.0), (120.0, 41.0), (145.0, 58.0), (180.0, 66.0)],
    'x_max': 0.20,                      # base : en dedans des têtes de `upperarm_*` (x ±0,212) ; au-delà, le bras et la manche
    # HYPOTHÈSE : m, à la robe, à la barbe et au capuchon ; la cape du Sorcier (`vetement--cape-en-lambeaux`, col à
    # 10 mm de la robe, 4 mm d'épaisseur) et la sangle d'une bandoulière passent dessous
    'jeu': 0.022,
    'plis': 3,                          # contrat : trois gros plis
    'ampleur': 0.026,                   # illustration : m, des bourrelets épais ; nuls au haut et au bord (à 18 mm,
                                        # les trois plis ne se lisaient pas au rendu de face)
    'inegalite': 0.25,                  # HYPOTHÈSE : part de l'ampleur qui varie autour du cou (le drapé n'est pas tourné)
    'bords': {'profondeur': 3.0, 'creux': 0.3, 'graine': 'humanoide--vetement--capuche'},   # degrés : bord flottant
    'os_reportes': {'Head': 'neck_01', 'upperarm_l': 'clavicle_l', 'upperarm_r': 'clavicle_r'},
    'lissage_des_poids': 8,
}
"""`os_reportes` et `lissage_des_poids` : l'écharpe s'enroule autour du cou et repose sur l'épaule, elle ne suit ni la
tête ni le bras, comme `vetement--foulard` (mêmes valeurs, mêmes causes mesurées)."""

# ---------------------------------------------------------------- pan
PAN = {
    'azimuts': (22.0, 33.0, 44.0),      # contrat : à l'avant gauche du personnage ; HYPOTHÈSE : ~7 cm de large
    'recouvrement': 8.0,                # degrés d'angle polaire sous l'écharpe, au-dessus de son bord
    # angle polaire du bas (z ~1,40 sur la poitrine). HYPOTHÈSE : au-dessus de la bandoulière et de ses rouleaux,
    # qui croisent la poitrine gauche plus bas (illustration) : plus long, le pan couvrirait leurs cases
    'bas': 92.0,
    'rangs': 6,
    'jeu': 0.012,                       # HYPOTHÈSE : m, à la robe, sous l'écharpe
    'bords': {'profondeur': 4.0, 'creux': 0.4, 'graine': 'humanoide--vetement--capuche-pan'},   # degrés
}
