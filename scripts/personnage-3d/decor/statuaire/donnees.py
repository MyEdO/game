"""Données de la statuaire (#4335) : un GLB par décor `statue`, `gargouille`, `idole-chaos`, `urne`, `oeuf-dragon`,
`crane-monstre`, `trophee-cranes` et `ossements` de `src/data/props.json`, bâti dans l'enveloppe convexe des primitives
de sa recette (`gabarit.py`). Aucune illustration au corpus : proportions d'adaptation, chacune en fraction de la
primitive qui la porte (son rang dans la recette), dans le repère de `gabarit.py` (x à l'est, z vers le haut). Une
position `(x, y, z)` se compte en demi-côtés depuis le centre de la primitive qui la porte, `y` vers le front de la
recette, `x` vers le dehors pour une pièce d'un côté (`geometrie.cadre`) ; un azimut est un angle en degrés autour de la
verticale, nul au front, le même des deux côtés.

- `statue` : un socle à deux corps moulurés ; une figure drapée, sa robe à plis creusés du socle aux épaules, le cou,
  la tête modelée (nez, arcades, orbites, tempes, chevelure sur la nuque) et la barbe en mèches ; un bras replié, le
  poing sur la poitrine ; l'autre levé, le poing sur le manche d'un marteau de guerre à frettes, sa tête
  chanfreinée, une pointe au revers.
- `gargouille` : un pilier mouluré ; une bête accroupie, l'échine du croupion à la nuque, les cuisses repliées et les
  antérieurs plantés au bord du pilier, leurs griffes, la gueule à mufle et arcades, deux cornes ; chaque aile, un
  bras, une voile festonnée sous le rampant du prisme de la recette, ses doigts, et la voile qui la relie au dos.
- `idole-chaos` : un emmarchement de pierre ; sur son piédestal, un colosse : deux jambes, un pagne froncé, un torse
  galbé (pectoraux, sillons du ventre et du dos), le cou, les bras pendants aux mains griffues, une tête à mufle et
  arcades dont le bandeau de rune tient la place des yeux, deux défenses et deux cornes d'os coudées vers le haut.
- `urne` : un socle à deux corps ; une panse à godrons, l'épaule, le col et sa lèvre, le couvercle, son bouton, deux
  anses.
- `oeuf-dragon` : un nid, son bourrelet et ses brins de paille couchés en rond ; l'œuf, ses rangs d'écailles en
  losange à recouvrement.
- `crane-monstre` : un crâne posé sur sa mâchoire (voûte, orbites et cavité nasale creusées et sombres, arcades,
  pommettes, dents), deux paires de crocs devant la mâchoire, deux cornes coudées vers le haut.
- `trophee-cranes` : une pierre de calage, un pieu, sa traverse ; quatre crânes : un fiché sur le pieu, un contre
  lui, deux pendus à la traverse par une corde nouée.
- `ossements` : quatre os longs à épiphyses, un crâne, une cage : des vertèbres en file et leurs côtes courbes.

Matières : celles des recettes. Le trophée prend `corde`, que sa recette ne nomme pas, pour pendre ses deux crânes de
côté, que la recette place sous la traverse sans les y relier. Le matériau `sculpture` de la gargouille est la
`pierre-atre` de son pilier, à part pour que la bête se lisse sous un angle plus ouvert que lui (`ANGLE_LISSE`). Aucun
emplacement de palette ne nomme la pierre, l'os, la paille ni l'écaille : ils prennent `corps` ; l'ombre, la rune et la
corde, `accent`."""

# Emplacement de palette et matière (domaine `prop` de `src/data/materials.json`) de chaque matériau (`habillage.py`).
PIERRE = {"pierre": ("corps", "pierre-atre")}
MARBRE = {"marbre": ("corps", "albatre")}
OS = {"os": ("corps", "os")}
OMBRE = {"ombre": ("accent", "ombre")}
MATERIAUX = {
    "statue": {**PIERRE, **MARBRE},
    "gargouille": {**PIERRE, "sculpture": ("corps", "pierre-atre")},
    "idole-chaos": {**PIERRE, **OS, "chaos": ("corps", "pierre-chaos"), "rune": ("accent", "rune-chaos")},
    "urne": {**PIERRE, **MARBRE},
    "oeuf-dragon": {"paille": ("corps", "paille"), "ecaille": ("corps", "ecaille")},
    "crane-monstre": {**OS, **OMBRE},
    "trophee-cranes": {**PIERRE, **OS, **OMBRE, "bois": ("bois", "bois-chene"), "corde": ("accent", "corde")},
    "ossements": {**OS, **OMBRE},
}

BUDGET_TRIANGLES = {"statue": 3300, "gargouille": 3300, "idole-chaos": 4900, "urne": 2400, "oeuf-dragon": 4400,
                    "crane-monstre": 2600, "trophee-cranes": 4000, "ossements": 3600}

ANGLE_LISSE = {"pierre": 30, "marbre": 50, "sculpture": 50, "chaos": 50, "os": 50, "rune": 30, "ombre": 40,
               "paille": 50, "ecaille": 35, "bois": 40, "corde": 50}
