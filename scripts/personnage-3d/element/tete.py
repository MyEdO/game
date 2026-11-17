"""Tête sur la base (#4379) : une tête de race (`tete`), bâtie sur la couture du cou de la base, pour le `modele.py` d'un
élément `tete--<race>` qui ne porte que `from tete import construire` et son `donnees.py`.

Le crâne est une grille de rayons visés d'un centre de la tête (`CENTRE`) : des colonnes en azimut, plus serrées devant
(`SERRAGE_DEVANT`), des rangs en élévation de la couture du cou au sommet (`RANGS`, part de l'arc de la couture au pôle),
un éventail au pôle. Chaque rayon s'arrête sur la plus extérieure des surfaces d'une forme implicite, union lisse de
volumes (ellipsoïdes, tubes à rayon variable) dont on creuse d'autres volumes (orbites, fente de la bouche) : `FORME`.
Le premier anneau est la couture même du cou de la base (les sommets du bord du `cou` qu'il partage avec la tête), aux
poids, aux clés et aux normales du cou : le cou reste celui de la base, sans marche, sans trou ni arête d'ombrage ; les
rangs au-dessus passent de la peau de la tête de la base (visée sur ses zones), qui prolonge le cou, à la forme sur
`FONDU_DU_COU`. Le premier rang passe au-dessus de l'enveloppe haute de la couture, qui est en dents de scie ; la
bande entre la couture et ce rang se triangule dépliée (`coudre`).

Posés sur le crâne, des solides : yeux (sphères), oreilles (feuilles pointues, épaisses à la racine, au pavillon
creusé), nez crochu et crocs (tubes effilés sur une courbe), dents (cônes), anneaux (tores passés dans le bord d'une
oreille). Chaque solide suit d'un bloc les poids de la peau de la tête sous son point d'ancrage ; le crâne emprunte au
plus près ceux de la peau de la tête. Silhouettes et clés `gabarit_*` se prennent au corps de la base, au point le plus
proche de chaque sommet (`cles_du_corps`) ; la couture prend celles du cou.

`visage_inverse` (mutation « Visage inversé », `mutations.json`) : le visage retourné tête en bas, crâne et oreilles
en place. Les volumes du visage (`visage: True`) se reflètent par le plan horizontal de `AXE_DU_VISAGE`, le crâne se
revise sur cette forme ; les yeux, crocs et dents tournent d'un demi-tour autour de l'axe avant-arrière qui passe à
cette hauteur.

Repère : celui de la base importée dans Blender (mètres, z vers le haut, l'avant vers -y, la gauche du personnage vers
+x) ; toute position de `donnees.py` se donne depuis la tête de l'os `Head` au repos. Un volume `miroir: True` et les
solides pairs (yeux, oreilles, crocs) se donnent à gauche (+x) et se reflètent à droite.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt
from mathutils.kdtree import KDTree

from formes import decalages, poser_la_cle
from tissu import Maillage, direction_spatiale, emprunter, fondu, maillage_skinne, poids_normalises, porteur_de, sur_le_porteur

POLE = np.array([0.0, 0.0, 1.0])
PORTEE_M = 0.30
"""Départ des visées du crâne, au-delà de toute forme d'une tête."""
PAS_M = 0.0008
"""Pas de la visée, du dehors vers le centre, avant la bissection."""
BISSECTIONS = 20
FENETRE_DE_COUTURE_DEG = 8.0
"""Demi-fenêtre d'azimut de l'enveloppe haute de la couture : un peu plus d'une dent de la couture du cou (~6,4°)."""
CONFONDUS_M = 1e-6
"""Distance sous laquelle deux sommets de la base sont le même point (le bord du cou et celui de la tête)."""


# --- forme implicite -------------------------------------------------------------------------------------------------

def _ellipsoide(Q, centre, rayons):
    """Distance signée approchée à l'ellipsoïde (négative dedans, signe exact)."""
    q = (Q - centre) / rayons
    k0 = np.linalg.norm(q, axis=1)
    k1 = np.linalg.norm(q / rayons, axis=1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-12)


