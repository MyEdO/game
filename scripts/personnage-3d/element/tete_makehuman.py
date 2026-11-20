"""Tête de race sur la base, au repos pris à la tête de MakeHuman (#4413), pour le `modele.py` d'un élément
`tete--<race>` qui ne porte que `from tete_makehuman import construire` et son `donnees.py`. Le pack `mpfb` (dossier
`data` de MPFB, celui de la silhouette `corpulence`) est celui de la base, tiré et vérifié par `production.pack_source`.

Forme : `base.obj` chargé des cibles `macrodetails` d'un homme jeune moyen (`corpulence.forme_macro`) et de
`BOUCHE_FERMEE`, puis des cibles `CUITES` de `donnees.py` (`((cible sous targets/, poids), …)`), qui font la race. La forme se recale sur le tronc de la
base (`corpulence.recalage`), puis se cale au crâne de la tête humaine publiée (`TAILLE_PUBLIEE`, `calage`) : le calage
se mesure sur la forme sans cibles cuites, pour qu'une race garde l'écart que ses cibles lui donnent.

Maillage : les faces de `body` dont l'os dominant est la tête ou le cou (`corpulence.os_des_faces`), au-dessus de
l'enveloppe haute de la couture du cou de la base vue de `CENTRE` (`tete.elevation_de_la_couture`, plus
`MARGE_DE_COUTURE_DEG`), choisies sur la forme sans cibles cuites. Au-dessus de la couture, la peau passe de celle de
la tête de la base à celle de MakeHuman sur `FONDU_DU_COU` (`tete.fondre_sur_le_cou`), et les écarts venus de
MakeHuman (`feminin`, traits) y prennent la même part. Les faces qu'on ne voit de nulle part (`cachees` :
orbites, dessous des paupières, cavité de la bouche, fond des narines), ni au repos ni sous `feminin` ni sous un
trait, sont retirées. Le bord bas se coud à un rang posé sur la peau de la base (`RANG_DU_COU`,
`tete.directions_des_rangs`), lui-même cousu à la couture (`tete.coudre`), aux poids, aux clés et aux normales du cou ;
tout autre bord (entre les lèvres, entre les paupières derrière chaque œil) se ferme d'un éventail à ses propres
sommets (`fermer`), qui prend les poids et les clés du bord qu'il double : sous `visage_inverse`, qui emporte l'œil,
la peau est close derrière lui. Les poids, empruntés au plus près à la peau de la tête de la base, sont adoucis
(`poids_adoucis`). Yeux : les groupes `helper-l-eye` et `helper-r-eye`. Sourcils : les faces que la cible `SOURCILS`
déplace le plus (`faces_des_sourcils`), doublées à `EPAISSEUR_DES_SOURCILS_M` de la peau en matière `cheveux`, aux
poids et aux clés de la peau qu'elles doublent.

Clés : les silhouettes et les clés `gabarit_*` de la base, transférées du corps (`tete.cles_du_corps`) ; `feminin` y
ajoute l'écart, sommet à sommet, de la même forme à l'état macro `ETAT_FEMININ`, recalée et calée comme elle : le calage
annule l'écart de taille de MakeHuman entre les deux états, qui est celui de la stature, que la base ne change pas, et
les pièces de tête restent bâties à cette taille ; hors du visage et des oreilles, cet écart ne garde que ce qu'il
change de la forme (`sans_glissement`), et à la nuque, hors de l'avant (`part_de_l_avant`), la clé passe au-dessus de
la couture de celle du cou de la base à celle de la tête sur `FONDU_DU_FEMININ`. Chaque trait de
`TRAITS`, partagé par toutes ces têtes, ses cibles lues sommet à sommet ; `visage_inverse`
(mutation « Visage inversé », `mutations.json`), le visage retourné tête en bas : de `AXE` (sur l'axe avant-arrière à la
hauteur `AXE_DU_VISAGE`), chaque sommet du visage prend le rayon de la peau dans la direction reflétée par le plan
horizontal de cet axe, entier devant, nul hors de `OUVERTURE_DU_VISAGE_DEG` ; ce rayon est la médiane de ceux du sommet
et de ses voisins, car une visée qui rase le bord d'une paupière passe dans l'orbite ; les yeux tournent d'un demi-tour
autour de l'axe, et la peau retournée devant chacun recule au plan de son centre, sur `PART_DE_L_ORBITE` de son rayon,
pour qu'il se voie.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x) ; une cote se donne depuis la tête de l'os `Head` au repos.
"""
import numpy as np
from mathutils.bvhtree import BVHTree

from corpulence import RACES, forme_macro, lire_cible, lire_obj, os_des_faces, recalage, tetes, vers_blender
from formes import poser_la_cle
from noms_formes_de_tete import ARCADES_MARQUEES, JOUES_CREUSES, NEZ_FORT, VISAGE_INVERSE, VISAGE_LONG
from noms_silhouettes import FEMININ
from production import pack_source
from tete import (PORTEE_M, azimut, cles_du_corps, coudre, couture, decalages_monde, depuis_l_arriere,
                  directions_des_rangs, elevation,
                  elevation_de_la_couture, fondre_sur_le_cou, normales_de_sommet, parts_du_fondu,
                  poser_les_normales_de_la_couture)
