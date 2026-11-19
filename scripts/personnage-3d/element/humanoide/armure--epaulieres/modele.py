"""Géométrie de `humanoide--armure--epaulieres` : sur chaque épaule, des lames d'acier superposées, posées sur la
manche du pourpoint publié (`donnees.py`).

Chaque lame est un arc autour de l'axe du bras (`OS`), de trois rangs (`PROFIL`), visé du dehors vers l'axe et posé au
`JEU` du pourpoint ; elle s'écarte de la manche du bord haut au bord bas, par-dessus
la lame suivante, et ses coins sont arrondis (`ARRONDI`). Double nappe ; chaque sommet porte, sans lissage, les poids du
point du pourpoint le plus proche, pour bouger comme la manche sous lui ; clés reprises du corps.
"""
import math

import numpy as np
from tissu import Maillage, emprunter, joindre, porteur_de, sur_le_porteur

HAUT = np.array([0.0, 0.0, 1.0])


def unitaire(x):
    return x / np.linalg.norm(x)


def lames(D, b, porteur, cote, mat):
    """Les lames de l'épaule `cote` (`l` ou `r`), de l'épaule vers le coude."""
    tete = np.array(b.tete(f"{D['OS'][0]}_{cote}"))
    axe = unitaire(np.array(b.tete(f"{D['OS'][1]}_{cote}")) - tete)
    dessus = unitaire(HAUT - (HAUT @ axe) * axe)
    travers = np.cross(axe, dessus)
    n = D['COLONNES']
    objets = []
    for k, demi_arc in enumerate(D['DEMI_ARCS']):
        debut = D['DEBUT'] + k * D['PAS']
        M = Maillage()
        rangs = []
        for t, ecart in D['PROFIL']:
            points = []
            for j, theta in enumerate(np.radians(np.linspace(-demi_arc, demi_arc, n + 1))):
                bout = min(j, n - j)
                retrait = D['ARRONDI'][bout] if bout < len(D['ARRONDI']) else 0.0
                s = debut + D['LONGUEUR'] * (0.5 + (t - 0.5) * (1 - retrait))
                d = math.cos(theta) * dessus + math.sin(theta) * travers
                touche, _ = sur_le_porteur(porteur, tete + s * axe, d, D['PORTEE'])
                points.append(touche + (D['JEU'] + D['EPAISSEUR'] + ecart) * d)
            rangs.append(M.ajouter(points, 'lame'))
        milieu = tete + (debut + D['LONGUEUR'] / 2) * axe
        for A, B in zip(rangs, rangs[1:]):
            for j in range(n):
                M.quad(A[j], A[j + 1], B[j + 1], B[j], milieu)
        X, orientes, normales = M.orienter()
        W = np.array([emprunter(p, porteur)[0] for p in X])
        objets.append(b.nappe(f'lame_{cote}{k}', X, normales, W, orientes, mat, D['EPAISSEUR']))
    return objets


def construire(D, materiaux, b):
    b.exiger(D['ZONES_DES_CLES'])
    porteur = porteur_de(*b.matieres_publiees(D['CONTOURNE']['pourpoint'], D['MATIERES']['pourpoint']))
    piece = joindre([o for cote in ('l', 'r') for o in lames(D, b, porteur, cote, materiaux['acier'])])
    piece.name = D['MANIFESTE']['cle']['piece']
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
