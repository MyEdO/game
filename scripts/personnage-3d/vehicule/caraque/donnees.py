"""Données de la caraque (fiche `caraque` de `src/data/vehicles.json`, MDG p.113 ; illustration directrice « Caraque »
et ses plans de pont ; #2987 lots V3 à V5) : véhicule sans base, en mètres.

Repère Blender : z vers le haut, z = 0 à la ligne de flottaison, la proue vers -y, bâbord vers +x. L'export glTF
(y vers le haut) place la proue vers +z. L'origine est le centre du plan de jeu, comme l'hôte le pose ; z = 0 reste la
flottaison.

Ponts : la source unique `ponts` de la fiche (`plan_de_jeu.py`, #3686) donne l'emprise de chaque
pont, la hauteur de chaque case, ses cloisons, portes, échelles et sabords, le pied de chaque mât, la proue en avant du
gaillard d'avant et la trappe de fret ouverte (#3815) ; une case mesure `CASE` mètres.

Parties de la planche « Caraque, avec plans de ses ponts » (MDG 12 l.286 ; fiche
`user-doctrine-vehicule-assemblage-de-parties`) :
- le bateau, modelé ici : coque, préceintes, pavois, ponts, proue (poulaine) et ses garde-corps, gaillard d'avant,
  passerelle et ses poutres de support, château de poupe, sa balustrade et les cartouches sculptés de ses sabords
  (nœud `avec-sabord`), cloisons, portes, échelles, écoutilles, trappe de fret, mâts, vergues, voiles, gréement,
  défenses, gouvernail ;
- les Améliorations, pièces à part (`ameliorations.py`) : Sabord (sa trappe et le cadre de son ouverture), Nid-de-pie (la
  hune), Embarcation de bord (le canot), et les autres que la planche ne dessine pas ;
- l'armement : bombardes du gaillard et canons, pièces de siège aux `postes` ;
- le décor, posé par le plan de la caraque au noyau (`src/noyau/planDeLaCaraque.ts`) : le fanal du couronnement, le
  mobilier des pièces ;
- le pavillon et la flamme : surfaces `blason`.

Abscisse `f` de la forme de coque : 0 au nez du gaillard d'avant, 1 à la face arrière du château de poupe, calée par
morceaux sur les bords des ponts (`CALAGE`). Mesures : illustration de profil (hauteurs, 24,06 px/m pour 842 px de
coque) et plans des ponts (positions des mâts et de la façade du château, forme vue de dessus, saillie du beaupré).
"""

# Mètres par case du plan (`sceneMetresPerTile`, LDB 15 l.12).
CASE = 2.0
# Calage de f sur le plus haut pont : (f de son bord avant, f de son bord arrière) de chaque glyphe, le gaillard d'avant
# et la plage arrière ; entre deux, f suit les cases linéairement, et au-delà de la première, prolongée.
CALAGE = {"g": (0.127, 0.254), "a": (0.60, 1.0)}
# Maître-couple : f de ses bouts, où tous les niveaux de coque ont leur pleine largeur (`FORME_PLAN`), et longueur en
# mètres de l'entrée (du gaillard d'avant au maître-couple) et de la sortie (du maître-couple au château) ; les cases
# de l'embelle au-delà de l'entrée et de la sortie allongent le maître-couple.
COPLE = {"f": (0.513, 0.577), "entree": 9.3, "sortie": 0.8}
# Le pont dont les cases les plus basses de chaque colonne donnent le pont principal, sous le pavois de l'embelle.
PONT_PRINCIPAL = 2
# Glyphes des ponts nommés : gaillard d'avant, plage arrière, passerelle, case du grand mât sur l'embelle et sa hune,
# pieds des mâts (un mât se dresse du milieu de la case de son pied, à travers chaque pont au-dessus).
GLYPHES = {"gaillard": "g", "plage": "a", "passerelle": "z", "mat": "m", "hune": "n", "pieds": "ijl"}
# Sous chaque pont couvrant (glyphe de la case du dessus) : épaisseur du pont, paroi de la pièce creusée dessous (« bord » :
# le bordé à la hauteur de la pièce, « chateau » : la muraille du château ; décalage vers l'extérieur), None quand rien
# ne se creuse (le dessous du gaillard d'avant, ouvert sur le pont principal, et celui de la passerelle).
SOUS_LES_PONTS = {
    "e": {"epaisseur": 0.12, "paroi": ("bord", -0.20)},
    "p": {"epaisseur": 0.10, "paroi": ("bord", -0.20)},
    "q": {"epaisseur": 0.10, "paroi": ("bord", -0.20)},
    "r": {"epaisseur": 0.10, "paroi": ("bord", -0.20)},
    "m": {"epaisseur": 0.10, "paroi": ("bord", -0.20)},
    "a": {"epaisseur": 0.10, "paroi": ("chateau", -0.15)},
    "g": {"epaisseur": 1.30, "paroi": None},
    "z": {"epaisseur": 0.15, "paroi": None},
}
# Muraille laissée au bout d'une pièce creusée devant une cloison du plan qui ne donne sur aucune pièce.
MURAILLE = 0.15

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
# Avant renflé des plans des ponts p.99 : 2,5 m de demi-largeur une case en arrière du nez de la cale comme de celui
# du pont principal.
FORME_PLAN = [(0.0, 0.0), (0.01, 0.30), (0.02, 0.45), (0.05, 0.64), (0.09, 0.75), (0.14, 0.84), (0.2, 0.91), (0.28, 0.96),
              (0.37, 0.99), (0.46, 1.0), (0.55, 1.0)]
