"""Les formes de la tête (#4413), lues à leur seule source, `src/lib/formesDeTete.ts`."""
import json
from pathlib import Path

from script_node import lancer

_noms = json.loads(lancer(Path(__file__).with_name('gabarit.mjs'), [], json.dumps({'operation': 'formesDeTete'})))
VISAGE_INVERSE = _noms['VISAGE_INVERSE']
NEZ_FORT = _noms['NEZ_FORT']
ARCADES_MARQUEES = _noms['ARCADES_MARQUEES']
JOUES_CREUSES = _noms['JOUES_CREUSES']
VISAGE_LONG = _noms['VISAGE_LONG']
FORMES_DE_TETE = tuple(_noms['NOMS_DES_FORMES_DE_TETE'])
