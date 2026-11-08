"""Construction des véhicules (#2987) : chaque modèle de `vehicule/` reconstruit depuis le dépôt les GLB et les
manifestes publiés sous `hotes/godot/projet/modeles/`, octet pour octet (l'empreinte du manifeste) ; chaque véhicule et
chaque Amélioration publiés y ont leur modèle ; une sortie dans le dépôt est refusée."""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI / 'vehicule'))

import construire  # noqa: E402

MODELES = ICI.parents[1] / 'hotes' / 'godot' / 'projet' / 'modeles'


class Reconstruction(unittest.TestCase):

    def construire(self, modele):
        """Les dossiers de production que `construire.py <modele>` écrit, par id."""
        sortie = Path(self.dossier.name) / modele
        env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
        vu = subprocess.run([sys.executable, '-X', 'utf8', str(ICI / 'vehicule' / 'construire.py'), modele, '--sortie', str(sortie)],
                            capture_output=True, text=True, env=env, timeout=240)
        self.assertEqual(vu.returncode, 0, vu.stdout[-2000:] + vu.stderr[-2000:])
        return {d.name: d for d in sorted(sortie.iterdir())}

    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.dossier.cleanup()

    def test_chaque_modele_reproduit_ses_elements_publies(self):
        produits = set()
        for modele in sorted(d.parent.name for d in (ICI / 'vehicule').glob('*/donnees.py')):
            for id_, dossier in self.construire(modele).items():
                produits.add(id_)
                with self.subTest(modele=modele, id=id_):
                    manifeste = json.loads((dossier / f'{id_}.element.json').read_text(encoding='utf-8'))
                    octets = (dossier / f'{id_}.glb').read_bytes()
                    self.assertEqual(manifeste['glb'], {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)})
                    enveloppe = json.loads((dossier / 'manifest.json').read_text(encoding='utf-8'))
                    self.assertEqual(enveloppe, {'model': f'{id_}.glb', 'model_sha256': manifeste['glb']['sha256'], 'manifeste': manifeste})
                    publie = MODELES / f'{id_}.manifeste.json'
                    self.assertTrue(publie.exists(), f'{id_} : aucun manifeste publié sous {MODELES}')
                    self.assertEqual(manifeste, json.loads(publie.read_text(encoding='utf-8')))
        publies = {p.name.removesuffix('.manifeste.json') for c in ('vehicule', 'amelioration') for p in MODELES.glob(f'{c}--*.manifeste.json')}
        self.assertEqual(publies - produits, set(), 'élément publié sans modèle sous vehicule/')


class Sortie(unittest.TestCase):

    def test_refuse_le_depot(self):
        with self.assertRaises(ValueError):
            construire.dossier_de_sortie(construire.habillage.DEPOT / 'hotes' / 'godot' / 'sortie-de-vehicule')

    def test_refuse_un_dossier_occupe(self):
        with tempfile.TemporaryDirectory() as dossier:
            (Path(dossier) / 'autre.glb').write_bytes(b'')
            with self.assertRaises(ValueError):
                construire.dossier_de_sortie(dossier)


if __name__ == '__main__':
    unittest.main()