"""Angle (degrés) sous lequel deux faces voisines se lissent (`maille.objet`), par nœud : un socle garde ses arêtes,
une figure, un os et un brin sont ronds, une écaille garde son arête."""

RETRAIT = 0.0005
"""Distance (m) sous une face de l'enveloppe à laquelle revient un sommet qui la dépasse (`Gabarit.rentrer`)."""

# Profils d'un corps de socle (`geometrie.profile`) : (part de sa hauteur, part de son demi-côté sur
# x, sur y, chanfrein en fraction du plus petit demi-côté).
ASSISE = ((0.0, 1.0, 1.0, 0.03), (0.70, 1.0, 1.0, 0.03), (1.0, 0.94, 0.94, 0.03))
"""Une assise à glacis : droite, puis rentrée en tête."""
DE = ((0.0, 0.94, 0.94, 0.02), (0.14, 0.94, 0.94, 0.02), (0.20, 0.86, 0.86, 0.02), (0.74, 0.86, 0.86, 0.02),
      (0.82, 0.93, 0.93, 0.02), (0.88, 1.0, 1.0, 0.02), (1.0, 1.0, 1.0, 0.02))
"""Un dé : une plinthe, un fût en retrait, une corniche en saillie."""

# Statue : rangs des deux corps du socle et leur profil ; rangs du corps, des quatre prismes de la jupe (les deux de
# côté, celui du front, celui du dos), des épaules, du cou, de la tête, du bras levé, du manche et de la tête du
# marteau dans la recette.
STATUE = {
    "socle": ((0, ASSISE), (1, DE)), "corps": 2, "jupe": (3, 4, 5, 6), "epaules": 7, "cou": 8, "tete": 9, "bras": 10,
    "manche": 11, "masse": 12,
    # Robe (`geometrie.froncee`). `jupe` : ses anneaux le long des rampants des quatre prismes (part du rampant, de
    # l'égout à la crête ; demi-largeur et demi-profondeur en parts de la demi-distance entre les deux rampants de
    # côté, puis entre celui du front et celui du dos ; creux de ses plis). `coupe` : ses anneaux au-dessus (boîte, part
    # de sa hauteur, parts de sa demi-largeur et de sa demi-profondeur, creux). `pointe` : sa pointe sous le cou (part
    # de la hauteur des épaules).
    "robe": {"plis": 11, "pas": 4, "pointe": 1.37,
             "jupe": ((0.0, 0.93, 0.96, 0.20), (0.16, 0.95, 1.0, 0.28), (0.60, 0.93, 1.08, 0.26),
                      (0.83, 0.85, 0.97, 0.16), (0.91, 0.93, 1.08, 0.08)),
             "coupe": (("corps", 0.85, 1.18, 1.23, 0.05), ("corps", 0.93, 1.34, 1.14, 0.0),
                       ("epaules", 0.0, 0.97, 0.95, 0.0), ("epaules", 0.51, 0.92, 0.87, 0.0),
                       ("epaules", 0.86, 0.73, 0.78, 0.0), ("epaules", 1.0, 0.45, 0.59, 0.0))},
    # Cou : ce dont il dépasse chaque bout de sa primitive (en hauteurs d'elle), son rayon (fraction de son demi-côté),
    # ses côtés.
    "cou_tourne": (1.1, 0.85, 8),
    # Visage (`modele.modelee`), dans la boîte de la tête : le nez, les arcades, les orbites, les tempes, la chevelure
    # qui tombe sur la nuque.
    "visage": {"cotes": 28, "resserre": 1.5, "sommet": 1.0,
               "profil": ((-1.0, 0.44), (-0.82, 0.62), (-0.62, 0.72), (-0.42, 0.76), (-0.24, 0.78), (-0.08, 0.80),
                          (0.08, 0.84), (0.24, 0.88), (0.42, 0.90), (0.62, 0.84), (0.80, 0.66), (0.93, 0.40)),
               "reliefs": ((0, -0.16, 12, 0.34, 0.24), (24, 0.24, 28, 0.13, 0.11), (26, 0.04, 13, 0.12, -0.14),
                           (78, -0.1, 26, 0.5, -0.05), (180, -0.45, 115, 0.62, 0.24))},
    # Barbe (`geometrie.froncee`) : ses anneaux (position dans la boîte de la tête, demi-axes x et y en fractions de
    # son demi-côté, creux de ses mèches), sa pointe.
    "barbe": {"plis": 7, "pas": 3, "pointe": (0.0, 0.58, -1.70),
              "stations": (((0.0, 0.22, -0.42), 0.80, 0.64, 0.12), ((0.0, 0.36, -0.80), 0.68, 0.52, 0.22),
                           ((0.0, 0.50, -1.25), 0.40, 0.32, 0.24))},
    # Bras levé (`modele.membre`), dans la boîte du bras : de l'épaule, dans la robe, au coude, à l'avant-bras, au
    # poignet et au poing ; ses rayons sur y puis en travers, en fractions du demi-côté x de la boîte.
    "bras_leve": {"taille": (8, 3),
                  "stations": (((-2.4, 0.0, -0.28), 1.1, 1.1), ((-0.9, 0.0, -0.12), 1.0, 1.0),
                               ((-0.1, 0.0, 0.12), 0.85, 0.82), ((0.0, 0.0, 0.50), 0.90, 0.85),
                               ((0.0, 0.0, 0.72), 0.70, 0.62), ((0.0, 0.0, 0.80), 1.05, 0.90),
                               ((0.0, 0.0, 0.95), 1.05, 0.90), ((0.0, 0.0, 1.0), 0.70, 0.60))},
    # Bras replié, dans la boîte du corps, du côté opposé : de l'épaule au coude, puis l'avant-bras en travers de la
    # poitrine jusqu'au poing ; ses rayons sur x puis en travers, en fractions du demi-côté x du corps.
    "bras_replie": {"taille": (8, 3),
                    "stations": (((1.05, 0.0, 1.07), 0.30, 0.30), ((1.2, -0.1, 0.93), 0.28, 0.28),
                                 ((1.3, -0.25, 0.45), 0.25, 0.25), ((0.95, 0.7, 0.52), 0.23, 0.23),
                                 ((0.45, 1.25, 0.66), 0.19, 0.19), ((0.2, 1.38, 0.72), 0.28, 0.27),
                                 ((0.02, 1.38, 0.76), 0.24, 0.24))},
    # Marteau : `pommeau` et `emmanche`, ce dont le manche dépasse sa primitive sous le poing et dans la tête (parts de
    # sa hauteur) ; `manche`, son profil à frettes (`geometrie.tournee`) ; `tete`, le profil de la tête, de la table,
    # au front, au revers en pointe (`geometrie.profile` : part de sa longueur, parts de ses demi-côtés x et z,
    # chanfrein).
    "marteau": {"pommeau": 0.16, "emmanche": 0.10, "cotes": 8,
                "manche": ((0.0, 0.55), (0.03, 0.95), (0.07, 0.95), (0.09, 0.60), (0.30, 0.60), (0.32, 0.88),
                           (0.37, 0.88), (0.39, 0.60), (0.74, 0.60), (0.76, 0.92), (0.82, 0.92), (0.84, 0.66),
                           (1.0, 0.66)),
                "tete": ((0.0, 0.78, 0.78, 0.22), (0.04, 0.90, 0.90, 0.22), (0.10, 0.98, 0.98, 0.22),
                         (0.58, 0.98, 0.98, 0.22), (0.60, 0.76, 0.76, 0.10), (0.68, 0.76, 0.76, 0.10),
                         (0.70, 0.56, 0.56, 0.10), (0.76, 0.50, 0.50, 0.10), (1.0, 0.10, 0.10, 0.02))},
}

