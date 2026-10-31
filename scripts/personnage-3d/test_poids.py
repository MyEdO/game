"""poids.lisser_les_sommets sur une chaîne synthétique de deux os : l'étirement se mesure à chaque état de la peau (neutre,
puis chaque shape key à 1), rapporté à la longueur au repos sans clé, et le rendu nomme exactement les sommets retouchés,
jumeaux compris ; sa région s'élargit par formes.region_locale. poids.extremes rend ses rapports par état ;
poids.instants, sur une action de bpy, la grille de l'évaluateur unie aux clés."""
import sys
import unittest
from pathlib import Path
from unittest import mock

import bpy
import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import poids  # noqa: E402
from formes import region_locale  # noqa: E402
from poids import extremes, instants, lisser_les_sommets  # noqa: E402
from seuils import ETIREMENT_EN_CLIP, IMAGES_PAR_SECONDE  # noqa: E402

SOMMETS = 10
PREMIER_DU_SECOND_OS = 5
JUMEAU = SOMMETS
"""Indice du sommet confondu avec `PREMIER_DU_SECOND_OS`, ajouté en fin de chaîne."""
ABSCISSES_A_ECART = [0, 1, 2, 3, 5, 6, 7, 8]
"""Une chaîne dont l'arête du milieu mesure 2 m, les autres 1 m."""
POIDS_DE_L_OS_1_A_ECART = [0.0, 0.09393223, 0.18433428, 0.29395363, 0.7060464, 0.8156657, 0.9060678, 1.0]
"""Les poids sur l'os 1 de `chaine_a_ecart(12.0)` lissée, région élargie par `par_les_voisins`."""
PASSES_A_ECART = 27
"""Les passes de lissage de `chaine_a_ecart(12.0)` où une arête sort des bornes, région élargie par `par_les_voisins`."""


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


def chaine_a_ecart(translation):
    """La chaîne `ABSCISSES_A_ECART`, sommets avant l'arête longue sur l'os 0, les autres sur l'os 1 ; échantillons de
    `chaine`. Lissés seuls, les deux sommets de l'arête longue tendent vers un point fixe où elle reste hors bornes."""
    x = numpy.array([(float(i), 0.0, 0.0, 1.0) for i in ABSCISSES_A_ECART], dtype=numpy.float32)
    milieu = len(ABSCISSES_A_ECART) // 2
    w = numpy.array([(1.0, 0.0) if i < milieu else (0.0, 1.0) for i in range(len(x))], dtype=numpy.float32)
    aretes = numpy.array([(i, i + 1) for i in range(len(x) - 1)])
    tire = numpy.eye(4, dtype=numpy.float32)
    tire[0, 3] = translation
    matrices = numpy.array([[numpy.eye(4), numpy.eye(4)], [numpy.eye(4), tire]], dtype=numpy.float32)
    return x, w, numpy.arange(len(x)), aretes, matrices


def par_les_voisins(aretes, masque, anneaux, n):
    """La région de `formes.region_locale` calculée par ensembles de voisins : les extrémités des arêtes `aretes` que
    marque `masque`, puis `anneaux` fois les voisins de la région ; (nœuds,) booléen."""
    voisins = [set() for _ in range(n)]
    for a, b in aretes:
        voisins[a].add(b)
        voisins[b].add(a)
    region = set(aretes[masque].ravel().tolist())
    for _ in range(anneaux):
        region.update(v for s in list(region) for v in voisins[s])
    dans = numpy.zeros(n, dtype=bool)
    dans[sorted(region)] = True
    return dans


