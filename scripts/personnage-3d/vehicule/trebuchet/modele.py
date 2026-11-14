"""Le trébuchet à contrepoids (#2987) : les nœuds `chassis`, `verge` (pivot à l'axe, fronde comprise) et `contrepoids`
(pivot à sa goupille), l'emprise recentrée, et ses clips (`clips.py`) : repos, halage, tir ; un GLB pour les clés de
`DEFINITIONS`."""
import math

import habillage
from clips import REPOS, animer, cahoter, coup
from maille import Maille, basculer, basculer_maille, boite, cylindre, objet, poutre, recentrer, tour, treuil, tube


def chassis(D, mats):
    """Longerons, traverses, patin, montants contreventés, axe, auget et treuil."""
    B, M, X, A = D["BASE"], D["MONTANTS"], D["AXE"], D["AUGET"]
    m = Maille([mats["bois"], mats["fer"]])
    c, y0, y1, w, h = B["longerons"]
    interieur = c - w / 2
    tz0, tz1 = B["traverse_z"]
    bl, bep = B["bande"]
    for signe in (1, -1):
        boite(m, (signe * c - w / 2, y0, 0.0), (signe * c + w / 2, y1, h), "bois")
        for y in B["bandes"]:
            boite(m, (signe * c - w / 2 - bep, y - bl / 2, 0.0), (signe * c + w / 2 + bep, y + bl / 2, h + bep), "fer")
    for y, prof in B["traverses"]:
        boite(m, (-interieur, y - prof / 2, tz0), (interieur, y + prof / 2, tz1), "bois")
    py, pl, pp, ph = B["patin"]
    boite(m, (-pl, py - pp / 2, 0.0), (pl, py + pp / 2, ph), "bois")

    s, haut = M["section"], M["haut"]
    jl, jep = M["jambe"]
    ex, ez = M["etais"]
    el, eep = M["etai"]
    for signe in (1, -1):
        boite(m, (signe * c - s / 2, -s / 2, h), (signe * c + s / 2, s / 2, haut), "bois")
        for pied, attache in M["jambes"]:
            cote = s / 2 if pied > 0 else -s / 2
            poutre(m, (signe * c, pied, h), (signe * c, cote, attache), jl, jep, (1, 0, 0), "bois")
        poutre(m, (signe * ex, py, ph), (signe * (c + s / 2), py, ez), el, eep, (0, 1, 0), "bois")
    r, l = X["rayon"], X["demi_longueur"]
    cylindre(m, -l, l, r, "x", (0, 0, X["z"]), 12, "fer")

    ay0, ay1 = A["y"]
    aw, az = A["demi_largeur"], A["z"]
    bep_, bh = A["bords"]
    boite(m, (-aw - bep_, ay0, az - bep_), (aw + bep_, ay1, az), "bois")
    for signe in (1, -1):
        a, b = sorted((signe * aw, signe * (aw + bep_)))
        boite(m, (a, ay0, az), (b, ay1, az + bh), "bois")

    treuil(m, D["TREUIL"], tz1)
    return m


def verge(D, mats):
    """La verge à l'horizontale avant `basculer_maille`, frettes, goupille du contrepoids et crochet de la fronde :
    (maille, goupille, crochet)."""
    X, V = D["AXE"], D["VERGE"]
    z = X["z"]
    m = Maille([mats["bois"], mats["fer"], mats["corde"], mats["cuir"]])
    larg, ep = V["section"]
    poutre(m, (0, -V["court"] - 0.15, z), (0, V["long"], z), larg, ep, (0, 0, 1), "bois")
    bl, bep = V["bande"]
    for s in V["bandes"]:
        boite(m, (-larg / 2 - bep, s - bl / 2, z - ep / 2 - bep), (larg / 2 + bep, s + bl / 2, z + ep / 2 + bep), "fer")
    gr, gl = V["goupille"]
    cylindre(m, -gl, gl, gr, "x", (0, -V["court"], z), 10, "fer")
    cs, cl = V["crochet"]
    boite(m, (-cs, V["long"], z - cs), (cs, V["long"] + cl, z + cs), "fer")
    return m, (0.0, -V["court"], z), (0.0, V["long"] + cl, z)