from tissu import Maillage, emprunter, fondu, lisser, maillage_skinne, poids_normalises, porteur_de, voisinage

ETAT = 'male-young-averagemuscle-averageweight'
ETAT_FEMININ = 'female-young-averagemuscle-averageweight'
FONDU_DU_COU = 0.1
"""HYPOTHÈSE : part de l'arc de la couture au pôle sur laquelle la tête passe de la peau de la base à MakeHuman
(`tete.fondre_sur_le_cou`) : elle garde à une race sa mâchoire (nain : 8,6 mm sur 8,7 de son écart à l'humain) et
adoucit le ressaut de la nuque sans l'effacer. Les têtes de `tete.py` ont la leur (`FONDU_DU_COU` de leur `donnees.py`,
0,2), qui efface mieux ce ressaut mais ne laisse au nain que 6,4 mm."""
RANG_DU_COU = 0.045
"""Part de l'arc de la couture au pôle où se pose, sur la peau de la base, le rang qui relie la couture à la peau de
MakeHuman, comme le premier rang d'une tête de `tete.py` : celle du premier rang de l'orc (`RANGS` de son
`donnees.py`), sous `MARGE_DE_COUTURE_DEG`."""
FONDU_DU_FEMININ = 0.25
"""HYPOTHÈSE : part de l'arc de la couture au pôle sur laquelle, hors de l'avant (`part_de_l_avant`), la clé `feminin`
passe de celle du cou de la base, à la couture, à celle de la tête (`tete.parts_du_fondu`), réglée à l'œil : le cou de
la base s'amincit, la nuque le suit et le ressaut sous le crâne s'adoucit ; devant, sous la mâchoire, la tête garde sa
clé, sans facette sous le menton. Étendu aux autres clés du corps, ce fondu rompt leur suivi du corps (`suiviDuCorps`,
`gabarit_head_plus`)."""
SOURCILS = 'eyebrows/eyebrows-trans-forward'
"""Cible dont les faces les plus déplacées portent les sourcils (`faces_des_sourcils`)."""
OREILLES = ('ears/l-ear-trans-backward', 'ears/r-ear-trans-backward')
"""Cibles qui déplacent chaque oreille d'un bloc : la part d'un sommet dans une oreille est son déplacement sur le plus
grand de sa cible."""
EPAISSEUR_DES_SOURCILS_M = 0.001
"""HYPOTHÈSE : écart des sourcils à la peau (brief de l'orchestrateur du 2026-11-20, #4413, « environ 1 mm » : une
évaluation d'ingénierie, pas un arbitrage de l'utilisateur)."""
OS_DE_LA_TETE = ('Head', 'neck_01')
YEUX = ('helper-l-eye', 'helper-r-eye')
BOUCHE_FERMEE = (('mouth/mouth-upperlip-height-incr', 1.0),
                 *((f'expression/units/{race}/mouth-compression', 0.5 / len(RACES)) for race in RACES))
"""Cibles qui ferment la bouche de la forme neutre, entrouverte de 1,5 mm au milieu (mesuré de face sur `base.obj`) : la
lèvre haute plus haute, et l'unité d'expression des lèvres serrées, moyennée sur les races comme les cibles
`macrodetails` (HYPOTHÈSE : poids, les plus faibles qui ferment la fente au milieu, à 1 cm et à 2 cm)."""
ZONES_DES_CLES = ['tete', 'visage', 'nez']
"""Zones de peau de la base que la tête remplace : ses poids au plus près."""
CENTRE = (0.0, -0.0054, 0.0807)
"""base : milieu de la boîte de la tête, sous les yeux ; d'où se déplie la couture."""
MARGE_DE_COUTURE_DEG = 9.0
"""HYPOTHÈSE : élévation au-dessus de l'enveloppe de la couture sous laquelle une face du donneur est retirée."""
VISEES = 256
"""HYPOTHÈSE : directions, réparties sur la sphère puis doublées de leur reflet gauche-droite, d'où se cherche une vue
libre sur une face."""
FEMININS_VUS = (0.5, 1.0)
"""Poids de `feminin` où se cherche une face cachée, avec le repos et chaque trait de `TRAITS` à 1."""
ECART_DE_VISEE_M = 1e-4
"""Départ d'une visée au-dessus de sa face, pour qu'elle ne la touche pas elle-même."""
PASSES_DE_LISSAGE_MAX = 20
"""Passes de lissage des poids au-delà desquelles la construction s'arrête."""
PINCEAU_M = {'rayon': 0.001, 'depart': 0.005}
"""HYPOTHÈSE : une vue libre est un pinceau, pas un fil : quatre visées parallèles, à `rayon` de la première et parties à
`depart` de la face, sortent aussi. Une fente plus étroite (entre les lèvres, aux commissures) ne montre rien : elle se
ferme."""
MILIEU_M = 0.012
"""Demi-largeur de la bande médiane où se lit le dessous du menton."""
DEVANT_M = 0.045
"""Recul depuis le bout du nez en deçà duquel un point de la bande médiane est du visage, pas du cou."""
TAILLE_PUBLIEE = {'sommet': 0.2103, 'menton': -0.0125, 'yeux': 0.0986, 'avant': -0.1119, 'arriere': 0.0887,
                  'demi_largeur': 0.0696}
