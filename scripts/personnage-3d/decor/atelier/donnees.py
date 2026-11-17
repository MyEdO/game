"""Données de l'atelier (#4335) : un GLB par décor `enclume`, `foyer-de-forge`, `cuve-brasserie`, `marmite`,
`roue-dentee`, `scie-chevalet`, `rack-armes` et `rack-lances` de `src/data/props.json`, bâti dans l'enveloppe convexe
des primitives de sa recette (`gabarit.py`). Aucune illustration au corpus : proportions d'adaptation, chacune en
fraction de la primitive qui la porte (son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, le front
de la recette vers -y, z vers le haut) ; un azimut est un angle en degrés dans le plan du sol, de +x vers +y.

- `enclume` : le billot de la recette, un rondin debout à l'écorce frettée de fer ; le pied de l'enclume, à semelle,
  taille et épaulement, tenu par quatre crampons ; la table, amincie par dessous à son talon ; la bigorne, un cône
  couché dans le prisme de la recette, dont il suit la pente ; un marteau posé sur le billot.
- `foyer-de-forge` : le massif, le contrecœur, le linteau de la hotte et la souche de la cheminée en assises de
  pierres taillées, harpées aux angles, sur leur blocage ; la hotte en tronc de pyramide du linteau à la souche ; les
  deux piliers de la recette, à chanfreins arrêtés ; le lit de braises et ses charbons ; un soufflet couché sur le
  massif, deux flasques de bois, leur cuir, la buse de fer plantée dans les braises.
- `cuve-brasserie` : une cuve en tronc de cône, plus large au pied, de douves dressées sur leur blocage ; les deux
  cercles de fer de la recette ; le moût en contrebas du bord ; un fourquet, la pale au sol dans la boîte de la
  recette, le manche appuyé au bord.
- `marmite` : les trois perches de la recette, dressées, un bras de chacune à la clef, ligaturés de corde ; une chaîne
  de la clef à l'anse ; le chaudron ventru, creux sous sa lèvre, son ragoût et deux os ; dessous, le lit de braises, ses
  charbons, trois bûches et une bordure de pierres dégrossies, une par côté du foyer de la recette.
- `roue-dentee` : une roue dans le cylindre de la recette, jante, dents égales, rayons, moyeu de laiton à deux
  tourillons ; deux chevalets en A, un devant et un derrière la roue, palier et entretoise, sur deux longerons rivés et
  deux traverses ; le levier de la recette, son bras de fer pris au tourillon.
- `scie-chevalet` : deux croix de pieds chevillées, des pieds de la recette au berceau de la bûche, une entretoise
  par leurs croisées, une lisse par côté ; une bûche à la place du madrier de la recette ; la scie de la recette,
  engagée dans son trait, la lame dentée plus haute au talon, la poignée.
- `rack-armes` : la plinthe, les deux poteaux à chanfreins arrêtés et les deux traverses chevillées de la recette ;
  trois armes d'hast dont les hampes traversent les traverses, une hallebarde, une pertuisane et un vouge, la douille
  de fer et le fer d'acier de chacune dans la boîte des fers.
- `rack-lances` : deux joues à deux montants et deux traverses ; la tablette, deux planches ; la lisse chevillée aux
  joues, un tasseau par lance ; quatre lances penchées, le talon sur la tablette, la hampe au tasseau, la douille et le
  fer en feuille.

Partie émissive : le nœud `emet` (`NOEUD_EMISSIF` de `gabarit.py`) du foyer et de la marmite porte le lit de braises et
ses charbons, à l'aplomb du centre de la primitive `emet` de la recette.

Écarts aux recettes, tenus dans leur enveloppe. `roue-dentee` : les deux montants de la recette, dans le plan de la
roue, deviennent deux chevalets devant et derrière elle, et ses quatre dents en boîte une denture égale au rayon du
cylindre. `scie-chevalet` : les pieds se croisent, la poutre de la recette descend à leurs croisées, son madrier est
une bûche. `marmite` et `cuve-brasserie` : le ragoût se tient sous la lèvre du chaudron et le moût sous le bord de la
cuve, quand la recette les pose dessus ; la planche dressée contre la cuve est un fourquet, qui penche de sa boîte au
bord. `rack-lances` : les lances penchent, chaque pointe sous le rampant du prisme de la recette.

Matières : celles des recettes, sauf l'écorce des rondins (`bois-mort`, dont la texture est une écorce), le cuir du
soufflet (`cuir-tanne`), la corde des ligatures (`corde`), les os du ragoût (`os`), la bordure du foyer de la marmite
(`pierre-atre`), le bois du soufflet et le fer de sa buse (`bois-chene`, `fer-noirci`) et l'acier des lames
(`acier-battu`, plus clair que le `fer-noirci` que la recette leur donne, pour qu'un fer se lise sur sa hampe). Le
catalogue n'a ni charbon ni cendre (les charbons sont de `braises`), ni bière ni bouillon (`eau-dormante` pour le
moût et le ragoût).
Aucun emplacement de palette ne nomme la pierre ni l'os : ils prennent `corps` ; le cuir, la corde, l'eau et les
braises, `accent`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
BOIS = {"bois": ("bois", "bois-chene")}
ECORCE = {"ecorce": ("bois", "bois-mort")}
FER = {"fer": ("metal", "fer-noirci")}
ACIER = {"acier": ("metal2", "acier-battu")}
PIERRE = {"pierre": ("corps", "pierre-atre")}
EAU = {"eau": ("accent", "eau-dormante")}
BRAISES = {"braises": ("accent", "braises")}
MATERIAUX = {
    "enclume": {**BOIS, **ECORCE, **FER},
    "foyer-de-forge": {**PIERRE, **BOIS, **FER, "cuir": ("accent", "cuir-tanne"), **BRAISES},
    "cuve-brasserie": {**BOIS, **FER, **EAU},
    "marmite": {**BOIS, **ECORCE, **FER, **PIERRE, **EAU, "corde": ("accent", "corde"), "os": ("corps", "os"),
                **BRAISES},
    "roue-dentee": {**FER, "laiton": ("metal2", "laiton-dore"), **BOIS},
    "scie-chevalet": {**BOIS, **ECORCE, **ACIER},
    "rack-armes": {**BOIS, **FER, **ACIER},
    "rack-lances": {**BOIS, **FER, **ACIER},
}

BUDGET_TRIANGLES = {"enclume": 700, "foyer-de-forge": 5400, "cuve-brasserie": 2400, "marmite": 2500,
                    "roue-dentee": 2600, "scie-chevalet": 900, "rack-armes": 1100, "rack-lances": 1700}

ANGLE_LISSE = {"bois": 40, "ecorce": 40, "fer": 35, "acier": 30, "pierre": 30, "cuir": 40, "eau": 30, "corde": 50,
               "os": 45, "laiton": 35, "emet": 25}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : la pierre, l'acier et les
braises restent facettés, une pièce tournée est ronde."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

ARETE = 0.08
"""Chanfrein d'une arête adoucie, en fraction d'une cote pleine : du côté de la tête du marteau ; de la hauteur du
socle pour le bâti de la roue ; de la largeur d'un pied, puis du côté d'un pied de la recette, pour le chevalet ; de
la hauteur d'une traverse au râtelier ; au présentoir, de la hauteur de la lisse pour elle et ses tasseaux, de
l'épaisseur d'une joue pour ses traverses, de celle de la tablette pour ses planches."""

CLOU = (0.09, 0.06)
"""Tête de clou en pointe de diamant (`geometrie.clou`) : demi-côté et hauteur, en fractions d'un demi-côté, celui du
pied de l'enclume pour ses crampons, celui du socle, le long de l'essieu, pour les rivets des longerons de la roue."""

# Pierre taillée (`geometrie.moellon`), en fractions de sa demi-hauteur : `joint`, demi-joint laissé sur son pourtour ;
# `arete`, chanfrein de ses arêtes ; `parement`, recul de sa face (tiré entre ces bornes).
TAILLE = {"joint": 0.04, "arete": 0.08, "parement": (0.0, 0.05)}

# Charbon d'un lit de braises (`geometrie.charbons`) : `enfonce`, part de son demi-côté sous le lit ; `charbon`,
# demi-côté et hauteur (`geometrie.clou`, fractions de ce demi-côté).
CHARBON = {"enfonce": 0.3, "charbon": (1.0, 0.8)}

SEMELLE = 0.2
"""Dessus de la semelle de l'enclume, en part de la hauteur de son corps."""

