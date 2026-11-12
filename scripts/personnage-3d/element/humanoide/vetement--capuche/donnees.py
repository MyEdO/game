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
CONTOURNE = {'tete': 'humanoide--tete--humain', 'coiffure': 'humanoide--pilosite--barbe-courte', 'robe': 'humanoide--vetement--robe',
             'cape': 'humanoide--vetement--cape', 'bandouliere': 'humanoide--accessoire--bandouliere-a-parchemins'}
MATIERES_DE_LA_TETE = ['peau', 'cheveux']
MATIERES_DE_LA_COIFFURE = ['poil']
# Le pan, le bas de l'écharpe et l'anneau suivant posés sur la robe (`ECHARPE['bas_sur_la_robe']`) en empruntent les
# poids et les clés, celles des meshes de la robe sous eux. Lié au corps, le bas de l'écharpe divergeait du col qu'il
# recouvre sous silhouette (la robe passait devant lui, 8 mm sous `feminin` en Hampe_Repos_Loop et Walk_Loop, garde
# `traversee`).
MATIERES_DE_LA_ROBE = ['robe']
ZONES_DE_LA_ROBE = {'pan': ['torse', 'bras_haut_g', 'bras_haut_d'], 'echarpe': ['torse', 'cou']}
# Consigne utilisateur (Clément, 2026-11-09, via l'orchestrateur : « J ai l'impression que c'est une cape avec capuche
# non ? ») : la cape du preset naît sous la capuche. Le bas de l'écharpe et le pan contournent aussi la cape publiée et
# empruntent, au plus proche de la robe ou d'elle, poids et clés : contournant le seul torse, le pan descendait sous la
# cape à l'omoplate gauche, et le col de la cape passait devant le bas de l'écharpe à la nuque (rendu de dos, Hampe_Repos_Loop
# image 20).
MATIERES_DE_LA_CAPE = ['cape']
ZONES_DE_LA_CAPE = ['torse']
# La sangle de la bandoulière publiée passe sous l'écharpe, à l'épaule droite et au pied du cou : chaque sommet de
# l'écharpe à moins de `ECHARPE['pose_sur_la_sangle']` d'elle en emprunte, sans part de `Head`, poids et clés. Liée au corps, l'écharpe y portait jusqu'à 0,22 de `Head` au-dessus d'une sangle à 0,87 de `clavicle_r` : la
# sangle passait devant elle quand la tête tourne (36 mm en Sword_Dash sous `carrure_plus`, 33 mm en Death01 sous
# `corpulence`).
MATIERES_DE_LA_BANDOULIERE = ['sangle']
ZONES_DE_LA_BANDOULIERE = ['torse']
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
    # Le bas passe par-dessus le col de la robe ou de la cape qu'il touche (portée de la visée, écart au-delà du rayon du
    # bas sous lequel le vêtement est un col, jeu de la nappe intérieure au col) : le col de la robe, arrêté au bas du cou à
    # 26 mm d'aisance (`vetement--robe/donnees.py`), entre sinon entre le bas et l'anneau suivant, dans le dos ; plus
    # loin, le vêtement est l'épaule ou la manche.
    'col': (0.30, 0.090, 0.010),        # adaptation
    'passes_du_col': 2,                 # adaptation : passes qui étalent le long du bas l'écart pris sur le col (au saut d'un
                                        # sommet écarté à son voisin qui ne l'est pas, l'arête vers l'anneau 1 s'étire)
    'pose_sur_la_sangle': 0.03,         # adaptation : la portée de couverture de la garde `traversee` (`PORTEE_DE_COUVERTURE_M`,
                                        # `hotes/godot/asset/evaluateur/gardes/traversee.ts`)
    'bas_sur_la_robe': 45.0,            # adaptation : azimut (degrés depuis l'avant) au-delà duquel le bas et l'anneau suivant,
                                        # posés sur le col et l'empiècement de la robe, en prennent les poids et les clés : à
                                        # 60°, la robe passait devant eux sous `carrure_plus` (5,3 mm en Hit_Knockback) et, le
                                        # bas seul, au-dessus de l'épaule droite (13 mm en Death01, OverhandThrow) ; devant,
                                        # aux poids du cou, l'arête qui joint le bas à l'anneau suivant s'étire moins (×3,30
                                        # contre ×3,61 aux poids de la robe, capuche-visage en Sword_Regular_A)
    'passes_du_bas': 2,                 # adaptation : passes qui lissent la hauteur du bas dans le dos (pondérées par le cosinus
                                        # de l'azimut vers l'arrière) : posée sur le torse depuis la couture en dents de scie puis
                                        # écartée sur le col, elle y monte et descend d'un sommet à l'autre (jusqu'à 27 mm), et
                                        # l'ourlet fait des dents ; devant, la lisser raccourcit l'arête vers l'anneau 1, qui
                                        # s'étire au-delà de la porte
    'os_hauteur': 'neck_01',
    # (hauteur depuis la tête de `neck_01`, abaissement devant, aisance) en m, du bas au haut. L'avant du dernier anneau
    # reste sous la barbe (son bas est 0,045 m au-dessus de la tête de `neck_01`, sonde de la coiffure publiée).
    'anneaux': [(0.050, 0.035, 0.036), (0.080, 0.055, 0.036), (0.112, 0.074, 0.012)],
    # part de `Head` dans les poids de chaque anneau (le bas compris), devant (pondérée par le cosinus de l'azimut) :
    # sous le menton, l'écharpe suit la barbe qui la pousse.
    'part_de_la_tete': [0.0, 0.06, 0.26, 0.40],   # adaptation ; au-dessus de 0,06 à l'anneau 1, l'arête qui le joint au bas
                                                  # posé sur le col s'étire au-delà de la porte (×3,54 à 0,08, Zombie_Scratch)
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
    'colonnes_x': (0.062, 0.083, 0.104),  # adaptation : x des colonnes depuis la tête de `clavicle_l` (pan de ~0,04 m, entre le
                                          # cou et l'acromion : au-delà, le haut de la manche de la robe passe sous son bord quand
                                          # la carrure s'élargit, 12 mm à 0,120 sous `carrure_plus` en Death01)
    'axe': (0.0, 0.050, -0.210),          # adaptation : axe des visées depuis la tête de `clavicle_l` (y, z ; x ignoré)
    'angle_devant': -12.0,                # illustration : le pan descend sur la poitrine jusqu'au-dessus de la ceinture
    'angle_derriere': 196.0,              # HYPOTHÈSE (dos non montré) : derrière, il descend sous l'omoplate
    'stations': 14,
    'jeu': 0.038,                         # adaptation : par-dessus la robe et son col (#3743) ; à 0,034, le haut de la manche
                                          # de la robe passe devant le pan sous `carrure_plus` (Push_Loop, Interact)
    'jeu_min': 0.036,                     # adaptation : distance vraie de la nappe intérieure au corps, au-dessus de l'aisance
                                          # de la robe (col à 26 mm, `vetement--robe/donnees.py`) et de son épaisseur
    'jeu_sur_la_cape': 0.008,             # HYPOTHÈSE : distance vraie de la nappe intérieure à la cape publiée, celle du
                                          # bas de l'écharpe au-dessus du col (`ECHARPE['jeu_min']`)
    'portee': 0.40,
    'passes_de_lissage': 2,
}

