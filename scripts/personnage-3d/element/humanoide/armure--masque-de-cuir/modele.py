"""Géométrie de `humanoide--armure--masque-de-cuir` (`element/casque.py`, `element/tissu.py`) : un couvre-tête de cuir
rapiécé à demi-masque, rigide sur l'os de la tête, son sceau, son parchemin et les deux bouts de son os.

- La coque : calotte, demi-masque et couvre-nuque d'un seul tenant, une grille de colonnes (`AZIMUTS`, en miroir) et de
  rangs du bord de la colonne (`BORD`) au haut de la calotte, éventail au sommet, tenue au `JEU` de la peau de la tête
  publiée, qu'elle épouse au nez ; chaque œil y ouvre une amande (`OEIL`) : les quads dont le centre tombe dans
  son rectangle sont ôtés, et les sommets de leur tour ramenés sur le contour de l'amande. Double nappe.
- Les pattes : de chaque côté, un ruban sur la coque le long de `JOUE`, de la pommette à sa pointe sous le menton.
  Double nappe.
- Les coutures, les lacets et les bouts d'os : des gaines rondes fermées le long d'un tracé (`gaine`).
- Le sceau et sa bande écrite (`element/sceau.py`) : la bande couchée sur les cuirs puis pendue (`pendre`), le sceau
  posé sur elle.
- Les pièces rapportées : des plaques en saillie sur la coque (`PIECES`).
- L'emplacement `cimier`, offert sur la coque à son bord haut.

Silhouettes et clés `gabarit_*` prises au corps de la base (`tete.cles_du_corps`). Toute cote vient de `donnees.py`.
"""
import math

import numpy as np

from casque import Coque, offrir_le_cimier, radiale, rigide, solide
from formes import positions, poser_la_cle
from maille import lineaire
from sceau import Cadre, Ruban, encre, sceau
from tente import HAUT
from tete import cles_du_corps
from tissu import JUMEAU, Maillage, joindre, porteur_de, selon

COTES = (-1.0, 1.0)
"""Le signe de l'azimut : la droite du personnage, puis sa gauche."""


def dans_l_oeil(D, phi, h):
    """La position de (`phi`, `h`) dans l'amande de l'œil de son côté : l'abscisse en demi-largeurs, la hauteur
    au-dessus de l'axe de l'amande et la demi-hauteur de l'amande à cette abscisse (négative hors d'elle)."""
    o = D['OEIL']
    a = (abs(phi) - o['azimut']) / o['demi_largeur']
    return a, h - o['hauteur'] - o['releve'] * a, o['demi_hauteur'] * (1.0 - a * a)


