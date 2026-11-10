"""Géométrie de `humanoide--rigide--baton` : un fût droit de bois et deux bagues de métal aux extrémités, le long du +Y
de la prise, centrés sur `AXE_DANS_LA_PRISE`."""
from maille import Maille, cylindre, objet


def construire(D, materiaux):
    talon = -D['PRISE_DEPUIS_TALON']
    tete = D['LONGUEUR'] - D['PRISE_DEPUIS_TALON']
    cu, cw = D['AXE_DANS_LA_PRISE']
    centre = (cu, 0.0, cw)
    F, B = D['FUT'], D['BAGUES']
    m = Maille(list(materiaux.values()))
    cylindre(m, talon + B['hauteur'] - B['recouvrement'], tete - B['hauteur'] + B['recouvrement'], F['rayon'], 'y', centre,
             F['segments'], 'bois')
    for a0, a1 in ((talon, talon + B['hauteur']), (tete - B['hauteur'], tete)):
        cylindre(m, a0, a1, B['rayon'], 'y', centre, B['segments'], 'metal')
    return [objet('humanoide--rigide--baton', m, (0.0, 0.0, 0.0), D['ANGLE_LISSE'])]
