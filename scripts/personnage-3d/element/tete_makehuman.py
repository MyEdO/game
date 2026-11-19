"""Tête de race sur la base, au repos pris à la tête de MakeHuman (#4413), pour le `modele.py` d'un élément
`tete--<race>` qui ne porte que `from tete_makehuman import construire` et son `donnees.py`. Le pack `mpfb` (dossier
`data` de MPFB, celui de la silhouette `corpulence`) est celui de la base, tiré et vérifié par `production.pack_source`.

Forme : `base.obj` chargé des cibles `macrodetails` d'un homme jeune moyen (`corpulence.forme_macro`) et de
`BOUCHE_FERMEE`, puis des cibles `CUITES` de `donnees.py` (`((cible sous targets/, poids), …)`), qui font la race. La forme se recale sur le tronc de la
base (`corpulence.recalage`), puis se cale à la taille de la tête humaine publiée (`TAILLE_PUBLIEE`, `calage`) : le calage
se mesure sur la forme sans cibles cuites, pour qu'une race garde l'écart que ses cibles lui donnent.

Maillage : les faces de `body` dont l'os dominant est la tête ou le cou (`corpulence.os_des_faces`), au-dessus de
l'enveloppe haute de la couture du cou de la base vue de `CENTRE` (`tete.elevation_de_la_couture`, plus
`MARGE_DE_COUTURE_DEG`), choisies sur la forme sans cibles cuites : toutes les têtes ont les mêmes sommets et les mêmes
faces. Son bord bas se coud à la couture (`tete.coudre`), aux poids, aux clés et aux normales du cou,
comme une tête de `tete.py` ; tout autre bord (la bouche) se ferme d'un éventail enfoncé de `ENFONCEMENT_M`. Yeux : les
groupes `helper-l-eye` et `helper-r-eye`.

Clés : les silhouettes et les clés `gabarit_*` de la base, transférées du corps (`tete.cles_du_corps`) ; `feminin` y
ajoute l'écart, sommet à sommet, de la même forme à l'état macro `ETAT_FEMININ`, recalée et calée comme elle : le calage
annule l'écart de taille de MakeHuman entre les deux états, qui est celui de la stature, que la base ne change pas, et
les pièces de tête restent bâties à cette taille ; à la couture, la clé du cou seule (`feminin`). Chaque trait de
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

from corpulence import RACES, forme_macro, lire_cible, lire_obj, os_des_faces, recalage, tetes, vers_blender
from formes import poser_la_cle
from noms_formes_de_tete import ARCADES_MARQUEES, JOUES_CREUSES, NEZ_FORT, VISAGE_INVERSE, VISAGE_LONG
from noms_silhouettes import FEMININ
from production import pack_source
from tete import (PORTEE_M, azimut, cles_du_corps, coudre, couture, decalages_monde, depuis_l_arriere, elevation,
                  elevation_de_la_couture, normales_de_sommet, poser_les_normales_de_la_couture)
from tissu import Maillage, emprunter, fondu, maillage_skinne, poids_normalises, porteur_de

ETAT = 'male-young-averagemuscle-averageweight'
ETAT_FEMININ = 'female-young-averagemuscle-averageweight'
FONDU_DE_LA_COUTURE_M = 0.025
"""HYPOTHÈSE : distance à la couture du cou sur laquelle la clé `feminin` passe de celle du corps à celle de MakeHuman."""
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
ENFONCEMENT_M = 0.004
"""HYPOTHÈSE : recul du centre de l'éventail qui ferme un bord, vers `CENTRE`."""
MILIEU_M = 0.012
"""Demi-largeur de la bande médiane où se lit le dessous du menton."""
DEVANT_M = 0.045
"""Recul depuis le bout du nez en deçà duquel un point de la bande médiane est du visage, pas du cou."""
TAILLE_PUBLIEE = {'sommet': 0.2103, 'menton': -0.0232, 'avant': -0.1119, 'arriere': 0.0887, 'demi_largeur': 0.0696}
"""Cotes de la tête humaine publiée (GLB be2c87c7…, relevées depuis `Head`), à laquelle sont bâties les pièces de tête :
z du sommet du crâne et du dessous du menton, y de l'avant et de l'arrière du crâne au-dessus des yeux, demi-largeur de
la peau à la hauteur des yeux devant y -0,03."""
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


def boucles_de_bord(triangles):
    """Les boucles simples du bord de `triangles`, de la plus longue à la plus courte."""
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
    return sorted(boucles, key=len, reverse=True)


