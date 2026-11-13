"""silhouettes.correction sur un cylindre synthétique, contre une résolution KKT directe du même problème, et ses
erreurs nommées ; silhouettes.raboter_sous_correction, rabot mesuré sur les clés corrigées jusqu'aux bornes
d'étirement, du repère du mesh au repère monde et retour ; formes.raboter, rabot des clés marquées à leur force et sa
pente ; silhouettes.parts_des_fautes, part de chaque nom aux sites en faute ; silhouettes.mesurer_domaine,
mesure incrémentale égale à la porte de construction ; silhouettes.fondu, une part par nœud ; silhouette à os et socle
du rabot (#4002 issuecomment-6826035694)."""
import contextlib
import io
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import silhouettes  # noqa: E402
import humanoide  # noqa: E402
from formes import PENTE_DU_RABOT, RABOT, STAGNATION_M, aux_noeuds, raboter, rapports, region_locale, retournees_par  # noqa: E402
import noms_silhouettes  # noqa: E402
from pas_des_poids import melanges_par_lots, minimum_du_carre  # noqa: E402
from poids import PASSES_MAX, GroupePondere, decouper_trace, etats_ponderes, extremes, integrer_trace, preparer_correction, verifier_repos_cuit  # noqa: E402
from seuils import ETIREMENT_DES_CLES, MAJORITE_DU_POIDS, SOL_TOLERANCE_M  # noqa: E402
from silhouettes import (AnneauIndetectable, ComposanteSansAppui, ContraintesLiees, correction, fondu,  # noqa: E402
                         mesurer_domaine, par_nom, raboter_sous_correction, refuser_les_inertes)
from cuisson_gabarit import etats_aux_facteurs_neutres, etats_du_gabarit  # noqa: E402

SECTEURS, NIVEAUX = 12, 14
NIVEAUX_DES_ANNEAUX = (2, 4, 6, 9, 11)
TOLERANCE = 1e-10
HAUTEUR = 0.1 * (NIVEAUX - 1)


def hors_de(r, bornes):
    return (r < bornes[0]) | (r > bornes[1])


def un_site_par_nom(masques):
    """La mesure `(fautes, parts)` d'un site par nom de `masques` (nom -> booléen par arête) : le site du nom en faute
    aux arêtes de son masque, où il a la part 1 et les autres noms la part 0."""
    fautes = numpy.stack(list(masques.values()))
    parts = {nom: numpy.zeros(fautes.shape) for nom in masques}
    for i, nom in enumerate(masques):
        parts[nom][i] = fautes[i]
    return fautes, parts


def rotation():
    """Une matrice 3×3 de rotation hors de l'axe du cylindre, à droite d'un champ : repère du mesh vers repère monde."""
    a, b = 0.7, 0.4
    autour_de_x = numpy.array([[1, 0, 0], [0, numpy.cos(a), -numpy.sin(a)], [0, numpy.sin(a), numpy.cos(a)]])
    autour_de_z = numpy.array([[numpy.cos(b), -numpy.sin(b), 0], [numpy.sin(b), numpy.cos(b), 0], [0, 0, 1]])
    return autour_de_x @ autour_de_z


def cylindre():
    """Un cylindre de `NIVEAUX` cercles de `SECTEURS` sommets, chaque cercle fermé par un sommet jumeau du premier :
    sommets, nœud de chaque sommet (`poids.jumeaux`), arêtes entre nœuds (`formes.aretes_des_triangles`)."""
    rayons = 0.1 + 0.05 * numpy.sin(numpy.arange(NIVEAUX) / 2.0)
    x, noeud = [], []
    for niveau in range(NIVEAUX):
        base = len(x)
        for k in range(SECTEURS + 1):
            angle = 2 * numpy.pi * (k % SECTEURS) / SECTEURS
            x.append([rayons[niveau] * numpy.cos(angle), rayons[niveau] * numpy.sin(angle), 0.1 * niveau])
            noeud.append(base + k % SECTEURS)
    x, noeud = numpy.array(x), numpy.array(noeud)
    triangles = []
    for niveau in range(NIVEAUX - 1):
        for k in range(SECTEURS):
            a, b = niveau * (SECTEURS + 1) + k, niveau * (SECTEURS + 1) + k + 1
            triangles += [(a, b, a + SECTEURS + 1), (b, b + SECTEURS + 1, a + SECTEURS + 1)]
    triangles = noeud[numpy.array(triangles)]
    aretes = numpy.unique(numpy.sort(triangles[:, [0, 1, 1, 2, 2, 0]].reshape(-1, 2), axis=1), axis=0)
    return x, noeud, aretes[aretes[:, 0] != aretes[:, 1]]


def sommets_du_niveau(niveau):
    return list(range(niveau * (SECTEURS + 1), (niveau + 1) * (SECTEURS + 1)))


def anneau(x, niveau, sommets=None, os=None):
    """L'anneau des sommets `sommets` (par défaut le cercle `niveau`), à la forme de `silhouettes.anneaux`."""
    s = sommets_du_niveau(niveau) if sommets is None else sommets
    centre, axe = x[s].mean(axis=0), numpy.array([0.0, 0.0, 1.0])
    radial = x[s] - centre
    radial -= (radial @ axe)[:, None] * axe
    return {'os': os or f'niveau_{niveau}', 'sommets': [{'mesh': 'Corps', 'indice': i} for i in s],
            'centre': centre.tolist(), 'rayon': float(numpy.linalg.norm(radial, axis=1).mean()), 'axe': axe.tolist()}


def anneaux(x, niveaux):
    return {'anneaux': [anneau(x, niveau) for niveau in niveaux]}


def kkt(x, aretes, noeud, fixe, lus, d0):
    """Le même problème que `correction`, posé sommet par sommet et résolu par son système KKT entier, sa source la
    moyenne de `d0` sur les sommets de chaque nœud."""
    nv = len(x)
    d0 = numpy.array([d0[noeud == noeud[v]].mean(axis=0) for v in range(nv)])
    taille = 3 * nv
    differences = []
    for i, j in aretes:
        for c in range(3):
            ligne = numpy.zeros(taille)
            inverse_longueur = 1 / numpy.linalg.norm(x[i] - x[j])
            ligne[c * nv + i], ligne[c * nv + j] = inverse_longueur, -inverse_longueur
            differences.append(ligne)
    differences = numpy.array(differences)
    hessienne = 2 * differences.T @ differences
    hessienne /= numpy.diag(hessienne).max()
    gradient = hessienne @ d0.T.ravel()
    lignes, cibles = [], []

    def somme_nulle(indices):
        for c in range(3):
            ligne = numpy.zeros(taille)
            ligne[[c * nv + i for i in indices]] = 1
            lignes.append(ligne)
            cibles.append(0.0)

    for v in range(nv):
        if noeud[v] != v:
            for c in range(3):
                ligne = numpy.zeros(taille)
                ligne[c * nv + v], ligne[c * nv + noeud[v]] = 1, -1
                lignes.append(ligne)
                cibles.append(0.0)
    for v in numpy.flatnonzero(fixe):
        somme_nulle([v])
    for a in lus['anneaux']:
        somme_nulle([v['indice'] for v in a['sommets']])
    lignes = numpy.array(lignes)
    systeme = numpy.block([[hessienne, lignes.T], [lignes, numpy.zeros((len(lignes), len(lignes)))]])
    solution = numpy.linalg.lstsq(systeme, numpy.concatenate([gradient, cibles]), rcond=None)[0]
    return solution[:taille].reshape(3, nv).T


