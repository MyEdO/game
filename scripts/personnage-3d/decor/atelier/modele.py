"""L'atelier (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène le sommet
qui en sortirait. Chaque pièce est une coque close : un rondin, son écorce sur son bois (`rondin`) ; une lame plate, son
contour d'une face à l'autre (`lame`) ; un massif de pierres taillées en assises harpées, une pierre taillée, un semis
de charbons, une pièce équarrie, une planche, une pièce profilée, une pièce tournée, une pièce ronde courbée, une
cheville, un clou et un cercle, ceux de `geometrie` ; une poutre et une révolution, celles de `maille` (`poutre`,
`tour`). Chaque matériau du décor est un nœud à son nom, les braises celui qui luit (`gabarit.NOEUD_EMISSIF`). L'aléa
est semé des codes de caractères de l'id du décor : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (ANGLES, AXES, BRAISES, COTES, CYLINDRE, HAUT, MAT, POTEAU, X, Y, autour, barre, cap, cercle,
                       charbons, cheville, clou, coque, courbee, normales, partage, pave, planche, profilee, rond,
                       tournee)
from gabarit import NOEUD_EMISSIF, VERSANTS
from maille import poutre, tour

DECORS = ("enclume", "foyer-de-forge", "cuve-brasserie", "marmite", "roue-dentee", "scie-chevalet", "rack-armes",
          "rack-lances")


def rondin(pieces, p0, p1, rayon, R):
    """Un rondin de `p0` à `p1`, d'après `R` : son bois, de bout en bout, et son écorce, en retrait de chaque coupe."""
    retrait, coeur = R["coupe"]
    d = (p1 - p0).normalized()
    u, v = normales(d)
    tournee(pieces["ecorce"], p0 + d * (rayon * retrait), p1 - d * (rayon * retrait), u, v, rayon, R["profil"],
            R["cotes"], "ecorce")
    tournee(pieces[MAT], p0, p1, u, v, rayon * coeur, CYLINDRE, R["cotes"])


def lame(m, origine, u, v, contour, demi, fil, mat):
    """Une lame plate de demi-épaisseur `demi` : son `contour` [(a, b)] posé en `origine` + a·`u` + b·`v` à
    mi-épaisseur, chaque face réduite à la part `fil` de ce contour autour de son centre."""
    n = u.cross(v).normalized()
    points = [origine + u * a + v * b for a, b in contour]
    centre = sum(points, Vector()) / len(points)
    coque(m, [[centre.lerp(p, part) + n * (demi * cote) for p in points]
              for cote, part in ((-1, fil), (0, 1), (1, fil))], mat)


