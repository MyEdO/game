"""Construction des éléments sur base (#3743) : chaque élément d'`element/<base>/` reconstruit depuis le dépôt, sur les GLB
épinglés lus dans le cache des modèles (`CACHE_DES_MODELES` de `hotes/godot/asset/release.ts`, que remplit `godot:sonde`
avant ce test en CI), reproduit le manifeste publié sous `hotes/godot/projet/modeles/`, son empreinte de GLB à part, et
la forme du GLB publié au flottant près (`forme`, `ecarts`), avec l'enveloppe de production et les licences des packs de
la base : sur la même roue bpy, la file de fusion de #3795 a reconstruit chaque GLB à quelques dizaines d'octets du
publié."""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))
from glb import lire_glb  # noqa: E402
from production import CACHE_DES_MODELES, MODELES  # noqa: E402

ECART_DE_POSITION_MAX = 1e-4   # m, entre deux bornes de positions ou deux translations de nœud
ECART_DE_ROTATION_MAX = 1e-4   # composante de quaternion
ECART_DE_COMPTE_MAX = 0.02     # part des sommets ou des indices d'une primitive


def lire(chemin):
    return json.loads(chemin.read_text(encoding='utf-8'))


def forme(chemin):
    """Ce que pose le GLB `chemin` : ses nœuds (nom, parent, mesh, peau, translation, rotation), par mesh ses primitives
    (matériau, sommets, indices, bornes des positions) et les articulations de ses peaux, par nom."""
    doc, _ = lire_glb(chemin)
    noeuds, acces = doc.get('nodes', []), doc.get('accessors', [])
    parents = {c: i for i, n in enumerate(noeuds) for c in n.get('children', [])}
    nom = lambda i: noeuds[i].get('name') if i is not None else None
    materiau = lambda p: doc['materials'][p['material']].get('name') if 'material' in p else None
    return {
        'noeuds': [{'nom': n.get('name'), 'parent': nom(parents.get(i)), 'mesh': doc['meshes'][n['mesh']].get('name') if 'mesh' in n else None,
                    'peau': 'skin' in n, 'translation': n.get('translation', [0, 0, 0]), 'rotation': n.get('rotation', [0, 0, 0, 1])}
                   for i, n in enumerate(noeuds)],
        'meshes': {m.get('name'): [{'materiau': materiau(p), 'sommets': acces[p['attributes']['POSITION']]['count'],
                                    'indices': acces[p['indices']]['count'] if 'indices' in p else 0,
                                    'bornes': acces[p['attributes']['POSITION']]['min'] + acces[p['attributes']['POSITION']]['max']}
                                   for p in m['primitives']] for m in doc.get('meshes', [])},
        'peaux': [[nom(j) for j in s['joints']] for s in doc.get('skins', [])],
    }


def ecarts(a, b):
    """Les écarts entre deux formes (`forme`) au-delà des tolérances : la structure à l'identique, positions et rotations à
    `ECART_DE_POSITION_MAX` et `ECART_DE_ROTATION_MAX` près, comptes à `ECART_DE_COMPTE_MAX` près."""
    proche = lambda u, v, e: len(u) == len(v) and all(abs(x - y) <= e for x, y in zip(u, v))
    compte = lambda u, v: abs(u - v) <= max(1, ECART_DE_COMPTE_MAX * max(u, v))
    structure = lambda f: ([{k: n[k] for k in ('nom', 'parent', 'mesh', 'peau')} for n in f['noeuds']], f['peaux'],
                           {m: [p['materiau'] for p in ps] for m, ps in f['meshes'].items()})
    if structure(a) != structure(b):
        return [('structure', structure(a), structure(b))]
    fautes = [(n['nom'], 'transformation') for n, o in zip(a['noeuds'], b['noeuds'])
              if not (proche(n['translation'], o['translation'], ECART_DE_POSITION_MAX) and proche(n['rotation'], o['rotation'], ECART_DE_ROTATION_MAX))]
    for m, ps in a['meshes'].items():
        for k, (p, q) in enumerate(zip(ps, b['meshes'][m])):
            if not (compte(p['sommets'], q['sommets']) and compte(p['indices'], q['indices']) and proche(p['bornes'], q['bornes'], ECART_DE_POSITION_MAX)):
                fautes.append((m, k, p, q))
    return fautes


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
                publie = lire(publie)
                self.assertEqual({k: v for k, v in manifeste.items() if k != 'glb'}, {k: v for k, v in publie.items() if k != 'glb'})
                self.assertEqual(ecarts(forme(produit / f'{id_}.glb'), forme(CACHE_DES_MODELES / f"{publie['glb']['sha256']}.glb")), [])


if __name__ == '__main__':
    unittest.main()
