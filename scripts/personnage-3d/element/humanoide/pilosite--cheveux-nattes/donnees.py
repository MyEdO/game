"""Données de `humanoide--pilosite--cheveux-nattes` (#4261, refaite #4413), lues par `modele.py` : la coiffure
`cheveux-nattes` de la garde-robe, au nom que prévoit #3486 (cheveux nattés génériques).

Illustration directrice : « Apothicaire | apothicaire | `carrieres/apothicaire.png` | Livre de Base | 87 | certaine »
(`INDEX.md` du recueil `illustrations-wfrp.zip`), hors dépôt. Ce qu'elle montre : des cheveux bruns tirés en arrière,
que la coiffe de cuir cache presque tout ; deux nattes fines qui sortent sous la coiffe, longent la mâchoire, passent
hors du foulard et pendent jusqu'au haut de la poitrine, l'une devant l'épaule droite, l'autre du côté gauche. Échelle
relevée : environ 640 px/m ; une natte y fait ~7 px de large, 11 mm.

Contrat (#4413) : sans coiffe, la coiffure se lit à taille de jeu par sa masse. Une masse de cheveux sur le crâne et
les tempes, à raie au milieu (HYPOTHÈSE), l'oreille dégagée sans trou autour d'elle : les cheveux passent au-dessus et
derrière. Les nattes partent de derrière les oreilles (écart à l'illustration, où elles sortent de la coiffe devant
l'oreille : demande de #4413), descendent sous le lobe, passent devant l'épaule et pendent sur la poitrine. Une seule
pièce coiffe les têtes humaine, naine, haut-elfe et halfling : elle se pose hors de la plus extérieure des quatre
(`chevelure.py`).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Toute position se donne depuis un os de la base (tête de l'os). Un azimut se compte en degrés autour de la
verticale d'un centre, 0 devant, positif vers la gauche (+x) ; une élévation, en degrés depuis l'horizontale du centre.
Chaque cote dit d'où elle vient : `illustration`, `têtes` (sonde de construction sur les quatre têtes publiées), `base`
(sonde sur la base ou le pourpoint publié) ou `HYPOTHÈSE`.
"""

MANIFESTE = {
    'categorie': 'pilosite',
    'cle': {'coiffure': 'cheveux-nattes'},
    'liaison': {'mode': 'squelette'},
    'couche': 'peau',
    'couvre': [],
}
MATERIAUX = {'poil': ('cheveux', 'chevelure')}
"""La surface des coiffures publiées, `poil`, palette `cheveux`, matière `chevelure` du catalogue."""

BUDGET_TRIANGLES = 1500                 # procédure du skill, section 7 : pilosité

CONTOURNE = {'humain': 'humanoide--tete--humain', 'nain': 'humanoide--tete--nain',
             'haut-elfe': 'humanoide--tete--haut-elfe', 'halfling': 'humanoide--tete--halfling',
             'pourpoint': 'humanoide--vetement--pourpoint-matelasse', 'foulard': 'humanoide--vetement--foulard'}
