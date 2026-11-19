"""Géométrie de `humanoide--rigide--pilon_et_mortier` : un mortier de révolution autour du +Y de la prise, l'ouverture en
haut et son creux, cerclé sous la lèvre, pendu à deux brins de sangle ; le pilon dressé dedans, penché vers +Z, virole au
bout (+Y vers le bas une fois rangé, +Z sortant)."""
import math

from mathutils import Matrix, Vector
from maille import Maille, objet, poutre, tore, tour


def construire(D, materiaux):
    m = Maille(list(materiaux.values()))
    y0 = D['SOUS_L_ORIGINE']
    rayon = max(r for _, r in D['MORTIER'])
    centre = (0.0, y0, rayon)
    levre = D['MORTIER'][0][1] - D['PAROI']
    creux = [(0.0, levre), (D['PROFONDEUR_DU_CREUX'] * 0.7, levre * 0.8), (D['PROFONDEUR_DU_CREUX'], 0.0)]
    tour(m, [(a, r) for a, r in reversed(D['MORTIER'])] + creux, 'y', centre, D['SEGMENTS'], 'bois')
    C = D['CERCLE']
    tore(m, 'y', (0.0, y0 + C['profondeur'], rayon), C['rayon'], C['section'], C['segments'], C['cotes'], 'metal')

    debut = len(m.v)
    tour(m, D['PILON'], 'y', (0.0, 0.0, 0.0), D['SEGMENTS'] // 2 * 2, 'bois')
    V = D['VIROLE']
    tour(m, [(V['depuis'], V['rayon']), (V['jusqu_a'], V['rayon'])], 'y', (0.0, 0.0, 0.0), D['SEGMENTS'], 'metal')
    pose = Matrix.Translation((0.0, y0 + D['PILON_ENFONCE'], rayon)) @ Matrix.Rotation(math.radians(180 - D['PILON_INCLINE']), 4, 'X')
    m.v[debut:] = [tuple(pose @ Vector(p)) for p in m.v[debut:]]

    S = D['SANGLE']
    for x in (-S['ecart'], S['ecart']):
        poutre(m, (x, y0, rayon * 0.3), (0.0, 0.0, S['epaisseur']), S['largeur'], S['epaisseur'], (0, 0, 1), 'cuir')
    return [objet('humanoide--rigide--pilon_et_mortier', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
