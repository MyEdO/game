"""silhouettes.correction sur un cylindre synthétique, contre une résolution KKT directe du même problème, et ses
erreurs nommées ; silhouettes.alterner, lissage et correction jusqu'aux bornes d'étirement ; formes.lisser, région
pleine et locale ; silhouettes.en_clip, mesure incrémentale égale à la mesure entière."""
import contextlib
import io
import sys
import unittest
from pathlib import Path

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import silhouettes  # noqa: E402
from formes import aux_noeuds, lisser, pas_laplacien, rapports  # noqa: E402
from poids import PASSES_MAX  # noqa: E402
from silhouettes import (AnneauIndetectable, ComposanteSansAppui, ContraintesLiees, alterner, correction,  # noqa: E402
                         en_clip, hors_de)

SECTEURS, NIVEAUX = 12, 14
NIVEAUX_DES_ANNEAUX = (2, 4, 6, 9, 11)
TOLERANCE = 1e-10
HAUTEUR = 0.1 * (NIVEAUX - 1)


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
            ligne[c * nv + i], ligne[c * nv + j] = 1, -1
            differences.append(ligne)
    differences = numpy.array(differences)
    hessienne = 2 * differences.T @ differences
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

    def test_egale_la_resolution_kkt_directe(self):
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX),
                              [(self.cle(), None), (self.cle(), 0.72), (self.cle(), 1.7)])

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


class Alternance(unittest.TestCase):
    """Un cylindre aux cercles des bouts invariants et aux deux cercles suivants en fondu ; une clé sans rapport qui
    translate tout le tronc : la correction, qui garde le centre de chaque anneau, la ramène en cisaillant les arêtes
    d'entre anneaux."""
    BORNES = (0.5, 2.0)

    def setUp(self):
        self.x, self.noeud, self.aretes = cylindre()
        z = self.x[:, 2]
        self.libre = numpy.clip((numpy.minimum(z, HAUTEUR - z) - 0.05) / 0.2, 0.0, 1.0)
        self.en_fondu = (self.libre > 0) & (self.libre < 1)
        self.vus = []
        corriger = correction(self.x, self.aretes, self.noeud, self.libre == 0, anneaux(self.x, NIVEAUX_DES_ANNEAUX))

        def corriger_et_noter(champs):
            corriges, sonde = corriger(champs)
            self.vus.append(([d for d, _ in champs], corriges))
            return corriges, sonde

        self.corriger = corriger_et_noter

    def translation(self):
        brut = numpy.zeros_like(self.x)
        brut[:, 0] = 0.1
        brut[:, 1] = 0.1 * numpy.sin(5 * self.x[:, 2])
        return brut

    def alterner(self, bruts, bornes=BORNES):
        with contextlib.redirect_stdout(io.StringIO()):
            return alterner(bruts, self.x, self.noeud, self.aretes, self.libre, self.corriger, numpy.eye(3),
                            lambda _, d: self.masque(d, bornes), 'pleine')

    def masque(self, champ, bornes=BORNES):
        return hors_de(rapports(self.x, champ, self.aretes), bornes)

    def hors(self, champ, bornes=BORNES):
        return int(self.masque(champ, bornes).sum())

    def test_une_cle_que_la_correction_sort_des_bornes_y_rentre(self):
        fini = self.alterner({'k': (self.translation(), None)})['k']
        (premier,), (corrige,) = self.vus[0]
        self.assertEqual(self.hors(premier), 0)
        self.assertGreater(self.hors(corrige), 0)
        self.assertEqual(self.hors(fini), 0)
        self.assertEqual(numpy.abs(fini[self.libre == 0]).max(), 0.0)

    def test_le_fondu_ne_se_reapplique_pas_au_tour_suivant(self):
        self.alterner({'k': (self.translation(), None)})
        self.assertGreaterEqual(len(self.vus), 2)
        (_,), (corrige,) = self.vus[0]
        (second,), _ = self.vus[1]
        sans_fondu, _ = lisser(corrige, self.x, self.noeud, self.aretes, (self.libre > 0).astype(float), self.masque,
                               PASSES_MAX, 'pleine')
        refondu, _ = lisser(corrige, self.x, self.noeud, self.aretes, self.libre, self.masque, PASSES_MAX, 'pleine')
        self.assertGreater(numpy.abs(refondu - sans_fondu)[self.en_fondu].max(), 1e-3)
        self.assertLess(numpy.abs(second - sans_fondu)[self.en_fondu].max(), TOLERANCE)

    def test_une_alternance_qui_ne_converge_pas_leve(self):
        """Une carrure de rapport 1,7 porte le cercle de l'anneau le plus épais à 1,7 fois son rayon, au-delà de 1,6."""
        radial = self.x * [1.0, 1.0, 0.0]
        with self.assertRaises(RuntimeError) as leve:
            self.alterner({'k': (0.21 * radial, 1.7)}, bornes=(0.6, 1.6))
        self.assertRegex(str(leve.exception),
                         r'^k : [1-9]\d* arête\(s\) hors bornes après 5 tours de correction$')


