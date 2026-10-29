import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import type { Combatant, ItemInstance } from '../engine/types';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { blessuresDeBase } from '../engine/characteristics';

const w = (uid: string, label: string): ItemInstance =>
  ({ uid, label, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1, damage: { plusBF: true, flat: 4 } }) as ItemInstance;

const hero = (): Combatant =>
  combattantDeTest({
    id: 'h', label: 'H', kind: 'hero', characteristics: { force: 30, endurance: 30 },
    conditions: [], wounds: blessuresDeBase(12), advantage: 0,
    items: [w('e', 'Épée'), w('ha', 'Hache')],
    loadouts: [{ id: 'lo-epee', main: 'e' }, { id: 'lo-hache', main: 'ha' }],
    activeLoadoutId: 'lo-epee',
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  });

const setBattle = (over: Partial<{ loadoutSwapped: boolean }> = {}) =>
  useGame.setState({
    battle: {
      combatants: [hero()], order: ['h'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false,
      over: null, log: [], ...over,
    } as never,
  });

const active = () => useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;

describe('battleSwitchLoadout', () => {
  it('bascule le set actif du combattant ACTIF et re-dérive ses armes', () => {
    setBattle();
    useGame.getState().battleSwitchLoadout('lo-hache');
    expect(active().activeLoadoutId).toBe('lo-hache');
    expect(active().weapons.some((x) => x.label === 'Hache')).toBe(true);
    expect(useGame.getState().battle!.loadoutSwapped).toBe(true);
  });

  it('1 switch gratuit par tour : le 2ᵉ est refusé', () => {
    setBattle();
    useGame.getState().battleSwitchLoadout('lo-hache');
    useGame.getState().battleSwitchLoadout('lo-epee'); // refusé (déjà switché)
    expect(active().activeLoadoutId).toBe('lo-hache');
  });

  it('au tour suivant (loadoutSwapped reset) le switch est de nouveau possible', () => {
    setBattle({ loadoutSwapped: false });
    useGame.getState().battleSwitchLoadout('lo-hache');
    expect(active().activeLoadoutId).toBe('lo-hache');
    // simule un nouveau tour
    useGame.setState({ battle: { ...useGame.getState().battle!, loadoutSwapped: false } });
    useGame.getState().battleSwitchLoadout('lo-epee');
    expect(active().activeLoadoutId).toBe('lo-epee');
  });
});
