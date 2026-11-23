"""Le drapé pendant d'une manche (#4697) : chaque brin pend sous sa racine, que porte l'avant-bras, et s'écarte de ce
qu'il rencontre.

Un brin est fait de `K` os rigides. Chaque os part de la direction où il tend, puis tourne autour de son départ tant
qu'un de ses points est à moins du jeu d'un obstacle : une peau (le plan tangent de son sommet le plus proche), un fût
(une capsule), le sol. Un os pris de face tourne vers le dégagement de son brin. Le tissu lie enfin les brins
voisins : les bouts de deux os liés qui s'écartent de plus que leur lien se tirent l'un vers l'autre, puis ressortent
de ce qu'ils rencontrent.

D'un instant au suivant, un os tend vers la direction qu'il avait, revenue vers l'aplomb d'une part (`vers_l_aplomb`) :
il reste du côté de l'obstacle où il était, ne rentre dans aucun, et retombe peu à peu quand l'obstacle le lâche. Il
peut tendre aussi vers une direction lissée d'une image à ses voisines, à un jeu moindre (`filets.Manche.cuire`).
Repère de l'armature : +Z le haut.
"""
import numpy as np

BAS = np.array([0.0, 0.0, -1.0])
JEU_M = 0.02
"""Écart qu'un os garde à ce qu'il longe, en mètres, d'un instant au suivant."""
PAS = 5
"""Points par os où se lit sa distance aux obstacles, de son départ à son bout."""
TOURS = 24
"""Tours de dégagement par os."""
VOISINAGE_M = 0.02
"""Distance, en mètres, sur laquelle le plan tangent d'une peau se fond de son sommet le plus proche à ses voisins."""
DEPART_M = 0.06
"""Longueur de brin, depuis sa racine, sur laquelle le jeu qu'il doit à un obstacle croît de 0 à son jeu."""
RETOUR = 0.3
"""Part de l'angle qui sépare un os de l'aplomb dont il revient d'une image à la suivante (HYPOTHÈSE : un pan de 0,3 m
lâché à l'horizontale pend à 5° de l'aplomb en 8 images, le quart de la période de son pendule)."""
TOUCHE_M = 0.001
"""Enfoncement, en mètres, sous lequel un os ne touche pas."""
PORTEE_M = 0.08
"""Distance au-delà du bout d'un os, en mètres, sous laquelle il voit un sommet de peau."""
DEGAGEMENT = 0.05
"""Part de l'enfoncement d'un os dont il tourne vers le dégagement de son brin."""
LIENS = 8
"""Tours où les os liés se tirent l'un vers l'autre."""


class Peaux:
    """Des surfaces orientées : leurs sommets `P` (n, 3), leurs normales unitaires sortantes `N` (n, 3)."""

    def __init__(self, P, N):
        self.P, self.N = P, N

    def pres(self, centres, rayons):
        """La part de la surface à moins de `rayons` (S,) d'un des `centres` (S, 3)."""
        garde = (np.linalg.norm(self.P[:, None, :] - centres[None], axis=2) < rayons[None]).any(axis=1)
        return Peaux(self.P[garde], self.N[garde])

    def poussee(self, q, jeux):
        """Par point de `q` (m, 3), ce dont il doit bouger pour sortir de son jeu `jeux` (m,) de la surface : le long de
        la normale du plan tangent, fondu autour du sommet le plus proche."""
        if not len(self.P):
            return np.zeros_like(q)
        ecarts = q[:, None, :] - self.P[None]
        d2 = np.einsum('mnc,mnc->mn', ecarts, ecarts)
        w = np.exp(-(d2 - d2.min(axis=1, keepdims=True)) / VOISINAGE_M ** 2)
        w /= w.sum(axis=1, keepdims=True)
        normales = w @ self.N
        normales /= np.maximum(np.linalg.norm(normales, axis=1, keepdims=True), 1e-9)
        distances = np.einsum('mn,mn->m', w, np.einsum('mnc,nc->mn', ecarts, self.N))
        return np.maximum(jeux - distances, 0.0)[:, None] * normales


class Fut:
    """Une capsule de `a` à `b`, de rayon `r`."""

    def __init__(self, a, b, r):
        self.a, self.b, self.r = a, b, r

    def pres(self, centres, rayons):
        return self

    def poussee(self, q, jeux):
        axe = self.b - self.a
        t = np.clip((q - self.a) @ axe / (axe @ axe), 0.0, 1.0)
        ecarts = q - (self.a + t[:, None] * axe)
        distances = np.maximum(np.linalg.norm(ecarts, axis=1), 1e-9)
        return np.maximum(jeux + self.r - distances, 0.0)[:, None] * ecarts / distances[:, None]


