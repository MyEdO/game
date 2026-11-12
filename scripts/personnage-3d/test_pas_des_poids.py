"""#3104 issuecomment-6565228921 : pas_des_poids sur petites chaînes synthétiques, et le pas de poids.avancer_correction qui le compose."""
import contextlib
import io
import os
import sys
import tempfile
import unittest
import warnings
from pathlib import Path
from unittest import mock

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import pas_des_poids  # noqa: E402
import poids  # noqa: E402
from formes import region_locale  # noqa: E402
from pas_des_poids import Region, corriger_region, plus_proche  # noqa: E402
from poids import GroupePondere, avancer_correction, ecart_des_aretes, etats_ponderes, extremes, preparer_correction  # noqa: E402
from seuils import ETIREMENT_DES_CLES, ETIREMENT_EN_CLIP, INFLUENCES_MAX, MAJORITE_DU_POIDS  # noqa: E402
from test_silhouettes import arete_du_domaine, groupe_a_un_clip, pile_partagee  # noqa: E402

BAS, HAUT = ETIREMENT_EN_CLIP


def translation(x):
    m = numpy.eye(4, dtype=numpy.float32)
    m[0, 3] = x
    return m


def chaine_x(abscisses):
    """Les sommets homogènes aux `abscisses` sur x et les arêtes qui les relient dans l'ordre."""
    x = numpy.array([(float(a), 0.0, 0.0, 1.0) for a in abscisses], dtype=numpy.float32)
    return x, numpy.array([(i, i + 1) for i in range(len(x) - 1)])


def deux_os(*instants):
    """Une pile (instants, 2, 4, 4) : os 0 immobile, os 1 sous chaque matrice de `instants`."""
    return numpy.array([[numpy.eye(4), m] for m in instants], dtype=numpy.float32)


def groupe_simple(x, pile):
    """Le groupe du seul état neutre `x`, sa propre référence (`poids.etats_ponderes`) : `pile[0]` est son repos."""
    return groupe_a_un_clip(x[None], x[None], pile, [])


def etat_de(x, w, aretes, pile, contraintes=(), pieds=()):
    return preparer_correction('chaine', x, numpy.array(w, dtype=numpy.float32), numpy.arange(len(x)), aretes,
                               [groupe_simple(x, pile)], contraintes=contraintes, pieds=pieds)


def rapport_a_la_reference(w, x, a, b, pose):
    """Le produit scalaire normé de l'arête (a, b) posée par `pose` avec son vecteur au repos."""
    pa = sum(w[a, o] * (pose[o] @ x[a]) for o in range(len(pose)))
    pb = sum(w[b, o] * (pose[o] @ x[b]) for o in range(len(pose)))
    e, e0 = (pa - pb)[:3], (x[a] - x[b])[:3]
    return float(e @ e0 / (numpy.linalg.norm(e) * numpy.linalg.norm(e0)))


CHAINE_PURE = [[1, 0]] * 4 + [[0, 1]] * 4
"""Sur `chaine_x([0, 1, 2, 3, 5, 6, 7, 8])`, os 1 translaté de 12 : chaque sommet porte un seul os ; l'arête centrale
sort, et ses deux sommets seuls ne la font pas rentrer sans sortir leurs voisines."""


RAYON = 10.0
"""Plus loin que tout point admissible des petits QP de `QPPur`."""