def coque(D, b, forme, mat):
    phis = [-a for a in reversed(D['AZIMUTS'][1:-1])] + D['AZIMUTS']
    phis = [phis[-1] - 360.0] + phis[:-1]
    n = len(phis)
    haut = D['DEMI_AXES']['haut']
    u_haut = haut * math.radians(D['ELEVATION_HAUTE'])
    grille = []
    for phi in phis:
        u_bord = forme.abscisse(selon(D['BORD'], phi))
        us = [u_bord + f * (D['ANCRE'] - u_bord) for f in D['RANGS_DU_BAS']] + D['RANGS_DU_HAUT'] + [u_haut]
        grille.append([forme.hauteur(u) for u in us])
    m = len(grille[0])
    quads = [(k, j) for k in range(n) for j in range(m - 1)]

    def centre(k, j):
        k2 = (k + 1) % n
        phi = 0.5 * (phis[k] + phis[k2] + (360.0 if k2 < k else 0.0))
        return phi, 0.25 * (grille[k][j] + grille[k][j + 1] + grille[k2][j] + grille[k2][j + 1])

    def ouvert(k, j):
        a, dh, _ = dans_l_oeil(D, *centre(k, j))
        return abs(a) < 1.0 and abs(dh) < D['OEIL']['demi_hauteur']

    otes = {q for q in quads if ouvert(*q)}
    gardes = [q for q in quads if q not in otes]
    coins = lambda k, j: [(k, j), ((k + 1) % n, j), ((k + 1) % n, j + 1), (k, j + 1)]
    hauteurs = {}
    for k, j in {c for q in gardes for c in coins(*q)}:
        h = grille[k][j]
        # Le tour de l'amande : un sommet sous l'ouverture va à la paupière du bas, un sommet au-dessus à celle du
        # haut, un sommet qui l'a des deux côtés reste au coin, sur l'axe.
        dessus = any(q in otes for q in ((k, j), ((k - 1) % n, j)))
        dessous = any(q in otes for q in ((k, j - 1), ((k - 1) % n, j - 1)))
        if dessus or dessous:
            o = D['OEIL']
            a, _, demi = dans_l_oeil(D, phis[k], h)
            h = o['hauteur'] + o['releve'] * a + (dessous - dessus) * max(demi, o['coin'])
        hauteurs[(k, j)] = h
    M = Maillage()
    indice = {c: M.ajouter([forme.point(phis[c[0]], hauteurs[c])], 'coque')[0] for c in sorted(hauteurs)}
    for q in gardes:
        M.quad(*[indice[c] for c in coins(*q)], forme.C)
    pole = M.ajouter([forme.point(0.0, haut)], 'coque')[0]
    for k in range(n):
        M.triangle(indice[(k, m - 1)], indice[((k + 1) % n, m - 1)], pole, forme.C)
    X, orientes, normales = M.orienter()
    return b.nappe('coque', X, normales, rigide(D, b, len(X)), orientes, mat, D['EPAISSEUR'])


def trace_de_la_joue(D):
    """Les stations (azimut, hauteur, demi-largeur) à pas égal le long du tracé de `JOUE`."""
    t = D['JOUE']['trace']
    parts = np.linspace(0.0, len(t) - 1.0, D['JOUE']['stations'])
    return [tuple(lineaire([(float(i), p[a]) for i, p in enumerate(t)], float(x)) for a in range(3)) for x in parts]


def joue(D, b, forme, mat, cote):
    stations = trace_de_la_joue(D)
    M = Maillage()
    rangs = []
    for i, (phi, h, w) in enumerate(stations):
        avant, apres = stations[max(i - 1, 0)], stations[min(i + 1, len(stations) - 1)]
        rho = float(np.linalg.norm((forme.point(cote * phi, h) - forme.C)[:2]))
        # Le long de la surface : l'arc (rho · azimut) et la hauteur ; le travers est la normale au tracé.
        t = np.array([rho * math.radians(apres[0] - avant[0]), apres[1] - avant[1]])
        t /= np.linalg.norm(t)
        points = []
        for s in (-1.0, 0.0, 1.0):
            d_arc, d_h = s * w * -t[1], s * w * t[0]
            phi_s, h_s = cote * (phi + math.degrees(d_arc / rho)), h + d_h
            p = forme.point(phi_s, h_s)
            points.append(p + D['JOUE']['saillie'] * (p - (forme.C + h_s * HAUT)) / np.linalg.norm(p - (forme.C + h_s * HAUT)))
        rangs.append(M.ajouter(points, 'joue'))
    for A, B in zip(rangs, rangs[1:]):
        for i in range(2):
            M.quad(A[i], A[i + 1], B[i + 1], B[i], forme.C + 0.5 * (stations[0][1] + stations[-1][1]) * HAUT)
    X, orientes, normales = M.orienter()
    return b.nappe('joue', X, normales, rigide(D, b, len(X)), orientes, mat, D['EPAISSEUR'])


