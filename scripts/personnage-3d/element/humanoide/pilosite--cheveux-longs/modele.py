"""Géométrie de `humanoide--pilosite--cheveux-longs` (`element/chevelure.py`) : une chevelure longue à raie au milieu,
qui couvre les oreilles, encadre le visage, repose sur les épaules et tombe dans le dos, des mèches par-dessus."""
from chevelure import Chevelure


def construire(D, materiaux, b):
    c = Chevelure(D, b)
    c.calotte()
    for table in D['MECHES']:
        c.meches(table)
    return c.finir('cheveux_longs', materiaux['poil'])