FORME_POUPE = (0.55, 1.8)        # u où commence le resserrement, exposant

# Stations u, partagées par tous les niveaux de coque ; 0.185 et 0.2 encadrent le bout arrière du gaillard d'avant.
STATIONS = [0.0, 0.01, 0.02, 0.05, 0.09, 0.14, 0.185, 0.2, 0.28, 0.37, 0.46, 0.55, 0.64, 0.72, 0.8, 0.87, 0.93, 1.0]

# Niveaux de coque, de la quille au plat-bord : (z ou "lisse", demi-largeur max, f d'étrave, f d'étambot,
# rapport de tableau, saillie). Les saillies entre z = 0.65 et 0.85, puis 2.0 et 2.4, sont les préceintes du dessin.
# L'étrave : plans des ponts p.99, son nez au pont principal vers x = 0,8 case, à la cale vers x = 1,6.
NIVEAUX = [
    (-3.0, 0.15, 0.170, 0.952, 1.0, 0.0),
    (-2.3, 2.50, 0.118, 0.960, 0.10, 0.0),
    (-1.3, 3.85, 0.095, 0.968, 0.22, 0.0),
    (0.0, 4.45, 0.068, 0.975, 0.36, 0.0),
    (0.6, 4.543, 0.058, 0.9766, 0.393, 0.0),
    (0.65, 4.550, 0.0575, 0.9768, 0.395, 0.12),
    (0.85, 4.581, 0.0555, 0.9773, 0.406, 0.12),
    (0.9, 4.589, 0.055, 0.9775, 0.409, 0.0),
    (1.1, 4.62, 0.053, 0.978, 0.42, 0.0),
    (1.95, 4.60, 0.050, 0.980, 0.45, 0.0),
    (2.0, 4.60, 0.0498, 0.980, 0.45, 0.15),
    (2.4, 4.56, 0.0485, 0.980, 0.46, 0.15),
    (2.45, 4.56, 0.0483, 0.980, 0.46, 0.0),
    ("lisse", 4.45, 0.047, 0.980, 0.47, 0.0),
]

# Hauteur du plat-bord selon f : pavois relevé sous le gaillard d'avant (en avant de lui, la proue l'arase), embelle à
# hauteur de taille (0.95 m au-dessus du pont : l'équipage s'y voit du buste, illustration p.99, et une pièce tire
# par-dessus), montée sous le château de poupe, qui la couvre.
LISSE = [(0.105, 4.0), (0.12, 4.35), (0.2506, 4.35), (0.264, 2.9), (0.5, 2.9), (0.6, 3.1), (0.8, 3.6), (1.0, 3.65)]
PAVOIS = (0.25, 0.45)            # retrait du plat-bord vers l'intérieur : en x, en y aux deux bouts

