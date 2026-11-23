"""Kit du sceau de cire et de sa bande de parchemin écrite (#3867, #4394) : le sceau du Prêtre sur sa bure, celui du
masque de cuir du Gladiateur.

- `Cadre` : le repère cylindrique autour d'un axe vertical, où chaque nappe se décrit sur ses paramètres (abscisse `g` le
  long du porteur, hauteur `z`) par sa distance `rho` à l'axe ;
- `Grille` : une nappe de parchemin sur ces paramètres, relevée (`relever`) au-dessus de ce qu'elle couvre ;
- `Ruban` : la bande en queue d'aronde qui pend sous le sceau, et les mots qui la descendent ;
- `sceau` : le disque bombé tourné autour de la normale du porteur, son cachet en creux ;
- `encre` : un trait d'encre par mot, à son jeu au-dessus de son parchemin, coupé à sa grille pour en suivre la surface.

Toute cote vient du `donnees.py` de l'élément (`SCEAU`, `CACHET`, `RUBAN`, `ECRITURE`).
"""
import math

import numpy as np

from maille import revolution
from tente import HAUT
from tissu import Maillage, direction, emprunter, sur_le_porteur, unitaire


def quads(colonnes):
    """Les triangles de la grille `colonnes` (indices de sommet, colonne par colonne), deux par maille, comme
    `Maillage.quad`."""
    tris = []
    for c0, c1 in zip(colonnes, colonnes[1:]):
        for j in range(len(c0) - 1):
            a, b, c, d = c0[j], c1[j], c1[j + 1], c0[j + 1]
            tris += [(a, b, c), (a, c, d)]
    return np.array(tris)


def dans_la_grille(uv, tris, points):
    """Par point de `points` (paramètres), le triangle de la grille de paramètres `uv` qui le contient (-1 hors d'elle)
    et ses coordonnées barycentriques."""
    dedans, bary = np.full(len(points), -1), np.zeros((len(points), 3))
    for t, (a, b, c) in enumerate(tris):
        m = np.array([uv[b] - uv[a], uv[c] - uv[a]]).T
        if abs(np.linalg.det(m)) < 1e-12:
            continue
        l = np.linalg.solve(m, (points - uv[a]).T).T
        w = np.column_stack([1 - l.sum(axis=1), l])
        pris = (w >= -1e-9).all(axis=1) & (dedans < 0)
        dedans[pris], bary[pris] = t, w[pris]
    return dedans, bary


def relever(uv, rho, tris, points, distances, marge):
    """`rho` (distance à l'axe par sommet de la grille) relevé pour passer à `marge` au moins devant chaque point de
    `points` à `distances` de l'axe : chaque sommet monte du plus grand manque des triangles qui le portent, et chaque
    point de ces triangles monte d'autant au moins."""
    dedans, bary = dans_la_grille(uv, tris, points)
    manque = np.zeros(len(tris))
    for t, w, r in zip(dedans, bary, distances):
        if t >= 0:
            manque[t] = max(manque[t], r + marge - w @ rho[tris[t]])
    monte = np.zeros(len(rho))
    for t in np.flatnonzero(manque > 0):
        monte[tris[t]] = np.maximum(monte[tris[t]], manque[t])
    return rho + monte


def mots_d_une_ligne(longueurs, debut, fin, espace, barrees):
    """Les mots (début, fin) de longueurs `longueurs` posés de `debut` vers `fin` à `espace` l'un de l'autre, chacun
    reporté au-delà de chaque intervalle de `barrees` qu'il toucherait ; la ligne s'arrête au premier qui dépasse `fin`."""
    mots, g = [], debut
    for longueur in longueurs:
        for a, z in sorted(barrees):
            if g < z and g + longueur > a:
                g = z
        if g + longueur > fin:
            break
        mots.append((g, g + longueur))
        g += longueur + espace
    return mots


def trait(centres, travers, demi):
    """Les paramètres des deux bords d'un trait de milieu `centres` (paramètres), à `demi` de part et d'autre le long de
    `travers`."""
    return [(c - demi * travers, c + demi * travers) for c in np.asarray(centres, dtype=float)]


def azimut(centre, Q):
    """L'azimut (degrés, depuis l'avant -Y vers la gauche +X) de chaque point de `Q` autour de l'axe vertical par
    `centre`."""
    return np.degrees(np.arctan2(Q[:, 0] - centre[0], centre[1] - Q[:, 1]))


