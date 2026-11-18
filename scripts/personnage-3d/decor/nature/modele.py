"""Les petites choses vivantes du sol et des marais (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe
convexe des primitives de sa recette (`gabarit.py`), dont il lit les cotes (`geometrie.pave`, `geometrie.bouts`,
`geometrie.apotheme`, `Gabarit.portee`) et où `Gabarit.rentrer` ramène le sommet qui en sortirait. Chaque pièce est une
coque close : une pièce tournée ou profilée, une pièce ronde courbée, une pièce plate découpée, une étoffe froncée, une
section bosselée et sa coque, un fil droit et une feuille en lame, ceux de `geometrie` ; une révolution de `maille` ;
les bosses semées sur une coque (`semis`), de cette famille.
Chaque matériau du décor est un nœud à son nom. L'aléa est semé des codes de caractères de l'id du décor : deux
constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (COTES, FRONT, HAUT, apotheme, autour, bosselee, bossue, bouts, coque, courbee, decoupee, feuille,
                       fil, froncee, lisse, normales, pave, profilee, tourne, tournee)
from maille import lineaire, tour

DECORS = ("terrier", "cocon", "toile", "champignon", "nenuphars", "roseaux")


def semis(m, anneaux, rangs, nombre, S, taille, a, mat):
    """`nombre` bosses tournées semées sur la coque des `anneaux` (`geometrie.bossue`), chacune au milieu d'une face
    tirée entre les anneaux de rangs `rangs[0]` à `rangs[1]`, dressée sur la normale de cette face, d'après `S`, en
    fractions de `taille` : son `rayon` tiré, ce dont elle entre dans la face (`enfonce`) et en sort (`saillie`), en
    parts de son rayon, son `profil`, ses `cotes`."""
    cotes = len(anneaux[0])
    for _ in range(nombre):
        i, j = a.randrange(*rangs), a.randrange(cotes)
        coins = (anneaux[i][j], anneaux[i][(j + 1) % cotes], anneaux[i + 1][(j + 1) % cotes], anneaux[i + 1][j])
        n = (coins[2] - coins[0]).cross(coins[3] - coins[1]).normalized()
        milieu = sum(coins, Vector()) / 4
        rayon = taille * a.uniform(*S["rayon"])
        tournee(m, milieu - n * (rayon * S["enfonce"]), milieu + n * (rayon * S["saillie"]), *normales(n), rayon,
                S["profil"], S["cotes"], mat)



def terrier(D, G, pieces, a):
    """Un terrier d'après `TERRIER` : butte bosselée semée de mottes, tas de déblais à son pied, porche voûté à
    lèvre arrondie, sa gueule creusée jusqu'à une plaque d'ombre."""
    T, terre = D["TERRIER"], pieces["terre"]
    talus = G.primitives[T["talus"]]
    sol, _, u, w, _ = bouts(talus)
    _, cime, _, _, _ = bouts(G.primitives[T["butte"]])
    rayon = apotheme(talus)
    anneaux = bossue(terre, sol, cime, bosselee(a, u, w, T["cotes"], T["bosse"]), rayon, T["profil"], "terre", cime)
    semis(terre, anneaux, T["semis"], T["mottes"], D["MOTTE"], rayon, a, "terre")
    for x, y, taille, hauteur in T["deblais"]:
        pied = sol + (u * x + w * y) * rayon
        tete = pied + u.cross(w) * (rayon * hauteur)
        bossue(terre, pied, tete, bosselee(a, u, w, T["cotes_des_tas"], T["bosse"]), rayon * taille, T["tas"],
               "terre", tete)

    cp, cotes_du_porche = pave(G.primitives[T["porche"]])
    co, cotes_de_l_ombre = pave(G.primitives[T["ombre"]])
    travers = HAUT.cross(FRONT)
    (long, large, haut), (epais, baie, jour) = ([abs(d.dot(Vector(cotes))) for d in (FRONT, travers, HAUT)]
                                                for cotes in (cotes_du_porche, cotes_de_l_ombre))
    arriere = cp - FRONT * (long / 2) - HAUT * (haut / 2)
    seuil = HAUT * (co.z - jour / 2 - arriere.z)

    def cintre(base, demi, fleche):
        """Le contour en demi-ovale de base `base`, de demi-largeur `demi` et de hauteur `fleche` : d'une naissance
        à l'autre, par son sommet."""
        return [base + travers * (demi * math.cos(math.pi * i / T["pas"]))
                + HAUT * (fleche * math.sin(math.pi * i / T["pas"])) for i in range(T["pas"] + 1)]

    cintres = [cintre(arriere + FRONT * (long * t), large / 2 * part_l, haut * part_h)
               for t, part_l, part_h in T["voute"]]
    cintres += [cintre(arriere + FRONT * (long * t) + seuil, baie / 2 * part, jour * part) for t, part in T["gueule"]]
    coque(terre, cintres, "terre")
    fond = arriere + FRONT * (long * T["gueule"][-1][0]) + seuil
    decoupee(pieces["ombre"], cintre(fond, baie / 2, jour), FRONT, (-epais / 2, epais / 2), epais * T["arete"],
             "ombre")