class QPPur(unittest.TestCase):
    def test_tient_l_egalite_et_les_bornes_au_moindre_deplacement(self):
        x, statut = plus_proche(numpy.array([.5, .5]), numpy.array([[1., 1.]]), numpy.array([1.]),
                                numpy.array([[1., 0.], [0., 1.], [1., 0.]]), numpy.array([0., 0., .7]), RAYON)
        self.assertEqual(statut, 'ok')
        numpy.testing.assert_allclose(x, [.7, .3], atol=1e-12)

    def test_sans_plan_viole_rend_le_depart_projete(self):
        x, _ = plus_proche(numpy.array([.25, .75]), numpy.array([[1., 1.]]), numpy.array([1.]), numpy.eye(2), numpy.zeros(2), RAYON)
        numpy.testing.assert_allclose(x, [.25, .75], atol=1e-12)

    def test_la_borne_positive_arrete_la_projection(self):
        x, _ = plus_proche(numpy.array([.6, .3, .1]), numpy.array([[1., 1., 1.]]), numpy.array([1.]),
                           numpy.vstack([numpy.eye(3), [[1., 0., 0.]]]), numpy.array([0., 0., 0., .96]), RAYON)
        numpy.testing.assert_allclose(x, [.96, .04, 0.], atol=1e-9)

    def test_optimal_face_a_tout_point_faisable(self):
        rng = numpy.random.default_rng(3)
        x0 = numpy.array([.4, .3, .2, .1])
        plans = numpy.vstack([numpy.eye(4), [[1., -1., .5, 0.]]])
        bornes = numpy.array([0., 0., 0., 0., .35])
        x, _ = plus_proche(x0, numpy.ones((1, 4)), numpy.ones(1), plans, bornes, RAYON)
        for _ in range(200):
            essai = rng.dirichlet(numpy.ones(4))
            if (plans @ essai >= bornes).all():
                self.assertLessEqual(numpy.linalg.norm(x - x0), numpy.linalg.norm(essai - x0) + 1e-9)

    def test_infaisable_rend_sa_cause_sans_x(self):
        self.assertEqual(plus_proche(numpy.array([.5, .5]), numpy.array([[1., 1.]]), numpy.array([1.]),
                                     numpy.array([[1., 0.], [0., 1.]]), numpy.array([.7, .7]), RAYON), (None, 'infaisable'))

    def test_un_plan_presque_constant_inatteignable_sort_hors_du_rayon_sans_deborder(self):
        rng = numpy.random.default_rng(0)
        constante = numpy.full((28, 8), 1.2314)
        constante[:, 4:] = -1.231
        plans = numpy.vstack([constante + 1e-7 * rng.standard_normal(constante.shape), numpy.eye(8)])
        bornes = numpy.concatenate([.05 + .005 * rng.standard_normal(28), numpy.zeros(8)])
        egalites = numpy.zeros((2, 8))
        egalites[0, :4] = egalites[1, 4:] = 1.0
        x0 = numpy.array([.12, .29, .07, .52, .14, .31, .06, .49])
        with warnings.catch_warnings():
            warnings.simplefilter('error', RuntimeWarning)
            self.assertEqual(plus_proche(x0, egalites, numpy.ones(2), plans, bornes, 2.0), (None, 'hors-rayon'))

    def test_au_dela_du_budget_d_iterations_le_statut_le_nomme(self):
        with mock.patch.object(pas_des_poids, 'ITERATIONS_MAX', 0):
            self.assertEqual(plus_proche(numpy.array([.5, .5]), numpy.array([[1., 1.]]), numpy.array([1.]),
                                         numpy.array([[1., 0.]]), numpy.array([.7]), RAYON), (None, 'iterations'))

    def test_un_pas_nan_le_statut_le_nomme(self):
        self.assertEqual(plus_proche(numpy.array([.5, .5]), numpy.array([[1., 1.]]), numpy.array([1.]),
                                     numpy.array([[1., 0.], [0., 1.]]), numpy.array([.7, numpy.nan]), RAYON),
                         (None, 'pas-non-fini'))


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


