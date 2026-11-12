"""silhouettes.correction sur un cylindre synthétique, contre une résolution KKT directe du même problème, et ses
erreurs nommées ; silhouettes.raboter_sous_correction, rabot mesuré sur les clés corrigées jusqu'aux bornes
d'étirement, du repère du mesh au repère monde et retour ; formes.raboter, rabot des clés marquées ; silhouettes.mesurer_domaine,
mesure incrémentale égale à la porte de construction ; silhouettes.fondu, une part par nœud ; portage d'une silhouette à
os (#4002) : extrémité rigide et centres d'anneaux portés par leurs os."""
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
from formes import RABOT, STAGNATION_M, aux_noeuds, raboter, rapports, region_locale, retournees_par  # noqa: E402
import noms_silhouettes  # noqa: E402
from pas_des_poids import melanges_par_lots, minimum_du_carre  # noqa: E402
from poids import PASSES_MAX, GroupePondere, decouper_trace, etats_ponderes, extremes, integrer_trace, preparer_correction, verifier_repos_cuit  # noqa: E402
from seuils import ETIREMENT_DES_CLES, ETIREMENT_EN_CLIP, MAJORITE_DU_POIDS, SOL_TOLERANCE_M  # noqa: E402
from silhouettes import (AnneauIndetectable, ComposanteSansAppui, ContraintesLiees, correction, fondu,  # noqa: E402
                         mesurer_domaine, raboter_sous_correction, refuser_les_inertes)
from cuisson_gabarit import etats_aux_facteurs_neutres, etats_du_gabarit  # noqa: E402

SECTEURS, NIVEAUX = 12, 14
NIVEAUX_DES_ANNEAUX = (2, 4, 6, 9, 11)
TOLERANCE = 1e-10
HAUTEUR = 0.1 * (NIVEAUX - 1)


def hors_de(r, bornes):
    return (r < bornes[0]) | (r > bornes[1])


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


def anneaux(x, niveaux, le_plus_epais=None):
    liste = [anneau(x, niveau) for niveau in niveaux]
    epais = int(numpy.argmax([a['rayon'] for a in liste])) if le_plus_epais is None else le_plus_epais
    return {'anneaux': liste, 'lePlusEpais': epais}


