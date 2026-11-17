"""Les éléments de bâtiment (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa
recette (`gabarit.py`), dont il lit les cotes (`geometrie.pave`, `geometrie.rond`, `geometrie.rampant`) et où
`Gabarit.rentrer` ramène le sommet qui en sortirait. Chaque pièce est une coque close : les assises d'un parement
(`pan`) ; le claveau d'un arc (`claveau`) ; des brins de paille semés (`brins`) ; un massif en assises harpées, une
pièce plate découpée d'après son contour, des ardoises en rangs, des charbons, une rampe, des planches côte à côte,
une section bosselée, une pièce tournée, une planche, une pièce profilée, une cheville, un clou et une chaîne, ceux de
`geometrie` ; une poutre de `maille`. Chaque matériau du décor est un nœud à son nom, les braises celui qui luit
(`gabarit.NOEUD_EMISSIF`). L'aléa est semé des codes de caractères de l'id du décor : deux constructions rendent les
mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (ANGLES, AXES, BRAISES, COTES, CYLINDRE, HAUT, MAT, POTEAU, X, Y, appareil, cap, chaine,
                       charbons, cheville, clou, coque, decoupee, normales, pave, planche, profilee, rampant, rond,
                       tournee)
from gabarit import NOEUD_EMISSIF
from maille import poutre

DECORS = ("cheminee", "cheminee-interieure", "clocheton", "arche-ruine", "escalier-bois", "stalle-ecurie", "grille",
          "paravent")


def pan(m, milieu, dehors, u, du, dv, queue, assises, pierres, ecart, K, a):
    """Le parement de la face de `milieu` et de normale `dehors`, de demi-côtés `du` sur `u` et `dv` en travers :
    ses `assises` (`geometrie.assise`), chacune de `pierres` moellons enfoncés de `queue`, leurs joints écartés d'au
    plus `ecart`, taillés d'après `K`. Rend le plus grand recul d'un de ses parements."""
    v = dehors.cross(u)
    haut = 2 * dv / assises
    for k in range(assises):
        geometrie.assise(m, milieu + v * (haut * (k + 0.5) - dv), dehors, u, (-du, du), pierres, ecart, haut / 2, queue,
                         K, a)
    return haut / 2 * K["parement"][1]


def claveau(m, centre, bornes, angles, demi, K, a):
    """Un claveau d'un arc du plan de x et z autour de `centre`, entre les deux `angles` (radians, de +x vers le
    haut), de demi-épaisseur `demi` le long de y, d'après `K` (une taille de `donnees.py`, en fractions de `demi`) :
    `bornes(angle)` rend ses rayons d'intrados et d'extrados ; son contour passe par le milieu de ses angles."""
    joint = demi * K["joint"]
    t0, t1 = sorted(angles)
    ecart = joint / bornes((t0 + t1) / 2)[0]
    rangs = [(X * math.cos(t) + HAUT * math.sin(t), bornes(t)) for t in (t0 + ecart, (t0 + t1) / 2, t1 - ecart)]
    contour = [centre + rayon * (dedans + joint) for rayon, (dedans, _) in rangs]
    contour += [centre + rayon * (dehors - joint) for rayon, (_, dehors) in reversed(rangs)]
    face = demi - demi * a.uniform(*K["parement"])
    decoupee(m, contour, Y, (-face, face), demi * K["arete"], "pierre")


def brins(m, pied, du, dv, epais, B, a):
    """Des brins de paille couchés sur la couche de milieu de dessous `pied`, de demi-côtés `du` (x) et `dv` (y) et
    d'épaisseur `epais`, d'après `B` : leur `nombre` ; demi-`longueur` (fractions du plus petit demi-côté, tirée) ;
    `largeur` (fraction de ce demi-côté) ; `epaisseur` et hauteur de leur milieu (`pose`, tirée), en parts d'`epais`."""
    court = min(du, dv)
    for _ in range(B["nombre"]):
        demi = court * a.uniform(*B["longueur"])
        fil = cap(a.uniform(0, 360)) * demi
        p = (pied + X * (a.uniform(-1, 1) * (du - demi)) + Y * (a.uniform(-1, 1) * (dv - demi))
             + HAUT * (epais * a.uniform(*B["pose"])))
        poutre(m, p - fil, p + fil, court * B["largeur"], epais * B["epaisseur"], HAUT, "paille")


