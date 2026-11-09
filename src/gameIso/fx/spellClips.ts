/**
 * Tintage d'INCANTATION par école (arcane/divin) d'un sort désigné par son id STABLE ; la forme du rendu
 * (projectile ou halo) vient de l'événement (`ANIM_ATTACK`, `projectile`), jamais du camp des combattants.
 */
import { findSpellById } from '../../data';
import { castInfoIsPrayer, isMagicMissile } from '../../engine/magic';

export type SpellSchool = 'divine' | 'arcane';

/** Classification CANONIQUE d'un sort par son id (data-driven). */
export function classifySpell(id: string): { school: SpellSchool; missile: boolean } {
  const spell = findSpellById(id);
  if (!spell) return { school: 'arcane', missile: false };
  return {
    school: castInfoIsPrayer(spell) ? 'divine' : 'arcane',
    missile: isMagicMissile(spell),
  };
}

/**
 * FEEDBACK VISUEL d'incantation par école — SOURCE DE VÉRITÉ UNIQUE (couleur du
 * projectile/halo/aura de canalisation). Le rendu (`fx/FxLayer`) lit ces entrées ; ajouter
 * une école (Chaos, etc.) = une entrée ici + un dégradé fixe `g_<école>` du registre
 * `FX_GRADIENTS_DEFS` (`fxGradients.ts`), sans toucher au rendu. `gradient` est un id de `FX_GRADIENT_IDS`.
 */
export interface SpellFx {
  /** id de `FX_GRADIENT_IDS` (`fxGradients.ts`) pour le halo/projectile diffus. */
  gradient: string;
  /** couleur du cœur dense (étincelle centrale). */
  core: string;
}
const SCHOOL_FX: Record<SpellSchool, SpellFx> = {
  arcane: { gradient: 'g_arcane', core: '#e7d8ff' }, // Vents de magie — violet/bleu
  divine: { gradient: 'g_divine', core: '#fff4c2' }, // Miracle — or
};

/** FX visuel d'une école (couleur de halo + cœur). */
export function spellFx(school: SpellSchool): SpellFx {
  return SCHOOL_FX[school];
}

/** FX visuel d'un sort par son id (arcane si inconnu). */
export function spellFxForSpell(id: string): SpellFx {
  return spellFx(classifySpell(id).school);
}
