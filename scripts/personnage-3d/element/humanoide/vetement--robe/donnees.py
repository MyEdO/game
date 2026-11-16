"""Données de `humanoide--vetement--robe` (le Sorcier, #4351, contrat du 2026-11-16), lues par le kit des robes
(`element/robe.py`).

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` » (`INDEX.md` du recueil `illustrations-wfrp`),
LDB folio 92, hors dépôt. Elle montre une robe de dessus anthracite ouverte devant du col à l'ourlet, ses deux bords et
son ourlet bordés d'un galon clair (les signes du galon sont un motif peint : OMIS, contrat), sur une robe de dessous
sable qui tombe à la cheville, plus bas que l'ourlet de la robe de dessus, court devant et long derrière ; les ourlets
en dents irrégulières ; des manches en cloche très larges dès l'épaule, au bord déchiqueté et galonné, l'envers clair,
d'où sortent les avant-bras bandés (élément `humanoide--vetement--bandages`). Le dos ne se voit pas (HYPOTHÈSE du
contrat : fermé d'un seul pan). Liseré, pièces rapportées et usure : OMIS (contrat).

Échelle relevée : 2,0 mm par pixel (semelles à y 1095 px, sommet du crâne à y ~185 px, 15 px sous la pointe du capuchon,
pour les 1,82 m de la base).

Chaque dimension est nommée, en mètres ou en degrés, avec sa source : `illustration` (relevée sur l'image, rapportée
au corps de la base), `base` (lue sur la base ou un élément publié, par une sonde de construction), `HYPOTHÈSE` (aucune
source ne la donne : valeur d'adaptation, doctrine #1993, à trancher en revue). Repère Blender de la base : +Z le haut,
-Y l'avant, +X la gauche du personnage. Un angle θ autour du bassin se compte depuis l'avant (-Y) vers la gauche (+X).
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

MATERIAUX = {'robe': ('vet1', 'drap-terne'),       # contrat : drap anthracite
             'dessous': ('vet2', 'toile-ecrue'),   # contrat : toile sable
             'poitrine': ('vet2', 'toile-ecrue'),  # la robe de dessous vue dans l'ouverture du corsage
             'galon': ('vet2', 'laine'),           # contrat : bande écrue ; brief : `vet2`
             'doublure': ('vet2', 'laine')}        # contrat : doublure gris clair ; HYPOTHÈSE : `vet2`, le clair de la tenue

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
SEGMENTS_CORPS = 16                # colonnes du corsage et de la jupe de dessus, les deux du galon comprises
SEGMENTS_MANCHE = 12               # une dent du bord sur deux colonnes
EPAISSEUR = 0.002                  # HYPOTHÈSE : double nappe d'un drap de laine, comme les vêtements du Soldat
DEGAGEMENT_MIN = 0.004             # HYPOTHÈSE : jeu minimal au corps, comme le pourpoint du Soldat
LISSAGE_POIDS = 2                  # passes laplaciennes des poids du corsage et des manches (la jupe n'est pas lissée)
BORNES_DES_CLES = (0.27, 2.5)      # rapport d'arête sous une clé transférée hors duquel `tissu` lisse la clé : sous
                                   # `gabarit_legs_moins`, le bas de la jambe de la base se tasse à ~0,28 ;
                                   # marge prise sur la porte d'étirement au repos de l'évaluateur ([0,25 ; 4])

GALON = 0.06
"""Illustration : le galon fait ~30 px de large le long des bords de l'ouverture, de l'ourlet et du bord des manches
(contrat : ~6 cm). Il est la première et la dernière colonne de la robe de dessus, la bande de son ourlet et la dernière
bande de chaque manche."""

# --- Corsage : anneaux horizontaux (ancre, décalage, aisance, demi-ouverture devant en degrés, 0 = fermé), ancres
# lues sur la base : `bas` = bas de la zone `torse`, `aisselle` = bas des zones `bras_haut_*`, `cou` = bas de la zone
# `cou` ---
CORSAGE = [('bas', 0.0, 0.012, 26.0), ('bas', 0.12, 0.014, 21.0), ('aisselle', -0.10, 0.017, 17.0),
           ('aisselle', 0.03, 0.020, 15.0), ('aisselle', 0.09, 0.022, 14.0), ('cou', -0.03, 0.026, 14.0),
           ('cou', 0.0, 0.026, 0.0), ('cou', 0.015, 0.026, 0.0), ('cou', 0.03, 0.026, 0.0)]
# Demi-ouvertures : illustration, la robe de dessus est ouverte du col à l'ourlet ; sur la poitrine, entre la
# bandoulière et l'écharpe, les deux galons montent presque parallèles, à ~8 cm l'un de l'autre, et s'écartent à la
# taille (~13 cm de robe de dessous entre eux sous la boucle, 26°). Le col, au bas du cou, reste fermé sous l'écharpe,
# qui y repose (HYPOTHÈSE : l'illustration le cache). Aisances : HYPOTHÈSE, robe ample, le premier anneau sous la
# ceinture ; col dégagé de 26 mm, que le cou traverse plus serré sous `carrure_plus` (mesuré au premier Sorcier, #3743).
# Dans l'ouverture, la robe de dessous est la nappe `poitrine`, au ras du torse (`DEGAGEMENT_MIN`), qui court sous
# les bords.
RECOUVREMENT_POITRINE = 20.0       # HYPOTHÈSE : la robe de dessous court sous celle de dessus sur 20° de chaque bord
COLONNES_POITRINE = 4              # intervalles par anneau (maillage)

# --- Jupe : rangées horizontales sous le corsage, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
OURLET_ROBE = 0.41                 # illustration : devant, l'ourlet de la robe de dessus à mi-mollet (y ~890 px)
OURLET_PAR_AZIMUT = [(0.0, 0.41), (50.0, 0.41), (95.0, 0.34), (140.0, 0.30), (180.0, 0.30)]
"""L'ourlet de la robe de dessus par direction. Illustration : court devant (y ~890 px), il descend sur le côté (pan
droit à y ~950 px, 0,29 m) ; contrat : aux chevilles côté dos (HYPOTHÈSE du dos : 0,30 m, 6 cm au-dessus des creux de
l'ourlet de la robe de dessous : à 1,5 cm d'une rangée de celle-ci, l'arête qui les joint se retournait sous
`gabarit_legs_moins` et le lissage de la clé décollait la robe de dessous du corps, `cle-non-suivie` 8 cm)."""
LAMBEAUX_ROBE = {'profondeur': 0.035, 'creux': 0.3, 'graine': 'humanoide--vetement--robe--dessus'}
"""Illustration : le bas du galon de l'ourlet est mordu de dents de 10 à 20 px (2 à 4 cm), larges."""
OURLET_DESSOUS = 0.17              # illustration : les pointes de la robe de dessous à la cheville (y ~1010 px), au-dessus
                                   # du haut des bottes publiées (z 0,165 m)