class RegionElargie(unittest.TestCase):
    def test_la_region_gagne_ses_anneaux_par_formes_comme_par_les_voisins(self):
        x, w, jumeau, aretes, matrices = chaine_a_ecart(12.0)
        with mock.patch.object(poids, 'region_locale', wraps=region_locale) as espion:
            lisses, retouches = lisser_les_sommets('ecart', x, w, {}, jumeau, aretes, matrices)
        self.assertEqual(max(appel.args[2] for appel in espion.call_args_list), 2, 'la région gagne deux anneaux')
        self.assertEqual(len(espion.call_args_list), PASSES_A_ECART)
        self.assertEqual(retouches.tolist(), [1, 2, 3, 4, 5, 6])
        numpy.testing.assert_allclose(lisses[:, 1], POIDS_DE_L_OS_1_A_ECART, atol=1e-7)
        self.assertTrue(dans_les_bornes(lisses, x, {}, aretes)(matrices))
        with mock.patch.object(poids, 'region_locale', par_les_voisins):
            attendus, attendues = lisser_les_sommets('ecart', x, w, {}, jumeau, aretes, matrices)
        numpy.testing.assert_array_equal(lisses, attendus)
        numpy.testing.assert_array_equal(retouches, attendues)


class RapportsParEtat(unittest.TestCase):
    def test_la_cle_seule_hors_bornes_sort_a_sa_ligne_et_laisse_le_neutre_dedans(self):
        x, w, _, aretes, matrices = chaine(2.0)
        d = numpy.array(list(ecartement().values()), dtype=numpy.float32)
        longueurs = numpy.linalg.norm(x[aretes[:, 0], :3] - x[aretes[:, 1], :3], axis=1)
        bas, haut = extremes(w, x, d, aretes, longueurs, matrices)
        self.assertEqual((bas.shape, haut.shape), ((2, len(aretes)), (2, len(aretes))))
        frontiere = PREMIER_DU_SECOND_OS - 1
        self.assertLessEqual(haut[0].max(), ETIREMENT_EN_CLIP[1], 'neutre : rapport 3 à la frontière des os')
        self.assertAlmostEqual(float(haut[0, frontiere]), 3.0, places=5)
        self.assertGreater(haut[1, frontiere], ETIREMENT_EN_CLIP[1], 'clé à 1 : rapport 4 à la frontière des os')
        self.assertAlmostEqual(float(haut[1, frontiere]), 4.0, places=5)


def action_cles(images):
    """Une action de bpy dont la seule courbe a ses clés aux `images`."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objet = bpy.data.objects.new('Porteur', None)
    bpy.context.scene.collection.objects.link(objet)
    for image in images:
        objet.location.x = image
        objet.keyframe_insert('location', index=0, frame=image)
    return objet.animation_data.action


class InstantsDeLEvaluateur(unittest.TestCase):
    def test_une_action_qui_commence_a_0_a_les_instants_de_l_evaluateur_en_images(self):
        action = action_cles([0.0, 2.00005, 3.25])
        bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
        numpy.testing.assert_allclose(instants(action), [0.0, 1.0, 2.0, 2.00005, 3.0, 3.25])

    def test_la_cadence_de_la_scene_divise_fps_par_fps_base(self):
        action = action_cles([0.0, 2.00005, 3.25])
        bpy.context.scene.render.fps = 4 * IMAGES_PAR_SECONDE
        bpy.context.scene.render.fps_base = 4.0
        numpy.testing.assert_allclose(instants(action), [0.0, 1.0, 2.0, 2.00005, 3.0, 3.25])

    def test_une_cle_a_moins_de_instants_confondus_d_un_instant_fusionne_avec_lui(self):
        action = action_cles([0.0, 2.00001, 3.25])
        bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
        numpy.testing.assert_allclose(instants(action), [0.0, 1.0, 2.0, 3.0, 3.25])

    def test_la_grille_ne_sort_pas_de_l_etendue_de_l_action(self):
        action = action_cles([1.5, 4.25])
        bpy.context.scene.render.fps = IMAGES_PAR_SECONDE
        numpy.testing.assert_allclose(instants(action), [1.5, 2.0, 3.0, 4.0, 4.25])

    def test_le_pas_suit_la_cadence_de_la_scene(self):
        action = action_cles([1.5, 4.25])
        bpy.context.scene.render.fps = 2 * IMAGES_PAR_SECONDE
        numpy.testing.assert_allclose(instants(action), [1.5, 2.0, 4.0, 4.25])

    def test_une_action_sans_cle_n_a_aucun_instant(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.assertEqual(instants(bpy.data.actions.new('Vide')), [])


if __name__ == '__main__':
    unittest.main()
