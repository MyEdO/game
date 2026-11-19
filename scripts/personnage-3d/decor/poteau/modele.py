"""Les ouvrages dressés sur un poteau ou une hampe (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe
convexe des primitives de sa recette (`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où
`Gabarit.rentrer` ramène le sommet qui en sortirait. Chaque pièce est une coque close : un poteau équarri dressé dans
sa boîte (`poteau`) ; une pièce droite d'un point à un autre, ses bouts enfoncés dans ce qu'elle joint
(`contrefiche`) ; une planche, une pièce équarrie, profilée, tournée ou courbée, une cheville, un rivet et un cercle,
ceux de `geometrie` ; un tour de corde et un maillon, le tore de `maille` ; un pieu, une pierre, une planche échancrée
et une étoffe, la coque de leurs sections. Chaque matériau du décor est un nœud à son nom. L'aléa est semé des codes
de caractères de l'id du décor : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (AXES, COTES, CYLINDRE, HAUT, MAT, X, Y, autour, barre, bosselee, cap, cercle, chaine, cheville,
                       clou, coque, courbee, lisse, normales, partage, pave, planche, profilee, rampant, rampante, rond,
                       tournee)
from gabarit import VERSANTS
from maille import lineaire, tore

DECORS = ("gibet", "pilori", "cage", "enseigne", "panneau", "pieu", "etendard", "banniere-chaos")


def poteau(D, m, primitive, P, sol):
    """Un poteau équarri dressé dans la boîte `primitive` de la recette, son pied à la hauteur `sol`, de demi-côté
    `P["cote"]` de celui de la boîte et de profil `D["FUT"]` (`geometrie.profilee`) ; rend son pied, sa tête et son
    demi-côté."""
    c, (cote, _, haut) = pave(primitive)
    demi = cote / 2 * P["cote"]
    pied, tete = Vector((c.x, c.y, sol)), c + HAUT * (haut / 2)
    profilee(m, pied, tete, (demi, demi), D["FUT"])
    return pied, tete, demi


def contrefiche(m, pied, tete, C, cote, mat):
    """Une pièce droite de `pied` à `tete`, qui monte (`geometrie.rampante`), d'après `C`, en fractions de `cote` : ses
    demi-côtés `C["section"]`, en travers puis dans son plan vertical, ses bouts enfoncés de `C["ancrage"]` au-delà des
    deux points, ses arêtes abattues de `C["chanfrein"]`."""
    fil = (tete - pied).normalized()
    rampante(m, pied - fil * (cote * C["ancrage"]), tete + fil * (cote * C["ancrage"]), cote * C["section"][0],
             cote * C["section"][1], cote * C["chanfrein"], mat)


def gibet(D, G, pieces, a):
    """Un gibet d'après `GIBET` : estrade sur lambourdes, poteau, potence chevillée, aisselier, contrefiches, corde
    à nœud coulant. La potence file en x ; la corde pend le long de l'axe de son cylindre."""
    Gi, bois, corde = D["GIBET"], pieces[MAT], pieces["corde"]
    E = Gi["plancher"]
    c, (lx, ly, lz) = pave(G.primitives[Gi["estrade"]])
    cp, (_, _, haut_p) = pave(G.primitives[Gi["poteau"]])
    sol, dessus = c.z - lz / 2, c.z + lz / 2
    lit = sol + lz * E["lambourde"]
    for x in (cp.x, c.x, 2 * c.x - cp.x):
        axe, portee = Vector((x, c.y, (sol + lit) / 2)), Y * (ly / 2 * E["portee"])
        planche(bois, axe - portee, axe + portee, X, HAUT, lx * E["largeur"], (lit - sol) / 2, lz * D["ARETE"])
    pose = lit - lz * E["ancrage"]
    bornes = [c.y + ly * (part - 1 / 2) for part in partage(a, E["planches"], E["ecart"])]
    for y0, y1 in zip(bornes, bornes[1:]):
        axe = Vector((c.x, (y0 + y1) / 2, (pose + dessus) / 2))
        gauche, droite = (X * (lx / 2 * a.uniform(*E["bout"])) for _ in COTES)
        planche(bois, axe - gauche, axe + droite, Y, HAUT, (y1 - y0) / 2 - ly * E["jour"], (dessus - pose) / 2,
                lz * D["ARETE"])

    pied, _, demi = poteau(D, bois, G.primitives[Gi["poteau"]], Gi["fut"], lit)
    rayon = demi * Gi["cheville"]

    P = Gi["bras"]
    cb, (long, epais, haut) = pave(G.primitives[Gi["potence"]])
    du, dv = epais / 2 * P["section"][0], haut / 2 * P["section"][1]
    axe = cb - HAUT * (haut / 2 - dv)
    profilee(bois, axe - X * (long / 2), axe + X * (long / 2), (du, dv), P["profil"], u=Y, v=HAUT)

    A = Gi["aisselier"]
    _, crete, egout, _, large = rampant(G.primitives[Gi["lien"]])
    naissance = Vector((crete.x, crete.y, egout.z)) + HAUT * ((crete.z - egout.z) * A["pied"])
    prise = crete.lerp(egout, (1 + A["portee"]) / 2)
    prise.z = axe.z - dv
    contrefiche(bois, naissance, prise, A["piece"], large, MAT)
    for sy in COTES:
        for part in P["chevilles"]:
            cheville(bois, Vector((pied.x + demi * part, pied.y + sy * demi, axe.z)), Y * sy, rayon, a)
        cheville(bois, Vector((pied.x, pied.y + sy * demi, naissance.z)), Y * sy, rayon, a)
        cheville(bois, Vector((prise.x, axe.y + sy * du, axe.z)), Y * sy, rayon, a)

    C = Gi["contrefiches"]
    for azimut in C["azimuts"]:
        d = cap(azimut)
        au_sol = Vector((pied.x, pied.y, dessus)) + d * (ly / 2 * C["empattement"])
        contrefiche(bois, au_sol, Vector((pied.x, pied.y, dessus + haut_p * C["hauteur"])) + d * demi, C["piece"],
                    demi, MAT)

    K, N, pendant = Gi["corde"], Gi["corde"]["noeud"], G.primitives[Gi["brin"]]
    cc, r_corde, l_corde = rond(pendant)
    _, r_noeud, l_noeud = rond(G.primitives[Gi["noeud"]])
    monte = AXES[pendant["axis"]][1]
    brin = r_corde * K["brin"]
    grand = max(du, dv) * K["tour"] + brin
    for k in range(K["tours"]):
        tore(corde, "x", (cc.x + 2 * brin * (k - (K["tours"] - 1) / 2), axe.y, axe.z), grand, brin, *K["segments"],
             "corde")
    bas = cc - monte * (l_corde / 2)
    serre = bas + monte * (N["spires"] * 2 * brin * N["pas"])
    sous_les_tours = cc + monte * ((axe - cc).dot(monte) - grand)
    tournee(corde, serre - monte * brin, sous_les_tours, *normales(monte), brin, CYLINDRE, K["cotes"], "corde")
    spires = [(k / (2 * N["spires"]), N["creux"] if k % 2 == 0 else 1.0) for k in range(2 * N["spires"] + 1)]
    tournee(corde, bas, serre, *normales(monte), brin * N["rayon"], spires, K["cotes"], "corde")
    demi_b, haut_b = r_noeud * K["boucle"][0], l_noeud * K["boucle"][1]
    anse = [bas + monte * (brin - haut_b * pz) + X * (demi_b * px) for px, pz in K["anse"]]
    courbee(corde, lisse(anse, K["pas"]), X.cross(monte), (brin, brin), K["cotes"], "corde")