def cocon(D, G, pieces, a):
    """Un cocon d'après `COCON` : fuseau cordé de torons en hélice, câble torsadé à sa pointe, fils de l'épaule au
    câble, haubans de la panse à leurs attaches posées au sol."""
    C, soie = D["COCON"], pieces["soie"]
    pied = G.primitives[C["pied"]]
    sol, _, u, w, _ = bouts(pied)
    axe = u.cross(w)
    profil = []
    for nom, t, part in C["fuseau"]:
        primitive = G.primitives[C[nom]]
        bas, haut, _, _, _ = bouts(primitive)
        profil.append(((bas.lerp(haut, t) - sol).dot(axe), apotheme(primitive) * part))
    hauteur = profil[-1][0]
    tours = [2 * math.pi * j / C["cotes"] for j in range(C["cotes"])]
    coque(soie, [[sol + axe * (hauteur * i / (C["tours"] * C["pas"]))
                  + autour(u, w, t) * (lineaire(profil, hauteur * i / (C["tours"] * C["pas"]))
                                       * (1 - C["creux"] * (1 - math.cos(C["torons"] * t - 2 * math.pi * i / C["pas"]))
                                          / 2)) for t in tours]
                 for i in range(C["tours"] * C["pas"] + 1)], "soie")

    def prise(niveau, vers):
        """Le point du dedans du fuseau à la part `niveau` de sa hauteur, du côté de `vers`."""
        return (sol + axe * (hauteur * niveau)
                + vers * (lineaire(profil, hauteur * niveau) * (1 - C["creux"]) * C["dedans"]))

    cf, (fx, fy, fz) = pave(G.primitives[C["fil"]])
    profilee(soie, cf - axe * (fz / 2 + fz * C["ancrage"]), cf + axe * (fz / 2), (fx / 2, fy / 2), C["cable"], "soie",
             u, w)
    brin = min(fx, fy) / 2 * C["brin"]
    phase = a.uniform(0, 2 * math.pi)
    for k in range(C["fils"]):
        fil(soie, prise(C["depart"], autour(u, w, phase + 2 * math.pi * k / C["fils"])),
            cf + axe * (fz * (C["arrivee"] - 1 / 2)), brin, C["brin_cotes"], "soie")
    A, portee = C["attache"], apotheme(pied)
    for k in range(C["haubans"]):
        vers = autour(u, w, math.radians(360 * k / C["haubans"] + a.uniform(-C["ecart"], C["ecart"])))
        pose = sol + vers * (portee * C["portee"])
        tete = pose + axe * (portee * A["hauteur"])
        tournee(soie, pose, tete, u, w, portee * A["rayon"], A["profil"], A["cotes"], "soie")
        fil(soie, prise(C["prise"], vers), pose.lerp(tete, 1 / 2), brin, C["brin_cotes"], "soie")


