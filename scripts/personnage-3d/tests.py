"""Tests de la chaîne de production 3D, dans le venv épinglé (gate `personnage-3d:tests` de ci.yml, #3145) :

    npm run personnage-3d:tests

Chaque module `test_*.py` joue dans son processus, menés de front, un par cœur ; sa sortie s'imprime à sa fin, d'un
bloc (#3412).
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ICI = Path(__file__).resolve().parent


def jouer(module):
    """Le module `module` joué par `unittest` dans son processus : sa sortie, et son code de sortie."""
    vu = subprocess.run([sys.executable, '-m', 'unittest', '--verbose', module], cwd=ICI, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return vu.stdout, vu.returncode


if __name__ == '__main__':
    modules = sorted(chemin.stem for chemin in ICI.glob('test_*.py'))
    if not modules:
        print(f'[personnage-3d] aucun test collecté sous {ICI} (test_*.py)', file=sys.stderr)
        sys.exit(1)
    rouges = []
    with ThreadPoolExecutor(max_workers=os.cpu_count()) as file:
        for module, (sortie, code) in zip(modules, file.map(jouer, modules)):
            sys.stdout.buffer.write(sortie)
            sys.stdout.flush()
            if code:
                rouges.append(module)
    if rouges:
        print(f'[personnage-3d] en échec : {", ".join(rouges)}', file=sys.stderr)
    sys.exit(1 if rouges else 0)
