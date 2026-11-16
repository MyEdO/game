"""Les entrées d'une reconstruction (`entrees.py`, #3412) : sur des sujets nommés, ce qui reconstruit un élément ou un modèle
de véhicule, et ce qui le laisse ; le relevé des lectures d'un processus."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import entrees  # noqa: E402
from entrees import a_reconstruire, est_entree, sujet  # noqa: E402

E = 'scripts/personnage-3d/element/humanoide/'
V = 'scripts/personnage-3d/vehicule/'
M = 'hotes/godot/projet/modeles/'
RACINES = ('scripts/personnage-3d/', 'hotes/godot/projet/modeles/', 'src/data/materials.json')
BURE = sujet(f'{E}vetement--bure/', {'humanoide--vetement--bure'})
CORDELIERE = sujet(f'{E}accessoire--cordeliere/', {'humanoide--accessoire--cordeliere'}, {'humanoide--vetement--bure'})
CARAQUE = sujet(f'{V}caraque/', {'vehicule--caraque', 'amelioration--sabord'})
SUJETS = [BURE, CORDELIERE, CARAQUE]


def change(*chemins, base='b'):
    return {'racines': RACINES, 'base': base, 'motif': None, 'chemins': frozenset(chemins)}


class Decision(unittest.TestCase):

    def test_rien_de_change_ne_reconstruit_rien(self):
        self.assertEqual([a_reconstruire(s, SUJETS, change()) for s in SUJETS], [False, False, False])

    def test_son_dossier_ne_reconstruit_que_lui(self):
        self.assertEqual([a_reconstruire(s, SUJETS, change(f'{E}vetement--bure/modele.py')) for s in SUJETS], [True, False, False])

    def test_un_fichier_partage_reconstruit_tout(self):
        for partage in ('scripts/personnage-3d/habillage.py', 'scripts/personnage-3d/element/lame.py', 'src/data/materials.json',
                        f'{M}humanoide.manifeste.json', f'{M}LICENSE-CC0-1.0-f6089cba01cb570a.txt'):
            with self.subTest(partage=partage):
                self.assertEqual([a_reconstruire(s, SUJETS, change(partage)) for s in SUJETS], [True, True, True])

    def test_le_publie_contourne_reconstruit_qui_le_contourne(self):
        self.assertEqual([a_reconstruire(s, SUJETS, change(f'{M}humanoide--vetement--bure.manifeste.json')) for s in SUJETS], [True, True, False])

    def test_le_publie_d_un_vehicule_ne_reconstruit_que_son_modele(self):
        self.assertEqual([a_reconstruire(s, SUJETS, change(f'{M}amelioration--sabord.glb')) for s in SUJETS], [False, False, True])

    def test_hors_des_racines_ne_reconstruit_rien(self):
        self.assertEqual([a_reconstruire(s, SUJETS, change('src/noyau/combat.ts', 'hotes/godot/projet/ecrans/menu.gd')) for s in SUJETS],
                         [False, False, False])

    def test_sans_base_tout_se_reconstruit(self):
        sans = {**change(), 'chemins': None}
        self.assertEqual([a_reconstruire(s, SUJETS, sans) for s in SUJETS], [True, True, True])

    def test_le_dossier_d_un_tiers_n_est_pas_une_entree(self):
        self.assertFalse(est_entree(f'{E}vetement--bure/donnees.py', CORDELIERE, SUJETS, RACINES))
        self.assertFalse(est_entree(f'{V}caraque/modele.py', BURE, SUJETS, RACINES))


class Changements(unittest.TestCase):

    def lire(self, sortie, env=None):
        with mock.patch.dict(os.environ, env or {}, clear=False), \
                mock.patch.object(entrees.subprocess, 'run', return_value=mock.Mock(returncode=0, stdout=sortie, stderr='')):
            return entrees.changements()

    def test_les_chemins_et_la_base_sont_lus(self):
        lu = self.lire('{"racines": ["a/"], "base": "b", "chemins": ["a/x"]}', {entrees.TOUT: ''})
        self.assertEqual(lu, {'racines': ('a/',), 'base': 'b', 'motif': None, 'chemins': frozenset({'a/x'})})

    def test_tout_reconstruire_garde_les_racines(self):
        lu = self.lire('{"racines": ["a/"], "base": "b", "chemins": ["a/x"]}', {entrees.TOUT: '1'})
        self.assertEqual((lu['racines'], lu['chemins'], lu['motif']), (('a/',), None, f'{entrees.TOUT}=1'))

    def test_une_panne_leve(self):
        with mock.patch.object(entrees.subprocess, 'run', return_value=mock.Mock(returncode=1, stdout='', stderr='git')):
            self.assertRaises(RuntimeError, entrees.changements)


class GlbLocaux(unittest.TestCase):
    """`--local <id>=<glb>` de `element/construire.py` (#4338)."""

    LUS = {'humanoide--vetement--bure', 'humanoide--accessoire--cordeliere'}

    def test_chaque_id_lu_a_son_glb(self):
        with tempfile.TemporaryDirectory() as tmp:
            bure, corde = Path(tmp) / 'bure.glb', Path(tmp) / 'corde.glb'
            bure.write_bytes(b'glTF')
            corde.write_bytes(b'glTF')
            self.assertEqual(entrees.glb_locaux([f'humanoide--vetement--bure={bure}', f'humanoide--accessoire--cordeliere={corde}'], self.LUS),
                             {'humanoide--vetement--bure': bure.resolve(), 'humanoide--accessoire--cordeliere': corde.resolve()})
            self.assertEqual(entrees.glb_locaux([], self.LUS), {})

    def test_refuse_un_id_non_lu_repete_ou_sans_glb(self):
        with tempfile.TemporaryDirectory() as tmp:
            glb = Path(tmp) / 'bure.glb'
            glb.write_bytes(b'glTF')
            for paires in ([f'humanoide--armure--plastron={glb}'], [str(glb)], [f'humanoide--vetement--bure={glb}'] * 2,
                           [f'humanoide--vetement--bure={Path(tmp) / "absent.glb"}'], [f'humanoide--vetement--bure={tmp}']):
                with self.subTest(paires=paires), self.assertRaises(ValueError):
                    entrees.glb_locaux(paires, self.LUS)


class Releve(unittest.TestCase):

    def test_les_lectures_du_depot_sont_relevees(self):
        with tempfile.TemporaryDirectory() as tmp:
            script = Path(tmp) / 'lit.py'
            script.write_text(f"import json, sys\nsys.path.insert(0, {str(entrees.ICI)!r})\nimport seuils\n"
                              f"json.loads(open({str(entrees.RACINE / 'src/data/materials.json')!r}, encoding='utf-8').read())\n", encoding='utf-8')
            vu, lus = entrees.construire_en_relevant([script], capture_output=True, text=True)
        self.assertEqual(vu.returncode, 0, vu.stderr)
        self.assertLessEqual({'scripts/personnage-3d/seuils.py', 'hotes/godot/asset/evaluateur/gardes/seuils.json', 'src/data/materials.json'}, lus)


if __name__ == '__main__':
    unittest.main()
