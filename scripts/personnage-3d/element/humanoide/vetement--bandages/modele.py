"""Géométrie de `humanoide--vetement--bandages` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

Une double nappe par avant-bras, en colonnes d'azimut autour de l'os `lowerarm_*` : chaque colonne court de la frontière
de la zone `avant_bras_*` au coude à celle du poignet, chacune passée du débord ; chaque sommet se pose sur l'enveloppe
de la coupe du bras perpendiculaire à l'os, plus l'aisance. Poids empruntés à la peau sommet par sommet, lissés aux
seuls anneaux du coude ; silhouettes et clés `gabarit_*` transférées des zones du bras.
"""
import math

import numpy as np
from tissu import Maillage, anneau, centre_de, emprunter, joindre, lisser, repere_de_plan, voisinage

OS_BRAS = {'g': ('lowerarm_l', 'hand_l'), 'd': ('lowerarm_r', 'hand_r')}
ZONES = {c: [f'bras_haut_{c}', f'avant_bras_{c}', f'main_{c}'] for c in 'gd'}


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


def construire(D, materiaux, b):
    b.exiger(ZONES['g'] + ZONES['d'])
    s = D['SEGMENTS']
    dirs = [np.array([math.cos(2 * math.pi * i / s), math.sin(2 * math.pi * i / s)]) for i in range(s)]
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
        for t in D['RANGS']:
            pts = []
            for i, (f0, f1) in enumerate(bornes):
                O = coude + (f0 + t * (f1 - f0)) * longueur * axe
                P = b.coupe(ZONES[c], O, axe, u, v)
                centre = centre_de(P)
                p = anneau(P, centre, [dirs[i]], [D['AISANCE']], D['AISANCE'], au_plus_pres=True)[0]
                pts.append(O + p[0] * u + p[1] * v)
            anneaux.append((M.ajouter(pts, None), np.mean(pts, axis=0)))
            poids.extend(emprunter(p, porteur)[0] for p in pts)
        for (A, ca), (B, cb) in zip(anneaux, anneaux[1:]):
            M.bande(A, B, (ca + cb) / 2)
        X, orientes, normales = M.orienter()
        jusqu_a, passes = D['LISSAGE_AU_COUDE']
        coude_ = np.repeat([t <= jusqu_a for t in D['RANGS']], s)[:, None]
        W0 = np.array(poids)
        W = np.where(coude_, lisser(W0, voisinage(orientes, len(X)), passes), W0)
        pieces.append(b.nappe(f'bandages_{c}', X, normales, W, orientes, materiaux['bandages'], D['EPAISSEUR']))
    piece = joindre(pieces)
    piece.name = 'bandages'
    b.transferer(piece, ZONES['g'] + ZONES['d'])
    return piece
