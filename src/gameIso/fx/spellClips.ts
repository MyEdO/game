/**
 * Style d'INCANTATION dérivé de la relation lanceur↔cible (donnée présente dans l'événement, sans
 * toucher le store) : `bolt`, sort OFFENSIF sur un ennemi (un projectile magique part — géré par la
 * surcouche de plateau, `fx/FxLayer`) ; `blessing`, BÉNÉDICTION / MIRACLE / buff sur soi ou un allié
 * (halo sur la cible, pas de projectile).
 *
 * Classification fine arcane/divin/projectile : `classifySpellByLabel` (data-driven via
 * spells.json + engine/magic).
 */
import { findSpell } from '../../data';
import { castInfo, isMagicMissile } from '../../engine/magic';
import type { StyleDeSort } from '../../noyau/animation';

/** Style de geste depuis la relation lanceur↔cible (offensif vs soutien). */
export function spellCastStyle(casterKind?: string, targetKind?: string, isSelf = false): StyleDeSort {
  if (isSelf) return 'blessing';
  if (casterKind && targetKind && casterKind === targetKind) return 'blessing'; // sur un allié
  return 'bolt'; // sur un ennemi
}

/** True si l'incantation est un soutien (pas de projectile ; halo sur la cible). */
export function isSupportiveCast(casterKind?: string, targetKind?: string, isSelf = false): boolean {
  return spellCastStyle(casterKind, targetKind, isSelf) === 'blessing';
}

export type SpellSchool = 'divine' | 'arcane';

/** Classification CANONIQUE d'un sort par libellé (data-driven). */
export function classifySpellByLabel(label: string): { school: SpellSchool; missile: boolean } {
  const spell = findSpell(label);
  if (!spell) return { school: 'arcane', missile: false };
  return {
    school: castInfo(spell).skill === 'priere' ? 'divine' : 'arcane',
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

/** FX visuel depuis le libellé d'un sort (arcane par défaut si inconnu). */
export function spellFxForLabel(label?: string): SpellFx {
  return spellFx(label ? classifySpellByLabel(label).school : 'arcane');
}