def _tube(Q, points, rayons):
    """Distance signée au tube de la ligne `points`, de rayon interpolé `rayons` le long de chaque segment."""
    d = np.full(len(Q), np.inf)
    for a, b, ra, rb in zip(points[:-1], points[1:], rayons[:-1], rayons[1:]):
        ab = b - a
        t = np.clip(((Q - a) @ ab) / (ab @ ab), 0.0, 1.0)
        d = np.minimum(d, np.linalg.norm(Q - (a + t[:, None] * ab), axis=1) - (ra + (rb - ra) * t))
    return d


def _smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b + (a - b) * h - k * h * (1.0 - h)


def _refletes(volume, cote):
    """Le volume posé du côté `cote` (+1 gauche, -1 droite) : x de chaque point multiplié par `cote`."""
    m = np.array([cote, 1.0, 1.0])
    if volume['forme'] == 'ellipsoide':
        return {**volume, 'centre': np.asarray(volume['centre']) * m}
    return {**volume, 'points': np.asarray(volume['points']) * m}


def volumes(forme):
    """Les volumes de `forme`, chacun doublé à droite s'il porte `miroir`, en tableaux."""
    sortie = []
    for v in forme:
        v = {**v, **({'centre': np.asarray(v['centre'], float), 'rayons': np.asarray(v['rayons'], float)}
                     if v['forme'] == 'ellipsoide' else
                     {'points': np.asarray(v['points'], float), 'rayons': np.asarray(v['rayons'], float)})}
        sortie.extend([v, _refletes(v, -1.0)] if v.get('miroir') else [v])
    return sortie


def _retourne(volume, z_axe):
    """Le volume reflété par le plan horizontal z = `z_axe` (repère de la tête)."""
    if volume['forme'] == 'ellipsoide':
        c = volume['centre'].copy()
        c[2] = 2 * z_axe - c[2]
        return {**volume, 'centre': c}
    p = volume['points'].copy()
    p[:, 2] = 2 * z_axe - p[:, 2]
    return {**volume, 'points': p}


def champ(Q, vols):
    """La forme implicite de `vols` en `Q` (repère de la tête) : unions et creux lissés, dans l'ordre."""
    f = None
    for v in vols:
        g = _ellipsoide(Q, v['centre'], v['rayons']) if v['forme'] == 'ellipsoide' else _tube(Q, v['points'], v['rayons'])
        if f is None:
            f = g
        elif v.get('creux'):
            f = -_smin(-f, g, v['lissage'])
        else:
            f = _smin(f, g, v['lissage'])
    return f


def rayons_vises(C, dirs, vols):
    """Par direction de `dirs` depuis `C` (repère de la tête), le rayon de la plus extérieure des surfaces de `vols`."""
    rs = np.arange(PORTEE_M, 0.0, -PAS_M)
    dedans = np.stack([champ(C + r * dirs, vols) < 0 for r in rs], axis=1)
    if not dedans.any(axis=1).all():
        raise ValueError('tête : une visée du crâne ne rencontre aucune forme')
    k = dedans.argmax(axis=1)
    if (k == 0).any():
        raise ValueError(f'tête : forme au-delà de la portée {PORTEE_M} m')
    haut, bas = rs[k - 1], rs[k]
    for _ in range(BISSECTIONS):
        milieu = 0.5 * (haut + bas)
        dans = champ(C + milieu[:, None] * dirs, vols) < 0
        bas = np.where(dans, milieu, bas)
        haut = np.where(dans, haut, milieu)
    return 0.5 * (haut + bas)


# --- couture du cou --------------------------------------------------------------------------------------------------

def azimut(p):
    return math.degrees(math.atan2(p[0], -p[1]))


def elevation(p):
    return math.degrees(math.atan2(p[2], math.hypot(p[0], p[1])))


