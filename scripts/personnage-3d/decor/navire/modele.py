"""L'accastillage (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène le sommet
qui en sortirait. Chaque pièce est une coque close : une pièce équarrie dressée contre un axe (`console`) ; un anneau
de fer, le tore de `maille` (`anneau_de_fer`) ; une pièce tournée, une planche, une pièce équarrie, une pièce
profilée, une pièce ronde courbée, une cheville et un cercle, ceux de `geometrie` ; une voile ferlée, la coque de ses
sections ovales pendues à la vergue. Chaque matériau du décor est un nœud à son
nom. L'aléa est semé des codes de caractères de l'id du décor : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (AXES, COTES, HAUT, MAT, X, Y, barre, cap, cercle, cheville, coque, courbee, lisse, normales,
                       partage, pave, planche, profilee, rampant, rond, tournee)
from maille import lineaire, tore

DECORS = ("ancre-de-navire", "barre-de-navire", "cabestan", "mat-de-navire", "rouleau-de-cordage", "ecoutille",
          "passerelle-d-embarquement")


def anneau_de_fer(m, axe, centre, rayon, petit, N):
    """Un anneau de fer d'axe `axe` de `maille` autour de `centre`, son dehors au rayon `rayon * N["grand"]`, son fer
    de rayon `petit`, en `N["segments"]` ; rend le rayon de l'axe de son fer."""
    grand = rayon * N["grand"] - petit
    tore(m, axe, tuple(centre), grand, petit, *N["segments"], "fer")
    return grand


def console(m, axe, u, stations, demi, chanfrein):
    """Une pièce équarrie dressée contre l'axe vertical par `axe`, vers `u` unitaire et horizontal : ses sections
    `stations` [(hauteur, distance à l'axe de sa face du dedans, de sa face du dehors)], de demi-largeur `demi`."""
    barre(m, [(axe + u * ((dedans + dehors) / 2) + HAUT * z, (dehors - dedans) / 2, demi, chanfrein)
              for z, dedans, dehors in stations], u, HAUT.cross(u))


def ancre(D, G, pieces, a):
    """Une ancre à jas d'après `ANCRE` : sole, bras cintrés, pattes, verge, organeau, jas fretté."""
    A, bois, fer = D["ANCRE"], pieces[MAT], pieces["fer"]
    c, (long, large, haut) = pave(G.primitives[A["socle"]])
    S = A["sole"]
    sol = c.z - haut / 2
    dessus = sol + haut * S["hauteur"]
    milieu, portee = Vector((c.x, c.y, (sol + dessus) / 2)), X * (long / 2 * S["longueur"])
    planche(bois, milieu - portee, milieu + portee, Y, HAUT, large / 2 * S["largeur"], (dessus - sol) / 2,
            (dessus - sol) * D["ARETE"])

    axe, r_verge, _ = rond(G.primitives[A["verge"]])
    _, r_bras, _ = rond(G.primitives[A["bras"]])
    B, P = A["courbe"], A["patte"]
    gros, fin = (r_bras * part for part in B["rayons"])
    diamant = Vector((axe.x, axe.y, dessus + gros * B["assise"]))
    e = r_bras * P["epaisseur"]
    for rang in A["pattes"]:
        _, (_, ly, _) = pave(G.primitives[rang])
        descend, crete, _, _, _ = rampant(G.primitives[rang])
        avance, montee = (crete - diamant).dot(descend), crete.z - diamant.z
        chemin = lisse([diamant + descend * (avance * fx) + HAUT * (montee * fz) for fx, fz in B["points"]], B["pas"])
        normale = descend.cross(HAUT)
        courbee(fer, chemin, normale, (gros, fin), B["cotes"], "fer")
        pied = chemin[round(P["pied"] * (len(chemin) - 1))]
        bec = crete.lerp(chemin[-1], P["bec"])
        barre(fer, [(pied.lerp(bec, t), ly / 2 * part, e, min(ly / 2 * part, e) * P["chanfrein"])
                    for t, part in P["profil"]], normale, (bec - pied).normalized().cross(normale), "fer")

    organeau = G.primitives[A["organeau"]]
    centre, r_anneau, epais = rond(organeau)
    grand = anneau_de_fer(fer, AXES[organeau["axis"]][0], centre, r_anneau, epais / 2 * A["anneau"]["petit"],
                          A["anneau"])
    tournee(fer, diamant, Vector((axe.x, axe.y, centre.z - grand)), X, Y, r_verge, A["fut"]["profil"],
            A["fut"]["cotes"], "fer")

    J, jas = A["traverse"], G.primitives[A["jas"]]
    cj, r_jas, l_jas = rond(jas)
    long = AXES[jas["axis"]][1]
    u, v = normales(long)
    bout = cj - long * (l_jas / 2)
    profilee(bois, bout, bout + long * l_jas, (r_jas, r_jas), J["profil"], u=u, v=v)
    cotes_jas = [(t, part_x) for t, part_x, _, _ in J["profil"]]
    part, demi = J["frette"]
    for t in J["frettes"]:
        cote = r_jas * lineaire(cotes_jas, t) * part
        station = bout + long * (l_jas * t)
        barre(fer, [(station + long * (l_jas * demi * s), cote, cote, cote * J["chanfrein"]) for s in COTES], u, v,
              "fer")


