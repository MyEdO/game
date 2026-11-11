import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, expect, it } from 'vitest';
import { EMBLEME, scenario } from './embleme-au-combat';
import { porteeDuCombattant } from '../../noyau/apparence/combattant';

const { party } = scenario.construire(idsDeTest);
const porteEcu = party.find((h) => h.id === 'porte-ecu')!;

describe('scénario « Emblème au combat » (#3253)', () => {
  it('sans aucun geste, le Porte-écu porte l’épée en main principale, le bouclier en main secondaire et l’emblème de sa donnée', () => {
    const portee = porteeDuCombattant(porteEcu)!;
    const tenus = portee.portees.filter((p) => p.cle.champ === 'apparence').map((p) => [p.point, p.cle.id]);
    expect(tenus).toEqual([['main', 'epee'], ['secondaire', 'rond']]);
    expect(portee.embleme).toEqual({ id: EMBLEME });
  });
});
