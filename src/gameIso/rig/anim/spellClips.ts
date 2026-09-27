/**
 * Animations d'INCANTATION (brin H). Deux gestes distincts dérivés de la relation
 * lanceur↔cible (donnée présente dans l'événement, sans toucher le store) :
 *  - bolt     : sort OFFENSIF sur un ennemi → rassemble l'énergie puis projette en avant
 *               (un projectile magique part — géré par la surcouche de plateau, `fx/FxLayer`).
 *  - blessing : BÉNÉDICTION / MIRACLE / buff sur soi ou un allié → bras levés soutenus,
 *               tête vers le ciel, halo sur la cible (pas de projectile).
 *
 * Classification fine arcane/divin/projectile : `classifySpellByLabel` (data-driven via
 * spells.json + engine/magic), prête pour un futur tintage de feedback quand l'événement
 * portera le libellé du sort.
 */
import type { Clip, ClipStep } from './clips';
import { findSpell } from '../../../data';
import { castInfo, isMagicMissile } from '../../../engine/magic';

const REST = {};
const c = (steps: ClipStep[], onImpact?: number): Clip => ({ steps, onImpact });

export type SpellCastStyle = 'bolt' | 'blessing';

const CAST: Record<SpellCastStyle, Clip> = {
  // Offensif : rassemble l'énergie (bras repliés) puis PROJETTE des deux mains.
  bolt: c([
    { pose: { epauleG: -50, epauleD: -50, avantBrasG: -30, avantBrasD: -30, tete: -4 }, ms: 200, easing: 'easeOut' },
    { pose: { epauleG: 55, epauleD: 55, avantBrasG: 10, avantBrasD: 10, torse: 6, bassin: 4 }, ms: 110, easing: 'easeOutBack' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 320),
  // Bénédiction/miracle : bras levés haut et SOUTENUS, regard vers le ciel.
  blessing: c([
    { pose: { epauleG: -80, epauleD: -80, avantBrasG: -20, avantBrasD: -20, tete: -10 }, ms: 260, easing: 'easeOut' },
    { pose: { epauleG: -82, epauleD: -82, tete: -12, torse: -3 }, ms: 300, easing: 'easeInOut' },
    { pose: REST, ms: 240, easing: 'easeInOut' },
  ], 560),
};

/** Style de geste depuis la relation lanceur↔cible (offensif vs soutien). */
export function spellCastStyle(casterKind?: string, targetKind?: string, isSelf = false): SpellCastStyle {
  if (isSelf) return 'blessing';
  if (casterKind && targetKind && casterKind === targetKind) return 'blessing'; // sur un allié
  return 'bolt'; // sur un ennemi
}

export function spellCastClip(style: SpellCastStyle): Clip {
  return CAST[style];
}

/** True si l'incantation est un soutien (pas de projectile ; halo sur la cible). */
export function isSupportiveCast(casterKind?: string, targetKind?: string, isSelf = false): boolean {
  return spellCastStyle(casterKind, targetKind, isSelf) === 'blessing';
}

export type SpellSchool = 'divine' | 'arcane';

/** Classification CANONIQUE d'un sort par libellé (data-driven). Pour feedback futur. */
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
 * `rigFxGradients` (`fxGradients.ts`), sans toucher au rendu. `gradient` est un id de `FX_GRADIENT_IDS`.
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