LAMBEAUX_DESSOUS = {'profondeur': 0.07, 'creux': 0.3, 'graine': 'humanoide--vetement--robe'}
"""Illustration : l'ourlet de la robe de dessous est en dents larges et irrégulières, de 20 à 40 px (4 à 8 cm)."""
RANGEES_JUPE = [1.00, 0.88, 0.72, 0.56]   # hauteurs nominales des rangées des deux robes, m (HYPOTHÈSE de maillage)
RANGEES_DESSOUS = []                      # aucune rangée de la robe de dessous entre l'ourlet de la robe et le sien
OUVERTURE_TAILLE = 26.0            # illustration : ~13 cm de robe de dessous entre les galons sous la boucle
OUVERTURE_OURLET = 40.0            # illustration : ~42 cm entre les galons à l'ourlet (x 370 à 610 px)
COLONNES_OUVERTURE = 4             # intervalles de la robe de dessous dans l'ouverture (maillage), pair : un sommet sur
                                   # l'axe (mesuré au premier Sorcier, #3743)
ECART_DESSOUS = 0.008              # HYPOTHÈSE : la robe de dessous court 8 mm sous la robe de dessus

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan) ;
# `pan` : longueur ajoutée en lobe (cos^`GALBE_DU_PAN`) vers `ANGLE_DU_PAN` dans le plan de l'anneau, incliné de
# `INCLINAISON_DU_PAN` sur l'axe du bras ---
COUPE_MIN = 0.06
CREUX_DE_LA_RACINE = 0.0
RAYON_DE_COUPE_MAX = 0.12
MANCHE = [(-0.10, 0.024, 0.0), (0.15, 0.026, 0.02), (0.55, 0.036, 0.09), (0.95, 0.052, 0.18), (1.22, 0.066, 0.27),
          (1.45, 0.075, 0.33)]
# Illustration (bras droit tendu) : la manche s'élargit dès l'épaule en trapèze, s'arrête à mi-avant-bras (1,45 fois
# `upperarm`) et son ouverture y fait ~230 px de haut (contrat : ~45 cm), le pan pendant sous le bras. Aisances de la
# cloche : HYPOTHÈSE, au moins celles qui gardent l'avant-bras bandé derrière la manche au coude (mesurées au premier
# Sorcier, #3743 : 42 et 62 mm le laissaient passer de 15 mm sous `carrure_plus`).
GALBE_DU_PAN = 1.0                 # illustration : l'ouverture de la cloche est large sur toute sa hauteur, pas une pointe
ANGLE_DU_PAN = 170.0               # base : direction du bas du monde dans le repère de repos de `upperarm` (0 = haut du bras
INCLINAISON_DU_PAN = 20.0          # en T, 90 = avant), moyenne sur Hampe_Repos_Loop, Hampe_Marche_Loop, Idle_Loop et
                                   # Walk_Loop, deux bras ; le pan, ainsi tourné, pend sous le coude dans ces clips
RACCORD_EPAULE = 0.5               # fraction de `upperarm` sous laquelle un anneau de manche emprunte ses poids sommet par
                                   # sommet (raccord au corsage, lissé avec lui) ; au-delà, la manche suit `upperarm` d'un
                                   # bloc (poids de `COUPE_DES_POIDS`), cloche comprise, et l'avant-bras plié en sort
COUPE_DES_POIDS = 0.7              # fraction de `upperarm` dont la peau donne les poids de la manche
LAMBEAUX_MANCHE = {'profondeur': 0.04, 'creux': 0.3, 'graine': 'humanoide--vetement--robe--manche-'}
"""Illustration : le bord des cloches est déchiqueté en dents de ~20 px (4 cm), sous la longueur de la dernière bande
de la manche (~6 cm), que le recul d'un creux ne retourne pas."""
