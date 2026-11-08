"""Données de la caraque (fiche `caraque` de `src/data/vehicles.json`, MDG p.113 ; illustration directrice « Caraque »
et ses plans de pont ; #2987 lots V3 à V5) : véhicule sans base, en mètres.

Repère Blender : z vers le haut, z = 0 à la ligne de flottaison, la proue vers -y, bâbord vers +x. L'export glTF
(y vers le haut) place la proue vers +z. Après construction, l'emprise est recentrée en x et y ; z = 0 reste la
flottaison.

Abscisse `f` : fraction de la longueur de coque hors beaupré, 0 au nez du gaillard d'avant, 1 à la face arrière du
château de poupe. `LONGUEUR` = 35 m (`ship.lengthM`). Mesures : illustration de profil (hauteurs, 24,06 px/m pour
842 px de coque) et plan « Pont supérieur » (positions des mâts, forme vue de dessus, saillie du beaupré).
"""

LONGUEUR = 35.0

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "toile": ("vet1", "toile-ecrue"), "rayure": ("vet2", "toile-rouge"),
             "fer": ("metal", "fer-noirci"), "cordage": ("cuir", "corde"), "dorure": ("accent", "laiton-dore")}
# Matériaux des pièces des Améliorations (`ameliorations.py`), même table ; une couleur sans emplacement
# (couleur linéaire, métal, rugosité) est celle que la source impose (le rouge sombre de l'idole de Stromfels, MDG p.97),
# ou le noir d'une ouverture.
MATERIAUX_DES_AMELIORATIONS = {
    "bois": ("bois", "bois-chene"),
    "fer": ("metal", "fer-noirci"),
    "bronze": ("metal", "laiton-dore"),
    "peinture": ("vet1", ((0.10, 0.25, 0.55), 0.0, 0.70)),
    "dorure": ("accent", "laiton-dore"),
    "chair": ("peau", ((0.80, 0.60, 0.48), 0.0, 0.80)),
    "toile": ("vet1", "toile-ecrue"),
    "rayure": ("vet2", "toile-rouge"),
    "sang": (None, ((0.30, 0.03, 0.03), 0.0, 0.7)),
    "ombre": (None, ((0.04, 0.04, 0.04), 0.0, 1.0)),
    "dent": (None, ((0.85, 0.82, 0.72), 0.0, 0.6)),
}
# Surfaces qui reçoivent l'emblème du navire (manifeste `blason`) : la toile des voiles carrées et du pavillon.
BLASONS = ("toile", "rayure")
# Carré de l'emblème sur une voile carrée : part de sa plus petite dimension, centre en hauteur (0 en tête).
BLASON = (0.62, 0.45)

# Forme de la coque vue de dessus : demi-largeur relative selon u (0 à l'étrave, 1 au tableau arrière) ; au-delà de
# u = 0.55 la coque se resserre jusqu'au rapport de tableau `s` de chaque niveau.
FORME_PLAN = [(0.0, 0.0), (0.02, 0.30), (0.05, 0.50), (0.09, 0.66), (0.14, 0.80), (0.2, 0.90), (0.28, 0.96),
              (0.37, 0.99), (0.46, 1.0), (0.55, 1.0)]
FORME_POUPE = (0.55, 1.8)        # u où commence le resserrement, exposant

# Stations u, partagées par tous les niveaux de coque ; 0.185 et 0.2 encadrent le bout arrière du gaillard d'avant.
STATIONS = [0.0, 0.02, 0.05, 0.09, 0.14, 0.185, 0.2, 0.28, 0.37, 0.46, 0.55, 0.64, 0.72, 0.8, 0.87, 0.93, 1.0]

# Niveaux de coque, de la quille au plat-bord : (z ou "lisse", demi-largeur max, f d'étrave, f d'étambot,
# rapport de tableau, saillie). Les saillies entre z = 0.65 et 0.85, puis 2.0 et 2.4, sont les préceintes du dessin.
NIVEAUX = [
    (-3.0, 0.15, 0.200, 0.952, 1.0, 0.0),
    (-2.3, 2.50, 0.168, 0.960, 0.10, 0.0),
    (-1.3, 3.85, 0.140, 0.968, 0.22, 0.0),
    (0.0, 4.45, 0.120, 0.975, 0.36, 0.0),
    (0.6, 4.543, 0.1135, 0.9766, 0.393, 0.0),
    (0.65, 4.550, 0.1129, 0.9768, 0.395, 0.12),
    (0.85, 4.581, 0.1107, 0.9773, 0.406, 0.12),
    (0.9, 4.589, 0.1102, 0.9775, 0.409, 0.0),
    (1.1, 4.62, 0.108, 0.978, 0.42, 0.0),
    (1.95, 4.60, 0.100, 0.980, 0.45, 0.0),
    (2.0, 4.60, 0.099, 0.980, 0.45, 0.15),
    (2.4, 4.56, 0.096, 0.980, 0.46, 0.15),
    (2.45, 4.56, 0.095, 0.980, 0.46, 0.0),
    ("lisse", 4.45, 0.085, 0.980, 0.47, 0.0),
]

