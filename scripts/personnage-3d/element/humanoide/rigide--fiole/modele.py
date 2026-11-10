"""Géométrie de `humanoide--rigide--fiole` : une fiole de révolution le long du +Y de la prise, centrée sur l'origine, le
bouchon vers -Y (le haut une fois rangée), son dos sur z = 0."""
from maille import Maille, objet, tour


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    r, col, demi = D['RAYON'], D['RAYON'] * D['COL'], D['LONGUEUR'] / 2
    epaule = D['BOUCHON'] - demi
    profil = [(-demi, 0), (-demi, col), (epaule, col), (epaule, r), (demi, r), (demi, 0)]
    tour(m, profil, 'y', (0.0, 0.0, r), D['SEGMENTS'], ['bouchon', 'bouchon', 'fiole', 'fiole', 'fiole'])
    return [objet('humanoide--rigide--fiole', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
