"""La maçonnerie commune aux kits de pierre (#4471) : l'appareil d'une arête (`Appareil`), ses assises de moellons
bruts posées sur une âme en retrait, ses chaînes de pierres de taille, son couronnement, son porche voûté et sa
brèche. Un kit qui le bâtit déclare les matériaux `PIERRE` et `AME`, et l'appareil `D["APPAREIL"]` :

- `assise` : la hauteur moyenne (m) d'une assise, joint compris ; `inegalite` : ce dont celle de chacune s'en écarte
  (fraction, tirée jusqu'à cette borne) ; `joint` : sa largeur (m) ; `bloc` : la longueur (m) d'un moellon, la plus
  courte puis la plus longue ; `decalage` : ce dont une assise sur deux raccourcit sa première pierre (fraction) ;
  `ondulation` : l'étendue (m) où chaque coin d'un moellon s'écarte de sa place ; `lit` : ce dont chacun de ses deux
  lits s'écarte de celui de l'assise (m, tiré jusqu'à cette borne) ;
- `boutisse` : la part des pierres posées en boutisse, plus courtes que `bloc` ; `cale` : la part des moellons que
  double une cale, et la hauteur de celle-ci (fraction de l'assise, tirée entre ces bornes) ;
- `moellon`, `taille` : la façon d'un moellon et celle d'une pierre de taille (`Appareil.pierre`), `taille` à `None`
  sans chaîne ; `creux` : ce dont l'âme recule sous le nu du mur, de chaque côté (m) ;
- `harpe` : la longueur (m) des pierres de taille d'une chaîne, une assise sur deux la première puis la seconde, `None`
  sans chaîne ;
- `couronnement` : ses pierres posées de chant sur le corps du mur, leur `hauteur` (m), leur `largeur` (m, tirée),
  ce dont leur tête s'abaisse (`chute`, m, tirée jusqu'à cette borne), leur `ondulation` et leur façon (`pierre`),
  `None` sans couronnement.

Une façon : le `relief` dont le parement recule sous le nu du mur, le `chanfrein` dont sa rive recule encore, et le
`retrait` de cette rive au bord de la pierre (m, chacun tiré entre ses bornes)."""
import math
import random

from geometrie import DEHORS, X, Repere, biais
from maille import lineaire

PIERRE, AME = "moellons", "ame"
MINCE = 0.1
"""La hauteur (m) sous laquelle un reste d'assise se fond dans sa voisine."""
JEU_DE_L_AME = 0.0004
"""Ce dont l'âme reste sous les bouts et la tête de l'arête (m), pour ne pas y doubler la face d'une pierre."""
COINS = ((0, 0), (1, 0), (1, 1), (0, 1))
"""Les quatre coins du parement d'une pierre, (droite, tête), dans le sens de son contour."""


