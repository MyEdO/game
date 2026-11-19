"""Géométrie de `humanoide--armure--casque` (`element/tissu.py`) : un casque d'acier ouvert, rigide sur l'os de la tête.

- La coque : calotte, joues et couvre-nuque d'un seul tenant, une grille de colonnes en azimut et de rangs du bord de la
  colonne (`BORD`) au haut de la calotte, éventail au sommet ; un ellipsoïde au-dessus du centre du crâne, le rayon de
  l'équateur corrigé par `PROFIL_BAS` au-dessous, tenu partout au `JEU` de la peau de la tête publiée ; le bord finit en
  lèvre retroussée (`LEVRE`), visière au front. Double nappe.
- Le bandeau : un tore à section aplatie qui tourne le long du tour, deux cordons torsadés, l'un d'acier, l'autre noir.
- Le fleuron : une rosette, chaton d'acier festonné en pétales, et son médaillon bombé, au front, sur le bandeau.
- L'emplacement `cimier`, offert sur la coque à l'avant-haut de la calotte (`CIMIER`).

Silhouettes et clés `gabarit_*` transférées des zones de la tête. Toute cote vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from tissu import Maillage, direction, joindre, maillage_skinne, selon

HAUT = np.array([0.0, 0.0, 1.0])


def radiale(phi):
    x, y = direction(phi)
    return np.array([x, y, 0.0])


class Coque:
    """La surface extérieure de la coque autour du centre `C`, tenue au jeu de la peau `peau`."""

    def __init__(self, D, C, peau):
        self.D, self.C, self.peau = D, C, peau
        self.jeu = D['JEU'] + D['EPAISSEUR']

    def equateur(self, phi):
        a = self.D['DEMI_AXES']
        s, c = math.sin(math.radians(phi)), math.cos(math.radians(phi))
        return 1.0 / math.hypot(s / a['cote'], c / (a['avant'] if c > 0 else a['arriere']))

    def point(self, phi, h):
        """Le point de la coque à l'azimut `phi` et à la hauteur `h` au-dessus du centre."""
        D = self.D
        if h >= 0:
            rho = self.equateur(phi) * math.sqrt(max(0.0, 1.0 - (h / D['DEMI_AXES']['haut']) ** 2))
        else:
            rho = self.equateur(phi) + float(np.interp(-h / D['DESCENTE'], *zip(*D['PROFIL_BAS'])))
        p = self.C + rho * radiale(phi) + h * HAUT
        # Au-dessus du centre, la peau se vise vers le centre ; au-dessous, à l'horizontale vers l'axe.
        origine = self.C if h >= 0 else self.C + h * HAUT
        d = p - origine
        portee = float(np.linalg.norm(d))
        d /= portee
        touche = self.peau.ray_cast(Vector((origine + 0.3 * d).tolist()), Vector((-d).tolist()), 0.3)[0]
        if touche is not None:
            portee = max(portee, float(np.linalg.norm(np.array(touche) - origine)) + self.jeu)
        return origine + portee * d

    def hauteur(self, u):
        """La hauteur au-dessus du centre à l'abscisse `u` du méridien (comptée du centre, négative au-dessous)."""
        haut = self.D['DEMI_AXES']['haut']
        return u if u < 0 else haut * math.sin(u / haut)

    def abscisse(self, h):
        haut = self.D['DEMI_AXES']['haut']
        return h if h < 0 else haut * math.asin(h / haut)

    def a_l_elevation(self, phi, e):
        """Le point de la coque à l'azimut `phi`, à l'élévation `e` (degrés) vue du centre, au-dessus de lui."""
        haut = self.D['DEMI_AXES']['haut']
        psi = math.atan(math.tan(math.radians(e)) * self.equateur(phi) / haut)
        return self.point(phi, haut * math.sin(psi))


def coque(D, b, forme, mat):
    n, m = D['COLONNES'], D['RANGS']
    phis = [-180.0 + 360.0 * k / n for k in range(n)]
    haut = D['DEMI_AXES']['haut']
    u_haut = haut * math.radians(D['ELEVATION_HAUTE'])
    M = Maillage()
    levre, rangs = [], [[] for _ in range(m)]
    for phi in phis:
        u_bord = forme.abscisse(selon(D['BORD'], phi))
        for j in range(m):
            rangs[j].append(forme.point(phi, forme.hauteur(u_bord + (u_haut - u_bord) * j / (m - 1))))
        pente = math.radians(selon(D['PENTE_DE_LA_LEVRE'], phi))
        levre.append(rangs[0][-1] + selon(D['LEVRE'], phi) * (math.cos(pente) * radiale(phi) + math.sin(pente) * HAUT))
    anneaux = [M.ajouter(points, 'coque') for points in [levre] + rangs]
    for A, B in zip(anneaux, anneaux[1:]):
        M.bande(A, B, forme.C)
    pole = M.ajouter([forme.point(0.0, haut)], 'coque')[0]
    for k in range(n):
        M.triangle(anneaux[-1][k], anneaux[-1][(k + 1) % n], pole, forme.C)
    X, orientes, normales = M.orienter()
    W = np.zeros((len(X), len(b.os)))
    W[:, b.indice_os[D['OS']]] = 1.0
    return b.nappe('casque', X, normales, W, orientes, mat, D['EPAISSEUR'])