class AreteTraitee(unittest.TestCase):
    def test_arete_ecrasee_hors_decroit_ecart_nul_et_deplacement_petit(self):
        x, aretes = chaine_x(range(4))
        w = [[1, 0], [1, 0], [0, 1], [0, 1]]
        etat = etat_de(x, w, aretes, deux_os(numpy.eye(4), translation(-.995)))
        self.assertEqual(numpy.flatnonzero(etat['hors']).tolist(), [1])
        avant = etat['w'].copy()
        avancer_correction(etat)
        self.assertEqual(int(etat['hors'].sum()), 0)
        self.assertEqual(float(ecart_des_aretes(etat).max()), 0.0)
        self.assertLess(numpy.abs(etat['w'] - avant).max(), .01)

    def test_chaque_passe_baisse_le_compte_des_marquees(self):
        x, aretes = chaine_x([0, 1, 2, 3, 8, 13, 14])
        w = [[1 - v, v] for v in [0.0, 0.0, 0.3, 0.3, 0.3, 0.5, 0.0]]
        etat = etat_de(x, w, aretes, deux_os(numpy.eye(4), translation(10.0)))
        self.assertEqual(numpy.flatnonzero(etat['hors']).tolist(), [1, 5])
        for attendu in (1, 0):
            avancer_correction(etat)
            self.assertEqual(int(etat['hors'].sum()), attendu)

    def test_la_solution_ne_retourne_pas_l_arete(self):
        x, aretes = chaine_x([0, 1])
        pile = deux_os(numpy.eye(4), translation(-1.005))
        etat = etat_de(x, [[1, 0], [0, 1]], aretes, pile)
        self.assertLess(rapport_a_la_reference(etat['w'], x, 0, 1, pile[1]), 0, 'retournée au départ')
        self.assertTrue(etat['hors'].all())
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertGreater(rapport_a_la_reference(etat['w'], x, 0, 1, pile[1]), 0)

    def test_plan_haut_arete_trop_longue(self):
        x, aretes = chaine_x(range(4))
        etat = etat_de(x, [[1, 0], [1, 0], [0, 1], [0, 1]], aretes, deux_os(numpy.eye(4), translation(5.0)))
        self.assertGreater(etat['haut'].max(), HAUT)
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertLessEqual(etat['haut'].max(), HAUT)

    def test_l_anneau_gagnant_est_le_premier_qui_reussit_et_le_journal_le_lit(self):
        x, aretes = chaine_x([0, 1, 2, 3, 5, 6, 7, 8])
        etat = etat_de(x, CHAINE_PURE, aretes, deux_os(numpy.eye(4), translation(12.0)))
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertEqual(etat['anneau'], 1)
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            poids.imprimer_correction(etat, 1)
        self.assertIn(' anneaux 1 ', sortie.getvalue())

    def test_la_region_gagne_ses_anneaux_par_formes_comme_par_les_voisins(self):
        x, aretes = chaine_x([0, 1, 2, 3, 5, 6, 7, 8])
        etat = etat_de(x, CHAINE_PURE, aretes, deux_os(numpy.eye(4), translation(12.0)))
        anneaux = []

        def comparee(aretes_, masque, n_anneaux, n):
            anneaux.append(n_anneaux)
            region = region_locale(aretes_, masque, n_anneaux, n)
            numpy.testing.assert_array_equal(region, par_les_voisins(aretes_, masque, n_anneaux, n))
            return region
        with mock.patch.object(poids, 'region_locale', side_effect=comparee):
            avancer_correction(etat)
        self.assertGreater(max(anneaux), 0, 'la région s élargit au-delà de l anneau 0')
        self.assertFalse(etat['hors'].any())

    def test_chaque_sommet_recoit_l_union_des_os_de_la_region_et_de_ses_voisins(self):
        x, aretes = chaine_x([0, 1, 2, 3])
        w = numpy.array([[1, 0, 0, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]], dtype=numpy.float32)
        region = Region(w, [1, 2], aretes, [])
        self.assertEqual({s: sorted(os) for s, os in region.os.items()}, {1: [0, 1, 2], 2: [0, 1, 2]})

    def test_une_chaine_pure_se_resout_par_un_os_que_seul_un_autre_sommet_de_la_region_porte(self):
        """Le sommet 2 ne porte que l'os 0 et ses voisins directs aussi : l'os 1 ne lui vient que du sommet 4, à deux arêtes."""
        x, aretes = chaine_x([0, 1, 2, 3, 5, 6, 7, 8])
        etat = etat_de(x, CHAINE_PURE, aretes, deux_os(numpy.eye(4), translation(12.0)))
        self.assertEqual(numpy.flatnonzero(etat['hors']).tolist(), [3])
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertEqual(etat['anneau'], 1)
        self.assertGreater(float(etat['w'][2, 1]), 0.0)
        self.assertLess(float(etat['w'][5, 1]), 1.0)


class InterieurDeCellule(unittest.TestCase):
    def test_un_defaut_seulement_interieur_est_corrige(self):
        x, _, aretes, demandes, champs, _, _ = arete_du_domaine(z=.5)
        w = numpy.array([[.002, .998], [.002, .998]], dtype=numpy.float32)
        pile = numpy.array([[numpy.eye(4), numpy.eye(4)], [numpy.eye(4), numpy.diag([1, 1, .01, 1])]], dtype=numpy.float32)
        groupes = etats_ponderes(x, champs, [(demandes, pile_partagee(demandes, pile), (1,))])
        etat = preparer_correction('cellule', x, w, numpy.arange(2), aretes, groupes)
        trace = etat['traces'][0]
        self.assertGreaterEqual(float(trace.bas.min()), BAS, 'les états seuls sont dans les bornes')
        self.assertLess(float(trace.domaine_clip.bas[0]), BAS)
        self.assertTrue(etat['horsClip'][0])
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertGreaterEqual(float(etat['traces'][0].domaine_clip.bas[0]), BAS)


def chaine_a_repos_comprime(rapport_au_repos):
    """Os 0 et 1 à l'identité au repos, le plan du repos ne dépend donc pas des poids. L'arête (0, 1) y est comprimée à
    `rapport_au_repos` ; l'arête (1, 2) sort en clip, ce qui fait entrer le sommet 1 dans la région."""
    x, aretes = chaine_x(range(4))
    positions = x.copy()
    positions[1:, 0] -= 1 - rapport_au_repos
    groupe = groupe_a_un_clip(positions[None], x[None], deux_os(numpy.eye(4), translation(5.0)), [])
    return preparer_correction('repos', x, numpy.array([[1, 0], [1, 0], [0, 1], [0, 1]], dtype=numpy.float32), numpy.arange(4), aretes, [groupe])