"""Cotes de la tête humaine publiée (GLB be2c87c7…), à laquelle sont bâties les pièces de tête, relevées par `cotes`
depuis `Head` : z du sommet du crâne, du menton et des yeux, y de l'avant et de l'arrière du crâne au-dessus des yeux,
demi-largeur de la peau à la hauteur des yeux devant y -0,03."""
AXE_DU_VISAGE = 0.05
"""publiée : z du milieu des arcades au menton, axe du retournement de `visage_inverse`."""
OUVERTURE_DU_VISAGE_DEG = {'azimut': (60.0, 85.0), 'elevation': (36.0, 46.0)}
"""HYPOTHÈSE : de part et d'autre de l'avant et du plan de l'axe, l'angle jusqu'où `visage_inverse` est entière, puis
celui où elle est nulle."""
PART_DE_L_ORBITE = 0.8
"""HYPOTHÈSE : part du rayon d'un œil retourné sur laquelle la peau recule devant lui."""
TRAITS = {
    NEZ_FORT: (('nose/nose-scale-vert-incr', 1.0), ('nose/nose-scale-depth-incr', 0.8), ('nose/nose-volume-incr', 0.5),
               ('nose/nose-point-down', 0.5)),
    ARCADES_MARQUEES: (('eyebrows/eyebrows-trans-forward', 1.0), ('eyebrows/eyebrows-trans-down', 0.7),
                       ('eyebrows/eyebrows-angle-down', 0.5)),
    JOUES_CREUSES: (('cheek/l-cheek-bones-incr', 1.0), ('cheek/r-cheek-bones-incr', 1.0),
                    ('cheek/l-cheek-volume-decr', 1.0), ('cheek/r-cheek-volume-decr', 1.0),
                    ('cheek/l-cheek-inner-decr', 0.5), ('cheek/r-cheek-inner-decr', 0.5)),
    VISAGE_LONG: (('chin/chin-height-incr', 1.0), ('chin/chin-jaw-drop-incr', 0.5)),
}
"""Traits du visage, par clé de forme : les cibles de MakeHuman (`targets/` du pack) et leur poids. Illustration : le
Sorcier (LDB folio 92, hors dépôt), nez long et fort, arcades basses et saillantes, pommette haute sur une joue creuse,
visage long (HYPOTHÈSE : la barbe cache le menton) ; poids HYPOTHÈSE, réglés à l'œil."""


def triangles_de(faces):
    """Les triangles des `faces` (polygones convexes), en éventail."""
    return np.array([(f[0], f[k], f[k + 1]) for f in faces for k in range(1, len(f) - 1)])


def voisins_de_bord(triangles):
    """Par sommet du bord de `triangles`, ses voisins le long du bord : deux sur une boucle simple."""
    compte = {}
    for t in triangles:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            arete = (min(a, b), max(a, b))
            compte[arete] = compte.get(arete, 0) + 1
    voisins = {}
    for (a, b), n in compte.items():
        if n == 1:
            voisins.setdefault(a, []).append(b)
            voisins.setdefault(b, []).append(a)
    return voisins


def boucles_de_bord(triangles, X):
    """Les boucles simples du bord de `triangles` (sommets `X`), de la plus longue à la plus courte, en mètres."""
    voisins = voisins_de_bord(triangles)
    if any(len(v) != 2 for v in voisins.values()):
        raise ValueError('tête MakeHuman : un bord du maillage n\'est pas une boucle simple')
    boucles, vus = [], set()
    for depart in voisins:
        if depart in vus:
            continue
        boucle, precedent = [depart], None
        while True:
            suivant = next(v for v in voisins[boucle[-1]] if v != precedent)
            if suivant == depart:
                break
            precedent = boucle[-1]
            boucle.append(suivant)
        vus.update(boucle)
        boucles.append(boucle)
    return sorted(boucles, key=lambda b: np.linalg.norm(X[b] - X[b[1:] + b[:1]], axis=1).sum(), reverse=True)


def composantes(triangles):
    """Par sommet de `triangles`, un sommet de sa composante connexe (par sommet partagé), le même pour toute la
    composante."""
    parent = {}

    def racine(i):
        while parent.setdefault(i, i) != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b, c in triangles:
        parent[racine(a)] = racine(b)
        parent[racine(b)] = racine(c)
    return {i: racine(i) for i in parent}


def composante_du_haut(triangles, X):
    """Les triangles de la composante connexe (par sommet partagé) qui porte le sommet le plus haut."""
    de = composantes(triangles)
    haut = de[max(de, key=lambda i: X[i][2])]
    return np.array([t for t in triangles if de[t[0]] == haut])


