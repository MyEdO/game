/**
 * ÉVALUATION d'une `Formula` (`FormuleDe`, `engine/ops.ts`) contre son référent, et l'échelle « par +N DR »
 * (`PerSL`), que `resolveFormula` et `traitsOctroyes` (`engine/traitOctroye.ts`) partagent. Dans la
 * composante fortement connexe d'`ops.ts` par `characteristics.ts` : #3044.
 */
import { bonus, effectiveChar } from './characteristics';
import { rule } from './policy';
import type { Combatant } from './types';
import type { FormuleDe, FormuleSansTirage, PerSL } from './ops';

/** Évaluation commune des deux grammaires : `jet` résout le terme de jet que `J` admet. */
export function evaluer<J>(f: FormuleDe<J>, ref: Combatant, jet: (t: J) => number, indice?: number, stacks?: number, gap?: number, woundsDealt?: number): number {
  if (typeof f === 'number') return f;
  if (typeof f !== 'object' || f === null) return 0; // formule malformée (donnée invalide) → 0, jamais un crash en plein combat
  const sous = (g: FormuleDe<J>): number => evaluer(g, ref, jet, indice, stacks, gap, woundsDealt);
  if ('bonusOf' in f) return bonus(effectiveChar(ref, f.bonusOf));
  if ('charOf' in f) return effectiveChar(ref, f.charOf);
  if ('indiceOf' in f) return indice ?? 0;
  if ('stacks' in f) return stacks ?? 0;
  if ('engagedAdvantageGap' in f) return gap ?? 0;
  if ('woundsDealt' in f) return woundsDealt ?? 0;
  if ('rule' in f) { const v = rule(f.rule); return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
  if ('minimum' in f) return Math.max(f.minimum, sous(f.of));
  if ('sum' in f) return f.sum.reduce<number>((acc, term) => acc + sous(term), 0);
  if ('times' in f) return sous(f.times.of) * sous(f.times.factor);
  return jet(f as J);
}

/** Valeur d'une quantité lue avant tout jet, contre son référent : aucun RNG, aucun terme de jet. */
export function valeurSansTirage(f: FormuleSansTirage, ref: Combatant): number {
  return evaluer<never>(f, ref, (t) => t);
}

/** Bonus de l'échelle « par +N DR » au DR `sl` (`PerSL`). */
export function slBonus(sl: number | undefined, p?: PerSL): number {
  if (!p || sl == null || !Number.isFinite(sl)) return 0; // DR absent OU non fini → 0 (jamais de NaN propagé)
  const magnitude = p.onFailure ? Math.max(0, -sl) : Math.max(0, sl);
  return Math.floor(magnitude / Math.max(1, p.every)) * p.amount;
}
