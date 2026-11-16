"""Géométrie de `humanoide--vetement--bandages` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

Par bras :
- l'avant-bras, une double nappe en colonnes d'azimut autour de l'os `lowerarm_*` : chaque colonne court de la frontière
  de la zone `avant_bras_*` au coude à
  celle du poignet, chacune passée du débord ; chaque sommet se pose sur l'enveloppe de la coupe du bras perpendiculaire
  à l'os, plus l'aisance. Les spires : à chaque bord de bande, deux anneaux en marche, celui du tour qui finit en saillie,
  le bord posé en biais, tourné d'un bord au suivant ;
- la main, une nappe simple : la peau du dos de la main et de la paume, décalée le long de ses normales, du bord de la
  zone `main_*` au poignet à la ligne où la peau passe aux doigts, hors du pouce ; chaque sommet de bord glisse sur cette
  ligne, le long de ses arêtes qui la passent ; ses poids sont ceux de la peau, tels quels.
Poids empruntés à la peau sommet par sommet, lissés aux seuls anneaux du coude ; silhouettes et clés `gabarit_*`
transférées des zones du bras.
"""
import math

import numpy as np
from tissu import (JUMEAU, Maillage, anneau, centre_de, emprunter, joindre, lisser, maillage_skinne, poids_normalises,
                   repere_de_plan, voisinage)

OS_BRAS = {'g': ('lowerarm_l', 'hand_l'), 'd': ('lowerarm_r', 'hand_r')}
ZONES = {c: [f'bras_haut_{c}', f'avant_bras_{c}', f'main_{c}'] for c in 'gd'}
POUCE, DOIGTS = ('thumb_',), ('index_', 'middle_', 'ring_', 'pinky_')


def bornes_par_colonne(b, c, coude, axe, longueur, u, v, s, debord):
    """Par colonne, les fractions des deux bouts : l'extrême de la zone `avant_bras_c` dans l'azimut de la colonne ± un pas,
    passé de `debord` (au coude, au poignet)."""
    P = b.corps(f'avant_bras_{c}')[0] - coude
    f = P @ axe / longueur
    azimut = np.degrees(np.arctan2(P @ v, P @ u)) % 360
    pas = 360 / s
    bornes = []
    for i in range(s):
        dans = np.abs((azimut - i * pas + 180) % 360 - 180) <= pas
        bornes.append((float(f[dans].min()) - debord[0], float(f[dans].max()) + debord[1]))
    return bornes


def rangs_de(D):
    """Les anneaux de l'avant-bras, du coude au poignet : (rang, saillie, azimut du biais ou `None`)."""
    S = D['SPIRES']
    rangs = [(t, 0.0, None) for t in D['RANGS_DU_COUDE']]
    for k, t in enumerate(S['bords']):
        rangs += [(t - S['marche'], S['saillie'], k * S['tour']), (t + S['marche'], 0.0, k * S['tour'])]
    return rangs + [(t, 0.0, None) for t in D['RANGS_DU_POIGNET']]


def nappe_de(b, D, M, anneaux, poids, lissage, nom, materiau):
    """La double nappe des `anneaux` fermés ; `lissage` : les sommets aux poids lissés."""
    for (A, ca), (B, cb) in zip(anneaux, anneaux[1:]):
        M.bande(A, B, (ca + cb) / 2)
    X, orientes, normales = M.orienter()
    W = np.array(poids)
    W = np.where(lissage, lisser(W, voisinage(orientes, len(X)), D['LISSAGE_AU_COUDE'][1]), W)
    return b.nappe(nom, X, normales, W, orientes, materiau, D['EPAISSEUR'])


