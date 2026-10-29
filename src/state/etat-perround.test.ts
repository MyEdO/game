import { describe, it, expect } from 'vitest';
import { fireConditionEffects } from '../noyau/triggeredEffects';
import { addCondition, hasCondition, stacks, COND } from '../engine/conditions';
import { slugId } from '../data/slug';
import type { Combatant } from '../engine/types';
import { deFixe, desDuTest } from '../engine/dice.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

const mk = (): Combatant => combattantDeTest({
  id: 'x', label: 'X', kind: 'enemy', characteristics: { endurance: 40 }, armour: { corps: 5 } as Combatant['armour'],
  wounds: { current: 10, max: 10, base: 10 },
});

describe('Empoisonné — dégâts par-round en DONNÉES (effects: onRoundEnd → wounds {stacks:self})', () => {
  const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;

  it('1 pion → 1 PB perdu, en IGNORANT BE+PA (le défaut de wounds)', () => {
    const c = mk(); addCondition(c, COND.empoisonne);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: desDuTest });
    expect(before - c.wounds.current).toBe(1); // BE=4 et PA=5 IGNORÉS (sinon 0)
  });

  it('3 pions → 3 PB perdus ({stacks:self} = nombre de pions)', () => {
    const c = mk(); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne); addCondition(c, COND.empoisonne);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: desDuTest });
    expect(before - c.wounds.current).toBe(3);
  });

  it('aucun Empoisonné → aucun dégât (inerte)', () => {
    const c = mk();
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: desDuTest });
    expect(c.wounds.current).toBe(before);
  });
});

describe('En Flammes — dégâts par-round en DONNÉES (effects onRoundEnd → wounds {sum:[1d10, pions, −1]} − BE − PAmin, min 1)', () => {
  const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
  const fixedD10 = deFixe; // int(1,10) moqué → d10 = v

  it('1 pion : 1d10 − BE − PAmin (BE=4, PAmin=0) ; d10=8 → 8−4 = 4 PB', () => {
    const c = mk(); c.armour = { corps: 0 } as never; addCondition(c, COND.enFlammes);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: fixedD10(8) });
    expect(before - c.wounds.current).toBe(4); // 8 + (1−1) − 4 − 0 = 4
  });

  it('3 pions : +1 par État en plus AVANT réduction ; d10=4, BE=7, PAmin=0 → (4+2)−7 = −1 → plancher 1', () => {
    const c = mk(); c.characteristics.endurance = 70; c.armour = { corps: 0 } as never;
    addCondition(c, COND.enFlammes); addCondition(c, COND.enFlammes); addCondition(c, COND.enFlammes);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: fixedD10(4) });
    expect(before - c.wounds.current).toBe(1); // max(1, (4+3−1) − 7 − 0) = max(1,−1) = 1
  });

  it('PAmin = la Localisation la MOINS protégée (pas le Corps) ; corps=5 mais tête=1 → PA=1', () => {
    const c = mk(); c.characteristics.endurance = 0; // BE=0
    c.armour = { tete: 1, corps: 5 } as never;
    addCondition(c, COND.enFlammes);
    const before = c.wounds.current;
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: fixedD10(8) });
    expect(before - c.wounds.current).toBe(7); // 8 − 0 − min(1,5)=1 = 7
  });
});

describe('Hémorragique — dégâts par-round en DONNÉES (effects onRoundEnd → wounds {stacks:self}, réduit par Endurci)', () => {
  const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
  const fire = (c: Combatant) => fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: desDuTest });

  it('2 pions, sans Endurci → 2 PB perdus, en IGNORANT BE+PA', () => {
    const c = mk(); addCondition(c, COND.hemorragique); addCondition(c, COND.hemorragique);
    const before = c.wounds.current;
    fire(c);
    expect(before - c.wounds.current).toBe(2);
  });

  it('Endurci ×1 (stacksReducedBy bleedIgnore) : 2 pions − 1 ignoré → 1 PB perdu', () => {
    const c = mk(); c.talents = [{ talentId: slugId('Endurci'), times: 1 }] as never;
    addCondition(c, COND.hemorragique); addCondition(c, COND.hemorragique);
    const before = c.wounds.current;
    fire(c);
    expect(before - c.wounds.current).toBe(1); // max(0, 2 − 1) = 1
  });

  it('Endurci ×2 ≥ pions → aucun dégât (le saignement est entièrement ignoré, plancher 0)', () => {
    const c = mk(); c.talents = [{ talentId: slugId('Endurci'), times: 2 }] as never;
    addCondition(c, COND.hemorragique);
    const before = c.wounds.current;
    fire(c);
    expect(c.wounds.current).toBe(before); // max(0, 1 − 2) = 0
  });
});

describe('Auto-dissipation en fin de Round en DONNÉES (effects: onRoundEnd → removeCondition)', () => {
  const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
  const fire = (c: Combatant) =>
    fireConditionEffects((get as (c: Combatant) => unknown)(c) as never, c, 'onRoundEnd', { rng: desDuTest });

  // LDB 16 : Aveuglé (l.48) / Assourdi (l.32) / Surpris (l.136) sont retirés à la fin du Round.
  for (const name of [COND.aveugle, COND.assourdi, COND.surpris] as const) {
    it(`${name} : 1 pion retiré à la fin du Round`, () => {
      const c = mk(); addCondition(c, name);
      fire(c);
      expect(hasCondition(c, name)).toBe(false);
    });
  }

  it('Aveuglé ×2 : un SEUL pion retiré par Round (les autres restent)', () => {
    const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.aveugle);
    fire(c);
    expect(stacks(c, COND.aveugle)).toBe(1);
  });

  it('plusieurs États qui dissipent en même temps (Aveuglé + Surpris) → chacun perd 1 pion', () => {
    const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.surpris);
    fire(c); // l'itération snapshot la liste : retirer l'un ne saute pas l'autre
    expect(hasCondition(c, COND.aveugle)).toBe(false);
    expect(hasCondition(c, COND.surpris)).toBe(false);
  });
});
