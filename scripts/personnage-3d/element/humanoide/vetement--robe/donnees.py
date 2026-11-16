"""Données de `humanoide--vetement--robe` (le Sorcier, #4351, contrat du 2026-11-16), lues par `modele.py`.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Elle montre une robe de dessus anthracite ouverte devant du col à l'ourlet, ses deux bords et
son ourlet bordés d'un galon clair (les signes du galon sont un motif peint : OMIS, contrat), serrée à la taille puis
tombant en plis verticaux, sur une robe de dessous sable, plissée elle aussi, qui tombe à la cheville, plus bas que
l'ourlet de la robe de dessus, court devant et long derrière ; les ourlets en dents larges et irrégulières ; de grandes
manches en cloche, molles, qui pendent sous les bras en plis, au bord déchiqueté et galonné, l'envers clair, d'où sortent
les avant-bras bandés (élément `humanoide--vetement--bandages`). Le dos ne se voit pas (HYPOTHÈSE du contrat : fermé d'un
seul pan). Liseré, pièces rapportées et usure : OMIS (contrat).

Échelle relevée : 2,0 mm par pixel (semelles à y 1095 px, sommet du crâne à y ~185 px, 15 px sous la pointe du capuchon,
pour les 1,82 m de la base).

Chaque dimension est nommée, en mètres ou en degrés, avec sa source : `illustration` (relevée sur l'image, rapportée
au corps de la base), `base` (lue sur la base, par une sonde de construction), `HYPOTHÈSE` (aucune source ne la donne :
valeur d'adaptation, doctrine #1993, à trancher en revue). Repère Blender de la base : +Z le haut, -Y l'avant, +X la
gauche du personnage. Un angle θ autour du bassin se compte depuis l'avant (-Y) vers la gauche (+X).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'robe'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'hanches', 'bras_haut_g', 'bras_haut_d', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d'],
    'chaines': ['jupe'],
}
"""`couvre` : sous l'ourlet ouvert et en dents, pieds écartés, le mollet se voit (procédure, section 2, #3743) ; la cloche
des manches laisse l'avant-bras sortir, bandé."""

MATERIAUX = {'robe': ('vet1', 'drap-terne'),       # contrat #4351 : drap anthracite
             'dessous': ('vet2', 'toile-ecrue'),   # contrat #4351 : toile sable
             'galon': ('vet2', 'laine'),           # contrat #4351 : bande écrue
             'doublure': ('vet2', 'laine')}        # contrat #4351 : doublure gris clair ; HYPOTHÈSE : `vet2`

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
COLONNES = 24                      # colonnes du corsage et de la jupe de dessus, les deux du galon comprises ; un pli et
                                   # une dent sur deux colonnes
COLONNES_OUVERTURE = 6             # intervalles de la robe de dessous dans l'ouverture, pair : un sommet sur l'axe ;
                                   # deux plis dans le devant
SEGMENTS_MANCHE = 16               # un pli et une dent du bord sur deux colonnes
EPAISSEUR = 0.003                  # HYPOTHÈSE : écart de la doublure des manches à leur endroit
DEGAGEMENT_MIN = 0.004             # HYPOTHÈSE : jeu minimal au corps, comme le pourpoint du Soldat
LISSAGE_POIDS = 2                  # passes laplaciennes des poids du corsage et du raccord des manches
BORNES_DES_CLES = (0.27, 2.5)      # rapport d'arête sous une clé transférée hors duquel `tissu` lisse la clé : sous
                                   # `gabarit_legs_moins`, le bas de la jambe de la base se tasse à ~0,28 ;
                                   # marge prise sur la porte d'étirement au repos de l'évaluateur ([0,25 ; 4])

ANGLE_VIF = 30                     # degrés : au-delà, une arête des robes reste vive (HYPOTHÈSE : plis marqués en bas)

GALON = 0.06
"""Illustration : le galon fait ~30 px de large le long des bords de l'ouverture (contrat : ~6 cm) : la première et la
dernière colonne de la robe de dessus."""

