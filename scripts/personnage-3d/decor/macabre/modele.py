"""Le macabre (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave`, `geometrie.rond`, `geometrie.bouts`) et où `Gabarit.rentrer`
ramène le sommet qui en sortirait. Chaque pièce est une coque close : un membre couché, ses sections ovales dressées
le long d'un chemin lissé, gonflées ou creusées par des reliefs, chaque rayon arrêté à sa portée sous l'enveloppe
(`gisant`, `corps`) ; une coque bombée sur une
section lobée ou bosselée (`tas`, `lobee`, `flaque`) ; une planche, un bordage, une pièce tournée, une pièce plate
découpée, une étoffe ondulée, un cercle et une pointe de diamant, ceux de `geometrie` ; une poutre de `maille`. Chaque
matériau du décor est un nœud à son nom. L'aléa est semé des codes de caractères de l'id du décor : deux
constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (AXES, COTES, FRONT, HAUT, MAT, X, Y, apotheme, autour, bordage, bosselee, bossue, bouts, cadre,
                       cap, cercle, clou, coque, decoupee, lisse, onde, pave, planche, rond, tourne, tournee)
from maille import poutre

DECORS = ("cadavre", "cheval-mort", "detritus", "mare-sang", "cercle-runique")


def gisant(m, G, stations, taille, reliefs, retrait, mat, pointe=False):
    """Un membre couché le long de la courbe lissée (`geometrie.lisse`) par le dessous de ses `stations` [(point de son
    dessous, demi-axe horizontal, demi-axe vertical)], lissés de même : ses sections ovales dressées, normales à son
    fil vu de dessus ; `taille` : côtés d'une section, points par tronçon. `reliefs` [(rang, angle, demi-longueur,
    demi-largeur, part)] : chacun gonfle le rayon de `part` en son milieu, au rang d'une station (compté en stations)
    et à un angle (degrés) depuis le dessus de la section vers la gauche du fil, ou le creuse si elle est négative,
    jusqu'à rien à son bord. Chaque rayon s'arrête à sa portée à `retrait` sous l'enveloppe de `G`. Fermé à plat à ses
    deux bouts, ou, `pointe`, en cône vers le milieu de sa dernière section. Rend le point du dessus de chaque
    station."""
    cotes, pas = taille
    chemin = lisse([p for p, _, _ in stations], pas)
    sections = lisse([Vector((rx, rz, 0)) for _, rx, rz in stations], pas)
    dernier = len(chemin) - 1
    tours = [2 * math.pi * j / cotes for j in range(cotes)]
    angles = [(270 - 360 * j / cotes) % 360 - 180 for j in range(cotes)]

    def galbe(rang, angle):
        part = 1.0
        for milieu, cap_, long, large, relief in reliefs:
            part *= geometrie.relief((rang - milieu) / long, (angle - cap_) / large, relief)
        return part
    centres, anneaux = [], []
    for i, (p, s) in enumerate(zip(chemin, sections)):
        fil = chemin[min(i + 1, dernier)] - chemin[max(i - 1, 0)]
        travers = HAUT.cross(Vector((fil.x, fil.y, 0))).normalized()
        centre = p + HAUT * s.y
        rayons = [(travers * (s.x * math.cos(t)) + HAUT * (s.y * math.sin(t))) * galbe(i / pas, angle)
                  for t, angle in zip(tours, angles)]
        centres.append(centre)
        anneaux.append([centre + e * min(1.0, G.portee(centre, e, retrait)) for e in rayons])
    if pointe:
        coque(m, anneaux[:-1], mat, centres[-1])
    else:
        coque(m, anneaux, mat)
    return [dessous + HAUT * (2 * rz) for dessous, _, rz in stations]


def corps(D, G, pieces, membres, milieu):
    """Les membres couchés `membres` {nom : (rangs de leurs boîtes dans la recette, matériau, taille, pointe,
    reliefs, stations)} d'un corps de `milieu` : par boîte, un membre (`gisant`) de stations [((x, y), rx, rz)], la
    place de son dessous sur celui de la boîte (`geometrie.cadre`, `x` du côté de la boîte par rapport à `milieu`),
    ses demi-axes en demi-hauteurs de la boîte. Rend {nom : par boîte, le dessus de ses stations}."""
    dessus = {}
    for nom, (rangs, mat, taille, pointe, reliefs, stations) in membres.items():
        dessus[nom] = []
        for rang in rangs:
            c, (_, _, lz) = pave(G.primitives[rang])
            lieu, demi = cadre(G.primitives[rang], math.copysign(1, c.x - milieu.x)), lz / 2
            dessus[nom].append(gisant(pieces[mat], G, [(lieu((x, y, -1)), demi * rx, demi * rz)
                                                       for (x, y), rx, rz in stations],
                                      taille, reliefs, D["RETRAIT"], mat, pointe))
    return dessus


def lobee(a, cotes, L):
    """La section lobée de `cotes` côtés, horizontale, d'après `L` : la somme des ondes `lobes` [(nombre de lobes au
    tour, poids)], chacune à une phase tirée, ôte au rayon jusqu'à sa part `creux`. Rend la fonction de ses sommets
    autour d'un centre, à un rayon, comme `geometrie.bosselee`."""
    phases = [a.uniform(0, 2 * math.pi) for _ in L["lobes"]]
    angles = [2 * math.pi * j / cotes for j in range(cotes)]
    parts = [1 - L["creux"] * sum(poids * (1 - math.cos(n * t + phase)) / 2
                                  for (n, poids), phase in zip(L["lobes"], phases)) for t in angles]
    return lambda centre, rayon: [centre + autour(X, Y, t) * (rayon * part) for t, part in zip(angles, parts)]


