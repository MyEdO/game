"""Données de `humanoide--vetement--capuche` (le Sorcier, #3743), lues par `modele.py`.

Contrat : `base-3d/sorcier/contrat.md` (2026-11-08). Illustration directrice : ligne de `INDEX.md` du recueil
`illustrations-wfrp` « Sorcier | sorcier | `carrieres/sorcier.png` | Livre de Base | 94 | certaine » (hors dépôt).
Ce qu'elle montre : un capuchon pointu bleu-vert rabattu sur la tête, la pointe dressée puis rejetée en arrière ; le
visage dégagé, le bord du capuchon bas sur le front ; une écharpe du même tissu enroulée autour du cou, sous la barbe,
dont un pan est rejeté sur l'épaule gauche. Le dos ne se voit pas (hypothèse du contrat : la capuche tombe en pointe
sur la nuque, le pan pend sur l'épaule gauche devant et derrière).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Toute position se donne depuis un os de la base (tête de l'os), jamais en coordonnées absolues. Chaque cote dit d'où
elle vient : `illustration` (lue sur l'image, proportionnée à la hauteur de tête de la base), `adaptation` (valeur
d'adaptation du lot, doctrine #1993) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'capuche'},
    'liaison': {'mode': 'squelette'},
    'couche': 'manteau',
    'couvre': ['tete', 'cou'],
}
# contrat : `SLOTS` n'offre que vet1 et vet2, pris par la robe ; gris de construction, sans couleur cuite
MATERIAUX = {'capuche': ('accent', ((0.6, 0.6, 0.6), 0.0, 0.87))}

# Ce que la capuche contourne : la tête publiée et la coiffure du preset `sorcier` (contrat), leurs matières visibles.
CONTOURNE = {'tete': 'humanoide--tete--humain', 'coiffure': 'humanoide--pilosite--barbe-courte', 'robe': 'humanoide--vetement--robe'}
MATIERES_DE_LA_TETE = ['peau', 'cheveux']
MATIERES_DE_LA_COIFFURE = ['poil']
MATIERES_DE_LA_ROBE = ['robe']          # le pan repose sur la robe : il en emprunte les poids et les clés, celles des
ZONES_DE_LA_ROBE = ['torse', 'bras_haut_g', 'bras_haut_d']  # meshes de la robe sous lui
BUDGET_TRIANGLES = 2500                 # procédure, section 7 : vêtement par pièce
EPAISSEUR = 0.004                       # adaptation : drap de laine, double nappe

# ---------------------------------------------------------------- capuchon
# Tout jeu est celui de la nappe intérieure (l'extérieure est `EPAISSEUR` au-delà).
# Rayons visés du dehors vers un centre de la tête ; colonnes en azimut `phi` (0 devant, positif vers la gauche +x),
# rangs en élévation, éventail au sommet. Chaque rayon s'arrête sur la plus extérieure des surfaces contournées.
CAPUCHON = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.007, 0.090),     # adaptation : milieu de la boîte de la peau de la tête, depuis la tête de `Head`
    'colonnes': 24,
    'rangs': 11,
    'elevation_bas': -40.0,             # adaptation : le bas descend sous la mâchoire et dans l'écharpe ; plus bas, les visées entrent dans le cou
    'elevation_haut': 84.0,
    # jeu à la surface contournée selon |phi| (degrés, m) : serré sur les joues, ample derrière (illustration : le tissu
    # tombe loin du crâne derrière et au-dessus).
    'jeu': [(0.0, 0.014), (70.0, 0.020), (120.0, 0.022), (180.0, 0.024)],
    'jeu_min': 0.010,                   # adaptation : sous lui, aucun point de la nappe intérieure
    'portee': 0.30,                     # adaptation : le capuchon ne contourne que la tête, la coiffure et le cou
    'passes_de_lissage': 3,
    # Ouverture du visage : |phi| < demi-ouverture sous l'élévation du milieu, puis arrondie en ellipse jusqu'au bord
    # haut, bas sur le front (illustration : le bord ombre les sourcils).
    'demi_ouverture': 64.0,             # illustration : le bord passe devant l'oreille, sur les favoris
    'elevation_milieu': 2.0,
    'elevation_bord_haut': 34.0,        # illustration : bord au-dessus des sourcils
    # Pointe : depuis la tête de `Head`, dressée au-dessus du crâne et rejetée en arrière.
    'pointe': (0.0, 0.165, 0.290),      # illustration : ~0,3 hauteur de tête au-dessus du crâne, rejetée derrière l'aplomb
    'pointe_ouverture': 48.0,           # adaptation : angle (degrés) autour de la pointe où la nappe s'y élève
    'pointe_exposant': 1.3,             # adaptation : 1 cône droit, plus grand creuse les flancs
}

# ---------------------------------------------------------------- écharpe autour du cou
# Le bas suit la couture des zones `cou` et `torse` de la base (le cou est couvert, rien ne s'y voit) ; au-dessus, des
# anneaux horizontaux, l'avant abaissé sous la barbe, l'arrière monté sur le bas du capuchon (illustration : l'écharpe
# est roulée serrée sous la barbe, le capuchon y entre).
ECHARPE = {
    'segments': 20,
    'couture_tolerance': 1e-4,          # m : un sommet du cou à moins de cette distance du torse est sur la couture
    'bas': (0.012, 0.016),              # adaptation : (au-dessus du torse, au-delà de la couture) en m, par-dessus un col de tenue
    # Le bas passe par-dessus le col de la robe qu'il touche (portée au-delà du rayon du bas, jeu de la nappe intérieure à
    # la robe) : le col, arrêté au bas du cou à 26 mm d'aisance (`vetement--robe/donnees.py`), entre sinon entre le bas
    # et l'anneau suivant, dans le dos.
    'col': (0.040, 0.010),              # adaptation
    'os_hauteur': 'neck_01',
    # (hauteur depuis la tête de `neck_01`, abaissement devant, aisance) en m, du bas au haut. L'avant du dernier anneau
    # reste sous la barbe (son bas est 0,045 m au-dessus de la tête de `neck_01`, sonde de la coiffure publiée).
    'anneaux': [(0.050, 0.035, 0.036), (0.080, 0.055, 0.036), (0.112, 0.074, 0.012)],
    # part de `Head` dans les poids de chaque anneau (le bas compris), devant (pondérée par le cosinus de l'azimut) :
    # sous le menton, l'écharpe suit la barbe qui la pousse.
    'part_de_la_tete': [0.0, 0.12, 0.26, 0.40],   # adaptation
    'ecart_min': 0.014,                 # adaptation : écart vertical minimal entre deux anneaux (devant, sous la barbe)
    'plis': 3,                          # adaptation : lobes de l'aisance autour du cou (illustration : drapé)
    'ampleur_des_plis': 0.010,
    'phase_des_plis': 1.3,              # adaptation : radians de décalage des lobes d'un anneau au suivant
    'jeu_min': 0.008,                   # adaptation : à la plus extérieure des surfaces contournées (capuchon compris)
    'portee': 0.16,                     # adaptation : au-delà, la visée sortirait du cou vers l'épaule
}

# ---------------------------------------------------------------- pan sur l'épaule gauche
# Une bande qui passe sur l'épaule gauche, entre le cou et l'acromion, et pend devant et derrière ; chaque station
# vise, dans le plan sagittal de sa colonne, l'enveloppe convexe de la coupe du torse depuis un axe à l'épaule.
PAN = {
    'os_epaule': 'clavicle_l',
    'colonnes_x': (0.070, 0.095, 0.120),  # adaptation : x des colonnes depuis la tête de `clavicle_l` (pan de ~0,05 m, entre le
                                          # cou et l'acromion : au-delà, l'épaule de la robe passe sous son bord quand la carrure s'élargit)
    'axe': (0.0, 0.050, -0.210),          # adaptation : axe des visées depuis la tête de `clavicle_l` (y, z ; x ignoré)
    'angle_devant': -12.0,                # illustration : le pan descend sur la poitrine jusqu'au-dessus de la ceinture
    'angle_derriere': 196.0,              # HYPOTHÈSE (dos non montré) : derrière, il descend sous l'omoplate
    'stations': 14,
    'jeu': 0.034,                         # adaptation : par-dessus la robe et son col (#3743)
    'jeu_min': 0.032,                     # adaptation : distance vraie de la nappe intérieure au corps, au-dessus de l'aisance
                                          # de la robe (col à 26 mm, `vetement--robe/donnees.py`) et de son épaisseur
    'portee': 0.40,
    'passes_de_lissage': 2,
}

# Zones de la base dont chaque nappe emprunte les poids ; le capuchon emprunte ceux de la peau de la tête publiée, qu'il
# couvre (la peau y porte un peu de `neck_01` : le capuchon la suit telle quelle), le pan ceux de la robe.
PORTEUSES = {'echarpe': ['cou', 'torse']}
# Os dont une nappe reporte le poids emprunté sur un autre : l'écharpe s'enroule autour du cou, elle ne suit pas la tête
# (sous le menton, la peau du cou porte `Head`) ; son poids va au cou.
OS_REPORTES = {'echarpe': {'Head': 'neck_01'}}
ZONES_DES_CLES = ['tete', 'visage', 'cou', 'torse', 'bras_haut_g', 'bras_haut_d']
LISSAGE_POIDS = {'capuchon': 1, 'echarpe': 12, 'pan': 0}   # adaptation : passes laplaciennes des poids par nappe ; le pan
                                                           # garde ceux de la robe qu'il couvre, tels quels
MARGE_DE_SUIVI = 0.9                    # adaptation : part du jeu tenue sous la garde `suiviDuCorps`
PAS_DE_VISEE = 0.002                    # adaptation : pas (m) de la visée du dehors vers le centre
