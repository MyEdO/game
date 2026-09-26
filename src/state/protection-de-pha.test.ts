import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { barrierTilesFor, zonesRoundTick, type BattleZone } from './zones';
import { isProfane } from '../engine/corruption';
import { hasCondition, stacks, COND } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import { useGame } from './store';
import { applyCast } from './combatFlow';
import { createHero } from '../engine/character';
import { findSpell } from '../data';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';
import type { Combatant } from '../engine/types';

/**
 * Protection de Phâ (LDB 48 l.393) — Zone sacrée centrée sur le lanceur (diamètre BFM, durée BFM Rounds) :
 *  (1) les créatures PROFANES (Mort-vivant/Démoniaque, mutées, ou Corruption > BFM+BE) ne peuvent ENTRER
 *      (barrière `gate:'profane'`) ; (2) celles déjà à l'intérieur gagnent Brisé ENTRETENU (sans empiler) ;
 *  (3) nul gain de Corruption dans la Zone. Implémenté sur le système de Zone existant (op `zone`).
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [], traits: [],
  weapons: [], armour: { corps: 0 }, movement: 4, pos: { x: 5, y: 5 }, groups: [],
  ...over,
}) as unknown as Combatant;

const ward = (over: Partial<BattleZone> = {}): BattleZone => ({
  label: 'Protection de Phâ', tiles: [{ x: 5, y: 5 }], rounds: 3, barrier: {}, gate: 'profane',
  perRound: [{ op: 'condition', id: 'brise', unlessCondition: 'brise' }], noCorruption: true, ...over,
});

describe('isProfane (LDB 48 l.393)', () => {
  it('Mort-vivant / Démoniaque (traits) → profane', () => {
    expect(isProfane(mk({ traits: [{ id: 'mort-vivant' }] as never }))).toBe(true);
    expect(isProfane(mk({ traits: [{ id: 'demoniaque' }] as never }))).toBe(true);
  });
  it('porteuse de Mutations → profane', () => {
    expect(isProfane(mk({ mutations: [{ kind: 'physique', label: 'Cornes' }] as never }))).toBe(true);
  });
  it('Corruption > BFM+BE → profane (sinon non)', () => {
    expect(isProfane(mk({ corruption: 7 }))).toBe(true); // BFM 3 + BE 3 = 6 < 7
    expect(isProfane(mk({ corruption: 6 }))).toBe(false);
  });
  it('créature ordinaire → non profane', () => {
    expect(isProfane(mk({ traits: [{ id: 'bestial' }] as never }))).toBe(false);
  });
});

describe('Protection de Phâ — barrière : seuls les profanes ne peuvent entrer', () => {
  it('un profane est bloqué sur les cases de la Zone', () => {
    expect(barrierTilesFor([ward()], mk({ traits: [{ id: 'demoniaque' }] as never }))).toEqual([{ x: 5, y: 5 }]);
  });
  it('un vivant ordinaire n’est PAS bloqué', () => {
    expect(barrierTilesFor([ward()], mk({ kind: 'hero' }))).toEqual([]);
  });
});

describe('Protection de Phâ — Brisé entretenu aux profanes présents (sans empiler)', () => {
  it('un profane dans la Zone gagne 1 Brisé ; re-tick → reste à 1 (unlessCondition)', () => {
    const demon = mk({ id: 'd', traits: [{ id: 'demoniaque' }] as never, pos: { x: 5, y: 5 } as never });
    zonesRoundTick([ward()], [demon], makeRNG(1));
    expect(stacks(demon, COND.brise)).toBe(1);
    zonesRoundTick([ward()], [demon], makeRNG(1));
    expect(stacks(demon, COND.brise)).toBe(1); // entretenu, pas empilé
  });
  it('un vivant dans la Zone ne gagne PAS de Brisé (gate profane)', () => {
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 5, y: 5 } as never });
    zonesRoundTick([ward()], [hero], makeRNG(1));
    expect(hasCondition(hero, COND.brise)).toBe(false);
  });
  it('un profane HORS de la Zone n’est pas affecté', () => {
    const demon = mk({ id: 'd', traits: [{ id: 'demoniaque' }] as never, pos: { x: 99, y: 99 } as never });
    zonesRoundTick([ward()], [demon], makeRNG(1));
    expect(hasCondition(demon, COND.brise)).toBe(false);
  });
});

describe('Protection de Phâ — incantation pose la Zone (intégration applyCast)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('cast self → Zone sacrée centrée sur le lanceur (barrière profane + Brisé + noCorruption + durée BFM)', () => {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', rng: makeRNG(3) });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(5);
    const b = useGame.getState().battle!;
    const caster = b.combatants.find((c) => c.label === 'W')!;
    caster.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 10 });
    caster.characteristics['force-mentale'] = 40; // BFM 4
    caster.pos = { x: 7, y: 7 };
    const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok' };
    applyCast(useGame.getState, useGame.setState, caster, caster, findSpell('Protection de Phâ')!, ok, false, false);

    const z = (useGame.getState().battle!.zones ?? []).find((x) => x.label === 'Protection de Phâ')!;
    expect(z).toBeTruthy();
    expect(z.barrier).toBeTruthy();
    expect(z.gate).toBe('profane');
    expect(z.noCorruption).toBe(true);
    expect(z.perRound?.some((o) => o.op === 'condition' && o.id === 'brise')).toBe(true);
    expect(z.rounds).toBe(4); // (BFM 4) Rounds
    expect(z.casterId).toBe(caster.id);
    expect(z.tiles.some((t) => t.x === 7 && t.y === 7)).toBe(true); // centrée sur le lanceur (range self)
  });
});
