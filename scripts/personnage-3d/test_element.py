"""Construction des éléments sur base (#3743) : chaque élément d'`element/<base>/` reconstruit depuis le dépôt, sur les GLB
épinglés lus dans le cache des modèles (`CACHE_DES_MODELES` de `hotes/godot/asset/release.ts`, que remplit `godot:sonde`
avant ce test en CI), reproduit le GLB et le manifeste publiés sous `hotes/godot/projet/modeles/`, octet pour octet
(l'empreinte du manifeste), avec l'enveloppe de production et les licences des packs de la base."""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
MODELES = ICI.parents[1] / 'hotes' / 'godot' / 'projet' / 'modeles'


def lire(chemin):
    return json.loads(chemin.read_text(encoding='utf-8'))


class Reconstruction(unittest.TestCase):

    def test_chaque_element_reproduit_son_publie(self):
        elements = sorted(f'{d.parent.parent.name}/{d.parent.name}' for d in (ICI / 'element').glob('*/*/donnees.py'))
        self.assertTrue(elements, f"aucun élément sous {ICI / 'element'}")
        for element in elements:
            base, dossier = element.split('/')
            id_ = f'{base}--{dossier}'
            with self.subTest(element=element), tempfile.TemporaryDirectory() as tmp:
                sortie = Path(tmp) / 'sortie'
                vu = subprocess.run([sys.executable, '-X', 'utf8', str(ICI / 'element' / 'construire.py'), element,
                                     '--sortie', str(sortie)],
                                    capture_output=True, text=True, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}, timeout=270)
                self.assertEqual(vu.returncode, 0, vu.stdout[-2000:] + vu.stderr[-2000:])
                produit = sortie / id_
                manifeste = lire(produit / f'{id_}.element.json')
                octets = (produit / f'{id_}.glb').read_bytes()
                self.assertEqual(manifeste['glb'], {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)})
                self.assertEqual(lire(produit / 'manifest.json'), {'model': f'{id_}.glb', 'model_sha256': manifeste['glb']['sha256'], 'manifeste': manifeste})
                licences = {l['fichier'] for l in lire(MODELES / f'{base}.provenance.json')['licences_de_pack']}
                self.assertEqual({p.name for p in produit.glob('LICENSE*.txt')}, licences)
                publie = MODELES / f'{id_}.manifeste.json'
                self.assertTrue(publie.exists(), f'{id_} : aucun manifeste publié sous {MODELES}')
                self.assertEqual(manifeste, lire(publie))


if __name__ == '__main__':
    unittest.main()
