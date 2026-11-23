"""Le mur enduit (#4471) : le GLB `arete--enduit`, un nœud par pièce de `BATIR`, bâti d'après `donnees.py` dans le
repère d'une arête (`geometrie.py`). Le corps du mur est d'enduit (`Enduit.pan_d_enduit`), une coque close par pan ;
ses pierres, à nu ou d'encadrement, sont celles de `maconnerie` (`Appareil.pierre`, `Appareil.pan`), posées en relief
sur lui. Une porte cintrée (`Appareil.porte_cintree`) prend le porche d'enduit d'`Enduit.porche`. L'aléa d'une pièce
est semé de son nom : deux constructions rendent les mêmes octets."""
import math

import geometrie
from geometrie import DROITE, GAUCHE, Repere, biais, noeud
from maconnerie import JEU_DE_L_AME, PIERRE, Appareil
from maille import lineaire
from menuiserie import BARRES, PORTE_DE_PLANCHES, croisee, echelle, vitre, volets

ENDUIT, CLAIRE, ARDOISE = "enduit", "pierre-claire", "ardoise"


def prisme(m, R, contour, c, mat):
    """Le prisme droit de `contour` [(abscisse, hauteur)] entre les bornes `c` de l'épaisseur, dans le repère `R`."""
    k = len(contour)
    faces = [list(range(k)), list(range(2 * k - 1, k - 1, -1)),
             *([i, (i + 1) % k, k + (i + 1) % k, k + i] for i in range(k))]
    m.ajouter([R.point(a, h, face) for face in c for a, h in contour], faces, mat)