"""Les têtes publiées que la chevelure coiffe ; le pourpoint et le foulard du preset `apothicaire`, par-dessus lesquels
pendent les nattes (illustration). HYPOTHÈSE : une natte qui pend sur la poitrine se pose sur ce qui y est porté ; une
couche `peau` à moins de 1 cm devant une couche qui la couvre est retenue derrière elle par la pile des couches
(`PERCEE_M`, `hotes/godot/asset/pile.ts`), et la natte y disparaîtrait."""
TETES = ['humain', 'nain', 'haut-elfe', 'halfling']
MATIERES_DE_LA_TETE = ['peau']
MATIERES_DES_COLS = {'pourpoint': ['robe'], 'foulard': ['foulard']}
ZONES_DU_CORPS = ['cou', 'torse']
"""Zones de la base que les nattes contournent sous la tête (le cou au-dessus du col du pourpoint)."""
ZONES_DES_POIDS = ['cou', 'torse']
ZONES_DES_CLES = ['tete', 'visage', 'nez', 'cou', 'torse']
"""Zones de la base dont la coiffure prend ses clés `gabarit_*`, et les nattes leurs silhouettes, au plus près. Le bas
des nattes les prend du corps, pas du pourpoint sur lequel il pend : repris du pourpoint, il ne suivait pas le torse qui
bouge sous `gabarit_head_plus` (`suiviDuCorps/cle-inerte`), ni la mâchoire sous la natte (`cle-non-suivie`, 21 mm)."""
TETE_DES_CLES = 'humain'
ZONES_DE_LA_TETE = ['tete', 'visage', 'nez']
"""La tête publiée, et ses meshes, dont la calotte prend ses silhouettes : sa clé `feminin` rapetisse le crâne plus que
celle de la base (#4413)."""
FONDU_DES_CLES = 24                     # HYPOTHÈSE : passes de moyenne des silhouettes, de la tête au corps
LISSAGE_DES_CLES = 6                    # HYPOTHÈSE : passes de moyenne des silhouettes le long des nattes
LISSAGE_DES_POIDS = 0
GRAINE = 'cheveux-nattes'

# ---------------------------------------------------------------- calotte
OS_DU_CENTRE = 'Head'
CENTRE = (0.0, -0.0074, 0.1007)
"""Depuis la tête de l'os : le centre du crâne. Têtes : (0 ; 0,010 ; 1,710) au repos, à la hauteur des yeux."""
PORTEE = 0.30                           # m : départ des visées, au-delà de la peau
POLE = (0.0, 90.0)
"""(azimut, élévation) du pôle des colonnes : le sommet du crâne, que traverse la raie."""
THETA_DU_POLE = 12.0                    # degrés : premier anneau autour du pôle
COLONNES = 28                           # HYPOTHÈSE de maillage
RANGS = 8                               # HYPOTHÈSE de maillage : du premier anneau au bord

BORD = [(0.0, 40.0), (22.0, 35.0), (42.0, 24.0), (58.0, 8.0), (68.0, -1.0), (75.0, 4.0), (80.0, 19.0), (106.0, 19.0),
        (113.0, 0.0), (124.0, -18.0), (150.0, -30.0), (180.0, -34.0)]
"""(azimut, élévation) : la naissance des cheveux. Le front, ouvert en pointe par la raie ; la tempe, couverte jusque
devant l'oreille ; le dessus de l'oreille, dégagée (têtes : le pavillon va de 83° à 102° d'azimut, de -28° à +12°
d'élévation, la pointe de la haut-elfe la plus haute) ; derrière elle, où naissent les nattes, puis la nuque."""
PROFIL = [(0.0, 0.010), (0.5, 0.013), (0.9, 0.011), (1.0, 0.001)]
"""(part du pôle au bord, m) : hauteur au-dessus de la plus extérieure des têtes ; le bord se pose sur la peau.
HYPOTHÈSE : une masse de cheveux, au jeu de la coiffe de l'Apothicaire près (`vetement--bonnet`, qui la contourne)."""
VOLUME = [(0.0, 0.85), (60.0, 1.0), (180.0, 1.1)]
RAIE = {'x': 0.0, 'largeur': 0.010, 'profondeur': 0.8, 'fin': 0.095, 'fondu': 0.030}
"""La raie : au milieu, du front à l'arrière du crâne (`fin`, m derrière le centre). HYPOTHÈSE : deux nattes, une raie."""
STRIES = 0.004                          # HYPOTHÈSE : m, une colonne sur deux plus haute : des mèches tirées vers les nattes
MECHES_DU_BORD = {'graine': 'cheveux-nattes', 'profondeur': 2.5, 'creux': 0.35}
"""Degrés : le bord en mèches inégales (`tissu.lambeaux`)."""