def pilori(D, G, pieces, a):
    """Un pilori d'après `PILORI` : semelle en croix, poteau, liens, carcan de deux planches échancrées entre des
    moises chevillées."""
    P, bois = D["PILORI"], pieces[MAT]
    c, (lx, ly, lz) = pave(G.primitives[P["socle"]])
    _, (_, _, haut_p) = pave(G.primitives[P["poteau"]])
    sol = c.z - lz / 2
    pied, _, demi = poteau(D, bois, G.primitives[P["poteau"]], P["fut"], sol)
    S, L = P["semelle"], P["liens"]
    for d, long, part in ((X, lx, S["hauteurs"][0]), (Y, ly, S["hauteurs"][1])):
        axe, dessus = Vector((c.x, c.y, sol + lz * part / 2)), sol + lz * part
        planche(bois, axe - d * (long / 2), axe + d * (long / 2), HAUT.cross(d), HAUT, min(lx, ly) * S["largeur"],
                lz * part / 2, lz * D["ARETE"])
        for s in COTES:
            au_sol = Vector((pied.x, pied.y, dessus)) + d * (s * long / 2 * L["empattement"])
            contrefiche(bois, au_sol, Vector((pied.x, pied.y, dessus + haut_p * L["hauteur"])) + d * (s * demi),
                        L["piece"], demi, MAT)

    K, M = P["carcan"], P["moises"]
    cc, (long, epais, haut) = pave(G.primitives[P["planche"]])
    e, jour = epais / 2 * K["epaisseur"], haut * K["jour"]
    trous = sorted((s * long / 2 * place, haut * r) for place, r in K["trous"] for s in COTES)
    arc = [math.pi * k / K["arc"] for k in range(K["arc"] + 1)]
    for s in COTES:
        joint = s * jour
        contour = [(-long / 2, s * haut / 2), (-long / 2, joint)]
        for x, r in trous:
            contour += [(x - r * math.cos(t), joint + s * r * math.sin(t)) for t in arc]
        contour += [(long / 2, joint), (long / 2, s * haut / 2)]
        coque(bois, [[cc + X * x + Y * (sy * e) + HAUT * z for x, z in contour] for sy in COTES], MAT)

    dedans, dehors = e * M["ancrage"], epais / 2 * M["face"]
    R = P["chevilles"]
    for sy in COTES:
        for sx in COTES:
            axe = cc + X * (sx * long / 2 * M["place"]) + Y * (sy * (dedans + dehors) / 2)
            portee = HAUT * (haut / 2 * M["hauteur"])
            planche(bois, axe - portee, axe + portee, X, Y, long * M["largeur"], (dehors - dedans) / 2,
                    (dehors - dedans) * D["ARETE"])
            for sz in COTES:
                cheville(bois, axe + Y * (sy * (dehors - dedans) / 2) + HAUT * (sz * haut / 2 * R["hauteur"]),
                         Y * sy, long * M["cheville"], a)
        for place in R["places"]:
            for sz in COTES:
                cheville(bois, Vector((pied.x + demi * place, pied.y + sy * demi,
                                       cc.z + sz * haut / 2 * R["hauteur"])), Y * sy, demi * R["rayon"], a)