# Gargouille : rangs du pilier, du corps, de la tête, des cornes et des ailes dans la recette.
GARGOUILLE = {
    "pilier": 0, "corps": 1, "tete": 2, "cornes": (5, 6), "ailes": (3, 4),
    "pilier_profil": ((0.0, 1.0, 1.0, 0.03), (0.10, 1.0, 1.0, 0.03), (0.14, 0.90, 0.90, 0.03),
                      (0.80, 0.90, 0.90, 0.03), (0.85, 0.96, 0.96, 0.03), (0.90, 1.0, 1.0, 0.03),
                      (1.0, 1.0, 1.0, 0.03)),
    # Échine (`modele.membre`), dans la boîte du corps : du croupion, dont la section repose sur le pilier, au dos, au
    # garrot et à la nuque, dans la tête ; ses rayons sur x puis en travers, en fractions du demi-côté x du corps.
    "echine": {"taille": (12, 3),
               "stations": (((0.0, -0.85, -0.62), 0.55, 0.42), ((0.0, -0.55, -0.15), 0.76, 0.62),
                            ((0.0, 0.0, 0.22), 0.70, 0.60), ((0.0, 0.5, 0.34), 0.62, 0.55),
                            ((0.0, 0.85, 0.32), 0.42, 0.40), ((0.0, 1.25, 0.50), 0.34, 0.34))},
    # Pattes, d'un côté : la cuisse, de la hanche au genou puis au pied, enfoncé dans le pilier ; l'antérieur, de
    # l'épaule au coude puis à la patte, au bord du pilier.
    "pattes": ({"taille": (8, 3),
                "stations": (((0.55, -0.6, -0.2), 0.34, 0.42), ((0.82, -0.05, 0.1), 0.30, 0.38),
                             ((0.85, 0.2, -0.45), 0.22, 0.24), ((0.85, 0.3, -0.9), 0.24, 0.30),
                             ((0.85, 0.36, -1.1), 0.24, 0.32))},
               {"taille": (8, 3),
                "stations": (((0.5, 0.55, 0.35), 0.26, 0.30), ((0.8, 0.6, -0.2), 0.20, 0.24),
                             ((0.72, 0.95, -0.7), 0.17, 0.20), ((0.7, 1.22, -0.92), 0.22, 0.24),
                             ((0.7, 1.3, -1.1), 0.22, 0.26))}),
    # Griffes, d'un côté : trois par pied puis trois par patte, chacune du doigt à sa pointe, couchée sur le pilier :
    # la place (x, y) de chaque point dans la boîte du corps, sa hauteur celle de son rayon au-dessus du pilier.
    "griffes": {"taille": (4, 1),
                "doigts": ((((0.67, 0.42), 0.07, 0.07), ((0.64, 0.6), 0.06, 0.06), ((0.62, 0.72), 0.0, 0.0)),
                           (((0.85, 0.42), 0.07, 0.07), ((0.85, 0.62), 0.06, 0.06), ((0.85, 0.75), 0.0, 0.0)),
                           (((1.03, 0.42), 0.07, 0.07), ((1.07, 0.6), 0.06, 0.06), ((1.1, 0.72), 0.0, 0.0)),
                           (((0.54, 1.3), 0.07, 0.07), ((0.5, 1.42), 0.06, 0.06), ((0.47, 1.52), 0.0, 0.0)),
                           (((0.7, 1.32), 0.07, 0.07), ((0.7, 1.45), 0.06, 0.06), ((0.7, 1.55), 0.0, 0.0)),
                           (((0.86, 1.3), 0.07, 0.07), ((0.9, 1.42), 0.06, 0.06), ((0.93, 1.52), 0.0, 0.0)))},
    # Gueule (`modele.modelee`), dans la boîte de la tête : le mufle, la fente de la gueule, les arcades, les orbites,
    # les joues.
    "gueule": {"cotes": 28, "resserre": 1.5, "sommet": 1.0,
               "profil": ((-1.0, 0.40), (-0.78, 0.60), (-0.60, 0.72), (-0.42, 0.76), (-0.24, 0.78), (-0.06, 0.82),
                          (0.12, 0.84), (0.30, 0.80), (0.48, 0.74), (0.68, 0.62), (0.88, 0.38)),
               "reliefs": ((0, -0.30, 34, 0.46, 0.26), (0, -0.60, 80, 0.10, -0.18), (30, 0.36, 28, 0.16, 0.18),
                           (33, 0.12, 14, 0.14, -0.20), (95, 0.2, 30, 0.4, 0.10))},
    # Corne, dans la boîte de la sienne : de sa racine, dans la tête, à sa pointe, courbée vers le dehors et l'arrière.
    "corne": {"taille": (6, 3),
              "stations": (((0.0, 0.0, -2.4), 1.8, 1.8), ((0.0, -0.1, -1.3), 1.5, 1.5), ((0.0, -0.2, -0.3), 0.9, 0.9),
                           ((0.3, -0.55, 0.55), 0.5, 0.5), ((0.55, -0.8, 1.0), 0.1, 0.1))},
    # Aile, en fractions de la largeur du rampant de son prisme sauf mention. Un point de sa voile est (part de cette
    # largeur depuis le milieu de la crête, vers le front ; part de la pente depuis la crête).
    "aile": {
        # Voile : son contour festonné, de la crête au bord de fuite ; sa profondeur sous le rampant et son épaisseur ;
        # le chanfrein de sa rive.
        "voile": ((0.46, 0.03), (0.47, 0.84), (0.30, 0.68), (0.12, 0.96), (-0.06, 0.70), (-0.27, 0.86),
                  (-0.34, 0.50), (-0.47, 0.46), (-0.43, 0.22), (-0.47, 0.03)),
        "sous": 0.036, "epais": 0.024, "arete": 0.01,
        # Doigts : chacun du poignet à sa pointe, ses rayons dans le plan de la voile puis en travers.
        "doigts": {"taille": (5, 2),
                   "chemins": ((((0.42, 0.06), 0.028, 0.028), ((0.45, 0.45), 0.022, 0.022),
                                ((0.46, 0.82), 0.012, 0.012)),
                               (((0.42, 0.06), 0.028, 0.028), ((0.28, 0.52), 0.022, 0.022),
                                ((0.13, 0.93), 0.012, 0.012)),
                               (((0.42, 0.06), 0.028, 0.028), ((0.05, 0.42), 0.022, 0.022),
                                ((-0.26, 0.83), 0.012, 0.012)),
                               (((0.42, 0.06), 0.028, 0.028), ((-0.05, 0.16), 0.022, 0.022),
                                ((-0.45, 0.44), 0.012, 0.012)))},
        # Bras : de l'épaule (dans la boîte du corps) au poignet (sur la voile), ses rayons à l'épaule puis au poignet.
        "bras": {"epaule": (0.45, 0.35, 0.55), "poignet": (0.42, 0.06), "rayons": ((0.07, 0.07), (0.04, 0.04)),
                 "taille": (6, 1)},
        # Voile du dos : de la crête (deux points de la voile) au dos (deux points de la boîte du corps), son épaisseur.
        "dos": {"faite": ((0.40, 0.05), (-0.42, 0.05)), "attache": ((0.42, -0.75, 0.58), (0.42, 0.40, 0.58)),
                "epais": 0.024},
    },
}