class Correction(unittest.TestCase):
    def setUp(self):
        self.x, self.noeud, self.aretes = cylindre()
        self.fixe = (self.x[:, 2] < 0.05) | (self.x[:, 2] > HAUTEUR - 0.05)
        self.rng = numpy.random.default_rng(3101)

    def lisse(self):
        frequences = self.rng.uniform(1, 4, (3, 2))
        return numpy.stack([numpy.sin(self.x[:, 2] * f + p) for f, p in frequences], axis=1) * 0.02

    def cle(self):
        """Un champ de clé tel que `finir_les_silhouettes` le passe : nul aux sommets fixes, égal entre jumeaux."""
        d0 = self.lisse() + 0.01 * self.rng.standard_normal(self.x.shape)
        d0[self.fixe] = 0
        return d0[self.noeud]

    def assert_comme_kkt(self, lus, champs, fixe=None):
        fixe = self.fixe if fixe is None else fixe
        corriges, sonde = correction(self.x, self.aretes, self.noeud, fixe, lus)(champs)
        self.assertEqual(set(sonde), {'noeuds_libres', 'contraintes', 'resolution_s'})
        for d0, d in zip(champs, corriges):
            self.assertLess(numpy.abs(d - kkt(self.x, self.aretes, self.noeud, fixe, lus, d0)).max(), TOLERANCE)

    def assert_liees(self, fixe, lus, champs, attendues):
        with self.assertRaises(ContraintesLiees) as leve:
            correction(self.x, self.aretes, self.noeud, fixe, lus)(champs)
        self.assertIsInstance(leve.exception, AnneauIndetectable)
        self.assertEqual(str(leve.exception).split(' : ')[1], ', '.join(attendues))

    def test_reutilise_le_laplacien_prepare_pour_chaque_resolution(self):
        with mock.patch.object(silhouettes, 'lancer', wraps=silhouettes.lancer) as lancer:
            corriger = correction(self.x, self.aretes, self.noeud, self.fixe, anneaux(self.x, NIVEAUX_DES_ANNEAUX))
            for _ in range(2):
                (champ,), _ = corriger([self.cle()])
                self.assertEqual(champ.shape, self.x.shape)
                self.assertTrue(numpy.isfinite(champ).all())
        preparation, *resolutions = [json.loads(appel.args[2]) for appel in lancer.call_args_list]
        self.assertEqual(set(preparation), {'fixes', 'aretes', 'positions', 'aretesNeutres'})
        numpy.testing.assert_array_equal(preparation['positions'], self.x)
        numpy.testing.assert_array_equal(preparation['aretesNeutres'], self.aretes)
        self.assertEqual(len(resolutions), 2)
        for resolution in resolutions:
            self.assertEqual(set(resolution), {'laplacien', 'seconds'})
        self.assertEqual(resolutions[0]['laplacien'], resolutions[1]['laplacien'])

    def test_egale_la_resolution_kkt_directe(self):
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX),
                              [self.cle(), self.cle(), self.cle()])

    def test_des_poids_un_rendent_la_correction_sans_poids(self):
        corriger = correction(self.x, self.aretes, self.noeud, self.fixe, anneaux(self.x, NIVEAUX_DES_ANNEAUX))
        champs = [self.cle(), self.cle()]
        sans, _ = corriger(champs)
        avec, _ = corriger(champs, [numpy.ones(len(self.x)), None])
        for a, b in zip(sans, avec):
            self.assertLess(numpy.abs(a - b).max(), TOLERANCE)

    def test_la_somme_sur_chaque_anneau_tenu_est_nulle_et_les_poids_epargnent_les_noeuds_de_poids_faible(self):
        """La part imposée, l'écart à la correction sans anneau, va aux nœuds de poids un : la moitié x > 0 de poids
        1e-3 en reçoit peu."""
        lus = anneaux(self.x, NIVEAUX_DES_ANNEAUX)
        corriger = correction(self.x, self.aretes, self.noeud, self.fixe, lus)
        d0 = self.cle()
        (libre,), _ = correction(self.x, self.aretes, self.noeud, self.fixe, {'anneaux': []})([d0])
        faibles = self.x[:, 0] > 0
        (sans,), _ = corriger([d0])
        (avec,), _ = corriger([d0], [numpy.where(faibles, 1e-3, 1.0)])
        for anneau in lus['anneaux']:
            s = numpy.array([v['indice'] for v in anneau['sommets']])
            self.assertGreater(numpy.abs(libre[s].sum(axis=0)).max(), 1e-3, anneau['os'])
            for d in (sans, avec):
                self.assertLess(numpy.abs(d[s].sum(axis=0)).max(), TOLERANCE, anneau['os'])
        self.assertLess(numpy.abs(avec - libre)[faibles].max(), 0.01 * numpy.abs(sans - libre)[faibles].max())

    def test_moyenne_aux_noeuds_une_source_non_nulle_aux_fixes_et_discordante_entre_jumeaux(self):
        d0 = self.lisse() + 0.01 * self.rng.standard_normal(self.x.shape)
        jumeaux = numpy.flatnonzero(self.noeud != numpy.arange(len(self.x)))
        self.assertGreater(numpy.abs(d0[jumeaux] - d0[self.noeud[jumeaux]]).min(), 0.0)
        self.assertGreater(numpy.abs(d0[self.fixe]).min(), 0.0)
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX), [d0])

    def test_un_anneau_tout_fixe_ne_porte_aucune_contrainte(self):
        self.assert_comme_kkt(anneaux(self.x, (0, *NIVEAUX_DES_ANNEAUX)), [self.cle()])

    def test_un_corps_sans_noeud_libre_rend_un_champ_nul(self):
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX), [self.cle()], fixe=numpy.ones(len(self.x), dtype=bool))

    def test_un_anneau_d_un_seul_noeud_libre_se_tient(self):
        fixe = self.fixe.copy()
        s = sommets_du_niveau(6)
        fixe[s] = True
        fixe[s[3]] = False
        self.assert_comme_kkt(anneaux(self.x, (4, 6, 9)), [self.cle()], fixe=fixe)

    def test_deux_anneaux_dont_la_part_libre_est_le_meme_noeud_levent_contraintes_liees(self):
        fixe = self.fixe.copy()
        s = sommets_du_niveau(6)
        fixe[s] = True
        fixe[[s[0], s[-1]]] = False
        lus = {'anneaux': [anneau(self.x, 9), anneau(self.x, 6, s[0:3], 'A'), anneau(self.x, 6, [s[-1], *s[3:5]], 'B')]}
        self.assert_liees(fixe, lus, [self.cle()], ['A centre', 'B centre'])

    def test_une_composante_libre_sans_arete_vers_un_noeud_fixe_leve_composante_sans_appui(self):
        with self.assertRaises(ComposanteSansAppui) as leve:
            correction(self.x, self.aretes, self.noeud, numpy.zeros(len(self.x), dtype=bool),
                       anneaux(self.x, NIVEAUX_DES_ANNEAUX))
        self.assertIsInstance(leve.exception, AnneauIndetectable)
        self.assertIn(f'{NIVEAUX * SECTEURS} nœud(s) libre(s) du sommet 0', str(leve.exception))


