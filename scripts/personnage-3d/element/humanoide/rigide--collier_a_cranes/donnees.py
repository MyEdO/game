"""Données de `humanoide--rigide--collier_a_cranes` (l'Apothicaire, #4261) : le collier à crânes
(`src/data/apparences.json`, forme `amulette`), apparence de l'objet `amulette` du preset `apothicaire`, rangé au cou
(`cou`). Clément, 2026-11-15 (#4261) : « Le collier ce n est pas ça du tout », dit de l'amulette générique du Sorcier.

Illustration directrice : ligne de `INDEX.md` du recueil `illustrations-wfrp` « Apothicaire | apothicaire |
`carrieres/apothicaire.png` | Livre de Base | 87 » (hors dépôt). Ce qu'elle montre (x 450-560, y 265-495 px) : une
chaîne de fer sombre à gros maillons part des deux côtés du cou par-dessus le foulard et descend presque droit jusqu'au
capuchon d'un fuseau de métal de chaque côté ; au bas du foulard, entre les deux brins, un petit crâne de métal flanqué
de deux ailes arquées qui remontent vers les brins ; de ce petit crâne pend un court bout de chaîne jusqu'à un crâne
d'os jaune pâle, au milieu de la poitrine, entre les deux fuseaux, plus hauts que lui à leur capuchon et plus bas à leur
pointe. Les crânes gravés sur les fuseaux sont des motifs : ils ne sont pas modelés. Échelle relevée : environ 600 px/m
(du dessus du crâne sous la coiffe, y ~85 px, aux semelles, y ~1165 px, pour les 1,82 m de la base), HYPOTHÈSE : la
figure est voûtée, la mesure sous-estime sa taille d'environ 5 %. Origine des cotes : l'emplacement, pris au point
(x 507, y 278 px), juste sous le départ des deux brins.

Repère de la prise `main` de la base, qui est aussi celui du rangement (`hotes/godot/pont/CONTRAT.md`, `bases`) : rangé,
+Y descend le long du corps, +Z sort sur la normale de l'emplacement, l'origine est sur
l'emplacement ; la face arrière se pose sur ce qui est porté dessous (`MontageDeComposition._appuyer`). Tout le collier
pend sous l'origine (y > 0). Mètres.
"""

MANIFESTE = {
    'categorie': 'rigide',
    'cle': {'apparence': 'collier_a_cranes'},
    'liaison': {'mode': 'rigide'},
}
PRISE = 'main'

MATERIAUX = {
    'metal': ('metal', ((0.66, 0.66, 0.66), 0.6, 0.45)),
    'os': ('corne', ((0.75, 0.75, 0.75), 0.0, 0.85)),
}
"""Brief (#4261) : chaîne, petit crâne et fuseaux sur l'emplacement `metal` ; le crâne d'os sur `corne`, l'ivoire de
l'os et de la corne, comme la tranche du livre (`rigide--livre`)."""

BUDGET_TRIANGLES = 800           # procédure du skill, section 7 : accessoire (brief du ticket)

PLAN = 0.10
"""La cote z de la face arrière de tout le collier sous le foulard (ailes, petit crâne, chaîne, crâne d'os, fuseaux) :
un plan, que l'hôte recule et fait pivoter sur ce qui est porté (`MontageDeComposition._appuyer`). Seul le haut des
brins s'en écarte, couché sur le foulard (`BRINS`). Valeur relative : l'hôte la ramène à son jeu
(recul simulé : 3 mm)."""

POSE = ("simulation de `MontageDeComposition._appuyer` sur la tenue du preset `apothicaire` au repos (corps, "
        "`tete--humain`, `foulard`, `pourpoint-matelasse`, `cheveux-nattes`, silhouettes feminin=1, corpulence=0,6), "
        "lancers le long de -Z dans le repère du rangement au cou ; recul 3 mm, pivot 26 degrés")
"""L'axe de l'os du cou, que suit +Y, penche d'environ 31 degrés vers l'avant : sous la zone d'appui (les 5 cm sous
l'attache), la poitrine monte vers +Z en descendant, et l'hôte fait pivoter le collier, le bas vers l'extérieur, autour
de l'attache. Ce pivot remonte le bas d'environ 30 % : les cotes y du bas sont étirées d'autant (`ETIREMENT`) pour que,
posé, le petit crâne tombe au bas du foulard et le crâne d'os au milieu de la poitrine. Relevés de la sonde (x, y : z) :
bord haut du foulard au côté du cou (0,05, -0,01 : 0,010), foulard (0,05, 0,05 : 0,095) ; les nattes pendent devant le
foulard à |x| ≥ 0,07 de y 0,05 à 0,10 (z jusqu'à 0,16) : les brins passent en dedans. Écart mesuré par la même
simulation, collier posé : 2 à 5 cm devant la poitrine, jusqu'à 10 cm au haut des brins (signalé, #4261)."""

ETIREMENT = {'depuis': 0.06, 'facteur': 1.4}
"""Les cotes y relevées sur l'illustration, au-delà de `depuis` sous l'attache (la zone d'appui de l'hôte, arrondie à
sa case), étirées de `facteur` (`POSE`) : réglé par la simulation, qui pose alors le petit crâne vers y 0,06 et le
crâne d'os vers y 0,21."""