class ClauseRepos(unittest.TestCase):
    def test_un_repos_dans_la_borne_sous_la_marge_ne_bloque_pas_le_pas(self):
        etat = chaine_a_repos_comprime(.2512)
        self.assertEqual(numpy.flatnonzero(etat['hors']).tolist(), [1], 'seule l arete de clip est hors')
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())

    def test_une_vraie_sortie_au_repos_que_les_poids_ne_bougent_pas_refuse_avec_capture(self):
        etat = chaine_a_repos_comprime(.24)
        self.assertTrue(etat['horsRepos'][0])
        with tempfile.TemporaryDirectory(prefix='repos-') as dossier:
            prefixe = str(Path(dossier) / 'diagnostic')
            with mock.patch.dict(os.environ, DIAGNOSTIC_POIDS_PREFIXE=prefixe), contextlib.redirect_stdout(io.StringIO()), \
                    self.assertRaisesRegex(RuntimeError, r"sans pas aux anneaux 0 à 9 : \['infaisable'"):
                while etat['hors'].any():
                    avancer_correction(etat)
            self.assertTrue(Path(prefixe + '-refus.npz').exists())
        self.assertTrue(etat['horsRepos'][0])


class SolveurEnPanne(unittest.TestCase):
    def test_une_linalgerror_du_solveur_part_en_refus_avec_capture(self):
        x, aretes = chaine_x(range(4))
        etat = etat_de(x, [[1, 0], [1, 0], [0, 1], [0, 1]], aretes, deux_os(numpy.eye(4), translation(5.0)))
        avant = etat['w'].copy()
        with tempfile.TemporaryDirectory(prefix='solveur-') as dossier:
            prefixe = str(Path(dossier) / 'diagnostic')
            with mock.patch.dict(os.environ, DIAGNOSTIC_POIDS_PREFIXE=prefixe), contextlib.redirect_stdout(io.StringIO()), \
                    mock.patch.object(numpy.linalg, 'solve', side_effect=numpy.linalg.LinAlgError('Singular matrix')), \
                    self.assertRaisesRegex(RuntimeError, r'arête \[1, 2\], anneau 0 : Singular matrix'):
                avancer_correction(etat)
            self.assertTrue(Path(prefixe + '-refus.npz').exists())
        numpy.testing.assert_array_equal(etat['w'], avant)


class PrecisionDuBalayage(unittest.TestCase):
    @staticmethod
    def arete_au_repos(longueur, posee):
        """Une arête rigide de `longueur` sur x posée au vecteur `posee` (x, y) au repos : son rapport float64 est
        |`posee`| / `longueur`."""
        x = numpy.array([(0, 0, 0, 1), (longueur, 0, 0, 1)], dtype=numpy.float32)
        positions = x.copy()
        positions[1, :2] = posee
        groupe = groupe_a_un_clip(positions[None], x[None], numpy.array([[numpy.eye(4)]], dtype=numpy.float32), [])
        w = numpy.ones((2, 1), dtype=numpy.float32)
        aretes = numpy.array([[0, 1]])
        traces = []
        extremes(w, aretes, [groupe], traces)
        return w, aretes, groupe, traces[0]

    def test_hors_des_bornes_en_float64_dedans_en_float32_le_balayage_tient_l_arete_dedans_comme_extremes(self):
        """Aux deux bornes de `ETIREMENT_DES_CLES`, un rapport float64 hors bornes que l'arrondi float32 du rapport ramène
        dedans : un balayage qui comparerait le float64 sortirait l'arête."""
        for longueur, posee, rapport, borne in ((1.0013649463653564, (3.5147910118103027, 0.0), 3.51000005, 1),
                                                (1.0, (0.1298491209745407, 0.21363334357738495), 0.2499999994, 0)):
            with self.subTest(rapport=rapport):
                self.assertAlmostEqual(numpy.hypot(*posee) / longueur, rapport, places=10)
                self.assertEqual(numpy.hypot(*posee) / longueur > ETIREMENT_DES_CLES[1], borne == 1)
                self.assertEqual(numpy.hypot(*posee) / longueur < ETIREMENT_DES_CLES[0], borne == 0)
                w, aretes, groupe, trace = self.arete_au_repos(longueur, posee)
                self.assertEqual(int(trace.cotes_repos[0, 0]), -1, 'extremes la lit dans les bornes')
                self.assertEqual(Region(w, [0, 1], aretes, [groupe]).balayer(w), [])
                self.assertEqual(corriger_region(w, [0, 1], aretes, [groupe]).statut, 'ok')

    def test_une_sortie_que_extremes_lit_sort_au_balayage_au_meme_rapport(self):
        w, aretes, groupe, trace = self.arete_au_repos(1.0, (3.5100002288818359, 0.0))
        self.assertEqual(int(trace.cotes_repos[0, 0]), 1)
        violations = Region(w, [0, 1], aretes, [groupe]).balayer(w)
        self.assertEqual([v.rapport for v in violations], [float(trace.rapports_repos[0, 0])])


