"""Géométrie de `humanoide--rigide--parchemin` : une feuille enroulée en spirale le long du +Y de la prise, centrée sur
l'origine, son dos sur z = 0, ceinte d'un lien en son milieu."""
import math

from maille import Maille, objet, tour


def feuille_enroulee(m, D, centre):
    """La feuille : un ruban dont la section, dans le plan xz, suit la spirale `SPIRE`, étiré sur `LONGUEUR` le long
    de y."""
    S, demi = D['SPIRE'], D['LONGUEUR'] / 2
    n = S['tours'] * S['segments']
    coeur = D['RAYON'] * S['coeur']
    sommets, faces = [], []
    for i in range(n + 1):
        t = 2 * math.pi * i / S['segments']
        dehors = coeur + (D['RAYON'] - coeur) * i / n
        for r in (dehors, dehors - S['feuille']):
            for y in (-demi, demi):
                sommets.append((centre[0] + r * math.cos(t), y, centre[2] + r * math.sin(t)))
    for i in range(n):
        a, b = 4 * i, 4 * (i + 1)
        faces += [[a, a + 1, b + 1, b], [a + 2, b + 2, b + 3, a + 3], [a, b, b + 2, a + 2], [a + 1, a + 3, b + 3, b + 1]]
    faces += [[0, 2, 3, 1], [4 * n, 4 * n + 1, 4 * n + 3, 4 * n + 2]]
    m.ajouter(sommets, faces, 'parchemin')


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    L = D['LIEN']
    r = D['RAYON'] + L['saillie']
    centre = (0.0, 0.0, r)
    feuille_enroulee(m, D, centre)
    tour(m, [(-L['largeur'] / 2, D['RAYON'] - D['SPIRE']['feuille']), (-L['largeur'] / 2, r), (L['largeur'] / 2, r),
             (L['largeur'] / 2, D['RAYON'] - D['SPIRE']['feuille'])], 'y', centre, L['segments'], 'lien')
    return [objet('humanoide--rigide--parchemin', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
