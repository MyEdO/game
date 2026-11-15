"""portage (#4002 issuecomment-6817454030) sur des squelettes de fixture : continuité de T = C + H à l'articulation,
axe de tronc d'un os latéralisé du tronc, aller-retour de la table locale, stockage sur l'armature."""
import sys
import unittest
from pathlib import Path
from unittest import mock

import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

import portage  # noqa: E402
from portage import (OS_DES_SILHOUETTES, axes_de_chair, deplacements_du_manifeste, ecrire_os_des_silhouettes,  # noqa: E402
                     lire_os_des_silhouettes, projete, table_locale, tetes_portees)
from silhouettes import carrure  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

RAPPORT = 1.7
TOLERANCE = 1e-12
TOLERANCE_DES_REPERES = 1e-6
"""Écart admis aux grandeurs qui passent par les vecteurs et matrices `mathutils`, en simple précision."""


class Os:
    """Un os d'armature au repos, aux champs que lit `portage`."""

    def __init__(self, nom, parent, tete, queue):
        self.name, self.parent = nom, parent
        self.head_local, self.tail_local = Vector(tete), Vector(queue)
        rotation = (self.tail_local - self.head_local).to_track_quat('Y', 'Z').to_matrix().to_4x4()
        self.matrix_local = Matrix.Translation(self.head_local) @ rotation


class Os_:
    def __init__(self, liste):
        self.liste, self.par_nom = liste, {b.name: b for b in liste}

    def __iter__(self):
        return iter(self.liste)

    def __getitem__(self, nom):
        return self.par_nom[nom]


class Squelette(dict):
    """Une armature : ses os et sa matrice monde ; ses propriétés personnalisées, celles d'un `dict`."""

    def __init__(self, os_, monde):
        super().__init__()
        self.data = type('Donnees', (), {'bones': Os_(os_)})()
        self.matrix_world = monde


def squelette(*definitions, monde=None):
    os_ = {}
    for nom, parent, tete, queue in definitions:
        os_[nom] = Os(nom, os_.get(parent), tete, queue)
    return Squelette(list(os_.values()), monde or Matrix.Identity(4))


def monde_tourne():
    return Matrix.Translation((0.3, -0.2, 0.1)) @ Matrix.Rotation(0.4, 4, 'X') @ Matrix.Rotation(-0.7, 4, 'Z')


def chair_autour(rng, tete, queue, rayon, n=40):
    """`n` points de chair au hasard autour du segment `tete` → `queue`, hors de son axe."""
    tete, queue = numpy.array(tete), numpy.array(queue)
    t = rng.uniform(0.1, 0.9, n)
    return tete + t[:, None] * (queue - tete) + rng.normal(0, rayon, (n, 3))


def chair_symetrique(tete, queue, rayon, n=12):
    """`n` points de chair en cercle autour du milieu du segment `tete` → `queue` : leur centroïde est sur l'os."""
    tete, queue = numpy.array(tete, dtype=float), numpy.array(queue, dtype=float)
    axe = (queue - tete) / numpy.linalg.norm(queue - tete)
    u = numpy.cross(axe, [0.0, 0.0, 1.0] if abs(axe[2]) < 0.9 else [1.0, 0.0, 0.0])
    u /= numpy.linalg.norm(u)
    v = numpy.cross(axe, u)
    angles = 2 * numpy.pi * numpy.arange(n) / n
    return (tete + queue) / 2 + rayon * (numpy.cos(angles)[:, None] * u + numpy.sin(angles)[:, None] * v)


def peau(rig, chairs):
    """Les sommets et poids (`poids.peau_lineaire`) d'une peau dont chaque groupe de `chairs` (nom d'os -> points) est
    tout à son os."""
    noms = [b.name for b in rig.data.bones]
    x = numpy.concatenate([chairs[n] for n in chairs])
    w = numpy.zeros((len(x), len(noms)))
    debut = 0
    for nom, points in chairs.items():
        w[debut:debut + len(points), noms.index(nom)] = 1.0
        debut += len(points)
    return numpy.hstack([x, numpy.ones((len(x), 1))]), w


def axes_de(rig, x, w):
    with mock.patch.object(portage, 'peau_lineaire', return_value=(x, w)):
        return axes_de_chair(rig, 'corps')


