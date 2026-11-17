"""La statuaire (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave`, `geometrie.rond`, `geometrie.bouts`, `geometrie.rampant`) et
où `Gabarit.rentrer` ramène le sommet qui en sortirait. Chaque pièce est une coque close : un volume modelé, ses
anneaux horizontaux gonflés ou creusés par des reliefs (`modelee`) ; un membre, ses sections ovales le long d'un chemin
lissé (`membre`) ; un corps de socle mouluré, une étoffe froncée, une pièce tournée, une pièce profilée, une pièce plate
découpée, une pièce ronde courbée, ceux de `geometrie` ; un tour, un tore et un tube de `maille`. Chaque matériau du
décor est un nœud à son nom. L'aléa est semé des codes de caractères de l'id du décor : deux constructions rendent les
mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (AXES, COTES, CYLINDRE, FRONT, HAUT, X, Y, apotheme, bosselee, bouts, cap, coque, courbee,
                       decoupee, froncee, lisse, pave, profile, rampant, rond, tourne, tournee)
from gabarit import boite
from maille import lineaire, tore, tour, tube

DECORS = ("statue", "gargouille", "idole-chaos", "urne", "oeuf-dragon", "crane-monstre", "trophee-cranes", "ossements")


def cadre(primitive, cote):
    """La fonction qui rend le point de position `(x, y, z)` dans la boîte de `primitive`, comptée en demi-côtés depuis
    son centre : `x` du côté `cote` (-1 ou 1), `y` vers le front, `z` vers le haut."""
    c, (lx, ly, lz) = pave(primitive)
    return lambda p: c + X * (cote * p[0] * lx / 2) + FRONT * (p[1] * ly / 2) + HAUT * (p[2] * lz / 2)


def pose(primitive, cote, stations):
    """Les points et les rayons d'un membre (`membre`) de `stations` [(position dans la boîte de `primitive`, du côté
    `cote` (`cadre`), rayon sur le travers, rayon en travers de lui)], ces rayons en fractions du demi-côté x de la
    boîte."""
    lieu = cadre(primitive, cote)
    _, (lx, _, _) = pave(primitive)
    return [lieu(p) for p, _, _ in stations], [(lx / 2 * du, lx / 2 * dv) for _, du, dv in stations]


def membre(m, points, rayons, travers, taille, mat, pointe=False, assise=None):
    """Un membre le long de la courbe lissée par `points` (`geometrie.lisse`), ses sections ovales de `rayons` [(sur
    `travers`, ramené dans le plan normal au fil ; en travers de lui)], lissés de même ; `taille` : côtés d'une
    section, points par tronçon. Fermé à plat à ses deux bouts, ou, `pointe`, en cône vers son dernier point.
    `assise` : la hauteur où repose sa première section, déplacée pour cela à la verticale."""
    cotes, pas = taille
    chemin = lisse(points, pas)
    sections = lisse([Vector((du, dv, 0)) for du, dv in rayons], pas)
    dernier = len(chemin) - 1
    anneaux = []
    for i, (p, s) in enumerate(zip(chemin, sections)):
        fil = (chemin[min(i + 1, dernier)] - chemin[max(i - 1, 0)]).normalized()
        u = (travers - fil * travers.dot(fil)).normalized()
        v = fil.cross(u)
        angles = [2 * math.pi * j / cotes for j in range(cotes)]
        anneaux.append([p + u * (s.x * math.cos(t)) + v * (s.y * math.sin(t)) for t in angles])
    if assise is not None:
        anneaux[0] = [p + HAUT * (assise - min(q.z for q in anneaux[0])) for p in anneaux[0]]
    if pointe:
        coque(m, anneaux[:-1], mat, chemin[-1])
    else:
        coque(m, anneaux, mat)


def modelee(m, centre, demi, F, mat):
    """Un volume modelé autour de la verticale de `centre`, dans la boîte de demi-côtés `demi` (x, y, z), d'après
    `F` : `profil` [(hauteur en demi-hauteurs depuis `centre`, part des demi-côtés que garde son anneau ovale)], du bas
    en haut ; `sommet`, la hauteur de sa pointe ; `cotes` sommets par anneau, serrés vers le front de l'exposant
    `resserre` ; `reliefs` [(azimut, hauteur, demi-largeur en degrés, demi-hauteur, part)] : chacun gonfle le rayon
    de `part` en son milieu, ou le creuse si elle est négative, jusqu'à rien à son bord. Rend la fonction du point de
    sa surface à un azimut (degrés) et une hauteur, déplacé de `saillie` (m) vers le dehors."""
    centre = Vector(centre)
    dx, dy, dz = demi
    travers = FRONT.cross(HAUT)

    def surface(azimut, hauteur, saillie=0.0):
        part = lineaire(F["profil"], hauteur)
        for milieu, h, large, haut, relief in F["reliefs"]:
            ea, eh = (abs(azimut) - milieu) / large, (hauteur - h) / haut
            if abs(ea) < 1 and abs(eh) < 1:
                part *= 1 + relief * (math.cos(math.pi * ea / 2) * math.cos(math.pi * eh / 2)) ** 2
        t = math.radians(azimut)
        return (centre + FRONT * (math.cos(t) * (dy * part + saillie)) + travers * (math.sin(t) * (dx * part + saillie))
                + HAUT * (dz * hauteur))

    tours = [2 * j / F["cotes"] - 1 for j in range(F["cotes"])]
    azimuts = [180 * math.copysign(abs(s) ** F["resserre"], s) for s in tours]
    coque(m, [[surface(az, h) for az in azimuts] for h, _ in F["profil"]], mat, centre + HAUT * (dz * F["sommet"]))
    return surface


def corne(pieces, G, rangs, K):
    """Une corne d'os le long des deux cylindres de rangs `rangs` de la recette, le couché puis le dressé, d'après
    `K` : de sa racine, prolongée de la part `ancrage` de la longueur du couché dans ce qui la porte, par la part
    `coude` du couché et la part `montee` du dressé, à sa pointe, au bout du dressé ; ses `rayons` en parts du plus
    petit de leurs deux apothèmes."""
    couche, dresse = (G.primitives[rang] for rang in rangs)
    centre, _, _ = rond(dresse)
    racine, coude = sorted(bouts(couche)[:2], key=lambda p: -(p - centre).length)
    pied, cime = sorted(bouts(dresse)[:2], key=lambda p: (p - coude).length)
    rayon = min(apotheme(couche), apotheme(dresse))
    points = [racine + (racine - coude) * K["ancrage"], racine.lerp(coude, K["coude"]), pied.lerp(cime, K["montee"]),
              cime]
    membre(pieces["os"], points, [(rayon * part, rayon * part) for part in K["rayons"]],
           (coude - racine).cross(cime - pied).normalized(), K["taille"], "os", True)


def crane(pieces, G, rangs, C):
    """Un crâne dans les primitives de rangs `rangs` (voûte, mâchoire, les deux orbites) de la recette, tourné vers le
    front, d'après `C` (`CRANE`) : la voûte, ses orbites creusées là où la recette pose ses ombres et sa cavité
    nasale ; au fond de chaque creux, une ombre en cône bas ; la mâchoire et ses dents."""
    voute, machoire, orbites = rangs
    os, ombre = pieces["os"], pieces["ombre"]
    centre, (lx, ly, lz) = pave(G.primitives[voute])
    yeux = [pave(G.primitives[rang]) for rang in orbites]
    oeil, (ox, _, oz) = yeux[0]
    large, haute, creux = C["orbite"]
    azimut = math.degrees(math.atan2(sum(abs(o.x - centre.x) for o, _ in yeux) / len(yeux), ly / 2))
    orbite = (azimut, (oeil.z - centre.z) / (lz / 2), math.degrees(math.atan2(ox / 2, ly / 2)) * large,
              oz / lz * haute, -creux)
    hauteur, demi_large, demi_haut, fond = C["nez"]
    nez = (0, hauteur, demi_large, demi_haut, -fond)
    surface = modelee(os, centre, (lx / 2, ly / 2, lz / 2),
                      {**C["voute"], "reliefs": C["voute"]["reliefs"] + (orbite, nez)}, "os")
    garde, enfonce, remonte, cotes = C["ombre"]
    for signe, (milieu, h, l_az, l_h, relief) in ((-1, orbite), (1, orbite), (1, nez)):
        prof = -relief * ly / 2
        angles = [2 * math.pi * j / cotes for j in range(cotes)]
        coque(ombre, [[surface(signe * milieu + l_az * garde * math.cos(t), h + l_h * garde * math.sin(t),
                               -prof * enfonce) for t in angles]], "ombre", surface(signe * milieu, h, prof * remonte))

    cm, (mx, my, mz) = pave(G.primitives[machoire])
    gencive = modelee(os, cm, (mx / 2, my / 2, mz / 2), C["machoire"], "os")
    T = C["dents"]
    dedans, dehors = -my / 2 * T["enfonce"], my / 2 * T["saillie"]
    for az in T["azimuts"]:
        coque(os, [[gencive(az + s * T["demi"], T["collet"], e)
                    for s, e in ((-1, dedans), (1, dedans), (1, dehors), (-1, dehors))]], "os",
              gencive(az, T["pointe"], dehors))


def statue(D, G, pieces, a):
    """Une statue d'après `STATUE` : socle à deux corps, figure drapée, tête barbue, un bras replié sur la poitrine,
    l'autre levé sur un marteau de guerre."""
    S, marbre = D["STATUE"], pieces["marbre"]
    for rang, profil in S["socle"]:
        profile(pieces["pierre"], G.primitives[rang], "h", profil, "pierre")
    corps = G.primitives[S["corps"]]
    c, _ = pave(corps)
    R = S["robe"]
    pentes = [rampant(G.primitives[rang]) for rang in S["jupe"]]
    stations = []
    for t, large, profond, creux in R["jupe"]:
        gauche, droit, devant, dos = (egout.lerp(crete, t) for _, crete, egout, _, _ in pentes)
        stations.append(((gauche + droit + devant + dos) / 4,
                         ((droit - gauche).length / 2 * large, (dos - devant).length / 2 * profond), creux))
    for nom, t, large, profond, creux in R["coupe"]:
        p, (lx, ly, lz) = pave(G.primitives[S[nom]])
        stations.append((p + HAUT * (lz * (t - 1 / 2)), (lx / 2 * large, ly / 2 * profond), creux))
    e, (_, _, ez) = pave(G.primitives[S["epaules"]])
    froncee(marbre, stations, R["plis"], R["pas"], a, "marbre", e + HAUT * (ez * (R["pointe"] - 1 / 2)))

    cou, (kx, _, kz) = pave(G.primitives[S["cou"]])
    depasse, part, cotes = S["cou_tourne"]
    tournee(marbre, cou - HAUT * (kz / 2 + kz * depasse), cou + HAUT * (kz / 2 + kz * depasse), X, Y, kx / 2 * part,
            CYLINDRE, cotes, "marbre")
    tete = G.primitives[S["tete"]]
    modelee(marbre, *boite(tete), S["visage"], "marbre")
    _, (tx, _, _) = pave(tete)
    lieu, B = cadre(tete, 1), S["barbe"]
    froncee(marbre, [(lieu(p), (tx / 2 * du, tx / 2 * dv), creux) for p, du, dv, creux in B["stations"]], B["plis"],
            B["pas"], a, "marbre", lieu(B["pointe"]))

    bras = G.primitives[S["bras"]]
    b, _ = pave(bras)
    membre(marbre, *pose(bras, 1, S["bras_leve"]["stations"]), FRONT, S["bras_leve"]["taille"], "marbre")
    membre(marbre, *pose(corps, -math.copysign(1, b.x - c.x), S["bras_replie"]["stations"]), X,
           S["bras_replie"]["taille"], "marbre")

    M = S["marteau"]
    h, (hx, _, hz) = pave(G.primitives[S["manche"]])
    tournee(marbre, h - HAUT * (hz / 2 + hz * M["pommeau"]), h + HAUT * (hz / 2 + hz * M["emmanche"]), X, Y, hx / 2,
            M["manche"], M["cotes"], "marbre")
    profile(marbre, G.primitives[S["masse"]], "y", M["tete"], "marbre")


