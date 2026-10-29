"""Lancement d'un script node de la chaîne depuis la construction Blender : la seule implémentation de la chaîne."""
import shutil
import subprocess


def lancer(script, arguments, entree):
    """Lance `node <script> <arguments…>`, `entree` sur son entrée standard ; rend sa sortie standard. Son erreur
    standard passe telle quelle ; un code de sortie non nul lève `RuntimeError`."""
    node = shutil.which('node')
    if not node:
        raise RuntimeError(f'node introuvable : {script.name} se lance par node')
    sortie = subprocess.run([node, str(script), *map(str, arguments)], input=entree, stdout=subprocess.PIPE, text=True,
                            encoding='utf-8')
    if sortie.returncode:
        raise RuntimeError(f'{script.name} : code {sortie.returncode}')
    return sortie.stdout
