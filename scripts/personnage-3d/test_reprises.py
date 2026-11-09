"""reprises.Reprises : une étape écrite se relit, scène rouverte ; une étape coupée avant son pointeur laisse la
précédente ; une étape nouvelle retire les anciennes ; `effacer` retire les reprises de toutes les constructions, qu'une
construction encore en cours réécrit. `dossier_de_construction` nomme le dossier par l'empreinte, sous le
`git-common-dir`. Une scène Blender réelle traverse l'écriture et la relecture (#3319, #3793)."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import bpy
import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from reprises import ETAT, POINTEUR, SCENE, Reprises, dossier_de_construction  # noqa: E402


def blender(dossier):
    return Reprises(dossier,
                    lambda chemin: bpy.ops.wm.save_as_mainfile(filepath=str(chemin), copy=True, relative_remap=False),
                    lambda chemin: bpy.ops.wm.open_mainfile(filepath=str(chemin), load_ui=False))


class Reprise(unittest.TestCase):
    def setUp(self):
        self.racine = Path(tempfile.mkdtemp()) / 'reprises-3d'
        self.dossier = self.racine / 'a'
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_sans_etape_rien_ne_se_lit(self):
        self.assertIsNone(blender(self.dossier).lire())

    def test_une_etape_se_relit_avec_sa_scene(self):
        maillage = bpy.data.meshes.new('peau')
        maillage.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])
        objet = bpy.data.objects.new('peau', maillage)
        bpy.context.scene.collection.objects.link(objet)
        objet.vertex_groups.new(name='os').add([1], 0.25, 'REPLACE')
        blender(self.dossier).ecrire('passe-0003', {'passe': 3, 'rabot': numpy.arange(4.0)})
        bpy.ops.wm.read_factory_settings(use_empty=True)
        etat = blender(self.dossier).lire()
        self.assertEqual(etat['passe'], 3)
        numpy.testing.assert_array_equal(etat['rabot'], numpy.arange(4.0))
        lu = bpy.data.objects['peau']
        self.assertAlmostEqual(lu.vertex_groups['os'].weight(1), 0.25)

    def test_une_etape_coupee_avant_son_pointeur_laisse_la_precedente(self):
        reprises = blender(self.dossier)
        reprises.ecrire('passe-0001', {'passe': 1})
        coupee = Reprises(self.dossier, reprises.sauver, reprises.ouvrir)
        coupee.sauver = lambda chemin: (_ for _ in ()).throw(KeyboardInterrupt())
        with self.assertRaises(KeyboardInterrupt):
            coupee.ecrire('passe-0002', {'passe': 2})
        self.assertEqual(reprises.lire()['passe'], 1)

    def test_une_etape_nouvelle_retire_les_anciennes(self):
        reprises = blender(self.dossier)
        reprises.ecrire('passe-0001', {'passe': 1})
        reprises.ecrire('point-fixe', {'passe': 2})
        self.assertEqual(sorted(p.name for p in self.dossier.iterdir()), [POINTEUR, 'point-fixe'])
        self.assertEqual(sorted(p.name for p in (self.dossier / 'point-fixe').iterdir()), sorted([SCENE, ETAT]))

    def test_effacer_retire_toutes_les_constructions_qu_une_construction_en_cours_reecrit(self):
        abandonnee, en_cours = blender(self.racine / 'b'), blender(self.racine / 'c')
        abandonnee.ecrire('passe-0001', {'passe': 1})
        en_cours.ecrire('passe-0001', {'passe': 1})
        finie = blender(self.dossier)
        finie.ecrire('point-fixe', {'passe': 9})
        finie.effacer()
        self.assertFalse(self.racine.exists())
        en_cours.ecrire('passe-0002', {'passe': 2})
        self.assertEqual(en_cours.lire()['passe'], 2)

    def test_l_empreinte_nomme_le_dossier_sous_le_git_common_dir(self):
        racine = Path(__file__).resolve().parents[2]
        commun = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=racine,
                                capture_output=True, check=True, text=True).stdout.strip()
        dossier = dossier_de_construction(racine, {'os': 65})
        self.assertEqual(dossier.parent, Path(commun) / 'reprises-3d')
        self.assertEqual(dossier, dossier_de_construction(racine, {'os': 65}))
        self.assertNotEqual(dossier, dossier_de_construction(racine, {'os': 66}))


if __name__ == '__main__':
    unittest.main()