# Hauteur du plat-bord selon f : tête d'étrave, pavois relevé sous le gaillard d'avant, embelle à hauteur de taille
# (0.95 m au-dessus du pont : l'équipage s'y voit du buste, illustration p.99, et une pièce tire par-dessus), montée
# sous le château de poupe, qui la couvre.
LISSE = [(0.085, 3.6), (0.103, 4.0), (0.12, 4.35), (0.2506, 4.35), (0.264, 2.9), (0.6, 2.9), (0.7, 3.1), (0.85, 3.6),
         (1.0, 3.65)]
# Pont principal selon f (sous le pavois de l'embelle).
PONT = [(0.0, 2.6), (0.15, 2.3), (0.3, 1.95), (1.0, 1.95)]
PAVOIS = (0.25, 0.45)            # retrait du plat-bord vers l'intérieur : en x, en y aux deux bouts

GOUVERNAIL = {"bas": (0.952, -2.8), "haut": (0.980, 3.2), "recul": 0.35, "corde": 0.7, "epaisseur": 0.3}

# Château de poupe : stations f, niveaux (z, saillie sur la demi-largeur du plat-bord), pont et garde-corps.
CHATEAU = {
    "stations": [0.70, 0.735, 0.77, 0.81, 0.85, 0.89, 0.93, 0.965, 0.98, 1.0],
    "niveaux": [(1.8, -0.10), (3.2, -0.10), (3.3, 0.25), (3.55, 0.25), (3.6, 0.12), (5.95, 0.12), (6.0, 0.24),
                (6.2, 0.24)],
    "garde_corps": (0.37, 0.25),     # retrait du plat-bord du château : en x, en y
    "pont": 5.85,
    "plancher": 3.75,                # pont intérieur du château, où roulent ses pièces
}

# Gaillard d'avant en surplomb : demi-largeur selon f (plan « Gaillard d'avant », avant plat), fond, pont, plat-bord.
GAILLARD = {
    "stations": [0.0, 0.03, 0.06, 0.09, 0.12, 0.16, 0.2, 0.254],
    "largeur": [(0.0, 2.7), (0.06, 3.3), (0.12, 3.7), (0.2, 3.95)],   # le bout arrière prend le plat-bord + 0.12
    "niveaux": [(4.3, 0.0), (5.75, 0.0), (5.8, 0.08), (5.95, 0.08)],
    "garde_corps": (0.28, 0.25),
    "pont": 5.6,
    "cloison": (0.254, 1.8, 4.35, 0.15),   # cloison arrière sous le gaillard : f, z bas, z haut, épaisseur
}

# Mâture. f du pied (plan « Pont supérieur »), z du pied, z de tête, rayons bas et haut.
MATS = {
    "misaine": {"f": 0.165, "pied": 5.2, "tete": 18.0, "rayons": (0.24, 0.15), "emplanture": 2.2},
    "grand_mat": {"f": 0.546, "pied": 1.5, "tete": 23.95, "rayons": (0.28, 0.20), "emplanture": -2.0},
    "grand_mat_arriere": {"f": 0.763, "pied": 5.4, "tete": 18.7, "rayons": (0.20, 0.13), "emplanture": 1.92},
    "artimon": {"f": 0.973, "pied": 5.4, "tete": 15.0, "rayons": (0.16, 0.10), "emplanture": 1.92},
}
COTES_MAT = 8

# Hune du grand mât : profil (z, rayon) fermé sur l'axe ; mât de hune au-dessus.
# Hune : pièce de l'Amélioration Nid-de-pie (ancrage `nid-de-pie`), hors du navire.
HUNE = [(23.2, 0.0), (23.2, 0.32), (23.55, 1.0), (23.7, 1.12), (24.75, 1.2), (24.75, 1.05), (23.9, 0.98), (23.9, 0.0)]
MAT_DE_HUNE = (23.9, 26.8, 0.15, 0.08)
COTES_HUNE = 10

