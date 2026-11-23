"""Géométrie de `humanoide--vetement--bandages` (`element/tissu.py`), d'après `donnees.py` (aucun nombre ici).

Par bras, une seule double nappe en colonnes d'azimut, du coude à la base des doigts :
- sur l'avant-bras, autour de l'os `lowerarm_*` : chaque colonne court de la frontière de la zone `avant_bras_*` au coude
  à celle du poignet, chacune passée du débord ; chaque sommet se pose sur l'enveloppe de la coupe du bras perpendiculaire
  à l'os, plus l'aisance. Les spires : à chaque bord de bande, deux anneaux en marche, celui du tour qui finit en saillie,
  le bord posé en biais, tourné d'un bord au suivant ;
- sur la main, les mêmes colonnes continuent, autour de l'axe du poignet à la base du majeur : chaque sommet est visé du
  dehors vers cet axe sur la peau de la main sans le pouce, au plus loin de sa colonne, et s'arrête au décalage ; les anneaux de la base du pouce
  s'ouvrent d'une fente dans son azimut, ceux d'après se referment entre le pouce et l'index, le dernier droit en travers
  de la main, avant les jointures.
Poids empruntés à la peau sommet par sommet, lissés aux seuls anneaux du coude ; silhouettes et clés `gabarit_*`
transférées des zones du bras.
"""
import math

import numpy as np
from tente import HAUT
from tissu import Maillage, anneau, centre_de, emprunter, joindre, lisser, porteur_de, repere_de_plan, viser, voisinage

OS_BRAS = {'g': ('lowerarm_l', 'hand_l', 'middle_01_l', 'thumb_02_l'), 'd': ('lowerarm_r', 'hand_r', 'middle_01_r', 'thumb_02_r')}
ZONES = {c: [f'bras_haut_{c}', f'avant_bras_{c}', f'main_{c}'] for c in 'gd'}
POUCE = 'thumb_'


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


def main_sans_pouce(b, c, seuil):
    """La peau de la zone `main_c` sans les faces d'un sommet du pouce (poids de ses os au-delà de `seuil`), en surface
    porteuse."""
    P, T, W = b.corps(f'main_{c}')
    pouce = W[:, [k for k, o in enumerate(b.os) if o.startswith(POUCE)]].sum(axis=1) > seuil
    return porteur_de(P, T[~pouce[T].any(axis=1)], W)


def construire(D, materiaux, b):
    b.exiger(ZONES['g'] + ZONES['d'])
    s, H = D['SEGMENTS'], D['MAIN']
    azimuts = [2 * math.pi * i / s for i in range(s)]
    dirs = [np.array([math.cos(a), math.sin(a)]) for a in azimuts]
    rangs = rangs_de(D)
    pieces = []
    for c, signe in (('g', 1.0), ('d', -1.0)):
        coude, poignet, majeur, pouce = (np.array(b.tete(o)) for o in OS_BRAS[c])
        longueur = float(np.linalg.norm(poignet - coude))
        axe = (poignet - coude) / longueur
        u, v = repere_de_plan(axe, HAUT, signe)
        bornes = bornes_par_colonne(b, c, coude, axe, longueur, u, v, s, D['DEBORD'])
        porteur = b.porteur(ZONES[c])
        M = Maillage()
        poids, anneaux = [], []

        # Avant-bras.
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
        au_coude = [t <= D['LISSAGE_AU_COUDE'][0] for t, _, _ in rangs for _ in range(s)]

        # Main : les mêmes colonnes, visées sur la peau sans le pouce.
        peau = main_sans_pouce(b, c, H['pouce'])
        portee = float(np.linalg.norm(majeur - poignet))
        axe_m = (majeur - poignet) / portee
        um, vm = repere_de_plan(axe_m, HAUT, signe)
        au_pouce = math.atan2((pouce - poignet) @ vm, (pouce - poignet) @ um)
        fente = [abs((a - au_pouce + math.pi) % (2 * math.pi) - math.pi) <= math.radians(H['fente']) for a in azimuts]
        for g, ouvert in H['rangs']:
            O = poignet + g * portee * axe_m
            visees = {}
            for i in range(s):
                if not (ouvert and fente[i]):
                    d = dirs[i][0] * um + dirs[i][1] * vm
                    rayons = []      # le plus loin de l'axe des visées de la colonne et de ses deux demi-pas voisins
                    for pas in (-0.5, 0.0, 0.5):
                        a = azimuts[i] + pas * 2 * math.pi / s
                        e = math.cos(a) * um + math.sin(a) * vm
                        touche = viser(peau, O, e, H['portee'])
                        if touche[0] is not None:
                            rayons.append((H['portee'] - touche[3]) * float(e @ d))
                    visees[i] = (d, max(rayons) if rayons else None)
            touchees = [r for _, r in visees.values() if r is not None]
            rang, pts = [], []
            for i in range(s):
                if i not in visees:
                    rang.append(None)
                    continue
                d, r = visees[i]      # sans peau sous la visée (le trou du pouce), le rayon moyen de l'anneau
                p = O + ((np.mean(touchees) if r is None else r) + H['decalage']) * d
                rang.append(M.ajouter([p], None)[0])
                pts.append(p)
                poids.append(emprunter(p, peau)[0])
                au_coude.append(False)
            anneaux.append((rang, np.mean(pts, axis=0)))

        for (A, ca), (B, cb) in zip(anneaux, anneaux[1:]):
            for i in range(s):
                coins = (A[i], A[(i + 1) % s], B[(i + 1) % s], B[i])
                if None not in coins:
                    M.quad(*coins, (ca + cb) / 2)
        X, orientes, normales = M.orienter()
        W = np.array(poids)
        W = np.where(np.array(au_coude)[:, None], lisser(W, voisinage(orientes, len(X)), D['LISSAGE_AU_COUDE'][1]), W)
        pieces.append(b.nappe(f'bandages_{c}', X, normales, W, orientes, materiaux['bandages'], D['EPAISSEUR']))
    piece = joindre(pieces)
    piece.name = 'bandages'
    b.transferer(piece, ZONES['g'] + ZONES['d'])
    return piece