class LissageSousCorrection(unittest.TestCase):
    """Un cylindre aux bouts invariants et aux deux cercles suivants en fondu. Les tests de repère et de refus
    utilisent la vraie correction ; le test de la mesure, un correcteur bouchon qui annule la moitié basse."""
    BORNES = (0.5, 2.0)

    def setUp(self):
        self.x, self.noeud, self.aretes = cylindre()
        z = self.x[:, 2]
        self.libre = numpy.clip((numpy.minimum(z, HAUTEUR - z) - 0.05) / 0.2, 0.0, 1.0)
        self.vus = []
        self.correction = correction(self.x, self.aretes, self.noeud, self.libre == 0,
                                     anneaux(self.x, NIVEAUX_DES_ANNEAUX))

        def corriger_et_noter(champs, repartitions=None):
            corriges, sonde = self.correction(champs, repartitions)
            self.vus.append((list(champs), corriges))
            return corriges, sonde

        self.corriger = corriger_et_noter

    def translation(self):
        brut = numpy.zeros_like(self.x)
        brut[:, 0] = 0.1
        brut[:, 1] = 0.1 * numpy.sin(5 * self.x[:, 2])
        return brut

    def finir(self, bruts, bornes=BORNES, vers_le_monde=None, rabot=None):
        """Les champs finis de `raboter_sous_correction` sur les clés `bruts` au repère du mesh, repos `self.x` porté
        dans ce repère par l'inverse de `vers_le_monde` (par défaut l'identité), depuis le rabot cumulé `rabot`."""
        return self.finir_et_raboter(bruts, bornes, vers_le_monde, rabot)[0]

    def finir_et_raboter(self, bruts, bornes=BORNES, vers_le_monde=None, rabot=None):
        vers_le_monde = numpy.eye(3) if vers_le_monde is None else vers_le_monde
        repos = self.x @ numpy.linalg.inv(vers_le_monde)
        return self.raboter(bruts, lambda champs: un_site_par_nom({nom: hors_de(rapports(repos, d, self.aretes), bornes)
                                                                   for nom, d in champs.items()}),
                            vers_le_monde, rabot)

    def raboter(self, bruts, hors, vers_le_monde=None, rabot=None, portes=None):
        with contextlib.redirect_stdout(io.StringIO()):
            return raboter_sous_correction(bruts, self.noeud, self.aretes, self.libre, self.corriger,
                                           numpy.eye(3) if vers_le_monde is None else vers_le_monde, hors, rabot,
                                           portes)

    def porte(self):
        """Une silhouette à os sur le cylindre : les sommets tenus (`libre` nul) tout à un os rigide de déplacement
        `RIGIDE`, le portage C ailleurs une rampe le long de l'axe. Rend T = C + H et C."""
        c = numpy.where((self.libre == 0)[:, None], self.RIGIDE, 0.04 * numpy.outer(self.x[:, 2], [1.0, 0.5, 0.0]))
        return c + self.translation(), c

    RIGIDE = numpy.array([0.03, -0.02, 0.01])

    def deux_os(self):
        """Deux os sur le cylindre, l'enfant (moitié haute) déplacé de `D` sous un parent immobile : C rigide par os.
        Rend T = C + H et C."""
        c = numpy.where((self.x[:, 2] > HAUTEUR / 2)[:, None], self.D, 0.0)
        return c + self.translation(), c

    D = numpy.array([0.05, -0.03, 0.02])

    def arete_libre(self, niveau):
        """L'arête du cercle `niveau` entre ses deux premiers secteurs, ses deux nœuds de `libre` un."""
        s = sommets_du_niveau(niveau)
        arete = numpy.flatnonzero((self.aretes == sorted(self.noeud[s[:2]])).all(axis=1))[0]
        self.assertEqual(self.libre[self.aretes[arete]].min(), 1.0)
        return arete

    def test_un_nom_porte_rend_le_fondu_de_son_portage_sans_correction_ni_rabot(self):
        """#4002 issuecomment-6826035694 : `hors` marque toutes ses arêtes à chaque mesure."""
        t, c = self.porte()
        tenus = self.libre == 0
        self.assertTrue(tenus.any())
        bruts = {'k': t, 'r': self.translation()}
        partout = numpy.ones(len(self.aretes), dtype=bool)
        finis, rabot = self.raboter(bruts, lambda champs: un_site_par_nom({
            'k': partout, 'r': hors_de(rapports(self.x, champs['r'], self.aretes), self.BORNES)}), portes={'k': c})
        self.assertEqual(list(finis), ['k', 'r'])
        self.assertEqual(list(rabot), ['r'])
        numpy.testing.assert_allclose(finis['k'], c + self.libre[:, None] * (t - c), rtol=0, atol=1e-12)
        numpy.testing.assert_array_equal(finis['k'][tenus], numpy.tile(self.RIGIDE, (tenus.sum(), 1)))
        self.assertTrue(self.vus)
        for champs, _ in self.vus:
            self.assertEqual(len(champs), 1)
            numpy.testing.assert_array_equal(champs[0][tenus], 0.0)

    def test_une_arete_en_defaut_sans_la_cle_rabotee_ne_la_rabote_pas(self):
        """#4002 issuecomment-6826035694 : l'arête marquée pour `r` dès que le champ porté de `k` y est non nul."""
        t, c = self.deux_os()
        socle = self.arete_libre(4)
        brut = self.translation()

        def hors(champs):
            marque = numpy.zeros(len(self.aretes), dtype=bool)
            marque[socle] = bool(numpy.abs(champs['k'][self.aretes[socle]]).max() > 0)
            return un_site_par_nom({'k': numpy.zeros(len(self.aretes), dtype=bool), 'r': marque})

        with mock.patch.object(silhouettes, 'PASSES_DE_RABOT', 10):
            finis, rabot = self.raboter({'k': t, 'r': brut}, hors, portes={'k': c})
        numpy.testing.assert_array_equal(rabot['r'], 1.0)
        (attendu,), _ = self.correction([self.libre[:, None] * brut])
        numpy.testing.assert_allclose(finis['r'], attendu, rtol=0, atol=1e-9)

    def test_une_arete_en_defaut_par_la_cle_rabotee_se_rabote_hors_du_socle(self):
        """#4002 issuecomment-6826035694 : l'arête `defaut`, marquée pour `r`, un champ radial, tant que son champ y
        dépasse `seuil`."""
        t, c = self.deux_os()
        socle, defaut = self.arete_libre(4), self.arete_libre(9)
        seuil = 0.02

        def hors(champs):
            marque = numpy.zeros(len(self.aretes), dtype=bool)
            marque[socle] = bool(numpy.abs(champs['k'][self.aretes[socle]]).max() > 0)
            marque[defaut] = bool(numpy.linalg.norm(champs['r'][self.aretes[defaut]], axis=1).max() > seuil)
            return un_site_par_nom({'k': numpy.zeros(len(self.aretes), dtype=bool), 'r': marque})

        with mock.patch.object(silhouettes, 'PASSES_DE_RABOT', 80):
            finis, rabot = self.raboter({'k': t, 'r': self.x * [1.0, 1.0, 0.0]}, hors, portes={'k': c})
        self.assertLess(rabot['r'][self.aretes[defaut]].max(), 1.0)
        self.assertLessEqual(numpy.linalg.norm(finis['r'][self.aretes[defaut]], axis=1).max(), seuil)
        numpy.testing.assert_array_equal(rabot['r'][numpy.isin(self.noeud, self.aretes[socle])], 1.0)

    def test_une_faute_de_site_a_champ_nul_reste_au_socle_quand_le_nom_y_a_une_part(self):
        """#4002 : le site A, en faute à l'arête `a` quels que soient les champs, n'y donne une part à `r` que quand le
        champ de `r` y est non nul ; le site B, en faute à l'arête `b` tant que le champ radial de `r` y dépasse `seuil`,
        lui donne toujours la part 1."""
        a, b = self.arete_libre(4), self.arete_libre(9)
        seuil = 0.02

        def hors(avec_a):
            def mesurer(champs):
                fautes = numpy.zeros((2, len(self.aretes)), dtype=bool)
                parts = numpy.zeros(fautes.shape)
                fautes[0, a] = avec_a
                parts[0, a] = avec_a and bool(numpy.abs(champs['r'][self.aretes[a]]).max() > 0)
                fautes[1, b] = bool(numpy.linalg.norm(champs['r'][self.aretes[b]], axis=1).max() > seuil)
                parts[1, b] = fautes[1, b]
                return fautes, {'r': parts}
            return mesurer

        finis = {}
        passes = {}
        for avec_a in (True, False):
            self.vus = []
            with mock.patch.object(silhouettes, 'PASSES_DE_RABOT', 80):
                finis[avec_a], _ = self.raboter({'r': self.x * [1.0, 1.0, 0.0]}, hors(avec_a))
            passes[avec_a] = len(self.vus)
        self.assertGreater(numpy.abs(finis[True]['r'][self.aretes[a]]).max(), 0)
        self.assertEqual(passes[True], passes[False])
        numpy.testing.assert_array_equal(finis[True]['r'], finis[False]['r'])
        self.assertLessEqual(numpy.linalg.norm(finis[True]['r'][self.aretes[b]], axis=1).max(), seuil)

    def test_sans_nom_a_raboter_ni_correction_ni_mesure(self):
        """#4002 issuecomment-6826035694."""
        t, c = self.porte()
        u, d = self.deux_os()

        def hors(_):
            raise AssertionError('hors appelé')

        def corriger(*_):
            raise AssertionError('corriger appelé')

        self.corriger = corriger
        finis, rabot = self.raboter({'k': t, 'j': u}, hors, portes={'j': d, 'k': c})
        self.assertEqual(list(finis), ['k', 'j'])
        self.assertEqual(rabot, {})
        numpy.testing.assert_allclose(finis['k'], c + self.libre[:, None] * (t - c), rtol=0, atol=1e-12)
        numpy.testing.assert_allclose(finis['j'], d + self.libre[:, None] * (u - d), rtol=0, atol=1e-12)

    def hors(self, champ, bornes=BORNES):
        return int(hors_de(rapports(self.x, champ, self.aretes), bornes).sum())

    def test_le_champ_rendu_est_la_correction_du_dernier_rabot_et_tient_les_bornes(self):
        fini = self.finir({'k': self.translation()})['k']
        _, (corrige,) = self.vus[-1]
        self.assertTrue(numpy.array_equal(fini, corrige))
        self.assertEqual(self.hors(fini), 0)
        self.assertEqual(numpy.abs(fini[self.libre == 0]).max(), 0.0)

    def test_le_tour_suivant_repart_du_rabot_cumule_et_ne_rabote_plus_les_memes_cles(self):
        brut = numpy.zeros_like(self.x)
        brut[:, 1] = 0.3 * numpy.sin(25 * self.x[:, 2])
        bruts = {'k': brut}
        fini, rabot = self.finir_et_raboter(bruts)
        self.assertLess(rabot['k'].min(), 1.0)
        vus = len(self.vus)
        repris, rabot_repris = self.finir_et_raboter(bruts, rabot=rabot)
        self.assertEqual(len(self.vus), vus + 1)
        self.assertLess(numpy.abs(repris['k'] - fini['k']).max(), TOLERANCE)
        numpy.testing.assert_array_equal(rabot_repris['k'], rabot['k'])

    def test_le_rabot_se_mesure_sur_le_champ_corrige(self):
        """Un correcteur bouchon qui annule la moitié basse : la bosse qu'il efface ne se rabote pas."""
        bas = self.x[:, 2] < HAUTEUR / 2

        def projeter(champs, repartitions=None):
            self.vus.append([d.copy() for d in champs])
            return [numpy.where(bas[:, None], 0.0, d) for d in champs], {'bouchon': 'projette'}

        self.corriger = projeter
        brut = numpy.zeros_like(self.x)
        brut[:, 1] = numpy.where(bas, 0.3 * numpy.sin(15 * self.x[:, 2]), 0.01)
        self.assertGreater(self.hors(brut * self.libre[:, None]), 0)
        fini = self.finir({'k': brut})['k']
        self.assertTrue(numpy.array_equal(fini, numpy.where(bas[:, None], 0.0, brut * self.libre[:, None])))
        self.assertEqual(len(self.vus), 1)

    def test_un_defaut_que_le_rabot_ne_guerit_pas_leve_au_bout_des_passes(self):
        """`hors` marque toute arête de la zone libre où le champ est non nul : aucun rabot ne l'annule."""
        dans = (self.libre[self.aretes] == 1.0).all(axis=1)

        def hors(champs):
            return un_site_par_nom({nom: dans & (numpy.abs(d[self.aretes]).max(axis=(1, 2)) > 0)
                                    for nom, d in champs.items()})

        with mock.patch.object(silhouettes, 'PASSES_DE_RABOT', 4), self.assertRaises(RuntimeError) as leve:
            self.raboter({'k': self.translation()}, hors)
        self.assertRegex(str(leve.exception), r'^[1-9]\d* arête\(s\) hors bornes après 4 passes de rabot$')

    def test_la_correction_se_fait_au_repere_monde_et_le_champ_revient_au_repere_du_mesh(self):
        """Les mêmes clés, au repère monde sous l'identité, et au repère d'un mesh tourné : le champ rendu au repère du
        mesh, porté au monde, est celui du monde."""
        radial = self.x * [1.0, 1.0, 0.0]
        au_monde = {'t': self.translation(), 'c': 0.2 * radial}
        attendus = self.finir(au_monde)
        vers_le_monde = rotation()
        vers_le_mesh = numpy.linalg.inv(vers_le_monde)
        rendus = self.finir({nom: d @ vers_le_mesh for nom, d in au_monde.items()}, vers_le_monde=vers_le_monde)
        for nom, attendu in attendus.items():
            self.assertGreater(numpy.abs(attendu @ vers_le_mesh - attendu).max(), 1e-2, nom)
            self.assertLess(numpy.abs(rendus[nom] @ vers_le_monde - attendu).max(), 1e-9, nom)