# Idole du Chaos : rangs de l'emmarchement, du piédestal, du corps, de la tête, des bras, de la rune et des cornes
# (cylindre couché, cylindre dressé) dans la recette.
IDOLE = {
    "marches": 0, "piedestal": 1, "corps": 2, "tete": 3, "bras": (8, 9), "rune": 10, "cornes": ((4, 6), (5, 7)),
    "emmarchement": ((0.0, 1.0, 1.0, 0.01), (0.33, 1.0, 1.0, 0.01), (0.34, 0.88, 0.88, 0.01), (0.66, 0.88, 0.88, 0.01),
                     (0.67, 0.76, 0.76, 0.01), (1.0, 0.76, 0.76, 0.01)),
    # Jambe (`modele.membre`), d'un côté, dans la boîte du corps : du pied, enfoncé dans le piédestal, à la cheville,
    # au genou, à la cuisse et à la hanche ; ses rayons sur x puis en travers, en fractions du demi-côté x du corps.
    "jambe": {"taille": (10, 3),
              "stations": (((0.5, 0.35, -1.06), 0.42, 0.50), ((0.5, 0.3, -0.75), 0.34, 0.38),
                           ((0.52, 0.4, -0.45), 0.40, 0.44), ((0.5, 0.1, -0.15), 0.44, 0.50),
                           ((0.4, 0.0, 0.08), 0.40, 0.45))},
    # Pagne (`geometrie.froncee`) : ses anneaux, de la ceinture au bas (position dans la boîte du corps, demi-axes x et
    # y en fractions de ses demi-côtés, creux de ses plis).
    "pagne": {"plis": 9, "pas": 3,
              "stations": (((0.0, 0.0, 0.0), 0.90, 0.92, 0.06), ((0.0, 0.05, -0.2), 0.86, 0.92, 0.22),
                           ((0.0, 0.1, -0.5), 0.60, 0.74, 0.34), ((0.0, 0.12, -0.62), 0.40, 0.55, 0.30))},
    # Torse (`modele.modelee`) : son centre dans la boîte du corps, ses demi-côtés en fractions des siens ; la taille,
    # les pectoraux, le sillon du ventre, celui du dos, les flancs.
    "torse": {"centre": (0.0, 0.0, 0.42), "demi": (1.0, 1.0, 0.58),
              "forme": {"cotes": 30, "resserre": 1.25, "sommet": 0.99,
                        "profil": ((-1.0, 0.62), (-0.78, 0.70), (-0.56, 0.66), (-0.42, 0.66), (-0.28, 0.69),
                                   (-0.14, 0.73), (0.0, 0.78), (0.14, 0.83), (0.28, 0.86), (0.42, 0.88), (0.56, 0.89),
                                   (0.70, 0.88), (0.84, 0.82), (0.94, 0.64)),
                        "reliefs": ((27, 0.38, 26, 0.22, 0.20), (0, 0.1, 7, 0.95, -0.09), (0, -0.14, 44, 0.07, -0.08),
                                    (0, -0.42, 44, 0.07, -0.08), (180, 0.1, 9, 0.9, -0.06),
                                    (62, -0.45, 22, 0.35, -0.05))}},
    # Cou : pied et tête (hauteurs dans la boîte du corps), rayon (fraction du demi-côté y du corps), côtés, profil
    # des trapèzes à la nuque (`geometrie.tournee`).
    "cou": (0.78, 1.2, 0.5, 10, ((0.0, 1.9), (0.30, 1.45), (0.52, 1.05), (1.0, 1.0))),
    # Bras, d'un côté, dans la boîte du sien : de l'épaule, dans le torse, au deltoïde, au biceps, au coude, à
    # l'avant-bras, au poignet et à la main ; ses rayons sur y puis en travers, en fractions de son demi-côté x.
    "bras_pendant": {"taille": (10, 3),
                     "stations": (((-1.9, -0.3, 0.92), 1.0, 1.0), ((-0.5, -0.2, 0.90), 1.20, 1.22),
                                  ((0.0, 0.0, 0.35), 0.86, 0.90), ((0.0, 0.1, -0.1), 0.70, 0.74),
                                  ((0.0, 0.35, -0.5), 0.82, 0.82), ((0.0, 0.5, -0.86), 0.58, 0.60),
                                  ((0.0, 0.55, -1.05), 0.90, 0.66), ((0.0, 0.55, -1.2), 0.74, 0.50))},
    # Griffes d'une main : quatre, côte à côte d'avant en arrière, de la jointure à la pointe.
    "griffes": {"taille": (5, 2),
                "doigts": ((((0.0, 1.05, -1.12), 0.22, 0.22), ((-0.1, 1.2, -1.45), 0.17, 0.17),
                            ((-0.3, 1.25, -1.72), 0.03, 0.03)),
                           (((0.0, 0.7, -1.15), 0.22, 0.22), ((-0.1, 0.8, -1.5), 0.17, 0.17),
                            ((-0.3, 0.82, -1.8), 0.03, 0.03)),
                           (((0.0, 0.35, -1.15), 0.22, 0.22), ((-0.1, 0.4, -1.5), 0.17, 0.17),
                            ((-0.3, 0.4, -1.78), 0.03, 0.03)),
                           (((0.0, 0.0, -1.12), 0.22, 0.22), ((-0.1, 0.0, -1.42), 0.17, 0.17),
                            ((-0.3, -0.02, -1.66), 0.03, 0.03)))},
    # Face (`modele.modelee`), dans la boîte de la tête : le mufle, la fente de la gueule, les arcades, les pommettes.
    "face": {"cotes": 30, "resserre": 1.4, "sommet": 1.0,
             "profil": ((-1.0, 0.56), (-0.84, 0.76), (-0.70, 0.84), (-0.56, 0.86), (-0.42, 0.86), (-0.28, 0.84),
                        (-0.10, 0.82), (0.08, 0.84), (0.26, 0.88), (0.44, 0.86), (0.62, 0.76), (0.78, 0.58),
                        (0.92, 0.36)),
             "reliefs": ((0, -0.58, 40, 0.34, 0.15), (0, -0.74, 64, 0.08, -0.16), (25, 0.32, 40, 0.17, 0.12),
                         (66, -0.40, 20, 0.30, 0.07))},
    # Défenses d'os, d'un côté, dans la boîte de la tête : chacune de sa racine, dans la mâchoire, à sa pointe.
    "defenses": {"taille": (6, 3),
                 "stations": (((0.34, 0.55, -0.80), 0.16, 0.16), ((0.44, 0.84, -0.66), 0.13, 0.13),
                              ((0.46, 0.92, -0.26), 0.02, 0.02))},
    # Bandeau de rune : points de son arc, ce dont il s'enfonce dans la face et en sort (en épaisseurs de sa primitive).
    "bandeau": (10, 2.0, 0.9),
    # Corne (`modele.corne`).
    "corne": {"ancrage": 0.34, "coude": 0.62, "montee": 0.40, "rayons": (1.0, 0.92, 0.66, 0.1), "taille": (8, 4)},
}

