"""Les pièces sur trépied à pivot (#2987) : un GLB par pièce, aux nœuds `trepied` et la pièce avec sa fourche (pivot à
l'axe des tourillons, sur l'axe du pivot vertical), meshes sans skin ni armature, l'emprise recentrée, et ses clips
(`clips.py`) : repos, portage, tir ; une clé par engin de ses `definitions`."""
import math

import habillage
from clips import REPOS, animer, cahoter, tirer
from maille import Maille, boite, cylindre, objet, plaque, poutre, recentrer, tore, tour, tube


def trepied(D, mats):
    """La tête de bois frettée, ses trois pieds sabotés et la broche du pivot."""
    T = D["TREPIED"]
    m = Maille([mats["bois"], mats["fer"]])
    r, z0, z1 = T["moyeu"]
    cylindre(m, z0, z1, r, "z", (0, 0, 0), T["segments"], "bois")
    rs, saillie = T["frette"]
    for z in T["frettes"]:
        tore(m, "z", (0, 0, z), r + saillie - rs, rs, T["segments"], 4, "fer")
    (rh, zh), (rb, zb) = T["pied_haut"], T["pied_bas"]
    largeur, epaisseur = T["pied_section"]
    cote, ep = T["sabot"]
    for azimut in T["pieds"]:
        c, s = math.cos(math.radians(azimut)), math.sin(math.radians(azimut))
        poutre(m, (rh * c, rh * s, zh), (rb * c, rb * s, zb), largeur, epaisseur, (-s, c, 0), "bois")
        boite(m, (rb * c - cote / 2, rb * s - cote / 2, 0.0), (rb * c + cote / 2, rb * s + cote / 2, ep), "fer")
    rp, p0, p1 = T["pivot"]
    cylindre(m, p0, p1, rp, "z", (0, 0, 0), 8, "fer")
    return m


def fourche(m, D, tourillon, mat):
    """La fourche de fer sur le pivot et les tourillons de la pièce (rayon, demi-longueur)."""
    F = D["FOURCHE"]
    z = F["tourillons_z"]
    demi, t0, t1, prof = F["traverse"]
    boite(m, (-demi, -prof / 2, t0), (demi, prof / 2, t1), mat)
    xi, xe, haut, prof = F["bras"]
    for signe in (1, -1):
        a, b = sorted((signe * xi, signe * xe))
        boite(m, (a, -prof / 2, t1), (b, prof / 2, haut), mat)
    rt, lt = tourillon
    cylindre(m, -lt, lt, rt, "x", (0, 0, z), 10, mat)


def pierrier(D, mats):
    """Le tromblon de bronze, sa queue de manœuvre et sa fourche."""
    P, z = D["PIERRIER"], D["FOURCHE"]["tourillons_z"]
    m = Maille([mats["bronze"], mats["fer"]])
    tour(m, P["profil"], "y", (0, 0, z), P["segments"], "bronze")
    fourche(m, D, P["tourillon"], "fer")
    chemin = [(0, y, z + dz) for y, dz in P["queue"]]
    tube(m, chemin, P["queue_section"], 8, "fer")
    rp, lp = P["pommeau"]
    y, dz = P["queue"][-1]
    tour(m, [(y - 0.01, 0), (y, rp), (y + lp / 2, rp), (y + lp, 0)], "y", (0, 0, z + dz), 10, "fer")
    return {"pierrier": m}, P["tir"]


def canon_a_repetition(D, mats):
    """La boîte de culasse, les leviers, la crosse et la fourche (`canon`), et le barillet qui tourne dans son axe : sept
    canons, leurs plaques et la manivelle circulaire."""
    C, z = D["CANON_A_REPETITION"], D["FOURCHE"]["tourillons_z"]
    m = Maille([mats["bois"], mats["fer"]])
    b = Maille([mats["bronze"], mats["fer"], mats["laiton"]])
    rb, rc, yc, yb, seg = C["canons"]
    centres = [(0.0, 0.0)] + [(rb * math.cos(math.pi * k / 3), rb * math.sin(math.pi * k / 3)) for k in range(6)]
    for u, w in centres:
        profil = [(yc, 0), (yc, rc), (yb + 0.04, rc), (yb + 0.02, rc * 1.25), (yb, rc * 1.25), (yb, rc * 0.55),
                  (yb + 0.06, rc * 0.55), (yb + 0.06, 0)]
        tour(b, profil, "y", (u, 0, z + w), seg, "bronze")
    rp = C["plaque_rayon"]
    for y, e in C["plaques"]:
        cylindre(b, y - e, y + e, rp, "y", (0, 0, z), 6, "fer")
    demi, h, y0, y1 = C["boite"]
    boite(m, (-demi, y0, z - h), (demi, y1, z + h), "fer")
    fourche(m, D, C["tourillon"], "fer")
    ym, rm, rs, rais = C["manivelle"]
    tore(b, "y", (0, ym, z), rm, rs, 20, 5, "laiton")
    cylindre(b, ym - 0.03, ym + 0.03, 0.022, "y", (0, 0, z), 8, "laiton")
    for k in range(rais):
        t = 2 * math.pi * k / rais + math.pi / 2
        poutre(b, (0.02 * math.cos(t), ym, z + 0.02 * math.sin(t)), (rm * math.cos(t), ym, z + rm * math.sin(t)), 0.014, 0.010, (0, 1, 0), "laiton")
    rg, lg = C["poignee"]
    t = math.pi / 2 + math.pi / rais
    cylindre(b, ym - lg, ym, rg, "y", (rm * math.cos(t), 0, z + rm * math.sin(t)), 8, "laiton")
    largeur, epaisseur = C["levier_section"]
    for ya, za, yb_, zb in C["leviers"]:
        poutre(m, (demi + 0.008, ya, z + za), (demi + 0.008, yb_, z + zb), largeur, epaisseur, (1, 0, 0), "fer")
    ep = C["crosse_epaisseur"]
    profil = C["crosse"]
    plaque(m, [(0.0, y, z + dz) for y, dz in profil], 2 * ep, "bois")
    p0, p1 = C["plaque_de_couche"]
    zs = [dz for y, dz in profil if y >= p0]
    boite(m, (-ep - 0.004, p1 - 0.012, z + min(zs) - 0.004), (ep + 0.004, p1 + 0.004, z + max(zs) + 0.004), "fer")
    return {"canon": m, "barillet": b}, C["tir"]


def construire(D, materiaux, piece):
    """La pièce `piece(D, mats)` → ({nœud: maille}, table de tir) dans sa fourche sur le trépied, l'emprise recentrée en
    x et y (le sol reste z = 0) ; ses nœuds pivotent à l'axe des tourillons, sur l'axe du pivot."""
    mats = habillage.materiaux(materiaux)
    mailles, tir = piece(D, mats)
    pied = trepied(D, mats)
    dx, dy = recentrer([*mailles.values(), pied])
    objet("trepied", pied, (0.0, 0.0, 0.0), 35)
    for nom, maille in mailles.items():
        objet(nom, maille, (dx, dy, D["FOURCHE"]["tourillons_z"]), 35)
    return animer([REPOS, cahoter(["trepied", *mailles]), tirer(tir, D["TIR"], [], mailles)])


PIECES = (("pierrier", "PIERRIER", pierrier), ("canon-a-repetition", "CANON_A_REPETITION", canon_a_repetition))


def elements(D):
    return habillage.pieces(D, PIECES, construire)
