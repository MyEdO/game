"""Données de `humanoide--pilosite--calvitie-et-barbe-rase` (le Prêtre, #3867), lues par `modele.py` : la coiffure
`calvitie-et-barbe-rase` de la garde-robe.

Contrat : `pretre/contrat.md` (2026-11-10). Illustration directrice : ligne de `INDEX.md` du recueil
`illustrations-wfrp` « Prêtre | pretre | `carrieres/pretre.png` | Livre de Base | 93 | certaine » (hors dépôt). Ce
qu'elle montre (tête, x 200-560, y 160-330) : le crâne nu au sommet ; une couronne de cheveux gris ras sur les tempes,
au-dessus et derrière les oreilles et sur la nuque ; une barbe grise de quelques jours qui épouse la mâchoire, les joues
basses, le menton, le dessous du menton et la lèvre supérieure, et arrondit le bas du visage ; les lèvres nues. Le dos
ne se voit pas (hypothèse du contrat : la couronne continue sur la nuque). Échelle relevée : environ 660 px/m (la tête,
du sommet du crâne au menton, environ 155 px pour les 0,235 m de la tête publiée).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Le poil est la peau de la tête publiée sous un masque, décalée le long de sa normale. Un sommet de la peau se repère
depuis un centre par son azimut `phi` (degrés, 0 devant, positif vers la gauche +x) et son élévation (degrés depuis
l'horizontale du centre) ; un masque est une bande entre un bord bas et un bord haut (tables `(|phi|, élévation)`
interpolées), chaque bord découpé en mèches (`tissu.lambeaux`, une mèche par `pas_des_meches` degrés). Chaque cote dit
d'où elle vient : `illustration`, `tête` (relevée sur la tête publiée `humanoide--tete--humain`), `adaptation` (valeur
d'adaptation du lot, doctrine #1993) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'calvitie-et-barbe-rase'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', ((0.6, 0.6, 0.6), 0.0, 0.95))}
"""La surface de la coiffure publiée `humanoide--pilosite--barbe-courte` : `poil`, palette `cheveux`, gris de construction."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

# La tête publiée, dont la peau porte le poil : la coiffure en prend les sommets, les normales et les poids, tels quels.
CONTOURNE = {'tete': 'humanoide--tete--humain'}
MATIERES_DE_LA_TETE = ['peau']
# Les zones de peau de la base que la tête publiée recouvre (mêmes bornes que sa peau, à 1 mm près) : la coiffure en
# prend les silhouettes et les clés `gabarit_*` (`Base.transferer`). Sans `nez`, la moustache sous la narine suivait le
# visage quand le nez de la base grandit sous `gabarit_head_plus` (`suiviDuCorps/cle-non-suivie`, 5,9 mm pour 5).
ZONES_DES_CLES = ['tete', 'visage', 'nez']
SOMMETS_PAR_FACE = 2                    # adaptation : à 3, les grandes faces de la tête au bord du masque tombent, et le
                                        # contour se creuse en dents de la taille d'une face (couronne absente au-dessus de l'oreille)
CAVITE = 0.012                          # adaptation : m, portée de la normale d'un sommet au creux d'une cavité (l'intérieur des
                                        # lèvres) ; plus loin, la normale du crâne au-dessus de l'oreille rencontre le pavillon
SOUDURE = 1e-5                          # adaptation : m, deux sommets de la peau plus proches sont un seul (coutures d'UV)

# Chaume : la hauteur du poil au-dessus de la peau, selon l'anneau du sommet compté depuis le bord du masque (0 au bord,
# puis 1, puis le cœur), plus un `grain` tiré par sommet ; l'épaisseur de la double nappe, sous la hauteur du bord, ne
# laisse aucune marche au pourtour. Illustration : barbe de quelques jours et cheveux ras, collés à la peau.
HAUTEUR = (0.0005, 0.0015, 0.0022)      # illustration : m, au bord, au premier anneau, au cœur
GRAIN = 0.0004                          # adaptation : m, écart tiré par sommet (la barbe drue ne lisse pas la surface)
EPAISSEUR = 0.0003                      # adaptation : m, sous `HAUTEUR[0]`
GRAINE = 'calvitie-et-barbe-rase'