GOUVERNAIL = {"bas": (0.952, -2.8), "haut": (0.980, 3.2), "recul": 0.35, "corde": 0.7, "epaisseur": 0.3}

# Château de poupe : stations f, niveaux (z, saillie sur la demi-largeur du plat-bord), pont et garde-corps.
CHATEAU = {
    "stations": [0.60, 0.647, 0.693, 0.747, 0.80, 0.853, 0.907, 0.953, 0.973, 1.0],
    "niveaux": [(1.8, -0.10), (3.2, -0.10), (3.3, 0.25), (3.55, 0.25), (3.6, 0.12), (5.95, 0.12), (6.0, 0.24),
                (6.2, 0.24)],
    "garde_corps": (0.37, 0.25),     # retrait du plat-bord du château : en x, en y
}

# Gaillard d'avant en surplomb : demi-largeur selon f (plan « Gaillard d'avant » : de x = 1,9 à 4,0 case, avant plat),
# fond, pont, plat-bord.
GAILLARD = {
    "stations": [0.12, 0.14, 0.16, 0.18, 0.2, 0.22, 0.254],
    "largeur": [(0.12, 3.7), (0.2, 3.95)],   # le bout arrière prend le plat-bord + 0.12
    "niveaux": [(4.3, 0.0), (5.75, 0.0), (5.8, 0.08), (5.95, 0.08)],
    "garde_corps": (0.28, 0.25),
}

# Passerelle du gaillard d'avant à la plage arrière, sur ses cases (glyphe `GLYPHES["passerelle"]`) : tablier (largeur,
# épaisseur), garde-corps (hauteur, section), poutres de support en travers de l'embelle (abscisse de chacune en cases
# du plan, section) sur des épontilles posées sur le plat-bord (section), z du haut du passage à travers les pavois des
# ponts qu'elle relie. Plan « Gaillard d'avant » p.99, « 4 » et « 5 ».
PASSERELLE = {"largeur": 1.6, "epaisseur": 0.15, "garde_corps": (0.95, 0.08), "poutres": (5.75, 7.4, 8.95),
              "section": (0.25, 0.30), "epontille": 0.18, "passage": 6.6}

# Mâture, de l'avant à l'arrière : chaque mât au milieu de la case de son pied (`GLYPHES["pieds"]`), son emplanture au
# plancher de cette case ; z où le mât s'effile au-dessus du pont (l'origine de son nœud), z de tête, rayons bas et haut.
MATS = {
    "misaine": {"pied": 5.2, "tete": 18.0, "rayons": (0.24, 0.15)},
    "grand_mat": {"pied": 1.5, "tete": 23.95, "rayons": (0.28, 0.20)},
    "grand_mat_arriere": {"pied": 5.4, "tete": 18.7, "rayons": (0.20, 0.13)},
    "artimon": {"pied": 5.4, "tete": 15.0, "rayons": (0.16, 0.10)},
}
COTES_MAT = 8

# Hune du grand mât : profil (z, rayon) fermé sur l'axe, z depuis son plancher, à la hauteur de la case
# `GLYPHES["hune"]` ; mât de hune au-dessus (z de son pied et de sa tête depuis le même plancher, rayons).
# Hune : pièce de l'Amélioration Nid-de-pie (ancrage `nid-de-pie`, au pied de son profil), hors du navire.
HUNE = [(-0.7, 0.0), (-0.7, 0.32), (-0.35, 1.0), (-0.2, 1.12), (0.85, 1.2), (0.85, 1.05), (0.0, 0.98), (0.0, 0.0)]
MAT_DE_HUNE = (0.0, 2.9, 0.15, 0.08)
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

