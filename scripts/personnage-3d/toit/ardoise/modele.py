"""Le faîtage d'ardoise (#4471) : le GLB `toit--ardoise`, le nœud `faitiere`, bâti d'après `donnees.py` dans le repère
d'une faîtière (`faitage.py`). Chaque ardoise et chaque crochet est une coque close ; rien n'y est tiré au sort : deux
constructions rendent les mêmes octets."""
import faitage

ARDOISE, CROCHET = "ardoise", "crochet"


def faitiere(D, m, _):
    """Les paires d'ardoises qui se recouvrent le long du faîte, et le crochet de la queue de chacune."""
    A, C = D["ARDOISES"], D["CROCHET"]
    portee, coin, (basse, haute) = A["portee"], A["coin"], A["levee"]
    pas = D["LONGUEUR"] / A["nombre"]
    place = portee * C["place"]
    for a0, a1, u0, u1 in faitage.recouvrants(D["LONGUEUR"], A["nombre"]):
        tete = a0 - u0 * pas
        queue = [(a1, portee - coin), (a1 - coin, portee)] if u1 == 1.0 else [(a1, portee)]
        contour = [(a0, 0.0), (a1, 0.0), *queue, (a0, portee)]
        for bras in faitage.BRAS:
            faitage.plaque(m, bras, contour, lambda a, d: 0.0,
                           lambda a, d: basse + (haute - basse) * (a - tete) / pas, ARDOISE)
            if u1 == 1.0:
                faitage.plaque(m, bras, [(a1 - C["longueur"], place - C["largeur"] / 2), (a1 + C["retour"], place - C["largeur"] / 2),
                                         (a1 + C["retour"], place + C["largeur"] / 2), (a1 - C["longueur"], place + C["largeur"] / 2)],
                               lambda a, d: 0.0, lambda a, d: haute + C["saillie"], CROCHET)


def elements(D):
    return faitage.elements(D, faitiere)