def tas(m, section, pied, rayon, haut, anneaux, mat):
    """La coque bombée posée sur `pied` : les anneaux de `section` (la fonction de ses sommets autour d'un centre, à
    un rayon : `lobee`, `geometrie.bosselee`) d'après `anneaux` [(part de `haut`, part de `rayon`)], du pied au
    dernier, sa pointe."""
    *flancs, (cime, _) = anneaux
    bossue(m, pied, pied + HAUT * haut, section, rayon, flancs, mat, pied + HAUT * (haut * cime))


def flaque(m, primitive, centre, part, F, a):
    """Une flaque de sang à l'aplomb de `centre`, posée à la hauteur du pied du cylindre `primitive` de la recette, du
    rayon la part `part` de son apothème, d'après `F` (`FLAQUE`) : un bord lobé (`lobee`), bombée (`tas`) jusqu'à
    une part tirée de la hauteur du cylindre."""
    c, _, h = rond(primitive)
    tas(m, lobee(a, F["cotes"], F), Vector((centre.x, centre.y, c.z - h / 2)), apotheme(primitive) * part,
        h * a.uniform(*F["hauteur"]), F["anneaux"], "sang")


def semis(G, a, ancre, marge, part, retrait):
    """Un point tiré autour d'`ancre`, à sa hauteur : sur un cap tiré, à une part tirée dans `part` de la portée à
    `retrait` sous l'enveloppe de `G`, `marge` ôtée."""
    d = cap(a.uniform(0, 360))
    return ancre + d * ((G.portee(ancre, d, retrait) - marge) * a.uniform(*part))


def cadavre(D, G, pieces, a):
    """Un cadavre d'après `CADAVRE` : tunique et ceinture, braies et bottes, deux bras et leurs mains, tête au visage
    modelé, cheveux, flaque."""
    C = D["CADAVRE"]
    corps(D, G, pieces, C["membres"], pave(G.primitives[C["torse"]])[0])
    nappe = G.primitives[C["sang"]]
    flaque(pieces["sang"], nappe, rond(nappe)[0], 1.0, D["FLAQUE"], a)