def gargouille(D, G, pieces, a):
    """Une gargouille d'après `GARGOUILLE` : pilier mouluré, bête accroupie (échine, pattes, griffes, gueule, cornes),
    deux ailes à demi ouvertes."""
    Ga, m = D["GARGOUILLE"], pieces["sculpture"]
    _, dessus = profile(pieces["pierre"], G.primitives[Ga["pilier"]], "h", Ga["pilier_profil"], "pierre")
    corps = G.primitives[Ga["corps"]]
    membre(m, *pose(corps, 1, Ga["echine"]["stations"]), X, Ga["echine"]["taille"], "sculpture", assise=dessus.z)
    for cote in COTES:
        for patte in Ga["pattes"]:
            membre(m, *pose(corps, cote, patte["stations"]), X, patte["taille"], "sculpture")
        for griffe in Ga["griffes"]["doigts"]:
            points, rayons = pose(corps, cote, [((x, y, 0.0), du, dv) for (x, y), du, dv in griffe])
            membre(m, [Vector((p.x, p.y, dessus.z + dv)) for p, (_, dv) in zip(points, rayons)], rayons, X,
                   Ga["griffes"]["taille"], "sculpture", True)
    tete = G.primitives[Ga["tete"]]
    modelee(m, *boite(tete), Ga["gueule"], "sculpture")
    milieu, _ = pave(tete)
    for rang in Ga["cornes"]:
        p = G.primitives[rang]
        membre(m, *pose(p, math.copysign(1, pave(p)[0].x - milieu.x), Ga["corne"]["stations"]), FRONT,
               Ga["corne"]["taille"], "sculpture", True)

    A = Ga["aile"]
    for rang in Ga["ailes"]:
        descend, crete, egout, _, large = rampant(G.primitives[rang])
        pente = egout - crete
        n = pente.cross(FRONT).normalized()
        n *= math.copysign(1, n.z)
        ame = crete - n * (large * (A["sous"] + A["epais"] / 2))
        decoupee(m, [crete + FRONT * (large * u) + pente * v for u, v in A["voile"]], n,
                 (-large * (A["sous"] + A["epais"]), -large * A["sous"]), large * A["arete"], "sculpture")
        for doigt in A["doigts"]["chemins"]:
            membre(m, [ame + FRONT * (large * u) + pente * v for (u, v), _, _ in doigt],
                   [(large * du, large * dv) for _, du, dv in doigt], n, A["doigts"]["taille"], "sculpture", True)
        lieu = cadre(corps, math.copysign(1, descend.x))
        B, Do = A["bras"], A["dos"]
        large_p, pente_p = B["poignet"]
        membre(m, [lieu(B["epaule"]), ame + FRONT * (large * large_p) + pente * pente_p],
               [(large * du, large * dv) for du, dv in B["rayons"]], FRONT, B["taille"], "sculpture")
        contour = [ame + FRONT * (large * u) + pente * v for u, v in Do["faite"]] + [lieu(p) for p in Do["attache"]]
        decoupee(m, contour, (contour[0] - contour[3]).cross(contour[1] - contour[0]).normalized(),
                 (-large * Do["epais"] / 2, large * Do["epais"] / 2), large * A["arete"], "sculpture")


