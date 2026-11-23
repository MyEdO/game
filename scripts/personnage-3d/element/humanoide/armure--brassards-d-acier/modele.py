"""Géométrie de `humanoide--armure--brassards-d-acier` : sur chaque avant-bras, un canon d'acier fermé, anneaux autour
de l'axe coude-poignet, du coude (son bord plus haut à l'arrière, sur la pointe du coude) au poignet (`donnees.py`).

Le rayon de chaque sommet est celui de l'enveloppe des coupes du corps et des manches publiées qu'il couvre (coupes tous
les `PAS_DES_COUPES`, la plus large l'emportant, adoucie de `PENTE` de part et d'autre), plus le `JEU` ; les bandes
d'anneaux des bords sont dorées, en relief. Poids empruntés sommet par sommet, au bord du coude à la manche du
pourpoint, ailleurs au corps, puis lissés sur la grille,
identiques sur l'acier et la dorure qui partagent un anneau ; double nappe ; silhouettes et clés `gabarit_*`
transférées."""
import math

import numpy as np
from maille import lineaire
from tente import HAUT
from tissu import (Maillage, emprunter, enveloppe_convexe, joindre, lisser, porteur_de, rayon_a_l_enveloppe,
                   repere_de_plan, voisinage)


def enveloppes(D, b, coude, axe, u, v, manches):
    """Par coupe, son abscisse et l'enveloppe convexe (u, v) du corps et des manches autour de l'axe."""
    resultat = []
    for s in np.arange(D['RANGEES'][0][0] - 0.02, D['RANGEES'][-1][0] + 0.011, D['PAS_DES_COUPES']):
        origine = coude + s * axe
        P = [b.coupe(D['ZONES_DU_BRAS'], origine, axe, u, v, minimum=0).reshape(-1, 2)]
        if s <= D['FIN_DES_MANCHES']:
            dans = manches[np.abs((manches - coude) @ axe - s) < D['PAS_DES_COUPES'] * 0.6] - origine
            P.append(np.stack([dans @ u, dans @ v], axis=1))
        P = np.concatenate(P)
        if len(P) >= 3:
            resultat.append((s, enveloppe_convexe(P)))
    return resultat


def canon(D, b, c, materiaux, manches, manche):
    """Le canon du bras `c` (`g` ou `d`) : ses morceaux d'acier et de dorure, double nappe chacun."""
    cote, signe = {'g': ('l', 1.0), 'd': ('r', -1.0)}[c]
    coude, poignet = np.array(b.tete(f'lowerarm_{cote}')), np.array(b.tete(f'hand_{cote}'))
    axe = (poignet - coude) / np.linalg.norm(poignet - coude)
    u, v = repere_de_plan(axe, HAUT, signe)
    D = {**D, 'ZONES_DU_BRAS': D['ZONES'][c]}
    cote_du_bras = manches[np.sign(manches[:, 0]) == np.sign(coude[0])]
    coupes = enveloppes(D, b, coude, axe, u, v, cote_du_bras)
    porteur = b.porteur(D['ZONES'][c])
    n = D['COLONNES']
    thetas = [math.radians(360.0 * j / n) for j in range(n)]
    grille, radiales, centres = [], [], []
    for s_dos, s_pli in D['RANGEES']:
        rangee, rad = [], []
        for t in thetas:
            part = ((1 + math.cos(t - math.radians(D['AZIMUT_ARRIERE']))) / 2) ** D['POINTE']
            s = s_pli + (s_dos - s_pli) * part
            d2 = np.array([math.cos(t), math.sin(t)])
            r = max(rayon_a_l_enveloppe(H, np.zeros(2), d2) - D['PENTE'] * abs(s - sk) for sk, H in coupes)
            d3 = d2[0] * u + d2[1] * v
            rangee.append(coude + s * axe + (r + lineaire(D['JEU'], s)) * d3)
            rad.append(d3)
        grille.append(rangee)
        radiales.append(rad)
        centres.append(coude + np.mean([s_dos, s_pli]) * axe)
    X = np.array([p for rangee in grille for p in rangee])
    tout = Maillage()
    tout.ajouter(list(X), None)
    for i in range(len(grille) - 1):
        tout.bande(list(range(i * n, (i + 1) * n)), list(range((i + 1) * n, (i + 2) * n)), (centres[i] + centres[i + 1]) / 2)
    _, orientes, _ = tout.orienter()
    au_coude = (X - coude) @ axe < D['FIN_DES_MANCHES']
    W = np.array([emprunter(p, manche if haut else porteur)[0] for p, haut in zip(X, au_coude)])
    W = lisser(W, voisinage(orientes, len(X)), D['LISSAGE_POIDS'])
    k = len(grille) - 1
    bandes = [('dorure', 0, D['LISERES']['haut']), ('acier', D['LISERES']['haut'], k - D['LISERES']['bas']),
              ('dorure', k - D['LISERES']['bas'], k)]
    objets = []
    for m, (mat, debut, fin) in enumerate(bandes):
        M = Maillage()
        relief = D['RELIEF_DU_LISERE'] if mat == 'dorure' else 0.0
        anneaux = [M.ajouter([grille[i][j] + relief * radiales[i][j] for j in range(n)], mat) for i in range(debut, fin + 1)]
        for i, (A, B) in enumerate(zip(anneaux, anneaux[1:])):
            M.bande(A, B, (centres[debut + i] + centres[debut + i + 1]) / 2)
        Xm, orientes_m, normales = M.orienter()
        Wm = W[debut * n:(fin + 1) * n]
        objets.append(b.nappe(f'brassard_{c}{m}', Xm, normales, Wm, orientes_m, materiaux[mat], D['EPAISSEUR']))
    return objets


def construire(D, materiaux, b):
    b.exiger(D['ZONES']['g'] + D['ZONES']['d'])
    publiees = {k: b.matieres_publiees(D['CONTOURNE'][k], D['MATIERES'][k]) for k in D['CONTOURNE']}
    manches = np.concatenate([P for P, _, _ in publiees.values()])
    manche = porteur_de(*publiees[D['POIDS_DE_LA_MANCHE']])
    piece = joindre([o for c in 'gd' for o in canon(D, b, c, materiaux, manches, manche)])
    piece.name = 'brassards'
    b.transferer(piece, D['ZONES']['g'] + D['ZONES']['d'])
    return piece
