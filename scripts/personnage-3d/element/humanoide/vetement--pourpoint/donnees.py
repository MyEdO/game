"""Données de `humanoide--vetement--pourpoint` (le Soldat, #4318), lues par `modele.py` : la pièce `pourpoint` de la
garde-robe, de l'ensemble `tenue-uniforme-de-soldat` ; l'Apothicaire porte sa variante `pourpoint-matelasse`.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : un pourpoint écru, court, porté sous le plastron, dont on voit les mancherons : de l'épaule au coude,
sous les épaulières, une grosse manche bouffante blanche fendue de crevés étroits, par où passe une étoffe noire. Le
corps se cache sous le plastron ; l'encolure s'arrête au bas du cou, sous le col rouge de la chemise. Le dos ne se voit
pas : symétrique du devant, HYPOTHÈSE. Échelle relevée : ~520 px/m (`armure--epaulieres/donnees.py`) ; le mancheron
fait ~110 px de large au plus bouffant, ~21 cm, sur un bras de ~13 cm (base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction), `pourpoint-matelasse` (reprise de
`vetement--pourpoint-matelasse/donnees.py`, même porteur, même kit de manches) ou `HYPOTHÈSE` (à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'pourpoint'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['torse', 'bras_haut_g', 'bras_haut_d'],
}
"""Le torse, et le haut des bras que le mancheron couvre jusqu'au coude (dernier anneau à 0,86 de `upperarm`, dans la
zone : base, chacune de ses faces la plus proche de `bras_haut_*`) ; l'avant-bras est à la chemise."""

MATERIAUX = {
    'pourpoint': ('vet2', 'drap-terne'),
    'creves': ('vet1', 'drap-terne'),
}
"""Illustration : drap écru (`vet2`, écru au preset `soldat`), l'étoffe noire des crevés à `vet1` (noir au preset), le
même drap teint par la palette."""

BUDGET_TRIANGLES = 1200
"""Sous les 2 500 d'un vêtement (procédure, section 7)."""

# --- Maillage ---
SEGMENTS_CORPS = 12                # HYPOTHÈSE de maillage : le corps est caché sous le plastron
SEGMENTS_MANCHE = 16               # HYPOTHÈSE de maillage : quatre crevés d'une colonne, trois colonnes de bouffant
EPAISSEUR = 0.002                  # pourpoint-matelasse
DEGAGEMENT_MIN = 0.008             # HYPOTHÈSE : au-dessus de la chemise (son corps à 4 à 8 mm)
LISSAGE_POIDS = 2                  # pourpoint-matelasse
BORNES_DES_CLES = (0.27, 2.5)      # pourpoint-matelasse

# --- Corps : anneaux horizontaux fermés (ancre, décalage, aisance) ; ancres : `bas` (bas du torse, z = 1,04, base),
# `aisselle` (bas du haut des bras, z = 1,37), `cou` (bas du cou, z = 1,53) ---
CORPS = [('bas', 0.10, 0.012), ('bas', 0.18, 0.014), ('aisselle', -0.05, 0.016), ('aisselle', 0.06, 0.016),
         ('cou', -0.06, 0.014), ('cou', 0.015, 0.014)]
"""HYPOTHÈSE : ajusté, 6 à 8 mm au-dessus de la chemise ; court, il s'arrête à 1,14, au-dessus du haut-de-chausses (son
haut à 1,085, base), sous le plastron qui descend à 1,06 : rentré dessous jusqu'à 1,06, il passait devant lui accroupi
ou sous `carrure_plus` (`couche-traversee`, 8 à 33 mm, Crouch_Fwd_Loop, Roll). L'anneau sous le cou à 6 cm de lui : à
3 cm, la bande qui monte au cou s'étirait de 4,5 fois sous `carrure_plus` (`arete-etiree`) ; l'encolure serrée sur le cou, 1,5 cm au-dessus de son bas, d'où sort le col de la chemise, à 8 mm de lui : à 4 mm, le col
passait devant elle sous `carrure_plus` (`couche-traversee`, 14 mm).
Sous le plastron (`armure--plastron`, 24 mm au moins)."""

# --- Mancherons : anneaux perpendiculaires à `upperarm` (fraction de l'os ; aisance ; pan), le kit des robes
# (`robe.manches`) ; l'épaule à 0, le coude à 1 ---
MANCHE = [(-0.10, 0.012, 0.0), (0.10, 0.016, 0.0), (0.35, 0.042, 0.0), (0.58, 0.036, 0.0), (0.84, 0.018, 0.0)]
"""Illustration : le mancheron bouffe de l'épaule au coude, ~21 cm de large au plus gros (4,2 cm d'aisance sur le bras),
et se resserre au-dessus du coude en un ourlet net, que coiffe le bord du brassard (`armure--brassards-d-acier`).
L'ourlet à 0,86, sous le bord du brassard tout autour (base : il monte à 0,71-0,84 de `upperarm`) : à 1,05, la
dernière bande d'anneaux passait dans la zone `avant_bras_*`, que le brassard cache, et le mancheron finissait en dents
au coude. L'ourlet à 1,8 cm du bras, 9 mm au-dessus de la chemise (son aisance à 0,86 : 9 mm), sous la distance de retenue du
montage (`SERRAGE_M` de `hotes/godot/asset/pile.ts`, 1 cm), la retient coude plié ; à 1 cm et plus, le bouffant de la
chemise passait devant lui (`couche-traversee`, 7 à 18 mm, Lourde_Attaque, Hampe_Mort, Punch). HYPOTHÈSE : sa racine,
sous le bord du plastron et l'épaulière, à 1,6 cm ; à 3 cm, et bouffant à 4,6 cm, il passait devant eux bras levés
(`couche-traversee`, 9 à 18 mm, Melee_Hook, Sword_Dash)."""
CREVES = (1, 4)
"""Les bandes d'anneaux fendues de crevés : de l'anneau 1 (0,10) à l'anneau 4 (0,86) de `MANCHE`."""
COLONNES_DE_CREVE = 4
"""Un crevé toutes les quatre colonnes (sur seize) : quatre crevés autour du bras, dessus, devant, dessous, derrière.
Illustration : trois à quatre fentes noires se comptent sur la face visible du mancheron droit."""
RETRAIT_DES_CREVES = 0.020
"""m : les deux bords d'un crevé, aux anneaux intérieurs de la bande, rentrent vers l'axe du bras ; la fente s'ouvre en
creux entre deux bouffants. HYPOTHÈSE : sous l'aisance du bouffant (42 mm), au-dessus de la chemise (16 mm)."""
COUPE_MIN = 0.06                   # pourpoint-matelasse
RAYON_DE_COUPE_MAX = 0.12          # pourpoint-matelasse
RACCORD_EPAULE = 2.0               # pourpoint-matelasse : le mancheron entier emprunte au bras, sommet par sommet
COUPE_DES_POIDS = 0.7              # pourpoint-matelasse (sans effet : aucun anneau n'est pris d'un bloc)
