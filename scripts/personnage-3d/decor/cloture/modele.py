"""Les clôtures (#4335) : un GLB par décor de `DECORS`, bâti dans l'enveloppe convexe des primitives de sa recette
(`gabarit.py`), dont il lit les cotes (`geometrie.pave` et `geometrie.rond`) et où `Gabarit.rentrer` ramène le sommet
qui en sortirait. Chaque pièce est une coque close (`geometrie.coque`) : une pièce refendue, des sections inégales le
long de son fil (`refendue`) ; une pièce moulurée, son profil filé d'un bout à l'autre (`filee`) ; un poteau, une
planche, une pièce tournée, une cheville et un clou, ceux de `geometrie`. Une pièce qui penche garde ses sections
horizontales : elle pose à plat. L'aléa est semé des codes de caractères de l'id du décor : deux constructions rendent
les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import (COTES, HAUT, MAT, X, Y, barre, bosselee, cheville, clou, coque, partage, pave, planche,
                       profilee, rond, tournee)
from maille import plaque

DECORS = ("barriere", "cloture", "palissade", "balustrade-bois", "bastingage")
NOEUDS = {"cloture": {MAT: (MAT,), "clous": ("fer",)}, "palissade": {"pieux": ("ecorce", MAT), MAT: (MAT,)},
          "bastingage": {MAT: (MAT, "vieux")}}
"""Les nœuds d'un décor qui en a d'autres que celui de son bois, et les matériaux de chacun (`MATERIAUX` de
`donnees.py`)."""


def refendue(m, p0, p1, u, du, dv, R, a):
    """Une pièce refendue de `p0` à `p1`, de demi-côtés `du` sur `u`, unitaire et normal à son fil, et `dv` en travers,
    d'après `R` (`REFENDUE`) : chaque section tirée dans ces demi-côtés."""
    v = (p1 - p0).normalized().cross(u)
    stations = []
    for k in range(R["stations"]):
        eu, ev = du * a.uniform(*R["section"]), dv * a.uniform(*R["section"])
        deport = u * (du * a.uniform(-R["ecart"], R["ecart"])) + v * (dv * a.uniform(-R["ecart"], R["ecart"]))
        centre = p0.lerp(p1, k / (R["stations"] - 1)) + deport
        stations.append((centre, eu, ev, min(eu, ev) * a.uniform(*R["chanfrein"])))
    barre(m, stations, u, v)


def filee(m, pied, demi_longueur, demi_largeur, hauteur, profil):
    """Une pièce moulurée filée le long de x, de part et d'autre de `pied`, milieu de son dessous : sa section, le
    demi-profil `profil` [(part de la demi-largeur, part de la hauteur)] du pied à la tête et son symétrique."""
    section = [(y * demi_largeur, z * hauteur) for y, z in profil]
    section += [(-y, z) for y, z in reversed(section)]
    plaque(m, [tuple(pied + Vector((0, y, z))) for y, z in section], 2 * demi_longueur, MAT)


def barriere(D, G, pieces, a):
    """Une barrière d'après `BARRIERE` : poteaux à tête de diamant, lisses refendues chevillées, écharpe, montant."""
    B, m = D["BARRIERE"], pieces[MAT]
    for rang in B["poteaux"]:
        c, (cote, _, haut) = pave(G.primitives[rang])
        demi = cote / 2 * B["poteau"]["cote"]
        pied = Vector((c.x, c.y, c.z - haut / 2))
        profilee(m, pied, pied + HAUT * haut, (demi, demi), B["poteau"]["profil"])
    dernier, (cote, _, _) = pave(G.primitives[B["poteaux"][-1]])
    demi = cote / 2 * B["poteau"]["cote"]
    place, rayon = abs(dernier.x), demi * B["cheville"]
    lisses = [pave(G.primitives[rang]) for rang in B["lisses"]]
    for c, (longueur, epais, haut) in lisses:
        refendue(m, c - X * longueur / 2, c + X * longueur / 2, Y, epais / 2, haut / 2, D["REFENDUE"], a)
        for sx in COTES:
            for sy in COTES:
                cheville(m, Vector((sx * place, c.y + sy * demi, c.z)), Y * sy, rayon, a)
    (basse, (_, epais, haut)), (haute, _) = lisses
    pose = epais / 2 * B["pose"]

    E = B["echarpe"]
    e, largeur = epais / 2 * E["section"][0], haut / 2 * E["section"][1]
    p0 = Vector((-place * E["portee"], basse.y - pose - e, basse.z))
    p1 = Vector((place * E["portee"], haute.y - pose - e, haute.z))
    planche(m, p0, p1, Y, (p1 - p0).normalized().cross(Y), e, largeur, e * 2 * D["ARETE"])
    for part in E["chevilles"]:
        cheville(m, p0.lerp(p1, part) - Y * e, -Y, rayon, a)

    M = B["montant"]
    e, largeur = epais / 2 * M["section"][0], haut / 2 * M["section"][1]
    axe = Vector((0, basse.y + pose + e, 0))
    bas, tete = basse.z - haut * M["depasse"], haute.z + haut * M["depasse"]
    planche(m, axe + HAUT * bas, axe + HAUT * tete, X, Y, largeur, e, e * 2 * D["ARETE"])
    for c, _ in lisses:
        cheville(m, axe + Y * e + HAUT * c.z, Y, rayon, a)


