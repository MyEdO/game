// @vitest-environment jsdom
/**
 * #998 — Maniement de deux armes (LDB 10 l.767-773) rejoué par les verbes du store, la fenêtre montée par
 * `ActiveModal` (recette 6133978543 de #1765) : entre les deux frappes, le slot de l'étape-jet courante est
 * vide et `pendingDualStrike` tient la main ; la cascade n'est pas élue, puis la 2ᵉ frappe rouvre SA fenêtre.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { initialFields } from '../state/stateFields';
import { openAttackCascade } from '../state/combatFlow';
import { pickActiveModalKey } from '../state/modalArbiter';
import { seedBattleRng } from '../noyau/battleRng';
import { testScene } from '../scenes/test-fixture';
import { ActiveModal } from './ActiveModal';
import type { Combatant, Weapon } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 60, 'capacite-de-tir': 50, force: 45, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 30, max: 30 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);
const arme = (uid: string, hand: 'main' | 'off'): Weapon =>
  ({ uid, name: uid, label: uid, type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand, hands: 1 } as unknown as Weapon);

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
  useGame.setState({ ...initialFields(), battle: null });
});

/** Bretteur à deux armes contre un gobelin ; `gmSeat: 0` surface la défense du gobelin (#989). */
function duel(gmSeat: number | undefined) {
  seedBattleRng(1);
  const bretteur = mk('Bretteur', 'hero', { x: 0, y: 0 }, [arme('m', 'main'), arme('o', 'off')]);
  bretteur.characteristics['capacite-de-combat'] = 95;
  const gobelin = mk('Gobelin', 'enemy', { x: 1, y: 0 }, [arme('g', 'main')]);
  gobelin.characteristics['capacite-de-combat'] = 5;
  gobelin.characteristics.agilite = 5;
  const battle: BattleState = {
    combatants: [bretteur, gobelin], order: [bretteur.id, gobelin.id], baseOrder: [bretteur.id, gobelin.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: testScene(), net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat, ownership: {} } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<ActiveModal />));
  return { bretteur, gobelin };
}

const g = useGame.getState;
const surDefense = (defenderId: string) => {
  expect(g().pendingDefense?.defenderId, 'la fenêtre du défenseur s’interpose').toBe(defenderId);
  act(() => g().defenseRoll());
  act(() => g().defenseConfirm());
};

describe('#998 — Deux armes : la fenêtre survit entre les deux frappes (recette 6133978543)', () => {
  for (const [nom, gmSeat] of [['défenseur surfacé', 0], ['défenseur de l’IA', undefined]] as const) {
    it(`${nom} : frappe principale, « Appliquer », 2ᵉ frappe dans SA fenêtre, puis clôture`, () => {
      const { bretteur, gobelin } = duel(gmSeat);
      act(() => { openAttackCascade(g, useGame.setState, { attackerId: bretteur.id, targetId: gobelin.id, location: null, result: null }, 'Attaque', 'action/attack'); });
      act(() => g().attackSetDualMode(true));
      act(() => g().attackRoll());
      act(() => g().attackConfirm());
      if (gmSeat != null) surDefense(gobelin.id);
      expect(g().pendingDualStrike, 'la 1ʳᵉ frappe a touché : la 2ᵉ attend sa cible').toBeTruthy();
      expect(pickActiveModalKey(g()), 'aucune fenêtre sans corps n’est élue').not.toBe('cascade');
      expect(host!.querySelector('.modal-overlay'), 'la carte tient la main (TargetPrompt)').toBeNull();
      act(() => g().dualStrikeAttack(gobelin.id));
      const seq = g().pendingCascade!;
      expect(seq.participants[seq.cursor].jet, 'la 2ᵉ frappe est rendue par une étape d’attaque').toBe('attack');
      expect(host!.querySelector('.modal-overlay'), 'la fenêtre de la 2ᵉ frappe est montée').not.toBeNull();
      act(() => g().attackConfirm());
      if (gmSeat != null) surDefense(gobelin.id);
      expect(g().pendingDualStrike, 'la 2ᵉ frappe est appliquée').toBeNull();
      expect(g().pendingAttack).toBeNull();
      expect(g().pendingCascade, 'la cascade se referme au bout').toBeNull();
    });
  }
});
