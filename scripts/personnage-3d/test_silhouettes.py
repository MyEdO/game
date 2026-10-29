"""silhouettes.correction sur un cylindre synthétique, contre une résolution KKT directe du même problème, et ses
erreurs nommées."""
import sys
import unittest
from pathlib import Path

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from silhouettes import AnneauIndetectable, AnneauSansNoeudLibre, EpaisseurFigee, correction  # noqa: E402

SECTEURS, NIVEAUX = 12, 14
NIVEAUX_DES_ANNEAUX = (2, 4, 6, 9, 11)
TOLERANCE = 1e-10


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


def anneau(x, niveau):
    """L'anneau du cercle `niveau`, à la forme de `silhouettes.anneaux`."""
    s = list(range(niveau * (SECTEURS + 1), (niveau + 1) * (SECTEURS + 1)))
    centre, axe = x[s].mean(axis=0), numpy.array([0.0, 0.0, 1.0])
    radial = x[s] - centre
    radial -= (radial @ axe)[:, None] * axe
    return {'os': f'niveau_{niveau}', 'sommets': [{'mesh': 'Corps', 'indice': i} for i in s],
            'centre': centre.tolist(), 'rayon': float(numpy.linalg.norm(radial, axis=1).mean()), 'axe': axe.tolist()}


def anneaux(x, niveaux, le_plus_epais=None):
    liste = [anneau(x, niveau) for niveau in niveaux]
    epais = int(numpy.argmax([a['rayon'] for a in liste])) if le_plus_epais is None else le_plus_epais
    return {'anneaux': liste, 'lePlusEpais': epais}


def kkt(x, aretes, noeud, fixe, lus, d0, rapport):
    """Le même problème que `correction`, posé sommet par sommet et résolu par son système KKT entier."""
    nv = len(x)
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
        hauteur = 0.1 * (NIVEAUX - 1)
        self.fixe = (self.x[:, 2] < 0.05) | (self.x[:, 2] > hauteur - 0.05)
        self.rng = numpy.random.default_rng(3101)

    def lisse(self):
        frequences = self.rng.uniform(1, 4, (3, 2))
        return numpy.stack([numpy.sin(self.x[:, 2] * f + p) for f, p in frequences], axis=1) * 0.02

    def cle(self):
        """Un champ de clé tel que `finir_les_silhouettes` le passe : nul aux sommets fixes, égal entre jumeaux."""
        d0 = self.lisse() + 0.01 * self.rng.standard_normal(self.x.shape)
        d0[self.fixe] = 0
        return d0[self.noeud]

    def assert_comme_kkt(self, lus, champs):
        corriges, sonde = correction(self.x, self.aretes, self.noeud, self.fixe, lus)(champs)
        self.assertEqual(set(sonde), {'noeuds_libres', 'contraintes', 'resolution_s'})
        for (d0, rapport), d in zip(champs, corriges):
            ecart = numpy.abs(d - kkt(self.x, self.aretes, self.noeud, self.fixe, lus, d0, rapport)).max()
            self.assertLess(ecart, TOLERANCE, f'rapport {rapport}')

    def test_egale_la_resolution_kkt_directe(self):
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX),
                              [(self.cle(), None), (self.cle(), 0.72), (self.cle(), 1.7)])

    def test_moyenne_aux_noeuds_une_source_non_nulle_aux_fixes_et_discordante_entre_jumeaux(self):
        self.assert_comme_kkt(anneaux(self.x, NIVEAUX_DES_ANNEAUX), [(self.lisse(), 1.7)])

    def test_un_anneau_le_plus_epais_tout_fixe_se_tient_sans_rapport_vise(self):
        self.assert_comme_kkt(anneaux(self.x, (0, *NIVEAUX_DES_ANNEAUX), le_plus_epais=0), [(self.cle(), None)])

    def test_un_rapport_vise_sur_un_anneau_le_plus_epais_tout_fixe_leve_epaisseur_figee(self):
        lus = anneaux(self.x, (0, *NIVEAUX_DES_ANNEAUX), le_plus_epais=0)
        with self.assertRaises(EpaisseurFigee) as leve:
            correction(self.x, self.aretes, self.noeud, self.fixe, lus)([(self.cle(), None), (self.cle(), 1.7)])
        self.assertIsInstance(leve.exception, AnneauIndetectable)
        self.assertIn('niveau_0', str(leve.exception))

    def test_un_corps_sans_noeud_libre_leve_anneau_sans_noeud_libre(self):
        with self.assertRaises(AnneauSansNoeudLibre) as leve:
            correction(self.x, self.aretes, self.noeud, numpy.ones(len(self.x), dtype=bool),
                       anneaux(self.x, NIVEAUX_DES_ANNEAUX))
        self.assertIsInstance(leve.exception, AnneauIndetectable)


if __name__ == '__main__':
    unittest.main()