def cheminee(D, G, pieces, a):
    """Une souche de cheminée d'après `CHEMINEE` : souche en assises harpées, couronnement à larmier posé sur son
    blocage, mitre de fer (collier, quatre pieds, chapeau en pointe)."""
    C, pierre, fer = D["CHEMINEE"], pieces["pierre"], pieces["fer"]
    c, cotes = pave(G.primitives[C["souche"]])
    dessus, _ = appareil(pierre, c, cotes, c.z - cotes[2] / 2, c.z + cotes[2] / 2, C["parement"], D["TAILLE"], a, {})
    cc, (lx, ly, lz) = pave(G.primitives[C["couronnement"]])
    tete = cc + HAUT * (lz / 2)
    profilee(pierre, Vector((cc.x, cc.y, dessus)), tete, (lx / 2, ly / 2), C["larmier"], "pierre")

    M = C["chapeau"]
    cm, (mx, my, mz) = pave(G.primitives[C["mitre"]])
    part, haut = M["collier"]
    col = tete + HAUT * (mz * haut)
    profilee(fer, tete - HAUT * (mz * M["ancrage"]), col, (mx / 2 * part, my / 2 * part), M["col"], "fer")
    assise = Vector((cm.x, cm.y, cm.z - mz / 2 + mz * M["assise"]))
    profilee(fer, assise, cm + HAUT * (mz / 2), (mx / 2 * M["debord"], my / 2 * M["debord"]), M["toit"], "fer")
    place, rayon, cotes_pied = M["pieds"]
    for sx, sy in ANGLES:
        pied = Vector((cm.x + sx * mx / 2 * place, cm.y + sy * my / 2 * place, col.z - mz * M["ancrage"]))
        tournee(fer, pied, Vector((pied.x, pied.y, assise.z + mz * M["ancrage"])), X, Y, mx / 2 * rayon, CYLINDRE,
                cotes_pied, "fer")


def atre(D, G, pieces, a):
    """Une cheminée intérieure d'après `ATRE` : sole dallée sur son socle ; deux jambages en assises harpées, dressés
    du fond des dalles ; contrecœur à deux parements devant son blocage, sa taque de fer ; linteau en plate-bande à
    clé pendante entre les jambages, sous une tablette moulurée posée sur leur blocage ; deux chenets ; lit de
    braises, charbons et bûches ardentes couchées sur les chenets."""
    A, pierre, fer, K = D["ATRE"], pieces["pierre"], pieces["fer"], D["TAILLE"]
    c, (lx, ly, lz) = pave(G.primitives[A["sole"]])
    S = A["dallage"]
    seuil, epais = c.z + lz / 2, lz * S["epaisseur"]
    profilee(pierre, c - HAUT * (lz / 2), Vector((c.x, c.y, seuil - epais / 2)), (lx / 2, ly / 2), S["socle"],
             "pierre")
    fond = seuil - pan(pierre, Vector((c.x, c.y, seuil)), HAUT, X, lx / 2, ly / 2, epais, S["rangs"], S["dalles"],
                       S["ecart"], K, a)

    jambages = [pave(G.primitives[rang]) for rang in A["jambages"]]
    appui = min(appareil(pierre, cj, cotes, fond, cj.z + cotes[2] / 2, A["jambage"], K, a, {})[0]
                for cj, cotes in jambages)
    (g, (jx, jy, _)), (d, _) = jambages
    cm, (mx, my, mz) = pave(G.primitives[A["manteau"]])
    profilee(pierre, Vector((cm.x, cm.y, appui)), cm + HAUT * (mz / 2), (mx / 2, my / 2), A["tablette"], "pierre")

    W = A["mur"]
    cc, (wx, wy, wz) = pave(G.primitives[A["contrecoeur"]])
    devant = math.copysign(1, c.y - cc.y)
    faite = cc.z + wz / 2
    queue = wy * W["queue"]
    reculs = [pan(pierre, Vector((cc.x, cc.y + cote * wy / 2, (fond + faite) / 2)), Y * cote, X, wx / 2,
                  (faite - fond) / 2, queue, assises, pierres, W["ecart"], K, a)
              for cote, (assises, pierres) in zip((devant, -devant), W["faces"])]
    poutre(pierre, (cc.x, cc.y, fond), (cc.x, cc.y, faite), wx, wy - queue, Y, "pierre")
    T = A["taque"]
    e = wy * T["epaisseur"]
    plaque = Vector((cc.x, cc.y + devant * (wy + e - reculs[0]) / 2, fond))
    decoupee(fer, [plaque + X * (wx / 2 * T["largeur"] * px) + HAUT * (wz * T["hauteur"] * pz)
                   for px, pz in T["contour"]], Y, (-(e + reculs[0]) / 2, (e + reculs[0]) / 2), e * D["ARETE"], "fer")

    L = A["linteau"]
    portee = (abs(d.x - g.x) - jx) / 2
    extrados = cm.z - mz / 2
    intrados = extrados - (extrados - fond) * L["hauteur"]
    demi = jy / 2 * L["profondeur"]
    saillie = ((cm.y - g.y) * devant + (my - jy) / 2) * L["saillie"]
    foyer = Vector(((g.x + d.x) / 2, g.y + devant * (jy / 2 + saillie - demi), intrados - portee * L["foyer"]))
    joints = [math.atan2(intrados - foyer.z, portee * (2 * k / len(L["claveaux"]) - 1))
              for k in range(len(L["claveaux"]) + 1)]
    for paire, (chute, avance) in zip(zip(joints, joints[1:]), L["claveaux"]):
        bas = intrados - (extrados - intrados) * chute - foyer.z
        claveau(pierre, foyer, lambda t, bas=bas: (bas / math.sin(t), (extrados - foyer.z) / math.sin(t)), paire,
                demi * avance, K, a)

    N = A["chenet"]
    chenets = [pave(G.primitives[rang]) for rang in A["chenets"]]
    _, (hx, hy, hz) = chenets[0]
    hauteur, section, pied = N["barre"]
    sur_barre = fond + (chenets[0][0].z + hz / 2 - fond) * hauteur
    cote, gros = hx / 2 * section, hx / 2 * pied
    for ch, _ in chenets:
        nez = Vector((ch.x, ch.y + devant * (hy / 2 - hx / 2), fond))
        talon = Vector((ch.x, ch.y - devant * (hy / 2 - gros), fond))
        profilee(fer, nez, Vector((nez.x, nez.y, ch.z + hz / 2)), (hx / 2, hx / 2), N["montant"], "fer")
        planche(fer, nez + HAUT * (sur_barre - fond - cote), talon + HAUT * (sur_barre - fond - cote), X, HAUT, cote,
                cote, hx * D["ARETE"], "fer")
        planche(fer, talon, Vector((talon.x, talon.y, sur_barre + gros - cote)), X, Y, gros, gros, hx * D["ARETE"],
                "fer")

    F, emet = A["feu"], pieces[NOEUD_EMISSIF]
    cb, (bx, by, bz) = pave(G.primitives[A["braises"]])
    dessus = Vector((cb.x, cb.y, fond + bz * F["hauteur"]))
    profilee(emet, Vector((cb.x, cb.y, fond)), dessus, (bx / 2, by / 2), F["lit"], BRAISES)
    charbons(emet, dessus, bx / 2 * F["semis"], by / 2 * F["semis"], F, a)
    debord, pose, cotes_buche = F["couche"]
    for place, part in F["buches"]:
        rayon = hx * part
        axe = Vector(((g.x + d.x) / 2, chenets[0][0].y + hy / 2 * place, sur_barre + rayon * pose))
        portee_buche = X * (abs(chenets[1][0].x - chenets[0][0].x) / 2 + hx * debord)
        tournee(emet, axe - portee_buche, axe + portee_buche, Y, HAUT, rayon, F["buche"], cotes_buche, BRAISES)


