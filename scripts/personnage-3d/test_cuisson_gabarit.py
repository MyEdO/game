"""#3104 issuecomment-6547804765."""
import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import bpy
from mathutils import Matrix
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))
from cuisson_gabarit import (ATTRIBUT_SOMMET, corps_du_gabarit, cuisson_des_champs, preparer_reference, vers_gltf,  # noqa: E402
                             groupes_de_peau, cuire_gabarit)
from formes import positions, poser_la_cle  # noqa: E402
from portage import ecrire_os_des_silhouettes  # noqa: E402
from script_node import lancer  # noqa: E402


class Armature(dict):
    """Une armature de test : ses os `os`, repère monde identité, propriétés personnalisées par indexation."""
    def __init__(self, *os):
        super().__init__()
        self.matrix_world = Matrix.Identity(4)
        self.data = SimpleNamespace(bones=list(os))


def racine_et_jambe():
    root = SimpleNamespace(name='root', parent=None, matrix_local=Matrix.Identity(4))
    return Armature(root, SimpleNamespace(name='leg', parent=root, matrix_local=Matrix.Translation((0, 1, 0))))


def retirer_la_fixture(fichiers, dossiers):
    for fichier in fichiers:
        if not fichier._mmap.closed:
            fichier._mmap.close()
    for dossier in dossiers:
        if dossier.exists():
            for fichier in dossier.iterdir():
                fichier.unlink()
            dossier.rmdir()


class FermetureDesMatrices(unittest.TestCase):
    def test_un_groupe_invalide_ferme_tous_les_fichiers_deja_ouverts(self):
        os = SimpleNamespace(name='root', parent=None, matrix_local=Matrix.Identity(4))
        rig = SimpleNamespace(matrix_world=Matrix.Identity(4), data=SimpleNamespace(bones=[os]))
        ouvrir = np.memmap
        for echec, erreur, nombre in [('ouverture', FileNotFoundError, 1), ('reshape', ValueError, 2)]:
            fichiers, dossiers = [], []
            def lancer_groupes(_, __, entree):
                dossier = Path(json.loads(entree)['sortie'])
                dossiers.append(dossier)
                np.arange(16, dtype=np.float32).tofile(dossier / 'premier.bin')
                if echec == 'reshape':
                    np.arange(15, dtype=np.float32).tofile(dossier / 'second.bin')
                return json.dumps({'groupes': [{'fichiers': [str(dossier / nom) for nom in ['premier.bin', 'second.bin']],
                                                'jeux': [], 'etats': []}]})
            def ouvrir_fichier(*args, **kwargs):
                fichier = ouvrir(*args, **kwargs)
                fichiers.append(fichier)
                return fichier
            with self.subTest(echec=echec):
                try:
                    with mock.patch('cuisson_gabarit.lancer', side_effect=lancer_groupes), \
                            mock.patch('cuisson_gabarit.np.memmap', side_effect=ouvrir_fichier):
                        with self.assertRaises(erreur):
                            with groupes_de_peau(rig, [], {}, [], ()):
                                self.fail('aucun groupe incomplet ne doit etre livre')
                    self.assertEqual(len(fichiers), nombre)
                    self.assertTrue(all(f._mmap.closed for f in fichiers))
                    self.assertTrue(all(not d.exists() for d in dossiers))
                finally:
                    retirer_la_fixture(fichiers, dossiers)

    def test_les_groupes_transportent_les_etats_et_partagent_la_pile_de_chaque_jeu(self):
        os = SimpleNamespace(name='root', parent=None, matrix_local=Matrix.Identity(4))
        rig = SimpleNamespace(matrix_world=Matrix.Identity(4), data=SimpleNamespace(bones=[os]))
        etats = [{'nom': nom, 'poidsSilhouettes': {}, 'poidsGabarit': {}} for nom in 'abc']
        def lancer_groupes(_, __, entree):
            requete = json.loads(entree)
            self.assertEqual(set(requete), {'operation', 'table', 'corps', 'clips', 'plantes', 'poses', 'sortie', 'etats'})
            fichiers = [Path(requete['sortie']) / f'jeu-{k}.bin' for k in range(2)]
            for k, fichier in enumerate(fichiers):
                (np.eye(4, dtype=np.float32) * (k + 1)).tofile(fichier)
            return json.dumps({'groupes': [{'facteurs': {}, 'etats': etats, 'fichiers': [str(f) for f in fichiers],
                                            'jeux': [0, 1, 1]}]})
        sortie = io.StringIO()
        with mock.patch('cuisson_gabarit.lancer', side_effect=lancer_groupes), redirect_stdout(sortie):
            with groupes_de_peau(rig, [], {}, etats, ()) as (_, groupes):
                lus, matrices, _ = groupes[0]
                self.assertEqual(lus, etats)
                self.assertEqual(len(matrices), 3)
                self.assertIs(matrices[1], matrices[2])
                np.testing.assert_array_equal(matrices[0][0, 0], np.eye(4, dtype=np.float32))
                np.testing.assert_array_equal(matrices[1][0, 0], 2 * np.eye(4, dtype=np.float32))
        self.assertIn('GABARIT_MATRICES 3 états 2 jeux 1 échantillons', sortie.getvalue())

    def test_les_matrices_de_gabarit_mjs_sont_l_identite_au_repos_et_la_pose_en_ligne_majeure_au_clip(self):
        root = SimpleNamespace(name='root', parent=None, matrix_local=Matrix.Identity(4))
        thigh = SimpleNamespace(name='thigh', parent=root, matrix_local=Matrix.Translation((0, 0, 1)))
        calf = SimpleNamespace(name='calf', parent=thigh, matrix_local=Matrix.Translation((0, 0, .5)))
        rig = SimpleNamespace(matrix_world=Matrix.Identity(4), data=SimpleNamespace(bones=[root, thigh, calf]))
        table = {'racine': 'root', 'legs': ['thigh'], 'arms': [], 'head': [], 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12}, 'arms': {'min': 1, 'max': 1}, 'head': {'min': 1, 'max': 1}},
                 'osDesSilhouettes': {}}
        translation = Matrix.Translation((1, 2, 3))
        pose = np.array([[np.array(translation @ b.matrix_local) for b in rig.data.bones]])
        etats = [{'nom': 'neutre', 'facteurs': {'sl': 1, 'legs': .62, 'arms': 1, 'head': 1, 'st': 1}, 'poidsSilhouettes': {}}]
        with mock.patch('cuisson_gabarit.poses', return_value=pose):
            with groupes_de_peau(rig, [SimpleNamespace(name='clip')], table, etats, ()) as (noms, piles):
                etats_lus, (matrices,), clips = piles[0]
                self.assertEqual((noms, etats_lus, clips), (['root', 'thigh', 'calf'], etats, [1]))
                np.testing.assert_allclose(matrices[0], np.tile(np.eye(4), (3, 1, 1)), atol=1e-6)
                np.testing.assert_allclose(matrices[1, 0], np.array(translation), atol=1e-6)