# Enclume : rangs du billot, du pied, de la table et du prisme de la bigorne dans la recette.
ENCLUME = {
    "billot": 0, "pied": 1, "table": 2, "bigorne": 3,
    # Billot : rayon (fraction de l'apothème de celui de la recette) ; `rondin` (`modele.rondin`) : côtés, profil de
    # l'écorce (part de la longueur, part du rayon), `coupe` : retrait de l'écorce à chaque bout (fraction du rayon) et
    # rayon du bois (fraction du sien) ; `frette` : sa place (part de la hauteur du billot), sa hauteur (fraction de
    # celle-ci), son épaisseur (fraction du rayon du billot).
    "rayon": 0.95,
    "rondin": {"cotes": 12, "profil": ((0.0, 0.94), (0.04, 1.0), (0.96, 1.0), (1.0, 0.94)), "coupe": (0.03, 0.93)},
    "frette": (0.86, 0.07, 0.05),
    # Table, du talon à la naissance de la bigorne : (part de sa longueur, part de sa demi-largeur, part de son
    # épaisseur ôtée par dessous, chanfrein en fraction de son épaisseur).
    "profil_table": ((0.0, 0.82, 0.5, 0.06), (0.2, 0.86, 0.5, 0.06), (0.24, 1.0, 0.0, 0.06), (1.0, 1.0, 0.0, 0.06)),
    # Corps, du billot à la table (`geometrie.profilee`, demi-côtés du pied de la recette) : la semelle, son ressaut, la
    # taille, l'épaulement ; `ancrage` : part de la hauteur du pied dont il entre dans le billot et dans la table.
    "ancrage": 0.08, "semelle": SEMELLE,
    "corps": ((0.0, 1.0, 1.0, 0.08), (SEMELLE, 1.0, 1.0, 0.08), (SEMELLE + 0.02, 0.72, 0.68, 0.14),
              (0.45, 0.62, 0.6, 0.14), (0.7, 0.62, 0.6, 0.14), (1.0, 0.95, 0.85, 0.08)),
    # Crampons, sur la semelle : leur place (fractions des demi-côtés x et y du pied), la part de leur hauteur qui y
    # entre.
    "crampons": (0.86, 0.86, 0.3),
    # Bigorne, en fractions du prisme : hauteur de son axe à la naissance et à la pointe (fractions de sa hauteur,
    # depuis son milieu), part de sa longueur enfoncée dans la table, part de sa longueur où elle s'arrête, rayon à la
    # naissance (fraction de sa demi-hauteur), côtés.
    "corne": {"axe": (0.0, -0.5), "ancrage": 0.08, "longueur": 0.94, "rayon": 0.96, "cotes": 10},
    # Marteau, en fractions du rayon du rondin : place de sa tête (x, y) depuis l'axe ; demi-longueur et demi-côté de
    # sa tête ; `enfonce`, part de ce demi-côté sous le dessus du billot ; longueur de son manche, son rayon, hauteur de
    # l'axe de son bout sur le billot (fraction de l'apothème de sa section) ; côtés du manche.
    "marteau": {"place": (0.7, -0.38), "tete": (0.17, 0.075), "enfonce": 0.15, "manche": (0.95, 0.045, 0.8),
                "cotes": 6},
}

