"""Géométrie de `humanoide--rigide--amulette` : un médaillon rond à bord relevé et champ uni, face vers +Z, sa bélière et
le cordon qui monte jusqu'à l'emplacement, le bas écarté du corps (+Y vers le bas une fois rangée, +Z sortant)."""
from maille import Maille, basculer_maille, objet, tore, tour, tube


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    r, e, B = D['RAYON'], D['EPAISSEUR'], D['BORD']
    yc = D['DESCENTE']
    champ = r - B['largeur']
    profil = [(0.0, 0), (0.0, r), (e, r), (e, champ), (e - B['creux'], champ - 0.001), (e - B['creux'], 0)]
    tour(m, profil, 'z', (0.0, yc, 0.0), D['SEGMENTS'], 'metal')
    L = D['BELIERE']
    haut = yc - r - L['rayon'] + L['section']
    tore(m, 'x', (0.0, haut, e / 2), L['rayon'], L['section'], L['segments'], L['cotes'], 'metal')
    C = D['CORDON']
    tube(m, [(0.0, haut - L['rayon'], e / 2), (0.0, 0.0, C['rayon']), (0.0, -C['au_dessus'], C['rayon'])], C['rayon'],
         C['cotes'], 'cuir')
    basculer_maille(m, (0.0, 0.0), -D['ECART'])
    return [objet('humanoide--rigide--amulette', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