def faces_des_sourcils(triangles, amplitudes):
    """Les triangles de `triangles` que la cible `SOURCILS` déplace le plus (`amplitudes`, par sommet), aussi loin
    qu'ils font deux sourcils : le plus bas niveau d'amplitude au-dessus duquel les triangles aux trois sommets déplacés
    forment deux composantes. Plus bas, les deux sourcils se rejoignent en un bandeau sur le front."""
    for niveau in np.unique(amplitudes[amplitudes > 0]):
        faces = triangles[(amplitudes[triangles] >= niveau).all(axis=1)]
        if len(set(composantes(faces).values())) == 2:
            return faces
    raise ValueError('tête MakeHuman : aucun niveau de la cible des sourcils ne fait deux sourcils')


def visees():
    """`VISEES` directions en spirale sur la sphère, et leurs reflets gauche-droite : une tête symétrique garde des faces
    symétriques."""
    i = np.arange(VISEES) + 0.5
    polaire, tour = np.arccos(1.0 - 2.0 * i / VISEES), np.pi * (1.0 + 5.0 ** 0.5) * i
    D = np.column_stack([np.cos(tour) * np.sin(polaire), np.sin(tour) * np.sin(polaire), np.cos(polaire)])
    return np.concatenate([D, D * np.array([-1.0, 1.0, 1.0])])


def cachees(triangles, etats, ecrans, sens):
    """Le masque des `triangles` qu'on ne voit de nulle part, dans aucun des `etats` (positions des sommets) : de son
    milieu et du milieu de chacun de ses rayons, côté dehors (`sens` fois la normale de son enroulement), aucun pinceau
    (`PINCEAU_M`) des `visees` ne sort sans toucher un triangle de `triangles` ou de `ecrans`."""
    D = visees()

    def libre(arbre, o, d, n):
        if arbre.ray_cast(o.tolist(), d.tolist())[0] is not None:
            return False
        u = np.cross(d, n)
        u /= np.linalg.norm(u)
        v = np.cross(d, u)
        depart = o + PINCEAU_M['depart'] * d
        return all(arbre.ray_cast((depart + PINCEAU_M['rayon'] * w).tolist(), d.tolist())[0] is None for w in (u, -u, v, -v))

    reste = np.arange(len(triangles))
    for Q in etats:
        arbre = BVHTree.FromPolygons([tuple(q) for q in Q], triangles.tolist() + ecrans.tolist(), all_triangles=True)
        vus = []
        for k in reste:
            a, b, c = Q[triangles[k]]
            n = sens * np.cross(b - a, c - a)
            n /= max(np.linalg.norm(n), 1e-12)
            g = (a + b + c) / 3.0
            dehors = D[D @ n > 0.0]
            vus.append(any(libre(arbre, o + ECART_DE_VISEE_M * n, d, n)
                           for o in (g, 0.5 * (g + a), 0.5 * (g + b), 0.5 * (g + c)) for d in dehors))
        reste = reste[~np.array(vus, dtype=bool)]
    cache = np.zeros(len(triangles), dtype=bool)
    cache[reste] = True
    return cache


def fermer(M, boucle, X, C):
    """Ferme la boucle `boucle` (sommets `X`) d'un éventail, et rend ses sommets dans `M` : ceux du bord, doublés, puis son
    centre, au milieu de la boucle : l'éventail affleure le bord de ce qui se voit, sans fond d'ombre entre deux lèvres.
    Ses triangles s'enroulent tous dans le sens de la boucle, celui qui tourne leur somme à l'opposé de l'axe vertical de
    `C` : presque horizontaux entre deux lèvres, tournés un à un vers l'avant ils se tournaient le dos. L'éventail a ses
    sommets à lui : là où les lèvres se chevauchent, il se replie, et ses normales, mêlées à celles de la peau,
    ombraient le bord des lèvres."""
    milieu = X[boucle].mean(axis=0)
    siens = M.ajouter([*X[boucle], milieu], 'peau')
    A, B = X[boucle], X[boucle[1:] + boucle[:1]]
    normales = np.cross(B - A, milieu - A)
    normales *= -np.sign(normales.sum(axis=0) @ ((C - milieu) * np.array([1.0, 1.0, 0.0])))
    for i, (a, b_, n) in enumerate(zip(A, B, normales)):
        M.triangle(siens[i], siens[(i + 1) % len(boucle)], siens[-1], (a + b_ + milieu) / 3.0 - n / np.linalg.norm(n))
    return siens


