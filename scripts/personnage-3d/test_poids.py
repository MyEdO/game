"""poids.lisser_les_sommets sur une chaîne synthétique de deux os : l'étirement se mesure à chaque état de la peau (neutre,
puis chaque shape key à 1), rapporté à la longueur au repos sans clé, et le rendu nomme exactement les sommets retouchés,
jumeaux compris."""
import sys
import unittest
from pathlib import Path

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from poids import lisser_les_sommets  # noqa: E402
from seuils import ETIREMENT_EN_CLIP  # noqa: E402

SOMMETS = 10
PREMIER_DU_SECOND_OS = 5
JUMEAU = SOMMETS
"""Indice du sommet confondu avec `PREMIER_DU_SECOND_OS`, ajouté en fin de chaîne."""


def chaine(translation):
    """Une chaîne de `SOMMETS` sommets espacés de 1 m sur x, plus un jumeau de `PREMIER_DU_SECOND_OS` ; les sommets
    avant lui pèsent tout sur l'os 0, les autres sur l'os 1. Deux échantillons de peau : le repos, et l'os 1 translaté
    de `translation` m sur x. Rend x homogènes, poids, nœud de chaque sommet, arêtes entre nœuds, matrices."""
    abscisses = [*range(SOMMETS), PREMIER_DU_SECOND_OS]
    x = numpy.array([(float(i), 0.0, 0.0, 1.0) for i in abscisses], dtype=numpy.float32)
    w = numpy.array([(1.0, 0.0) if i < PREMIER_DU_SECOND_OS else (0.0, 1.0) for i in abscisses], dtype=numpy.float32)
    jumeau = numpy.array([*range(SOMMETS), PREMIER_DU_SECOND_OS])
    aretes = numpy.array([(i, i + 1) for i in range(SOMMETS - 1)])
    tire = numpy.eye(4, dtype=numpy.float32)
    tire[0, 3] = translation
    matrices = numpy.array([[numpy.eye(4), numpy.eye(4)], [numpy.eye(4), tire]], dtype=numpy.float32)
    return x, w, jumeau, aretes, matrices


def ecartement():
    """Une shape key qui éloigne de 1 m sur x tous les sommets portés par l'os 1 : seule l'arête qui franchit la
    frontière des os s'allonge, de 1 à 2 m au repos."""
    d = numpy.zeros((SOMMETS + 1, 3))
    d[PREMIER_DU_SECOND_OS:, 0] = 1.0
    return {'ecartement': d}


def dans_les_bornes(w, x, decalages, aretes):
    """Si chaque arête reste dans `ETIREMENT_EN_CLIP` à chaque échantillon de `matrices` et à chaque état, mesurée
    sommet par sommet sans `poids` : skinning linéaire de x + d, rapporté au repos sans clé."""
    repos = numpy.linalg.norm(x[aretes[:, 0], :3] - x[aretes[:, 1], :3], axis=1)
    etats = [x[:, :3], *(x[:, :3] + d for d in decalages.values())]

    def mesure(matrices):
        for m in matrices:
            for p in etats:
                q = numpy.array([sum(w[s, o] * (m[o, :3, :3] @ p[s] + m[o, :3, 3]) for o in range(len(m)))
                                 for s in range(len(x))])
                rapport = numpy.linalg.norm(q[aretes[:, 0]] - q[aretes[:, 1]], axis=1) / repos
                if rapport.min() < ETIREMENT_EN_CLIP[0] or rapport.max() > ETIREMENT_EN_CLIP[1]:
                    return False
        return True
    return mesure


class LissageParEtat(unittest.TestCase):
    def test_une_cle_a_1_qui_sort_une_arete_des_bornes_la_fait_lisser(self):
        x, w, jumeau, aretes, matrices = chaine(2.0)
        neutre = dans_les_bornes(w, x, {}, aretes)(matrices)
        self.assertTrue(neutre, 'le neutre seul laisse la chaîne dans les bornes (rapport 3)')
        self.assertFalse(dans_les_bornes(w, x, ecartement(), aretes)(matrices), 'la clé à 1 en sort (rapport 4)')
        lisses, retouches = lisser_les_sommets('chaine', x, w, ecartement(), jumeau, aretes, matrices)
        self.assertGreater(len(retouches), 0)
        self.assertTrue(dans_les_bornes(lisses, x, ecartement(), aretes)(matrices))
        self.assertTrue(dans_les_bornes(lisses, x, {}, aretes)(matrices))

    def test_une_peau_sans_decalage_ne_mesure_que_le_neutre(self):
        x, w, jumeau, aretes, matrices = chaine(3.0)
        self.assertFalse(dans_les_bornes(w, x, {}, aretes)(matrices), 'le neutre sort des bornes (rapport 4)')
        lisses, retouches = lisser_les_sommets('chaine', x, w, {}, jumeau, aretes, matrices)
        self.assertEqual(retouches.tolist(), [PREMIER_DU_SECOND_OS - 1, PREMIER_DU_SECOND_OS, JUMEAU])
        self.assertTrue(dans_les_bornes(lisses, x, {}, aretes)(matrices))
        x, w, jumeau, aretes, matrices = chaine(2.0)
        intacts, aucun = lisser_les_sommets('chaine', x, w, {}, jumeau, aretes, matrices)
        self.assertEqual(aucun.tolist(), [])
        numpy.testing.assert_array_equal(intacts, w)

    def test_le_rendu_nomme_exactement_les_sommets_retouches_jumeaux_compris(self):
        x, w, jumeau, aretes, matrices = chaine(2.0)
        lisses, retouches = lisser_les_sommets('chaine', x, w, ecartement(), jumeau, aretes, matrices)
        self.assertEqual(retouches.tolist(), [PREMIER_DU_SECOND_OS - 1, PREMIER_DU_SECOND_OS, JUMEAU])
        changes = numpy.flatnonzero(numpy.abs(lisses - w).max(axis=1) > 0)
        self.assertEqual(changes.tolist(), [PREMIER_DU_SECOND_OS - 1, PREMIER_DU_SECOND_OS])
        numpy.testing.assert_allclose(lisses[changes], 0.5)


if __name__ == '__main__':
    unittest.main()
