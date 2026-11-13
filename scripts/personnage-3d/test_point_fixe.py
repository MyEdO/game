"""#3104 issuecomment-6549354475 ; hotes/godot/pont/CONTRAT.md, « Gabarit d'une base » ; #3810."""
import contextlib
import io
import sys
import unittest
from pathlib import Path
from unittest import mock

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))
import humanoide  # noqa: E402
from point_fixe import ToursSansTour, atteindre_le_point_fixe, suite_de_phase  # noqa: E402
from cuisson_gabarit import etats_aux_facteurs_neutres  # noqa: E402


class Cuisson(Exception):
    """La construction entre en phase `gabarit` : le test s'arrête à sa cuisson."""


def doublures_de_la_construction(peau, journal):
    """Les modules de `humanoide.construire` en doublures : un seul défaut d'arête à la seconde mesure des moteurs."""
    def preparer_moteurs(*_, repos_cuit=False, **__):
        etat = {'hors': numpy.array([sum(e[0] == 'mesure' for e in journal) == 1]), 'retouches': set(), 'jumeau': None}
        journal.append(('mesure', bool(etat['hors'][0])))
        return [(peau, ['root'], etat)]

    def avancer_correction(correction):
        journal.append(('poids',))
        correction['hors'][:] = False
        correction['retouches'].add(0)

    def atteindre(construire_tour, passes_max, refuser, depuis=1):
        for passe in range(depuis, passes_max + 1):
            construire_tour(passe)

    nul = mock.MagicMock()
    return {
        'manifeste_mjs': nul, 'importer': mock.MagicMock(return_value=(nul, [], [])), 'resoudre_images': nul,
        'hierarchie': mock.MagicMock(return_value=['root']), 'meshes_for': mock.MagicMock(return_value=[peau]),
        'bas_des_sources': mock.MagicMock(return_value={}), 'fusionner': nul, 'ecarter': nul,
        'retirer_sans_sol': mock.MagicMock(return_value=[]), 'reperes_des_prises': nul,
        'deriver_a_deux_mains': mock.MagicMock(return_value=[]), 'poser_au_sol': nul, 'rigidifier_les_pieds': nul,
        'clips_plantes': mock.MagicMock(return_value=[]),
        'corps_et_secondaires': mock.MagicMock(return_value=(peau, [])), 'bornes_de_st': nul,
        'gabarit': mock.MagicMock(return_value={}), 'bornes_du_gabarit': nul, 'clear_animation': nul,
        'ajouter_feminin_et_carrure': nul, 'ajouter_corpulence': nul,
        'lire_os_des_silhouettes': mock.MagicMock(return_value={}),
        'etats_aux_facteurs_neutres': mock.MagicMock(side_effect=lambda *_: {'etats': []}),
        'etats_du_gabarit': mock.MagicMock(side_effect=lambda _, silhouettes: {'etats': [], 'silhouettes': silhouettes}),
        'silhouettes': mock.MagicMock(return_value=['silhouette']),
        'finir_les_silhouettes': mock.MagicMock(side_effect=lambda *_: journal.append(('finition',))),
        'poser_les_clips_au_sol': mock.MagicMock(side_effect=lambda *_: journal.append(('clips',))),
        'surfaces_des_pieds': nul, 'peau_lineaire': nul, 'deplacements': mock.MagicMock(return_value={}),
        'preparer_moteurs': mock.MagicMock(side_effect=preparer_moteurs),
        'avancer_correction': mock.MagicMock(side_effect=avancer_correction),
        'appliquer_correction': mock.MagicMock(return_value=[]), 'garder_les_poids_des_pieds': nul,
        'imprimer_correction': nul, 'cuire_gabarit': mock.MagicMock(side_effect=Cuisson), 'atteindre_le_point_fixe': atteindre,
        'imprimer_retournements': mock.MagicMock(side_effect=lambda *_: journal.append(('retournements',))),
        'faces_des_noeuds': nul, 'dossier_de_construction': nul,
        'Reprises': mock.MagicMock(return_value=mock.MagicMock(lire=mock.MagicMock(return_value=None))),
    }


def peau_de_test():
    peau = mock.MagicMock()
    peau.name = 'corps'
    return peau


