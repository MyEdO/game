/**
 * Option : Vents Tourbillonnants (LDB 46 l.179-190) — « Avant chaque scène – ou même à chaque Round
 * dans des zones de turbulences magiques –, le MJ peut effectuer un lancer concernant la force des
 * Vents relatifs à la scène […]. Le modificateur peut être ajouté à vos Tests d'Incantation et de
 * Focalisation. » Table verbatim (l.183-190), tirage au dé du document (`die`), lookup `findTableEntry`.
 *
 * « Si vous possédez le Talent Seconde vue, un Test de Perception Facile (+40) repérera de telles
 * perturbations. » (l.181) — le prédicat `hasSecondeVue` compare l'id du Talent DIRECTEMENT (patron
 * `talentId === 'beni'`, cf. combat-hardcode-guard.test.ts) : ni `hasTalent()` (littéral flaggé par la
 * garde) ni dispatch de capability (pas un pouvoir de combat).
 *
 * Module PUR : le grain (scène/Round) et la couture combat (tirage à l'ouverture, re-tirage au
 * Round, câblage `extraMod` de `resolveCasting`/`resolveFocus`) vivent au noyau — cf.
 * `src/noyau/combatFlow.ts` (`windsOfMagicAtCombatStart`) et `src/noyau/combat/roundHooks.ts`.
 */
import type { RNG } from './dice';
import { rollDice } from './dice';
import { findTableEntry } from './tables';
import type { Combatant } from './types';
import type { ModLine } from './combat';
import ventsJson from '../data/vents-tourbillonnants.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from '../data/rangees';
import type * as vents from '../data/schemas/defs/vents-tourbillonnants';
import { effectiveTalents } from './talentEffects';

/** Le Tableau VIVANT — la collection que le Codex expose et édite (`ventsTourbillonnants`,
 *  `data/overrides.ts`, `src/noyau/codex/registry.ts`) ; le lookup n'en lit que `min`/`max`/`mod`. */
type LigneDesVents = RangeeDe<typeof vents>;
export const windsOfMagicTable: LigneDesVents[] = rangeesDe<typeof vents>(ventsJson);

/** Modificateur (LDB 46 l.183-190) pour un jet donné — lecture LIVE de la donnée éditable. */
export function windsModFromRoll(roll: number): number {
  return findTableEntry(windsOfMagicTable, roll).mod;
}

export interface WindsRoll { roll: number; mod: number }

/** LIGNE DE JET des Vents — MAISON UNIQUE des deux couches (aperçu d'Incantation `previewCast`,
 *  modale de Focalisation) : le libellé EST celui de la ligne tirée du Tableau (« Vents forts »), sa
 *  `ref` la fiche Codex de cette ligne — label et référence dérivent de la MÊME donnée. `null` quand
 *  aucun Vent n'est tiré ou que la force est neutre (rien à afficher). */
export function windsModLine(winds: WindsRoll | null | undefined): ModLine | null {
  if (!winds?.mod) return null;
  const e = findTableEntry(windsOfMagicTable, winds.roll);
  return { label: e.label, value: winds.mod, famille: 'jet', ref: { category: 'ventsTourbillonnants', id: e.id } };
}

/** Tirage de la force des Vents (LDB 46 l.183-190). */
export function rollWindsOfMagic(rng: RNG): WindsRoll {
  const roll = rollDice(deDeTirageDe<typeof vents>(ventsJson), rng);
  return { roll, mod: windsModFromRoll(roll) };
}

/** Le personnage possède-t-il le Talent Seconde vue (id direct, pas de `hasTalent()` littéral) ? */
export function hasSecondeVue(c: Combatant): boolean {
  return effectiveTalents(c).some((t) => t.talentId === 'seconde-vue' && (t.times ?? 1) >= 1);
}
