"""hotes/godot/pont/CONTRAT.md, « Gabarit d'une base »."""
import json
from pathlib import Path

from script_node import lancer

_noms = json.loads(lancer(Path(__file__).with_name('gabarit.mjs'), [], json.dumps({'operation': 'silhouettes'})))
FEMININ = _noms['FEMININ']
CARRURE_MOINS = _noms['CARRURE_MOINS']
CARRURE_PLUS = _noms['CARRURE_PLUS']
CORPULENCE = _noms['CORPULENCE']
SILHOUETTES = tuple(_noms['NOMS_DES_SILHOUETTES'])
