"""La maçonnerie commune aux kits de pierre (#4471) : l'appareil d'une arête (`Appareil`), ses assises de moellons
posées sur une âme en retrait, ses chaînes de pierres de taille, son couronnement et sa brèche. Un kit qui le bâtit
déclare les matériaux `PIERRE` et `AME`, et l'appareil `D["APPAREIL"]` :

- `assise` : la hauteur (m) d'une assise, joint compris ; `joint` : sa largeur (m) ; `bloc` : la longueur (m) d'un
  moellon, la plus courte puis la plus longue ; `decalage` : ce dont une assise sur deux décale ses joints (fraction
  d'un moellon) ; `ondulation` : l'étendue (m) où chaque coin d'un moellon s'écarte de sa place ;
- `relief` : ce dont le parement d'un moellon recule sous le nu du mur (m, tiré entre ces bornes) ; `creux` : ce dont
  l'âme recule sous ce nu, de chaque côté (m) ;
- `harpe` : la longueur (m) des pierres de taille d'une chaîne, une assise sur deux la première puis la seconde, `None`
  sans chaîne ;
- `couronnement` : ses pierres posées de chant sur le corps du mur, leur `hauteur` (m), leur `largeur` (m, tirée),
  ce dont leur tête s'abaisse (`chute`, m, tirée jusqu'à cette borne), leur `relief` et leur `ondulation` (comme ceux
  d'un moellon), `None` sans couronnement."""
from geometrie import DEHORS, X, Repere, biais
from maille import lineaire

PIERRE, AME = "moellons", "ame"
MINCE = 0.1
"""La hauteur (m) sous laquelle un reste d'assise se fond dans sa voisine."""


