"""Les apparences de `src/data/structureAppearance.json` que lisent les données d'un modèle d'arête (#4471) : leurs
seuls champs de forme, jamais leurs couleurs."""
import json
from pathlib import Path

from script_node import lancer

APPARENCES = Path(__file__).resolve().parents[3] / "src" / "data" / "structureAppearance.json"


def apparence(kit, id_):
    """L'apparence `id_` de `APPARENCES`, du kit `kit`."""
    lue = next(a for a in json.loads(APPARENCES.read_text(encoding="utf-8")) if a["id"] == id_)
    if lue["kit"] != kit:
        raise ValueError(f"{id_} : kit {lue['kit']}, {kit} attendu")
    return lue


def hauteur(lue):
    """La hauteur (m) des arêtes de l'apparence `lue`, `METRES_PER_LEVEL` sans `wallHeightM`
    (`src/noyau/monde/aretes.ts`)."""
    return lue.get("wallHeightM") or json.loads(lancer(Path(__file__).parent / "niveau.mjs", [], ""))
