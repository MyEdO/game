/**
 * Cascade combat → Possession (#618 SOCLE POSSESSIONS, dernier item DoD) — un combattant issu d'une
 * Possession (bête montée/de bât en pièce, convention `Combatant.id === Possession.uid`, `pos-N`) qui
 * finit le combat écrit son état vers le registre `possessions` — MÊME couture que le writeback héros
 * (`carryOverState`) déjà fait par `finalizeBattle` : blessée → `wounds.current` persisté (clampé à son
 * max) ; morte → `destroyed:true`, ses `items`/`cargo` restent CO-LOCALISÉS sur la Possession (jamais
 * évaporés — miroir du patron `travelFlow.ts` bête abandonnée : `{ ...p, destroyed: true }`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { finalizeBattle } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Possession } from '../engine/possession';
import type { Combatant, ItemInstance } from '../engine/types';

describe('finalizeBattle — writeback Possession (bête/serviteur/véhicule en pièce, #618)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, possessions: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    return useGame.getState().battle!;
  }

  const mule = (uid: string): Possession => ({
    uid, nature: 'bete', ownerId: 'W', label: 'Marguerite',
    location: { kind: 'avec-le-groupe' }, items: [{ itemId: 'sac-a-dos', qty: 1 } as unknown as ItemInstance],
    ref: { creatureId: 'mule' }, wounds: { current: 8, max: 8 },
  });

  it('bête possession BLESSÉE en combat → wounds persisté sur la Possession (clampé à son max)', () => {
    const battle = setup();
    useGame.setState({ possessions: [mule('pos-1')] });
    const combatant: Combatant = {
      ...battle.combatants[0], id: 'pos-1', label: 'Marguerite', kind: 'npc',
      wounds: { current: 3, max: 8 }, dead: false,
    };
    useGame.setState({ battle: { ...battle, combatants: [...battle.combatants, combatant] } });
    finalizeBattle(useGame.getState, useGame.setState);
    const p = useGame.getState().possessions.find((x) => x.uid === 'pos-1');
    expect(p?.nature === 'bete' && p.wounds).toEqual({ current: 3, max: 8 });
  });

  it('bête possession TUÉE en combat → destroyed:true, items CO-LOCALISÉS (pas évaporés)', () => {
    const battle = setup();
    useGame.setState({ possessions: [mule('pos-1')] });
    const combatant: Combatant = {
      ...battle.combatants[0], id: 'pos-1', label: 'Marguerite', kind: 'npc',
      wounds: { current: 0, max: 8 }, dead: true,
    };
    useGame.setState({ battle: { ...battle, combatants: [...battle.combatants, combatant] } });
    finalizeBattle(useGame.getState, useGame.setState);
    const p = useGame.getState().possessions.find((x) => x.uid === 'pos-1');
    expect(p?.destroyed).toBe(true);
    expect(p?.items).toHaveLength(1);
  });

  it('bête possession SURVIT indemne → aucune mutation, wounds inchangé, destroyed absent', () => {
    const battle = setup();
    useGame.setState({ possessions: [mule('pos-1')] });
    const combatant: Combatant = {
      ...battle.combatants[0], id: 'pos-1', label: 'Marguerite', kind: 'npc',
      wounds: { current: 8, max: 8 }, dead: false,
    };
    useGame.setState({ battle: { ...battle, combatants: [...battle.combatants, combatant] } });
    finalizeBattle(useGame.getState, useGame.setState);
    const p = useGame.getState().possessions.find((x) => x.uid === 'pos-1');
    expect(p?.destroyed).toBeUndefined();
    expect(p?.nature === 'bete' && p.wounds).toEqual({ current: 8, max: 8 });
  });
});
