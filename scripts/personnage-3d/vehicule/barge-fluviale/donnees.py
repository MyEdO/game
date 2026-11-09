"""Données de la barge fluviale (fiche `barge-fluviale` de `src/data/vehicles.json`, Barge Moyenne, MSRC 07 l.176 ;
#3790) : véhicule sans base, en mètres. Illustrations (`INDEX.md` du recueil `bateaux-wfrp`) : directrice, la planche
du Bérébéli, chaland de Josef (l.26 : profil, plan « Main Deck », intérieur de la cabine) ; la Barge Moyenne de MSRC
(l.21). Hypothèses, qu'aucune ne donne : la tête du mât à 10 m ; la plate-forme de proue sur deux cases ; le rouf d'une
seule hauteur ; boucliers et lances de la planche omis (équipement de l'équipage).

Repère Blender : z vers le haut, z = 0 à la ligne de flottaison, la proue vers -y, bâbord vers +x. L'export glTF
(y vers le haut) place la proue vers +z. L'origine est le centre du plan de jeu, comme l'hôte le pose.

Ponts : la source unique `ponts` de la fiche (`plan_de_jeu.py`) donne l'emprise de chaque pont, la hauteur de
chaque case, ses cloisons, portes et échelles ; une case mesure `CASE` mètres. La coque (15 m, MSRC 07 l.176) est
centrée sur les 16 m du plan ; ses largeurs suivent le rapport du plan « Main Deck » de la planche (75 × 23 pieds).

Abscisse `f` de la forme de coque : 0 à l'étrave, 1 à l'étambot, au plat-bord ; elle suit le plan linéairement
(`CALAGE` et `COPLE` sur le rouf). Mesures : profil de la planche (74 px/m pour 1 110 px de coque), plan du pont.
"""

# Mètres par case du plan (`sceneMetresPerTile`, LDB 15 l.12).
CASE = 2.0
# Calage de f sur le plus haut pont : le rouf (glyphe « r », cases 3 à 5) ; f = (x du plan - 0.25) / 7.5.
CALAGE = {"r": (2.75 / 7.5, 5.75 / 7.5)}
# Maître-couple : f de ses bouts, longueurs de l'entrée et de la sortie qui gardent f linéaire sur le plan.
COPLE = {"f": (0.45, 0.55), "entree": 1.25, "sortie": 3.25}
# Le pont dont les cases les plus basses de chaque colonne donnent le pont principal, sous le pavois.
PONT_PRINCIPAL = 1
# Glyphes des ponts nommés : pont principal (et plancher des cabines), plate-forme de proue, plate-forme de poupe, toit
# du rouf.
GLYPHES = {"pont": "p", "proue": "g", "poupe": "a", "toit": "r"}
# Sous chaque pont couvrant : épaisseur, paroi de la pièce creusée dessous (« bord » : le bordé, décalé vers l'intérieur),
# None sous les plates-formes, ouvertes sur le pont. Les cabines se creusent dans le rouf, à `ROUF["retrait"]` du
# plat-bord plus l'épaisseur de ses murs (0.12 m).
SOUS_LES_PONTS = {
    "p": {"epaisseur": 0.10, "paroi": ("bord", -0.15)},
    "r": {"epaisseur": 0.12, "paroi": ("bord", -0.42)},
    "g": {"epaisseur": 0.15, "paroi": None},
    "a": {"epaisseur": 0.15, "paroi": None},
}
# Muraille laissée au bout d'une pièce creusée devant une cloison du plan qui ne donne sur aucune pièce.
MURAILLE = 0.15

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
MATERIAUX = {"bois": ("bois", "bois-chene"), "toile": ("vet1", "toile-ecrue"), "rayure": ("vet2", "toile-rouge"),
             "fer": ("metal", "fer-noirci"), "cordage": ("cuir", "corde")}