def clocheton(D, G, pieces, a):
    """Un clocheton d'après `CLOCHETON` : plinthe à glacis ; tour en assises harpées, ouverte d'une baie sur chaque
    face d'abat-sons ; corniche moulurée posée sur son blocage ; dans chaque baie un cadre de fers plats et des lames
    inclinées, pris dans le blocage ; une cloche de laiton et son battant, pendus par une chaîne à une potence de fer
    scellée au-dessus de la baie ; un comble à deux versants, ses ardoises en rangs sur un massif, deux pignons de
    pierre en assises, une faîtière ; la croix de laiton, plantée dans la faîtière."""
    C, pierre, fer, laiton, ardoise = (D["CLOCHETON"], pieces["pierre"], pieces["fer"], pieces["laiton"],
                                       pieces["ardoise"])
    K = D["TAILLE"]
    socle = G.primitives[C["socle"]]
    geometrie.profile(pierre, socle, "h", C["plinthe"], "pierre")
    _, (_, _, sz) = pave(socle)
    ct, cotes = pave(G.primitives[C["tour"]])
    _, ty, tz = cotes
    lit, tete = ct.z - tz / 2 - sz * C["ancrage"], ct.z + tz / 2
    abats = [(math.copysign(1, cb.y - ct.y), cb, boite) for cb, boite in
             (pave(G.primitives[rang]) for rang in C["abat_sons"])]
    baies = {cote: ((cb.x - ct.x - bx / 2, cb.x - ct.x + bx / 2), (cb.z - bz / 2, cb.z + bz / 2))
             for cote, cb, (bx, _, bz) in abats}
    dessus, queue = appareil(pierre, ct, cotes, lit, tete, C["parement"], K, a, baies)
    cc, (kx, ky, kz) = pave(G.primitives[C["corniche"]])
    egout = cc.z + kz / 2
    profilee(pierre, Vector((cc.x, cc.y, dessus)), Vector((cc.x, cc.y, egout)), (kx / 2, ky / 2), C["moulure"],
             "pierre")

    F = C["abat_son"]
    for cote, cb, (bx, by, bz) in abats:
        nu, scelle = cb.y + cote * by / 2, ct.y + cote * ((ty - queue) / 2 - by * F["ancrage"])
        axe, demi, w = Vector((cb.x, (nu + scelle) / 2, cb.z)), abs(nu - scelle) / 2, bx * F["fer"]
        for s in COTES:
            montant = axe + X * (s * (bx / 2 - w))
            planche(fer, montant - HAUT * (bz / 2), montant + HAUT * (bz / 2), X, Y, w, demi, w * D["ARETE"], "fer")
            traverse = axe + HAUT * (s * (bz / 2 - w))
            planche(fer, traverse - X * (bx / 2 - w), traverse + X * (bx / 2 - w), Y, HAUT, demi * F["traverse"], w,
                    w * D["ARETE"], "fer")
        pas = bz / F["lames"]
        fil = (Y * (cote * 2 * demi) - HAUT * (pas * F["pente"])).normalized()
        for k in range(F["lames"]):
            lame = axe + HAUT * (pas * (k + 0.5) - bz / 2)
            poutre(fer, lame - X * (bx / 2 - w), lame + X * (bx / 2 - w), 2 * demi * F["portee"] / abs(fil.y),
                   by * F["tole"], X.cross(fil), "fer")

    B = C["sonnerie"]
    cloche = G.primitives[C["cloche"]]
    cl, _, h = rond(cloche)
    apotheme = geometrie.apotheme(cloche)
    cote = math.copysign(1, cl.y - ct.y)
    pied, cerveau = cl - HAUT * (h / 2), cl + HAUT * (h / 2)
    tournee(laiton, pied + HAUT * (h * B["levre"]), cerveau, X, Y, apotheme, B["robe"], B["cotes"], "laiton")
    part, haut = B["battant"]
    tournee(fer, pied, pied + HAUT * (h * haut), X, Y, apotheme * part, B["poire"], B["cotes"], "fer")
    hauteur, portee, section = B["potence"]
    linteau = baies[cote][1][1]
    bras = Vector((cl.x, ct.y + cote * ((ty - queue) / 2 - apotheme * section), linteau + (tete - linteau) * hauteur))
    planche(fer, bras, Vector((cl.x, cl.y + cote * apotheme * portee, bras.z)), X, HAUT, apotheme * section,
            apotheme * section, apotheme * section * D["ARETE"], "fer")
    grand, petit, serre, segments = B["maillons"]
    grand, petit = apotheme * grand, apotheme * petit
    bas, sommet = cerveau.z + grand * serre, bras.z - apotheme * section - grand * serre
    chaine(fer, cl.x, cl.y, bas, sommet, math.ceil((sommet - bas) / (2 * (grand - petit) * serre)) + 1, grand, petit,
           segments, "fer")

    T = C["toit"]
    versants = [rampant(G.primitives[rang]) for rang in C["versants"]]
    faite = (versants[0][1] + versants[1][1]) / 2
    large = versants[0][4]
    e, jeu = large * T["epaisseur"], large * T["jeu"]
    rives = []
    for descend, crete, bord, long, _ in versants:
        travers = descend.cross(HAUT)
        fil = (bord - crete).normalized()
        n = travers.cross(fil)
        debut, pente = (faite - crete).dot(descend) / long, (bord - crete).length
        geometrie.ardoises(ardoise, crete + fil * (pente * debut), fil, travers, n, pente * (1 - debut), large, large,
                           T, a)
        sous = jeu + e * T["lit"]
        rives.append((bord - n * sous, crete + fil * (pente * debut) - HAUT * (sous / n.z)))
    (devant, tete_devant), (derriere, tete_derriere) = rives
    pointe = (tete_devant + tete_derriere) / 2
    N = T["pignon"]
    epais = large * N["epaisseur"]
    travers = X * (large / 2 - epais + epais * N["ancrage"])
    coque(ardoise, [[p + travers * s for p in (devant, pointe, derriere)] for s in COTES], "ardoise")
    joint = epais / 2 * K["joint"]
    niveaux = [N["tete"] * k / len(N["assises"]) for k in range(len(N["assises"]) + 1)]
    for s in COTES:
        nu = X * (s * (large - epais) / 2)
        for (z0, z1), pierres in zip(zip(niveaux, niveaux[1:]), N["assises"]):
            limites = geometrie.partage(a, pierres, N["ecart"])
            for x0, x1 in zip(limites, limites[1:]):
                coins = [devant.lerp(pointe, z).lerp(derriere.lerp(pointe, z), x)
                         for z, x in ((z0, x0), (z0, x1), (z1, x1), (z1, x0))]
                centre = sum(coins, Vector()) / len(coins)
                face = epais / 2 - epais / 2 * a.uniform(*K["parement"])
                decoupee(pierre, [nu + p + (centre - p).normalized() * joint for p in coins], X, (-face, face),
                         epais / 2 * K["arete"], "pierre")
    ch, (hx, hy, hz) = pave(G.primitives[C["hampe"]])
    rouleau = (versants[0][1] - versants[1][1]).length * T["faitiere"]
    axe = faite - HAUT * rouleau
    tournee(ardoise, axe - X * (large / 2), axe + X * (large / 2), Y, HAUT, rouleau, CYLINDRE, T["pans"], "ardoise")
    profilee(laiton, Vector((ch.x, ch.y, axe.z)), ch + HAUT * (hz / 2), (hx / 2, hy / 2), C["croix"], "laiton")
    cv, (vx, vy, vz) = pave(G.primitives[C["traverse"]])
    planche(laiton, cv - X * (vx / 2), cv + X * (vx / 2), Y, HAUT, vy / 2 * C["bras"], vz / 2, vz * D["ARETE"],
            "laiton")


