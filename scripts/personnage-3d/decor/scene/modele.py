"""La scène (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène le sommet
qui en sortirait. Chaque pièce est une coque close : une étoffe plissée, la coque de ses contours d'un rang à l'autre
(`geometrie.onde`) ; des degrés de planches sur leurs joues (`gradins`) ; une pièce tournée, une planche, une planche
rampante, une pièce équarrie, une pièce profilée, une pièce ronde courbée, un cercle, le dais d'une tribune et une rampe
d'escalier, ceux de `geometrie` ; un tore de `maille`. Chaque matériau du décor est un nœud à son nom, les flammes celui
qui luit (`gabarit.NOEUD_EMISSIF`). L'aléa est semé des codes de caractères de l'id du décor : deux constructions
rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (COTES, CYLINDRE, FRONT, HAUT, MAT, POTEAU, X, Y, barre, bougie, cercle, chaine, coque, courbee,
                       lisse, onde, partage, pave, planche, profilee, rampant, rond, tournee)
from gabarit import NOEUD_EMISSIF
from maille import lineaire, tore

DECORS = ("pupitre-chef", "tribune", "balustrade-loge", "rangee-sieges", "rideau-scene", "escalier-loge",
          "lustre-opera", "portant-costumes", "decor-flat")
FLAMME = "flamme"
"""Le matériau de ce qui luit, que porte le nœud `gabarit.NOEUD_EMISSIF`."""


def gradins(m, degres, S, D, a):
    """Les degrés de bois des boîtes `degres` [(centre, côtés)], du plus bas au plus haut, d'après `S` : par degré,
    des planches en travers, une contremarche sous le nez depuis le dessous des planches du degré d'en bas, des joues
    du sol aux planches."""
    nez = degres[0][0] - degres[-1][0]
    nez.z = 0
    nez.normalize()
    travers = nez.cross(HAUT)
    bas = degres[0][0].z - degres[0][1][2] / 2
    for c, (lx, ly, lz) in degres:
        giron = abs(nez.dot(Vector((lx, ly, 0))))
        portee = travers * ((lx + ly - giron) / 2)
        dessus, e = c.z + lz / 2, giron * S["epaisseur"]
        sous = dessus - e + e * S["ancrage"]
        bornes = [giron * (part - 1 / 2) for part in partage(a, S["planches"], S["ecart"])]
        for g0, g1 in zip(bornes, bornes[1:]):
            axe = Vector((c.x, c.y, dessus - e / 2)) + nez * ((g0 + g1) / 2)
            planche(m, axe - portee, axe + portee, nez, HAUT, (g1 - g0) / 2 - giron * S["jour"], e / 2,
                    e * D["ARETE"])
        face = Vector((c.x, c.y, (bas + sous) / 2)) + nez * (giron / 2 - giron * S["retrait"])
        planche(m, face - portee, face + portee, HAUT, nez, (sous - bas) / 2, e * S["contremarche"] / 2,
                e * D["ARETE"])
        for part in S["joues"]:
            pied = Vector((c.x, c.y, c.z - lz / 2)) + portee * part
            planche(m, pied, Vector((pied.x, pied.y, sous)), nez, travers, giron / 2, e / 2, e * D["ARETE"])
        bas = dessus - e


def pupitre(D, G, pieces, a):
    """Un pupitre d'après `PUPITRE` : estrade de planches sur sa ceinture, pied et fût tournés, tablette inclinée à
    rebord, deux pages."""
    P, bois, fer = D["PUPITRE"], pieces[MAT], pieces["fer"]
    c, (lx, ly, lz) = pave(G.primitives[P["estrade"]])
    L, K = P["plancher"], P["ceinture"]
    dessus, e = c.z + lz / 2, lz * L["epaisseur"]
    bornes = [c.y + ly * (part - 1 / 2) for part in partage(a, L["planches"], L["ecart"])]
    for y0, y1 in zip(bornes, bornes[1:]):
        axe = Vector((c.x, (y0 + y1) / 2, dessus - e / 2))
        planche(bois, axe - X * (lx / 2), axe + X * (lx / 2), Y, HAUT, (y1 - y0) / 2 - ly * L["jour"], e / 2,
                e * D["ARETE"])
    retrait, demi = lz * K["retrait"], lz * K["epaisseur"]
    sol, sous = c.z - lz / 2, dessus - e + e * K["ancrage"]
    ceinture = Vector((c.x, c.y, (sol + sous) / 2))
    for s in COTES:
        longue, courte = ceinture + Y * (s * (ly / 2 - retrait)), ceinture + X * (s * (lx / 2 - retrait))
        planche(bois, longue - X * (lx / 2 - retrait), longue + X * (lx / 2 - retrait), Y, HAUT, demi,
                (sous - sol) / 2, demi * D["ARETE"])
        planche(bois, courte - Y * (ly / 2 - retrait), courte + Y * (ly / 2 - retrait), X, HAUT, demi,
                (sous - sol) / 2, demi * D["ARETE"])

    descend, crete, bord, _, largeur = rampant(G.primitives[P["tablette"]])
    tz = crete.z - bord.z
    travers = descend.cross(HAUT)
    d = (bord - crete).normalized()
    n = travers.cross(d)
    T = P["plaque"]
    epais, jeu = tz * T["epaisseur"], tz * T["jeu"]
    milieu, portee = crete.lerp(bord, 1 / 2) - n * (jeu + epais / 2), d * ((bord - crete).length / 2 * T["longueur"])
    demi_large = largeur / 2 * T["largeur"]
    planche(fer, milieu - portee, milieu + portee, travers, n, demi_large, epais / 2, epais * D["ARETE"], "fer")
    rebord = milieu + portee - d * (tz * T["rebord"]) + n * (epais / 2)
    planche(fer, rebord - travers * demi_large, rebord + travers * demi_large, d, n, tz * T["rebord"], jeu,
            jeu * D["ARETE"], "fer")

    cp, (px, py, pz) = pave(G.primitives[P["pied"]])
    cf, (fx, _, fz) = pave(G.primitives[P["fut"]])
    pose = pz * P["ancrage"]
    tournee(fer, cp - HAUT * (pz / 2 + pose), cp + HAUT * (pz / 2), X, Y, min(px, py) / 2, P["pied_tourne"]["profil"],
            P["pied_tourne"]["cotes"], "fer")
    sous_tablette = milieu.z + (Vector((cf.x, cf.y, milieu.z)) - milieu).dot(descend) / d.dot(descend) * d.z
    tournee(fer, cf - HAUT * (fz / 2 + pose), Vector((cf.x, cf.y, sous_tablette)), X, Y, fx / 2,
            P["fut_tourne"]["profil"], P["fut_tourne"]["cotes"], "fer")

    Pa = P["pages"]
    cs, (sx, sy, _) = pave(G.primitives[P["partition"]])
    feuille, large = jeu * Pa["epaisseur"], abs(travers.dot(Vector((sx, sy, 0))))
    pied = milieu + portee - d * (2 * tz * T["rebord"]) + n * (epais / 2 + feuille / 2)
    pied += travers * (cs - pied).dot(travers)
    for s in COTES:
        rive = pied + travers * (s * large / 4)
        planche(pieces["papier"], rive - portee * (2 * Pa["longueur"]), rive, travers, n,
                large / 4 - large * Pa["jour"], feuille / 2, feuille * D["ARETE"], "papier")


def tribune(D, G, pieces, a):
    """Une tribune d'après `TRIBUNE` : trois degrés, quatre poteaux, sablières, chevrons et faîtière, dais de toile à
    deux versants et ses lambrequins."""
    T, bois = D["TRIBUNE"], pieces[MAT]
    gradins(bois, [pave(G.primitives[rang]) for rang in T["gradins"]], D["DEGRE_DE_TRIBUNE"], D, a)
    V, C = T["dais"], T["charpente"]
    cretes = []
    for rang, poteaux in T["versants"]:
        pente = rampant(G.primitives[rang])
        descend, crete, _, _, large = pente
        travers = descend.cross(HAUT)
        demi_c, haut_c = (large * part for part in C["chevron"])
        n, chevron, sur_sabliere = geometrie.dais(pieces["toile"], pente, V, large * V["tombee"],
                                                  -HAUT * (large * V["feston"]), (haut_c, C["entaille"]), a)
        (p0, r, _), (p1, _, _) = axes = [rond(G.primitives[poteau]) for poteau in poteaux]
        recul = -descend * (r * C["deport"])
        demi_s, haut_s = (r * part for part in C["sabliere"])
        appui = sur_sabliere(p0 + recul)
        s0, s1 = (Vector((p.x, p.y, appui - haut_s / 2)) + recul for p in (p0, p1))
        debord = (s1 - s0).normalized() * (r * C["debord"])
        planche(bois, s0 - debord, s1 + debord, descend, HAUT, demi_s, haut_s / 2, haut_s * D["ARETE"])
        for cp, _, h in axes:
            profilee(bois, Vector((cp.x, cp.y, cp.z - h / 2 - r * C["ancrage"])),
                     Vector((cp.x, cp.y, appui - haut_s + r * C["ancrage"])), (r * C["poteau"],) * 2, POTEAU)
        for part in C["chevrons"]:
            pied = s0.lerp(s1, part)
            planche(bois, chevron(pied), chevron(pied - descend * (pied - crete).dot(descend)), travers, n, demi_c,
                    haut_c / 2, haut_c * D["ARETE"])
        cretes.append((crete, chevron(crete).z - haut_c / 2, travers * (large / 2 * V["largeur"])))

    (c0, sous0, portee), (c1, sous1, _) = cretes
    dessus, dessous = min(c0.z, c1.z), min(sous0, sous1)
    milieu = Vector(((c0.x + c1.x) / 2, (c0.y + c1.y) / 2, (dessus + dessous) / 2))
    planche(bois, milieu - portee, milieu + portee, portee.normalized().cross(HAUT), HAUT,
            portee.length * C["faitiere"], (dessus - dessous) / 2, (dessus - dessous) * D["ARETE"])


def balustrade(D, G, pieces, a):
    """Une balustrade d'après `BALUSTRADE` : lisse basse et main courante moulurées, balustres de laiton tournés,
    tenture plissée pendue sous la main courante."""
    B, bois = D["BALUSTRADE"], pieces[MAT]
    for nom, moulures in B["moulures"].items():
        c, (lx, ly, lz) = pave(G.primitives[B[nom]])
        for bas, haut, large in moulures:
            axe = c + HAUT * (lz * ((bas + haut) / 2 - 1 / 2))
            planche(bois, axe - X * (lx / 2), axe + X * (lx / 2), Y, HAUT, ly / 2 * large, lz * (haut - bas) / 2,
                    lz * (haut - bas) * D["ARETE"])

    futs = [rond(G.primitives[rang]) for rang in B["balustres"]]
    _, r, h = futs[0]
    axes = [c for c, _, _ in futs]
    axes += [g.lerp(d, k / (B["entre"] + 1)) for g, d in zip(axes, axes[1:]) for k in range(1, B["entre"] + 1)]
    portee = HAUT * (h / 2 + h * B["ancrage"])
    for c in axes:
        tournee(pieces["laiton"], c - portee, c + portee, X, Y, r, D["BALUSTRE"], B["cotes"], "laiton")

    T = B["drape"]
    ct, (tx, ty, tz) = pave(G.primitives[B["tenture"]])
    cm, (_, my, mz) = pave(G.primitives[B["main"]])
    front = Y * math.copysign(1, ct.y - cm.y)
    part_z, part_y = T["prise"]
    prise = Vector((ct.x, cm.y, cm.z - mz / 2 + mz * part_z)) + front * (my / 2 * part_y)
    chute = -HAUT * (tz * T["feston"])
    fil = Vector((ct.x, ct.y, ct.z - tz / 2)) - front * (ty * T["recul"]) - chute
    phase = a.uniform(0, 2 * math.pi)
    coque(pieces["toile"], [onde(Vector((ct.x, prise.y + (fil.y - prise.y) * avance, prise.z + (fil.z - prise.z) * t)),
                                 X, front, tx / 2, ty * T["epais"], ty * creux, T["plis"], phase, T["pas"],
                                 T["festons"], chute * feston)
                            for t, avance, creux, feston in T["rangs"]], "toile")


def rangee(D, G, pieces, a):
    """Une rangée de fauteuils d'après `RANGEE` : joues et manchettes, ceintures, montants, coussins et dossiers
    garnis sur leur fond de bois, lisse dorée."""
    S, bois, toile = D["RANGEE"], pieces[MAT], pieces["toile"]
    cs, (sx, sy, sz) = pave(G.primitives[S["socle"]])
    ca, (_, ay, az) = pave(G.primitives[S["assise"]])
    cd, (dx, dy, dz) = pave(G.primitives[S["dossier"]])
    cg, (gx, gy, gz) = pave(G.primitives[S["galon"]])
    sol = cs.z - sz / 2
    arriere = Y * math.copysign(1, cd.y - ca.y)

    recette = [pave(G.primitives[rang]) for rang in S["accoudoirs"]]
    _, (mx, my, mz) = recette[0]
    axes = [g.lerp(d, k / S["places"]) for (g, _), (d, _) in zip(recette, recette[1:]) for k in range(S["places"])]
    axes.append(recette[-1][0])
    J, M = S["joue"], S["montant"]
    demi_j, cote = my * J["epaisseur"], dy / 2 * M["cote"]
    for p in axes:
        pied = Vector((min(max(p.x, cs.x - sx / 2 + demi_j), cs.x + sx / 2 - demi_j), p.y, sol))
        tete = Vector((p.x, p.y, p.z - mz / 2 + mz * J["appui"]))
        barre(bois, [(pied.lerp(tete, t), demi_j, my / 2 * profond, demi_j * chanfrein)
                     for t, profond, chanfrein in J["profil"]], X, Y)
        planche(bois, p - Y * (my / 2), p + Y * (my / 2), X, HAUT, mx / 2, mz / 2, mz * D["ARETE"])
        x = min(max(p.x, cs.x - sx / 2 + cote), cs.x + sx / 2 - cote)
        profilee(bois, Vector((x, cd.y, sol + sz * M["pied"])), Vector((x, cd.y, cg.z)), (cote, cote), POTEAU)

    K = S["ceinture"]
    haut_k = sz * K["hauteur"]
    for s in COTES:
        axe = Vector((cs.x, cs.y + s * sy / 2 * K["place"], cs.z + sz / 2 - haut_k / 2 + haut_k * K["ancrage"]))
        planche(bois, axe - X * (sx / 2), axe + X * (sx / 2), Y, HAUT, sy * K["largeur"], haut_k / 2,
                haut_k * D["ARETE"])

    Ga = S["garni"]
    etoffe, fond = dy * Ga["etoffe"], dy * Ga["fond"]
    planche(bois, cd + arriere * (dy / 2 - fond / 2) - X * (dx / 2), cd + arriere * (dy / 2 - fond / 2) + X * (dx / 2),
            HAUT, Y, dz / 2, fond / 2, fond * D["ARETE"])
    planche(pieces["laiton"], cg - X * (gx / 2), cg + X * (gx / 2), Y, HAUT, gy / 2, gz / 2, gz * D["ARETE"], "laiton")
    for g, d in zip(axes, axes[1:]):
        demi = (d.x - g.x) / 2 - (d.x - g.x) * S["coussin"]["jour"]
        milieu = Vector(((g.x + d.x) / 2, ca.y, ca.z))
        profilee(toile, milieu - Y * (ay / 2), milieu + Y * (ay / 2), (demi, az / 2), D["COUSSIN"], "toile", X, HAUT)
        garni = Vector((milieu.x, cd.y, cd.z)) - arriere * (dy / 2 - etoffe / 2)
        profilee(toile, garni - HAUT * (dz / 2), garni + HAUT * (dz / 2), (demi, etoffe / 2), D["COUSSIN"], "toile")


def rideau(D, G, pieces, a):
    """Un rideau de scène d'après `RIDEAU` : tringle à pommes et anneaux, frise plissée bordée de son galon, deux
    pans plissés serrés chacun dans une embrasse de deux cordons."""
    R, toile, laiton, fer = D["RIDEAU"], pieces["toile"], pieces["laiton"], pieces["fer"]
    T, F = R["barre"], R["lambrequin"]
    ct, (tx, _, tz) = pave(G.primitives[R["tringle"]])
    cf, (fx, fy, fz) = pave(G.primitives[R["frise"]])
    cg, (_, _, gz) = pave(G.primitives[R["galon"]])
    tournee(fer, ct - X * (tx / 2), ct + X * (tx / 2), Y, HAUT, tz / 2, T["profil"], T["cotes"], "fer")
    N = T["anneaux"]
    demi = fx / 2 * F["largeur"]
    for k in range(N["nombre"]):
        cercle(fer, "x", (cf.x + demi * (2 * (k + 1 / 2) / N["nombre"] - 1), ct.y, ct.z),
               tz / 2 * N["rayon"], tz / 2 * N["largeur"], tz / 2 * N["epaisseur"], N["segments"], "fer")

    phase = a.uniform(0, 2 * math.pi)
    chute = -HAUT * (fz * F["feston"])
    bas = cg.z - chute.z
    coque(toile, [onde(Vector((cf.x, ct.y + (cf.y - ct.y) * avance, ct.z + (bas - ct.z) * t)), X, Y, demi,
                       fy * F["epais"], fy / 2 * creux, F["plis"], phase, F["pas"], F["festons"], chute * feston)
                  for t, avance, creux, feston in F["rangs"]], "toile")
    coque(laiton, [onde(Vector((cf.x, cf.y, bas + gz / 2 * s)), X, Y, demi, fy * R["frange"]["epais"],
                        fy / 2 * F["rangs"][-1][2], F["plis"], phase, F["pas"], F["festons"], chute)
                   for s in COTES], "laiton")

    P, C = R["pan"], R["cordon"]
    for rang, embrasse in zip(R["pans"], R["embrasses"]):
        cp, (px, py, pz) = pave(G.primitives[rang])
        ce, (_, _, ez) = pave(G.primitives[embrasse])
        dehors = math.copysign(1, cp.x - cf.x)
        rive = cp.x + dehors * px / 2
        brin = ez / 2 * C["brin"]
        grand = py / 2 * C["rayon"] - brin
        serre, axe = (grand - brin) * P["serre"], grand + brin + D["RETRAIT"]
        etages = ((0, cp.z - pz / 2), (1, ce.z), (2, cp.z + pz / 2))
        phase = a.uniform(0, 2 * math.pi)
        rangs = [(lineaire(etages, t), serre + (px / 2 - serre) * ouvert, axe + (px / 2 - axe) * ouvert, creux)
                 for t, ouvert, creux in P["rangs"]]
        coque(toile, [onde(Vector((rive - dehors * milieu, cp.y, z)), X, Y, large, py * P["epais"],
                           min(py / 2, large) * creux, P["plis"], phase, P["pas"], 1, Vector())
                      for z, large, milieu, creux in rangs], "toile")
        for s in COTES:
            tore(laiton, "z", (rive - dehors * axe, cp.y, ce.z + s * brin), grand, brin, *C["segments"], "laiton")


def escalier(D, G, pieces, a):
    """Un escalier d'après `ESCALIER` : quatre marches, et sa rampe (`geometrie.rampe`) : lisse basse, deux pilastres
    à boule de laiton, lisse et main courante rampantes, balustres tournés."""
    E, bois = D["ESCALIER"], pieces[MAT]
    gradins(bois, [pave(G.primitives[rang]) for rang in E["marches"]], D["DEGRE_D_ESCALIER"], D, a)
    geometrie.rampe(bois, G, E["rampe"], D["ARETE"], (pieces["laiton"], "laiton"))


def lustre(D, G, pieces, a):
    """Un lustre d'après `LUSTRE` : chaîne, tige, corbeille et cul-de-lampe tournés, deux couronnes de bras cintrés
    liés entre voisins, bobèches, bougies et flammes."""
    L, laiton = D["LUSTRE"], pieces["laiton"]
    for rang in ("culot", "corbeille", "tige"):
        geometrie.tourne(laiton, G.primitives[L[rang]], L["tournes"][rang], L["cotes"], "laiton")
    axe, r_tige, _ = rond(G.primitives[L["tige"]])

    Br = L["bras"]
    for etage in L["etages"]:
        depart, _ = pave(G.primitives[etage["traverse"]])
        boites = sorted((pave(G.primitives[rang]) for rang in etage["bougies"]),
                        key=lambda b: math.atan2(b[0].y - axe.y, b[0].x - axe.x))
        chemins = []
        for c, (cote, _, haut) in boites:
            pied = c - HAUT * (haut / 2)
            vers = Vector((pied.x - axe.x, pied.y - axe.y, 0))
            portee = vers.length
            vers.normalize()
            origine = Vector((axe.x, axe.y, depart.z))
            chemin = lisse([origine + vers * (portee * fr) + HAUT * (portee * fz) for fr, fz in Br["chemin"]] + [pied],
                           Br["pas"])
            courbee(laiton, chemin, HAUT.cross(vers), tuple(r_tige * part for part in Br["rayons"]), Br["cotes"],
                    "laiton")
            chemins.append(chemin)
            bougie(laiton, pieces["cire"], pieces[NOEUD_EMISSIF], pied, cote / 2, cote / 2, pied.z + haut * L["meche"],
                   L["bougie"])
        for g, d in zip(chemins, chemins[1:] + chemins[:1]):
            p, q = g[Br["lien"] * Br["pas"]], d[Br["lien"] * Br["pas"]]
            geometrie.fil(laiton, p, q, r_tige * Br["tringle"], Br["cotes"], "laiton")

    M = L["maillons"]
    cc, (cote, _, haut) = pave(G.primitives[L["chaine"]])
    fer = cote / 2 * M["fer"]
    grand = cote / 2 * M["dehors"] - fer
    bas = cc.z - haut / 2 + grand - fer
    chaine(pieces["fer"], cc.x, cc.y, bas, bas + haut - 2 * grand, M["nombre"], grand, fer, M["segments"], "fer")


def portant(D, G, pieces, a):
    """Un portant d'après `PORTANT` : patins, montants, entretoise et tringle de fer, quatre costumes à godets pendus
    à leur crochet."""
    P, fer = D["PORTANT"], pieces["fer"]
    futs = []
    for patin, montant in zip(P["pieds"], P["montants"]):
        geometrie.profile(fer, G.primitives[patin], "y", P["patin"], "fer")
        cm, r, h = rond(G.primitives[montant])
        tournee(fer, cm - HAUT * (h / 2), cm + HAUT * (h / 2), X, Y, r, P["fut"]["profil"], P["fut"]["cotes"], "fer")
        futs.append((cm, r, h))
    (g, r, h), (d, _, _) = futs
    hauteur, part = P["entretoise"]
    basse = HAUT * (h * (hauteur - 1 / 2))
    tournee(fer, g + basse, d + basse, Y, HAUT, r * part, CYLINDRE, P["fut"]["cotes"], "fer")
    ct, (tx, _, tz) = pave(G.primitives[P["tringle"]])
    tournee(fer, ct - X * (tx / 2), ct + X * (tx / 2), Y, HAUT, tz / 2, P["barre"], P["fut"]["cotes"], "fer")

    K = P["crochet"]
    brin = tz / 2 * K["fer"]
    grand = tz / 2 * min(part for _, part in P["barre"])
    tours = [2 * math.pi * j / (P["plis"] * P["pas"]) for j in range(P["plis"] * P["pas"])]
    for rang, mat in P["costumes"]:
        c, (lx, ly, lz) = pave(G.primitives[rang])
        (u, du), (v, dv) = sorted(((X, lx / 2), (Y, ly / 2)), key=lambda cote: -cote[1])
        col = c + HAUT * (lz / 2)
        godet, phase = a.uniform(*P["godet"]), a.uniform(0, 2 * math.pi)
        coque(pieces[mat], [[col - HAUT * (lz * t)
                             + (u * (du * large * math.cos(s)) + v * (dv * epais * math.sin(s)))
                             * (1 - godet * pli * (1 - math.cos(P["plis"] * s + phase)) / 2) for s in tours]
                            for t, large, epais, pli in P["coupe"]], mat)
        tore(fer, "x", (c.x, ct.y, ct.z), grand, brin, *K["segments"], "fer")
        tournee(fer, Vector((c.x, ct.y, ct.z - grand)), Vector((c.x, ct.y, col.z - lz * K["col"])), X, Y, brin,
                CYLINDRE, K["segments"][1], "fer")


def chassis(D, G, pieces, a):
    """Un châssis de décor d'après `CHASSIS` : montants, traverses haute et basse, traverses du dedans et écharpes
    derrière la toile peinte, pilastre doré devant elle, équerre de trois pièces derrière le châssis."""
    C, bois = D["CHASSIS"], pieces[MAT]
    axes = []
    for rang in C["montants"]:
        pied, _ = geometrie.profile(bois, G.primitives[rang], "h", POTEAU, MAT)
        axes.append(pied)
    cm, (mx, my, _) = pave(G.primitives[C["montants"][0]])
    ct, (tx, ty, tz) = pave(G.primitives[C["toile"]])
    lisses = []
    for nom in ("haute", "basse"):
        c, (_, ly, lz) = pave(G.primitives[C[nom]])
        g, d = (Vector((p.x, c.y, c.z)) for p in axes)
        planche(bois, g, d, Y, HAUT, ly / 2 * C["traverse"], lz / 2, lz * D["ARETE"])
        lisses.append((g, d))

    etoffe = ty * C["etoffe"]
    fil = ct + FRONT * (ty / 2 - etoffe / 2)
    planche(pieces["peinte"], fil - HAUT * (tz / 2), fil + HAUT * (tz / 2), X, Y, tx / 2 + mx * C["feuillure"],
            etoffe / 2, etoffe * D["ARETE"], "peinte")
    cp, (px, py, pz) = pave(G.primitives[C["motif"]])
    devant = (cp - fil).dot(FRONT) + py / 2
    milieu = cp + FRONT * (py / 2 - devant / 2)
    profilee(pieces["laiton"], milieu - HAUT * (pz / 2), milieu + HAUT * (pz / 2), (px / 2, devant / 2),
             C["pilastre"], "laiton")

    pente = rampant(G.primitives[C["etai"]])
    descend, crete, egout, long, large = pente
    I, E = C["dedans"], C["equerre"]
    dos = (cm - fil).dot(FRONT) - my / 2 * C["traverse"]
    recul = FRONT * ((fil - cm).dot(FRONT) + dos / 2)
    demi_h = mx * I["section"]
    (g, d), _ = lisses
    for z in (crete.z, crete.z + (g.z - crete.z) * I["mediane"]):
        planche(bois, Vector((g.x, g.y, z)) + recul, Vector((d.x, d.y, z)) + recul, Y, HAUT, -dos / 2, demi_h,
                demi_h * D["ARETE"])
    for g, d in lisses:
        for coin, autre in ((g, d), (d, g)):
            vers = (autre - coin).normalized() * (tx * I["echarpe"])
            sur_montant = coin + recul + HAUT * math.copysign(vers.length, ct.z - coin.z)
            biais = (coin + recul + vers - sur_montant).normalized()
            planche(bois, sur_montant, coin + recul + vers, Y.cross(biais), Y, demi_h, -dos / 2, demi_h * D["ARETE"])

    travers = descend.cross(HAUT)
    demi_l, demi_e = large / 2 * E["largeur"], large / 2 * E["epaisseur"]
    pied = Vector((crete.x, crete.y, egout.z))
    planche(bois, pied, crete, travers, HAUT.cross(travers), demi_l, demi_e, demi_e * D["ARETE"])
    haut = crete.z - egout.z
    planche(bois, pied + HAUT * demi_e, egout - descend * (2 * demi_e * long / haut) + HAUT * demi_e, travers, HAUT,
            demi_l, demi_e, demi_e * D["ARETE"])
    n_z = long / (crete - egout).length
    sous = demi_e / n_z
    geometrie.rampante(bois, geometrie.sous_le_rampant(pente, crete, sous),
                       geometrie.sous_le_rampant(pente, egout.lerp(crete, (sous + demi_e * n_z) / haut), sous),
                       large / 2 * E["etai"], demi_e, demi_e * D["ARETE"])


BATIR = {"pupitre-chef": pupitre, "tribune": tribune, "balustrade-loge": balustrade, "rangee-sieges": rangee,
         "rideau-scene": rideau, "escalier-loge": escalier, "lustre-opera": lustre, "portant-costumes": portant,
         "decor-flat": chassis}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_], FLAMME), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