# Urne : rangs des deux corps du socle et leur profil ; rangs de la panse et des anses dans la recette.
URNE = {
    "socle": ((0, ASSISE), (1, DE)), "panse": 2, "anses": (7, 8),
    # Panse à godrons (`geometrie.froncee`) : ses anneaux (part de sa hauteur, part de son apothème, creux).
    "godrons": {"plis": 12, "pas": 4,
                "stations": ((0.0, 0.42, 0.0), (0.06, 0.36, 0.0), (0.12, 0.40, 0.0), (0.18, 0.60, 0.10),
                             (0.32, 0.86, 0.16), (0.50, 0.99, 0.16), (0.68, 0.99, 0.12), (0.84, 0.90, 0.05),
                             (0.93, 0.82, 0.0), (1.0, 0.74, 0.0))},
    # Pièces tournées (`geometrie.tourne`), chacune dans son cylindre de la recette : l'épaule, le col et sa lèvre, le
    # couvercle, le bouton.
    "cotes": 16,
    "tournes": ((3, ((0.0, 0.97), (0.25, 0.92), (0.55, 0.74), (0.80, 0.60), (1.0, 0.56))),
                (4, ((0.0, 0.86), (0.30, 0.76), (0.62, 0.80), (0.74, 0.98), (0.92, 0.98), (1.0, 0.90))),
                (5, ((0.0, 0.66), (0.12, 0.98), (0.40, 0.98), (0.52, 0.84), (0.80, 0.56), (1.0, 0.34))),
                (6, ((0.0, 0.52), (0.18, 0.40), (0.36, 0.78), (0.58, 0.98), (0.80, 0.82), (1.0, 0.30)))),
    # Anse (`modele.membre`), dans la boîte de la sienne : de l'épaule à la panse.
    "anse": {"taille": (6, 4),
             "stations": (((-3.4, 0.0, 0.78), 0.55, 0.55), ((-0.9, 0.0, 0.95), 0.55, 0.55),
                          ((0.2, 0.0, 0.55), 0.55, 0.55), ((0.2, 0.0, -0.35), 0.5, 0.5),
                          ((-0.7, 0.0, -0.95), 0.5, 0.5), ((-2.2, 0.0, -1.3), 0.5, 0.5))},
}