def cheval(D, G, pieces, a):
    """Un cheval mort d'après `CHEVAL` : tronc galbé, encolure, tête et oreilles, pattes et sabots, crinière et queue
    en mèches, flaque."""
    C, peau = D["CHEVAL"], pieces["peau"]
    tronc = G.primitives[C["corps"]]
    bout_a, bout_b, _, _, rayon = bouts(tronc)
    milieu = bout_a.lerp(bout_b, 1 / 2)
    tete, = corps(D, G, pieces, C["membres"], milieu)["tete"]
    rang_tete, = C["membres"]["tete"][0]
    ct, (_, _, lz) = pave(G.primitives[rang_tete])
    poitrail, croupe = sorted((bout_a, bout_b), key=lambda p: (p - ct).length)
    sections, taille, reliefs = C["tronc"]
    gisant(peau, G, [(croupe.lerp(poitrail, t) + FRONT * (apotheme(tronc) * y) - HAUT * rayon, apotheme(tronc) * rx,
                      apotheme(tronc) * rz) for t, y, rx, rz in sections], taille, reliefs, D["RETRAIT"], "peau")
    station, enfonce, oreille, (monte, recule) = C["oreille"]
    clou(peau, tete[station] - HAUT * (lz / 2 * enfonce), (HAUT * monte - FRONT * recule).normalized(), oreille,
         lz / 2, "peau")

    Me = C["meche"]
    fin_x, fin_z = Me["fuseau"][-1]
    for K in (C["criniere"], C["queue"]):
        cb, (_, _, bz) = pave(G.primitives[K["boite"]])
        lieu, demi = cadre(G.primitives[K["boite"]], math.copysign(1, cb.x - milieu.x)), bz / 2
        crete = lisse([lieu((x, y, -1)) for x, y in K["crete"]], Me["pas"])
        rx, rz = (demi * r for r in K["rayons"])
        for k in range(K["nombre"]):
            racine = crete[round((k + 1 / 2) / K["nombre"] * (len(crete) - 1))]
            d = cap(a.uniform(*K["sens"]))
            long = min(demi * a.uniform(*K["longueur"]),
                       G.portee(racine + HAUT * (2 * rz * fin_z), d, D["RETRAIT"]) - rx * fin_x)
            points = (racine, racine + d * (long / 2) + HAUT.cross(d) * (long * a.uniform(*Me["onde"])),
                      racine + d * long)
            gisant(pieces["crin"], G, [(p, rx * fx, rz * fz) for p, (fx, fz) in zip(points, Me["fuseau"])],
                   Me["taille"], (), D["RETRAIT"], "crin", True)
    nappe = G.primitives[C["sang"]]
    flaque(pieces["sang"], nappe, rond(nappe)[0], 1.0, D["FLAQUE"], a)


