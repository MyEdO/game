import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult } from './combatFlow';
import { draineCascade } from './cascadeTestKit';
import { createHero } from '../engine/character';
import { rederivePassiveAttack } from '../engine/combat';
import { setRule, resetRule } from '../engine/policy';
import { hasCondition } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

/** Le compte des Blessures critiques d'un coup, joué par le store : LDB 18 l.17, l.44, l.53 ; AA 07 l.36. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

/** Un coup Critique (double 44) qui DÉPASSE les 2 Blessures restantes de la cible, par la couture du jeu
 *  (`rederivePassiveAttack` → `applyAttackResult`), la cascade drainée au dé 1. */
function coupQuiDepasse(important: boolean, chanceux = false) {
  useGame.getState().seedRng(7);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [] });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const cible = b.combatants.find((c) => c.kind === 'enemy')!;
  cible.items = (cible.items ?? []).filter((i) => i.kind !== 'armor');
  cible.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
  cible.wounds = { current: 2, max: 20 } as Combatant['wounds'];
  cible.important = important;
  if (chanceux) cible.talents = [...(cible.talents ?? []), { talentId: 'chanceux', times: 1 }];
  const res = rederivePassiveAttack(H, cible, epee, { roll: 44, target: 90, success: true, sl: 0, isDouble: true } as never, 'melee', 'corps');
  expect(res.critical, 'le double fait le Coup Critique').toBe(true);
  expect(res.woundsLost ?? 0, 'le coup dépasse les Blessures restantes').toBeGreaterThan(2);
  applyAttackResult(useGame.getState, useGame.setState, H, cible, epee, res, {});
  draineCascade(useGame.getState, 200, () => 1);
  return { res, cible: useGame.getState().battle!.combatants.find((c) => c.id === cible.id)! };
}

describe('le store joue le compte des Blessures critiques du coup', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  it("'ldb' : Coup Critique ET dépassement — deux Blessures critiques, à la même Localisation (LDB 18 l.17, l.53)", () => {
    const { res, cible } = coupQuiDepasse(true);
    expect(cible.criticalWounds).toBe(2);
    expect(res.critLocation).toBeDefined();
    expect(res.location).toBe(res.critLocation);
  });

  it("'aa' : une seule Blessure critique par coup, pour le Chanceux hors Mort subite (AA 07 l.36, l.67)", () => {
    setRule('combat-aa-blessures', 'aa');
    expect(coupQuiDepasse(true, true).cible.criticalWounds).toBe(1);
  });

  it("'ldb' : le figurant tombe par la Mort subite, sans Blessure critique (LDB 18 l.44, l.46)", () => {
    const { cible } = coupQuiDepasse(false);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(cible.wounds.current).toBe(0);
    expect(hasCondition(cible, 'inconscient')).toBe(true);
  });
});
