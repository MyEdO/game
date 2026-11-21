"""L'escalier de pierre (#4471) : le GLB `escalier--pierre`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py`
dans le repère d'une pièce d'escalier (`volee.py`), à plat, par l'appareil de `maconnerie`. Chaque pierre est une coque
close. L'aléa d'une pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import volee
from maconnerie import Appareil

CHAPERON = "chaperon"
BOUTS_TAILLES = (True, True)
"""Chaque bout de la case porte une chaîne de pierres de taille (`maconnerie.Appareil.rang`)."""


def appareil(D, m, alea, P):
    """L'appareil (`maconnerie.Appareil`) de la pièce de cotes `P` (`hauteur`, `epaisseur`, `appareil`), d'un bout à
    l'autre de la case, bâti à cheval sur le plan du bord."""
    return Appareil({"KIT": D["KIT"], "LONGUEUR": D["LONGUEUR"], "HAUTEUR": P["hauteur"],
                     "EPAISSEUR": P["epaisseur"], "APPAREIL": P["appareil"]}, m, alea)


def limon(D, m, alea):
    """Le limon : une assise de pierres de taille, son parement du dedans au plan du bord."""
    A = appareil(D, m, alea, D["LIMON"])
    A.mur((-A.demi, A.demi), (0.0, A.haut), BOUTS_TAILLES)
    volee.poser(m, 0, 0.0, A.nu)


def rampe(D, m, alea):
    """La rampe : le mur d'échiffre monté sur le limon, en retrait du plan du bord, et son chaperon de dalles, une
    demi-dalle à chaque bout de la case."""
    P, socle = D["RAMPE"], D["LIMON"]["hauteur"]
    A = appareil(D, m, alea, P)
    A.mur((-A.demi, A.demi), (0.0, A.haut), BOUTS_TAILLES)
    volee.poser(m, 0, socle, P["retrait"] + A.nu)
    C = P["chaperon"]
    pied, tete = socle + A.haut, socle + A.haut + C["hauteur"]
    dedans, dehors = P["retrait"] - C["debord"], P["retrait"] + P["epaisseur"] + C["debord"]
    milieu = (dedans + dehors) / 2
    section = [(pied, dedans), (pied + C["rive"], dedans), (tete, milieu - C["faite"]), (tete, milieu + C["faite"]),
               (pied + C["rive"], dehors), (pied, dehors)]
    dalles = round(D["LONGUEUR"] / C["dalle"])
    bornes = [-A.demi, *(-A.demi + (k + 0.5) * D["LONGUEUR"] / dalles for k in range(dalles)), A.demi]
    for gauche, droite in zip(bornes, bornes[1:]):
        volee.profil(m, (gauche + (C["joint"] / 2 if gauche > -A.demi else 0.0),
                         droite - (C["joint"] / 2 if droite < A.demi else 0.0)), section, CHAPERON)


BATIR = {"limon": limon, "rampe": rampe}


def elements(D):
    return volee.elements(D, BATIR)
