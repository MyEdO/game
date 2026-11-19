"""Les roches (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`). Chaque pièce se place et se dimensionne en fractions de la primitive qui la porte (`boite`). Un éclat de
roche est un polyèdre convexe exact (`polyedre`) : ses pans tirés, ses plans nommés, ses écailles et les faces de
l'enveloppe, sol compris ; ses strates, des bancs empilés, chacun en retrait ; un moellon, un pavé aux coins tirés ;
une colonne de concrétion, une suite d'anneaux en bourrelets, cannelée ; un tas, un cœur et les pierres et moellons de
sa pente. Le calcul est en flottants de Python, sans `mathutils` ; l'aléa est semé des codes de caractères de l'id du
décor : deux constructions rendent les mêmes octets."""
import math

import geometrie
import habillage
from geometrie import alea, coque
from gabarit import Gabarit, boite
from maille import Maille, lineaire, objet

DECORS = ("rocher", "menhir", "stalagmite", "gravats")
MAT = "pierre"
PHI = (1 + 5 ** 0.5) / 2
PARALLELE = 1e-9
"""Déterminant sous lequel trois plans ne se rencontrent pas en un point (`polyedre`)."""
SUR_LE_PLAN = 1e-7
"""Écart sous lequel un point est tenu pour posé sur un plan (`polyedre`), dans l'espace de la sphère unité."""


def somme(u, v, k=1.0):
    """`u + k v`."""
    return (u[0] + k * v[0], u[1] + k * v[1], u[2] + k * v[2])


def produit(u, v):
    """Le produit terme à terme de `u` et `v`."""
    return (u[0] * v[0], u[1] * v[1], u[2] * v[2])


def scalaire(u, v):
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]


def vectoriel(u, v):
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


def norme(u):
    return math.sqrt(scalaire(u, u))


def unitaire(u):
    n = norme(u)
    return (u[0] / n, u[1] / n, u[2] / n)


def direction(a):
    """Une direction unitaire tirée, par rejet dans le cube : sans fonction trigonométrique."""
    while True:
        u = (a.uniform(-1, 1), a.uniform(-1, 1), a.uniform(-1, 1))
        if 0.01 < scalaire(u, u) <= 1:
            return unitaire(u)


def dans(primitive, centre, demi):
    """Le centre et les demi-côtés d'une pièce, de `centre` et `demi` en fractions des demi-côtés de `primitive`."""
    c, e = boite(primitive)
    return somme(c, produit(e, centre)), produit(e, demi)


ICOSAEDRE = tuple(unitaire(p) for p in ((-1, PHI, 0), (1, PHI, 0), (-1, -PHI, 0), (1, -PHI, 0), (0, -1, PHI), (0, 1, PHI),
                                       (0, -1, -PHI), (0, 1, -PHI), (PHI, 0, -1), (PHI, 0, 1), (-PHI, 0, -1), (-PHI, 0, 1)))
"""Les douze directions des sommets d'un icosaèdre : des pans tirés autour d'elles ferment un polyèdre."""
CUBE = ((1.0, 0.0, 0.0), (-1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, -1.0, 0.0), (0.0, 0.0, 1.0), (0.0, 0.0, -1.0))


