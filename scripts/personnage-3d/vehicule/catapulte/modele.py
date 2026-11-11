"""Les engins à bras de torsion (#2987) : un GLB par engin, aux nœuds `chassis` et `bras` (pivot à l'axe de l'écheveau),
l'emprise recentrée, et ses clips (`clips.py`) : repos, halage, tir ; la catapulte et le mangonneau portent la poche
rigide, l'onagre la fronde."""
import math

import habillage
from clips import REPOS, animer, cahoter, coup
from maille import Maille, basculer, basculer_maille, boite, cylindre, objet, poutre, recentrer, tore, tour, treuil, tube


def chassis(D, mats):
    """Longerons, traverses, montants et écheveau, butoir et ses contrefiches, treuil, taquet de repos du bras."""
    C, E, B, T, R = D["CHASSIS"], D["ECHEVEAU"], D["BUTOIR"], D["TREUIL"], D["BRAS"]
    m = Maille([mats["bois"], mats["fer"], mats["corde"], mats["cuir"]])
    c, y0, y1, w, h = C["longerons"]
    interieur = c - w / 2
    tz0, tz1 = C["traverse_z"]
    bl, bep = C["bande"]
    for signe in (1, -1):
        boite(m, (signe * c - w / 2, y0, 0.0), (signe * c + w / 2, y1, h), "bois")
        for y in C["bandes"]:
            boite(m, (signe * c - w / 2 - bep, y - bl / 2, 0.0), (signe * c + w / 2 + bep, y + bl / 2, h + bep), "fer")
    for y, prof in C["traverses"]:
        boite(m, (-interieur, y - prof / 2, tz0), (interieur, y + prof / 2, tz1), "bois")

    ay, az = E["axe"]
    prof, haut = E["montant"]
    rr, rep = E["rondelle"]
    cs, cl = E["cheville"]
    for signe in (1, -1):
        boite(m, (signe * c - w / 2, ay - prof / 2, h), (signe * c + w / 2, ay + prof / 2, haut), "bois")
        a, b = sorted((signe * (c + w / 2), signe * (c + w / 2 + rep)))
        cylindre(m, a, b, rr, "x", (0, ay, az), E["segments"], "fer")
        a, b = sorted((signe * (c + w / 2 + rep), signe * (c + w / 2 + rep + 2 * cs)))
        boite(m, (a, ay - cl, az - cs), (b, ay + cl, az + cs), "fer")
    r = E["rayon"]
    tour(m, [(-interieur, 0), (-interieur, r * 0.85), (-interieur / 2, r), (interieur / 2, r), (interieur, r * 0.85), (interieur, 0)],
         "x", (0, ay, az), E["segments"], "corde")

    by = B["y"]
    sec, zh = B["montant"]
    tz_bas, tz_haut, tprof, debord = B["traverse"]
    for signe in (1, -1):
        boite(m, (signe * c - sec / 2, by - sec / 2, h), (signe * c + sec / 2, by + sec / 2, zh), "bois")
        jl, jep = B["jambe"]
        for pied, attache in B["jambes"]:
            cote = math.copysign(sec / 2, pied - by)
            poutre(m, (signe * c, pied, h), (signe * c, by + cote, attache), jl, jep, (1, 0, 0), "bois")
    boite(m, (-c - sec / 2 - debord, by - tprof / 2, tz_bas), (c + sec / 2 + debord, by + tprof / 2, tz_haut), "bois")
    demi, cz0, cz1, cep = B["coussin"]
    boite(m, (-demi, by + tprof / 2, cz0), (demi, by + tprof / 2 + cep, cz1), "cuir")

    treuil(m, T, h)

    # taquet sous le bras armé, sur la traverse arrière
    ry, _ = C["traverses"][-1]
    tqx, tqy = R["taquet"]
    s = R["section"][1] / 2
    dessous = az - (ry - ay) * math.tan(math.radians(R["repos"])) - s / math.cos(math.radians(R["repos"]))
    boite(m, (-tqx, ry - tqy, tz1), (tqx, ry + tqy, dessous), "bois")
    return m