def kkt(x, aretes, noeud, fixe, lus, d0, rapport):
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
    if rapport is not None:
        epais = lus['anneaux'][lus['lePlusEpais']]
        s = numpy.array([v['indice'] for v in epais['sommets']])
        axe = numpy.array(epais['axe'])
        u = x[s] - epais['centre']
        u -= (u @ axe)[:, None] * axe
        u /= numpy.linalg.norm(u, axis=1, keepdims=True) * len(s)
        ligne = numpy.zeros(taille)
        for c in range(3):
            ligne[c * nv + s] = u[:, c]
        lignes.append(ligne)
        cibles.append((rapport - 1) * epais['rayon'])
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
        for (d0, rapport), d in zip(champs, corriges):
            ecart = numpy.abs(d - kkt(self.x, self.aretes, self.noeud, fixe, lus, d0, rapport)).max()
            self.assertLess(ecart, TOLERANCE, f'rapport {rapport}')

    def assert_liees(self, fixe, lus, champs, attendues):
        with self.assertRaises(ContraintesLiees) as leve:
            correction(self.x, self.aretes, self.noeud, fixe, lus)(champs)
        self.assertIsInstance(leve.exception, AnneauIndetectable)
        self.assertEqual(str(leve.exception).split(' : ')[1], ', '.join(attendues))

    def test_reutilise_le_laplacien_prepare_pour_chaque_resolution(self):
        with mock.patch.object(silhouettes, 'lancer', wraps=silhouettes.lancer) as lancer:
            corriger = correction(self.x, self.aretes, self.noeud, self.fixe, anneaux(self.x, NIVEAUX_DES_ANNEAUX))
            for rapport in (None, 1.7):
                (champ,), _ = corriger([(self.cle(), rapport)])
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
                              [(self.cle(), None), (self.cle(), 0.72), (self.cle(), 1.7)])

    def test_des_poids_un_rendent_la_correction_sans_poids(self):
        corriger = correction(self.x, self.aretes, self.noeud, self.fixe, anneaux(self.x, NIVEAUX_DES_ANNEAUX))
        champs = [(self.cle(), None), (self.cle(), 1.7)]
        sans, _ = corriger(champs)
        avec, _ = corriger(champs, [numpy.ones(len(self.x)), None])
        for a, b in zip(sans, avec):
            self.assertLess(numpy.abs(a - b).max(), TOLERANCE)

    def test_les_poids_tiennent_les_contraintes_et_epargnent_les_noeuds_de_poids_faible(self):
        """Une carrure seule : la part imposée va aux nœuds de poids un, la moitié x > 0 de poids 1e-3 en reçoit peu."""
        lus = anneaux(self.x, NIVEAUX_DES_ANNEAUX)
        corriger = correction(self.x, self.aretes, self.noeud, self.fixe, lus)
        faibles = self.x[:, 0] > 0
        (sans,), _ = corriger([(numpy.zeros_like(self.x), 1.7)])
        (avec,), _ = corriger([(numpy.zeros_like(self.x), 1.7)], [numpy.where(faibles, 1e-3, 1.0)])
        self.assertLess(numpy.abs(avec[faibles]).max(), 0.01 * numpy.abs(sans[faibles]).max())
        for anneau in lus['anneaux']:
            s = numpy.array([v['indice'] for v in anneau['sommets']])
            self.assertLess(numpy.abs(avec[s].sum(axis=0)).max(), TOLERANCE, anneau['os'])
        epais = lus['anneaux'][lus['lePlusEpais']]
        s = numpy.array([v['indice'] for v in epais['sommets']])
        axe = numpy.array(epais['axe'])
        radial = self.x[s] - numpy.array(epais['centre'])
        radial -= (radial @ axe)[:, None] * axe
        radial /= numpy.linalg.norm(radial, axis=1, keepdims=True)
        self.assertAlmostEqual(float((avec[s] * radial).sum(axis=1).mean()), 0.7 * epais['rayon'], places=9)

    def test_moyenne_aux_noeuds_une_source_non_nulle_aux_fixes_et_discordante_entre_jumeaux(self):
        d0 = self.lisse() + 0.01 * self.rng.standard_normal(self.x.shape)
        jumeaux = numpy.flatnonzero(self.noeud != numpy.arange(len(self.x)))
        self.assertGreater(numpy.abs(d0[jumeaux] - d0[self.noeud[jumeaux]]).min(), 0.0)
        self.assertGreater(numpy.abs(d0[self.fixe]).min(), 0.0)
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX), [(d0, 1.7)])

    def test_un_anneau_le_plus_epais_tout_fixe_se_tient_sans_rapport_vise(self):
        self.assert_comme_kkt(anneaux(self.x, (0, *NIVEAUX_DES_ANNEAUX), le_plus_epais=0), [(self.cle(), None)])

    def test_un_rapport_vise_sur_un_anneau_le_plus_epais_tout_fixe_leve_contraintes_liees(self):
        self.assert_liees(self.fixe, anneaux(self.x, (0, *NIVEAUX_DES_ANNEAUX), le_plus_epais=0),
                          [(self.cle(), None), (self.cle(), 1.7)], ['niveau_0 épaisseur'])

    def test_un_corps_sans_noeud_libre_rend_un_champ_nul_et_ne_porte_aucune_epaisseur(self):
        tout = numpy.ones(len(self.x), dtype=bool)
        lus = anneaux(self.x, NIVEAUX_DES_ANNEAUX, le_plus_epais=2)
        self.assert_comme_kkt(lus, [(self.cle(), None)], fixe=tout)
        self.assert_liees(tout, lus, [(self.cle(), 1.7)], ['niveau_6 épaisseur'])

    def test_une_epaisseur_sur_le_seul_noeud_libre_de_l_anneau_le_plus_epais_leve_contraintes_liees(self):
        fixe = self.fixe.copy()
        s = sommets_du_niveau(6)
        fixe[s] = True
        fixe[s[3]] = False
        lus = anneaux(self.x, (4, 6, 9), le_plus_epais=1)
        self.assert_comme_kkt(lus, [(self.cle(), None)], fixe=fixe)
        self.assert_liees(fixe, lus, [(self.cle(), 1.7)], ['niveau_6 centre', 'niveau_6 épaisseur'])

    def test_deux_anneaux_dont_la_part_libre_est_le_meme_noeud_levent_contraintes_liees(self):
        fixe = self.fixe.copy()
        s = sommets_du_niveau(6)
        fixe[s] = True
        fixe[[s[0], s[-1]]] = False
        lus = {'anneaux': [anneau(self.x, 9), anneau(self.x, 6, s[0:3], 'A'), anneau(self.x, 6, [s[-1], *s[3:5]], 'B')],
               'lePlusEpais': 0}
        self.assert_liees(fixe, lus, [(self.cle(), None)], ['A centre', 'B centre'])

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
        corriger = correction(self.x, self.aretes, self.noeud, self.libre == 0, anneaux(self.x, NIVEAUX_DES_ANNEAUX))

        def corriger_et_noter(champs, repartitions=None, centres=None):
            corriges, sonde = corriger(champs, repartitions, centres)
            self.vus.append(([d for d, _ in champs], corriges))
            return corriges, sonde

        self.corriger = corriger_et_noter

    def translation(self):
        brut = numpy.zeros_like(self.x)
        brut[:, 0] = 0.1
        brut[:, 1] = 0.1 * numpy.sin(5 * self.x[:, 2])
        return brut

    def finir(self, bruts, bornes=BORNES, vers_le_monde=None, rabot=None, portes=None):
        """Les champs finis de `raboter_sous_correction` sur les clés `bruts` au repère du mesh, repos `self.x` porté
        dans ce repère par l'inverse de `vers_le_monde` (par défaut l'identité), depuis le rabot cumulé `rabot`, sous
        les portages `portes`."""
        return self.finir_et_raboter(bruts, bornes, vers_le_monde, rabot, portes)[0]

    def finir_et_raboter(self, bruts, bornes=BORNES, vers_le_monde=None, rabot=None, portes=None):
        vers_le_monde = numpy.eye(3) if vers_le_monde is None else vers_le_monde
        repos = self.x @ numpy.linalg.inv(vers_le_monde)
        with contextlib.redirect_stdout(io.StringIO()):
            return raboter_sous_correction(bruts, self.noeud, self.aretes, self.libre, self.corriger, vers_le_monde,
                                          lambda champs: {nom: hors_de(rapports(repos, d, self.aretes), bornes)
                                                          for nom, d in champs.items()}, rabot, portes)

    def porte(self):
        """Une silhouette à os sur le cylindre : les sommets tenus (`libre` nul) tout à un os rigide de déplacement
        `RIGIDE`, le portage C ailleurs une rampe le long de l'axe, l'os de chaque anneau déplacé de C au centre de
        l'anneau. Rend T = C + H, F = (1 − libre)·C, les cibles des centres d'anneaux et le déplacement de leurs os."""
        c = numpy.where((self.libre == 0)[:, None], self.RIGIDE, 0.04 * numpy.outer(self.x[:, 2], [1.0, 0.5, 0.0]))
        f = (1.0 - self.libre)[:, None] * c
        lus = anneaux(self.x, NIVEAUX_DES_ANNEAUX)
        sommets = [numpy.array([v['indice'] for v in a['sommets']]) for a in lus['anneaux']]
        os_ = numpy.array([c[s].mean(axis=0) + [0.0, 0.0, 0.01] for s in sommets])
        cibles = numpy.array([len(s) * d - f[s].sum(axis=0) for s, d in zip(sommets, os_)])
        return c + self.translation(), f, cibles, sommets, os_

    RIGIDE = numpy.array([0.03, -0.02, 0.01])

    def test_un_sommet_tout_a_un_os_rigide_garde_le_portage_de_son_os_avant_et_apres_finition(self):
        t, f, cibles, _, _ = self.porte()
        tenus = self.libre == 0
        self.assertTrue(tenus.any())
        numpy.testing.assert_array_equal((f + self.libre[:, None] * t)[tenus], numpy.tile(self.RIGIDE, (tenus.sum(), 1)))
        fini = self.finir({'k': (t, None)}, portes={'k': (f, cibles)})['k']
        numpy.testing.assert_allclose(fini[tenus], numpy.tile(self.RIGIDE, (tenus.sum(), 1)), rtol=0, atol=TOLERANCE)
        self.assertEqual(self.hors(fini), 0)

    def test_le_centre_de_chaque_anneau_suit_le_deplacement_de_son_os(self):
        t, f, cibles, sommets, os_ = self.porte()
        fini = self.finir({'k': (t, None)}, portes={'k': (f, cibles)})['k']
        for s, d in zip(sommets, os_):
            self.assertGreater(numpy.abs(t[s].mean(axis=0) - d).max(), 1e-3)
            numpy.testing.assert_allclose(fini[s].mean(axis=0), d, rtol=0, atol=TOLERANCE)

    def hors(self, champ, bornes=BORNES):
        return int(hors_de(rapports(self.x, champ, self.aretes), bornes).sum())

    def test_le_champ_rendu_est_la_correction_du_dernier_rabot_et_tient_les_bornes(self):
        fini = self.finir({'k': (self.translation(), None)})['k']
        _, (corrige,) = self.vus[-1]
        self.assertTrue(numpy.array_equal(fini, corrige))
        self.assertEqual(self.hors(fini), 0)
        self.assertEqual(numpy.abs(fini[self.libre == 0]).max(), 0.0)

    def test_le_tour_suivant_repart_du_rabot_cumule_et_ne_rabote_plus_les_memes_cles(self):
        brut = numpy.zeros_like(self.x)
        brut[:, 1] = 0.3 * numpy.sin(25 * self.x[:, 2])
        bruts = {'k': (brut, None)}
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

        def projeter(champs, repartitions=None, centres=None):
            self.vus.append([d.copy() for d, _ in champs])
            return [numpy.where(bas[:, None], 0.0, d) for d, _ in champs], {'bouchon': 'projette'}

        self.corriger = projeter
        brut = numpy.zeros_like(self.x)
        brut[:, 1] = numpy.where(bas, 0.3 * numpy.sin(15 * self.x[:, 2]), 0.01)
        self.assertGreater(self.hors(brut * self.libre[:, None]), 0)
        fini = self.finir({'k': (brut, None)})['k']
        self.assertTrue(numpy.array_equal(fini, numpy.where(bas[:, None], 0.0, brut * self.libre[:, None])))
        self.assertEqual(len(self.vus), 1)

    def test_une_correction_infaisable_leve_au_bout_des_passes(self):
        """Une carrure de rapport 1,7 porte le cercle de l'anneau le plus épais à 1,7 fois son rayon, au-delà de 1,6."""
        radial = self.x * [1.0, 1.0, 0.0]
        with mock.patch.object(silhouettes, 'PASSES_DE_RABOT', 4), self.assertRaises(RuntimeError) as leve:
            self.finir({'k': (0.21 * radial, 1.7)}, bornes=(0.6, 1.6))
        self.assertRegex(str(leve.exception), r'^[1-9]\d* arête\(s\) hors bornes après 4 passes de rabot$')

    def test_la_correction_se_fait_au_repere_monde_et_le_champ_revient_au_repere_du_mesh(self):
        """Les mêmes clés, au repère monde sous l'identité, et au repère d'un mesh tourné : le champ rendu au repère du
        mesh, porté au monde, est celui du monde ; la carrure vise un rayon, mesuré au monde."""
        radial = self.x * [1.0, 1.0, 0.0]
        au_monde = {'t': (self.translation(), None), 'c': (0.1 * radial, 1.2)}
        attendus = self.finir(au_monde)
        vers_le_monde = rotation()
        vers_le_mesh = numpy.linalg.inv(vers_le_monde)
        rendus = self.finir({nom: (d @ vers_le_mesh, r) for nom, (d, r) in au_monde.items()},
                               vers_le_monde=vers_le_monde)
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

    def test_une_passe_ne_rabote_que_les_noeuds_des_aretes_marquees(self):
        champ = 0.03 * numpy.random.default_rng(3101).standard_normal(self.x.shape)
        marque = numpy.zeros(len(self.aretes), dtype=bool)
        marque[0] = True
        mesures = iter([marque, numpy.zeros_like(marque)])
        resultat, passes = self.raboter(champ, hors=lambda _: next(mesures))
        self.assertEqual(passes, 1)
        valeur = aux_noeuds(champ, self.noeud)
        dans = region_locale(self.aretes, marque, 0, len(valeur))
        attendu = valeur.copy()
        attendu[dans] = RABOT * valeur[dans]
        self.assertTrue(numpy.array_equal(resultat, attendu[self.noeud]))
        self.assertGreater(int((~dans[self.noeud]).sum()), len(self.x) // 2)

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
        self.assertTrue(numpy.allclose(resultat[self.noeud == voisin], RABOT * champ[self.noeud == voisin]))
        self.assertTrue(numpy.array_equal(resultat[self.noeud == loin], champ[self.noeud == loin]))

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
        self.assertTrue(numpy.allclose(resultat[self.noeud == voisin, 0], RABOT * champ[self.noeud == voisin]))

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
        return mesurer_domaine(self.w, self.x, self.aretes, [(self.etats if etats is None else etats, self.matrices, ())], numpy.eye(3) if monde is None else monde)

    def test_un_coin_hors_est_refuse_puis_corrige_collectivement(self):
        sans_coins = {'cellulesSilhouettes': [], 'etats': [e
                      for e in self.etats['etats'] if sum(v != 0 for v in e['poidsSilhouettes'].values()) <= 1]}
        for e in sans_coins['etats']:
            champ = sum(e['poidsSilhouettes'][n] * d for n, d in self.champs.items())
            self.assertFalse(hors_de(rapports(self.p, champ, self.aretes), ETIREMENT_DES_CLES).any(), e['nom'])
        self.assertFalse(any(m.any() for m in self.mesure(sans_coins)(self.champs).values()))
        marques = self.mesure()(self.champs)
        self.assertTrue(all(m.any() for m in marques.values()))
        groupes = etats_ponderes(self.x, self.champs, [(self.etats, self.matrices, ())])
        etat = preparer_correction('coin', self.x, self.w, self.noeud, self.aretes, groupes)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, 'clause R'):
            verifier_repos_cuit(etat)
        z = self.p[:, 2]
        libre = ((z > 0.05) & (z < HAUTEUR - 0.05)).astype(float)
        corriger = correction(self.p, self.aretes, self.noeud, libre == 0,
                              anneaux(self.p, NIVEAUX_DES_ANNEAUX))
        mesure = self.mesure()
        with contextlib.redirect_stdout(io.StringIO()):
            finis, _ = raboter_sous_correction({n: (d, None) for n, d in self.champs.items()}, self.noeud, self.aretes,
                                              libre, corriger, numpy.eye(3), mesure)
        self.assertFalse(any(m.any() for m in self.mesure()(finis).values()))
        for nom in self.champs:
            self.assertGreater(numpy.abs(finis[nom] - self.champs[nom]).max(), 0)
        groupes = etats_ponderes(self.x, finis, [(self.etats, self.matrices, ())])
        etat = preparer_correction('coin', self.x, self.w, self.noeud, self.aretes, groupes)
        with contextlib.redirect_stdout(io.StringIO()):
            verifier_repos_cuit(etat)

    def test_remesure_les_aretes_touchees_par_toute_cle_et_garde_le_repere_monde(self):
        mesure = self.mesure()
        monde = rotation()
        for facteur in (1, 0.5, 0.5):
            champs = {n: d * facteur for n, d in self.champs.items()}
            obtenu = mesure(champs)
            entier = self.mesure()(champs)
            tourne = self.mesure(monde=monde)({n: d @ monde.T for n, d in champs.items()})
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
        (temoin,), _ = corriger([(temoin, None)])
        champs = {**self.champs, 'temoin': temoin}
        mesure = self.mesure()

        def hors(courants):
            marques = mesure({n: courants[n] for n in self.champs})
            return {**marques, 'temoin': numpy.zeros(len(self.aretes), dtype=bool)}

        with contextlib.redirect_stdout(io.StringIO()):
            finis, _ = raboter_sous_correction({n: (d, None) for n, d in champs.items()}, self.noeud, self.aretes,
                                              libre, corriger, numpy.eye(3), hors)
        numpy.testing.assert_allclose(finis['temoin'], temoin, rtol=0, atol=TOLERANCE)
        self.assertTrue(all(numpy.abs(finis[n] - champs[n]).max() > 0 for n in self.champs))
        self.assertFalse(any(m.any() for m in hors(finis).values()))


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
        self.groupes = [({'etats': jeu, 'cellulesSilhouettes': etats['cellulesSilhouettes']}, numpy.eye(4)[None, None], ())
                        for jeu in jeux.values()]
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
        self.assertFalse(any(m.any() for m in mesure(self.champs).values()))
        champs = {**self.champs, 'feminin': self.champs['feminin'].copy()}
        champs['feminin'][self.noeud == self.noeud[loin]] = [0, 0, 1e-4]
        incremental = mesure(champs)
        frais = mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3), derivees)(champs)
        self.assertTrue(incremental['feminin'].any())
        for nom in champs:
            numpy.testing.assert_array_equal(incremental[nom], frais[nom])

    def test_une_cle_croisee_trop_etiree_marque_sa_silhouette(self):
        marques = mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3),
                                  self.derivees('gabarit_legs_plus_feminin', facteur=-5))(self.champs)
        self.assertTrue(marques['feminin'].any())

    def test_une_cle_croisee_hors_bornes_marque_sa_silhouette_aux_seuls_etats_du_gabarit(self):
        self.assertIn('gabarit_legs_plus_feminin', self.cles)
        neutres = [(d, m, c) for d, m, c in self.groupes if all(not p for p in d['etats'][0]['poidsGabarit'].values())]
        self.assertEqual(len(neutres), 1)
        sans = mesurer_domaine(self.w, self.x, self.aretes, neutres, numpy.eye(3), self.derivees('gabarit_legs_plus_feminin'))
        self.assertFalse(any(m.any() for m in sans(self.champs).values()))
        marques = mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3),
                                  self.derivees('gabarit_legs_plus_feminin'))(self.champs)
        self.assertTrue(marques['feminin'].any())
        self.assertFalse(marques['carrure_plus'].any())
        nulles = mesurer_domaine(self.w, self.x, self.aretes, self.groupes, numpy.eye(3),
                                 lambda champs: {nom: numpy.zeros_like(self.p) for nom in self.cles})(self.champs)
        self.assertFalse(any(m.any() for m in nulles.values()))


