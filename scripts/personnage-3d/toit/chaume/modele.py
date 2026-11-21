"""Le faîtage de chaume (#4471) : le GLB `toit--chaume`, le nœud `faitiere`, bâti d'après `donnees.py` dans le repère
d'une faîtière (`faitage.py`). La selle, chaque brin et chaque baguette est une coque close ; rien n'y est tiré au
sort : deux constructions rendent les mêmes octets."""
import math

import faitage
from maille import lineaire

SELLE, TRESSE, BAGUETTE = "selle", "tresse", "baguette"
BRINS = 3


def selle(D, m):
    """La selle de paille, filée de la pointe d'une dent au creux de la suivante."""
    S, demi = D["SELLE"], D["LONGUEUR"] / 2
    dos, (creux, pointe) = S["dos"], S["portee"]
    sections = []
    for k in range(2 * S["dents"] + 1):
        portee = creux if k % 2 else pointe
        dessus = [(faitage.pan(d) + levee, d) for d, levee in ((portee, S["bord"]), *reversed(dos))]
        contour = [(faitage.pan(portee), -portee), (0.0, 0.0), (faitage.pan(portee), portee), *dessus,
                   *((h, -c) for h, c in reversed(dessus[:-1]))]
        sections.append((-demi + k * D["LONGUEUR"] / (2 * S["dents"]), contour))
    faitage.file(m, sections, SELLE)


def tresse(D, m):
    """La tresse : trois brins, chacun filé d'un bout à l'autre de la case, qui s'écarte du faîte de part et d'autre et
    passe sur un voisin puis sous l'autre."""
    T, demi = D["TRESSE"], D["LONGUEUR"] / 2
    rayon, sections = T["rayon"], T["periodes"] * T["pas"]
    axe = D["SELLE"]["dos"][0][1] + T["assise"]
    for brin in range(BRINS):
        anneaux = []
        for k in range(sections + 1):
            phase = 2 * math.pi * (k / T["pas"] + brin / BRINS)
            h, c = axe + T["passe"] * math.sin(2 * phase), T["ecart"] * math.sin(phase)
            anneaux.append((-demi + k * D["LONGUEUR"] / sections,
                            [(h + rayon * math.cos(2 * math.pi * i / T["cotes"]), c + rayon * math.sin(2 * math.pi * i / T["cotes"]))
                             for i in range(T["cotes"])]))
        faitage.file(m, anneaux, TRESSE)


def baguettes(D, m):
    """Les deux baguettes de chaque bras, filées d'un bout à l'autre de la case sur le dos de la selle, et le zigzag
    des baguettes croisées de l'une à l'autre."""
    B, demi, dos = D["BAGUETTES"], D["LONGUEUR"] / 2, D["SELLE"]["dos"]
    (filee, croisee), (haute, basse) = B["cotes"], B["places"]
    pas = D["LONGUEUR"] / B["croisees"]

    def sur_le_dos(a, d):
        return lineaire(dos, d)

    for bras in faitage.BRAS:
        for place in B["places"]:
            faitage.plaque(m, bras, [(-demi, place - filee / 2), (demi, place - filee / 2), (demi, place + filee / 2),
                                     (-demi, place + filee / 2)], sur_le_dos, lambda a, d: sur_le_dos(a, d) + filee, BAGUETTE)
        for k in range(B["croisees"]):
            a0, a1 = -demi + k * pas, -demi + (k + 1) * pas
            d0, d1 = (haute, basse) if k % 2 else (basse, haute)
            faitage.plaque(m, bras, [(a0, d0), (a0 + croisee, d0), (a1, d1), (a1 - croisee, d1)],
                           sur_le_dos, lambda a, d: sur_le_dos(a, d) + croisee, BAGUETTE)


def faitiere(D, m, _):
    selle(D, m)
    tresse(D, m)
    baguettes(D, m)


def elements(D):
    return faitage.elements(D, faitiere)
