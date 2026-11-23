"""Casque rigide sur l'os de la tête (#4318, #4394) : ce que partagent les casques d'`element/<base>/armure--casque*/`.

- `Coque` : la surface extérieure d'une coque autour du centre du crâne, une surface de révolution déformée (un
  ellipsoïde `DEMI_AXES` au-dessus du centre, le rayon de l'équateur corrigé par `PROFIL_BAS` au-dessous), tenue partout
  au `JEU` de la peau de la tête publiée que le casque contourne.
- `rigide` : les poids d'une partie liée au seul os `OS` ; `solide` : un maillage fermé lié de même.
- `fleuron` : une rosette au flanc de la coque, chaton festonné (`petales`, `festons`) et médaillon bombé (`FLEURON`).
- `offrir_le_cimier` : l'emplacement `cimier` (`CIMIER`), sur la coque.

Toute cote vient du `donnees.py` de l'élément.
"""
import math

import numpy as np

from maille import revolution
from tente import HAUT
from tissu import Maillage, direction, viser


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
        touche = viser(self.peau, origine, d, 0.3)[0]
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


def rigide(D, b, n):
    """Les poids de `n` sommets liés rigides à l'os du casque."""
    W = np.zeros((n, len(b.os)))
    W[:, b.indice_os[D['OS']]] = 1.0
    return W


def solide(D, b, nom, M, mat, teintes=()):
    """Le maillage `M`, fermé, lié rigide à l'os du casque, au matériau `mat`, chaque triangle à celui de `teintes` qui
    n'est pas `None`."""
    X, faces, _ = M.orienter()
    return b.nappe_simple(nom, [tuple(p) for p in X], [tuple(f) for f in faces], rigide(D, b, len(X)), mat, teintes)


def fleuron(D, b, forme, metal, medaillon):
    f = D['FLEURON']
    pied = forme.point(f['azimut'], f['hauteur'])
    normale = pied - forme.C
    normale /= np.linalg.norm(normale)
    u = np.cross(HAUT, normale)
    u /= np.linalg.norm(u)
    v = np.cross(normale, u)

    repere = (normale, u, v)
    dedans = pied - f['rayon_du_chaton'] * normale
    n = 2 * f['petales']
    feston = [f['rayon_du_chaton'] * (1.0 - f['festons'] * (k % 2)) for k in range(n)]
    chaton, pierre = Maillage(), Maillage()
    for M, partie, profil, cotes in (
            (chaton, 'chaton', [(-0.3 * f['saillie_du_chaton'], feston), (f['saillie_du_chaton'], feston),
                                (f['saillie_du_chaton'], f['rayon_du_medaillon'])], n),
            (pierre, 'medaillon', [(f['saillie_du_chaton'], f['rayon_du_medaillon']),
                                   (f['saillie_du_chaton'] + 0.75 * (f['saillie_du_medaillon'] - f['saillie_du_chaton']),
                                    0.6 * f['rayon_du_medaillon']),
                                   (f['saillie_du_medaillon'], 0)], f['cotes'])):
        M.ajouter_faces(*revolution(profil, repere, pied, cotes), partie, dedans)
    return [solide(D, b, 'chaton', chaton, metal), solide(D, b, 'medaillon', pierre, medaillon)]


def offrir_le_cimier(D, b, forme):
    """Offre l'emplacement `cimier` : sur la coque, à l'azimut et à l'élévation de `CIMIER` ; son axe Y est la verticale
    inclinée d'`inclinaison` degrés vers l'arrière, son axe X la gauche du personnage."""
    c = D['CIMIER']
    i = math.radians(c['inclinaison'])
    b.offrir('cimier', rigide(D, b, 1)[0], forme.a_l_elevation(c['azimut'], c['elevation']),
             [(1.0, 0.0, 0.0), (0.0, math.sin(i), math.cos(i)), (0.0, -math.cos(i), math.sin(i))])
