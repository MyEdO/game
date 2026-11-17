"""Géométrie de `humanoide--rigide--fiole` : un tube de révolution le long du +Y de la prise, centré sur l'origine, le
bouchon vers -Y (le haut une fois rangée), une bague sous le bouchon et un culot au fond, son dos sur z = 0."""
from maille import Maille, objet, tour


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    r, demi = D['RAYON'], D['LONGUEUR'] / 2
    bouchon, bague = r * D['BOUCHON']['rayon'], r * D['BAGUE']['rayon']
    col = D['BOUCHON']['longueur'] - demi
    epaule = col + D['BAGUE']['longueur']
    culot = demi - D['BAGUE']['longueur']
    profil = [(-demi, 0), (-demi, bouchon), (col, bouchon), (col, bague), (epaule, bague), (epaule, r), (culot, r),
              (culot, bague), (demi, bague), (demi, 0)]
    tour(m, profil, 'y', (0.0, 0.0, bague), D['SEGMENTS'], ['bouchon'] * 5 + ['fiole'] + ['bouchon'] * 4)
    return [objet('humanoide--rigide--fiole', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
