"""Le campement (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave`, `geometrie.rond`, `geometrie.rampant`) et où `Gabarit.rentrer`
ramène le sommet qui en sortirait. Chaque pièce est une coque close : une roue à rais (`roue`) ; une virure, un
plat-bord, une sole, un pignon de toile, une bâche, une gerbe et une meule, la coque de leurs sections ; une toile
plissée, la coque de ses contours d'un rang à l'autre, un dais, des planches côte à côte, une section bosselée, une
planche, une pièce profilée, tournée ou courbée, une cheville et un cercle, ceux de `geometrie` ; un tour de corde, le
tore de `maille`. Chaque matériau du décor est un nœud à son nom. L'aléa est semé des codes de caractères de l'id du
décor : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (AXES, COTES, CYLINDRE, HAUT, MAT, POTEAU, X, Y, anneau, autour, bordage, cap, cercle, cheville,
                       coque, courbee, lisse, normales, onde, pave, planche, profilee, rampant, rond, sous_le_rampant,
                       tournee)
from maille import lineaire, tore

DECORS = ("charrette", "diligence", "epave-carrosse", "barque", "etal-marche", "tente", "tas-foin", "cargaison-bachee",
          "hamac")


def roue(m, primitive, dehors, large, R, manquants, moyeu):
    """Une roue de bois autour de l'axe du cylindre `primitive` de la recette, d'après `R` : une jante de rayon
    `dehors`, large de `R["largeur"]` de `large`, au nombre de pans de la primitive ; un moyeu tourné
    `moyeu` (maille, matériau, rayon, demi-longueur) ; des rais tournés du moyeu à la jante, hors les rangs
    `manquants`."""
    centre, _, _ = rond(primitive)
    axe, essieu = AXES[primitive["axis"]]
    u, w = geometrie.repere(axe)
    dedans = dehors * R["jante"]
    cercle(m, axe, tuple(centre), (dedans + dehors) / 2, large * R["largeur"], dehors - dedans, primitive["sides"],
           MAT)
    noix, mat, rayon, demi = moyeu
    tournee(noix, centre - essieu * demi, centre + essieu * demi, u, w, rayon, R["noix"], R["cotes"], mat)
    for k in range(R["rais"]):
        if k in manquants:
            continue
        tours = 2 * math.pi * (k + 1 / 2) / R["rais"]
        d = autour(u, w, tours)
        tournee(m, centre + d * (rayon * R["pied"]), centre + d * (dedans * R["tete"]), essieu, essieu.cross(d),
                large / 2 * R["rai"], R["fuseau"], R["pans"])


def ferrees(D, G, pieces, roues, bandage):
    """Les roues `roues` [(rang du bandage, de la jante, du moyeu dans la recette)] : un bandage de fer épais de
    `bandage` de son rayon, une roue de bois (`roue`) jusqu'à son milieu, un moyeu de laiton. Rend le centre et le rayon
    du moyeu de chacune dans la recette."""
    moyeux = []
    for rang_bandage, jante, noix in roues:
        cercle_de_fer, boite = G.primitives[rang_bandage], G.primitives[noix]
        ct, rt, lt = rond(cercle_de_fer)
        epais = rt * bandage
        cercle(pieces["fer"], AXES[cercle_de_fer["axis"]][0], tuple(ct), rt - epais / 2, lt, epais,
               cercle_de_fer["sides"], "fer")
        cm, rm, lm = rond(boite)
        roue(pieces[MAT], G.primitives[jante], rt - epais / 2, lt, D["ROUE"], (),
             (pieces["laiton"], "laiton", geometrie.apotheme(boite), lm / 2))
        moyeux.append((cm, rm))
    return moyeux


def bloc(D, m, centre, demi, mat=MAT):
    """Un bloc de `centre` et de demi-côtés `demi` (x, y, z), ses arêtes adoucies de `D["ARETE"]` de son plus petit
    côté."""
    dx, dy, dz = demi
    planche(m, centre - X * dx, centre + X * dx, Y, HAUT, dy, dz, 2 * min(demi) * D["ARETE"], mat)


def charrette(D, G, pieces, a):
    """Une charrette d'après `CHARRETTE` : plateau de planches en travers, quatre ridelles à lisses et montants
    chevillés, deux longerons qui filent en brancards, une traverse entre eux, un essieu sur ses cales, deux roues à
    rais cerclées de fer, moyeux de laiton."""
    C, bois = D["CHARRETTE"], pieces[MAT]
    c, (lx, ly, lz) = pave(G.primitives[C["plateau"]])
    bordage(bois, c, Y, X, ly, lx, lz, C["plancher"], D, a)

    R = C["ridelle"]
    for rang in C["ridelles"]:
        cr, (rx, ry, rz) = pave(G.primitives[rang])
        fil, long, epais = (X, rx, ry) if rx > ry else (Y, ry, rx)
        dehors = fil.cross(HAUT)
        dehors = dehors * math.copysign(1, (cr - c).dot(dehors))
        rayon = epais * R["cheville"]
        face = epais / 2 - rayon * geometrie.CHEVILLE["saillie"][1] - D["RETRAIT"]
        fond = epais * R["lisse"] * (1 - R["ancrage"]) - epais / 2
        lisses = bordage(bois, cr + dehors * (epais * R["lisse"] / 2 - epais / 2), fil, HAUT, long, rz,
                         epais * R["lisse"], R["lisses"], D, a)
        for part in R["montants"]:
            pied = Vector((cr.x, cr.y, c.z)) + fil * (long / 2 * part) + dehors * ((face + fond) / 2)
            planche(bois, pied, Vector((pied.x, pied.y, cr.z + rz / 2)), fil, dehors, long * R["montant"],
                    (face - fond) / 2, epais * D["ARETE"])
            for axe in lisses:
                cheville(bois, Vector((pied.x, pied.y, axe.z)) + dehors * ((face - fond) / 2), dehors, rayon, a)

    (gauche, rayon), (droite, _) = ferrees(D, G, pieces, C["roues"], C["bandage"])
    E = C["essieu"]
    demi = rayon * E["section"]
    planche(bois, gauche, droite, (droite - gauche).normalized().cross(HAUT), HAUT, demi, demi, demi * D["ARETE"])

    essieu = AXES[G.primitives[C["roues"][0][1]]["axis"]][1]
    part, section = C["traverse"]
    limons = []
    for rang in C["brancards"]:
        cb, (bx, by, bz) = pave(G.primitives[rang])
        fil, long, large = (X, bx, by) if bx > by else (Y, by, bx)
        avant = fil * math.copysign(1, (cb - c).dot(fil))
        travers = HAUT.cross(fil)
        plateau = abs(fil.dot(Vector((lx, ly, 0))))
        queue = cb + avant * ((c - cb).dot(avant) - (plateau / 2 - plateau * C["recul"]))
        profilee(bois, queue, cb + avant * (long / 2), (large / 2, bz / 2), C["limon"], MAT, travers, HAUT)
        cale = gauche + essieu * (cb - gauche).dot(essieu)
        planche(bois, cale, Vector((cale.x, cale.y, cb.z)), fil, travers, demi * E["cale"], large / 2,
                demi * D["ARETE"])
        limons.append((cb - avant * (long / 2 - long * part), large / 2 * section, bz / 2 * section))
    (p0, du, dv), (p1, _, _) = limons
    planche(bois, p0, p1, (p1 - p0).normalized().cross(HAUT), HAUT, du, dv, dv * D["ARETE"])


def diligence(D, G, pieces, a):
    """Une diligence d'après `DILIGENCE` : châssis sur deux essieux et quatre roues ferrées, caisse close à membrure,
    vitrages, portières à poignée et marchepied, toit de cuir à galerie et bagages, siège du cocher, coffre arrière,
    timon et palonnier. Elle file en x, le timon du côté de sa boîte."""
    K, bois, fer, cuir, laiton = D["DILIGENCE"], pieces[MAT], pieces["fer"], pieces["cuir"], pieces["laiton"]
    P = G.primitives

    cc, (cx, cy, cz) = pave(P[K["chassis"]])
    large = cz / 2 * K["longeron"]
    for s in COTES:
        bloc(D, bois, cc + Y * (s * (cy / 2 - large)), (cx / 2, large, cz / 2))
    for part in K["traverses"]:
        bloc(D, bois, cc + X * (cx / 2 * part), (large * K["traverse"], cy / 2 - large, cz / 2 * K["traverse"]))
    moyeux = ferrees(D, G, pieces, K["roues"], K["bandage"])
    trains = []
    for i, j in K["essieux"]:
        (gauche, rayon), (droite, _) = moyeux[i], moyeux[j]
        demi = rayon * K["essieu"]
        planche(bois, gauche, droite, (droite - gauche).normalized().cross(HAUT), HAUT, demi, demi, demi * D["ARETE"])
        milieu = gauche.lerp(droite, 1 / 2)
        for s in COTES:
            bloc(D, bois, Vector((milieu.x, cc.y + s * (cy / 2 - large), (milieu.z + cc.z) / 2)),
                 (demi * K["cale"], large, (cc.z - milieu.z) / 2 + demi))
        trains.append((milieu, demi))

    Q = K["coque"]
    c, (lx, ly, lz) = pave(P[K["caisse"]])
    bas, haut = c.z - lz / 2, c.z + lz / 2
    e, retrait, cote, lisse_ = ly * Q["paroi"], ly * Q["retrait"], ly * Q["poteau"], lz * Q["membrure"]
    saillie = (retrait + e / 2) / 2
    for sx in COTES:
        for sy in COTES:
            pied = Vector((c.x + sx * (lx / 2 - cote), c.y + sy * (ly / 2 - cote), bas))
            profilee(bois, pied, pied + HAUT * lz, (cote, cote), POTEAU)
    bloc(D, bois, Vector((c.x, c.y, bas + e / 2)), (lx / 2 - cote, ly / 2 - cote, e / 2))
    for s in COTES:
        bout = c + X * (s * (lx / 2 - retrait - e / 2))
        bloc(D, bois, bout, (e / 2, ly / 2 - cote, lz / 2 - e))
        for z in (bas + lisse_, haut - lisse_):
            bloc(D, bois, Vector((c.x + s * (lx / 2 - saillie), c.y, z)), (saillie, ly / 2 - cote, lisse_))
    porte = lx * Q["porte"]
    H = K["poignee"]
    for rang in K["vitrages"]:
        cv, (vx, _, vz) = pave(P[rang])
        dehors = Y * math.copysign(1, cv.y - c.y)
        bloc(D, bois, c + dehors * (ly / 2 - retrait - e / 2), (lx / 2 - cote, e / 2, lz / 2 - e))
        bloc(D, pieces["vitre"], Vector((cv.x, c.y, cv.z)) + dehors * (ly / 2 - retrait * (1 - Q["vitre"]) - e / 2),
             (vx / 2, e / 2, vz / 2), "vitre")
        membrure = c + dehors * (ly / 2 - saillie)
        appui = cv.z - vz / 2 - lisse_
        for z in (bas + lisse_, appui, haut - lisse_):
            bloc(D, bois, Vector((membrure.x, membrure.y, z)), (lx / 2 - cote, saillie, lisse_))
        for x, pied in ((c.x - porte, bas), (c.x + porte, bas), (cv.x - vx / 2, appui), (cv.x + vx / 2, appui)):
            bloc(D, bois, Vector((x, membrure.y, (pied + haut) / 2)),
                 (lisse_ * Q["montant"], saillie * Q["face"], (haut - pied) / 2 - lisse_ * Q["ancrage"]))
        prise = c + X * (porte * H["place"]) - HAUT * (lz * H["hauteur"]) + dehors * (ly / 2 - retrait)
        tournee(laiton, prise, prise + dehors * (retrait + ly * H["saillie"]), *normales(dehors), lz * H["rayon"],
                H["profil"], H["cotes"], "laiton")
        M = K["degre"]
        dx, dy, dz = lx * M["plat"][0], ly * M["plat"][1], lz * M["plat"][2]
        plat = Vector((c.x, c.y, bas - lz * M["hauteur"])) + dehors * (ly / 2 + dy)
        bloc(D, fer, plat, (dx, dy, dz), "fer")
        for s in COTES:
            pied = plat + X * (s * dx * M["tirant"][0]) - dehors * (dy * M["tirant"][0])
            geometrie.fil(fer, pied, Vector((pied.x, pied.y, bas)) - dehors * (dy * (1 - M["tirant"][0]) + cote),
                          dz * M["tirant"][1], K["rambarde"]["cotes"], "fer")

    ct, (tx, ty, tz) = pave(P[K["toit"]])
    planche(cuir, ct - X * (tx / 2), ct + X * (tx / 2), Y, HAUT, ty / 2, tz / 2, tz * K["couverture"], "cuir")
    dessus = ct.z + tz / 2
    Ra = K["rambarde"]
    cg, (gx, gy, gz) = pave(P[K["galerie"]])
    r = gz * Ra["rayon"]
    lisse_z, dx, dy = cg.z + gz / 2 - r, gx / 2 - r, gy / 2 - r
    coins = [Vector((cg.x + sx * dx, cg.y + sy * dy, lisse_z)) for sx, sy in geometrie.ANGLES]
    for p, q in zip(coins, coins[1:] + coins[:1]):
        fil = (q - p).normalized()
        geometrie.fil(fer, p - fil * r, q + fil * r, r, Ra["cotes"], "fer")
    longs, petits = Ra["montants"]
    pieds = [(cg.x + dx * (2 * k / (longs - 1) - 1), cg.y + s * dy) for s in COTES for k in range(longs)]
    pieds += [(cg.x + s * dx, cg.y + dy * (2 * k / (petits - 1) - 1)) for s in COTES for k in range(1, petits - 1)]
    for x, y in pieds:
        geometrie.fil(fer, Vector((x, y, dessus - r)), Vector((x, y, lisse_z)), r, Ra["cotes"], "fer")
    T = K["coffret"]
    haut_t = gz * T["cotes"][2]
    bloc(D, bois, Vector((cg.x + gx / 2 * T["place"], cg.y, dessus + haut_t / 2)),
         (gx / 2 * T["cotes"][0], gy / 2 * T["cotes"][1], haut_t / 2))

    S = K["sangles"]
    for rang, mat in ((K["malle"], "cuir"), (K["arriere"], MAT)):
        cm, (mx, my, mz) = pave(P[rang])
        bloc(D, pieces[mat], cm, tuple(cote_ / 2 * K["bagage"] for cote_ in (mx, my, mz)), mat)
        fil, long, travers, large_m = (X, mx, Y, my) if mx > my else (Y, my, X, mx)
        for part in S["places"]:
            bande = cm + fil * (long / 2 * K["bagage"] * part)
            demi = fil * (long * S["largeur"]) + travers * (large_m / 2) + HAUT * (mz / 2)
            bloc(D, fer, bande, (abs(demi.x), abs(demi.y), demi.z), "fer")

    cf, (fx, fy, fz) = pave(P[K["coffre"]])
    bloc(D, bois, cf, (fx / 2, fy / 2, fz / 2))
    cs, (sx_, sy_, sz) = pave(P[K["siege"]])
    planche(cuir, cs - Y * (sy_ / 2), cs + Y * (sy_ / 2), X, HAUT, sx_ / 2, sz / 2, sz * K["coussin"], "cuir")
    avant = X * math.copysign(1, cs.x - c.x)
    Ga, La = K["garde"], K["lanterne"]
    rg, rl = sz * Ga["rayon"], lz * La["rayon"]
    for s in COTES:
        y = cs.y + s * (sy_ / 2 - 2 * rg)
        nez = c + avant * (lx / 2)
        geometrie.fil(fer, Vector((nez.x, y, cs.z + sz / 2 + lz * Ga["prise"])),
                      Vector((cs.x, y, cs.z + sz / 2 + rg)) + avant * (sx_ / 2 * Ga["pied"]), rg, Ga["cotes"], "fer")
        fanal = Vector((nez.x, c.y + s * (ly / 2 - rl), c.z + lz * La["hauteur"])) + avant * rl
        tournee(laiton, fanal, fanal + HAUT * (lz * La["longueur"]), X, Y, rl, La["profil"], La["cotes"], "laiton")

    cp, (px, py, pz) = pave(P[K["marchepied"]])
    bloc(D, bois, cp, (px / 2, py / 2, pz / 2))
    for s in COTES:
        y = cc.y + s * (cy / 2 - large)
        geometrie.fil(fer, Vector((cc.x, y, cc.z)) + avant * (cx / 2 - large), Vector((cp.x, y, cp.z)),
                      cz * K["console"], Ga["cotes"], "fer")

    (train, demi), = (t for t in trains if (t[0] - cc).dot(avant) > 0)
    cb, (bx, by, bz) = pave(P[K["timon"]])
    depart, pointe = train + HAUT * (demi + bz / 2), cb + avant * (bx / 2)
    file = (pointe - depart).normalized()
    profilee(bois, depart, pointe, (by / 2, bz / 2), K["fleche"], MAT, Y, file.cross(Y))
    cl, (ax, ay, az) = pave(P[K["palonnier"]])
    bloc(D, bois, cl, (ax / 2, ay / 2, az / 2))


def carrosse(D, G, pieces, a):
    """Une épave de carrosse d'après `CARROSSE` : caisse de planches debout entre ses poteaux, saine sous le toit,
    brisée au-delà de son faîte ; ceintures, plancher, baie de la porte fermée d'ombre entre ses montants ; pan de
    toit relevé sur deux montants ; trois roues à rais brisés sur leurs essieux, la quatrième couchée ; timon rompu
    et planches tombées au sol."""
    K, bois, vieux = D["CARROSSE"], pieces[MAT], pieces["vieux"]
    c, (lx, ly, lz) = pave(G.primitives[K["caisse"]])
    pente = rampant(G.primitives[K["toit"]])
    descend, crete, egout, _, large = pente
    co, (ox, oy, oz) = pave(G.primitives[K["porte"]])
    vers = -descend
    travers = HAUT.cross(vers)
    long, profond = (abs(sens.dot(Vector((lx, ly, 0)))) for sens in (vers, travers))
    bas, haut = c.z - lz / 2, c.z + lz / 2
    Pl, Ce = K["planche"], K["ceinture"]
    e, cote = profond * Pl["epaisseur"], profond * K["poteau"]
    faite, baie = (crete - c).dot(vers), (co - c).dot(vers)
    demi_baie = abs(vers.dot(Vector((ox, oy, 0)))) / 2
    flanc_porte = math.copysign(1, (co - c).dot(travers))
    rive, bout = travers * (profond / 2 - cote), vers * (long / 2 - cote)

    def au_flanc(abscisse, flanc):
        """Le point de l'axe du flanc `flanc` de la caisse, à l'`abscisse` le long de la caisse, à mi-hauteur."""
        return c + vers * abscisse + rive * flanc

    pans = [(c - bout, travers, profond - 2 * cote, haut, Pl["saine"]),
            (c + bout, travers, profond - 2 * cote, haut, Pl["ruine"]),
            (au_flanc((faite - long / 2) / 2, -flanc_porte), vers, faite + long / 2, haut, Pl["saine"]),
            (au_flanc((faite + long / 2) / 2, -flanc_porte), vers, long / 2 - faite, haut, Pl["ruine"]),
            (au_flanc((baie - demi_baie - long / 2) / 2, flanc_porte), vers, baie - demi_baie + long / 2, haut,
             Pl["saine"]),
            (au_flanc((baie + demi_baie + long / 2) / 2, flanc_porte), vers, long / 2 - baie - demi_baie, haut,
             Pl["ruine"]),
            (au_flanc(baie, flanc_porte), vers, 2 * demi_baie, co.z - oz / 2, Pl["saine"])]
    for milieu, sens, largeur, tete, brise in pans:
        P = {**K["bardage"], "planches": max(1, round(largeur / (long * Pl["largeur"]))), "bout": brise}
        bordage(vieux, Vector((milieu.x, milieu.y, (bas + tete) / 2)), HAUT, sens, tete - bas, largeur, e, P, D, a,
                "vieux")

    fil = (crete - egout).normalized()
    dessus = fil.cross(travers)
    montant = baie - demi_baie
    avant = G.primitives[K["roues"][K["essieux"][2]]]
    ca, ra, _ = rond(avant)
    essieu = AXES[avant["axis"]][1]
    coin = (math.copysign(1, (ca - c).dot(vers)), -math.copysign(1, (ca - c).dot(travers)))
    futs = [(c + bout * s + rive * flanc, ca.z - ra if (s, flanc) == coin else bas,
             haut if s < 0 else bas + lz * a.uniform(*K["casse"])) for s in COTES for flanc in COTES]
    futs += [(p, bas, sous_le_rampant(pente, p, e / 2 / dessus.z).z) for p in (au_flanc(montant, f) for f in COTES)]
    futs.append((au_flanc(baie + demi_baie, flanc_porte), bas, co.z + oz / 2))
    for p, pied, tete in futs:
        profilee(vieux, Vector((p.x, p.y, pied)), Vector((p.x, p.y, tete)), (cote, cote), POTEAU, "vieux")

    demi_h = lz * Ce["hauteur"]
    ceintures = [(c - bout - rive, c - bout + rive, z) for z in (bas + demi_h, haut - demi_h)]
    ceintures.append((c + bout - rive, c + bout + rive, bas + demi_h))
    for flanc in COTES:
        ceintures.append((au_flanc(cote - long / 2, flanc), au_flanc(long / 2 - cote, flanc), bas + demi_h))
        ceintures.append((au_flanc(cote - long / 2, flanc), au_flanc(montant, flanc), haut - demi_h))
    for p0, p1, z in ceintures:
        planche(vieux, Vector((p0.x, p0.y, z)), Vector((p1.x, p1.y, z)), HAUT, (p1 - p0).normalized().cross(HAUT),
                demi_h, cote * Ce["epaisseur"], e * D["ARETE"], "vieux")
    bordage(vieux, Vector((c.x, c.y, bas + demi_h)), travers, vers, profond - 2 * cote, long - 2 * cote, e,
            K["plancher"], D, a, "vieux")
    seuil = au_flanc(baie, flanc_porte)
    seuil.z = co.z
    ombre = e * K["ombre"]
    planche(pieces["ombre"], seuil - vers * demi_baie, seuil + vers * demi_baie, HAUT, travers, oz / 2, ombre,
            ombre * D["ARETE"], "ombre")
    bordage(vieux, egout.lerp(crete, 1 / 2) - dessus * (e / 2 + D["RETRAIT"]), fil, travers, (crete - egout).length,
            large * K["toit_large"], e, K["voliges"], D, a, "vieux")

    centres, E = [], K["essieu"]
    for rang in K["roues"]:
        jante = G.primitives[rang]
        cr, r, l = rond(jante)
        roue(bois, jante, r, l, D["ROUE"], a.sample(range(D["ROUE"]["rais"]), K["brises"]),
             (bois, MAT, r * K["moyeu"][0], l / 2 * K["moyeu"][1]))
        centres.append((cr, r * E["section"]))
    (gauche, demi), (droite, _), (seule, _) = (centres[rang] for rang in K["essieux"])
    moignon = seule - essieu * ((seule - c).dot(essieu) * (1 + E["moignon"]))
    for p0, p1 in ((gauche, droite), (seule, moignon)):
        planche(bois, p0, p1, vers, HAUT, demi, demi, demi * D["ARETE"])

    ct, (tx, ty, tz) = pave(G.primitives[K["timon"]])
    file, demi_t = (X * (tx / 2), ty / 2) if tx > ty else (Y * (ty / 2), tx / 2)
    profilee(bois, ct - file, ct + file, (demi_t, tz / 2), K["fleche"], MAT, file.normalized().cross(HAUT), HAUT)
    tombee, _ = centres[K["tombee"]]
    for t0, t1 in K["debris"]:
        p0, p1 = (Vector((p.x, p.y, ct.z - tz / 2 + e / 2))
                  for p in ((ct - file).lerp(tombee, t0), (ct + file).lerp(tombee, t1)))
        planche(vieux, p0, p1, (p1 - p0).normalized().cross(HAUT), HAUT, long * Pl["largeur"] / 2, e / 2,
                e * D["ARETE"], "vieux")


def barque(D, G, pieces, a):
    """Une barque à fond plat d'après `BARQUE` : sole, virures à clin de chaque bord, du tableau à l'étrave,
    plats-bords, membrures (varangue et deux allonges), payol, deux bancs, tolets, un aviron couché sur les bancs,
    une glène sur le payol."""
    B, bois, vieux = D["BARQUE"], pieces[MAT], pieces["vieux"]
    c, (lx, ly, lz) = pave(G.primitives[B["coque"]])
    descend, crete, _, long, _ = rampant(G.primitives[B["proue"]])
    cl, (_, _, hl) = pave(G.primitives[B["plat_bord"]])
    travers = HAUT.cross(descend)
    demi_long, demi_large = (abs(sens.dot(Vector((lx, ly, 0)))) / 2 for sens in (descend, travers))
    sol = c.z - lz / 2
    creux = cl.z + hl / 2 - sol
    poupe = Vector((c.x, c.y, sol)) - descend * demi_long
    longueur = (crete - poupe).dot(descend) + long * B["etrave"]
    V, Li, M = B["borde"], B["liston"], B["membrure"]
    e = creux * V["epaisseur"]
    demi_l, demi_h = (creux * part / 2 for part in Li["section"])

    flancs = []
    for s in COTES:
        bouchain, livet = [], []
        for t, large_l, large_b, tonture, releve in B["couples"]:
            axe = poupe + descend * (longueur * t)
            bouchain.append(axe + travers * (s * demi_large * large_b) + HAUT * (creux * releve))
            livet.append(axe + travers * (s * demi_large * large_l) + HAUT * (creux * tonture))
        bouchain, livet = lisse(bouchain, B["pas"]), lisse(livet, B["pas"])
        for p in bouchain:
            p.z = max(p.z, sol)
        dernier = len(livet) - 1
        dehors = [HAUT.cross(livet[min(i + 1, dernier)] - livet[max(i - 1, 0)]).normalized() * s
                  for i in range(dernier + 1)]
        for k in range(V["virures"]):
            f0, f1 = max(k - V["recouvre"], 0) / V["virures"], (k + 1) / V["virures"]
            clin = e * V["clin"] * min(k, 1)
            coque(bois, [[p.lerp(q, f0) + n * clin, p.lerp(q, f0) + n * (clin + e), p.lerp(q, f1) + n * e,
                          p.lerp(q, f1)] for p, q, n in zip(bouchain, livet, dehors)], MAT)
        coque(bois, [[q + n * (e / 2 + sens * demi_l) + HAUT * (haut * demi_h)
                      for sens, haut in ((-1, -1), (1, -1), (1, 1), (-1, 1))] for q, n in zip(livet, dehors)], MAT)
        for rang in B["membrures"]:
            dedans = dehors[rang] * (creux * M["section"][1] * (1 - M["ancrage"]))
            planche(bois, bouchain[rang] - dedans + HAUT * e, livet[rang] - dedans, descend, dehors[rang],
                    creux * M["section"][0], creux * M["section"][1], e * D["ARETE"])
        flancs.append((bouchain, livet, dehors))

    (babord, livet_babord, vers_babord), (bouchain, livet, vers_tribord) = flancs
    coque(bois, [[g + n * (e / 2), d + m * (e / 2), d + m * (e / 2) + HAUT * e, g + n * (e / 2) + HAUT * e]
                 for g, n, d, m in zip(babord, vers_babord, bouchain, vers_tribord)], MAT)
    _, (tx, ty, _) = pave(G.primitives[B["tableau"]])
    cadre = [ligne[0] + vers[0] * (e / 2) for ligne, vers in ((babord, vers_babord), (bouchain, vers_tribord),
                                                              (livet, vers_tribord), (livet_babord, vers_babord))]
    coque(bois, [[p + descend * avance for p in cadre]
                 for avance in (0, abs(descend.dot(Vector((tx, ty, 0)))) * B["tableau_epais"])], MAT)

    def au_flanc(p):
        """La demi-largeur du dedans du bordé à l'abscisse et à la hauteur de `p`, et le point du livet de tribord à
        cette abscisse."""
        abscisse = (p - poupe).dot(descend)
        bas, haut = (Vector([lineaire([((q - poupe).dot(descend), q[k]) for q in ligne], abscisse) for k in range(3)])
                     for ligne in (bouchain, livet))
        return (bas.lerp(haut, (p.z - bas.z) / (haut.z - bas.z)) - poupe).dot(travers), haut

    pointe = bouchain[-1].lerp(babord[-1], 1 / 2)
    Et = B["etrave_piece"]
    demi_t, demi_e = creux * Et["section"][0], creux * Et["section"][1]
    sommet = min(G.portee((q.x, q.y, 0), (0, 0, 1), D["RETRAIT"])
                 for q in (pointe + descend * demi_e + travers * (s * demi_t) for s in COTES))
    planche(bois, pointe, Vector((pointe.x, pointe.y, sol + (sommet - sol) * Et["tete"])), travers, descend, demi_t,
            demi_e, e * D["ARETE"])

    haut_v = creux * M["varangue"]
    lit = sol + e * (1 - M["ancrage"]) + haut_v
    for rang in B["membrures"]:
        g, d = (Vector((p.x, p.y, lit - haut_v / 2)) for p in (babord[rang], bouchain[rang]))
        planche(bois, g, d, descend, HAUT, creux * M["section"][0], haut_v / 2, e * D["ARETE"])
    Pa = B["payol"]
    e_p = creux * Pa["epaisseur"]
    debut, fin = (poupe + descend * (longueur * part) for part in Pa["etendue"])
    fond = lit + e_p * (1 - M["ancrage"])
    bordage(vieux, debut.lerp(fin, 1 / 2) + HAUT * (fond - e_p / 2 - sol), descend, travers, (fin - debut).length,
            2 * min(au_flanc(p)[0] for p in (debut, fin)) * Pa["largeur"], e_p, Pa["planches"], D, a, "vieux")

    T, assises = B["tolet"], []
    for rang in B["bancs"]:
        cb, (bx, by, bz) = pave(G.primitives[rang])
        demi, _ = au_flanc(cb)
        giron = abs(descend.dot(Vector((bx, by, 0))))
        planche(vieux, cb - travers * (demi + e / 2), cb + travers * (demi + e / 2), descend, HAUT, giron / 2, bz / 2,
                bz * D["ARETE"], "vieux")
        assises.append(cb.z + bz / 2)
        for avance in T["places"]:
            axe = Vector((cb.x, cb.y, sol)) + descend * (giron * avance)
            _, lisse_haute = au_flanc(axe)
            for s in COTES:
                pied = (axe + travers * (s * ((lisse_haute - poupe).dot(travers) + e / 2))
                        + HAUT * (lisse_haute.z - sol + demi_h * (1 - M["ancrage"])))
                tournee(bois, pied, pied + HAUT * (creux * T["hauteur"]), X, Y, creux * T["rayon"], T["profil"],
                        T["cotes"])

    A = B["rame"]
    rame = G.primitives[B["aviron"]]
    ca, _, la = rond(rame)
    _, file = AXES[rame["axis"]]
    file = file * math.copysign(1, file.dot(descend))
    ra = geometrie.apotheme(rame)
    ca.z = max(assises) + ra * A["manche"] * math.cos(math.pi / A["cotes"]) * (1 - M["ancrage"])
    pale, poignee = ca - file * (la / 2), ca - file * (la / 2) + file * (la * A["longueur"])
    profilee(bois, pale, pale.lerp(poignee, A["pale"]), (ra * A["section"][0], ra * A["section"][1]), A["profil"],
             MAT, HAUT.cross(file), HAUT)
    tournee(bois, pale.lerp(poignee, A["pale"] * A["emmanche"]), poignee, *normales(file), ra * A["manche"],
            A["fuseau"], A["cotes"])

    L = B["love"]
    glene = G.primitives[B["glene"]]
    cg, _, hg = rond(glene)
    brin = hg * L["brin"]
    for lit_k in range(L["lits"]):
        for spire in range(L["spires"]):
            tore(pieces["corde"], AXES[glene["axis"]][0], (cg.x, cg.y, fond + brin * (L["pose"] + L["pas"] * lit_k)),
                 geometrie.apotheme(glene) - brin * (1 + L["pas"] * spire + lit_k % 2), brin, *L["segments"],
                 "corde")


def etal(D, G, pieces, a):
    """Un étal d'après `ETAL` : coffre de planches entre quatre poteaux, plateau de planches, deux sablières, trois
    chevrons, un auvent de toile qui retombe en lambrequin plissé et festonné ; sur le plateau, une caissette et
    trois coupons de toile roulés."""
    E, bois, toile = D["ETAL"], pieces[MAT], pieces["toile"]
    c, (lx, ly, lz) = pave(G.primitives[E["coffre"]])
    cp, (px, py, pz) = pave(G.primitives[E["plateau"]])
    dessus = cp.z + pz / 2
    bordage(bois, cp, X, Y, px, py, pz, E["table"], D, a)
    e = ly * E["panneau"]["epaisseur"]
    for fil, dehors, long, demi in ((X, Y, lx, ly / 2), (Y, X, ly, lx / 2)):
        for s in COTES:
            bordage(bois, c + dehors * (s * (demi - e / 2)), fil, HAUT, long, lz, e, E["panneau"]["planches"], D, a)

    pente = rampant(G.primitives[E["auvent"]])
    descend, _, egout, _, large = pente
    travers = descend.cross(HAUT)
    V, Ch = E["toile"], E["charpente"]
    demi_c, haut_c = (large * part for part in Ch["chevron"])
    cl, (_, _, hl) = pave(G.primitives[E["lambrequin"]])
    chute = -HAUT * (hl * V["feston"])
    n, chevron, sur_sabliere = geometrie.dais(toile, pente, V, egout.z - (cl.z - hl / 2) + chute.z, chute,
                                              (haut_c, Ch["entaille"]), a)
    futs = sorted((pave(G.primitives[rang]) for rang in E["poteaux"]),
                  key=lambda fut: (round(fut[0].dot(descend), 6), fut[0].dot(travers)))
    sablieres = []
    for (p0, (cote, _, haut)), (p1, _) in (futs[:2], futs[2:]):
        appui = sur_sabliere(p0)
        demi_s, haut_s = (cote * part for part in Ch["sabliere"])
        s0, s1 = (Vector((p.x, p.y, appui - haut_s / 2)) for p in (p0, p1))
        debord = (s1 - s0).normalized() * (cote * Ch["debord"])
        planche(bois, s0 - debord, s1 + debord, descend, HAUT, demi_s, haut_s / 2, haut_s * D["ARETE"])
        for p in (p0, p1):
            profilee(bois, Vector((p.x, p.y, p.z - haut / 2)), Vector((p.x, p.y, appui - haut_s * Ch["ancrage"])),
                     (cote / 2 * Ch["poteau"],) * 2, POTEAU)
        sablieres.append((s0, s1, descend * (cote * Ch["debord"])))
    (h0, h1, queue), (b0, b1, _) = sablieres
    for part in Ch["chevrons"]:
        planche(bois, chevron(h0.lerp(h1, part) - queue), chevron(b0.lerp(b1, part) + queue), travers, n, demi_c,
                haut_c / 2, haut_c * D["ARETE"])

    Ca = E["caissette"]
    centre = Vector((cp.x + px / 2 * Ca["place"][0], cp.y + py / 2 * Ca["place"][1], dessus))
    hx, hy, haut_k, ais = px * Ca["cotes"][0], py * Ca["cotes"][1], pz * Ca["hauteur"], pz * Ca["ais"]
    planche(bois, centre - X * hx + HAUT * (ais * Ca["pose"]), centre + X * hx + HAUT * (ais * Ca["pose"]), Y, HAUT,
            hy, ais / 2, ais * D["ARETE"])
    for fil, dehors, long, demi in ((X, Y, hx, hy), (Y, X, hy - ais * Ca["pose"], hx)):
        for s in COTES:
            milieu = centre + dehors * (s * (demi - ais / 2)) + HAUT * (haut_k / 2)
            planche(bois, milieu - fil * long, milieu + fil * long, HAUT, dehors, haut_k / 2, ais / 2,
                    ais * D["ARETE"])
    Co = E["coupons"]
    r = pz * Co["rayon"]
    for dx, dz in ((-1, 1), (1, 1), (0, 1 + math.sqrt(3))):
        axe = Vector((cp.x + px / 2 * Co["place"] + dx * r * Co["serre"], cp.y, dessus + dz * r * Co["serre"]))
        portee = Y * (py / 2 * a.uniform(*Co["longueur"]))
        tournee(toile, axe - portee, axe + portee, X, HAUT, r, Co["profil"], Co["cotes"], "toile")


def tente(D, G, pieces, a):
    """Une tente d'après `TENTE` : une faîtière sur deux mâts, une toile d'un seul tenant passée sur la faîtière,
    qui fléchit, se creuse entre les arêtes tendues vers ses points de piquet et se relève au sol entre eux ; deux
    pignons de toile, l'un ouvert de la baie d'ombre de la recette, son pan roulé au-dessus ; deux piquets et leurs
    haubans de corde."""
    T, bois, toile, corde = D["TENTE"], pieces[MAT], pieces["toile"], pieces["corde"]
    faite = G.primitives[T["faitiere"]]
    cf, _, lf = rond(faite)
    _, file = AXES[faite["axis"]]
    apotheme = geometrie.apotheme(faite)
    pentes = [rampant(G.primitives[rang]) for rang in T["versants"]]
    (_, _, pied_du_versant, _, large), _ = pentes
    sol = pied_du_versant.z
    V, Pe, Pi = T["toile"], T["perche"], T["pignon"]
    epais, creux, fleche = (large * V[nom] for nom in ("epais", "creux", "fleche"))
    perche = apotheme - epais * Pe["jeu"]
    tournee(bois, cf - file * (lf / 2), cf + file * (lf / 2), *normales(file), perche, Pe["fuseau"], Pe["cotes"])
    sommet = cf + HAUT * (apotheme - epais / 2 - D["RETRAIT"])
    deport = creux + epais / 2

    def fil(pente, t):
        """Le point du fil de la toile sur le versant `pente`, à la part `t` du faîte au sol, sa normale vers le
        dehors et le sens où le versant monte."""
        descend, crete, egout, _, _ = pente
        monte = (crete - egout).normalized()
        n = monte.cross(descend.cross(HAUT))
        leve = deport * n.z + D["RETRAIT"]
        pied = egout - descend * ((deport + leve * n.z) / n.dot(descend)) + HAUT * leve
        return sommet.lerp(pied, t) - n * (fleche * math.sin(math.pi * t)), n, monte

    rangs = [(*fil(pentes[0], t), part, feston) for t, part, feston in reversed(V["pente"])]
    rangs.append((sommet, HAUT, HAUT, 0, 0))
    rangs += [(*fil(pentes[1], t), part, feston) for t, part, feston in V["pente"]]
    coque(toile, [onde(p, file, n, large / 2 * V["largeur"], epais, creux * part, V["festons"], 0, V["pas"],
                       V["festons"], monte * (large * V["releve"] * feston))
                  for p, n, monte, part, feston in rangs], "toile")

    co, (ox, oy, oz) = pave(G.primitives[T["entree"]])
    en_travers = HAUT.cross(file)
    baie = abs(en_travers.dot(Vector((ox, oy, 0))))
    planche(pieces["ombre"], co - HAUT * (oz / 2), co + HAUT * (oz / 2), en_travers, file, baie / 2,
            abs(file.dot(Vector((ox, oy, 0)))) / 2, epais * D["ARETE"], "ombre")
    for s in COTES:
        bout = cf + file * (s * large / 2 * Pi["place"])
        mat = bout - file * (s * perche * Pi["mat"])
        tournee(bois, Vector((mat.x, mat.y, sol)), mat, X, Y, perche, CYLINDRE, Pe["cotes"])
        for pente in pentes:
            descend = pente[0]
            pan = [bout]
            for t in Pi["rangs"]:
                p, n, _ = fil(pente, t)
                p = p - n * deport
                pan.append(p + file * (bout - p).dot(file))
            seuil = Vector((bout.x, bout.y, sol))
            jambage = descend * ((co - cf).dot(descend) + baie / 2)
            if (co - cf).dot(file) * s > 0 and (co - cf).dot(descend) > 0:
                linteau = Vector((bout.x, bout.y, co.z + oz / 2))
                pan += [seuil + jambage, linteau + jambage, linteau]
                roule = linteau + file * (s * large * Pi["rouleau"])
                tournee(toile, roule, roule + jambage, file, HAUT, large * Pi["rouleau"], Pi["boudin"], Pe["cotes"],
                        "toile")
            else:
                pan.append(seuil)
            coque(toile, [[p + file * (cote * epais / 2) for p in pan] for cote in COTES], "toile")

    Ha = T["hauban"]
    for rang in T["piquets"]:
        piquet = G.primitives[rang]
        cq, rq, hq = rond(piquet)
        pied = cq - HAUT * (hq / 2)
        geometrie.tourne(bois, piquet, T["piquet"], Pe["cotes"], MAT)
        prise = cf + file * (math.copysign(lf / 2, (cq - cf).dot(file)) * Ha["prise"])
        encoche = pied + HAUT * (hq * Ha["encoche"])
        geometrie.fil(corde, prise, encoche, rq * Ha["brin"], Ha["cotes"], "corde")


def foin(D, G, pieces, a):
    """Un tas de foin d'après `FOIN` : une meule bosselée en pointe, coiffée d'un chapeau qui retombe en frange
    épaisse et dentelée, et une couronne de gerbes liées jointives dressées contre elle, le pied évasé, les épis
    hérissés."""
    F, paille = D["FOIN"], pieces["paille"]
    assises = []
    for rang in F["assises"]:
        assise = G.primitives[rang]
        c, _, h = rond(assise)
        assises.append((c - HAUT * (h / 2), geometrie.apotheme(assise), h))

    def place(niveau):
        """Le centre du tas à `niveau` (rang d'une assise, part de sa hauteur), l'apothème et la hauteur de cette
        assise."""
        rang, part = niveau
        pied, apotheme, h = assises[rang]
        return pied + HAUT * (h * part), apotheme, h

    M, Ge = F["meule"], F["gerbes"]
    section = geometrie.bosselee(a, X, Y, M["cotes"], M["bosse"])
    anneaux = []
    for niveau, part, dent in M["profil"]:
        centre, apotheme, h = place(niveau)
        anneaux.append([p - HAUT * (h * dent * a.uniform(*M["dentelure"])) for p in section(centre, apotheme * part)])
    pointe, _, _ = place(M["pointe"])
    coque(paille, anneaux, "paille", pointe - HAUT * D["RETRAIT"])

    (pied_c, lim_p, _), (tete_c, lim_t, _) = place(Ge["pied"][0]), place(Ge["tete"][0])
    for k in range(Ge["nombre"]):
        dehors = cap(360 * (k + a.uniform(*Ge["ecart"])) / Ge["nombre"])
        pied, tete = pied_c + dehors * (lim_p * Ge["pied"][1]), tete_c + dehors * (lim_t * Ge["tete"][1])
        u = HAUT.cross(dehors)
        v = (tete - pied).normalized().cross(u)
        epis = [a.uniform(*Ge["epi"]) for _ in range(Ge["brins"])]
        coque(paille, [[q.lerp(pied.lerp(tete, t), herisse * epi) for q, epi in
                        zip(anneau(pied.lerp(tete, t), u, v if t else -dehors, lim_p * Ge["grosseur"] * part,
                                   Ge["brins"]), epis)] for t, part, herisse in Ge["profil"]], "paille")


def cargaison(D, G, pieces, a):
    """Une cargaison bâchée d'après `CARGAISON` : une palette de planches sur trois semelles ; une bâche d'un seul
    volume, à deux versants et deux croupes, plissée sur ses flancs et étranglée par trois sangles de corde qui en
    font le tour."""
    C, bois = D["CARGAISON"], pieces[MAT]
    c, (lx, ly, lz) = pave(G.primitives[C["palette"]])
    Pa, B = C["plateau"], C["bache"]
    e = lz * Pa["epaisseur"]
    sol, dessus = c.z - lz / 2, c.z + lz / 2
    bordage(bois, Vector((c.x, c.y, dessus - e / 2)), Y, X, ly, lx, e, Pa["planches"], D, a)
    for part in Pa["semelles"]:
        axe = Vector((c.x, c.y + ly / 2 * part, (sol + dessus - e * Pa["ancrage"]) / 2))
        planche(bois, axe - X * (lx / 2 * Pa["longueur"]), axe + X * (lx / 2 * Pa["longueur"]), Y, HAUT,
                ly * Pa["largeur"], (dessus - e * Pa["ancrage"] - sol) / 2, e * D["ARETE"])

    cb, (bx, by, bz) = pave(G.primitives[C["ballot"]])
    pentes = [rampant(G.primitives[rang]) for rang in C["versants"]]
    (descend, _, _, _, large), _ = pentes
    file = descend.cross(HAUT)
    demi_b = abs(file.dot(Vector((bx, by, 0)))) / 2
    bas = cb.z - bz / 2 - e * Pa["ancrage"]
    liens = [pave(G.primitives[rang]) for rang in C["cordes"]]
    places = [(cc - cb).dot(file) for cc, _ in liens]
    _, (kx, ky, _) = liens[0]
    brin = abs(file.dot(Vector((kx, ky, 0)))) / 2 * B["brin"]
    phase = a.uniform(0, 2 * math.pi)

    def contour(s, hors):
        """Le contour de la bâche à l'abscisse `s` le long de son faîte, d'un bas de flanc à l'autre par le faîte,
        ramené de `hors` vers le dehors."""
        croupe = min(1, (demi_b - abs(s)) / (demi_b - large / 2))
        serre = max(math.exp(-((s - place) / (large * B["sangle"])) ** 2) for place in places)
        pli = (1 + math.cos(2 * math.pi * B["plis"] * s / large + phase)) / 2
        points = []
        for (tombe, crete, egout, _, _), sens in zip(pentes, (1, -1)):
            faite = Vector((crete.x, crete.y, egout.z + (crete.z - egout.z) * croupe))
            n = tombe.cross(HAUT).cross((egout - faite).normalized())
            demi = []
            for niveau, plisse in B["contour"]:
                rentre = by * (B["marge"] + B["creux"] * plisse * pli + B["serre"] * serre) - hors
                if niveau > 1:
                    demi.append(egout.lerp(faite, niveau - 1) - n * rentre + file * s)
                else:
                    demi.append(Vector((egout.x, egout.y, bas + (egout.z - bas) * niveau)) - tombe * rentre
                                + file * s)
            points += demi[::sens]
        return points

    N = B["plis"] * B["pas"]
    coque(pieces["toile"], [contour(s, 0) for s in [-demi_b] + [large * (i / N - 1 / 2) for i in range(N + 1)]
                            + [demi_b]], "toile")
    for place in places:
        tour = contour(place, brin * B["pose"])
        courbee(pieces["corde"], tour + tour[:1], file, (brin, brin), B["cotes"], "corde")


def hamac(D, G, pieces, a):
    """Un hamac d'après `HAMAC` : deux poteaux à chanfreins arrêtés, deux barres d'écartement tournées, une toile
    qui pend de l'une à l'autre et se creuse, et à chaque bout une araignée de brins de corde nouée au poteau."""
    H, bois, corde = D["HAMAC"], pieces[MAT], pieces["corde"]
    ct, (_, ty, tz) = pave(G.primitives[H["toile"]])
    cc, (_, _, hc) = pave(G.primitives[H["creux"]])
    L, A = H["lit"], H["araignee"]
    brin = tz * A["brin"]
    barres = []
    for poteau, barre, lien in H["bouts"]:
        cp, (px, _, pz) = pave(G.primitives[poteau])
        profilee(bois, cp - HAUT * (pz / 2), cp + HAUT * (pz / 2), (px / 2 * H["poteau"],) * 2, POTEAU)
        cb, (bx, by, bz) = pave(G.primitives[barre])
        cl, _ = pave(G.primitives[lien])
        portee = Y * (by / 2)
        tournee(bois, cb - portee, cb + portee, X, HAUT, min(bx, bz) / 2, H["barre"], H["cotes"])
        noeud = Vector((cp.x, cp.y, cl.z))
        tore(corde, "z", tuple(noeud), px / 2 - brin - D["RETRAIT"], brin, *A["segments"], "corde")
        for part in A["brins"]:
            prise = cb + portee * part
            geometrie.fil(corde, noeud, prise, brin * A["fin"], H["cotes"], "corde")
        barres.append(cb)
    gauche, droite = barres
    epais = tz * L["epais"]
    fond = cc.z - hc / 2
    phase = a.uniform(0, 2 * math.pi)
    rangs = []
    for t, pli in L["rangs"]:
        fleche = math.sin(math.pi * t)
        rive = gauche.lerp(droite, t)
        rive.z -= (rive.z - ct.z) * fleche
        rangs.append(onde(Vector((rive.x, ct.y, rive.z)), Y, HAUT, ty / 2 * L["largeur"], epais, tz * pli, L["plis"],
                          phase, L["pas"], 1, -HAUT * ((rive.z - fond) * L["ventre"] * fleche)))
    coque(pieces["toile"], rangs, "toile")


BATIR = {"charrette": charrette, "diligence": diligence, "epave-carrosse": carrosse, "barque": barque,
         "etal-marche": etal, "tente": tente, "tas-foin": foin, "cargaison-bachee": cargaison, "hamac": hamac}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
