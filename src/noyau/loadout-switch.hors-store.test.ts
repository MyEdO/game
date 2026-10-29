import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const w = (uid: string, label: string): unknown =>
  ({ uid, label, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1, damage: { plusBF: true, flat: 4 } });

const hero = (): Combatant =>
  ({
    id: 'h', label: 'H', kind: 'hero', characteristics: { force: 30, endurance: 30 },
    conditions: [], wounds: { current: 12, max: 12 }, advantage: 0,
    items: [w('e', 'Épée'), w('ha', 'Hache')],
    loadouts: [{ id: 'lo-epee', name: 'Épée', main: 'e' }, { id: 'lo-hache', name: 'Hache', main: 'ha' }],
    activeLoadoutId: 'lo-epee',
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant);

const setBattle = (over: Partial<{ loadoutSwapped: boolean }> = {}) =>
  banc.setState({
    battle: {
      combatants: [hero()], order: ['h'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false,
      over: null, log: [], ...over,
    } as never,
  });

const active = () => banc.getState().battle!.combatants.find((c) => c.id === 'h')!;

describe('battleSwitchLoadout', () => {
  it('bascule le set actif du combattant ACTIF et re-dérive ses armes', () => {
    setBattle();
    banc.getState().battleSwitchLoadout('lo-hache');
    expect(active().activeLoadoutId).toBe('lo-hache');
    expect(active().weapons.some((x) => x.label === 'Hache')).toBe(true);
    expect(banc.getState().battle!.loadoutSwapped).toBe(true);
  });

  it('1 switch gratuit par tour : le 2ᵉ est refusé', () => {
    setBattle();
    banc.getState().battleSwitchLoadout('lo-hache');
    banc.getState().battleSwitchLoadout('lo-epee'); // refusé (déjà switché)
    expect(active().activeLoadoutId).toBe('lo-hache');
  });

  it('au tour suivant (loadoutSwapped reset) le switch est de nouveau possible', () => {
    setBattle({ loadoutSwapped: false });
    banc.getState().battleSwitchLoadout('lo-hache');
    expect(active().activeLoadoutId).toBe('lo-hache');
    // simule un nouveau tour
    banc.setState({ battle: { ...banc.getState().battle!, loadoutSwapped: false } });
    banc.getState().battleSwitchLoadout('lo-epee');
    expect(active().activeLoadoutId).toBe('lo-epee');
  });
});
