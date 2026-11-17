"""Géométrie de `humanoide--rigide--hallebarde` : la hampe de bois le long du +Y de la prise, centrée sur
`AXE_DANS_LA_PRISE` (`base/anatomie.py`), son talon de métal ; au sommet, la douille renflée, le collet doré à champ d'acier,
les deux lames en croissant dans le plan de la hampe et du tranchant (+Z), biseautées vers le fil, la tige, la bague et
la pointe d'estoc ; au milieu de chaque face du champ du collet, le cartouche de l'emblème ; le gland cannelé pendu
sous la douille, autour de la hampe (`donnees.py`)."""
import math

import numpy as np
from anatomie import AXE_DANS_LA_PRISE
from maille import Maille, boite, cylindre, objet, tour


def bezier(a, c, b, n=24):
    t = np.linspace(0.0, 1.0, n)[:, None]
    return (1 - t) ** 2 * np.array(a) + 2 * (1 - t) * t * np.array(c) + t ** 2 * np.array(b)


def reechantillonner(chemin, n):
    """`n` + 1 points du `chemin` (polyligne) à pas égaux de longueur d'arc."""
    longueurs = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(chemin, axis=0), axis=1))])
    cibles = np.linspace(0.0, longueurs[-1], n + 1)
    return np.stack([np.interp(cibles, longueurs, chemin[:, k]) for k in range(2)], axis=1)


def lame(m, D, L, centre_y):
    """Une lame : par colonne, du dos au fil, six sommets (dos, biseau, fil sur chaque face) ; les deux bouts fermés."""
    E_ = D['EPAISSEUR_LAME']
    cu, cw = AXE_DANS_LA_PRISE
    haute, basse = np.array(L['pointe_haute']), np.array(L['pointe_basse'])
    n = L['colonnes']
    controle = 2 * np.array(L['ventre']) - (haute + basse) / 2
    fil = reechantillonner(bezier(haute, controle, basse), n)
    retrait = D['RETRAIT_DES_POINTES']
    depart = haute + retrait * (np.array(L['creux_haut']) - haute) / np.linalg.norm(np.array(L['creux_haut']) - haute)
    arrivee = basse + retrait * (np.array(L['creux_bas']) - basse) / np.linalg.norm(np.array(L['creux_bas']) - basse)
    dos = reechantillonner(np.vstack([bezier(depart, L['creux_haut'], L['collet_haut']),
                                      bezier(L['collet_bas'], L['creux_bas'], arrivee)]), n)

    def sommet(rh, x):
        r, h = rh
        return (cu + x, centre_y + h, cw + L['signe'] * r)

    sommets = []
    for d, f in zip(dos, fil):
        ecart = np.linalg.norm(d - f)
        b = f + (d - f) * min(0.5, E_['largeur_biseau'] / ecart)
        sommets += [sommet(d, E_['dos'] / 2), sommet(b, E_['biseau'] / 2), sommet(f, E_['fil'] / 2),
                    sommet(f, -E_['fil'] / 2), sommet(b, -E_['biseau'] / 2), sommet(d, -E_['dos'] / 2)]
    faces = [[6 * i + k, 6 * i + (k + 1) % 6, 6 * (i + 1) + (k + 1) % 6, 6 * (i + 1) + k] for i in range(n) for k in range(6)]
    faces += [list(range(6)), [6 * n + k for k in range(5, -1, -1)]]
    m.ajouter(sommets, faces, 'metal')


def gland(m, D, centre_y):
    """Le gland : rangées de révolution cannelées (une colonne sur deux en creux), la frange du bas alternée, fermé en
    cône au haut et au bas."""
    G = D['GLAND']
    cu, cw = AXE_DANS_LA_PRISE
    n = G['segments']
    haut, bas = centre_y + G['haut'], centre_y + G['bas']
    sommets, faces, rangees = [(cu, haut, cw)], [], []
    for k, (s, r) in enumerate(G['rayons']):
        y = haut + s * (bas - haut)
        rangee = []
        for j in range(n):
            t = 2 * math.pi * j / n
            rj = r * (G['cannelure'] if j % 2 and k > 1 else 1.0)
            yj = y + (G['frange'] if j % 2 and s == 1.0 else 0.0)
            rangee.append(len(sommets))
            sommets.append((cu + rj * math.cos(t), yj, cw + rj * math.sin(t)))
        rangees.append(rangee)
    sommets.append((cu, bas + G['frange'] / 2, cw))
    for j in range(n):
        j2 = (j + 1) % n
        faces.append([0, rangees[0][j2], rangees[0][j]])
        for A, B in zip(rangees, rangees[1:]):
            faces.append([A[j], A[j2], B[j2], B[j]])
        faces.append([rangees[-1][j], rangees[-1][j2], len(sommets) - 1])
    m.ajouter(sommets, faces, 'gland')


