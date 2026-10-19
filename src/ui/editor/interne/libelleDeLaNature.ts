import { refLabel } from '../../../data';
import type { NatureDInfluence } from '../../../data/schemas/grammaire/valeurs';
import { testDeRegle } from '../../../engine/reglesChiffrees';

/** Libellé d'atelier d'une nature d'Influence : la compétence et le libellé de son Test dans la fiche
 *  `influences-corruptrices` (LDB 19 l.29). */
export function libelleDeLaNature(nature: NatureDInfluence): string {
  const test = testDeRegle('influences-corruptrices', nature);
  return `${refLabel('skills', test.skill)} (${test.label})`;
}
