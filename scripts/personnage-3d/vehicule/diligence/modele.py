"""La diligence (#4471) : les nœuds `voiture` (châssis, caisse, toit, siège, plateau, timon),
`roue_avg`, `roue_avd`, `roue_arg` et `roue_ard` (chacune à son essieu, `roulant.py` ; meshes sans skin ni armature),
l'emprise recentrée, et ses clips (`clips.py`) : repos, roulage ; un GLB pour les clés des `definitions` de la
caisse."""
import habillage
from clips import REPOS, animer, rouler
from maille import Maille, boite, cylindre, monter, poutre, tube
from roulant import roulement, trains

COTES = (1, -1)


def chassis(D, m):
    """Le châssis : deux longerons et leurs traverses, sur les cales des trains."""
    C = D["CHASSIS"]
    lx, ll, y0, y1, z0, z1 = C["longerons"]
    for s in COTES:
        boite(m, (s * lx - ll, y0, z0), (s * lx + ll, y1, z1), "bois")
    ys, tp, tz0, tz1 = C["traverses"]
    for y in ys:
        boite(m, (-lx, y - tp, tz0), (lx, y + tp, tz1), "bois")


def caisse(D, m):
    """La caisse : plancher, parois de bout, flancs percés de leurs baies (allège, linteau, montants), vitrage en
    retrait, membrure en saillie (ceintures, poteaux d'angle, montants de la portière), poignée et marchepied."""
    K = D["CAISSE"]
    lx, y0, y1, z0, z1 = K["boite"]
    e, (appui, linteau), (py, pl), dm = K["paroi"], K["baies"], K["portiere"], K["montant"]
    boite(m, (-lx + e, y0 + e, z0), (lx - e, y1 - e, z0 + e), "caisse")
    for y in (y0, y1 - e):
        boite(m, (-lx, y, z0), (lx, y + e, z1), "caisse")
    retrait, verre = K["vitre"]
    saillie, dh, part = K["membrure"]
    ceintures = K["ceintures"]
    hy, hz, hr, hs, hc = K["poignee"]
    dz, ds, dl, de, dr = K["degre"]
    montants = (y0 + dm, py - pl, py + pl, y1 - dm)
    for s in COTES:
        dehors, dedans = s * lx, s * (lx - e)
        x0, x1 = sorted((dehors, dedans))
        boite(m, (x0, y0 + e, z0), (x1, y1 - e, appui), "caisse")
        boite(m, (x0, y0 + e, linteau), (x1, y1 - e, z1), "caisse")
        for y in montants:
            boite(m, (x0, y - dm, appui), (x1, y + dm, linteau), "caisse")
        v0, v1 = sorted((s * (lx - retrait), s * (lx - retrait - verre)))
        boite(m, (v0, y0 + e, appui), (v1, y1 - e, linteau), "vitre")
        b0, b1 = sorted((dehors, s * (lx + saillie)))
        for z in ceintures:
            boite(m, (b0, y0, z - dh), (b1, y1, z + dh), "caisse")
        b0, b1 = sorted((dehors, s * (lx + saillie * part)))
        for y in (y0 + dm, y1 - dm):
            boite(m, (b0, y - dm, ceintures[0] + dh), (b1, y + dm, ceintures[2] - dh), "caisse")
        for y in (py - pl, py + pl):
            boite(m, (b0, y - dm / 2, ceintures[0] + dh), (b1, y + dm / 2, ceintures[2] - dh), "caisse")
        p0, p1 = sorted((dehors, s * (lx + hs)))
        cylindre(m, p0, p1, hr, "x", (0, py - hy, hz), hc, "laiton")
        g0, g1 = sorted((dehors, s * (lx + ds)))
        boite(m, (g0, py - dl, dz - de / 2), (g1, py + dl, dz + de / 2), "fer")
        for y in (py - dl + dr, py + dl - dr):
            poutre(m, (s * (lx + ds / 2), y, dz), (s * (lx - e), y, z0 + e), 2 * dr, 2 * dr, (0, 1, 0), "fer")