# --- Corsage : anneaux horizontaux (ancre, décalage, aisance, demi-ouverture devant en degrés, 0 = fermé), ancres
# lues sur la base : `bas` = bas de la zone `torse`, `aisselle` = bas des zones `bras_haut_*`, `cou` = bas de la zone
# `cou`. Le premier est la taille ---
CORSAGE = [('bas', 0.0, 0.012, 26.0), ('bas', 0.12, 0.014, 21.0), ('aisselle', -0.10, 0.017, 17.0),
           ('aisselle', 0.03, 0.020, 15.0), ('aisselle', 0.09, 0.022, 14.0), ('cou', -0.03, 0.026, 14.0),
           ('cou', 0.0, 0.026, 0.0), ('cou', 0.03, 0.026, 0.0)]
# Demi-ouvertures : illustration, la robe de dessus est ouverte du col à l'ourlet ; sur la poitrine, entre la
# bandoulière et l'écharpe, les deux galons montent presque parallèles, à ~8 cm l'un de l'autre, et s'écartent à la
# taille (~13 cm de robe de dessous entre eux sous la boucle, 26°). Le col, au bas du cou, reste fermé sous l'écharpe
# (HYPOTHÈSE : l'illustration le cache). Aisances : HYPOTHÈSE, robe ample, serrée à la taille sous la ceinture ; col
# dégagé de 26 mm, que le cou traverse plus serré sous `carrure_plus` (mesuré au premier Sorcier, #3743).
RECOUVREMENT_POITRINE = 20.0       # HYPOTHÈSE : sous l'ouverture du corsage, la robe de dessous court sous ses bords sur 20°
COLONNES_POITRINE = 4              # intervalles de cette bande par anneau (maillage)

# --- Jupes : rangées sous la taille, pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
EVASEMENT = 0.25
"""Hauteur sur laquelle la jupe passe de l'aisance de la taille au jeu sur le filet. Illustration : la robe, serrée par
la ceinture, s'évase sur les hanches sans ressaut ; base : à sa racine, le filet est déjà 6 cm hors des hanches, et la
jupe posée sur lui dès la taille y faisait une marche (HYPOTHÈSE : 25 cm, jusqu'au haut des cuisses)."""
OURLET_PAR_AZIMUT = [(0.0, 0.41), (50.0, 0.41), (95.0, 0.34), (140.0, 0.30), (180.0, 0.30)]
"""L'ourlet de la robe de dessus par direction, le premier celui du devant. Illustration : court devant, à mi-mollet
(y ~890 px), il descend sur le côté (pan droit à y ~950 px, 0,29 m) ; contrat : aux chevilles côté dos (HYPOTHÈSE du
dos : 0,30 m, au-dessus des creux de l'ourlet de la robe de dessous)."""
RANGEES_JUPE = [0.95, 0.85, 0.72, 0.56]
"""Hauteurs nominales des rangées de la robe de dessus, m (HYPOTHÈSE de maillage). La première à 9 cm sous la taille : à
7 cm, l'arête qui les joint devant, du tronc au filet, s'étirait à 3,58 fois sa longueur (Melee_Hook, Farm_PlantSeed,
porte 3,51)."""
GALON_DE_L_OURLET = 0.07
"""Hauteur de la bande de galon de l'ourlet au-dessus de ses pointes. Illustration : ~30 px, mordue de dents."""
LAMBEAUX_ROBE = {'profondeur': 0.04, 'creux': 0.3, 'graine': 'humanoide--vetement--robe--dessus'}
"""Illustration : le bas du galon de l'ourlet est mordu de dents de 10 à 20 px (2 à 4 cm), larges de deux colonnes
(~17 cm) ; elles restent 3 cm sous la rangée du galon."""
RANGEES_DESSOUS = [0.95, 0.85, 0.72, 0.56, 0.40]   # hauteurs des rangées de la robe de dessous, m (HYPOTHÈSE de maillage)
OURLET_DESSOUS = 0.17              # illustration : les pointes de la robe de dessous à la cheville (y ~1010 px), au-dessus
                                   # du haut des bottes publiées (z 0,165 m)
