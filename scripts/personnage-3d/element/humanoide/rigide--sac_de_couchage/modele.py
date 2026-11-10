"""Géométrie de `humanoide--rigide--sac_de_couchage` : un rouleau de toile couché sur l'axe x de la prise, ses bouts
creusés, serré par deux sangles de cuir (+Y vers le bas une fois rangé, +Z sortant)."""
from maille import Maille, objet, tour


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    r, demi, B = D['RAYON'], D['LONGUEUR'] / 2, D['BOUT']
    centre = (0.0, D['HAUTEUR'], r)
    profil = [(-demi + B['creux'], 0), (-demi, B['cœur'] * r), (-demi, B['bord'] * r), (-demi + B['chanfrein'], r),
              (demi - B['chanfrein'], r), (demi, B['bord'] * r), (demi, B['cœur'] * r), (demi - B['creux'], 0)]
    tour(m, profil, 'x', centre, D['SEGMENTS'], 'toile')
    L = D['LIENS']
    for p in L['positions']:
        a0, a1 = p - L['largeur'] / 2, p + L['largeur'] / 2
        r0, r1 = r - L['epaisseur'] / 2, r + L['epaisseur']
        tour(m, [(a0, r0), (a1, r0), (a1, r1), (a0, r1)], 'x', centre, L['segments'], 'cuir', ferme=True)
    return [objet('humanoide--rigide--sac_de_couchage', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
