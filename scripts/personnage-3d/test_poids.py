"""La correction des poids sur une chaîne synthétique de deux os : l'étirement se mesure à chaque état de la peau (neutre,
puis chaque shape key à 1), rapporté à la longueur au repos sans clé, et le rendu nomme exactement les sommets retouchés,
jumeaux compris ; poids.ecart_des_aretes lit chaque sortie à ses bornes. poids.extremes rend ses rapports par état ;
poids.instants, sur une action de bpy, la grille de l'évaluateur unie aux clés."""
import contextlib
import io
import sys
import unittest
from pathlib import Path
from unittest import mock

import bpy
import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import poids  # noqa: E402
from pas_des_poids import ANNEAUX_MAX, Resolution  # noqa: E402
from poids import (avancer_correction, extremes, instants, preparer_correction, retouches_de_la_correction,  # noqa: E402
                   sommets_des_surfaces)
from seuils import ETIREMENT_DES_CLES, ETIREMENT_EN_CLIP, IMAGES_PAR_SECONDE  # noqa: E402
from test_silhouettes import arete_du_domaine, groupe_a_un_clip  # noqa: E402

SOMMETS = 10
PREMIER_DU_SECOND_OS = 5
JUMEAU = SOMMETS
"""Indice du sommet confondu avec `PREMIER_DU_SECOND_OS`, ajouté en fin de chaîne."""


def repos_puis_os_1_tire(translation):
    """Deux échantillons de peau, os 0 et os 1 : le repos, et l'os 1 translaté de `translation` m sur x."""
    tire = numpy.eye(4, dtype=numpy.float32)
    tire[0, 3] = translation
    return numpy.array([[numpy.eye(4), numpy.eye(4)], [numpy.eye(4), tire]], dtype=numpy.float32)


def chaine(translation):
    """Une chaîne de `SOMMETS` sommets espacés de 1 m sur x, plus un jumeau de `PREMIER_DU_SECOND_OS` ; les sommets
    avant lui pèsent tout sur l'os 0, les autres sur l'os 1. Deux échantillons de peau : le repos, et l'os 1 translaté
    de `translation` m sur x. Rend x homogènes, poids, nœud de chaque sommet, arêtes entre nœuds, matrices."""
    abscisses = [*range(SOMMETS), PREMIER_DU_SECOND_OS]
    x = numpy.array([(float(i), 0.0, 0.0, 1.0) for i in abscisses], dtype=numpy.float32)
    w = numpy.array([(1.0, 0.0) if i < PREMIER_DU_SECOND_OS else (0.0, 1.0) for i in abscisses], dtype=numpy.float32)
    jumeau = numpy.array([*range(SOMMETS), PREMIER_DU_SECOND_OS])
    aretes = numpy.array([(i, i + 1) for i in range(SOMMETS - 1)])
    return x, w, jumeau, aretes, repos_puis_os_1_tire(translation)


def eloignement():
    """Une shape key qui éloigne de 1 m sur x tous les sommets portés par l'os 1 : seule l'arête qui franchit la
    frontière des os s'allonge, de 1 à 2 m au repos."""
    d = numpy.zeros((SOMMETS + 1, 3))
    d[PREMIER_DU_SECOND_OS:, 0] = 1.0
    return {'eloignement': d}


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


def groupe_de_la_chaine(x, matrices, decalages=None):
    """Le groupe de la chaîne sous `matrices` (`matrices[0]` est le repos) : le neutre, puis chaque shape key de
    `decalages` à 1, chacun rapporté au neutre sans clé (`poids.etats_ponderes`)."""
    cles = [x + numpy.pad(d, ((0, 0), (0, 1))) for d in (decalages or {}).values()]
    return groupe_a_un_clip(numpy.array([x, *cles], dtype=numpy.float32), numpy.array([x] * (1 + len(cles))), matrices, [])


def corriger_les_sommets(nom, x, w, jumeau, aretes, groupes, contraintes=()):
    """Les passes de `avancer_correction` jusqu'à vider les arêtes marquées : les poids et les sommets retouchés."""
    etat = preparer_correction(nom, x, w, jumeau, aretes, groupes, contraintes)
    while avancer_correction(etat):
        pass
    return etat['w'], retouches_de_la_correction(etat)


