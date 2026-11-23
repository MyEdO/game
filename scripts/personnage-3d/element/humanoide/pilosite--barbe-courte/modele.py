"""Géométrie de `humanoide--pilosite--barbe-courte` (`element/pilosite.py`) : une barbe courte et dense, la peau de la tête
publiée sous un masque, décalée le long de sa normale lissée.

- Le masque : les sommets de la peau dans la barbe (d'un favori à l'autre par le menton et le dessous du menton, la
  moustache comprise, les lèvres hors d'elle), chaque bord découpé en mèches ; une face de la peau est au poil si
  `SOMMETS_PAR_FACE` de ses sommets le sont. Une face dont un sommet est au creux d'une cavité (l'intérieur de la bouche)
  ou au coin de la bouche (`coin_de_la_bouche`) reste nue.
- L'épaisseur : `BORD` au bord du masque, puis `PENTE` par mètre d'éloignement du bord, bornée par le plafond de
  l'endroit (`PLAFOND` par élévation, `PART` par azimut), plus un grain ; la barbe se fond dans la peau à son pourtour,
  sans marche.

Nappe simple, poids et clés propres de la peau tels quels (`pilosite.py`), silhouettes et clés `gabarit_*` transférées
des zones de la base que la tête recouvre. Toute cote vient de `donnees.py`.
"""
import numpy as np

from maille import tirage
from pilosite import anneaux, au_poil, barbe, normales_de, peau_de_la_tete
from tissu import lisser, table, voisinage


def construire(D, materiaux, b):
    peau = peau_de_la_tete(D, b)
    poil, phi, e = barbe(D, b, peau[0])
    coin = D['BARBE']['coin_de_la_bouche']
    nu = (np.abs(phi) - coin['phi']) ** 2 + (e - coin['elevation']) ** 2 < coin['rayon'] ** 2
    gardes, X, faces, W, cles = au_poil(D, peau, poil, nu)
    phi, e = phi[gardes], e[gardes]
    N = lisser(normales_de(X, faces), voisinage(faces, len(X)), D['LISSAGE_DES_NORMALES'])
    N /= np.linalg.norm(N, axis=1, keepdims=True)
    bord = anneaux(faces, len(X)) == 0
    eloignement = np.linalg.norm(X[:, None] - X[bord][None], axis=2).min(axis=1)
    plafond = np.array([table(D['PLAFOND'], f) * table(D['PART'], abs(p)) for p, f in zip(phi, e)])
    grain = tirage(D['GRAINE'])
    montee = np.minimum(D['PENTE'] * eloignement, plafond)
    hauteur = D['BORD'] + montee + np.minimum(montee, D['GRAIN']) * np.array([grain.uniform(-0.5, 0.5) for _ in bord])
    piece = b.nappe_simple('barbe_courte', [tuple(p) for p in X + N * hauteur[:, None]], [tuple(f) for f in faces], W,
                           materiaux['poil'], cles=cles)
    b.transferer(piece, D['ZONES_DES_CLES'])
    return piece