def couture(b, zones, C):
    """Les sommets du bord du `cou` de la base qu'il partage avec les zones `zones`, en boucle d'azimut croissant depuis
    l'arrière (vu de `C`, monde) : (indices dans le cou, positions monde). Deux sommets confondus du cou n'en font qu'un."""
    P = b.corps('cou')[0]
    tete = np.concatenate([b.corps(z)[0] for z in zones])
    kd = KDTree(len(tete))
    for i, p in enumerate(tete):
        kd.insert(p, i)
    kd.balance()
    sur = [i for i in range(len(P)) if kd.find(P[i])[2] < CONFONDUS_M]
    representant = {}
    for i in sur:
        representant[i] = next((j for j in representant.values() if np.linalg.norm(P[i] - P[j]) < CONFONDUS_M), i)
    bm = bmesh.new()
    bm.from_mesh(b.zones['cou'].data)
    voisins = {}
    for e in bm.edges:
        a, c = e.verts[0].index, e.verts[1].index
        if e.is_boundary and a in representant and c in representant and representant[a] != representant[c]:
            voisins.setdefault(representant[a], set()).add(representant[c])
            voisins.setdefault(representant[c], set()).add(representant[a])
    bm.free()
    if not voisins or any(len(v) != 2 for v in voisins.values()):
        raise ValueError('tête : la couture du cou n\'est pas une boucle simple')
    boucle = [min(voisins)]
    precedent = None
    while True:
        suivant = min(v for v in voisins[boucle[-1]] if v != precedent)
        if suivant == boucle[0]:
            break
        precedent = boucle[-1]
        boucle.append(suivant)
    if len(boucle) != len(voisins):
        raise ValueError('tête : la couture du cou est en plusieurs boucles')
    phis = np.array([azimut(P[i] - C) for i in boucle])
    if np.sum(np.sin(np.radians(np.roll(phis, -1) - phis))) < 0:
        boucle.reverse()
        phis = phis[::-1]
    phis = np.where(phis >= 180.0, phis - 360.0, phis)
    debut = int(np.argmin(phis))
    boucle = boucle[debut:] + boucle[:debut]
    return np.array(boucle), P[boucle]


def elevation_de_la_couture(S, C, phis):
    """Élévation de la couture `S` (vue de `C`) aux azimuts `phis` : l'enveloppe haute de la couture en dents de scie sur
    `FENETRE_DE_COUTURE_DEG` de part et d'autre, lissée sans redescendre sous elle, pour qu'aucun rang ne passe sous une
    de ses pointes."""
    a = np.degrees(np.unwrap(np.radians([azimut(p - C) for p in S])))
    e = np.array([elevation(p - C) for p in S])
    a3, e3 = np.concatenate([a - 360.0, a, a + 360.0]), np.tile(e, 3)
    enveloppe = np.array([e3[np.abs(a3 - phi) <= FENETRE_DE_COUTURE_DEG].max(initial=np.interp(phi, a3, e3))
                          for phi in phis])
    E = enveloppe.copy()
    for _ in range(3):
        E = 0.25 * np.roll(E, 1) + 0.5 * E + 0.25 * np.roll(E, -1)
    return np.maximum(E, enveloppe)


