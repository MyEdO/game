"""Données de `humanoide--vetement--haut-de-chausses-ample` (le Gladiateur, #4394, contrat du 2026-11-22), lues par
`modele.py` : la variante `haut-de-chausses-ample` de la pièce `haut-de-chausses` de la garde-robe, que porte le preset
`gladiateur` (le Soldat garde la pièce `haut-de-chausses`).

Illustration directrice : celle du Gladiateur fournie par l'utilisateur le 2026-11-02 (#4394), 773 × 1257 px, hors dépôt.

Ce qu'elle montre : une culotte ocre, ample et bouffante, à plis lourds couchés en travers de la jambe, la ceinture
haute sous une large ceinture de cuir ; à la jambe droite, elle descend sous le genou et retombe en blouse sur la tige
de la botte. Omis (contrat) : la bande de mailles en travers de la cuisse droite, le genou gauche nu et
déchiré ; la pièce est symétrique, sur le modèle de la jambe droite. Le dos ne se voit pas : fermé et uniforme,
HYPOTHÈSE du contrat. Échelle : ~580 px/m, du sommet du casque (y ~165 px) à la plante du pied d'appui (y ~1215 px)
pour ~1,80 m ; le bas de la blouse à y ~1010 px, ~0,35 m ; la blouse fait ~110 px de large, ~0,19 m, sur un mollet de
~0,125 m (base).

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x). Chaque cote dit d'où elle vient : `illustration`, `base` (sonde de construction) ou `HYPOTHÈSE` (à trancher en
revue).
"""

MANIFESTE = {
    'categorie': 'vetement',
    'cle': {'piece': 'haut-de-chausses-ample'},
    'liaison': {'mode': 'squelette'},
    'couche': 'tenue',
    'couvre': ['hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d'],
}
"""Les hanches (base : 0,893 à 1,118, leur haut dans le dos), les cuisses (0,576 à 1,031) et les genoux (0,485 à 0,628),
que la culotte enferme. Le mollet est aux bottes (`vetement--bottes-a-revers`) : la blouse est ouverte dessous."""

MATERIAUX = {'toile': ('vet2', 'toile-ecrue')}
"""Illustration : une toile ocre (`vet2`, ocre au preset `gladiateur`)."""

BUDGET_TRIANGLES = 1900
"""Sous les 2 500 d'un vêtement (procédure, section 7) : le personnage assemblé tient sous 16 000."""

PORTEUSES = ['torse', 'hanches', 'cuisse_g', 'cuisse_d', 'genou_g', 'genou_d', 'mollet_g', 'mollet_d']
"""Les zones que la culotte traverse : ses poids et ses clés en viennent."""

# --- Colonnes : par jambe, `COLONNES_JAMBE` azimuts réguliers autour de l'axe de la jambe (degrés, depuis l'avant vers
# la gauche du personnage, à la jambe gauche ; en miroir à la droite) ---
COLONNES_JAMBE = 16                # HYPOTHÈSE de maillage : une colonne tous les 22,5°
COUTURE_DEVANT = 15
"""Colonne (337,5°, devant, côté entrejambe) où la jambe rejoint la couture du milieu devant ; les colonnes de
l'entrejambe vont de `COUTURE_DOS` à elle, celles du dehors d'elle à `COUTURE_DOS` par l'avant."""
COUTURE_DOS = 9                    # 202,5°, derrière, côté entrejambe

# --- Rangées : anneaux horizontaux, de la ceinture à l'entrejambe autour des hanches, puis autour de chaque jambe ---
CEINTURE = [1.13, 1.06, 0.99, 0.915]
"""z des anneaux autour des hanches. Illustration : la ceinture haute, sous le nombril. Base : la zone `hanches`, que la
culotte couvre, monte à 1,118 dans le dos ; la culotte monte à 1,13, derrière le bourrelet de la ceinture
(`accessoire--ceinture-large`). Les hanches laissées au corps, sous une culotte à 1,10, passaient devant elle accroupi
(`couche-traversee`, 20 sommets, 24 mm, Crouch_Fwd_Loop). La rangée du haut garde les poids du corps sous elle, sans
lissage : lissée, elle s'écartait du dos assis et accroupi, et le bord des hanches cachées se voyait (rendu,
Sitting_Idle_Loop, Crouch_Idle_Loop)."""
ENTREJAMBE = 0.845
"""z de la rangée où les deux jambes se séparent. Base : les cuisses se touchent jusqu'à ~0,85, le bas des hanches est à
0,893."""
JAMBE = [0.79, 0.745, 0.70, 0.655, 0.61, 0.57, 0.535, 0.505, 0.475, 0.45]
"""z des anneaux de chaque jambe, sous l'entrejambe. Illustration : la blouse retombe sur le haut de la botte ; son bas à
0,45, sur le revers (de 0,493 à 0,38, `vetement--bottes-a-revers`), dont il laisse voir le bas. HYPOTHÈSE : l'image
la descend à ~0,35 m, où elle cacherait tout le revers de la pièce symétrique. Base : le genou de 0,485 à 0,628 ; trois
rangées dedans, pour qu'il plie ; une rangée par creux et par bosse des plis (`AISANCE`)."""

