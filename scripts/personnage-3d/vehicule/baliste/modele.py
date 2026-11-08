"""La baliste (#2987) : les nœuds `pied` et `baliste` (pivot à l'axe vertical, sur la platine), meshes sans skin ni
armature, l'emprise recentrée ; un GLB pour les clés de `DEFINITIONS`."""
import math

from mathutils import Vector

import habillage
from maille import Maille, boite, cylindre, objet, plaque, poutre, recentrer, tour, tube


def pied(D, bois, fer):
    P = D["PIED"]
    m = Maille([bois, fer])
    L, l, h = P["croix"]
    boite(m, (-L, -l, 0.0), (L, l, h), "bois")
    boite(m, (-l, -L, 0.0), (l, L, h), "bois")
    c, haut = P["poteau"]
    boite(m, (-c, -c, h), (c, c, haut), "bois")
    d, z, s = P["jambes"]
    for ux, uy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        poutre(m, (ux * d, uy * d, h), (ux * c, uy * c, z), s, s, (uy, ux, 0), "bois")
    r, e = P["platine"]
    cylindre(m, haut, haut + e, r, "z", (0, 0, 0), 16, "fer")
    return m


def baliste(D, bois, fer, cordage):
    B, zp = D["BALISTE"], D["PIVOT_Z"]
    m = Maille([bois, fer, cordage])

    # fourche tournante et axe d'élévation
    sx, sy, se = B["sellette"]
    boite(m, (-sx, -sy, zp), (sx, sy, zp + se), "bois")
    xi, ej, py, zj = B["joues"]
    for signe in (1, -1):
        a, b = sorted((signe * xi, signe * (xi + ej)))
        boite(m, (a, -py, zp + se), (b, py, zj), "bois")
    zt, rt, lt = B["tourillon"]
    cylindre(m, -lt, lt, rt, "x", (0, 0, zt), 8, "fer")

    # glissière et ses rails
    fl, fy0, fy1, fz0, fz1 = B["fut"]
    boite(m, (-fl, fy0, fz0), (fl, fy1, fz1), "bois")
    rx, rl, ry0, ry1, rh = B["rails"]
    for signe in (1, -1):
        a, b = sorted((signe * rx, signe * (rx + rl)))
        boite(m, (a, ry0, fz1), (b, ry1, fz1 + rh), "bois")

    # cadre des écheveaux, écheveaux de torsion et rondelles
    cy0, cy1, cl, (b0, b1), (h0, h1) = B["chassis"]
    boite(m, (-cl, cy0, b0), (cl, cy1, b1), "bois")
    boite(m, (-cl, cy0, h0), (cl, cy1, h1), "bois")
    for mx, ml, my0, my1 in B["montants"]:
        for signe in (1, -1):
            a, b = sorted((signe * mx, signe * (mx + ml)))
            boite(m, (a, my0, b1), (b, my1, h0), "bois")
    ex, ey, er, ez0, ez1 = B["echeveaux"]
    rr, re_ = B["rondelles"]
    for signe in (1, -1):
        cylindre(m, ez0, ez1, er, "z", (signe * ex, ey, 0), 12, "cordage")
        cylindre(m, h1, h1 + re_, rr, "z", (signe * ex, ey, 0), 12, "fer")
        cylindre(m, b0 - re_, b0, rr, "z", (signe * ex, ey, 0), 12, "fer")

    # bras, coiffes et corde tendue sur la griffe
    (bx, by), bl, be, bc = B["bras"]
    zc = B["carreau"][5]
    gl, gy0, gy1, gz0, gz1 = B["griffe"]
    for signe in (1, -1):
        pied_bras = Vector((signe * ex, ey, zc))
        bout = Vector((signe * bx, by, zc))
        poutre(m, pied_bras, bout, bl, be, (0, 0, 1), "bois")
        d = (bout - pied_bras).normalized()
        poutre(m, bout - d * bc, bout + d * 0.01, bl * 1.15, be * 1.15, (0, 0, 1), "fer")
        tube(m, [bout, ((bout.x * 0.5), (bout.y + gy0) * 0.5, zc + 0.005), (0.0, gy0, zc + 0.01)], B["corde"], 5, "cordage")
    boite(m, (-gl, gy0, gz0), (gl, gy1, gz1), "fer")

    # treuil à cliquet et câble jusqu'à la griffe
    T = B["treuil"]
    jx, je, jy0, jy1, jz0, jz1 = T["joues"]
    for signe in (1, -1):
        a, b = sorted((signe * jx, signe * (jx + je)))
        boite(m, (a, jy0, jz0), (b, jy1, jz1), "bois")
    ay, az, ra, rf, la = T["axe"]
    cylindre(m, -jx, jx, ra, "x", (0, ay, az), 12, "bois")
    cylindre(m, -la, la, rf, "x", (0, ay, az), 8, "fer")
    lb, sb, lp = T["manivelles"]
    for signe in (1, -1):
        x = signe * (la - sb / 2)
        poutre(m, (x, ay, az), (x, ay, az - lb), sb, sb, (1, 0, 0), "fer")
        a, b = sorted((x, x + signe * lp))
        cylindre(m, a, b, sb * 0.8, "x", (0, ay, az - lb), 6, "fer")
    q0, q1, rq = T["rochet"]
    n = T["dents"]
    contour = []
    for k in range(n):
        t0, t1 = 2 * math.pi * k / n, 2 * math.pi * (k + 0.75) / n
        contour += [(ay + rq * 0.8 * math.cos(t0), az + rq * 0.8 * math.sin(t0)), (ay + rq * math.cos(t1), az + rq * math.sin(t1))]
    plaque(m, [((q0 + q1) / 2, y, z) for y, z in contour], q1 - q0, "fer")
    pq, bq, sq = T["cliquet"]
    poutre(m, pq, bq, sq, sq, (1, 0, 0), "fer")
    tube(m, [(0.0, ay - ra, az), (0.0, (ay - ra + gy1) / 2, (az + gz1) / 2 - 0.02), (0.0, gy1, gz1 - 0.03)], B["corde"], 5, "cordage")

    # carreau engagé, sa douille de fer et ses empennes
    ty, dy, py_, rc, rd, zc = B["carreau"]
    cylindre(m, ty, dy, rc, "y", (0, 0, zc), 8, "bois")
    tour(m, [(dy + 0.04, 0), (dy + 0.04, rc), (dy, rd), (py_, 0)], "y", (0, 0, zc), 8, "fer")
    ey0, ey1, eh, ee, angles = B["empennes"]
    for angle in angles:
        w = Vector((math.sin(math.radians(angle)), 0, math.cos(math.radians(angle))))
        c = Vector((0, 0, zc)) + w * (rc + eh / 2)
        poutre(m, c + Vector((0, ey0, 0)), c + Vector((0, ey1, 0)), eh, ee, Vector((0, 1, 0)).cross(w), "bois")
    return m


def construire(D):
    mats = habillage.materiaux(D["MATERIAUX"])
    bois, fer, cordage = mats["bois"], mats["fer"], mats["cordage"]
    socle = pied(D, bois, fer)
    arme = baliste(D, bois, fer, cordage)

    # emprise recentrée en x et y ; le sol reste z = 0
    dx, dy = recentrer([socle, arme])
    objet("pied", socle, (0.0, 0.0, 0.0), 35)
    objet("baliste", arme, (dx, dy, D["PIVOT_Z"]), 35)
    return {}


def elements(D):
    yield {"glb": "baliste", "cles": [("vehicule", {"definition": d}) for d in D["DEFINITIONS"]],
           "materiaux": D["MATERIAUX"], "blasons": (), "construire": lambda: construire(D)}