def coudre(M, bord, S, anneau, A, C):
    """Coud la boucle `bord` (positions `S`) à la boucle `anneau` (positions `A`), toutes deux en azimut croissant depuis
    l'arrière autour de `C`, l'anneau au-dessus du bord : la bande qu'elles bordent, dépliée en azimut et élévation vus
    de `C`, se triangule en polygone (Delaunay contraint). La couture, en dents de scie, revient sur ses pas en azimut : cousue dans l'ordre
    des azimuts, ses triangles passaient par-dessus les dents du cou. Les triangles prennent tous le sens du polygone,
    dehors du côté opposé à `C` pour leur ensemble : orienté seul contre `C`, un triangle presque radial tournait le
    dos."""
    def deplie(P):
        a = np.degrees(np.unwrap(np.radians([azimut(p - C) for p in P])))
        return [(x, elevation(p - C)) for x, p in zip(a, P)]

    bas, haut = deplie(S), deplie(A)
    tour = [(bas[0][0] + 360.0, bas[0][1])], [(haut[0][0] + 360.0, haut[0][1])]
    contour = bas + tour[0] + tour[1] + haut[::-1]
    sommets = list(bord) + [bord[0], anneau[0]] + list(anneau[::-1])
    X = np.concatenate([S, S[:1], A[:1], A[::-1]])
    _, _, faces, origines, _, _ = delaunay_2d_cdt([Vector(p) for p in contour], [], [list(range(len(contour)))], 1, 1e-9)
    if any(len(o) != 1 for o in origines) or any(len(f) != 3 for f in faces):
        raise ValueError('tête : la bande de la couture dépliée se recoupe')
    cousus = [t for t in ([origines[k][0] for k in f] for f in faces) if len({sommets[k] for k in t}) == 3]
    normales = [np.cross(X[q] - X[p], X[r] - X[p]) for p, q, r in cousus]
    centres = [(X[p] + X[q] + X[r]) / 3 for p, q, r in cousus]
    sens = np.sign(sum(nrm @ (c - C) for nrm, c in zip(normales, centres)))
    for t, nrm, c in zip(cousus, normales, centres):
        M.triangle(*(sommets[k] for k in t), c - sens * nrm / np.linalg.norm(nrm))


def normales_de_sommet(objet):
    """La normale de chaque sommet de `objet`, monde : la moyenne de ses normales de coin, libres comprises."""
    me = objet.data
    coins = np.empty(len(me.loops) * 3, dtype=np.float32)
    me.corner_normals.foreach_get('vector', coins)
    sommets = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', sommets)
    N = np.zeros((len(me.vertices), 3))
    np.add.at(N, sommets, coins.reshape(-1, 3))
    N = N @ np.array(objet.matrix_world)[:3, :3].T
    return N / np.linalg.norm(N, axis=1, keepdims=True)


def poser_les_normales_de_la_couture(piece, n, normales):
    """Les `n` premiers sommets de `piece`, ceux de la couture, aux normales monde `normales`, celles du cou : la lumière
    ne marque pas la couture. Normales libres par coin, les mêmes octets aux coins d'un sommet (`tissu.decouper`)."""
    me = piece.data
    monde = np.array(piece.matrix_world)[:3, :3]
    N = np.array([v.normal for v in me.vertices])
    N[:n] = normales @ monde
    N = (N / np.linalg.norm(N, axis=1, keepdims=True)).astype(np.float32)
    sommets = np.empty(len(me.loops), dtype=np.int32)
    me.loops.foreach_get('vertex_index', sommets)
    me.attributes.new('custom_normal', 'FLOAT_VECTOR', 'CORNER').data.foreach_set('vector', N[sommets].ravel())


# --- solides ---------------------------------------------------------------------------------------------------------

def _repere(axe, normale):
    a = np.asarray(axe, float)
    a /= np.linalg.norm(a)
    n = np.asarray(normale, float) - (np.asarray(normale, float) @ a) * a
    n /= np.linalg.norm(n)
    return a, n, np.cross(a, n)


def sphere(M, centre, rayon, cotes, rangs, partie):
    """Sphère UV ; rend ses sommets."""
    haut = M.ajouter([centre + rayon * POLE], partie)[0]
    anneaux = []
    for k in range(1, rangs):
        t = math.pi * k / rangs
        anneaux.append(M.ajouter([centre + rayon * np.array([math.sin(t) * math.cos(2 * math.pi * j / cotes),
                                                               math.sin(t) * math.sin(2 * math.pi * j / cotes),
                                                               math.cos(t)]) for j in range(cotes)], partie))
    bas = M.ajouter([centre - rayon * POLE], partie)[0]
    for j in range(cotes):
        M.triangle(haut, anneaux[0][j], anneaux[0][(j + 1) % cotes], centre)
        M.triangle(bas, anneaux[-1][j], anneaux[-1][(j + 1) % cotes], centre)
    for A, B in zip(anneaux[:-1], anneaux[1:]):
        M.bande(A, B, centre)
    return [haut, bas] + [i for A in anneaux for i in A]


