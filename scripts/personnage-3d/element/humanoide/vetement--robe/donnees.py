"""Données de `humanoide--vetement--robe` (le Sorcier, #3743, contrat du 2026-11-08), lues par `modele.py`.

Illustration directrice : « Sorcier | sorcier | `carrieres/sorcier.png` | Livre de Base | 94 | certaine » (`INDEX.md`
du recueil `illustrations-wfrp 2.zip`), hors dépôt. Elle montre une robe de dessus gris-bleu longue jusqu'aux chevilles,
ouverte devant sous la ceinture sur une robe de dessous écrue, aux manches très évasées qui pendent sous les avant-bras
(bandés, clairs) ; bordures à runes peintes (OMISES, contrat). Fermée derrière d'un seul pan (hypothèse du dos du
contrat).

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
    'couvre': ['torse', 'hanches', 'bras_haut_g', 'bras_haut_d', 'avant_bras_g', 'avant_bras_d',
               'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d', 'mollet_g', 'mollet_d'],
    'chaines': ['jupe'],
}
MATERIAUX = {'robe': ('vet1', ((0.55, 0.57, 0.6), 0.0, 0.87)),       # niveaux de gris de construction, sans couleur cuite
             'dessous': ('vet2', ((0.8, 0.78, 0.72), 0.0, 0.87))}

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

# --- Corsage : anneaux horizontaux (ancre, décalage, aisance), ancres lues sur la base : `bas` = bas de la zone
# `torse`, `aisselle` = bas des zones `bras_haut_*`, `cou` = bas de la zone `cou` ---
CORSAGE = [('bas', 0.0, 0.008), ('bas', 0.12, 0.012), ('aisselle', -0.12, 0.014), ('aisselle', -0.04, 0.016),
           ('aisselle', 0.03, 0.020), ('aisselle', 0.09, 0.022), ('cou', -0.03, 0.026), ('cou', 0.0, 0.026)]
# aisances : HYPOTHÈSE (robe ample mais portée sous la ceinture : l'aisance au premier anneau reste sous la surface
# intérieure de la ceinture publiée, mesurée sur l'élément publié) ; col arrêté au bas du cou et dégagé de 26 mm,
# caché par l'écharpe de la capuche (illustration) : plus haut ou plus serré, le cou le traverse sous `carrure_plus`
# (Hit_Knockback, Push_Loop : jusqu'à 16 mm).

# --- Jupe : rangées horizontales sous le corsage, cône évasé depuis la ligne des hanches ---
Z_HANCHES = 0.90                   # base : coupe la plus large du bassin et des cuisses (x ±0,18 m)
AISANCE_HANCHES = 0.04             # HYPOTHÈSE : la robe, froncée sous la ceinture, tombe des hanches sans les mouler ;
                                   # à moins, le petit rayon du devant étire les arêtes au-delà de la porte en clip (Roll) ;
                                   # à 0,055, l'ourlet latéral se lie au corps autrement sous `gabarit_legs_moins` et le
                                   # lissage des clés décolle la pièce (suiviDuCorps/cle-non-suivie)
EVASEMENT_DEVANT = 1.8             # illustration : de face, l'ourlet fait ~1,8 fois la largeur aux hanches
EVASEMENT_ARRIERE = 2.0            # HYPOTHÈSE (dos non montré) : jupe plus pleine derrière, pour que le talon, relevé
                                   # en marche par le genou plié, reste sous l'ourlet
OURLET_ROBE = 0.13                 # illustration : la robe de dessus tombe à la cheville (tête de `foot_l` à 0,096 m)
OURLET_DESSOUS = 0.10              # illustration : la robe de dessous dépasse de ~3 cm sous celle de dessus, à la cheville
RANGEES_JUPE = [1.00, 0.90, 0.76, 0.60, 0.44, 0.28]   # hauteurs des rangées intermédiaires, m (HYPOTHÈSE de maillage)
OUVERTURE_TAILLE = 6.0             # illustration : la robe de dessus s'ouvre en V sous la ceinture ; demi-angle en degrés à la
                                   # première rangée : à 2°, les intervalles du pan de dessous dans l'ouverture font 5 mm
                                   # à 0,90 m et s'étirent ×3,7 sous `corpulence` (Jump_Land, Roll)
OUVERTURE_OURLET = 26.0            # illustration : demi-angle de l'ouverture devant à l'ourlet, degrés
RECOUVREMENT_DESSOUS = 3           # HYPOTHÈSE : le pan de dessous court sous les 3 premières colonnes de chaque bord
                                   # de la robe de dessus (~60° à la taille, ~75° à l'ourlet)
COLONNES_OUVERTURE = 4             # intervalles du pan de dessous dans l'ouverture (maillage), pair : un sommet sur l'axe ;
                                   # une paire de part et d'autre de l'axe, entre les genoux, se croise sous `corpulence`
                                   # (la clé suit l'intérieur des genoux) et l'arête retournée se replie en Slide_Exit ;
                                   # à 2 intervalles, la corde de l'ourlet (26°) rentre sur le pied, qui la traverse
                                   # sous `carrure_plus`
REMONTEE_DESSOUS = 0.012           # HYPOTHÈSE : hors de l'ouverture, l'ourlet du dessous remonte à 1,2 cm au-dessus de
                                   # celui de la robe, caché dessous (pas de bande écrue tronquée sur les côtés)
ECART_DESSOUS = 0.008              # HYPOTHÈSE : le pan de dessous court 8 mm sous la robe de dessus

# --- Poids de la jupe : chaîne `jupe` de la base (4 brins : avant θ=0, g θ=90, arrière θ=180, d θ=270) ---
# Le poids d'un brin décroît linéairement de 1 à son angle à 0 à l'angle des brins voisins (90°) : tout secteur où un brin
# porte seul la jupe raidit le fondu et étire les arêtes au-delà de la porte en clip (×6 en Sword_Attack à 50°, ×3,6 à
# 15°, mesurés en passe neutre).
# Part des brins à la hauteur z (le reste au bassin) : deux brins voisins, ou un brin et le bassin, tournés l'un de
# l'autre de φ écartent un point à L sous la tête des brins de c·L, c = 2·sin(φ/2). Arête horizontale : deux colonnes
# voisines, d'angles θ et θ+Δθ, diffèrent de part·Δθ/90° en poids de brin, et l'arête, longue de r·Δθ, se replie dès que
# part·c·L/(π/2) atteint r, quel que soit Δθ. Arête verticale : sous la rangée au bassin, l'écart part·c·L croît plus
# vite que la hauteur dès que part atteint 1/c. La part vaut donc MARGE_DE_PLI/c·min(1, π·r(z)/(2L)), bornée à 1,
# r(z) le plus petit rayon de la rangée aux quatre brins (le devant : l'arête la plus courte à Δθ donné) ; sous
# `Z_HANCHES`, les poids du corps sont ceux de la ligne des hanches.
ROTATION_RELATIVE_MAX = 120.0      # HYPOTHÈSE : rotation relative de deux brins voisins dans les clips de la base (le brin
                                   # avant suit la cuisse la plus avancée, flexion jusqu'à ~120° en Roll, Slide_*,
                                   # Jump_Land, le brin latéral la seule abduction)
MARGE_DE_PLI = 0.8                 # HYPOTHÈSE : part bornée à 80 % du repli ; à part linéaire de 1 sous la tête à 0,40 à
                                   # l'ourlet, arêtes repliées (l_c/l_b < 0,01) à mi-jambe en Shield_Dash, Hit_Knockback,
                                   # Sword_Dash, LayToIdle ; à part 0,8 au fondu sous la tête, arête verticale repliée
                                   # entre 1,00 et 0,90 m en Roll ; au rayon moyen de la rangée, arêtes repliées à
                                   # l'ourlet devant du dessous en Sword_Regular_A_Rec (`corpulence`) et à 0,60 m en
                                   # Jump_Start (`feminin`), mesurées sous silhouettes

# --- Manches : anneaux perpendiculaires aux os du bras (segment, fraction de l'os, aisance, pan) ; `pan` : rayon
# ajouté vers le bas-arrière du bras (`ANGLE_DU_PAN`), en lobe (cos²) ---
COUPE_MIN = 0.06
CREUX_DE_LA_RACINE = 0.0
RAYON_DE_COUPE_MAX = 0.12
ANGLE_DU_PAN = 250.0               # HYPOTHÈSE : dans le plan de l'anneau, 0 = haut du bras en T, 90 = avant, 270 = arrière
MANCHE = [('haut', -0.10, 0.024, 0.0), ('haut', 0.15, 0.022, 0.0), ('haut', 0.55, 0.024, 0.0), ('haut', 0.95, 0.026, 0.010),
          ('bas', 0.30, 0.040, 0.040), ('bas', 0.65, 0.058, 0.080), ('bas', 0.98, 0.072, 0.120)]
# illustration : manche ajustée au bras, évasée dès le coude, ouverture ~3 fois l'avant-bras, pan pendant ~12 cm ;
# valeurs relevées sur le bras tendu de l'illustration, rapportées à l'avant-bras de la base (0,24 m).
SOUS_MANCHE = [(0.05, 0.006), (0.50, 0.006), (0.86, 0.006)]
# robe de dessous : manche ajustée de l'avant-bras, vue dans la manche évasée (illustration : avant-bras clairs) ;
# (fraction de `lowerarm`, aisance), HYPOTHÈSE ; arrêtée avant le poignet, que la main traverse sous corpulence.