class PhaseSilhouettes(unittest.TestCase):
    def test_un_defaut_en_clip_retouche_les_poids_regenere_les_silhouettes_puis_va_au_gabarit(self):
        journal = []
        doublures = doublures_de_la_construction(peau_de_test(), journal)
        sortie = io.StringIO()
        with mock.patch.multiple(humanoide, **doublures), mock.patch.dict(sys.modules, {'bpy': mock.MagicMock()}), \
                contextlib.redirect_stdout(sortie), self.assertRaises(Cuisson):
            humanoide.construire(mock.MagicMock(os=1))
        phases = [ligne.split()[1] for ligne in sortie.getvalue().splitlines()
                  if ligne.startswith('CONSTRUCTION_PHASE')]
        self.assertEqual(phases, ['neutre', 'silhouettes', 'silhouettes'])
        self.assertEqual(journal, [
            ('mesure', False),
            ('finition',), ('clips',), ('mesure', True), ('poids',), ('retournements',),
            ('finition',), ('clips',), ('mesure', False),
            ('clips',),
        ])
        self.assertEqual(doublures['cuire_gabarit'].call_count, 1)
        self.assertEqual([appel.args[0] for appel in doublures['Reprises'].return_value.ecrire.call_args_list],
                         ['passe-0001', 'passe-0002', 'passe-0003'], 'chaque passe écrit sa reprise')
        self.assertEqual([appel.args[1]['suites'] is None for appel in doublures['Reprises'].return_value.ecrire.call_args_list],
                         [True, True, True], 'une fin de phase ne porte pas la suite des corrections')
        self.assertEqual([appel.args[1] for appel in doublures['etats_aux_facteurs_neutres'].call_args_list][:2],
                         [[], ['silhouette']], 'la phase neutre reçoit le domaine sans silhouette, la phase silhouettes le sien')
        self.assertEqual([appel.args[4] for appel in doublures['finir_les_silhouettes'].call_args_list],
                         [{'etats': [], 'silhouettes': ['silhouette']}] * 2, 'la finition reçoit tout le domaine du gabarit')

    def test_une_entree_de_pied_refuse_avec_capture(self):
        journal = []
        doublures = doublures_de_la_construction(peau_de_test(), journal)
        doublures['garder_les_poids_des_pieds'] = mock.MagicMock(side_effect=RuntimeError('entrée de pied'))
        doublures['refuser_correction'] = mock.MagicMock(side_effect=Cuisson)
        with mock.patch.multiple(humanoide, **doublures), mock.patch.dict(sys.modules, {'bpy': mock.MagicMock()}), \
                contextlib.redirect_stdout(io.StringIO()), self.assertRaises(Cuisson):
            humanoide.construire(mock.MagicMock(os=1))
        self.assertEqual(doublures['refuser_correction'].call_count, 1)
        self.assertEqual(doublures['refuser_correction'].call_args.args[2], 'entrée de pied')
        self.assertEqual(doublures['cuire_gabarit'].call_count, 0)


def actions(*noms):
    """Des actions nommées `noms`, et la doublure de `bpy` qui note les actions retirées."""
    bpy = mock.MagicMock()
    rendues = []
    for nom in noms:
        action = mock.MagicMock()
        action.name = nom
        rendues.append(action)
    return bpy, rendues


class ClipsEcartes(unittest.TestCase):
    def test_les_clips_ecartes_s_effacent_avec_leur_trace(self):
        bpy, clips = actions('Idle_Loop', 'LayToIdle', 'Walk_Loop')
        sortie = io.StringIO()
        with contextlib.redirect_stdout(sortie):
            gardes = humanoide.ecarter(bpy, clips, ['LayToIdle'])
        self.assertEqual([a.name for a in gardes], ['Idle_Loop', 'Walk_Loop'])
        self.assertEqual([appel.args[0].name for appel in bpy.data.actions.remove.call_args_list], ['LayToIdle'])
        self.assertEqual(sortie.getvalue(), 'RETIRE LayToIdle : écarté par la déclaration du corps (clipsEcartes)\n')

    def test_sans_clip_ecarte_tout_reste(self):
        bpy, clips = actions('Idle_Loop', 'Walk_Loop')
        self.assertEqual(humanoide.ecarter(bpy, clips, []), clips)
        self.assertEqual(bpy.data.actions.remove.call_count, 0)

    def test_un_clip_ecarte_absent_des_packs_arrete_la_construction(self):
        bpy, clips = actions('Idle_Loop', 'Walk_Loop')
        with self.assertRaisesRegex(RuntimeError, r'^clipsEcartes : LayToIdle absent des packs fusionnés$'):
            humanoide.ecarter(bpy, clips, ['Idle_Loop', 'LayToIdle'])
        self.assertEqual(bpy.data.actions.remove.call_count, 0)


