"""Le colombage (#4471) : le GLB `arete--colombage`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans le
repère d'une arête (`geometrie.py`). Chaque bois est une boîte close (`Repere.boite`) ou une pièce de biais
(`Repere.poutre`) ; le torchis, en retrait, s'arrête dans le bois qui l'encadre. Un vantail, de porte ou de volet, se
bâtit dans le repère de son gond (`menuiserie.vantail`) : fermé, ouvert d'un quart de tour ou rabattu à plat, il ne
change que de repère. L'aléa de la brèche est semé du nom de la pièce : deux constructions rendent les mêmes octets."""
import math

import geometrie
from geometrie import DEHORS, X, Repere
from maille import lineaire
from menuiserie import PORTE_DE_PLANCHES, croisee, vantail, volets

BOIS, TORCHIS = "ossature", "torchis"


class Pan:
    """Le pan de bois d'une arête, bâti dans la maille `m` d'après `D` : ses cotes et ses pièces. Une abscisse `a` se
    compte du milieu de l'arête, une hauteur `h` de son pied, dans le repère `R` de l'arête."""

    def __init__(self, D, m):
        self.D, self.m, self.R = D, m, Repere((0, 0, 0), X, DEHORS)
        S, bois = D["SECTIONS"], D["BOIS"]
        self.demi, self.haut, self.nu = D["LONGUEUR"] / 2, D["HAUTEUR"], D["EPAISSEUR"] / 2
        self.poteau, self.echarpe, self.traverse = (bois * S[nom] for nom in ("poteau", "echarpe", "traverse"))
        self.pied, self.tete = bois * S["sole"], self.haut - bois * S["sabliere"]
        self.linteau = bois * S["linteau"]
        self.axes = [self.haut * part for part in D["TRAVERSES"]]
        travees = math.ceil(D["LONGUEUR"] / D["ENTRAXE"])
        self.poteaux = [-self.demi + k * D["LONGUEUR"] / travees for k in range(travees + 1)]
        self.bout = self.demi - self.poteau / 4

    def epais(self, retrait=0.0):
        """Les bornes, dans l'épaisseur, d'une pièce dont chaque face recule de `retrait` sous le nu du bois."""
        return (retrait - self.nu, self.nu - retrait)

    def registres(self):
        """Le jour (pied, tête) de chaque registre, entre la sole, les entretoises et la sablière."""
        bords = [self.pied, *(h + s * self.traverse / 2 for h in self.axes for s in (-1, 1)), self.tete]
        return list(zip(bords[::2], bords[1::2]))

    def travees(self):
        """Le jour (gauche, droite) de chaque travée, entre deux poteaux."""
        return [(g + self.poteau / 2, d - self.poteau / 2) for g, d in zip(self.poteaux, self.poteaux[1:])]

    def bois(self, a, h, retrait=0.0):
        self.R.boite(self.m, a, h, self.epais(retrait), BOIS)

    def sole(self, a):
        self.bois(a, (0, self.pied))

    def sabliere(self):
        self.bois((-self.demi, self.demi), (self.tete, self.haut))

    def montant(self, a, h):
        """Un poteau d'axe `a`, entre les hauteurs `h`."""
        self.bois((a - self.poteau / 2, a + self.poteau / 2), h)

    def demi_poteaux(self):
        """Le demi-poteau de chaque bout de l'arête, que complète celui du pan voisin."""
        for s in (-1, 1):
            self.bois(tuple(sorted((s * self.demi, s * (self.demi - self.poteau / 2)))), (self.pied, self.tete))

    def entretoise(self, axe, a):
        self.bois(a, (axe - self.traverse / 2, axe + self.traverse / 2), self.D["RETRAITS"]["traverse"])

    def torchis(self, a, h):
        self.R.boite(self.m, a, h, self.epais(self.D["RETRAITS"]["torchis"]), TORCHIS)

    def croix(self, a, h):
        """Les écharpes du panneau de jour `a` × `h` (`ECHARPES`)."""
        for bouts, retrait in zip(self.D["ECHARPES"].get(self.D["CROIX"], ()), self.D["RETRAITS"]["echarpes"]):
            depart, arrivee = ((a[0] + pa * (a[1] - a[0]), h[0] + ph * (h[1] - h[0])) for pa, ph in bouts)
            self.R.poutre(self.m, depart, arrivee, self.echarpe, self.epais(retrait), BOIS)

    def croix_des_registres(self, sauf=()):
        for rang in self.D["CROIX_AUX_RANGS"]:
            if rang not in sauf:
                for a in self.travees():
                    self.croix(a, self.registres()[rang])

    def cadre(self):
        """La sablière et les demi-poteaux, que toute pièce garde."""
        self.sabliere()
        self.demi_poteaux()

    def biais(self, a, h_gauche, h_droite, retrait, mat):
        geometrie.biais(self.m, a, h_gauche, h_droite, self.epais(retrait), mat)


