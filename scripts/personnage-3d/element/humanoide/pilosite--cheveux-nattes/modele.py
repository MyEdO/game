"""Géométrie de `humanoide--pilosite--cheveux-nattes` (`element/tissu.py`) : une calotte de cheveux tirés et deux nattes.

- La calotte : une grille de rayons visés du dehors vers le centre du crâne (colonnes en azimut, rangs du bord bas de la
  colonne au haut, éventail au sommet), chaque sommet posé sur la peau de la tête publiée à sa hauteur le long de la
  normale ; le bord bas en mèches, une colonne sur deux plus haute (des mèches tirées). Double nappe, poids de la peau.
- Les nattes : un chemin par points de passage visés du dehors (tempe, joue, sous la mâchoire, poitrine), posé au jeu
  des surfaces contournées (peau, cou, torse, pourpoint et foulard publiés), échantillonné, puis tenu au jeu minimal de
  ces surfaces et au jeu du foulard, par-dessus lequel il passe, en le relevant vers le dehors, et lissé ; un tube de
  maillons, renflés puis pincés, décalés de part et d'autre, la section tournée d'un maillon au suivant ; le bout
  effilé. Poids de la tête jusqu'à la joue, puis du pourpoint et du corps sous la natte, lissés le long d'elle.

Silhouettes et clés `gabarit_*` transférées des zones de la base sous la pièce, au plus près. Toute cote vient de
`donnees.py`.
"""
import math

import numpy as np
from mathutils import Vector

from tissu import Maillage, direction_spatiale, emprunter, joindre, joindre_les_surfaces, lambeaux, porteur_de, sur_le_porteur


# ---------------------------------------------------------------- calotte

def calotte(D, b, M, peau):
    c = D['CALOTTE']
    C = np.array(b.tete(c['os_du_centre'])) + np.asarray(c['centre'], float)
    n, m = c['colonnes'], c['rangs']
    phis = [-180.0 + 360.0 * k / n for k in range(n)]
    meches = lambeaux(c['meches'], n)
    h_bord, h_coeur = c['hauteur']

    def pose(d, h):
        p, normale = sur_le_porteur(peau, C, d, c['portee'])
        return p + h * normale

    rangs = []
    for j in range(m):
        rang = []
        for k, phi in enumerate(phis):
            bas = float(np.interp(abs(phi), *zip(*c['bas']))) - meches[k]
            e = bas + (c['elevation_haut'] - bas) * j / (m - 1)
            rang.append(pose(direction_spatiale(phi, e), h_bord if j == 0 else h_coeur + c['stries'] * (k % 2)))
        rangs.append(M.ajouter(rang, 'calotte'))
    for A, B in zip(rangs, rangs[1:]):
        M.bande(A, B, C)
    pole = M.ajouter([pose(np.array([0.0, 0.0, 1.0]), h_coeur)], 'calotte')[0]
    for k in range(n):
        M.triangle(rangs[-1][k], rangs[-1][(k + 1) % n], pole, C)


# ---------------------------------------------------------------- nattes

def catmull_rom(points, par_segment):
    """La courbe de Catmull-Rom (uniforme) par `points`, `par_segment` échantillons par segment ; rend les échantillons
    et, par point de passage, l'indice de son échantillon."""
    P = [points[0] + (points[0] - points[1])] + list(points) + [points[-1] + (points[-1] - points[-2])]
    sortie, indices = [], []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        indices.append(len(sortie))
        for t in np.linspace(0.0, 1.0, par_segment, endpoint=False):
            sortie.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                                 + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
    indices.append(len(sortie))
    sortie.append(P[-2])
    return np.array(sortie), indices


def abscisses(X):
    return np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(X, axis=0), axis=1))])


def reechantillonner(X, s, valeurs):
    return np.array([[np.interp(v, s, X[:, a]) for a in range(3)] for v in valeurs])


def chemin(D, b, arbre, foulard, cote):
    """Les échantillons du chemin de la natte du côté `cote` (+1 gauche, -1 droite), au pas d'échantillon, et l'abscisse
    de chaque point de passage."""
    t = D['NATTE']
    r = t['rayon']
    passages = []
    for os_, decalage, phi, e, portee, jeu in t['chemin']:
        O = np.array(b.tete(os_)) + np.asarray(decalage, float)
        d = direction_spatiale(cote * phi, e)
        p, _ = sur_le_porteur(arbre, O, d, portee)
        passages.append(p + (jeu + r) * d)
    X, indices = catmull_rom(passages, 24)
    s = abscisses(X)
    marques = s[indices]
    X = reechantillonner(X, s, np.arange(0.0, s[-1], t['pas_d_echantillon']).tolist() + [s[-1]])
    s = abscisses(X)
    debut = int(np.searchsorted(s, marques[t['premier_pousse']]))
    axe = np.array(b.tete(t['os_du_releve']))

    def trop_pres(p):
        return any(surfaces['arbre'].find_nearest(Vector(p.tolist()))[3] < r + jeu
                   for surfaces, jeu in ((arbre, t['jeu_min']), (foulard, t['jeu_au_foulard'])))
    for passe in range(t['passes']):
        for i in range(debut, len(X)):
            # Relevé vers le dehors, à l'horizontale depuis l'axe du tronc : poussée loin du point le plus proche, la
            # natte prise entre le foulard et le pourpoint restait sous le bord du foulard (rendu Idle_Loop).
            d = np.array([X[i][0] - axe[0], X[i][1] - axe[1], 0.0])
            d /= np.linalg.norm(d)
            while trop_pres(X[i]):
                X[i] = X[i] + t['pas_du_releve'] * d
        if passe < t['passes'] - 1:
            X[debut:-1] = 0.5 * X[debut:-1] + 0.25 * (X[debut - 1:-2] + X[debut + 1:])
    return X, abscisses(X), marques * abscisses(X)[-1] / marques[-1]