def enclume(D, G, pieces, a):
    """Une enclume d'après `ENCLUME` : billot fretté, pied et corps à taille, table à talon, bigorne, crampons, un
    marteau posé sur le billot."""
    E, fer = D["ENCLUME"], pieces["fer"]
    billot = G.primitives[E["billot"]]
    centre, _, hauteur = rond(billot)
    sol, tete = centre - HAUT * (hauteur / 2), centre + HAUT * (hauteur / 2)
    r = geometrie.apotheme(billot) * E["rayon"]
    rondin(pieces, sol, tete, r, E["rondin"])
    part, haut, epais = E["frette"]
    cercle(fer, "z", tuple(sol.lerp(tete, part)), r, hauteur * haut, r * epais, E["rondin"]["cotes"], "fer")

    corne = G.primitives[E["bigorne"]]
    cc, (cx, cy, cz) = pave(corne)
    d = Vector(VERSANTS[corne["slope"]])
    travers = d.cross(HAUT)
    table, (tx, ty, tz) = pave(G.primitives[E["table"]])
    longue, large = (abs(axe.dot(Vector((tx, ty, 0)))) for axe in (d, travers))
    talon = table - d * (longue / 2)
    barre(fer, [(talon + d * (longue * place) + HAUT * (tz * creux / 2), large / 2 * part, tz / 2 * (1 - creux),
                 tz * chanfrein) for place, part, creux, chanfrein in E["profil_table"]], travers, HAUT, "fer")

    pied, (lx, ly, lz) = pave(G.primitives[E["pied"]])
    ancrage = lz * E["ancrage"]
    assise = Vector((pied.x, pied.y, tete.z - ancrage))
    haut_c = table.z - tz / 2 + ancrage - assise.z
    profilee(fer, assise, assise + HAUT * haut_c, (lx / 2, ly / 2), E["corps"], "fer")
    kx, ky, enfonce = E["crampons"]
    semelle = assise.z + haut_c * E["semelle"] - lx / 2 * D["CLOU"][1] * enfonce
    for sx, sy in ANGLES:
        clou(fer, Vector((pied.x + sx * lx / 2 * kx, pied.y + sy * ly / 2 * ky, semelle)), HAUT, D["CLOU"], lx / 2,
             "fer")

    B = E["corne"]
    portee = abs(d.dot(Vector((cx, cy, 0))))
    racine, pointe = (cc + d * (sens * portee / 2) + HAUT * (cz * axe) for sens, axe in zip(COTES, B["axe"]))
    profil = ((0, 1), (B["ancrage"] / (B["longueur"] + B["ancrage"]), 1), (1, 1 - B["longueur"]))
    tournee(fer, racine.lerp(pointe, -B["ancrage"]), racine.lerp(pointe, B["longueur"]), HAUT, travers,
            cz / 2 * B["rayon"], profil, B["cotes"], "fer")

    M = E["marteau"]
    demi_l, demi_c = (r * part for part in M["tete"])
    longueur, rayon_m, pose = M["manche"]
    masse = (centre + X * (r * M["place"][0]) + Y * (r * M["place"][1])
             + HAUT * (hauteur / 2 + demi_c * (1 - M["enfonce"])))
    planche(fer, masse - X * demi_l, masse + X * demi_l, Y, HAUT, demi_c, demi_c, demi_c * 2 * D["ARETE"], "fer")
    bout = Vector((masse.x, masse.y + r * longueur, tete.z + r * rayon_m * math.cos(math.pi / M["cotes"]) * pose))
    tournee(pieces[MAT], masse, bout, X, HAUT, r * rayon_m, CYLINDRE, M["cotes"])


def foyer(D, G, pieces, a):
    """Un foyer de forge d'après `FOYER` : massif, contrecœur, linteau de hotte et souche en assises de pierres
    taillées harpées aux angles, sur leur blocage ; hotte en tronc de pyramide ; piliers ; lit de braises et charbons ;
    soufflet à deux flasques, son cuir, sa buse dans les braises."""
    F, m, K = D["FOYER"], pieces["pierre"], D["TAILLE"]
    for nom, P in F["parements"]:
        c, cotes = pave(G.primitives[F[nom]])
        lit, tete = (c.z - cotes[2] / 2 + cotes[2] * part for part in P["entre"])
        geometrie.appareil(m, c, cotes, lit, tete, P, K, a, {})

    H = F["manteau"]
    hotte, (hx, hy, hz) = pave(G.primitives[F["hotte"]])
    souche, (sx, sy, sz) = pave(G.primitives[F["souche"]])
    naissance = Vector((hotte.x, hotte.y, hotte.z - hz / 2 + hz * H["naissance"]))
    gorge = Vector((souche.x, souche.y, souche.z - sz / 2 + sz * H["gorge"]))
    barre(m, [(naissance, hx / 2 * H["pied"], hy / 2 * H["pied"], hz * H["chanfrein"]),
              (gorge, sx / 2 * H["tete"], sy / 2 * H["tete"], hz * H["chanfrein"])], X, Y, "pierre")
    for rang in F["piliers"]:
        c, (px, py, pz) = pave(G.primitives[rang])
        profilee(m, c - HAUT * (pz / 2 + pz * F["ancrage"]), c + HAUT * (pz / 2 + pz * F["ancrage"]), (px / 2, py / 2),
                 F["pilier"], "pierre")

    L = F["lit"]
    braises, (bx, by, bz) = pave(G.primitives[F["braises"]])
    fond = braises - HAUT * (bz / 2)
    dessus = fond + HAUT * (bz * L["hauteur"])
    profilee(pieces[NOEUD_EMISSIF], fond - HAUT * (bz * L["ancrage"]), dessus, (bx / 2, by / 2), L["profil"], BRAISES)
    charbons(pieces[NOEUD_EMISSIF], dessus, bx / 2 * L["semis"], by / 2 * L["semis"], L, a)

    S = F["soufflet"]
    massif, (mx, my, mz) = pave(G.primitives[F["massif"]])
    demi_l, e = mx / 2 * S["largeur"], mz * S["flasque"]
    poignee, bec = (massif + X * (mx / 2 * px) - Y * (my / 2 * py) + HAUT * (mz / 2 - e * S["enfonce"])
                    for px, py in S["portee"])
    beant, clos = (mz * part for part in S["ouverture"])
    for flasque in (0, 1):
        barre(pieces[MAT], [(poignee.lerp(bec, t) + HAUT * (e + flasque * (2 * e + beant + (clos - beant) * t)),
                             demi_l * part, e, e * S["chanfrein"]) for t, part in S["contour"]], X, HAUT)
    barre(pieces["cuir"], [(poignee.lerp(bec, t) + HAUT * (2 * e + (beant + (clos - beant) * t) / 2), demi_l * part,
                            (beant + (clos - beant) * t) / 2 + e * S["prise"], e * S["chanfrein"])
                           for t, part in S["cuir"]], X, HAUT, "cuir")
    depart, arrivee, rayon, cotes = S["buse"]
    buse = [poignee.lerp(bec, t) + HAUT * (2 * e) for t in (depart, arrivee)]
    buse[1].z = dessus.z
    tournee(pieces["fer"], *buse, *normales((buse[1] - buse[0]).normalized()), e * rayon, S["cone"], cotes, "fer")