def cloture(D, G, pieces, a):
    """Une clôture d'après `CLOTURE` : lisses refendues, piquets et échalas inégaux à tête taillée, cloués, dont un de
    travers."""
    C, m = D["CLOTURE"], pieces[MAT]
    P = C["piquet"]
    piquets = []
    for rang, tete in zip(C["piquets"], C["tetes"]):
        p, (large, _, _) = pave(G.primitives[rang])
        t, (_, _, haut_t) = pave(G.primitives[tete])
        piquets.append((p, large / 2, t.z + haut_t / 2))
    echalas = [(g.lerp(d, k / (C["entre"] + 1)), du * C["echalas"][0], h * C["echalas"][1])
               for (g, du, h), (d, _, _) in zip(piquets, piquets[1:]) for k in range(1, C["entre"] + 1)]
    dernier, (large, epais_p, _) = pave(G.primitives[C["piquets"][-1]])
    pose, dv = dernier.y, epais_p / 2 * P["epaisseur"]

    lisses = [pave(G.primitives[rang]) for rang in C["lisses"]]
    devant = math.copysign(1, pose - lisses[-1][0].y)
    for c, (longueur, epais, haut) in lisses:
        axe_lisse = c + Y * (devant * epais / 2 * P["pose"])
        portee = X * (longueur / 2)
        refendue(m, axe_lisse - portee, axe_lisse + portee, Y, epais / 2, haut / 2, D["REFENDUE"], a)

    de_travers = a.randrange(len(piquets + echalas))
    for i, (p, du, h) in enumerate(piquets + echalas):
        du, h = du * a.uniform(*P["largeur"]), h * a.uniform(*P["hauteur"])
        pente = a.uniform(-P["penche"], P["penche"])
        if i == de_travers:
            pente, h = math.copysign(P["travers"], -p.x), h * P["affaisse"]

        def axe(z, x=p.x, pente=pente):
            return Vector((x + pente * z, pose, z))
        chanfrein, meplat = dv * 2 * D["ARETE"], du * P["meplat"]
        faite = axe(h) + X * (du * a.uniform(-P["faite"], P["faite"]))
        barre(m, [(axe(0), du, dv, chanfrein), (axe(h - 2 * du * P["pointe"]), du, dv, chanfrein),
                  (faite, meplat, dv, meplat * D["ARETE"])], X, Y)
        for c, _ in lisses:
            for place in P["clous"]:
                tete = axe(c.z) + X * (place * du) + Y * (devant * dv)
                clou(pieces["clous"], tete, Y * devant, D["CLOU"], large / 2, "fer")


def palissade(D, G, pieces, a):
    """Une palissade d'après `PALISSADE` : pieux jointifs bosselés, épointés jusqu'au bois, traverses refendues
    chevillées à chaque pieu."""
    P, m = D["PALISSADE"], pieces[MAT]
    Pi = P["pieu"]
    rx, ry = Pi["rayons"]
    axes = []
    for rang in P["pieux"]:
        c, rayon, longueur = rond(G.primitives[rang])
        axes.append(c)
        pied, tete = c.z - longueur / 2, c.z + longueur / 2
        epaule = tete - rayon * a.uniform(*Pi["pointe"])
        section = bosselee(a, (rx, 0, 0), (0, ry, 0), Pi["cotes"], Pi["bosse"])

        def tranche(z, part, deport, c=c, rayon=rayon, section=section):
            return section((c.x + rayon * deport[0], c.y + rayon * deport[1], z), rayon * part)
        deports = [tuple(a.uniform(-Pi["flexe"], Pi["flexe"]) for _ in COTES) for _ in range(Pi["rangs"] + 1)]
        parts = [i / Pi["rangs"] for i in range(Pi["rangs"] + 1)]
        coque(pieces["pieux"], [tranche(pied + (epaule - pied) * t, 1 - Pi["defilement"] * t, deport)
                                for t, deport in zip(parts, deports)], "ecorce")
        coupe = (1 - Pi["defilement"]) * Pi["coupe"]
        sommet = Vector((c.x + rayon * a.uniform(-Pi["sommet"], Pi["sommet"]),
                         c.y + rayon * a.uniform(-Pi["sommet"], Pi["sommet"]), tete))
        taille = [tranche(z, coupe, deports[-1]) for z in (epaule - rayon * Pi["enfonce"], epaule)]
        coque(pieces["pieux"], taille, MAT, sommet)

    c, (longueur, epais, haut) = pave(G.primitives[P["traverse"]])
    dehors = math.copysign(1, c.y - axes[0].y)
    for part_h, part_l, part_e, recul, part_d in P["traverses"]:
        face = c.y + dehors * epais * (0.5 - recul)
        milieu = Vector((c.x, face - dehors * epais * part_e, c.z * part_h))
        portee = X * (longueur / 2 * part_l)
        refendue(m, milieu - portee, milieu + portee, Y, epais * part_e, haut * part_d, D["REFENDUE"], a)
        for axe in axes:
            cheville(m, Vector((axe.x, face, milieu.z)), Y * dehors, haut * P["cheville"], a)


