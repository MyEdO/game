"""Le kit de toit d'ardoise (#4471) : le GLB `toit--ardoise`, les nœuds `faitiere`, `aretier` et `noue`, bâtis d'après
`donnees.py` dans le repère d'une pièce de toit (`faitage.py`). Chaque ardoise et chaque crochet est une coque close ;
rien n'y est tiré au sort : deux constructions rendent les mêmes octets."""
import faitage

ARDOISE, CROCHET = "ardoise", "crochet"


def ardoises(piece):
    """Les paires d'ardoises qui se recouvrent le long de la `piece`, et le crochet de la queue de chacune si elle en
    porte."""
    versant = faitage.VERSANT[piece]

    def batir(D, m, _):
        A, C = D["ARDOISES"][piece], D["CROCHET"]
        portee, coin, (basse, haute) = A["portee"], A["coin"], A["levee"]
        place = portee * C["place"]
        for a0, a1, u0, u1 in faitage.recouvrants(faitage.longueur(D, piece), A["nombre"], faitage.VERS_LE_BAS[piece]):
            debut = [(a0, portee - coin), (a0 + coin, portee)] if u0 == 1.0 else [(a0, portee)]
            fin = [(a1, portee - coin), (a1 - coin, portee)] if u1 == 1.0 else [(a1, portee)]
            contour = [(a0, 0.0), (a1, 0.0), *fin, *reversed(debut)]
            queues = [(a, sens) for a, u, sens in ((a0, u0, -1), (a1, u1, 1)) if u == 1.0 and piece in C["pieces"]]
            for bras in faitage.BRAS:
                faitage.plaque(m, bras, contour, lambda a, d: 0.0,
                               lambda a, d: basse + (haute - basse) * faitage.part(a, a0, a1, u0, u1), ARDOISE, versant)
                for queue, sens in queues:
                    le_long = sorted((queue - sens * C["longueur"], queue + sens * C["retour"]))
                    faitage.plaque(m, bras, [(le_long[0], place - C["largeur"] / 2), (le_long[1], place - C["largeur"] / 2),
                                             (le_long[1], place + C["largeur"] / 2), (le_long[0], place + C["largeur"] / 2)],
                                   lambda a, d: 0.0, lambda a, d: haute + C["saillie"], CROCHET, versant)
    return batir


def elements(D):
    return faitage.elements(D, ardoises)