def _section(centre, u, v, demi_u, demi_v, cotes, creux=0.0):
    """Ellipse de demi-axes `demi_u` (le long de `u`) et `demi_v` (le long de `v`), creusée de `creux` · `demi_u` vers -v
    au milieu de sa largeur."""
    pts = []
    for j in range(cotes):
        t = 2 * math.pi * j / cotes
        c, s = math.cos(t), math.sin(t)
        pts.append(centre + demi_u * c * u + (demi_v * s - creux * demi_u * (1.0 - c * c)) * v)
    return pts


def fuseau(M, axe_points, sections, tete_de, cotes, partie):
    """Solide fermé le long des points `axe_points`, de sections `sections` (`(u, v, demi_u, demi_v, creux)` par point),
    fermé au premier point par un éventail et au dernier par la pointe `tete_de` (point) ; rend ses sommets. Ses faces
    s'orientent ensuite vers le dehors avec celles des autres solides (`orienter_les_solides`)."""
    anneaux = [M.ajouter(_section(c, *s[:4], cotes, s[4]), partie) for c, s in zip(axe_points, sections)]
    fond = M.ajouter([axe_points[0]], partie)[0]
    pointe = M.ajouter([tete_de], partie)[0]
    for j in range(cotes):
        M.triangle(fond, anneaux[0][j], anneaux[0][(j + 1) % cotes], axe_points[0])
        M.triangle(pointe, anneaux[-1][j], anneaux[-1][(j + 1) % cotes], axe_points[-1])
    for A, B, c in zip(anneaux[:-1], anneaux[1:], axe_points[:-1]):
        M.bande(A, B, c)
    return [fond, pointe] + [i for A in anneaux for i in A]


def orienter_les_solides(piece, premier):
    """Les faces des solides fermés de `piece` (sommets à partir de `premier`) orientées vers le dehors, chaque solide
    d'un seul tenant : leur point de référence (`Maillage.orienter`) ne départage pas les faces d'une feuille mince et
    creusée comme l'oreille, qui sortaient tantôt d'un côté, tantôt de l'autre."""
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f.verts[0].index >= premier])
    bm.to_mesh(piece.data)
    bm.free()


def bezier(p0, p1, p2, t):
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2


def rayons_effiles(spec, ts):
    """Le rayon du solide effilé `spec` aux parts `ts` de sa courbe : `rayon` à la base, nul à la pointe ; `effilement`
    1 fait un cône, au-delà un bec qui garde son épaisseur jusque près de la pointe."""
    return spec['rayon'] * (1.0 - np.asarray(ts, float) ** spec['effilement'])


def effile(M, spec, H, cote, partie):
    """Solide effilé sur la courbe (base, inflexion, pointe), croc ou nez crochu ; rend ses sommets et son ancrage (la
    base)."""
    p0, p1, p2 = (H + np.asarray(spec[k], float) * np.array([cote, 1.0, 1.0]) for k in ('base', 'inflexion', 'pointe'))
    n = spec['segments']
    ts = [k / n for k in range(n)]
    pts = [bezier(p0, p1, p2, t) for t in ts]
    sections = []
    for t, p, r in zip(ts, pts, rayons_effiles(spec, ts)):
        tangente = 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1)
        a, u, v = _repere(tangente, np.array([1.0, 0.0, 0.0]))
        sections.append((u, v, r, r, 0.0))
    return fuseau(M, pts, sections, p2, spec['cotes'], partie), p0