def cuve(D, G, pieces, a):
    """Une cuve de brasserie d'après `CUVE` : douves dressées en tronc de cône sur leur blocage, cercles de fer, le
    moût en contrebas du bord, un fourquet appuyé au bord."""
    C, m, fer = D["CUVE"], pieces[MAT], pieces["fer"]
    corps = G.primitives[C["cuve"]]
    centre, rayon, hauteur = rond(corps)
    sol = centre - HAUT * (hauteur / 2)
    n = C["douves"]
    pied, tete = (geometrie.apotheme(corps) * part for part in C["rayons"])
    e, plat = rayon * C["epaisseur"], math.cos(math.pi / n)
    chanfrein = e * C["chanfrein"]

    def arete(part):
        return pied + (tete - pied) * part
    for k in range(n):
        dehors = cap(360 * (k + 0.5) / n)
        recul = e * a.uniform(*C["jeu"])
        stations = []
        for part, rogne in ((0, chanfrein), (chanfrein / hauteur, 0), (1 - chanfrein / hauteur, 0), (1, chanfrein)):
            parement = arete(part) * plat
            stations.append((sol + HAUT * (hauteur * part) + dehors * (parement - e / 2 - recul), e / 2 - rogne,
                             parement * math.tan(math.pi / n) - e * C["jour"] - rogne, chanfrein - rogne / 2))
        barre(m, stations, dehors, HAUT.cross(dehors))
    haut, hors, dedans = C["blocage"]
    tour(m, [(0, arete(0) * plat - e * hors), (hauteur * haut, arete(haut) * plat - e * hors),
             (hauteur * haut, arete(haut) * plat - e * dedans), (0, arete(0) * plat - e * dedans)], "z", tuple(sol), n,
         MAT, ferme=True)
    dessous, dessus, bord = C["mout"]
    tournee(pieces["eau"], sol + HAUT * (hauteur * dessous), sol + HAUT * (hauteur * dessus), X, Y,
            arete(dessus) * plat - e * bord, CYLINDRE, n, "eau")
    serre, saillie = C["cercle"]
    for rang in C["cercles"]:
        c, _, large = rond(G.primitives[rang])
        r = arete((c.z - sol.z) / hauteur)
        cercle(fer, "z", (sol.x, sol.y, c.z), r * (serre + saillie) / 2, large, r * (saillie - serre), n, "fer")

    F = C["fourquet"]
    boite, (bx, by, bz) = pave(G.primitives[C["planche"]])
    pose = Vector((boite.x, boite.y + by / 2 * F["pied"], boite.z - bz / 2))
    appui = sol + cap(F["appui"]) * tete + HAUT * hauteur
    tournee(m, pose, pose.lerp(appui, F["depasse"]), X, Y, bx / 2 * F["rayon"], CYLINDRE, F["cotes"])
    demi_e, demi_l, chanfrein = F["pale"]
    barre(m, [(pose.lerp(appui, t), bx / 2 * demi_e, by / 2 * demi_l * part, bx / 2 * demi_e * chanfrein)
              for t, part in F["profil"]], X, Y)


