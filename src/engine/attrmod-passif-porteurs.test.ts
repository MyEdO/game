import { describe, it, expect, afterEach } from 'vitest';
import { effectiveMaxWounds } from './characteristics';
import { fortuneMax, resolveMax } from './talentEffects';
import type { Combatant } from './types';
import { resetData } from '../data/overrides';
import { combattantDeTest } from './combattantDeTest.testkit';
import { PORTEURS } from './porteursDePassifs.testkit';

/**
 * `attrMod` PASSIF lu sur TOUT porteur du collecteur `passiveMods`, talents compris (#3060, #1463).
 * Inventaire des porteurs et de leur branche de collecte : `trauma.ts › passiveMods`.
 */

/** F 38 (BF 3), E 35 (BE 3), FM 31 (BFM 3) : B = 12. */
const heros = (): Combatant => combattantDeTest({ id: 'h', label: 'Héros', kind: 'hero', characteristics: { force: 38, endurance: 35, 'force-mentale': 31 } });

afterEach(() => resetData());

describe('attrMod de Blessures passif — tout porteur compte au maximum des Blessures', () => {
  it.each(PORTEURS)('%s : +3 Blessures, puis +BE (formule) ; sans le porteur, 12', (_, __, poser) => {
    const c = heros();
    expect(effectiveMaxWounds(c)).toBe(12);
    poser(c, [{ op: 'attrMod', attr: 'wounds', mod: 3 }]);
    expect(effectiveMaxWounds(c)).toBe(15);
    const d = heros();
    poser(d, [{ op: 'attrMod', attr: 'wounds', mod: { bonusOf: 'endurance' } }]);
    expect(effectiveMaxWounds(d)).toBe(15);
  });

  it.each(PORTEURS)('%s : un +BE suit le Bonus d’Endurance qui augmente (LDB 10 l.384)', (_, __, poser) => {
    const c = heros();
    poser(c, [{ op: 'attrMod', attr: 'wounds', mod: { bonusOf: 'endurance' } }]);
    c.characteristics.endurance = 45;
    expect(effectiveMaxWounds(c)).toBe(3 + 2 * 4 + 3 + 4);
  });
});

describe('attrMod de Chance et de Détermination passif — tout porteur', () => {
  it.each(PORTEURS)('%s : +1 Chance, +2 Détermination', (_, __, poser) => {
    const c = { ...heros(), fate: 2, resilience: 1 } as Combatant;
    poser(c, [{ op: 'attrMod', attr: 'fortune', mod: 1 }, { op: 'attrMod', attr: 'resolve', mod: 2 }]);
    expect(fortuneMax(c)).toBe(3);
    expect(resolveMax(c)).toBe(3);
  });
});