def gaine(M, centres, profils, partie):
    """Ajoute à `M` la gaine fermée par `centres`, de section `profils[k]` à la station k (points (u, v) dans le
    repère de la section, tournant de u vers v) ; le repère de la section suit le tracé par transport, v au plus près
    de la verticale au départ. Les deux bouts se ferment en éventail autour du milieu de leur tour."""
    centres = np.asarray(centres, float)
    tangentes = np.gradient(centres, axis=0)
    tangentes /= np.linalg.norm(tangentes, axis=1, keepdims=True)
    u = np.cross(tangentes[0], HAUT if abs(tangentes[0] @ HAUT) < 0.9 else np.array([1.0, 0.0, 0.0]))
    sections = []
    for c, T, profil in zip(centres, tangentes, profils):
        u = u - (u @ T) * T
        u /= np.linalg.norm(u)
        v = np.cross(T, u)
        sections.append([c + x * u + y * v for x, y in profil])
    anneaux = [M.ajouter(points, partie) for points in sections]
    for k, (A, B) in enumerate(zip(anneaux, anneaux[1:])):
        M.bande(A, B, 0.5 * (centres[k] + centres[k + 1]))
    for k, voisin in ((0, 1), (-1, -2)):
        milieu = np.mean(sections[k], axis=0)
        bout = M.ajouter([milieu], partie)[0]
        for i in range(len(anneaux[k])):
            M.triangle(anneaux[k][i], anneaux[k][(i + 1) % len(anneaux[k])], bout, milieu + 0.3 * (centres[voisin] - centres[k]))


def rond(rayon, cotes):
    return [(rayon * math.cos(a), rayon * math.sin(a)) for a in np.linspace(0.0, 2 * math.pi, cotes, endpoint=False)]


def vers(x, y, z):
    """Le vecteur unitaire de composantes (vers la gauche, vers l'avant, vers le haut)."""
    d = x * radiale(90.0) + y * radiale(0.0) + z * HAUT
    return d / np.linalg.norm(d)


def cordon(D, b, forme, mat, cote):
    c = D['CORDON']
    phi, h, _ = D['JOUE']['trace'][-1]
    pied = forme.point(cote * phi, h)
    dehors, avant = radiale(cote * 90.0), radiale(0.0)
    centres = [pied + x * dehors + y * avant + z * HAUT for x, y, z in c['trace']]
    M = Maillage()
    gaine(M, centres, [rond(c['rayon'], c['cotes'])] * len(centres), 'cordon')
    return solide(D, b, 'cordon', M, mat)


def coutures(D, b, forme, mat):
    c = D['COUTURES']
    M = Maillage()
    for trace in c['traces']:
        parts = np.linspace(0.0, len(trace) - 1.0, c['points'])
        centres = [forme.point(*[lineaire([(float(i), p[a]) for i, p in enumerate(trace)], float(x)) for a in range(2)])
                   for x in parts]
        gaine(M, centres, [rond(c['rayon'], c['cotes'])] * len(centres), 'couture')
    return solide(D, b, 'couture', M, mat)


def pieces_rapportees(D, b, forme, mat):
    def pose(phi, h, saillie):
        x = forme.point(float(phi), float(h))
        return x + saillie * (x - forme.C) / np.linalg.norm(x - forme.C)

    M = Maillage()
    tour = [(0, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 1), (2, 0), (1, 0)]
    for p in D['PIECES']:
        hs = np.linspace(*p['hauteurs'], 3)
        phis = [np.linspace(*p['azimuts'], 3) + 0.5 * p['biais'] * (j - 1) for j in range(3)]
        dessus = [M.ajouter([pose(phi, hs[j], p['saillie']) for phi in phis[j]], 'piece') for j in range(3)]
        dedans = pose(phis[1][1], hs[1], -0.02)
        for j in range(2):
            for i in range(2):
                M.quad(dessus[j][i], dessus[j][i + 1], dessus[j + 1][i + 1], dessus[j + 1][i], dedans)
        bord = M.ajouter([pose(phis[j][i], hs[j], -0.5 * p['saillie']) for j, i in tour], 'piece')
        M.bande([dessus[j][i] for j, i in tour], bord, dedans)
    return solide(D, b, 'piece', M, mat)


def surface_de(objet):
    """Positions monde et triangles d'un objet bâti."""
    M = np.array(objet.matrix_world)
    objet.data.calc_loop_triangles()
    return positions(objet.data) @ M[:3, :3].T + M[:3, 3], np.array([t.vertices[:] for t in objet.data.loop_triangles])