# Foyer de forge : rangs du massif, des braises, du contrecœur, de la hotte, de la souche et des piliers.
FOYER = {
    "massif": 0, "braises": 1, "contrecoeur": 2, "hotte": 3, "souche": 4, "piliers": (5, 6),
    # Parements, par boîte de la recette : `entre`, lit et tête (parts de sa hauteur) ; ses assises ; `pierres` par
    # face, le long de y puis le long de x ; `queue` d'une pierre (fraction du plus petit demi-côté) ; `ecart` d'un
    # joint (`geometrie.partage`) ; `retrait` du dessus du blocage (fraction de la hauteur d'une assise).
    "parements": (
        ("massif", {"entre": (0.0, 1.0), "assises": 3, "pierres": (3, 4), "queue": 0.22, "ecart": 0.15,
                    "retrait": 0.08}),
        ("contrecoeur", {"entre": (0.0, 1.0), "assises": 2, "pierres": (1, 4), "queue": 0.5, "ecart": 0.15,
                         "retrait": 0.08}),
        ("hotte", {"entre": (0.0, 0.5), "assises": 1, "pierres": (2, 3), "queue": 0.3, "ecart": 0.15,
                   "retrait": 0.08}),
        ("souche", {"entre": (0.42, 1.0), "assises": 3, "pierres": (2, 2), "queue": 0.45, "ecart": 0.12,
                    "retrait": 0.08}),
    ),
    # Manteau de la hotte : `naissance` (part de la hauteur de la hotte) et `gorge` (part de celle de la souche) ;
    # demi-côtés au pied (fraction de ceux de la hotte) et à la tête (fraction de ceux de la souche) ; chanfrein
    # (fraction de la hauteur de la hotte).
    "manteau": {"naissance": 0.45, "gorge": 0.46, "pied": 0.97, "tete": 0.9, "chanfrein": 0.06},
    # Piliers (`geometrie.profilee`) ; `ancrage` : part de leur hauteur enfoncée dans le massif et dans la hotte.
    "ancrage": 0.02,
    "pilier": ((0.0, 1.0, 1.0, 0.1), (0.07, 1.0, 1.0, 0.1), (0.1, 0.8, 0.8, 0.25), (0.9, 0.8, 0.8, 0.25),
               (0.93, 1.0, 1.0, 0.1), (1.0, 1.0, 1.0, 0.1)),
    # Lit de braises, en fractions de sa boîte : `ancrage` et `hauteur` (parts de sa hauteur), son profil
    # (`geometrie.profilee`) ; charbons (`geometrie.charbons`) : `semis`, part des demi-côtés où ils tombent ; leur
    # nombre ; `grosseur`, demi-côté (fractions du demi-côté x du semis, tiré) ; `CHARBON`.
    "lit": {"ancrage": 0.5, "hauteur": 0.6, "profil": ((0.0, 0.97, 0.97, 0.05), (0.6, 0.97, 0.97, 0.08),
                                                     (1.0, 0.86, 0.84, 0.08)),
            "semis": 0.8, "charbons": 34, "grosseur": (0.07, 0.15), **CHARBON},
    # Soufflet, sur le dessus du massif : `portee`, places (x, y vers le front) de sa poignée puis de son bec
    # (fractions des demi-côtés du massif) ; demi-`largeur` (fraction du demi-côté x du massif) ; demi-épaisseur d'une
    # `flasque` et `ouverture` à la poignée puis au bec (fractions de la hauteur du massif) ; `enfonce`, part de cette
    # demi-épaisseur dont la flasque du dessous entre dans le massif, `chanfrein` des flasques et du cuir et `prise`
    # du cuir dans chaque flasque (fractions d'elle) ; `contour` des flasques et du `cuir` (part de la longueur, part
    # de la demi-largeur) ; `buse` : son départ et son arrivée (parts de la longueur), son rayon (fraction de la
    # demi-épaisseur d'une flasque), ses côtés ; `cone`, son profil (`geometrie.tournee`).
    "soufflet": {"portee": ((0.84, 0.86), (0.62, 0.16)), "largeur": 0.15, "flasque": 0.012, "enfonce": 0.3,
                 "chanfrein": 0.5, "prise": 0.5, "ouverture": (0.1, 0.02),
                 "contour": ((0.0, 0.22), (0.14, 0.25), (0.3, 0.85), (0.55, 1.0), (0.8, 0.7), (1.0, 0.3)),
                 "cuir": ((0.26, 0.6), (0.3, 0.8), (0.55, 0.95), (0.8, 0.66), (0.97, 0.3)),
                 "buse": (0.96, 1.6, 1.3, 6), "cone": ((0.0, 1.0), (1.0, 0.55))},
}