def toile(D, G, pieces, a):
    """Une toile d'araignée d'après `TOILE` : rayons tendus du moyeu, fil de cadre sur le carré du dehors de la
    recette, spirale fléchie entre les rayons, du carré du dedans à celui du dehors par celui du milieu, son écart au
    moyeu sur chaque rayon pris entre leurs croisements (`maille.lineaire`), araignée tête en bas, le bout de ses huit
    pattes coudées sur un nœud de la spirale."""
    T, soie, ombre = D["TOILE"], pieces["soie"], pieces["ombre"]
    cm, cotes_du_montant = pave(G.primitives[T["montant"]])
    ct, _ = pave(G.primitives[T["traverse"]])
    travers = HAUT.cross(FRONT)
    moyeu = cm + HAUT * (ct.z - cm.z)
    demi = abs(FRONT.dot(Vector(cotes_du_montant))) / 2
    r_fil, r_soie = demi * T["fil"], demi * T["soie"]
    carres = []
    for rangs in T["carres"]:
        centres = [pave(G.primitives[rang])[0] for rang in rangs]
        centre = sum(centres, Vector()) / len(centres)
        carres.append([(c, (c - centre).normalized()) for c in centres])
    rayons = []
    for j in range(T["rayons"]):
        d = autour(travers, HAUT, 2 * math.pi * (j + a.uniform(-T["ecart"], T["ecart"])) / T["rayons"])
        croises = [min((p - moyeu).dot(n) / d.dot(n) for p, n in carre if d.dot(n) > 0) for carre in carres]
        rayons.append((d, croises))
        portee = croises[-1] if j % 2 else max(croises[-1], G.portee(moyeu, d, D["RETRAIT"] + r_fil))
        fil(soie, moyeu, moyeu + d * portee, r_fil, T["fil_cotes"], "soie")
    cadres = [moyeu + d * croises[-1] for d, croises in rayons]
    for p, q in zip(cadres, cadres[1:] + cadres[:1]):
        fil(soie, p, q, r_fil, T["fil_cotes"], "soie")
    pas = T["tours"] * T["rayons"]
    parts = [i / (len(carres) - 1) for i in range(len(carres))]
    points = []
    for k in range(pas + 1):
        d, croises = rayons[k % T["rayons"]]
        points.append(moyeu + d * lineaire(list(zip(parts, croises)), k / pas + a.uniform(-T["jeu"], T["jeu"])))
    for p, q in zip(points, points[1:]):
        milieu = p.lerp(q, 1 / 2)
        courbee(soie, [p, milieu + (moyeu - milieu).normalized() * ((q - p).length * T["fleche"]), q], FRONT,
                (r_soie, r_soie), T["soie_cotes"], "soie")

    cs, (lx, ly, lz) = pave(G.primitives[T["araignee"]])
    tour(ombre, [(lz / 2 * z, lx / 2 * large, ly / 2 * profond) for z, large, profond in T["corps"]], "z", cs,
         T["corps_cotes"], "ombre")
    hanche = cs + HAUT * (lz / 2 * T["hanche"])
    libres = list(points)
    for cote in COTES:
        for large, haut in T["pattes"]:
            cible = cs + travers * (cote * lx / 2 * large) + HAUT * (lz / 2 * haut)
            noeud = min(libres, key=lambda p: (p - cible).length)
            libres.remove(noeud)
            bout = noeud + FRONT * r_soie
            genou = hanche.lerp(bout, 1 / 2) + FRONT * (ly / 2 * T["genou"])
            courbee(ombre, lisse([hanche, genou, bout], T["patte_pas"]), (bout - hanche).cross(FRONT).normalized(),
                    tuple(lx / 2 * part for part in T["patte"]), T["soie_cotes"], "ombre")


def champignon(D, G, pieces, a):
    """Des champignons d'après `CHAMPIGNON` : par sujet, pied bulbeux, collerette, chapeau bombé semé de verrues,
    entonnoir de lamelles sous le chapeau."""
    C, chair = D["CHAMPIGNON"], pieces["chair"]
    (bas, haut), jupe = C["collerette"]
    for rang, (bord, sommet), lamelles, verrues in C["sujets"]:
        pied = G.primitives[rang]
        tourne(chair, pied, C["pied"], C["cotes"], "chair", (0.0, C["ancrage"]))
        sol, tete, u, w, _ = bouts(pied)
        tournee(chair, sol.lerp(tete, bas), sol.lerp(tete, haut), u, w, apotheme(pied), jupe, C["cotes"], "chair")
        dessous, _, u, w, _ = bouts(G.primitives[bord])
        _, dessus, _, _, _ = bouts(G.primitives[sommet])
        rayon = apotheme(G.primitives[bord])
        anneaux = bossue(pieces["chapeau"], dessous, dessus, bosselee(a, u, w, C["pans"], C["bosse"]), rayon,
                         C["dome"], "chapeau", dessous.lerp(dessus, C["pointe"]))
        semis(chair, anneaux, C["semis"], verrues, D["VERRUE"], rayon, a, "chair")
        froncee(chair, [(dessous - u.cross(w) * (rayon * chute), (rayon * part,) * 2, creux)
                        for chute, part, creux in C["lamelles"]], lamelles, C["pas"], a, "chair")