def poids_adoucis(W, P, orientes, couture):
    """Les poids `W` des sommets `P` (triangles `orientes`) lissés (`tissu.lisser`), ceux des `couture` premiers sommets
    tenus, jusqu'à ce qu'aucune arête ne porte un saut de poids par mètre plus fort que la couture du cou de la base :
    emprunté au plus près, le poids de deux sommets voisins de la lèvre basse se prend de part et d'autre de la bouche de
    la base, et leur arête, d'un millimètre, s'étire quand la tête tourne sur le cou."""
    aretes = np.unique(np.sort(np.concatenate([orientes[:, [0, 1]], orientes[:, [1, 2]], orientes[:, [2, 0]]]), axis=1), axis=0)
    longueurs = np.linalg.norm(P[aretes[:, 0]] - P[aretes[:, 1]], axis=1)
    de_la_couture = (aretes < couture).all(axis=1)
    voisins = voisinage(orientes, len(P))

    def sauts(W):
        return np.abs(W[aretes[:, 0]] - W[aretes[:, 1]]).sum(axis=1) / longueurs

    passes = 0
    while sauts(W)[~de_la_couture].max() > sauts(W)[de_la_couture].max():
        if passes == PASSES_DE_LISSAGE_MAX:
            raise ValueError(f'tête MakeHuman : poids encore plus raides que la couture après {passes} passes de lissage')
        W = np.concatenate([W[:couture], lisser(W, voisins, 1)[couture:]])
        passes += 1
    print('TETE_MH poids :', passes, 'passe(s) de lissage ; saut le plus fort', round(float(sauts(W)[~de_la_couture].max()), 1),
          'par mètre, couture', round(float(sauts(W)[de_la_couture].max()), 1), flush=True)
    return W


def cotes(peau, yeux, H):
    """Les cotes de `TAILLE_PUBLIEE` d'une tête : sa peau `peau` (sommets, monde), ses yeux `yeux` (sommets), l'os `Head`
    en `H`. Le menton est le point du visage, dans la bande médiane, le plus avancé vers l'avant et le bas à parts
    égales : il ne dépend ni de la gorge ni de l'endroit où la peau est coupée sous lui."""
    p = peau - H
    hauteur_des_yeux = (yeux - H)[:, 2].mean()
    milieu = p[np.abs(p[:, 0]) < MILIEU_M]
    visage = milieu[milieu[:, 1] < milieu[:, 1].min() + DEVANT_M]
    crane = p[p[:, 2] > hauteur_des_yeux]
    aux_yeux = p[(np.abs(p[:, 2] - hauteur_des_yeux) < MILIEU_M) & (p[:, 1] < -0.03)]
    return {'sommet': p[:, 2].max(), 'menton': visage[np.argmin(visage[:, 1] + visage[:, 2]), 2],
            'yeux': hauteur_des_yeux, 'avant': crane[:, 1].min(), 'arriere': crane[:, 1].max(),
            'demi_largeur': np.abs(aux_yeux[:, 0]).max()}


def calage(peau, yeux, H):
    """`(échelle, translation)` qui portent la tête de peau `peau` et d'yeux `yeux` au crâne de `TAILLE_PUBLIEE`, que
    coiffent les pièces de tête : une seule échelle, celle de la profondeur du crâne d'avant en arrière ; le sommet du
    crâne et son milieu d'avant en arrière sur ceux de la tête publiée. Le menton et les yeux, que le visage de
    MakeHuman place autrement que la tête publiée, ne calent rien : leur écart s'imprime, avec celui de la demi-largeur."""
    c, v = cotes(peau, yeux, H), TAILLE_PUBLIEE
    echelle = (v['arriere'] - v['avant']) / (c['arriere'] - c['avant'])
    translation = np.array([0.0, 0.5 * (v['avant'] + v['arriere']) - echelle * 0.5 * (c['avant'] + c['arriere']),
                            v['sommet'] - echelle * c['sommet']])
    cale = {k: echelle * x + (translation[2] if k in ('sommet', 'menton', 'yeux') else
                              translation[1] if k in ('avant', 'arriere') else 0.0) for k, x in c.items()}
    print('TETE_MH calage : échelle', round(float(echelle), 4), '; cotes calées moins cotes publiées',
          {k: round(float(x - v[k]), 4) for k, x in cale.items()}, flush=True)
    return echelle, H * (1.0 - echelle) + translation


def part_de_l_avant(direction):
    """La part de l'avant dans la `direction` vue de `AXE` : entière devant, nulle au-delà de l'azimut de
    `OUVERTURE_DU_VISAGE_DEG`."""
    bornes = OUVERTURE_DU_VISAGE_DEG['azimut']
    return fondu((bornes[1] - abs(azimut(direction))) / (bornes[1] - bornes[0]))


def part_du_visage(direction):
    """La part du visage dans la `direction` vue de `AXE` : celle de l'avant (`part_de_l_avant`), nulle hors de
    l'élévation de `OUVERTURE_DU_VISAGE_DEG`."""
    bornes = OUVERTURE_DU_VISAGE_DEG['elevation']
    return part_de_l_avant(direction) * fondu((bornes[1] - abs(elevation(direction))) / (bornes[1] - bornes[0]))


