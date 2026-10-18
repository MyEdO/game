import { describe, it, expect, afterEach } from 'vitest';
import { groundStateOf } from './groundPose';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

const mk = (over: Partial<Combatant>): Combatant =>
  ({ id: 'c', name: 'C', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], ...over }) as unknown as Combatant;

describe('état au sol pour le rendu (groundStateOf)', () => {
  it('debout par défaut ; entité éparse (sans conditions) = debout', () => {
    expect(groundStateOf(mk({}))).toBeNull();
    expect(groundStateOf({ id: 'e', name: 'E' } as unknown as Combatant)).toBeNull();
  });

  it('À Terre → prone (couché conscient)', () => {
    expect(groundStateOf(mk({ conditions: [{ id: 'a-terre', value: 1 }] } as Partial<Combatant>))).toBe('prone');
  });

  it('Inconscient ou hors de combat → corpse (effondré) — prime sur À Terre', () => {
    expect(groundStateOf(mk({ conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }] } as Partial<Combatant>))).toBe('corpse');
    expect(groundStateOf(mk({ dead: true }))).toBe('corpse');
  });

  describe('figurant à 0 PB exact', () => {
    afterEach(() => resetRule('combat-aa-blessures'));
    it("'ldb' : pas de dépassement, toujours en jeu (LDB 18 l.15, l.46)", () => {
      expect(groundStateOf(mk({ kind: 'enemy', wounds: { current: 0, max: 10 } }))).toBeNull();
    });
    it("'aa' : Mort Subite à 0 Blessure → corpse (AA 07 l.65) ; un HÉROS à 0 reste actif (AA 07 l.67)", () => {
      setRule('combat-aa-blessures', 'aa');
      expect(groundStateOf(mk({ kind: 'enemy', wounds: { current: 0, max: 10 } }))).toBe('corpse');
      expect(groundStateOf(mk({ wounds: { current: 0, max: 10 } }))).toBeNull();
    });
  });
});
