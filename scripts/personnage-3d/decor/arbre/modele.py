"""Les arbres (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), où `Gabarit.rentrer` ramène le sommet qui en sortirait. Une branche (tronc, charpentière, rameau, racine,
tige) est une suite d'anneaux le long d'une courbe, au repère transporté, de section striée et vrillée, finie en pointe
ou en cassure ; une masse de feuillage, un icosaèdre subdivisé, lobé, entaillé, facetté. L'aléa est semé des codes de
caractères de l'id du décor : deux constructions rendent les mêmes octets."""
import math
import random

from mathutils import Vector

import habillage
from gabarit import Gabarit
from maille import Maille, lineaire, objet

DECORS = ("arbre", "arbre-mort", "souche", "buisson")
HAUT = Vector((0, 0, 1))


def alea(id_):
    """Le générateur semé des codes de caractères de `id_`."""
    return random.Random(sum((i + 1) * ord(c) for i, c in enumerate(id_)))


def cap(azimut):
    """Le vecteur horizontal unitaire d'`azimut` degrés."""
    return Vector((math.cos(math.radians(azimut)), math.sin(math.radians(azimut)), 0))


def ecart_d_azimut(direction, azimut):
    """L'écart (radians, de 0 à pi) entre l'azimut de `direction` et `azimut` degrés."""
    return abs((math.atan2(direction.y, direction.x) - math.radians(azimut) + math.pi) % (2 * math.pi) - math.pi)


def courbe(points, rayons, pas, ecart, a):
    """La courbe de Catmull-Rom par `points`, `pas` anneaux par tronçon, chaque anneau intercalé écarté d'au plus
    `ecart` mètres sur chaque axe, et le rayon de chacun, interpolé de `rayons`."""
    pts = [Vector(p) for p in points]
    chemin, sections = [], []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
        for s in range(pas):
            t = s / pas
            q = 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3)
            chemin.append(q + Vector([a.uniform(-ecart, ecart) for _ in range(3)]) if s else q)
            sections.append(rayons[i] + (rayons[i + 1] - rayons[i]) * t)
    return chemin + [pts[-1]], sections + [rayons[-1]]


def transporter(n, t0, t1):
    """La normale `n` portée par la plus petite rotation qui amène la tangente unitaire `t0` sur `t1`, sans fonction
    trigonométrique (Rodrigues) : le résultat ne dépend pas de la libm."""
    v = t0.cross(t1)
    return n + v.cross(n) + v.cross(v.cross(n)) / (1 + t0.dot(t1))


def peau(m, anneaux, mat, pointe):
    """Les quads entre anneaux successifs (listes de points de même longueur), le premier fermé à plat, le dernier en
    cône vers `pointe`."""
    k = len(anneaux[0])
    sommets = [tuple(p) for anneau in anneaux for p in anneau] + [tuple(pointe)]
    faces = [[i * k + j, i * k + (j + 1) % k, (i + 1) * k + (j + 1) % k, (i + 1) * k + j]
             for i in range(len(anneaux) - 1) for j in range(k)]
    faces.append(list(range(k))[::-1])
    dernier = (len(anneaux) - 1) * k
    faces += [[dernier + j, dernier + (j + 1) % k, len(sommets) - 1] for j in range(k)]
    m.ajouter(sommets, faces, mat)


def evasement(direction, z, contreforts):
    """Le facteur de rayon des `contreforts` (azimuts, saillie, décroissance, exposant) dans `direction` à la hauteur `z`."""
    azimuts, saillie, decroissance, exposant = contreforts
    return 1 + saillie * math.exp(-z / decroissance) * sum(max(0.0, math.cos(ecart_d_azimut(direction, phi))) ** exposant for phi in azimuts)