# Surface qui reçoit l'emblème du bateau (manifeste `blason`) : le pavillon de poupe.
BLASONS = ("rayure",)

# Forme vue de dessus (plan « Main Deck ») : demi-largeur relative selon u (0 à l'étrave, 1 à l'étambot) ; l'étrave est
# un avant plat étroit sous la plate-forme de proue ; au-delà de u = 0.7 la coque se resserre jusqu'au rapport de
# tableau `s` de chaque niveau.
FORME_PLAN = [(0.0, 0.25), (0.05, 0.36), (0.09, 0.46), (0.14, 0.62), (0.19, 0.76), (0.25, 0.87), (0.3, 0.93),
              (0.37, 0.98), (0.43, 1.0), (0.7, 1.0)]
FORME_POUPE = (0.7, 2.0)        # u où commence le resserrement, exposant

STATIONS = [0.0, 0.02, 0.05, 0.09, 0.14, 0.19, 0.25, 0.3, 0.37, 0.43, 0.55, 0.7, 0.78, 0.85, 0.91, 0.96, 1.0]

# Niveaux de coque, du fond plat au plat-bord : (z ou "lisse", demi-largeur max, f d'étrave, f d'étambot, rapport de
# tableau, saillie). La saillie entre z = 0.95 et 1.05 est la préceinte. Demi-largeur au plat-bord : 23 / 75 de la
# longueur, la moitié (plan « Main Deck »).
NIVEAUX = [
    (-0.8, 1.70, 0.160, 0.880, 0.40, 0.0),
    (-0.65, 1.95, 0.110, 0.920, 0.48, 0.0),
    (-0.4, 2.15, 0.075, 0.945, 0.56, 0.0),
    (0.0, 2.27, 0.045, 0.962, 0.65, 0.0),
    (0.6, 2.30, 0.022, 0.978, 0.72, 0.0),
    (0.95, 2.30, 0.014, 0.984, 0.74, 0.08),
    (1.05, 2.30, 0.012, 0.985, 0.74, 0.08),
    (1.1, 2.30, 0.011, 0.986, 0.75, 0.0),
    ("lisse", 2.30, 0.0, 1.0, 0.76, 0.0),
]

# Hauteur du plat-bord selon f : l'étrave montée sous la plate-forme de proue, 0.55 m au-dessus du pont au milieu
# (1.28 m au-dessus de l'eau, profil), relevée à la poupe sous sa plate-forme.
LISSE = [(0.0, 2.95), (0.05, 2.2), (0.1, 1.7), (0.17, 1.42), (0.3, 1.33), (0.75, 1.33), (0.86, 1.55), (0.93, 1.9),
         (1.0, 2.3)]
PAVOIS = (0.18, 0.30)           # retrait du plat-bord vers l'intérieur : en x, en y aux deux bouts

# Rouf : murs en retrait du plat-bord (plan « Main Deck » : 4 m de large sur 4.6), de l'abscisse de sa première case
# à celle d'après sa dernière (cases du glyphe « r ») ; toit au pont « r ». Garde-corps du toit (hauteur, pas des
# montants, section), hublots de l'avant (abscisses en cases, z, rayon) et fenêtres de l'arrière (abscisses, z,
# largeur, hauteur) sur ses deux flancs, d'après le profil.
ROUF = {"retrait": 0.3, "garde_corps": (0.9, 0.95, 0.09), "hublots": ((3.3, 3.95), 1.85, 0.17),
        "fenetres": ((4.75, 5.45), 1.8, 0.48, 0.42)}