# Zones de la base dont chaque nappe emprunte les poids ; le capuchon emprunte ceux de la peau de la tête publiée, qu'il
# couvre (la peau y porte un peu de `neck_01` : le capuchon la suit telle quelle), le pan et le bas de l'écharpe ceux de la robe.
PORTEUSES = {'echarpe': ['cou', 'torse']}
# Os dont une nappe reporte le poids emprunté sur un autre : l'écharpe s'enroule autour du cou, elle ne suit pas la tête
# (sous le menton, la peau du cou porte `Head`) ; son poids va au cou.
OS_REPORTES = {'echarpe': {'Head': 'neck_01'}}
ZONES_DES_CLES = ['tete', 'visage', 'cou', 'torse', 'bras_haut_g', 'bras_haut_d']
# Le capuchon prend ses clés de la tête seule : lié aussi au cou, qui monte sous `carrure_plus` quand la tête publiée ne
# bouge pas, son bas près de l'oreille se replie (Shield_Dash).
ZONES_DES_CLES_DU_CAPUCHON = ['tete', 'visage']
LISSAGE_POIDS = {'capuchon': 3, 'echarpe': 12, 'pan': 0}   # adaptation : passes laplaciennes des poids par nappe ; le pan
                                                           # garde ceux de la robe qu'il couvre, tels quels ; à une passe, le
                                                           # bas du capuchon derrière l'oreille se replie quand le cou plie
                                                           # (Shield_Dash), et la tête passe devant
MARGE_DE_SUIVI = 0.9                    # adaptation : part du jeu tenue sous la garde `suiviDuCorps`
PAS_DE_VISEE = 0.002                    # adaptation : pas (m) de la visée du dehors vers le centre