# Voiles carrées : z de la vergue, longueur de vergue, rayons de vergue (milieu, bout), largeur en tête et en bordure,
# z de la bordure, creux vers l'avant, recul de la vergue devant le mât.
VOILES_CARREES = {
    "grand_mat": {"vergue": 19.3, "longueur": 14.5, "rayons": (0.20, 0.10), "tete": 13.6, "bordure": 14.4,
                  "bas": 9.1, "creux": 1.0, "devant": 0.45},
    "misaine": {"vergue": 16.1, "longueur": 11.6, "rayons": (0.17, 0.08), "tete": 10.8, "bordure": 11.4,
                "bas": 7.9, "creux": 0.8, "devant": 0.40},
}
GRILLE_VOILE = (6, 4)            # divisions en largeur, en hauteur

# Voile latine du grand mât arrière, dans le plan longitudinal décalé de `x` : point d'amure, tête de vergue, point
# d'écoute en (décalage f par rapport au mât, z) ; creux vers bâbord.
LATINE = {"x": 0.5, "amure": (-0.125, 8.3), "tete": (0.172, 20.6), "ecoute": (0.10, 7.9), "creux": 0.6,
          "rayons": (0.16, 0.07), "grille": (5, 3)}

# Beaupré : talon sur le pont du gaillard (f, z), pente, saillie horizontale jusqu'à f = -0.17 (plan « Pont
# supérieur ») ; civadière sous sa vergue.
BEAUPRE = {"talon": (0.12, 5.7), "pente_deg": 32.0, "bout_f": -0.17, "rayons": (0.22, 0.10)}
CIVADIERE = {"f": -0.12, "sous": 0.4, "longueur": 6.4, "rayons": (0.10, 0.06), "tete": 6.0, "bordure": 6.4,
             "hauteur": 4.45, "creux": 0.6}

# Postes : où se montent les pièces d'un bord (manifeste `postes`, dans l'ordre de chaque bord). Sans Sabord, « les
# tirs doivent nécessairement être effectués depuis le pont » (MDG p.97) : la coque n'a aucune ouverture, et chaque
# pièce se pose sur un pont découvert, sa bouche passée par-dessus le plat-bord de `RECUL` derrière sa face intérieure.
# Groupe : bords, f (flancs) ou x (proue, poupe), plancher ("pont" : `PONT` selon f), plat-bord par-dessus lequel elle
# tire. Embelle : le plan « Pont supérieur » (p.99, « 13 ») porte deux pièces par bord, la p.105 en aligne davantage ;
# quatre par bord, hors des haubans du grand mât et du canot. Proue : les bombardes du gaillard (« 1 »). Poupe : la
# plage arrière, par-dessus le couronnement.
CANON = {"axe": 1.15, "bouche": 1.725, "saillie": 0.45, "recul": 0.95}   # canon de campagne : axe au-dessus du sol, bouche devant l'origine
POSTES_DU_PONT = [
    {"bords": ("tribord", "babord"), "f": (0.33, 0.40, 0.47, 0.64), "plancher": "pont", "par_dessus": "embelle"},
    {"bords": ("proue",), "x": (-1.2, 1.2), "plancher": 5.6, "par_dessus": "gaillard"},
    {"bords": ("poupe",), "x": (-1.15, 1.15), "plancher": 5.85, "par_dessus": "couronnement"},
]

