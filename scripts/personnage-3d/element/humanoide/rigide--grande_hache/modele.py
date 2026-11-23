"""Géométrie de `humanoide--rigide--grande_hache` : le manche de bois le long du +Y de la prise, centré sur
`AXE_DANS_LA_PRISE` (`base/anatomie.py`) ; au sommet, la douille, le croissant dans le plan du manche et du tranchant
(+Z), biseauté vers le fil, le bloc à trois pointes au dos (-Z) et le petit crâne ; les lanières en spirale et leurs
bouts libres ; au talon, la virole, la pointe en fer de lance et ses deux crochets (`donnees.py`)."""
import math

import numpy as np
from anatomie import AXE_DANS_LA_PRISE
from maille import Maille, boite, cylindre, objet, plaque, tour, tube


def croissant(m, D, centre_y):
    """Le fer : par colonne, du dos au fil, six sommets (dos, biseau, fil sur chaque face) ; les deux cornes fermées."""
    E_ = D['EPAISSEUR_FER']
    cu, cw = AXE_DANS_LA_PRISE

    def sommet(rh, x):
        return (cu + x, centre_y + rh[1], cw + rh[0])

    sommets = []
    for dos, fil in D['COLONNES']:
        d, f = np.array(dos), np.array(fil)
        ecart = np.linalg.norm(d - f)
        b = f + (d - f) * min(0.5, E_['largeur_biseau'] / ecart)
        part = min(1.0, ecart / E_['pleine_largeur'])
        sommets += [sommet(d, part * E_['dos'] / 2), sommet(b, part * E_['biseau'] / 2), sommet(f, E_['fil'] / 2),
                    sommet(f, -E_['fil'] / 2), sommet(b, -part * E_['biseau'] / 2), sommet(d, -part * E_['dos'] / 2)]
    n = len(D['COLONNES']) - 1
    faces = [[6 * i + k, 6 * i + (k + 1) % 6, 6 * (i + 1) + (k + 1) % 6, 6 * (i + 1) + k] for i in range(n) for k in range(6)]
    faces += [list(range(6)), [6 * n + k for k in range(5, -1, -1)]]
    m.ajouter(sommets, faces, 'metal')


def adoucir(chemin, pas):
    """La ligne brisée `chemin` (points de même dimension) adoucie : `pas` points par tronçon d'une courbe de
    Catmull-Rom par ses points."""
    p = np.array([chemin[0], *chemin, chemin[-1]], dtype=float)
    points = []
    for i in range(1, len(p) - 2):
        for k in range(pas):
            t = k / pas
            points.append(0.5 * (2 * p[i] + (p[i + 1] - p[i - 1]) * t + (2 * p[i - 1] - 5 * p[i] + 4 * p[i + 1] - p[i + 2]) * t ** 2
                                 + (3 * p[i] - p[i - 1] - 3 * p[i + 1] + p[i + 2]) * t ** 3))
    return [tuple(q) for q in points] + [tuple(p[-1])]


def spires(G, bas, haut):
    """Le nombre de segments de la lanière de `bas` à `haut`."""
    return max(1, round((haut - bas - G['largeur']) / G['pas'] * G['segments_par_tour']))


def guipure(m, G, bas, haut):
    """Une lanière en hélice autour du manche, de `bas` à `haut` : un prisme fermé de section triangulaire, sa face
    large dehors, son arête de fond noyée dans le bois."""
    cu, cw = AXE_DANS_LA_PRISE
    par_tour, demi = G['segments_par_tour'], G['largeur'] / 2
    n = spires(G, bas, haut)
    sommets = []
    for i in range(n + 1):
        t = 2 * math.pi * i / par_tour
        y = bas + demi + (haut - bas - G['largeur']) * i / n
        c, s = math.cos(t), math.sin(t)
        sommets += [(cu + G['rayon'] * c, y - demi, cw + G['rayon'] * s), (cu + G['rayon'] * c, y + demi, cw + G['rayon'] * s),
                    (cu + G['fond'] * c, y, cw + G['fond'] * s)]
    faces = [[3 * i + k, 3 * i + (k + 1) % 3, 3 * (i + 1) + (k + 1) % 3, 3 * (i + 1) + k] for i in range(n) for k in range(3)]
    faces += [[0, 1, 2], [3 * n + 2, 3 * n + 1, 3 * n]]
    m.ajouter(sommets, faces, 'cuir')


