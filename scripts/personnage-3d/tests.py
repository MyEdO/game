"""Tests de la chaîne de production 3D, dans le venv épinglé (gate `personnage-3d:tests` de ci.yml, #3145) :

    npm run personnage-3d:tests
"""
import sys
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.discover(str(ICI), pattern='test_*.py', top_level_dir=str(ICI))
    resultat = unittest.TextTestRunner(verbosity=2).run(suite)
    if resultat.testsRun == 0:
        print(f'[personnage-3d] aucun test collecté sous {ICI} (test_*.py)', file=sys.stderr)
    sys.exit(0 if resultat.testsRun and resultat.wasSuccessful() else 1)