# Plates-formes de proue et de poupe sur leurs cases (glyphes « g » et « a ») : débord au-delà du plat-bord, piliers (x, abscisse en cases,
# repris aux deux bords) qui les portent depuis le pont ; garde-corps (hauteur, pas des montants, section), ouvert
# au-dessus de la trappe de son échelle sur `ouverture` de part et d'autre de l'axe. Celle de proue couvre deux cases
# (la planche n'en montre qu'une, 1.36 m) : sa pièce et la trappe de son échelle ne tiennent pas sur une seule.
PLATEFORMES = {
    "g": {"debord": 0.15, "piliers": ((0.95, 1.0), (1.6, 1.95)), "section": 0.18},
    "a": {"debord": 0.10, "piliers": ((1.6, 7.03),), "section": 0.18},
}
GARDE_CORPS = {"hauteur": 0.75, "pas": 0.75, "section": 0.08, "ouverture": 0.65}

# Écoutilles aux échelles du plan, dans le pont du dessus au-dessus de la trappe, depuis l'arête de l'échelle :
# ouverture (en travers, le long de l'échelle), hiloire (largeur, hauteur). Échelles de meunier : largeur, pente,
# montants (profondeur, épaisseur), barreaux (rayon, pas vertical).
ECOUTILLE = {"ouverture": (1.0, 0.9), "hiloire": (0.10, 0.20)}
ECHELLE = {"largeur": 0.5, "pente": 72.0, "montant": (0.09, 0.05), "barreau": (0.022, 0.30)}
# Cloisons du plan (épaisseur, débord, épaisseur d'une cloison sous un seul pont couvert : la façade du rouf) et leurs
# portes (`navire.py`, `vantail`).
CLOISON = {"epaisseur": 0.10, "marge": 0.03, "sous_un_pont": 0.12}
PORTE = {"largeur": 0.80, "hauteur": 1.80, "jeu": 0.10, "planche": 0.16, "joint": 0.012, "epaisseur": 0.05,
         "cadre": (0.09, 0.16), "penture": (0.07, 0.015), "anneau": 0.06}
# Cale : membrures le long des murailles (pas, section), baux sous le pont du dessus.
MEMBRURES = {"pas": 0.6, "section": (0.13, 0.10), "baux": (0.14, 0.10)}
# Emprise libre des cases (`cases` du manifeste, `navire.emprises`) : pas de la grille de sondes, hauteur d'où chacune
# descend (sous les baux de la cale, 1.3 m sous barrot), écart toléré (une épaisseur de cloison), en mètres.
EMPRISE = {"pas": 0.05, "stature": 1.0, "ecart": 0.10}

# Bâches de la cargaison sur le pont avant (plan « Main Deck », profil) : de l'abscisse a à b en cases, une par bord de
# part et d'autre de l'allée axiale (rang du milieu), hiloire de l'écoutille de charge (hauteur, largeur), sommet de la bâche au-dessus
# du pont, sangles croisées (nombre de croix, section).
BACHES = {"abscisses": (2.05, 2.95), "allee": 1.0, "hiloire": (0.22, 0.12), "sommet": 1.45, "croix": 2, "sangle": 0.05}

# Bandes verticales du bordé (profil) : abscisses en cases, de z au plat-bord, section, saillie.
BANDES = {"abscisses": (1.83, 3.03, 4.15, 4.6, 5.73, 6.55), "z": -0.25, "section": 0.11, "saillie": 0.06}

# Mât : abscisse en cases (profil : juste derrière la façade du rouf), z de l'emplanture et de la tête, rayons ; vergue
# de la voile au tiers, voile ferlée dessous (bouts en cases et z, rayons, décalage du mât en x), rabans (nombre,
# rayon) ; haubans (z du capelage, abscisses des cadènes au plat-bord) et étai vers la plate-forme de proue (z de son
# pied sur le garde-corps avant).
MAT = {"abscisse": 3.45, "emplanture": -0.6, "tete": 10.0, "rayons": (0.17, 0.09)}
VERGUE = {"de": (1.0, 4.4), "a": (5.8, 10.6), "rayons": (0.10, 0.06), "x": 0.25, "ferlee": (0.24, 0.12), "rabans": 9}
HAUBANS = {"capelage": 9.3, "cadenes": (2.95, 4.05)}
ETAI = 3.7
CORDAGE = {"hauban": 0.05, "etai": 0.06, "raban": 0.03}

