"""Géométrie de `humanoide--pilosite--calvitie-et-barbe-rase` (`element/pilosite.py`) : un chaume ras, la peau de la tête
publiée sous un masque, décalée le long de sa normale.

- Le masque : les sommets de la peau dans la couronne (de la tempe gauche à la tempe droite par la nuque, au-dessus et
  derrière les oreilles) ou dans la barbe (d'un favori à l'autre par le menton et le dessous du menton, les lèvres hors
  d'elle) ; chaque bord, bas, haut et côtés, découpé en mèches. Une face de la peau est au poil si
  `SOMMETS_PAR_FACE` de ses sommets le sont : le contour suit les faces de la tête (lèvres comprises).
- Les nus : une face dont un sommet est sur une oreille ou au creux d'une cavité (sa normale rencontre la peau :
  l'intérieur de la bouche) reste nue, quel que soit le masque.
- La hauteur : du bord au cœur, `HAUTEUR` selon l'anneau du sommet, plus un grain ; le chaume se fond dans la peau à son
  pourtour, sans marche.

Double nappe d'épaisseur sous la hauteur du bord, poids et clés propres de la peau tels quels (`pilosite.py`),
silhouettes et clés `gabarit_*` transférées des zones de la base que la tête recouvre. Toute cote vient de `donnees.py`.
"""
import numpy as np

from maille import tirage
from pilosite import angles, anneaux, au_poil, barbe, dans_la_bande, normales_de, peau_de_la_tete


def oreille(D, X):
    """Par sommet de la peau `X`, s'il est sur une oreille."""
    o = D['OREILLE']
    return (np.abs(X[:, 0]) > o['x_min']) & (X[:, 1] > o['y'][0]) & (X[:, 1] < o['y'][1]) \
        & (X[:, 2] > o['z'][0]) & (X[:, 2] < o['z'][1])


def masque(D, b, X):
    """Par sommet de la peau `X`, s'il est dans la couronne ou dans la barbe (`pilosite.barbe`, hors des lèvres)."""
    pc, ec = angles(b, D['COURONNE'], X)
    couronne = np.array([dans_la_bande(D['COURONNE'], p, e, 'phi_min') for p, e in zip(pc, ec)])
    return couronne | barbe(D, b, X)[0]


def construire(D, materiaux, b):
    peau = peau_de_la_tete(D, b)
    _, X, faces, W, cles = au_poil(D, peau, masque(D, b, peau[0]), oreille(D, peau[0]))
    N = normales_de(X, faces)
    rang = anneaux(faces, len(X))
    grain = tirage(D['GRAINE'])
    hauteur = np.array([D['HAUTEUR'][min(r, 2)] + (grain.uniform(-0.5, 0.5) * D['GRAIN'] if r > 0 else 0.0) for r in rang])
    piece = b.nappe('calvitie_et_barbe_rase', X + N * hauteur[:, None], N, W, [tuple(f) for f in faces],
                    materiaux['poil'], D['EPAISSEUR'], cles=cles)
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
