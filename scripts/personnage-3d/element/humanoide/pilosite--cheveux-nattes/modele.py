"""Géométrie de `humanoide--pilosite--cheveux-nattes` (`element/chevelure.py`) : une masse de cheveux à raie au milieu
sur le crâne et les tempes, les oreilles dégagées, et deux nattes qui partent de derrière les oreilles, passent devant
les épaules par-dessus le foulard et pendent sur la poitrine."""
from chevelure import Chevelure


def construire(D, materiaux, b):
    c = Chevelure(D, b)
    c.calotte()
    arbre, foulard = c.porteur('tetes', 'pourpoint', 'foulard', 'corps'), c.porteur('foulard')
    bas = c.porteur('pourpoint', 'corps')
    for cote in (1.0, -1.0):
        c.natte(D['NATTE'], arbre, foulard, bas, cote)
    return c.finir('cheveux_nattes', materiaux['poil'])
