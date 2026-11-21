"""Géométrie de `humanoide--vetement--capuche` (`element/tissu.py`) : trois nappes d'un seul drap, en un seul élément.

- Le capuchon : rangs en élévation autour du centre du crâne, chacun d'un bord de l'ouverture du visage à l'autre par
  la nuque, fermé au-dessus du front ; chaque point est sur l'ellipsoïde du capuchon (`forme`), jamais à moins du jeu
  de la tête et de la coiffure ; derrière la tête, les rangs du bas s'écartent en une poche qui retombe sur la nuque,
  par-dessus l'écharpe ;
  le sommet est rond, fermé en éventail. Son envers porte la doublure.
- L'écharpe : colonnes en azimut autour de l'axe du cou ; le haut, un anneau marché à l'horizontale vers l'axe jusqu'au
  jeu du capuchon, de la coiffure et du cou (sous le menton, autour du bas du capuchon, sous sa retombée derrière) ; sous lui, rangs en angle
  polaire depuis un centre dans le torse jusqu'au bord (épaules, poitrine, haut du dos), chaque point le plus extérieur
  de son rayon au jeu de la robe, du corps, de la tête et de la coiffure, plus le pli de son rang.
- Le pan : une bande qui sort de sous le bord de l'écharpe à l'avant gauche et tombe sur la poitrine.

Double nappe ; poids du capuchon empruntés à la peau de la tête, ceux de l'écharpe et du pan à la robe et au corps, la
tête et les bras reportés ; clés reprises du corps, au plus près. Toute cote vient de `donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector

from tissu import Maillage, direction_spatiale, emprunter, fondu, joindre, joindre_les_surfaces, lambeaux, lisser, porteur_de, selon, voisinage


def exterieur(D, surfaces, origine, d, portee, jeu, plancher=None):
    """Le rayon, depuis `origine` le long de `d`, du point le plus extérieur dont la nappe intérieure est à `jeu` des
    `surfaces`, marché du dehors (`portee`) ; jamais sous `plancher`, sans lequel un rayon qui n'approche aucune
    surface, ou qui part déjà contre l'une d'elles, est refusé."""
    r = portee
    while r > (plancher or 0.0):
        if surfaces['arbre'].find_nearest(Vector((origine + r * d).tolist()))[3] <= jeu + D['EPAISSEUR']:
            if plancher is None and r == portee:
                raise ValueError(f'capuche : la marche depuis {tuple(origine)} vers {tuple(d)} part contre une surface')
            return r + D['PAS']
        r -= D['PAS']
    if plancher is None:
        raise ValueError(f'capuche : aucune surface depuis {tuple(origine)} vers {tuple(d)}')
    return plancher


def capuchon(D, b, surfaces):
    """Le maillage du capuchon : rangs du bas au sommet, celui-ci fermé en éventail."""
    c = D['CAPUCHON']
    C = np.array(b.tete(c['os_du_centre'])) + np.asarray(c['centre'], float)
    f, o, n, t = c['forme'], c['ouverture'], c['colonnes'] + 1, c['retombee']
    M = Maillage()
    rangs = []
    for e in c['elevations']:
        s = (e - o['milieu']) / (o['haut'] - o['milieu'])
        demi = o['demi'] if s <= 0 else o['demi'] * math.sqrt(max(0.0, 1.0 - s * s))
        ferme = demi < 1e-6
        points = []
        for phi in np.linspace(demi, 360.0 - demi, n)[:n - 1 if ferme else n]:
            d = direction_spatiale(phi, e)
            forme = 1.0 / math.sqrt((d[0] / f['cote']) ** 2 + (d[1] / (f['devant'] if d[1] < 0 else f['derriere'])) ** 2
                                    + (d[2] / (f['haut'] if d[2] > 0 else f['bas'])) ** 2)
            derriere = fondu((180.0 - abs(phi - 180.0) - t['azimuts'][0]) / (t['azimuts'][1] - t['azimuts'][0]))
            forme += derriere * float(np.interp(e, *zip(*t['surplus'])))
            points.append(C + exterieur(D, surfaces, C, d, D['PORTEE'], c['jeu'], plancher=forme) * d)
        rang = M.ajouter(points, 'capuchon')
        rangs.append(rang + rang[:1] if ferme else rang)
    sommet = M.ajouter([C + np.array([0.0, 0.0, f['haut']])], 'capuchon')[0]
    for A, B in zip(rangs, rangs[1:]):
        for i in range(n - 1):
            M.quad(A[i], A[i + 1], B[i + 1], B[i], C)
    for i in range(n - 1):
        M.triangle(rangs[-1][i], rangs[-1][i + 1], sommet, C)
    return M


def echarpe(D, b, surfaces, capuchon_):
    """Les rangs de l'écharpe, du haut (au jeu des `surfaces` et du capuchon) au bord (un point par colonne), et son
    centre."""
    e = D['ECHARPE']
    O = np.array(b.tete(e['os_du_centre'])) + np.asarray(e['centre'], float)
    m, R = e['colonnes'], e['rangs']
    bords = lambeaux(e['bords'], m)
    autour = porteur_de(*joindre_les_surfaces([(surfaces['P'], surfaces['T'], surfaces['W']), capuchon_]))
    rangs = [[] for _ in range(R + 1)]
    hauts = [O + np.array([0.0, 0.0, selon(e['haut'], 360.0 * j / m)]) for j in range(m)]
    rayons = np.array([exterieur(D, autour if abs((360.0 * j / m + 180.0) % 360.0 - 180.0) <= e['sous_la_retombee'] else surfaces,
                                 A, direction_spatiale(360.0 * j / m), e['portee_du_haut'], e['jeu']) for j, A in enumerate(hauts)])
    for _ in range(e['passes_du_haut']):
        rayons = np.maximum(rayons, 0.25 * np.roll(rayons, 1) + 0.5 * rayons + 0.25 * np.roll(rayons, -1))
    for j in range(m):
        psi = 360.0 * j / m
        rangs[0].append(hauts[j] + rayons[j] * direction_spatiale(psi))
        haut = math.degrees(math.atan2(math.hypot(*(rangs[0][j] - O)[:2]), rangs[0][j][2] - O[2]))
        bas = selon(e['bord'], psi) + bords[j]
        ampleur = e['ampleur'] * (1.0 + e['inegalite'] * math.sin(math.radians(2.0 * psi) + 1.3))
        for k in range(1, R + 1):
            rangs[k].append(pose(D, surfaces, O, psi, haut + (bas - haut) * k / R, e['x_max'], e['jeu'],
                                 ampleur * 0.5 * (1.0 - math.cos(2 * math.pi * e['plis'] * k / R))))
    return rangs, O


def pose(D, surfaces, O, psi, polaire, x_max, jeu, relief):
    """Le point de la demi-droite d'azimut `psi` et d'angle polaire `polaire` depuis `O`, le plus extérieur au `jeu` des
    `surfaces`, plus `relief` ; la marche part en dedans de `x_max`, hors des bras."""
    p = math.radians(polaire)
    d = math.sin(p) * direction_spatiale(psi) + np.array([0.0, 0.0, math.cos(p)])
    portee = min(D['PORTEE'], x_max / abs(d[0])) if abs(d[0]) > 1e-9 else D['PORTEE']
    return O + (exterieur(D, surfaces, O, d, portee, jeu) + relief) * d


def pan(D, surfaces, O, e):
    """Les rangs du pan, du haut (sous l'écharpe) au bas, un point par azimut."""
    c = D['PAN']
    bords = lambeaux(c['bords'], len(c['azimuts']))
    rangs = [[] for _ in range(c['rangs'] + 1)]
    for j, psi in enumerate(c['azimuts']):
        haut, bas = selon(e['bord'], psi) - c['recouvrement'], c['bas'] + bords[j]
        for k in range(c['rangs'] + 1):
            rangs[k].append(pose(D, surfaces, O, psi, haut + (bas - haut) * k / c['rangs'], e['x_max'], c['jeu'], 0.0))
    return rangs


def nappe_des_rangs(rangs, ref, ferme):
    """Le maillage des `rangs` (un point par colonne), fermé en azimut ou non, orienté à l'opposé de `ref`."""
    M = Maillage()
    lignes = [M.ajouter(r, 'echarpe') for r in rangs]
    for A, B in zip(lignes, lignes[1:]):
        if ferme:
            M.bande(A, B, ref)
        else:
            for i in range(len(A) - 1):
                M.quad(A[i], A[i + 1], B[i + 1], B[i], ref)
    return M


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    tete = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES']['tete'])
    coiffure = b.matieres_publiees(D['CONTOURNE']['coiffure'], D['MATIERES']['coiffure'])
    robe = b.matieres_publiees(D['CONTOURNE']['robe'], D['MATIERES']['robe'])
    corps = [b.corps(z) for z in D['ZONES_DU_CORPS']]
    e = D['ECHARPE']

    dessous = porteur_de(*joindre_les_surfaces([robe] + corps))

    def pose(X):
        """Les poids de ce qui repose sur les épaules : ceux de la robe et du corps, la tête et les bras reportés."""
        W = np.array([emprunter(p, dessous)[0] for p in X])
        for a, o in e['os_reportes'].items():
            W[:, b.indice_os[o]] += W[:, b.indice_os[a]]
            W[:, b.indice_os[a]] = 0.0
        return W

    M = capuchon(D, b, porteur_de(*joindre_les_surfaces([tete, coiffure])))
    X, orientes, normales = M.orienter()
    W = lisser(np.array([emprunter(p, porteur_de(*tete))[0] for p in X]), voisinage(orientes, len(X)),
               D['CAPUCHON']['lissage_des_poids'])
    nappes = [b.nappe('capuche', X, normales, W, orientes, materiaux['capuche'], D['EPAISSEUR'],
                      [(None, materiaux['doublure'])] * len(orientes))]
    capuchon_ = (X, np.array(orientes), W)

    autres = porteur_de(*joindre_les_surfaces([robe, coiffure, tete] + corps))
    rangs, O = echarpe(D, b, autres, capuchon_)
    ref = O + np.array([0.0, 0.0, -0.10])
    for M in (nappe_des_rangs(rangs, ref, True),
              nappe_des_rangs(pan(D, autres, O, e), ref, False)):
        X, orientes, normales = M.orienter()
        W = lisser(pose(X), voisinage(orientes, len(X)), e['lissage_des_poids'])
        nappes.append(b.nappe('echarpe', X, normales, W, orientes, materiaux['capuche'], D['EPAISSEUR']))
    piece = joindre(nappes)
    b.transferer(piece, D['ZONES_DES_CLES'], bornes=D['BORNES_DES_CLES'])
    return piece
