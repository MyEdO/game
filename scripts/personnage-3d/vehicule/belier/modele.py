"""Le bélier (#2987) : les nœuds `charpente`, `tronc`, `chaine_av` et `chaine_ar` (pivot à leur attache au chapeau),
`roue_avg`, `roue_avd`, `roue_arg`, `roue_ard` (meshes sans skin ni armature), l'emprise recentrée, et ses clips
(`clips.py`) : repos, roulage, coup ; un GLB pour les clés de `DEFINITIONS`."""
import math

import habillage
from clips import REPOS, animer, lisse, montee, rouler
from maille import Maille, boite, cylindre, objet, poutre, recentrer, roue, tore, tour


def charpente(D, bois, fer):
    C, zE = D["CHARPENTE"], D["ESSIEU_Z"]
    m = Maille([bois, fer])
    lx, ll, ly0, ly1, lz0, lz1 = C["longerons"]
    for signe in (1, -1):
        boite(m, (signe * lx - ll, ly0, lz0), (signe * lx + ll, ly1, lz1), "bois")
    cx, cp, cz0, cz1 = C["corps_essieu"]
    rf, lf = C["fusee"]
    for y in D["ESSIEUX_Y"]:
        boite(m, (-cx, y - cp, cz0), (cx, y + cp, cz1), "bois")
        cylindre(m, -lf, lf, rf, "x", (0, y, zE), 8, "fer")
    ys, tp, tz0, tz1 = C["traverses"]
    for y in ys:
        boite(m, (-lx, y - tp, tz0), (lx, y + tp, tz1), "bois")
    ps, pz = C["poteau"]
    hx, hp, hh = C["chapeau"]
    fd, fz, fs = C["contrefiches"]
    ax, az, as_ = C["aisseliers"]
    for y in C["portiques"]:
        for signe in (1, -1):
            x = signe * lx
            boite(m, (x - ps, y - ps, lz1), (x + ps, y + ps, pz), "bois")
            for sens in (1, -1):
                poutre(m, (x, y + sens * fd, lz1), (x, y + sens * ps, fz), fs, fs, (1, 0, 0), "bois")
            poutre(m, (x - signe * ps, y, az), (signe * ax, y, pz), as_, as_, (0, 1, 0), "bois")
        boite(m, (-hx, y - hp, pz), (hx, y + hp, pz + hh), "bois")
    fx, fl, fh = C["faitiere"]
    boite(m, (-fx, -fl, pz + hh), (fx, fl, pz + hh + fh), "bois")
    return m


def tronc(D, bois, fer):
    """Le tronc, sa tête de fer et ses colliers, puis la chaîne de chaque portique, du chapeau au collier, maillons
    alternés : (tronc, [chaîne]), une chaîne par y de `portiques`."""
    T, C = D["TRONC"], D["CHARPENTE"]
    m = Maille([bois, fer])
    z = T["axe_z"]
    tour(m, T["fut"], "y", (0, 0, z), T["segments"], "bois")
    tour(m, T["tete"], "y", (0, 0, z), T["segments"], "fer")
    ys, rs = T["colliers"]
    for y in ys:
        tore(m, "y", (0, y, z), T["fut"][1][1] - 0.01, rs, T["segments"], 4, "fer")

    ra, rm, pas = T["maillon"]
    haut = C["poteau"][1]
    bas = z + T["fut"][1][1] + rs
    chaines = []
    for y in C["portiques"]:
        chaine = Maille([fer])
        k = 0
        while haut - ra - k * pas - ra >= bas - ra:
            tore(chaine, "x" if k % 2 else "y", (0, y, haut - ra - k * pas), ra, rm, 8, 4, "fer")
            k += 1
        chaines.append(chaine)
    return m, chaines


def balance(T, longueur):
    """Le clip `melee` : le tronc tiré en arrière, lancé en avant, ramené au repos (`balance` : degrés en arrière, en
    avant, temps de chaque mouvement), en parallélogramme sous ses chaînes de `longueur`, qui tournent à leur attache."""
    arriere, avant, (a, b, c) = (math.radians(T["balance"][0]), math.radians(T["balance"][1]), T["balance"][2])

    def angle(t):
        if t < a:
            return arriere * lisse(t / a)
        if t < a + b:
            return arriere - (arriere + avant) * montee((t - a) / b)
        return -avant * (1 - lisse((t - a - b) / c))

    chaine = lambda t: ((0, 0, 0), (angle(t), 0, 0))
    tronc_ = lambda t: ((0, longueur * math.sin(angle(t)), longueur * (1 - math.cos(angle(t)))), (0, 0, 0))
    return ("melee", "coup", a + b + c, {"tronc": tronc_, "chaine_av": chaine, "chaine_ar": chaine})


def construire(D):
    mats = habillage.materiaux(D["MATERIAUX"])
    bois, fer = mats["bois"], mats["fer"]
    R, zE = D["ROUE"], D["ESSIEU_Z"]
    bati = charpente(D, bois, fer)
    belier, chaines = tronc(D, bois, fer)
    y_av, y_ar = D["ESSIEUX_Y"]
    roues = {nom: (roue(R, signe * R["voie"], zE, signe, bois, fer), (signe * R["voie"], y, zE))
             for nom, signe, y in (("roue_avg", 1, y_av), ("roue_avd", -1, y_av), ("roue_arg", 1, y_ar), ("roue_ard", -1, y_ar))}
    for r, (_, y, _) in roues.values():
        r.v = [(px, py + y, pz) for px, py, pz in r.v]

    # emprise recentrée en x et y ; le sol reste z = 0
    dx, dy = recentrer([bati, belier, *chaines] + [r for r, _ in roues.values()])
    haut = D["CHARPENTE"]["poteau"][1]
    objet("charpente", bati, (0.0, 0.0, 0.0), 35)
    objet("tronc", belier, (dx, dy, haut), 35)
    for nom, chaine, y in zip(("chaine_av", "chaine_ar"), chaines, D["CHARPENTE"]["portiques"]):
        objet(nom, chaine, (dx, y + dy, haut), 35)
    for nom, (r, c) in roues.items():
        objet(nom, r, (c[0] + dx, c[1] + dy, c[2]), 35)
    T = D["TRONC"]
    longueur = haut - T["axe_z"] - T["fut"][1][1]
    return animer([REPOS, rouler(R["bandage"][1], roues), balance(T, longueur)])


def elements(D):
    yield {"glb": "belier", "cles": [("vehicule", {"definition": d}) for d in D["DEFINITIONS"]],
           "materiaux": D["MATERIAUX"], "blasons": (), "construire": lambda: construire(D)}
