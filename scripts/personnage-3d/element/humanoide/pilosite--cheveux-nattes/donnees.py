"""Données de `humanoide--pilosite--cheveux-nattes` (l'Apothicaire, #4261), lues par `modele.py` : la coiffure
`cheveux-nattes` de la garde-robe, au nom que prévoit #3486 (cheveux nattés génériques).

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Ce qu'elle montre : des cheveux bruns tirés en arrière,
que la coiffe de cuir cache presque tout ; deux nattes fines qui sortent sous la coiffe aux tempes, devant les oreilles,
longent la joue et la mâchoire, passent hors du foulard et pendent jusqu'au haut de la poitrine, l'une devant l'épaule
droite, l'autre du côté gauche. Le dos ne se voit pas (HYPOTHÈSE : cheveux ramassés sur la nuque, sans chignon). Échelle
relevée : environ 640 px/m (la tête, du menton, y ~225 px, au sommet de la coiffe, y ~75 px, pour les 0,235 m de la tête
publiée) ; une natte y fait ~7 px de large, 11 mm.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Toute position se donne depuis un os de la base (tête de l'os). Un azimut `phi` se compte en degrés autour de la
verticale d'un centre, 0 devant, positif vers la gauche (+x) ; une élévation `e`, en degrés depuis l'horizontale du
centre. Chaque cote dit d'où elle vient : `illustration`, `tête` (relevée sur la tête publiée `humanoide--tete--humain`),
`base` (sonde de construction sur la base ou le pourpoint publié) ou `HYPOTHÈSE` (rien ne la donne, à trancher en revue).
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'cheveux-nattes'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', ((0.6, 0.6, 0.6), 0.0, 0.95))}
"""La surface des coiffures publiées : `poil`, palette `cheveux`, gris de construction."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

# La tête publiée, dont la peau porte la calotte ; le pourpoint et le foulard du preset `apothicaire`, par-dessus
# lesquels pendent les nattes (illustration). HYPOTHÈSE : une natte qui pend sur la poitrine se pose sur ce qui y est
# porté, comme le pan de la capuche sur la robe ; une couche `peau` à moins de 1 cm devant une couche qui la couvre est
# retenue derrière elle par la pile des couches (`PERCEE_M`, `hotes/godot/asset/pile.ts`), et la natte y disparaîtrait.
CONTOURNE = {'tete': 'humanoide--tete--humain', 'pourpoint': 'humanoide--vetement--pourpoint-matelasse',
             'foulard': 'humanoide--vetement--foulard'}
MATIERES_DE_LA_TETE = ['peau']
MATIERES_DU_POURPOINT = ['robe']
MATIERES_DU_FOULARD = ['foulard']
ZONES_DU_CORPS = ['cou', 'torse']
"""Zones de la base que les nattes contournent sous la tête (le cou au-dessus du col du pourpoint)."""
ZONES_DES_CLES = ['tete', 'visage', 'nez', 'cou', 'torse']
"""Zones de la base dont la coiffure prend ses silhouettes et ses clés `gabarit_*`, au plus près de chaque sommet. Le bas
des nattes les prend du corps, pas du pourpoint sur lequel il pend : repris du pourpoint, il ne suivait pas le torse
qui bouge sous `gabarit_head_plus` (`suiviDuCorps/cle-inerte`), ni la mâchoire sous la natte (`cle-non-suivie`, 21 mm)."""
EPAISSEUR = 0.0008                      # HYPOTHÈSE : double nappe de la calotte, sous la hauteur du bord

# ---------------------------------------------------------------- calotte
# Rayons visés depuis le centre du crâne vers la peau de la tête publiée ; colonnes en azimut, rangs en élévation du bord
# bas de la colonne à `elevation_haut`, éventail au sommet. Chaque sommet est posé à sa hauteur au-dessus de la peau.
CALOTTE = {
    'os_du_centre': 'Head',
    'centre': (0.0, -0.0074, 0.1007),   # tête : (0 ; 0,010 ; 1,710) au repos, milieu de la boîte du crâne au-dessus de l'oreille
    'colonnes': 24,
    'rangs': 7,
    'elevation_haut': 78.0,
    'portee': 0.20,                     # m : départ des visées, au-delà de la peau
    # bord bas (|phi|, e) : la naissance des cheveux. Devant, haute sur le front (HYPOTHÈSE : la coiffe la cache) ; à la
    # tempe, basse, où naissent les nattes (illustration) ; au-dessus de l'oreille (tête : haut de l'hélix à z 1,725,
    # e ~10°) ; derrière elle, elle descend sur la nuque (HYPOTHÈSE : cheveux ramassés, tête : la peau s'arrête à z 1,625
    # derrière).
    'bas': [(0.0, 40.0), (25.0, 37.0), (45.0, 28.0), (58.0, 12.0), (68.0, 6.0), (78.0, 14.0), (100.0, 15.0),
            (115.0, 0.0), (130.0, -22.0), (150.0, -34.0), (180.0, -40.0)],
    'meches': {'graine': 'cheveux-nattes', 'profondeur': 2.5, 'creux': 0.35},   # degrés, bord en mèches (`tissu.lambeaux`)
    # hauteur au-dessus de la peau : au bord, puis au cœur (illustration : cheveux tirés, plaqués au crâne)
    'hauteur': (0.0012, 0.0045),
    'stries': 0.0010,                   # HYPOTHÈSE : m, une colonne sur deux plus haute : des mèches tirées vers la nuque
}