class Enduit(Appareil):
    """Le mur enduit d'une arête : l'appareil de ses pierres (`Appareil`), le corps d'enduit qui les porte et le
    chaperon qui le coiffe, d'après `D["ENDUIT"]`, `D["CHAPERON"]` et `D["ENCADREMENT"]`."""

    def __init__(self, D, m, alea):
        super().__init__(D, m, alea)
        self.E, self.C, self.T = D["ENDUIT"], D["CHAPERON"], D["ENCADREMENT"]
        self.face = self.nu - self.E["retrait"]
        self.flanc = self.haut - self.C["hauteur"]
        self.parement = self.nu + self.T["saillie"]

    def pan_d_enduit(self, a, pied=0.0, tete=None, pas=None):
        """Le corps d'enduit entre les abscisses `a`, une coque close : son dessous à la hauteur `pied` (m, ou
        `pied(abscisse)`), ses deux nus creusés d'un relief tiré, nul à ses deux bouts, sa tête plate à la hauteur
        `tete`, ou sans elle le chaperon arrondi qui le déborde jusqu'à la hauteur du mur ; `pas` : le plus grand écart
        (m) entre deux de ses sections, celui de l'enduit sans lui."""
        E, C = self.E, self.C
        bas = pied if callable(pied) else (lambda _: pied)
        n = max(1, math.ceil((a[1] - a[0]) / (pas or E["pas"]) - 1e-9))
        stations = [a[0] + (a[1] - a[0]) * i / n for i in range(n + 1)]
        flanc = self.flanc if tete is None else tete
        rangs = max(1, math.ceil((flanc - min(map(bas, stations))) / E["pas"] - 1e-9))
        coiffe = []
        if tete is None:
            fleche, k = C["hauteur"] - C["bande"], C["segments"]
            arrondi = [(-self.nu * math.cos(math.pi * i / k), flanc + C["bande"] + fleche * math.sin(math.pi * i / k))
                       for i in range(1, k)]
            coiffe = [(-self.nu, flanc), (-self.nu, flanc + C["bande"]), *arrondi, (self.nu, flanc + C["bande"]),
                      (self.nu, flanc)]
        sommets = []
        for i, x in enumerate(stations):
            hauteurs = [bas(x) + (flanc - bas(x)) * r / rangs for r in range(rangs + 1)]
            nus = [self.face - (0.0 if i in (0, n) or r == rangs else self.alea.uniform(0.0, E["relief"]))
                   for _ in (-1, 1) for r in range(rangs + 1)]
            section = [*((-c, h) for c, h in zip(nus, hauteurs)), *coiffe,
                       *((c, h) for c, h in zip(nus[:rangs:-1], hauteurs[::-1]))]
            sommets += [self.R.point(x, h, c) for c, h in section]
        p = len(sommets) // (n + 1)
        faces = [[i * p + j, i * p + (j + 1) % p, (i + 1) * p + (j + 1) % p, (i + 1) * p + j]
                 for i in range(n) for j in range(p)]
        corps = [*range(rangs + 1), *range(p - rangs - 1, p)]
        bouts = [corps, list(range(rangs, p - rangs))] if coiffe else [corps]
        faces += [[i * p + j for j in bout] for i in (0, n) for bout in bouts]
        self.m.ajouter(sommets, faces, ENDUIT)

    def pierres_a_nu(self, lacunes):
        """Les pierres du mur à nu dans les `lacunes` de l'enduit (`PIERRES_A_NU`), en relief sur lui : celles des
        assises du mur dont le milieu est dans une lacune."""
        def garde(gauche, droite, pied, tete):
            x, h = (gauche + droite) / 2, (pied + tete) / 2
            return any(((x - ca * self.demi) / ra) ** 2 + ((h - ch) / rh) ** 2 <= 1 for ca, ch, ra, rh in lacunes)
        self.pan((-self.demi, self.demi), (0.0, self.flanc), garde=garde, recul=self.E["a_nu"])

    def tableau(self, bord, cote, h, harpe):
        """Le tableau de pierre de la baie au `bord` (abscisse), le mur du côté `cote`, entre les hauteurs `h` : ses
        pierres de taille en harpe (`harpe` : leur longueur, une assise sur deux la première puis la seconde), en
        saillie sur les deux parements, et l'âme de pierre qui les double derrière leurs joints, sous la plus courte,
        et fait le tableau devant elles. Rend l'abscisse où le corps d'enduit la rejoint."""
        T, j = self.T, self.A["joint"] / 2
        ame = bord + cote * (min(harpe) - T["retrait"])
        self.R.boite(self.m, tuple(sorted((bord - cote * T["jeu"], ame))),
                     (max(h[0] - T["retrait"], 0.0), h[1] + T["retrait"]),
                     (T["creux"] - self.parement, self.parement - T["creux"]), PIERRE)
        for k, bas, haut in self.assises(h):
            pierre = tuple(sorted((bord - cote * j, bord + cote * harpe[k % 2])))
            self.pierre(pierre, (bas, haut), self.A["taille"], recul=-T["saillie"])
        return ame - cote * T["jeu"]

    def porche(self, axe, cotes, V):
        """Le porche d'enduit d'axe `axe` (abscisse de sa clef), d'après `V` (`PORTE`, `PORTAIL`) : de chaque côté de
        `cotes` (-1 vers -X, 1 vers +X), le corps d'enduit du bout de l'arête à la clef, ouvert sous l'arc, le
        piédroit en harpe (`tableau`), les claveaux de l'arc, de queues alternées, la moitié de sa clef à l'axe, sa
        joue sous le bout de l'arête quand l'axe y est, son sommier au lit horizontal sur le piédroit, et le bandeau de
        pierre claire qui suit l'arc. Rend la hauteur de l'intrados à une abscisse."""
        T, portee, naissance, nombre = self.T, V["portee"], V["naissance"], V["claveaux"]
        rayon = (portee ** 2 + V["fleche"] ** 2) / (2 * V["fleche"])
        centre, ouverture = naissance + V["fleche"] - rayon, math.asin(portee / rayon)
        jeu, bout = self.A["joint"] / 2 / rayon, self.demi - JEU_DE_L_AME
        joue = JEU_DE_L_AME / rayon if abs(axe) > bout else 0.0
        dos = rayon + min(V["queue"]) - T["retrait"]

        def cercle(x, r):
            return centre + math.sqrt(max(r ** 2 - (x - axe) ** 2, 0.0))

        def voussoir(angles, rayons, c, mat, lit=None):
            contour = [(axe + cote * r * math.sin(a), centre + r * math.cos(a))
                       for r, a in ((rayons[0], angles[0]), (rayons[0], angles[1]), (rayons[1], angles[1]),
                                    (rayons[1], angles[0]))]
            if lit is not None:
                contour[1:3] = [(contour[1][0], lit), (contour[2][0], lit), contour[2]]
            prisme(self.m, self.R, contour, (-c, c), mat)
        for cote in cotes:
            raccord = self.tableau(axe + cote * portee, cote, (0.0, naissance), V["harpe"])
            self.pan_d_enduit(tuple(sorted((cote * self.demi, raccord))), tete=V["tete"])
            self.pan_d_enduit(tuple(sorted((raccord, axe))), lambda x: max(cercle(x, dos - T["jeu"]), naissance),
                              V["tete"], self.E["cintre"])
            pas = sorted(min(max(axe + cote * portee * k / nombre, -bout), bout) for k in range(nombre + 1))
            for g, d in zip(pas, pas[1:]):
                biais(self.m, (g, d), (cercle(g, rayon - T["jeu"]), cercle(g, dos)),
                      (cercle(d, rayon - T["jeu"]), cercle(d, dos)),
                      (T["creux"] - self.parement, self.parement - T["creux"]), PIERRE)
            for k in range(nombre):
                sommier = k == nombre - 1
                angles = (ouverture * k / nombre + (jeu if k else joue),
                          ouverture * (k + 1) / nombre - (0.0 if sommier else jeu))
                voussoir(angles, (rayon, rayon + V["queue"][k % 2] + (0.0 if k else V["clef"])), self.parement, PIERRE,
                         naissance + self.A["joint"] / 2 if sommier else None)
            B = V["bandeau"]
            for k in range(B["segments"] if B else 0):
                angles = [B["part"] * ouverture * (k + i) / B["segments"] for i in (0, 1)]
                voussoir((angles[0] or joue, angles[1]), (rayon + B["rayon"], rayon + B["rayon"] + B["epaisseur"]),
                         self.nu + B["saillie"], CLAIRE)
        return lambda x: cercle(x, rayon)