def cage(D, G, pieces, a):
    """Une cage d'après `CAGE` : plancher et toit de tôle encadrés, barreaux, ceintures rivées, porte à gonds et
    serrure, tirants, tige et anneau de suspension."""
    C, fer = D["CAGE"], pieces["fer"]
    K = C["cadre"]
    plateaux = [pave(G.primitives[C[rang]]) for rang in ("plancher", "toit")]
    for c, (lx, ly, lz) in plateaux:
        large, arete = lx * K["largeur"], lz * K["chanfrein"]
        for s in COTES:
            for d, t, long, travers in ((X, Y, lx, ly), (Y, X, ly - 2 * large, lx)):
                rive = c + t * (s * (travers - large) / 2)
                planche(fer, rive - d * (long / 2), rive + d * (long / 2), t, HAUT, large / 2, lz / 2, arete, "fer")
        portee = X * ((lx - large) / 2)
        planche(fer, c - portee, c + portee, Y, HAUT, (ly - large) / 2, lz / 2 * K["tole"], arete, "fer")
    (centre, (lx, ly, _)), (ct, (tx, ty, tz)) = plateaux

    B = C["barreau"]
    barreaux = [(rond(p), AXES[p["axis"]][1]) for p in (G.primitives[rang] for rang in C["barreaux"])]
    for (c, rayon, longueur), axe in barreaux:
        portee = axe * (longueur / 2 + longueur * B["ancrage"])
        tournee(fer, c - portee, c + portee, *normales(axe), rayon * B["rayon"], CYLINDRE, B["cotes"], "fer")
    (_, r, l), monte = barreaux[0]
    r *= B["rayon"]

    def au_niveau(c, part):
        return c + monte * (l * (part - 1 / 2))

    faces = []
    for n in normales(monte):
        for s in COTES:
            dehors = n * s
            rive = max((c - centre).dot(dehors) for (c, _, _), _ in barreaux)
            long = monte.cross(dehors)
            rangee = sorted((c for (c, _, _), _ in barreaux if (c - centre).dot(dehors) > rive - r),
                            key=lambda c, long=long: c.dot(long))
            faces.append((dehors, long, abs(dehors.dot(Vector((lx, ly, 0)))) / 2 - rive - r, rangee))
    porte = max(faces, key=lambda face: face[0].dot(-Y))
    Ce, Po = C["ceinture"], C["porte"]
    k_gond, k_battant = Po["battant"]
    for face in faces:
        dehors, long, jeu, rangee = face
        e = jeu * Ce["epaisseur"]
        pose = dehors * (r + e / 2 - e * Ce["pose"])
        dernier = len(rangee) - 1
        troncons = ([((0, -r), (k_gond, 0.0)), ((k_battant, 0.0), (dernier, r))] if face is porte
                    else [((0, -r), (dernier, r))])
        for part in Ce["hauteurs"]:
            for (k0, bout0), (k1, bout1) in troncons:
                planche(fer, au_niveau(rangee[k0], part) + pose + long * bout0,
                        au_niveau(rangee[k1], part) + pose + long * bout1, monte, dehors, l * Ce["hauteur"], e / 2,
                        e * D["ARETE"], "fer")
            for k, c in enumerate(rangee):
                if face is not porte or not k_gond <= k <= k_battant:
                    clou(fer, au_niveau(c, part) + pose, dehors, D["RIVET"], 2 * r, "fer")

    dehors, long, jeu, rangee = porte
    gond, battant = rangee[k_gond], rangee[k_battant]
    e, large = jeu * Po["epaisseur"], l * Po["largeur"]
    pose = dehors * (r + e / 2 - e * Po["pose"])
    for c in (gond, battant):
        planche(fer, au_niveau(c, Po["traverses"][0]) + pose - monte * large,
                au_niveau(c, Po["traverses"][-1]) + pose + monte * large, long, dehors, large, e / 2, e * D["ARETE"],
                "fer")
    for part in Po["traverses"]:
        planche(fer, au_niveau(gond, part) + pose + long * large, au_niveau(battant, part) + pose - long * large,
                monte, dehors, large, e / 2, e * D["ARETE"], "fer")
    r_gond, h_gond = Po["gond"]
    for part in Po["gonds"]:
        axe = au_niveau(gond, part) + pose - long * large
        tournee(fer, axe - monte * (l * h_gond), axe + monte * (l * h_gond), *normales(monte), e * r_gond, CYLINDRE,
                B["cotes"], "fer")
    niveau, demi_large, demi_haut, saillie = Po["serrure"]
    boitier = au_niveau(battant, niveau) + dehors * (r + jeu * saillie / 2)
    planche(fer, boitier - monte * (large * demi_haut), boitier + monte * (large * demi_haut), long, dehors,
            large * demi_large, jeu * saillie / 2, e * D["ARETE"], "fer")

    A, anneau = C["anse"], G.primitives[C["anneau"]]
    ca, r_a, l_a = rond(anneau)
    tige = AXES[anneau["axis"]][1]
    petit = r_a * A["petit"]
    grand = r_a * A["grand"] - petit
    oeil = ca + tige * (l_a / 2 - grand - petit)
    tore(fer, next(nom for nom, vecteur in AXES.values() if vecteur.dot(tige) == 0), tuple(oeil), grand, petit,
         *A["segments"], "fer")
    tournee(fer, ca - tige * (l_a / 2 + tz * A["ancrage"]), oeil - tige * grand, *normales(tige), r_a, A["profil"],
            A["cotes"], "fer")
    attache = ca + tige * (l_a * (A["attache"] - 1 / 2))
    for n in normales(tige):
        for s in COTES:
            au_toit = ct + tige * (tz / 2) + n * (s * abs(n.dot(Vector((tx, ty, 0)))) / 2 * A["portee"])
            contrefiche(fer, au_toit, attache, A["tirant"], r_a, "fer")


