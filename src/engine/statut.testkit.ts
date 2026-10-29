import { careers, levelsForCareer } from '../data';
import { actorStatus } from './social';
import { statusBudgetBrass } from './money';
import type { Combatant } from './types';

/**
 * Carrière et niveau au Statut le plus haut de la donnée, avec son budget « Tenir les comptes » en sous
 * (LDB 59 l.9-11) — le héros dont les moyens couvrent le plus d'objets.
 */
export function statutLePlusHaut(): { career: string; careerLevel: number; budget: number } {
  let best = { career: '', careerLevel: 1, budget: -1 };
  for (const c of careers) {
    levelsForCareer(c.id).forEach((_l, i) => {
      const st = actorStatus({ career: c.id, careerLevel: i + 1 } as Combatant);
      const budget = statusBudgetBrass(st.tier, st.standing);
      if (budget > best.budget) best = { career: c.id, careerLevel: i + 1, budget };
    });
  }
  return best;
}
