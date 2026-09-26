/**
 * Sort « Souffle » (LDB 47 l.509) : « Vous effectuez immédiatement une attaque de Souffle, comme
 * si vous aviez dépensé 2 Avantages pour activer le Trait de créature Souffle (voir page 341).
 * Souffle est un Projectile magique dont les Dégâts sont égaux à votre Bonus d'Endurance. Le MJ
 * détermine quel type d'attaque de Souffle correspond le mieux à votre Talent Magie des Arcanes. »
 * — délégué à l'attaque de ZONE du trait (applyAreaAttack), centrée sur la cible du sort.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyCast, castSpell } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { findSpell } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';

const okRes = (sl: number): CastResult => ({ cast: true, roll: 30, target: 70, sl, isCritical: false, isFumble: false, log: 'lance Souffle' });

describe('Souffle — délégation à l’attaque de zone du Trait (LDB 47 l.509)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', rng: makeRNG(3) });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(2);
    const b = useGame.getState().battle!;
    const caster = b.combatants.find((c) => c.label === 'W')!;
    caster.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 10 });
    caster.talents.push({ talentId: 'magie-des-arcanes', spec: 'Feu', times: 1 });
    caster.characteristics.endurance = 60; // BE 6 → Dégâts du Souffle
    caster.characteristics['capacite-de-tir'] = 100;
    caster.pos = { x: 10, y: 10 };
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    const T = foes[0];
    T.pos = { x: 12, y: 10 };
    T.characteristics.agilite = 5;
    T.skills = T.skills.filter((s) => s.id !== 'esquive');
    foes.slice(1).forEach((e) => { e.pos = { x: 30, y: 30 }; }); // hors zone
    return { caster, T };
  }

  it('lancé avec succès : attaque de zone Souffle (Feu) centrée sur la cible du sort', () => {
    const { caster, T } = setup();
    const souffle = findSpell('Souffle')!;
    applyCast(useGame.getState, useGame.setState, caster, T, souffle, okRes(6), false, false);
    const log = useGame.getState().battle!.log.map((e) => e.text).join('\n');
    expect(log).toMatch(/déclenche Souffle \(Feu\)/);
  });

  it('castSpell : la portée du sort suit le TRAIT (BE+20 m), pas le champ « 1 mètre »', () => {
    const { caster, T } = setup();
    T.pos = { x: 16, y: 10 }; // 6 cases = 12 m — hors « 1 mètre », dans BE+20 (26 m)
    castSpell(useGame.getState, useGame.setState, caster, T, 'souffle');
    expect(useGame.getState().pendingCast).not.toBeNull();
    expect(useGame.getState().pendingCast!.missile).toBe(false); // résolu comme zone, pas Projectile
  });
});
