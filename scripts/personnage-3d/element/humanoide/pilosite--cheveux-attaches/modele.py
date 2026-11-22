"""Géométrie de `humanoide--pilosite--cheveux-attaches` (`element/chevelure.py`) : des cheveux tirés en arrière, plaqués,
vers un chignon à l'arrière du crâne, les oreilles et la nuque dégagées."""
from chevelure import Chevelure


def construire(D, materiaux, b):
    c = Chevelure(D, b)
    c.calotte()
    c.chignon(D['CHIGNON'])
    return c.finir('cheveux_attaches', materiaux['poil'])
