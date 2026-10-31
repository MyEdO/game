"""Les seuils partagés entre la construction et l'évaluateur des assets (#2972). Leur valeur vit dans une seule donnée,
`hotes/godot/asset/evaluateur/gardes/seuils.json`, que lisent ce module et l'évaluateur. Leur sens se documente au
symbole homonyme de l'évaluateur : `IMAGES_PAR_SECONDE`, `INSTANTS_CONFONDUS`,
`MARGE_DE_GRILLE` (`echantillonnage.ts`) ; `INFLUENCES_MAX`,
`POIDS_NEGLIGEABLE`, `TOLERANCE_SOMME_POIDS`, `TOLERANCE_JUMEAUX_POSITION_M` (`gardes/poids.ts`) ; `SOL_TOLERANCE_M`
(`gardes/piedsAuSol.ts`) ; `TOLERANCE_ECHELLE` (`gardes/pistesDEchelle.ts`) ; `MAJORITE_DU_POIDS` (`gardes/appuis.ts`) ;
`ETIREMENT_EN_CLIP`, `ETIREMENT_AU_REPOS` (`gardes/etirement.ts`), intervalles (bas, haut).
"""
import json
from pathlib import Path

DONNEE = Path(__file__).resolve().parents[2] / 'hotes' / 'godot' / 'asset' / 'evaluateur' / 'gardes' / 'seuils.json'
_SEUILS = json.loads(DONNEE.read_text(encoding='utf-8'))

IMAGES_PAR_SECONDE = _SEUILS['IMAGES_PAR_SECONDE']
INSTANTS_CONFONDUS = _SEUILS['INSTANTS_CONFONDUS']
MARGE_DE_GRILLE = _SEUILS['MARGE_DE_GRILLE']
INFLUENCES_MAX = _SEUILS['INFLUENCES_MAX']
POIDS_NEGLIGEABLE = _SEUILS['POIDS_NEGLIGEABLE']
TOLERANCE_SOMME_POIDS = _SEUILS['TOLERANCE_SOMME_POIDS']
TOLERANCE_JUMEAUX_POSITION_M = _SEUILS['TOLERANCE_JUMEAUX_POSITION_M']
SOL_TOLERANCE_M = _SEUILS['SOL_TOLERANCE_M']
TOLERANCE_ECHELLE = _SEUILS['TOLERANCE_ECHELLE']
MAJORITE_DU_POIDS = _SEUILS['MAJORITE_DU_POIDS']
ETIREMENT_EN_CLIP = tuple(_SEUILS['ETIREMENT_EN_CLIP'])
ETIREMENT_AU_REPOS = tuple(_SEUILS['ETIREMENT_AU_REPOS'])