BRINS = [(0.052, -0.012, 0.027), (0.055, 0.02, 0.083), (0.056, 0.05, 0.113), (0.054, 0.085, PLAN),
         (0.047, 0.13, PLAN), (0.045, 0.168, PLAN)]
"""Le brin gauche (x, y, z), miroir du droit, de son départ au cou jusqu'au fleuron de son fuseau. Illustration : les
brins partent des côtés du cou, au bord haut du foulard, et descendent presque droit jusqu'au capuchon des fuseaux ;
écart au départ : environ 48 px de l'axe (8 cm), ramené à 5,2 cm, le côté du cou de la base sous le foulard, en dedans
des nattes (`POSE`). Les trois premiers points, dans la zone d'appui, suivent le foulard à 2 cm (sonde) : un brin plan
y reculait tout le collier de 10 cm. Ils ne font pas le tour du cou : l'hôte pose le collier sur ce qui est porté
(`_appuyer`), et une boucle derrière le cou le repousserait loin de la poitrine."""

AILE = [(0.054, 0.085, PLAN), (0.035, 0.075, PLAN), (0.013, 0.094, PLAN + 0.006)]
"""L'aile gauche du petit crâne (x, y, z), du brin au crâne. Illustration : deux arcs d'environ 52 px d'envergure
qui remontent du crâne vers les brins ; lus comme deux bouts de chaîne, qui tiennent le petit crâne aux brins (le
brief : les deux brins se rejoignent sur lui). HYPOTHÈSE de lecture : l'illustration les dessine nervurés, ornement ou
chaîne."""

CHAINON = {'pas': 0.02, 'largeur': 0.009, 'epaisseur': 0.0035, 'recouvrement': 0.002}
"""Illustration : gros maillons d'environ 7 px (1,2 cm). Chaque maillon est une barrette, à plat puis de chant, en
alternance : la chaîne en dents de scie se lit à taille de jeu sans le budget d'anneaux ouverts. HYPOTHÈSE : pas de
2 cm, plus long que dessiné, pour tenir dans le budget avec le bas étiré (`ETIREMENT`) ; chaque maillon chevauche le
suivant de `recouvrement`."""

PETIT_CRANE = {'centre': 0.10, 'arriere': PLAN, 'largeur': 0.028, 'hauteur': 0.034, 'profondeur': 0.026,
               'segments': 6}
"""Illustration : le petit crâne de métal au bas du foulard, environ 17 × 20 px, centré 61 px sous l'origine ;
`profondeur` : HYPOTHÈSE."""

CRANE = {'centre': 0.22, 'arriere': PLAN, 'largeur': 0.04, 'hauteur': 0.053, 'profondeur': 0.044, 'segments': 8,
         'orbites': {'hauteur': 0.48, 'creux': 0.55}}
"""Illustration : le crâne d'os, environ 24 × 32 px, centré 132 px sous l'origine ; `profondeur` : HYPOTHÈSE. Les
orbites sont deux creux de son anneau à `hauteur` (fraction depuis le sommet), ses sommets avant-gauche et avant-droit
ramenés à `creux` de leur rayon : sans eux, l'ovale ne se lit pas comme un crâne."""

PROFIL_DE_CRANE = [(0.0, 0.0, 0.0), (0.08, 0.6, 0.6), (0.28, 0.97, 0.95), (0.48, 1.0, 1.0), (0.66, 0.82, 0.8),
                   (0.82, 0.6, 0.55), (0.94, 0.45, 0.35), (1.0, 0.0, 0.0)]
"""Révolution d'un crâne de face, (fraction de hauteur depuis le sommet, fraction de demi-largeur, fraction de
demi-profondeur) : la calotte ronde, les tempes, la mâchoire étroite. HYPOTHÈSE de forme, commune aux deux crânes."""

CHAINE_DU_CRANE = [(0.0, 0.117, PLAN + 0.006), (0.0, 0.193, PLAN + 0.006)]
"""Le bout de chaîne du petit crâne au crâne d'os (x, y, z), de la mâchoire de l'un au sommet de l'autre. Illustration :
environ 42 px (7 cm)."""

FUSEAU = {'x': 0.045, 'haut': 0.172, 'segments': 6,
          'profil': [(0.0, 0.0), (0.012, 0.006), (0.014, 0.013), (0.026, 0.014), (0.028, 0.019),
                     (0.07, 0.024), (0.13, 0.016), (0.18, 0.0)]}
"""Illustration : chaque fuseau fait environ 109 px (18 cm) du sommet de son capuchon à sa pointe, et 29 px (4,8 cm) au
plus large, au tiers haut ; son capuchon, environ 12 px (2 cm), coiffé d'un fleuron où s'accroche le brin. Profil (cote
sous le sommet, rayon), son axe dans le plan des fuseaux, sur `PLAN` au plus large. `x` : 24 px de
l'axe sur l'illustration (4 cm), porté à 4,5 cm pour ne pas entrer dans le crâne d'os, plus large que dessiné
(HYPOTHÈSE)."""


ANGLE_LISSE = 40                 # degrés : arêtes plus vives que cet angle gardées vives
