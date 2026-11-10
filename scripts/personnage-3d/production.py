"""Le dossier de production d'un élément (#2987, #3743), commun à `vehicule/construire.py` et `element/construire.py` :
ce que lit `node hotes/godot/importer.mjs <dossier> <id>`.

- `<id>.glb` et `<id>.element.json`, le manifeste schéma 3 ;
- `manifest.json`, l'enveloppe de production (`model`, `model_sha256`, `manifeste`) ;
- les textes de licence, chacun sous son nom.
"""
import hashlib
import json
import shutil
from pathlib import Path

DEPOT = Path(__file__).resolve().parents[2]
MODELES = DEPOT / "hotes" / "godot" / "projet" / "modeles"
CACHE_DES_MODELES = Path.home() / ".cache" / "wfrp-modeles-3d"
"""Le cache des modèles, GLB nommés par empreinte (`CACHE_DES_MODELES` de `hotes/godot/asset/release.ts`)."""


def dossier_de_sortie(chemin):
    """Le dossier de sortie, neuf ou vide et hors du dépôt : aucun GLB ne s'écrit dans l'arbre."""
    sortie = Path(chemin).resolve()
    if sortie == DEPOT or DEPOT in sortie.parents:
        raise ValueError(f"{sortie} : dossier de sortie dans le dépôt {DEPOT}")
    if sortie.exists() and any(sortie.iterdir()):
        raise ValueError(f"{sortie} : dossier de sortie neuf ou vide attendu")
    sortie.mkdir(parents=True, exist_ok=True)
    return sortie


def ecrire_json(chemin, valeur):
    chemin.write_text(json.dumps(valeur, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def ecrire_le_dossier(dossier, id_, octets, manifeste, licences):
    """Écrit le dossier de production `dossier` de l'élément `id_` : son GLB `octets`, `manifeste` complété de l'empreinte
    du GLB, l'enveloppe et chaque licence de `licences`, `{nom déposé: texte source}`."""
    empreinte = hashlib.sha256(octets).hexdigest()
    manifeste = {**manifeste, "glb": {"sha256": empreinte, "octets": len(octets)}}
    dossier.mkdir()
    (dossier / f"{id_}.glb").write_bytes(octets)
    ecrire_json(dossier / f"{id_}.element.json", manifeste)
    ecrire_json(dossier / "manifest.json", {"model": f"{id_}.glb", "model_sha256": empreinte, "manifeste": manifeste})
    for nom, source in licences.items():
        shutil.copyfile(source, dossier / nom)
    return manifeste
