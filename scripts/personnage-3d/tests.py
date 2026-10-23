"""Tests de la chaîne de production 3D, dans le venv épinglé :

    node scripts/personnage-3d/environnement.mjs scripts/personnage-3d/tests.py
"""
import sys
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.discover(str(ICI), pattern='test_*.py', top_level_dir=str(ICI))
    sys.exit(0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1)
