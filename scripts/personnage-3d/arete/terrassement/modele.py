"""Le terrassement (#4471) : le GLB `arete--terrassement`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py`
dans le repère d'une arête (`geometrie.py`). Chaque lit de terre est une coque close, à plat d'un bout à l'autre de
son tronçon ; la barrière (`menuiserie.vantail`), fermée ou ouverte d'un quart de tour, ne change que de repère. L'aléa
d'une pièce est semé de son nom : deux constructions rendent les mêmes octets."""
import math

from mathutils import Vector

import geometrie
from geometrie import DEHORS, HAUT, X, Repere
from maille import cylindre, lineaire, poutre
from menuiserie import vantail

TERRE, CLAYONNAGE, BOISAGE = "terre", "clayonnage", "boisage"


def nombre_de_lits(D):
    return round(D["HAUTEUR"] / D["TALUS"]["lit"])


def lit(D, m, alea, rang, gauche, droite):
    """Le lit de terre de rang `rang` depuis le pied, à plat entre ses bouts `gauche` et `droite` `(abscisse au pied
    du lit, abscisse à sa tête)` : une coque close, bombée à mi-hauteur, arrondie en couronnement pour le dernier. Sa
    face ondule hors du lit du pied, que tient le clayonnage, et de ses bouts, que rejoint la pièce voisine ou que
    tranche une coupure."""
    T, haut, lits = D["TALUS"], D["HAUTEUR"], nombre_de_lits(D)
    couronne = rang == lits - 1
    pied, tete = rang / lits, (rang + 1) / lits
    nombre = max(1, round((sum(droite) - sum(gauche)) / 2 / T["pas"]))
    sommets = []
    for i in range(nombre + 1):
        a_pied, a_tete = (g + (d - g) * i / nombre for g, d in zip(gauche, droite))
        ondule = T["ondulation"] if rang and 0 < i < nombre else 0.0

        def flanc(t, saillie=0.0, retrait=1.0):
            return (a_pied + (a_tete - a_pied) * (t - pied) / (tete - pied),
                    lineaire(T["profil"], t) * retrait + saillie + alea.uniform(-ondule, ondule), t * haut)
        for cote in (1, -1):
            epaule = (flanc(pied + (tete - pied) * T["epaule"][1], 0.0, T["epaule"][0]) if couronne
                      else flanc(tete))
            montee = [flanc(pied), flanc((pied + tete) / 2, T["bombe"]), epaule]
            sommets += [(a, cote * c, h) for a, c, h in (montee if cote > 0 else montee[::-1])]
            if couronne and cote > 0:
                sommets.append((a_tete, 0.0, haut))
    tour = len(sommets) // (nombre + 1)
    faces = [[i * tour + j, i * tour + (j + 1) % tour, (i + 1) * tour + (j + 1) % tour, (i + 1) * tour + j]
             for i in range(nombre) for j in range(tour)]
    faces += [list(range(tour))[::-1], [nombre * tour + j for j in range(tour)]]
    m.ajouter(sommets, faces, TERRE)


def talus(D, m, alea, a0, a1, lits):
    """La terre du talus entre les abscisses `a0` et `a1`, pour les lits de rangs `lits`."""
    for rang in lits:
        lit(D, m, alea, rang, (a0, a0), (a1, a1))


def axe_des_pieux(D):
    """L'écart (m) de l'axe des pieux à celui de l'arête : la perche qui passe devant un pieu affleure le nu du
    talus."""
    C = D["CLAYONNAGE"]
    passe = (C["section"] + C["perche"][0]) / 2
    biais = math.atan2(2 * passe, D["LONGUEUR"] / C["pieux"])
    return D["EPAISSEUR"] / 2 - C["perche"][0] / 2 * math.cos(biais) - passe


def pieux(D):
    """L'abscisse de chaque pieu d'une arête, de gauche à droite."""
    pas = D["LONGUEUR"] / D["CLAYONNAGE"]["pieux"]
    return [-D["LONGUEUR"] / 2 + pas * (k + 0.5) for k in range(D["CLAYONNAGE"]["pieux"])]


def clayonnage(D, m, a0, a1):
    """Le clayonnage du pied des deux faces entre les abscisses `a0` et `a1` : ses pieux, et ses perches tressées
    devant un pieu puis derrière le suivant, droites à chaque bout."""
    C = D["CLAYONNAGE"]
    section, (large, haut_p), axe = C["section"], C["perche"], axe_des_pieux(D)
    passe = (section + large) / 2
    plantes = [(k, x) for k, x in enumerate(pieux(D)) if a0 + C["droit"] < x < a1 - C["droit"]]
    for cote in (1, -1):
        R = Repere((0, 0, 0), X, DEHORS * cote)
        for _, x in plantes:
            R.boite(m, (x - section / 2, x + section / 2), (0.0, C["hauteur"]), (axe - section / 2, axe + section / 2),
                    CLAYONNAGE)
        for rang, h in enumerate(C["perches"]):
            chemin = [(a0, axe), (a0 + C["droit"], axe)]
            chemin += [(x, axe + (passe if (k + rang) % 2 == 0 else -passe)) for k, x in plantes]
            chemin += [(a1 - C["droit"], axe), (a1, axe)]
            for (xa, ca), (xb, cb) in zip(chemin, chemin[1:]):
                poutre(m, R.point(xa, h, ca), R.point(xb, h, cb), large, haut_p, HAUT, CLAYONNAGE)


def mur(D, m, alea):
    """Le talus plein, son clayonnage au pied."""
    demi = D["LONGUEUR"] / 2
    talus(D, m, alea, -demi, demi, range(nombre_de_lits(D)))
    clayonnage(D, m, -demi, demi)


