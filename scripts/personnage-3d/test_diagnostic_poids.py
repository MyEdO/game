"""#3104 issuecomment-6549354475."""
import ast
import contextlib
import io
import json
import sys
import tempfile
import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from pathlib import Path
from unittest import mock
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))
import poids
import humanoide
from diagnostic_poids import decrire_aretes as decrire_traces, imprimer_retournements, recharger, retournements_neufs
from test_silhouettes import groupe_a_un_clip


def decrire_aretes(w, aretes, groupes, contexte):
    traces = []
    poids.extremes(w, aretes, groupes, traces)
    return decrire_traces(aretes, groupes, contexte, traces)


def refus():
    x = np.array([[0, 0, 0, 1], [1, 0, 0, 1], [2, 0, 0, 1], [3, 0, 0, 1]], dtype=np.float32)
    w = np.array([[1, 0], [1, 0], [1, 0], [0, 1]], dtype=np.float32)
    comprime, etire = x.copy(), x.copy()
    comprime[3, 0], etire[3, 0] = 2.005, 4
    matrices = np.tile(np.eye(4, dtype=np.float32), (3, 2, 1, 1))
    matrices[2, 1, 0, 3] = 5
    groupes = [groupe_a_un_clip(np.array([x, comprime, etire]), np.array([x, x, x]), matrices, [])]
    contexte = {'noms': ['calf', 'foot'], 'etats': [[{'nom': n} for n in ['neutre', 'comprime', 'etire']]],
                'echantillons': [{'clip': 'repos', 't': 0}, {'clip': 'Compression', 't': .25}, {'clip': 'Course', 't': 0.5}]}
    flux = io.StringIO()
    with contextlib.redirect_stdout(flux):
        try:
            poids.refuser_correction(poids.preparer_correction('peau', x, w, np.arange(4), np.array([[2, 3]]), groupes, [2], contexte), 0)
        except RuntimeError as erreur:
            ligne = next(l for l in flux.getvalue().splitlines() if l.startswith('POIDS_REFUS '))
            return erreur.diagnostic, json.loads(ligne.removeprefix('POIDS_REFUS '))
    raise AssertionError('refus attendu')


class GrapheDesImports(unittest.TestCase):
    def test_le_graphe_des_imports_y_compris_locaux_est_acyclique(self):
        racine = Path(__file__).resolve().parent
        fichiers = {p.stem: p for dossier in (racine, racine / 'base') for p in dossier.glob('*.py')
                    if not p.stem.startswith('test_')}
        graphe = {}
        for nom, chemin in fichiers.items():
            voisins = set()
            for n in ast.walk(ast.parse(chemin.read_text(encoding='utf-8'))):
                modules = [a.name for a in n.names] if isinstance(n, ast.Import) else (
                    [n.module] if isinstance(n, ast.ImportFrom) and n.module else [])
                voisins.update(m.split('.')[0] for m in modules if m.split('.')[0] in fichiers and m != nom)
            graphe[nom] = voisins
        def visiter(nom, pile):
            self.assertNotIn(nom, pile, ' -> '.join((*pile, nom)))
            for voisin in graphe[nom]:
                visiter(voisin, (*pile, nom))
        for nom in graphe:
            visiter(nom, ())