def branche(m, points, rayons, S, mat, a, cassure=None, contreforts=None, creux=()):
    """Une branche le long de `points`, de section `S` (`SECTIONS`), finie en pointe, ou en `cassure` (éclats, paroi,
    fond) ; `contreforts` l'évase au pied, `creux` (hauteur, azimut, demi-hauteur, demi-ouverture, profondeur) l'entaille.
    Rend son chemin et ses anneaux."""
    chemin, sections = courbe(points, rayons, S["pas"], S["ecart"], a)
    k = S["cotes"]
    stries = [a.uniform(-S["stries"], S["stries"]) for _ in range(k)]
    tangentes = [(chemin[min(i + 1, len(chemin) - 1)] - chemin[max(i - 1, 0)]).normalized() for i in range(len(chemin))]
    ref = Vector((1, 0, 0)) if abs(tangentes[0].x) < 0.9 else Vector((0, 1, 0))
    n = (ref - tangentes[0] * ref.dot(tangentes[0])).normalized()
    anneaux, longueur = [], 0.0
    for i, (p, t, r) in enumerate(zip(chemin, tangentes, sections)):
        if i:
            n = transporter(n, tangentes[i - 1], t).normalized()
            longueur += (p - chemin[i - 1]).length
        b = t.cross(n)
        anneau = []
        for j in range(k):
            angle = 2 * math.pi * j / k + S["torsion"] * longueur
            d = n * math.cos(angle) + b * math.sin(angle)
            f = 1 + stries[j] + a.uniform(-S["grain"], S["grain"])
            if contreforts:
                f *= evasement(d, p.z, contreforts)
            for z, azimut, demi_hauteur, demi_ouverture, profondeur in creux:
                f *= 1 - profondeur * max(0.0, 1 - ((p.z - z) / demi_hauteur) ** 2) * max(0.0, 1 - (ecart_d_azimut(d, azimut) / math.radians(demi_ouverture)) ** 2)
            anneau.append(p + d * r * f)
        anneaux.append(anneau)
    bout, t, r = chemin[-1], tangentes[-1], sections[-1]
    if cassure is None:
        peau(m, anneaux, mat, bout + t * r * S["pointe"])
    else:
        eclats, paroi, fond = cassure
        bord = [v + t * r * a.uniform(*eclats) for v in anneaux[-1]]
        dedans = [bout + (v - bout) * paroi for v in anneaux[-1]]
        peau(m, anneaux + [bord, dedans], mat, bout - t * r * fond)
    return chemin, anneaux


def ecorce(m, chemin, anneaux, E, mat, a):
    """Les lanières d'écorce restées sur un tronc : par côté, une bande à `epaisseur` de ses anneaux, du pied à la
    hauteur où elle s'arrête, son bord déchiré, ses chants fermés là où la voisine s'arrête plus bas."""
    epaisseur, hauteurs, dent = E
    k = len(anneaux[0])
    arrets = []
    for _ in range(k):
        h = a.uniform(*hauteurs)
        arrets.append(max(i for i, c in enumerate(chemin[:-1]) if c.z <= h))

    def dessus(i, j, part):
        """Le point du tronc au côté `j`, `part` du tronçon au-delà de l'anneau `i`, et son vis-à-vis sur l'écorce."""
        v = anneaux[i][j % k].lerp(anneaux[i + 1][j % k], part)
        c = chemin[i].lerp(chemin[i + 1], part)
        return v, v + (v - c).normalized() * epaisseur

    for j, n in enumerate(arrets):
        if n == 0:
            continue
        gauche = [dessus(i, j, 0.0) for i in range(n)] + [dessus(n, j, a.uniform(0, dent))]
        droite = [dessus(i, j + 1, 0.0) for i in range(n)] + [dessus(n, j + 1, a.uniform(0, dent))]
        sommets = [p for paire in gauche + droite for p in paire]
        dedans_g, dehors_g = (lambda i: 2 * i), (lambda i: 2 * i + 1)
        dedans_d, dehors_d = (lambda i: 2 * (n + 1 + i)), (lambda i: 2 * (n + 1 + i) + 1)
        faces = [[dehors_g(i), dehors_d(i), dehors_d(i + 1), dehors_g(i + 1)] for i in range(n)]
        faces.append([dehors_g(n), dehors_d(n), dedans_d(n), dedans_g(n)])
        faces += [[dedans_g(i), dehors_g(i), dehors_g(i + 1), dedans_g(i + 1)] for i in range(min(arrets[j - 1], n), n)]
        faces += [[dehors_d(i), dedans_d(i), dedans_d(i + 1), dehors_d(i + 1)] for i in range(min(arrets[(j + 1) % k], n), n)]
        m.ajouter([tuple(p) for p in sommets], faces, mat)


def icosaedre(subdivisions):
    """Les sommets unitaires et les faces d'un icosaèdre subdivisé `subdivisions` fois."""
    t = (1 + 5 ** 0.5) / 2
    v = [Vector(p).normalized() for p in ((-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t),
                                          (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1))]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    for _ in range(subdivisions):
        milieux = {}

        def milieu(i, j):
            cle = (min(i, j), max(i, j))
            if cle not in milieux:
                milieux[cle] = len(v)
                v.append(((v[i] + v[j]) / 2).normalized())
            return milieux[cle]
        f = [g for i, j, k in f for g in ((i, milieu(i, j), milieu(i, k)), (j, milieu(j, k), milieu(i, j)),
                                         (k, milieu(i, k), milieu(j, k)), (milieu(i, j), milieu(j, k), milieu(i, k)))]
    return v, f