# Beaupré : talon sur le pont du gaillard (f, z), pente, saillie horizontale jusqu'à f = -0.235, 3,7 cases devant la
# proue du plan (plan « Pont supérieur », MDG p.99) ; civadière sous sa vergue.
BEAUPRE = {"talon": (0.12, 5.7), "pente_deg": 32.0, "bout_f": -0.235, "rayons": (0.22, 0.10)}
CIVADIERE = {"f": -0.12, "sous": 0.4, "longueur": 6.4, "rayons": (0.10, 0.06), "tete": 6.0, "bordure": 6.4,
             "hauteur": 4.45, "creux": 0.6}

# Postes : où se montent les pièces d'un bord (manifeste `postes`, dans l'ordre de chaque bord). Sans Sabord, « les
# tirs doivent nécessairement être effectués depuis le pont » (MDG p.97) : la coque n'a aucune ouverture, et chaque
# pièce se pose sur un pont découvert, sa bouche passée par-dessus le plat-bord, son origine de `recul` derrière sa face
# intérieure. Groupe : bords, colonnes des cases du plan (flancs) ou x (proue, poupe), plancher (un glyphe des ponts, ou
# "pont" : le pont principal), plat-bord par-dessus lequel elle tire, recul (m). Embelle : le plan « Pont supérieur » (p.99, « 13 ») porte deux
# pièces par bord, la p.105 en aligne davantage ; quatre par bord, hors des haubans du grand mât et des trappes. Proue :
# les bombardes du gaillard (« 1 »), de part et d'autre de la misaine, contre son avant plat, leurs bouches par-dessus,
# devant la trappe (« 3 »). Poupe : la plage arrière, par-dessus le couronnement.
CANON = {"axe": 1.15, "bouche": 1.725, "saillie": 0.45}   # canon de campagne : axe au-dessus du sol, bouche devant l'origine
POSTES_DU_PONT = [
    {"bords": ("tribord", "babord"), "cases": (6, 7, 8, 9), "plancher": "pont", "par_dessus": "embelle", "recul": 0.95},
    {"bords": ("proue",), "x": (-1.5, 1.5), "plancher": "g", "par_dessus": "gaillard", "recul": 0.6},
    {"bords": ("poupe",), "x": (-1.15, 1.15), "plancher": "a", "par_dessus": "couronnement", "recul": 0.95},
]

# Sabords (Amélioration `sabord`, manifeste `selon.sabord.postes`) : une ouverture traversant la muraille à chaque
# arête sabord des ponts (batterie du pont principal, plan p.99, « 22 », sous l'embelle, entre les deux préceintes, aux
# ouvertures de l'illustration p.99 où une pièce tient), au milieu de la case qu'elle ouvre, le bordé qui la bouche
# dans le nœud `sans-sabord` ; son cadre est celui de la pièce de l'Amélioration (`ameliorations.py`). Ils remplacent
# les postes des bords qu'ils nomment ; la proue garde ses bombardes du gaillard, la poupe ses deux pièces de chasse de
# la plage arrière (p.105). Chaque ouverture regarde exactement son bord, comme la pièce et la trappe qui s'y montent
# tournées vers lui ; le plancher de son poste est celui de sa case. L'ouverture : largeur, hauteur ; le cadre :
# largeur, saillie.
EMBRASURE = {"ouverture": (0.75, 0.75), "cadre": (0.12, 0.10)}
# Ouvertures vides du Sabord, des deux bords, que le modèle perce sans poste, comme un sabord : sorte de leur paroi
# (`SOUS_LES_PONTS`), abscisses en cases du plan, plancher (glyphe des ponts) et hauteur de leur axe au-dessus de lui.
# Château : les huit de l'illustration p.99 au-dessus du bandeau, à cartouches (`CARTOUCHE`, nœud `avec-sabord`),
# réparties sur sa longueur hors des cloisons du plan ; aucune pièce, la p.105 n'en monte aucune en abord de la poupe.
# Batterie : celles de l'illustration p.99 dont la pièce couvrirait la trappe ou l'échelle de sa case voisine.
OUVERTURES_VIDES = [
    {"sorte": "chateau", "cases": (11.45, 12.3, 13.2, 14.3, 14.95, 15.7, 16.7, 17.55), "plancher": "p", "axe": 2.3},
    {"sorte": "bord", "cases": (5.5, 10.5), "plancher": "e", "axe": CANON["axe"]},
]
# Cloisons du plan (épaisseur, débord au-delà du volume qu'elles ferment, épaisseur d'une cloison sous un seul pont
# couvert : la cloison arrière du gaillard, du pont principal à son fond) ; leurs portes : vantail (largeur, hauteur maximale, jeu sous le plafond, largeur des
# planches et joint, épaisseur), cadre (largeur, profondeur), pentures (hauteur, épaisseur), rayon de l'anneau.
CLOISON = {"epaisseur": 0.10, "marge": 0.03, "sous_un_pont": 0.15}
PORTE = {"largeur": 0.85, "hauteur": 1.85, "jeu": 0.12, "planche": 0.17, "joint": 0.012, "epaisseur": 0.05,
         "cadre": (0.10, 0.18), "penture": (0.07, 0.015), "anneau": 0.06}
