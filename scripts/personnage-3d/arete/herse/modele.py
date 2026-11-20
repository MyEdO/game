"""La herse (#4471) : le GLB `arete--herse`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans le repère
d'une arête (`geometrie.py`). `mur` est la grille baissée, `breche` la grille arrachée ; chacune existe seule sur son
arête et en bouts gauche et droit d'une ouverture de deux arêtes. Une herse ne s'ouvre ni ne se perce : ses portes et
ses fenêtres sont la grille. L'aléa d'une pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import DEHORS, DROITE, GAUCHE, HAUT, X, Repere, noeud
from maille import poutre, tour

BARREAU, TRAVERSE, FERRURE = "barreau", "traverse", "ferrure"

MONTANTS = {None: (-1, 1), GAUCHE: (-1,), DROITE: (1,)}
"""Par position, les bouts de l'arête qui portent un montant."""


def pan_couche(m, alea, D):
    """Le pan de grille arraché, couché au sol devant la herse d'après `BRECHE["pan"]`."""
    G, P = D["GRILLE"], D["BRECHE"]["pan"]
    section, (haut_t, epais_t) = G["section"], G["plat"]
    pas, demi = D["LONGUEUR"] / G["barreaux"], D["LONGUEUR"] / 2
    biais = math.radians(alea.uniform(-P["biais"], P["biais"]))
    le_long = Vector((math.sin(biais), -math.cos(biais), 0.0))
    travers = Vector((math.cos(biais), math.sin(biais), 0.0))
    milieu = X * demi * alea.uniform(-P["ecart"], P["ecart"]) + DEHORS * P["recul"]
    pente = HAUT * P["levee"] / P["longueur"]

    def lieu(a, t):
        """Le point de l'axe du pan à `a` de son milieu le long des barreaux et à `t` en travers."""
        return milieu + le_long * a + travers * t + HAUT * section / 2 + pente * (P["longueur"] / 2 - a)

    demi_large = (P["barreaux"] - 1) / 2 * pas
    for k in range(P["barreaux"]):
        t = k * pas - demi_large
        poutre(m, lieu(-P["longueur"] / 2, t), lieu(P["longueur"] / 2, t), section, section, HAUT, BARREAU)
    for part in P["traverses"]:
        a = (part - 0.5) * P["longueur"]
        dessus = HAUT * (section + epais_t) / 2
        poutre(m, lieu(a, -demi_large - pas / 2) + dessus, lieu(a, demi_large + pas / 2) + dessus, haut_t, epais_t,
               HAUT, TRAVERSE)


def grille(abattue, position=None):
    """La herse à la `position` de son ouverture : ses montants, sa tête, ses barreaux à pointe et ses traverses
    rivetées, ou, `abattue`, ses barreaux rompus sous la tête et un pan de grille au sol."""
    def batir(D, m, alea):
        G, B = D["GRILLE"], D["BRECHE"]
        demi, haut, nu = D["LONGUEUR"] / 2, D["HAUTEUR"], D["EPAISSEUR"] / 2
        R = Repere((0, 0, 0), X, DEHORS)
        section, (haut_t, epais_t), rivet = G["section"], G["plat"], G["rivet"] / 2
        large, epais_m = G["montant"]
        plat, tete = section / 2 + epais_t, haut - G["tete"]
        cotes = MONTANTS[position]
        for cote in cotes:
            R.boite(m, tuple(sorted((cote * demi, cote * (demi - large)))), (0.0, haut), (-epais_m / 2, epais_m / 2),
                    BARREAU)
        R.boite(m, (-demi, demi), (tete, haut), (-plat, plat), TRAVERSE)
        pas = D["LONGUEUR"] / G["barreaux"]
        axes = [-demi + pas * (k + 0.5) for k in range(G["barreaux"])]
        barreaux = [x for x in axes if all(cote * x < demi - large - section / 2 for cote in cotes)]
        rangs = [] if abattue else [part * haut for part in G["traverses"]]
        rives = (-demi + large if -1 in cotes else -demi, demi - large if 1 in cotes else demi)
        for h in rangs:
            for face in (-1, 1):
                R.boite(m, rives, (h - haut_t / 2, h + haut_t / 2), tuple(sorted((face * section / 2, face * plat))),
                        TRAVERSE)
        for x in barreaux + [cote * (demi - large / 2) for cote in cotes]:
            for h in rangs + [(tete + haut) / 2]:
                for face in (-1, 1):
                    R.boite(m, (x - rivet, x + rivet), (h - rivet, h + rivet), tuple(sorted((face * plat, face * nu))),
                            FERRURE)
        P = G["pointe"]
        for x in barreaux:
            if abattue:
                if alea.random() < B["tiennent"]:
                    R.boite(m, (x - section / 2, x + section / 2), (tete - alea.uniform(*B["longueur"]), tete + 0.01),
                            (-section / 2, section / 2), BARREAU)
                continue
            R.boite(m, (x - section / 2, x + section / 2), (P["hauteur"] - 0.02, tete + 0.01),
                    (-section / 2, section / 2), BARREAU)
            tour(m, [(0.0, 0), (P["epaule"], P["rayon"]), (P["hauteur"], section / 2), (P["hauteur"], 0)], "z",
                 (x, 0.0, 0.0), 4, FERRURE)
        if abattue:
            x, depart = barreaux[len(barreaux) // 2], Vector((0.0, 0.0, tete))
            for dehors, chute in B["tordu"]:
                arrivee = Vector((0.0, 0.0, tete)) + DEHORS * dehors - HAUT * chute
                poutre(m, X * x + depart, X * x + arrivee, section, section, X, BARREAU)
                depart = arrivee
            pan_couche(m, alea, D)
            geometrie.eboulis(m, R, alea, B["gravats"], demi, lambda tirage: tirage.choice((BARREAU, TRAVERSE)))
    return batir


BATIR = {
    **{noeud(piece, position): grille(abattue, position)
       for piece, abattue in (("mur", False), ("breche", True)) for position in (None, GAUCHE, DROITE)},
    **{piece: grille(False) for piece in ("porte-fermee", "porte-ouverte", "fenetre", "fenetre-close")},
}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