def mur(D, m, alea):
    """Le mur plein : son corps d'enduit sous son chaperon, ses pierres à nu."""
    A = Enduit(D, m, alea)
    A.pan_d_enduit((-A.demi, A.demi))
    A.pierres_a_nu(D["PIERRES_A_NU"])


def porte(ouverte):
    """La porte cintrée seule sur son arête, son vantail fermé dans la baie ou `ouverte` d'un quart de tour vers le
    dedans."""
    def batir(D, m, alea):
        P = D["PORTE"]
        Enduit(D, m, alea).porte_cintree(0.0, (-1, 1), P["porche"], P["seuil"], P["jeu"], PORTE_DE_PLANCHES, ouverte)
    return batir


def ecu(m, R, axe, cote, c, E):
    """La moitié, du côté `cote` de l'axe `axe`, de l'écu `E` (`PORTAIL["ecu"]`) : une plaque nue, son dos à `c` de
    l'axe du mur, vers le dehors."""
    demi_largeur, hauteur = E["taille"]
    contour = [(axe + cote * demi_largeur * x, E["pied"] + hauteur * y) for x, y in E["contour"]]
    prisme(m, R, contour, (c, c + E["epaisseur"]), CLAIRE)


def toit(m, R, alea, a, nu, haut, T):
    """Le petit toit d'ardoise `T` (`PORTAIL["toit"]`) entre les abscisses `a`, à deux pans sur la tête du mur, son
    faîte à la hauteur `haut` : par pan, ses rangs d'ardoises à recouvrement, les joints croisés d'un rang à l'autre,
    le pied de chacune tiré, et ses chevrons sous elles, du bois des barres d'un vantail ; sa faîtière."""
    egout, faite = (nu + T["debord"], T["egout"]), (0.0, haut - T["faitiere"][1])
    rampant = math.dist(egout, faite)
    pente = ((faite[0] - egout[0]) / rampant, (faite[1] - egout[1]) / rampant)

    def au_pan(le_long, dessus):
        return (egout[0] + pente[0] * le_long + pente[1] * dessus, egout[1] + pente[1] * le_long - pente[0] * dessus)
    pureau, epais = rampant / T["rangs"], T["epaisseur"]
    colonnes = max(1, round((a[1] - a[0]) / T["largeur"]))
    large, haut_c = T["section"]
    for sens in (1, -1):
        pan = Repere(R.o, sens * R.n, R.u)
        for rang in range(T["rangs"]):
            joints = [a[0] + (a[1] - a[0]) * (k + (rang % 2) / 2) / colonnes for k in range(colonnes + 1 - rang % 2)]
            bords = sorted({a[0], *joints, a[1]})
            for g, d in zip(bords, bords[1:]):
                pied = rang * pureau - alea.uniform(0.0, T["jeu"])
                tete = min(rang * pureau + T["recouvrement"] * pureau, rampant)
                pan.poutre(m, au_pan(pied, 1.9 * epais), au_pan(tete, 0.5 * epais), epais, (g, d), ARDOISE)
        for k in range(T["chevrons"]):
            x = a[0] + (a[1] - a[0]) * (k + 0.5) / T["chevrons"]
            pan.poutre(m, au_pan(0.02, -haut_c / 2 - 0.002), au_pan(rampant - 0.02, -haut_c / 2 - 0.002), haut_c,
                       (x - large / 2, x + large / 2), BARRES)
    R.boite(m, a, (faite[1], haut), (-T["faitiere"][0] / 2, T["faitiere"][0] / 2), ARDOISE)


