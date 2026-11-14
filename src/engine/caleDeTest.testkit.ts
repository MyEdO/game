/** Fixtures de la cale du navire : des lots de vivres datés, lus par vivre. MDG 14 l.238, l.245-252 */
import type { Id } from '../data/schemas/grammaire/ref';
import type { LotDeVivres } from './provisions';

/** Un lot par vivre de `quantites`, tous embarqués à la minute `entre`. */
export function lotsDeCale(quantites: Record<string, number>, entre: number): LotDeVivres[] {
  return Object.entries(quantites).map(([vivre, rations]) => ({ vivre: vivre as Id<'trapping'>, entre, rations }));
}

/** Les rations de la cale par vivre, tous lots confondus (un vivre sans lot n'y paraît pas). */
export function quantitesDeCale(lots: readonly LotDeVivres[] | undefined): Record<string, number> {
  const q: Record<string, number> = {};
  for (const l of lots ?? []) q[l.vivre] = (q[l.vivre] ?? 0) + l.rations;
  return q;
}