class Appareil:
    """L'appareil d'une arête, bâti dans la maille `m` d'après `D`, ses tirages pris à `alea`. Une abscisse `a` se
    compte du milieu de l'arête, une hauteur `h` de son pied, dans le repère `R` de l'arête. Les assises se comptent
    du pied à la tête du corps du mur (`corps`), les mêmes pour toutes les pièces du kit."""

    def __init__(self, D, m, alea):
        self.A, self.m, self.alea, self.R = D["APPAREIL"], m, alea, Repere((0, 0, 0), X, DEHORS)
        self.demi, self.haut, self.nu = D["LONGUEUR"] / 2, D["HAUTEUR"], D["EPAISSEUR"] / 2
        C = self.A["couronnement"]
        self.corps = self.haut - (C["hauteur"] if C else 0.0)
        du_kit, e = random.Random(f"{D['KIT']}/assises"), self.A["inegalite"]
        parts = [1 + du_kit.uniform(-e, e) for _ in range(max(1, round(self.corps / self.A["assise"])))]
        self.lits = [self.corps * sum(parts[:k]) / sum(parts) for k in range(len(parts))] + [self.corps]

    def pierre(self, a, h, facon, ondulation=0.0, lit=0.0, recul=0.0):
        """Une pierre entre les abscisses `a` et les hauteurs `h`, ses joints déduits, d'un parement à l'autre du
        mur : une coque close, ses lits écartés de `lit`, ses coins écartés dans `ondulation`, chaque parement bombé
        d'après `facon`, à `recul` (m) sous le nu du mur. Un côté au bout, au pied ou à la tête de l'arête y reste."""
        j, o, tire = self.A["joint"] / 2, ondulation / 2, self.alea.uniform
        bornes = ((-self.demi, self.demi), (0.0, self.haut))

        def cote(axe, bout, ecart):
            place = (a, h)[axe][bout]
            if not bornes[axe][0] < place < bornes[axe][1]:
                return (place, True)
            return (place + (1 - 2 * bout) * j + ecart, False)
        cotes = ((cote(0, 0, 0.0), cote(0, 1, 0.0)), (cote(1, 0, tire(-lit, lit)), cote(1, 1, tire(-lit, lit))))
        rive = [tuple(place if tenu else min(max(place + tire(-o, o), bornes[axe][0]), bornes[axe][1])
                      for axe, (place, tenu) in enumerate((cotes[0][coin[0]], cotes[1][coin[1]]))) for coin in COINS]
        fond = self.nu - recul - tire(*facon["relief"])
        bord = fond - tire(*facon["chanfrein"])
        sommets, faces = [], []
        for cote in (-1, 1):
            base = len(sommets)
            jusqu_ou = [min(tire(*facon["retrait"]), 0.4 * (cotes[axe][1][0] - cotes[axe][0][0])) for axe in (0, 1)]
            sommets += [(x, cote * bord, z) for x, z in rive]
            sommets += [(x + (1 - 2 * coin[0]) * jusqu_ou[0], cote * fond, z + (1 - 2 * coin[1]) * jusqu_ou[1])
                        for (x, z), coin in zip(rive, COINS)]
            faces += [[base + 4 + k for k in range(4)]]
            faces += [[base + k, base + (k + 1) % 4, base + 4 + (k + 1) % 4, base + 4 + k] for k in range(4)]
        faces += [[k, (k + 1) % 4, 8 + (k + 1) % 4, 8 + k] for k in range(4)]
        self.m.ajouter(sommets, faces, PIERRE)

    def assises(self, h):
        """Le rang et les hauteurs de chaque assise du mur entre les hauteurs `h`, un reste mince fondu dans sa
        voisine."""
        dans = [(k, max(bas, h[0]), min(haut, h[1])) for k, (bas, haut) in enumerate(zip(self.lits, self.lits[1:]))
                if min(haut, h[1]) - max(bas, h[0]) > 1e-6]
        fondues = []
        for k, bas, haut in dans:
            if fondues and min(haut - bas, fondues[-1][2] - fondues[-1][1]) < MINCE:
                fondues[-1] = (fondues[-1][0], fondues[-1][1], haut)
            else:
                fondues.append((k, bas, haut))
        return fondues

    def rang(self, a, k, chaines):
        """Les pierres (gauche, droite, de taille) de l'assise de rang `k` entre les abscisses `a`, de longueurs
        inégales, des boutisses parmi elles ; `chaines` : si son bout gauche, puis son bout droit, portent une chaîne
        (`harpe`)."""
        H, (court, long) = self.A["harpe"], self.A["bloc"]
        tetes = [H[(k + cote) % 2] if H and chaine else 0.0 for cote, chaine in enumerate(chaines)]
        g, d = a[0] + tetes[0], a[1] - tetes[1]
        if d - g < court / 2:
            if not all(tetes):
                return [(a[0], a[1], any(tetes))]
            coupe = a[0] + (a[1] - a[0]) * tetes[0] / sum(tetes)
            return [(a[0], coupe, True), (coupe, a[1], True)]
        bornes, part = [g], 1 - self.A["decalage"] * (k % 2)
        while d - bornes[-1] > 1.5 * court:
            longueur = self.alea.uniform(court, long) * part
            if self.alea.random() < self.A["boutisse"]:
                longueur = court * self.alea.uniform(0.5, 0.85)
            bornes.append(min(bornes[-1] + longueur, d - 0.75 * court))
            part = 1
        pierres = [(gauche, droite, False) for gauche, droite in zip(bornes, [*bornes[1:], d])]
        return ([(a[0], g, True)] if tetes[0] else []) + pierres + ([(d, a[1], True)] if tetes[1] else [])

    def ame(self, a, h):
        """L'âme entre les abscisses `a` et les hauteurs `h`, jusqu'aux bouts et à la tête de l'arête."""
        gauche, droite = (min(max(x, JEU_DE_L_AME - self.demi), self.demi - JEU_DE_L_AME) for x in a)
        self.R.boite(self.m, (gauche, droite), (h[0], min(h[1], self.haut - JEU_DE_L_AME)),
                     (self.A["creux"] - self.nu, self.nu - self.A["creux"]), AME)

    def pan(self, a, h, chaines=(False, False), garde=None, recul=0.0):
        """Les assises du mur entre les abscisses `a` et les hauteurs `h`, sur leur âme, une cale sous ou sur certains
        moellons ; `garde(gauche, droite, pied, tête)` dit quelles pierres restent, toutes sans elle, et l'âme est
        alors laissée à qui les garde ; `recul` : celui de chaque pierre (`pierre`)."""
        if not garde:
            self.ame(a, h)
        part, hauteur = self.A["cale"]
        for k, bas, haut in self.assises(h):
            for gauche, droite, taille in self.rang(a, k, chaines):
                lits = [bas, haut]
                if not taille and self.alea.random() < part:
                    cale = (haut - bas) * self.alea.uniform(*hauteur)
                    lits.insert(1, bas + cale if self.alea.random() < 0.5 else haut - cale)
                for pied, tete in zip(lits, lits[1:]):
                    if not garde or garde(gauche, droite, pied, tete):
                        if taille:
                            self.pierre((gauche, droite), (pied, tete), self.A["taille"], recul=recul)
                        else:
                            self.pierre((gauche, droite), (pied, tete), self.A["moellon"], self.A["ondulation"],
                                        self.A["lit"], recul)

    def couronnement(self, a, garde=None):
        """Les pierres de chant du couronnement entre les abscisses `a`, la première à la hauteur et au nu du mur."""
        C = self.A["couronnement"]
        if not C:
            return
        if not garde:
            self.ame(a, (self.corps, self.haut - C["chute"] - self.A["creux"]))
        gauche, premiere = a[0], True
        while gauche < a[1] - 1e-6:
            droite = min(gauche + self.alea.uniform(*C["largeur"]), a[1])
            if a[1] - droite < C["largeur"][0] / 2:
                droite = a[1]
            chute = 0.0 if premiere else self.alea.uniform(0.0, C["chute"])
            if not garde or garde(gauche, droite, self.corps, self.haut):
                facon = {**C["pierre"], "relief": (0.0, 0.0)} if premiere else C["pierre"]
                self.pierre((gauche, droite), (self.corps, self.haut - chute), facon,
                            0.0 if premiere else C["ondulation"])
            gauche, premiere = droite, False

    def mur(self, a, h, chaines=(False, False)):
        """Le mur entre les abscisses `a`, du pied `h[0]` à la hauteur `h[1]` ou, plus haut que son corps, à son
        couronnement."""
        self.pan(a, (h[0], min(h[1], self.corps)), chaines)
        if h[1] > self.corps:
            self.couronnement(a)

    def porche(self, axe, cotes, V):
        """Le porche voûté d'axe `axe` (abscisse de sa clef) sur toute la hauteur du mur, d'après `V` : de chaque
        côté de `cotes` (-1 vers -X, 1 vers +X), un piédroit du bout de l'arête à la `portee` (m), les claveaux
        (`claveaux`, leur `queue`, m) d'un arc de `fleche` (m) né à la hauteur `naissance` (m), la moitié de sa clef
        (plus haute de `clef`, m) à l'axe, et le mur qui les charge, en retrait de leur `saillie` (m) : ses moellons
        portent sur leur dos, recoupés tant que leur lit s'en écarte. L'âme monte dans leurs joints. Rend la hauteur
        de l'intrados à une abscisse."""
        portee, naissance, queue, nombre = V["portee"], V["naissance"], V["queue"], V["claveaux"]
        rayon = (portee ** 2 + V["fleche"] ** 2) / (2 * V["fleche"])
        centre, ouverture = naissance + V["fleche"] - rayon, math.asin(portee / rayon)
        jeu, creux = self.A["joint"] / 2 / rayon, (self.A["creux"] - self.nu, self.nu - self.A["creux"])
        tete, bout = self.haut - JEU_DE_L_AME, self.demi - JEU_DE_L_AME

        def cercle(x, r):
            return centre + math.sqrt(max(r ** 2 - (x - axe) ** 2, 0.0))

        def charger(g, d, bas, haut):
            pres, loin = sorted((g, d), key=lambda x: abs(x - axe))
            pied = max(bas, cercle(pres, rayon + queue / 2))
            if min(pied, haut) - max(bas, cercle(loin, rayon + queue)) > self.A["joint"] and d - g > self.A["bloc"][0]:
                charger(g, (g + d) / 2, bas, haut)
                charger((g + d) / 2, d, bas, haut)
            elif haut - pied >= MINCE:
                self.pierre((g, d), (pied, haut), self.A["moellon"], self.A["ondulation"], self.A["lit"], V["saillie"])
        for cote in cotes:
            pile = tuple(sorted((cote * self.demi, axe + cote * portee)))
            self.mur(pile, (0.0, naissance), (True, True))
            self.pan(pile, (naissance, self.corps), (cote < 0, cote > 0), recul=V["saillie"])
            pas = sorted(min(max(axe + cote * rayon * math.sin(ouverture * k / nombre), -bout), bout)
                         for k in range(nombre + 1))
            for g, d in zip(pas, pas[1:]):
                biais(self.m, (g, d), (cercle(g, rayon), tete), (cercle(d, rayon), tete), creux, AME)
            for k, bas, haut in self.assises((naissance, self.corps)):
                for g, d, _ in self.rang(tuple(sorted((axe + cote * portee, axe))), k, (False, False)):
                    charger(g, d, bas, haut)
            for k in range(nombre):
                angles = (ouverture * k / nombre + (jeu if k else 0.0), ouverture * (k + 1) / nombre - jeu)
                rayons = (rayon, rayon + queue + (0.0 if k else V["clef"]))
                contour = [(axe + cote * r * math.sin(a), centre + r * math.cos(a))
                           for r, a in ((rayons[0], angles[0]), (rayons[0], angles[1]), (rayons[1], angles[1]),
                                        (rayons[1], angles[0]))]
                sommets = [(x, c, h) for c in (-self.nu, self.nu) for x, h in contour]
                faces = [[0, 1, 2, 3], [7, 6, 5, 4], *([i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i] for i in range(4))]
                self.m.ajouter(sommets, faces, PIERRE)
        return lambda x: cercle(x, rayon)

    def breche(self, contour, plancher):
        """Le mur éventré jusqu'à sa tête : `contour`, à chaque abscisse (fraction de la demi-longueur, d'un bout à
        l'autre de l'arête), la hauteur (fraction de celle du mur) où son âme s'arrête, au moins à `plancher` (m) ; une
        pierre reste si son milieu est sous elle."""
        def crete(x):
            return self.haut * lineaire(contour, x / self.demi)

        def garde(gauche, droite, pied, tete):
            return (pied + tete) / 2 <= crete((gauche + droite) / 2)
        bout, tete = self.demi - JEU_DE_L_AME, self.haut - JEU_DE_L_AME
        bords = [(min(max(part * self.demi, -bout), bout), min(max(crete(part * self.demi), plancher), tete))
                 for part, _ in contour]
        for (g, tete_g), (d, tete_d) in zip(bords, bords[1:]):
            biais(self.m, (g, d), (0.0, tete_g), (0.0, tete_d), (self.A["creux"] - self.nu, self.nu - self.A["creux"]),
                  AME)
        self.pan((-self.demi, self.demi), (0.0, self.corps), (True, True), garde)
        self.couronnement((-self.demi, self.demi), garde)