def idole(D, G, pieces, a):
    """Une idole du Chaos d'après `IDOLE` : emmarchement, piédestal, colosse (jambes, pagne, torse, cou, bras et
    griffes, tête), bandeau de rune, cornes d'os."""
    Id, m = D["IDOLE"], pieces["chaos"]
    profile(pieces["pierre"], G.primitives[Id["marches"]], "h", Id["emmarchement"], "pierre")
    profile(m, G.primitives[Id["piedestal"]], "h", D["DE"], "chaos")
    corps = G.primitives[Id["corps"]]
    c, (lx, ly, lz) = pave(corps)
    lieu = cadre(corps, 1)
    for cote in COTES:
        membre(m, *pose(corps, cote, Id["jambe"]["stations"]), X, Id["jambe"]["taille"], "chaos")
    Pa, To = Id["pagne"], Id["torse"]
    froncee(m, [(lieu(p), (lx / 2 * du, ly / 2 * dv), creux) for p, du, dv, creux in Pa["stations"]], Pa["plis"],
            Pa["pas"], a, "chaos")
    fx, fy, fz = To["demi"]
    modelee(m, lieu(To["centre"]), (lx / 2 * fx, ly / 2 * fy, lz / 2 * fz), To["forme"], "chaos")
    pied, tete_du_cou, part, cotes, trapezes = Id["cou"]
    tournee(m, lieu((0, 0, pied)), lieu((0, 0, tete_du_cou)), X, Y, ly / 2 * part, trapezes, cotes, "chaos")
    for rang in Id["bras"]:
        p = G.primitives[rang]
        cote = math.copysign(1, pave(p)[0].x - c.x)
        membre(m, *pose(p, cote, Id["bras_pendant"]["stations"]), FRONT, Id["bras_pendant"]["taille"], "chaos")
        for griffe in Id["griffes"]["doigts"]:
            membre(m, *pose(p, cote, griffe), FRONT, Id["griffes"]["taille"], "chaos", True)

    tete = G.primitives[Id["tete"]]
    surface = modelee(m, *boite(tete), Id["face"], "chaos")
    t, (_, ty, tz) = pave(tete)
    r, (rx, ry, rz) = pave(G.primitives[Id["rune"]])
    arc, fond, saillie = Id["bandeau"]
    ouverture, milieu, demi = math.degrees(math.atan2(rx / 2, ty / 2)), (r.z - t.z) / (tz / 2), rz / tz
    coque(pieces["rune"], [[surface(az, h, e) for h, e in ((milieu - demi, -ry * fond), (milieu + demi, -ry * fond),
                                                            (milieu + demi, ry * saillie),
                                                            (milieu - demi, ry * saillie))]
                           for az in (ouverture * (2 * k / arc - 1) for k in range(arc + 1))], "rune")
    for rangs in Id["cornes"]:
        corne(pieces, G, rangs, Id["corne"])
    for cote in COTES:
        membre(pieces["os"], *pose(tete, cote, Id["defenses"]["stations"]), X, Id["defenses"]["taille"], "os", True)