def sans_glissement(X, ecart, utiles, triangles, oreilles, H):
    """L'écart `ecart` des sommets `utiles` de la peau `X` (`triangles`), gardé au visage (`part_du_visage`, vu de
    `AXE`) et aux oreilles (`oreilles`, la part de chaque sommet), dont les traits se déplacent, et ramené ailleurs à ce
    qu'il change de la forme : le chemin du sommet au point le plus proche de la peau déplacée. D'une forme de MakeHuman
    à l'autre, les sommets du crâne et de la nuque glissent sur la peau de centimètres sans qu'elle bouge d'autant ; ce
    glissement, que la couture du cou arrête, y plissait la nuque."""
    axe = H + np.array([0.0, CENTRE[1], AXE_DU_VISAGE])
    deplacee = porteur_de(X + ecart, triangles, np.zeros((len(X), 1)))['arbre']
    sortie = ecart.copy()
    for i in utiles:
        w = max(part_du_visage((X[i] - axe) / np.linalg.norm(X[i] - axe)), oreilles[i])
        if w < 1.0:
            sortie[i] = w * ecart[i] + (1.0 - w) * (np.array(deplacee.find_nearest(X[i].tolist())[0]) - X[i])
    return sortie


def visage_inverse(P, peau, yeux, triangles, H):
    """La clé `visage_inverse` des sommets `P` (monde) : sur les sommets `peau`, l'écart entre le rayon de la peau
    (`triangles`) dans la direction reflétée et dans la sienne, vus de `AXE`, à la part du visage ; sur les sommets
    `yeux`, le demi-tour autour de l'axe."""
    axe = H + np.array([0.0, CENTRE[1], AXE_DU_VISAGE])
    surface = porteur_de(P, triangles, np.zeros((len(P), 1)))

    def rayon(direction):
        """Le rayon de la peau vue de l'axe le long de `direction`, `None` où elle est ouverte (sous la mâchoire)."""
        touche = surface['arbre'].ray_cast((axe + PORTEE_M * direction).tolist(), (-direction).tolist(), PORTEE_M)[0]
        return None if touche is None else np.linalg.norm(np.array(touche) - axe)

    voisins = {}
    for tri in triangles.tolist():
        for i in tri:
            voisins.setdefault(i, set()).update(tri)
    directions, parts, siens, refletes = {}, {}, {}, {}
    for v in peau:
        d = P[v] - axe
        propre = np.linalg.norm(d)
        d /= propre
        w = part_du_visage(d)
        sien, reflete = (rayon(d), rayon(d * np.array([1.0, 1.0, -1.0]))) if w > 0 else (None, None)
        if sien is not None and reflete is not None:
            directions[v], parts[v], siens[v], refletes[v] = d, w, max(sien, propre), reflete
    cle = np.zeros_like(P)
    for v, d in directions.items():
        reflete = np.median([refletes[i] for i in voisins[v] if i in refletes])
        cle[v] = parts[v] * (reflete - siens[v]) * d
    p = P[yeux]
    cle[yeux] = np.column_stack([-p[:, 0], p[:, 1], 2 * axe[2] - p[:, 2]]) - p
    peau = np.fromiter(directions, dtype=int)
    for cote in (p[:, 0] > 0, p[:, 0] <= 0):
        retourne = (P[yeux] + cle[yeux])[cote]
        centre = retourne.mean(axis=0)
        rayon_de_l_oeil = np.linalg.norm(retourne - centre, axis=1).max()
        u = (centre - axe) / np.linalg.norm(centre - axe)
        ecart = P[peau] + cle[peau] - centre
        devant = ecart @ u
        dessus = (np.linalg.norm(ecart - devant[:, None] * u, axis=1) < PART_DE_L_ORBITE * rayon_de_l_oeil) & (devant > 0)
        cle[peau[dessus]] -= devant[dessus, None] * u
    return cle