def polyedre(plans):
    """Le polyèdre convexe des points `q` où `n . q <= t` pour chaque plan `(n, t)` de `plans`, `n` unitaire : ses sommets
    (les points de rencontre de trois plans que tous les autres gardent) et ses faces, chacune le tour de ses sommets."""
    sommets = {}
    for i, ((a1, b1, c1), t1) in enumerate(plans):
        for j in range(i + 1, len(plans)):
            (a2, b2, c2), t2 = plans[j]
            x12, y12, z12 = b1 * c2 - c1 * b2, c1 * a2 - a1 * c2, a1 * b2 - b1 * a2
            if x12 * x12 + y12 * y12 + z12 * z12 < PARALLELE:
                continue
            for (a3, b3, c3), t3 in plans[j + 1:]:
                det = a3 * x12 + b3 * y12 + c3 * z12
                if abs(det) < PARALLELE:
                    continue
                x = (t1 * (b2 * c3 - c2 * b3) + t2 * (b3 * c1 - c3 * b1) + t3 * x12) / det
                y = (t1 * (c2 * a3 - a2 * c3) + t2 * (c3 * a1 - a3 * c1) + t3 * y12) / det
                z = (t1 * (a2 * b3 - b2 * a3) + t2 * (a3 * b1 - b3 * a1) + t3 * z12) / det
                if all(n[0] * x + n[1] * y + n[2] * z <= t + SUR_LE_PLAN for n, t in plans):
                    sommets.setdefault((round(x / SUR_LE_PLAN), round(y / SUR_LE_PLAN), round(z / SUR_LE_PLAN)), (x, y, z))
    points = list(sommets.values())
    faces = []
    for n, t in plans:
        tour = [i for i, q in enumerate(points) if abs(scalaire(n, q) - t) <= 2 * SUR_LE_PLAN]
        if len(tour) < 3:
            continue
        milieu = tuple(sum(points[i][k] for i in tour) / len(tour) for k in range(3))
        u = unitaire(somme(points[tour[0]], milieu, -1))
        v = vectoriel(n, u)

        def angle(i):
            """Un nombre croissant avec l'angle du sommet `i` autour de `milieu`, sans fonction trigonométrique."""
            d = somme(points[i], milieu, -1)
            x, y = scalaire(d, u), scalaire(d, v)
            part = x / (abs(x) + abs(y))
            return 1 - part if y >= 0 else 3 + part
        tour.sort(key=angle)
        aire = (0.0, 0.0, 0.0)
        for i, k in zip(tour, tour[1:] + tour[:1]):
            aire = somme(aire, vectoriel(somme(points[i], milieu, -1), somme(points[k], milieu, -1)))
        if norme(aire) > SUR_LE_PLAN:
            faces.append(tour)
    return points, faces


def eclat(m, G, centre, demi, T, retrait, a, plans=()):
    """Un éclat de roche dans l'ellipsoïde (`centre`, `demi`), à la taille `T` (`TAILLES`) : le polyèdre de ses pans
    tirés autour des directions d'`ICOSAEDRE`, de ses `plans` nommés (normale, distance) et de ses écailles, chacune un
    plan qui lui enlève un coin, dans les faces de l'enveloppe de `G` à `retrait` ; en bancs empilés, chacun en retrait,
    s'il a des strates. Pans et distances se donnent dans l'espace où l'ellipsoïde est la sphère unité, la normale d'un
    plan nommé dans le repère du décor."""
    centre = tuple(G.rentrer([centre], retrait + min(demi) * T["ancrage"])[0])
    pans = []
    for d in ICOSAEDRE:
        u = somme(d, direction(a), T["jeu"])
        pans.append((unitaire((u[0], u[1], u[2] * T["aplomb"] + T["fruit"])), a.uniform(*T["coupe"])))
    pans += [(unitaire(produit(n, demi)), t) for n, t in plans]
    limites = [(n, T["arrondi"]) for n in CUBE]
    for n, b in zip(G.normales.tolist(), G.bornes.tolist()):
        etire = produit(n, demi)
        t = (b - retrait - scalaire(n, centre)) / norme(etire)
        if t < T["arrondi"] * 3 ** 0.5:
            limites.append((unitaire(etire), t))
    nombre, profondeurs = T["ecailles"]
    if nombre:
        brut, _ = polyedre(pans + limites)
        for _ in range(nombre):
            u = direction(a)
            pans.append((u, max(scalaire(u, q) for q in brut) * (1 - a.uniform(*profondeurs))))
    bancs = [(1.0, [])]
    if T["strates"]:
        epaisseur, rentrant, pendage, chevauchement, mince = T["strates"]
        lit = unitaire((pendage * a.uniform(-1, 1), pendage * a.uniform(-1, 1), 1.0))
        bas = -T["arrondi"] * 3 ** 0.5 - a.random() * epaisseur
        bancs = [(1 - a.uniform(0, rentrant), [(lit, bas + (k + 1) * epaisseur), (somme((0.0, 0.0, 0.0), lit, -1), -bas - (k - chevauchement) * epaisseur)])
                 for k in range(math.ceil(2 * T["arrondi"] * 3 ** 0.5 / epaisseur) + 1)]
    for part, lits in bancs:
        sommets, faces = polyedre([(n, t * part) for n, t in pans] + limites + lits)
        if faces and (not lits or max(scalaire(lit, q) for q in sommets) - min(scalaire(lit, q) for q in sommets) > mince * epaisseur):
            m.ajouter([somme(centre, produit(demi, q)) for q in sommets], faces, MAT)