# Œuf de dragon : rang du nid et rangs des cylindres de l'œuf, du bas en haut, dans la recette.
OEUF = {
    "nid": 0, "oeuf": (1, 2, 3, 4, 5),
    # Bourrelet du nid (`maille.tour`), en parts de la hauteur et de l'apothème du nid : son flanc, du sol, puis son
    # dessus, du bord au milieu (part de l'apothème, part de la hauteur).
    "flanc": ((0.0, 0.0), (0.0, 0.93)),
    "dessus": ((0.985, 0.34), (0.95, 0.72), (0.84, 0.86), (0.70, 0.82), (0.52, 0.68), (0.0, 0.66)),
    "segments": 16,
    # Brins de paille (`geometrie.courbee`), couchés à demi dans le dessus du bourrelet : leur nombre ; bornes tirées
    # de leur rayon de départ et d'arrivée autour de l'axe (parts de l'apothème), de leur arc (degrés), de leur
    # grosseur (part de l'apothème) ; leurs tronçons et leurs côtés.
    "brins": {"nombre": 40, "rayon": (0.50, 0.92), "arc": (45, 110), "grosseur": (0.011, 0.018), "troncons": 5,
              "cotes": 5},
    # Coquille : part de l'apothème de chaque cylindre de l'œuf que garde son rayon à mi-hauteur ; points par tronçon
    # de son profil lissé ; segments de son tour.
    "coquille": {"parts": (0.80, 0.92, 0.90, 0.86, 0.80), "pas": 3, "segments": 16},
    # Écailles : rangs, du bas en haut, entre ces deux parts de la hauteur de l'œuf ; demi-largeur visée (part de la
    # hauteur de l'œuf) ; en fractions de la demi-largeur d'une écaille : sa demi-hauteur, ce dont son pourtour
    # s'enfonce dans la coquille, la saillie de sa pointe et ce dont elle descend sous son milieu.
    "ecailles": {"rangs": 9, "hauteurs": (0.10, 0.93), "demi": 0.062, "haut": 1.25, "enfonce": 0.14,
                 "saillie": 0.30, "descend": 0.55},
}