class CorrectionParEtat(unittest.TestCase):
    def test_les_extremes_conservent_l_ordre_des_groupes(self):
        x, w, _, aretes, matrices = chaine(2.0)
        groupes = [groupe_a_un_clip(x[None], x[None], matrices[:1], []), groupe_a_un_clip(x[None], x[None], matrices[1:], [])]
        obtenus = extremes(w, aretes, groupes)
        separes = [extremes(w, aretes, [g]) for g in groupes]
        for i in range(2):
            numpy.testing.assert_array_equal(obtenus[i], numpy.concatenate([r[i] for r in separes]))

    def test_chaque_etat_recu_change_la_region_corrigee(self):
        x, w, jumeau, aretes, matrices = chaine(2.0)
        neutre = x[None]
        deplace = x.copy()
        deplace[:, :3] += eloignement()['eloignement']
        groupes = [groupe_a_un_clip(neutre, neutre, matrices, []), groupe_a_un_clip(deplace[None], neutre, matrices, [])]
        corriges, retouches = corriger_les_sommets('groupes', x, w, jumeau, aretes, groupes)
        self.assertGreater(len(retouches), 0)
        self.assertTrue(dans_les_bornes(corriges, x, eloignement(), aretes)(matrices))

    def test_les_noeuds_contraints_restent_mesures_et_ne_sont_pas_retouches(self):
        x, w, jumeau, aretes, matrices = chaine(3.0)
        corriges, retouches = corriger_les_sommets('pied', x, w, jumeau, aretes, [groupe_de_la_chaine(x, matrices)],
                                             contraintes=sommets_des_surfaces({'pied': numpy.arange(len(x)) == PREMIER_DU_SECOND_OS}))
        self.assertNotIn(PREMIER_DU_SECOND_OS, retouches)
        numpy.testing.assert_array_equal(corriges[PREMIER_DU_SECOND_OS], w[PREMIER_DU_SECOND_OS])
        self.assertTrue(dans_les_bornes(corriges, x, {}, aretes)(matrices))

    def test_une_cle_a_1_qui_sort_une_arete_des_bornes_la_fait_corriger(self):
        x, w, jumeau, aretes, matrices = chaine(2.0)
        neutre = dans_les_bornes(w, x, {}, aretes)(matrices)
        self.assertTrue(neutre, 'le neutre seul laisse la chaîne dans les bornes (rapport 3)')
        self.assertFalse(dans_les_bornes(w, x, eloignement(), aretes)(matrices), 'la clé à 1 en sort (rapport 4)')
        corriges, retouches = corriger_les_sommets('chaine', x, w, jumeau, aretes, [groupe_de_la_chaine(x, matrices, eloignement())])
        self.assertGreater(len(retouches), 0)
        self.assertTrue(dans_les_bornes(corriges, x, eloignement(), aretes)(matrices))
        self.assertTrue(dans_les_bornes(corriges, x, {}, aretes)(matrices))

    def test_une_peau_sans_decalage_ne_mesure_que_le_neutre(self):
        x, w, jumeau, aretes, matrices = chaine(3.0)
        self.assertFalse(dans_les_bornes(w, x, {}, aretes)(matrices), 'le neutre sort des bornes (rapport 4)')
        corriges, retouches = corriger_les_sommets('chaine', x, w, jumeau, aretes, [groupe_de_la_chaine(x, matrices)])
        self.assertEqual(retouches.tolist(), [PREMIER_DU_SECOND_OS - 1, PREMIER_DU_SECOND_OS, JUMEAU])
        self.assertTrue(dans_les_bornes(corriges, x, {}, aretes)(matrices))
        x, w, jumeau, aretes, matrices = chaine(2.0)
        intacts, aucun = corriger_les_sommets('chaine', x, w, jumeau, aretes, [groupe_de_la_chaine(x, matrices)])
        self.assertEqual(aucun.tolist(), [])
        numpy.testing.assert_array_equal(intacts, w)

    def test_le_rendu_nomme_exactement_les_sommets_retouches_jumeaux_compris(self):
        x, w, jumeau, aretes, matrices = chaine(2.0)
        corriges, retouches = corriger_les_sommets('chaine', x, w, jumeau, aretes, [groupe_de_la_chaine(x, matrices, eloignement())])
        self.assertEqual(retouches.tolist(), [PREMIER_DU_SECOND_OS - 1, PREMIER_DU_SECOND_OS, JUMEAU])
        changes = numpy.flatnonzero(numpy.abs(corriges - w).max(axis=1) > 0)
        self.assertEqual(changes.tolist(), [PREMIER_DU_SECOND_OS - 1, PREMIER_DU_SECOND_OS])


def arete_aux_coins_valides(z, clip=None):
    """L'état de `preparer_correction` sur `test_silhouettes.arete_du_domaine`."""
    x, w, aretes, _, _, _, groupes = arete_du_domaine(clip=clip, z=z)
    return preparer_correction('domaine', x, w, numpy.arange(2), aretes, groupes)