# Écoutilles aux échelles du plan, dans le pont du dessus au-dessus de la trappe, depuis l'arête de l'échelle :
# ouverture (en travers, le long de l'échelle, en deçà du milieu de la trappe, qui reste un pont), hiloire (largeur,
# hauteur).
ECOUTILLE = {"ouverture": (1.0, 0.9), "hiloire": (0.10, 0.25)}
# Échelles de meunier, à cheval sur l'arête de l'échelle : largeur, pente, montants (profondeur, épaisseur), barreaux
# (rayon, pas vertical).
ECHELLE = {"largeur": 0.5, "pente": 72.0, "montant": (0.09, 0.05), "barreau": (0.022, 0.30)}
# Cale : membrures le long des murailles (pas, section le long du navire et en saillie), baux sous l'entrepont (un sur
# deux) ; le mobilier de la cale est celui du plan de jeu.
MEMBRURES = {"pas": 0.6, "section": (0.15, 0.12), "baux": (0.16, 0.12)}

# Emprise libre des cases (`cases` du manifeste, #3767) : pas de la grille de sondes verticales dans une case, hauteur
# d'où chacune descend au-dessus du plancher (une stature), écart toléré entre le plancher qu'elle touche d'abord et la
# hauteur de la case (une épaisseur de cloison, `CLOISON`), en mètres.
EMPRISE = {"pas": 0.05, "stature": 1.2, "ecart": 0.10}

# Proue (plan « Pont supérieur », « 11 ») : en avant de la cloison avant du gaillard, le pont arase la coque au plancher
# de ses cases ; la poulaine, plate-forme qui la prolonge au-delà de l'étrave jusqu'à `bout` (abscisse en cases), de
# `largeur` et d'`epaisseur` ; l'éperon qui la porte, de l'étrave à son bout ((abscisse en cases, z) de chaque bout,
# section en largeur et hauteur) ; son garde-corps (hauteur, pas des montants, section), le long de la coque arasée et
# de la poulaine.
POULAINE = {"bout": -0.5, "largeur": 2.1, "epaisseur": 0.3, "eperon": ((0.95, 0.4), (-0.45, 1.9)), "section": (0.35, 0.5),
            "garde_corps": (1.0, 0.9, 0.09)}

# Balustrade du château sur son couronnement : z du haut de la lisse, pas des balustres, rayons (col, panse),
# section de la main courante (largeur, épaisseur).
BALUSTRADE = {"haut": 6.75, "pas": 0.36, "rayons": (0.05, 0.09), "main": (0.18, 0.12)}
# Garde-corps à claire-voie du gaillard d'avant au-dessus de son mur : z du haut, montants (pas, côté), lisses
# (z bas, z haut) ; l'avant plat reste plein jusqu'en haut, les bombardes tirant par-dessus.
CLAIRE_VOIE = {"haut": 6.5, "pas": 1.1, "montant": 0.16, "lisses": [(6.12, 6.22), (6.4, 6.5)], "epaisseur": 0.09}
# Cartouches des ouvertures du château (illustration p.99) : arc doré au-dessus du cadre (rayon ajouté, épaisseur,
# saillie) et panneau sculpté dessous (largeur, hauteur, saillie, écart sous le cadre).
CARTOUCHE = {"arc": (0.0, 0.11, 0.13), "panneau": (0.62, 0.32, 0.07, 0.12)}
# Défenses verticales de l'embelle, entre les sabords de la batterie et les ralentisseurs : abscisse de chacune en
# cases du plan, de z à la lisse, section, saillie.
DEFENSES = {"cases": (4.7, 8.0, 9.0, 10.0, 11.5), "z": 0.85, "section": 0.14, "saillie": 0.10}