def enseigne(D, G, pieces, a):
    """Une enseigne d'après `ENSEIGNE` : patte de scellement rivée, potence à bouton, tirant, deux chaînes, tableau
    de planches dans son cadre. Les maillons alternent entre le plan du tableau, normal à x, et son travers."""
    E, fer, bois = D["ENSEIGNE"], pieces["fer"], pieces[MAT]
    cp, (px, py, pz) = pave(G.primitives[E["patte"]])
    cb, (bx, by, bz) = pave(G.primitives[E["bras"]])
    ct, (tx, ty, tz) = pave(G.primitives[E["tableau"]])
    avant = Y * math.copysign(1, cb.y - cp.y)

    S = E["scellement"]
    e = py / 2 * S["epaisseur"]
    dos = cp - avant * (py / 2 - e) - HAUT * (pz / 2)
    profilee(fer, dos, dos + HAUT * pz, (px / 2, e), S["profil"], "fer")
    for part in S["rivets"]:
        clou(fer, dos + HAUT * (pz * part), avant, D["RIVET"], px / 2, "fer")

    mur = cb - avant * (by / 2)
    profilee(fer, mur, mur + avant * by, (bx / 2, bz / 2), E["potence"], "fer", u=X, v=HAUT)
    T = E["tirant"]
    scelle, prise = dos + HAUT * (pz * T["pied"]), mur + avant * (by * T["portee"])
    geometrie.fil(fer, scelle, prise, bx / 2 * T["rayon"], T["cotes"], "fer")

    M = E["chaine"]
    petit = bx / 2 * M["petit"]
    sur = ct.z + tz / 2 - petit
    for rang in E["chaines"]:
        cm, _ = pave(G.primitives[rang])
        dessous = cb.z - bz / 2 * lineaire([(t, part) for t, _, part, _ in E["potence"]], (cm - mur).dot(avant) / by)
        sous = dessous + petit
        chaine(fer, cm.x, cm.y, sous, sur, M["maillons"], (sous - sur) / (M["maillons"] - 1) / 2 + petit, petit,
               M["segments"], "fer")

    Ca = E["cadre"]
    large = tz * Ca["largeur"]
    dedans = large * (1 - Ca["ancrage"])
    for s in COTES:
        rive, montant = ct + HAUT * (s * (tz - large) / 2), ct + Y * (s * (ty - large) / 2)
        planche(bois, rive - Y * (ty / 2), rive + Y * (ty / 2), X, HAUT, tx / 2, large / 2, tx * D["ARETE"])
        planche(bois, montant - HAUT * (tz / 2 - dedans), montant + HAUT * (tz / 2 - dedans), X, Y,
                tx / 2 * Ca["montant"], large / 2 * Ca["montant"], tx * D["ARETE"])
    bornes = [ct.z + (tz - 2 * dedans) * (part - 1 / 2) for part in partage(a, Ca["planches"], Ca["ecart"])]
    for z0, z1 in zip(bornes, bornes[1:]):
        axe, portee = Vector((ct.x, ct.y, (z0 + z1) / 2)), Y * (ty / 2 - dedans)
        planche(bois, axe - portee, axe + portee, X, HAUT, tx / 2 * a.uniform(*Ca["epaisseur"]),
                (z1 - z0) / 2 - tz * Ca["jour"], tx * D["ARETE"])