def detritus(D, G, pieces, a):
    """Un tas d'immondices d'après `DETRITUS` : butte, panneau de planches, cruche, motte, chiffon, cageot, fémur,
    mottes et éclats semés."""
    T, bois, terre = D["DETRITUS"], pieces[MAT], pieces["terre"]
    c, (lx, ly, lz) = pave(G.primitives[T["planches"]])
    sol = c.z - lz / 2
    fil, long, large = (X, lx, ly) if lx > ly else (Y, ly, lx)
    epais = lz * T["planche"]
    bordage(bois, Vector((c.x, c.y, sol + epais / 2)), fil, HAUT.cross(fil), long, large, epais, T["bordage"], D, a)

    cruche = G.primitives[T["cruche"]]
    profil, cotes = T["cruche_tournee"]
    tourne(terre, cruche, profil, cotes, "terre")
    _, _, h_cruche = rond(cruche)

    M = T["motte"]
    motte = G.primitives[T["motte_de_terre"]]
    bout_a, bout_b, _, _, r_motte = bouts(motte)
    tas(terre, lobee(a, M["cotes"], M), bout_a.lerp(bout_b, 1 / 2) - HAUT * r_motte, apotheme(motte),
        r_motte * M["hauteur"], M["anneaux"], "terre")

    K = T["etoffe"]
    cc, (kx, ky, kz) = pave(G.primitives[T["chiffon"]])
    e_drap = kz * K["epais"]
    rangs = []
    for k, (t, demi) in enumerate(K["rangs"]):
        creux = (kz - e_drap) / 2 * a.uniform(*K["creux"])
        place = cc + FRONT * (ky / 2 * t) + X * (kx / 2 * (1 - demi) * a.uniform(-1, 1))
        rangs.append(onde(Vector((place.x, place.y, cc.z - kz / 2 + creux + e_drap / 2)), X, HAUT, kx / 2 * demi,
                          e_drap, creux, K["plis"], math.pi * k, K["pas"], 0, Vector()))
    coque(pieces["drap"], rangs, "drap")

    Ca = T["caisse"]
    cg, (gx, gy, gz) = pave(G.primitives[T["cageot"]])
    e = gz * Ca["epais"]
    fond = Vector((cg.x, cg.y, cg.z - gz / 2 + e / 2))
    planche(bois, fond - X * (gx / 2), fond + X * (gx / 2), Y, HAUT, gy / 2, e / 2, e * D["ARETE"])
    parois = [(X, gx, Y * (s * (gy - e) / 2)) for s in COTES] + [(Y, gy, X * (s * (gx - e) / 2)) for s in COTES]
    pied = fond.z + e / 2 - e * Ca["ancrage"]
    for long_p, portee, place in a.sample(parois, Ca["parois"]):
        tete = fond.z + e / 2 + (gz - e) * a.uniform(*Ca["hauteur"])
        axe = Vector((fond.x, fond.y, (pied + tete) / 2)) + place
        planche(bois, axe - long_p * (portee / 2), axe + long_p * (portee / 2), HAUT.cross(long_p), HAUT, e / 2,
                (tete - pied) / 2, e * D["ARETE"])

    co, (ox, oy, oz) = pave(G.primitives[T["os"]])
    long_o, portee_o = (X, ox) if ox > oy else (Y, oy)
    tournee(pieces["os"], co - long_o * (portee_o / 2), co + long_o * (portee_o / 2), HAUT.cross(long_o), HAUT, oz / 2,
            T["femur"], T["pans"], "os")

    B, S = T["butte"], T["semis"]
    centres = [pave(p)[0] for p in G.primitives]
    haut = h_cruche * B["hauteur"]
    centre = sum(centres, Vector()) / len(centres)
    ancre = Vector((centre.x, centre.y, sol + haut))
    rayon = min(G.portee(ancre, cap(360 * k / B["caps"]), D["RETRAIT"]) for k in range(B["caps"])) * B["rayon"]
    tas(terre, lobee(a, B["cotes"], B), ancre - HAUT * haut, rayon, haut, B["anneaux"], "terre")
    nombre, grosseur = S["mottes"]
    for _ in range(nombre):
        r = apotheme(motte) * a.uniform(*grosseur)
        p = semis(G, a, ancre, r, S["part"], D["RETRAIT"])
        tas(terre, lobee(a, M["cotes"], M), Vector((p.x, p.y, sol)), r, r * M["hauteur"], M["anneaux"], "terre")
    nombre, longueur, demi_large, mince = S["eclats"]
    for _ in range(nombre):
        demi = long / 2 * a.uniform(*longueur)
        p = semis(G, a, ancre, demi, S["part"], D["RETRAIT"])
        d = cap(a.uniform(0, 360))
        axe = Vector((p.x, p.y, sol + epais * mince / 2))
        planche(bois, axe - d * demi, axe + d * demi, HAUT.cross(d), HAUT,
                large / T["bordage"]["planches"] / 2 * demi_large, epais * mince / 2, epais * mince * D["ARETE"])


