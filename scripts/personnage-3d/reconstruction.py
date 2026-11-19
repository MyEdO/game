"""Reconstruction des modèles sans base d'une famille (#2987, #4335), commune à `test_vehicule.py` et `test_decor.py` :
chaque modèle de `<famille>/` reconstruit par `construire.py` les GLB et les manifestes publiés sous
`hotes/godot/projet/modeles/`, octet pour octet (l'empreinte du manifeste), et chaque élément publié des catégories de la
famille (`CATEGORIES_DES_FAMILLES`) y a son modèle. Seul se reconstruit un modèle dont une entrée a changé depuis la base
du diff, tous sous `WFRP_3D_TOUT=1` (`entrees.py`, #3412), chacun ne lisant que ses entrées."""
import hashlib
import importlib
import json
import os
import runpy
import sys
import tempfile
from pathlib import Path

import construire
from entrees import (a_reconstruire, changements, construire_en_relevant, ids_publies, lectures_hors_entrees, modeles,
                     sujets_des_elements, sujets_sans_base)
from production import MODELES

ICI = Path(__file__).resolve().parent


def publie_par_modele(famille):
    """Les ids que publie chaque modèle de `<famille>/`, lus aux clés de ses éléments (`elements(D)`), sans les bâtir."""
    if str(ICI / famille) not in sys.path:
        sys.path.insert(0, str(ICI / famille))
    return {m: [construire.identifiant(categorie, cle)
                for element in importlib.import_module(f'{m}.modele').elements(runpy.run_path(str(ICI / famille / m / 'donnees.py')))
                for categorie, cle in element['cles']]
            for m in modeles(famille)}


def construire_le_modele(famille, modele, sortie):
    """`construire.py <famille>/<modele> --sortie <sortie>` lancé sous le relevé de ses lectures : le processus achevé,
    et les fichiers du dépôt lus (`entrees.construire_en_relevant`)."""
    env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'}
    return construire_en_relevant([ICI / 'construire.py', f'{famille}/{modele}', '--sortie', sortie],
                                  capture_output=True, text=True, env=env, timeout=240)


class DUneFamille:
    """Les tests de reconstruction de la famille `FAMILLE`, à mêler à `unittest.TestCase`."""

    FAMILLE = None

    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.publie = publie_par_modele(self.FAMILLE)

    def tearDown(self):
        self.dossier.cleanup()

    def construire(self, modele):
        """Les dossiers de production que `construire.py <famille>/<modele>` écrit, par id, bâtis sous le relevé de leurs
        lectures, et les fichiers du dépôt lus (`entrees.construire_en_relevant`)."""
        sortie = Path(self.dossier.name) / modele
        vu, lus = construire_le_modele(self.FAMILLE, modele, sortie)
        self.assertEqual(vu.returncode, 0, vu.stdout[-2000:] + vu.stderr[-2000:])
        return {d.name: d for d in sorted(sortie.iterdir())}, lus

    def test_chaque_modele_reproduit_ses_elements_publies(self):
        """Chaque modèle dont une entrée a changé (`entrees.a_reconstruire`) reconstruit les éléments qu'il déclare, chacun
        comme publié, sans lire hors de ses entrées."""
        change = changements()
        sujets = sujets_des_elements() + sujets_sans_base(**{self.FAMILLE: self.publie})
        dossier = (ICI / self.FAMILLE).relative_to(ICI.parents[1]).as_posix()
        for modele in sorted(self.publie):
            s = next(s for s in sujets if s['dossier'] == f'{dossier}/{modele}/')
            with self.subTest(modele=modele):
                if not a_reconstruire(s, sujets, change):
                    self.skipTest(f"aucune entrée de {modele} changée depuis {change['base']}")
                produits, lus = self.construire(modele)
                self.assertEqual(lectures_hors_entrees(lus, s, sujets, change['racines']), [], f'{modele} lit hors de ses entrées (`entrees.est_entree`)')
                self.assertEqual(sorted(produits), sorted(self.publie[modele]))
                for id_, sortie in produits.items():
                    with self.subTest(id=id_):
                        manifeste = json.loads((sortie / f'{id_}.element.json').read_text(encoding='utf-8'))
                        octets = (sortie / f'{id_}.glb').read_bytes()
                        self.assertEqual(manifeste['glb'], {'sha256': hashlib.sha256(octets).hexdigest(), 'octets': len(octets)})
                        enveloppe = json.loads((sortie / 'manifest.json').read_text(encoding='utf-8'))
                        self.assertEqual(enveloppe, {'model': f'{id_}.glb', 'model_sha256': manifeste['glb']['sha256'], 'manifeste': manifeste})
                        publie = MODELES / f'{id_}.manifeste.json'
                        self.assertTrue(publie.exists(), f'{id_} : aucun manifeste publié sous {MODELES}')
                        self.assertEqual(manifeste, json.loads(publie.read_text(encoding='utf-8')))

    def test_chaque_element_publie_a_son_modele(self):
        declares = {id_ for ids in self.publie.values() for id_ in ids}
        self.assertEqual(ids_publies(self.FAMILLE) - declares, set(), f'élément publié sans modèle sous {self.FAMILLE}/')
        for modele, ids in sorted(self.publie.items()):
            with self.subTest(modele=modele):
                self.assertEqual([id_ for id_ in ids if not (MODELES / f'{id_}.manifeste.json').exists()], [], 'élément déclaré sans manifeste publié')
