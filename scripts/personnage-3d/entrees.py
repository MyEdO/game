"""Les entrées d'une reconstruction de la chaîne 3D (#3412, lot 4C) : un SUJET est un élément sur base (`element/<base>/<dossier>`)
ou un modèle sans base (`<famille>/<modele>` : `vehicule/caraque`, `decor/arbre`, `arete/colombage`,
`escalier/bois`), avec son
dossier et les ids publiés qu'il
lit sous `hotes/godot/projet/modeles/` (les siens, ceux qu'il contourne et celui dont il prend un emplacement). Un chemin du dépôt est une ENTRÉE d'un sujet (`est_entree`) s'il est sous une racine que
lit la gate `personnage-3d:tests` (`ECRIT_LU`, `scripts/gates/toutes.mjs`), hors du dossier d'un autre sujet, et, sous les
modèles publiés, hors des fichiers d'un id qu'un autre sujet publie et que lui ne lit pas. Tout le reste de ces racines est
partagé : le code de la chaîne, la base, les licences, les matières.

La file ne reconstruit un sujet que si une de ses entrées a changé depuis la base du diff (`changements`, par
`changements.mjs`) ; sans base, sur une panne, ou sous `WFRP_3D_TOUT=1`, elle reconstruit tout. Chaque reconstruction se
lance sous un relevé de ses lectures (`construire_en_relevant`) : un fichier du dépôt qu'elle ouvre hors de ses entrées est
une erreur, si bien qu'une lecture neuve, qui ne naît qu'en changeant le sujet ou le partagé, se voit dans la course même
qui le reconstruit."""
import ast
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[1]
MODELES = 'hotes/godot/projet/modeles/'
TOUT = 'WFRP_3D_TOUT'
CATEGORIES_DES_FAMILLES = {'vehicule': ('vehicule', 'amelioration'), 'decor': ('decor',), 'arete': ('arete',),
                           'escalier': ('escalier',)}
"""Par famille de modèles sans base (`<famille>/<modele>/`, `construire.py`), les catégories des éléments qu'ils publient
(`identifiant` de `construire.py`)."""


def sujet(dossier, publie, lus=()):
    """Le sujet de dossier `dossier` (relatif au dépôt, finissant par `/`), qui publie les ids `publie` et lit en plus les
    ids `lus` (`ids_lus`)."""
    return {'dossier': dossier, 'publie': frozenset(publie), 'lit': frozenset(publie) | frozenset(lus)}


def ids_lus(donnees):
    """Les ids publiés que lit l'élément de `donnees`, littéraux de son `donnees.py` : ceux qu'il contourne (`CONTOURNE`)
    et celui dont il prend un emplacement (`OFFRANT`, #4318)."""
    lus = []
    for noeud in ast.parse(donnees.read_text(encoding='utf-8')).body:
        if isinstance(noeud, ast.Assign):
            noms = {c.id for c in noeud.targets if isinstance(c, ast.Name)}
            if 'CONTOURNE' in noms:
                lus += ast.literal_eval(noeud.value).values()
            if 'OFFRANT' in noms:
                lus.append(ast.literal_eval(noeud.value))
    return tuple(lus)


def glb_locaux(paires, lus):
    """Les GLB de `--local <id>=<glb>` (`element/construire.py`, #4338) : `{id: chemin}`, chaque id parmi les ids publiés
    `lus` par l'élément, chaque GLB un fichier. Lève `ValueError` sinon."""
    locaux = {}
    for paire in paires:
        id_, egal, glb = paire.partition('=')
        if not egal or id_ not in lus or id_ in locaux:
            raise ValueError(f'--local « {paire} » : attendu <id>=<glb>, une fois par id, id parmi {sorted(lus)}')
        if not Path(glb).is_file():
            raise ValueError(f'--local « {paire} » : {glb} n’est pas un fichier')
        locaux[id_] = Path(glb).resolve()
    return locaux


def sujets_des_elements():
    """Un sujet par élément sur base, `element/<base>/<dossier>/`, qui publie `<base>--<dossier>`."""
    return [sujet(f'{d.parent.relative_to(RACINE).as_posix()}/', {f'{d.parent.parent.name}--{d.parent.name}'}, ids_lus(d))
            for d in sorted((ICI / 'element').glob('*/*/donnees.py'))]


def modeles(famille):
    """Les modèles de la famille `famille`, les dossiers `<famille>/<modele>/` qui portent un `donnees.py`."""
    return sorted(d.parent.name for d in (ICI / famille).glob('*/donnees.py'))


def ids_publies(famille):
    """Les ids publiés sous `MODELES` des catégories de la famille `famille`."""
    return {p.name.removesuffix('.manifeste.json') for c in CATEGORIES_DES_FAMILLES[famille]
            for p in (RACINE / MODELES).glob(f'{c}--*.manifeste.json')}