def dent(M, spec, H, partie):
    """Cône : sa pointe à `longueur` de `base` le long de `direction`, son pied, de rayon `rayon`, enfoncé d'une
    demi-longueur sous `base` ; rend ses sommets et son ancrage."""
    base = H + np.asarray(spec['base'], float)
    a, u, v = _repere(spec['direction'], np.array([1.0, 0.0, 0.0]) if abs(spec['direction'][0]) < 0.9 else POLE)
    return fuseau(M, [base - a * spec['longueur'] * 0.5], [(u, v, spec['rayon'], spec['rayon'], 0.0)],
                  base + a * spec['longueur'], spec['cotes'], partie), base


def oreille(M, O, H, cote, partie):
    """Feuille pointue de la base à la pointe, sa largeur selon `largeur` (demi-largeur au départ, au plus large, part de
    la longueur au plus large), son épaisseur selon `epaisseur` (demi-épaisseur à la racine, à la pointe), son pavillon
    creusé du côté de `normale`, de `creux` au plus large, nul à la racine et à la pointe ; rend ses sommets, son
    ancrage et son repère par part de longueur."""
    m = np.array([cote, 1.0, 1.0])
    base = H + np.asarray(O['base'], float) * m
    a, n, w = _repere(np.asarray(O['direction'], float) * m, np.asarray(O['normale'], float) * m)
    depart, large, part = O['largeur']

    def demi_largeur(t):
        if t <= part:
            return depart + (large - depart) * math.sin(0.5 * math.pi * t / part)
        return large * math.cos(0.5 * math.pi * (t - part) / (1.0 - part))

    def centre(t):
        return base + O['longueur'] * t * a + O['cambrure'] * O['longueur'] * math.sin(math.pi * t) * (-n)

    ts = [k / O['rangs'] for k in range(O['rangs'])]
    racine, pointe = O['epaisseur']
    sections = [(w, n, demi_largeur(t), pointe + (racine - pointe) * (1.0 - t) ** 2,
                 O['creux'] * math.sin(math.pi * min(1.0, 0.5 * t / part))) for t in ts]
    sommets = fuseau(M, [centre(t) for t in ts], sections, centre(1.0), O['cotes'], partie)
    return sommets, base, (centre, demi_largeur, a, n, w)


def anneau_d_oreille(M, spec, repere, partie):
    """Tore passé dans le bord bas de l'oreille, à la part `part` de sa longueur ; rend ses sommets et son ancrage."""
    centre, demi_largeur, a, n, w = repere
    c = centre(spec['part'])
    bord = w if (c + w)[2] < (c - w)[2] else -w
    o = c + (demi_largeur(spec['part']) + spec['grand_rayon'] - spec['prise']) * bord
    sommets = []
    for i in range(spec['segments']):
        u = 2 * math.pi * i / spec['segments']
        axe = math.cos(u) * bord + math.sin(u) * n
        anneau = M.ajouter([o + (spec['grand_rayon'] + spec['petit_rayon'] * math.cos(2 * math.pi * j / spec['cotes'])) * axe
                            + spec['petit_rayon'] * math.sin(2 * math.pi * j / spec['cotes']) * a
                            for j in range(spec['cotes'])], partie)
        sommets.append((anneau, o + spec['grand_rayon'] * axe))
    for (A, ref), (B, _) in zip(sommets, sommets[1:] + sommets[:1]):
        M.bande(A, B, ref)
    return [i for A, _ in sommets for i in A], o


# --- clés ------------------------------------------------------------------------------------------------------------

def decalages_monde(objet, nom):
    """Les décalages de la clé `nom` de `objet`, dans le repère monde."""
    return decalages(objet, nom) @ np.array(objet.matrix_world)[:3, :3].T


