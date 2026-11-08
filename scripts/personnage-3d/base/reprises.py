"""Les reprises de la construction de la base humanoïde (#3319) : une coupure de la machine ne coûte plus que la phase en
cours du point fixe, et non les heures déjà calculées.

Une reprise est une étape écrite dans un dossier : la scène (`sauver`, un `.blend`) et l'état de la boucle (pickle), puis
le pointeur `courante`, remplacé d'un seul geste, qui la nomme avec l'empreinte de la construction. Une coupure pendant
l'écriture laisse le pointeur sur l'étape précédente, entière. Une reprise ne se lit que sous la même empreinte : le code
ou les arguments changés depuis la refusent.
"""
import hashlib
import json
import os
import pickle
import shutil
import subprocess

POINTEUR = 'courante'
SCENE = 'scene.blend'
ETAT = 'etat.pickle'


def empreinte_de_construction(racine, arguments):
    """La révision du dépôt `racine`, ses écarts suivis et `arguments` (nom → valeur), en hexadécimal."""
    def git(*commande):
        return subprocess.run(['git', *commande], cwd=racine, capture_output=True, check=True).stdout
    empreinte = hashlib.sha256(git('rev-parse', 'HEAD') + git('diff', 'HEAD', '--binary'))
    empreinte.update(json.dumps({cle: str(valeur) for cle, valeur in arguments.items()}, sort_keys=True).encode())
    return empreinte.hexdigest()


class EmpreinteDifferente(RuntimeError):
    """La reprise de `dossier` vient d'une autre construction."""

    def __init__(self, dossier):
        super().__init__(f'reprise {dossier} : écrite sous une autre empreinte (code ou arguments changés) ; '
                         'videz ce dossier pour reconstruire depuis le début')


class Reprises:
    """Les reprises du dossier `dossier` sous l'empreinte `empreinte` ; `sauver(chemin)` écrit la scène, `ouvrir(chemin)`
    la rouvre."""

    def __init__(self, dossier, empreinte, sauver, ouvrir):
        self.dossier, self.empreinte, self.sauver, self.ouvrir = dossier, empreinte, sauver, ouvrir

    def lire(self):
        """L'état de la dernière étape, sa scène rouverte ; `None` sans étape."""
        pointeur = self.dossier / POINTEUR
        if not pointeur.exists():
            return None
        courante = json.loads(pointeur.read_text(encoding='utf-8'))
        if courante['empreinte'] != self.empreinte:
            raise EmpreinteDifferente(self.dossier)
        etape = self.dossier / courante['etape']
        self.ouvrir(etape / SCENE)
        with open(etape / ETAT, 'rb') as fichier:
            etat = pickle.load(fichier)
        print('REPRISE lue', etape, flush=True)
        return etat

    def ecrire(self, nom, etat):
        """Écrit l'étape `nom` : la scène, `etat`, puis le pointeur ; retire les autres étapes."""
        etape = self.dossier / nom
        shutil.rmtree(etape, ignore_errors=True)
        etape.mkdir(parents=True)
        self.sauver(etape / SCENE)
        with open(etape / ETAT, 'wb') as fichier:
            pickle.dump(etat, fichier, protocol=pickle.HIGHEST_PROTOCOL)
        provisoire = self.dossier / f'{POINTEUR}.provisoire'
        provisoire.write_text(json.dumps({'empreinte': self.empreinte, 'etape': nom}), encoding='utf-8')
        os.replace(provisoire, self.dossier / POINTEUR)
        for autre in self.dossier.iterdir():
            if autre.is_dir() and autre.name != nom:
                shutil.rmtree(autre)
        print('REPRISE écrite', etape, flush=True)