def balustrade(D, G, pieces, a):
    """Une balustrade d'après `BALUSTRADE` : lisse basse, main courante moulurée, balustres tournés, poteaux à
    pommeau."""
    B, m = D["BALUSTRADE"], pieces[MAT]
    lisses = [(pave(G.primitives[B[rang]]), B[profil])
              for rang, profil in (("lisse_basse", "plinthe"), ("lisse_haute", "main_courante"))]
    for (c, (longueur, large, haut)), profil in lisses:
        filee(m, c - HAUT * haut / 2, longueur / 2, large / 2, haut, profil)
    ((basse, (_, _, haut_b)), _), ((haute, (_, _, haut_h)), _) = lisses

    T = B["balustre"]
    ancrage = haut_b * T["ancrage"]
    pied, tete = basse.z + haut_b / 2 - ancrage, haute.z - haut_h / 2 + ancrage
    suite = [rond(G.primitives[rang]) for rang in (B["poteaux"][0][0], *B["balustres"], B["poteaux"][1][0])]
    places = [c for c, _, _ in suite[1:-1]]
    places += [g.lerp(d, k / (B["entre"] + 1))
               for (g, _, _), (d, _, _) in zip(suite, suite[1:]) for k in range(1, B["entre"] + 1)]
    rayon = suite[0][1] * T["rayon"]
    for p in places:
        tournee(m, Vector((p.x, p.y, pied)), Vector((p.x, p.y, tete)), X, Y, rayon, T["profil"], T["cotes"])

    Po, Pm, K = B["poteau"], B["pommeau"], B["cheville"]
    for _, pommeau in B["poteaux"]:
        c, r, hauteur = rond(G.primitives[pommeau])
        demi = r * Po["cote"]
        sol, dessous = Vector((c.x, c.y, 0)), Vector((c.x, c.y, c.z - hauteur / 2))
        profilee(m, sol, dessous, (demi, demi), Po["profil"])
        tournee(m, dessous, dessous + HAUT * hauteur, X, Y, r * Pm["rayon"], Pm["profil"], Pm["cotes"])
        for ((centre, (_, large, haut)), _), part in zip(lisses, K["hauteurs"]):
            for sy in COTES:
                tete = Vector((c.x, centre.y + sy * large / 2 * K["tete"], centre.z - haut / 2 + haut * part))
                cheville(m, tete, Y * sy, demi * K["rayon"], a)


def bastingage(D, G, pieces, a):
    """Un bastingage d'après `BASTINGAGE` : serre, lisse de pavois, jambettes, bordé de virures inégales, gournables."""
    B, m = D["BASTINGAGE"], pieces[MAT]
    for rang, profil in (("serre", "profil_serre"), ("lisse", "profil_lisse")):
        c, (longueur, large, haut) = pave(G.primitives[B[rang]])
        filee(m, c - HAUT * haut / 2, longueur / 2, large / 2, haut, B[profil])

    V = B["virures"]
    c, (longueur, epais, haut) = pave(G.primitives[B["borde"]])
    bornes = [c.z - haut / 2 + haut * u for u in partage(a, V["nombre"], V["ecart"])]
    milieux = [(z0 + z1) / 2 for z0, z1 in zip(bornes, bornes[1:])]
    for (z0, z1), z in zip(zip(bornes, bornes[1:]), milieux):
        axe, portee = Vector((c.x, c.y, z)), X * (longueur / 2)
        planche(m, axe - portee, axe + portee, Y, HAUT, epais / 2 * a.uniform(*V["epaisseur"]),
                (z1 - z0) / 2 - haut * V["jour"], epais / 2 * V["chanfrein"], "vieux")

    J, N = B["jambette"], B["gournable"]
    for rang in B["jambettes"]:
        c, (large, profond, haut) = pave(G.primitives[rang])
        dx, dy = large / 2 * J["cotes"][0], profond / 2 * J["cotes"][1]
        pied = Vector((c.x, c.y, c.z - haut / 2))
        profilee(m, pied, pied + HAUT * haut, (dx, dy), J["profil"])
        for sy in COTES:
            for z in milieux:
                tete = Vector((c.x + dx * a.uniform(-N["deport"], N["deport"]), c.y + sy * dy, z))
                cheville(m, tete, Y * sy, dx * N["rayon"], a)


BATIR = {"barriere": barriere, "cloture": cloture, "palissade": palissade, "balustrade-bois": balustrade,
         "bastingage": bastingage}


def construire(D, id_):
    return geometrie.par_noeuds(D, id_, NOEUDS.get(id_, {MAT: (MAT,)}), BATIR[id_])


def elements(D):
    return geometrie.elements(D, DECORS, construire)
