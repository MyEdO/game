"""Géométrie de `humanoide--pilosite--cheveux-courts` (`element/chevelure.py`) : une coupe courte en volume, coiffée de
l'épi vers le front, une frange courte, les oreilles dégagées, la nuque courte."""
from chevelure import Chevelure


def construire(D, materiaux, b):
    c = Chevelure(D, b)
    c.calotte()
    for table in D['MECHES']:
        c.meches(table)
    return c.finir('cheveux_courts', materiaux['poil'])