# Haubans et enfléchures : par mât, z du capelage, f de chaque cadène (relatif au mât), z et saillie des cadènes,
# pas des enfléchures ; étais (de, à) en (f, z) ; diamètres des cordages.
HAUBANS = {
    "grand_mat": {"capelage": 22.8, "cadenes": [0.006, 0.026, 0.046, 0.066], "z": 2.6, "saillie": 0.3},
    "misaine": {"capelage": 17.4, "cadenes": [0.006, 0.022, 0.038, 0.054], "z": 5.5, "saillie": 0.15},
}
ENFLECHURES = 0.55
ETAIS = [(("grand_mat", 22.8), (0.174, 6.1)), (("misaine", 17.4), (-0.17, 12.04))]   # (mât, z) du haut, (f, z) du bas
CORDAGE = {"hauban": 0.07, "enflechure": 0.035, "etai": 0.09}

# Pavillons : poupe (hampe de (f, z) à z, penchée vers l'arrière, toile longueur × hauteur) et flamme du grand mât.
PAVILLON = {"hampe": ((0.995, 6.9), 11.2, 0.5), "toile": (2.8, 1.8), "flamme": (26.4, 4.5, 0.7), "guindant": 0.12,
            "blason": 0.75}

# Rayures des voiles : bandes verticales du matériau `rayure`, `nombre` par voile, de largeur relative `largeur`.
RAYURES = {"nombre": 7, "largeur": 0.045}

# Ancrages des Améliorations (manifeste `ancrages`), en repère Blender : (x, f, z) ; ceux du milieu du navire en
# cases du plan (`ANCRAGES_AUX_CASES`) : (x, abscisse en cases, z, glyphe des ponts ou "pont" : le pont principal) ;
# celui du nid-de-pie, au pied de la hune (`HUNE`). Figure de proue et proue-idole au bout de la poulaine (`POULAINE`),
# bélier et bouteur sur l'étrave ; l'ancre à 1,15 m du bordé, sous le flanc du gaillard d'avant.
ANCRAGES = {
    "figure-de-proue": [(0.0, -0.0318, 1.9)],
    "ancre": [(4.6, 0.14, 3.2), (-4.6, 0.14, 3.2)],
    "belier": [(0.0, 0.0613, 0.4)],
    "clinfoc": [(0.0, -0.17, 12.04)],
    "blindage-fer": [(0.0, 0.5, 0.0)],
    "blindage-bronze": [(0.0, 0.5, 0.0)],
    "murs-blindes": [(0.0, 0.5, 0.0)],
    "bouteur": [(0.0, 0.068, 0.0)],
    "proue-idole-de-stromfels": [(0.0, -0.0318, 1.9)],
    "safran": [(0.0, 0.966, 0.2)],
}
ANCRAGES_AUX_CASES = {
    "embarcation-de-bord": [(2.0, 6.6, "z")],                                 # le canot du plan, sur deux poutres de la passerelle
    "ralentisseurs-lateraux": [(4.95, 6.5, 2.2), (-4.95, 6.5, 2.2)],          # entre les sabords de la batterie, hors du blindage
    "propulsion-a-vapeur": [(0.0, 8.7, "pont")],                              # entre la trappe de fret et le grand mât
}
# Ancrages sur la lisse de l'embelle, des deux bords, au milieu de son plat-bord, entre les pièces de l'embelle et
# hors des haubans : abscisse de chacun en cases du plan.
ANCRAGES_LISSE = {"fourquines": [6.0, 7.0, 8.0, 9.0]}