def composante_du_haut(triangles, X):
    """Les triangles de la composante connexe (par sommet partagé) qui porte le sommet le plus haut."""
    parent = {}

    def racine(i):
        while parent.setdefault(i, i) != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b, c in triangles:
        parent[racine(a)] = racine(b)
        parent[racine(b)] = racine(c)
    haut = racine(max({i for t in triangles for i in t}, key=lambda i: X[i][2]))
    return np.array([t for t in triangles if racine(t[0]) == haut])


def cotes(peau, yeux, H):
    """Les cotes de `TAILLE_PUBLIEE` d'une tête : sa peau `peau` (sommets, monde), ses yeux `yeux` (sommets), l'os `Head`
    en `H`."""
    p = peau - H
    hauteur_des_yeux = (yeux - H)[:, 2].mean()
    milieu = p[np.abs(p[:, 0]) < MILIEU_M]
    visage = milieu[milieu[:, 1] < milieu[:, 1].min() + DEVANT_M]
    crane = p[p[:, 2] > hauteur_des_yeux]
    aux_yeux = p[(np.abs(p[:, 2] - hauteur_des_yeux) < MILIEU_M) & (p[:, 1] < -0.03)]
    return {'sommet': p[:, 2].max(), 'menton': visage[:, 2].min(), 'avant': crane[:, 1].min(),
            'arriere': crane[:, 1].max(), 'demi_largeur': np.abs(aux_yeux[:, 0]).max()}


def calage(peau, yeux, H):
    """`(échelle, translation)` qui portent la tête de peau `peau` et d'yeux `yeux` à la taille de `TAILLE_PUBLIEE` : une
    seule échelle, celle de la hauteur du menton au sommet du crâne ; le sommet du crâne et le milieu du crâne d'avant en
    arrière sur ceux de la tête publiée. Imprime ce que donne la demi-largeur aux yeux."""
    c, v = cotes(peau, yeux, H), TAILLE_PUBLIEE
    echelle = (v['sommet'] - v['menton']) / (c['sommet'] - c['menton'])
    translation = np.array([0.0, 0.5 * (v['avant'] + v['arriere']) - echelle * 0.5 * (c['avant'] + c['arriere']),
                            v['sommet'] - echelle * c['sommet']])
    print('TETE_MH calage : échelle', round(float(echelle), 4), '; avant le calage', {k: round(float(x), 4) for k, x in c.items()},
          '; demi-largeur aux yeux calée', round(float(echelle * c['demi_largeur']), 4), 'pour', v['demi_largeur'],
          '; avant et arrière calés', round(float(echelle * c['avant'] + translation[1]), 4),
          round(float(echelle * c['arriere'] + translation[1]), 4), flush=True)
    return echelle, H * (1.0 - echelle) + translation


def visage_inverse(P, peau, yeux, triangles, H):
    """La clé `visage_inverse` des sommets `P` (monde) : sur les sommets `peau`, l'écart entre le rayon de la peau
    (`triangles`) dans la direction reflétée et dans la sienne, vus de `AXE`, à la part du visage ; sur les sommets
    `yeux`, le demi-tour autour de l'axe."""
    axe = H + np.array([0.0, CENTRE[1], AXE_DU_VISAGE])
    surface = porteur_de(P, triangles, np.zeros((len(P), 1)))

    def part(angle, bornes):
        return fondu((bornes[1] - abs(angle)) / (bornes[1] - bornes[0]))

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
        w = part(azimut(d), OUVERTURE_DU_VISAGE_DEG['azimut']) * part(elevation(d), OUVERTURE_DU_VISAGE_DEG['elevation'])
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