def construire(D, materiaux, b):
    mpfb = pack_source('mpfb')
    b.exiger(ZONES_DES_CLES + ['cou'])
    H = np.array(b.tete('Head'))
    C = H + np.asarray(CENTRE, float)
    obj = mpfb / '3dobjs' / 'base.obj'
    sommets, faces, groupes = lire_obj(obj)
    yeux = [triangles_de(lire_obj(obj, groupe)[1]) for groupe in YEUX]
    des_yeux = np.unique(np.concatenate(yeux))

    def cible(liste):
        return sum(p * lire_cible(mpfb / 'targets' / f'{nom}.target.gz', len(sommets)) for nom, p in liste)

    triangles = triangles_de(faces)
    noms = [o.name for o in b.rig.data.bones]
    triangles = triangles[np.isin(os_des_faces(mpfb, noms, triangles), [noms.index(n) for n in OS_DE_LA_TETE])]
    de_la_tete = np.unique(triangles)

    def calee(etat):
        """`(forme sans cibles cuites, forme de la race, échelle)` à l'état macro `etat`, recalées sur le tronc puis
        calées à la taille publiée."""
        neutre = forme_macro(mpfb, sommets, etat) + cible(BOUCHE_FERMEE)
        echelle, translation = recalage({nom: vers_blender(neutre[i]).mean(axis=0) for nom, i in groupes.items()},
                                        tetes(b.rig))
        sur_le_tronc = vers_blender(neutre) * echelle + translation
        e, t = calage(sur_le_tronc[de_la_tete], sur_le_tronc[des_yeux], H)
        echelle, translation = echelle * e, translation * e + t
        return (vers_blender(neutre) * echelle + translation,
                vers_blender(neutre + cible(D.get('CUITES', ()))) * echelle + translation, echelle)

    cale, X, echelle = calee(ETAT)
    de_makehuman = {FEMININ: calee(ETAT_FEMININ)[1] - X,
                    **{nom: vers_blender(cible(liste)) * echelle for nom, liste in TRAITS.items()}}

    indices_du_cou, S = couture(b, ZONES_DES_CLES, C)
    utiles = np.unique(triangles)
    seuil = elevation_de_la_couture(S, C, np.array([azimut(cale[i] - C) for i in utiles])) + MARGE_DE_COUTURE_DEG
    au_dessus = np.zeros(len(X), dtype=bool)
    au_dessus[utiles] = np.array([elevation(cale[i] - C) for i in utiles]) > seuil
    triangles = composante_du_haut(triangles[au_dessus[triangles].all(axis=1)], cale)
    oreilles = np.max([a / a.max() for a in (np.linalg.norm(cible([(nom, 1.0)]), axis=1) for nom in OREILLES)], axis=0)
    utiles = np.unique(triangles)
    de_makehuman[FEMININ] = sans_glissement(X, de_makehuman[FEMININ], utiles, triangles, oreilles, H)
    rayons = np.linalg.norm(X[utiles] - C, axis=1)
    enveloppe = elevation_de_la_couture(S, C, np.array([azimut(x - C) for x in X[utiles]]))
    arcs = (np.array([elevation(x - C) for x in X[utiles]]) - enveloppe) / (90.0 - enveloppe)
    porteur = b.porteur(ZONES_DES_CLES)
    fondus, parts = fondre_sur_le_cou(porteur, C, (X[utiles] - C) / rayons[:, None], rayons, arcs, FONDU_DU_COU)
    X[utiles] = C + (fondus / rayons)[:, None] * (X[utiles] - C)
    for delta in de_makehuman.values():
        delta[utiles] *= parts[:, None]
    bas = boucles_de_bord(triangles, X)[0]
    normales = np.cross(X[triangles[:, 1]] - X[triangles[:, 0]], X[triangles[:, 2]] - X[triangles[:, 0]])
    sens = np.sign(np.einsum('ij,ij->', normales, X[triangles].mean(axis=1) - C))
    bouchon = np.array([(i, j, len(X)) for i, j in zip(bas, bas[1:] + bas[:1])])
    etats = [np.vstack([Q, Q[bas].mean(axis=0)]) for Q in
             [X, *(X + p * de_makehuman[FEMININ] for p in FEMININS_VUS), *(X + de_makehuman[nom] for nom in TRAITS)]]
    cache = cachees(triangles, etats, np.concatenate([*yeux, bouchon]), sens)
    while True:
        gardes = composante_du_haut(triangles[~cache], X)
        pinces = [i for i, v in voisins_de_bord(gardes).items() if len(v) != 2]
        if not pinces:
            break
        cache &= ~np.isin(triangles, pinces).any(axis=1)
    print('TETE_MH faces cachées :', int(cache.sum()), 'retirées, et', int((~cache).sum()) - len(gardes),
          'faces vues qu\'elles isolaient', flush=True)
    triangles = gardes
    bas, *autres = boucles_de_bord(triangles, X)
    bas = depuis_l_arriere(bas, X, C)

    M = Maillage()
    bord = M.ajouter(list(S), 'peau')
    utiles = np.unique(triangles)
    rang = dict(zip(utiles.tolist(), M.ajouter(list(X[utiles]), 'peau')))
    colonnes = -180.0 + 360.0 * np.arange(len(bas)) / len(bas)
    vers_le_rang = directions_des_rangs(colonnes, elevation_de_la_couture(S, C, colonnes), [RANG_DU_COU])
    du_rang = C + fondre_sur_le_cou(porteur, C, vers_le_rang, np.zeros(len(bas)), np.zeros(len(bas)), FONDU_DU_COU)[0][:, None] * vers_le_rang
    anneau = M.ajouter(list(du_rang), 'peau')
    coudre(M, bord, S, anneau, du_rang, C)
    coudre(M, anneau, du_rang, [rang[i] for i in bas], X[bas], C)
    normales = np.cross(X[triangles[:, 1]] - X[triangles[:, 0]], X[triangles[:, 2]] - X[triangles[:, 0]])
    normales /= np.maximum(np.linalg.norm(normales, axis=1, keepdims=True), 1e-12)
    centres = X[triangles].mean(axis=1)
    for tri, n, c in zip(triangles.tolist(), normales, centres):
        M.triangle(*(rang[i] for i in tri), c - sens * 1e-4 * n)
    lus = [lambda champ: champ[utiles],          # par groupe de sommets ajoutés, son champ lu dans un champ du donneur
           lambda champ: np.zeros((len(anneau), 3))]
    doublures = []                               # (sommets qui en doublent d'autres, leur champ lu dans celui de la pièce)
    for boucle in autres:
        print('TETE_MH bord fermé :', len(boucle), 'arêtes, milieu', np.round(X[boucle].mean(axis=0) - H, 3).tolist(),
              flush=True)
        doublures.append((fermer(M, boucle, X, C),
                          lambda champ, doubles=[rang[i] for i in boucle]: np.concatenate([champ[doubles], champ[doubles].mean(axis=0)[None]])))
        lus.append(lambda champ, boucle=boucle: np.concatenate([champ[boucle], champ[boucle].mean(axis=0)[None]]))
    peau = len(M.sommets)
    for t_ in yeux:
        siens = np.unique(t_)
        rangs = dict(zip(siens.tolist(), M.ajouter(list(X[siens]), 'yeux')))
        centre = X[siens].mean(axis=0)
        for tri in t_.tolist():
            M.triangle(*(rangs[i] for i in tri), centre)
        lus.append(lambda champ, siens=siens: champ[siens])
    fin_des_yeux = len(M.sommets)
    sourcils = faces_des_sourcils(triangles, np.linalg.norm(cible([(SOURCILS, 1.0)]), axis=1))
    poilus = np.unique(sourcils)
    de_sommet = np.zeros_like(X)
    for k in range(3):
        np.add.at(de_sommet, triangles[:, k], sens * normales)
    de_sommet[poilus] /= np.linalg.norm(de_sommet[poilus], axis=1, keepdims=True)
    rang_des_poils = dict(zip(poilus.tolist(), M.ajouter(list(X[poilus] + EPAISSEUR_DES_SOURCILS_M * de_sommet[poilus]),
                                                         'cheveux')))
    for tri in sourcils.tolist():
        M.triangle(*(rang_des_poils[i] for i in tri), X[tri].mean(axis=0))
    lus.append(lambda champ: champ[poilus])
    doublures.append((list(rang_des_poils.values()), lambda champ, doubles=[rang[i] for i in poilus]: champ[doubles]))

    P, orientes, _ = M.orienter()
    print('TETE_MH', D['NOM'], ': triangles de peau', len(triangles), ', de sourcils', len(sourcils), ', bord du cou',
          len(bas), 'arêtes ; cotes',
          {k: round(float(x), 4) for k, x in cotes(P[len(bord):peau], P[peau:fin_des_yeux], H).items()}, flush=True)
    W = np.zeros((len(P), len(b.os)))
    W[:len(bord)] = b.corps('cou')[2][indices_du_cou]
    for v in range(len(bord), len(P)):
        W[v] = emprunter(P[v], porteur)[0]
    W = poids_adoucis(W, P, np.array(orientes), len(bord))
    for siens, lire in doublures:
        W[siens] = lire(W)
    noms_des_materiaux = list(materiaux)
    piece = maillage_skinne(D['NOM'], [tuple(p) for p in P], orientes, materiaux[noms_des_materiaux[0]], b.rig,
                            poids_normalises(W, b.os))
    for nom in noms_des_materiaux[1:]:
        piece.data.materials.append(materiaux[nom])
    for poly, tri in zip(piece.data.polygons, orientes):
        poly.material_index = noms_des_materiaux.index(M.parties[tri[0]])
        poly.use_smooth = True
    poser_les_normales_de_la_couture(piece, len(bord), normales_de_sommet(b.zones['cou'])[indices_du_cou])
    tours = np.degrees(np.unwrap(np.radians([azimut(p - C) for p in S])))
    azimuts = np.array([azimut(p - C) for p in P[len(bord):]])
    enveloppe = elevation_de_la_couture(S, C, azimuts)
    du_cou_a_la_nuque = 1.0 - parts_du_fondu((np.array([elevation(p - C) for p in P[len(bord):]]) - enveloppe)
                                             / (90.0 - enveloppe), FONDU_DU_FEMININ)
    axe = H + np.array([0.0, CENTRE[1], AXE_DU_VISAGE])
    de_la_tete = (1.0 - du_cou_a_la_nuque * np.array([1.0 - part_de_l_avant(p - axe) for p in P[len(bord):]]))[:, None]
    for nom, champ in cles_du_corps(b, ZONES_DES_CLES, P[len(bord):]).items():
        du_cou = decalages_monde(b.zones['cou'], nom)[indices_du_cou]
        if nom == FEMININ:
            champ = champ + np.concatenate([lu(de_makehuman[FEMININ]) for lu in lus])
            au_cou = np.column_stack([np.interp(azimuts, tours, du_cou[:, k], period=360.0) for k in range(3)])
            champ = de_la_tete * champ + (1.0 - de_la_tete) * au_cou
        poser_la_cle(piece, nom, np.concatenate([du_cou, champ]))
    for nom in TRAITS:
        poser_la_cle(piece, nom, np.concatenate([np.zeros((len(bord), 3))] + [lu(de_makehuman[nom]) for lu in lus]))
    de_peau = np.array([tri for tri in orientes if M.parties[tri[0]] == 'peau'])
    retourne = visage_inverse(P, range(len(bord), peau), np.arange(peau, fin_des_yeux), de_peau, H)
    for siens, lire in doublures:
        retourne[siens] = lire(retourne)
    poser_la_cle(piece, VISAGE_INVERSE, retourne)
    return piece