def marmite(D, G, pieces, a):
    """Une marmite d'après `MARMITE` : trois perches dressées, trois bras ligaturés à leur tête et noués à la clef, la
    chaîne, le chaudron ventru à lèvre, son anse, le ragoût et ses os ; dessous, les braises, leurs charbons, des
    bûches et une bordure de pierres."""
    M, m, fer = D["MARMITE"], pieces[MAT], pieces["fer"]
    chaudron = G.primitives[M["chaudron"]]
    centre, rayon, hauteur = rond(chaudron)
    fond, bord = centre - HAUT * (hauteur / 2), centre + HAUT * (hauteur / 2)

    P, Li = M["potence"], M["ligature"]
    perches = [pave(G.primitives[rang]) for rang in M["perches"]]
    faite, (cote, _, haut) = perches[0]
    r = cote / 2 * P["rayon"]
    clef = Vector((centre.x, centre.y, faite.z + haut / 2 - r))
    noeuds = [clef]
    for p, _ in perches:
        tournee(m, p - HAUT * (haut / 2), p + HAUT * (haut / 2), X, Y, r, P["profil"], P["cotes"])
        epaule = Vector((p.x, p.y, clef.z))
        geometrie.fil(m, epaule, clef, r, P["cotes"])
        noeuds.append(epaule)
    for noeud in noeuds:
        tournee(pieces["corde"], noeud - HAUT * (r * Li["dessous"]), noeud + HAUT * (r * Li["dessus"]), X, Y,
                r * Li["rayon"], Li["spires"], P["cotes"], "corde")

    tournee(fer, fond, bord, X, Y, rayon, M["panse"], chaudron["sides"], "fer")
    dessous, dessus, part = M["ragout"]
    tournee(pieces["eau"], fond.lerp(bord, dessous), fond.lerp(bord, dessus), X, Y, rayon * part, CYLINDRE,
            chaudron["sides"], "eau")
    O = M["os"]
    for (dx, dy), azimut, elevation, longueur in O["poses"]:
        p0 = fond.lerp(bord, dessous) + (X * dx + Y * dy) * rayon
        vers = autour(cap(azimut), HAUT, math.radians(elevation))
        tournee(pieces["os"], p0, p0 + vers * (rayon * longueur), *normales(vers), rayon * O["rayon"], O["profil"],
                O["cotes"], "os")

    A, Ch = M["anse"], M["chaine"]
    attache = bord - HAUT * (hauteur * A["ancrage"])
    arc = [attache - Y * (rayon * A["portee"] * math.cos(math.pi * k / A["troncons"]))
           + HAUT * (rayon * A["fleche"] * math.sin(math.pi * k / A["troncons"])) for k in range(A["troncons"] + 1)]
    courbee(fer, arc, X, (rayon * A["fer"],) * 2, A["cotes"], "fer")
    pas = (clef.z - attache.z - rayon * A["fleche"]) / Ch["maillons"]
    maillon = pas / 2 * Ch["recouvre"]
    for k in range(Ch["maillons"]):
        cercle(fer, "xy"[k % 2], (clef.x, clef.y, clef.z - pas * (k + 0.5)), maillon * (1 - Ch["fer"] / 2),
               maillon * Ch["fer"], maillon * Ch["fer"], Ch["cotes"], "fer")

    L, B, Bu = M["lit"], M["bordure"], M["buches"]
    braises = G.primitives[M["braises"]]
    foyer_, r_foyer, h_foyer = rond(braises)
    cotes = braises["sides"]
    atre = foyer_ - HAUT * (h_foyer / 2)
    dessus = atre + HAUT * (h_foyer * L["hauteur"])
    tournee(pieces[NOEUD_EMISSIF], atre, dessus, X, Y, r_foyer, L["profil"], cotes, BRAISES)
    charbons(pieces[NOEUD_EMISSIF], dessus, r_foyer * L["semis"], r_foyer * L["semis"], L, a)
    for k in range(cotes):
        dehors = cap(360 * (k + 0.5) / cotes)
        demi_h = h_foyer * B["hauteur"] / 2
        face = atre + dehors * (geometrie.apotheme(braises) * B["parement"]) + HAUT * demi_h
        geometrie.moellon(pieces["pierre"], face, dehors, HAUT.cross(dehors),
                          r_foyer * math.sin(math.pi / cotes) * B["largeur"], demi_h, r_foyer * B["queue"], B["taille"],
                          a)
    for azimut in Bu["azimuts"]:
        p0, p1 = (dessus + cap(azimut) * (r_foyer * part) + HAUT * (r_foyer * Bu["rayon"] * Bu["pose"])
                  for part in Bu["portee"])
        rondin(pieces, p0, p1, r_foyer * Bu["rayon"], Bu["rondin"])