def arete_repos_puis_clip(repos, clip_x, clips=(1,), instants_de_clip=1):
    """L'arête (0, 1) de longueur 1, os 0 et 1 à l'identité au repos où elle mesure `repos`, puis `instants_de_clip`
    échantillons où l'os 1 est translaté de `clip_x` sur x, découpés en `clips` : (w, arêtes, groupe, trace de
    `extremes`)."""
    x = numpy.array([(0, 0, 0, 1), (1, 0, 0, 1)], dtype=numpy.float32)
    positions = x.copy()
    positions[1, 0] = repos
    w = numpy.array([[1, 0], [0, 1]], dtype=numpy.float32)
    pile = deux_os(numpy.eye(4), *[translation(clip_x)] * instants_de_clip)
    groupe = GroupePondere(positions[None], x[None], [pile], [], (), clips)
    aretes = numpy.array([[0, 1]])
    traces = []
    extremes(w, aretes, [groupe], traces)
    return w, aretes, groupe, traces[0]


class ClausesDuBalayage(unittest.TestCase):
    def test_la_pire_sortie_du_clip_ne_masque_pas_la_clause_repos_par_le_haut(self):
        w, aretes, groupe, trace = arete_repos_puis_clip(3.6, .4)
        self.assertEqual(int(trace.cotes_repos[0, 0]), 1)
        violations = Region(w, [0, 1], aretes, [groupe]).balayer(w)
        self.assertEqual([(v.instant, v.haut, v.rapport) for v in violations],
                         [(0, True, float(trace.rapports_repos[0, 0])), (1, True, float(trace.haut[0, 0]))])

    def test_la_pire_sortie_du_clip_ne_masque_pas_la_clause_repos_par_le_bas(self):
        w, aretes, groupe, trace = arete_repos_puis_clip(.24, .009 - .24)
        self.assertEqual((int(trace.cotes_repos[0, 0]), int(trace.cotes_clip[0, 0])), (0, 0))
        violations = Region(w, [0, 1], aretes, [groupe]).balayer(w)
        self.assertEqual([(v.instant, v.haut, v.rapport) for v in violations],
                         [(0, False, float(trace.rapports_repos[0, 0])), (1, False, float(trace.bas[0, 0]))])

    def test_l_espacement_des_instants_ne_traverse_pas_la_frontiere_entre_deux_clips(self):
        w, aretes, groupe, _ = arete_repos_puis_clip(1.0, 4.0, clips=(1, 1), instants_de_clip=2)
        violations = Region(w, [0, 1], aretes, [groupe]).balayer(w)
        self.assertEqual([v.instant for v in violations], [1, 2])
        groupe = groupe_a_un_clip(groupe[0], groupe[1], groupe[2][0], [])
        self.assertEqual(groupe.clips, (2,))
        self.assertEqual([v.instant for v in Region(w, [0, 1], aretes, [groupe]).balayer(w)], [1])

    def test_des_clips_qui_ne_couvrent_pas_la_pile_sont_refuses(self):
        with self.assertRaisesRegex(ValueError, r'clips-incoherents : \[2\] pour 1 échantillon\(s\) après le repos'):
            arete_repos_puis_clip(1.0, 4.0, clips=(2,))


class CibleSansSommetLibre(unittest.TestCase):
    def test_deux_sommets_fixes_refus_avec_capture_jamais_de_passe_reussie(self):
        x, aretes = chaine_x(range(4))
        w = [[1, 0], [1, 0], [0, 1], [0, 1]]
        etat = etat_de(x, w, aretes, deux_os(numpy.eye(4), translation(5.0)), contraintes=[1, 2])
        self.assertEqual(numpy.flatnonzero(etat['hors']).tolist(), [1])
        avant = etat['w'].copy()
        with tempfile.TemporaryDirectory(prefix='fixes-') as dossier:
            prefixe = str(Path(dossier) / 'diagnostic')
            with mock.patch.dict(os.environ, DIAGNOSTIC_POIDS_PREFIXE=prefixe), contextlib.redirect_stdout(io.StringIO()), \
                    self.assertRaisesRegex(RuntimeError, 'deux sommets sont fixes') as refus:
                avancer_correction(etat)
            self.assertTrue(Path(prefixe + '-refus.npz').exists())
        self.assertEqual(refus.exception.diagnostic['aretes'][0]['sommets'], [1, 2])
        numpy.testing.assert_array_equal(etat['w'], avant)
        self.assertEqual(etat['retouches'], set())


def pile_du_gabarit(clip):
    """pile[0] ≠ I : l'os 1 est à l'échelle 2 au repos du groupe, sous `clip` à l'instant suivant."""
    return numpy.array([[numpy.eye(4), numpy.diag([2.0, 2.0, 2.0, 1.0])], [numpy.eye(4), clip]], dtype=numpy.float32)


