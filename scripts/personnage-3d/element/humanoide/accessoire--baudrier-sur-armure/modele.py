"""Géométrie de `humanoide--accessoire--baudrier-sur-armure` : le kit des sangles (`element/sangle.py`) sur le plastron,
et une boucle, cadre carré à plat sur le brin de devant (surface `boucle`), aux poids du plastron sous elle, ses
silhouettes et clés `gabarit_*` reprises du plastron comme celles de la sangle."""
import numpy as np

from sangle import construire as sangle
from tissu import Maillage, emprunter, joindre, porteur_de


def unitaire(x):
    return x / np.linalg.norm(x)


def construire(D, materiaux, b):
    piece = sangle(D, materiaux, b)
    (publie,) = D['CONTOURNE'].values()
    support = porteur_de(*b.matieres_publiees(publie, D['MATIERES_DU_SUPPORT']))

    # Le brin de devant à `BOUCLE_Z` : les sommets extérieurs de la sangle à cette hauteur, devant ; sa pente et sa
    # normale sortante.
    X = np.array([v.co[:] for v in piece.data.vertices])
    devant = X[(np.abs(X[:, 2] - D['BOUCLE_Z']) < 0.04) & (X[:, 1] < np.median(X[:, 1]))]
    if len(devant) < 4:
        raise ValueError(f'boucle : aucun brin de devant à z = {D["BOUCLE_Z"]}')
    centre = devant.mean(axis=0)
    _, _, axe = np.linalg.svd(devant - centre)
    le_long = unitaire(axe[0] * np.sign(axe[0][2] or 1.0))
    sortante = unitaire(axe[2] * (-1.0 if axe[2][1] > 0 else 1.0))
    travers = np.cross(sortante, le_long)
    devant_max = float(((devant - centre) @ sortante).max())
    origine = centre + (devant_max + D['JEU_BOUCLE'] + D['EPAISSEUR_BOUCLE']) * sortante

    longueur, largeur, cadre = D['BOUCLE']
    M = Maillage()
    exterieur = M.ajouter([origine + a * longueur / 2 * le_long + c * largeur / 2 * travers
                           for a, c in ((-1, -1), (1, -1), (1, 1), (-1, 1))], None)
    interieur = M.ajouter([origine + a * (longueur / 2 - cadre) * le_long + c * (largeur / 2 - cadre) * travers
                           for a, c in ((-1, -1), (1, -1), (1, 1), (-1, 1))], None)
    dessous = origine - 0.1 * sortante
    M.bande(exterieur, interieur, dessous)
    P, orientes, normales = M.orienter()
    W = np.array([emprunter(p, support)[0] for p in P])
    boucle = b.nappe('boucle', P, normales, W, orientes, materiaux['boucle'], D['EPAISSEUR_BOUCLE'])
    b.transferer(boucle, D['ZONES'], masques=[([True] * len(boucle.data.vertices), D['ZONES'],
                                               {publie: D['ZONES_DU_SUPPORT']})])
    piece = joindre([piece, boucle])
    piece.name = D['MANIFESTE']['cle']['piece']
    return piece
