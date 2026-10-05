// Résolveur UNIQUE de la couche de campagne runtime (#767). Frontière RÉFÉRENCE vs NARRATIF
// (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) : le narratif d'un paquet de
// campagne (`state.campaignNarratif`, posé par `loadProject`) est lu ICI par id STABLE, jamais copié
// dans `src/data` global. Les accesseurs d'affaire/indice/preset/document n'existent QUE dans la couche ; seul
// `trappingById` chaîne campagne-d'abord puis règle globale (`findTrappingById`).
import { findCreatureById, trappingDesObjetsPuisDuCatalogue, type CreatureData, type TrappingData } from '../data';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { Affaire, DocumentNarratif, Indice, NarratifBlock, PresetPnj } from './campaignNarratif';
import { REGISTRES_NARRATIFS, type CleDeRegistreNarratif } from '../data/schemas/defs-scenes/registres-narratifs';
// Import de `useGame` au top-level mais lu UNIQUEMENT dans les fonctions (usage runtime différé) :
// le cycle store → combatEffects → campaignData → store ne se résout que par la liaison vivante ESM.
import { useGame } from './store';

/** Un index par id pour CHAQUE registre du narratif (`REGISTRES_NARRATIFS`). */
type NarratifMaps = { [K in CleDeRegistreNarratif]: Map<string, NarratifBlock[K][number]> };

const mapsDe = (n: NarratifBlock | null): NarratifMaps =>
  Object.fromEntries(
    REGISTRES_NARRATIFS.map((r) => [r.cle, new Map(((n?.[r.cle] ?? []) as readonly { id: string }[]).map((e) => [e.id, e]))]),
  ) as unknown as NarratifMaps;

// Mémoïsation par RÉFÉRENCE de `campaignNarratif` : on ne rebâtit les Maps que lorsque la couche
// change (chargement/déchargement de campagne). `campaignNarratif === null` → Maps vides, tout id
// d'objet tombe sur la règle globale.
let cachedRef: NarratifBlock | null = null;
let cached: NarratifMaps = mapsDe(null);

function maps(): NarratifMaps {
  const n = useGame.getState().campaignNarratif;
  if (n === cachedRef) return cached;
  cachedRef = n;
  cached = mapsDe(n);
  return cached;
}

/** Preset de PNJ pré-composé de la campagne chargée — couche-SEULEMENT (n'existe pas dans `src/data`). */
export function presetPnjById(id: string): PresetPnj | undefined {
  return maps().presetsPnj.get(id);
}

/**
 * Fusion PURE base+surcharges d'un preset de PNJ (#671) — sémantique de surcharge AU NIVEAU CHAMP :
 * un champ présent dans `profil` REMPLACE celui de `base` ; `char` est fusionné caractéristique par
 * caractéristique (les caracs non-mentionnées gardent la base) ; les tableaux structurés
 * (`traits`/`skills`/`talents`/`spells`/`optionals`/`trappings`) sont REMPLACÉS EN BLOC dès que
 * `profil` en fournit un (pas de fusion par-élément — un profil qui liste des traits redéfinit la
 * liste). Fonction sans dépendance au store (testable en unité).
 */
export function mergeCreatureProfile(base: CreatureData, profil?: Partial<CreatureData>): CreatureData {
  if (!profil) return base;
  const { char, ...rest } = profil;
  return {
    ...base,
    ...rest, // surcharge au niveau champ (tableaux remplacés en bloc si présents)
    char: char ? { ...base.char, ...char } : base.char, // char fusionné par caractéristique
  };
}

/** Résout un preset de PNJ nommé en une `CreatureData` prête à spawner + son apparence embarquée.
 *  `base` présente → créature globale surchargée (`mergeCreatureProfile`) ; sinon `profil` sert de
 *  profil ad hoc complet. `undefined` si le preset est inconnu OU si sa `base` est introuvable
 *  (fail-doux : `narratifSchema` a déjà rejeté un projet à base invalide au parse). */
export function resolvePresetCreature(presetId: string): { creature: CreatureData; apparence?: EntityAppearance } | undefined {
  const preset = presetPnjById(presetId);
  if (!preset) return undefined;
  if (preset.base) {
    const base = findCreatureById(preset.base);
    if (!base) return undefined;
    return { creature: mergeCreatureProfile(base, preset.profil), apparence: preset.apparence };
  }
  return { creature: preset.profil as CreatureData, apparence: preset.apparence };
}

/** Affaire (fil d'enquête) de la campagne chargée — couche-SEULEMENT. */
export function affaireById(id: string): Affaire | undefined {
  return maps().affaires.get(id);
}

/** Indice/rumeur de la campagne chargée — couche-SEULEMENT. */
export function indiceById(id: string): Indice | undefined {
  return maps().indices.get(id);
}

/** Document remis au joueur (#679) de la campagne chargée — couche-SEULEMENT. */
export function documentById(id: string): DocumentNarratif | undefined {
  return maps().documents.get(id);
}

/** Possession résolue par id STABLE, campagne-D'ABORD (`campaignNarratif.objets`) puis règle globale
 *  (`trappingDesObjetsPuisDuCatalogue`). Les ids narratifs ne collisionnent jamais avec le global (garde `narratifSchema`,
 *  #765) → chaîne déterministe. Signature IDENTIQUE à `findTrappingById` : sert de résolveur injecté aux
 *  coutures d'objet du moteur (`engine/items`), qui restent PURES (elles reçoivent la fonction). */
export function trappingById(id: string): TrappingData | undefined {
  return trappingDesObjetsPuisDuCatalogue(maps().objets, id);
}