# Cuve de brasserie : rangs de la cuve, de ses deux cercles et de la boîte de sa planche.
CUVE = {
    "cuve": 0, "cercles": (1, 2), "planche": 4,
    # Douves : leur nombre ; `rayons` de leurs arêtes au pied et à la tête (fractions de l'apothème de la cuve) ;
    # `epaisseur` (fraction du rayon de la cuve) ; `chanfrein`, `jeu` (recul d'une douve, tiré) et `jour` entre deux
    # douves (fractions de leur épaisseur).
    "douves": 24, "rayons": (0.99, 0.93), "epaisseur": 0.045, "chanfrein": 0.22, "jeu": (0.0, 0.08), "jour": 0.012,
    # Blocage : sa tête (part de la hauteur), son dehors et son dedans sous le parement (fractions de l'épaisseur
    # d'une douve).
    "blocage": (0.985, 0.6, 1.4),
    # Moût : dessous et dessus (parts de la hauteur), son bord sous le parement (fraction de l'épaisseur d'une douve).
    "mout": (0.90, 0.925, 1.2),
    # Cercle : son dedans et son dehors (fractions du rayon des arêtes à sa hauteur).
    "cercle": (0.985, 1.02),
    # Fourquet : `pied`, sa place dans la boîte (fraction de son demi-côté y) ; `appui`, azimut de son appui sur
    # l'arête du bord ; `depasse`, sa longueur (part de celle du pied à l'appui) ; `rayon` du manche (fraction du
    # demi-côté x de la boîte) ; `pale` : demi-épaisseur et demi-largeur (fractions des demi-côtés x et y de la
    # boîte), chanfrein (fraction de sa demi-épaisseur) ; son `profil` (part de la longueur du pied à l'appui, part de
    # la demi-largeur).
    "fourquet": {"pied": -0.6, "appui": -9, "depasse": 1.025, "rayon": 0.6, "cotes": 6, "pale": (0.4, 0.34, 0.5),
                 "profil": ((0.0, 1.0), (0.2, 1.0), (0.25, 0.3))},
}