class PointFixeCommun(unittest.TestCase):
    def test_les_poids_et_les_cles_doivent_etre_stables_ensemble(self):
        appels = []
        restes = [{'sommets': 2, 'ecartCles': 0}, {'sommets': 0, 'ecartCles': 1}, {'sommets': 0, 'ecartCles': 0}]
        def construire(tour):
            appels.append(tour)
            return restes[tour - 1]
        self.assertEqual(atteindre_le_point_fixe(construire, 3, self.fail), 3)
        self.assertEqual(appels, [1, 2, 3])

    def test_la_borne_refuse_sans_executer_un_tour_de_plus(self):
        appels = []
        def construire(tour):
            appels.append(tour)
            return {'sommets': 1}
        refus = []
        with self.assertRaisesRegex(RuntimeError, 'point fixe absent après 2 passes'):
            atteindre_le_point_fixe(construire, 2, lambda passe, reste: refus.append((passe, reste)))
        self.assertEqual(appels, [1, 2])
        self.assertEqual(refus, [(2, {'sommets': 1})])

    def test_la_preparation_et_la_verification_finale_partagent_la_borne(self):
        phase = 'neutre'
        visites, regenerations = [], []
        mesures = [(2, 0), (3, 0), (0, 0), (2, .1), (0, 0), (0, .1), (0, 0)]
        def construire(passe):
            nonlocal phase
            visites.append(phase)
            phase, regenerer, fini = suite_de_phase(phase, *mesures[passe - 1], tolerance=.001)
            if regenerer:
                regenerations.append(passe)
            return {'phase': int(not fini)}
        self.assertEqual(atteindre_le_point_fixe(construire, 7, self.fail), 7)
        self.assertEqual(visites, ['neutre', 'silhouettes', 'silhouettes', 'gabarit', 'silhouettes', 'gabarit', 'gabarit'])
        self.assertEqual(regenerations, [2, 4])

    def test_les_phases_neutre_et_silhouettes_recoivent_les_etats_aux_facteurs_neutres_sans_cuire(self):
        table = {'racine': 'root', 'legs': ['leg'], 'arms': [], 'head': [],
                 'st': {'min': .72, 'max': 1.7},
                 'bornes': {'legs': {'min': .62, 'max': 1.12},
                            'arms': {'min': 1, 'max': 1.6}, 'head': {'min': 1, 'max': 1.9}}}
        par_nom = {e['nom']: e for e in etats_aux_facteurs_neutres(table, ['corpulence'])['etats']}
        self.assertEqual(set(par_nom), {'neutre', 'corpulence'})
        for nom, poids in [('neutre', 0), ('corpulence', 1)]:
            self.assertEqual(par_nom[nom]['poidsSilhouettes'], {'corpulence': poids})
            self.assertFalse(any(par_nom[nom]['poidsGabarit'].values()))
            self.assertFalse(par_nom[nom]['pointCuisson'])
        self.assertEqual([e['nom'] for e in etats_aux_facteurs_neutres(table, [])['etats']], ['neutre'])

    def test_une_borne_sans_tour_est_refusee(self):
        with self.assertRaises(ToursSansTour):
            atteindre_le_point_fixe(lambda _: self.fail(), 0, self.fail)
        with self.assertRaises(ToursSansTour):
            atteindre_le_point_fixe(lambda _: self.fail(), 4, self.fail, depuis=5)

    def test_une_reprise_continue_au_numero_de_passe_suivant(self):
        passes = []

        def construire(passe):
            passes.append(passe)
            return {'aretes': 0 if passe == 6 else 1}
        self.assertEqual(atteindre_le_point_fixe(construire, 9, self.fail, depuis=4), 6)
        self.assertEqual(passes, [4, 5, 6])


if __name__ == '__main__':
    unittest.main()