class RefusDesPoids(unittest.TestCase):
    def test_le_refus_porte_toutes_les_mesures_demandees(self):
        rapport, journal = refus()
        self.assertEqual(journal, rapport)
        self.assertEqual(rapport['passe'], 0)
        self.assertEqual(len(rapport['aretes']), 1)
        e = rapport['aretes'][0]
        self.assertEqual(e['sommets'], [2, 3])
        self.assertEqual(e['osDominants'], ['calf', 'foot'])
        self.assertEqual(e['fixes'], [True, False])
        self.assertEqual(e['minimum']['etat'], 'comprime')
        self.assertEqual(e['maximum']['etat'], 'etire')
        self.assertEqual(e['minimum']['clip'], 'Compression')
        self.assertEqual(e['maximum']['clip'], 'Course')
        self.assertEqual(e['maximum']['t'], 0.5)
        for cle in ['minimum', 'maximum']:
            self.assertEqual(set(e[cle]), {'etat', 'clip', 't', 'echantillon', 'l_b', 'rapport',
                                          'longueurDeformee', 'l_b_sur_neutre'})
            self.assertAlmostEqual(e[cle]['l_b'], 1)
        self.assertGreater(e['maximum']['rapport'], 3.51)
        self.assertLess(e['minimum']['rapport'], 0.01)
        self.assertEqual(e['l_b_neutre'], 1)
        repos = e['parEtat'][1]['repos']
        self.assertEqual(repos['clause'], 'R')
        self.assertEqual(repos['cote'], 0)
        self.assertEqual(repos['seuil'], .25)
        self.assertLess(repos['rapport'], .25)

    def test_le_refus_mesure_la_reference_avec_les_poids_courants(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
        deplace = x.copy()
        deplace[1, 0] = 2
        w = np.array([[1, 0], [0, 1]], dtype=np.float32)
        matrices = np.tile(np.eye(4, dtype=np.float32), (3, 2, 1, 1))
        matrices[:, 0, 0, 0] = 2
        matrices[:, 1, 0, 0] = 3
        matrices[2, 1, 0, 3] = 3
        groupes = [groupe_a_un_clip(deplace[None], x[None], matrices, [])]
        contexte = {'etats': [[{'nom': 'deplace'}]],
                    'echantillons': [{'clip': 'repos', 't': 0}, {'clip': 'Compression', 't': .25}, {'clip': 'Course', 't': .5}]}
        e = decrire_aretes(w, np.array([[0, 1]]), groupes, contexte)[0]
        self.assertEqual(e['minimum']['rapport'], 2)
        self.assertEqual(e['maximum']['rapport'], 3)
        self.assertEqual(e['minimum']['l_b'], 3)
        w[1] = [1, 0]
        e = decrire_aretes(w, np.array([[0, 1]]), groupes, contexte)[0]
        self.assertEqual(e['minimum']['rapport'], 2)
        self.assertEqual(e['maximum']['rapport'], 2)
        self.assertEqual(e['minimum']['l_b'], 2)


def preparation_cuite(rapport_repos, capture=None, topologie=None):
    x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
    w = np.ones((2, 1), dtype=np.float32)
    deltas = np.zeros((2, 3), dtype=np.float32)
    deltas[1, 0] = rapport_repos - 1
    etats = [{'nom': nom, 'poidsSilhouettes': {}, 'poidsGabarit': {'cuite': p}, 'poidsReference': {}}
             for nom, p in [('neutre', 0), ('cuite', 1)]]
    pile = np.tile(np.eye(4, dtype=np.float32), (1, 1, 1, 1))
    appels = []
    if topologie is None:
        topologie = []

    @contextlib.contextmanager
    def groupes(rig, clips, table, demandes, plantes, diagnostic):
        appels.append(clips)
        diagnostic.update(etats=[demandes], echantillons=[{'clip': 'repos', 't': 0}])
        yield ['os'], [(demandes, [pile] * len(demandes), ())]

    with ExitStack() as ressources, contextlib.redirect_stdout(io.StringIO()):
        ressources.enter_context(mock.patch.object(humanoide, 'groupes_de_peau', groupes))
        ressources.enter_context(mock.patch.object(humanoide, 'peau_lineaire', return_value=(x, w)))
        ressources.enter_context(mock.patch.object(humanoide, 'aretes_des_triangles', return_value=np.array([[0, 1]])))
        moteurs = humanoide.preparer_moteurs(None, [SimpleNamespace(name='peau')], ['clip'], (), {}, {'etats': etats, 'cellulesSilhouettes': topologie},
            {'peau': {'cuite': deltas}}, None, ressources, repos_cuit=True,
            captures={'peau': capture} if capture is not None else None)
    return moteurs, appels


def retournement_sous_le_clip(poids_de_sortie, au_repos=False):
    """Trois sommets sur l'os 0, os 1 translaté de -1,5 m sur x en clip, ou au repos (`pile[0]`) si `au_repos` : le
    sommet 1 passé à l'os 1 retourne l'arête (0, 1) et la face (0, 1, 2) sous cet échantillon."""
    x = np.array([[0, 0, 0, 1], [1, 0, 0, 1], [0, 1, 0, 1]], dtype=np.float32)
    origine = np.array([[1, 0], [1, 0], [1, 0]], dtype=np.float32)
    clip = np.eye(4, dtype=np.float32)
    clip[0, 3] = -1.5
    pile = np.array([[np.eye(4), clip], [np.eye(4), np.eye(4)]] if au_repos else [[np.eye(4), np.eye(4)], [np.eye(4), clip]],
                    dtype=np.float32)
    return {'nom': 'peau', 'origine': origine, 'w': np.array(poids_de_sortie, dtype=np.float32), 'retouches': {1},
            'aretes': np.array([[0, 1]]), 'groupes': [groupe_a_un_clip(x[None], x[None], pile, [])]}, np.array([[0, 1, 2]])


class RetournementsNeufs(unittest.TestCase):
    def test_un_retournement_de_la_phase_se_compte_et_le_journal_l_imprime(self):
        etat, faces = retournement_sous_le_clip([[1, 0], [0, 1], [1, 0]])
        self.assertEqual(retournements_neufs(etat, faces), {'aretes': 1, 'faces': 1})
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            imprimer_retournements(etat, faces)
        self.assertEqual(sortie.getvalue().strip(), 'POIDS_RETOURNEMENTS peau arêtes 1 faces 1')

    def test_un_retournement_deja_la_a_l_entree_ne_compte_pas(self):
        etat, faces = retournement_sous_le_clip([[1, 0], [0, 1], [1, 0]])
        etat['origine'] = etat['w'].copy()
        self.assertEqual(retournements_neufs(etat, faces), {'aretes': 0, 'faces': 0})

    def test_un_retournement_sous_le_seul_repos_ne_compte_pas(self):
        etat, faces = retournement_sous_le_clip([[1, 0], [0, 1], [1, 0]], au_repos=True)
        self.assertEqual(retournements_neufs(etat, faces), {'aretes': 0, 'faces': 0})


    def test_le_retournement_d_un_etat_se_lit_sous_sa_pile(self):
        etat, faces = retournement_sous_le_clip([[1, 0], [0, 1], [1, 0]])
        groupe = etat['groupes'][0]
        immobile = np.tile(np.eye(4, dtype=np.float32), (2, 2, 1, 1))
        positions = np.concatenate([groupe[0], groupe[0]])
        etat['groupes'] = [poids.GroupePondere(positions, positions, [immobile, groupe[2][0]], [], (), groupe.clips)]
        self.assertEqual(retournements_neufs(etat, faces), {'aretes': 1, 'faces': 1})

class PorteDeCuisson(unittest.TestCase):
    def test_les_moteurs_lisent_la_topologie_recue(self):
        topologie = []
        with mock.patch.object(humanoide, 'etats_ponderes', wraps=poids.etats_ponderes) as ponderer:
            preparation_cuite(1, topologie=topologie)
        self.assertEqual(len(ponderer.call_args_list), 2)
        for appel in ponderer.call_args_list:
            self.assertIs(appel.args[2][0][0]['cellulesSilhouettes'], topologie)

    def test_un_etat_cuit_hors_R_est_refuse_avant_clips_et_correction(self):
        with mock.patch.object(humanoide, 'avancer_correction') as avancer:
            with self.assertRaisesRegex(RuntimeError, 'cuisson : clause R') as erreur:
                preparation_cuite(5)
        avancer.assert_not_called()
        self.assertEqual(erreur.exception.diagnostic['passe'], 0)
        e = erreur.exception.diagnostic['aretes'][0]
        self.assertIsNone(e['minimum'])
        self.assertIsNone(e['maximum'])
        self.assertEqual(e['parEtat'][1]['repos']['rapport'], 5)
        self.assertEqual(e['parEtat'][1]['repos']['clause'], 'R')
        json.dumps(erreur.exception.diagnostic, allow_nan=False)

    def test_une_cuisson_dans_R_prepare_ensuite_les_clips(self):
        moteurs, appels = preparation_cuite(3.5)
        self.assertEqual(appels, [[], ['clip']])
        self.assertEqual(len(moteurs), 1)
        self.assertFalse(moteurs[0][2]['horsRepos'].any())

    def test_un_repos_entre_la_borne_des_cles_et_R_est_refuse(self):
        with self.assertRaisesRegex(RuntimeError, 'cuisson : clause R') as erreur:
            preparation_cuite(3.7)
        mesure = erreur.exception.diagnostic['aretes'][0]['parEtat'][1]['repos']
        self.assertEqual(mesure['seuil'], 3.51)
        self.assertEqual(mesure['cote'], 1)

    def test_le_refus_capture_l_entree_H5_de_sa_peau(self):
        capture = {'entree': {'table': {'racine': 'os'}, 'corps': {
            'positions': [[0, 0, 0], [1, 0, 0]], 'aretes': [[0, 1]],
            'poids': [[[0, 1]], [[0, 1]]], 'squelette': [{'nom': 'os', 'parent': None,
            'repos': np.eye(4).ravel().tolist(), 'boneInverse': np.eye(4).ravel().tolist()}],
            'silhouettes': [{'nom': 'large', 'deltas': [[0, 0, 0], [1, 0, 0]]}]}}, 'noeud': [0, 1]}
        with tempfile.TemporaryDirectory(prefix='r13-h5-') as dossier:
            prefixe = str(Path(dossier) / 'diagnostic')
            with mock.patch.dict('os.environ', DIAGNOSTIC_POIDS_PREFIXE=prefixe):
                with self.assertRaisesRegex(RuntimeError, 'cuisson : clause R'):
                    preparation_cuite(3.7, capture)
            with np.load(prefixe + '-refus.npz', allow_pickle=False) as z:
                self.assertEqual(json.loads(str(z['h5'])), capture)
            Path(prefixe + '-refus.npz').unlink()
            Path(prefixe + '-refus.json').unlink()
            with mock.patch.dict('os.environ', DIAGNOSTIC_POIDS_PREFIXE=prefixe):
                preparation_cuite(3.5, capture)
            self.assertEqual(list(Path(dossier).iterdir()), [])


class SauvegardeDuRefus(unittest.TestCase):
    def test_la_sauvegarde_du_refus_rejoue_les_memes_mesures_et_deduplique_les_piles(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
        w = np.array([[1, 0], [0, 1]], dtype=np.float32)
        matrices = np.tile(np.eye(4, dtype=np.float32), (2, 2, 1, 1))
        matrices[1, 1, 0, 3] = 4
        groupes = [groupe_a_un_clip(x[None], x[None], matrices, []), groupe_a_un_clip(x[None], x[None], matrices, [])]
        contexte = {'etats': [[{'nom': 'neutre'}], [{'nom': 'duplique'}]],
                    'echantillons': [{'clip': 'repos', 't': 0}, {'clip': 'course', 't': .1}]}
        entree = poids.preparer_correction('peau', x, w, np.arange(2), np.array([[0, 1]]), groupes, [0], contexte)
        with tempfile.TemporaryDirectory(prefix='r12-refus-') as dossier:
            prefixe = str(Path(dossier) / 'diagnostic')
            with mock.patch.dict('os.environ', DIAGNOSTIC_POIDS_PREFIXE=prefixe), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(RuntimeError) as refuse:
                    poids.refuser_correction(entree, 0)
            with np.load(prefixe + '-refus.npz', allow_pickle=False) as z:
                configuration = json.loads(str(z['configuration']))
                self.assertEqual(len([k for k in z.files if k.startswith('matrices_')]), 1)
                recharges = [poids.GroupePondere(z[g['positions']], z[g['references']], recharger(z, g), g['cellules'], (),
                                                  g['clips'])
                             for g in configuration['groupes']]
                self.assertEqual([g.clips for g in recharges], [g.clips for g in groupes])
                rejoue = poids.preparer_correction(configuration['nom'], z['x'], z['w_initial'], z['jumeau'], z['aretes'], recharges,
                    z['fixes'], json.loads(str(z['contexte'])))
                for cle in ['x', 'w', 'origine', 'aretes', 'jumeau', 'contraintes', 'bas', 'haut', 'repos']:
                    np.testing.assert_array_equal(rejoue[cle], entree[cle])
                with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(RuntimeError) as second:
                    poids.refuser_correction(rejoue, 0)
                self.assertEqual(second.exception.diagnostic, refuse.exception.diagnostic)

    def test_la_sauvegarde_decrit_la_pile_de_chaque_etat_et_la_relit_partagee(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
        w = np.array([[1, 0], [0, 1]], dtype=np.float32)
        a = np.tile(np.eye(4, dtype=np.float32), (2, 2, 1, 1))
        a[1, 1, 0, 3] = 4
        b = a.copy()
        b[1, 1, 0, 3] = 5
        groupes = [poids.GroupePondere(np.array([x, x, x]), np.array([x, x, x]), [a, b, a], [], (), (1,)),
                   groupe_a_un_clip(x[None], x[None], b, [])]
        contexte = {'etats': [[{'nom': 'a'}, {'nom': 'b'}, {'nom': 'a-bis'}], [{'nom': 'b-seul'}]],
                    'echantillons': [{'clip': 'repos', 't': 0}, {'clip': 'course', 't': .1}]}
        entree = poids.preparer_correction('peau', x, w, np.arange(2), np.array([[0, 1]]), groupes, [0], contexte)
        with tempfile.TemporaryDirectory(prefix='r12-piles-') as dossier:
            prefixe = str(Path(dossier) / 'diagnostic')
            with mock.patch.dict('os.environ', DIAGNOSTIC_POIDS_PREFIXE=prefixe), contextlib.redirect_stdout(io.StringIO()), \
                    self.assertRaises(RuntimeError):
                poids.refuser_correction(entree, 0)
            with np.load(prefixe + '-refus.npz', allow_pickle=False) as z:
                configuration = json.loads(str(z['configuration']))
                self.assertEqual(sorted(k for k in z.files if k.startswith('matrices_')), ['matrices_0', 'matrices_1'])
                self.assertEqual([g['matrices'] for g in configuration['groupes']], [[0, 1, 0], [1]])
                relues = [recharger(z, g) for g in configuration['groupes']]
        self.assertIs(relues[0][0], relues[0][2])
        self.assertIsNot(relues[0][0], relues[0][1])
        for lus, groupe in zip(relues, groupes):
            for pile, originale in zip(lus, groupe[2]):
                np.testing.assert_array_equal(pile, originale)

    def test_le_succes_ne_sauvegarde_rien(self):
        x = np.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=np.float32)
        w = np.ones((2, 1), dtype=np.float32)
        matrices = np.eye(4, dtype=np.float32)[None, None]
        with tempfile.TemporaryDirectory(prefix='r12-succes-') as dossier:
            with mock.patch.dict('os.environ', DIAGNOSTIC_POIDS_PREFIXE=str(Path(dossier) / 'diagnostic')):
                poids.avancer_correction(poids.preparer_correction('peau', x, w, np.arange(2), np.array([[0, 1]]),
                                                                   [groupe_a_un_clip(x[None], x[None], matrices, [])]))
            self.assertEqual(list(Path(dossier).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
