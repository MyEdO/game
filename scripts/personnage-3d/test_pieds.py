"""sol.surfaces_des_pieds et sol.garder_les_poids_des_pieds sur un squelette synthétique : la surface d'un pied compte le
poids du pied et de ses descendants jusqu'à `MAJORITE_DU_POIDS`, et un sommet retouché par le lissage des poids qui y
tombe arrête la construction en le nommant."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from seuils import MAJORITE_DU_POIDS  # noqa: E402
from sol import garder_les_poids_des_pieds, surfaces_des_pieds  # noqa: E402
from faux_rig import Bones  # noqa: E402

PIED = 'foot_l'


def squelette():
    """`root` -> `calf_l` -> `foot_l` -> `ball_l` : le pied a un descendant, la jambe n'en est pas un."""
    balle = SimpleNamespace(name='ball_l', children_recursive=[])
    pied = SimpleNamespace(name=PIED, children_recursive=[balle])
    jambe = SimpleNamespace(name='calf_l', children_recursive=[pied, balle])
    racine = SimpleNamespace(name='root', children_recursive=[jambe, pied, balle])
    return SimpleNamespace(data=SimpleNamespace(bones=Bones([racine, jambe, pied, balle])))


def poids():
    """Par sommet, ses poids sur (root, calf_l, foot_l, ball_l) : tout au pied ; pour l'essentiel à son
    descendant ; la majorité tout juste au pied ; tout juste sous elle ; tout à la jambe."""
    juste = MAJORITE_DU_POIDS
    sous = MAJORITE_DU_POIDS - 1e-3
    return numpy.array([(0, 0, 1, 0), (0, 0, 0.2, 0.8), (0, 1 - juste, juste, 0), (0, 1 - sous, sous, 0), (0, 1, 0, 0)],
                       dtype=numpy.float64)


class SurfacesDesPieds(unittest.TestCase):
    def test_la_surface_compte_le_pied_et_ses_descendants_jusqu_a_la_majorite(self):
        surfaces = surfaces_des_pieds(squelette(), poids(), [PIED])
        self.assertEqual(numpy.flatnonzero(surfaces[PIED]).tolist(), [0, 1, 2])


class PoidsDesPieds(unittest.TestCase):
    def test_un_sommet_retouche_hors_des_pieds_passe(self):
        garder_les_poids_des_pieds('peau', {3, 4}, surfaces_des_pieds(squelette(), poids(), [PIED]))

    def test_un_sommet_retouche_dans_un_pied_arrete_en_le_nommant(self):
        with self.assertRaises(RuntimeError) as arret:
            garder_les_poids_des_pieds('peau', {4, 1}, surfaces_des_pieds(squelette(), poids(), [PIED]))
        self.assertIn('peau', str(arret.exception))
        self.assertIn(PIED, str(arret.exception))
        self.assertIn('[1]', str(arret.exception))


if __name__ == '__main__':
    unittest.main()