def repere(devers, a):
    """Un repère orthonormé tiré, sans fonction trigonométrique : son troisième axe à `devers` de la verticale."""
    w = unitaire((devers * a.uniform(-1, 1), devers * a.uniform(-1, 1), 1.0))
    r = direction(a)
    u = unitaire(somme(r, w, -scalaire(r, w)))
    return u, vectoriel(w, u), w


def moellon(m, centre, demi, axes, jeu, a):
    """Un moellon : le pavé de demi-côtés `demi` sur les `axes`, chaque coin écarté d'au plus `jeu` de son demi-côté."""
    sommets = []
    for sx, sy, sz in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)):
        p = centre
        for s, e, axe in zip((sx, sy, sz), demi, axes):
            p = somme(p, axe, s * e * (1 + a.uniform(-jeu, jeu)))
        sommets.append(p)
    m.ajouter(sommets, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], MAT)


def colonne(m, pied, profil, C, a):
    """Une colonne de concrétion dressée sur `pied`, de rayon `profil` [(hauteur, rayon)] interpolé, d'après `C`
    (`CONCRETION`) : des bourrelets empilés, chacun sa lèvre en surplomb du précédent, cannelés, désaxés, leurs joints
    en dévers, puis la pointe."""
    k = C["cotes"]
    sommet = profil[-1][0]
    tour = a.uniform(0, 2 * math.pi)
    rayons = [(math.cos(tour + 2 * math.pi * j / k), math.sin(tour + 2 * math.pi * j / k), 0.0) for j in range(k)]
    cannelures = [a.uniform(-C["cannelures"], C["cannelures"]) for _ in range(k)]
    anneaux, z, dessus = [], profil[0][0], (0.0, 0.0, 0.0)
    fin = sommet - C["pointe"] * (sommet - z)
    while z < fin:
        haut = min(z + a.uniform(*C["bourrelet"]) * profil[0][1], fin)
        saillie = a.uniform(*C["saillie"])
        axe = (pied[0] + a.uniform(-C["desaxe"], C["desaxe"]) * lineaire(profil, z), pied[1] + a.uniform(-C["desaxe"], C["desaxe"]) * lineaire(profil, z))
        propres = [a.uniform(-C["cannelures"], C["cannelures"]) * C["propre"] for _ in range(k)]
        dessous, dessus = dessus, (a.uniform(-C["pente"], C["pente"]), a.uniform(-C["pente"], C["pente"]), 0.0)
        for part, gonfle in C["galbe"]:
            h = z + (haut - z) * part
            pied_evase = 1 + C["evasement"][0] * math.exp(-(h - profil[0][0]) / (C["evasement"][1] * profil[0][1]))
            anneau = []
            for j, d in enumerate(rayons):
                r = lineaire(profil, h) * pied_evase * (1 + saillie * gonfle + cannelures[j] + propres[j] + a.uniform(-C["grain"], C["grain"]))
                anneau.append((axe[0] + d[0] * r, axe[1] + d[1] * r, h + r * scalaire(d, somme(produit(dessous, (1 - part,) * 3), dessus, part))))
            anneaux.append(anneau)
        z = haut
    coque(m, anneaux, MAT, (pied[0], pied[1], sommet))