def roue(D, G, pieces, a):
    """Une roue dentée d'après `ROUE` : jante, dents, rayons, moyeu de laiton à tourillons ; deux chevalets en A à
    palier et entretoise, sur deux longerons rivés et deux traverses ; un levier, son bras de fer sur le tourillon."""
    R, fer = D["ROUE"], pieces["fer"]
    jante = G.primitives[R["roue"]]
    centre, _, epais = rond(jante)
    axe, essieu = AXES[jante["axis"]]
    u, w = geometrie.repere(axe)
    apotheme = geometrie.apotheme(jante)

    def vers(tours):
        return autour(u, w, 2 * math.pi * tours)
    J, T, Ra = R["jante"], R["dents"], R["rayons"]
    dedans, dehors = (apotheme * part for part in J["rayons"])
    demi_e = epais / 2 * J["epaisseur"]
    cercle(fer, axe, tuple(centre), (dedans + dehors) / 2, 2 * demi_e, dehors - dedans, 2 * T["nombre"], "fer")
    chanfrein = demi_e * T["chanfrein"]
    creux, pointe = (apotheme * part for part in T["largeurs"])
    for k in range(T["nombre"]):
        d = vers(k / T["nombre"])
        tete = centre + d * (apotheme * T["tete"])
        barre(fer, [(centre + d * (dehors * T["pied"]), demi_e * T["epaisseur"], creux, chanfrein),
                    (tete - d * chanfrein, demi_e * T["epaisseur"], pointe, chanfrein),
                    (tete, demi_e * T["epaisseur"] - chanfrein, pointe - chanfrein, chanfrein / 2)], essieu,
              essieu.cross(d), "fer")
    noix = G.primitives[R["moyeu"]]
    moyeu, _, l_moyeu = rond(noix)
    r_moyeu = geometrie.apotheme(noix)
    for k in range(Ra["nombre"]):
        d = vers((k + 0.5) / Ra["nombre"])
        planche(fer, centre + d * (r_moyeu * Ra["pied"]), centre + d * (dedans * Ra["tete"]), essieu, essieu.cross(d),
                demi_e * Ra["epaisseur"], apotheme * Ra["largeur"], demi_e * Ra["chanfrein"], "fer")
    tournee(pieces["laiton"], moyeu - essieu * (l_moyeu / 2), moyeu + essieu * (l_moyeu / 2), u, w, r_moyeu,
            R["noix"], R["cotes"], "laiton")

    Ch, Tr = R["chevalet"], R["traverse"]
    socle, (lx, ly, lz) = pave(G.primitives[R["socle"]])
    longue, large = (abs(sens.dot(Vector((lx, ly, 0)))) for sens in (u, essieu))
    du, dv = longue * Ch["section"][0], l_moyeu / 2 * Ch["section"][1]
    arete = lz * D["ARETE"]
    for cote in COTES:
        palier = moyeu + essieu * (cote * l_moyeu / 2 * Ch["palier"])
        demi_c, r_collier = Ch["collier"]
        tournee(fer, palier - essieu * (l_moyeu / 2 * demi_c), palier + essieu * (l_moyeu / 2 * demi_c), u, w,
                r_moyeu * r_collier, CYLINDRE, R["cotes"], "fer")
        sous = Vector((palier.x, palier.y, socle.z + lz / 2 - lz * Ch["ancrage"]))
        for sens in COTES:
            jambe = (sous + u * (sens * longue / 2 * Ch["empattement"]), palier + u * (sens * du * Ch["tete"]))
            barre(fer, [(q, du, dv, arete) for q in jambe], u, essieu, "fer")
        part, demi_h = Ch["entretoise"]
        portee = u * (longue / 2 * Ch["empattement"] * (1 - part))
        planche(fer, sous.lerp(palier, part) - portee, sous.lerp(palier, part) + portee, essieu, HAUT, dv * demi_h,
                du * demi_h, arete * demi_h, "fer")
        longeron = Vector((palier.x, palier.y, socle.z))
        planche(fer, longeron - u * (longue / 2), longeron + u * (longue / 2), essieu, HAUT, large / 2 * Ch["longeron"],
                lz / 2, arete, "fer")
        for sens in COTES:
            clou(fer, longeron + u * (sens * longue / 2 * Ch["rivet"][0]) + HAUT * (lz / 2 * Ch["rivet"][1]), HAUT,
                 D["CLOU"], large / 2, "fer")
    for sens in COTES:
        p = socle + u * (sens * longue / 2 * Tr["place"]) - HAUT * (lz / 2 * (1 - Tr["hauteur"]))
        planche(fer, p - essieu * (large / 2), p + essieu * (large / 2), u, HAUT, longue * Tr["largeur"],
                lz / 2 * Tr["hauteur"], arete, "fer")

    Lv = R["bras"]
    manche = G.primitives[R["levier"]]
    lc, lr, ll = rond(manche)
    file = AXES[manche["axis"]][1]
    file = file * math.copysign(1, (lc - moyeu).dot(file))
    pres, loin = lc - file * (ll / 2), lc + file * (ll / 2)
    tourillon = moyeu + essieu * (math.copysign(l_moyeu / 2, (lc - moyeu).dot(essieu)) * Lv["depart"])
    poutre(fer, tourillon, pres.lerp(loin, Lv["prise"]), lr * Lv["section"][0], lr * Lv["section"][1], HAUT, "fer")
    tournee(pieces[MAT], pres, loin, *normales(file), lr * Lv["rayon"], Lv["profil"], Lv["cotes"])