def porte(ouverte):
    """La coupure du talus : son passage planchéié entre deux joues de planches, sous un linteau de rondins qui porte
    les lits du dessus, sa barrière fermée dans la baie ou `ouverte` d'un quart de tour vers le dedans."""
    def batir(D, m, alea):
        P, T = D["PORTE"], D["TALUS"]
        demi, nu, lits = D["LONGUEUR"] / 2, D["EPAISSEUR"] / 2, nombre_de_lits(D)
        haut = D["HAUTEUR"] * P["lits"] / lits
        demi_baie = P["baie"] * D["LONGUEUR"] / 2
        epais_j, planches, debord = P["joue"]
        section, ecart = P["poteau"]
        rondins, rayon, portee, cotes = P["linteau"]
        R = Repere((0, 0, 0), X, DEHORS)
        for cote in (-1, 1):
            bornes = tuple(sorted((cote * demi, cote * (demi_baie + epais_j))))
            talus(D, m, alea, *bornes, range(P["lits"]))
            clayonnage(D, m, *bornes)
            joue = tuple(sorted((cote * demi_baie, cote * (demi_baie + epais_j))))
            for k in range(planches):
                bas, tete = haut * k / planches, haut * (k + 1) / planches
                large = lineaire(T["profil"], (bas + tete) / 2 / D["HAUTEUR"]) + debord
                R.boite(m, joue, (bas, tete), (-large, large), BOISAGE)
            poteau = tuple(sorted((cote * (demi_baie - section / 2), cote * (demi_baie + epais_j / 2))))
            for face in (-1, 1):
                R.boite(m, poteau, (0.0, haut - 2 * rayon),
                        tuple(sorted((face * (ecart - section / 2), face * (ecart + section / 2)))), BOISAGE)
        bout = demi_baie + epais_j + portee
        for k in range(rondins):
            axe = R.point(0.0, haut - rayon, ecart * (2 * k / (rondins - 1) - 1))
            cylindre(m, -bout, bout, rayon, "x", axe, cotes, BOISAGE)
        talus(D, m, alea, -demi, demi, range(P["lits"], lits))
        S = P["plancher"]
        large = 2 * (nu + S["debord"]) / S["planches"]
        for k in range(S["planches"]):
            c = -nu - S["debord"] + k * large
            R.boite(m, (-demi_baie, demi_baie), (0.0, S["epaisseur"] + (k % 2) * S["relief"]),
                    (c + S["jeu"] / 2, c + large - S["jeu"] / 2), BOISAGE)
        V, jeu = P["barriere"], P["jeu"]
        gond = R.point(-demi_baie + jeu, 0, -V["epaisseur"] / 2)
        vantail(m, Repere(gond, -DEHORS, X) if ouverte else Repere(gond, X, DEHORS), 2 * (demi_baie - jeu),
                (P["garde"], P["hauteur"]), V)
    return batir


def tas(m, alea, S, milieu):
    """Un tas de terre tombée d'après `S` (`BRECHE["tas"]`), posé au sol autour de `milieu` : une coque close, ses
    anneaux écartés au hasard."""
    cotes, (le_long, travers) = S["cotes"], S["rayons"]
    sommets = []
    for part_h, part_r in S["anneaux"]:
        for j in range(cotes):
            angle = 2 * math.pi * j / cotes
            r = part_r * (1 + alea.uniform(-S["ecart"], S["ecart"]))
            sommets.append(milieu + X * le_long * r * math.cos(angle) + DEHORS * travers * r * math.sin(angle)
                           + HAUT * part_h * S["hauteur"])
    sommets.append(milieu + HAUT * S["hauteur"])
    anneaux, cime = len(S["anneaux"]), len(sommets) - 1
    faces = [list(range(cotes))]
    for i in range(anneaux):
        for j in range(cotes):
            a, b = i * cotes + j, i * cotes + (j + 1) % cotes
            faces.append([a + cotes, b + cotes, b, a] if i < anneaux - 1 else [cime, b, a])
    m.ajouter(sommets, faces, TERRE)


def breche(D, m, alea):
    """La brèche d'après `BRECHE` : les lits du talus à plat, tranchés par la trouée au-dessus de ceux qui restent
    entiers, un tas de terre au pied de chaque face, le clayonnage rompu, ses pieux arrachés déversés, des mottes et
    des bois épars."""
    B, C = D["BRECHE"], D["CLAYONNAGE"]
    demi, axe, section, lits = D["LONGUEUR"] / 2, axe_des_pieux(D), C["section"], nombre_de_lits(D)
    talus(D, m, alea, -demi, demi, range(B["assise"]))
    for rang in range(B["assise"], lits):
        for cote, bord in zip((-1, 1), B["trouee"]):
            tranche = tuple(lineaire(bord, t / lits) * demi + alea.uniform(-B["saccade"], B["saccade"])
                            for t in (rang, rang + 1))
            lit(D, m, alea, rang, *sorted(((cote * demi, cote * demi), tranche)))
    for cote in (1, -1):
        tas(m, alea, B["tas"], DEHORS * cote * B["tas"]["recul"])
        clayonnage(D, m, *sorted((cote * demi, cote * demi * B["rompu"])))
        for rang, devers in B["pieux"]:
            pied = Vector((pieux(D)[rang], 0.0, 0.0)) + DEHORS * cote * axe + HAUT * section / 2 * devers / C["hauteur"]
            poutre(m, pied, pied + HAUT * C["hauteur"] + DEHORS * cote * devers, section, section, X, CLAYONNAGE)
    G = B["gravats"]
    geometrie.eboulis(m, Repere((0, 0, 0), X, DEHORS), alea, G, demi,
                      lambda tirage: CLAYONNAGE if tirage.random() < G["bois"] else TERRE)


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": mur, "fenetre-close": mur,
         "breche": breche}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