class Cadre:
    """Le repère cylindrique autour de l'axe vertical par `centre` (z nul), tourné vers l'azimut `azimut` ; son `rayon`,
    la distance à l'axe du `porteur` à cet azimut et à la `hauteur` ; `dessous`, les paramètres et la distance à l'axe de
    chaque sommet du porteur, ce que toute nappe couvre. Les visées vers le porteur partent de `portee` de l'axe."""

    def __init__(self, porteur, centre, azimut_, hauteur, portee):
        self.porteur, self.centre, self.azimut, self.portee = porteur, centre, azimut_, portee
        d0 = np.array([*direction(azimut_), 0.0])
        self.rayon = (sur_le_porteur(porteur, centre + HAUT * hauteur, d0, portee)[0] - centre) @ d0
        Q = porteur['P'][np.unique(porteur['T'])]
        self.dessous = (np.column_stack([np.radians((azimut(centre, Q) - azimut_ + 180) % 360 - 180) * self.rayon,
                                         Q[:, 2]]),
                        np.linalg.norm(Q[:, :2] - centre[:2], axis=1))

    def vers(self, g):
        """Direction horizontale de l'abscisse `g` (m, le long du porteur vers la gauche du personnage depuis l'azimut du
        cadre)."""
        return np.array([*direction(self.azimut + math.degrees(g / self.rayon)), 0.0])

    def sur(self, g, z):
        """Distance à l'axe du porteur à l'abscisse `g` et à la hauteur `z`, et sa normale."""
        p, n = sur_le_porteur(self.porteur, self.centre + HAUT * z, self.vers(g), self.portee)
        return (p - self.centre) @ self.vers(g), n

    def position(self, g, z, rho):
        return self.centre + HAUT * z + self.vers(g) * rho


class Grille:
    """Une nappe sur les paramètres d'un `Cadre` : `uv` (abscisse, hauteur) par sommet, `colonnes` (indices de sommet,
    colonne par colonne), leurs triangles `tris` (`quads`) et `rho`, la distance à l'axe par sommet."""

    def __init__(self, uv, colonnes, rho):
        self.uv, self.colonnes, self.tris, self.rho = np.array(uv), colonnes, quads(colonnes), np.array(rho)

    def relever(self, points, distances, marge):
        """`rho` relevé à `marge` au moins devant chaque point de `points` (paramètres) à `distances` de l'axe
        (`relever`)."""
        self.rho = relever(self.uv, self.rho, self.tris, points, distances, marge)

    def sous(self, points):
        """La distance à l'axe de la grille sous chaque point de `points` (paramètres), `None` hors d'elle."""
        dedans, bary = dans_la_grille(self.uv, self.tris, points)
        return [w @ self.rho[self.tris[t]] if t >= 0 else None for t, w in zip(dedans, bary)]

    def nappe(self, b, cadre, nom, mat, epaisseur):
        """La double nappe `nom` (`Base.nappe`) d'`epaisseur`, chaque sommet aux poids du porteur du `cadre` sous lui."""
        M = Maillage()
        M.ajouter([cadre.position(g, z, r) for (g, z), r in zip(self.uv, self.rho)], None)
        for c0, c1 in zip(self.colonnes, self.colonnes[1:]):
            for j in range(len(c0) - 1):
                M.quad(c0[j], c1[j], c1[j + 1], c0[j + 1], cadre.centre + HAUT * self.uv[c0[j]][1])
        X, orientes, normales = M.orienter()
        return b.nappe(nom, X, normales, [emprunter(p, cadre.porteur)[0] for p in X], orientes, mat, epaisseur)