def arche(D, G, pieces, a):
    """Une arche en ruine d'après `ARCHE` : deux piédroits en assises harpées, arasés à la naissance ; un arc en
    plein cintre dont restent les claveaux du côté du piédroit de la recette le plus haut, clé comprise, et le
    sommier de l'autre, pris dans son blocage ; un tas de charge de pierres taillées contre l'extrados ; derrière
    eux un blocage d'un seul tenant, pris dans le premier piédroit ; un claveau tombé."""
    A, m = D["ARCHE"], pieces["pierre"]
    K = A["taille"]
    piedroits = [pave(G.primitives[rang]) for rang in A["piedroits"]]
    (g, (gx, gy, _)), (d, (dx, _, _)) = piedroits
    naissance = min(c.z + cotes[2] / 2 for c, cotes in piedroits)
    blocages = [appareil(m, c, cotes, c.z - cotes[2] / 2, naissance, A["parement"], K, a, {})[0]
                for c, cotes in piedroits]
    ct, (lx, _, lz) = pave(G.primitives[A["linteau"]])
    sens = math.copysign(1, d.x - g.x)
    centre = Vector(((g.x + sens * gx / 2 + d.x - sens * dx / 2) / 2, g.y, naissance))
    dedans = abs(d.x - g.x) / 2 - (gx + dx) / 4
    sommet = ct.z + lz / 2
    dehors = (sommet - naissance) * A["extrados"]
    demi = gy / 2
    joint = demi * K["joint"]
    nombre, restent, charges = A["claveaux"]

    def angle(k):
        """L'angle du joint de rang `k` de l'arc, compté depuis le premier piédroit."""
        return math.pi / 2 + sens * (math.pi / 2) * (1 - 2 * k / nombre)

    def rayon(t):
        """Le rayon unitaire de l'arc à l'élévation `t` au-dessus de la naissance, du côté du premier piédroit."""
        return HAUT * math.sin(t) - X * (sens * math.cos(t))

    for k in range(restent):
        claveau(m, centre, lambda t: (dedans, dehors), (angle(k), angle(k + 1)), demi, K, a)
    _, (_, sy, _) = pave(G.primitives[A["sommier"]])
    prise = [math.asin(min(1.0, A["prise"] * (naissance - blocage) / dedans)) for blocage in blocages]
    claveau(m, centre, lambda t: (dedans, dehors), (angle(nombre - 1), angle(nombre) - sens * prise[1]), sy / 2, K, a)

    rive = min(abs(g.x - sens * gx / 2 - centre.x), abs(ct.x - sens * lx / 2 - centre.x))
    butee = math.pi * charges / nombre

    def dos(r, t0, haut, marge):
        """Le contour d'une pierre adossée à l'arc : le long du cercle de rayon `r` depuis l'élévation `t0` jusqu'à
        la hauteur `haut` ou la butée du tas de charge, puis à l'aplomb jusqu'à `haut`, la rive à `marge` du bord et
        retour à la hauteur du départ."""
        t1 = min(math.asin(min(1.0, (haut - naissance) / r)), butee)
        arc = [centre + rayon(t0 + (t1 - t0) * k / A["pas"]) * r for k in range(A["pas"] + 1)]
        if haut - arc[-1].z > joint:
            arc.append(Vector((arc[-1].x, arc[-1].y, haut)))
        bord = centre.x - sens * (rive - marge)
        return arc + [Vector((bord, centre.y, haut)), Vector((bord, centre.y, arc[0].z))]

    niveaux = [naissance + (sommet - naissance) * part for part in A["tas_de_charge"]]
    for z0, z1 in zip(niveaux, niveaux[1:]):
        face = demi - demi * a.uniform(*K["parement"])
        decoupee(m, dos(dehors + joint, math.asin((z0 + joint - naissance) / (dehors + joint)), z1 - joint, joint), Y,
                 (-face, face), demi * K["arete"], "pierre")
    retrait = (dehors - dedans) * A["blocage"][0]
    bout = math.pi * restent / nombre - retrait / dedans
    cintre = [centre + rayon(-prise[0] + (bout + prise[0]) * k / (restent * A["pas"])) * (dedans + retrait)
              for k in range(restent * A["pas"] + 1)]
    queue = [centre + rayon(butee + (bout - butee) * k / A["pas"]) * (dehors - retrait)
             for k in range(A["pas"], 0, -1)]
    massif = cintre + queue + dos(dehors - retrait, butee, sommet - retrait, retrait)[A["pas"]:-1]
    massif.append(Vector((massif[-1].x, centre.y, cintre[0].z)))
    decoupee(m, massif, Y, (-demi * A["blocage"][1], demi * A["blocage"][1]), joint, "pierre")

    cb, (bx, by, bz) = pave(G.primitives[A["bloc"]])
    decoupee(m, [cb + X * (bx / 2 * px) + Y * (by / 2 * py) for px, py in A["tombe"]], HAUT, (-bz / 2, bz / 2),
             bz / 2 * K["arete"], "pierre")


