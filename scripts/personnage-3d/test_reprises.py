"""reprises.Reprises : une étape écrite se relit sous la même empreinte, scène rouverte ; une autre empreinte la refuse ;
une étape coupée avant son pointeur laisse la précédente ; une étape nouvelle retire les anciennes. Une scène Blender
réelle traverse l'écriture et la relecture."""
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from reprises import ETAT, POINTEUR, SCENE, EmpreinteDifferente, Reprises, empreinte_de_construction  # noqa: E402


def blender(dossier, empreinte):
    return Reprises(dossier, empreinte,
                    lambda chemin: bpy.ops.wm.save_as_mainfile(filepath=str(chemin), copy=True, relative_remap=False),
                    lambda chemin: bpy.ops.wm.open_mainfile(filepath=str(chemin), load_ui=False))


class Reprise(unittest.TestCase):
    def setUp(self):
        self.dossier = Path(tempfile.mkdtemp()) / 'reprises'
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_sans_etape_rien_ne_se_lit(self):
        self.assertIsNone(blender(self.dossier, 'a').lire())

    def test_une_etape_se_relit_avec_sa_scene(self):
        maillage = bpy.data.meshes.new('peau')
        maillage.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])
        objet = bpy.data.objects.new('peau', maillage)
        bpy.context.scene.collection.objects.link(objet)
        objet.vertex_groups.new(name='os').add([1], 0.25, 'REPLACE')
        blender(self.dossier, 'a').ecrire('passe-0003', {'passe': 3, 'rabot': numpy.arange(4.0)})
        bpy.ops.wm.read_factory_settings(use_empty=True)
        etat = blender(self.dossier, 'a').lire()
        self.assertEqual(etat['passe'], 3)
        numpy.testing.assert_array_equal(etat['rabot'], numpy.arange(4.0))
        lu = bpy.data.objects['peau']
        self.assertAlmostEqual(lu.vertex_groups['os'].weight(1), 0.25)

    def test_une_autre_empreinte_est_refusee(self):
        blender(self.dossier, 'a').ecrire('passe-0001', {'passe': 1})
        with self.assertRaises(EmpreinteDifferente):
            blender(self.dossier, 'b').lire()

    def test_une_etape_coupee_avant_son_pointeur_laisse_la_precedente(self):
        reprises = blender(self.dossier, 'a')
        reprises.ecrire('passe-0001', {'passe': 1})
        coupee = Reprises(self.dossier, 'a', reprises.sauver, reprises.ouvrir)
        coupee.sauver = lambda chemin: (_ for _ in ()).throw(KeyboardInterrupt())
        with self.assertRaises(KeyboardInterrupt):
            coupee.ecrire('passe-0002', {'passe': 2})
        self.assertEqual(reprises.lire()['passe'], 1)

    def test_une_etape_nouvelle_retire_les_anciennes(self):
        reprises = blender(self.dossier, 'a')
        reprises.ecrire('passe-0001', {'passe': 1})
        reprises.ecrire('point-fixe', {'passe': 2})
        self.assertEqual(sorted(p.name for p in self.dossier.iterdir()), [POINTEUR, 'point-fixe'])
        self.assertEqual(sorted(p.name for p in (self.dossier / 'point-fixe').iterdir()), sorted([SCENE, ETAT]))

    def test_l_empreinte_suit_les_arguments(self):
        racine = Path(__file__).resolve().parents[2]
        self.assertEqual(empreinte_de_construction(racine, {'os': 65}), empreinte_de_construction(racine, {'os': 65}))
        self.assertNotEqual(empreinte_de_construction(racine, {'os': 65}), empreinte_de_construction(racine, {'os': 66}))


if __name__ == '__main__':
    unittest.main()
