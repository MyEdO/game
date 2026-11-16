"""Données des arbres (#4335) : un GLB par décor `arbre`, `hetre`, `orme`, `pin`, `arbre-mort`, `souche` et `buisson` de
`src/data/props.json`, bâti dans l'enveloppe convexe des primitives de sa recette (`gabarit.py`). Aucune illustration au
corpus : proportions d'adaptation, en mètres dans le repère de `gabarit.py` (x à l'est, le front de la recette vers -y,
z vers le haut, origine à l'ancre) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y.

- `arbre` : le chêne, un feuillu élancé (l'enveloppe monte à 4,5 m pour 0,95 m de rayon). Tronc à section lobée, évasé
  au pied en contreforts de racines, qui se prolonge en flèche ; quatre charpentières le quittent sous le houppier et
  montent en arc, chacune vers une grande masse de feuillage, et portent des rameaux à masses plus petites ; la flèche
  porte les masses hautes et la cime. Les masses sont séparées : le bois se voit dessous et entre elles.
- `hetre` : fût droit, lisse et gris, nu jusqu'à 2,2 m ; des charpentières dressées, serrées contre la flèche ; un
  houppier ovoïde haut (de 2,3 à 5,3 m) et dense, ses masses hautes et jointives, le bois caché.
- `orme` : en vase. Fût trapu qui se divise vers 1,8 m en charpentières dressées puis ouvertes, nues sur deux mètres ;
  le houppier est en haut, large et plat (0,95 m de rayon de 3,6 à 4,4 m), ses masses basses et étalées.
- `pin` : long fût nu, roux, à moignons de branches mortes ; houppier court, en trois plateaux d'aiguilles séparés, le
  fût visible entre eux, portés par des branches presque horizontales.
- `arbre-mort` : un chicot. Tronc vrillé qui garde au pied des lanières d'écorce, creusé d'une cavité, fourchu : une
  branche maîtresse cassée net et un bras qui part vers l'est et se redresse, des branches secondaires en lignes
  brisées, des moignons, deux racines hors de terre.
- `souche` : le pied d'un arbre abattu. Fût à contreforts, coupe en gradins vers un cœur creusé, fendue de gerces,
  entaille d'abattage d'un côté et charnière d'éclats arrachés à sa lèvre, racines qui plongent.
- `buisson` : une touffe de masses de feuillage inégales portées par des tiges qui se voient à la base.

Matières : l'écorce d'un arbre vivant et la coupe de la souche prennent `bois-mort`, dont la texture est une écorce ;
`bois-chene`, que leur recette nomme, est un plancher, qui se lirait en planches sur un tronc ou une coupe. Le catalogue
n'a ni écorce grise lisse, ni écorce rousse, ni aiguilles : le fût du hêtre prend `laine`, un gris-beige uni et mat, celui
du pin `cuir-tanne`, un brun roux, et ses aiguilles `feuillage`, la seule matière végétale.

Saisons (`SELON`, par décor et par saison de `src/data/weather.json`) : la couleur que prend l'emplacement `vegetal`,
qui teint la texture neutre du feuillage ; l'été, sans entrée, est le feuillage tel que bâti ; l'hiver, sans palette,
cache le feuillage des `CADUCS` et montre leur ramure nue (`modele.py`)."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {
    "arbre": {"ecorce": ("bois", "bois-mort"), "feuillage": ("vegetal", "feuillage")},
    "hetre": {"ecorce": ("bois", "laine"), "feuillage": ("vegetal", "feuillage")},
    "orme": {"ecorce": ("bois", "bois-mort"), "feuillage": ("vegetal", "feuillage")},
    "pin": {"ecorce": ("bois", "cuir-tanne"), "feuillage": ("vegetal", "feuillage")},
    "arbre-mort": {"bois-mort": ("bois", "bois-mort")},
    "souche": {"bois-mort": ("bois", "bois-mort")},
    "buisson": {"tiges": ("bois", "bois-mort"), "feuillage": ("vegetal", "feuillage")},
}

CADUCS = ("arbre", "hetre", "orme", "buisson")
"""Les décors qui perdent leurs feuilles en hiver."""

SELON = {
    "arbre": {"printemps": {"palette": {"vegetal": "#68a23e"}}, "automne": {"palette": {"vegetal": "#8c5229"}}, "hiver": {}},
    "hetre": {"printemps": {"palette": {"vegetal": "#74ac44"}}, "automne": {"palette": {"vegetal": "#b8642a"}}, "hiver": {}},
    "orme": {"printemps": {"palette": {"vegetal": "#62a03a"}}, "automne": {"palette": {"vegetal": "#d8ac34"}}, "hiver": {}},
    "buisson": {"printemps": {"palette": {"vegetal": "#5e9c42"}}, "automne": {"palette": {"vegetal": "#7a2422"}}, "hiver": {}},
}

# Triangles montrés à la fois : d'un décor caduc, la plus lourde de ses deux tenues, en feuilles ou en ramure d'hiver.
BUDGET_TRIANGLES = {"arbre": 4000, "hetre": 4000, "orme": 4000, "pin": 4000, "arbre-mort": 1500, "souche": 1200, "buisson": 2000}

ANGLE_LISSE = {"ecorce": 40, "bois-mort": 40, "tiges": 40, "feuillage": 5}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`) : le feuillage reste facetté."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

# Section d'une branche : côtés ; écart de rayon propre à chaque côté sur toute la longueur (stries) et à chaque sommet
# (grain), en fraction du rayon ; vrille des stries (rad/m) ; anneaux par tronçon du chemin (pas) ; écart latéral (m) des
# anneaux intercalés, qui brise la courbe ; longueur de la pointe (fois le dernier rayon).
SECTIONS = {
    "tronc": {"cotes": 10, "stries": 0.12, "grain": 0.04, "torsion": 0.5, "pas": 2, "ecart": 0.0, "pointe": 2.0},
    "tronc-lisse": {"cotes": 12, "stries": 0.025, "grain": 0.012, "torsion": 0.0, "pas": 2, "ecart": 0.0, "pointe": 2.0},
    "tronc-de-pin": {"cotes": 9, "stries": 0.10, "grain": 0.05, "torsion": 0.3, "pas": 2, "ecart": 0.0, "pointe": 2.0},
    "charpentiere": {"cotes": 6, "stries": 0.10, "grain": 0.05, "torsion": 0.0, "pas": 2, "ecart": 0.012, "pointe": 2.0},
    "rameau": {"cotes": 4, "stries": 0.0, "grain": 0.08, "torsion": 0.0, "pas": 1, "ecart": 0.0, "pointe": 3.0},
    "tronc-mort": {"cotes": 10, "stries": 0.20, "grain": 0.05, "torsion": 1.5, "pas": 4, "ecart": 0.0, "pointe": 1.0},
    "branche-morte": {"cotes": 6, "stries": 0.14, "grain": 0.07, "torsion": 0.8, "pas": 2, "ecart": 0.022, "pointe": 4.0},
    "racine": {"cotes": 6, "stries": 0.15, "grain": 0.07, "torsion": 0.0, "pas": 2, "ecart": 0.012, "pointe": 2.5},
    "tige": {"cotes": 4, "stries": 0.0, "grain": 0.10, "torsion": 0.0, "pas": 2, "ecart": 0.012, "pointe": 2.0},
}

CASSURE = ((0.25, 1.6), 0.55, 1.2)
"""Le bout cassé d'une branche morte, en fractions de son dernier rayon : hauteurs des éclats du bord, rayon de la paroi
intérieure, profondeur du fond."""

MOIGNON = ((0.5, 0.3), (1.0, 0.8, 0.6))
"""Le moignon d'une branche morte sur un fût : son coude (part de sa longueur, part de sa montée), et sa section à ses
trois points (fractions du rayon de son départ)."""

# Ramure d'hiver d'une masse de feuillage, en fractions de sa taille : brindilles par mètre de taille et leur minimum,
# côtés de leur section ; élévation (degrés) du point que vise une brindille autour du centre de la masse, et sa
# distance à ce centre (les satellites portent la masse au-delà de sa taille) ; son coude (part de sa course) et son
# bombé, qui sont aussi ceux de ses fourches, son écart de côté ; sa section au départ et au coude ; ses fourches : où
# chacune la quitte (part de sa course), leur écart d'azimut (degrés), l'élévation et la distance du point où elles
# finissent, leur section au départ et au coude.
RAMURE = {"par_metre": 12, "minimum": 2, "cotes": 3, "elevation": (0, 65), "portee": (1.10, 1.55), "coude": 0.45,
          "bombe": 0.12, "travers": 0.15, "rayons": (0.050, 0.032), "fourches": (0.40, 0.70), "ecart": (30, 75),
          "elevation_des_fourches": (-10, 70), "portee_des_fourches": (0.75, 1.30), "rayons_des_fourches": (0.024, 0.014)}

# Feuillage. Une masse est un bloc et ses satellites ; un bloc, un icosaèdre subdivisé une fois, de demi-largeur sa
# taille à `variation` près, de demi-hauteur `hauteur` fois sa taille, son dessous réduit d'`aplati` ; `lobes` et
# `creux` : nombre, amplitude (fraction du rayon, tirée dans la part `amplitude`) et exposant de bosses et d'entailles
# de directions tirées ; `grain` : écart de chaque sommet ; `assise` : part de sa demi-hauteur dont le centre de la
# masse monte au-dessus du bout du bois ; `satellites` : tailles de masse à partir desquelles un satellite s'ajoute,
# leur écart au centre et leur hauteur (fractions de la taille de la masse), leur taille (fraction de la sienne).
FEUILLAGE = {
    "arbre": {"variation": 0.18, "hauteur": 0.72, "aplati": 0.55, "lobes": (4, 0.32, 2.0), "creux": (2, 0.28, 3.0),
              "amplitude": (0.4, 1.0), "grain": 0.10, "assise": 0.35,
              "satellites": ((0.26, 0.32, 0.38), 0.62, (-0.10, 0.40), (0.55, 0.80))},
    "hetre": {"variation": 0.10, "hauteur": 1.00, "aplati": 0.70, "lobes": (4, 0.24, 2.0), "creux": (1, 0.16, 3.0),
              "amplitude": (0.4, 1.0), "grain": 0.08, "assise": 0.30,
              "satellites": ((0.33,), 0.55, (-0.25, 0.25), (0.60, 0.75))},
    "orme": {"variation": 0.20, "hauteur": 0.68, "aplati": 0.50, "lobes": (4, 0.30, 2.0), "creux": (2, 0.24, 3.0),
             "amplitude": (0.4, 1.0), "grain": 0.10, "assise": 0.40,
             "satellites": ((0.30, 0.34), 0.68, (-0.05, 0.25), (0.55, 0.80))},
    "pin": {"variation": 0.22, "hauteur": 0.36, "aplati": 0.40, "lobes": (5, 0.30, 2.0), "creux": (2, 0.25, 3.0),
            "amplitude": (0.4, 1.0), "grain": 0.10, "assise": 0.45,
            "satellites": ((0.14, 0.19, 0.23), 0.78, (-0.10, 0.14), (0.60, 0.85))},
    "buisson": {"variation": 0.20, "hauteur": 0.85, "aplati": 0.60, "lobes": (4, 0.36, 2.0), "creux": (2, 0.30, 3.0),
                "amplitude": (0.4, 1.0), "grain": 0.12, "assise": 0.10,
                "satellites": ((0.20, 0.25, 0.28), 0.65, (-0.15, 0.45), (0.55, 0.80))},
}

# Un arbre. `tronc` : la section de son fût (`SECTIONS`) ; `chemin`, `rayons` : le tronc et sa flèche, son rayon à chaque
# point ; `contreforts` de racines : azimuts, saillie (fraction du rayon), hauteur de décroissance (m), exposant du
# lobe ; `cime` : taille de la masse au bout de la flèche. Une charpentière : hauteur de son départ sur le tronc, azimut,
# portée (m, à l'horizontale), montée (m), rayon à son départ, taille de la masse à son bout ; ses rameaux : (position sur
# la charpentière de 0 à 1, écart d'azimut, longueur, montée, taille de la masse). `fleche` : les rameaux de la flèche,
# (hauteur du départ, azimut, longueur, montée, taille de la masse). `coude` d'un rameau : sa position entre le départ
# et le bout, son bombé (part de la montée), son écart de côté (m). `arc` : les deux points intermédiaires d'une
# charpentière, (part de la portée, part de la montée). `rayons_charpentiere` : sa section aux quatre points, fraction
# du rayon du départ ; `rayons_rameau` : la section d'un rameau à ses trois points (m). `enfoui` : part du rayon du
# porteur dont le départ d'une branche s'écarte de son axe. `moignons` de branches mortes sur le fût : (hauteur, azimut,
# longueur, montée, rayon).
ARBRES = {
    "arbre": {
        "tronc": "tronc",
        "chemin": [(0.0, 0.0, 0.0), (0.03, -0.02, 0.70), (-0.03, 0.03, 1.45), (0.03, 0.02, 2.30), (-0.03, -0.03, 3.10), (0.0, 0.0, 3.80)],
        "rayons": [0.125, 0.112, 0.100, 0.070, 0.042, 0.018],
        "contreforts": ((20, 95, 165, 240, 310), 0.60, 0.16, 3),
        "cime": 0.32,
        "charpentieres": [
            {"depart": 1.20, "azimut": 25, "portee": 0.50, "montee": 0.85, "rayon": 0.062, "masse": 0.42,
             "rameaux": [(0.50, -75, 0.30, 0.10, 0.24), (0.75, 70, 0.28, 0.45, 0.26)]},
            {"depart": 1.35, "azimut": 150, "portee": 0.52, "montee": 1.00, "rayon": 0.058, "masse": 0.40,
             "rameaux": [(0.45, 65, 0.32, 0.10, 0.24), (0.80, -80, 0.26, 0.42, 0.22)]},
            {"depart": 1.28, "azimut": 268, "portee": 0.48, "montee": 0.80, "rayon": 0.060, "masse": 0.43,
             "rameaux": [(0.50, 70, 0.30, 0.20, 0.22), (0.70, -60, 0.30, 0.55, 0.27)]},
            {"depart": 1.70, "azimut": 335, "portee": 0.36, "montee": 1.20, "rayon": 0.048, "masse": 0.36,
             "rameaux": [(0.55, 60, 0.24, 0.30, 0.20)]},
        ],
        "fleche": [(2.40, 95, 0.44, 0.50, 0.38), (2.75, 210, 0.42, 0.45, 0.36), (3.10, 330, 0.32, 0.36, 0.30), (3.40, 120, 0.22, 0.22, 0.22)],
        "coude": (0.5, 0.15, 0.04),
        "arc": ((0.40, 0.12), (0.80, 0.55)),
        "rayons_charpentiere": (1.0, 0.80, 0.55, 0.30),
        "rayons_rameau": (0.022, 0.014, 0.007),
        "enfoui": 0.5,
        "moignons": [],
    },
    "hetre": {
        "tronc": "tronc-lisse",
        "chemin": [(0.0, 0.0, 0.0), (0.02, -0.01, 1.20), (-0.02, 0.02, 2.40), (0.01, 0.0, 3.50), (0.0, -0.01, 4.40), (0.0, 0.0, 4.82)],
        "rayons": [0.140, 0.126, 0.110, 0.076, 0.040, 0.016],
        "contreforts": ((35, 110, 190, 265, 330), 0.22, 0.14, 3),
        "cime": 0.26,
        "charpentieres": [
            {"depart": 2.15, "azimut": 30, "portee": 0.24, "montee": 0.40, "rayon": 0.050, "masse": 0.32,
             "rameaux": [(0.60, 60, 0.20, 0.30, 0.24)]},
            {"depart": 2.30, "azimut": 150, "portee": 0.24, "montee": 0.50, "rayon": 0.052, "masse": 0.33,
             "rameaux": [(0.55, 60, 0.20, 0.28, 0.24)]},
            {"depart": 2.22, "azimut": 270, "portee": 0.24, "montee": 0.45, "rayon": 0.050, "masse": 0.31,
             "rameaux": [(0.60, 60, 0.20, 0.30, 0.24)]},
            {"depart": 2.60, "azimut": 90, "portee": 0.33, "montee": 0.70, "rayon": 0.046, "masse": 0.36, "rameaux": []},
            {"depart": 2.70, "azimut": 210, "portee": 0.33, "montee": 0.75, "rayon": 0.046, "masse": 0.36, "rameaux": []},
            {"depart": 2.80, "azimut": 330, "portee": 0.33, "montee": 0.70, "rayon": 0.044, "masse": 0.36, "rameaux": []},
        ],
        "fleche": [(3.20, 30, 0.31, 0.50, 0.37), (3.35, 150, 0.31, 0.50, 0.37), (3.50, 270, 0.31, 0.50, 0.37),
                   (3.90, 90, 0.20, 0.45, 0.33), (4.00, 210, 0.20, 0.45, 0.33), (4.10, 330, 0.20, 0.40, 0.32),
                   (4.40, 60, 0.12, 0.30, 0.27), (4.45, 240, 0.12, 0.28, 0.26)],
        "coude": (0.5, 0.10, 0.03),
        "arc": ((0.30, 0.25), (0.70, 0.65)),
        "rayons_charpentiere": (1.0, 0.80, 0.55, 0.30),
        "rayons_rameau": (0.020, 0.013, 0.006),
        "enfoui": 0.5,
        "moignons": [],
    },
    "orme": {
        "tronc": "tronc",
        "chemin": [(0.0, 0.0, 0.0), (0.02, 0.02, 0.90), (-0.02, 0.0, 1.80), (0.03, -0.02, 2.60), (0.0, 0.02, 3.50), (0.0, 0.0, 4.25)],
        "rayons": [0.165, 0.150, 0.135, 0.066, 0.038, 0.016],
        "contreforts": ((10, 80, 150, 225, 300), 0.30, 0.16, 3),
        "cime": 0.35,
        "charpentieres": [
            {"depart": 1.75, "azimut": 15, "portee": 0.52, "montee": 2.45, "rayon": 0.072, "masse": 0.33,
             "rameaux": [(0.42, 70, 0.30, 0.35, 0.25), (0.62, -65, 0.28, 0.50, 0.27), (0.85, 70, 0.26, 0.22, 0.25)]},
            {"depart": 1.90, "azimut": 88, "portee": 0.50, "montee": 2.25, "rayon": 0.066, "masse": 0.32,
             "rameaux": [(0.44, -70, 0.30, 0.35, 0.25), (0.60, 60, 0.28, 0.55, 0.26), (0.85, -70, 0.24, 0.25, 0.24)]},
            {"depart": 1.80, "azimut": 160, "portee": 0.54, "montee": 2.50, "rayon": 0.070, "masse": 0.33,
             "rameaux": [(0.42, 65, 0.30, 0.30, 0.26), (0.65, -60, 0.28, 0.45, 0.27), (0.88, 65, 0.24, 0.18, 0.24)]},
            {"depart": 2.00, "azimut": 235, "portee": 0.50, "montee": 2.20, "rayon": 0.064, "masse": 0.32,
             "rameaux": [(0.44, -65, 0.30, 0.35, 0.25), (0.60, 65, 0.28, 0.55, 0.26), (0.85, -60, 0.26, 0.25, 0.25)]},
            {"depart": 1.85, "azimut": 305, "portee": 0.52, "montee": 2.40, "rayon": 0.068, "masse": 0.33,
             "rameaux": [(0.42, 60, 0.30, 0.32, 0.26), (0.62, -60, 0.28, 0.50, 0.27), (0.86, 60, 0.24, 0.20, 0.24)]},
        ],
        "fleche": [(3.20, 50, 0.32, 0.65, 0.28), (3.40, 190, 0.32, 0.60, 0.28), (3.70, 300, 0.28, 0.45, 0.26)],
        "coude": (0.5, 0.15, 0.04),
        "arc": ((0.14, 0.34), (0.48, 0.74)),
        "rayons_charpentiere": (1.0, 0.82, 0.58, 0.30),
        "rayons_rameau": (0.022, 0.014, 0.007),
        "enfoui": 0.5,
        "moignons": [],
    },
    "pin": {
        "tronc": "tronc-de-pin",
        "chemin": [(0.0, 0.0, 0.0), (0.03, 0.0, 1.20), (-0.02, 0.03, 2.40), (0.03, -0.02, 3.60), (0.0, 0.02, 4.40), (0.0, 0.0, 4.95)],
        "rayons": [0.115, 0.100, 0.088, 0.070, 0.040, 0.016],
        "contreforts": ((40, 130, 215, 300), 0.20, 0.12, 3),
        "cime": 0.17,
        "charpentieres": [
            {"depart": 3.55, "azimut": 20, "portee": 0.37, "montee": 0.22, "rayon": 0.040, "masse": 0.25, "rameaux": []},
            {"depart": 3.70, "azimut": 110, "portee": 0.35, "montee": 0.20, "rayon": 0.038, "masse": 0.24, "rameaux": []},
            {"depart": 3.60, "azimut": 200, "portee": 0.38, "montee": 0.24, "rayon": 0.040, "masse": 0.25, "rameaux": []},
            {"depart": 3.72, "azimut": 290, "portee": 0.35, "montee": 0.18, "rayon": 0.038, "masse": 0.24, "rameaux": []},
            {"depart": 4.18, "azimut": 65, "portee": 0.29, "montee": 0.20, "rayon": 0.030, "masse": 0.21, "rameaux": []},
            {"depart": 4.25, "azimut": 185, "portee": 0.29, "montee": 0.18, "rayon": 0.030, "masse": 0.21, "rameaux": []},
            {"depart": 4.20, "azimut": 305, "portee": 0.28, "montee": 0.20, "rayon": 0.030, "masse": 0.20, "rameaux": []},
        ],
        "fleche": [(4.62, 130, 0.13, 0.12, 0.15), (4.66, 310, 0.12, 0.12, 0.14)],
        "coude": (0.5, 0.10, 0.02),
        "arc": ((0.45, 0.15), (0.80, 0.50)),
        "rayons_charpentiere": (1.0, 0.80, 0.55, 0.30),
        "rayons_rameau": (0.016, 0.011, 0.006),
        "enfoui": 0.5,
        "moignons": [(2.10, 70, 0.22, 0.06, 0.030), (2.85, 230, 0.27, 0.08, 0.030), (3.20, 340, 0.20, 0.05, 0.025), (1.45, 170, 0.12, 0.03, 0.028)],
    },
}

ARBRE_MORT = {
    "chemin": [(0.0, 0.0, 0.0), (0.03, -0.02, 0.60), (-0.04, 0.03, 1.15), (0.02, 0.0, 1.60)],
    "rayons": [0.150, 0.142, 0.125, 0.112],
    "contreforts": ((-25, 115, 200, 290), 0.42, 0.14, 3),
    # cavité : hauteur, azimut, demi-hauteur (m), demi-ouverture (degrés), profondeur (fraction du rayon)
    "creux": [(1.12, -80, 0.26, 62, 0.85)],
    # bourrelet de la cavité : part de l'ouverture où court sa crête, saillie et largeur (fractions), côtés, grain
    "bourrelet": (0.80, 0.20, 0.25, 8, 0.05),
    # lanières d'écorce restées au pied : épaisseur (m), hauteur où chacune s'arrête (m, tirée entre ces bornes), part
    # du tronçon suivant dont son bord déchiré remonte
    "ecorce": (0.022, (0.25, 0.85), 0.8),
    # branches : chemin, rayons, bout cassé ou en pointe
    "branches": [
        {"chemin": [(0.02, 0.0, 1.55), (-0.07, 0.03, 1.95), (-0.04, -0.02, 2.28), (-0.11, 0.01, 2.52)],
         "rayons": [0.105, 0.078, 0.060, 0.048], "casse": True},
        {"chemin": [(0.03, 0.0, 1.38), (0.27, -0.02, 1.68), (0.49, 0.03, 1.84), (0.69, 0.0, 2.06), (0.76, 0.0, 2.43)],
         "rayons": [0.085, 0.066, 0.052, 0.038, 0.016], "casse": False},
        {"chemin": [(-0.07, 0.02, 2.02), (-0.26, 0.0, 2.27), (-0.40, 0.03, 2.37), (-0.55, 0.0, 2.50)],
         "rayons": [0.045, 0.036, 0.026, 0.012], "casse": False},
        {"chemin": [(-0.06, 0.02, 1.90), (-0.01, 0.24, 2.10), (-0.04, 0.44, 2.19), (0.01, 0.64, 2.31)],
         "rayons": [0.050, 0.040, 0.028, 0.012], "casse": False},
        {"chemin": [(0.49, 0.03, 1.84), (0.47, 0.15, 1.99), (0.41, 0.23, 2.07)],
         "rayons": [0.034, 0.028, 0.022], "casse": True},
        {"chemin": [(0.69, 0.0, 2.06), (0.60, -0.03, 2.20), (0.56, -0.02, 2.36)],
         "rayons": [0.024, 0.018, 0.007], "casse": False},
        # moignons
        {"chemin": [(-0.02, 0.0, 0.82), (-0.13, -0.05, 0.90), (-0.17, -0.06, 0.96)], "rayons": [0.05, 0.042, 0.036], "casse": True},
        {"chemin": [(0.0, 0.02, 1.24), (0.06, 0.13, 1.33), (0.07, 0.17, 1.40)], "rayons": [0.045, 0.036, 0.030], "casse": True},
    ],
    "racines": [
        {"chemin": [(0.06, -0.04, 0.20), (0.20, -0.12, 0.09), (0.37, -0.15, 0.03)], "rayons": [0.075, 0.050, 0.020]},
        {"chemin": [(-0.07, 0.05, 0.18), (-0.17, 0.17, 0.08), (-0.20, 0.32, 0.03)], "rayons": [0.070, 0.046, 0.018]},
    ],
}

SOUCHE = {
    "rayons": 18,                           # rayons réguliers du plan de la souche, auxquels s'ajoutent ceux des gerces
    "profil": [(0.0, 0.330), (0.04, 0.315), (0.10, 0.295), (0.22, 0.282), (0.32, 0.278)],   # (hauteur, rayon) du fût
    "stries": 0.07,
    "grain": 0.025,
    "contreforts": ((0, 128, 270, 60, 200), 0.16, 0.10, 4),
    "coupe": 0.385,                         # hauteur de la coupe en son centre
    "pente": (0.05, 200),                   # pente de la coupe (m par m) et azimut vers lequel elle monte
    "lisiere": 0.010,                       # écart de hauteur de chaque sommet du bord d'écorce
    "cernes": (0.80, 0.58, 0.36, 0.16),     # gradins de la coupe (fraction du rayon), chacun plus bas que le précédent
    "gradin": 0.006,
    "coeur": 0.030,                         # creux du cœur sous le dernier gradin
    "relief": 0.003,                        # écart de hauteur de chaque sommet de la coupe
    # entaille d'abattage : azimut de la chute, distance du centre où elle commence (m), pente
    "entaille": (75, 0.13, 0.55),
    # charnière : nombre d'éclats, demi-longueur de la lèvre (m), largeurs et épaisseur d'un éclat (m), hauteurs (m),
    # dévers de côté (m), couché de la pointe vers la chute (m)
    "charniere": (8, 0.19, (0.035, 0.075), 0.018, (0.010, 0.065), 0.012, (0.005, 0.035)),
    # gerces : (azimut, demi-ouverture en degrés, fraction du rayon où elle commence, profondeur en m)
    "gerces": [(170, 2.5, 0.20, 0.035), (250, 2.0, 0.40, 0.028), (318, 2.5, 0.30, 0.032)],
    "gerce_au_flanc": (0.12, 0.10),         # la gerce sur le fût : rentrant (fraction du rayon), hauteur de décroissance (m)
    "racines": [
        {"chemin": [(0.22, 0.0, 0.14), (0.33, 0.03, 0.08), (0.43, -0.02, 0.045), (0.52, 0.01, 0.015)], "rayons": [0.060, 0.045, 0.030, 0.012]},
        {"chemin": [(-0.18, -0.12, 0.13), (-0.25, -0.22, 0.075), (-0.33, -0.27, 0.04), (-0.38, -0.35, 0.015)], "rayons": [0.058, 0.042, 0.028, 0.012]},
        {"chemin": [(0.0, 0.22, 0.13), (0.03, 0.33, 0.075), (-0.02, 0.43, 0.04), (0.01, 0.53, 0.015)], "rayons": [0.056, 0.042, 0.028, 0.012]},
        {"chemin": [(0.17, 0.17, 0.10), (0.24, 0.27, 0.05), (0.27, 0.36, 0.02)], "rayons": [0.045, 0.030, 0.010]},
        {"chemin": [(-0.22, 0.10, 0.10), (-0.32, 0.13, 0.05), (-0.41, 0.19, 0.02)], "rayons": [0.042, 0.028, 0.010]},
    ],
}

BUISSON = {
    # masses de feuillage : centre, taille
    "masses": [((0.02, 0.02, 0.44), 0.30), ((0.30, -0.24, 0.27), 0.26), ((-0.30, 0.19, 0.25), 0.25),
               ((0.06, 0.0, 0.68), 0.19), ((-0.24, -0.26, 0.20), 0.19), ((0.26, 0.24, 0.20), 0.18),
               ((-0.03, 0.36, 0.16), 0.15), ((0.40, 0.02, 0.15), 0.13), ((-0.02, -0.38, 0.15), 0.14)],
    "pied": (0.03, 0.07),                   # distance de l'ancre d'où part une tige, tirée entre ces bornes
    "rayons_tige": (0.016, 0.012, 0.006),   # section d'une tige au pied, à mi-course et sous sa masse (m)
    "coude": (0.35, 0.60),                  # le point de mi-course d'une tige : part de sa portée, part de sa montée
    # tiges nues, qui percent le feuillage : (azimut, portée, hauteur)
    "brindilles": [(120, 0.47, 0.50), (215, 0.50, 0.56), (20, 0.50, 0.58), (300, 0.22, 0.88)],
}
