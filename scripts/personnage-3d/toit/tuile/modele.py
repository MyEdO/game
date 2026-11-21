"""Le faîtage de tuile (#4471) : le GLB `toit--tuile`, le nœud `faitiere`, bâti d'après `donnees.py` dans le repère
d'une faîtière (`faitage.py`). Chaque tuile, chaque bourrelet et chaque solin est une coque close ; rien n'y est tiré
au sort : deux constructions rendent les mêmes octets."""
import math

import faitage

TUILE, MORTIER = "tuile", "mortier"


def dos(bord, rayon, pans):
    """La section demi-ronde d'une tuile : son dos de `rayon`, en `pans` facettes, au-dessus de son `bord`."""
    return [(bord + rayon * math.sin(math.pi * k / pans), rayon * math.cos(math.pi * k / pans)) for k in range(pans + 1)]


def faitiere(D, m, _):
    """Les tuiles demi-rondes qui se recouvrent le long du faîte, le bourrelet de la queue de chacune, et le solin de
    mortier de chaque côté."""
    T, S, demi = D["TUILES"], D["SOLIN"], D["LONGUEUR"] / 2
    (etroit, large), pans = T["rayon"], T["pans"]
    longueur, saillie = T["bourrelet"]
    pas = D["LONGUEUR"] / T["nombre"]
    bord = faitage.pan(large) + T["lit"]

    def rayon(u):
        return etroit + (large - etroit) * u

    for a0, a1, u0, u1 in faitage.recouvrants(D["LONGUEUR"], T["nombre"]):
        faitage.file(m, [(a0, dos(bord, rayon(u0), pans)), (a1, dos(bord, rayon(u1), pans))], TUILE)
        if u1 == 1.0:
            faitage.file(m, [(a1 - longueur, dos(bord, rayon(1 - longueur / pas) + saillie, pans)),
                             (a1, dos(bord, large + saillie, pans))], TUILE)
    dehors, dedans = large + S["debord"], etroit - S["prise"]
    for bras in faitage.BRAS:
        contour = [(faitage.pan(dehors), bras * dehors), (bord + S["levee"], bras * large),
                   (bord + S["levee"], bras * dedans), (faitage.pan(dedans), bras * dedans)]
        faitage.profil(m, (-demi, demi), contour, MORTIER)


def elements(D):
    return faitage.elements(D, faitiere)