# Marmite : rangs des trois perches, des braises et du chaudron.
MARMITE = {
    "perches": (0, 1, 2), "braises": 3, "chaudron": 4,
    # Potence : rayon d'une perche et d'un bras (fraction du demi-côté d'une perche de la recette), côtés, profil
    # d'une perche (`geometrie.tournee`).
    "potence": {"rayon": 0.7, "cotes": 6, "profil": ((0.0, 1.1), (0.5, 1.0), (1.0, 0.9))},
    # Ligature, en fractions du rayon d'une perche : sa descente sous l'axe du bras, sa montée, son rayon ; ses
    # spires (`geometrie.tournee`).
    "ligature": {"dessous": 2.4, "dessus": 0.95, "rayon": 1.35,
                 "spires": ((0.0, 0.8), (0.12, 1.0), (0.25, 0.85), (0.38, 1.0), (0.5, 0.85), (0.62, 1.0), (0.75, 0.85),
                            (0.88, 1.0), (1.0, 0.8))},
    # Chaudron (`geometrie.tournee`, fractions de sa hauteur et de son rayon) : le dehors du fond à la lèvre, puis le
    # dedans.
    "panse": ((0.0, 0.34), (0.05, 0.6), (0.14, 0.8), (0.3, 0.94), (0.45, 0.97), (0.6, 0.9), (0.76, 0.78),
              (0.88, 0.74), (0.95, 0.8), (1.0, 0.84), (1.0, 0.77), (0.84, 0.7)),
    # Ragoût : dessous et dessus (parts de la hauteur du chaudron), rayon (fraction du sien).
    "ragout": (0.86, 0.9, 0.73),
    # Os, en fractions du rayon du chaudron : rayon, côtés, profil ; par os, son pied sur le dessous du ragoût (x, y),
    # son azimut, son élévation (degrés), sa longueur.
    "os": {"rayon": 0.05, "cotes": 6,
           "profil": ((0.0, 0.9), (0.07, 1.35), (0.14, 0.8), (0.5, 0.6), (0.86, 0.8), (0.93, 1.35), (1.0, 0.9)),
           "poses": (((0.0, 0.0), -30, 14, 0.93), ((-0.3, 0.2), 150, 60, 0.5))},
    # Anse : `ancrage` (part de la hauteur du chaudron sous son bord) ; demi-`portee` (dans l'épaisseur de la lèvre),
    # `fleche` et rayon du `fer` (fractions du rayon du chaudron) ; tronçons, côtés.
    "anse": {"ancrage": 0.03, "portee": 0.8, "fleche": 0.5, "fer": 0.028, "troncons": 10, "cotes": 6},
    # Chaîne, de la clef au sommet de l'anse : maillons ; `recouvre`, rayon d'un maillon (fraction de son demi-pas) ;
    # `fer`, épaisseur de son fer (fraction de ce rayon) ; côtés.
    "chaine": {"maillons": 4, "recouvre": 1.3, "fer": 0.28, "cotes": 8},
    # Lit de braises, en fractions du foyer de la recette : `hauteur` (part de la sienne), profil
    # (`geometrie.tournee`) ; charbons (`geometrie.charbons`) : `semis` (fraction de son rayon), nombre, `grosseur`
    # (fractions du semis), `CHARBON`.
    "lit": {"hauteur": 0.6, "profil": ((0.0, 0.88), (0.6, 0.82), (1.0, 0.6)), "semis": 0.36, "charbons": 16,
            "grosseur": (0.14, 0.3), **CHARBON},
    # Bordure, une pierre par côté du foyer : `parement` (fraction de son apothème), `hauteur` (part de la sienne),
    # `largeur` (part du côté), `queue` (fraction de son rayon) ; `taille`, celle d'une pierre à peine dégrossie
    # (`geometrie.moellon`, comme `TAILLE`).
    "bordure": {"parement": 0.97, "hauteur": 0.5, "largeur": 0.9, "queue": 0.28,
                "taille": {"joint": 0.06, "arete": 0.2, "parement": (0.0, 0.25)}},
    # Bûches, sur le lit : azimuts ; `portee`, leurs deux bouts depuis l'axe (fractions du rayon du foyer) ; `rayon`
    # (fraction de celui-ci) ; `pose`, hauteur de leur axe sur le lit (fraction de leur rayon) ; `rondin`
    # (`modele.rondin`).
    "buches": {"azimuts": (40, 165, 280), "portee": (0.66, -0.2), "rayon": 0.12, "pose": 0.7,
               "rondin": {"cotes": 7, "profil": ((0.0, 0.9), (0.1, 1.0), (0.9, 1.0), (1.0, 0.9)),
                          "coupe": (0.12, 0.9)}},
}