def mare(D, G, pieces, a):
    """Une mare de sang d'après `MARE` : les flaques de la recette, des gouttes semées autour de la grande."""
    M, sang = D["MARE"], pieces["sang"]
    for rang in M["flaques"]:
        flaque(sang, G.primitives[rang], rond(G.primitives[rang])[0], 1.0, D["FLAQUE"], a)
    grande = G.primitives[M["flaques"][0]]
    Go = M["gouttes"]
    for _ in range(Go["nombre"]):
        part = a.uniform(*Go["rayon"])
        flaque(sang, grande, semis(G, a, rond(grande)[0], apotheme(grande) * part, Go["part"], D["RETRAIT"]), part,
               D["FLAQUE"], a)


def cercle_runique(D, G, pieces, a):
    """Un cercle runique d'après `CERCLE` : dalle, étoile dont chaque barre de la croix porte les flèches de son
    axe, son moyeu, pierres à rune, cercle tracé."""
    R, pierre, rune = D["CERCLE"], pieces["pierre"], pieces["rune"]
    dalle = G.primitives[R["dalle"]]
    sol, tete = tourne(pierre, dalle, R["dalle_tournee"], dalle["sides"], "pierre")

    E = R["etoile"]
    barres = []
    for rang in R["croix"]:
        cb, (bx, by, bz) = pave(G.primitives[rang])
        barres.append((0 if bx > by else 90, max(bx, by) / 2, min(bx, by) / 2, (cb.z + bz / 2 - tete.z) * E["relief"]))
    for azimut, demi_long, large, relief in barres:
        for ecart in E["fleches"]:
            d = cap(azimut + ecart)
            decoupee(rune, [tete + d * (demi_long * x) + HAUT.cross(d) * (large * y) for x, y in E["fleche"]], HAUT,
                     (-relief * E["ancrage"], relief), relief * E["arete"], "rune")
    _, _, demi_large, relief = barres[0]
    part, saillie, profil, cotes = E["moyeu"]
    tournee(rune, tete - HAUT * (relief * E["ancrage"]), tete + HAUT * (relief * saillie), X, Y, demi_large * part,
            profil, cotes, "rune")

    P = R["pierre"]
    boites = [pave(G.primitives[rang]) for rang in R["pierres"]]
    for rang, (c, (lx, ly, lz)) in enumerate(boites):
        demi, haut = min(lx, ly) / 2, lz * P["hauteur"]
        pied = c - HAUT * (lz / 2)
        tas(pierre, bosselee(a, X, Y, P["cotes"], P["bosse"]), pied, demi, haut, P["anneaux"], "pierre")
        dehors = Vector((c.x - sol.x, c.y - sol.y, 0)).normalized()
        travers = HAUT.cross(dehors)
        fond = haut - haut * P["ancrage"]
        for k, trait in enumerate(R["glyphes"][rang % len(R["glyphes"])]):
            saillie = (lz - fond) * (1 - P["degre"] * k)
            de, vers = (pied + HAUT * (fond + saillie / 2) + dehors * (demi * u) + travers * (demi * v)
                        for u, v in trait)
            poutre(rune, de, vers, 2 * demi * P["trait"], saillie, HAUT, "rune")

    part_h, part_l, segments = R["trace"]
    c, (_, _, lz) = boites[0]
    h = lz * part_h
    cercle(rune, AXES[dalle["axis"]][0], (sol.x, sol.y, sol.z + h / 2), Vector((c.x - sol.x, c.y - sol.y, 0)).length,
           h, 2 * demi_large * part_l, segments, "rune")


BATIR = {"cadavre": cadavre, "cheval-mort": cheval, "detritus": detritus, "mare-sang": mare,
         "cercle-runique": cercle_runique}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, geometrie.par_materiau(D["MATERIAUX"][id_]), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