class Retournement(unittest.TestCase):
    """formes.retournees_par : une clé qui croise deux sommets retourne leur arête, longueur dans les bornes ou non."""

    def test_une_arete_croisee_a_longueur_egale_est_retournee_et_ses_voisines_non(self):
        x = numpy.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [2.0, 0.0, 0.0]])
        aretes = numpy.array([[0, 1], [1, 2]])
        champ = numpy.array([[1.0, 0.0, 0.0], [-1.0, 0.0, 0.0], [0.0, 0.0, 0.0]])
        self.assertEqual(rapports(x, champ, aretes).tolist(), [1.0, 2.0])
        self.assertEqual(retournees_par(x, champ, aretes).tolist(), [True, False])

    def test_une_arete_ecrasee_en_un_point_est_retournee(self):
        x = numpy.array([[0.0, 0.0, 0.0], [1.0, 0.0, 0.0]])
        self.assertTrue(retournees_par(x, numpy.array([[0.5, 0.0, 0.0], [-0.5, 0.0, 0.0]]), numpy.array([[0, 1]]))[0])


class Rabot(unittest.TestCase):
    """formes.raboter sur le cylindre : une bosse tangente sur un seul nœud du niveau 7 sort ses arêtes de `BORNES`."""
    BORNES = (0.7, 1.4)
    BOSSE = 7 * (SECTEURS + 1)

    def setUp(self):
        self.x, self.noeud, self.aretes = cylindre()
        self.facteur = numpy.ones(len(self.x))
        self.bosse = numpy.zeros_like(self.x)
        self.bosse[self.BOSSE] = [0.0, 0.15, 0.0]
        self.vus = []

    def hors(self, champ):
        masque = hors_de(rapports(self.x, champ, self.aretes), self.BORNES)
        self.vus.append(masque)
        return masque

    def raboter(self, champ, facteur=None, hors=None):
        mesure = hors or self.hors
        resultat, passes, _ = raboter(champ[:, None], self.noeud, self.aretes,
                                      self.facteur if facteur is None else facteur,
                                      lambda pile, _: (pile, mesure(pile[:, 0])[:, None]), PASSES_MAX)
        return resultat[:, 0], passes

    def test_une_arete_hors_bornes_aux_deux_extremites_tenues_leve(self):
        facteur = numpy.ones(len(self.x))
        tenue = self.aretes[0]
        facteur[numpy.isin(self.noeud, tenue)] = 0.0
        marque = numpy.zeros(len(self.aretes), dtype=bool)
        marque[0] = True
        with self.assertRaises(RuntimeError) as leve:
            self.raboter(self.bosse, facteur, lambda _: marque)
        self.assertRegex(str(leve.exception), r'^1 arête\(s\) hors bornes aux deux extrémités tenues')

    def test_une_passe_rabote_les_noeuds_des_aretes_marquees_et_leur_pente_seulement(self):
        """#4002 : `RABOT` aux nœuds de l'arête marquée, `RABOT ** (1 − r / (PENTE_DU_RABOT + 1))` à r anneaux."""
        champ = 0.03 * numpy.random.default_rng(3101).standard_normal(self.x.shape)
        marque = numpy.zeros(len(self.aretes), dtype=bool)
        marque[0] = True
        mesures = iter([marque, numpy.zeros_like(marque)])
        resultat, passes = self.raboter(champ, hors=lambda _: next(mesures))
        self.assertEqual(passes, 1)
        valeur = aux_noeuds(champ, self.noeud)
        attendu = valeur.copy()
        vus = numpy.zeros(len(valeur), dtype=bool)
        for r in range(PENTE_DU_RABOT + 1):
            anneau = region_locale(self.aretes, marque, r, len(valeur)) & ~vus
            attendu[anneau] = RABOT ** (1 - r / (PENTE_DU_RABOT + 1)) * valeur[anneau]
            vus |= anneau
        numpy.testing.assert_allclose(resultat, attendu[self.noeud], rtol=1e-12, atol=0)
        self.assertGreater(int((~vus[self.noeud]).sum()), len(self.x) // 2)

    def test_la_region_gagne_un_anneau_quand_la_cle_y_stagne(self):
        marque = numpy.zeros(len(self.aretes), dtype=bool)
        marque[0] = True
        premier = region_locale(self.aretes, marque, 0, len(self.x))
        second = region_locale(self.aretes, marque, 1, len(self.x)) & ~premier
        voisin = numpy.flatnonzero(second)[0]
        loin = numpy.flatnonzero(region_locale(self.aretes, marque, 2, len(self.x)) & ~second & ~premier)[0]
        champ = numpy.zeros_like(self.x)
        champ[self.noeud == voisin] = [0.0, 0.0, 10 * STAGNATION_M]
        champ[self.noeud == loin] = [0.0, 0.0, 10 * STAGNATION_M]
        mesures = iter([marque, marque, numpy.zeros_like(marque)])
        resultat, passes = self.raboter(champ, hors=lambda _: next(mesures))
        self.assertEqual(passes, 2)
        pente = 1 / (PENTE_DU_RABOT + 1)
        self.assertTrue(numpy.allclose(resultat[self.noeud == voisin], RABOT ** (2 - pente) * champ[self.noeud == voisin]))
        self.assertTrue(numpy.allclose(resultat[self.noeud == loin], RABOT ** (2 - 3 * pente) * champ[self.noeud == loin]))

    def test_la_region_gagne_un_anneau_quand_la_mesure_rend_aux_noeuds_ce_que_la_passe_leur_ote(self):
        marque = numpy.zeros(len(self.aretes), dtype=bool)
        marque[0] = True
        premier = region_locale(self.aretes, marque, 0, len(self.x))
        voisin = numpy.flatnonzero(region_locale(self.aretes, marque, 1, len(self.x)) & ~premier)[0]
        champ = numpy.zeros_like(self.x)
        champ[premier[self.noeud]] = [0.0, 0.0, 20 * STAGNATION_M]
        champ[self.noeud == voisin] = [0.0, 0.0, 20 * STAGNATION_M]
        marques = iter([marque, marque, numpy.zeros_like(marque)])

        def rendre(pile, _):
            pile = pile.copy()
            pile[premier[self.noeud]] = champ[premier[self.noeud]][:, None]
            return pile, next(marques)[:, None]

        resultat, passes, _ = raboter(champ[:, None], self.noeud, self.aretes, self.facteur, rendre, PASSES_MAX)
        self.assertEqual(passes, 2)
        self.assertTrue(numpy.allclose(resultat[self.noeud == voisin, 0],
                                       RABOT ** (2 - 1 / (PENTE_DU_RABOT + 1)) * champ[self.noeud == voisin]))

    def test_la_pente_monte_de_l_arete_marquee_a_un_et_s_arrete_apres_pente_du_rabot_anneaux(self):
        """#4002 : une chaîne de nœuds, son arête du milieu marquée une passe."""
        n = 2 * PENTE_DU_RABOT + 8
        aretes = numpy.column_stack([numpy.arange(n - 1), numpy.arange(1, n)])
        milieu = n // 2 - 1
        force = numpy.zeros((len(aretes), 1))
        force[milieu] = 1.0
        forces = iter([force, numpy.zeros_like(force)])
        champ = numpy.ones((n, 1, 3))
        resultat, passes, cumul = raboter(champ, numpy.arange(n), aretes, numpy.ones(n),
                                          lambda pile, _: (pile, next(forces)), PASSES_MAX)
        self.assertEqual(passes, 1)
        numpy.testing.assert_array_equal(resultat[:, 0, 0], cumul[:, 0])
        distance = numpy.minimum(numpy.abs(numpy.arange(n) - milieu), numpy.abs(numpy.arange(n) - milieu - 1))
        facteurs = [cumul[distance == r, 0] for r in range(PENTE_DU_RABOT + 2)]
        for f in facteurs:
            self.assertEqual(numpy.ptp(f), 0.0)
        facteurs = [f[0] for f in facteurs]
        self.assertAlmostEqual(facteurs[0], RABOT, places=12)
        self.assertLess(facteurs[1], 1.0)
        self.assertTrue(all(a < b for a, b in zip(facteurs, facteurs[1:])), facteurs)
        numpy.testing.assert_array_equal(cumul[distance > PENTE_DU_RABOT, 0], 1.0)

    def test_une_cle_de_force_moitie_descend_moins_vite_qu_une_cle_de_force_un(self):
        """#4002 : deux clés marquées sur la même arête, forces 1 et 0,5, une passe."""
        marque = numpy.zeros((len(self.aretes), 2))
        marque[0] = [1.0, 0.5]
        forces = iter([marque, numpy.zeros_like(marque)])
        champ = numpy.stack([self.bosse, self.bosse], axis=1)
        _, passes, cumul = raboter(champ, self.noeud, self.aretes, self.facteur,
                                   lambda pile, _: (pile, next(forces)), PASSES_MAX)
        self.assertEqual(passes, 1)
        bouts = numpy.isin(self.noeud, self.aretes[0])
        numpy.testing.assert_allclose(cumul[bouts, 0], RABOT, rtol=1e-12)
        numpy.testing.assert_allclose(cumul[bouts, 1], RABOT ** 0.5, rtol=1e-12)
        self.assertTrue((cumul[:, 1] >= cumul[:, 0]).all())
        self.assertTrue((cumul[:, 1] > cumul[:, 0])[cumul[:, 0] < 1].all())

    def test_le_rabot_garde_la_direction_de_la_cle_et_rend_ses_bornes(self):
        rabote, passes = self.raboter(self.bosse)
        self.assertGreater(passes, 0)
        self.assertFalse(hors_de(rapports(self.x, rabote, self.aretes), self.BORNES).any())
        bosse = self.noeud == self.noeud[self.BOSSE]
        depart = aux_noeuds(self.bosse, self.noeud)[self.noeud[self.BOSSE]]
        self.assertTrue(numpy.allclose(rabote[bosse], RABOT ** passes * depart))
        self.assertFalse(rabote[~bosse].any())

    def test_une_bosse_locale_laisse_intact_le_champ_loin_d_elle(self):
        z = self.x[:, 2]
        large = numpy.zeros_like(self.x)
        large[:, 0] = 0.01 * numpy.clip(0.4 - z, 0.0, None)
        rabote, passes = self.raboter(self.bosse + large)
        self.assertGreater(passes, 0)
        self.assertFalse(hors_de(rapports(self.x, rabote, self.aretes), self.BORNES).any())
        self.assertTrue(numpy.array_equal(rabote[z < 0.2], large[z < 0.2]))


class SilhouettesInertes(unittest.TestCase):
    """silhouettes.refuser_les_inertes : la garde `silhouette-inerte` de l'évaluateur, rejouée dès la finition."""

    def test_un_champ_au_seuil_leve_et_nomme_la_silhouette(self):
        vive = numpy.zeros((4, 3))
        vive[1, 2] = 2 * SOL_TOLERANCE_M
        inerte = numpy.zeros((4, 3))
        inerte[2, 0] = SOL_TOLERANCE_M
        with self.assertRaises(RuntimeError) as leve:
            refuser_les_inertes({'feminin': vive, 'corpulence': inerte})
        self.assertRegex(str(leve.exception), r'^silhouette-inerte après la finition : corpulence ')
        self.assertNotIn('feminin', str(leve.exception))

    def test_des_champs_au_dessus_du_seuil_passent(self):
        vive = numpy.zeros((4, 3))
        vive[0, 1] = 1.01 * SOL_TOLERANCE_M
        refuser_les_inertes({'feminin': vive, 'corpulence': -vive})


class DomaineDesSilhouettes(unittest.TestCase):
    def setUp(self):
        self.p, self.noeud, self.aretes = cylindre()
        self.x = numpy.column_stack([self.p, numpy.ones(len(self.p))]).astype(numpy.float32)
        self.w = numpy.ones((len(self.x), 1), dtype=numpy.float32)
        self.matrices = numpy.eye(4)[None, None]
        table = {'st': {'min': 0.7, 'max': 1.5},
                 'bornes': {cle: {'min': 0.8, 'max': 1.2} for cle in ('legs', 'arms', 'head')}}
        self.etats = etats_aux_facteurs_neutres(table, ['feminin', 'carrure_moins'])
        d = numpy.zeros_like(self.p)
        d[self.noeud == self.noeud[7 * (SECTEURS + 1) + 3], 1] = 1
        lo, hi = 0, 1
        for _ in range(50):
            milieu = (lo + hi) / 2
            if rapports(self.p, milieu * d, self.aretes).max() < (1 + ETIREMENT_DES_CLES[1]) / 2:
                lo = milieu
            else:
                hi = milieu
        self.champs = {'feminin': lo * d, 'carrure_moins': lo * d}

    def mesure(self, etats=None, monde=None):
        return mesurer_domaine(self.w, self.x, self.aretes, [(self.etats if etats is None else etats, pile_partagee(self.etats if etats is None else etats, self.matrices), ())], numpy.eye(3) if monde is None else monde)

    def test_un_coin_hors_est_refuse_puis_corrige_collectivement(self):
        sans_coins = {'cellulesSilhouettes': [], 'etats': [e
                      for e in self.etats['etats'] if sum(v != 0 for v in e['poidsSilhouettes'].values()) <= 1]}
        for e in sans_coins['etats']:
            champ = sum(e['poidsSilhouettes'][n] * d for n, d in self.champs.items())
            self.assertFalse(hors_de(rapports(self.p, champ, self.aretes), ETIREMENT_DES_CLES).any(), e['nom'])
        self.assertFalse(any(m.any() for m in par_nom(*self.mesure(sans_coins)(self.champs)).values()))
        marques = par_nom(*self.mesure()(self.champs))
        self.assertTrue(all(m.any() for m in marques.values()))
        groupes = etats_ponderes(self.x, self.champs, [(self.etats, pile_partagee(self.etats, self.matrices), ())])
        etat = preparer_correction('coin', self.x, self.w, self.noeud, self.aretes, groupes)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, 'clause R'):
            verifier_repos_cuit(etat)
        z = self.p[:, 2]
        libre = ((z > 0.05) & (z < HAUTEUR - 0.05)).astype(float)
        corriger = correction(self.p, self.aretes, self.noeud, libre == 0,
                              anneaux(self.p, NIVEAUX_DES_ANNEAUX))
        mesure = self.mesure()
        with contextlib.redirect_stdout(io.StringIO()):
            finis, _ = raboter_sous_correction(dict(self.champs), self.noeud, self.aretes,
                                              libre, corriger, numpy.eye(3), mesure)
        self.assertFalse(any(m.any() for m in par_nom(*self.mesure()(finis)).values()))
        for nom in self.champs:
            self.assertGreater(numpy.abs(finis[nom] - self.champs[nom]).max(), 0)
        groupes = etats_ponderes(self.x, finis, [(self.etats, pile_partagee(self.etats, self.matrices), ())])
        etat = preparer_correction('coin', self.x, self.w, self.noeud, self.aretes, groupes)
        with contextlib.redirect_stdout(io.StringIO()):
            verifier_repos_cuit(etat)

    def test_remesure_les_aretes_touchees_par_toute_cle_et_garde_le_repere_monde(self):
        mesure = self.mesure()
        monde = rotation()
        for facteur in (1, 0.5, 0.5):
            champs = {n: d * facteur for n, d in self.champs.items()}
            obtenu = par_nom(*mesure(champs))
            entier = par_nom(*self.mesure()(champs))
            tourne = par_nom(*self.mesure(monde=monde)({n: d @ monde.T for n, d in champs.items()}))
            for nom in champs:
                numpy.testing.assert_array_equal(obtenu[nom], entier[nom])
                numpy.testing.assert_array_equal(tourne[nom], entier[nom])

    def test_une_cle_valide_non_participante_reste_intacte_pendant_le_rabot_collectif(self):
        z = self.p[:, 2]
        libre = ((z > 0.05) & (z < HAUTEUR - 0.05)).astype(float)
        corriger = correction(self.p, self.aretes, self.noeud, libre == 0,
                              anneaux(self.p, NIVEAUX_DES_ANNEAUX))
        temoin = numpy.zeros_like(self.p)
        temoin[self.noeud == self.noeud[8 * (SECTEURS + 1) + 7], 1] = .001
        (temoin,), _ = corriger([temoin])
        champs = {**self.champs, 'temoin': temoin}
        mesure = self.mesure()

        def hors(courants):
            fautes, pese = mesure({n: courants[n] for n in self.champs})
            return fautes, {**pese, 'temoin': numpy.zeros_like(fautes)}

        with contextlib.redirect_stdout(io.StringIO()):
            finis, _ = raboter_sous_correction(champs, self.noeud, self.aretes,
                                              libre, corriger, numpy.eye(3), hors)
        numpy.testing.assert_allclose(finis['temoin'], temoin, rtol=0, atol=TOLERANCE)
        self.assertTrue(all(numpy.abs(finis[n] - champs[n]).max() > 0 for n in self.champs))
        self.assertFalse(any(m.any() for m in par_nom(*hors(finis)).values()))