# Sabords (Amélioration `sabord`, manifeste `selon.sabord.postes`) : une ouverture traversant la muraille par poste, le
# cadre et le fond dans le nœud `avec-sabord`, le bordé qui la bouche dans le nœud `sans-sabord`. Ils remplacent les
# postes des bords qu'ils nomment ; la proue garde ses bombardes du gaillard. Batterie du pont principal (plan p.99,
# « 22 », deux pièces par bord, sous l'embelle, entre les deux préceintes) puis château (illustration p.99, huit par
# bord) ; poupe : le tableau du château. Chaque ouverture regarde exactement son bord, comme la pièce et la trappe qui
# s'y montent tournées vers lui. L'ouverture : largeur, hauteur ; le cadre : largeur, saillie.
EMBRASURE = {"ouverture": (0.75, 0.75), "cadre": (0.12, 0.10)}
SABORDS = [
    {"groupe": "batterie", "bords": ("tribord", "babord"), "f": (0.318, 0.456), "plancher": 0.30},
    {"groupe": "chateau", "bords": ("tribord", "babord"), "f": tuple(0.735 + 0.22 * i / 7 for i in range(8)), "plancher": 3.75},
    {"groupe": "poupe", "bords": ("poupe",), "x": (-1.15, 1.15), "plancher": 3.75},
]
# Intérieurs creusés dans la coque. Cale et entrepont de la batterie : z du plancher et du plafond, épaisseur de
# muraille ; ils s'étendent en f là où leur demi-largeur atteint `largeur_min`, jusqu'à `f_max` (avant l'étambot).
# Chambre du château, que ses sabords ouvrent : z du plancher, du plafond ; épaisseur de muraille. Pièces basses du
# château (plan de jeu, pont supérieur, cases 10 à 17), du pont de l'embelle au plancher de la chambre : z, muraille
# depuis le plat-bord, épaisseur de la façade et du tableau.
CALE = {"z": (-2.0, 0.18), "muraille": 0.20, "largeur_min": 1.0, "f_max": 0.93}
ENTREPONT = {"z": (0.30, 1.85), "muraille": 0.20, "largeur_min": 1.2, "f_max": 0.93}
CHAMBRE = {"z": (3.75, 5.75), "muraille": 0.15}
CHATEAU_BAS = {"z": (1.92, 3.62), "muraille": 0.30, "facade": 0.15}

# Plan de jeu (`src/noyau/planDeLaCaraque.ts`, #3686) ramené au modèle : l'abscisse du plan (en cases, proue à 0) donne
# f par morceaux, calés sur la cloison arrière du gaillard (arête 4) et la façade du château (arête 10) ; l'ordonnée
# (tribord à 0) donne x = (y - H / 2) × `case`, la largeur d'une case en mètres.
PLAN = {"calage": [(0, 0.0), (4, 0.254), (10, 0.70), (18, 1.0)], "case": LONGUEUR / 18}
# Cloisons du plan (épaisseur, débord au-delà du volume qu'elles ferment) ; leurs portes : vantail (largeur, hauteur maximale, jeu sous le plafond, largeur des
# planches et joint, épaisseur), cadre (largeur, profondeur), pentures (hauteur, épaisseur), rayon de l'anneau.
CLOISON = {"epaisseur": 0.10, "marge": 0.03}
PORTE = {"largeur": 0.85, "hauteur": 1.85, "jeu": 0.12, "planche": 0.17, "joint": 0.012, "epaisseur": 0.05,
         "cadre": (0.10, 0.18), "penture": (0.07, 0.015), "anneau": 0.06}
# Écoutilles aux échelles du plan : ouverture (en travers, le long de l'échelle), hiloire (largeur, hauteur), écart
# maximal de l'axe d'une écoutille transversale, pour laisser passer les affûts des pièces des bords.
ECOUTILLE = {"ouverture": (1.0, 1.2), "hiloire": (0.10, 0.25), "x_max": 0.6}
# Échelles de meunier : largeur, pente, montants (profondeur, épaisseur), barreaux (rayon, pas vertical), retrait du
# haut depuis le bord de l'écoutille.
ECHELLE = {"largeur": 0.5, "pente": 72.0, "montant": (0.09, 0.05), "barreau": (0.022, 0.30), "marge": 0.15}
# Cale : membrures (pas, section le long du navire et en saillie), baux sous l'entrepont (un sur deux) ; barriques
# debout le long des deux murailles (f de, à ; pas ; hauteur ; rayons au jable et au bouge ; rangs par bord).
MEMBRURES = {"pas": 0.6, "section": (0.15, 0.12), "baux": (0.16, 0.12)}
BARRIQUES = {"f": (0.30, 0.62), "pas": 0.85, "hauteur": 1.0, "rayons": (0.30, 0.37), "rangs": 2}

# Fanal au-dessus du couronnement du château de poupe : z du pied, hauteur de la lanterne, rayon, rayon du pied.
FANAL = {"z": 6.9, "hauteur": 1.4, "rayon": 0.32, "pied": 0.08}