def mur(D, m, _):
    """Le pan plein : sole, sablière, poteaux, entretoises, torchis et écharpes."""
    P = Pan(D, m)
    P.cadre()
    P.sole((-P.demi, P.demi))
    for a in P.poteaux[1:-1]:
        P.montant(a, (P.pied, P.tete))
    for axe in P.axes:
        P.entretoise(axe, (-P.bout, P.bout))
    P.torchis((-P.bout, P.bout), (P.pied / 2, (P.tete + P.haut) / 2))
    P.croix_des_registres()


def porte(ouverte):
    """La porte, son vantail fermé dans la baie ou `ouverte` d'un quart de tour vers le dedans."""
    def batir(D, m, _):
        P, B = Pan(D, m), D["PORTE_DE_PAN"]
        baie = D["BAIE_DE_PORTE"] * D["LONGUEUR"] / 2
        huisserie, tete = baie + P.poteau / 2, B["hauteur"] + P.linteau
        P.cadre()
        for s in (-1, 1):
            cote = tuple(sorted((s * P.bout, s * huisserie)))
            P.sole(tuple(sorted((s * P.demi, s * baie))))
            P.montant(s * huisserie, (P.pied, P.tete))
            P.torchis(cote, (P.pied / 2, (P.tete + P.haut) / 2))
            for axe in P.axes:
                if axe - P.traverse / 2 < tete:
                    P.entretoise(axe, cote)
        P.bois((-baie, baie), (0, B["seuil"]), D["RETRAITS"]["traverse"])
        P.bois((-huisserie, huisserie), (B["hauteur"], tete), D["RETRAITS"]["traverse"])
        for axe in P.axes:
            if axe - P.traverse / 2 >= tete:
                P.entretoise(axe, (-P.bout, P.bout))
        for a in P.poteaux[1:-1]:
            if abs(a) < baie:
                P.montant(a, (tete, P.tete))
        P.torchis((-huisserie, huisserie), (B["hauteur"] + P.linteau / 2, (P.tete + P.haut) / 2))
        V, jeu = PORTE_DE_PLANCHES, B["jeu"]
        gond = P.R.point(-baie + jeu, 0, -V["epaisseur"] / 2)
        vantail(m, Repere(gond, -DEHORS, X) if ouverte else Repere(gond, X, DEHORS), 2 * (baie - jeu),
                (B["seuil"] + jeu, B["hauteur"] - jeu), V)
    return batir