class DomaineDuGabarit(unittest.TestCase):
    """#3104 : la finition des silhouettes mesure aussi les états du gabarit, par les clés que la cuisson en dérive."""

    def setUp(self):
        self.p, self.noeud, self.aretes = cylindre()
        self.x = numpy.column_stack([self.p, numpy.ones(len(self.p))]).astype(numpy.float32)
        self.w = numpy.ones((len(self.x), 1), dtype=numpy.float32)
        table = {'st': {'min': 0.7, 'max': 1.5},
                 'bornes': {cle: {'min': 0.8, 'max': 1.2} for cle in ('legs', 'arms', 'head')}}
        etats = etats_du_gabarit(table, ['feminin', 'carrure_plus'])
        jeux = {}
        for etat in etats['etats']:
            jeux.setdefault(json.dumps(etat['facteurs'], sort_keys=True), []).append(etat)
        self.groupes = [({'etats': jeu, 'cellulesSilhouettes': etats['cellulesSilhouettes']},
                         pile_partagee({'etats': jeu}, numpy.eye(4)[None, None]), ()) for jeu in jeux.values()]
        self.cles = sorted({nom for e in etats['etats'] for poids in (e['poidsGabarit'], e['poidsReference'])
                            for nom in poids if nom.startswith('gabarit_')})
        self.champs = {n: numpy.zeros_like(self.p) for n in ('feminin', 'carrure_plus')}
        self.a, self.b = self.aretes[len(self.aretes) // 2]

    def derivees(self, croisee, facteur=.9, si=lambda champs: True):
        def deriver(champs):
            cles = {nom: numpy.zeros_like(self.p) for nom in self.cles}
            if si(champs):
                cles[croisee][self.noeud == self.noeud[self.b]] = facteur * (self.p[self.a] - self.p[self.b])
            return cles
        return deriver

    def test_un_champ_change_loin_de_l_arete_remesure_l_arete_que_sa_cle_derivee_deplace(self):
        loin = int(numpy.argmax(numpy.linalg.norm(self.p - self.p[self.b], axis=1)))
        derivees = self.derivees('gabarit_legs_plus_feminin', si=lambda champs: champs['feminin'][loin].any())
        mesure = mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3), derivees)
        self.assertFalse(any(m.any() for m in par_nom(*mesure(self.champs)).values()))
        champs = {**self.champs, 'feminin': self.champs['feminin'].copy()}
        champs['feminin'][self.noeud == self.noeud[loin]] = [0, 0, 1e-4]
        incremental = par_nom(*mesure(champs))
        frais = par_nom(*mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3), derivees)(champs))
        self.assertTrue(incremental['feminin'].any())
        for nom in champs:
            numpy.testing.assert_array_equal(incremental[nom], frais[nom])

    def test_une_cle_croisee_trop_etiree_marque_sa_silhouette(self):
        marques = par_nom(*mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3),
                                           self.derivees('gabarit_legs_plus_feminin', facteur=-5))(self.champs))
        self.assertTrue(marques['feminin'].any())

    def test_une_cle_croisee_hors_bornes_marque_sa_silhouette_aux_seuls_etats_du_gabarit(self):
        self.assertIn('gabarit_legs_plus_feminin', self.cles)
        neutres = [(d, m, c) for d, m, c in self.groupes if all(not p for p in d['etats'][0]['poidsGabarit'].values())]
        self.assertEqual(len(neutres), 1)
        sans = mesurer_domaine(self.w, self.x, self.aretes, neutres, numpy.eye(3), self.derivees('gabarit_legs_plus_feminin'))
        self.assertFalse(any(m.any() for m in par_nom(*sans(self.champs)).values()))
        marques = par_nom(*mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3),
                                           self.derivees('gabarit_legs_plus_feminin'))(self.champs))
        self.assertTrue(marques['feminin'].any())
        self.assertFalse(marques['carrure_plus'].any())
        nulles = mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3),
                                 lambda champs: {nom: numpy.zeros_like(self.p) for nom in self.cles})(self.champs)
        self.assertFalse(any(m.any() for m in par_nom(*nulles).values()))


