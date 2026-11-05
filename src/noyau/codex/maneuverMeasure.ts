import type { ManeuverMeasure } from '../../data';
import { CHAR_LABELS } from '../../engine/types';

/** Portée/Souffle d'une manœuvre (`ManeuverMeasure`, mètres = bonus(carac) + plus) → prose FR DÉRIVÉE
 *  de la structure (comme `formatSpellRange`) : « (Bonus de Endurance) m », « (Bonus de Endurance) + 20 m »,
 *  « 20 m ». Affichage seul (le combat résout en mètres via `measureMeters`). */
export function formatManeuverMeasure(m: ManeuverMeasure): string {
  const bonus = m.bonusOf ? `(Bonus de ${CHAR_LABELS[m.bonusOf]})` : null;
  const plus = m.plus ? String(m.plus) : null;
  const expr = bonus && plus ? `${bonus} + ${plus}` : bonus ?? plus ?? '0';
  return `${expr} m`;
}