class TousLesGroupes(unittest.TestCase):
    def test_le_rapport_du_solveur_egale_celui_de_extremes_sous_pile_0_non_identite(self):
        x, aretes = chaine_x([0, 1])
        w = numpy.array([[1, 0], [0.5, 0.5]], dtype=numpy.float32)
        positions = x.copy()
        positions[1, 0] = 5.0
        grand = numpy.diag([2.0, 2.0, 2.0, 1.0])
        pile = numpy.array([pile_du_gabarit(grand)[0]] * 3 + [[numpy.eye(4), numpy.diag([3.0, 3.0, 3.0, 1.0])]], dtype=numpy.float32)
        groupe = groupe_a_un_clip(positions[None], x[None], pile, [])
        traces = []
        extremes(w, aretes, [groupe], traces)
        violations = Region(w, [0, 1], aretes, [groupe]).balayer(w)
        par_instant = {v.instant: v.rapport for v in violations if v.haut}
        self.assertEqual(sorted(par_instant), [0, 3], "la clause repos entre au balayage")
        self.assertEqual(par_instant[0], float(traces[0].rapports_repos[0, 0]))
        self.assertEqual(par_instant[3], float(traces[0].haut[0, 0]))

    def test_le_pas_se_ferme_sous_pile_0_non_identite(self):
        x, aretes = chaine_x([0, 1])
        groupe = groupe_a_un_clip(x[None], x[None], pile_du_gabarit(translation(12.0)), [])
        etat = preparer_correction('gabarit', x, numpy.array([[1, 0], [0, 1]], dtype=numpy.float32), numpy.arange(2), aretes, [groupe])
        self.assertTrue(etat['horsClip'].all())
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())

    def test_la_violation_du_second_groupe_recoit_son_plan(self):
        x, aretes = chaine_x([0, 1])
        w = numpy.array([[1, 0], [0, 1]], dtype=numpy.float32)
        groupes = [groupe_simple(x, deux_os(numpy.eye(4), translation(-.995))),
                   groupe_simple(x, deux_os(numpy.eye(4), translation(-.999)))]
        resolution = corriger_region(w, [0, 1], aretes, groupes)
        self.assertEqual(resolution.statut, 'ok')
        bas, _ = extremes(resolution.w, aretes, groupes)
        self.assertGreaterEqual(float(bas.min()), BAS)


class PartDuPied(unittest.TestCase):
    def test_un_sommet_a_0_49_de_pied_reste_sous_la_majorite(self):
        x, aretes = chaine_x([0, 1])
        w = [[.51, 0, .49], [0, 1, 0]]
        pile = numpy.array([[numpy.eye(4)] * 3, [numpy.eye(4), translation(12.0), translation(12.0)]], dtype=numpy.float32)
        sans_plan = etat_de(x, w, aretes, pile)
        avancer_correction(sans_plan)
        self.assertGreater(float(sans_plan['w'][0, 2]), MAJORITE_DU_POIDS, 'sans plan, le pas la pousse au-delà')
        etat = etat_de(x, w, aretes, pile, pieds=[[2]])
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertLess(float(etat['w'][0, 2]), MAJORITE_DU_POIDS)


class Determinisme(unittest.TestCase):
    def test_deux_appels_memes_octets(self):
        x, aretes = chaine_x([0, 1, 2, 3, 5, 6, 7, 8])
        w = numpy.array(CHAINE_PURE, dtype=numpy.float32)
        groupes = [groupe_simple(x, deux_os(numpy.eye(4), translation(12.0)))]
        premier = corriger_region(w, [2, 3, 4, 5], aretes[1:6], groupes)
        second = corriger_region(w, [2, 3, 4, 5], aretes[1:6], groupes)
        self.assertEqual(premier.statut, 'ok')
        self.assertEqual(premier.w.tobytes(), second.w.tobytes())


class FormeDesPoids(unittest.TestCase):
    def test_quatre_influences_au_plus_et_somme_a_1(self):
        x, aretes = chaine_x([0, 1])
        w = numpy.array([[.25] * 4 + [0] * 4, [0] * 4 + [.25] * 4], dtype=numpy.float32)
        pile = numpy.array([[numpy.eye(4)] * 8, [numpy.eye(4)] * 4 + [translation(5.0)] * 4], dtype=numpy.float32)
        etat = preparer_correction('forme', x, w, numpy.arange(2), aretes, [groupe_simple(x, pile)])
        avancer_correction(etat)
        self.assertFalse(etat['hors'].any())
        self.assertLessEqual(int((etat['w'] > 0).sum(axis=1).max()), INFLUENCES_MAX)
        numpy.testing.assert_allclose(etat['w'].sum(axis=1), 1.0, atol=1e-6)

    def test_les_poids_infimes_d_un_sommet_deplace_tombent_a_0(self):
        x, aretes = chaine_x([0, 1])
        w = numpy.array([[.5, .5, 0], [1, 0, 0]], dtype=numpy.float32)
        region = Region(w, [0], aretes, [])
        proposition = region.proposition(numpy.array([[.6, .4 - 5.9e-20, 5.9e-20], [1, 0, 0]]), w.dtype)
        self.assertEqual(proposition[0, 2], 0.0)
        numpy.testing.assert_allclose(proposition[0], [.6, .4, 0])

    def test_un_sommet_que_le_pas_ne_deplace_pas_garde_ses_octets(self):
        x, aretes = chaine_x([0, 1])
        w = numpy.array([[1 / 3, 2 / 3], [1, 0]], dtype=numpy.float32)
        region = Region(w, [0], aretes, [])
        proposition = region.proposition(w.astype(numpy.float64) * (1 + 1e-9), w.dtype)
        self.assertEqual(proposition.tobytes(), w.tobytes())


