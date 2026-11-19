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


def assises(lue):
    """Les cotes de forme des assises de l'apparence `lue` (`detail.courses`), nommées comme `maconnerie` les lit :
    `assise`, `joint`, `bloc`, `decalage` et `ondulation`."""
    champs = (("assise", "hM"), ("joint", "jointW"), ("bloc", "blockWM"), ("decalage", "stagger"),
              ("ondulation", "edgeWobble"))
    return {cote: lue["detail"]["courses"][champ] for cote, champ in champs}


MOELLONS_MACONNES = {
    "inegalite": 0.22, "lit": 0.022, "boutisse": 0.2, "cale": (0.15, (0.3, 0.42)),
    "moellon": {"relief": (0.0, 0.022), "chanfrein": (0.014, 0.032), "retrait": (0.025, 0.06)},
    "taille": {"relief": (0.0, 0.0), "chanfrein": (0.01, 0.01), "retrait": (0.015, 0.015)},
    "creux": 0.06, "harpe": (0.32, 0.18), "couronnement": None,
}
"""La façon des moellons maçonnés à chaînes de pierres de taille (`maconnerie`), commune aux kits qui en sont bâtis :
cotes d'adaptation."""