# ---------------------------------------------------------------- nattes
# Le chemin de la natte gauche (la droite en est le miroir) : des points de passage, chacun visé du dehors vers un centre
# (os, décalage depuis sa tête, azimut, élévation, portée de la visée) et posé à `jeu` plus le rayon au-delà de la plus
# extérieure des surfaces contournées (têtes, cou et torse de la base, pourpoint et foulard publiés).
NATTE = {
    'chemin': [
        # racine derrière l'oreille, enfoncée dans la calotte (#4413 : les nattes partent de derrière les oreilles)
        ('Head', (0.0, -0.0074, 0.1007), 116.0, 6.0, 0.20, -0.004),
        # sous la calotte, derrière le pavillon (têtes : il finit à 102° d'azimut)
        ('Head', (0.0, -0.0074, 0.1007), 114.0, -14.0, 0.20, 0.002),
        # sous le lobe, derrière l'angle de la mâchoire
        ('Head', (0.0, -0.0074, 0.1007), 104.0, -36.0, 0.20, 0.006),
        # côté du cou, hors du foulard (illustration : les nattes passent par-dessus lui). HYPOTHÈSE : 34 mm au-delà du
        # cou, le foulard posé à ~20 mm et épais de 4 mm, la natte à plus d'1 cm de lui (`PERCEE_M` de la pile)
        ('neck_01', (0.0, 0.0, 0.060), 56.0, 0.0, 0.16, 0.034),
        # haut de la poitrine, devant l'épaule (illustration) ; HYPOTHÈSE : 16 mm au-delà du pourpoint ou du foulard
        ('spine_03', (0.0, 0.0, 0.145), 36.0, 0.0, 0.35, 0.016),
        # bout, au haut de la poitrine (illustration : au niveau de l'amulette)
        ('spine_03', (0.0, 0.0, 0.095), 33.0, 0.0, 0.35, 0.014),
    ],
    'premier_pousse': 2,                # rang du point de passage dès lequel la natte est tenue au jeu des surfaces
    'jeu_min': 0.004,                   # HYPOTHÈSE : m, de la surface de la natte à la plus proche des surfaces contournées
    'jeu_au_foulard': 0.013,            # m, de la surface de la natte au foulard : `PERCEE_M` (1 cm) et 3 mm de marge
    'os_du_releve': 'spine_03',         # la natte trop près d'une surface se relève, à l'horizontale, depuis l'axe de cet os
    'pas_du_releve': 0.001,             # m
    'pas_d_echantillon': 0.004,         # m, échantillonnage du chemin pour le tenir au jeu
    'passes': 16,                       # adaptation : passes (tenue au jeu puis lissage du chemin) ; à 4, la natte se
                                        # recourbait autour du bord du foulard (rendu Idle_Loop)
    'rayon': 0.0085,                    # HYPOTHÈSE : natte de 17 mm, plus grosse que celle de l'illustration (11 mm), qui
                                        # ne se lisait pas à taille de jeu (#4413)
    'cotes': 5,                         # HYPOTHÈSE de maillage : section pentagonale lissée, sous le budget
    'maillon': 0.030,                   # illustration : un maillon de tresse tous les ~16 px, 2,5 cm, à l'échelle du rayon
    'pincement': 0.72,                  # HYPOTHÈSE : rayon entre deux maillons, en part du rayon
    'zigzag': 0.22,                     # HYPOTHÈSE : écart latéral alterné des maillons, en part du rayon (trois brins)
    'torsion': 28.0,                    # HYPOTHÈSE : degrés, section tournée d'un maillon au suivant, alternée
    'bout': 0.022,                      # HYPOTHÈSE : m, longueur sur laquelle le bout s'effile
    'rang_de_la_tete': 2,               # rang du point de passage jusqu'auquel la natte suit la tête seule
    'lissage_des_poids': 30,            # HYPOTHÈSE : passes de moyenne de la part du corps le long de la natte ; à 8, le
                                        # passage de la tête à la poitrine tenait sur deux maillons, étirés ×3,5 sous
                                        # `carrure_plus` (OverhandThrow, Zombie_Scratch)
}