def cles_du_corps(b, zones, X):
    """Par silhouette déclarée de la base et par clé `gabarit_*`, le décalage de chaque sommet `X` : celui du corps de la
    base (tout mesh qui porte une zone, yeux et sourcils compris) au point le plus proche du sommet, interpolé dans son
    triangle, prolongé jusqu'au sommet par la partie linéaire du champ affine qui approche au mieux (moindres carrés) le
    décalage de la peau de la tête (zones `zones`). La tête s'écarte du corps de plusieurs centimètres (mâchoire d'orc
    5 cm devant le menton) ; sous `gabarit_head_plus`, qui grandit la tête, le décalage d'un point de la peau ne vaut pas
    celui d'un point 5 cm devant : le champ affine porte la croissance sur l'écart. `suiviDuCorps` compare au même point
    du corps : le décalage d'un sommet ne s'en écarte que de cette croissance sur son jeu."""
    noms = list(b.manifeste['silhouettes']) + [k.name for k in b.zones[zones[0]].data.shape_keys.key_blocks
                                                if k.name.startswith('gabarit_')]
    P, T, champs, n = [], [], {nom: [] for nom in noms}, 0
    de_la_tete = []
    for o in sorted((o for o in bpy.data.objects if o.type == 'MESH' and o.get('zone')), key=lambda o: o.name):
        Mo = np.array(o.matrix_world)
        p = np.array([v.co for v in o.data.vertices]) @ Mo[:3, :3].T + Mo[:3, 3]
        o.data.calc_loop_triangles()
        P.append(p)
        T.append(np.array([t.vertices[:] for t in o.data.loop_triangles]) + n)
        de_la_tete.append(np.full(len(p), o in [b.zones[z] for z in zones]))
        n += len(p)
        cles = o.data.shape_keys.key_blocks if o.data.shape_keys else {}
        for nom in noms:
            champs[nom].append(decalages_monde(o, nom) if nom in cles else np.zeros_like(p))
    P, T, de_la_tete = np.concatenate(P), np.concatenate(T), np.concatenate(de_la_tete)
    porteur = porteur_de(P, T, np.zeros((len(P), 1)))
    lies, proches = [], []
    for x in X:
        point, _, face, _ = porteur['arbre'].find_nearest(Vector(x.tolist()))
        point = np.array(point)
        a, b_, c = P[T[face]]
        v0, v1, v2 = b_ - a, c - a, point - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        bv, bw = (d11 * d20 - d01 * d21) / den, (d00 * d21 - d01 * d20) / den
        lies.append((T[face], np.array([1 - bv - bw, bv, bw])))
        proches.append(point)
    homogenes = np.column_stack([P, np.ones(len(P))])[de_la_tete]
    ecarts = X - np.array(proches)
    sortie = {}
    for nom in noms:
        champ = np.concatenate(champs[nom])
        lineaire = np.linalg.lstsq(homogenes, champ[de_la_tete], rcond=None)[0][:3]
        sortie[nom] = np.array([(champ[t] * w[:, None]).sum(0) for t, w in lies]) + ecarts @ lineaire
    return sortie


# --- construction ----------------------------------------------------------------------------------------------------