# Roue dentée : rangs du socle, de la roue, du moyeu et du levier.
ROUE = {
    "socle": 0, "roue": 3, "moyeu": 4, "levier": 9,
    # Jante : son dedans et son dehors (fractions de l'apothème de la roue), sa demi-épaisseur (fraction de celle de
    # la roue).
    "jante": {"rayons": (0.72, 0.86), "epaisseur": 0.78},
    # Dents : nombre ; `pied` (fraction du dehors de la jante) et `tete` (fraction de l'apothème) ; demi-`largeurs` au
    # pied et à la tête (fractions de l'apothème) ; demi-`epaisseur` et `chanfrein` (fractions de la demi-épaisseur
    # de la jante).
    "dents": {"nombre": 16, "pied": 0.96, "tete": 0.985, "largeurs": (0.075, 0.045), "epaisseur": 0.9,
              "chanfrein": 0.12},
    # Rayons : nombre ; `pied` (fraction de l'apothème du moyeu) et `tete` (fraction du dedans de la jante) ;
    # demi-`epaisseur` et `chanfrein` (fractions de la demi-épaisseur de la jante) ; demi-`largeur` (fraction de
    # l'apothème de la roue).
    "rayons": {"nombre": 8, "pied": 0.7, "tete": 1.03, "epaisseur": 0.45, "largeur": 0.05, "chanfrein": 0.1},
    # Moyeu (`geometrie.tournee`, fractions de sa longueur et de son apothème) : un tourillon, la noix, un tourillon.
    "noix": ((0.0, 0.3), (0.2, 0.3), (0.22, 0.62), (0.27, 0.95), (0.5, 1.0), (0.73, 0.95), (0.78, 0.62), (0.8, 0.3),
             (1.0, 0.3)),
    "cotes": 12,
    # Chevalet : `palier`, sa place sur l'essieu (fraction de la demi-longueur du moyeu) ; `collier` : demi-longueur
    # (fraction de celle du moyeu) et rayon (fraction de son apothème) ; `section` d'une jambe : demi-côté dans le plan
    # de la roue (fraction de la longueur du socle) et le long de l'essieu (fraction de la demi-longueur du moyeu) ;
    # `ancrage` (part de la hauteur du socle) ; `tete`, écart de sa tête à l'axe (fraction de son demi-côté dans le
    # plan de la roue) ; `empattement` (fraction de la demi-longueur du socle) ; `entretoise` :
    # sa hauteur (part de celle du palier) et ses demi-côtés (fraction de ceux d'une jambe) ; demi-largeur d'un
    # `longeron` (fraction de la demi-largeur du socle) ; `rivet` : sa place (fraction de la demi-longueur du socle) et
    # sa hauteur (fraction de la demi-hauteur du socle).
    "chevalet": {"palier": 0.82, "collier": (0.16, 0.5), "section": (0.035, 0.13), "ancrage": 0.2, "tete": 0.5,
                 "empattement": 0.68, "entretoise": (0.45, 0.6), "longeron": 0.2, "rivet": (0.92, 0.98)},
    # Traverse : sa `place` (fraction de la demi-longueur du socle), sa demi-`largeur` (fraction de la longueur du
    # socle), sa `hauteur` (part de celle du socle).
    "traverse": {"place": 0.8, "largeur": 0.05, "hauteur": 0.7},
    # Bras du levier : `depart` sur le tourillon (fraction de la demi-longueur du moyeu) ; `prise` dans le manche
    # (part de sa longueur) ; `section`, largeur et épaisseur (fractions du rayon du manche de la recette) ; `rayon`
    # du manche (fraction du sien), son profil (`geometrie.tournee`), ses côtés.
    "bras": {"depart": 0.9, "prise": 0.1, "section": (0.9, 1.3), "rayon": 0.85,
             "profil": ((0.0, 0.85), (0.12, 0.85), (0.5, 1.0), (0.88, 0.9), (1.0, 0.7)), "cotes": 8},
}

