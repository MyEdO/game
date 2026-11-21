import type { ActiveEffect, Combatant } from './types';
import { blessuresReconciliees } from './characteristics';

/** LDB 46 l.119 */
export function applyActiveEffect(target: Combatant, effect: ActiveEffect) {
  target.activeEffects = target.activeEffects ?? [];
  const sp = effect.spell;
  const idx = sp ? target.activeEffects.findIndex((e) => e.characteristic === effect.characteristic && e.spell?.spellId === sp.spellId && e.spell.casterId === sp.casterId) : -1;
  if (idx >= 0) target.activeEffects[idx] = effect;
  else target.activeEffects.push(effect);
  target.wounds = blessuresReconciliees(target);
}