class Sol:
    """Le sol à la hauteur `z`."""

    def __init__(self, z):
        self.z = z

    def pres(self, centres, rayons):
        return self

    def poussee(self, q, jeux):
        return np.maximum(self.z - q[:, 2], 0.0)[:, None] * -BAS


def vers_l_aplomb(d, degagements, images):
    """Les directions unitaires `d` (S, K, 3) revenues vers l'aplomb en `images` images, de `RETOUR` de l'arc qui les en
    sépare par image ; l'arc qui passe par le dégagement de son brin (`degagements`, (S, 3)) pour une direction
    dressée."""
    d = np.where((d @ BAS < -1.0 + 1e-9)[..., None], d + 1e-4 * degagements[:, None, :], d)
    d = d / np.linalg.norm(d, axis=2, keepdims=True)
    angle = np.arccos(np.clip(d @ BAS, -1.0, 1.0))
    sinus = np.maximum(np.sin(angle), 1e-12)
    reste = (1 - RETOUR) ** images
    revenu = np.where((angle > 1e-9)[..., None], (np.sin(reste * angle) / sinus)[..., None] * d + (np.sin((1 - reste) * angle) / sinus)[..., None] * BAS, d)
    return revenu / np.linalg.norm(revenu, axis=2, keepdims=True)


def pendre(racines, longueurs, vers, degagements, obstacles, liens, jeu=JEU_M):
    """Les articulations (S, K+1, 3) des brins de `racines` (S, 3) et d'os de `longueurs` (S, K). `vers` (S, K, 3) : par
    os, la direction unitaire où il tend ; `degagements` (S, 3) : par brin, la direction unitaire où tourne un os pris
    de face ; `obstacles` : ce qui rend une `poussee` ; `liens` : les paires (P, 2) de brins que lie le tissu et, par os,
    l'écart (P, K) que leurs bouts ne passent pas ; `jeu` : l'écart, en mètres, qu'un os garde à ce qu'il longe."""
    S, K = longueurs.shape
    paires, ecarts = liens
    x = np.zeros((S, K + 1, 3))
    x[:, 0] = racines
    parts = np.arange(1, PAS + 1) / PAS
    parcouru = np.zeros(S)
    for k in range(K):
        L = longueurs[:, k]
        bras = (parts[None, :] * L[:, None])[:, :, None]
        jeux = (jeu * np.clip((parcouru[:, None] + bras[:, :, 0]) / DEPART_M, 0.0, 1.0)).ravel()
        proches = [o.pres(x[:, k], L + PORTEE_M) for o in obstacles]

        def poussees(d):
            q = (x[:, k, None, :] + bras * d[:, None, :]).reshape(-1, 3)
            return sum(o.poussee(q, jeux) for o in proches).reshape(S, PAS, 3)

        def degager(d):
            for _ in range(TOURS):
                poussee = poussees(d)
                enfoncement = np.linalg.norm(poussee, axis=2)
                total = enfoncement.sum(axis=1, keepdims=True)
                if total.max() < TOUCHE_M:
                    break
                poids = (enfoncement / np.maximum(total, 1e-12))[:, :, None]
                tour = (poids * (poussee + DEGAGEMENT * enfoncement[:, :, None] * degagements[:, None, :]) / bras).sum(axis=1)
                d = d + tour - np.einsum('sc,sc->s', tour, d)[:, None] * d
                d /= np.linalg.norm(d, axis=1, keepdims=True)
            return d

        d = degager(vers[:, k])
        for _ in range(LIENS):
            bouts = x[:, k] + L[:, None] * d
            entre = bouts[paires[:, 1]] - bouts[paires[:, 0]]
            distances = np.linalg.norm(entre, axis=1)
            exces = np.maximum(distances - ecarts[:, k], 0.0)
            if exces.max(initial=0.0) < TOUCHE_M:
                break
            tirs = (0.5 * exces / np.maximum(distances, 1e-12))[:, None] * entre
            tire, tires = np.zeros((S, 3)), np.zeros(S)
            np.add.at(tire, paires[:, 0], tirs)
            np.add.at(tire, paires[:, 1], -tirs)
            np.add.at(tires, paires.ravel(), np.repeat(exces > 0.0, 2))
            tire = bouts + tire / np.maximum(tires, 1.0)[:, None] - x[:, k]
            d = degager(tire / np.linalg.norm(tire, axis=1, keepdims=True))
        x[:, k + 1] = x[:, k] + L[:, None] * d
        parcouru += L
    return x