class EcartDesAretes(unittest.TestCase):
    def test_l_ecart_d_une_arete_hors_bornes_au_repos_seul_se_lit_a_ses_bornes(self):
        for decalage, attendu in ((4.0, numpy.log(5.0 / ETIREMENT_DES_CLES[1])), (-0.9, numpy.log(ETIREMENT_DES_CLES[0] / 0.1))):
            x, w, jumeau, aretes, matrices = chaine(0.0)
            deplace = x.copy()
            deplace[PREMIER_DU_SECOND_OS:, 0] += decalage
            groupes = [groupe_a_un_clip(deplace[None], x[None], matrices[:1], [])]
            etat = preparer_correction('repos', x, w, jumeau, aretes, groupes)
            frontiere = PREMIER_DU_SECOND_OS - 1
            self.assertEqual(numpy.flatnonzero(etat['horsRepos']).tolist(), [frontiere])
            self.assertFalse(etat['horsClip'].any())
            ecart = poids.ecart_des_aretes(etat)
            self.assertAlmostEqual(float(ecart[frontiere]), float(attendu), places=5)
            self.assertEqual(ecart[numpy.arange(len(ecart)) != frontiere].max(), 0)

    def test_l_ecart_ignore_le_minimum_strictement_interieur_de_clip(self):
        """#4002 : au milieu de la cellule, l'arête écrasée à 0,005 / 1,5 sous le clip ; ses coins sains."""
        clip = numpy.eye(4)
        clip[2, 2] = .01
        etat = arete_aux_coins_valides(.5, clip)
        self.assertLess(.005 / 1.5, ETIREMENT_EN_CLIP[0])
        numpy.testing.assert_array_equal(etat['horsClip'], [False])
        self.assertEqual(float(poids.ecart_des_aretes(etat)[0]), 0.0)

    def test_l_ecart_lit_l_ecrasement_d_un_etat_en_clip(self):
        """#4002 : l'arête de la chaîne, écrasée à 0,005 sous le clip de l'état neutre."""
        x, w, jumeau, aretes, matrices = chaine(0.0)
        clip = numpy.eye(4)
        clip[0, 0] = .005
        groupes = [groupe_a_un_clip(x[None], x[None], numpy.array([matrices[0], [clip] * matrices.shape[1]]), [])]
        etat = preparer_correction('clip', x, w, jumeau, aretes, groupes)
        self.assertTrue(etat['horsClip'].all())
        numpy.testing.assert_allclose(poids.ecart_des_aretes(etat), numpy.log(ETIREMENT_EN_CLIP[0] / .005), rtol=1e-5)

    def test_l_ecart_lit_le_minimum_interieur_au_repos(self):
        etat = arete_aux_coins_valides(.1)
        numpy.testing.assert_array_equal(etat['horsRepos'], [True])
        self.assertAlmostEqual(float(poids.ecart_des_aretes(etat)[0]), numpy.log(ETIREMENT_DES_CLES[0] * numpy.sqrt(2.01) / .1), places=9)


class RapportsParEtat(unittest.TestCase):
    def test_la_cle_seule_hors_bornes_sort_a_sa_ligne_et_laisse_le_neutre_dedans(self):
        x, w, _, aretes, matrices = chaine(2.0)
        bas, haut = extremes(w, aretes, [groupe_de_la_chaine(x, matrices, eloignement())])
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

    def test_instants_confondus_suit_la_cadence_de_la_scene(self):
        action = action_cles([0.0, 2.00003, 3.25])
        bpy.context.scene.render.fps = 2 * IMAGES_PAR_SECONDE
        numpy.testing.assert_allclose(instants(action), [0.0, 2.0, 3.25])

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


def voisine_a_preserver(contraintes=()):
    x = numpy.array([[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 1]], dtype=numpy.float32)
    w = numpy.array([[1, 0], [.5, .5], [.5, .5]], dtype=numpy.float32)
    aretes = numpy.array([[0, 1], [1, 2]])
    matrices = numpy.tile(numpy.eye(4, dtype=numpy.float32), (2, 2, 1, 1))
    matrices[1, 1, 0, 3] = 12
    return preparer_correction('voisine', x, w, numpy.arange(3), aretes, [groupe_de_la_chaine(x, matrices)],
                               contraintes=contraintes)


class MonotonieDesPoids(unittest.TestCase):
    def test_une_cible_est_reparee_sans_faire_sortir_sa_voisine(self):
        etat = voisine_a_preserver()
        numpy.testing.assert_array_equal(etat['hors'], [True, False])
        avant = etat['w'].copy()
        avancer_correction(etat)
        numpy.testing.assert_array_equal(etat['hors'], [False, False])
        numpy.testing.assert_array_equal(etat['w'][2], avant[2])
        self.assertEqual(etat['retouches'], {0, 1})

    def test_un_refus_conserve_poids_cache_et_contraintes(self):
        etat = voisine_a_preserver([0, 1])
        poids_avant = etat['w'].copy()
        caches_avant = {cle: etat[cle].copy() for cle in ['bas', 'haut', 'repos', 'cotesRepos', 'hors']}
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError):
            avancer_correction(etat)
        numpy.testing.assert_array_equal(etat['w'], poids_avant)
        for cle, cache in caches_avant.items():
            numpy.testing.assert_array_equal(etat[cle], cache)
        self.assertEqual(etat['retouches'], set())

    def test_aucun_anneau_ne_reussit_le_refus_nomme_ses_essais(self):
        etat = voisine_a_preserver([0])
        with mock.patch.object(poids, 'corriger_region', return_value=Resolution(None, 'infaisable')) as corriger, \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, 'sans pas aux anneaux'):
            avancer_correction(etat)
        self.assertEqual(corriger.call_count, ANNEAUX_MAX + 1)


if __name__ == '__main__':
    unittest.main()
