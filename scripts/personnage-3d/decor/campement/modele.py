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
from geometrie import (AXES, COTES, CYLINDRE, HAUT, MAT, POTEAU, X, Y, anneau, bordage, cap, cercle, cheville, coque,
                       courbee, lisse, normales, onde, pave, planche, profilee, rampant, rond, sous_le_rampant,
                       tournee)
from maille import lineaire, tore

DECORS = ("charrette", "epave-carrosse", "barque", "etal-marche", "tente", "tas-foin", "cargaison-bachee", "hamac")


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
        d = u * math.cos(tours) + w * math.sin(tours)
        tournee(m, centre + d * (rayon * R["pied"]), centre + d * (dedans * R["tete"]), essieu, essieu.cross(d),
                large / 2 * R["rai"], R["fuseau"], R["pans"])


def charrette(D, G, pieces, a):
    """Une charrette d'après `CHARRETTE` : plateau de planches en travers, quatre ridelles à lisses et montants
    chevillés, deux longerons qui filent en brancards, une traverse entre eux, un essieu sur ses cales, deux roues à
    rais cerclées de fer, moyeux de laiton."""
    C, bois, fer = D["CHARRETTE"], pieces[MAT], pieces["fer"]
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

    moyeux = []
    for bandage, jante, noix in C["roues"]:
        cercle_de_fer, boite = G.primitives[bandage], G.primitives[noix]
        ct, rt, lt = rond(cercle_de_fer)
        epais = rt * C["bandage"]
        cercle(fer, AXES[cercle_de_fer["axis"]][0], tuple(ct), rt - epais / 2, lt, epais, cercle_de_fer["sides"],
               "fer")
        cm, rm, lm = rond(boite)
        roue(bois, G.primitives[jante], rt - epais / 2, lt, D["ROUE"], (),
             (pieces["laiton"], "laiton", rm * math.cos(math.pi / boite["sides"]), lm / 2))
        moyeux.append((cm, rm))
    (gauche, rayon), (droite, _) = moyeux
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
    ca, ra, la = rond(rame)
    _, file = AXES[rame["axis"]]
    file = file * math.copysign(1, file.dot(descend))
    ra *= math.cos(math.pi / rame["sides"])
    ca.z = max(assises) + ra * A["manche"] * math.cos(math.pi / A["cotes"]) * (1 - M["ancrage"])
    pale, poignee = ca - file * (la / 2), ca - file * (la / 2) + file * (la * A["longueur"])
    profilee(bois, pale, pale.lerp(poignee, A["pale"]), (ra * A["section"][0], ra * A["section"][1]), A["profil"],
             MAT, HAUT.cross(file), HAUT)
    tournee(bois, pale.lerp(poignee, A["pale"] * A["emmanche"]), poignee, *normales(file), ra * A["manche"],
            A["fuseau"], A["cotes"])

    L = B["love"]
    glene = G.primitives[B["glene"]]
    cg, rg, hg = rond(glene)
    brin = hg * L["brin"]
    for lit_k in range(L["lits"]):
        for spire in range(L["spires"]):
            tore(pieces["corde"], AXES[glene["axis"]][0], (cg.x, cg.y, fond + brin * (L["pose"] + L["pas"] * lit_k)),
                 rg * math.cos(math.pi / glene["sides"]) - brin * (1 + L["pas"] * spire + lit_k % 2), brin,
                 *L["segments"], "corde")


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
    cf, rf, lf = rond(faite)
    _, file = AXES[faite["axis"]]
    apotheme = rf * math.cos(math.pi / faite["sides"])
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
        tournee(bois, pied, pied + HAUT * hq, X, Y, rq * math.cos(math.pi / piquet["sides"]), T["piquet"],
                Pe["cotes"])
        prise = cf + file * (math.copysign(lf / 2, (cq - cf).dot(file)) * Ha["prise"])
        encoche = pied + HAUT * (hq * Ha["encoche"])
        tournee(corde, prise, encoche, *normales((encoche - prise).normalized()), rq * Ha["brin"], CYLINDRE,
                Ha["cotes"], "corde")


def foin(D, G, pieces, a):
    """Un tas de foin d'après `FOIN` : une meule bosselée en pointe, coiffée d'un chapeau qui retombe en frange
    épaisse et dentelée, et une couronne de gerbes liées jointives dressées contre elle, le pied évasé, les épis
    hérissés."""
    F, paille = D["FOIN"], pieces["paille"]
    assises = []
    for rang in F["assises"]:
        assise = G.primitives[rang]
        c, r, h = rond(assise)
        assises.append((c - HAUT * (h / 2), r * math.cos(math.pi / assise["sides"]), h))

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
            tournee(corde, noeud, prise, *normales((prise - noeud).normalized()), brin * A["fin"], CYLINDRE,
                    H["cotes"], "corde")
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


BATIR = {"charrette": charrette, "epave-carrosse": carrosse, "barque": barque, "etal-marche": etal, "tente": tente,
         "tas-foin": foin, "cargaison-bachee": cargaison, "hamac": hamac}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