def solide(D, b, nom, M, mat):
    """Le maillage `M`, fermé, lié rigide à l'os du casque."""
    X, faces, _ = M.orienter()
    objet = maillage_skinne(nom, [tuple(p) for p in X], [tuple(f) for f in faces], mat, b.rig, [{D['OS']: 1.0}] * len(X))
    for polygone in objet.data.polygons:
        polygone.use_smooth = True
    return objet


def bandeau(D, b, forme, mat, cordon):
    """Le tore aplati qui tourne le long du tour ; la moitié de chaque section, de part et d'autre du grand axe, est un
    cordon : l'une d'acier (`mat`), l'autre de `cordon`, et la torsion les fait alterner."""
    t = D['BANDEAU']
    M = Maillage()
    centres, anneaux = [], []
    for k in range(t['segments']):
        phi = -180.0 + 360.0 * k / t['segments']
        centre = forme.point(phi, t['hauteur']) + (1.0 - t['enfoncement']) * t['rayon'] * radiale(phi)
        tour = math.pi * t['tours'] * k / t['segments']
        grand = math.cos(tour) * radiale(phi) + math.sin(tour) * HAUT
        petit = -math.sin(tour) * radiale(phi) + math.cos(tour) * HAUT
        points = [centre + t['rayon'] * (math.cos(a) * grand + t['aplat'] * math.sin(a) * petit)
                  for a in np.linspace(0.0, 2 * math.pi, t['cotes'], endpoint=False)]
        centres.append(centre)
        anneaux.append(M.ajouter(points, 'bandeau'))
    for k in range(t['segments']):
        suivant = (k + 1) % t['segments']
        M.bande(anneaux[k], anneaux[suivant], 0.5 * (centres[k] + centres[suivant]))
    objet = solide(D, b, 'bandeau', M, mat)
    objet.data.materials.append(cordon)
    # `Maillage.bande` : le côté i de la section k porte les triangles 2 (k cotes + i) et 2 (k cotes + i) + 1.
    for polygone in objet.data.polygons:
        if (polygone.index // 2) % t['cotes'] < t['cotes'] // 2:
            polygone.material_index = 1
    return objet


def fleuron(D, b, forme, metal, medaillon):
    f = D['FLEURON']
    pied = forme.point(f['azimut'], f['hauteur'])
    normale = pied - forme.C
    normale /= np.linalg.norm(normale)
    u = np.cross(HAUT, normale)
    u /= np.linalg.norm(u)
    v = np.cross(normale, u)

    def cercle(rayon, saillie, cotes=f['cotes'], festons=0.0):
        return [pied + saillie * normale + rayon * (1.0 - festons * (k % 2)) * (math.cos(a) * u + math.sin(a) * v)
                for k, a in enumerate(np.linspace(0.0, 2 * math.pi, cotes, endpoint=False))]

    dedans = pied - f['rayon_du_chaton'] * normale
    chaton = Maillage()
    n = 2 * f['petales']
    anneaux = [chaton.ajouter(cercle(r, s, n, e), 'chaton') for r, s, e in (
        (f['rayon_du_chaton'], -0.3 * f['saillie_du_chaton'], f['festons']),
        (f['rayon_du_chaton'], f['saillie_du_chaton'], f['festons']),
        (f['rayon_du_medaillon'], f['saillie_du_chaton'], 0.0))]
    for A, B in zip(anneaux, anneaux[1:]):
        chaton.bande(A, B, dedans)
    pierre = Maillage()
    bas = pierre.ajouter(cercle(f['rayon_du_medaillon'], f['saillie_du_chaton']), 'medaillon')
    mi = pierre.ajouter(cercle(0.6 * f['rayon_du_medaillon'],
                               f['saillie_du_chaton'] + 0.75 * (f['saillie_du_medaillon'] - f['saillie_du_chaton'])), 'medaillon')
    pierre.bande(bas, mi, dedans)
    sommet = pierre.ajouter([pied + f['saillie_du_medaillon'] * normale], 'medaillon')[0]
    for k in range(f['cotes']):
        pierre.triangle(mi[k], mi[(k + 1) % f['cotes']], sommet, dedans)
    return [solide(D, b, 'chaton', chaton, metal), solide(D, b, 'medaillon', pierre, medaillon)]


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    P, T, _ = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE'])
    peau = BVHTree.FromPolygons([tuple(p) for p in P], T.tolist(), all_triangles=True)
    forme = Coque(D, np.array(b.tete(D['OS'])) + np.asarray(D['CENTRE'], float), peau)
    piece = joindre([coque(D, b, forme, materiaux['metal']), bandeau(D, b, forme, materiaux['metal'], materiaux['cordon']),
                     *fleuron(D, b, forme, materiaux['metal'], materiaux['fleuron'])])
    piece.name = D['MANIFESTE']['cle']['piece']

    c = D['CIMIER']
    i = math.radians(c['inclinaison'])
    w = np.zeros(len(b.os))
    w[b.indice_os[D['OS']]] = 1.0
    b.offrir('cimier', w, forme.a_l_elevation(c['azimut'], c['elevation']),
             [(1.0, 0.0, 0.0), (0.0, math.sin(i), math.cos(i)), (0.0, -math.cos(i), math.sin(i))])

    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