def concretion(m, G, K, C, a):
    """La concrétion `K` (`CONCRETIONS`) : la colonne que portent ses primitives empilées, son rayon la `part` du leur à
    mi-hauteur de chacune, nul au sommet de la dernière ; ses bosses, des colonnes basses à son pied (azimut en degrés,
    distance, rayon et hauteur en fractions du rayon de sa première primitive)."""
    boites = [boite(G.primitives[i]) for i in K["primitives"]]
    (centre, demi), (dernier, demi_du_dernier) = boites[0], boites[-1]
    profil = [(centre[2] - demi[2], demi[0] * K["part"])] + [(c[2], e[0] * K["part"]) for c, e in boites] + [(dernier[2] + demi_du_dernier[2], 0.0)]
    colonne(m, centre, profil, C, a)
    for azimut, distance, rayon, hauteur in K["bosses"]:
        pied = somme(centre, (math.cos(math.radians(azimut)), math.sin(math.radians(azimut)), 0.0), distance * demi[0])
        base = centre[2] - demi[2]
        colonne(m, pied, [(base, rayon * demi[0]), (base + hauteur * demi[0] / 2, rayon * demi[0] * K["taille_de_bosse"]), (base + hauteur * demi[0], 0.0)], C, a)


def dans_le_disque(a):
    """Un point tiré dans le disque unité, par rejet dans le carré."""
    while True:
        u, v = a.uniform(-1, 1), a.uniform(-1, 1)
        if u * u + v * v <= 1:
            return u, v


def tas(m, G, T, D, a):
    """Le tas `T` (`TAS`) que porte une primitive : du sol à son dessus, sur son emprise élargie d'`etale`, un cœur, puis
    sur sa pente (celle de l'ellipsoïde du cœur, le `niveau` tiré sous elle, le sol au-delà) ses pierres et ses moellons."""
    centre, demi = boite(G.primitives[T["porte"]])
    rx, ry = demi[0] * T["etale"], demi[1] * T["etale"]
    petit = min(demi[0], demi[1])
    part_large, part_haute = T["coeur"]
    haut = (centre[2] + demi[2]) * part_haute
    eclat(m, G, (centre[0], centre[1], 0.0), (rx * part_large, ry * part_large, haut), D["TAILLES"][T["taille_du_coeur"]], D["RETRAIT"], a)

    def sur_la_pente(hauteur):
        u, v = dans_le_disque(a)
        z = haut * math.sqrt(max(0.0, 1 - (u * u + v * v) / part_large ** 2)) * a.uniform(*T["niveau"])
        return (centre[0] + rx * u, centre[1] + ry * v, max(z, hauteur))

    for nombre, tailles, taille_de_pierre in T["pierres"]:
        for _ in range(nombre):
            taille = petit * a.uniform(*tailles)
            e = tuple(taille * a.uniform(*f) for f in D["PIERRE"])
            eclat(m, G, sur_la_pente(e[2] / 2), e, D["TAILLES"][taille_de_pierre], D["RETRAIT"], a)
    devers, jeu, formes = D["MOELLON"]
    for _ in range(T["moellons"]):
        taille = petit * a.uniform(*T["tailles_des_moellons"])
        e = tuple(taille * a.uniform(*f) for f in formes)
        moellon(m, sur_la_pente(e[2]), e, repere(devers, a), jeu, a)


def construire(D, id_):
    G, a = Gabarit(id_), alea(id_)
    mats = habillage.materiaux(D["MATERIAUX"][id_])
    m = Maille([mats[MAT]])
    for B in D["BLOCS"].get(id_, ()):
        centre, demi = dans(G.primitives[B["porte"]], B["centre"], B["demi"])
        eclat(m, G, centre, demi, D["TAILLES"][B["taille"]], D["RETRAIT"], a, B.get("plans", ()))
    for K in D["CONCRETIONS"].get(id_, ()):
        concretion(m, G, K, D["CONCRETION"], a)
    for T in D["TAS"].get(id_, ()):
        tas(m, G, T, D, a)
    m.v = [tuple(p) for p in G.rentrer(m.v, D["RETRAIT"])]
    roche = objet(MAT, m, (0.0, 0.0, 0.0), D["ANGLE_LISSE"][id_])
    if len(roche.data.polygons) > D["BUDGET_TRIANGLES"][id_]:
        raise ValueError(f"{id_} : {len(roche.data.polygons)} triangles, budget {D['BUDGET_TRIANGLES'][id_]}")
    return {}


def elements(D):
    return geometrie.elements(D, DECORS, construire)