def bloc(m, F, centre, taille, mat, a):
    """Un bloc de feuillage de `taille` autour de `centre` : un icosaèdre subdivisé, lobé, entaillé, son dessous aplati."""
    unitaires, faces = icosaedre(1)
    rx, ry = (taille * (1 + a.uniform(-F["variation"], F["variation"])) for _ in range(2))
    rz = taille * F["hauteur"]
    tour = a.uniform(0, 2 * math.pi)
    e1, e2 = Vector((math.cos(tour), math.sin(tour), 0)), Vector((-math.sin(tour), math.cos(tour), 0))

    def bosses(nombre, amplitude, exposant):
        return [(Vector((a.gauss(0, 1), a.gauss(0, 1), a.gauss(0, 1))).normalized(), a.uniform(*F["amplitude"]) * amplitude, exposant)
                for _ in range(nombre)]

    lobes, creux = bosses(*F["lobes"]), bosses(*F["creux"])
    sommets = []
    for d in unitaires:
        r = (1 + sum(amp * max(0.0, d.dot(u)) ** e for u, amp, e in lobes)
             - sum(amp * max(0.0, d.dot(u)) ** e for u, amp, e in creux) + a.uniform(-F["grain"], F["grain"]))
        sommets.append(tuple(centre + (e1 * d.x * rx + e2 * d.y * ry + HAUT * d.z * rz * (F["aplati"] if d.z < 0 else 1.0)) * r))
    m.ajouter(sommets, faces, mat)


def masse(m, F, bout, taille, mat, a):
    """Une masse de feuillage de `taille` au-dessus de `bout`, le bout du bois qui la porte, d'après `F` (`FEUILLAGE`) :
    un bloc, et autour de lui un satellite par seuil de `satellites` que sa taille atteint."""
    centre = Vector(bout) + HAUT * taille * F["hauteur"] * F["assise"]
    bloc(m, F, centre, taille, mat, a)
    seuils, ecart, hauteurs, tailles = F["satellites"]
    nombre = sum(taille >= seuil for seuil in seuils)
    tour = a.uniform(0, 360)
    for k in range(nombre):
        azimut = tour + (k + a.random()) * 360 / nombre
        bloc(m, F, centre + (cap(azimut) * ecart + HAUT * a.uniform(*hauteurs)) * taille, taille * a.uniform(*tailles), mat, a)


def sur(chemin, part):
    """Le point de `chemin` à `part` (0 à 1) de ses tronçons."""
    x = part * (len(chemin) - 1)
    i = min(int(x), len(chemin) - 2)
    return chemin[i].lerp(chemin[i + 1], x - i)


def a_la_hauteur(chemin, z):
    """Le point de `chemin`, qui monte, à la hauteur `z`."""
    i = max(i for i, p in enumerate(chemin[:-1]) if p.z <= z)
    return chemin[i].lerp(chemin[i + 1], (z - chemin[i].z) / (chemin[i + 1].z - chemin[i].z))


def rayon_a(points, rayons, z):
    """Le rayon nominal, à la hauteur `z`, d'une branche qui monte par `points` avec `rayons`."""
    return lineaire(list(zip((p[2] for p in points), rayons)), z)


def bourrelet(m, chemin, rayon, creux, B, mat, a):
    """Le bourrelet qui cerne la cavité `creux` d'un tronc de chemin `chemin` et de rayon `rayon(z)` : trois anneaux
    autour d'elle, le pied dans le bois, la crête en saillie, la gorge vers le fond, d'après `B` (part de l'ouverture où
    court la crête, saillie et largeur en fractions, côtés, grain)."""
    z, azimut, demi_hauteur, demi_ouverture, _ = creux
    part, saillie, largeur, cotes, grain = B
    anneaux = []
    for echelle, relief in ((part + largeur, -saillie), (part, saillie), (part - largeur, -2 * saillie)):
        for k in range(cotes):
            t = 2 * math.pi * k / cotes
            h = z + demi_hauteur * echelle * math.sin(t)
            anneaux.append(tuple(a_la_hauteur(chemin, h) + cap(azimut + demi_ouverture * echelle * math.cos(t)) * rayon(h) * (1 + relief + a.uniform(-grain, grain))))
    m.ajouter(anneaux, [[i * cotes + k, i * cotes + (k + 1) % cotes, (i + 1) * cotes + (k + 1) % cotes, (i + 1) * cotes + k]
                        for i in range(2) for k in range(cotes)], mat)


