"""Les arbres (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), où `Gabarit.rentrer` ramène le sommet qui en sortirait. Une branche (tronc, charpentière, rameau, racine,
tige) est une suite d'anneaux le long d'une courbe, au repère transporté, de section striée et vrillée, finie en pointe
ou en cassure ; une masse de feuillage, un icosaèdre subdivisé, lobé, entaillé, facetté. L'aléa est semé des codes de
caractères de l'id du décor : deux constructions rendent les mêmes octets.

Saisons. Un décor de `CADUCS` (`donnees.py`) perd ses feuilles en hiver : son feuillage est le nœud `sans-hiver`
(`NOEUD_DU_FEUILLAGE`), caché en hiver, et sa ramure nue, des brindilles en éventail là où chaque masse de feuillage se
tient, le nœud `avec-hiver` (`NOEUD_DE_LA_RAMURE`), montré en hiver seulement ; son aléa est à part (`alea` de l'id suivi
d'« hiver »), si bien que la ramure ne change rien au reste. Un décor que nomme `SELON` (`donnees.py`) porte au
manifeste ce qui change selon la saison : par saison, `{ palette? }` ; `SELON` nomme l'hiver de chaque décor caduc."""
import math

from mathutils import Vector

import habillage
import geometrie
from geometrie import HAUT, a_la_hauteur, alea, anneau, cap, coque, lisse, normale, normales
from gabarit import Gabarit
from maille import Maille, lineaire, objet

DECORS = ("arbre", "hetre", "orme", "pin", "arbre-mort", "souche", "buisson")
NOEUD_DU_FEUILLAGE = "sans-hiver"
NOEUD_DE_LA_RAMURE = "avec-hiver"


def ecart_d_azimut(direction, azimut):
    """L'écart (radians, de 0 à pi) entre l'azimut de `direction` et `azimut` degrés."""
    return abs((math.atan2(direction.y, direction.x) - math.radians(azimut) + math.pi) % (2 * math.pi) - math.pi)


def courbe(points, rayons, pas, ecart, a):
    """La courbe de Catmull-Rom par `points`, `pas` anneaux par tronçon, chaque anneau intercalé écarté d'au plus
    `ecart` mètres sur chaque axe, et le rayon de chacun, interpolé de `rayons`."""
    lisses = lisse([Vector(p) for p in points], pas)
    chemin = [q + Vector([a.uniform(-ecart, ecart) for _ in range(3)]) if i % pas else q for i, q in enumerate(lisses[:-1])]
    sections = [rayons[i] + (rayons[i + 1] - rayons[i]) * (s / pas) for i in range(len(points) - 1) for s in range(pas)]
    return chemin + lisses[-1:], sections + [rayons[-1]]


def transporter(n, t0, t1):
    """La normale `n` portée par la plus petite rotation qui amène la tangente unitaire `t0` sur `t1`, sans fonction
    trigonométrique (Rodrigues) : le résultat ne dépend pas de la libm."""
    v = t0.cross(t1)
    return n + v.cross(n) + v.cross(v.cross(n)) / (1 + t0.dot(t1))


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
    n = normale(tangentes[0])
    anneaux, longueur = [], 0.0
    for i, (p, t, r) in enumerate(zip(chemin, tangentes, sections)):
        if i:
            n = transporter(n, tangentes[i - 1], t).normalized()
            longueur += (p - chemin[i - 1]).length
        b = t.cross(n)
        cercle = []
        for j in range(k):
            angle = 2 * math.pi * j / k + S["torsion"] * longueur
            d = n * math.cos(angle) + b * math.sin(angle)
            f = 1 + stries[j] + a.uniform(-S["grain"], S["grain"])
            if contreforts:
                f *= evasement(d, p.z, contreforts)
            for z, azimut, demi_hauteur, demi_ouverture, profondeur in creux:
                f *= 1 - profondeur * max(0.0, 1 - ((p.z - z) / demi_hauteur) ** 2) * max(0.0, 1 - (ecart_d_azimut(d, azimut) / math.radians(demi_ouverture)) ** 2)
            cercle.append(p + d * r * f)
        anneaux.append(cercle)
    bout, t, r = chemin[-1], tangentes[-1], sections[-1]
    if cassure is None:
        coque(m, anneaux, mat, bout + t * r * S["pointe"])
    else:
        eclats, paroi, fond = cassure
        bord = [v + t * r * a.uniform(*eclats) for v in anneaux[-1]]
        dedans = [bout + (v - bout) * paroi for v in anneaux[-1]]
        coque(m, anneaux + [bord, dedans], mat, bout - t * r * fond)
    return chemin, anneaux


