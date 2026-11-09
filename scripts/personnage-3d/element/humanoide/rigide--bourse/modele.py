"""Géométrie de `humanoide--rigide--bourse` : une poche de cuir de révolution autour du +Y de la prise, aplatie sur z, son
cordon noué au col et la boucle qui monte jusqu'à l'emplacement, le fond incliné vers l'extérieur (+Y vers le bas une fois rangée, +Z sortant)."""
from maille import Maille, basculer_maille, objet, poutre, tore, tour


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    rayon_max = max(r for _, r in D['PROFIL'])
    centre = (0.0, 0.0, rayon_max * D['APLATI'])
    tour(m, D['PROFIL'], 'y', centre, D['SEGMENTS'], 'cuir')
    C = D['CORDON']
    tore(m, 'y', (0.0, C['y'], centre[2]), C['rayon'], C['section'], C['segments'], C['cotes'], 'cuir')
    cz = centre[2]
    m.v = [(x, y, cz + (z - cz) * D['APLATI']) for x, y, z in m.v]
    A = D['ATTACHE']
    for x in (-A['ecart'], A['ecart']):
        poutre(m, (x, C['y'], cz * (1 - D['APLATI']) + A['epaisseur']), (0.0, -A['au_dessus'], A['epaisseur'] / 2),
               A['largeur'], A['epaisseur'], (0, 0, 1), 'cuir')
    basculer_maille(m, (0.0, 0.0), -D['ECART'])
    return [objet('humanoide--rigide--bourse', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