# Chevalet de sciage : rang du madrier ; par croix, de gauche à droite, les rangs de ses deux pieds.
SCIE = {
    "madrier": 5, "croix": ((1, 3), (2, 4)),
    # Bûche : rayon (fraction de l'épaisseur du madrier), longueur (part de la sienne), `rondin` (`modele.rondin`).
    "buche": {"rayon": 0.93, "longueur": 0.76,
              "rondin": {"cotes": 9, "profil": ((0.0, 0.92), (0.03, 1.0), (0.97, 1.0), (1.0, 0.92)),
                         "coupe": (0.1, 0.93)}},
    # Pied, en fractions du côté d'un pied de la recette : `section`, demi-épaisseur le long de x et largeur ;
    # `decale`, écart de son axe à celui de la recette ; `cheville`, son rayon ; en fractions du rayon de la bûche :
    # `appui`, part dont elle s'enfonce dans le pied ; `depasse`, hauteur de sa tête au-dessus de l'axe de la bûche.
    "pied": {"section": (0.2, 0.8), "decale": 0.2, "appui": 0.1, "depasse": 0.3, "cheville": 0.12},
    # Entretoise, en fractions du côté d'un pied de la recette : ce dont elle dépasse chaque croisée, ses demi-côtés
    # (y, z).
    "entretoise": {"depasse": 0.45, "section": (0.32, 0.4)},
    # Lisse : sa hauteur (part de celle des croisées), ses demi-côtés y et z (fractions du côté d'un pied).
    "lisse": (0.42, 0.25, 0.35),
    # Scie : rangs de la lame et de la poignée. Lame, en fractions de sa boîte depuis son milieu (x, z) : `dos`, de la
    # pointe au talon ; `fil`, du talon à la pointe ; `dents` : leur nombre et leur creux (fraction de la hauteur de
    # la boîte) ; demi-`epaisseur` (fraction de celle de la boîte) ; `biseau` (`modele.lame`). Poignée : `prise`, son
    # contour dans sa boîte ; `joue`, demi-épaisseur (fraction de celle de la boîte) ; `arrondi` (`modele.lame`).
    "scie": {"lame": 6, "poignee": 7, "dos": ((0.5, 0.0), (-0.5, 0.5)), "fil": ((-0.5, -0.35), (0.5, -1.0)),
             "dents": (14, 0.18), "epaisseur": 0.12, "biseau": 0.97,
             "prise": ((0.5, -0.3), (0.5, 0.2), (0.2, 0.5), (-0.25, 0.5), (-0.5, 0.25), (-0.3, 0.0), (-0.5, -0.3),
                       (-0.35, -0.5), (-0.05, -0.5), (0.1, -0.2), (0.3, -0.38)),
             "joue": 0.7, "arrondi": 0.75},
}

