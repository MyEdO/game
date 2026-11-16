"""Données de `humanoide--armure--casque` (le Soldat, #4318), lues par `modele.py` : la pièce `casque` de la garde-robe.

Illustration directrice : « Soldat | soldat | `carrieres/soldat.png` | Livre de Base | 76 | certaine » (`INDEX.md` du
recueil `illustrations-wfrp.zip` ; page du PDF, folio imprimé 74), hors dépôt.

Ce qu'elle montre : un casque d'acier ouvert. Une calotte ronde, basse, au bord riveté ; devant, le bord s'arrête
au-dessus des sourcils en une arche relevée d'une courte visière ; de chaque côté il plonge en une grande joue de
plaque, d'un seul tenant avec la calotte, qui descend le long de la mâchoire jusqu'au menton, s'écarte du visage et se
retrousse au bas ; le visage reste dégagé entre les deux joues. Un bandeau de deux cordons torsadés, noir et acier,
ceint la base de la calotte. Au front, sur le bandeau, un fleuron rond : un médaillon rouge serti dans un chaton
d'acier (sa tête de mort est un détail peint, omis). Les plumes sont plantées juste derrière le fleuron, à l'avant-haut
de la calotte. Le dos ne se voit pas : couvre-nuque court et évasé, HYPOTHÈSE. Échelle relevée : ~520 px/m (du bas des
bottes au sommet du casque, ~915 px pour ~1,75 m) ; le casque y fait ~120 px de large, 0,23 m, joues comprises.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Un azimut se compte en degrés autour de la verticale du centre, 0 devant, positif vers la gauche. Chaque cote dit
d'où elle vient : `illustration`, `tête` (sonde de construction sur la tête publiée `humanoide--tete--humain`) ou
`HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'armure',
    'cle': {'piece': 'casque'},
    'liaison': {'mode': 'squelette'},
    'couche': 'armure',
    'couvre': [],
}
"""`couvre` vide : le casque est ouvert, le crâne se voit par l'ouverture du visage et sous les joues."""

MATERIAUX = {
    'metal': ('metal', 'acier-battu'),
    'fleuron': ('accent', ((0.3, 0.3, 0.3), 0.0, 0.5)),
}
"""Illustration : acier poli de la calotte et des joues ; cordons du bandeau noir et acier, lus comme de l'acier
(`acier-battu`, le même emplacement `metal`). Le médaillon du fleuron n'a aucune matière au catalogue (émail, pierre) :
gris de construction, teinté par l'emplacement `accent`."""

BUDGET_TRIANGLES = 2000                 # procédure du skill, section 7 : armure par pièce

CONTOURNE = {'tete': 'humanoide--tete--humain'}
MATIERES_DE_LA_TETE = ['peau']
ZONES_DES_CLES = ['tete', 'visage', 'nez']
"""Zones de la base dont le casque prend ses silhouettes et ses clés `gabarit_*` : la tête seule, qu'il coiffe ; lié
aussi au cou, il se plierait quand le cou bouge sous une silhouette et que la tête ne bouge pas."""
OS = 'Head'
"""L'os que suit tout le casque, rigide."""

CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os `OS` : le centre du crâne. Tête : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""

# ---------------------------------------------------------------- coque
# La coque est une surface de révolution déformée : à l'azimut `phi` et à la hauteur `h` au-dessus du centre, son rayon
# horizontal. Au-dessus du centre, un ellipsoïde ; au-dessous, le rayon de l'équateur corrigé par `PROFIL_BAS`.
DEMI_AXES = {'cote': 0.106, 'avant': 0.124, 'arriere': 0.122, 'haut': 0.128}
"""m. Tête : la peau est à 0,077-0,091 du centre sur les côtés (oreilles comprises), 0,103-0,113 devant, 0,092-0,108
derrière, 0,110 au sommet ; le casque passe à 14-25 mm d'elle, de quoi loger la coiffure (`JEU`). Illustration : calotte
ronde, à peine plus haute que large."""
JEU = 0.014
"""m : distance minimale de la nappe intérieure à la peau, tenue par une visée horizontale ou vers le centre. HYPOTHÈSE :
l'épaisseur d'une coiffure plaquée (`cheveux-longs` : 9 mm au sommet, 6 mm sur l'oreille) et 5 mm."""
EPAISSEUR = 0.003                       # HYPOTHÈSE : tôle lisible à taille de jeu, double nappe
COLONNES = 24                           # HYPOTHÈSE de maillage : une colonne tous les 15°, sous le plafond du personnage assemblé
RANGS = 6                               # HYPOTHÈSE de maillage : du bord au haut de la calotte
ELEVATION_HAUTE = 78.0                  # degrés : dernier rang avant le pôle
BORD = [(0.0, 0.040), (30.0, 0.037), (40.0, 0.026), (47.0, -0.030), (55.0, -0.092), (65.0, -0.112), (85.0, -0.112),
        (100.0, -0.095), (112.0, -0.058), (125.0, -0.048), (180.0, -0.052)]