class Portage(unittest.TestCase):
    def setUp(self):
        self.rng = numpy.random.default_rng(4002)

    def test_t_est_continu_a_l_articulation_de_deux_os_non_colineaires(self):
        rig = squelette(('thigh_l', None, (0.1, 0.0, 1.0), (0.12, 0.05, 0.55)),
                        ('calf_l', 'thigh_l', (0.12, 0.05, 0.55), (0.1, -0.1, 0.1)), monde=monde_tourne())
        monde = numpy.array(rig.matrix_world)
        chairs = {'thigh_l': chair_autour(self.rng, (0.1, 0.0, 1.0), (0.12, 0.05, 0.55), 0.06),
                  'calf_l': chair_autour(self.rng, (0.12, 0.05, 0.55), (0.1, -0.1, 0.1), 0.04)}
        chairs = {n: (numpy.hstack([p, numpy.ones((len(p), 1))]) @ monde.T)[:, :3] for n, p in chairs.items()}
        _, w = peau(rig, chairs)
        x = numpy.concatenate(list(chairs.values()))
        axes = axes_de(rig, numpy.hstack([x, numpy.ones((len(x), 1))]), w)
        self.assertGreater(numpy.linalg.norm(numpy.cross(axes['thigh_l'][1], axes['calf_l'][1])), 0.1)
        unites = tetes_portees(rig, axes, set())
        d = deplacements_du_manifeste(rig, table_locale(rig, {o: (RAPPORT - 1) * v for o, v in unites.items()}))
        noms = [b.name for b in rig.data.bones]
        j = (monde @ numpy.array([0.12, 0.05, 0.55, 1.0]))[:3]
        sommets, poids = numpy.array([j, j]), numpy.eye(2)
        t = portage.portage(poids, noms, d) + carrure(sommets, poids, noms, axes, RAPPORT)
        self.assertGreater(numpy.linalg.norm(d['calf_l']), 0.01)
        numpy.testing.assert_allclose(t[0], t[1], rtol=0, atol=TOLERANCE_DES_REPERES)

    def test_un_os_lateralise_du_tronc_prend_l_axe_du_tronc_et_porte_son_enfant_de_sa_distance_a_cet_axe(self):
        spine = ((0.0, 0.02, 1.2), (0.0, 0.0, 1.45))
        clavicule = ((0.03, 0.0, 1.4), (0.17, 0.02, 1.42))
        bras = ((0.18, 0.03, 1.4), (0.2, 0.05, 1.1))
        rig = squelette(('spine_03', None, *spine), ('clavicle_l', 'spine_03', *clavicule),
                        ('upperarm_l', 'clavicle_l', *bras))
        chairs = {'spine_03': chair_autour(self.rng, *spine, 0.1), 'clavicle_l': chair_autour(self.rng, *clavicule, 0.03),
                  'upperarm_l': chair_symetrique(*bras, 0.05)}
        axes = axes_de(rig, *peau(rig, chairs))
        tronc = axes['spine_03']
        numpy.testing.assert_allclose(tronc[0], chairs['spine_03'].mean(axis=0), rtol=0, atol=TOLERANCE)
        numpy.testing.assert_array_equal(tronc[1], [0.0, 0.0, 1.0])
        unites = tetes_portees(rig, axes, set())
        numpy.testing.assert_array_equal(unites['clavicle_l'] - unites['spine_03'], [0.0, 0.0, 0.0])
        j = numpy.array(bras[0])
        self.assertGreater(numpy.linalg.norm(j - projete(tronc, j)), 0.1)
        numpy.testing.assert_allclose(unites['upperarm_l'] - unites['clavicle_l'], j - projete(tronc, j),
                                      rtol=0, atol=TOLERANCE_DES_REPERES)

    def test_la_table_locale_rend_les_deplacements_monde_a_l_aller_retour(self):
        rig = squelette(('pelvis', None, (0, 0, 1), (0, 0, 1.1)), ('thigh_l', 'pelvis', (0.1, 0, 1), (0.12, 0.05, 0.55)),
                        ('calf_l', 'thigh_l', (0.12, 0.05, 0.55), (0.1, -0.1, 0.1)),
                        ('foot_l', 'calf_l', (0.1, -0.1, 0.1), (0.1, 0.05, 0.02)), monde=monde_tourne())
        deplacements = {'pelvis': numpy.zeros(3), 'thigh_l': self.rng.normal(0, 0.1, 3),
                        'calf_l': self.rng.normal(0, 0.1, 3)}
        deplacements['foot_l'] = deplacements['calf_l'].copy()
        table = table_locale(rig, deplacements)
        self.assertEqual(set(table), {'thigh_l', 'calf_l'})
        self.assertTrue(all(isinstance(v, float) for t in table.values() for v in t))
        for nom, d in deplacements_du_manifeste(rig, table).items():
            numpy.testing.assert_allclose(d, deplacements[nom], rtol=0, atol=TOLERANCE, err_msg=nom)

    def test_la_table_vit_sur_l_armature_et_se_lit_vide_sans_elle(self):
        rig = squelette(('pelvis', None, (0, 0, 1), (0, 0, 1.1)))
        self.assertEqual(lire_os_des_silhouettes(rig), {})
        tables = {'carrure_plus': {'thigh_l': [0.1, 0.0, -0.2]}, 'carrure_moins': {}}
        ecrire_os_des_silhouettes(rig, tables)
        self.assertIsInstance(rig[OS_DES_SILHOUETTES], str)
        self.assertEqual(lire_os_des_silhouettes(rig), tables)

if __name__ == '__main__':
    unittest.main()
