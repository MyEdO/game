"""Le colombage (#4471) : le GLB `arete--colombage`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans le
repère d'une arête (`geometrie.py`). Chaque bois est une boîte close (`Repere.boite`) ou une pièce de biais
(`Repere.poutre`) ; le torchis, en retrait, s'arrête dans le bois qui l'encadre. Un vantail, de porte ou de volet, se
bâtit dans le repère de son gond (`vantail`) : fermé, ouvert d'un quart de tour ou rabattu à plat, il ne change que de
repère. L'aléa de la brèche est semé du nom de la pièce : deux constructions rendent les mêmes octets."""
import math

import geometrie
from geometrie import DEHORS, X, Repere
from maille import boite, lineaire

BOIS, TORCHIS, MENUISERIE, CROISEE, FER = "ossature", "torchis", "menuiserie", "croisee", "ferrure"


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
        """Une pièce des abscisses `a`, dont le dessous et le dessus sont aux hauteurs `h_gauche` à son bout gauche et
        `h_droite` à son bout droit."""
        c = self.epais(retrait)
        boite(self.m, (a[0], c[0], 0.0), (a[1], c[1], 1.0), mat)
        hauteurs = (h_gauche, h_droite)
        self.m.v[-8:] = [(x, y, hauteurs[k // 4][k % 2]) for k, (x, y, _) in enumerate(self.m.v[-8:])]


def vantail(m, R, largeur, h, V):
    """Un vantail de planches d'après `V` (`PORTE_DE_PLANCHES`, `VOLET`) dans le repère `R` de son gond : large de
    `largeur` depuis lui, entre les hauteurs `h`, son parement vers la normale du repère, ses barres au dos."""
    epais, pas = V["epaisseur"], largeur / V["planches"]
    for k in range(V["planches"]):
        R.boite(m, (k * pas, (k + 1) * pas), h, (0, epais - (k % 2) * V["relief"]), MENUISERIE)
    haut_b, epais_b = V["section"]
    axes = [h[0] + (h[1] - h[0]) * part for part in V["barres"]]
    for axe in axes:
        R.boite(m, (V["marge"], largeur - V["marge"]), (axe - haut_b / 2, axe + haut_b / 2), (-epais_b, 0), MENUISERIE)
        long, haut_p, epais_p, depasse = V["pentures"]
        R.boite(m, (-depasse, largeur * long), (axe - haut_p / 2, axe + haut_p / 2), (epais, epais + epais_p), FER)
    if V["echarpe"]:
        rive = V["marge"] + haut_b / 2
        R.poutre(m, (rive, axes[0] + haut_b / 2), (largeur - rive, axes[1] - haut_b / 2), haut_b, (-epais_b * 0.9, 0),
                 MENUISERIE)
    if V["poignee"]:
        G = V["poignee"]
        large, haut_g, epais_g = G["platine"]
        a, z = largeur - G["rive"], h[0] + (h[1] - h[0]) * G["hauteur"]
        R.boite(m, (a - large / 2, a + large / 2), (z - haut_g / 2, z + haut_g / 2), (epais, epais + epais_g), FER)
        R.boite(m, (a - large / 6, a + large / 6), (z - haut_g / 3, z + haut_g / 3),
                (epais + epais_g, epais + epais_g + G["saillie"]), FER)


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
        V = D["PORTE_DE_PLANCHES"]
        jeu = B["jeu"]
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

        dormant, c = F["dormant"]
        meneau = F["meneau"]
        dedans = (appui + dormant, linteau - dormant)
        for a in ((-baie, -baie + dormant), (baie - dormant, baie)):
            P.R.boite(m, a, (appui, linteau), c, CROISEE)
        large = (-baie + dormant, baie - dormant)
        for h in ((appui, appui + dormant), (linteau - dormant, linteau)):
            P.R.boite(m, large, h, c, CROISEE)
        P.R.boite(m, (-meneau / 2, meneau / 2), dedans, c, CROISEE)
        croisillon = appui + (linteau - appui) * F["croisillon"]
        fin = (c[0] + 0.004, c[1] - 0.004)
        P.R.boite(m, large, (croisillon - meneau / 2, croisillon + meneau / 2), fin, CROISEE)
        B = F["petits_bois"]
        section, milieu = B["section"], (c[0] + c[1]) / 2
        for s in (-1, 1):
            a = s * (meneau / 2 + baie - dormant) / 2
            P.R.boite(m, (a - section / 2, a + section / 2), dedans, (milieu - section / 2, milieu + section / 2),
                      CROISEE)
        compartiments = ((dedans[0], croisillon - meneau / 2), (croisillon + meneau / 2, dedans[1]))
        for (bas, haut), nombre in zip(compartiments, B["traverses"]):
            for k in range(1, nombre + 1):
                h = bas + (haut - bas) * k / (nombre + 1)
                P.R.boite(m, large, (h - section / 2, h + section / 2),
                          (milieu - section * 0.4, milieu + section * 0.4), CROISEE)

        V = D["VOLET"]
        h = (appui - F["recouvrement"], linteau + F["recouvrement"])
        for s in (-1, 1):
            if close:
                gond = Repere(P.R.point(s * baie, 0, P.nu), -s * X, DEHORS)
            else:
                gond = Repere(P.R.point(s * baie, 0, P.nu + V["epaisseur"]), s * X, -DEHORS)
            vantail(m, gond, baie - F["jeu"] / 2, h, V)
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
    for _ in range(G["nombre"]):
        cote = a.uniform(*G["cote"])
        ca, cc = x(a.uniform(-G["etendue"][0], G["etendue"][0])), a.uniform(-G["etendue"][1], G["etendue"][1])
        mat = BOIS if a.random() < G["bois"] else TORCHIS
        P.R.boite(m, (ca - cote / 2, ca + cote / 2), (0.0, cote * 0.6), (cc - cote / 2, cc + cote / 2), mat)
        ecart = cote * G["ecart"]
        m.v[-8:] = [(px + a.uniform(-ecart, ecart), py + a.uniform(-ecart, ecart),
                     pz + (k % 2) * a.uniform(-ecart, ecart)) for k, (px, py, pz) in enumerate(m.v[-8:])]
    for depart, arrivee in B["debris"]:
        P.R.poutre(m, (x(depart[0]), P.echarpe / 2), (x(arrivee[0]), P.echarpe / 2), P.echarpe,
                   (-P.echarpe / 2, P.echarpe / 2), BOIS)
        m.v[-8:] = [(px, py + (depart[1] if k < 4 else arrivee[1]), pz) for k, (px, py, pz) in enumerate(m.v[-8:])]


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": fenetre(False),
         "fenetre-close": fenetre(True), "breche": breche}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
