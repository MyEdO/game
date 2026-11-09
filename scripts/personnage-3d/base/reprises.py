"""Les reprises de la construction de la base humanoïde (#3319, #3793) : une coupure de la machine ne coûte plus que la
passe en cours du point fixe, et non les heures déjà calculées.

Une reprise est une étape écrite dans le dossier de la construction, `<git-common-dir>/reprises-3d/<empreinte>` : la
scène (`sauver`, un `.blend`) et l'état de la boucle (pickle), puis le pointeur `courante`, remplacé d'un seul geste, qui
la nomme. Une coupure pendant l'écriture laisse le pointeur sur l'étape précédente, entière. L'empreinte nomme le
dossier : le code ou les arguments changés depuis lisent un autre dossier, vide. Le dossier vit avec le clone, qu'un
redémarrage du conteneur cloud garde quand il vide `~/.cache` (#3793).
"""
import hashlib
import json
import os
import pickle
import shutil
import subprocess
import time
from pathlib import Path

POINTEUR = 'courante'
SCENE = 'scene.blend'
ETAT = 'etat.pickle'


def dossier_de_construction(racine, arguments):
    """Le dossier des reprises de la construction du dépôt `racine` sous `arguments` (nom → valeur) : son empreinte, en
    hexadécimal, de la révision, des écarts suivis et des arguments, sous `<git-common-dir>/reprises-3d`."""
    def git(*commande):
        return subprocess.run(['git', *commande], cwd=racine, capture_output=True, check=True).stdout
    empreinte = hashlib.sha256(git('rev-parse', 'HEAD') + git('diff', 'HEAD', '--binary'))
    empreinte.update(json.dumps({cle: str(valeur) for cle, valeur in arguments.items()}, sort_keys=True).encode())
    commun = git('rev-parse', '--path-format=absolute', '--git-common-dir').decode().strip()
    return Path(commun) / 'reprises-3d' / empreinte.hexdigest()


class Reprises:
    """Les reprises du dossier `dossier` (`dossier_de_construction`) ; `sauver(chemin)` écrit la scène, `ouvrir(chemin)`
    la rouvre."""

    def __init__(self, dossier, sauver, ouvrir):
        self.dossier, self.sauver, self.ouvrir = dossier, sauver, ouvrir
        print('REPRISES', self.dossier, flush=True)

    def lire(self):
        """L'état de la dernière étape, sa scène rouverte ; `None` sans étape."""
        pointeur = self.dossier / POINTEUR
        if not pointeur.exists():
            return None
        etape = self.dossier / pointeur.read_text(encoding='utf-8')
        self.ouvrir(etape / SCENE)
        with open(etape / ETAT, 'rb') as fichier:
            etat = pickle.load(fichier)
        print('REPRISE lue', etape, flush=True)
        return etat

    def ecrire(self, nom, etat):
        """Écrit l'étape `nom` : la scène, `etat`, puis le pointeur ; retire les autres étapes."""
        debut = time.monotonic()
        etape = self.dossier / nom
        shutil.rmtree(etape, ignore_errors=True)
        etape.mkdir(parents=True)
        self.sauver(etape / SCENE)
        with open(etape / ETAT, 'wb') as fichier:
            pickle.dump(etat, fichier, protocol=pickle.HIGHEST_PROTOCOL)
        provisoire = self.dossier / f'{POINTEUR}.provisoire'
        provisoire.write_text(nom, encoding='utf-8')
        os.replace(provisoire, self.dossier / POINTEUR)
        for autre in self.dossier.iterdir():
            if autre.is_dir() and autre.name != nom:
                shutil.rmtree(autre)
        print('REPRISE écrite', etape, round(time.monotonic() - debut, 1), 's',
              'scène', round((etape / SCENE).stat().st_size / 1e6), 'Mo', 'état', round((etape / ETAT).stat().st_size / 1e6),
              'Mo', flush=True)

    def effacer(self):
        """Retire le dossier de la construction, une fois sa sortie écrite."""
        shutil.rmtree(self.dossier)