def bout_libre(m, G, L, bout):
    """La fin défaite de la lanière du groupe `bout['groupe']` : un prisme plat fermé, de la section de la lanière, qui
    part de l'extrémité haute de la spire, sa face dehors sur celle de la spire, la prolonge sur `amorce`, puis suit
    son chemin (angle depuis la fin de la spire, y, distance à l'axe) en tournant sur lui-même de `vrille`."""
    cu, cw = AXE_DANS_LA_PRISE
    bas, haut = G['groupes'][bout['groupe']]
    demi, ep = G['largeur'] / 2, L['epaisseur'] / 2
    n = spires(G, bas, haut)
    fin = 2 * math.pi * n / G['segments_par_tour']
    montee = (haut - bas - G['largeur']) / n * G['segments_par_tour'] / (2 * math.pi)
    r0 = G['rayon'] - ep
    chemin = [(0.0, 0.0, r0), (L['amorce'], montee * L['amorce'], r0), *bout['chemin']]
    points = np.array([(cu + r * math.cos(fin + a), haut - demi + y, cw + r * math.sin(fin + a))
                       for a, y, r in adoucir(chemin, L['pas'])])
    pas = np.linalg.norm(np.diff(points, axis=0), axis=1)
    parts = np.concatenate([[0.0], np.cumsum(pas)]) / pas.sum()
    sommets, large = [], np.array((0.0, 1.0, 0.0))
    for i, p in enumerate(points):
        d = points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]
        d /= np.linalg.norm(d)
        if i:
            large = large - d * large.dot(d)
            large /= np.linalg.norm(large)
        vrille = math.radians(bout['vrille']) * parts[i]
        w = large * math.cos(vrille) + np.cross(d, large) * math.sin(vrille)
        normale = np.cross(d, w)
        sommets += [tuple(p + sw * demi * w + sn * ep * normale) for sw, sn in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    k = len(points) - 1
    faces = [[4 * i + c, 4 * i + (c + 1) % 4, 4 * (i + 1) + (c + 1) % 4, 4 * (i + 1) + c] for i in range(k) for c in range(4)]
    faces += [[0, 1, 2, 3], [4 * k + 3, 4 * k + 2, 4 * k + 1, 4 * k]]
    m.ajouter(sommets, faces, 'cuir')


def construire(D, materiaux):
    cu, cw = AXE_DANS_LA_PRISE
    centre = (cu, 0.0, cw)
    yc = D['CENTRE_DU_FER']
    M, T, B, P, K = D['MANCHE'], D['TALON'], D['BLOC'], D['POINTES'], D['CRANE']
    bas_douille, haut_douille = yc + D['DOUILLE']['profil'][0][0], yc + D['DOUILLE']['profil'][-1][0]
    m = Maille(list(materiaux.values()))
    cylindre(m, T['virole'][1] - 0.005, bas_douille + 0.005, M['rayon'], 'y', centre, M['segments'], 'bois')
    tour(m, [(yc + h, r) for h, r in D['DOUILLE']['profil']], 'y', centre, D['DOUILLE']['segments'], 'metal')
    croissant(m, D, yc)
    boite(m, (cu - B['demi_largeur'], yc + B['h'][0], cw + B['r'][0]), (cu + B['demi_largeur'], yc + B['h'][1], cw + B['r'][1]),
          'metal')
    vers_le_dos = ((0.0, 0.0, -1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
    for h in P['h']:
        tour(m, [(-0.004, 0.0), (-0.004, P['rayon']), (P['longueur'], 0.0)], vers_le_dos, (cu, yc + h, cw + B['r'][0]),
             P['segments'], 'metal')
    tour(m, [(f * K['hauteur'], r * K['largeur'] / 2, r * K['profondeur'] / 2) for f, r in K['profil']], 'y',
         (cu, haut_douille - 0.002, cw), K['segments'], 'os')
    for bas, haut in D['GUIPURES']['groupes']:
        guipure(m, D['GUIPURES'], bas, haut)
    for bout in D['BOUTS_LIBRES']['bouts']:
        bout_libre(m, D['GUIPURES'], D['BOUTS_LIBRES'], bout)
    v0, v1 = T['virole']
    tour(m, [(v0, 0.0), (v0, T['rayon'] * 0.85), (v0 + 0.006, T['rayon']), (v1 - 0.006, T['rayon']), (v1, T['rayon'] * 0.85),
             (v1, 0.0)], 'y', centre, M['segments'], 'metal')
    plaque(m, [(cu, v0 + 0.005, cw - T['collet']), (cu, T['epaule'], cw - T['demi_largeur']), (cu, T['pointe'], cw),
               (cu, T['epaule'], cw + T['demi_largeur']), (cu, v0 + 0.005, cw + T['collet'])], T['epaisseur'], 'metal')
    for signe in (-1.0, 1.0):
        tube(m, [(cu, y, cw + signe * r) for y, r in adoucir(T['crochet'], T['pas_crochet'])], T['rayon_crochet'], T['cotes_crochet'], 'metal')
    return [objet('humanoide--rigide--grande_hache', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
