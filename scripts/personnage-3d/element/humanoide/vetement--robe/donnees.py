"""Données de `humanoide--vetement--robe` (le Sorcier, #3743, contrat du 2026-11-08), lues par `modele.py`.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` | Livre de Base | 94 | certaine » (`INDEX.md`
du recueil `illustrations-wfrp 2.zip`), hors dépôt. Elle montre une robe de dessus gris-bleu à mi-mollet, ouverte devant
sous la ceinture sur une robe de dessous écrue qui tombe à la cheville et dépasse tout autour sous l'ourlet, aux manches
très évasées qui pendent sous les avant-bras (bandés : élément `humanoide--vetement--bandages`) et l'ourlet en
lambeaux de la robe de dessous ; bordures à runes peintes (OMIS, contrat). Fermée derrière d'un seul pan (hypothèse du dos
du contrat).

Chaque dimension est nommée, en mètres ou en degrés, avec sa source : `illustration` (proportion relevée sur l'image,
rapportée au corps de la base), `base` (lue sur la base r24 ou un élément publié, par une sonde Blender de construction), `HYPOTHÈSE` (aucune source ne la donne : valeur d'adaptation, doctrine #1993, à trancher en revue).
Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du personnage. Un angle θ autour du bassin se compte
depuis l'avant (-Y) vers la gauche (+X).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'robe'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'hanches', 'bras_haut_g', 'bras_haut_d', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d'],
    'chaines': ['jupe'],
}
MATERIAUX = {'robe': ('vet1', ((0.55, 0.57, 0.6), 0.0, 0.87)),       # niveaux de gris de construction, sans couleur cuite
             'dessous': ('vet2', ((0.8, 0.78, 0.72), 0.0, 0.87)),
             'poitrine': ('peau', ((0.7, 0.7, 0.7), 0.0, 0.6))}

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
SEGMENTS_CORPS = 18                # colonnes du corsage et de la jupe de dessus
SEGMENTS_MANCHE = 10
EPAISSEUR = 0.002                  # HYPOTHÈSE : double nappe d'un drap de laine, comme les vêtements du Soldat
DEGAGEMENT_MIN = 0.004             # HYPOTHÈSE : jeu minimal au corps, comme le pourpoint du Soldat
LISSAGE_POIDS = 2                  # passes laplaciennes des poids du corsage et des manches (la jupe n'est pas lissée)
BORNES_DES_CLES = (0.27, 2.5)      # rapport d'arête sous une clé transférée hors duquel `tissu` lisse la clé : sous
                                   # `gabarit_legs_moins`, le bas de la jambe de la base se tasse à ~0,28 ;
                                   # marge prise sur la porte d'étirement au repos de l'évaluateur ([0,25 ; 4])

# --- Corsage : anneaux horizontaux (ancre, décalage, aisance, demi-ouverture devant en degrés, 0 = fermé), ancres
# lues sur la base : `bas` = bas de la zone `torse`, `aisselle` = bas des zones `bras_haut_*`, `cou` = bas de la zone
# `cou` ---
CORSAGE = [('bas', 0.0, 0.008, 0.0), ('bas', 0.12, 0.012, 0.0), ('aisselle', -0.12, 0.014, 0.0),
           ('aisselle', -0.04, 0.016, 0.0), ('aisselle', 0.03, 0.020, 16.0), ('aisselle', 0.09, 0.022, 28.0),
           ('cou', -0.03, 0.026, 38.0), ('cou', 0.0, 0.026, 0.0), ('cou', 0.015, 0.026, 0.0), ('cou', 0.03, 0.026, 0.0)]
# aisances : HYPOTHÈSE (robe ample mais portée sous la ceinture : l'aisance au premier anneau reste sous la surface
# intérieure de la ceinture publiée, mesurée sur l'élément publié) ; col arrêté au bas du cou et dégagé de 26 mm,
# caché par l'écharpe de la capuche (illustration) : plus serré, le cou le traverse sous `carrure_plus` (Hit_Knockback,
# Push_Loop : jusqu'à 16 mm). Base : la coupe au bas du cou (z 1,527 m) passe par le haut des épaules (x ±0,237 m) ;
# arrêtée là, la robe laissait le trapèze à nu entre l'écharpe et la manche, et l'on voyait l'intérieur de son dos
# au-dessus des épaules (sonde de rayons de la vue de face, Hampe_Repos_Loop image 20 : 465 rayons sur l'intérieur
# du dos) : deux anneaux au-dessus couvrent le trapèze jusqu'au cou, sous l'écharpe, dont le bas emprunte leurs poids
# et leurs clés (`vetement--capuche/donnees.py`). L'empiècement suit la colonne du V (garde `enroulement`, `modele.py`).
# Demi-ouvertures : illustration, l'encolure s'ouvre en V sous l'écharpe jusque sous les pectoraux (fermée à
# l'anneau `aisselle` -0,04, z 1,33 m) ; le col, au bas du cou, reste fermé sous l'écharpe : ouvert, le bas de
# l'écharpe n'y reposait plus devant, et l'arête qui le joint à l'anneau suivant s'étirait au-delà de la porte
# (capuche-visage, ×3,52 en Sword_Regular_A).
# Dans le V, la poitrine est une nappe de la robe à l'emplacement `peau`, au ras du torse (`DEGAGEMENT_MIN`), qui
# court sous les bords : la zone `torse`, découverte, laissait la peau de la base passer devant la robe à l'épaule et
# sous l'aisselle, jusqu'à 40 mm (Idle_Loop, Walk_Loop, Hampe_Repos_Loop ; garde `traversee`, poids lissés ou non).
RECOUVREMENT_POITRINE = 20.0       # HYPOTHÈSE : la poitrine court sous la robe sur une colonne (20°) de chaque bord du V
COLONNES_POITRINE = 4              # intervalles de la poitrine par anneau (maillage)

# --- Jupe : rangées horizontales sous le corsage, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
Z_HANCHES = 0.90                   # base : coupe la plus large du bassin et des cuisses (x ±0,18 m)
AISANCE_HANCHES = 0.04             # HYPOTHÈSE : la robe, froncée sous la ceinture, tombe des hanches sans les mouler ;
                                   # à moins, le petit rayon du devant étire les arêtes au-delà de la porte en clip (Roll) ;
                                   # à 0,055, l'ourlet latéral se lie au corps autrement sous `gabarit_legs_moins` et le
                                   # lissage des clés décolle la pièce (suiviDuCorps/cle-non-suivie)
# Longueurs : illustration, hauteurs au sol rapportées à la ceinture (centre de la ceinture à y 567 px, sol entre les
# semelles à y 1095 px ; centre de la ceinture publiée à z 1,098 m, soit 2,08 mm par pixel).
OURLET_ROBE = 0.40                 # illustration : la robe de dessus tombe à mi-mollet (y ~905 px)
OURLET_DESSOUS = 0.19              # illustration : la robe de dessous tombe à la cheville (y ~1005 px, lambeaux de 960 à
                                   # 1020 px), au-dessus du haut des bottes publiées (z 0,165 m)
LAMBEAUX_DESSOUS = {'profondeur': 0.085, 'creux': 0.15, 'graine': 'humanoide--vetement--robe'}
"""Illustration : les lambeaux de la robe de dessous montent d'environ 45 px au-dessus de l'ourlet (960 à 1005 px), 8,5 cm
(`tissu.lambeaux`) ; les pointes restent à `OURLET_DESSOUS`, au-dessus des bottes, et les creux sous `RANGEES_DESSOUS`."""
RANGEES_JUPE = [1.00, 0.90, 0.76, 0.60]   # hauteurs des rangées intermédiaires des deux robes, m (HYPOTHÈSE de maillage)
RANGEES_DESSOUS = [0.30]                  # rangées de la robe de dessous sous l'ourlet de la robe (HYPOTHÈSE de maillage)
OUVERTURE_TAILLE = 18.0            # illustration : la robe de dessus s'ouvre devant sous la ceinture, ~0,13 m de large
                                   # sous la boucle (demi-angle en degrés à la première rangée) ; à 2°, les intervalles de
                                   # la robe de dessous dans l'ouverture font 5 mm à 0,90 m et s'étirent ×3,7 sous
                                   # `corpulence` (Jump_Land, Roll)
OUVERTURE_OURLET = 36.0            # illustration : l'ouverture fait ~0,3 m de large au genou (demi-angle à l'ourlet)
COLONNES_OUVERTURE = 4             # intervalles de la robe de dessous dans l'ouverture (maillage), pair : un sommet sur l'axe ;
                                   # une paire de part et d'autre de l'axe, entre les genoux, se croise sous `corpulence`
                                   # (la clé suit l'intérieur des genoux) et l'arête retournée se replie en Slide_Exit ;
                                   # à 2 intervalles, la corde de l'ourlet (26°) rentre sur le pied, qui la traverse
                                   # sous `carrure_plus`
ECART_DESSOUS = 0.008              # HYPOTHÈSE : la robe de dessous court 8 mm sous la robe de dessus

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan) ;
# `pan` : longueur ajoutée en lobe (cos²) vers `ANGLE_DU_PAN` dans le plan de l'anneau, incliné de
# `INCLINAISON_DU_PAN` sur l'axe du bras ---
COUPE_MIN = 0.06
CREUX_DE_LA_RACINE = 0.0
RAYON_DE_COUPE_MAX = 0.12
MANCHE = [(-0.10, 0.024, 0.0), (0.15, 0.022, 0.0), (0.55, 0.026, 0.0), (0.95, 0.050, 0.02), (1.15, 0.072, 0.12),
          (1.40, 0.085, 0.38)]
# illustration : manche ajustée jusqu'au coude, puis cloche ouverte ~0,1 m passé le coude, dont le pan pend ~0,4 m
# sous le coude du bras plié (bras gauche) ; aisances de la cloche : HYPOTHÈSE, assez larges pour que l'avant-bras
# droit de Hampe_Repos_Loop (coude à 34°) sorte par l'ouverture sans en percer le devant (vu au rendu), et que
# l'avant-bras bandé (`humanoide--vetement--bandages`, découvert) ne passe pas devant la manche au coude : à 32 et 50 mm
# (anneaux 0,95 et 1,15), il la traversait jusqu'à 27 mm sous `carrure_plus` (Lourde_Attaque, Hampe_Attaque), à 42 et
# 62 mm jusqu'à 15 mm (garde `traversee`).
ANGLE_DU_PAN = 170.0               # base : direction du bas du monde dans le repère de repos de `upperarm` (0 = haut du bras
INCLINAISON_DU_PAN = 20.0          # en T, 90 = avant), moyenne sur Hampe_Repos_Loop, Hampe_Marche_Loop, Idle_Loop et
                                   # Walk_Loop, deux bras : (0,94 le long du bras, 0,08 vers l'avant, 0,33 vers le bas),
                                   # à moins de 25° de chacun ; le pan, ainsi tourné, pend sous le coude dans ces clips
RACCORD_EPAULE = 0.5               # fraction de `upperarm` sous laquelle un anneau de manche emprunte ses poids sommet par
                                   # sommet (raccord au corsage, lissé avec lui) ; au-delà, la manche suit `upperarm` d'un
                                   # bloc (poids de `COUPE_DES_POIDS`), cloche comprise, et l'avant-bras plié en sort :
                                   # dans le repère de `lowerarm`, le bas du monde tourne de plus de 100° d'un clip à
                                   # l'autre (avant-bras levé de Hampe_Repos_Loop, pendant d'Idle_Loop), et aucun pan lié à
                                   # l'avant-bras ne pend ; mêlée des deux os, elle se replie au coude (anneau du coude à
                                   # 6 mm de l'axe, dents de scie sous l'avant-bras plié de Hampe_Repos_Loop)
COUPE_DES_POIDS = 0.7              # fraction de `upperarm` dont la peau donne les poids de la manche (0,95 `upperarm`,
                                   # 0,05 `lowerarm`, lus sur l'export)