def ecorce(m, chemin, anneaux, E, mat, a):
    """Les lanières d'écorce restées sur un tronc : par côté, une bande close à `epaisseur` de ses anneaux, du pied à la
    hauteur où elle s'arrête, son bord déchiré."""
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
        coque(m, [[dedans_g, dehors_g, dehors_d, dedans_d] for (dedans_g, dehors_g), (dedans_d, dehors_d) in zip(gauche, droite)], mat)


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


def brin(m, points, rayons, cotes, mat):
    """Un brin droit ou coudé : un anneau de `cotes` côtés à chacun de ses `points` sauf le dernier, sa pointe ; une
    coque convexe par tronçon."""
    pts = [Vector(p) for p in points]
    anneaux = [anneau(pts[i], *normales((pts[i + 1] - pts[max(i - 1, 0)]).normalized()), r, cotes) for i, r in enumerate(rayons)]
    for troncon in zip(anneaux, anneaux[1:]):
        coque(m, troncon, mat)
    coque(m, anneaux[-1:], mat, pts[-1])


def ramure(m, R, F, bout, taille, mat, a):
    """La ramure nue de la masse de feuillage de `taille` au-dessus de `bout`, d'après `R` (`RAMURE`) : des brindilles en
    éventail de `bout` jusqu'au bord de la masse et de ses satellites, coudées, chacune fourchue d'un côté puis de
    l'autre, ses fourches coudées comme elle."""
    bout = Vector(bout)
    centre = bout + HAUT * taille * F["hauteur"] * F["assise"]
    nombre = max(R["minimum"], round(taille * R["par_metre"]))
    tour = a.uniform(0, 360)

    def au_bord(azimut, elevations, portees):
        elevation = math.radians(a.uniform(*elevations))
        return centre + (cap(azimut) * math.cos(elevation) + HAUT * math.sin(elevation) * F["hauteur"]) * taille * a.uniform(*portees)

    for k in range(nombre):
        azimut = tour + (k + a.random()) * 360 / nombre
        fin = au_bord(azimut, R["elevation"], R["portee"])
        coude = bout.lerp(fin, R["coude"]) + HAUT * taille * R["bombe"] + cap(azimut + 90) * taille * a.uniform(-R["travers"], R["travers"])
        brin(m, [bout, coude, fin], [r * taille for r in R["rayons"]], R["cotes"], mat)
        for rang, part in enumerate(R["fourches"]):
            depart = sur([bout, coude, fin], part)
            vise = au_bord(azimut + (1 if (k + rang) % 2 else -1) * a.uniform(*R["ecart"]), R["elevation_des_fourches"], R["portee_des_fourches"])
            brin(m, [depart, depart.lerp(vise, R["coude"]) + HAUT * taille * R["bombe"], vise], [r * taille for r in R["rayons_des_fourches"]], R["cotes"], mat)


def sur(chemin, part):
    """Le point de `chemin` à `part` (0 à 1) de ses tronçons."""
    x = part * (len(chemin) - 1)
    i = min(int(x), len(chemin) - 2)
    return chemin[i].lerp(chemin[i + 1], x - i)


def rayon_a(points, rayons, z):
    """Le rayon nominal, à la hauteur `z`, d'une branche qui monte par `points` avec `rayons`."""
    return lineaire(list(zip((p[2] for p in points), rayons)), z)


