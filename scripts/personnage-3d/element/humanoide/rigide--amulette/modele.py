"""Géométrie de `humanoide--rigide--amulette` : un médaillon rond à bord relevé, un jonc autour de son champ uni, face
vers +Z, sa bélière et le cordon de deux brins tordus qui monte jusqu'à l'emplacement (+Y vers le bas une fois rangée,
+Z sortant)."""
import math

from maille import Maille, objet, tore, tour, tube


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    r, e, B, J = D['RAYON'], D['EPAISSEUR'], D['BORD'], D['JONC']
    yc = D['DESCENTE']
    champ = r - B['largeur']
    fond = e - B['creux']
    dehors, dedans = J['rayon'] + J['largeur'] / 2, J['rayon'] - J['largeur'] / 2
    profil = [(0.0, 0), (0.0, r), (e, r), (e, champ), (fond, champ - 0.001), (fond, dehors), (e, dehors - 0.001),
              (e, dedans + 0.001), (fond, dedans), (fond, 0)]
    tour(m, profil, 'z', (0.0, yc, 0.0), D['SEGMENTS'], 'metal')
    L = D['BELIERE']
    haut = yc - r - L['rayon'] + L['section']
    tore(m, 'x', (0.0, haut, e / 2), L['rayon'], L['section'], L['segments'], L['cotes'], 'metal')
    C = D['CORDON']
    bas, sommet = haut - L['rayon'], -C['au_dessus']
    n = round(C['torsades'] * C['points'])
    for brin in (0.0, math.pi):
        chemin = []
        for i in range(n + 1):
            t = brin + 2 * math.pi * i / C['points']
            chemin.append((C['brin'] * math.cos(t), bas + (sommet - bas) * i / n, 2 * C['brin'] + C['brin'] * math.sin(t)))
        tube(m, chemin, C['brin'], C['cotes'], 'cordon')
    return [objet('humanoide--rigide--amulette', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
