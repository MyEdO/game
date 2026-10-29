import { describe, it, expect, afterEach } from 'vitest';
import { effectiveMaxWounds } from './characteristics';
import { extraWounds, fortuneMax, resolveMax } from './talentEffects';
import type { OpPassive } from './ops';
import type { Combatant } from './types';
import { resetData } from '../data/overrides';
import { combattantDeTest } from './combattantDeTest.testkit';
import { ID_DE_PORTEUR, PORTEURS_HORS_TALENT, ajouterAuCatalogue } from './porteursDePassifs.testkit';

/**
 * `attrMod` PASSIF lu sur TOUT porteur du collecteur `passiveMods` (#3060). Inventaire des porteurs et de
 * leur branche de collecte : `trauma.ts › passiveMods`. Un talent compte dans `wounds.base`
 * (`extraWounds`) ; tout autre porteur compte au delta d'`effectiveMaxWounds`.
 */

/** F 38 (BF 3), E 35 (BE 3), FM 31 (BFM 3) : B = 12. */
const heros = (): Combatant => combattantDeTest({ id: 'h', label: 'Héros', kind: 'hero', characteristics: { force: 38, endurance: 35, 'force-mentale': 31 } });

afterEach(() => resetData());

describe('attrMod de Blessures passif — tout porteur hors talent compte au delta des Blessures max', () => {
  it.each(PORTEURS_HORS_TALENT)('%s : +3 Blessures, puis +BE (formule) ; sans le porteur, 12', (_, __, poser) => {
    const c = heros();
    expect(effectiveMaxWounds(c)).toBe(12);
    poser(c, [{ op: 'attrMod', attr: 'wounds', mod: 3 }]);
    expect(effectiveMaxWounds(c)).toBe(15);
    const d = heros();
    poser(d, [{ op: 'attrMod', attr: 'wounds', mod: { bonusOf: 'endurance' } }]);
    expect(effectiveMaxWounds(d)).toBe(15);
  });

  it('talent : ses Blessures sont dans `wounds.base` (`extraWounds`), jamais recomptées au delta', () => {
    const c = heros();
    ajouterAuCatalogue('talents', { passive: [{ op: 'attrMod', attr: 'wounds', mod: 3 }] });
    c.talents = [{ talentId: ID_DE_PORTEUR, times: 2 }];
    expect(extraWounds(c)).toBe(6);
    expect(effectiveMaxWounds(c)).toBe(12);
  });
});

describe('attrMod de Chance et de Détermination passif — tout porteur, talents compris', () => {
  it.each([...PORTEURS_HORS_TALENT, ['talent', 'talents', (c: Combatant, passive: OpPassive[]) => { ajouterAuCatalogue('talents', { passive }); c.talents = [{ talentId: ID_DE_PORTEUR, times: 1 }]; }] as const])(
    '%s : +1 Chance, +2 Détermination',
    (_, __, poser) => {
      const c = { ...heros(), fate: 2, resilience: 1 } as Combatant;
      poser(c, [{ op: 'attrMod', attr: 'fortune', mod: 1 }, { op: 'attrMod', attr: 'resolve', mod: 2 }]);
      expect(fortuneMax(c)).toBe(3);
      expect(resolveMax(c)).toBe(3);
    },
  );
});
