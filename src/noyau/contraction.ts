import { diseaseTestModLines, sujetDeContraction } from '../engine/disease';
import type { Combatant } from '../engine/types';

/** LDB 20 l.25, l.41, l.51, l.64, l.90 ; LDB 16 l.105 */
export function ligneDeContraction(porteur: Combatant, disease: string) {
  return {
    test: sujetDeContraction(disease),
    surLaCible: diseaseTestModLines(porteur, disease),
  };
}