LAMBEAUX_DESSOUS = {'profondeur': 0.10, 'creux': 0.3, 'graine': 'humanoide--vetement--robe'}
"""Illustration : l'ourlet de la robe de dessous est en dents larges et irrégulières, de 20 à 40 px (4 à 8 cm) ; contrat :
dents larges, lisibles à taille de jeu (HYPOTHÈSE : jusqu'à 10 cm, larges de deux colonnes)."""
OUVERTURE_TAILLE = 26.0            # illustration : ~13 cm de robe de dessous entre les galons sous la boucle
OUVERTURE_OURLET = 40.0            # illustration : ~42 cm entre les galons à l'ourlet (x 370 à 610 px)
ECART_DESSOUS = 0.010              # HYPOTHÈSE : la robe de dessous court 10 mm sous la robe de dessus
PLIS = {'amplitude': 0.06, 'hauteur': 0.40, 'graine': 'humanoide--vetement--robe--plis'}
"""Illustration : les deux robes tombent en plis verticaux, nuls à la taille, creusés vers l'ourlet. Une colonne sur
deux rentre sous le filet de 50 à 100 % d'`amplitude`, atteinte `hauteur` sous la taille (HYPOTHÈSE : 6 cm à 40 cm,
lisibles à taille de jeu) ; les crêtes restent au jeu sur le filet : en saillie, elles passaient devant la cape, qui
tombe sur lui (`couche-traversee`, 22 cm en Sprint_Loop)."""

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan) ;
# `pan` : longueur ajoutée en lobe (cos^`GALBE_DU_PAN`) vers `ANGLE_DU_PAN` dans le plan de l'anneau, incliné de
# `INCLINAISON_DU_PAN` sur l'axe du bras ---
COUPE_MIN = 0.06                   # fraction de `upperarm` en deçà de laquelle la coupe du bras se prend là (épaule)
RAYON_DE_COUPE_MAX = 0.12          # rayon au-delà duquel un point de la coupe n'est pas du bras (tronc)
MANCHE = [(-0.10, 0.024, 0.0), (0.15, 0.026, 0.03), (0.40, 0.032, 0.09), (0.62, 0.040, 0.16), (0.84, 0.048, 0.23),
          (1.06, 0.056, 0.30), (1.28, 0.064, 0.37), (1.58, 0.075, 0.44)]
# Illustration (bras droit tendu) : la manche s'élargit dès l'épaule, pend sous le bras et s'arrête à mi-avant-bras, où
# son ouverture fait ~230 px de haut (contrat : ~45 cm). Aisances de la cloche : HYPOTHÈSE, au moins celles qui gardent
# l'avant-bras bandé derrière la manche au coude (mesurées au premier Sorcier, #3743 : 42 et 62 mm le laissaient passer).
GALBE_DU_PAN = 1.5                 # HYPOTHÈSE : le pan large sur la hauteur de l'ouverture, pas une pointe
ANGLE_DU_PAN = 170.0               # base : direction du bas du monde dans le repère de repos de `upperarm` (0 = haut du bras
INCLINAISON_DU_PAN = 35.0          # en T, 90 = avant), moyenne sur les clips de repos et de marche (#3743) ; inclinaison :
                                   # HYPOTHÈSE, entre le pan qui pend bras tendu (illustration) et celui qui suit le bras baissé
RACCORD_EPAULE = 0.5               # fraction de `upperarm` sous laquelle un anneau emprunte ses poids sommet par sommet ;
                                   # au-delà, la manche suit `upperarm` d'un bloc et l'avant-bras plié en sort (#3743)
COUPE_DES_POIDS = 0.7              # fraction de `upperarm` dont la peau donne les poids de la manche
PLIS_DE_MANCHE = {'amplitude': 0.03, 'travers': 0.035, 'debut': 0.2, 'graine': 'humanoide--vetement--robe--plis-de-manche-'}
"""Illustration : la cloche tombe en plis le long du bras. Une colonne sur deux sort de 50 à 100 % d'`amplitude` au
bord, rien avant la fraction `debut` (HYPOTHÈSE : 3 cm) ; le pan d'un anneau sur deux est poussé de `travers` vers
l'avant, l'autre vers l'arrière : les plis du tombé, en travers du bras (HYPOTHÈSE : 3,5 cm au bord)."""
LAMBEAUX_MANCHE = {'profondeur': 0.055, 'creux': 0.3, 'graine': 'humanoide--vetement--robe--manche-'}
"""Illustration : le bord des cloches est déchiqueté ; contrat : dents lisibles à taille de jeu (HYPOTHÈSE : 5,5 cm, sous
les 7,5 cm de la dernière bande de la manche, galonnée)."""
