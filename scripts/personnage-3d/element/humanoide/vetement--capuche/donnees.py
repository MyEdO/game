"""Données de `humanoide--vetement--capuche` (le Sorcier, #4351, contrat du 2026-11-16), lues par `modele.py` : la pièce
`capuche` de la garde-robe.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Ce qu'elle montre (signe identitaire 1 du contrat) : un capuchon ample de drap bleu-gris
tirant sur le vert, loin du crâne au-dessus et derrière, dont le bord avant dépasse le front et l'ombre ; sa pointe
monte en arrière du crâne puis casse et retombe vers l'arrière ; au bord, l'envers plus clair, ocre-olive, se voit ; une
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

CONTOURNE = {'tete': 'humanoide--tete--humain', 'coiffure': 'humanoide--pilosite--barbe-longue',
             'robe': 'humanoide--vetement--robe'}
"""La tête publiée et la coiffure du Sorcier, que le capuchon enveloppe et par-dessus la barbe de laquelle passe
l'écharpe ; la robe du Sorcier, sur les épaules et la poitrine de laquelle l'écharpe repose : elle en emprunte les poids
et les clés (procédure, section 3)."""
MATIERES = {'tete': ['peau'], 'coiffure': ['poil'], 'robe': ['robe', 'galon', 'dessous']}
ZONES_DE_LA_ROBE = ['cou', 'torse', 'bras_haut_g', 'bras_haut_d']   # zones des meshes de la robe sous l'écharpe
ZONES_DU_CORPS = ['cou', 'torse']       # zones de la base que l'écharpe contourne avec la robe
ZONES_DES_CLES = ['tete', 'visage', 'cou', 'torse']
ZONES_DES_CLES_DU_CAPUCHON = ['tete', 'visage']
"""Le capuchon prend ses clés de la tête seule (procédure, section 3 : lié aussi au cou, qui monte sous `carrure_plus`
quand la tête ne bouge pas, son bas se replie)."""

BUDGET_TRIANGLES = 2500                 # procédure du skill, section 7 : vêtement par pièce
EPAISSEUR = 0.004                       # HYPOTHÈSE : drap de laine, double nappe
PORTEE = 0.40                           # m : départ des marches, au-delà de toute surface contournée
PAS = 0.002                             # m : pas des marches du dehors vers un centre

# ---------------------------------------------------------------- capuchon
CAPUCHON = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0074, 0.1007),   # base : (0 ; 0,010 ; 1,710) au repos, le centre du crâne, à la hauteur des yeux
    'colonnes': 20,                     # HYPOTHÈSE de maillage : intervalles d'un bord de l'ouverture à l'autre
    # élévations des rangs, du bas au dernier avant la pointe. Bas : sous la mâchoire (base : coin de la mâchoire à
    # z ~1,61), dans l'écharpe
    'elevations': (-38.0, -25.5, -13.0, -0.5, 12.0, 24.5, 37.0, 49.5, 62.0),
    # Demi-axes (m) de l'ellipsoïde du capuchon autour du centre : la forme du drap, loin du crâne (illustration :
    # un volume, plus large que la tête, profond derrière, dont le bord avance devant le front). Base : la tête a
    # 0,091 de demi-largeur, 0,096 derrière le centre, 0,110 au-dessus, le front à 0,100 devant
    'forme': {'cote': 0.122, 'devant': 0.150, 'derriere': 0.155, 'haut': 0.140, 'bas': 0.120},
    'jeu': 0.012,                       # HYPOTHÈSE : m, au plus près de la tête et de la coiffure, là où la forme les frôle
    # Ouverture du visage : demi-ouverture en azimut jusqu'à l'élévation `milieu`, puis refermée en ellipse jusqu'au
    # bord haut. Illustration : le bord passe devant l'oreille, à la joue, et se ferme au-dessus du front, qu'il ombre
    # (base : sourcils à z ~1,74, soit 17° ; bord haut à 37°, z ~1,79, 2,4 cm devant le front)
    'ouverture': {'demi': 58.0, 'milieu': -0.5, 'haut': 37.0},
    # Pointe : anneaux (recul, hauteur depuis le centre, rayon, inclinaison vers l'arrière en degrés) au-dessus du
    # dernier rang, puis le bout (recul, hauteur). Illustration : la pointe monte en arrière du crâne, casse, et son
    # bout retombe derrière ; HYPOTHÈSE : 13 cm au-dessus du crâne (à 8 cm, la pointe se lisait comme un bouton, rendu de dos)
    'pointe': [(0.055, 0.170, 0.055, 25.0), (0.115, 0.215, 0.032, 55.0)],
    'bout': (0.185, 0.185),
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
    # la barbe du menton (base : menton à z 1,584) ; sur les côtés et derrière, autour du bas du capuchon (z 1,636),
    # qu'il enveloppe (illustration)
    'haut': [(0.0, 0.175), (40.0, 0.190), (90.0, 0.240), (180.0, 0.240)],
    'portee_du_haut': 0.17,             # base : en deçà des épaules
    # (azimut, angle polaire) du bord : devant, sur le haut de la poitrine (illustration : ~55 px sous le menton,
    # z ~1,49) ; sur les côtés, à la pointe de l'épaule (`x_max`) ; derrière (HYPOTHÈSE), sur le haut du dos
    'bord': [(0.0, 66.0), (40.0, 62.0), (60.0, 48.0), (90.0, 41.0), (120.0, 41.0), (145.0, 58.0), (180.0, 66.0)],
    'x_max': 0.20,                      # base : en dedans des têtes de `upperarm_*` (x ±0,212) ; au-delà, le bras et la manche
    # HYPOTHÈSE : m, à la robe, à la barbe et au capuchon ; la cape du Sorcier (`vetement--cape-en-lambeaux`, col à
    # 10 mm de la robe, 4 mm d'épaisseur) et la sangle d'une bandoulière passent dessous
    'jeu': 0.022,
    'plis': 3,                          # contrat : trois gros plis
    'ampleur': 0.018,                   # illustration : m, des bourrelets épais ; nuls au haut et au bord
    'inegalite': 0.25,                  # HYPOTHÈSE : part de l'ampleur qui varie autour du cou (le drapé n'est pas tourné)
    'bords': {'profondeur': 3.0, 'creux': 0.3, 'graine': 'humanoide--vetement--capuche'},   # degrés : bord flottant
    'haut_au_corps': 2,                 # rangs du haut dont les clés viennent du corps, au plus près ; les suivants, de la robe
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