# Revue (`revue.py`) : le véhicule revu, la pièce montée aux postes armés de chaque bord, puis les configurations rendues (nom, titre, armement :
# bord → rangs armés, ou "tout" ; Améliorations montées) et les vues de l'intérieur (configuration, fichier, œil et
# visée en mètres glTF du manifeste, focale).
SANS_SABORD_A_BORD = ["figure-de-proue", "ancre", "belier", "nid-de-pie", "embarcation-de-bord", "ralentisseurs-lateraux",
                      "clinfoc", "blindage-fer", "fourquines"]
REVUE = {
    "vehicule": "vehicule--caraque",
    "aux_postes": {"proue": "vehicule--pierrier", "tribord": "vehicule--canon-moyen", "poupe": "vehicule--canon-moyen",
                   "babord": "vehicule--canon-moyen"},
    "configurations": [
        ("01-nue", "Sans arme ni Amélioration : coque pleine", {}, []),
        ("02-armee", "Armée sur le pont (10 canons, bombardes au gaillard), sans Sabord", "tout", []),
        ("03-sabords-fermes", "Sabord, sans arme : sabords fermés", {}, ["sabord"]),
        ("04-sabords-armee", "Sabord et armée (10 canons, bombardes au gaillard)", "tout", ["sabord"]),
        ("05-sabords-batterie", "Sabord, la batterie armée", {"babord": range(4), "tribord": range(4)}, ["sabord"]),
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
        ("02-armee", "interieur-embelle", (-0.3, 3.7, 8.5), (4.2, 2.6, 2.0), 16),
        ("05-sabords-batterie", "interieur-entrepont", (-0.6, 1.3, 1.0), (4.3, 1.05, 5.0), 12),
        ("05-sabords-batterie", "exterieur-sabord-batterie", (9.0, 3.0, 5.0), (4.3, 1.45, 5.0), 30),
        ("04-sabords-armee", "interieur-chateau", (0.0, 3.6, -4.7), (0.8, 2.8, -13.5), 14),
        ("21-tout", "proue-idole-et-belier", (5.5, 3.0, 21.4), (0.0, 1.2, 17.5), 30),
        ("01-nue", "interieur-cale", (0.4, -0.6, -10.0), (-0.3, -1.5, 6.0), 14),
        ("01-nue", "porte-du-chateau", (-2.6, 3.5, -0.065), (0.0, 2.7, -4.0), 22),
        ("01-nue", "porte-du-gaillard", (1.8, 3.7, 6.194), (0.0, 3.0, 10.0), 22),
        ("01-nue", "ecoutille-et-echelle", (-0.5, 4.2, 4.5), (-2.0, 1.0, 7.6), 20),
        ("01-nue", "echelle-de-l-entrepont", (1.5, 1.3, 9.5), (-2.0, 0.9, 8.2), 14),
        ("01-nue", "interieur-chateau-bas", (0.0, 3.4, -13.3), (-0.5, 2.6, -5.0), 14),
        ("01-nue", "passerelle", (4.5, 8.5, 13.0), (0.0, 5.6, 2.0), 20),
    ],
}

# Illustration directrice (`cote_a_cote.py`) : la planche dans le recueil ; pour le profil et pour chaque plan de pont
# (MDG p.99 : gaillard d'avant et château de poupe au pont 3, pont supérieur, pont principal, pont de cargaison), l'abscisse
# px de l'étrave et de l'étambot (le château), les lignes px du haut et du bas de la bande, la flottaison du profil.
ILLUSTRATION = {"fichier": "bateaux/caraque-et-plans-de-pont.png",
                "profil": {"etrave": 945, "etambot": 165, "haut": 20, "bas": 700, "eau": 655},
                "ponts": {3: ({"etrave": 230, "etambot": 830, "haut": 815, "bas": 990},),
                          2: ({"etrave": 230, "etambot": 830, "haut": 1005, "bas": 1190},),
                          1: ({"etrave": 230, "etambot": 830, "haut": 1200, "bas": 1385},),
                          0: ({"etrave": 230, "etambot": 830, "haut": 1390, "bas": 1560},)}}