# Crâne (`modele.crane`) du trophée et des ossements. `voute` et `machoire` : formes (`modele.modelee`) dans la boîte de
# la voûte et dans celle de la mâchoire ; `orbite` : demi-largeur et demi-hauteur du creux d'une orbite (en celles de
# sa primitive d'ombre), sa profondeur (part du rayon) ; `nez` : hauteur, demi-largeur (degrés), demi-hauteur et
# profondeur de la cavité nasale ; `ombre` : ce que le fond sombre d'un creux garde de ses demi-côtés, ce dont son
# pourtour s'enfonce et dont son milieu remonte (parts de la profondeur du creux), ses côtés ; `dents` : leurs
# azimuts, les hauteurs de leur collet et de leur pointe dans la boîte de la mâchoire, leur demi-largeur (degrés), ce
# dont elles s'enfoncent et dont elles sortent (parts du demi-côté y de la mâchoire).
CRANE = {
    "voute": {"cotes": 20, "resserre": 1.5, "sommet": 1.0,
              "profil": ((-1.0, 0.50), (-0.82, 0.62), (-0.64, 0.72), (-0.46, 0.80), (-0.30, 0.86), (-0.12, 0.92),
                         (0.06, 0.97), (0.26, 1.0), (0.48, 0.96), (0.70, 0.83), (0.88, 0.58), (0.97, 0.30)),
              "reliefs": ((24, 0.34, 30, 0.16, 0.04), (54, -0.52, 16, 0.24, 0.09), (82, -0.2, 30, 0.5, -0.07))},
    "orbite": (1.5, 1.4, 0.26), "nez": (-0.62, 11, 0.30, 0.22), "ombre": (0.85, 0.12, 0.30, 6),
    "machoire": {"cotes": 20, "resserre": 1.5, "sommet": 1.0,
                 "profil": ((-1.0, 0.42), (-0.62, 0.56), (-0.24, 0.63), (0.14, 0.67), (0.46, 0.68), (0.76, 0.64)),
                 "reliefs": ((0, 0.30, 80, 0.26, -0.10), (0, -0.70, 34, 0.40, 0.10), (180, 0.0, 75, 1.3, -0.22))},
    "dents": {"azimuts": (-48, -29, -16, -6, 6, 16, 29, 48), "collet": 0.50, "pointe": 0.10, "demi": 4.0,
              "enfonce": 0.10, "saillie": 0.03},
}

# Crâne du monstre : `modele.crane`, plus fouillé, les arcades lourdes, un sillon au front, les dents longues.
GRAND_CRANE = {
    "voute": {"cotes": 32, "resserre": 1.6, "sommet": 1.0,
              "profil": ((-1.0, 0.52), (-0.86, 0.62), (-0.72, 0.70), (-0.58, 0.77), (-0.46, 0.82), (-0.34, 0.86),
                         (-0.22, 0.90), (-0.10, 0.93), (0.02, 0.96), (0.14, 0.98), (0.28, 0.98), (0.44, 0.95),
                         (0.60, 0.88), (0.76, 0.74), (0.90, 0.52), (0.97, 0.30)),
              "reliefs": ((25, 0.36, 34, 0.16, 0.08), (0, 0.46, 12, 0.3, -0.04), (55, -0.50, 17, 0.24, 0.11),
                          (84, -0.2, 30, 0.5, -0.09))},
    "orbite": (1.5, 1.4, 0.30), "nez": (-0.64, 12, 0.30, 0.26), "ombre": (0.85, 0.12, 0.30, 8),
    "machoire": {"cotes": 32, "resserre": 1.6, "sommet": 1.0,
                 "profil": ((-1.0, 0.44), (-0.70, 0.56), (-0.40, 0.63), (-0.10, 0.67), (0.20, 0.69), (0.48, 0.70),
                            (0.76, 0.66)),
                 "reliefs": ((0, 0.34, 82, 0.26, -0.11), (0, -0.70, 36, 0.40, 0.11), (180, 0.0, 75, 1.3, -0.24))},
    "dents": {"azimuts": (-56, -44, -4, 4, 44, 56), "collet": 0.56, "pointe": -0.05, "demi": 3.5,
              "enfonce": 0.12, "saillie": 0.035},
}