def scie(D, G, pieces, a):
    """Un chevalet de sciage d'après `SCIE` : deux croix de pieds chevillées, une entretoise par leurs croisées, une
    lisse par côté ; la bûche portée par les quatre pieds ; la scie engagée dans son trait, sa lame dentée, sa
    poignée."""
    S, m = D["SCIE"], pieces[MAT]
    B, Pd, T = S["buche"], S["pied"], S["entretoise"]
    madrier, (longueur, _, haut) = pave(G.primitives[S["madrier"]])
    rayon = haut * B["rayon"]
    axe = Vector((madrier.x, madrier.y, madrier.z + haut / 2 - rayon))
    rondin(pieces, axe - X * (longueur / 2 * B["longueur"]), axe + X * (longueur / 2 * B["longueur"]), rayon,
           B["rondin"])

    croix = []
    for rangs in S["croix"]:
        pieds = []
        for rang, cote in zip(rangs, COTES):
            p, (large, _, haut_p) = pave(G.primitives[rang])
            epais = large * Pd["section"][1]
            pose = Vector((p.x + cote * large * Pd["decale"], p.y, p.z - haut_p / 2))
            vers = math.copysign(1, axe.y - pose.y)
            ecart, montee = vers * (axe.y - pose.y), axe.z - pose.z
            pente = math.atan2(montee, ecart) - math.asin((rayon * (1 - Pd["appui"]) + epais / 2)
                                                          / math.hypot(ecart, montee))
            d = Y * (vers * math.cos(pente)) + HAUT * math.sin(pente)
            tete = pose + d * ((axe.z + rayon * Pd["depasse"] - pose.z) / d.z)
            barre(m, [(q, large * Pd["section"][0], epais / 2 / d.z, epais * D["ARETE"]) for q in (pose, tete)], X, Y)
            pieds.append((pose, d, large))
        (p0, d0, large), (p1, d1, _) = pieds
        entre = p1 - p0
        croisee = p0 + d0 * ((entre.y * d1.z - entre.z * d1.y) / (d0.y * d1.z - d0.z * d1.y))
        croisee.x = (p0.x + p1.x) / 2
        for cote in COTES:
            cheville(m, croisee + X * (cote * large * (Pd["decale"] + Pd["section"][0])), X * cote,
                     large * Pd["cheville"], a)
        croix.append((croisee, pieds))
    (gauche, pieds_g), (droite, pieds_d) = croix
    file = (droite - gauche).normalized()
    _, _, large = pieds_g[0]
    planche(m, gauche - file * (large * T["depasse"]), droite + file * (large * T["depasse"]), Y, HAUT,
            large * T["section"][0], large * T["section"][1], large * D["ARETE"])
    hauteur, demi_y, demi_z = S["lisse"]
    for (p0, d0, _), (p1, d1, _) in zip(pieds_g, pieds_d):
        planche(m, p0 + d0 * ((gauche.z - p0.z) * hauteur / d0.z), p1 + d1 * ((gauche.z - p1.z) * hauteur / d1.z), Y,
                HAUT, large * demi_y, large * demi_z, large * D["ARETE"])

    Sc = S["scie"]
    c, (l, e, h) = pave(G.primitives[Sc["lame"]])
    nombre, creux = Sc["dents"]
    (a0, b0), (a1, b1) = Sc["fil"]
    dents = [(a0 + (a1 - a0) * k / (2 * nombre), b0 + (b1 - b0) * k / (2 * nombre) - creux * (k % 2))
             for k in range(2 * nombre + 1)]
    lame(pieces["acier"], c, X * l, HAUT * h, [*Sc["dos"], *dents], e / 2 * Sc["epaisseur"], Sc["biseau"], "acier")
    c, (l, e, h) = pave(G.primitives[Sc["poignee"]])
    lame(m, c, X * l, HAUT * h, Sc["prise"], e / 2 * Sc["joue"], Sc["arrondi"], MAT)