def toit(D, m):
    """Le toit de cuir et sa galerie : une lisse de fer sur ses montants."""
    T = D["TOIT"]
    lx, y0, y1, z0, z1 = T["boite"]
    boite(m, (-lx, y0, z0), (lx, y1, z1), "cuir")
    gx, g0, g1, haut = T["galerie"]
    r, cotes = T["fer"]
    lisse = z1 + haut - r
    for s in COTES:
        cylindre(m, g0 - r, g1 + r, r, "y", (s * gx, 0, lisse), cotes, "fer")
    for y in (g0, g1):
        cylindre(m, -gx, gx, r, "x", (0, y, lisse), cotes, "fer")
    longs, petits = T["montants"]
    pieds = [(s * gx, g0 + (g1 - g0) * k / (longs - 1)) for s in COTES for k in range(longs)]
    pieds += [(gx - 2 * gx * k / (petits - 1), y) for y in (g0, g1) for k in range(1, petits - 1)]
    for x, y in pieds:
        cylindre(m, z1 - r, lisse, r, "z", (x, y, 0), cotes, "fer")


def cocher(D, m):
    """Le poste du cocher : coffre, coussin de cuir, marchepied sur ses consoles, garde-corps de fer."""
    Co = D["COCHER"]
    for nom, mat in (("coffre", "caisse"), ("coussin", "cuir"), ("marchepied", "bois")):
        lx, y0, y1, z0, z1 = Co[nom]
        boite(m, (-lx, y0, z0), (lx, y1, z1), mat)
    cx, py, pz, ty, tz, section = Co["consoles"]
    gx, gz, fy, fz, r, cotes = Co["garde"]
    devant = D["CAISSE"]["boite"][1]
    for s in COTES:
        poutre(m, (s * cx, py, pz), (s * cx, ty, tz), section, section, (1, 0, 0), "fer")
        tube(m, [(s * gx, devant, gz), (s * gx, fy, fz)], r, cotes, "fer")


def plateau(D, m):
    """Le plateau à bagages de l'arrière, ferré de deux bandes."""
    lx, y0, y1, z0, z1 = D["PLATEAU"]["boite"]
    boite(m, (-lx, y0, z0), (lx, y1, z1), "caisse")
    xs, dl, saillie = D["PLATEAU"]["sangles"]
    for x in xs:
        boite(m, (x - dl, y0, z0), (x + dl, y1 + saillie, z1 + saillie), "fer")


def timon(D, m):
    """Le timon, du dessus de l'essieu avant à sa pointe, et son palonnier posé sur lui."""
    Ti, avant = D["TIMON"], D["TRAINS"]["av"]
    largeur, epaisseur = Ti["section"]
    depart = (0, avant["y"], avant["rayon"] + avant["essieu"][0] + epaisseur / 2)
    py, pz = Ti["pointe"]
    poutre(m, depart, (0, py, pz), largeur, epaisseur, (0, 0, 1), "bois")
    lx, y, dp, dh = Ti["palonnier"]
    z = depart[2] + (pz - depart[2]) * (y - depart[1]) / (py - depart[1]) + epaisseur / 2
    boite(m, (-lx, y - dp, z - dh), (lx, y + dp, z + dh), "bois")


def construire(D, materiaux, piece):
    """La caisse `piece(D, maille)` sur le châssis et ses deux trains (`roulant.trains`), l'emprise recentrée en x et y
    (le sol reste z = 0)."""
    mats = habillage.materiaux(materiaux)
    voiture = Maille([mats[nom] for nom in materiaux])
    chassis(D, voiture)
    roues = trains(D["TRAINS"], voiture, mats["bois"], mats["fer"])
    for batir in (piece, toit, cocher, plateau, timon):
        batir(D, voiture)
    monter({"voiture": (voiture, None), **roues}, D["ANGLE_LISSE"])
    return animer([REPOS, rouler(roulement(D["TRAINS"]))])


PIECES = (("diligence", "CAISSE", caisse),)


def elements(D):
    return habillage.pieces(D, PIECES, construire)