def escalier(D, G, pieces, a):
    """Un escalier de bois d'après `ESCALIER` : deux limons à crémaillère du sol au palier, un poteau sous la tête
    de chacun ; quatre marches posées dans leurs crans, chacune glissée sous le nez de la suivante ; une contremarche
    par marche, en retrait sous le nez ; à gauche, la lisse basse de la recette, deux poteaux à chanfreins arrêtés
    coiffés d'un pommeau tourné, une main courante et une lisse rampantes, des balustres tournés entre elles."""
    E, bois = D["ESCALIER"], pieces[MAT]
    marches = [pave(G.primitives[rang]) for rang in E["marches"]]
    (c0, (lx, ly, lz)), (c1, _) = marches[:2]
    monte = Vector((c1.x - c0.x, c1.y - c0.y, 0)).normalized()
    travers = monte.cross(HAUT)
    giron = abs(monte.dot(Vector((lx, ly, 0))))
    large, sol = lx + ly - giron, c0.z - lz / 2
    M, L = E["marche"], E["limon"]
    e, plat = giron * M["epaisseur"], giron * M["contremarche"]
    recul, prise = giron * M["retrait"], e * M["ancrage"]
    origine = Vector((c0.x, c0.y, 0)) - monte * (giron / 2)
    fronts = [(c - c0).dot(monte) for c, _ in marches]
    fin, cote = fronts[-1] + giron, giron * L["poteau"]
    bout = fin - cote - prise
    sieges = [c.z + cotes[2] / 2 - e + prise for c, cotes in marches]
    crans = [front + recul + plat * (1 - M["ancrage"]) for front in fronts] + [bout]
    sous = sol
    for front, siege in zip(fronts, sieges):
        arriere = min(front + giron + recul + plat * M["ancrage"], fin)
        axe = origine + monte * ((front + arriere) / 2) + HAUT * (siege - prise + e / 2)
        planche(bois, axe - travers * (large / 2), axe + travers * (large / 2), monte, HAUT, (arriere - front) / 2,
                e / 2, e * D["ARETE"])
        face = origine + monte * (front + recul + plat / 2) + HAUT * ((sous + siege) / 2)
        planche(bois, face - travers * (large / 2 * M["largeur"]), face + travers * (large / 2 * M["largeur"]), HAUT,
                monte, (siege - sous) / 2, plat / 2, plat * D["ARETE"])
        sous = siege - prise

    pente = (sieges[1] - sieges[0]) / (crans[1] - crans[0])
    gorge = sieges[0] - (sieges[1] - sieges[0]) * L["gorge"]
    profil = [(crans[0], sol)]
    for k, siege in enumerate(sieges):
        profil += [(crans[k], siege), (crans[k + 1], siege)]
    profil += [(bout, gorge + (bout - crans[1]) * pente), (crans[1] - (gorge - sol) / pente, sol)]
    demi = giron * L["epaisseur"]
    for s in COTES:
        rive = origine + travers * (s * large / 2 * L["place"])
        decoupee(bois, [rive + monte * x + HAUT * z for x, z in profil], travers, (-demi, demi), demi * D["ARETE"],
                 MAT)
        pied = rive + monte * bout
        profilee(bois, pied + HAUT * sol, pied + HAUT * sieges[-1], (cote, cote), POTEAU)
    geometrie.rampe(bois, G, E["rampe"], D["ARETE"], (bois, MAT))