def ratelier(D, G, pieces, a):
    """Un râtelier d'armes d'après `RATELIER` : plinthe moulurée, deux poteaux, deux traverses chevillées que les
    hampes traversent ; trois armes d'hast, la hampe, la douille et le fer de chacune."""
    R, m = D["RATELIER"], pieces[MAT]
    geometrie.profile(m, G.primitives[R["socle"]], "h", R["plinthe"], MAT)
    poteaux = [pave(G.primitives[rang]) for rang in R["poteaux"]]
    for c, (cote, _, haut) in poteaux:
        profilee(m, c - HAUT * (haut / 2), c + HAUT * (haut / 2), (cote / 2 * R["poteau"], cote / 2 * R["poteau"]),
                 POTEAU)
    for rang in R["traverses"]:
        c, (longueur, epais, haut) = pave(G.primitives[rang])
        planche(m, c - X * (longueur / 2), c + X * (longueur / 2), Y, HAUT, epais / 2, haut / 2, haut * D["ARETE"])
        for p, (cote, _, _) in poteaux:
            for sy in COTES:
                cheville(m, Vector((p.x, p.y + sy * cote / 2 * R["poteau"], c.z)), Y * sy, cote * R["cheville"], a)

    H, Fe = R["hampe"], R["fer"]
    fers, (large, epais, haut) = pave(G.primitives[R["fers"]])
    bas, tete, part = R["douille"]
    for rang, arme in zip(R["hampes"], R["armes"]):
        c, rayon, longueur = rond(G.primitives[rang])
        tournee(m, c - HAUT * (longueur / 2), c + HAUT * (longueur / 2), X, Y, rayon * H["rayon"], H["profil"],
                H["cotes"])
        origine = Vector((c.x, fers.y, fers.z))
        lame(pieces["acier"], origine, X * (math.copysign(1, fers.x - c.x) * large / 2), HAUT * (haut / 2),
             R["dessins"][arme], epais / 2 * Fe["epaisseur"], Fe["biseau"], "acier")
        tournee(pieces["fer"], origine + HAUT * (haut / 2 * bas), origine + HAUT * (haut / 2 * tete), X, Y,
                rayon * part, CYLINDRE, H["cotes"], "fer")