def champ(m, C, cu, cw, yc):
    """Le champ d'acier du collet, en `relief` sur ses deux faces, et au milieu de chacune le cartouche carré (surface
    `blason`), ses UV sur le carré [0,1]² : vu de sa face, u croît vers la droite de qui le regarde, v vers le fer."""
    e, b, c = C['epaisseur'] / 2 + C['relief'], C['bordure'], C['cartouche'] / 2
    h0, h1 = yc + C['h'][0] + b, yc + C['h'][1] - b
    r0, r1 = cw + C['r'][0] + b, cw + C['r'][1] - b
    hc, rc = (h0 + h1) / 2, (r0 + r1) / 2
    hs, rs = [h0, hc - c, hc + c, h1], [r0, rc - c, rc + c, r1]
    noms = [x.name for x in m.materiaux]

    def face(q, mat, uv=None):
        m.f.append(q)
        m.m.append(noms.index(mat))
        m.uv.append(uv or [(0.0, 0.0)] * len(q))

    # Sur chaque face, la grille 4 × 4 (h, r) ; sa case du milieu est le cartouche.
    debuts = {}
    for signe in (1.0, -1.0):
        debuts[signe] = base = len(m.v)
        m.v.extend((cu + signe * e, h, r) for h in hs for r in rs)
        for i in range(3):
            for j in range(3):
                q = [base + 4 * i + j, base + 4 * i + j + 1, base + 4 * (i + 1) + j + 1, base + 4 * (i + 1) + j]
                q = q[::-1] if signe > 0 else q
                if (i, j) == (1, 1):
                    # Vue de +X, la droite de qui regarde est -Z ; vue de -X, +Z.
                    face(q, 'cartouche', [(0.5 - signe * (m.v[k][2] - rc) / (2 * c), 0.5 + (m.v[k][1] - hc) / (2 * c))
                                          for k in q])
                else:
                    face(q, 'metal')
    # Le chant du champ, entre les deux faces.
    tour = [4 * i + j for i, j in [(0, 0), (0, 1), (0, 2), (0, 3), (1, 3), (2, 3), (3, 3), (3, 2), (3, 1), (3, 0),
                                   (2, 0), (1, 0)]]
    ip, im = debuts[1.0], debuts[-1.0]
    for k in range(12):
        face([ip + tour[k], ip + tour[(k + 1) % 12], im + tour[(k + 1) % 12], im + tour[k]], 'metal')


def construire(D, materiaux):
    talon = -D['PRISE_DEPUIS_TALON']
    sommet = D['LONGUEUR'] - D['PRISE_DEPUIS_TALON']
    cu, cw = AXE_DANS_LA_PRISE
    centre = (cu, 0.0, cw)
    yc = D['CENTRE_DU_FER']
    H, T, P, B, C = D['HAMPE'], D['TALON'], D['POINTE'], D['BAGUE'], D['COLLET']
    bas_douille = yc + D['DOUILLE'][0][0]
    m = Maille(list(materiaux.values()))
    cylindre(m, talon + T['hauteur'] - 0.005, bas_douille + 0.005, H['rayon'], 'y', centre, H['segments'], 'bois')
    tour(m, [(talon, 0.0), (talon + T['pointe'], T['rayon'] * 0.7), (talon + T['pointe'] + 0.01, T['rayon']),
             (talon + T['hauteur'], T['rayon']), (talon + T['hauteur'], 0.0)], 'y', centre, H['segments'], 'metal')
    tour(m, [(yc + h, r) for h, r in D['DOUILLE']], 'y', centre, D['SEGMENTS_DOUILLE'], 'metal')
    cylindre(m, yc + C['h'][1] - 0.005, B['bas'] + 0.002, D['TIGE']['rayon'], 'y', centre, P['segments'], 'metal')
    cylindre(m, B['bas'], B['haut'], B['rayon'], 'y', centre, P['segments'], 'metal')
    tour(m, [(P['base'], 0.0), (P['base'], P['rayon']), (P['base'] + 0.35 * (sommet - P['base']), P['rayon'] * 0.75),
             (sommet, 0.0)], 'y', centre, P['segments'], 'metal')
    boite(m, (cu - C['epaisseur'] / 2, yc + C['h'][0], cw + C['r'][0]),
          (cu + C['epaisseur'] / 2, yc + C['h'][1], cw + C['r'][1]), 'dorure')
    champ(m, C, cu, cw, yc)
    for L in D['LAMES'].values():
        lame(m, D, L, yc)
    gland(m, D, yc)
    return [objet('humanoide--rigide--hallebarde', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
