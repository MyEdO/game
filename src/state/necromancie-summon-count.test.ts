/**
 * Compte d'invocations d'un Sort de Nécromancie au LANCEMENT (chaîne réelle `castCommitZone` →
 * `applyCast` → `applySummon`), là où `summon-flow.test.ts` couvre `applySummon` seule.
 *
 * Réanimation (LDB 50 l.94) : « Réanimez un nombre de corps égal à Bonus de Force Mentale + DR ».
 * Relever les morts (LDB 50 l.106) : « DR+1 Squelettes sortiront ainsi du sol ».
 * Le DR est celui du Test d'Incantation (LDB 46 l.24) ; NI 8 → un lancement NON focalisé n'aboutit
 * qu'à partir de DR 8 (LDB 46 l.132 : la Focalisation ramène le NI à 0, le DR du Test reste le sien).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { spawnEnemy } from './spawn';
import { castCommitZone } from './combatFlow';
import { findSpell } from '../data';
import { evaluateCasting } from '../engine/magic';
import { bonus, effectiveChar } from '../engine/characteristics';
import type { Combatant } from '../engine/types';
import type { TestResult } from '../engine/tests';

/** Jet d'Incantation FIGÉ (aucun dé) : seul le DR pilote le compte. */
const frozen = (sl: number): TestResult => ({ roll: 11, target: 60, success: true, sl, isDouble: false });

/** Nécromancien du bestiaire (BFM 4) + N adversaires DANS la zone posée. */
function setup(foes: number): Combatant {
  const necro = spawnEnemy({ ref: 'necromancien' }, 'necro', { x: 5, y: 5 });
  necro.kind = 'enemy';
  const others = Array.from({ length: foes }, (_, i) =>
    Object.assign(spawnEnemy({ ref: 'brigand' }, `foe${i}`, { x: 8 + i, y: 5 }), { kind: 'hero' as const }),
  );
  const combatants = [necro, ...others];
  const ids = combatants.map((c) => c.id);
  const battle = {
    combatants, order: ids, baseOrder: [...ids], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  const scene = {
    id: 's', name: 's', dimensions: { w: 30, h: 30 }, ambiance: 'exterieur',
    layers: [{ z: 0, tiles: new Array(30 * 30).fill('herbe') }],
    entities: [], dialogues: [], triggers: [], encounters: [],
  } as never;
  useGame.setState({ battle, scene, party: [], journal: [], pendingCast: null, pendingCascade: null });
  return useGame.getState().battle!.combatants.find((c) => c.id === 'necro')!;
}

/** Pose la zone du sort au DR donné et rend le nombre de créatures invoquées. */
function castAndCount(spellRef: string, sl: number, opts: { foes?: number; focused?: boolean } = {}): number {
  const spell = findSpell(spellRef)!;
  const caster = setup(opts.foes ?? 1);
  const res = evaluateCasting(caster, spell, frozen(sl), opts.focused ?? true);
  if (!res.cast) return -1; // incantation non aboutie (DR < NI)
  useGame.setState({
    pendingCast: {
      casterId: 'necro', targetId: 'necro', spellId: spell.id, missile: false, focused: opts.focused ?? true,
      result: res, zone: { center: null, radius: 2, r0m: 4 },
    } as never,
  });
  castCommitZone(useGame.getState, useGame.setState, { x: 8, y: 5 });
  return useGame.getState().battle!.combatants.filter((c) => c.summon).length;
}

describe('Nécromancie — compte d’invocations au lancement', () => {
  beforeEach(() => { useGame.getState().seedRng(7); });

  it('Réanimation : exactement Bonus de Force Mentale + DR zombies (LDB 50 l.94)', () => {
    const bfm = bonus(effectiveChar(setup(1), 'force-mentale'));
    expect(bfm).toBe(4);
    expect(castAndCount('Réanimation', 0)).toBe(bfm);
    expect(castAndCount('Réanimation', 3)).toBe(bfm + 3);
  });

  it('Relever les morts : exactement DR + 1 squelettes (LDB 50 l.106)', () => {
    expect(castAndCount('Relever les morts', 0)).toBe(1);
    expect(castAndCount('Relever les morts', 4)).toBe(5);
  });

  it('ZdE : le compte est celui du LANCEMENT, jamais multiplié par le nombre de cibles dans la zone', () => {
    const solo = castAndCount('Réanimation', 2, { foes: 1 });
    expect(castAndCount('Réanimation', 2, { foes: 4 })).toBe(solo);
  });

  it('NI 8 sans Focalisation : le Sort n’aboutit qu’à partir de DR 8 (LDB 46 l.24)', () => {
    expect(castAndCount('Réanimation', 7, { focused: false })).toBe(-1);
    const bfm = bonus(effectiveChar(setup(1), 'force-mentale'));
    expect(castAndCount('Réanimation', 8, { focused: false })).toBe(bfm + 8);
  });
});
