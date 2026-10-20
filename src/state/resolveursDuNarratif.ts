// Résolveurs de la couche de campagne (#767) sur un narratif passé en ARGUMENT (#2817). Frontière RÉFÉRENCE
// vs NARRATIF (doctrine `user-doctrine-campagne-json-portable-frontiere-reference-narratif`) : le narratif
// d'un paquet de campagne (`state.campaignNarratif`, posé par `loadProject` ; ou celui du projet ÉDITÉ) est
// lu ICI par id STABLE, jamais copié dans `src/data` global. Les résolveurs d'indice/preset/document
// n'existent QUE dans la couche ; seul `objetDuNarratif` chaîne campagne-d'abord puis règle globale
// (`trappingDesObjetsPuisDuCatalogue`). Aucune lecture du store : l'appelant passe son narratif.
import { findCreatureById, trappingDesObjetsPuisDuCatalogue, type CreatureData } from '../data';
import { memoByRef } from '../noyau/monde/sceneMemo';
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { TrappingResolver } from '../engine/items';
import type { DocumentNarratif, Indice, NarratifBlock, PresetPnj } from './campaignNarratif';
import { REGISTRES_NARRATIFS, type CleDeRegistreNarratif } from '../data/schemas/defs-scenes/registres-narratifs';

/** Le narratif résolu : celui de la partie (`campaignNarratif`, `null` hors campagne) ou celui du projet édité. */
type Narratif = NarratifBlock | null | undefined;

/** Un index par id pour CHAQUE registre du narratif (`REGISTRES_NARRATIFS`). */
type TablesDuNarratif = { [K in CleDeRegistreNarratif]: Map<string, NarratifBlock[K][number]> };

const tablesDe = (n: NarratifBlock | null): TablesDuNarratif =>
  Object.fromEntries(
    REGISTRES_NARRATIFS.map((r) => [r.cle, new Map(((n?.[r.cle] ?? []) as readonly { id: string }[]).map((e) => [e.id, e]))]),
  ) as unknown as TablesDuNarratif;

const TABLES_VIDES = tablesDe(null);
// Mémoïsées par IDENTITÉ du narratif : un narratif est remplacé, jamais muté (chargement, édition).
const tablesDuNarratifConnu = memoByRef<NarratifBlock, TablesDuNarratif>(tablesDe);

const tablesDuNarratif = (n: Narratif): TablesDuNarratif => (n ? tablesDuNarratifConnu(n) : TABLES_VIDES);

/** Résout un preset de PNJ par son id. */
export type ResolveurDePreset = (id: string) => PresetPnj | undefined;

/** Le résolveur de preset d'un narratif donné : celui de la partie, ou celui du projet ÉDITÉ. */
export const presetDuNarratif = (n: Narratif): ResolveurDePreset => (id) => tablesDuNarratif(n).presetsPnj.get(id);

/** Le résolveur d'indice/rumeur d'un narratif donné. */
export const indiceDuNarratif = (n: Narratif) => (id: string): Indice | undefined => tablesDuNarratif(n).indices.get(id);

/** Le résolveur de document remis au joueur (#679) d'un narratif donné. */
export const documentDuNarratif = (n: Narratif) => (id: string): DocumentNarratif | undefined => tablesDuNarratif(n).documents.get(id);

/** Le résolveur de Possession d'un narratif donné, campagne-D'ABORD (`narratif.objets`) puis règle globale
 *  (`trappingDesObjetsPuisDuCatalogue`). Les ids narratifs ne collisionnent jamais avec le global (garde
 *  `narratifSchema`, #765) → chaîne déterministe. */
export const objetDuNarratif = (n: Narratif): TrappingResolver => (id) => trappingDesObjetsPuisDuCatalogue(tablesDuNarratif(n).objets, id);

/** Le NOM d'un preset : celui de son profil, sinon celui de sa créature de base, comme `mergeCreatureProfile`
 *  le pose ; `undefined` sans l'un ni l'autre. */
export function nomDePreset(p: PresetPnj): string | undefined {
  return p.profil?.label ?? (p.base ? findCreatureById(p.base)?.label : undefined);
}

/**
 * Fusion PURE base+surcharges d'un preset de PNJ (#671) — sémantique de surcharge AU NIVEAU CHAMP :
 * un champ présent dans `profil` REMPLACE celui de `base` ; `char` est fusionné caractéristique par
 * caractéristique (les caracs non-mentionnées gardent la base) ; les tableaux structurés
 * (`traits`/`skills`/`talents`/`spells`/`optionals`/`trappings`) sont REMPLACÉS EN BLOC dès que
 * `profil` en fournit un (pas de fusion par-élément — un profil qui liste des traits redéfinit la
 * liste).
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
export function resolvePresetCreature(presetId: string, presetDe: ResolveurDePreset): { creature: CreatureData; apparence?: EntityAppearance } | undefined {
  const preset = presetDe(presetId);
  if (!preset) return undefined;
  if (preset.base) {
    const base = findCreatureById(preset.base);
    if (!base) return undefined;
    return { creature: mergeCreatureProfile(base, preset.profil), apparence: preset.apparence };
  }
  return { creature: preset.profil as CreatureData, apparence: preset.apparence };
}