def panneau(D, G, pieces, a):
    """Un panneau d'après `PANNEAU` : poteau, flèche de deux planches entaillée en queue et taillée en pointe,
    traverses chevillées."""
    P, bois, vieux = D["PANNEAU"], pieces[MAT], pieces["vieux"]
    cp, (_, _, haut_p) = pave(G.primitives[P["poteau"]])
    poteau(D, bois, G.primitives[P["poteau"]], P["fut"], cp.z - haut_p / 2)

    F, pointe = P["fleche"], G.primitives[P["pointe"]]
    cb, cotes = pave(G.primitives[P["tableau"]])
    cq, _ = pave(pointe)
    vers = Vector(VERSANTS[pointe["slope"]])
    avant = HAUT.cross(vers) * math.copysign(1, (cb - cp).dot(HAUT.cross(vers)))
    long, epais, haut = (abs(axe.dot(Vector(cotes))) for axe in (vers, avant, HAUT))
    demi, bout = long / 2, (cq - cb).dot(vers)
    e, jour, meplat = epais / 2 * F["epaisseur"], haut * F["jour"], haut * F["meplat"]
    queue, ouverture = long * F["entaille"][0], haut / 2 * F["entaille"][1]
    profil = ((-demi, ouverture, haut / 2), (-demi + queue, jour, haut / 2), (demi, jour, haut / 2),
              (bout - (bout - demi) * (jour + meplat) / (haut / 2), jour, jour + meplat))
    dos = cb - avant * (epais / 2)
    gardes = [e * a.uniform(*F["usure"]) for _ in COTES]
    for sz, garde in zip(COTES, gardes):
        barre(vieux, [(dos + avant * garde + vers * s + HAUT * (sz * (bas + tete) / 2), garde, (tete - bas) / 2,
                       garde * F["chanfrein"]) for s, bas, tete in profil], avant, HAUT, "vieux")

    T = P["traverse"]
    dedans, dehors = 2 * e - e * T["ancrage"], epais * (1 + T["face"]) / 2
    rayon, niveau = haut * P["chevilles"]["rayon"], haut / 2 * P["chevilles"]["hauteur"]
    for sz, garde in zip(COTES, gardes):
        cheville(bois, dos + vers * (cp - cb).dot(vers) + avant * (2 * garde) + HAUT * (sz * niveau), avant, rayon, a)
    for place in T["places"]:
        axe = dos + vers * (demi * place) + avant * ((dedans + dehors) / 2)
        portee = HAUT * (haut / 2 * T["hauteur"])
        planche(bois, axe - portee, axe + portee, vers, avant, long * T["largeur"], (dehors - dedans) / 2,
                (dehors - dedans) * D["ARETE"])
        for sz in COTES:
            cheville(bois, axe + avant * ((dehors - dedans) / 2) + HAUT * (sz * niveau), avant, rayon, a)