def arbre(D, bois, feuilles, a):
    """Le feuillu : le tronc et sa flèche, les charpentières en arc, leurs rameaux, une masse de feuillage à chaque bout."""
    A, S, F = D["ARBRE"], D["SECTIONS"], D["FEUILLAGE"]["arbre"]
    fut, _ = branche(bois, A["chemin"], A["rayons"], S["tronc"], "ecorce", a, contreforts=A["contreforts"])
    masse(feuilles, F, fut[-1], A["cime"], "feuillage", a)

    def rameau(depart, azimut, longueur, montee, taille):
        bout = depart + cap(azimut) * longueur + HAUT * montee
        part, bombe, travers = A["coude"]
        coude = depart.lerp(bout, part) + HAUT * montee * bombe + cap(azimut + 90) * a.uniform(-travers, travers)
        branche(bois, [depart, coude, bout], A["rayons_rameau"], S["rameau"], "ecorce", a)
        masse(feuilles, F, bout, taille, "feuillage", a)

    for C in A["charpentieres"]:
        pied = a_la_hauteur(fut, C["depart"])
        vers = cap(C["azimut"])
        points = [pied + vers * rayon_a(A["chemin"], A["rayons"], C["depart"]) * A["enfoui"]]
        points += [pied + vers * C["portee"] * fp + HAUT * C["montee"] * fm for fp, fm in A["arc"]]
        points.append(pied + vers * C["portee"] + HAUT * C["montee"])
        chemin, _ = branche(bois, points, [f * C["rayon"] for f in A["rayons_charpentiere"]], S["charpentiere"], "ecorce", a)
        masse(feuilles, F, chemin[-1], C["masse"], "feuillage", a)
        for part, ecart, longueur, montee, taille in C["rameaux"]:
            rameau(sur(chemin, part), C["azimut"] + ecart, longueur, montee, taille)
    for hauteur, azimut, longueur, montee, taille in A["fleche"]:
        rameau(a_la_hauteur(fut, hauteur), azimut, longueur, montee, taille)


def arbre_mort(D, bois, a):
    """Le chicot : le tronc vrillé, ses lanières d'écorce, sa cavité cernée d'un bourrelet, ses branches et ses racines."""
    A, S = D["ARBRE_MORT"], D["SECTIONS"]
    mat = "bois-mort"
    chemin, anneaux = branche(bois, A["chemin"], A["rayons"], S["tronc-mort"], mat, a, contreforts=A["contreforts"], creux=A["creux"])
    ecorce(bois, chemin, anneaux, A["ecorce"], mat, a)
    for creux in A["creux"]:
        bourrelet(bois, chemin, lambda z: rayon_a(A["chemin"], A["rayons"], z), creux, A["bourrelet"], mat, a)
    for B in A["branches"]:
        branche(bois, B["chemin"], B["rayons"], S["branche-morte"], mat, a, cassure=D["CASSURE"] if B["casse"] else None)
    for R in A["racines"]:
        branche(bois, R["chemin"], R["rayons"], S["racine"], mat, a)