def construire(D, materiaux, b):
    zones = D['ZONES_DES_CLES']
    b.exiger(zones + ['cou'])
    H = np.array(b.tete('Head'))
    C = H + np.asarray(D['CENTRE'], float)
    vols = volumes(D['FORME'])
    z_axe = D['AXE_DU_VISAGE']
    vols_inverses = [_retourne(v, z_axe) if v.get('visage') else v for v in vols]

    indices_du_cou, S = couture(b, zones, C)
    k = D['SERRAGE_DEVANT']
    vs = -180.0 + 360.0 * np.arange(D['COLONNES']) / D['COLONNES']
    phis = vs - k * np.degrees(np.sin(np.radians(vs)))
    E = elevation_de_la_couture(S, C, phis)
    rangs = np.asarray(D['RANGS'], float)
    fondus = np.array([fondu(g / D['FONDU_DU_COU']) for g in rangs])

    dirs = np.array([direction_spatiale(phi, e + (90.0 - e) * g) for g in rangs for phi, e in zip(phis, E)] + [POLE])
    r_forme = rayons_vises(C - H, dirs, vols)
    r_inverse = rayons_vises(C - H, dirs, vols_inverses)
    poids_forme = np.concatenate([np.repeat(fondus, len(phis)), [1.0]])
    porteur = b.porteur(zones)
    r_couture = np.array([np.linalg.norm(sur_le_porteur(porteur, C, d, PORTEE_M)[0] - C) for d in dirs])
    r = (1 - poids_forme) * r_couture + poids_forme * r_forme
    inverse = (poids_forme * (r_inverse - r_forme))[:, None] * dirs

    M = Maillage()
    bord = M.ajouter(list(S), 'peau')
    grille = M.ajouter(list(C + r[:, None] * dirs), 'peau')
    n = len(phis)
    anneaux = [grille[i * n:(i + 1) * n] for i in range(len(rangs))]
    pole = grille[-1]
    coudre(M, bord, S, anneaux[0], C + r[:n, None] * dirs[:n], C)
    for A, B in zip(anneaux[:-1], anneaux[1:]):
        M.bande(A, B, C)
    for j in range(n):
        M.triangle(anneaux[-1][j], anneaux[-1][(j + 1) % n], pole, C)
    crane = len(M.sommets)

    rigides = []          # (sommets, ancrage, retourné par visage_inverse)
    for cote in (1.0, -1.0):
        rigides.append((sphere(M, H + np.asarray(D['OEIL']['centre'], float) * np.array([cote, 1, 1]), D['OEIL']['rayon'],
                               D['OEIL']['cotes'], D['OEIL']['rangs'], 'yeux'),
                        H + np.asarray(D['OEIL']['centre'], float) * np.array([cote, 1, 1]), True))
    reperes = {}
    for cote in (1.0, -1.0):
        sommets, ancre, reperes[cote] = oreille(M, D['OREILLE'], H, cote, 'peau')
        rigides.append((sommets, ancre, False))
    if 'NEZ' in D:
        rigides.append((*effile(M, D['NEZ'], H, 1.0, 'peau'), True))
    for spec in D.get('CROCS', []):
        for cote in (1.0, -1.0):
            rigides.append((*effile(M, spec, H, cote, 'dents'), True))
    for spec in D.get('DENTS', []):
        rigides.append((*dent(M, spec, H, 'dents'), True))
    for spec in D.get('ANNEAUX', []):
        rigides.append((*anneau_d_oreille(M, spec, reperes[spec['cote']], 'anneaux'), False))

    X, orientes, _ = M.orienter()
    W = np.zeros((len(X), len(b.os)))
    for v in range(len(bord), crane):
        W[v] = emprunter(X[v], porteur)[0]
    W[:len(bord)] = b.corps('cou')[2][indices_du_cou]
    for sommets, ancre, _ in rigides:
        W[sommets] = emprunter(ancre, porteur)[0]

    noms = list(materiaux)
    piece = maillage_skinne(D['NOM'], [tuple(p) for p in X], orientes, materiaux[noms[0]], b.rig, poids_normalises(W, b.os))
    for nom in noms[1:]:
        piece.data.materials.append(materiaux[nom])
    for poly, t in zip(piece.data.polygons, orientes):
        poly.material_index = noms.index(M.parties[t[0]])
        poly.use_smooth = True
    orienter_les_solides(piece, crane)
    poser_les_normales_de_la_couture(piece, len(bord), normales_de_sommet(b.zones['cou'])[indices_du_cou])
    for nom, champ_ in cles_du_corps(b, zones, X[len(bord):]).items():
        poser_la_cle(piece, nom, np.concatenate([decalages_monde(b.zones['cou'], nom)[indices_du_cou], champ_]))

    retourne = np.zeros_like(X)
    retourne[len(bord):crane] = inverse
    for sommets, _, tourne in rigides:
        if tourne:
            p = X[sommets]
            retourne[sommets] = np.column_stack([-p[:, 0], p[:, 1], 2 * (H[2] + z_axe) - p[:, 2]]) - p
    poser_la_cle(piece, 'visage_inverse', retourne)
    return piece
