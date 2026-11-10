"""Le dossier de production d'un élément (`production.py`, #3743) : une sortie dans le dépôt ou dans un dossier occupé est
refusée."""
import tempfile
import unittest
from pathlib import Path

from production import DEPOT, dossier_de_sortie


class Sortie(unittest.TestCase):

    def test_refuse_le_depot(self):
        with self.assertRaises(ValueError):
            dossier_de_sortie(DEPOT / 'hotes' / 'godot' / 'sortie-d-element')

    def test_refuse_un_dossier_occupe(self):
        with tempfile.TemporaryDirectory() as dossier:
            (Path(dossier) / 'autre.glb').write_bytes(b'')
            with self.assertRaises(ValueError):
                dossier_de_sortie(dossier)


if __name__ == '__main__':
    unittest.main()