# ---------------------------------------------------------------- nattes
# Le chemin de la natte gauche (la droite en est le miroir) : des points de passage, chacun visé du dehors vers un centre
# (os, décalage depuis sa tête, azimut, élévation, portée de la visée) et posé à `jeu` plus le rayon au-delà de la plus
# extérieure des surfaces contournées (peau de la tête, cou et torse de la base, pourpoint et foulard publiés).
NATTE = {
    'chemin': [
        # racine sous la coiffe, enfoncée dans la calotte (illustration : la natte sort sous la coiffe à la tempe)
        ('Head', (0.0, -0.0074, 0.1007), 57.0, 13.0, 0.15, -0.002),
        # tempe, devant l'oreille (illustration ; tête : l'avant de l'oreille est à phi ~81°)
        ('Head', (0.0, -0.0074, 0.1007), 60.0, -4.0, 0.15, 0.003),
        # joue, devant l'angle de la mâchoire (illustration)
        ('Head', (0.0, -0.0074, 0.1007), 60.0, -26.0, 0.15, 0.006),
        # sous la mâchoire, hors du foulard (illustration : les nattes passent par-dessus lui). HYPOTHÈSE : 34 mm au-delà
        # du cou, le foulard posé à ~20 mm et épais de 4 mm, la natte à plus d'1 cm de lui (`PERCEE_M` de la pile)
        ('neck_01', (0.0, 0.0, 0.060), 50.0, 0.0, 0.25, 0.034),
        # haut de la poitrine, devant l'épaule (illustration) ; HYPOTHÈSE : 16 mm au-delà du pourpoint ou du foulard
        ('spine_03', (0.0, 0.0, 0.145), 34.0, 0.0, 0.35, 0.016),
        # bout, au haut de la poitrine (illustration : au niveau de l'amulette)
        ('spine_03', (0.0, 0.0, 0.105), 32.0, 0.0, 0.35, 0.014),
    ],
    'premier_pousse': 2,                # rang du point de passage dès lequel la natte est tenue au jeu des surfaces
    'jeu_min': 0.004,                   # HYPOTHÈSE : m, de la surface de la natte à la plus proche des surfaces contournées
    'jeu_au_foulard': 0.013,            # m, de la surface de la natte au foulard : `PERCEE_M` (1 cm) et 3 mm de marge
    'os_du_releve': 'spine_03',         # la natte trop près d'une surface se relève, à l'horizontale, depuis l'axe de cet os
    'pas_du_releve': 0.001,             # m
    'pas_d_echantillon': 0.004,         # m, échantillonnage du chemin pour le tenir au jeu
    'passes': 16,                       # adaptation : passes (tenue au jeu puis lissage du chemin) ; à 4, la natte se
                                        # recourbait autour du bord du foulard (rendu Idle_Loop)
    'rayon': 0.0065,                    # illustration : natte de ~11 mm de large, renflée aux maillons
    'cotes': 5,                         # HYPOTHÈSE de maillage : section pentagonale lissée, sous le budget
    'maillon': 0.026,                   # illustration : un maillon de tresse tous les ~16 px, 2,5 cm
    'pincement': 0.72,                  # HYPOTHÈSE : rayon entre deux maillons, en part du rayon
    'zigzag': 0.22,                     # HYPOTHÈSE : écart latéral alterné des maillons, en part du rayon (trois brins)
    'torsion': 28.0,                    # HYPOTHÈSE : degrés, section tournée d'un maillon au suivant, alternée
    'bout': 0.022,                      # HYPOTHÈSE : m, longueur sur laquelle le bout s'effile
    'rang_de_la_tete': 2,               # rang du point de passage jusqu'auquel la natte suit la tête seule
    'lissage_des_poids': 30,            # HYPOTHÈSE : passes laplaciennes des poids le long de la natte ; à 8, le passage
                                        # de la tête à la poitrine tenait sur deux maillons, étirés ×3,5 sous `carrure_plus`
                                        # (OverhandThrow, Zombie_Scratch)
}