# Balustrade du château sur son couronnement : z du haut de la lisse, pas des balustres, rayons (col, panse),
# section de la main courante (largeur, épaisseur).
BALUSTRADE = {"haut": 6.75, "pas": 0.36, "rayons": (0.05, 0.09), "main": (0.18, 0.12)}
# Garde-corps à claire-voie du gaillard d'avant au-dessus de son mur : z du haut, montants (pas, côté), lisses
# (z bas, z haut) ; l'avant plat reste plein jusqu'en haut, les bombardes tirant par-dessus.
CLAIRE_VOIE = {"haut": 6.5, "pas": 1.1, "montant": 0.16, "lisses": [(6.12, 6.22), (6.4, 6.5)], "epaisseur": 0.09}
# Cartouches des sabords du château et du tableau (illustration p.99) : arc doré au-dessus du cadre (rayon ajouté, épaisseur,
# saillie) et panneau sculpté dessous (largeur, hauteur, saillie, écart sous le cadre).
CARTOUCHE = {"arc": (0.0, 0.11, 0.13), "panneau": (0.62, 0.32, 0.07, 0.12)}
# Défenses verticales de l'embelle, entre les sabords de la batterie : f de chacune, de z à la lisse, section, saillie.
DEFENSES = {"f": (0.29, 0.35, 0.42, 0.49, 0.56, 0.63), "z": 0.85, "section": 0.14, "saillie": 0.10}

# Haubans et enfléchures : par mât, z du capelage, f de chaque cadène (relatif au mât), z et saillie des cadènes,
# pas des enfléchures ; étais (de, à) en (f, z) ; diamètres des cordages.
HAUBANS = {
    "grand_mat": {"capelage": 22.8, "cadenes": [0.006, 0.026, 0.046, 0.066], "z": 2.6, "saillie": 0.3},
    "misaine": {"capelage": 17.4, "cadenes": [0.006, 0.022, 0.038, 0.054], "z": 5.5, "saillie": 0.15},
}
ENFLECHURES = 0.55
ETAIS = [((0.546, 22.8), (0.174, 6.1)), ((0.165, 17.4), (-0.17, 12.04))]
CORDAGE = {"hauban": 0.07, "enflechure": 0.035, "etai": 0.09}

# Pavillons : poupe (hampe de (f, z) à z, penchée vers l'arrière, toile longueur × hauteur) et flamme du grand mât.
PAVILLON = {"hampe": ((0.995, 6.9), 11.2, 0.5), "toile": (2.8, 1.8), "flamme": (26.4, 4.5, 0.7), "guindant": 0.12,
            "blason": 0.75}

# Rayures des voiles : bandes verticales du matériau `rayure`, `nombre` par voile, de largeur relative `largeur`.
RAYURES = {"nombre": 7, "largeur": 0.045}

# Ancrages des Améliorations (manifeste `ancrages`), en repère Blender avant recentrage : (x, f, z).
ANCRAGES = {
    "figure-de-proue": [(0.0, 0.097, 2.6)],
    "ancre": [(3.55, 0.14, 3.2), (-3.55, 0.14, 3.2)],
    "belier": [(0.0, 0.118, 0.4)],
    "nid-de-pie": [(0.0, 0.546, 23.2)],
    "embarcation-de-bord": [(0.0, 0.42, 1.95)],
    "ralentisseurs-lateraux": [(4.95, 0.387, 2.2), (-4.95, 0.387, 2.2)],   # entre les sabords de la batterie, hors du blindage
    "clinfoc": [(0.0, -0.17, 12.04)],
    "blindage-fer": [(0.0, 0.5, 0.0)],
    "blindage-bronze": [(0.0, 0.5, 0.0)],
    "murs-blindes": [(0.0, 0.5, 0.0)],
    "bouteur": [(0.0, 0.12, 0.0)],
    "proue-idole-de-stromfels": [(0.0, 0.097, 2.6)],
    "safran": [(0.0, 0.966, 0.2)],
    "propulsion-a-vapeur": [(0.0, 0.60, 1.95)],
}
# Ancrages sur la lisse de l'embelle, des deux bords, au milieu de son plat-bord, entre les pièces de l'embelle et
# hors des haubans : f de chacun.
ANCRAGES_LISSE = {"fourquines": [0.365, 0.435, 0.505, 0.68]}