class AreteRigideEnClip(unittest.TestCase):
    def test_a_r_3_505_l_anneau_0_est_infaisable_et_l_anneau_1_reussit(self):
        x, aretes = chaine_x(range(4))
        positions = x.copy()
        positions[1:, 0] += 2.505
        groupe = groupe_a_un_clip(positions[None], x[None], deux_os(numpy.eye(4), translation(4.0)), [])
        w = numpy.array([[1, 0], [1, 0], [0, 1], [0, 1]], dtype=numpy.float32)
        etat = preparer_correction('bande', x, w, numpy.arange(4), aretes, [groupe])
        self.assertEqual(numpy.flatnonzero(etat['hors']).tolist(), [1])
        self.assertEqual(corriger_region(w, [1, 2], aretes, [groupe]).statut, 'infaisable')
        self.assertFalse(avancer_correction(etat))
        self.assertEqual(etat['anneau'], 1)
        self.assertEqual(int(etat['hors'].sum()), 0)


def flechi(angle, tete):
    """L'os 1 tourné de `angle` degrés autour de z, autour de sa tête `tete` (x, y)."""
    c, s = numpy.cos(numpy.radians(angle)), numpy.sin(numpy.radians(angle))
    m = numpy.eye(4)
    m[:2, :2] = [[c, -s], [s, c]]
    m[:2, 3] = numpy.array(tete) - m[:2, :2] @ numpy.array(tete)
    return m


def groupe_a_deux_piles(repos_b=None):
    """Deux états de mêmes facteurs, poids de silhouette `s` 0 et 1 sur deux os, la cellule de coins (0, 1, 0, 1) :
    pile A (os enfant fléchi de 90° autour de (1, 0)) pour l'état 0, pile B (fléchi de -90° autour de la tête déplacée
    (1,2455, 0,2545)) pour l'état 1 : au clip, le segment entre leurs vecteurs de (1, 2) passe à 0,006 de l'origine ; `repos_b`, le repos de l'os 1 sous B s'il n'est pas l'identité. (x, w, arêtes, groupe)."""
    x = numpy.array([[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 1]], dtype=numpy.float64)
    w = numpy.array([[1, 0], [1, 0], [0, 1]], dtype=numpy.float64)
    aretes = numpy.array([[0, 1], [1, 2]])
    a = numpy.array([[numpy.eye(4), numpy.eye(4)], [numpy.eye(4), flechi(90, (1, 0))]])
    b = numpy.array([[numpy.eye(4), numpy.eye(4) if repos_b is None else repos_b], [numpy.eye(4), flechi(-90, (1.2455, 0.2545))]])
    etats = [{'nom': f's{k}', 'poidsSilhouettes': {'s': k}, 'poidsGabarit': {}, 'poidsReference': {}} for k in (0, 1)]
    cellule = {'nom': 'segment', 'origine': {'s': 0}, 'colonnes': [{'s': 1}, {'s': 0}]}
    groupes = etats_ponderes(x, {'s': numpy.zeros((3, 3))}, [({'etats': etats, 'cellulesSilhouettes': [cellule]}, [a, b], (1,))])
    return x, w, aretes, groupes[0]


def vecteurs_deformes(w, x, pile, aretes):
    """Les vecteurs des `aretes` de `x` sous chaque échantillon de `pile`, par `poids.deformer` : (échantillons, arêtes, 3)."""
    p = poids.deformer(w, x, pile)
    return p[:, aretes[:, 0]] - p[:, aretes[:, 1]]