def bras(D, mats):
    """Le bras couché, frettes de fer, à l'horizontale avant `basculer_maille` : (maille, bout du bras, dessus du bras)."""
    E, R = D["ECHEVEAU"], D["BRAS"]
    ay, az = E["axe"]
    m = Maille([mats["bois"], mats["fer"], mats["corde"], mats["cuir"]])
    L, larg, ep = R["longueur"], *R["section"]
    poutre(m, (0, ay - R["talon"], az), (0, ay + L, az), larg, ep, (0, 0, 1), "bois")
    bl, bep = R["bande"]
    for s in R["bandes"]:
        boite(m, (-larg / 2 - bep, ay + s - bl / 2, az - ep / 2 - bep), (larg / 2 + bep, ay + s + bl / 2, az + ep / 2 + bep), "fer")
    return m, (0.0, ay + L, az), az + ep / 2


def poche(D, m, bout, dessus):
    """La poche rigide de bois cerclée de fer sur le dessus du bout du bras."""
    P = D["POCHE"]
    centre = (0.0, bout[1] - P["recul"], dessus)
    tour(m, P["profil"], "z", centre, P["segments"], "bois")
    grand, petit = P["cercle"]
    haut = max(a for a, _ in P["profil"])
    tore(m, "z", (0.0, centre[1], dessus + haut), grand, petit, P["segments"], 4, "fer")


def crochet(D, m, bout):
    """Le crochet de fer de la fronde au bout du bras ; rend son extrémité."""
    cs, cl = D["FRONDE"]["crochet"]
    boite(m, (-cs, bout[1], bout[2] - cs), (cs, bout[1] + cl, bout[2] + cs), "fer")
    return (0.0, bout[1] + cl, bout[2])


def fronde(D, m, tip):
    """Deux cordes du crochet `tip` à la poche de cuir posée au sol derrière le bout du bras."""
    F = D["FRONDE"]
    recul, zp = F["poche"]
    centre = (0.0, tip[1] + recul, zp)
    tour(m, F["profil"], "z", centre, F["segments"], "cuir")
    ecart, rc = F["cordes"]
    bord = max(a for a, _ in F["profil"])
    cs = F["crochet"][0]
    for signe in (1, -1):
        a = (signe * cs * 0.8, tip[1], tip[2])
        b = (signe * ecart, centre[1] - ecart * 0.3, zp + bord)
        milieu = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 0.04)
        tube(m, [a, milieu, b], rc, 5, "corde")


def construire(D, extremite):
    mats = habillage.materiaux(D["MATERIAUX"])
    ch = chassis(D, mats)
    br, bout, dessus = bras(D, mats)
    pivot = D["ECHEVEAU"]["axe"]
    angle = D["BRAS"]["repos"]
    if extremite == "poche":
        poche(D, br, bout, dessus)
        basculer_maille(br, pivot, angle)
    else:
        tip = crochet(D, br, bout)
        basculer_maille(br, pivot, angle)
        fronde(D, br, basculer(tip, pivot, angle))
    dx, dy = recentrer([ch, br])
    objet("chassis", ch, (0.0, 0.0, 0.0), 35)
    objet("bras", br, (dx, pivot[0] + dy, pivot[1]), 35)
    return animer([REPOS, cahoter(["chassis", "bras"]), tir(D)])


def tir(D):
    """Le clip `tir` : le bras lâché contre le coussin du butoir, puis ramené au treuil (`TIR`, temps de `coup`).
    Sa course va du repos au contact de la face de son dessus avec la face arrière du coussin, à mi-hauteur."""
    B, R = D["BUTOIR"], D["BRAS"]
    ay, az = D["ECHEVEAU"]["axe"]
    _, cz0, cz1, cep = B["coussin"]
    y = B["y"] + B["traverse"][2] / 2 + cep - ay
    z = (cz0 + cz1) / 2 - az
    contact = math.atan2(z, y) - math.asin(R["section"][1] / 2 / math.hypot(y, z))
    course = contact + math.radians(R["repos"])
    temps = D["TIR"]
    return ("tir", "tir", sum(temps), {"bras": lambda t: ((0, 0, 0), (course * coup(t, temps), 0, 0))})


def elements(D):
    for glb, definitions, extremite in (("catapulte", D["CATAPULTE"], "poche"), ("onagre", D["ONAGRE"], "fronde")):
        yield {"glb": glb, "cles": [("vehicule", {"definition": d}) for d in definitions],
               "materiaux": D["MATERIAUX"], "blasons": (),
               "construire": lambda extremite=extremite: construire(D, extremite)}
