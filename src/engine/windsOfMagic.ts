/**
 * Option : Vents Tourbillonnants (LDB 46 l.179-190) — « Avant chaque scène – ou même à chaque Round
 * dans des zones de turbulences magiques –, le MJ peut effectuer un lancer concernant la force des
 * Vents relatifs à la scène […]. Le modificateur peut être ajouté à vos Tests d'Incantation et de
 * Focalisation. » Table verbatim (l.183-190), tirage 1d10, lookup `findTableEntry`.
 *
 * « Si vous possédez le Talent Seconde vue, un Test de Perception Facile (+40) repérera de telles
 * perturbations. » (l.181) — le prédicat `hasSecondeVue` compare l'id du Talent DIRECTEMENT (patron
 * `talentId === 'beni'`, cf. combat-hardcode-guard.test.ts) : ni `hasTalent()` (littéral flaggé par la
 * garde) ni dispatch de capability (pas un pouvoir de combat).
 *
 * Module PUR : le grain (scène/Round) et la couture combat (tirage à l'ouverture, re-tirage au
 * Round, câblage `extraMod` de `resolveCasting`/`resolveFocus`) vivent en `state/` — cf.
 * `src/noyau/combatFlow.ts` (`windsOfMagicAtCombatStart`) et `src/noyau/combat/roundHooks.ts`.
 */
import type { RNG } from './dice';
import { defaultRNG, d10 } from './dice';
import { findTableEntry } from './tables';
import type { Combatant } from './types';
import type { ModLine } from './combat';
import ventsJson from '../data/vents-tourbillonnants.json';

/** `id`/`label` = affichage (Codex `ventsTourbillonnants`, `src/ui/compendium/registry.ts`) ; le
 *  lookup n'utilise que `min`/`max`/`mod` (`findTableEntry`). */
interface WindsEntry { id: string; min: number; max: number; mod: number; label: string }
const WINDS_TABLE = (ventsJson as { entries: WindsEntry[] }).entries;

/** Modificateur (LDB 46 l.183-190) pour un jet 1d10 donné — lecture LIVE de la donnée éditable. */
export function windsModFromRoll(roll: number): number {
  return findTableEntry(WINDS_TABLE, roll).mod;
}

export interface WindsRoll { roll: number; mod: number }

/** LIGNE DE JET des Vents — MAISON UNIQUE des deux couches (aperçu d'Incantation `previewCast`,
 *  modale de Focalisation) : le libellé EST celui de la ligne tirée du Tableau (« Vents forts »), sa
 *  `ref` la fiche Codex de cette ligne — label et référence dérivent de la MÊME donnée. `null` quand
 *  aucun Vent n'est tiré ou que la force est neutre (rien à afficher). */
export function windsModLine(winds: WindsRoll | null | undefined): ModLine | null {
  if (!winds?.mod) return null;
  const e = findTableEntry(WINDS_TABLE, winds.roll);
  return { label: e.label, value: winds.mod, famille: 'jet', ref: { category: 'ventsTourbillonnants', id: e.id } };
}

/** Tirage de la force des Vents (1d10 sur le Tableau, LDB 46 l.183-190). */
export function rollWindsOfMagic(rng: RNG = defaultRNG): WindsRoll {
  const roll = d10(rng);
  return { roll, mod: windsModFromRoll(roll) };
}

/** Le personnage possède-t-il le Talent Seconde vue (id direct, pas de `hasTalent()` littéral) ? */
export function hasSecondeVue(c: Combatant): boolean {
  return c.talents.some((t) => t.talentId === 'seconde-vue' && (t.times ?? 1) >= 1);
}
