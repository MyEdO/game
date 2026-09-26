import { describe, it, expect } from 'vitest';
import { fireTriggers } from './triggeredEffects';
import { addCondition, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/**
 * Trait Redoutable (Zoo Impérial) — au début de son tour, la créature complète ses Avantages jusqu'à
 * son *Indice* (`value` de l'instance), sauf si Empêtré/Inconscient/Surpris (ZI 14 l.1045). Câblé 100% en
 * DONNÉE : trigger `onTurnStart` → Flow gardé (`compare` sur les États) → op `gainAdvantage` dont
 * l'`amount: '$indice'` est baké à la valeur d'instance par `withArg`. Aucun code spécifique à Redoutable.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  ...over,
}) as unknown as Combatant;
const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
const fire = (c: Combatant) => fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onTurnStart', {});

describe('Trait Redoutable (ZI) — Avantage minimum = Indice au début du tour', () => {
  it('porte l’Avantage jusqu’à l’Indice (value:2)', () => {
    const c = mk({ traits: [{ id: 'redoutable', value: 2 }] as never, advantage: 0 });
    fire(c);
    expect(c.advantage).toBe(2);
  });

  it('ne réduit JAMAIS l’Avantage (déjà 3 > Indice 2 → reste 3)', () => {
    const c = mk({ traits: [{ id: 'redoutable', value: 2 }] as never, advantage: 3 });
    fire(c);
    expect(c.advantage).toBe(3);
  });

  it('Indice 1 → Avantage 1', () => {
    const c = mk({ traits: [{ id: 'redoutable', value: 1 }] as never, advantage: 0 });
    fire(c);
    expect(c.advantage).toBe(1);
  });

  it('Empêtré → ne gagne PAS d’Avantage (garde, ZI 14 l.1045)', () => {
    const c = mk({ traits: [{ id: 'redoutable', value: 2 }] as never, advantage: 0 });
    addCondition(c, COND.empetre);
    fire(c);
    expect(c.advantage).toBe(0);
  });

  it('Inconscient → ne gagne PAS d’Avantage (garde, ZI 14 l.1045)', () => {
    const c = mk({ traits: [{ id: 'redoutable', value: 2 }] as never, advantage: 0 });
    addCondition(c, COND.inconscient);
    fire(c);
    expect(c.advantage).toBe(0);
  });

  it('Surpris → ne gagne PAS d’Avantage', () => {
    const c = mk({ traits: [{ id: 'redoutable', value: 2 }] as never, advantage: 0 });
    addCondition(c, COND.surpris);
    fire(c);
    expect(c.advantage).toBe(0);
  });

  it('sans le trait → aucun changement d’Avantage', () => {
    const c = mk({ advantage: 0 });
    fire(c);
    expect(c.advantage).toBe(0);
  });
});
