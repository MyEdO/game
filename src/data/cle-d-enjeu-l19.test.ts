/**
 * #2968 L19 — l'enjeu d'un jet n'a qu'une identité, son `id` (`stakes.json`, `schemas/defs/stakes.ts`) :
 * `resolveStake` le résout à `{ dataset: cascade, kind: id }`, et chaque porte typée (`nightStakeRef`,
 * `voyageStakeRef`, `flowStakeRef`, `combatStakeRef`) ne prend que les ids de SA cascade. Fixtures : enjeu
 * résolu par son id, enjeu d'une autre famille refusé à la porte, clé inconnue refusée au typecheck, Test
 * d'équipage sans enjeu refusé au parse, valeurs calculées d'un enjeu refusées au document.
 */
import { describe, expect, it } from 'vitest';
import { STAKES, combatStakeRef, flowStakeRef, nightStakeRef, resolveStake, voyageStakeRef } from './index';
import { flowTestSchema } from './schemas/grammaire/mecanique';

const entree = (id: string) => STAKES.find((e) => e.id === id)!;

describe('L19 — un enjeu, une identité : son id', () => {
  it('chaque porte résout l’enjeu que son id nomme, son gabarit et son foyer', () => {
    expect(resolveStake(combatStakeRef('combat-fatigue')).text).toBe(entree('combat-fatigue').template);
    expect(resolveStake(voyageStakeRef('equipage-progression')).rule).toEqual({ category: 'regles', id: 'test-equipage-progression' });
    expect(resolveStake(nightStakeRef('marche-forcee')).text).toBe(entree('marche-forcee').template);
    expect(resolveStake(flowStakeRef('course-test')).text).toBe(entree('course-test').template);
    expect(combatStakeRef('combat-fatigue').key).toEqual({ dataset: 'combat', kind: 'combat-fatigue' });
  });

  it('une porte de famille refuse l’enjeu d’une autre famille', () => {
    // @ts-expect-error — `equipage-progression` est un enjeu de voyage
    expect(() => combatStakeRef('equipage-progression')).toThrow(/aucune entrée d'enjeu/);
    // @ts-expect-error — `combat-fatigue` est un enjeu de combat
    expect(() => nightStakeRef('combat-fatigue')).toThrow(/aucune entrée d'enjeu/);
    expect(() => resolveStake({ key: { dataset: 'voyage', kind: 'exposition-nocturne' } })).toThrow(/aucune entrée d'enjeu/);
  });

  it('une clé qui n’est l’id d’aucun enjeu est refusée au typecheck, puis à la construction', () => {
    // @ts-expect-error — `enjeu-inconnu` n'est l'id d'aucun enjeu de voyage
    expect(() => voyageStakeRef('enjeu-inconnu')).toThrow(/aucune entrée d'enjeu/);
  });

  it('un Test d’équipage de Flow nomme son enjeu : sans lui, il est refusé au parse', () => {
    const test = { crewTestType: 'affaler', difficulty: 'difficile' };
    const r = flowTestSchema.safeParse(test);
    expect(r.success).toBe(false);
    expect(r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toMatch(/Test d’équipage SANS enjeu/);
    expect(flowTestSchema.safeParse({ ...test, stake: voyageStakeRef('equipage-affaler') }).success).toBe(true);
  });

  it('un document authore la clé d’un enjeu au catalogue, jamais les valeurs de ses trous, que le flux calcule (#3606 M2e3)', () => {
    const calcule = combatStakeRef('saut-test', { values: { metres: 3 } });
    const test = { skill: { id: 'athletisme' }, difficulty: 'intermediaire' };
    const r = flowTestSchema.safeParse({ ...test, stake: calcule });
    expect(r.success ? [] : r.error.issues.map((i) => [i.code, i.path.join('/'), 'keys' in i ? i.keys : []])).toEqual([['unrecognized_keys', 'stake', ['values']]]);
    expect(flowTestSchema.safeParse({ ...test, stake: { key: calcule.key } }).success).toBe(true);
  });
});