# --- Volume ---
AISANCE = [(1.13, 0.006), (1.06, 0.020), (0.99, 0.032), (0.915, 0.044), (0.845, 0.054), (0.79, 0.088), (0.745, 0.092),
           (0.70, 0.060), (0.655, 0.040), (0.61, 0.084), (0.57, 0.046), (0.535, 0.088), (0.505, 0.100), (0.475, 0.092),
           (0.45, 0.062)]
"""(z, m) : distance au corps (enveloppe convexe de la coupe) au dehors de la jambe. Illustration : la jambe de culotte
fait ~0,30 à 0,34 m de large sur une cuisse de ~0,16 m (base), soit 7 à 9 cm d'aisance au dehors ; trois volumes
lourds, de la cuisse à la blouse, que séparent deux creux ; la blouse, le plus gros, déborde la botte puis rentre vers
elle. Ajustée à la ceinture, sous la ceinture de cuir. HYPOTHÈSE de valeurs."""
VERS_L_ENTREJAMBE = [(0.0, 1.0), (90.0, 0.9), (140.0, 0.4), (180.0, 0.2)]
"""(angle depuis le dehors de la jambe, degrés ; part de l'aisance), à la cuisse : le bouffant s'éteint vers
l'entrejambe, où les deux jambes se touchent (base). HYPOTHÈSE de valeurs."""
VERS_L_AUTRE_MOLLET = [(0.0, 1.0), (90.0, 1.0), (140.0, 0.8), (180.0, 0.7)]
"""Comme `VERS_L_ENTREJAMBE`, sous le genou. Base : les mollets sont à ~13 cm l'un de l'autre. HYPOTHÈSE de valeurs."""
GENOU = (0.60, 0.50)
"""z entre lesquels la part de l'aisance passe de `VERS_L_ENTREJAMBE` à `VERS_L_AUTRE_MOLLET` (base : le genou)."""
PLIS = {'pente': 0.06, 'azimut': 110.0, 'de': 0.90, 'a': 0.70}
"""Les plis couchés en travers : chaque colonne lit `AISANCE` à une hauteur décalée de `pente` (m) fois le cosinus de
son écart à `azimut` (degrés, autour de la jambe), entièrement sous `a`, pas du tout au-dessus de `de` (z). Illustration :
les plis descendent du dedans de la jambe vers le dehors ; HYPOTHÈSE de valeurs."""
CREUX = {'lobes': 4, 'vrille': 1100.0,
         'profondeur': [(0.92, 0.0), (0.845, 0.020), (0.79, 0.045), (0.61, 0.045), (0.505, 0.042),
                        (0.475, 0.030), (0.45, 0.008)]}
"""Les plis cassés : `lobes` creux autour de la jambe, chacun rentré de `profondeur` ((z, m)) en son milieu, qui tournent
de `vrille` degrés de phase par mètre de hauteur, soit une colonne tous les ~8 cm. Illustration : des plis lourds et
cassés, en travers de la cuisse et à la blouse. Nuls au-dessus de 0,92, sous la languette de la ceinture
(`accessoire--ceinture-large`, jusqu'à 0,90) : posée sur des creux dès 0,99, une de ses arêtes s'étirait de 4,3 fois
accroupi (`etirement/arete-etiree`, Crouch_Fwd_Loop, Sword_Heavy_Combo). HYPOTHÈSE de valeurs."""
SUR_LE_REVERS = [(0.45, 0.060), (0.505, 0.050), (0.56, 0.0)]
"""(z, m) : aisance la plus petite, quel que soit l'azimut : la blouse reste au-dessus du revers de la botte (2,4 à 3,4 cm
d'aisance de 0,465 à 0,43, `vetement--bottes-a-revers`). À 1,6 cm de lui, 2 à 4 sommets du revers passaient devant la
blouse genou plié (`couche-traversee`, 9 à 17 mm, Crouch_Fwd_Loop, Sword_Heavy_Combo)."""
DEGAGEMENT_MIN = 0.006
EPAISSEUR = 0.003                  # HYPOTHÈSE : toile lisible à taille de jeu, double nappe
LISSAGE_POIDS = 5                  # comme la culotte du Soldat (`vetement--haut-de-chausses`)
BORNES_DES_CLES = (0.27, 2.5)
"""Comme le pourpoint (`vetement--pourpoint`). Aux bornes de la culotte du Soldat (0,5 ; 1,8), le lissage gagnait toute
la pièce sous `carrure_plus` : sa clé restait 3 cm en deçà de celle du corps aux hanches, et le ventre passait devant la
ceinture de la culotte (rendu au repos ; `couche-traversee` de la ceinture de cuir, 25 mm, 40 clips)."""