class GrapheDuGabarit(unittest.TestCase):
    def setUp(self):
        mesh = bpy.data.meshes.new('couture')
        mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)],
                         [], [(0, 1, 2), (3, 4, 5)])
        self.peau = bpy.data.objects.new('couture', mesh)
        self.peau.vertex_groups.new(name='root').add([1, 2, 3, 4, 5], .5, 'REPLACE')
        self.peau.vertex_groups.new(name='leg').add([0], 1, 'REPLACE')
        self.peau.vertex_groups['leg'].add([1, 2, 3, 4, 5], .5, 'REPLACE')
        poser_la_cle(self.peau, 'corpulence', np.tile([0, 0, .1], (6, 1)))

    def tearDown(self):
        mesh = self.peau.data
        bpy.data.objects.remove(self.peau, do_unlink=True)
        bpy.data.meshes.remove(mesh)

    def test_les_sommets_jumeaux_partagent_positions_poids_et_silhouettes(self):
        corps, noeud = corps_du_gabarit(self.peau, racine_et_jambe())
        self.assertEqual(noeud.tolist(), [0, 1, 2, 1, 3, 2])
        self.assertEqual(len(corps['positions']), 4)
        self.assertEqual(len(corps['aretes']), 5)
        self.assertEqual(corps['poids'], [[(1, 1.0)], [(0, .5), (1, .5)], [(0, .5), (1, .5)], [(0, .5), (1, .5)]])
        np.testing.assert_allclose(corps['silhouettes'][0]['deltas'], np.tile([0, 0, .1], (4, 1)))
        np.testing.assert_array_equal(corps['silhouettes'][0]['portage'], np.zeros((4, 3)))

    def test_une_silhouette_a_os_se_separe_en_residu_et_portage_au_repere_du_mesh(self):
        rig = racine_et_jambe()
        ecrire_os_des_silhouettes(rig, {'carrure_plus': {'leg': [.1, 0, .2]}})
        self.peau.matrix_world = Matrix.Rotation(np.pi / 2, 4, 'Z')
        totale = np.arange(18, dtype=float).reshape(6, 3) / 100
        poser_la_cle(self.peau, 'carrure_plus', totale)
        corps, noeud = corps_du_gabarit(self.peau, rig)
        silhouettes = {s['nom']: s for s in corps['silhouettes']}
        poids_de_la_jambe = np.array([1, .5, .5, .5, .5, .5])
        au_mesh = np.array(Matrix.Rotation(-np.pi / 2, 3, 'Z')) @ np.array([.1, 0, .2])
        portage = poids_de_la_jambe[:, None] * au_mesh
        moyenne = lambda d: np.array([d[noeud == k].mean(axis=0) for k in range(noeud.max() + 1)])
        np.testing.assert_allclose(silhouettes['carrure_plus']['portage'], moyenne(portage), atol=1e-6)
        np.testing.assert_allclose(silhouettes['carrure_plus']['deltas'], moyenne(totale - portage), atol=1e-6)
        np.testing.assert_array_equal(silhouettes['corpulence']['portage'], np.zeros((4, 3)))
        np.testing.assert_allclose(silhouettes['corpulence']['deltas'], np.tile([0, 0, .1], (4, 1)), atol=1e-6)

    def test_la_capture_porte_exactement_l_entree_de_la_cuisson_et_son_expansion(self):
        rig = racine_et_jambe()
        table = {'racine': 'root', 'legs': ['leg'], 'arms': [], 'head': [], 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12}, 'arms': {'min': 1, 'max': 1.6},
                            'head': {'min': 1, 'max': 1.9}}}
        captures, entrees = {}, []
        def cuire(script, arguments, entree):
            entrees.append(json.loads(entree))
            return lancer(script, arguments, entree)
        with mock.patch('cuisson_gabarit.lancer', side_effect=cuire):
            references = cuire_gabarit(rig, [self.peau], table, captures)
        capture = captures[self.peau.name]
        self.assertEqual(capture['entree'], entrees[0])
        rejoue = json.loads(lancer(Path(__file__).resolve().parent / 'base/gabarit.mjs', [],
                                  json.dumps(capture['entree'])))
        self.assertEqual(rejoue, capture['resultat'])
        for cle, attendue in zip(rejoue['cles'], references[0][2]['cles']):
            np.testing.assert_allclose(np.array(cle['deltas'])[capture['noeud']], attendue['deltas'], atol=1e-5)

    def test_la_cuisson_des_champs_rend_les_cles_de_la_cuisson_des_shape_keys(self):
        rig = racine_et_jambe()
        table = {'racine': 'root', 'legs': ['leg'], 'arms': [], 'head': [], 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12}, 'arms': {'min': 1, 'max': 1.6},
                            'head': {'min': 1, 'max': 1.9}}}
        champ = np.zeros((6, 3))
        champ[[1, 3], 2] = .3
        poser_la_cle(self.peau, 'corpulence', champ)
        attendues = {c['nom']: c['deltas'] for c in cuire_gabarit(rig, [self.peau], table)[0][2]['cles']}
        poser_la_cle(self.peau, 'corpulence', np.zeros((6, 3)))
        obtenues = cuisson_des_champs(rig, self.peau, table)({'corpulence': champ})
        self.assertEqual(sorted(obtenues), sorted(attendues))
        self.assertTrue(any(np.abs(d).max() > 0 for nom, d in obtenues.items() if nom.endswith('_corpulence')))
        for nom, deltas in obtenues.items():
            np.testing.assert_allclose(deltas, attendues[nom], atol=1e-12, err_msg=nom)

    def test_la_cuisson_des_champs_ne_recuit_que_les_champs_changes(self):
        rig = racine_et_jambe()
        table = {'racine': 'root', 'legs': ['leg'], 'arms': [], 'head': [], 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12}, 'arms': {'min': 1, 'max': 1.6},
                            'head': {'min': 1, 'max': 1.9}}}
        corpulence, feminin = np.zeros((6, 3)), np.zeros((6, 3))
        corpulence[[1, 3], 2], feminin[[2, 5], 0] = .3, .2
        cuire = cuisson_des_champs(rig, self.peau, table)
        cuire({'corpulence': corpulence, 'feminin': feminin})
        corpulence = corpulence * 2
        envoyees = []
        def lancer_et_noter(script, arguments, entree):
            envoyees.append([s['nom'] for s in json.loads(entree)['corps']['silhouettes']])
            return lancer(script, arguments, entree)
        with mock.patch('cuisson_gabarit.lancer', side_effect=lancer_et_noter):
            obtenues = cuire({'corpulence': corpulence, 'feminin': feminin})
            cuire({'corpulence': corpulence, 'feminin': feminin})
        self.assertEqual(envoyees, [['corpulence']])
        attendues = cuisson_des_champs(rig, self.peau, table)({'corpulence': corpulence, 'feminin': feminin})
        self.assertEqual(sorted(obtenues), sorted(attendues))
        for nom, deltas in obtenues.items():
            np.testing.assert_array_equal(deltas, attendues[nom], err_msg=nom)

    def test_le_quotient_relie_une_composante_sans_ancre(self):
        corps, _ = corps_du_gabarit(self.peau, racine_et_jambe())
        table = {'racine': 'root', 'legs': ['leg'], 'arms': [], 'head': [], 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12}, 'arms': {'min': 1, 'max': 1.6},
                            'head': {'min': 1, 'max': 1.9}}}
        resultat = json.loads(lancer(Path(__file__).resolve().parent / 'base/gabarit.mjs', [],
                                    json.dumps({'table': table, 'corps': corps})))
        self.assertEqual(resultat['ancres'], 1)
        self.assertTrue(resultat['cles'])
        self.assertTrue(all(len(cle['deltas']) == 4 for cle in resultat['cles']))

    def test_la_reference_des_silhouettes_exclut_le_gabarit_et_garde_les_memes_poids(self):
        deltas = np.zeros((6, 3))
        deltas[[1, 3], 2] = .8
        poser_la_cle(self.peau, 'corpulence', deltas)
        co = positions(self.peau.data)
        gabarit = np.zeros((6, 3))
        gabarit[[2, 5], 2] = 1
        poser_la_cle(self.peau, 'gabarit_legs_moins', gabarit)
        attribut = self.peau.data.attributes.new(ATTRIBUT_SOMMET, 'INT', 'POINT')
        attribut.data.foreach_set('value', np.arange(6, dtype=np.int32))
        etat = {'nom': 'corpulence', 'pointCuisson': False, 'poidsSilhouettes': {'corpulence': 1},
                'poidsGabarit': {'gabarit_legs_moins': 1},
                'positions': (co + deltas + gabarit).tolist()}
        cles_avant = [cle.name for cle in self.peau.data.shape_keys.key_blocks]
        reference = preparer_reference([self.peau], [(0, 6, {'etats': [etat], 'sensCuits': 1})])
        cle = poser_la_cle(self.peau, 'attendu', deltas)
        attendu = vers_gltf(np.array(cle.normals_split_get()).reshape(-1, 3))
        self.peau.shape_key_remove(cle)
        np.testing.assert_allclose(reference['normales_silhouettes'][0], attendu)
        self.assertGreater(np.max(np.abs(reference['normales'][0] - attendu)), .1)
        self.assertEqual([cle.name for cle in self.peau.data.shape_keys.key_blocks], cles_avant)
        self.assertNotIn(ATTRIBUT_SOMMET, self.peau.data.attributes)

    def test_etats_et_poids_differents_entre_peaux_refusent(self):
        for champ, valeur in [('nom', 'autre'), ('poidsSilhouettes', {'corpulence': .5}),
                              ('poidsGabarit', {'libre': 1}), ('pointCuisson', True), ('sensCuits', 1)]:
            etat = {'nom': 'a', 'poidsSilhouettes': {}, 'poidsGabarit': {}, 'pointCuisson': False}
            autre = etat if champ == 'sensCuits' else {**etat, champ: valeur}
            with self.subTest(champ=champ), self.assertRaisesRegex(RuntimeError, 'états et poids différents'):
                preparer_reference([], [(0, 0, {'etats': [etat], 'sensCuits': 0}),
                                        (0, 0, {'etats': [autre], 'sensCuits': valeur if champ == 'sensCuits' else 0})])


if __name__ == '__main__':
    unittest.main()