def pieu(D, G, pieces, a):
    """Un pieu d'après `PIEU` : fût bosselé taillé en pointe jusqu'à la crête de son prisme, pierre dégrossie et
    pierre de calage, assises dans l'axe du fût."""
    P, bois, pierre = D["PIEU"], pieces[MAT], pieces["pierre"]
    T, S = P["tronc"], P["pierre"]
    fut = G.primitives[P["fut"]]
    c, rayon, longueur = rond(fut)
    monte = AXES[fut["axis"]][1]
    u, v = normales(monte)
    _, crete, _, _, _ = rampant(G.primitives[P["taille"]])

    pied = c - monte * (longueur / 2)
    epaule = longueur - rayon * T["epaule"]
    tranche = bosselee(a, u, v, T["cotes"], T["bosse"])
    anneaux = []
    for k in range(T["rangs"] + 1):
        t = k / T["rangs"]
        deport = (u * a.uniform(-T["flexe"], T["flexe"]) + v * a.uniform(-T["flexe"], T["flexe"])) * (rayon * t)
        anneaux.append(tranche(pied + monte * (epaule * t) + deport, rayon * T["rayon"] * (1 - T["defilement"] * t)))
    anneaux += [[p.lerp(crete, min(1, part * a.uniform(*T["eclat"]))) for p in anneaux[-1]] for part in T["taille"]]
    coque(bois, anneaux, MAT, crete)

    cs, r_s, h_s = rond(G.primitives[P["borne"]])
    ecart = cs - c
    vers = (ecart - monte * ecart.dot(monte)).normalized()
    r_cale, h_cale = r_s * S["cale"][0], h_s * S["cale"][1]
    cale = pied + vers * (rayon * T["rayon"] + r_cale * S["contre"])
    for assise, r, h in ((cs - monte * (h_s / 2), r_s, h_s), (cale, r_cale, h_cale)):
        tranche = bosselee(a, u, v, S["cotes"], S["bosse"])
        coque(pierre, [tranche(assise + monte * (h * z), r * part) for z, part in S["profil"]], "pierre")


