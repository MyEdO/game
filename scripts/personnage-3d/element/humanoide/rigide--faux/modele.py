"""Géométrie de `humanoide--rigide--faux` : un manche droit de bois le long du +Y de la prise, centré sur
`AXE_DANS_LA_PRISE`, sa virole au haut, et la lame en croissant qui en part vers +Z (le sens du tranchant), courbée vers
le talon, plate dans le plan (y, z) du manche, son fil sur le creux."""
import math

from maille import Maille, cylindre, objet


def lame(m, D, depart, cu):
    """La lame : arc de cercle parti de `depart` (y, z), son dos sur le cercle de rayon `rayon`, son fil vers le centre,
    qui tourne de +Z vers -Y."""
    L = D['LAME']
    R, n, demi = L['rayon'], L['segments'], L['epaisseur'] / 2
    a0 = math.radians(L['angle'])
    tangente = (-math.cos(a0), math.sin(a0))           # (y, z) : vers +Z, penchée vers le talon
    normale = (-tangente[1], tangente[0])               # à gauche de la marche : le creux, vers le talon
    centre = (depart[0] + R * normale[0], depart[1] + R * normale[1])
    balayage = L['longueur'] / R
    sommets = []
    for i in range(n + 1):
        s = i / n
        t = s * balayage
        rayon = (math.cos(t) * -normale[0] + math.sin(t) * tangente[0], math.cos(t) * -normale[1] + math.sin(t) * tangente[1])
        largeur = L['largeur'] + (L['pointe'] - L['largeur']) * s
        dos = (centre[0] + R * rayon[0], centre[1] + R * rayon[1])
        fil = (centre[0] + (R - largeur) * rayon[0], centre[1] + (R - largeur) * rayon[1])
        sommets += [(cu - demi, *dos), (cu + demi, *dos), (cu + demi, *fil), (cu - demi, *fil)]
    faces = [[4 * i + k, 4 * (i + 1) + k, 4 * (i + 1) + (k + 1) % 4, 4 * i + (k + 1) % 4] for i in range(n)
             for k in range(4)]
    faces += [[0, 1, 2, 3], [4 * n + 3, 4 * n + 2, 4 * n + 1, 4 * n]]
    m.ajouter(sommets, faces, 'metal')


def construire(D, materiaux):
    talon = -D['PRISE_DEPUIS_TALON']
    tete = D['LONGUEUR'] - D['PRISE_DEPUIS_TALON']
    cu, cw = D['AXE_DANS_LA_PRISE']
    centre = (cu, 0.0, cw)
    M, V = D['MANCHE'], D['VIROLE']
    m = Maille(list(materiaux.values()))
    cylindre(m, talon, tete - V['hauteur'] + 0.005, M['rayon'], 'y', centre, M['segments'], 'bois')
    cylindre(m, tete - V['hauteur'], tete, V['rayon'], 'y', centre, M['segments'], 'metal')
    lame(m, D, (tete - D['LAME']['ancrage'], cw), cu)
    return [objet('humanoide--rigide--faux', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
