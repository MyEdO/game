"""Les objets d'intérieur et les petits objets (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe
des primitives de sa recette (`gabarit.py`), dont il lit les cotes (`geometrie.pave`, `geometrie.rond`,
`geometrie.rampant`, `Gabarit.portee`) et où `Gabarit.rentrer` ramène le sommet qui en sortirait. Chaque pièce est une
coque close : une pièce tournée, profilée ou équarrie, une planche, une pièce plate découpée, une étoffe froncée, une
pièce ronde courbée, un cercle, une section bosselée et une onde, ceux de `geometrie` ; un tore et une révolution de
`maille` ; une pile de pièces (`pile`), de cette famille. Chaque matériau du décor est un nœud à son nom. L'aléa est
semé des codes de caractères de l'id du décor : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (ANGLES, AXES, COTES, CYLINDRE, FRONT, HAUT, MAT, POTEAU, X, Y, apotheme, autour, bosselee, cap,
                       cercle, clou, coque, courbee, decoupee, feuille, froncee, lisse, normales, onde, pave, planche,
                       profile, profilee, rampant, rond, tourne, tournee)
from maille import tore, tour

DECORS = ("miroir", "mannequin", "mannequin-couturier", "plante-pot", "bourse", "cle", "lettre", "tas-or")


def pile(m, pied, rayon, nombre, P, a):
    """`nombre` pièces de `rayon` empilées sur `pied`, d'après `P` (`PIECE`) : chacune tournée, épaisse de la part
    `epaisseur` de son rayon, entrée de la part `assise` de son épaisseur dans celle qui la porte, décalée d'au plus
    `ecart` (fraction du rayon)."""
    e = rayon * P["epaisseur"]
    for k in range(nombre):
        bas = (pied + HAUT * (e * k * (1 - P["assise"]))
               + (X * a.uniform(-1, 1) + Y * a.uniform(-1, 1)) * (rayon * P["ecart"]))
        tournee(m, bas, bas + HAUT * e, X, Y, rayon, P["profil"], P["cotes"], "laiton")


def miroir(D, G, pieces, a):
    """Une psyché d'après `MIROIR` : patins, montants, entretoise tournée, cadre entre les montants, moulure, glace
    devant son dos, pivots."""
    M, bois = D["MIROIR"], pieces["bois"]
    montants = []
    for patin, montant in zip(M["patins"], M["montants"]):
        profile(bois, G.primitives[patin], "y", M["patin"], MAT)
        cm, (mx, _, mz) = pave(G.primitives[montant])
        demi = mx / 2 * M["montant"]
        profilee(bois, cm - HAUT * (mz / 2), cm + HAUT * (mz / 2), (demi, demi), POTEAU)
        montants.append((cm, demi))
    (gauche, _), (droit, _) = montants
    ce, (_, ey, ez) = pave(G.primitives[M["entretoise"]])
    B = M["balustre"]
    tournee(bois, Vector((gauche.x, ce.y, ce.z)), Vector((droit.x, ce.y, ce.z)), Y, HAUT, min(ey, ez) / 2,
            B["profil"], B["cotes"])

    cc, (cx, cy, cz) = pave(G.primitives[M["cadre"]])
    cg, (gx, gy, gz) = pave(G.primitives[M["glace"]])
    large = min(abs(cm.x - cc.x) - demi for cm, demi in montants) - cx * M["jeu"]
    feuillure, arete = gx * M["feuillure"], cy * M["arete"]
    w, h = large - gx / 2 + feuillure, (cz - gz) / 2 + feuillure
    devant = math.copysign(1, cg.y - cc.y)
    saillie = abs(cg.y - cc.y) + gy / 2
    moulure = gx * M["moulure"]
    milieu = cc.y + devant * saillie / 2
    for cote in COTES:
        x, z = cc.x + cote * (large - w / 2), cc.z + cote * (cz / 2 - h / 2)
        planche(bois, Vector((x, cc.y, cc.z - cz / 2)), Vector((x, cc.y, cc.z + cz / 2)), X, Y, w / 2, cy / 2, arete)
        planche(bois, Vector((cc.x - large + w / 2, cc.y, z)), Vector((cc.x + large - w / 2, cc.y, z)), HAUT, Y,
                h / 2, cy / 2 * M["traverse"], arete)
        x, z = cg.x + cote * (gx / 2 - moulure / 2), cg.z + cote * (gz / 2 - moulure / 2)
        planche(bois, Vector((x, milieu, cg.z - gz / 2)), Vector((x, milieu, cg.z + gz / 2)), X, Y, moulure / 2,
                saillie / 2, moulure * M["quart"])
        planche(bois, Vector((cg.x - gx / 2, milieu, z)), Vector((cg.x + gx / 2, milieu, z)), HAUT, Y, moulure / 2,
                saillie / 2, moulure * M["quart"])
    for mat, y0, y1 in (("glace", 0.0, devant * saillie * M["tain"]), (MAT, -devant * cy / 2 * M["dos"], 0.0)):
        y = cc.y + (y0 + y1) / 2
        planche(pieces[mat], Vector((cg.x, y, cg.z - gz / 2)), Vector((cg.x, y, cg.z + gz / 2)), X, Y, gx / 2,
                abs(y1 - y0) / 2, arete, mat)

    P = M["pivot"]
    for cm, demi in montants:
        cote = math.copysign(1, cm.x - cc.x)
        axe = Vector((cm.x, cm.y, cc.z))
        tournee(bois, Vector((cc.x + cote * (large - w / 2), cm.y, cc.z)),
                axe + X * (cote * G.portee(axe, X * cote, D["RETRAIT"]) * P["portee"]), Y, HAUT, demi * P["rayon"],
                P["profil"], B["cotes"])


def mannequin(D, G, pieces, a):
    """Un mannequin d'entraînement d'après `MANNEQUIN` : socle, poteau, bras, sac de toile froncé sous ses liens et
    cousu devant, botte de paille, casque cerclé à nasal."""
    M, bois, corde, fer = D["MANNEQUIN"], pieces["bois"], pieces["corde"], pieces["fer"]
    casque = G.primitives[M["tete"]]
    sol, pied = tourne(bois, G.primitives[M["socle"]], M["tournes"]["socle"], M["cotes"], MAT)
    col, cime = tourne(pieces["laiton"], casque, M["tournes"]["casque"], M["cotes"], "laiton")
    rt = apotheme(casque)
    cp, (px, _, _) = pave(G.primitives[M["poteau"]])
    demi = px / 2 * M["cote"]
    profilee(bois, Vector((cp.x, cp.y, pied.lerp(sol, M["ancrage"]).z)),
             Vector((cp.x, cp.y, col.lerp(cime, M["ancrage"]).z)), (demi, demi), POTEAU)
    cb, (bx, by, bz) = pave(G.primitives[M["bras"]])
    large, haut = M["bras_section"]
    profilee(bois, cb - X * (bx / 2), cb + X * (bx / 2), (by / 2 * large, bz / 2 * haut), M["main"], MAT, Y, HAUT)

    def stations(table):
        """Les stations (`geometrie.froncee`) d'une étoffe autour du poteau, d'après `table` [(part de la
        hauteur du socle au casque, demi-profondeur en part de la portée vers +y, creux)], large de `carrure` fois sa
        profondeur."""
        sortie = []
        for t, part, creux in table:
            c = Vector((cp.x, cp.y, pied.z + (col.z - pied.z) * t))
            r = G.portee(c, Y, D["RETRAIT"]) * part
            sortie.append((c, (r * M["carrure"], r), creux))
        return sortie

    sac = stations(M["sac"])
    (plis, brins), (pas, pointes) = M["plis"], M["pas"]
    point = froncee(pieces["toile"], sac, plis, pas, a, "toile")
    froncee(pieces["paille"], stations(M["botte"]), brins, pointes, a, "paille")
    tours, section = M["tore"]
    for rang in M["liens"]:
        c, (du, dv), creux = sac[rang]
        serre, brin = du * (1 - creux / 2), du * M["corde"]
        tour(corde, [(brin * math.sin(s), serre + brin * math.cos(s), (serre + brin * math.cos(s)) * dv / du)
                     for s in (2 * math.pi * k / section for k in range(section))], "z", c, tours, "corde", ferme=True)
    brin = px / 2 * M["couture"]
    devant = math.atan2(FRONT.y, FRONT.x)
    courbee(corde, [point(s, devant) for s in sac], X, (brin, brin), section, "corde")

    cercles = []
    for rang in M["cercles"]:
        p = G.primitives[rang]
        c, _, h = rond(p)
        e = 2 * (apotheme(p) - rt)
        cercle(fer, AXES[p["axis"]][0], c, apotheme(p) - e / 2, h, e, M["cotes"], "fer")
        cercles.append((c, e))
    (bas, e), (dessus, _) = cercles
    planche(fer, bas + FRONT * rt, dessus + FRONT * rt, X, Y, rt * M["nasal"], e / 2, e * M["nasal"], "fer")


def couturier(D, G, pieces, a):
    """Un mannequin de couturier d'après `COUTURIER` : piètement en croix, fût, col et bouton tournés, buste froncé à
    sa basque et ses piqûres."""
    C, bois = D["COUTURIER"], pieces["bois"]
    for rang in C["pieds"]:
        _, (lx, ly, _) = pave(G.primitives[rang])
        profile(bois, G.primitives[rang], "x" if lx > ly else "y", C["patin"], MAT)
    for rang, profil, ancrage, mat in C["tournes"]:
        tourne(pieces[mat], G.primitives[rang], profil, C["cotes"], mat, ancrage)

    ch, (_, hy, hz) = pave(G.primitives[C["hanches"]])
    gauche, droit = (rampant(G.primitives[rang])[2] for rang in C["basques"])
    large, profond, godet = C["basque"]
    stations = [(ch - HAUT * (hz / 2), ((droit - gauche).length / 2 * large, hy / 2 * profond), godet)]
    for rang, t, large, profond in C["coupe"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        stations.append((c + HAUT * (lz * (t - 1 / 2)), (lx / 2 * large, ly / 2 * profond), 0.0))
    point = froncee(pieces["toile"], stations, C["plis"], C["pas"], a, "toile")
    rayon, cotes = C["piqure"]
    for azimut in C["piqures"]:
        courbee(pieces["toile"], [point(s, math.radians(azimut)) for s in stations], HAUT.cross(cap(azimut)),
                (hy * rayon, hy * rayon), cotes, "toile")


def plante(D, G, pieces, a):
    """Une plante en pot d'après `PLANTE` : pot tourné sous son bord, terre en butte, tronc, couronnes de feuilles."""
    P, bois = D["PLANTE"], pieces["bois"]
    tourne(bois, G.primitives[P["pot"]], P["pot_tourne"], P["cotes"], MAT)
    rp = apotheme(G.primitives[P["pot"]])
    bord = G.primitives[P["bord"]]
    cb, _, hb = rond(bord)
    dedans = rp * P["levre"]
    cercle(bois, AXES[bord["axis"]][0], cb, (apotheme(bord) + dedans) / 2, hb, apotheme(bord) - dedans, P["cotes"],
           MAT)
    tournee(pieces["terre"], cb - HAUT * (hb / 2), cb + HAUT * (hb / 2 + hb * P["butte"]), X, Y, rp * P["terre"],
            P["motte"], P["cotes"], "terre")
    F, tronc = P["fut"], G.primitives[P["tronc"]]
    souche, cime = tourne(bois, tronc, F["profil"], F["cotes"], MAT, (F["ancrage"], 0.0))

    depart = cime.lerp(souche, P["attache"])
    epais = apotheme(tronc) * P["epais"]
    ecart_azimut, ecart_elevation = P["jeu"]
    for nombre, azimut, elevation, part, largeur in P["couronnes"]:
        for k in range(nombre):
            vers = cap(azimut + 360 * k / nombre + a.uniform(-ecart_azimut, ecart_azimut))
            pente = math.radians(elevation + a.uniform(-ecart_elevation, ecart_elevation))
            d = autour(vers, HAUT, pente)
            long = G.portee(depart, d, D["RETRAIT"]) * part
            feuille(pieces["feuillage"], depart, d, HAUT.cross(vers), long, P, long * largeur, epais, "feuillage")