class Ruban:
    """La bande `RUBAN` qui pend du sceau de `rayon` centré en (`g`, `z`) sur le `cadre` : trois colonnes de la gauche du
    personnage à sa droite, la pointe du milieu remontée en queue d'aronde ; sa `grille` à `marge` du porteur."""

    def __init__(self, R, cadre, g, z, rayon, marge):
        self.R, self.cadre, self.g, self.z, self.rayon = R, cadre, g, z, rayon
        self.haut, self.long = z + rayon / 2, R['longueur'] + rayon / 2
        m = R['segments']
        uv = [(g - R['derive'] * (j / m) ** 2 + c * R['largeur'] / 2,
               self.haut - self.long * j / m + (R['aronde'] if j == m and c == 0 else 0.0))
              for c in (1, 0, -1) for j in range(m + 1)]
        self.grille = Grille(uv, [list(range(c * (m + 1), (c + 1) * (m + 1))) for c in range(3)],
                             [cadre.sur(gu, zu)[0] + marge for gu, zu in uv])
        self.grille.relever(*cadre.dessous, marge)

    def milieu(self, z):
        """L'abscisse du milieu de la bande à la hauteur `z`."""
        t = (self.haut - z) / self.long
        return self.g - self.R['derive'] * t ** 2

    def sous_le_sceau(self):
        """Le point de la bande sous le centre du sceau et la normale du porteur sous lui."""
        p = np.array([(self.g, self.z)])
        return self.cadre.position(self.g, self.z, self.grille.sous(p)[0]), self.cadre.sur(self.g, self.z)[1]

    def mots(self, lignes, E):
        """Les traits (`encre`) des mots `lignes` (par décalage, m, depuis le milieu de la bande vers la gauche du
        personnage, les longueurs de ses mots) qui la descendent de `E['autour']` sous le sceau à la queue d'aronde, coupés
        à ses rangs."""
        t_haut = (self.rayon * 1.5 + E['autour']) / self.long
        t_bas = 1 - (self.R['aronde'] + E['autour']) / self.long
        m = self.R['segments']
        coupes = [j / m for j in range(m + 1)]
        traits = []
        for decalage, longueurs in lignes.items():
            for t0, t1 in mots_d_une_ligne([l / self.long for l in longueurs], t_haut, t_bas, E['espace'] / self.long,
                                           []):
                t = [t0, *(c for c in coupes if t0 < c < t1), t1]
                centres = [(self.milieu(self.haut - self.long * x) + decalage, self.haut - self.long * x) for x in t]
                traits.append((trait(centres, np.array([1.0, 0.0]), E['trait'] / 2), self.grille))
        return traits


def sceau(b, cadre, S, C, o, axe, mat, angle_vif):
    """Le sceau `S` (`rayon`, `epaisseur`, `segments`) posé en `o` : un profil (hauteur le long d'`axe`, rayon) tourné
    autour d'`axe` (`revolution`), son cachet `C` (`rayon` en fraction du sien, `creux`) en creux ; en bloc aux poids du
    porteur du `cadre` sous `o`."""
    u = unitaire(HAUT - (HAUT @ axe) * axe)
    v = np.cross(axe, u)
    e, r = S['epaisseur'], S['rayon']
    sommets, faces = revolution([(0.0, 0), (0.0, r), (e * 0.5, r), (e, r * 0.85), (e, r * C['rayon']),
                                    (e - C['creux'], r * C['rayon'] * 0.85), (e - C['creux'], 0)],
                                   (axe, u, v), o, S['segments'])
    return b.nappe_simple('sceau', sommets, faces,
                          [emprunter(o, cadre.porteur)[0]] * len(sommets), mat, angle_vif=angle_vif)


def encre(b, cadre, traits, jeu, mat):
    """La nappe `encre` des `traits` (les bords d'un trait, `trait`, et la `Grille` de son parchemin), chacun à `jeu`
    au-dessus de son parchemin, chaque sommet aux poids du porteur du `cadre` sous lui ; un mot hors de son parchemin, une
    erreur."""
    M = Maillage()
    for bords, grille in traits:
        points = np.array([p for paire in bords for p in paire])
        dedans, bary = dans_la_grille(grille.uv, grille.tris, points)
        if (dedans < 0).any():
            raise ValueError(f'un mot sort de son parchemin : {points[dedans < 0].tolist()}')
        rho = np.einsum('ij,ij->i', bary, grille.rho[grille.tris[dedans]]) + jeu
        indices = M.ajouter([cadre.position(g, z, r) for (g, z), r in zip(points, rho)], None)
        for k in range(len(bords) - 1):
            a, b_, c, d = indices[2 * k], indices[2 * k + 2], indices[2 * k + 3], indices[2 * k + 1]
            M.quad(a, b_, c, d, cadre.centre + HAUT * points[2 * k][1])
    X, orientes, _ = M.orienter()
    return b.nappe_simple('encre', [tuple(p) for p in X], [tuple(t) for t in orientes],
                          [emprunter(p, cadre.porteur)[0] for p in X], mat)
