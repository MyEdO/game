"""Le mur de moellons maçonnés (#4471) : le GLB `arete--moellons`, un nœud par pièce de `BATIR`, bâti d'après
`donnees.py` dans le repère d'une arête (`geometrie.py`) par l'appareil de `maconnerie`. Chaque pierre est une coque
close ; un vantail (`menuiserie.vantail`), fermé ou ouvert d'un quart de tour, ne change que de repère. L'aléa d'une
pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import geometrie
from geometrie import DEHORS, DROITE, GAUCHE, X, Repere, noeud
from maconnerie import PIERRE, Appareil
from menuiserie import PORTE_DE_PLANCHES, croisee, vantail, volets


def mur(D, m, alea):
    """Le mur plein, une chaîne à chaque bout."""
    A = Appareil(D, m, alea)
    A.mur((-A.demi, A.demi), (0.0, A.haut), (True, True))


def baie(A, demi_baie, pied, tete, linteau):
    """Le mur autour d'une baie de demi-largeur `demi_baie` ouverte de `pied` à `tete` : ses assises pleines sous
    elle, ses piédroits harpés, son `linteau` (hauteur, portée) de taille et le mur qui le charge."""
    haut_l, portee = linteau
    if pied > 0:
        A.mur((-A.demi, A.demi), (0.0, pied), (True, True))
    A.mur((-A.demi, -demi_baie), (pied, tete), (True, True))
    A.mur((demi_baie, A.demi), (pied, tete), (True, True))
    A.mur((-A.demi, -demi_baie - portee), (tete, tete + haut_l), (True, False))
    A.mur((demi_baie + portee, A.demi), (tete, tete + haut_l), (False, True))
    A.ame((-demi_baie - portee, demi_baie + portee), (tete, tete + haut_l))
    A.pierre((-demi_baie - portee, demi_baie + portee), (tete, tete + haut_l), A.A["taille"])
    A.mur((-A.demi, A.demi), (tete + haut_l, A.haut), (True, True))


def porte(ouverte):
    """La porte, son vantail fermé dans la baie ou `ouverte` d'un quart de tour vers le dedans."""
    def batir(D, m, alea):
        A, P, V = Appareil(D, m, alea), D["PORTE"], PORTE_DE_PLANCHES
        demi_baie, jeu = P["baie"] * D["LONGUEUR"] / 2, P["jeu"]
        baie(A, demi_baie, 0.0, P["hauteur"], P["linteau"])
        A.R.boite(m, (-demi_baie, demi_baie), (0.0, P["seuil"]), (-A.nu, A.nu), PIERRE)
        gond = A.R.point(-demi_baie + jeu, 0, -V["epaisseur"] / 2)
        vantail(m, Repere(gond, -DEHORS, X) if ouverte else Repere(gond, X, DEHORS), 2 * (demi_baie - jeu),
                (P["seuil"] + jeu, P["hauteur"] - jeu), V)
    return batir


def portail(ouverte, cote):
    """L'arête de bout d'un portail de deux arêtes, celle de gauche (`cote` -1) ou de droite (1) : son piédroit, sa
    moitié du porche, et son vantail gondé au piédroit, sa tête cintrée sous l'arc, fermé ou `ouverte` d'un quart de
    tour vers le dedans."""
    def batir(D, m, alea):
        A, P = Appareil(D, m, alea), D["PORTAIL"]
        A.porte_cintree(-cote * A.demi, (cote,), P["porche"], P["seuil"], P["jeu"], P["vantail"], ouverte)
    return batir


def fenetre(close):
    """La fenêtre : sa baie entre un appui saillant et un linteau, sa croisée, ses volets rabattus sur le dehors ou
    `close`, fermés devant elle."""
    def batir(D, m, alea):
        A, F = Appareil(D, m, alea), D["FENETRE"]
        demi_baie = F["baie"] * D["LONGUEUR"] / 2
        haut_a, saillie = F["pierre_d_appui"]
        baie(A, demi_baie, F["appui"] - haut_a, F["tete"], F["linteau"])
        A.R.boite(m, (-demi_baie, demi_baie), (F["appui"] - haut_a, F["appui"]), (-A.nu, A.nu + saillie), PIERRE)
        croisee(m, A.R, demi_baie, F["appui"], F["tete"])
        volets(m, A.R, demi_baie, (F["appui"] + F["jour"], F["tete"] + F["recouvrement"]), A.nu, close)
    return batir


def breche(D, m, alea):
    """La brèche : le mur éventré d'après `BRECHE`, ses pierres tombées au pied."""
    A, B = Appareil(D, m, alea), D["BRECHE"]
    A.breche(B["contour"], B["plancher"])
    geometrie.eboulis(m, A.R, alea, B["gravats"], A.demi, lambda _: PIERRE)


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": fenetre(False),
         "fenetre-close": fenetre(True), "breche": breche,
         **{noeud(piece, position): portail(ouverte, cote)
            for piece, ouverte in (("porte-fermee", False), ("porte-ouverte", True))
            for position, cote in ((GAUCHE, -1), (DROITE, 1))}}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
