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
OURLET_PAR_AZIMUT = [(0.0, 0.37), (50.0, 0.37), (95.0, 0.31), (140.0, 0.27), (180.0, 0.27)]
"""Les pointes de l'ourlet de la robe de dessus par direction, le premier celui du devant. Illustration : court devant,
à mi-mollet (y ~890 px, 0,41 m au milieu des dents), il descend sur le côté (pan droit à y ~950 px) ; contrat : aux
chevilles côté dos (HYPOTHÈSE du dos : 0,27 m)."""
RANGEES_JUPE = [0.95, 0.85, 0.74, 0.63]
"""Hauteurs nominales des rangées de la robe de dessus, m (HYPOTHÈSE de maillage). La première à 9 cm sous la taille : à
7 cm, l'arête qui les joint devant, du tronc au filet, s'étirait à 3,58 fois sa longueur (Melee_Hook, Farm_PlantSeed,
porte 3,51) ; la dernière au-dessus du galon de l'ourlet et de ses dents."""
GALON_DE_L_OURLET = 0.06
"""Hauteur de la bande de galon de l'ourlet, le long de ses dents. Illustration : ~30 px."""
LAMBEAUX_ROBE = {'profondeur': 0.10, 'creux': 0.3, 'graine': 'humanoide--vetement--robe--dessus'}
"""Illustration : l'ourlet du drap sombre est franchement déchiqueté, en dents irrégulières (HYPOTHÈSE : jusqu'à 10 cm,
larges de deux colonnes, ~17 cm) ; le galon de l'ourlet suit leur bord."""
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

# --- Manches : anneaux perpendiculaires à l'axe du bras, (fraction de `upperarm`, au-delà de 1 passé le coude ; aisance du
# dessus ; poche) ; `poche` : ce dont le dessous pend sous le bras, en lobe (cos^`GALBE_DE_LA_POCHE`) vers
# `ANGLE_DE_LA_POCHE` dans le plan de l'anneau, incliné de `INCLINAISON_DE_LA_POCHE` sur l'axe du bras ---
COUPE_MIN = 0.06                   # fraction de `upperarm` en deçà de laquelle la coupe du bras se prend là (épaule)
RAYON_DE_COUPE_MAX = 0.12          # rayon au-delà duquel un point de la coupe n'est pas du bras (tronc)
AZIMUTS_DE_MANCHE = [0.0, 40.0, 80.0, 110.0, 132.0, 150.0, 166.0, 180.0, 194.0, 210.0, 228.0, 250.0, 280.0, 320.0]
"""Azimuts des colonnes (0 = dessus du bras en T, 180 = dessous) : serrées dessous, où la poche pend et se plisse."""
MANCHE = [(-0.10, 0.024, 0.0), (0.25, 0.028, 0.03), (0.55, 0.032, 0.05), (0.85, 0.036, 0.07), (1.15, 0.040, 0.10),
          (1.34, 0.046, 0.26), (1.62, 0.055, 0.44)]
"""Illustration (bras droit tendu) : le dessus de la manche suit le bras ; dessous, le tissu pend en poche sous
l'avant-bras et s'ouvre au poignet sur ~230 px de haut (contrat : ~45 cm), à mi-avant-bras (1,62 fois `upperarm` aux
pointes). La poche reste courte jusqu'au coude (10 cm à 1,15) : plus longue là, la bande qui passe le coude, du bras à
l'avant-bras, s'étirerait au-delà de la porte coude plié (HYPOTHÈSE). Aisances du dessus : HYPOTHÈSE."""
GALBE_DE_LA_POCHE = 1.0            # HYPOTHÈSE : en entonnoir, l'ouverture ronde sous le bras, pas une lame
ANGLE_DE_LA_POCHE = 180.0          # le dessous du bras en T : la poche pend droit bras tendu (illustration)
INCLINAISON_DE_LA_POCHE = 35.0
"""Angle de la poche sur l'axe du bras : à 90°, elle pend droit sous le bras tendu (illustration) ; à 0°, elle prolonge
la manche, comme elle tombe bras baissé. La manche suit l'avant-bras sans chaîne d'os qui la fasse tomber : à 60°, la
poche de l'illustration, bras tendu, traverse le ventre et les hanches bras baissés (Idle_Loop, vu au rendu) ; à 25°,
elle tombe le long du bras au repos et n'est plus qu'un pan en T. HYPOTHÈSE : 35°, entre les deux."""
RACCORD_AU_BRAS = 1.0              # fraction sous laquelle un anneau emprunte ses poids au bras, sommet par sommet ; au-delà,
                                   # la manche suit l'avant-bras d'un bloc
COUPE_DES_POIDS = 1.5              # fraction dont la peau donne les poids de la manche passé le coude (l'avant-bras)
GODETS = {'creux': 0.05, 'debut': 0.85, 'colonnes': [4, 6, 8, 10]}
"""Illustration : la poche tombe en godets qui partent du coude. `colonnes` : les colonnes du dessous creusées (une sur
deux), de `creux` au bord, de rien à la fraction `debut` (HYPOTHÈSE : 5 cm)."""
LAMBEAUX_MANCHE = {'profondeur': 0.05, 'creux': 0.3, 'graine': 'humanoide--vetement--robe--manche-'}
"""Illustration : le bord des cloches est déchiqueté ; contrat : dents lisibles à taille de jeu (HYPOTHÈSE : 5 cm, sous
les 7 cm de la dernière bande de la manche, galonnée)."""
