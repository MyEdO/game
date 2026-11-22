"""reprises.Reprises : une étape écrite se relit, scène rouverte ; une étape coupée avant son pointeur laisse la
précédente ; une étape nouvelle retire les anciennes ; `effacer` retire les reprises de sa construction et
celles, périmées, des autres (#3173).
`dossier_de_construction` nomme le dossier par l'empreinte, sous le `git-common-dir`. Une scène Blender réelle traverse
l'écriture et la relecture, attribut `ATTRIBUT_SOMMET` et clip sans porteur compris (#3319, #3793, #3280). `reprendre`
joue, après l'étape relue, les seules étapes qui la suivent (#3280)."""
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import bpy
import numpy

sys.path.insert(0, str(Path(__file__).resolve().parent / 'base'))

from cuisson_gabarit import ATTRIBUT_SOMMET  # noqa: E402
from reprises import ETAT, PEREMPTION_S, POINTEUR, SCENE, Reprises, dossier_de_construction, reprendre  # noqa: E402

ETAPES = ('point-fixe', 'membres', 'deux-mains')


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
        blender(self.dossier).ecrire('passe-0003', {'passe': 3, 'captures': numpy.arange(4.0)})
        bpy.ops.wm.read_factory_settings(use_empty=True)
        etat = blender(self.dossier).lire()
        self.assertEqual(etat['passe'], 3)
        numpy.testing.assert_array_equal(etat['captures'], numpy.arange(4.0))
        lu = bpy.data.objects['peau']
        self.assertAlmostEqual(lu.vertex_groups['os'].weight(1), 0.25)

    def test_l_attribut_du_gabarit_et_un_clip_sans_porteur_traversent_la_reprise(self):
        maillage = bpy.data.meshes.new('peau')
        maillage.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])
        bpy.context.scene.collection.objects.link(bpy.data.objects.new('peau', maillage))
        maillage.attributes.new(ATTRIBUT_SOMMET, 'INT', 'POINT').data.foreach_set('value', [7, 8, 9])
        bpy.data.actions.new('deux_mains_derive').use_fake_user = True
        blender(self.dossier).ecrire('deux-mains', {'objets': {'clips': ['deux_mains_derive']}})
        bpy.ops.wm.read_factory_settings(use_empty=True)
        etat = blender(self.dossier).lire()
        valeurs = numpy.zeros(3, dtype=numpy.int32)
        bpy.data.objects['peau'].data.attributes[ATTRIBUT_SOMMET].data.foreach_get('value', valeurs)
        numpy.testing.assert_array_equal(valeurs, [7, 8, 9])
        self.assertEqual([bpy.data.actions[n].name for n in etat['objets']['clips']], ['deux_mains_derive'])

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

    def test_effacer_laisse_la_reprise_d_une_autre_empreinte(self):
        autre = blender(self.racine / 'b')
        autre.ecrire('passe-0001', {'passe': 1})
        finie = blender(self.dossier)
        finie.ecrire('point-fixe', {'passe': 9})
        finie.effacer()
        self.assertFalse(self.dossier.exists())
        self.assertIsNone(finie.lire())
        self.assertEqual(autre.lire()['passe'], 1)

    def test_effacer_retire_la_reprise_perimee_d_une_autre_empreinte(self):
        autre = blender(self.racine / 'b')
        autre.ecrire('passe-0001', {'passe': 1})
        ancien = time.time() - PEREMPTION_S - 60
        os.utime(self.racine / 'b', (ancien, ancien))
        finie = blender(self.dossier)
        finie.ecrire('point-fixe', {'passe': 9})
        finie.effacer()
        self.assertEqual(list(self.racine.iterdir()), [])

    def test_l_empreinte_nomme_le_dossier_sous_le_git_common_dir(self):
        racine = Path(__file__).resolve().parents[2]
        commun = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=racine,
                                capture_output=True, check=True, text=True).stdout.strip()
        dossier = dossier_de_construction(racine, {'os': 65})
        self.assertEqual(dossier.parent, Path(commun) / 'reprises-3d')
        self.assertEqual(dossier, dossier_de_construction(racine, {'os': 65}))
        self.assertNotEqual(dossier, dossier_de_construction(racine, {'os': 66}))


class Reprendre(unittest.TestCase):
    """La reprise relue nomme sa `phase` ; `reprendre` en joue la suite, chaque étape suivie de son écriture."""

    def jouer(self, faite):
        journal = []
        reprendre({nom: (lambda nom=nom: journal.append(('joue', nom))) for nom in ETAPES}, faite,
                  lambda nom: journal.append(('ecrit', nom)))
        return journal

    def relue(self, phase):
        dossier = Path(tempfile.mkdtemp()) / 'reprises-3d' / 'a'
        bpy.ops.wm.read_factory_settings(use_empty=True)
        blender(dossier).ecrire(phase, {'phase': phase})
        return blender(dossier).lire()['phase']

    def test_au_milieu_du_point_fixe_toutes_les_etapes_se_jouent(self):
        self.assertEqual(self.jouer('gabarit'), [(geste, nom) for nom in ETAPES for geste in ('joue', 'ecrit')])

    def test_une_reprise_membres_ne_rejoue_pas_la_passe_du_pack(self):
        self.assertEqual(self.jouer(self.relue('membres')), [('joue', 'deux-mains'), ('ecrit', 'deux-mains')])

    def test_une_reprise_deux_mains_ne_rejoue_ni_la_passe_ni_la_derivation(self):
        self.assertEqual(self.jouer(self.relue('deux-mains')), [])


if __name__ == '__main__':
    unittest.main()