def banniere(D, G, pieces, a):
    """Un étendard ou une bannière d'après `BANNIERE` et `ETOFFES` : socle, hampe, traverse entre deux viroles,
    étoffe plissée pendue par son fourreau, ferrure de tête. Le socle et la ferrure se dressent dans l'axe de la
    hampe ; l'étoffe pend dans le plan de cet axe et de celui de la traverse."""
    B, V = D["BANNIERE"], D["ETOFFES"][G.id]
    pierre, bois, toile, ferrure = (pieces[nom] for nom in ("pierre", MAT, "toile", "ferrure"))
    hampe, traverse = G.primitives[B["hampe"]], G.primitives[B["traverse"]]
    axe_h, monte = AXES[hampe["axis"]]
    long = AXES[traverse["axis"]][1]
    u, v = normales(monte)

    cs, r_s, h_s = rond(G.primitives[B["socle"]])
    tournee(pierre, cs - monte * (h_s / 2), cs + monte * (h_s / 2), u, v, r_s, B["pied"]["profil"],
            B["pied"]["cotes"], "pierre")
    H = B["fut"]
    ch, r_h, l_h = rond(hampe)
    pied = ch - monte * (l_h / 2 + h_s * H["ancrage"])
    tete = ch + monte * (l_h / 2)
    tournee(bois, pied, tete, u, v, r_h, H["profil"], H["cotes"])

    T, Vi = B["vergue"], B["virole"]
    ct, r_t, l_t = rond(traverse)
    tournee(bois, ct - long * (l_t / 2), ct + long * (l_t / 2), *normales(long), r_t, T["profil"], T["cotes"])
    mortaise = pied + monte * (ct - pied).dot(monte)
    for s in COTES:
        centre = mortaise + monte * (s * r_t * Vi["ecart"])
        rayon = r_h * lineaire(H["profil"], (centre - pied).length / (tete - pied).length)
        cercle(ferrure, axe_h, tuple(centre), rayon, r_t * Vi["hauteur"], r_h * Vi["epaisseur"], H["cotes"],
               "ferrure")

    F, K = V["ferrure"], V["ferrure"]["crocs"]
    cf, r_f, l_f = rond(G.primitives[B["fleche"]])

    def sur_la_tete(part):
        return cf + monte * (l_f * (part - 1 / 2))
    tournee(ferrure, sur_la_tete(-F["ancrage"]), sur_la_tete(F["douille"]), u, v, r_f, F["profil"], F["cotes"],
            "ferrure")
    barre(ferrure, [(sur_la_tete(part), r_f * du, r_f * dv, r_f * min(du, dv) * F["chanfrein"])
                    for part, du, dv in F["fer"]], long, monte.cross(long), "ferrure")
    for azimut in K["azimuts"]:
        d = autour(u, v, math.radians(azimut))
        bout = sur_la_tete(K["pied"] + K["montee"]) + d * (r_f * K["portee"])
        tournee(ferrure, sur_la_tete(K["pied"]), bout, *normales((bout - sur_la_tete(K["pied"])).normalized()),
                r_f * K["rayon"], K["profil"], K["cotes"], "ferrure")

    E, Pl = B["drap"], V["plis"]
    ce, cotes_e = pave(G.primitives[B["etoffe"]])
    _, cotes_p = pave(G.primitives[B["pan"]])
    travers = long.cross(monte)
    large, epais, haut_e = (abs(axe.dot(Vector(cotes_e))) for axe in (long, travers, monte))
    haut_p = abs(monte.dot(Vector(cotes_p)))
    guindant = ce - long * (large / 2)
    tetiere = (ct - guindant).dot(monte)
    e = epais / 2 * E["epaisseur"]
    phase = a.uniform(0, 2 * math.pi)
    rangs = []
    for i in range(E["rangs"] + 1):
        t = i / E["rangs"]
        devant, derriere = [], []
        for j in range(E["colonnes"] + 1):
            s = j / E["colonnes"]
            chute = haut_e / 2 + haut_p * lineaire(V["bord"], s)
            p = guindant + long * (large * s) + monte * (tetiere - (tetiere + chute) * t)
            jeu = min(G.portee(p, sens, D["RETRAIT"]) for sens in (travers, -travers))
            creux = max(0.0, min(jeu * Pl["part"] - e, large * Pl["creux"]))
            creux *= E["tetiere"] + (1 - E["tetiere"]) * t
            p += travers * (creux * math.sin(2 * math.pi * (Pl["ondes"] * s + Pl["derive"] * t) + phase))
            devant.append(p + travers * e)
            derriere.append(p - travers * e)
        rangs.append(devant + derriere[::-1])
    coque(toile, rangs, "toile")
    Fo = E["fourreau"]
    fronces = [(k / Fo["fronces"], a.uniform(*Fo["rayon"])) for k in range(Fo["fronces"] + 1)]
    ourlet = guindant + monte * tetiere
    tournee(toile, ourlet, ourlet + long * large, *normales(long), r_t, fronces, T["cotes"], "toile")


BATIR = {"gibet": gibet, "pilori": pilori, "cage": cage, "enseigne": enseigne, "panneau": panneau, "pieu": pieu,
         "etendard": banniere, "banniere-chaos": banniere}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
