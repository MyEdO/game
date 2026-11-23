"""Le drapé pendant d'une manche (#4697) : chaque brin pend d'aplomb sous sa racine, que porte l'avant-bras, et s'écarte
de ce qu'il rencontre. Fonction de la seule image : aucun état d'une image à l'autre, un clip qui
boucle rend un drapé qui boucle.

Un brin est fait de `K` os rigides. Chaque os part d'aplomb, puis tourne autour de son départ tant qu'un de ses points
est à moins du jeu d'un obstacle : une peau (le plan tangent de son sommet le plus proche), un fût (une capsule), le
sol. Un os pris de face tourne vers le dégagement de son brin. Il revient ensuite vers l'aplomb, sur l'arc qui l'en a
écarté, jusqu'où il touche encore.
Repère de l'armature : +Z le haut.
"""
import numpy as np

BAS = np.array([0.0, 0.0, -1.0])
JEU_M = 0.02
"""Écart gardé entre un os et ce qu'il longe, en mètres."""
PAS = 5
"""Points par os où se lit sa distance aux obstacles, de son départ à son bout."""
TOURS = 24
"""Tours de dégagement par os."""
VOISINAGE_M = 0.02
"""Distance, en mètres, sur laquelle le plan tangent d'une peau se fond de son sommet le plus proche à ses voisins."""
DEPART_M = 0.06
"""Longueur de brin, depuis sa racine, sur laquelle le jeu qu'il doit à un obstacle croît de 0 à `JEU_M`."""
RETOURS = 7
"""Pas de la dichotomie qui ramène un os vers l'aplomb."""
TOUCHE_M = 0.001
"""Enfoncement, en mètres, sous lequel un os ne touche pas."""
PORTEE_M = 0.08
"""Distance au-delà du bout d'un os, en mètres, sous laquelle il voit un sommet de peau."""
DEGAGEMENT = 0.05
"""Part de l'enfoncement d'un os dont il tourne vers le dégagement de son brin."""


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


def pendre(racines, longueurs, degagements, obstacles):
    """Les articulations (S, K+1, 3) des brins de `racines` (S, 3) et d'os de `longueurs` (S, K). `degagements` (S, 3) :
    par brin, la direction unitaire où tourne un os pris de face ; `obstacles` : ce qui rend une `poussee`."""
    S, K = longueurs.shape
    x = np.zeros((S, K + 1, 3))
    x[:, 0] = racines
    parts = np.arange(1, PAS + 1) / PAS
    parcouru = np.zeros(S)
    for k in range(K):
        L = longueurs[:, k]
        bras = (parts[None, :] * L[:, None])[:, :, None]
        jeux = (JEU_M * np.clip((parcouru[:, None] + bras[:, :, 0]) / DEPART_M, 0.0, 1.0)).ravel()
        proches = [o.pres(x[:, k], L + PORTEE_M) for o in obstacles]

        def poussees(d):
            q = (x[:, k, None, :] + bras * d[:, None, :]).reshape(-1, 3)
            return sum(o.poussee(q, jeux) for o in proches).reshape(S, PAS, 3)

        d = np.tile(BAS, (S, 1))
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
        angle = np.arccos(np.clip(d @ BAS, -1.0, 1.0))
        hors = d - (d @ BAS)[:, None] * BAS
        hors /= np.maximum(np.linalg.norm(hors, axis=1, keepdims=True), 1e-12)

        def sur_l_arc(part):
            return np.cos(part * angle)[:, None] * BAS + np.sin(part * angle)[:, None] * hors

        libre, pris = np.ones(S), np.zeros(S)
        for _ in range(RETOURS):
            milieu = (libre + pris) / 2
            touche = np.linalg.norm(poussees(sur_l_arc(milieu)), axis=2).max(axis=1) > TOUCHE_M
            pris, libre = np.where(touche, milieu, pris), np.where(touche, libre, milieu)
        x[:, k + 1] = x[:, k] + L[:, None] * sur_l_arc(libre)
        parcouru += L
    return x