def barre_a_roue(D, G, pieces, a):
    """Une barre à roue d'après `BARRE` : colonne, moyeu, jante, rayons et poignées tournés, chevilles."""
    B, bois = D["BARRE"], pieces[MAT]
    c, (lx, ly, lz) = pave(G.primitives[B["socle"]])
    moyeu, jante = G.primitives[B["moyeu"]], G.primitives[B["jante"]]
    cm, r_moyeu, l_moyeu = rond(moyeu)
    cj, r_jante, l_jante = rond(jante)
    _, r_rayon, _ = rond(G.primitives[B["rayon"]])
    axe, essieu = AXES[moyeu["axis"]]
    u, v = geometrie.repere(axe)
    arriere = essieu * math.copysign(1, (c - cm).dot(essieu))

    K = B["colonne"]
    sol, tete = c.z - lz / 2, cm.z + r_moyeu * K["tete"]
    face = cm + arriere * (l_moyeu / 2 - l_moyeu * K["enfonce"])
    aplomb = c + essieu * (face - c).dot(essieu)
    stations = []
    for t, large, profond, chanfrein in K["profil"]:
        du, dv = lx / 2 * large, ly / 2 * profond
        stations.append((Vector((aplomb.x, aplomb.y, sol + (tete - sol) * t)) + arriere * dv, du, dv,
                         min(du, dv) * chanfrein))
    barre(bois, stations, essieu.cross(HAUT), essieu)

    M = B["moyeu_tourne"]
    tournee(pieces["laiton"], cm - arriere * (l_moyeu / 2), cm + arriere * (l_moyeu / 2), u, v, r_moyeu,
            M["profil"], M["cotes"], "laiton")

    J, R = B["roue"], B["rayons"]
    r, h = r_jante * J["rayon"], l_jante * J["epaisseur"]
    cercle(bois, AXES[jante["axis"]][0], tuple(cj), r, h, r_jante * J["largeur"], J["segments"], MAT)
    for k in range(R["nombre"]):
        t = 2 * math.pi * k / R["nombre"]
        d = u * math.cos(t) + v * math.sin(t)
        jante = cj + d * r
        tournee(bois, cj + d * (r_moyeu * R["pied"]), jante, essieu, d.cross(essieu), r_rayon, R["profil"],
                R["cotes"])
        tournee(bois, jante, cj + d * (r_jante * R["portee"]), essieu, d.cross(essieu), r_rayon, R["poignee"],
                R["cotes"])
        cheville(bois, jante - arriere * (h / 2), -arriere, r_rayon * R["cheville"], a)