class PilesParEtat(unittest.TestCase):
    def test_chaque_etat_est_mesure_sous_sa_pile(self):
        _, w, aretes, groupe = groupe_a_deux_piles()
        touches, locales = numpy.unique(aretes, return_inverse=True)
        locales = locales.reshape(aretes.shape)
        longueurs = pas_des_poids.longueurs_de_reference(w, groupe, touches, locales)
        lot, = pas_des_poids.mesurer_par_lots(w, groupe, touches, locales, longueurs)
        attendus = [vecteurs_deformes(w, groupe[0][e], groupe[2][e], aretes) for e in (0, 1)]
        self.assertFalse(numpy.allclose(attendus[0][1], attendus[1][1]), 'les deux piles posent l\'arête autrement')
        for e in (0, 1):
            numpy.testing.assert_allclose(lot.vecteurs[e], attendus[e], rtol=0, atol=1e-12)
        self.assertEqual(lot.vecteurs.shape, (2, 2, 2, 3))

    def test_la_cellule_entre_deux_piles_se_mesure_sur_le_segment_des_vecteurs_deformes(self):
        _, w, aretes, groupe = groupe_a_deux_piles()
        self.assertEqual(groupe.cellules[0]['coins'], [0, 1, 0, 1])
        traces = []
        extremes(w, aretes, [groupe], traces, filtrer=False)
        e0, e1 = (vecteurs_deformes(w, groupe[0][e], groupe[2][e], aretes)[1, 1] for e in (0, 1))
        u = numpy.clip(-(e0 @ (e1 - e0)) / ((e1 - e0) @ (e1 - e0)), 0, 1)
        self.assertGreater(u, 0)
        self.assertLess(u, 1)
        self.assertTrue(traces[0].domaine_clip.exact[1])
        self.assertAlmostEqual(traces[0].domaine_clip.bas[1], numpy.linalg.norm(e0 + u * (e1 - e0)), places=12)
        self.assertAlmostEqual(traces[0].domaine_clip.poids['s'][1], u, places=12)

    def test_la_longueur_de_reference_d_un_etat_est_posee_par_le_repos_de_sa_pile(self):
        _, w, aretes, groupe = groupe_a_deux_piles(numpy.diag([3.0, 3.0, 3.0, 1.0]))
        touches, locales = numpy.unique(aretes, return_inverse=True)
        longueurs = pas_des_poids.longueurs_de_reference(w, groupe, touches, locales.reshape(aretes.shape))
        attendues = numpy.array([numpy.linalg.norm(vecteurs_deformes(w, groupe[1][e], groupe[2][e][:1], aretes)[0], axis=1)
                                 for e in (0, 1)])
        numpy.testing.assert_allclose(longueurs, attendues, rtol=0, atol=1e-12)
        self.assertNotAlmostEqual(longueurs[0, 1], longueurs[1, 1])

    def test_les_plans_d_une_violation_posent_chaque_coin_par_sa_pile(self):
        x, w, aretes, groupe = groupe_a_deux_piles()
        region = Region(w, [1], aretes, [groupe])
        violations = [v for v in region.balayer(w) if len(v.coins) == 4]
        self.assertTrue(violations, 'la cellule sort par le bas au clip')
        for violation in violations:
            a, b = aretes[violation.arete]
            coefficients = (1 - violation.u - violation.v, violation.u, violation.v)
            poses = [numpy.einsum('o,oij->ij', w[s], groupe[2][e][violation.instant]) for e in (0, 1) for s in (a, b)]
            par_coin = {e: (poses[2 * e], poses[2 * e + 1]) for e in (0, 1)}
            n = sum(k * 0.5 * (par_coin[c][0] + par_coin[c][1])[:3, :3] @ (x[a] - x[b])[:3]
                    for k, c in zip(coefficients, violation.coins[:3]))
            n = n / numpy.linalg.norm(n)
            facteur = BAS * pas_des_poids.MARGE_PLAN_BAS
            plans = region.plans_de(w, violation)
            self.assertEqual(len(plans), 4)
            for plan, c in zip(plans, (0, 1, 0, 1)):
                e = vecteurs_deformes(w, x, groupe[2][c], aretes)[violation.instant, violation.arete]
                valeur = plan.signe * (plan.os_a @ w[plan.a] - plan.os_b @ w[plan.b])
                self.assertAlmostEqual(valeur, n @ e - facteur * numpy.linalg.norm(x[a, :3] - x[b, :3]), places=12)

    def test_un_groupe_porte_une_pile_par_etat_de_meme_taille(self):
        pile = deux_os(numpy.eye(4), translation(1.0))
        x, _ = chaine_x([0, 1])
        with self.assertRaisesRegex(ValueError, r'piles-incoherentes : 1 pile\(s\) pour 2 état\(s\)'):
            GroupePondere(numpy.array([x, x]), numpy.array([x, x]), [pile], [], (), (1,))
        with self.assertRaisesRegex(ValueError, r'clips-incoherents : piles de \[1, 2\] échantillons'):
            GroupePondere(numpy.array([x, x]), numpy.array([x, x]), [pile, pile[:1]], [], (), (1,))


if __name__ == '__main__':
    unittest.main()