"""(azimut, m) : la hauteur du bord au-dessus du centre. Illustration : devant, l'arche du bord est au-dessus des
sourcils (tête : sourcils à ~2 cm au-dessus du centre) ; elle plonge à l'aplomb du coin de l'œil en une joue qui
descend sous la bouche (tête : menton à -0,126) et couvre l'oreille. HYPOTHÈSE : couvre-nuque à 5 cm sous le
centre, à la base du crâne."""
PROFIL_BAS = [(0.0, 0.0), (0.5, -0.003), (0.8, 0.0), (1.0, 0.008)]
"""(part de la descente, m) : sous le centre, ce que le rayon gagne sur celui de l'équateur, de l'équateur (0) à
`DESCENTE` (1). Illustration : la joue rentre un peu vers la mâchoire puis s'écarte au bas."""
DESCENTE = 0.112                        # m : la hauteur sous le centre où finit `PROFIL_BAS`, le bas des joues
LEVRE = [(0.0, 0.020), (40.0, 0.016), (50.0, 0.012), (100.0, 0.012), (125.0, 0.016), (180.0, 0.018)]
"""(azimut, m) : la largeur de la lèvre retroussée qui finit le bord. Illustration : courte visière relevée au front
(~10 px, 2 cm), bas des joues retroussé ; HYPOTHÈSE : couvre-nuque évasé de même."""
PENTE_DE_LA_LEVRE = [(0.0, 20.0), (50.0, -35.0), (100.0, -35.0), (125.0, -40.0), (180.0, -40.0)]
"""(azimut, degrés) : la lèvre part du bord vers le dehors, relevée de cet angle sur l'horizontale. Illustration : la
visière remonte, le bas des joues s'évase vers le bas."""

# ---------------------------------------------------------------- bandeau
BANDEAU = {
    'hauteur': 0.056,                   # illustration : à la base de la calotte, juste au-dessus de l'arche du front
    'rayon': 0.011,                     # illustration : bandeau de ~11 px de haut, 2,2 cm
    'aplat': 0.5,                       # HYPOTHÈSE : petit axe de la section en part du grand, deux cordons accolés
    'segments': 36,                     # HYPOTHÈSE de maillage
    'cotes': 5,
    'tours': 12,                        # illustration : une torsade tous les ~6 cm ; demi-tours de la section sur le tour
    'enfoncement': 0.4,                 # HYPOTHÈSE : part du rayon noyée dans la coque
}

# ---------------------------------------------------------------- fleuron
FLEURON = {
    'azimut': 0.0,                      # illustration : au milieu du front
    'hauteur': 0.056,                   # illustration : sur le bandeau
    'rayon_du_chaton': 0.024,           # illustration : ~25 px de diamètre, 4,8 cm
    'rayon_du_medaillon': 0.017,        # illustration : le rouge fait les deux tiers du diamètre
    'saillie_du_chaton': 0.016,         # HYPOTHÈSE : au-delà de la coque, par-dessus le bandeau
    'saillie_du_medaillon': 0.020,      # HYPOTHÈSE : bombé de 4 mm au-dessus du chaton
    'cotes': 8,                         # HYPOTHÈSE de maillage
}

# ---------------------------------------------------------------- cimier
CIMIER = {
    'azimut': 0.0,
    'elevation': 50.0,
    'inclinaison': 12.0,
}
"""L'emplacement `cimier` qu'offre le casque : sur la coque, à cet azimut et à cette élévation depuis le centre.
Illustration : les plumes sortent de la calotte juste derrière le fleuron, à l'avant-haut, et non du sommet. Son axe Y,
le long duquel part la hampe d'un panache, est la verticale inclinée de `inclinaison` degrés vers l'arrière ; son axe X
est la gauche du personnage. HYPOTHÈSE de valeur : 50° d'élévation (le fleuron est à ~25°) et 12° d'inclinaison."""