# Râtelier d'armes : rangs du socle, des poteaux, des traverses, des hampes et de la boîte des fers.
RATELIER = {
    "socle": 0, "poteaux": (1, 2), "traverses": (3, 4), "hampes": (5, 6, 7), "fers": 8,
    # Plinthe (`geometrie.profilee`, demi-côtés du socle).
    "plinthe": ((0.0, 1.0, 1.0, 0.06), (0.55, 1.0, 1.0, 0.06), (0.7, 0.97, 0.9, 0.1), (1.0, 0.95, 0.84, 0.06)),
    # Poteau : demi-côté (fraction du sien) ; cheville : rayon (fraction du côté d'un poteau).
    "poteau": 0.92, "cheville": 0.12,
    # Hampe : rayon (fraction de celui de la recette), profil (`geometrie.tournee`), côtés.
    "hampe": {"rayon": 0.8, "profil": ((0.0, 0.9), (0.03, 1.0), (1.0, 0.92)), "cotes": 8},
    # Douille : pied et tête (fractions de la demi-hauteur de la boîte des fers, depuis son milieu), rayon (fraction
    # de celui de la hampe de la recette).
    "douille": (-1.8, -1.1, 0.92),
    # Fer : demi-épaisseur (fraction de celle de la boîte des fers), `biseau` (`modele.lame`).
    "fer": {"epaisseur": 0.4, "biseau": 0.72},
    # Arme de chaque hampe, et son dessin : contour (x vers le milieu du râtelier, en fractions de la demi-largeur de
    # la boîte des fers depuis l'axe de la hampe ; z en fractions de sa demi-hauteur depuis son milieu).
    "armes": ("hallebarde", "pertuisane", "vouge"),
    "dessins": {
        "hallebarde": ((0.0, 1.0), (0.05, 0.3), (0.12, 0.3), (0.42, 0.6), (0.5, 0.1), (0.5, -0.45), (0.42, -1.0),
                       (0.12, -0.6), (0.07, -0.6), (0.07, -1.5), (-0.07, -1.5), (-0.07, -0.5), (-0.12, -0.2),
                       (-0.07, 0.0), (-0.05, 0.3)),
        "pertuisane": ((0.0, 1.0), (0.1, 0.2), (0.13, -0.3), (0.07, -0.75), (0.26, -0.9), (0.3, -1.2), (0.07, -1.15),
                       (0.07, -1.6), (-0.07, -1.6), (-0.07, -1.15), (-0.3, -1.2), (-0.26, -0.9), (-0.07, -0.75),
                       (-0.13, -0.3), (-0.1, 0.2)),
        "vouge": ((0.04, 1.0), (0.22, 0.7), (0.4, 0.2), (0.44, -0.4), (0.34, -1.0), (0.07, -1.35), (0.07, -1.6),
                  (-0.07, -1.6), (-0.07, 0.1), (-0.12, 0.25), (-0.07, 0.45), (-0.04, 0.8)),
    },
}

# Présentoir à lances : rangs des joues, de la tablette et de la lisse ; par lance, les rangs de sa hampe et de son
# prisme, le déport de son talon du côté où descend le prisme (fraction de son côté x) et celui de sa pointe du côté
# opposé (fraction de son demi-côté x).
PRESENTOIR = {
    "joues": (0, 1), "tablette": 2, "lisse": 3,
    "lances": ((4, 5, 1.2, 1.0), (6, 7, -0.5, 0.2), (8, 9, 0.7, -0.1), (10, 11, 0.9, 1.0)),
    # Joue : `montant`, ses demi-côtés (fractions des demi-côtés x et y de la joue) ; `traverses`, leurs hauteurs
    # (parts de celle de la joue) ; `traverse` : demi-épaisseur (fraction du demi-côté x) et demi-hauteur (fraction de
    # la hauteur de la joue) ; `cheville`, rayon (fraction du côté x).
    "joue": {"montant": (0.9, 0.18), "traverses": (0.5, 0.97), "traverse": (0.7, 0.02), "cheville": 0.1},
    # Tablette : ses planches, l'écart de leur joint (`geometrie.partage`), le demi-jour entre elles (fraction de sa
    # profondeur).
    "planches": {"nombre": 2, "ecart": 0.06, "jour": 0.006},
    # Lance : `ancrage` du talon (part de l'épaisseur de la tablette) ; `rayon` de la hampe (fraction de celui de la
    # recette), côtés ; `feuille`, contour du fer (x en fractions du demi-côté x du prisme, z en parts de la longueur
    # du collet à la pointe) ; demi-`epaisseur` (fraction du demi-côté y du prisme), `biseau` (`modele.lame`) ;
    # `douille` : sa descente sous le collet et sa montée (fractions de la hauteur du prisme), son rayon (fraction de
    # celui de la hampe de la recette), son `cone` (`geometrie.tournee`) ; `tasseau` : demi-largeur (fraction du rayon
    # de la hampe de la recette) et demi-hauteur (fraction de celle de la lisse).
    "lance": {"ancrage": 0.1, "rayon": 0.75, "cotes": 8,
              "feuille": ((0.0, 1.0), (0.4, 0.74), (0.78, 0.45), (0.7, 0.27), (0.3, 0.1), (0.3, 0.0), (-0.3, 0.0),
                          (-0.3, 0.1), (-0.7, 0.27), (-0.78, 0.45), (-0.4, 0.74)),
              "epaisseur": 0.22, "biseau": 0.6, "douille": (0.35, 0.14, 0.92), "cone": ((0.0, 1.0), (1.0, 0.55)),
              "tasseau": (2.4, 0.75)},
}
