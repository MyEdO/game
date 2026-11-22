"""Le kit de toit de tuile (#4471) : le GLB `toit--tuile`, les nœuds `faitiere`, `aretier` et `noue`, bâtis d'après
`donnees.py` dans le repère d'une pièce de toit (`faitage.py`). Chaque tuile, chaque bourrelet et chaque solin est une
coque close ; rien n'y est tiré au sort : deux constructions rendent les mêmes octets."""
import math

import faitage

TUILE, MORTIER = "tuile", "mortier"


def dos(bord, rayon, pans):
    """La section demi-ronde d'une tuile : son dos de `rayon`, en `pans` facettes, au-dessus de son `bord`."""
    return [(bord + rayon * math.sin(math.pi * k / pans), rayon * math.cos(math.pi * k / pans)) for k in range(pans + 1)]


def creux(portee, levee, fond, pans):
    """La section d'une tuile creuse couchée dans la noue : son creux de `pans` facettes, épais de `fond` sur l'arête,
    levé de `levee`, d'un bord à l'autre de sa `portee`, et son dessous sur les deux pans."""
    travers = [portee * math.cos(math.pi * k / pans) for k in range(pans + 1)]
    return [*((levee + math.hypot(c, fond), c) for c in travers), (portee, -portee), (0.0, 0.0), (portee, portee)]


def solins(D, m, piece, bord, large, etroit):
    """Le solin de mortier de chaque côté de la `piece`, du pan au `bord` des tuiles, de la plus `large` à la plus
    `etroit`."""
    S, demi, versant = D["SOLIN"], faitage.longueur(D, piece) / 2, faitage.VERSANT[piece]
    dehors, dedans = large + S["debord"], etroit - S["prise"]
    for bras in faitage.BRAS:
        contour = [(faitage.pan(dehors, versant), bras * dehors), (bord + S["levee"], bras * large),
                   (bord + S["levee"], bras * dedans), (faitage.pan(dedans, versant), bras * dedans)]
        faitage.profil(m, (-demi, demi), contour, MORTIER)


def demi_rondes(piece):
    """Les tuiles demi-rondes qui se recouvrent le long de la `piece`, le bourrelet de la queue de chacune, et le solin
    de mortier de chaque côté."""
    def batir(D, m, _):
        T = D["TUILES"]
        (etroit, large), pans = T["rayon"], T["pans"]
        longueur, saillie = T["bourrelet"]
        pas = faitage.longueur(D, piece) / T["nombre"][piece]
        bord = faitage.pan(large) + T["lit"]

        def rayon(u):
            return etroit + (large - etroit) * u

        for a0, a1, u0, u1 in faitage.recouvrants(faitage.longueur(D, piece), T["nombre"][piece], faitage.VERS_LE_BAS[piece]):
            faitage.file(m, [(a0, dos(bord, rayon(u0), pans)), (a1, dos(bord, rayon(u1), pans))], TUILE)
            for queue, u, sens in ((a0, u0, 1), (a1, u1, -1)):
                if u == 1.0:
                    bouts = sorted(((queue, large + saillie), (queue + sens * longueur, rayon(1 - longueur / pas) + saillie)))
                    faitage.file(m, [(a, dos(bord, r, pans)) for a, r in bouts], TUILE)
        solins(D, m, piece, bord, large, etroit)
    return batir


def creuses(piece):
    """Les tuiles creuses qui se recouvrent le long de la `piece`, couchées dans son creux, et le solin de mortier de
    chaque côté."""
    def batir(D, m, _):
        C = D["CREUSES"]
        (large, etroit), fond, pans = C["portee"], C["fond"], C["pans"]

        def section(u):
            return creux(large + (etroit - large) * u, C["levee"] * u, fond, pans)

        for a0, a1, u0, u1 in faitage.recouvrants(faitage.longueur(D, piece), C["nombre"], faitage.VERS_LE_BAS[piece]):
            faitage.file(m, [(a0, section(u0)), (a1, section(u1))], TUILE)
        solins(D, m, piece, math.hypot(large, fond), large, etroit)
    return batir


def elements(D):
    return faitage.elements(D, lambda piece: creuses(piece) if piece == faitage.NOUE else demi_rondes(piece))