def porteur_du_parchemin(D, b, cuirs, peau):
    """Ce qui porte la bande, rigide sur l'os de la tête : les cuirs `cuirs`, et sous leur bord la peau de la tête."""
    P, T, n = [], [], 0
    for p, t in [surface_de(o) for o in cuirs] + [(peau['P'], peau['T'])]:
        P.append(p)
        T.append(t + n)
        n += len(p)
    return porteur_de(np.vstack(P), np.vstack(T), rigide(D, b, n))


def pendre(grille):
    """La bande sous son poids : le long de chaque colonne, du haut vers le bas, aucun sommet ne rentre vers l'axe sous
    un sommet plus saillant."""
    for colonne in grille.colonnes:
        grille.rho[colonne] = np.maximum.accumulate(grille.rho[colonne])


def sceau_et_bande(D, b, forme, cuirs, peau, materiaux):
    S, R, E = D['SCEAU'], D['RUBAN'], D['ECRITURE']
    z = forme.C[2] + S['hauteur']
    cadre = Cadre(porteur_du_parchemin(D, b, cuirs, peau), np.array([forme.C[0], forme.C[1], 0.0]), S['azimut'], z,
                  D['PORTEE'])
    ruban = Ruban(R, cadre, 0.0, z, S['rayon'], R['jeu'] + R['epaisseur'])
    pendre(ruban.grille)
    return [ruban.grille.nappe(b, cadre, 'bande', materiaux['parchemin'], R['epaisseur']),
            sceau(b, cadre, S, D['CACHET'], *ruban.sous_le_sceau(), materiaux['cire'], D['ANGLE_LISSE']),
            encre(b, cadre, ruban.mots(D['LIGNES_DU_RUBAN'], E), E['jeu'], materiaux['encre'])]


def os_du_cote(D, b, forme, mat):
    o = D['OS_DU_COTE']
    d = vers(*o['direction'])
    pied = forme.point(o['azimut'], o['hauteur']) - o['enfoncement'] * d
    M = Maillage()
    gaine(M, [pied, pied + 0.5 * o['longueur'] * d, pied + o['longueur'] * d],
          [rond(r, o['cotes']) for r in (o['rayon'], 0.55 * o['rayon'], 0.0008)], 'os')
    return solide(D, b, 'os_du_cote', M, mat)


def os_du_sommet(D, b, forme, mat):
    o = D['OS_DU_SOMMET']
    d = vers(*o['direction'])
    pied = forme.a_l_elevation(o['azimut'], o['elevation']) - o['rayon'] * d
    bout = pied + o['longueur'] * d
    M = Maillage()
    gaine(M, [pied, bout], [rond(o['rayon'], o['cotes'])] * 2, 'os')
    gaine(M, [bout - 0.6 * o['bouton'] * d, bout + 0.2 * o['bouton'] * d, bout + o['bouton'] * d],
          [rond(f * o['bouton'], o['cotes']) for f in (0.6, 1.0, 0.5)], 'os')
    return solide(D, b, 'os_du_sommet', M, mat)


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    peau = porteur_de(*b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE']))
    forme = Coque(D, np.array(b.tete(D['OS'])) + np.asarray(D['CENTRE'], float), peau)
    cuir, os = materiaux['cuir'], materiaux['os']
    cuirs = [coque(D, b, forme, cuir), *[joue(D, b, forme, cuir, cote) for cote in COTES],
             coutures(D, b, forme, cuir), pieces_rapportees(D, b, forme, cuir)]
    du_crane = [*cuirs, *sceau_et_bande(D, b, forme, cuirs, peau, materiaux),
                os_du_sommet(D, b, forme, os), os_du_cote(D, b, forme, os)]
    piece = joindre(du_crane + [cordon(D, b, forme, cuir, cote) for cote in COTES])
    piece.name = D['MANIFESTE']['cle']['piece']
    for attribut in [a for a in piece.data.attributes if a.name == JUMEAU]:
        piece.data.attributes.remove(attribut)
    offrir_le_cimier(D, b, forme)
    for nom, champ in cles_du_corps(b, D['ZONES_DES_CLES'], positions(piece.data)).items():
        poser_la_cle(piece, nom, champ)
    return piece