def bande_de_main(b, c, H, nom, materiau):
    """La nappe simple de la main `c` : les faces de la peau de `main_c` dont aucun sommet n'est du pouce ni des doigts
    (poids de leurs os au-delà de `H['pouce']`, `H['doigts']`), leur plus grande pièce d'un seul tenant, décalée de
    `H['decalage']`."""
    P0, T0, W0 = b.corps(f'main_{c}')
    _, premier, noeud = np.unique(np.round(P0 * 1e5).astype(np.int64), axis=0, return_index=True, return_inverse=True)
    P, W, T = P0[premier], W0[premier], noeud.ravel()[T0]
    T = T[(T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])]
    N = np.zeros_like(P)
    for k, n in zip(T.T, [np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])] * 3):
        np.add.at(N, k, n)
    N /= np.linalg.norm(N, axis=1, keepdims=True)

    def part(prefixes):
        return W[:, [k for k, o in enumerate(b.os) if o.startswith(prefixes)]].sum(axis=1)
    marge = np.minimum(H['pouce'] - part(POUCE), H['doigts'] - part(DOIGTS))     # positive sur la bande, nulle à son bord
    faces = T[(marge[T] > 0).all(axis=1)]
    piece = np.arange(len(P))                                                     # plus petit sommet de la pièce de chacun
    while True:
        suite = piece.copy()
        np.minimum.at(suite, faces, suite[faces].min(axis=1, keepdims=True))
        if (suite == piece).all():
            break
        piece = suite
    tailles = np.bincount(piece[faces[:, 0]], minlength=len(P))
    faces = faces[piece[faces[:, 0]] == int(np.argmax(tailles))]

    # Chaque sommet de bord glisse sur la ligne : la moyenne des points où ses arêtes la passent.
    coupes = {}
    for t in T:
        for a in t:
            for d in t:
                if marge[a] > 0 >= marge[d]:
                    coupes.setdefault(int(a), {})[int(d)] = marge[a] / (marge[a] - marge[d])
    X, Wn = P + H['decalage'] * N, W.copy()
    for a, voisins in coupes.items():
        pts = [(P[a] + u * (P[d] - P[a]), N[a] + u * (N[d] - N[a]), W[a] + u * (W[d] - W[a])) for d, u in sorted(voisins.items())]
        p, n, w = (np.mean([q[k] for q in pts], axis=0) for k in range(3))
        X[a], Wn[a] = p + H['decalage'] * n / np.linalg.norm(n), w

    def endroit(Q):
        return np.cross(Q[faces[:, 1]] - Q[faces[:, 0]], Q[faces[:, 2]] - Q[faces[:, 0]])
    faces = faces[(endroit(X) * endroit(P)).sum(axis=1) > 0]      # sans la face qu'un sommet glissé retourne
    gardes = np.unique(faces)
    rang = {int(k): i for i, k in enumerate(gardes)}
    bande = maillage_skinne(nom, [tuple(X[k]) for k in gardes], [[rang[int(k)] for k in f] for f in faces], materiau, b.rig,
                            poids_normalises(Wn[gardes], b.os))
    for poly in bande.data.polygons:
        poly.use_smooth = True
    bande.data.attributes.new(JUMEAU, 'INT', 'POINT')   # nappe simple : chaque sommet est son propre jumeau
    return bande


def construire(D, materiaux, b):
    b.exiger(ZONES['g'] + ZONES['d'])
    s = D['SEGMENTS']
    azimuts = [2 * math.pi * i / s for i in range(s)]
    dirs = [np.array([math.cos(a), math.sin(a)]) for a in azimuts]
    rangs = rangs_de(D)
    pieces = []
    for c, signe in (('g', 1.0), ('d', -1.0)):
        coude, poignet = (np.array(b.tete(o)) for o in OS_BRAS[c])
        longueur = float(np.linalg.norm(poignet - coude))
        axe = (poignet - coude) / longueur
        u, v = repere_de_plan(axe, (0.0, 0.0, 1.0), signe)
        bornes = bornes_par_colonne(b, c, coude, axe, longueur, u, v, s, D['DEBORD'])
        porteur = b.porteur(ZONES[c])
        M = Maillage()
        poids, anneaux = [], []
        for t, saillie, tour in rangs:
            pts = []
            for i, (f0, f1) in enumerate(bornes):
                biais = 0.0 if tour is None else D['SPIRES']['biais'] * math.cos(azimuts[i] - math.radians(tour))
                O = coude + (f0 + (t + biais) * (f1 - f0)) * longueur * axe
                P = b.coupe(ZONES[c], O, axe, u, v)
                p = anneau(P, centre_de(P), [dirs[i]], [D['AISANCE'] + saillie], D['AISANCE'], au_plus_pres=True)[0]
                pts.append(O + p[0] * u + p[1] * v)
            anneaux.append((M.ajouter(pts, None), np.mean(pts, axis=0)))
            poids.extend(emprunter(p, porteur)[0] for p in pts)
        au_coude = np.repeat([t <= D['LISSAGE_AU_COUDE'][0] for t, _, _ in rangs], s)[:, None]
        pieces.append(nappe_de(b, D, M, anneaux, poids, au_coude, f'bandages_{c}', materiaux['bandages']))

        pieces.append(bande_de_main(b, c, D['MAIN'], f'bandages_main_{c}', materiaux['bandages']))
    piece = joindre(pieces)
    piece.name = 'bandages'
    b.transferer(piece, ZONES['g'] + ZONES['d'])
    return piece