def cabestan(D, G, pieces, a):
    """Un cabestan d'après `CABESTAN` : embase, mèche et taquets, cloche frettée, barres, chapeau."""
    C, bois, fer = D["CABESTAN"], pieces[MAT], pieces["fer"]
    for rang, forme, m, mat in (("embase", "socle", bois, MAT), ("tete", "cloche", bois, MAT),
                                ("chapeau", "coiffe", fer, "fer")):
        c, r, haut = rond(G.primitives[C[rang]])
        tournee(m, c - HAUT * (haut / 2), c + HAUT * (haut / 2), X, Y, r, C[forme]["profil"], C[forme]["cotes"], mat)

    ct, r_tete, h_tete = rond(G.primitives[C["tete"]])
    F = C["frette"]
    for part in F["places"]:
        cercle(fer, "z", (ct.x, ct.y, ct.z - h_tete / 2 + h_tete * part), r_tete * F["rayon"], h_tete * F["hauteur"],
               r_tete * F["epaisseur"], C["cloche"]["cotes"], "fer")

    Me, T = C["meche"], C["taquets"]
    cf, r_fut, h_fut = rond(G.primitives[C["fut"]])
    axe = Vector((cf.x, cf.y, 0))
    pied, tete = cf.z - h_fut / 2 - h_fut * Me["ancrage"], cf.z + h_fut / 2 + h_fut * Me["ancrage"]
    tournee(bois, axe + HAUT * pied, axe + HAUT * tete, X, Y, r_fut, Me["profil"], Me["cotes"])
    for k in range(T["nombre"]):
        console(bois, axe, cap(360 * (k + 0.5) / T["nombre"]),
                [(pied + (tete - pied) * t, r_fut * T["dedans"], r_fut * dehors) for t, dehors in T["profil"]],
                r_fut * T["largeur"], r_fut * T["chanfrein"])

    Br = C["barre"]
    for rang in C["barres"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        d = X if lx > ly else Y
        for s in COTES:
            pied_b, bout = c + d * (s * r_tete * Br["pied"]), c + d * (s * max(lx, ly) / 2 * Br["portee"])
            profilee(bois, pied_b, bout, (lz / 2, lz / 2), Br["profil"], u=HAUT.cross(d), v=HAUT)


def mat(D, G, pieces, a):
    """Un mât d'après `MATURE` : étambrai et coins, bas-mât fretté, rousture, taquets, vergue, voile ferlée et
    rabans, hune sur jottereaux, mât de hune."""
    M, bois, fer, corde = D["MATURE"], pieces[MAT], pieces["fer"], pieces["corde"]
    cm, r_mat, h_mat = rond(G.primitives[M["mat"]])
    ch, r_hune, h_hune = rond(G.primitives[M["hune"]])
    vergue = G.primitives[M["vergue"]]
    cv, r_vergue, l_vergue = rond(vergue)
    axe = Vector((cm.x, cm.y, 0))
    sol, cime = cm.z - h_mat / 2, cm.z + h_mat / 2
    dessous, capelage = ch.z - h_hune / 2, ch.z + h_hune / 2
    F = M["fut"]
    conicite = ((sol, F["rayons"][0]), (capelage, F["rayons"][1]))

    def rayon(z):
        return r_mat * lineaire(conicite, z)
    tournee(bois, axe + HAUT * sol, axe + HAUT * capelage, X, Y, r_mat, ((0.0, F["rayons"][0]), (1.0, F["rayons"][1])),
            F["cotes"])
    tournee(bois, axe + HAUT * dessous, axe + HAUT * cime, X, Y, r_mat, M["mat_de_hune"]["profil"], F["cotes"])
    haut_f, epais_f = (r_mat * part for part in F["frette"])
    frettes = [(sol + (capelage - sol) * part, haut_f) for part in F["frettes"]] + [(cv.z, r_vergue * F["racage"])]
    for z, h in frettes:
        cercle(fer, "z", (axe.x, axe.y, z), rayon(z), h, 2 * epais_f, F["cotes"], "fer")

    E, Co = M["collier"], M["coins"]
    ce, r_et, h_et = rond(G.primitives[M["etambrai"]])
    pied_et, tete_et = ce.z - h_et / 2, ce.z + h_et / 2
    tournee(bois, axe + HAUT * pied_et, axe + HAUT * tete_et, X, Y, r_et, E["profil"], E["cotes"])
    place, moyen, haut, epais = E["frette"]
    cercle(fer, "z", (axe.x, axe.y, pied_et + h_et * place), r_et * moyen, h_et * haut, r_et * epais, E["cotes"], "fer")
    for k in range(Co["nombre"]):
        console(bois, axe, cap(360 * k / Co["nombre"]),
                [(tete_et + h_et * dz, rayon(tete_et) * Co["dedans"], r_et * dehors) for dz, dehors in Co["profil"]],
                r_et * Co["largeur"], r_et * Co["chanfrein"])

    R = M["tours"]
    cr, r_rou, h_rou = rond(G.primitives[M["rousture"]])
    bas, haut = (cr.z + h_rou * part for part in R["etendue"])
    spires = [(k / (2 * R["nombre"]), R["creux"] if k % 2 == 0 else 1.0) for k in range(2 * R["nombre"] + 1)]
    tournee(corde, axe + HAUT * bas, axe + HAUT * haut, X, Y, r_rou * R["rayon"], spires, R["cotes"], "corde")

    T = M["taquet"]
    milieu = sol + h_mat * T["hauteur"]
    for s in COTES:
        console(bois, axe, X * s, [(milieu + r_mat * dz, r_mat * dedans, r_mat * dehors)
                                   for dz, dedans, dehors in T["profil"]], r_mat * T["largeur"], r_mat * T["chanfrein"])

    Es, espar = M["espar"], AXES[vergue["axis"]][1]
    tournee(bois, cv - espar * (l_vergue / 2), cv + espar * (l_vergue / 2), *normales(espar), r_vergue, Es["profil"],
            Es["cotes"])

    V = M["ferlee"]
    cs, (lx, ly, _) = pave(G.primitives[M["voile"]])
    epais, haut_v = ly / 2 * V["epais"], r_vergue * V["haut"]
    y_voile, tetiere = cv.y + (cs.y - cv.y) * V["avance"], cv.z - r_vergue * V["sous"]
    demi, serre = lx / 2 * V["longueur"], V["serre"]
    pas = 2 * demi / V["bourrelets"]
    demi_raban, gras = V["raban"]
    tours = [2 * math.pi * j / V["segments"] for j in range(V["segments"])]

    def ovale(x, part):
        ry, rz = epais * part, haut_v * part
        return [Vector((x, y_voile + ry * math.cos(t), tetiere - rz + rz * math.sin(t))) for t in tours]
    sections = []
    for k in range(V["bourrelets"]):
        x = cs.x - demi + pas * k
        gonfle = a.uniform(*V["gonfle"])
        sections += [ovale(x, serre)] + [ovale(x + pas * t, serre + (gonfle - serre) * part) for t, part in V["galbe"]]
        if k:
            coque(corde, [ovale(x + r_vergue * demi_raban * s, serre * gras) for s in COTES], "corde")
    coque(pieces["toile"], sections + [ovale(cs.x + demi, serre)], "toile")

    P, J = M["plateau"], M["jottereau"]
    tournee(bois, axe + HAUT * dessous, axe + HAUT * capelage, X, Y, r_hune, P["profil"], P["cotes"])
    for k in range(J["nombre"]):
        console(bois, axe, cap(360 * k / J["nombre"]),
                [(dessous + h_hune * dz, rayon(dessous) * J["dedans"], r_hune * dehors) for dz, dehors in J["profil"]],
                r_hune * J["largeur"], r_hune * J["chanfrein"])


def rouleau(D, G, pieces, a):
    """Une glène d'après `ROULEAU` : lits de spires sur un cœur d'ombre, œil ouvert, bout qui file."""
    R, corde = D["ROULEAU"], pieces["corde"]
    _, r_oeil, _ = rond(G.primitives[R["oeil"]])
    couches = [(G.primitives[rang]["sides"], *rond(G.primitives[rang])) for rang in R["couches"]]
    (_, pied, _, h_pied), (_, tete, _, h_tete) = couches[0], couches[-1]
    sol, hauteur = pied.z - h_pied / 2, tete.z + h_tete / 2 - (pied.z - h_pied / 2)
    nombre = len(couches) * R["lits"]
    brin = hauteur / (2 * nombre) * R["gras"]
    jeu = brin * R["jeu"]
    dedans = r_oeil + brin
    lits = [(c, r * math.cos(math.pi / pans) - brin - jeu, sol + brin + (hauteur - 2 * brin) * k / (nombre - 1))
            for k, (pans, c, r, _) in enumerate(couche for couche in couches for _ in range(R["lits"]))]
    for rang, (c, dehors, z) in enumerate(lits):
        spires = R["spires"] if rang == nombre - 1 else 2
        for k in range(spires):
            deport = Vector((a.uniform(-jeu, jeu), a.uniform(-jeu, jeu), 0))
            tore(corde, "z", tuple(Vector((c.x, c.y, z)) + deport), dehors + (dedans - dehors) * k / (spires - 1), brin,
                 *R["segments"], "corde")
    K = R["coeur"]
    for (_, c, _, h), (_, dehors, _) in zip(couches, lits[::R["lits"]]):
        cercle(pieces["ombre"], "z", tuple(c), (dedans + dehors) / 2, h - 2 * brin * K["retrait"], dehors - dedans,
               K["segments"], "ombre")

    Fi = R["filant"]
    centre, dehors, z = lits[0]
    bout = G.primitives[R["bout"]]
    cb, _, l_bout = rond(bout)
    file = AXES[bout["axis"]][1]
    vers = file * math.copysign(1, (cb - centre).dot(file))
    azimut = math.degrees(math.atan2(cb.y - centre.y, cb.x - centre.x))
    pose = Vector((centre.x, centre.y, z))
    points = [pose + cap(azimut - Fi["depart"] * part) * dehors for part in (Fi["amorce"], 1.0)]
    points += [Vector((cb.x, cb.y, z)) + vers * (l_bout / 2 * part) for part in (Fi["milieu"], Fi["fin"])]
    courbee(corde, lisse(points, Fi["pas"]), HAUT, (brin, brin), Fi["cotes"], "corde")


def ecoutille(D, G, pieces, a):
    """Une écoutille d'après `ECOUTILLE` : hiloire chevillée, deux panneaux de planches, barrot, anneaux et pitons."""
    E, bois, fer = D["ECOUTILLE"], pieces[MAT], pieces["fer"]
    c, (lx, ly, lz) = pave(G.primitives[E["hiloire"]])
    large = lx * E["piece"]
    arete = lz * D["ARETE"]
    for s in COTES:
        longue = c + Y * (s * (ly - large) / 2)
        planche(bois, longue - X * (lx / 2), longue + X * (lx / 2), Y, HAUT, large / 2, lz / 2, arete)
        courte, portee = c + X * (s * (lx - large) / 2), Y * (ly / 2 - large + large * E["ancrage"])
        planche(bois, courte - portee, courte + portee, X, HAUT, large / 2, lz / 2, arete)
        for sx in COTES:
            cheville(bois, longue + X * (sx * (lx - large) / 2) + HAUT * (lz / 2), HAUT, large * E["cheville"], a)

    P = E["planches"]
    cp, (px, py, pz) = pave(G.primitives[E["panneau"]])
    lit = cp.z - pz / 2 - pz * P["pose"]
    jour = px * P["jour"]
    dessus = {}
    for s in COTES:
        bornes = [cp.y + py * (part - 1 / 2) for part in partage(a, P["nombre"], P["ecart"])]
        for y0, y1 in zip(bornes, bornes[1:]):
            demi = (pz * a.uniform(*P["epaisseur"]) + pz * P["pose"]) / 2
            rive = Vector((cp.x, (y0 + y1) / 2, lit + demi))
            planche(pieces["vieux"], rive + X * (s * jour), rive + X * (s * px / 2), Y, HAUT, (y1 - y0) / 2 - jour,
                    demi, pz * P["chanfrein"], "vieux")
            dessus[tuple(sorted((cp.x + s * jour, cp.x + s * px / 2))) + (y0, y1)] = lit + 2 * demi

    def sous(x0, x1, y0, y1):
        """Le plus bas des dessus des planches qui couvrent un point de [`x0`, `x1`] × [`y0`, `y1`]."""
        return min(z for (a0, a1, b0, b1), z in dessus.items() if a0 <= x1 and x0 <= a1 and b0 <= y1 and y0 <= b1)

    cb, (bx, by, bz) = pave(G.primitives[E["barrot"]])
    demi_l, long, pose = E["couvre_joint"]
    portee, demi_b = by / 2 * long, bx / 2 * demi_l
    pied = sous(cb.x - demi_b, cb.x + demi_b, cb.y - portee, cb.y + portee) - bz * pose
    haut_b = cb.z + bz / 2 - pied
    axe = Vector((cb.x, cb.y, pied + haut_b / 2))
    planche(bois, axe - Y * portee, axe + Y * portee, X, HAUT, demi_b, haut_b / 2, haut_b * D["ARETE"])

    N = E["anneau"]
    cote, chanfrein = N["piton"]
    for rang in E["anneaux"]:
        organeau = G.primitives[rang]
        ca, r, haut = rond(organeau)
        petit = haut * N["petit"]
        pose = Vector((ca.x, ca.y, sous(ca.x, ca.x, ca.y, ca.y) + petit * (1 - N["pose"])))
        grand = anneau_de_fer(fer, AXES[organeau["axis"]][0], pose, r, petit, N)
        piton = pose - X * (grand * math.copysign(1, ca.x - cp.x))
        barre(fer, [(Vector((piton.x, piton.y, z)), petit * cote, petit * cote, petit * cote * chanfrein)
                    for z in (cp.z, pose.z + petit)], X, Y, "fer")


def passerelle(D, G, pieces, a):
    """Une passerelle d'après `PASSERELLE` : planches au pied en biseau, longerons, tasseaux chevillés, chevalet,
    poteaux et chandeliers, filière de corde."""
    Pa, bois = D["PASSERELLE"], pieces[MAT]
    rampe = G.primitives[Pa["rampe"]]
    _, (_, _, lz) = pave(rampe)
    descend, tete, bas, long, large = rampant(rampe)
    d = (tete - bas).normalized()
    travers = descend.cross(HAUT)
    n = d.cross(travers)
    pente = (tete - bas).length

    def dessus(p):
        return Vector((p.x, p.y, bas.z + (p - bas).dot(-descend) * lz / long))

    P = Pa["planches"]
    e = lz * P["epaisseur"]
    biseau = e * pente / lz
    jour = large * P["jour"]
    bornes = [large * P["largeur"] * (part - 1 / 2) for part in partage(a, P["nombre"], P["ecart"])]
    for w0, w1 in zip(bornes, bornes[1:]):
        rive, du = travers * ((w0 + w1) / 2), (w1 - w0) / 2 - jour
        fin = pente - long * a.uniform(*P["bout"])
        pied = e / 2 * P["pied"]
        barre(bois, [(bas + rive + d * (biseau * P["pied"]) - n * pied, du, pied, 2 * pied * D["ARETE"]),
                     (bas + rive + d * biseau - n * (e / 2), du, e / 2, e * D["ARETE"]),
                     (bas + rive + d * fin - n * (e / 2), du, e / 2, e * D["ARETE"])], travers, n)

    L = Pa["longeron"]
    haut_l = lz * L["hauteur"]
    sous = n * (e - e * L["ancrage"] + haut_l / 2)
    for s in COTES:
        rive = bas + travers * (s * large / 2 * L["place"]) - sous
        planche(bois, rive + d * (pente * L["depart"]), rive + d * (pente - long * P["bout"][1]), travers, n,
                large * L["largeur"], haut_l / 2, haut_l * D["ARETE"])

    T = Pa["tasseau"]
    places = [pave(G.primitives[rang]) for rang in Pa["tasseaux"]]
    _, (tx, ty, tz) = places[0]
    longueur, largeur = (abs(axe.dot(Vector((tx, ty, 0)))) for axe in (travers, descend))
    poses = [dessus(p) for p, _ in places]
    poses += [g.lerp(h, k / (T["entre"] + 1)) for g, h in zip(poses, poses[1:]) for k in range(1, T["entre"] + 1)]
    demi_h = tz / 2 * T["hauteur"]
    portee = travers * (longueur / 2 * T["longueur"])
    parts, rayon = T["chevilles"]
    for p in poses:
        axe = p + n * (demi_h - 2 * demi_h * T["ancrage"])
        planche(pieces["vieux"], axe - portee, axe + portee, d, n, largeur / 2 * T["largeur"], demi_h,
                2 * demi_h * D["ARETE"], "vieux")
        for part in parts:
            cheville(bois, axe + portee * part + n * demi_h, n, largeur * T["largeur"] * rayon, a)

    Ch, vieux = Pa["chevalet"], pieces["vieux"]
    ca, (ax, ay, az) = pave(G.primitives[Pa["appui"]])
    sol = ca.z - az / 2
    place, cote = Ch["pieds"]
    demi_c = min(ax, ay) * cote
    demi_long, demi_large, haut_c, pose = Ch["chapeau"]
    sous_planches = dessus(ca).z - e / d.dot(-descend)
    chapeau = Vector((ca.x, ca.y, sous_planches + e * pose - az * haut_c / 2))
    en_travers = travers * (max(ax, ay) / 2)
    planche(vieux, chapeau - en_travers * demi_long, chapeau + en_travers * demi_long, descend, HAUT,
            min(ax, ay) / 2 * demi_large, az * haut_c / 2, az * haut_c * D["ARETE"], "vieux")
    hauteur, part = Ch["entretoise"]
    entretoise = Vector((ca.x, ca.y, sol + az * hauteur))
    planche(vieux, entretoise - en_travers * place, entretoise + en_travers * place, descend, HAUT, demi_c * part,
            demi_c * part, 2 * demi_c * part * D["ARETE"], "vieux")
    for s in COTES:
        pied = Vector((ca.x, ca.y, sol)) + en_travers * (s * place)
        profilee(vieux, pied, Vector((pied.x, pied.y, chapeau.z)), (demi_c, demi_c), D["PIED_DE_CHEVALET"],
                 "vieux")

    Po, Fi = Pa["poteau"], Pa["filiere"]
    (pb, r_poteau, h_poteau), (ph, _, h_haut) = (rond(G.primitives[rang]) for rang in Pa["poteaux"])
    tetes = [pb + HAUT * (h_poteau / 2), ph + HAUT * (h_haut / 2)]
    tetes[1:1] = [tetes[0].lerp(tetes[1], k / (Po["entre"] + 1)) for k in range(1, Po["entre"] + 1)]
    for p in tetes:
        pied = Vector((p.x, p.y, max(dessus(p).z - e * Po["ancrage"], pb.z - h_poteau / 2)))
        tournee(bois, pied, p, X, Y, r_poteau, Po["profil"], Po["cotes"])
    passes = [p - HAUT * (h_poteau * Fi["tete"]) for p in tetes]
    points = [passes[0]]
    for g, h in zip(passes, passes[1:]):
        points += [g.lerp(h, 1 / 2) - HAUT * ((h - g).length * Fi["fleche"]), h]
    courbee(pieces["corde"], lisse(points, Fi["pas"]), d.cross(HAUT).normalized(), (r_poteau * Fi["rayon"],) * 2,
            Fi["cotes"], "corde")


BATIR = {"ancre-de-navire": ancre, "barre-de-navire": barre_a_roue, "cabestan": cabestan, "mat-de-navire": mat,
         "rouleau-de-cordage": rouleau, "ecoutille": ecoutille, "passerelle-d-embarquement": passerelle}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