# Fanaux sur les garde-corps (profil) : (x, abscisse en cases, glyphe du plancher), hampe, lanterne (hauteur, rayon).
FANAUX = {"points": [(-0.85, 0.3, "g"), (0.85, 0.3, "g"), (1.55, 7.75, "a")], "hampe": 1.0, "lanterne": (0.45, 0.13)}

# Aviron de queue de la poupe (plan « Main Deck » : la barre qui dépasse à tribord de l'arrière) : la poignée, le
# tolet sur le couronnement et le bout de la pale, en (x, abscisse en cases, z) ; pale (longueur, largeur, épaisseur).
AVIRON = {"poignee": (-0.9, 7.125, 3.3), "tolet": (-1.0, 7.825, 2.95), "bout": (-1.25, 8.65, -0.35), "pale": (1.6, 0.5, 0.06),
          "rayon": 0.06}

# Pavillon de poupe sur sa hampe (profil : à l'arrière), en (x, abscisse en cases), z de la tête, toile
# longueur × hauteur, part de l'emblème.
PAVILLON = {"hampe": (-1.55, 7.75), "tete": 6.6, "toile": (1.5, 1.0), "blason": 0.75}

# Postes : où se montent les pièces d'un bord (manifeste `postes`), canons « montés à la proue, à la poupe ou sur les
# côtés » (MSRC 12 l.185), balistes et pierriers sur pivot (MSRC 12 l.170, l.215) : (bord, abscisse en cases, plancher,
# x ou None). Proue : sur l'axe de sa plate-forme, la bouche passée par-dessus le garde-corps avant, la crosse devant la
# trappe. Poupe : à bâbord de la trappe de sa plate-forme. Côtés (x None) : sur le pont, la bouche passée par-dessus le
# plat-bord de `RECUL` derrière sa face intérieure ; la coque de 4.6 m ne tenant qu'une pièce de travers par abscisse,
# tribord tire sous la plate-forme de proue et bâbord du pont arrière, entre le rouf et la plate-forme de poupe.
POSTES = [("proue", 0.7, "g", 0.0), ("poupe", 7.425, "a", 1.15), ("tribord", 1.5, "p", None), ("babord", 6.5, "p", None)]
RECUL = 0.95

# Revue (`revue.py`) : le véhicule revu, la pièce montée aux postes armés de chaque bord, les configurations rendues et les vues (profil,
# dessus, intérieur), en mètres glTF du manifeste.
REVUE = {
    "vehicule": "vehicule--barge-fluviale",
    "aux_postes": {"proue": "vehicule--canon-petit", "poupe": "vehicule--pierrier", "tribord": "vehicule--canon-petit",
                   "babord": "vehicule--canon-petit"},
    "configurations": [
        ("01-nue", "Sans arme ni Amélioration", {}, []),
        ("02-armee", "Armée : canons légers à la proue et aux deux bords, pierrier à la poupe", "tout", []),
    ],
    "gros_plans": [
        ("01-nue", "profil-tribord", (-48.0, 3.0, 0.0), (0.0, 3.0, 0.0), 60),
        ("02-armee", "profil-tribord-armee", (-48.0, 3.0, 0.0), (0.0, 3.0, 0.0), 60),
        ("02-armee", "dessus-armee", (0.0, 62.0, 0.01), (0.0, 0.0, 0.0), 55),
        ("01-nue", "interieur-cabine", (0.3, 2.2, -3.4), (-0.2, 1.1, 1.6), 14),
        ("01-nue", "interieur-cale", (0.4, 0.0, 5.6), (0.0, -0.3, 2.2), 14),
        ("02-armee", "pont-avant", (2.6, 4.2, -1.0), (-0.6, 1.4, 5.6), 18),
    ],
}