class Lissage(unittest.TestCase):
    """formes.lisser sur le cylindre : une bosse tangente sur un seul nœud du niveau 7 sort ses arêtes de `BORNES`."""
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

    def lisser(self, champ, region, facteur=None, hors=None):
        return lisser(champ, self.x, self.noeud, self.aretes, self.facteur if facteur is None else facteur,
                      hors or self.hors, PASSES_MAX, region)

    def test_le_pas_local_ne_change_que_la_region_et_converge(self):
        local, _ = self.lisser(self.bosse, 'locale')
        self.assertFalse(hors_de(rapports(self.x, local, self.aretes), self.BORNES).any())
        plein, _ = self.lisser(self.bosse, 'pleine')
        touches_en_local = numpy.abs(local).max(axis=1) > 0
        touches_en_plein = numpy.abs(plein).max(axis=1) > 0
        self.assertTrue((touches_en_plein & ~touches_en_local).any())
        self.assertFalse((touches_en_local & ~touches_en_plein).any())

    def test_la_convergence_voit_une_arete_hors_de_la_region_de_depart(self):
        local, _ = self.lisser(self.bosse, 'locale')
        depart = numpy.zeros(len(self.x), dtype=bool)
        depart[self.aretes[self.vus[0]].ravel()] = True
        dehors = [m & ~depart[self.aretes].all(axis=1) for m in self.vus[1:]]
        self.assertTrue(any(m.any() for m in dehors))
        self.assertFalse(hors_de(rapports(self.x, local, self.aretes), self.BORNES).any())

    def test_une_arete_hors_bornes_aux_deux_extremites_tenues_leve(self):
        facteur = numpy.ones(len(self.x))
        tenue = self.aretes[0]
        facteur[numpy.isin(self.noeud, tenue)] = 0.0
        marque = numpy.zeros(len(self.aretes), dtype=bool)
        marque[0] = True
        for region in ('pleine', 'locale'):
            with self.assertRaises(RuntimeError) as leve:
                self.lisser(self.bosse, region, facteur, lambda _: marque)
            self.assertRegex(str(leve.exception), r'^1 arête\(s\) hors bornes aux deux extrémités tenues')

    def test_le_pas_plein_est_le_pas_laplacien_itere_aux_noeuds_puis_le_facteur(self):
        z = self.x[:, 2]
        libre = numpy.clip((numpy.minimum(z, HAUTEUR - z) - 0.05) / 0.2, 0.0, 1.0)
        champ = 0.03 * numpy.random.default_rng(3101).standard_normal(self.x.shape)
        resultat, passes = self.lisser(champ, 'pleine', libre)
        self.assertGreater(passes, 1)
        valeur = aux_noeuds(champ, self.noeud)
        for _ in range(passes):
            valeur = pas_laplacien(valeur, self.aretes)
        self.assertTrue(numpy.array_equal(resultat, valeur[self.noeud] * libre[:, None]))


class EnClip(unittest.TestCase):
    """silhouettes.en_clip sur le cylindre, deux os (bas et haut du tronc) et trois échantillons de peau : une bosse
    tangente de 0,5 m sur un nœud sort ses arêtes de `ETIREMENT_EN_CLIP`."""
    BOSSES = (7 * (SECTEURS + 1) + 3, 4 * (SECTEURS + 1) + 8)

    def setUp(self):
        x, self.noeud, self.aretes = cylindre()
        self.x = numpy.concatenate([x, numpy.ones((len(x), 1))], axis=1).astype(numpy.float32)
        haut = numpy.clip((x[:, 2] - 0.4) / 0.5, 0.0, 1.0)
        self.w = numpy.stack([1.0 - haut, haut], axis=1).astype(numpy.float32)
        self.longueurs = numpy.linalg.norm(x[self.aretes[:, 0]] - x[self.aretes[:, 1]], axis=1)
        angle = 0.6
        plie = numpy.eye(4)
        plie[:3, :3] = [[1, 0, 0], [0, numpy.cos(angle), -numpy.sin(angle)], [0, numpy.sin(angle), numpy.cos(angle)]]
        decale = numpy.eye(4)
        decale[:3, 3] = [0.02, 0.0, 0.01]
        self.matrices = numpy.array([[numpy.eye(4), numpy.eye(4)], [numpy.eye(4), plie], [decale, plie]],
                                    dtype=numpy.float32)
        self.mesurees = []
        extremes = silhouettes.extremes

        def compter(w, x, decalages, aretes, longueurs, matrices):
            self.mesurees.append(len(aretes))
            return extremes(w, x, decalages, aretes, longueurs, matrices)

        silhouettes.extremes = compter
        self.addCleanup(setattr, silhouettes, 'extremes', extremes)

    def mesure(self):
        return en_clip(self.w, self.x, self.aretes, self.longueurs, self.matrices, numpy.eye(3))

    def bosse(self, sommet):
        champ = numpy.zeros((len(self.x), 3))
        champ[self.noeud == self.noeud[sommet]] = [0.0, 0.5, 0.0]
        return champ

    def test_ne_remesure_que_les_aretes_touchees_et_egale_la_mesure_entiere(self):
        incrementale = self.mesure()
        champs = [self.bosse(self.BOSSES[0]), self.bosse(self.BOSSES[1]), self.bosse(self.BOSSES[1])]
        for champ in champs:
            masque = incrementale('k', champ)
            self.assertTrue(masque.any())
            self.assertTrue(numpy.array_equal(masque, self.mesure()('k', champ)))
        self.assertEqual(self.mesurees[0], len(self.aretes))
        bougees = (champs[0] != champs[1]).any(axis=1)[self.aretes].any(axis=1)
        self.assertEqual(self.mesurees[2], int(bougees.sum()))
        self.assertLess(self.mesurees[2], len(self.aretes))
        self.assertEqual(len(self.mesurees), 5)

    def test_chaque_cle_garde_sa_mesure(self):
        incrementale = self.mesure()
        incrementale('a', self.bosse(self.BOSSES[0]))
        masque = incrementale('b', self.bosse(self.BOSSES[1]))
        self.assertEqual(self.mesurees[1], len(self.aretes))
        self.assertTrue(numpy.array_equal(masque, self.mesure()('b', self.bosse(self.BOSSES[1]))))


if __name__ == '__main__':
    unittest.main()