# Revue (`revue.py`) : le véhicule revu, la pièce montée à chaque poste armé, puis les configurations rendues (nom, titre, armement :
# bord → rangs armés, ou "tout" ; Améliorations montées) et les vues de l'intérieur (configuration, fichier, œil et
# visée en mètres glTF du manifeste, focale).
SANS_SABORD_A_BORD = ["figure-de-proue", "ancre", "belier", "nid-de-pie", "embarcation-de-bord", "ralentisseurs-lateraux",
                      "clinfoc", "blindage-fer", "fourquines"]
REVUE = {
    "vehicule": "vehicule--caraque",
    "aux_postes": "vehicule--canon-moyen",
    "configurations": [
        ("01-nue", "Sans arme ni Amélioration : coque pleine", {}, []),
        ("02-armee", "Armée sur le pont (12 canons), sans Sabord", "tout", []),
        ("03-sabords-fermes", "Sabord, sans arme : sabords fermés", {}, ["sabord"]),
        ("04-sabords-armee", "Sabord et armée (24 canons, bombardes au gaillard)", "tout", ["sabord"]),
        ("05-sabords-batterie", "Sabord, la batterie armée, le château fermé", {"babord": range(2), "tribord": range(2)}, ["sabord"]),
        ("06-figure-de-proue", "Figure de proue", {}, ["figure-de-proue"]),
        ("07-ancre", "Ancre", {}, ["ancre"]),
        ("08-belier", "Bélier", {}, ["belier"]),
        ("09-nid-de-pie", "Nid-de-pie", {}, ["nid-de-pie"]),
        ("10-embarcation", "Embarcation de bord", {}, ["embarcation-de-bord"]),
        ("11-ralentisseurs", "Ralentisseurs latéraux", {}, ["ralentisseurs-lateraux"]),
        ("12-clinfoc", "Clinfoc", {}, ["clinfoc"]),
        ("13-blindage-fer", "Blindage (fer)", {}, ["blindage-fer"]),
        ("14-blindage-bronze", "Blindage (bronze)", {}, ["blindage-bronze"]),
        ("15-murs-blindes", "Murs blindés", {}, ["murs-blindes"]),
        ("16-bouteur", "Bouteur", {}, ["bouteur"]),
        ("17-proue-idole", "Proue-idole de Stromfels", {}, ["proue-idole-de-stromfels"]),
        ("18-safran", "Safran", {}, ["safran"]),
        ("19-fourquines", "Fourquines", {}, ["fourquines"]),
        ("20-vapeur", "Propulsion à vapeur", {}, ["propulsion-a-vapeur"]),
        ("21-tout", "Sabord, armée et Améliorations compatibles", "tout",
         ["sabord", "proue-idole-de-stromfels", "ancre", "belier", "nid-de-pie", "embarcation-de-bord",
          "ralentisseurs-lateraux", "clinfoc", "blindage-fer", "murs-blindes", "safran", "fourquines"]),
        ("22-pont-tout", "Armée sur le pont, sans Sabord, avec canot et blindage", "tout", SANS_SABORD_A_BORD),
    ],
    "gros_plans": [
        ("02-armee", "interieur-embelle", (-0.3, 3.7, 6.43), (4.2, 2.6, -0.395), 16),
        ("05-sabords-batterie", "interieur-entrepont", (-0.6, 1.45, -5.995), (4.4, 1.05, 2.055), 12),
        ("05-sabords-batterie", "exterieur-sabord-batterie", (9.0, 3.0, 2.055), (4.3, 1.45, 0.095), 30),
        ("04-sabords-armee", "interieur-chateau", (0.0, 5.4, -8.725), (3.0, 4.9, -11.945), 14),
        ("21-tout", "proue-idole-et-belier", (5.5, 3.0, 16.755), (0.0, 1.2, 12.38), 30),
        ("01-nue", "interieur-cale", (0.4, -0.55, -7.045), (-0.3, -1.5, 2.755), 14),
        ("01-nue", "porte-du-chateau", (-2.6, 3.5, -4.595), (0.0, 2.7, -8.445), 22),
        ("01-nue", "porte-du-gaillard", (1.8, 3.7, 3.455), (0.0, 3.0, 7.165), 22),
        ("01-nue", "ecoutille-et-echelle", (-1.6, 4.2, -4.07), (0.6, 1.6, -5.365), 20),
        ("01-nue", "echelle-de-l-entrepont", (-1.5, 1.25, -3.02), (0.6, 1.35, -5.47), 14),
        ("01-nue", "interieur-chateau-bas", (1.2, 3.25, -8.865), (-0.97, 2.55, -11.945), 14),
    ],
}