def sujets_sans_base(**exacts):
    """Un sujet par modèle de chaque famille, `<famille>/<modele>/`. `exacts[famille]` donne, par modèle, les ids qu'il
    publie ; sans lui, chaque modèle de la famille est tenu pour publier tous les ids publiés de ses catégories, ce qui
    suffit à juger les entrées des autres sujets."""
    return [sujet(f'{(ICI / f / m).relative_to(RACINE).as_posix()}/', exacts[f][m] if f in exacts else ids_publies(f))
            for f in CATEGORIES_DES_FAMILLES for m in modeles(f)]


def changements():
    """Les changements depuis la base du diff : `{'racines', 'chemins', 'base'}`, `chemins` à `None` sans base ou sous
    `WFRP_3D_TOUT=1` (tout se reconstruit, `motif` dit pourquoi). Lève si `changements.mjs` échoue : sans racines, aucune
    lecture ne se juge."""
    vu = subprocess.run(['node', str(ICI / 'changements.mjs')], cwd=RACINE, capture_output=True, text=True)
    if vu.returncode != 0:
        raise RuntimeError(f'changements.mjs en échec ({vu.returncode}) : {vu.stderr.strip()[-2000:]}')
    lu = json.loads(vu.stdout)
    change = {'racines': tuple(lu['racines']), 'base': lu['base'], 'motif': lu.get('motif'),
              'chemins': None if lu['chemins'] is None else frozenset(lu['chemins'])}
    return {**change, 'chemins': None, 'motif': f'{TOUT}=1'} if os.environ.get(TOUT) == '1' else change


def id_publie(chemin):
    """L'id dont `chemin` est un fichier publié sous `MODELES` (`<id>.manifeste.json`, `<id>.glb`…), sinon `None`."""
    if not chemin.startswith(MODELES) or '/' in chemin[len(MODELES):]:
        return None
    return chemin[len(MODELES):].split('.', 1)[0]


def est_entree(chemin, sujet, sujets, racines):
    """`chemin` (relatif au dépôt, en `/`) est-il une entrée de `sujet` (`{'dossier', 'lit'}`) parmi tous les `sujets` ?"""
    if not any(chemin.startswith(r) if r.endswith('/') else chemin == r for r in racines):
        return False
    autres = [s for s in sujets if s is not sujet]
    if any(chemin.startswith(s['dossier']) for s in autres):
        return False
    publie = id_publie(chemin)
    return publie is None or publie in sujet['lit'] or not any(publie in s['publie'] for s in autres)


def a_reconstruire(sujet, sujets, change):
    """Le sujet se reconstruit-il pour les changements `change` (`changements()`) ?"""
    return change['chemins'] is None or any(est_entree(c, sujet, sujets, change['racines']) for c in change['chemins'])


def source_lue(chemin):
    """Le fichier du dépôt qu'une lecture de `chemin` rend : un bytecode de `__pycache__` vaut sa source."""
    p = Path(chemin)
    if p.parent.name == '__pycache__' and p.suffix == '.pyc':
        p = p.parent.parent / f"{p.name.split('.', 1)[0]}.py"
    try:
        return p.resolve().relative_to(RACINE).as_posix()
    except ValueError:
        return None


RELEVE = """import atexit, json, runpy, sys
sortie, script = sys.argv[1], sys.argv[2]
lus = set()
sys.addaudithook(lambda e, a: lus.add(a[0]) if e == 'open' and isinstance(a[0], str) else None)
atexit.register(lambda: open(sortie, 'w', encoding='utf-8').write(json.dumps(sorted(lus))))
sys.argv = sys.argv[2:]
runpy.run_path(script, run_name='__main__')
"""


def construire_en_relevant(argv, **options):
    """`python <argv>` (un script et ses arguments) lancé sous un relevé des fichiers qu'il ouvre (audit `open`) : le
    processus achevé, et les fichiers du dépôt lus (`source_lue`)."""
    with tempfile.TemporaryDirectory() as tmp:
        releve = Path(tmp) / 'lus.json'
        vu = subprocess.run([sys.executable, '-X', 'utf8', '-c', RELEVE, str(releve), *map(str, argv)], **options)
        lus = json.loads(releve.read_text(encoding='utf-8')) if releve.exists() else []
    return vu, {s for s in map(source_lue, lus) if s is not None}


def lectures_hors_entrees(lus, sujet, sujets, racines):
    """Les fichiers du dépôt de `lus` qui ne sont pas des entrées de `sujet`, triés."""
    return sorted(c for c in lus if not est_entree(c, sujet, sujets, racines))


if __name__ == '__main__':
    # `python entrees.py <donnees.py>...` : les ids que lit chacun, en JSON, pour `integrer.mjs` (#4338).
    print(json.dumps([ids_lus(Path(d)) for d in sys.argv[1:]]))