def urne(D, G, pieces, a):
    """Une urne funéraire d'après `URNE` : socle à deux corps, panse à godrons, épaule, col, couvercle et bouton
    tournés, deux anses."""
    U, marbre = D["URNE"], pieces["marbre"]
    for rang, profil in U["socle"]:
        profile(pieces["pierre"], G.primitives[rang], "h", profil, "pierre")
    panse = G.primitives[U["panse"]]
    c, _, h = rond(panse)
    rayon, Go = apotheme(panse), U["godrons"]
    froncee(marbre, [(c + HAUT * (h * (t - 1 / 2)), (rayon * part, rayon * part), creux)
                     for t, part, creux in Go["stations"]], Go["plis"], Go["pas"], a, "marbre")
    for rang, profil in U["tournes"]:
        tourne(marbre, G.primitives[rang], profil, U["cotes"], "marbre")
    for rang in U["anses"]:
        p = G.primitives[rang]
        membre(marbre, *pose(p, math.copysign(1, pave(p)[0].x - c.x), U["anse"]["stations"]), FRONT,
               U["anse"]["taille"], "marbre")


def oeuf(D, G, pieces, a):
    """Un œuf de dragon d'après `OEUF` : nid de paille, son bourrelet et ses brins ; œuf, ses rangs d'écailles."""
    O, paille, ecaille = D["OEUF"], pieces["paille"], pieces["ecaille"]
    nid = G.primitives[O["nid"]]
    centre, _, haut = rond(nid)
    sol, rayon = centre - HAUT * (haut / 2), apotheme(nid)
    tour(paille, [(haut * h, rayon * r) for h, r in O["flanc"]] + [(haut * h, rayon * r) for r, h in O["dessus"]],
         AXES[nid["axis"]][0], tuple(sol), O["segments"], "paille")
    B, dessus = O["brins"], O["dessus"][::-1]
    for _ in range(B["nombre"]):
        depart, arc = a.uniform(0, 360), a.uniform(*B["arc"])
        r0, r1 = a.uniform(*B["rayon"]), a.uniform(*B["rayon"])
        parts = [r0 + (r1 - r0) * k / B["troncons"] for k in range(B["troncons"] + 1)]
        gros = rayon * a.uniform(*B["grosseur"])
        courbee(paille, [sol + cap(depart + arc * k / B["troncons"]) * (rayon * part)
                         + HAUT * (haut * lineaire(dessus, part)) for k, part in enumerate(parts)], HAUT, (gros, gros),
                B["cotes"], "paille")

    K = O["coquille"]
    cylindres = [G.primitives[rang] for rang in O["oeuf"]]
    bas, cime = bouts(cylindres[0])[0], bouts(cylindres[-1])[1]
    profil = lisse([Vector((0, 0, bas.z))] + [Vector((apotheme(p) * part, 0, rond(p)[0].z))
                                              for p, part in zip(cylindres, K["parts"])]
                   + [Vector((0, 0, cime.z))], K["pas"])
    tour(ecaille, [(p.z - bas.z, p.x) for p in profil], AXES[cylindres[0]["axis"]][0], tuple(bas), K["segments"],
         "ecaille")
    galbe = [(p.z, p.x) for p in profil]
    E = O["ecailles"]
    bas_des_rangs, haut_des_rangs = E["hauteurs"]
    hauteur = cime.z - bas.z
    for rang in range(E["rangs"]):
        z = bas.z + hauteur * (bas_des_rangs + (haut_des_rangs - bas_des_rangs) * rang / (E["rangs"] - 1))
        r = lineaire(galbe, z)
        nombre = round(math.pi * r / (hauteur * E["demi"]))
        demi = math.pi * r / nombre
        pente = (lineaire(galbe, z + demi) - lineaire(galbe, z - demi)) / (2 * demi)
        for k in range(nombre):
            dehors = cap(360 * (k + rang % 2 / 2) / nombre)
            travers = HAUT.cross(dehors)
            monte = (HAUT + dehors * pente).normalized()
            n = travers.cross(monte)
            p = Vector((bas.x, bas.y, z)) + dehors * r
            fond = p - n * (demi * E["enfonce"])
            coque(ecaille, [[fond + monte * (demi * E["haut"]), fond + travers * demi,
                             fond - monte * (demi * E["haut"]), fond - travers * demi]], "ecaille",
                  p + n * (demi * E["saillie"]) - monte * (demi * E["descend"]))