def stalle(D, G, pieces, a):
    """Une stalle d'écurie d'après `STALLE` : une litière de paille et ses brins ; deux cloisons, chacune de poteaux
    à chanfreins arrêtés plantés au sol, d'une lisse haute entre eux et de planches inégales chevillées du côté de la
    litière ; le poteau cornier, à tête taillée, sa patère ; une mangeoire de planches (fond, devant incliné, dos,
    deux joues) sur deux pieds, garnie d'un tas de foin bosselé qui déborde les rives, des brins qui en sortent."""
    S, bois, paille = D["STALLE"], pieces[MAT], pieces["paille"]
    cl, (lx, ly, lz) = pave(G.primitives[S["litiere"]])
    sol = cl - HAUT * (lz / 2)
    L = S["lit"]
    couche = lz * L["hauteur"]
    profilee(paille, sol, sol + HAUT * couche, (lx / 2, ly / 2), L["profil"], "paille")
    brins(paille, sol, lx / 2, ly / 2, couche, L["brins"], a)

    C = S["cloison"]
    for rang, places in zip(S["cloisons"], S["poteaux"]):
        c, (bx, by, bz) = pave(G.primitives[rang])
        (u, long), (n, epais) = sorted(((X, bx), (Y, by)), key=lambda cote: -cote[1])
        dedans = n * math.copysign(1, (cl - c).dot(n))
        bas, haut = c.z - bz / 2, c.z + bz / 2
        portee = u * ((long - epais) / 2)
        demi = epais / 2 * C["poteau"]
        pieds = [Vector((c.x, c.y, sol.z)) + portee * part for part in places]
        for pied in pieds:
            profilee(bois, pied, Vector((pied.x, pied.y, haut)), (demi, demi), POTEAU)
        large, haute, sous = (epais * part for part in C["lisse"])
        axe = Vector((c.x, c.y, haut - sous - haute / 2))
        planche(bois, axe - portee, axe + portee, n, HAUT, large / 2, haute / 2, haute * D["ARETE"])
        for fil in geometrie.bordage(bois, Vector((c.x, c.y, (bas + axe.z) / 2)), u, HAUT, long - epais, axe.z - bas,
                                     epais * C["planche"], C["planches"], D, a):
            for pied in pieds:
                cheville(bois, Vector((pied.x, pied.y, fil.z)) + dedans * demi, dedans, epais * C["cheville"], a)

    cp, (px, _, pz) = pave(G.primitives[S["cornier"]])
    geometrie.profile(bois, G.primitives[S["cornier"]], "h", S["tete"], MAT)
    hauteur, enfonce, longueur, rayon, pans = S["patere"]
    vers = X * math.copysign(1, cl.x - cp.x)
    face = cp + vers * (px / 2) + HAUT * (pz * (hauteur - 1 / 2))
    tournee(bois, face - vers * (px * enfonce), face + vers * (px * longueur), *normales(vers), px * rayon,
            S["crochet"], pans)

    A = S["mangeoire"]
    descend, crete, bord, long, large = rampant(G.primitives[S["auge"]])
    travers = descend.cross(HAUT)
    e = long * A["epaisseur"]
    portee = travers * ((large - e) / 2)

    def lieu(s, z):
        """Le point de la coupe de l'auge à la part `s` de sa profondeur depuis son dos et à la part `z` de sa
        hauteur depuis son fond."""
        return crete + descend * (long * s) + HAUT * ((crete.z - bord.z) * (z - 1))

    for s in COTES:
        decoupee(bois, [lieu(*coin) + portee * s for coin in A["joue"]], travers, (-e / 2, e / 2), e * D["ARETE"], MAT)
    for coins in A["planches"]:
        p0, p1 = (lieu(*coin) for coin in coins)
        fil = (p1 - p0).normalized()
        planche(bois, (p0 + p1) / 2 - portee, (p0 + p1) / 2 + portee, fil, travers.cross(fil), (p1 - p0).length / 2,
                e / 2, e * D["ARETE"])
    place, cote = A["pied"]
    for s in COTES:
        pied = lieu(place, 0) + portee * s
        profilee(bois, Vector((pied.x, pied.y, sol.z)), pied, (e * cote, e * cote), POTEAU)
    F = A["foin"]
    creux = crete.z - bord.z
    (s0, z0), (s1, z1) = A["planches"][F["devant"]]
    marge, sol_auge = e / long, e / creux

    def dans_l_auge(p):
        """`p`, ramené sous les rives dans le dedans de l'auge, entre ses planches."""
        s, z = (p - crete).dot(descend) / long, (p.z - bord.z) / creux
        if z >= 1:
            return p
        z = max(z, sol_auge)
        s = min(max(s, marge), s0 + (s1 - s0) * (z - z0) / (z1 - z0) - marge)
        return lieu(s, z) + travers * (p - crete).dot(travers)

    rive, bombe = lieu(F["place"], 1), creux * F["bombe"]
    dedans = portee - travers * (e / 2)
    anneaux = []
    for t, part in F["profil"]:
        centre = rive - dedans + dedans * (2 * t)
        tour = geometrie.bosselee(a, descend * (long * F["debord"]), HAUT * bombe, F["cotes"], F["bosse"])(centre, part)
        premier = min(range(F["cotes"]),
                      key=lambda j: math.atan2((tour[j] - centre).z, (tour[j] - centre).dot(descend)) % (2 * math.pi))
        anneaux.append([dans_l_auge(p) for p in tour[premier:] + tour[:premier]])
    coque(paille, anneaux, "paille")
    emprise = dedans + descend * (long * F["debord"])
    brins(paille, rive, abs(emprise.x), abs(emprise.y), bombe, F["brins"], a)