def fenetre(close):
    """La fenêtre : la baie percée dans le registre du milieu, sa croisée à petits bois, ses volets rabattus sur le
    dehors ou `close`, fermés devant elle."""
    def batir(D, m, _):
        P, F = Pan(D, m), D["FENETRE"]
        baie = F["largeur"] * D["LONGUEUR"] / 2
        huisserie = baie + P.poteau / 2
        appui, linteau = P.axes[0] + P.traverse / 2, P.axes[1] - P.traverse / 2
        P.cadre()
        P.sole((-P.demi, P.demi))
        for axe in P.axes:
            P.entretoise(axe, (-P.bout, P.bout))
        for a in P.poteaux[1:-1]:
            if abs(a) < huisserie + P.poteau / 2:
                P.montant(a, (P.pied, appui - P.traverse))
                P.montant(a, (linteau + P.traverse, P.tete))
            else:
                P.montant(a, (P.pied, P.tete))
        for s in (-1, 1):
            P.montant(s * huisserie, (appui, linteau))
            P.torchis(tuple(sorted((s * P.bout, s * huisserie))), (P.axes[0], P.axes[1]))
        P.torchis((-P.bout, P.bout), (P.pied / 2, P.axes[0]))
        P.torchis((-P.bout, P.bout), (P.axes[1], (P.tete + P.haut) / 2))
        P.croix_des_registres(sauf=(1,))

        croisee(m, P.R, baie, appui, linteau)
        volets(m, P.R, baie, (appui - F["recouvrement"], linteau + F["recouvrement"]), P.nu, close)
    return batir


def breche(D, m, a):
    """La brèche : le pan éventré d'après `BRECHE`, ses bois rompus, ses éclisses à nu et ses gravats."""
    P, B = Pan(D, m), D["BRECHE"]
    P.cadre()

    def x(part):
        return part * P.demi

    def bas(part):
        return P.haut * lineaire([(q, b) for q, b, _ in B["contour"]], part)

    def haut(part):
        return P.haut * lineaire([(q, h) for q, _, h in B["contour"]], part)
    for (g, _, _), (d, _, _) in zip(B["contour"], B["contour"][1:]):
        if max(bas(g), bas(d)) > 0:
            P.biais((x(g), x(d)), (0.0, max(bas(g), B["plancher"])), (0.0, max(bas(d), B["plancher"])),
                    D["RETRAITS"]["torchis"], TORCHIS)
        P.biais((x(g), x(d)), (haut(g), (P.tete + P.haut) / 2), (haut(d), (P.tete + P.haut) / 2),
                D["RETRAITS"]["torchis"], TORCHIS)
    premier, dernier = B["contour"][0][0], B["contour"][-1][0]
    for cote in ((-P.bout, x(premier)), (x(dernier), P.bout)):
        P.torchis(cote, (P.pied / 2, (P.tete + P.haut) / 2))

    def restes(vide, borne):
        return ((-borne, x(vide[0])), (x(vide[1]), borne))
    for cote in restes(B["sole"], P.demi):
        P.sole(cote)
    for axe, vide in zip(P.axes, B["traverses"]):
        for cote in restes(vide, P.bout):
            P.entretoise(axe, cote)
    for poteau in P.poteaux[1:-1]:
        P.montant(poteau, (P.haut * B["poteau"], P.tete))
    for (depart, arrivee), retrait in zip(B["echarpes"], D["RETRAITS"]["echarpes"]):
        P.R.poutre(m, (x(depart[0]), P.haut * depart[1]), (x(arrivee[0]), P.haut * arrivee[1]), P.echarpe,
                   P.epais(retrait), BOIS)

    E = B["eclisses"]
    for part, sens in E["places"]:
        long, c = a.uniform(*E["longueur"]), a.uniform(-E["ecart"], E["ecart"])
        h = (haut(part) - long, haut(part) + E["ancrage"]) if sens > 0 else (bas(part) - E["ancrage"], bas(part) + long)
        P.R.boite(m, (x(part) - E["section"] / 2, x(part) + E["section"] / 2), h,
                  (c - E["section"] / 2, c + E["section"] / 2), BOIS)

    G = B["gravats"]
    geometrie.eboulis(m, P.R, a, G, P.demi, lambda alea: BOIS if alea.random() < G["bois"] else TORCHIS)
    for depart, arrivee in B["debris"]:
        P.R.poutre(m, (x(depart[0]), P.echarpe / 2), (x(arrivee[0]), P.echarpe / 2), P.echarpe,
                   (-P.echarpe / 2, P.echarpe / 2), BOIS)
        m.v[-8:] = [(px, py + (depart[1] if k < 4 else arrivee[1]), pz) for k, (px, py, pz) in enumerate(m.v[-8:])]


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": fenetre(False),
         "fenetre-close": fenetre(True), "breche": breche}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