def souche(D, bois, a):
    """Le fût et la coupe d'une seule peau, sur les rayons d'un plan polaire où chaque gerce a les siens."""
    C, S = D["SOUCHE"], D["SECTIONS"]
    mat = "bois-mort"
    azimuts = [(360 * k / C["rayons"], None) for k in range(C["rayons"])]
    for gerce in C["gerces"]:
        azimut, ouverture = gerce[:2]
        azimuts = [(x, g) for x, g in azimuts if abs((x - azimut + 180) % 360 - 180) > 2 * ouverture]
        azimuts += [(azimut - ouverture, None), (azimut, gerce), (azimut + ouverture, None)]
    azimuts.sort(key=lambda x: x[0])
    stries = [a.uniform(-C["stries"], C["stries"]) for _ in azimuts]
    pente, vers = C["pente"]
    chute, debut, raideur = C["entaille"]
    rentrant, decroissance = C["gerce_au_flanc"]
    sommet = C["profil"][-1][0]

    def dessus(p):
        """La hauteur de la coupe au point `p` du plan : sa pente, puis l'entaille au-delà de sa lèvre."""
        return C["coupe"] + pente * p.dot(cap(vers)) - raideur * max(0.0, p.dot(cap(chute)) - debut)

    def au_fut(j, z, r):
        azimut, gerce = azimuts[j]
        d = cap(azimut)
        f = (1 + stries[j] + a.uniform(-C["grain"], C["grain"])) * evasement(d, z, C["contreforts"])
        return d * r * f * (1 - (rentrant * math.exp(-(sommet - z) / decroissance) if gerce else 0))

    anneaux = [[au_fut(j, z, r) + HAUT * z for j in range(len(azimuts))] for z, r in C["profil"]]
    bord = [au_fut(j, sommet, C["profil"][-1][1]) for j in range(len(azimuts))]
    lisiere = []
    for j, p in enumerate(bord):
        gerce = azimuts[j][1]
        lisiere.append(p + HAUT * (dessus(p) + a.uniform(-C["lisiere"], C["lisiere"]) - (gerce[3] if gerce else 0)))
    anneaux.append(lisiere)
    for rang, part in enumerate(C["cernes"]):
        for marche in (rang, rang + 1):
            anneau = []
            for j, p in enumerate(bord):
                gerce = azimuts[j][1]
                q = p * part
                fond = gerce[3] if gerce and part >= gerce[2] else 0
                anneau.append(q + HAUT * (dessus(q) - marche * C["gradin"] - fond + a.uniform(-C["relief"], C["relief"])))
            anneaux.append(anneau)
    peau(bois, anneaux, mat, HAUT * (dessus(Vector((0, 0, 0))) - (len(C["cernes"]) + 1) * C["gradin"] - C["coeur"]))

    nombre, demi_longueur, largeurs, epaisseur, hauteurs, devers, couche = C["charniere"]
    levre, travers = cap(chute) * debut, cap(chute + 90)
    for k in range(nombre):
        c = levre + travers * demi_longueur * (2 * (k + a.random()) / nombre - 1)
        largeur = a.uniform(*largeurs)
        pied = [c + travers * i * largeur / 2 + cap(chute) * j * epaisseur / 2 for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        pointe = c + HAUT * (dessus(c) + a.uniform(*hauteurs)) + travers * a.uniform(-devers, devers) + cap(chute) * a.uniform(*couche)
        bois.ajouter([tuple(p + HAUT * (dessus(p) - C["gradin"])) for p in pied] + [tuple(pointe)],
                     [[i, (i + 1) % 4, 4] for i in range(4)], mat)
    for R in C["racines"]:
        branche(bois, R["chemin"], R["rayons"], S["racine"], mat, a)


def buisson(D, tiges, feuilles, a):
    """La touffe : une tige par masse de feuillage, du pied à son dessous, et les brindilles nues."""
    B, S, F = D["BUISSON"], D["SECTIONS"], D["FEUILLAGE"]["buisson"]
    part_portee, part_montee = B["coude"]

    def tige(bout):
        pied = cap(math.degrees(math.atan2(bout.y, bout.x))) * a.uniform(*B["pied"])
        coude = Vector((pied.x + (bout.x - pied.x) * part_portee, pied.y + (bout.y - pied.y) * part_portee, bout.z * part_montee))
        branche(tiges, [pied, coude, bout], B["rayons_tige"], S["tige"], "tiges", a)

    for centre, taille in B["masses"]:
        bout = Vector(centre) - HAUT * taille * F["hauteur"] * F["assise"]
        tige(bout)
        masse(feuilles, F, bout, taille, "feuillage", a)
    for azimut, portee, hauteur in B["brindilles"]:
        tige(cap(azimut) * portee + HAUT * hauteur)


def construire(D, id_):
    G, a = Gabarit(id_), alea(id_)
    mats = habillage.materiaux(D["MATERIAUX"][id_])
    pieces = {nom: Maille([mat]) for nom, mat in mats.items()}
    if id_ == "arbre":
        arbre(D, pieces["ecorce"], pieces["feuillage"], a)
    elif id_ == "arbre-mort":
        arbre_mort(D, pieces["bois-mort"], a)
    elif id_ == "souche":
        souche(D, pieces["bois-mort"], a)
    else:
        buisson(D, pieces["tiges"], pieces["feuillage"], a)
    objets = []
    for nom, maille in pieces.items():
        maille.v = [tuple(p) for p in G.rentrer(maille.v, D["RETRAIT"])]
        objets.append(objet(nom, maille, (0.0, 0.0, 0.0), D["ANGLE_LISSE"][nom]))
    triangles = sum(len(o.data.polygons) for o in objets)
    if triangles > D["BUDGET_TRIANGLES"][id_]:
        raise ValueError(f"{id_} : {triangles} triangles, budget {D['BUDGET_TRIANGLES'][id_]}")
    return {}


def elements(D):
    for id_ in DECORS:
        yield {"glb": id_, "cles": [("decor", {"prop": id_})], "materiaux": D["MATERIAUX"][id_], "blasons": (),
               "construire": lambda id_=id_: construire(D, id_)}
