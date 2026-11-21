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


def rampe(bouts):
    """La rampe : le mur d'échiffre monté sur le limon, en retrait du plan du bord, et son chaperon de dalles, une
    demi-dalle à chaque bout de la case qu'elle raccorde. À chacun des `bouts` (`volee.BOUTS`), un pilier termine le
    mur et le chaperon : son dé de pierres de taille, sa dalle et sa pointe."""
    def batir(D, m, alea):
        P, T, socle = D["RAMPE"], D["PILIER"], D["LIMON"]["hauteur"]
        A = appareil(D, m, alea, P)
        gauche, droite = (s * (A.demi - (T["cote"] if s in bouts else 0.0)) for s in (-1, 1))
        A.mur((gauche, droite), (0.0, A.haut), tuple(s not in bouts for s in (-1, 1)))
        volee.poser(m, 0, socle, P["retrait"] + A.nu)
        C = P["chaperon"]
        pied, tete = socle + A.haut, socle + A.haut + C["hauteur"]
        dedans, dehors = P["retrait"] - C["debord"], P["retrait"] + P["epaisseur"] + C["debord"]
        milieu = (dedans + dehors) / 2
        section = [(pied, dedans), (pied + C["rive"], dedans), (tete, milieu - C["faite"]),
                   (tete, milieu + C["faite"]), (pied + C["rive"], dehors), (pied, dehors)]
        dalles = round(D["LONGUEUR"] / C["dalle"])
        joints = [a for a in (-A.demi + (k + 0.5) * D["LONGUEUR"] / dalles for k in range(dalles))
                  if gauche < a < droite]
        for debut, fin in zip([gauche, *joints], [*joints, droite]):
            volee.profil(m, (debut + (C["joint"] / 2 if debut > gauche else 0.0),
                             fin - (C["joint"] / 2 if fin < droite else 0.0)), section, CHAPERON)
        epaisseur, hauteur, retrait = T["couronne"]
        for s in bouts:
            a = tuple(sorted((s * A.demi, s * (A.demi - T["cote"]))))
            depuis = len(m.v)
            de = appareil(D, m, alea, {"hauteur": T["hauteur"], "epaisseur": T["cote"],
                                       "appareil": D["LIMON"]["appareil"]})
            de.pan(a, (0.0, de.haut), (s < 0, s > 0))
            volee.poser(m, depuis, socle, de.nu)
            dessus = socle + de.haut
            volee.REPERE.boite(m, a, (dessus, dessus + epaisseur), (0.0, T["cote"]), CHAPERON)
            volee.pointe(m, a, (dessus + epaisseur, dessus + epaisseur + hauteur), (0.0, T["cote"]), retrait,
                         CHAPERON)
    return batir


BATIR = {"limon": limon, **volee.a_chaque_position("rampe", rampe)}


def elements(D):
    return volee.elements(D, BATIR)