def groupe_a_un_clip(positions, references, matrices, cellules, demandes=()):
    """`GroupePondere` dont tous les états partagent la pile `matrices`, ses échantillons après le repos formant un seul
    clip."""
    return GroupePondere(positions, references, [matrices] * len(positions), cellules, demandes,
                         (len(matrices) - 1,) if len(matrices) > 1 else ())


def pile_partagee(domaine, pile):
    """La pile `pile` partagée par référence entre tous les états de `domaine` (`cuisson_gabarit.groupes_de_peau`)."""
    return [pile] * len(domaine['etats'])


def domaine_a_facteurs_neutres():
    """`etats_aux_facteurs_neutres` de corpulence et carrure_moins."""
    table = {'st': {'min': .7, 'max': 1.5}, 'bornes': {
        cle: {'min': 1, 'max': 1} for cle in ('legs', 'arms', 'head')}}
    return etats_aux_facteurs_neutres(table, ['corpulence', 'carrure_moins'])


def arete_du_domaine(interieur=True, clip=None, z=.1):
    """Une arête sous `domaine_a_facteurs_neutres`, à l'identité puis sous `clip` ; `interieur` : aux états dans leurs
    bornes, son minimum est intérieur au domaine des silhouettes."""
    x = numpy.array([[0, 0, 0, 1], [1, 1, z, 1]], dtype=float)
    w = numpy.ones((2, 1))
    aretes = numpy.array([[0, 1]])
    demandes = domaine_a_facteurs_neutres()
    champs = {n: numpy.zeros((2, 3)) for n in ('corpulence', 'carrure_moins')}
    champs['corpulence'][1] = [-2, 0, 0] if interieur else [.01, 0, 0]
    champs['carrure_moins'][1] = [0, -2, 0] if interieur else [0, .01, 0]
    matrices = numpy.eye(4)[None, None]
    if clip is not None:
        matrices = numpy.concatenate([matrices, clip[None, None]])
    groupes = etats_ponderes(x, champs, [(demandes, pile_partagee(demandes, matrices), () if clip is None else (1,))])
    return x, w, aretes, demandes, champs, matrices, groupes


