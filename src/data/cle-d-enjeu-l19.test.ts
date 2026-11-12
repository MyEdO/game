/**
 * #2968 L19 — l'enjeu d'un jet n'a qu'une identité, son `id` (`stakes.json`, `schemas/defs/stakes.ts`) :
 * `resolveStake` le résout à `{ dataset: cascade, kind: id }`, et chaque porte typée (`nightStakeRef`,
 * `voyageStakeRef`, `flowStakeRef`, `combatStakeRef`) ne prend que les ids de SA cascade. Fixtures : enjeu
 * résolu par son id, enjeu d'une autre famille refusé à la porte, clé inconnue refusée au typecheck, Test
 * d'équipage sans enjeu refusé au parse ; au document, ni valeurs calculées ni entrée à trous ou inconnue.
 */
import { describe, expect, it } from 'vitest';
import { STAKES, combatStakeRef, flowStakeRef, nightStakeRef, resolveStake, voyageStakeRef } from './index';
import { catalogStakeSchema, flowTestSchema } from './schemas/grammaire/mecanique';
import seaEvents from './sea-events.json';

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
    const test = { skill: { id: 'athletisme' }, difficulty: 'intermediaire' };
    const { key } = voyageStakeRef('equipage-affaler');
    const r = flowTestSchema.safeParse({ ...test, stake: { key, values: { metres: 3 } } });
    expect(r.success ? [] : r.error.issues.map((i) => [i.code, i.path.join('/'), 'keys' in i ? i.keys : []])).toEqual([['unrecognized_keys', 'stake', ['values']]]);
    expect(flowTestSchema.safeParse({ ...test, stake: { key } }).success).toBe(true);
  });

  it('un document ne vise qu’une entrée d’enjeu qui existe et n’a aucun trou : le moteur seul les remplit (#3606 M2e3)', () => {
    const refus = (key: unknown) => {
      const r = catalogStakeSchema.safeParse({ key });
      return r.success ? [] : r.error.issues.map((i) => [i.path.join('/'), i.message]);
    };
    expect(refus(combatStakeRef('saut-test', { values: { metres: 3 } }).key)).toEqual([['key', 'l’entrée d’enjeu « combat/saut-test » a des trous que seul le moteur remplit (metres) : un document ne peut pas la viser']]);
    expect(refus({ dataset: 'voyage', kind: 'enjeu-inconnu' })).toEqual([['key', 'aucune entrée d’enjeu « voyage/enjeu-inconnu »']]);
    expect(refus(voyageStakeRef('equipage-affaler').key)).toEqual([]);
  });

  it('chaque enjeu au catalogue authoré par `sea-events.json` vise une entrée sans trou', () => {
    const cles: unknown[] = [];
    const visiter = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(visiter);
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (o.stake && typeof o.stake === 'object' && 'key' in o.stake) cles.push(o.stake);
        Object.values(o).forEach(visiter);
      }
    };
    visiter(seaEvents);
    expect(cles.length, 'le document authore des enjeux au catalogue').toBeGreaterThan(0);
    expect(cles.filter((c) => !catalogStakeSchema.safeParse(c).success)).toEqual([]);
  });
});
