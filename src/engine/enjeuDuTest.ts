import type { FlowTest } from './flowCore';
import type { StakeRef } from '../data';

/**
 * Pose l'ENJEU (#1117) d'un `FlowTest` — RÈGLE UNIQUE des deux étages d'enjeu : un enjeu DÉJÀ
 * déclaré (dataset nommé par le producteur, `AuthoredStake` écrit par un document) PRIME toujours ;
 * à défaut, `stake` s'applique. Aucun enjeu à poser, ou enjeu déjà là : le `FlowTest` ressort
 * IDENTIQUE.
 *
 * Deux provenances de `stake` composent cette règle, et elles seules :
 *  - le PRODUCTEUR moteur nomme son dataset au moment où il fabrique le nœud — un nœud venu d'un
 *    `.json` porte ses branches mais ignore la rangée à laquelle il appartient (`miscast.ts` `mkTest`) ;
 *  - la couche `state` le DÉRIVE du porteur qui exige le jet (`withDerivedStake`,
 *    `src/noyau/combat/triggeredTest.ts`).
 * PUR. Les six porteurs de nœud `test` du moteur passent par ici pour nommer ce qui se joue :
 * rangée d'Imparfaite (`miscast.json`), rangée de Critique (`criticals.json`), coup à l'équipage
 * (`river-criticals.json`, `ship-criticals.json`), cycle de maladie (`symptoms.json`,
 * `maladies.json`) et escalade de séquelle (`Trauma.critTrigger`, nœud de RUNTIME — porté par
 * l'instance de Trauma, hors cardinal authoré).
 */
export function poserEnjeu<T extends FlowTest>(test: T, stake: StakeRef | undefined): T {
  if (test.stake || !stake) return test;
  return { ...test, stake };
}