def nenuphars(D, G, pieces, a):
    """Des nénuphars d'après `NENUPHARS` : feuilles fendues au bord ondulé et leurs nervures ; fleurs de trois
    couronnes de pétales autour d'un cœur, posées sur leur feuille."""
    N, vert, blanc = D["NENUPHARS"], pieces["feuille"], pieces["fleur"]
    nervures, portee, grosseur, cotes = N["nervures"]
    demi = math.radians(N["fente"])
    dessus = {}
    for rang in N["feuilles"]:
        primitive = G.primitives[rang]
        bas, haut, u, w, _ = bouts(primitive)
        rayon, epais = apotheme(primitive) * N["limbe"], (haut - bas).length * N["epais"]
        fente = a.uniform(0, 2 * math.pi)
        bord = [bas + autour(u, w, fente + demi + (2 * math.pi - 2 * demi) * i / N["pans"])
                * (rayon * (1 + a.uniform(-N["onde"], N["onde"]))) for i in range(N["pans"] + 1)]
        decoupee(vert, [bas + autour(u, w, fente) * (rayon * N["coeur"])] + bord, u.cross(w), (0.0, epais),
                 epais * N["arete"], "feuille")
        dessus[rang] = bas + u.cross(w) * epais
        for k in range(nervures):
            fil(vert, dessus[rang], dessus[rang] + autour(u, w, fente + 2 * math.pi * (k + 1) / (nervures + 1))
                * (rayon * portee), epais * grosseur, cotes, "feuille")

    B = N["bouton"]
    for rang, porteuse in N["fleurs"]:
        primitive = G.primitives[rang]
        bas, _, u, w, _ = bouts(primitive)
        axe, rayon = u.cross(w), apotheme(primitive)
        pose = bas + axe * (dessus[porteuse] - bas).dot(axe)
        coeur = rayon * B["rayon"]
        tournee(blanc, pose - axe * (coeur * B["ancrage"]), pose + axe * (coeur * B["hauteur"]), u, w, coeur,
                B["profil"], B["cotes"], "fleur")
        for nombre, elevation, longueur, largeur in N["couronnes"]:
            phase = a.uniform(0, 2 * math.pi)
            for k in range(nombre):
                vers = autour(u, w, phase + 2 * math.pi * k / nombre)
                feuille(blanc, pose + axe * (rayon * N["petale"]), autour(vers, axe, math.radians(elevation)),
                        axe.cross(vers), rayon * longueur, D["PETALE"], rayon * longueur * largeur,
                        rayon * N["petale"], "fleur")


def roseaux(D, G, pieces, a):
    """Une touffe de roseaux d'après `ROSEAUX` : par tige, chaume à nœuds, massette sous son épi, feuilles en lame
    dressées vers le cœur de la touffe."""
    R, vert = D["ROSEAUX"], pieces["roseau"]
    tiges = [(G.primitives[chaume], G.primitives[massette]) for chaume, massette in R["tiges"]]
    coeur = sum((bouts(chaume)[0] for chaume, _ in tiges), Vector()) / len(tiges)
    for chaume, massette in tiges:
        tourne(vert, chaume, R["chaume"], R["cotes"], "roseau", (0.0, R["ancrage"]))
        tourne(pieces["massette"], massette, R["epi"], R["cotes"], "massette")
        pied, _, u, w, _ = bouts(chaume)
        axe, rayon = u.cross(w), apotheme(chaume)
        large, epais = rayon * R["largeur"], rayon * R["epais"]
        depart = pied + axe * epais
        azimut = math.atan2((coeur - pied).dot(w), (coeur - pied).dot(u))
        for _ in range(R["feuilles"]):
            vers = autour(u, w, azimut + math.radians(a.uniform(-R["ouverture"], R["ouverture"])))
            d = autour(vers, axe, math.radians(a.uniform(*R["elevation"])))
            travers = axe.cross(vers)
            fils = [d * t + d.cross(travers) * fleche for t, fleche in D["LAME"]["nervure"][1:]]
            long = min(G.portee(depart, f.normalized(), D["RETRAIT"] + large) / f.length for f in fils)
            feuille(vert, depart, d, travers, long * a.uniform(*R["longueur"]), D["LAME"], large, epais, "roseau")


BATIR = {"terrier": terrier, "cocon": cocon, "toile": toile, "champignon": champignon, "nenuphars": nenuphars,
         "roseaux": roseaux}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
