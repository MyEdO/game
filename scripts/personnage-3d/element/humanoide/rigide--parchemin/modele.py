"""Géométrie de `humanoide--rigide--parchemin` : un rouleau de révolution le long du +Y de la prise, centré sur l'origine,
son dos sur z = 0, le cœur en retrait aux deux bouts."""
from maille import Maille, objet, tour


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    r, demi, c = D['RAYON'], D['LONGUEUR'] / 2, D['RAYON'] * D['ENROULEMENT']
    fond = demi - D['RETRAIT']
    profil = [(-fond, 0), (-fond, c), (-demi, c), (-demi, r), (demi, r), (demi, c), (fond, c), (fond, 0)]
    tour(m, profil, 'y', (0.0, 0.0, r), D['SEGMENTS'], 'parchemin')
    return [objet('humanoide--rigide--parchemin', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