def bourrelet(m, chemin, rayon, creux, B, mat, a):
    """Le bourrelet qui cerne la cavité `creux` d'un tronc de chemin `chemin` et de rayon `rayon(z)` : un tore de trois
    anneaux autour d'elle, le pied dans le bois, la crête en saillie, la gorge vers le fond, d'après `B` (part de
    l'ouverture où court la crête, saillie et largeur en fractions, côtés, grain)."""
    z, azimut, demi_hauteur, demi_ouverture, _ = creux
    part, saillie, largeur, cotes, grain = B
    anneaux = []
    for echelle, relief in ((part + largeur, -saillie), (part, saillie), (part - largeur, -2 * saillie)):
        for k in range(cotes):
            t = 2 * math.pi * k / cotes
            h = z + demi_hauteur * echelle * math.sin(t)
            anneaux.append(tuple(a_la_hauteur(chemin, h) + cap(azimut + demi_ouverture * echelle * math.cos(t)) * rayon(h) * (1 + relief + a.uniform(-grain, grain))))
    m.ajouter(anneaux, [[i * cotes + k, i * cotes + (k + 1) % cotes, (i + 1) % 3 * cotes + (k + 1) % cotes, (i + 1) % 3 * cotes + k]
                        for i in range(3) for k in range(cotes)], mat)