def bourse(D, G, pieces, a):
    """Une bourse d'après `BOURSE` : sac froncé à gueule creuse, cordon et ses deux brins, pièces empilées."""
    B, corde = D["BOURSE"], pieces["corde"]
    panse = G.primitives[B["panse"]]
    stations = []
    for nom, t, part, creux in B["sac"]:
        p = G.primitives[B[nom]]
        c, _, h = rond(p)
        stations.append((c + HAUT * (h * (t - 1 / 2)), (apotheme(p) * part,) * 2, creux))
    cl, (lx, ly, hl) = pave(G.primitives[B["lien"]])
    for t, part, creux in B["levre"]:
        stations.append((cl + HAUT * (hl * (t - 1 / 2)), (min(lx, ly) / 2 * part,) * 2, creux))
    point = froncee(pieces["cuir"], stations, B["plis"], B["pas"], a, "cuir", cl + HAUT * (hl * (B["gueule"] - 1 / 2)))
    c, (serre, _), creux = stations[B["noeud"]]
    cordon = apotheme(panse) * B["cordon"]
    tore(corde, AXES[panse["axis"]][0], c, serre * (1 - creux / 2) + cordon / 2, cordon, *B["tore"], "corde")
    for azimut in B["brins"]:
        chemin = [point(s, math.radians(azimut), cordon) for s in stations[B["chute"]:B["noeud"] + 1][::-1]]
        courbee(corde, lisse(chemin, B["pas"]), HAUT.cross(cap(azimut)), tuple(cordon * f for f in B["effile"]),
                B["brin_cotes"], "corde")
    for rang in B["pieces"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        pile(pieces["laiton"], c - HAUT * (lz / 2), min(lx, ly) / 2 * B["piece"], B["nombre"], D["PIECE"], a)


def cle(D, G, pieces, a):
    """Une clé couchée, sa tige le long de x, d'après `CLE` : anneau posé au sol, tige tournée, panneton découpé."""
    C, fer = D["CLE"], pieces["fer"]
    ct, (tx, _, _) = pave(G.primitives[C["tige"]])
    ca, (ax, ay, az) = pave(G.primitives[C["anneau"]])
    cb, (bx, _, _) = pave(G.primitives[C["panneton"]])
    petit = az / 2 * C["fer"]
    grand = min(ax, ay) / 2 * C["dehors"] - petit
    z = ca.z - az / 2 + petit
    tore(fer, "z", (ca.x, ca.y, z), grand, petit, *C["tore"], "fer")
    vers = math.copysign(1, ct.x - ca.x)
    bout = Vector((ct.x + vers * tx / 2, ct.y, z))
    T = C["tournee"]
    tournee(fer, Vector((ca.x + vers * grand, ct.y, z)), bout, Y, HAUT, petit, T["profil"], T["cotes"], "fer")
    cote = math.copysign(1, cb.y - ct.y)
    x0, x1 = cb.x - vers * bx / 2, bout.x - vers * tx * C["bout"]
    profond = G.portee(Vector((cb.x, ct.y, z)), Y * cote, D["RETRAIT"])
    decoupee(fer, [Vector((x0 + (x1 - x0) * s, ct.y + cote * profond * t, z)) for s, t in C["dents"]], HAUT,
             (-petit * C["lame"], petit * C["lame"]), petit * C["arete"], "fer")


def lettre(D, G, pieces, a):
    """Une lettre d'après `LETTRE` : pliée sous ses quatre rabats, fermée d'un sceau godronné, un feuillet gondolé à
    côté."""
    L, papier = D["LETTRE"], pieces["papier"]
    c, (lx, ly, lz) = pave(G.primitives[L["pli"]])
    cs, (sx, sy, sz) = pave(G.primitives[L["sceau"]])
    sol = c - HAUT * (lz / 2)
    coins = [sol + X * (i * lx / 2 * L["marge"]) + Y * (j * ly / 2 * L["marge"]) for i, j in ANGLES]
    corps, arete = lz * L["corps"], lz * L["arete"]
    decoupee(papier, coins, HAUT, (0.0, corps), arete, "papier")
    pointe = Vector((cs.x, cs.y, sol.z))
    for g, d, dessus in zip(coins, coins[1:] + coins[:1], L["rabats"]):
        decoupee(papier, [g, d, pointe], HAUT, (corps * L["charniere"], lz * dessus), arete, "papier")
    haut = cs.z + sz / 2 - sol.z - corps
    r = min(sx, sy) / 2
    froncee(pieces["cire"], [(pointe + HAUT * (corps + haut * t), (r * part, r * part), creux)
                             for t, part, creux in L["cire"]], L["plis"], L["pas"], a, "cire")

    F = L["feuille"]
    cf, (fx, fy, fz) = pave(G.primitives[L["feuillet"]])
    cote = math.copysign(1, cf.y - c.y)
    epais, creux = fz * F["epais"], fz * F["creux"]
    z = cf.z - fz / 2 + creux + epais / 2
    coque(papier, [onde(Vector((cf.x, y, z)), X, HAUT, fx / 2 * L["marge"], epais, creux, F["plis"],
                        math.pi * (1 + 2 * a.randrange(F["pas"]) / F["pas"]), F["pas"], 0, Vector())
                   for y in (c.y + cote * (ly / 2 * L["marge"] - ly * L["glisse"]), cf.y + cote * fy / 2 * L["marge"])],
          "papier")


def tresor(D, G, pieces, a):
    """Un trésor d'après `TRESOR` : tas bosselé semé de pièces, piles à son pied, calice creux garni, coffret de
    planches à couvercle de fer, pentures cloutées et serrure."""
    T, P, tas, bois, fer = D["TRESOR"], D["PIECE"], pieces["laiton"], pieces["bois"], pieces["fer"]
    section = bosselee(a, X, Y, T["cotes"], T["bosse"])
    anneaux = []
    for rang, t, part in T["talus"]:
        p = G.primitives[rang]
        c, _, h = rond(p)
        anneaux.append(section(c + HAUT * (h * (t - 1 / 2)), apotheme(p) * part))
    coque(tas, anneaux, "laiton")
    rayon = apotheme(G.primitives[T["eparses"]]) * T["piece"]
    epais = rayon * P["epaisseur"]
    rangs = range(T["depuis"], len(anneaux) - 1)
    tours = [(anneaux[i][0] - anneaux[i][T["cotes"] // 2]).length for i in rangs]
    for i in a.choices(rangs, tours, k=T["semis"]):
        j, s, t = a.randrange(T["cotes"]), a.random(), a.random()
        bas, haut = anneaux[i], anneaux[i + 1]
        p = bas[j].lerp(haut[j], s).lerp(bas[j - 1].lerp(haut[j - 1], s), t)
        n = (haut[j] - bas[j]).cross(bas[j - 1] - bas[j]).normalized()
        n = (n + Vector([a.uniform(-T["penche"], T["penche"]) for _ in range(3)])).normalized()
        tournee(tas, p - n * (epais * T["enfonce"]), p + n * epais, *normales(n), rayon, CYLINDRE, P["cotes"], "laiton")
    centre, _, _ = rond(G.primitives[T["tas"]])
    for rang, part, nombre in T["piles"]:
        c, _, h = rond(G.primitives[rang])
        pile(tas, Vector((centre.x + (c.x - centre.x) * part, centre.y + (c.y - centre.y) * part, c.z - h / 2)),
             rayon, nombre, P, a)

    calice = G.primitives[T["calice"]]
    c, _, h = rond(calice)
    tour(tas, [(h * (t - 1 / 2), apotheme(calice) * part) for t, part in T["coupe"]], AXES[calice["axis"]][0], c,
         T["cotes"], "laiton")
    pile(tas, c + HAUT * (h * (T["coupe"][-1][0] - 1 / 2)), rayon, T["garni"], P, a)

    K = T["coffre"]
    cc, (lx, ly, lz) = pave(G.primitives[T["caisse"]])
    ck, (kx, ky, kz) = pave(G.primitives[T["couvercle"]])
    hx, hy = lx / 2 * K["corps"], ly / 2 * K["corps"]
    rang = lz / K["planches"]
    for k in range(K["planches"]):
        z = cc.z - lz / 2 + rang * (k + 1 / 2)
        planche(bois, Vector((cc.x - hx, cc.y, z)), Vector((cc.x + hx, cc.y, z)), Y, HAUT, hy, rang / 2,
                rang * K["arete"])
    planche(fer, ck - X * (kx / 2), ck + X * (kx / 2), Y, HAUT, ky / 2, kz / 2, kz * K["arete"], "fer")
    jeu = ly / 2 - hy
    ferrure = jeu * K["fer"]
    for cote in COTES:
        for part in K["pentures"]:
            penture = Vector((cc.x + lx * part, cc.y + cote * hy, cc.z))
            planche(fer, penture - HAUT * (lz / 2), penture + HAUT * (lz / 2), X, Y, lx * K["bande"], ferrure,
                    ferrure * K["arete"], "fer")
            for t in K["clous"]:
                clou(fer, penture + Y * (cote * ferrure) + HAUT * (lz * (t - 1 / 2)), Y * cote, D["CLOU"], jeu, "fer")
    large, bas, haut = K["serrure"]
    face = Vector((cc.x, cc.y - hy, cc.z - lz / 2))
    planche(tas, face + HAUT * (lz * bas), face + HAUT * (lz * haut), X, Y, lx * large, ferrure, ferrure * K["arete"],
            "laiton")
    clou(fer, face - Y * ferrure + HAUT * (lz * (bas + haut) / 2), -Y, D["CLOU"], jeu, "fer")


BATIR = {"miroir": miroir, "mannequin": mannequin, "mannequin-couturier": couturier, "plante-pot": plante,
         "bourse": bourse, "cle": cle, "lettre": lettre, "tas-or": tresor}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
