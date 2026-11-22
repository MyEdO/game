"""Données de `humanoide--vetement--bure` (le Prêtre, #3867), lues par le kit des robes (`element/robe.py`) : la variante
`bure` de la pièce `robe` de la garde-robe.

Illustration directrice : « Prêtre | pretre | `carrieres/pretre.png` | Livre de Base | 93 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip`), hors dépôt. Elle montre une robe de bure ocre d'un seul pan, fermée devant (aucune
ouverture, aucune robe de dessous), ample sur un ventre rond, longue jusqu'aux chevilles, l'ourlet effiloché en
lambeaux irréguliers au-dessus des pieds nus ; les manches ajustées jusqu'au coude puis en cloche très évasée, au bord
effiloché, qui pendent sous les avant-bras bandés (élément `humanoide--vetement--bandages`). Le dos ne se voit pas
(HYPOTHÈSE du contrat : fermé d'un seul pan). Échelle relevée : environ 433 px/m (du sommet du crâne, y ~290 px, aux
plantes des pieds, y ~1078 px, pour les 1,82 m de la base).

Chaque dimension est nommée, en mètres ou en degrés, avec sa source : `illustration`, `base` (base r24, sonde de
construction), `#3743` (mesurée sur la robe du premier Sorcier : même kit, même porteur) ou `HYPOTHÈSE` (valeur
d'adaptation, doctrine #1993, à trancher en revue). Repère Blender de la base : +Z le haut, -Y l'avant, +X la gauche du
personnage ; un angle θ autour du bassin se compte depuis l'avant (-Y) vers la gauche (+X).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'bure'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'hanches', 'bras_haut_g', 'bras_haut_d', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d'],
    'chaines': ['jupe'],
}
"""`couvre` : sous l'ourlet effiloché, pieds écartés, le mollet se voit (procédure, section 2) ; la cloche des manches
laisse l'avant-bras sortir, bandé."""
MATERIAUX = {'robe': ('vet1', 'laine')}

EMPLACEMENTS_DEPLACES = ['ceinture_avant']
"""Design L2 de #2972 : la robe (chaîne `jupe`) déplace `ceinture_avant` sur sa surface, où se posent la cordelière et la
bourse du preset `pretre`."""

# --- Maillage ---
BUDGET_TRIANGLES = 2500            # procédure, section 7 : vêtement par pièce
SEGMENTS_CORPS = 24                # colonnes du corsage et de la jupe (HYPOTHÈSE de maillage : une pointe de lambeau sur deux)
SEGMENTS_MANCHE = 12               # HYPOTHÈSE de maillage
EPAISSEUR = 0.002                  # HYPOTHÈSE : double nappe d'un drap de laine
DEGAGEMENT_MIN = 0.004             # HYPOTHÈSE : jeu minimal au corps
LISSAGE_POIDS = 2                  # passes laplaciennes des poids du corsage et du raccord des manches (la jupe n'est pas lissée)
BORNES_DES_CLES = (0.27, 2.5)      # #3743 : la jupe longue suit le bas de jambe, tassé à ~0,28 sous `gabarit_legs_moins` ;
                                   # marge prise sur la porte d'étirement au repos de l'évaluateur ([0,25 ; 4])

# --- Corsage : (ancre, décalage, aisance) ; ancres lues sur la base (`robe.ancres_du_corps`) : `bas` =
# bas de la zone `torse`, `aisselle` = bas des zones `bras_haut_*`, `cou` = bas de la zone `cou`. Fermé à chaque anneau
# (illustration : aucune ouverture devant ; le col, sous la fourrure, ne se voit pas) ---
CORSAGE = [('bas', 0.0, 0.008), ('bas', 0.12, 0.014), ('aisselle', -0.12, 0.018),
           ('aisselle', -0.04, 0.018), ('aisselle', 0.03, 0.020), ('aisselle', 0.09, 0.022),
           ('cou', -0.03, 0.026), ('cou', 0.0, 0.026), ('cou', 0.015, 0.030)]