class MinimumContinu(unittest.TestCase):
    def test_le_minimum_interieur_exact_refuse_R_malgre_les_coins_valides(self):
        x, w, aretes, demandes, champs, matrices, groupes = arete_du_domaine()
        etat = preparer_correction('interieur', x, w, numpy.arange(2), aretes, groupes)
        self.assertFalse((etat['cotesRepos'] >= 0).any())
        with mock.patch('poids.extremes', side_effect=AssertionError('seconde mesure')), contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, 'clause R') as refuse:
            verifier_repos_cuit(etat)
        minimum = refuse.exception.diagnostic['aretes'][0]['domaine'][0]
        self.assertEqual(minimum['nature'], 'EXACT')
        self.assertAlmostEqual(minimum['rapport'], .1 / numpy.sqrt(2.01), places=12)
        self.assertAlmostEqual(minimum['poids']['corpulence'], .5)
        self.assertAlmostEqual(minimum['poids']['carrure_moins'], .5)
        marques = par_nom(*mesurer_domaine(w, x, aretes, [(demandes, pile_partagee(demandes, matrices), ())],
                                           numpy.eye(3))(champs))
        self.assertTrue(all(m[0] for m in marques.values()))

    def test_le_minimum_interieur_de_clip_refuse_malgre_les_coins_valides(self):
        clip = numpy.eye(4)
        clip[2, 2] = .01
        x, w, aretes, _, champs, _, groupes = arete_du_domaine(clip=clip, z=.5)
        etat = preparer_correction('clip-interieur', x, w, numpy.arange(2), aretes, groupes)
        trace = etat['traces'][0]
        self.assertTrue((trace.cotes_clip < 0).all())
        self.assertFalse(etat['horsRepos'][0])
        self.assertTrue(etat['horsClip'][0])
        self.assertAlmostEqual(trace.domaine_clip.bas[0], .005 / 1.5, places=12)
        self.assertTrue(trace.domaine_clip.exact[0])
        self.assertTrue(numpy.isfinite(trace.domaine_clip.bas[0]))
        for nom in champs:
            self.assertAlmostEqual(trace.domaine_clip.poids[nom][0], .5)

    def test_la_finition_marque_les_cles_d_un_defaut_de_clip(self):
        clip = numpy.eye(4)
        clip[2, 2] = .01
        x, w, aretes, demandes, champs, matrices, _ = arete_du_domaine(clip=clip, z=.5)
        au_repos = mesurer_domaine(w, x, aretes, [(demandes, pile_partagee(demandes, matrices[:1]), ())], numpy.eye(3))(champs)
        self.assertFalse(any(m.any() for m in par_nom(*au_repos).values()))
        fautes, parts = mesurer_domaine(w, x, aretes, [(demandes, pile_partagee(demandes, matrices[:1]), ()),
                                                       (demandes, pile_partagee(demandes, matrices), (1,))],
                                        numpy.eye(3))(champs)
        self.assertTrue(all(m[0] for m in par_nom(fautes, parts).values()))
        n = len(demandes['etats'])
        self.assertEqual(fautes.shape, (2 * n + 4, len(aretes)))
        self.assertEqual(list(parts), list(champs))
        for nom, p in parts.items():
            self.assertEqual(p.shape, fautes.shape)
            numpy.testing.assert_array_equal(p[~fautes], 0.0)
            pese = [e['poidsSilhouettes'].get(nom, 0) != 0 for e in demandes['etats']] * 2
            self.assertFalse(((p[:2 * n, 0] > 0) & ~numpy.array(pese)).any())
        numpy.testing.assert_allclose(numpy.max(list(parts.values()), axis=0)[fautes], 1.0)
        self.assertFalse(fautes[list(range(n)) + [2 * n, 2 * n + 1]].any())
        self.assertTrue(fautes[list(range(n, 2 * n)) + [2 * n + 2, 2 * n + 3]].any())

    def test_une_topologie_absente_est_un_refus_nomme(self):
        x, _, _, demandes, champs, matrices, _ = arete_du_domaine()
        with self.assertRaisesRegex(RuntimeError, 'topologie-silhouettes-absente'):
            etats_ponderes(x, champs, [({'etats': demandes['etats']}, pile_partagee(demandes, matrices), ())])

    def test_un_groupe_sans_topologie_est_un_refus_nomme(self):
        x, w, aretes, _, _, matrices, groupes = arete_du_domaine()
        with self.assertRaisesRegex(RuntimeError, 'topologie-silhouettes-absente'):
            extremes(w, aretes, [tuple(groupes[0])])

    def test_un_minimum_de_clip_au_coin_neutre_reste_dans_la_trace(self):
        domaine = domaine_a_facteurs_neutres()
        x = numpy.array([[0, 0, 0, 1], [0, 0, 1, 1]], dtype=float)
        w, aretes = numpy.ones((2, 1)), numpy.array([[0, 1]])
        champs = {nom: numpy.zeros((2, 3)) for nom in ('corpulence', 'carrure_moins')}
        champs['corpulence'][1] = [1, 0, 0]
        champs['carrure_moins'][1] = [0, 1, 0]
        clip = numpy.eye(4)
        clip[2, 2] = .001
        matrices = numpy.array([[numpy.eye(4)], [clip]])
        traces = []
        groupes = etats_ponderes(x, champs, [(domaine, pile_partagee(domaine, matrices), (1,))])
        extremes(w, aretes, groupes, traces)
        self.assertEqual(traces[0].domaine_clip.cotes[0], 0)
        self.assertTrue(traces[0].domaine_clip.exact[0])
        self.assertAlmostEqual(traces[0].domaine_clip.bas[0], .001)
        self.assertTrue(all(p[0] == 0 for p in traces[0].domaine_clip.poids.values()))

    def test_le_repli_ne_remesure_que_les_aretes_incompletes(self):
        clip = numpy.eye(4)
        clip[:3, :3] *= 10
        x, w, _, _, _, _, groupes = arete_du_domaine(False, clip)
        x = numpy.concatenate([x, x + [3, 0, 0, 0]])
        w = numpy.concatenate([w, w])
        g = groupes[0]
        positions = numpy.concatenate([g[0], g[0] + [3, 0, 0, 0]], axis=1)
        references = numpy.concatenate([g[1], g[1] + [3, 0, 0, 0]], axis=1)
        pile = numpy.concatenate([g[2][0], g[2][0]], axis=1)
        w = numpy.column_stack([w, numpy.zeros_like(w)])
        w[2:] = [0, 1]
        pile[1:, 1] = numpy.eye(4)
        groupe = GroupePondere(positions, references, [pile] * len(positions), g.cellules, g.demandes, g.clips)
        tailles = []
        def melanges(poids, pile):
            tailles.append(len(poids))
            return melanges_par_lots(poids, pile)
        with mock.patch('pas_des_poids.melanges_par_lots', side_effect=melanges):
            extremes(w, numpy.array([[0, 1], [2, 3]]), [groupe])
        self.assertEqual(tailles, [4, 4, 2, 2])

    def test_la_borne_certifie_sans_qp_et_ne_depasse_pas_l_exact(self):
        x, w, aretes, _, _, _, groupes = arete_du_domaine(False)
        traces, exactes = [], []
        extremes(w, aretes, groupes, traces)
        extremes(w, aretes, groupes, exactes, filtrer=False)
        a, b = traces[0].domaine_repos, exactes[0].domaine_repos
        self.assertGreater(a.certifiees, 0)
        self.assertEqual(a.resolues, 0)
        self.assertFalse(a.exact[0])
        self.assertLessEqual(a.bas[0], b.bas[0])
        self.assertTrue(b.exact[0])
        self.assertEqual(a.cotes[0], -1)

    def test_la_correction_des_poids_marque_en_clip_une_arete_valide_au_repos(self):
        clip = numpy.eye(4)
        clip[:3, :3] *= 10
        x, w, aretes, _, _, _, groupes = arete_du_domaine(False, clip)
        etat = preparer_correction('clip', x, w, numpy.arange(2), aretes, groupes)
        self.assertFalse(etat['horsRepos'][0])
        self.assertTrue(etat['horsClip'][0])

    def test_une_arete_hors_par_le_maximum_porte_un_argmin_exact(self):
        clip = numpy.eye(4)
        clip[:3, :3] *= 10
        x, w, aretes, _, _, _, groupes = arete_du_domaine(False, clip)
        traces = []
        extremes(w, aretes, groupes, traces)
        self.assertTrue(traces[0].domaine_repos.exact[0])
        self.assertTrue(traces[0].domaine_clip.exact[0])

    def test_une_topologie_declaree_incomplete_est_refusee(self):
        x, _, _, demandes, champs, matrices, _ = arete_du_domaine()
        incomplets = {**demandes, 'etats': [e for e in demandes['etats'] if sum(v != 0 for v in e['poidsSilhouettes'].values()) <= 1]}
        with self.assertRaisesRegex(RuntimeError, r"cellule-incomplete : .+ : coin absent .*corpulence.*carrure_moins"):
            etats_ponderes(x, champs, [(incomplets, pile_partagee(incomplets, matrices), ())])

    def test_les_compteurs_suivent_la_remesure_et_la_decoupe(self):
        def mesurer(fixture):
            x, w, aretes, _, _, _, groupes = fixture
            traces = []
            extremes(w, aretes, groupes, traces)
            return traces[0]
        sain, mauvais = mesurer(arete_du_domaine(False)), mesurer(arete_du_domaine())
        self.assertEqual((sain.domaine_repos.certifiees, sain.domaine_repos.resolues), (4, 0))
        self.assertEqual((mauvais.domaine_repos.certifiees, mauvais.domaine_repos.resolues), (2, 2))
        integrer_trace(sain, mauvais, numpy.array([0]))
        self.assertEqual((sain.domaine_repos.certifiees, sain.domaine_repos.resolues), (2, 2))
        self.assertTrue(sain.domaine_repos.exact[0])
        numpy.testing.assert_array_equal(sain.domaine_repos.certifiees_par_arete, [2])
        numpy.testing.assert_array_equal(sain.domaine_repos.resolues_par_arete, [2])
        decoupe = decouper_trace(sain, numpy.array([0])).domaine_repos
        self.assertEqual((decoupe.certifiees, decoupe.resolues), (2, 2))
        vide = decouper_trace(sain, numpy.array([], dtype=int)).domaine_repos
        self.assertEqual((vide.certifiees, vide.resolues), (0, 0))

    def test_le_cas_singulier_est_resolu_par_les_bords(self):
        valeur, uv = minimum_du_carre(numpy.array([[1., 0, 0]]),
            numpy.array([[-2., 0, 0]]), numpy.array([[-2., 0, 0]]))
        self.assertEqual(valeur[0], 0)
        self.assertAlmostEqual(uv[0].sum(), .5)


