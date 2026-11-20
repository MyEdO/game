"""Le mur de pierres sèches (#4471) : le GLB `arete--pierres-seches`, un nœud par pièce de `BATIR`, bâti d'après
`donnees.py` dans le repère d'une arête (`geometrie.py`) par l'appareil de `maconnerie`. Chaque pierre est une coque
close ; le portillon (`menuiserie.vantail`), fermé ou ouvert d'un quart de tour, ne change que de repère. L'aléa
d'une pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import geometrie
from geometrie import DEHORS, X, Repere
from maconnerie import Appareil
from menuiserie import vantail


def mur(D, m, alea):
    """Le muret plein sous son couronnement."""
    A = Appareil(D, m, alea)
    A.mur((-A.demi, A.demi), (0.0, A.haut))


def porte(ouverte):
    """Le passage, son portillon fermé dans la baie ou `ouverte` d'un quart de tour vers le dedans."""
    def batir(D, m, alea):
        A, P = Appareil(D, m, alea), D["PORTE"]
        demi_baie, jeu, V = P["baie"] * D["LONGUEUR"] / 2, P["jeu"], P["portillon"]
        A.mur((-A.demi, -demi_baie), (0.0, A.haut))
        A.mur((demi_baie, A.demi), (0.0, A.haut))
        gond = A.R.point(-demi_baie + jeu, 0, -V["epaisseur"] / 2)
        vantail(m, Repere(gond, -DEHORS, X) if ouverte else Repere(gond, X, DEHORS), 2 * (demi_baie - jeu),
                (P["garde"], P["hauteur"]), V)
    return batir


def breche(D, m, alea):
    """La brèche : le muret éboulé d'après `BRECHE`, ses pierres au pied."""
    A, B = Appareil(D, m, alea), D["BRECHE"]
    A.breche(B["contour"], B["plancher"])
    geometrie.eboulis(m, A.R, alea, B["gravats"], A.demi)


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": mur, "fenetre-close": mur,
         "breche": breche}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
