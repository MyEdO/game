/**
 * `onCrit` à chaque Blessure critique non létale, avec son origine ; le filtre `coupCritique` réserve un
 * effet au Coup Critique (`estUnCoupCritique`). LDB 62 l.248-250 ; AA 08 l.87 ; #1595 C6.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import type { Combatant, Weapon } from '../engine/types';
import { applyAttackResult } from '../noyau/combatFlow';
import type { AttackResult } from '../engine/combat';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';

/** Un arc qui porte Taillade (toute Blessure critique) et Empaleuse (le seul Coup Critique). */
function arcTailladeEmpaleuse(): Weapon {
  const arc = weaponFromItem(itemFromTrappingById('arc')!);
  return { ...arc, qualities: [...(arc.qualities ?? []), { id: 'taillade', value: 1 }, { id: 'empaleuse' }] };
}

const munitions = (c: Combatant | undefined): number => c?.conditions?.find((x) => x.id === 'munition-logee')?.value ?? 0;

describe('onCrit : chaque Blessure critique non létale, le filtre coupCritique au seul Coup Critique (#1595 C6)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, pendingAttack: null, pendingCascade: null });
    useGame.getState().seedRng(7);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 14, y: 10 };
    E.important = true; // LDB 18 l.44 : hors Mort subite
    E.wounds = { current: 30, max: 30 };
    H.advantage = 3;
    return { H, E };
  }

  const cible = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id);

  /** Draine la cascade du coup ; rend l'offre de Taillade si elle s'est ouverte. */
  function offreDeTaillade() {
    for (let i = 0; i < 20 && useGame.getState().pendingCascade; i++) {
      const pc = useGame.getState().pendingCascade!;
      const cur = pc.participants[pc.cursor];
      if (cur?.kind === 'triggeredChoice') return cur;
      avanceEtapeCascade(useGame.getState);
    }
    return undefined;
  }

  const touche = (over: Partial<AttackResult>): AttackResult => ({
    hit: true, attackerRoll: 44, netSL: 4, location: 'corps',
    damage: 6, woundsLost: 2, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'touche', ...over,
  });

  it('Blessure critique de DÉPASSEMENT : Taillade joue, la munition ne se loge pas (LDB 62 l.250 ; AA 08 l.87)', () => {
    const { H, E } = setup();
    E.wounds.current = 2;
    // Graine dont la Blessure critique ne fait pas saigner : à 0 PB, l'Hémorragique la rendrait Inconsciente
    // (LDB 16 l.105), hors d'atteinte de l'effet de Taillade sur la cible.
    useGame.getState().seedRng(1);
    applyAttackResult(useGame.getState, useGame.setState, H, E, arcTailladeEmpaleuse(), touche({ woundsLost: 3 }));
    expect(offreDeTaillade(), 'onCrit n’est pas parti sur la Blessure critique du dépassement').toBeDefined();
    expect(munitions(cible(E.id)), 'Empaleuse a logé sa munition hors Coup Critique').toBe(0);
  });

  it('COUP CRITIQUE : Taillade joue et la munition se loge (LDB 62 l.248-250)', () => {
    const { H, E } = setup();
    applyAttackResult(useGame.getState, useGame.setState, H, E, arcTailladeEmpaleuse(), touche({ critical: true, critLocation: 'corps' }));
    expect(offreDeTaillade()).toBeDefined();
    expect(munitions(cible(E.id))).toBe(1);
  });

  it('Poings d’ignominie : maladie au seul Coup Critique, rien au dépassement (VDM 12 l.910, l.916)', () => {
    const poings = () => weaponFromItem(itemFromTrappingById('poings-d-ignominie')!);
    let { H, E } = setup(); E.pos = { x: 11, y: 10 }; E.wounds.current = 2;
    applyAttackResult(useGame.getState, useGame.setState, H, E, poings(), touche({ woundsLost: 3 }));
    draineCascade(useGame.getState);
    expect(cible(H.id)?.diseases ?? [], 'le dépassement a déclenché la malédiction').toEqual([]);
    ({ H, E } = setup()); E.pos = { x: 11, y: 10 };
    applyAttackResult(useGame.getState, useGame.setState, H, E, poings(), touche({ critical: true, critLocation: 'corps' }));
    draineCascade(useGame.getState);
    expect(cible(H.id)?.diseases?.length).toBe(1);
  });
});
