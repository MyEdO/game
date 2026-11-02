/**
 * LE REFUS SE DIT AU SIÈGE QUI A AGI (`refusVisible.ts`, `refuserGesteDuSiege`) : l'hôte qui applique l'intention
 * d'un invité ne pose pas le bandeau chez lui ; l'invité lit la raison au gate de sa propre console (`actionGate`).
 * Deux sièges, l'intention passant par la couture coop (`appliquerLIntentionDUnSiege`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from './store';
import { appliquerLIntentionDUnSiege } from '../noyau/intentionsDeSiege';
import { actionGate } from '../noyau/actionRegistry';
import { seedBattleRng } from '../noyau/battleRng';
import { testScene } from '../scenes/test-fixture';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

const NET0 = useGame.getState().net;

function cb(p: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Doc', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4, engagedWith: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

/** `doc`, au tour, Action dépensée, appartient au siège 1 (l'invité) ; ce client est l'hôte (siège 0) ou une partie locale. */
function poser(netMode: 'host' | 'local'): void {
  seedBattleRng(1);
  const doc = cb({ id: 'doc', pos: { x: 5, y: 5 } });
  const al = cb({ id: 'al', label: 'Blessé', wounds: blessuresDeBase(12, 3), pos: { x: 6, y: 5 } });
  const order = ['doc', 'al'];
  useGame.setState({
    mode: 'battle', scene: testScene(), party: [doc, al],
    battle: { combatants: [doc, al], order, baseOrder: order, turn: 0, round: 1, action: 'heal', selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: true, log: [], over: null } as never,
    pendingHeal: null, pendingRun: null, refus: null,
    net: netMode === 'host'
      ? { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { doc: 1, al: 0 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } }
      : NET0,
  } as never);
}

afterEach(() => { useGame.setState({ net: NET0, battle: null, pendingHeal: null, pendingRun: null, refus: null } as never); });

const gestes: [string, string, unknown[], 'pendingHeal' | 'pendingRun'][] = [
  ['heal', 'battleHeal', ['al', 'wounds'], 'pendingHeal'],
  ['course', 'battleRun', [{ x: 9, y: 5 }], 'pendingRun'],
];

describe('Refus d’un geste en coop : dit au siège qui a agi, jamais chez l’hôte', () => {
  for (const [entree, verbe, args, pending] of gestes) {
    it(`${verbe} d’un invité, Action dépensée : refusé sans bandeau chez l’hôte ; l’invité lit la raison à son gate`, () => {
      poser('host');
      appliquerLIntentionDUnSiege(useGame.getState, 1, verbe, args);
      const s = useGame.getState();
      expect(s[pending], 'le geste refusé est parti').toBeFalsy();
      expect(s.refus, 'le refus de l’invité s’affiche chez l’hôte').toBeNull();
      const doc = s.battle!.combatants.find((c) => c.id === 'doc')!;
      expect(actionGate(entree, { active: doc, battle: s.battle!, netMode: 'guest', gameTime: s.gameTime })).toEqual({ ok: false, reason: t('agate.actionSpent') });
    });

    it(`${verbe} en partie locale, Action dépensée : refusé, et le bandeau le dit`, () => {
      poser('local');
      (useGame.getState() as unknown as Record<string, (...a: unknown[]) => void>)[verbe](...args);
      const s = useGame.getState();
      expect(s[pending]).toBeFalsy();
      expect(s.refus?.texte).toBe(t('agate.actionSpent'));
    });
  }
});