# Crâne de monstre : rangs de la voûte, de la mâchoire et des deux orbites ; des cornes (cylindre couché, cylindre
# dressé) ; de la rangée de dents dans la recette.
CRANE_MONSTRE = {
    "crane": (0, 1, (2, 3)), "cornes": ((4, 6), (5, 7)), "dents": 8,
    # Corne (`modele.corne`).
    "corne": {"ancrage": 0.30, "coude": 0.60, "montee": 0.42, "rayons": (1.0, 0.95, 0.70, 0.1), "taille": (10, 4)},
    # Crocs (`modele.membre`), d'un côté, dans la boîte de la rangée de dents : chacun de sa racine, dans le bas de
    # la voûte, à sa pointe, dans la rangée ; ses rayons en fractions du demi-côté x de la rangée.
    "crocs": {"taille": (6, 3),
              "dents": ((((0.62, -8.75, 8.3), 0.22, 0.22), ((0.66, -2.5, 4.0), 0.17, 0.17),
                         ((0.70, 0.0, -0.9), 0.02, 0.02)),
                        (((0.30, -8.0, 8.3), 0.14, 0.14), ((0.30, -3.2, 4.6), 0.10, 0.10),
                         ((0.30, -1.5, 1.5), 0.02, 0.02)))},
}

# Trophée de crânes : rangs de la pierre, du pieu et de la traverse ; des crânes (voûte, mâchoire, orbites), celui du
# faîte d'abord ; rangs, parmi eux, de ceux qui pendent à la traverse.
TROPHEE = {
    "pierre": 0, "pieu": 1, "traverse": 2,
    "cranes": ((3, 4, (5, 6)), (7, 8, (9, 10)), (11, 12, (13, 14)), (15, 16, (17, 18))), "pendus": (1, 2),
    # Pierre de calage : côtés, part du rayon que garde chacun (tirée), ses anneaux (part de la hauteur, part de
    # l'apothème).
    "calage": {"cotes": 9, "bosse": (0.84, 1.0), "anneaux": ((0.0, 1.0), (0.45, 0.96), (0.80, 0.80), (1.0, 0.56))},
    # Pieu : son profil du pied à sa pointe, dans le crâne du faîte (`geometrie.tournee`), ses côtés.
    "fut": (((0.0, 0.98), (0.30, 0.90), (0.62, 0.86), (0.90, 0.80), (0.96, 0.62), (1.0, 0.12)), 7),
    # Traverse : son rayon (part de son apothème), ses côtés.
    "barre": (0.70, 6),
    # Corde d'un crâne pendu, en parts de l'apothème de la traverse : rayon de son brin ; nœud (`maille.tore`) :
    # segments de son tour et de sa section ; part de la demi-hauteur de la voûte où le brin s'enfonce sous son sommet.
    "corde": {"brin": 0.13, "segments": (10, 5), "ancrage": 0.30},
}

# Profils d'un os long (`geometrie.tournee`) : (part de sa longueur, part du rayon de son cylindre).
FEMUR = ((0.0, 0.55), (0.03, 0.92), (0.07, 1.0), (0.12, 0.84), (0.20, 0.50), (0.50, 0.42), (0.80, 0.50), (0.87, 0.82),
         (0.92, 1.0), (0.97, 0.92), (1.0, 0.55))
"""Un fémur : une épiphyse renflée à chaque bout d'une diaphyse mince."""
TIBIA = ((0.0, 0.60), (0.04, 1.0), (0.10, 0.86), (0.20, 0.50), (0.55, 0.40), (0.84, 0.46), (0.92, 0.76), (0.97, 0.80),
         (1.0, 0.50))
"""Un tibia : un plateau large à un bout, une cheville plus mince à l'autre."""

# Ossements : rang et profil de chaque os long ; rangs du crâne (voûte, mâchoire, orbites) et de la cage dans la
# recette.
OSSEMENTS = {
    "os": ((0, FEMUR), (1, FEMUR), (2, TIBIA), (3, TIBIA)), "crane": (4, 5, (6, 7)), "cage": 8,
    # Vertèbres, en file sur le grand côté de la boîte de la cage, posées au sol : leur nombre, le profil de chacune
    # (`geometrie.tournee`), leur rayon (fraction de la demi-hauteur de la boîte), leurs côtés.
    "vertebres": (6, ((0.0, 0.50), (0.22, 1.0), (0.72, 1.0), (1.0, 0.50)), 0.62, 6),
    # Côtes (`modele.membre`), une paire par vertèbre : leur flèche (part de la portée sous l'enveloppe, à l'aplomb de
    # la vertèbre) ; leurs points (écart à la file en demi-petits côtés de la boîte, hauteur de leur dessous en
    # flèches, rayon en fraction de celui d'une vertèbre), du sol, où repose son bout, à la vertèbre.
    "cotes": {"fleche": 0.66, "taille": (5, 3),
              "stations": ((0.94, 0.0, 0.45), (0.96, 0.40, 0.55), (0.86, 0.80, 0.62), (0.50, 0.92, 0.70),
                           (0.0, 0.10, 0.75))},
}