def portail(ouverte, cote):
    """L'arête de bout d'un portail de deux arêtes, celle de gauche (`cote` -1) ou de droite (1) : son piédroit, sa
    moitié de l'arc, du bandeau, de l'écu et du petit toit, et son vantail gondé au piédroit, sa tête cintrée sous
    l'arc, fermé ou `ouverte` d'un quart de tour vers le dedans."""
    def batir(D, m, alea):
        A, P = Enduit(D, m, alea), D["PORTAIL"]
        axe = -cote * A.demi
        A.porte_cintree(axe, (cote,), P["porche"], P["seuil"], P["jeu"], P["vantail"], ouverte)
        ecu(m, A.R, axe, cote, A.parement + P["ecu"]["ecart"], P["ecu"])
        toit(m, A.R, alea, (-A.demi, A.demi), A.nu, A.haut, P["toit"])
    return batir


def fenetre(close):
    """La fenêtre : sa baie entre deux jambages en harpe, sur un appui saillant et sous un linteau, sa croisée vitrée,
    ses volets rabattus sur le dehors ou `close`, fermés devant elle."""
    def batir(D, m, alea):
        A, F = Enduit(D, m, alea), D["FENETRE"]
        demi_baie = F["baie"] * D["LONGUEUR"] / 2
        (haut_a, saillie_a, portee_a), (haut_l, portee_l) = F["pierre_d_appui"], F["linteau"]
        gauche, droite = (A.tableau(cote * demi_baie, cote, (F["appui"], F["tete"]), F["harpe"]) for cote in (-1, 1))
        A.pan_d_enduit((-A.demi, gauche))
        A.pan_d_enduit((droite, A.demi))
        A.pan_d_enduit((gauche, droite), tete=F["appui"] - A.T["jeu"])
        A.pan_d_enduit((gauche, droite), F["tete"] + haut_l / 2)
        A.R.boite(m, (-demi_baie - portee_a, demi_baie + portee_a), (F["appui"] - haut_a, F["appui"]),
                  (-A.nu, A.nu + saillie_a), PIERRE)
        A.pierre((-demi_baie - portee_l, demi_baie + portee_l), (F["tete"] - A.A["joint"] / 2, F["tete"] + haut_l),
                 A.A["taille"], recul=-A.T["saillie"])
        croisee(m, A.R, demi_baie, F["appui"], F["tete"])
        vitre(m, A.R, demi_baie, F["appui"], F["tete"])
        volets(m, A.R, demi_baie, (F["appui"] + F["jour"], F["tete"] + F["recouvrement"]),
               A.parement + F["volets"], close)
    return batir


def breche(D, m, alea):
    """La brèche : le mur éventré d'après `BRECHE`, son enduit resté à ses deux bouts, sa maçonnerie à nu entre eux,
    chaque pierre gardée si son milieu est sous la crête, ses pierres tombées au pied."""
    A, B = Enduit(D, m, alea), D["BRECHE"]
    gauche, droite = (part * A.demi for part in B["enduit"])

    def crete(x):
        return A.haut * lineaire(B["contour"], x / A.demi)
    A.pan_d_enduit((-A.demi, gauche))
    A.pan_d_enduit((droite, A.demi))
    bords = [(x, min(max(crete(x), B["plancher"]), A.haut - JEU_DE_L_AME))
             for x in (gauche, *(part * A.demi for part, _ in B["contour"] if gauche < part * A.demi < droite), droite)]
    for (g, tete_g), (d, tete_d) in zip(bords, bords[1:]):
        biais(m, (g, d), (0.0, tete_g), (0.0, tete_d), (B["ame"] - A.face, A.face - B["ame"]), PIERRE)
    A.pan((gauche, droite), (0.0, A.haut), garde=lambda g, d, pied, tete: (pied + tete) / 2 <= crete((g + d) / 2),
          recul=A.E["a_nu"])
    geometrie.eboulis(m, A.R, alea, B["gravats"], A.demi)


BATIR = {"mur": mur, "porte-fermee": porte(False), "porte-ouverte": porte(True), "fenetre": fenetre(False),
         "fenetre-close": fenetre(True), "breche": breche,
         **{noeud(piece, position): portail(ouverte, cote)
            for piece, ouverte in (("porte-fermee", False), ("porte-ouverte", True))
            for position, cote in ((GAUCHE, -1), (DROITE, 1))},
         "echelle": echelle}


def elements(D):
    return geometrie.elements(D, D["KIT"], BATIR)