def crane_monstre(D, G, pieces, a):
    """Un crâne de monstre d'après `CRANE_MONSTRE` : crâne (`crane`), deux cornes, deux paires de crocs."""
    K, os = D["CRANE_MONSTRE"], pieces["os"]
    crane(pieces, G, K["crane"], D["GRAND_CRANE"])
    for rangs in K["cornes"]:
        corne(pieces, G, rangs, K["corne"])
    for cote in COTES:
        for croc in K["crocs"]["dents"]:
            membre(os, *pose(G.primitives[K["dents"]], cote, croc), X, K["crocs"]["taille"], "os", True)


def trophee(D, G, pieces, a):
    """Un trophée de crânes d'après `TROPHEE` : pierre de calage, pieu, traverse, quatre crânes (`crane`), les deux
    pendus à leur corde."""
    T, bois, corde = D["TROPHEE"], pieces["bois"], pieces["corde"]
    pierre, Ca = G.primitives[T["pierre"]], T["calage"]
    c, _, h = rond(pierre)
    section = bosselee(a, X, Y, Ca["cotes"], Ca["bosse"])
    coque(pieces["pierre"], [section(tuple(c + HAUT * (h * (t - 1 / 2))), apotheme(pierre) * part)
                             for t, part in Ca["anneaux"]], "pierre")
    for rangs in T["cranes"]:
        crane(pieces, G, rangs, D["CRANE"])
    voutes = [pave(G.primitives[voute]) for voute, _, _ in T["cranes"]]
    pieu = G.primitives[T["pieu"]]
    pied, tete, u, w, _ = bouts(pieu)
    profil, cotes = T["fut"]
    tournee(bois, pied, Vector((tete.x, tete.y, voutes[0][0].z)), u, w, apotheme(pieu), profil, cotes, "bois")
    traverse = G.primitives[T["traverse"]]
    gauche, droite, u, w, _ = bouts(traverse)
    part, cotes = T["barre"]
    tournee(bois, gauche, droite, u, w, apotheme(traverse) * part, CYLINDRE, cotes, "bois")
    Co = T["corde"]
    axe, fil = AXES[traverse["axis"]]
    brin = apotheme(traverse) * Co["brin"]
    for rang in T["pendus"]:
        v, (_, _, vz) = voutes[rang]
        noeud = gauche + fil * (v - gauche).dot(fil)
        tore(corde, axe, tuple(noeud), apotheme(traverse) * part + brin, brin, *Co["segments"], "corde")
        tube(corde, [noeud, v + HAUT * (vz / 2 * (1 - Co["ancrage"]))], brin, Co["segments"][1], "corde")


