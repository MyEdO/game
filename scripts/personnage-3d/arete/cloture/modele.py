"""La clôture de clayonnage (#4471) : le GLB `arete--cloture`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py`
dans le repère d'une arête (`geometrie.py`). Chaque pieu et chaque baguette est une coque close ; la barrière, fermée
ou ouverte d'un quart de tour, ne change que de repère. L'aléa d'une pièce est semé de son nom, celui d'une porte du
kit seul, pour que la claie ne change pas quand la barrière tourne : deux constructions rendent les mêmes octets."""
import math
import random

import geometrie
from geometrie import DEHORS, DROITE, GAUCHE, X, Repere, noeud
from maille import lineaire, tube

CLAIE, PIEUX, MENUISERIE, BARRES, FER = "clayonnage", "pieux", "menuiserie", "barres", "ferrure"


class Cloture:
    """La clôture d'une arête, bâtie dans la maille `m` d'après `D` : ses cotes et ses pièces. Une abscisse `a` se
    compte du milieu de l'arête, une hauteur `h` de son pied, dans le repère `R` de l'arête."""

    def __init__(self, D, m, alea):
        self.D, self.m, self.alea, self.R = D, m, alea, Repere((0, 0, 0), X, DEHORS)
        self.A, self.P = D["APPAREIL"], D["PIEUX"]
        self.demi, self.haut, self.rayon = D["LONGUEUR"] / 2, D["HAUTEUR"], D["PIEU"] / 2
        self.fort = self.rayon * self.P["fort"]
        self.travees = math.ceil(D["LONGUEUR"] / D["ENTRAXE"])
        self.pas = D["LONGUEUR"] / self.travees
        self.axes = [-self.demi + k * self.pas for k in range(self.travees + 1)]
        tete = self.haut - self.A["couronnement"]["hauteur"]
        self.lits = round(tete / self.A["assise"])
        o, e = self.A["ondulation"] / 2, self.A["embrasse"]
        places = sorted({-self.demi, self.demi, *(a + s * e for a in self.axes[1:-1] for s in (-1, 0, 1))})
        self.bords = [[(a, k * tete / self.lits + self.ecart(a, k, o)) for a in places] for k in range(self.lits + 1)]

    def ecart(self, a, k, o):
        """Ce dont la limite sous le lit `k` s'écarte de sa place à l'abscisse `a` : rien au pied ni aux bouts de
        l'arête, où la pièce voisine la reprend ; vers le haut seulement à la tête du dernier lit."""
        if k == 0 or abs(a) == self.demi:
            return 0.0
        return self.alea.uniform(0.0 if k == self.lits else -o, o)

    def pieu(self, a, rayon, tete, moitie=0, eclat=0.0):
        """Un pieu d'axe `a`, du pied à `tete`, taillé en pointe ; `moitie` : le demi-pieu d'un bout de l'arête, vers
        les abscisses de ce signe ; `eclat` : rompu à `tete`, chaque bord de sa cassure écarté jusqu'à cette borne."""
        n = self.P["cotes"]
        angles = ([2 * math.pi * (k + 0.5) / n for k in range(n)] if not moitie else
                  [(0 if moitie > 0 else math.pi) - math.pi / 2 + math.pi * k / (n // 2) for k in range(n // 2 + 1)])
        if eclat:
            anneaux = [[(0.0, 1.0)] * len(angles), [(tete + self.alea.uniform(-eclat, eclat), 1.0) for _ in angles]]
        else:
            anneaux = [[(h, part)] * len(angles)
                       for h, part in ((0.0, 1.0), (tete - self.P["pointe"], 1.0), (tete, self.P["meplat"]))]
        sommets = [self.R.point(a + rayon * part * math.cos(t), h, rayon * part * math.sin(t))
                   for anneau in anneaux for t, (h, part) in zip(angles, anneau)]
        k, rangs = len(angles), len(anneaux)
        faces = [list(range(k)), [(rangs - 1) * k + i for i in range(k)]]
        faces += [[r * k + i, r * k + (i + 1) % k, (r + 1) * k + (i + 1) % k, (r + 1) * k + i]
                  for r in range(rangs - 1) for i in range(k)]
        self.m.ajouter(sommets, faces, PIEUX)

    def courant(self, a):
        """Un pieu courant d'axe `a`, sa tête un peu sous celle de la clôture."""
        self.pieu(a, self.rayon, self.haut - self.alea.uniform(0.0, self.P["chute"]))

    def bouts(self, cotes=(-1, 1)):
        """Le demi-pieu de chaque bout de l'arête, que complète celui de la pièce voisine."""
        for s in cotes:
            self.pieu(s * self.demi, self.rayon, self.haut, moitie=-s)

    def rang(self, a):
        """Le rang du pieu d'axe `a` le long de la clôture : une baguette passe devant un pieu de rang pair et
        derrière le suivant, la baguette du lit voisin à contre-sens."""
        return round((a + self.demi) / self.pas)

    def baguette(self, lit, a, pieux):
        """La baguette du lit `lit` entre les abscisses `a`, tressée sur les `pieux` [(axe, rayon)] : plaquée contre
        chacun sur `embrasse`, d'un côté puis de l'autre ; ses limites sont celles de son lit (`bords`)."""
        epais, e, r = self.D["BAGUETTE"], self.A["embrasse"], self.A["recouvrement"]
        trace = [(axe + s * e, (-1) ** (self.rang(axe) + lit) * (rayon + epais / 2))
                 for axe, rayon in sorted(pieux) for s in (-1, 1)]
        places = sorted({*a, *(x for x, _ in trace if a[0] < x < a[1])})
        sommets = []
        for x in places:
            c = lineaire(trace, x)
            bas = max(lineaire(self.bords[lit], x) - r, 0.0)
            tete = lineaire(self.bords[lit + 1], x) + r
            sommets += [self.R.point(x, tete, c), self.R.point(x, (bas + tete) / 2, c + epais / 2),
                        self.R.point(x, bas, c), self.R.point(x, (bas + tete) / 2, c - epais / 2)]
        dernier = 4 * (len(places) - 1)
        faces = [[0, 1, 2, 3], [dernier + 3, dernier + 2, dernier + 1, dernier]]
        faces += [[i + j, i + (j + 1) % 4, i + 4 + (j + 1) % 4, i + 4 + j] for i in range(0, dernier, 4)
                  for j in range(4)]
        self.m.ajouter(sommets, faces, CLAIE)

    def claie(self, a, pieux):
        """Tous les lits de la claie entre les abscisses `a`, tressés sur les `pieux` [(axe, rayon)]."""
        for lit in range(self.lits):
            self.baguette(lit, a, pieux)


def mur(D, m, alea):
    """La clôture pleine : ses pieux, les demi-pieux de ses bouts et sa claie."""
    C = Cloture(D, m, alea)
    C.bouts()
    for a in C.axes[1:-1]:
        C.courant(a)
    C.claie((-C.demi, C.demi), [(a, C.rayon) for a in C.axes])


def barriere(m, R, largeur, h, B):
    """La barrière d'après `B` (`PORTE["barriere"]`) dans le repère `R` de son gond : large de `largeur` depuis lui,
    entre les hauteurs `h`, son parement vers la normale du repère, son écharpe au dos."""
    epais, montant = B["epaisseur"], B["montants"]
    for a in ((0, montant), (largeur - montant, largeur)):
        R.boite(m, a, h, (0, epais), MENUISERIE)
    haut_l, retrait = B["section"]
    axes = [h[0] + (h[1] - h[0]) * part for part in B["lisses"]]
    for axe in axes:
        R.boite(m, (montant, largeur - montant), (axe - haut_l / 2, axe + haut_l / 2), (retrait, epais - retrait),
                MENUISERIE)
    large_e, epais_e = B["echarpe"]
    R.poutre(m, (montant, axes[0]), (largeur - montant, axes[-1]), large_e, (-epais_e, retrait), BARRES)
    long, haut_p, epais_p, depasse = B["pentures"]
    for axe in (axes[0], axes[-1]):
        R.boite(m, (-depasse, long), (axe - haut_p / 2, axe + haut_p / 2), (epais, epais + epais_p), FER)
    long, haut_q, epais_q, part = B["loquet"]
    axe = h[0] + (h[1] - h[0]) * part
    R.boite(m, (largeur - long, largeur), (axe - haut_q / 2, axe + haut_q / 2), (epais, epais + epais_q), FER)


def porte(ouverte, position=None):
    """Le passage entre deux pieux forts, sur son seuil, sa barrière fermée ou `ouverte` d'un quart de tour vers le
    dedans. À la `position` d'une ouverture de deux arêtes, le passage file jusqu'au bout de l'arête que l'ouverture
    continue, sans pieu, et la barrière se gonde au pieu fort du bout extérieur, à un demi-jeu de sa voisine."""
    def batir(D, m, _):
        C, P = Cloture(D, m, random.Random(f"{D['KIT']}/porte")), D["PORTE"]
        baie, jeu = P["baie"] * D["LONGUEUR"] / 2, P["jeu"]
        passage = []
        for s in (-1, 1):
            if position == (GAUCHE if s > 0 else DROITE):
                passage.append((s * C.demi, jeu / 2))
                continue
            C.bouts((s,))
            courants = [a for a in C.axes[1:-1] if abs(a) > baie + C.pas / 2 and a * s > 0]
            for a in courants:
                C.courant(a)
            C.pieu(s * baie, C.fort, C.haut)
            C.claie(tuple(sorted((s * C.demi, s * baie))),
                    [(s * C.demi, C.rayon), *((a, C.rayon) for a in courants), (s * baie, C.fort)])
            passage.append((s * (baie - C.fort), jeu))
        haut_s, large_s = P["seuil"]
        (gauche, jeu_gauche), (droite, jeu_droite) = passage
        C.R.boite(m, (gauche, droite), (0, haut_s), (-large_s / 2, large_s / 2), PIEUX)
        sens = -1 if position == DROITE else 1
        gauche, droite = gauche + jeu_gauche, droite - jeu_droite
        B = P["barriere"]
        gond = C.R.point(gauche if sens > 0 else droite, 0, -B["epaisseur"] / 2)
        barriere(m, Repere(gond, -DEHORS, sens * X) if ouverte else Repere(gond, sens * X, DEHORS), droite - gauche,
                 (P["garde"], P["hauteur"]), B)
    return batir


def breche(D, m, alea):
    """La brèche : la claie arrachée d'après `BRECHE`, le bout libre de ses baguettes affaissé, ses pieux rompus, un
    pieu et des baguettes couchés au pied."""
    C, B = Cloture(D, m, alea), D["BRECHE"]
    C.bouts()

    def x(part):
        return part * C.demi
    rompus = [(x(part), C.haut * h) for part, h in B["rompus"]]
    for a, h in rompus:
        C.pieu(a, C.rayon, h, eclat=B["eclat"])
    for s, portees in zip((-1, 1), B["portees"]):
        for lit in range(C.lits):
            milieu = (lit + 0.5) * C.A["assise"]
            bout = x(lineaire(portees, milieu / C.haut)) + alea.uniform(-B["frange"], B["frange"])
            tenue = [(a, C.rayon) for a, h in rompus if a * s > 0 and h > milieu and abs(a) < abs(bout)]
            debut = len(m.v)
            C.baguette(lit, tuple(sorted((s * C.demi, bout))), [(s * C.demi, C.rayon), *tenue])
            libre = slice(len(m.v) - 4, len(m.v)) if s < 0 else slice(debut, debut + 4)
            chute = min(alea.uniform(0.0, B["affaissement"]), min(pz for _, _, pz in m.v[libre]))
            travers = alea.uniform(-B["affaissement"], B["affaissement"])
            m.v[libre] = [(px, py + travers, pz - chute) for px, py, pz in m.v[libre]]
    depart, arrivee = B["couche"]
    tube(m, [C.R.point(x(depart[0]), C.rayon, -depart[1]), C.R.point(x(arrivee[0]), C.rayon, -arrivee[1])], C.rayon,
         C.P["cotes"], PIEUX)
    epais, large = D["BAGUETTE"], B["claie"]["largeur"]
    for depart, arrivee in B["claie"]["bouts"]:
        C.R.poutre(m, (x(depart[0]), epais / 2), (x(arrivee[0]), epais / 2), epais, (-large / 2, large / 2), CLAIE)
        m.v[-8:] = [(px, py + (depart[1] if k < 4 else arrivee[1]), pz) for k, (px, py, pz) in enumerate(m.v[-8:])]
    geometrie.eboulis(m, C.R, alea, B["gravats"], C.demi)


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": mur, "fenetre-close": mur,
         "breche": breche,
         **{noeud(piece, position): porte(ouverte, position)
            for piece, ouverte in (("porte-fermee", False), ("porte-ouverte", True))
            for position in (GAUCHE, DROITE)}}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