class PartsDesFautes(unittest.TestCase):
    """#4002 : silhouettes.parts_des_fautes par `mesurer_domaine`, sur une arête unité le long de x sous
    `domaine_a_facteurs_neutres`, ses champs posés au second sommet ; le site lu est l'état où les deux noms pèsent 1."""

    def mesurer(self, corpulence, carrure_moins, portes=()):
        x = numpy.array([[0, 0, 0, 1], [1, 0, 0, 1]], dtype=float)
        w, aretes = numpy.ones((2, 1)), numpy.array([[0, 1]])
        demandes = domaine_a_facteurs_neutres()
        champs = {n: numpy.zeros((2, 3)) for n in ('corpulence', 'carrure_moins')}
        champs['corpulence'][1], champs['carrure_moins'][1] = corpulence, carrure_moins
        mesure = mesurer_domaine(w, x, aretes, [(demandes, pile_partagee(demandes, numpy.eye(4)[None, None]), ())],
                                 numpy.eye(3), portes=portes)
        fautes, parts = mesure(champs)
        coin = next(i for i, e in enumerate(demandes['etats'])
                    if e['poidsSilhouettes'] == {'corpulence': 1, 'carrure_moins': 1})
        self.assertTrue(fautes[coin, 0])
        return {nom: p[coin, 0] for nom, p in parts.items()}, (fautes, parts), (x, w, aretes, champs, mesure)

    def exces(self, *decalages):
        return numpy.log(numpy.linalg.norm(numpy.array([1.0, 0, 0]) + sum(decalages)) / ETIREMENT_DES_CLES[1])

    def test_le_nom_dont_le_retrait_rend_les_bornes_a_la_part_un_l_autre_zero_et_n_est_pas_rabote(self):
        parts, mesure, (x, w, aretes, champs, hors) = self.mesurer([4, 0, 0], [0, 0, 0])
        self.assertEqual(parts, {'corpulence': 1.0, 'carrure_moins': 0.0})
        marques = par_nom(*mesure)
        self.assertTrue(marques['corpulence'][0])
        self.assertFalse(marques['carrure_moins'][0])
        with contextlib.redirect_stdout(io.StringIO()):
            finis, rabot = raboter_sous_correction(champs, numpy.arange(2), aretes, numpy.ones(2),
                                                   lambda d, _=None: (d, {}), numpy.eye(3), hors)
        self.assertLess(rabot['corpulence'].max(), 1.0)
        numpy.testing.assert_array_equal(rabot['carrure_moins'], 1.0)
        self.assertFalse(any(m.any() for m in par_nom(*hors(finis)).values()))

    def test_des_gains_positifs_inegaux_rendent_des_parts_proportionnelles(self):
        corpulence, carrure = numpy.array([4.0, 0, 0]), numpy.array([3.0, 0, 0])
        parts, _, _ = self.mesurer(corpulence, carrure)
        avec = self.exces(corpulence, carrure)
        gains = {'corpulence': (avec - self.exces(carrure)) / avec, 'carrure_moins': (avec - self.exces(corpulence)) / avec}
        self.assertTrue(0 < gains['carrure_moins'] < gains['corpulence'] < 1)
        self.assertAlmostEqual(parts['corpulence'], 1.0, places=9)
        self.assertAlmostEqual(parts['carrure_moins'], gains['carrure_moins'] / gains['corpulence'], places=6)

    def test_sans_gain_positif_chaque_nom_qui_pese_a_la_part_un(self):
        corpulence, carrure = numpy.array([3.0, 5, 0]), numpy.array([0.0, -5, 0])
        parts, _, _ = self.mesurer(corpulence, carrure)
        avec = self.exces(corpulence, carrure)
        self.assertGreater(avec, 0)
        self.assertGreater(self.exces(carrure), avec)
        self.assertGreater(self.exces(corpulence), avec)
        self.assertEqual(parts, {'corpulence': 1.0, 'carrure_moins': 1.0})


    def test_un_nom_porte_n_entre_pas_aux_gains_et_le_rabote_qui_pese_prend_le_repli(self):
        """Seule la carrure portée a un gain au site ; le raboté, nul à l'arête, n'en a aucun."""
        parts, (fautes, toutes), _ = self.mesurer([0, 0, 0], [4, 0, 0], portes=['carrure_moins'])
        self.assertEqual(parts, {'corpulence': 1.0, 'carrure_moins': 0.0})
        numpy.testing.assert_array_equal(toutes['carrure_moins'], 0.0)


class PublicationDesSilhouettes(unittest.TestCase):
    def peau(self, noms):
        cles = [SimpleNamespace(name=nom) for nom in ('Basis', *noms)]
        return SimpleNamespace(data=SimpleNamespace(shape_keys=SimpleNamespace(key_blocks=cles, reference_key=cles[0])))

    def test_le_manifeste_publie_les_silhouettes_et_garde_la_premiere_rencontre(self):
        nom = noms_silhouettes.SILHOUETTES[0]
        self.assertEqual(humanoide.silhouettes([self.peau([nom, 'gabarit_legs_moins'])]), [nom])
        table = noms_silhouettes.SILHOUETTES
        peaux = [self.peau(table), self.peau(tuple(reversed(table)))]
        self.assertEqual(humanoide.silhouettes(peaux), list(table))
        self.assertEqual(humanoide.silhouettes(list(reversed(peaux))), list(reversed(table)))


class Fondu(unittest.TestCase):
    """silhouettes.fondu sur trois sommets, dont deux jumeaux aux poids de pied discordants."""

    def test_un_noeud_garde_la_plus_petite_part_de_ses_sommets(self):
        noms = ['pied', 'tibia']
        demi = 0.5 * MAJORITE_DU_POIDS
        w = numpy.array([[0.0, 1.0], [MAJORITE_DU_POIDS, 1.0 - MAJORITE_DU_POIDS], [demi, 1.0 - demi]])
        libre = fondu(w, noms, {'pied'}, numpy.array([0, 0, 2]))
        self.assertTrue(numpy.allclose(libre, [0.0, 0.0, 0.5]))


if __name__ == '__main__':
    unittest.main()