# Aisances : celles du premier Sorcier (#3743), un peu plus amples sous la poitrine (HYPOTHÈSE : la bure tombe des
# pectoraux sur le ventre). Le col,
# fermé, s'arrête 15 mm au-dessus du bas du cou, sous le col de fourrure (`vetement--col-de-fourrure`) : monté à 30 mm
# comme celui du premier Sorcier (#3743), le cou le traversait de 19 mm sous `carrure_plus`
# (Hit_Knockback, porte) ; élargi à 40 mm, il ne suivait plus le cou sous `gabarit_head_plus` (`cle-inerte`). Le premier
# anneau reste sous la ceinture publiée, que la cordelière remplace. Le ventre rond est celui du corps sous `corpulence`
# (preset `pretre`, build 0,8), que la bure suit par ses clés.

# --- Jupe : rangées horizontales sous le corsage, posées et pondérées sur le filet `jupe` de la base (`tissu.Filet`) ---
OURLET_ROBE = 0.12                 # illustration : les pointes des lambeaux de l'ourlet à ~1025 px, 53 px au-dessus des plantes
                                   # (au-dessus de la cheville : tête de `foot_*` à 0,096 m, base) ; les pieds nus dessous
LAMBEAUX_ROBE = {'profondeur': 0.08, 'creux': 0.15, 'graine': 'humanoide--vetement--bure'}
"""Illustration : les lambeaux de l'ourlet montent d'environ 35 px au-dessus de leurs pointes (985 à 1025 px), 8 cm
(`tissu.lambeaux`)."""
RANGEES_JUPE = [1.00, 0.90, 0.76, 0.60, 0.44, 0.28]   # hauteurs des rangées intermédiaires, m (HYPOTHÈSE de maillage)

# --- Manches : anneaux perpendiculaires à `upperarm` (fraction de l'os, au-delà de 1 passé le coude ; aisance ; pan) ;
# `pan` : longueur ajoutée en lobe (cos²) vers `ANGLE_DU_PAN` dans le plan de l'anneau, incliné de `INCLINAISON_DU_PAN`
# sur l'axe du bras ---
COUPE_MIN = 0.06                   # #3743 : fraction de `upperarm` en deçà de laquelle la coupe du bras se prend là (épaule)
RAYON_DE_COUPE_MAX = 0.12          # #3743 : rayon au-delà duquel un point de la coupe n'est pas du bras (tronc)
MANCHE = [(-0.10, 0.024, 0.0), (0.15, 0.022, 0.0), (0.55, 0.026, 0.0), (0.95, 0.050, 0.02), (1.15, 0.080, 0.14),
          (1.40, 0.100, 0.42)]
# illustration : manche ajustée jusqu'au coude, puis cloche très évasée (bras gauche levé : l'ouverture fait ~0,25 m de
# large) dont le pan pend jusqu'à l'aisselle, ~0,45 m sous le coude ; aisances de la cloche : HYPOTHÈSE, plus larges que
# les 50 et 72 mm qui gardaient l'avant-bras bandé derrière la manche du premier Sorcier (mesurés, #3743).
ANGLE_DU_PAN = 170.0               # #3743, base : direction du bas du monde dans le repère de repos de `upperarm`
INCLINAISON_DU_PAN = 20.0          # (0 = haut du bras en T, 90 = avant), moyenne des deux bras sur Hampe_Repos_Loop,
                                   # Hampe_Marche_Loop, Idle_Loop et Walk_Loop : le pan, ainsi tourné, pend sous le coude
RACCORD_EPAULE = 0.5               # #3743 : au-delà, la manche suit `upperarm` d'un bloc
COUPE_DES_POIDS = 0.7              # #3743 : 0,95 `upperarm`, 0,05 `lowerarm`, lus sur l'export
LAMBEAUX_MANCHE = {'profondeur': 0.05, 'creux': 0.15, 'graine': 'humanoide--vetement--bure--manche-'}
"""Illustration : le bord des cloches s'effiloche en lambeaux d'environ 25 px (6 cm) ; 5 cm, sous la longueur du dernier
intervalle de la manche (~6,5 cm du côté sans pan), que le recul d'un creux ne retourne pas (HYPOTHÈSE)."""
