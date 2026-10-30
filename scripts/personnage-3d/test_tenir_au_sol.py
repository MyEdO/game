"""tenue_au_sol.tenir_au_sol sur des doublures du sol, de la mesure et de la finition : sortie sans finition quand tout
est dans les bornes, finition puis sortie au tour suivant, erreur nommée d'un neutre hors bornes, arrêt au-delà des
tours."""
import contextlib
import io
import sys
import unittest
from pathlib import Path

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from tenue_au_sol import NeutreHorsDuClip, tenir_au_sol  # noqa: E402

ARETES = 6


def masque(*hors):
    m = numpy.zeros(ARETES, dtype=bool)
    m[list(hors)] = True
    return m


class Doublures:
    """Le sol rend le numéro de son appel comme matrices ; la mesure rend, à chaque appel, la mesure suivante de
    `mesures` ; la finition note les matrices qu'elle reçoit."""

    def __init__(self, mesures):
        self.mesures, self.poses, self.mesurees, self.refinies = list(mesures), 0, [], []

    def poser_au_sol(self):
        self.poses += 1
        return self.poses

    def mesurer(self, matrices):
        self.mesurees.append(matrices)
        return self.mesures.pop(0)

    def refinir(self, matrices):
        self.refinies.append(matrices)
        return 12

    def tenir(self, **options):
        with contextlib.redirect_stdout(io.StringIO()):
            return tenir_au_sol(self.poser_au_sol, self.mesurer, self.refinir, **options)


DANS_LES_BORNES = (masque(), {'feminin': masque(), 'corpulence': masque()})
CLE_HORS = (masque(), {'feminin': masque(), 'corpulence': masque(2, 4)})


class TenirAuSol(unittest.TestCase):
    def test_sort_sans_refinir_quand_tout_est_dans_les_bornes(self):
        d = Doublures([DANS_LES_BORNES])
        self.assertEqual(d.tenir(), 1)
        self.assertEqual(d.refinies, [])
        self.assertEqual(d.mesurees, [1])

    def test_refinit_sous_les_matrices_du_tour_puis_sort_au_tour_suivant(self):
        d = Doublures([CLE_HORS, DANS_LES_BORNES])
        self.assertEqual(d.tenir(), 2)
        self.assertEqual(d.refinies, [1])
        self.assertEqual(d.mesurees, [1, 2])
        self.assertEqual(d.poses, 2)

    def test_un_neutre_hors_bornes_leve_l_erreur_nommee_sans_refinir(self):
        d = Doublures([(masque(0, 5), CLE_HORS[1])])
        with self.assertRaises(NeutreHorsDuClip) as leve:
            d.tenir()
        self.assertEqual(str(leve.exception),
                         'neutre-hors-du-clip : tour 1 : 2 arête(s) du neutre hors de ETIREMENT_EN_CLIP sous les clips '
                         'posés')
        self.assertEqual(d.refinies, [])

    def test_leve_au_dela_de_tours_max(self):
        d = Doublures([CLE_HORS] * 3)
        with self.assertRaises(RuntimeError) as leve:
            d.tenir(tours_max=3)
        self.assertNotIsInstance(leve.exception, NeutreHorsDuClip)
        self.assertEqual(str(leve.exception), 'sol : corpulence:2 arête(s) hors bornes après 3 tours de sol')
        self.assertEqual(d.refinies, [1, 2, 3])


if __name__ == '__main__':
    unittest.main()
