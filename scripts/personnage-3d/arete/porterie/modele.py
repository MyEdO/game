"""La porterie (#4471) : le GLB `arete--porterie`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans le
repère d'une arête (`geometrie.py`) par l'appareil de `maconnerie`. `mur` est la porte close, `breche` la porte
abattue ; chacune existe seule sur son arête et en moitiés gauche et droite d'une ouverture de deux arêtes. L'aléa
d'une pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import geometrie
from geometrie import DEHORS, DROITE, GAUCHE, X, Repere, biais, noeud
from maconnerie import PIERRE, Appareil
from menuiserie import FER, MENUISERIE, vantail

MOITIES = {None: (0, (-1, 1)), GAUCHE: (1, (-1,)), DROITE: (-1, (1,))}
"""Par position, l'abscisse de la clef du porche (en demi-longueurs d'arête) et les côtés qu'en porte l'arête."""


def porte(abattue, position=None):
    """La porte de ville à la `position` de son ouverture : son porche, puis sa herse baissée devant ses vantaux
    clos, ou leurs restes si elle est `abattue`."""
    def batir(D, m, alea):
        A, H, C, B = Appareil(D, m, alea), D["HERSE"], D["VANTAUX"], D["BRECHE"]
        V = D["PORCHES"]["ouverture" if position else None]
        axe, cotes = MOITIES[position][0] * A.demi, MOITIES[position][1]
        intrados = A.porche(axe, cotes, V)
        portee, naissance, T = V["portee"], V["naissance"], C["vantail"]
        tete = H["tete"] * (naissance + V["fleche"])
        nombre = max(1, round(portee * H["barreaux"] / D["LONGUEUR"]))
        devant = (H["axe"], H["axe"] + H["section"])
        for cote in cotes:
            for k in range(nombre):
                x = axe + cote * portee * (k + 0.5) / nombre
                h = (0.0, min(tete, intrados(x) + C["prise"]))
                if abattue:
                    if alea.random() > B["tiennent"]:
                        continue
                    h = (h[1] - alea.uniform(*B["longueur"]), h[1])
                A.R.boite(m, (x - H["section"] / 2, x + H["section"] / 2), h, devant, FER)
            large = tuple(sorted((axe, axe + cote * (portee + C["ancrage"]))))
            for part in H["traverses"][1:] if abattue else H["traverses"]:
                haut_t, epais_t = H["traverse"]
                A.R.boite(m, large, (part * tete - haut_t / 2, part * tete + haut_t / 2),
                          (devant[0] - epais_t, devant[0]), FER)
            gond = A.R.point(axe + cote * (portee + C["ancrage"]), 0, -T["epaisseur"])
            repere = Repere(gond, -cote * X, DEHORS)
            if abattue:
                planches, hauteur = B["planches"]
                pas = (portee + C["ancrage"]) / T["planches"]
                for k in range(planches):
                    repere.boite(m, (k * pas, (k + 1) * pas), (0.0, naissance * alea.uniform(*hauteur)),
                                 (0, T["epaisseur"]), MENUISERIE)
                continue
            vantail(m, repere, portee + C["ancrage"], (0.0, naissance), T)
            pas = [axe + cote * portee * k / V["claveaux"] for k in range(V["claveaux"] + 1)]
            for g, d in zip(sorted(pas), sorted(pas)[1:]):
                biais(m, (g, d), (naissance, intrados(g) + C["prise"]), (naissance, intrados(d) + C["prise"]),
                      (-T["epaisseur"], 0.0), MENUISERIE)
        if abattue:
            G = B["gravats"]
            geometrie.eboulis(m, A.R, alea, G, A.demi,
                              lambda tirage: FER if tirage.random() < G["fer"] else MENUISERIE)
    return batir


BATIR = {noeud(piece, position): porte(abattue, position)
         for piece, abattue in (("mur", False), ("breche", True)) for position in (None, GAUCHE, DROITE)}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