def arbre(A, D, F, bois, feuilles, nues, a, hiver):
    """L'arbre `A` (`ARBRES`) au feuillage `F` : le tronc et sa flèche, les charpentières en arc, leurs rameaux, une
    masse de feuillage à chaque bout, et sous elle sa ramure d'hiver dans `nues` (aucune si `None`) ; ses moignons."""
    S = D["SECTIONS"]
    fut, _ = branche(bois, A["chemin"], A["rayons"], S[A["tronc"]], "ecorce", a, contreforts=A["contreforts"])

    def garnir(bout, taille):
        masse(feuilles, F, bout, taille, "feuillage", a)
        if nues is not None:
            ramure(nues, D["RAMURE"], F, bout, taille, "ecorce", hiver)

    garnir(fut[-1], A["cime"])

    def rameau(depart, azimut, longueur, montee, taille):
        bout = depart + cap(azimut) * longueur + HAUT * montee
        part, bombe, travers = A["coude"]
        coude = depart.lerp(bout, part) + HAUT * montee * bombe + cap(azimut + 90) * a.uniform(-travers, travers)
        branche(bois, [depart, coude, bout], A["rayons_rameau"], S["rameau"], "ecorce", a)
        garnir(bout, taille)

    for C in A["charpentieres"]:
        pied = a_la_hauteur(fut, C["depart"])
        vers = cap(C["azimut"])
        points = [pied + vers * rayon_a(A["chemin"], A["rayons"], C["depart"]) * A["enfoui"]]
        points += [pied + vers * C["portee"] * fp + HAUT * C["montee"] * fm for fp, fm in A["arc"]]
        points.append(pied + vers * C["portee"] + HAUT * C["montee"])
        chemin, _ = branche(bois, points, [f * C["rayon"] for f in A["rayons_charpentiere"]], S["charpentiere"], "ecorce", a)
        garnir(chemin[-1], C["masse"])
        for part, ecart, longueur, montee, taille in C["rameaux"]:
            rameau(sur(chemin, part), C["azimut"] + ecart, longueur, montee, taille)
    for hauteur, azimut, longueur, montee, taille in A["fleche"]:
        rameau(a_la_hauteur(fut, hauteur), azimut, longueur, montee, taille)
    for hauteur, azimut, longueur, montee, rayon in A["moignons"]:
        pied = a_la_hauteur(fut, hauteur)
        (part, bombe), sections = D["MOIGNON"]
        branche(bois, [pied, pied + cap(azimut) * longueur * part + HAUT * montee * bombe, pied + cap(azimut) * longueur + HAUT * montee],
                [rayon * f for f in sections], S["branche-morte"], "ecorce", a, cassure=D["CASSURE"])


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
            cercle = []
            for j, p in enumerate(bord):
                gerce = azimuts[j][1]
                q = p * part
                fond = gerce[3] if gerce and part >= gerce[2] else 0
                cercle.append(q + HAUT * (dessus(q) - marche * C["gradin"] - fond + a.uniform(-C["relief"], C["relief"])))
            anneaux.append(cercle)
    coque(bois, anneaux, mat, HAUT * (dessus(Vector((0, 0, 0))) - (len(C["cernes"]) + 1) * C["gradin"] - C["coeur"]))

    nombre, demi_longueur, largeurs, epaisseur, hauteurs, devers, couche = C["charniere"]
    levre, travers = cap(chute) * debut, cap(chute + 90)
    for k in range(nombre):
        c = levre + travers * demi_longueur * (2 * (k + a.random()) / nombre - 1)
        largeur = a.uniform(*largeurs)
        pied = [c + travers * i * largeur / 2 + cap(chute) * j * epaisseur / 2 for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        pointe = c + HAUT * (dessus(c) + a.uniform(*hauteurs)) + travers * a.uniform(-devers, devers) + cap(chute) * a.uniform(*couche)
        coque(bois, [[p + HAUT * (dessus(p) - C["gradin"]) for p in pied]], mat, pointe)
    for R in C["racines"]:
        branche(bois, R["chemin"], R["rayons"], S["racine"], mat, a)


def buisson(D, tiges, feuilles, nues, a, hiver):
    """La touffe : une tige par masse de feuillage, du pied à son dessous, sa ramure d'hiver dans `nues`, et les
    brindilles nues."""
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
        ramure(nues, D["RAMURE"], F, bout, taille, "tiges", hiver)
    for azimut, portee, hauteur in B["brindilles"]:
        tige(cap(azimut) * portee + HAUT * hauteur)


def construire(D, id_):
    G, a, hiver = Gabarit(id_), alea(id_), alea(f"{id_} hiver")
    mats = habillage.materiaux(D["MATERIAUX"][id_])
    pieces = {nom: Maille([mat]) for nom, mat in mats.items()}
    caduc = id_ in D["CADUCS"]
    nues = Maille([mats["tiges" if id_ == "buisson" else "ecorce"]]) if caduc else None
    if id_ in D["ARBRES"]:
        arbre(D["ARBRES"][id_], D, D["FEUILLAGE"][id_], pieces["ecorce"], pieces["feuillage"], nues, a, hiver)
    elif id_ == "arbre-mort":
        arbre_mort(D, pieces["bois-mort"], a)
    elif id_ == "souche":
        souche(D, pieces["bois-mort"], a)
    else:
        buisson(D, pieces["tiges"], pieces["feuillage"], nues, a, hiver)
    noeuds = [(NOEUD_DU_FEUILLAGE if caduc and nom == "feuillage" else nom, maille) for nom, maille in pieces.items()]
    if caduc:
        noeuds.append((NOEUD_DE_LA_RAMURE, nues))
    objets = []
    for nom, maille in noeuds:
        maille.v = [tuple(p) for p in G.rentrer(maille.v, D["RETRAIT"])]
        objets.append(objet(nom, maille, (0.0, 0.0, 0.0), D["ANGLE_LISSE"][maille.materiaux[0].name]))
    triangles = sum(len(o.data.polygons) for o in objets) - min((len(o.data.polygons) for o in objets if o.name in (NOEUD_DU_FEUILLAGE, NOEUD_DE_LA_RAMURE)), default=0)
    if triangles > D["BUDGET_TRIANGLES"][id_]:
        raise ValueError(f"{id_} : {triangles} triangles, budget {D['BUDGET_TRIANGLES'][id_]}")
    selon = D["SELON"].get(id_)
    return {"selon": selon} if selon else {}


def elements(D):
    return geometrie.elements(D, DECORS, construire)