# Oreilles : leurs sommets restent nus (illustration : la couronne passe au-dessus et derrière elles). Tête : pavillon de
# z 1,655 à 1,726 (le haut de l'hélix, z 1,722 à 1,725, à |x| 0,083 à 0,090), de y -0,002 à 0,034, détaché du crâne
# au-delà de |x| 0,078 (le crâne, à cette hauteur, est à |x| 0,074) : sur l'hélix, le bord du poil se retournait
# (`enroulement`, 3 triangles au-dessus de l'oreille).
OREILLE = {'x_min': 0.078, 'y': (-0.010, 0.042), 'z': (1.645, 1.727)}

# ---------------------------------------------------------------- couronne
COURONNE = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0074, 0.1007),   # tête : (0 ; 0,010 ; 1,710) au repos, milieu de la boîte du crâne au-dessus de l'oreille
    # Devant, la couronne s'arrête sur la tempe (illustration), bord découpé en mèches lui aussi.
    'phi_min': [(-6.0, 68.0), (30.0, 62.0)],
    # bord bas : sur la tempe, au-dessus de l'oreille, puis derrière elle jusqu'à la nuque (tête : la peau s'arrête à z
    # 1,625 derrière)
    'bas': [(60.0, 2.0), (80.0, 8.0), (100.0, 9.0), (118.0, -16.0), (140.0, -34.0), (180.0, -42.0)],
    # bord haut : bande étroite, de 4 à 6 cm au dos (illustration : crâne nu au-dessus des oreilles et sur l'occiput)
    # (au-dessus de l'oreille, la peau de la tête n'a qu'un rang de sommets entre le haut du pavillon, z 1,725, et z 1,751 :
    # le bord haut passe au-dessus de ce rang, sans quoi la bande s'y rompt)
    'haut': [(60.0, 26.0), (90.0, 34.0), (112.0, 32.0), (135.0, 14.0), (180.0, -8.0)],
    'meches': {'graine': 'couronne', 'profondeur': 2.0, 'creux': 0.35},   # degrés
    'pas_des_meches': 7.0,
}

# ---------------------------------------------------------------- barbe
BARBE = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0344, 0.0507),   # tête : (0 ; -0,017 ; 1,660) au repos, à la hauteur du bout du nez, derrière la bouche
    # favori : devant l'oreille, il monte jusqu'à la couronne de la tempe (tête : avant de l'oreille à y -0,002)
    'phi_max': [(-20.0, 74.0), (30.0, 84.0)],
    # bord bas : sous le menton (tête : sa peau s'arrête à z 1,584), puis le long de la mâchoire jusque sous l'oreille
    'bas': [(0.0, -70.0), (30.0, -66.0), (50.0, -56.0), (66.0, -40.0), (84.0, -20.0)],
    # bord haut : sous le nez (moustache rase), puis la ligne de joue, haute et diffuse (illustration)
    'haut': [(0.0, -1.0), (14.0, -2.0), (24.0, 4.0), (40.0, 10.0), (60.0, 16.0), (84.0, 30.0)],
    # Lèvres nues : une ellipse d'azimut et d'élévation. Tête : lèvres de z 1,627 à 1,641 à y -0,093, coins à x ±0,022,
    # soit de -19,5 à -11,5 degrés et 18 degrés d'azimut depuis le centre ; la lèvre supérieure garde la moustache rase.
    'bouche': {'phi': 21.0, 'elevation': (-23.5, -12.0)},
    'meches': {'graine': 'barbe', 'profondeur': 2.0, 'creux': 0.35},      # degrés
    'pas_des_meches': 6.0,
}