def ossements(D, G, pieces, a):
    """Un tas d'ossements d'après `OSSEMENTS` : quatre os longs, un crâne (`crane`), une file de vertèbres et ses
    côtes."""
    O, os = D["OSSEMENTS"], pieces["os"]
    for rang, profil in O["os"]:
        p = G.primitives[rang]
        bout, autre, u, w, rayon = bouts(p)
        tournee(os, bout, autre, u, w, rayon, profil, p["sides"], "os")
    crane(pieces, G, O["crane"], D["CRANE"])

    c, (lx, ly, lz) = pave(G.primitives[O["cage"]])
    long, court = (X, FRONT) if lx > ly else (FRONT, X)
    nombre, vertebre, part, cotes = O["vertebres"]
    rayon, demi = lz / 2 * part, max(lx, ly) / 2
    file_ = Vector((c.x, c.y, c.z - lz / 2 + rayon))
    tournee(os, file_ - long * demi, file_ + long * demi, HAUT, long.cross(HAUT), rayon,
            [((k + t) / nombre, r) for k in range(nombre) for t, r in vertebre], cotes, "os")
    K = O["cotes"]
    for k in range(nombre):
        pied = Vector((c.x, c.y, c.z - lz / 2)) + long * (demi * ((2 * k + 1) / nombre - 1))
        fleche = G.portee(pied, HAUT, D["RETRAIT"]) * K["fleche"]
        for cote in COTES:
            membre(os, [pied + court * (cote * min(lx, ly) / 2 * ecart) + HAUT * (fleche * haut + rayon * r)
                        for ecart, haut, r in K["stations"]],
                   [(rayon * r, rayon * r) for _, _, r in K["stations"]], long, K["taille"], "os", assise=pied.z)


BATIR = {"statue": statue, "gargouille": gargouille, "idole-chaos": idole, "urne": urne, "oeuf-dragon": oeuf,
         "crane-monstre": crane_monstre, "trophee-cranes": trophee, "ossements": ossements}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