class Appareil:
    """L'appareil d'une arête, bâti dans la maille `m` d'après `D`, ses tirages pris à `alea`. Une abscisse `a` se
    compte du milieu de l'arête, une hauteur `h` de son pied, dans le repère `R` de l'arête. Les assises se comptent
    du pied à la tête du corps du mur (`corps`), les mêmes pour toutes ses parties."""

    def __init__(self, D, m, alea):
        self.A, self.m, self.alea, self.R = D["APPAREIL"], m, alea, Repere((0, 0, 0), X, DEHORS)
        self.demi, self.haut, self.nu = D["LONGUEUR"] / 2, D["HAUTEUR"], D["EPAISSEUR"] / 2
        C = self.A["couronnement"]
        self.corps = self.haut - (C["hauteur"] if C else 0.0)
        nombre = max(1, round(self.corps / self.A["assise"]))
        self.lits = [self.corps * k / nombre for k in range(nombre + 1)]

    def pierre(self, a, h, relief=None, ondulation=0.0):
        """Une pierre entre les abscisses `a` et les hauteurs `h`, ses joints déduits hors des bouts et de la tête de
        l'arête : de taille, d'équerre au nu du mur, ou un moellon au parement en retrait (`relief`, ses bornes), aux
        coins écartés dans `ondulation`."""
        j = self.A["joint"] / 2
        recul = self.alea.uniform(*relief) if relief else 0.0
        gauche, droite = (x if abs(x) >= self.demi else x + s * j for x, s in zip(a, (1, -1)))
        tete = h[1] if h[1] >= self.haut else h[1] - j
        self.R.boite(self.m, (gauche, droite), (h[0] + j, tete), (recul - self.nu, self.nu - recul), PIERRE)
        if relief:
            o = ondulation / 2
            coins = [(self.alea.uniform(-o, o), self.alea.uniform(-o, o)) for _ in range(4)]
            self.m.v[-8:] = [(min(max(x + coins[k // 4 * 2 + k % 2][0], -self.demi), self.demi), y,
                              min(max(z + coins[k // 4 * 2 + k % 2][1], 0.0), self.haut))
                             for k, (x, y, z) in enumerate(self.m.v[-8:])]

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
        """Les pierres (gauche, droite, de taille) de l'assise de rang `k` entre les abscisses `a` ; `chaines` : si son
        bout gauche, puis son bout droit, portent une chaîne (`harpe`)."""
        H, (court, long) = self.A["harpe"], self.A["bloc"]
        tetes = [H[(k + cote) % 2] if H and chaine else 0.0 for cote, chaine in enumerate(chaines)]
        g, d = a[0] + tetes[0], a[1] - tetes[1]
        if d - g < court / 2:
            if not all(tetes):
                return [(a[0], a[1], any(tetes))]
            coupe = a[0] + (a[1] - a[0]) * tetes[0] / sum(tetes)
            return [(a[0], coupe, True), (coupe, a[1], True)]
        nombre = max(1, round((d - g) / ((court + long) / 2)))
        pas, phase = (d - g) / nombre, self.A["decalage"] * (k % 2)
        jeu = min((long - court) / 4, pas / 4)
        coupes = [g + (i + phase) * pas + self.alea.uniform(-jeu, jeu) for i in range(0 if phase else 1, nombre)]
        bornes = [g, *(c for c in coupes if g + court / 2 < c < d - court / 2), d]
        pierres = [(gauche, droite, False) for gauche, droite in zip(bornes, bornes[1:])]
        return ([(a[0], g, True)] if tetes[0] else []) + pierres + ([(d, a[1], True)] if tetes[1] else [])

    def dans_l_ame(self, a, h):
        """Le point `(a, h)` ramené sous les bouts et la tête de l'arête, que l'âme n'atteint pas."""
        creux = self.A["creux"]
        return (min(max(a, creux - self.demi), self.demi - creux), min(h, self.haut - creux))

    def ame(self, a, h):
        (gauche, _), (droite, tete) = self.dans_l_ame(a[0], h[1]), self.dans_l_ame(a[1], h[1])
        self.R.boite(self.m, (gauche, droite), (h[0], tete), (self.A["creux"] - self.nu, self.nu - self.A["creux"]),
                     AME)

    def pan(self, a, h, chaines=(False, False), garde=None):
        """Les assises du mur entre les abscisses `a` et les hauteurs `h`, sur leur âme ; `garde(gauche, droite,
        pied, tête)` dit quelles pierres restent, toutes sans elle, et l'âme est alors laissée à qui les garde."""
        if not garde:
            self.ame(a, h)
        for k, bas, haut in self.assises(h):
            for gauche, droite, taille in self.rang(a, k, chaines):
                if not garde or garde(gauche, droite, bas, haut):
                    self.pierre((gauche, droite), (bas, haut), None if taille else self.A["relief"],
                                self.A["ondulation"])

    def couronnement(self, a, garde=None):
        """Les pierres de chant du couronnement entre les abscisses `a`, la première à la hauteur du mur."""
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
                self.pierre((gauche, droite), (self.corps, self.haut - chute), None if premiere else C["relief"],
                            C["ondulation"])
            gauche, premiere = droite, False

    def mur(self, a, h, chaines=(False, False)):
        """Le mur entre les abscisses `a`, du pied `h[0]` à la hauteur `h[1]` ou, plus haut que son corps, à son
        couronnement."""
        self.pan(a, (h[0], min(h[1], self.corps)), chaines)
        if h[1] > self.corps:
            self.couronnement(a)

    def breche(self, contour, plancher):
        """Le mur éventré jusqu'à sa tête : `contour`, à chaque abscisse (fraction de la demi-longueur, d'un bout à
        l'autre de l'arête), la hauteur (fraction de celle du mur) où son âme s'arrête, au moins à `plancher` (m) ; une
        pierre reste si son milieu est sous elle."""
        def crete(x):
            return self.haut * lineaire(contour, x / self.demi)

        def garde(gauche, droite, pied, tete):
            return (pied + tete) / 2 <= crete((gauche + droite) / 2)
        bords = [self.dans_l_ame(part * self.demi, max(crete(part * self.demi), plancher)) for part, _ in contour]
        for (g, tete_g), (d, tete_d) in zip(bords, bords[1:]):
            biais(self.m, (g, d), (0.0, tete_g), (0.0, tete_d), (self.A["creux"] - self.nu, self.nu - self.A["creux"]),
                  AME)
        self.pan((-self.demi, self.demi), (0.0, self.corps), (True, True), garde)
        self.couronnement((-self.demi, self.demi), garde)