def grille(D, G, pieces, a):
    """Une grille d'égout d'après `GRILLE` : la fosse d'ombre ; un cadre de quatre fers plats, deux longerons et deux
    traverses prises entre eux, rivés ; trois barreaux à trous renflés, traversés par trois barreaux ronds, leurs
    bouts pris dans le cadre."""
    R, fer = D["GRILLE"], pieces["fer"]
    c, (lx, ly, lz) = pave(G.primitives[R["fosse"]])
    profilee(pieces["ombre"], c - HAUT * (lz / 2), c + HAUT * (lz * (R["fond"] - 1 / 2)), (lx / 2, ly / 2),
             R["plaque"], "ombre")

    K = R["fers"]
    cadre = [pave(G.primitives[rang]) for rang in R["cadre"]]
    longeron, (x0, y0, _) = cadre[0]
    for cb, (bx, by, bz) in cadre:
        long, travers = (X, Y) if bx > by else (Y, X)
        traverse = (bx > by) != (x0 > y0)
        large, haut = min(bx, by), bz * K["hauteur"][traverse]
        portee = max(bx, by) / 2
        if traverse:
            portee = abs((longeron - cb).dot(long)) - min(x0, y0) * (1 / 2 - K["ancrage"])
        axe = cb + HAUT * ((haut - bz) / 2)
        profilee(fer, axe - long * portee, axe + long * portee, (large / 2, haut / 2), K["profil"], "fer", travers,
                 HAUT)
        for part in K["rivets"]:
            clou(fer, axe + long * (portee * part) + HAUT * (haut / 2), HAUT, K["rivet"], large / 2, "fer")

    B = R["barreau"]
    barreaux = [(primitive, *rond(primitive)) for primitive in (G.primitives[rang] for rang in R["barreaux"])]
    perce = barreaux[0][0]["axis"]
    for primitive, cb, _, long in barreaux:
        _, axe = AXES[primitive["axis"]]
        apotheme = geometrie.apotheme(primitive)
        profil = [(0.0, B["passant"]), (1.0, B["passant"])]
        if primitive["axis"] == perce:
            croises = sorted((autre - cb).dot(axe) / long + 1 / 2 for p, autre, _, _ in barreaux
                             if p["axis"] != perce)
            profil = ([(0.0, B["corps"])]
                      + [(t + pas * apotheme / long, part) for t in croises for pas, part in B["renflement"]]
                      + [(1.0, B["corps"])])
        tournee(fer, cb - axe * (long / 2), cb + axe * (long / 2), *normales(axe), apotheme, profil, primitive["sides"],
                "fer")


