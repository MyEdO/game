import { describe, it, expect } from 'vitest';
import type { IdsParDataset } from './_ids.generated';
import type { FlowStakeId } from '../index';

/**
 * L'union LITTÉRALE des ids par dataset (`IdsParDataset`, émise par `scripts/gen-registry.mjs`) ferme
 * l'id AU COMPILATEUR, comme `QualityId` (`scripts/gen-quality-ids.mjs`). La preuve est de TYPE : les
 * `@ts-expect-error` ci-dessous rougissent `npm run typecheck` (TS2578) le jour où l'union s'élargit
 * en `string`. Les `expect` ne font que tenir les valeurs vivantes.
 */
describe('IdsParDataset — un id absent de la donnée ne compile pas', () => {
  it('flow-stakes.json : `FlowStakeId` refuse un id inconnu et accepte un id réel', () => {
    // @ts-expect-error — 'n-existe-pas' n'est pas un id de flow-stakes.json
    const faux: FlowStakeId = 'n-existe-pas';
    const vrai: FlowStakeId = 'fall-choice';
    expect([faux, vrai]).toEqual(['n-existe-pas', 'fall-choice']);
  });

  it('la règle est GÉNÉRALE : tout dataset a son union', () => {
    // @ts-expect-error — 'n-existe-pas' n'est pas un id de etats.json
    const faux: IdsParDataset['etats.json'] = 'n-existe-pas';
    const vrai: IdsParDataset['etats.json'] = 'empetre';
    expect([faux, vrai]).toEqual(['n-existe-pas', 'empetre']);
  });
});