def feminin(X, S, du_corps, de_makehuman):
    """La clé `feminin` des sommets `X` : `du_corps`, la clé transférée du corps de la base, plus `de_makehuman`, l'écart
    de la forme féminine de MakeHuman à la forme masculine, nul à la couture `S` et entier à `FONDU_DE_LA_COUTURE_M`
    d'elle."""
    part = np.array([fondu(np.linalg.norm(S - x, axis=1).min() / FONDU_DE_LA_COUTURE_M) for x in X])[:, None]
    print('TETE_MH feminin : clé du corps, au plus', round(float(np.linalg.norm(du_corps, axis=1).max()), 4),
          'm ; écart de MakeHuman, au plus', round(float(np.linalg.norm(de_makehuman, axis=1).max()), 4), flush=True)
    return du_corps + part * de_makehuman


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
    feminine = calee(ETAT_FEMININ)[1] - X

    indices_du_cou, S = couture(b, ZONES_DES_CLES, C)
    utiles = np.unique(triangles)
    seuil = elevation_de_la_couture(S, C, np.array([azimut(cale[i] - C) for i in utiles])) + MARGE_DE_COUTURE_DEG
    au_dessus = np.zeros(len(X), dtype=bool)
    au_dessus[utiles] = np.array([elevation(cale[i] - C) for i in utiles]) > seuil
    triangles = composante_du_haut(triangles[au_dessus[triangles].all(axis=1)], cale)
    bas, *autres = boucles_de_bord(triangles)
    bas = depuis_l_arriere(bas, X, C)

    M = Maillage()
    bord = M.ajouter(list(S), 'peau')
    utiles = np.unique(triangles)
    rang = dict(zip(utiles.tolist(), M.ajouter(list(X[utiles]), 'peau')))
    coudre(M, bord, S, [rang[i] for i in bas], X[bas], C)
    normales = np.cross(X[triangles[:, 1]] - X[triangles[:, 0]], X[triangles[:, 2]] - X[triangles[:, 0]])
    normales /= np.maximum(np.linalg.norm(normales, axis=1, keepdims=True), 1e-12)
    centres = X[triangles].mean(axis=1)
    sens = np.sign(np.einsum('ij,ij->', normales, centres - C))
    for tri, n, c in zip(triangles.tolist(), normales, centres):
        M.triangle(*(rang[i] for i in tri), c - sens * 1e-4 * n)
    lus = [lambda champ: champ[utiles]]          # par groupe de sommets ajoutés, son champ lu dans un champ du donneur
    for boucle in autres:
        milieu = X[boucle].mean(axis=0)
        print('TETE_MH bord fermé :', len(boucle), 'arêtes, milieu', np.round(milieu - H, 3).tolist(), flush=True)
        fond = M.ajouter([milieu + ENFONCEMENT_M * (C - milieu) / np.linalg.norm(C - milieu)], 'peau')[0]
        for i, j in zip(boucle, boucle[1:] + boucle[:1]):
            M.triangle(rang[i], rang[j], fond, C)
        lus.append(lambda champ, boucle=boucle: champ[boucle].mean(axis=0)[None])
    peau = len(M.sommets)
    for t_ in yeux:
        siens = np.unique(t_)
        rangs = dict(zip(siens.tolist(), M.ajouter(list(X[siens]), 'yeux')))
        centre = X[siens].mean(axis=0)
        for tri in t_.tolist():
            M.triangle(*(rangs[i] for i in tri), centre)
        lus.append(lambda champ, siens=siens: champ[siens])

    P, orientes, _ = M.orienter()
    print('TETE_MH', D['NOM'], ': triangles de peau', len(triangles), ', bord du cou', len(bas), 'arêtes ; cotes',
          {k: round(float(x), 4) for k, x in cotes(P[len(bord):peau], P[peau:], H).items()}, flush=True)
    porteur = b.porteur(ZONES_DES_CLES)
    W = np.zeros((len(P), len(b.os)))
    W[:len(bord)] = b.corps('cou')[2][indices_du_cou]
    for v in range(len(bord), len(P)):
        W[v] = emprunter(P[v], porteur)[0]
    noms_des_materiaux = list(materiaux)
    piece = maillage_skinne(D['NOM'], [tuple(p) for p in P], orientes, materiaux[noms_des_materiaux[0]], b.rig,
                            poids_normalises(W, b.os))
    for nom in noms_des_materiaux[1:]:
        piece.data.materials.append(materiaux[nom])
    for poly, tri in zip(piece.data.polygons, orientes):
        poly.material_index = noms_des_materiaux.index(M.parties[tri[0]])
        poly.use_smooth = True
    poser_les_normales_de_la_couture(piece, len(bord), normales_de_sommet(b.zones['cou'])[indices_du_cou])
    for nom, champ in cles_du_corps(b, ZONES_DES_CLES, P[len(bord):]).items():
        if nom == FEMININ:
            champ = feminin(P[len(bord):], S, champ, np.concatenate([lu(feminine) for lu in lus]))
        poser_la_cle(piece, nom, np.concatenate([decalages_monde(b.zones['cou'], nom)[indices_du_cou], champ]))
    for nom, liste in TRAITS.items():
        delta = vers_blender(cible(liste)) * echelle
        poser_la_cle(piece, nom, np.concatenate([np.zeros((len(bord), 3))] + [lu(delta) for lu in lus]))
    de_peau = np.array([tri for tri in orientes if M.parties[tri[0]] == 'peau'])
    poser_la_cle(piece, VISAGE_INVERSE, visage_inverse(P, range(len(bord), peau), np.arange(peau, len(P)), de_peau, H))
    return piece
