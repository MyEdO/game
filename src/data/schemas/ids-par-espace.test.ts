import { describe, it, expect } from 'vitest';
import type { IdsParEspace } from './_ids.generated';
import type { FlowStakeId } from '../index';
import { idsDeLaSousListe } from './grammaire/ref';
import { ENGINS_DE_SIEGE } from './grammaire/sousListes';

/**
 * L'union LITTÉRALE des ids par espace (`IdsParEspace`, émise par `scripts/gen-espaces.mts`) ferme
 * l'id AU COMPILATEUR — `FlowStakeId`, `QualityId` en sont des espaces. La preuve est de TYPE : les
 * `@ts-expect-error` ci-dessous rougissent `npm run typecheck` (TS2578) le jour où l'union s'élargit
 * en `string`. Les `expect` ne font que tenir les valeurs vivantes.
 */
describe('IdsParEspace — un id absent de la donnée ne compile pas', () => {
  it('stakes.json, cascade `flux` : `FlowStakeId` refuse un id inconnu et accepte un id réel', () => {
    // @ts-expect-error — 'n-existe-pas' n'est pas un id de la cascade `flux` de stakes.json
    const faux: FlowStakeId = 'n-existe-pas';
    const vrai: FlowStakeId = 'chute-choix';
    expect([faux, vrai]).toEqual(['n-existe-pas', 'chute-choix']);
  });

  it('la règle est GÉNÉRALE : tout espace a son union', () => {
    // @ts-expect-error — 'n-existe-pas' n'est pas un id de etats.json
    const faux: IdsParEspace['etats.json'] = 'n-existe-pas';
    const vrai: IdsParEspace['etats.json'] = 'empetre';
    expect([faux, vrai]).toEqual(['n-existe-pas', 'empetre']);
  });

  it('un discriminant référence `{ id }` ouvre son espace : les engins de siège, `subType` de trappings.json', () => {
    // @ts-expect-error — 'dague' est un trapping hors du sous-type des engins de siège
    const faux: IdsParEspace['trappings.json?subType=armes-de-siege'] = 'dague';
    const vrai: IdsParEspace['trappings.json?subType=armes-de-siege'] = 'pierrier';
    const engins = idsDeLaSousListe('trapping', ENGINS_DE_SIEGE);
    expect(engins).toHaveLength(22);
    expect(engins).toContain(vrai);
    expect(engins).not.toContain(faux);
  });
});