def paravent(D, G, pieces, a):
    """Un paravent d'après `PARAVENT` : trois feuilles, celle du milieu droite, les deux autres ouvertes vers le
    front depuis ses montants ; par feuille deux montants à chanfreins arrêtés, trois traverses et une toile tendue
    dans leur épaisseur ; entre deux feuilles voisines, des gonds de bois tournés pris dans leurs deux montants."""
    P, bois = D["PARAVENT"], pieces[MAT]
    (ag, (mx, my, mz)), (ad, _) = (pave(G.primitives[rang]) for rang in P["montants"])
    panneaux = [pave(G.primitives[rang]) for rang in P["panneaux"]]
    (hg, _), (hd, _) = (pave(G.primitives[rang]) for rang in P["charnieres"])
    plan = panneaux[len(panneaux) // 2][0].y
    sol, tete = ag.z - mz / 2, ag.z + mz / 2
    demi, e = mx / 2, my / 2 * P["epaisseur"]
    noeuds = [Vector((ag.x, ag.y, 0)), Vector((hg.x, plan, 0)), Vector((hd.x, plan, 0)), Vector((ad.x, ad.y, 0))]
    feuilles = []
    for p, q, (debut, fin) in zip(noeuds, noeuds[1:], P["retraits"]):
        fil = (q - p).normalized()
        feuilles.append((p + fil * (demi * debut), q - fil * (demi * fin), fil))
    for (p, q, fil), (cp, (_, py, pz)) in zip(feuilles, panneaux):
        n = HAUT.cross(fil)
        for pied in (p, q):
            profilee(bois, pied + HAUT * sol, pied + HAUT * tete, (demi, e), P["montant"], MAT, fil, n)
        for z0, z1 in P["traverses"]:
            axe = HAUT * (cp.z + pz * ((z0 + z1) / 2 - 1 / 2))
            planche(bois, p + axe, q + axe, n, HAUT, e * P["traverse"], pz * (z1 - z0) / 2, e * D["ARETE"])
        toile = py / 2 * P["toile"]
        planche(pieces["toile"], p + HAUT * cp.z, q + HAUT * cp.z, n, HAUT, toile, pz / 2, toile / 2, "toile")
    rayon, haut, cotes = P["gond"]
    for (_, q, f0), (p, _, f1) in zip(feuilles, feuilles[1:]):
        axe = (q + f0 * demi + p - f1 * demi) / 2
        for part in P["gonds"]:
            z = sol + (tete - sol) * part
            tournee(bois, axe + HAUT * (z - demi * haut), axe + HAUT * (z + demi * haut), X, Y, demi * rayon,
                    P["broche"], cotes)


BATIR = {"cheminee": cheminee, "cheminee-interieure": atre, "clocheton": clocheton, "arche-ruine": arche,
         "escalier-bois": escalier, "stalle-ecurie": stalle, "grille": grille, "paravent": paravent}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_], BRAISES), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