def groupe_a_un_clip(positions, references, matrices, cellules, demandes=()):
    """`GroupePondere` dont les échantillons de `matrices` après le repos forment un seul clip."""
    return GroupePondere(positions, references, matrices, cellules, demandes, (len(matrices) - 1,) if len(matrices) > 1 else ())


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
    groupes = etats_ponderes(x, champs, [(demandes, matrices, () if clip is None else (1,))])
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
        marques = mesurer_domaine(w, x, aretes, [(demandes, matrices, ())], numpy.eye(3))(champs)
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
        au_repos = mesurer_domaine(w, x, aretes, [(demandes, matrices[:1], ())], numpy.eye(3))(champs)
        self.assertFalse(any(m.any() for m in au_repos.values()))
        en_clip = mesurer_domaine(w, x, aretes, [(demandes, matrices[:1], ()), (demandes, matrices, (1,))], numpy.eye(3))(champs)
        self.assertTrue(all(m[0] for m in en_clip.values()))

    def test_une_topologie_absente_est_un_refus_nomme(self):
        x, _, _, demandes, champs, matrices, _ = arete_du_domaine()
        with self.assertRaisesRegex(RuntimeError, 'topologie-silhouettes-absente'):
            etats_ponderes(x, champs, [({'etats': demandes['etats']}, matrices, ())])

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
        groupes = etats_ponderes(x, champs, [(domaine, matrices, (1,))])
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
        matrices = numpy.concatenate([g[2], g[2]], axis=1)
        w = numpy.column_stack([w, numpy.zeros_like(w)])
        w[2:] = [0, 1]
        matrices[1:, 1] = numpy.eye(4)
        groupe = GroupePondere(positions, references, matrices, g.cellules, g.demandes, g.clips)
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
            etats_ponderes(x, champs, [(incomplets, matrices, ())])

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