def fronde(D, m, crochet):
    """Deux cordes du crochet à la poche de cuir couchée dans l'auget, vers l'avant."""
    F, A = D["FRONDE"], D["AUGET"]
    recul, dz = F["poche"]
    centre = (0.0, crochet[1] + recul, A["z"] + dz)
    tour(m, F["profil"], "z", centre, F["segments"], "cuir")
    ecart, rc = F["cordes"]
    bord = max(a for a, _ in F["profil"])
    for signe in (1, -1):
        a = (signe * 0.04, crochet[1], crochet[2])
        b = (signe * ecart, centre[1] + ecart * 0.3, centre[2] + bord)
        milieu = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - 0.03)
        tube(m, [a, milieu, b], rc, 5, "corde")


def contrepoids(D, mats, goupille):
    """La caisse pendue sous la goupille : corps, cornières et ceintures de fer, couvercle à lattes, suspentes."""
    C = D["CONTREPOIDS"]
    m = Maille([mats["bois"], mats["fer"]])
    _, gy, gz = goupille
    dx, dy, hauteur, sous = C["caisse"]
    haut = gz - sous
    bas = haut - hauteur
    boite(m, (-dx, gy - dy, bas), (dx, gy + dy, haut), "bois")
    cw, cep = C["cornieres"]
    for sx in (1, -1):
        for sy in (1, -1):
            a = sorted((sx * (dx - cw), sx * (dx + cep)))
            b = sorted((gy + sy * (dy - cw), gy + sy * (dy + cep)))
            boite(m, (a[0], b[0], bas - cep), (a[1], b[1], haut + cep), "fer")
    for z in (bas + hauteur * 0.2, bas + hauteur * 0.8):
        boite(m, (-dx - cep, gy - dy - cep, z - cw / 2), (dx + cep, gy + dy + cep, z + cw / 2), "fer")
    ep, n = C["planche"], C["lattes"]
    pas = 2 * dy / n
    for k in range(n):
        y = gy - dy + pas * (k + 0.5)
        boite(m, (-dx, y - pas * 0.42, haut), (dx, y + pas * 0.42, haut + ep), "bois")
    sl, sep = C["suspentes"]
    gl = D["VERGE"]["goupille"][1]
    boite(m, (-dx - cep, gy - sl / 2, haut + ep), (dx + cep, gy + sl / 2, haut + ep + sep), "fer")
    for signe in (1, -1):
        x = signe * (gl - sl)
        poutre(m, (x, gy, gz), (x, gy, haut + ep), sl, sep, (1, 0, 0), "fer")
    return m


def construire(D):
    mats = habillage.materiaux(D["MATERIAUX"])
    ch = chassis(D, mats)
    vg, goupille, crochet = verge(D, mats)
    pivot = (0.0, D["AXE"]["z"])
    angle = D["VERGE"]["repos"]
    basculer_maille(vg, pivot, angle)
    goupille, crochet = basculer(goupille, pivot, angle), basculer(crochet, pivot, angle)
    fronde(D, vg, crochet)
    cp = contrepoids(D, mats, goupille)
    dx, dy = recentrer([ch, vg, cp])
    objet("chassis", ch, (0.0, 0.0, 0.0), 35)
    objet("verge", vg, (dx, dy, pivot[1]), 35)
    objet("contrepoids", cp, (dx, goupille[1] + dy, goupille[2]), 35)
    return animer([REPOS, cahoter(["chassis", "verge", "contrepoids"]), tir(D, goupille[1], goupille[2] - pivot[1])])


def tir(D, gy, gz):
    """Le clip `tir` : la verge lâchée de `course` (degrés) par la chute du contrepoids, pendu d'aplomb à sa goupille
    (`gy`, `gz` depuis l'axe), puis ramenée au treuil (`TIR`, temps de `coup`)."""
    temps, course = D["TIR"], math.radians(D["VERGE"]["course"])
    angle = lambda t: course * coup(t, temps)

    def goupille(t):
        c, s = math.cos(angle(t)), math.sin(angle(t))
        return (0, gy * c - gz * s - gy, gy * s + gz * c - gz), (0, 0, 0)

    return ("tir", "tir", sum(temps), {"verge": lambda t: ((0, 0, 0), (angle(t), 0, 0)), "contrepoids": goupille})


def elements(D):
    yield {"glb": "trebuchet", "cles": [("vehicule", {"definition": d}) for d in D["DEFINITIONS"]],
           "materiaux": D["MATERIAUX"], "blasons": (), "construire": lambda: construire(D)}