def natte(D, b, M, arbre, foulard, cote):
    """Le tube de la natte du côté `cote` ; rend, par anneau, son centre, son abscisse et ses sommets."""
    t = D['NATTE']
    X, s, marques = chemin(D, b, arbre, foulard, cote)
    L = s[-1]
    k_max = max(2, int(round(L / (0.5 * t['maillon']))))
    valeurs = np.linspace(0.0, L, k_max + 1)
    centres = reechantillonner(X, s, valeurs)
    tangentes = np.gradient(centres, axis=0)
    tangentes /= np.linalg.norm(tangentes, axis=1, keepdims=True)
    normale = np.cross(tangentes[0], [0.0, 0.0, 1.0])
    anneaux = []
    for k, (p, T) in enumerate(zip(centres, tangentes)):
        normale = normale - (normale @ T) * T
        normale /= np.linalg.norm(normale)
        binormale = np.cross(T, normale)
        renfle = k % 2 == 0
        cote_du_maillon = 1.0 if (k // 2) % 2 == 0 else -1.0
        rayon = t['rayon'] * (1.0 if renfle else t['pincement'])
        effile = min(1.0, max(0.35, (L - valeurs[k]) / t['bout']))
        centre = p + (cote_du_maillon * t['zigzag'] * t['rayon'] * normale if renfle else 0.0)
        theta = math.radians(cote_du_maillon * t['torsion'])
        points = [centre + effile * rayon * (math.cos(a + theta) * normale + math.sin(a + theta) * binormale)
                  for a in np.linspace(0.0, 2 * math.pi, t['cotes'], endpoint=False)]
        anneaux.append((p, valeurs[k], M.ajouter(points, 'natte')))
    for (pa, _, A), (pb, _, B) in zip(anneaux, anneaux[1:]):
        M.bande(A, B, 0.5 * (pa + pb))
    r = t['rayon']
    racine = M.ajouter([centres[0] - 0.5 * r * tangentes[0]], 'natte')[0]
    bout = M.ajouter([centres[-1] + 0.6 * r * tangentes[-1]], 'natte')[0]
    for (p, _, A), extremite, dedans in ((anneaux[0], racine, centres[0] + 0.5 * r * tangentes[0]),
                                         (anneaux[-1], bout, centres[-1] - 0.5 * r * tangentes[-1])):
        for i in range(len(A)):
            M.triangle(A[i], A[(i + 1) % len(A)], extremite, dedans)
    anneaux[0][2].append(racine)
    anneaux[-1][2].append(bout)
    return anneaux, marques


# ---------------------------------------------------------------- ensemble

def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    tete = b.matieres_publiees(D['CONTOURNE']['tete'], D['MATIERES_DE_LA_TETE'])
    pourpoint = b.matieres_publiees(D['CONTOURNE']['pourpoint'], D['MATIERES_DU_POURPOINT'])
    dessous = joindre_les_surfaces([pourpoint] + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    foulard_ = b.matieres_publiees(D['CONTOURNE']['foulard'], D['MATIERES_DU_FOULARD'])
    toutes = joindre_les_surfaces([tete, pourpoint, foulard_] + [b.corps(z) for z in D['ZONES_DU_CORPS']])
    foulard, arbre = porteur_de(*foulard_), porteur_de(*toutes)
    porteur_tete, porteur_dessous = porteur_de(*tete), porteur_de(*dessous)

    M = Maillage()
    calotte(D, b, M, porteur_tete)
    X, orientes, normales = M.orienter()
    W = np.array([emprunter(p, porteur_tete)[0] for p in X])
    piece = b.nappe('cheveux_nattes', X, normales, W, orientes, materiaux['poil'], D['EPAISSEUR'])

    t = D['NATTE']
    N = Maillage()
    poids_par_sommet = {}
    for cote in (1.0, -1.0):
        anneaux, marques = natte(D, b, N, arbre, foulard, cote)
        limite = marques[t['rang_de_la_tete']]
        Wr = np.array([emprunter(p, porteur_tete if s <= limite else porteur_dessous)[0] for p, s, _ in anneaux])
        for _ in range(t['lissage_des_poids']):
            Wr[1:-1] = 0.5 * Wr[1:-1] + 0.25 * (Wr[:-2] + Wr[2:])
        for (_, _, sommets), w in zip(anneaux, Wr):
            for i in sommets:
                poids_par_sommet[i] = w
    Xn, faces, _ = N.orienter()
    Wn = np.array([poids_par_sommet[i] for i in range(len(Xn))])
    tresses = b.nappe_simple('nattes', [tuple(p) for p in Xn], [tuple(f) for f in faces], Wn, materiaux['poil'])
    piece = joindre([piece, tresses])

    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