def presentoir(D, G, pieces, a):
    """Un présentoir à lances d'après `PRESENTOIR` : deux joues à deux montants et traverses, la tablette de planches
    où posent les talons, la lisse chevillée et ses tasseaux, quatre lances penchées, la hampe, la douille et le fer
    en feuille de chacune."""
    R, m = D["PRESENTOIR"], pieces[MAT]
    J, T, L = R["joue"], R["planches"], R["lance"]
    lisse, (longueur, epais, haut) = pave(G.primitives[R["lisse"]])
    planche(m, lisse - X * (longueur / 2), lisse + X * (longueur / 2), Y, HAUT, epais / 2, haut / 2, haut * D["ARETE"])
    for rang in R["joues"]:
        c, (ex, ey, ez) = pave(G.primitives[rang])
        pied = c - HAUT * (ez / 2)
        dx, dy = ex / 2 * J["montant"][0], ey / 2 * J["montant"][1]
        for sy in COTES:
            axe = pied + Y * (sy * (ey / 2 - dy))
            profilee(m, axe, axe + HAUT * ez, (dx, dy), POTEAU)
        for part in J["traverses"]:
            milieu = pied + HAUT * (ez * part)
            planche(m, milieu - Y * (ey / 2 - dy), milieu + Y * (ey / 2 - dy), X, HAUT, ex / 2 * J["traverse"][0],
                    ez * J["traverse"][1], ex * D["ARETE"])
        dehors = math.copysign(1, c.x - lisse.x)
        cheville(m, Vector((c.x + dehors * dx, lisse.y, lisse.z)), X * dehors, ex * J["cheville"], a)

    c, (lx, ly, lz) = pave(G.primitives[R["tablette"]])
    bornes = [c.y - ly / 2 + ly * part for part in partage(a, T["nombre"], T["ecart"])]
    for y0, y1 in zip(bornes, bornes[1:]):
        axe = Vector((c.x, (y0 + y1) / 2, c.z))
        planche(m, axe - X * (lx / 2), axe + X * (lx / 2), Y, HAUT, (y1 - y0) / 2 - ly * T["jour"], lz / 2,
                lz * D["ARETE"])
    dessus = c.z + lz / 2 - lz * L["ancrage"]

    for hampe, fer, deport, pointe in R["lances"]:
        c, rayon, _ = rond(G.primitives[hampe])
        prisme = G.primitives[fer]
        p, (px, py, pz) = pave(prisme)
        descend = Vector(VERSANTS[prisme["slope"]])
        talon = Vector((c.x, c.y, dessus)) + descend * (px * deport)
        sommet = p + HAUT * (pz / 2) - descend * (px / 2 * pointe)
        d = (sommet - talon).normalized()
        collet = talon + d * ((p.z - pz / 2 - talon.z) / d.z)
        tournee(m, talon, collet, X, Y, rayon * L["rayon"], CYLINDRE, L["cotes"])
        lame(pieces["acier"], collet, d.cross(Y) * (px / 2), sommet - collet, L["feuille"], py / 2 * L["epaisseur"],
             L["biseau"], "acier")
        dessous, tete, part = L["douille"]
        tournee(pieces["fer"], collet - d * (pz * dessous), collet + d * (pz * tete), X, Y, rayon * part, L["cone"],
                L["cotes"], "fer")
        appui = talon + d * ((lisse.z - talon.z) / d.z)
        demi_l, demi_h = L["tasseau"]
        planche(m, Vector((appui.x, lisse.y, lisse.z)), Vector((appui.x, appui.y, lisse.z)), X, HAUT, rayon * demi_l,
                haut / 2 * demi_h, haut * D["ARETE"])


BATIR = {"enclume": enclume, "foyer-de-forge": foyer, "cuve-brasserie": cuve, "marmite": marmite, "roue-dentee": roue,
         "scie-chevalet": scie, "rack-armes": ratelier, "rack-lances": presentoir}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_], BRAISES), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
