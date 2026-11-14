/**
 * LA SUITE DU TOUR D'IA EN COOP (#3058) : l'hôte joue les tours d'IA qu'il possède — son IA ennemie, son héros en
 * Auto-combat — ; un invité est connecté. Le chargeur charge un porteur de Frappe réactive (LDB 10 l.498) : chez
 * l'hôte, une décision, une frappe, le tour avance ; l'instantané diffusé porte le tour d'IA (`battle.tourEnCours`), que
 * l'invité applique. La frappe pilotée d'un invité (#3059) ne se rejoue que chez l'hôte.
 */
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc } from '../../noyau/banc.testkit';
import { aiTurnLog, clearAiTurnLog, maybeRunEnemyTurn } from '../../noyau/combatFlow';
import { seedBattleRng } from '../../noyau/battleRng';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { etatInitialDuJeu, type BattleState, type NetState, type TourEnCours } from '../../noyau/etat';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant, Weapon } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(40),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** La table : l'hôte au siège 0, l'invité au siège 1, qui possède `h2`. */
const NET = (mode: 'hote' | 'invite', mySeat: number): NetState => ({
  mode, mySeat, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { h2: 1 }, slots: [1, 1, 0, 0], rangs: {},
});

/** Le combat de l'hôte : `chargeur` (à 4 cases) charge `charge`, porteur de Frappe réactive ; `h2` est à l'invité. */
function table(chargeur: Combatant, charge: Combatant) {
  const banc = ouvrirLeBanc({ cadence: 'auto' });
  clearAiTurnLog();
  seedBattleRng(2);
  chargeur.pos = { x: 4, y: 0 };
  charge.pos = { x: 0, y: 0 };
  charge.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
  charge.characteristics.initiative = 99;
  const h2 = mk('h2', 'heros', { x: 9, y: 9 });
  const combatants = [chargeur, charge, h2];
  const ids = combatants.map((c) => c.id);
  const battle = {
    combatants, order: ids, baseOrder: ids, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: testScene(), party: combatants.filter((c) => c.kind === 'heros'), pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [], net: NET('hote', 0) } as never);
  const recus: Record<string, unknown>[] = [];
  const host = new HostSession({ build: 'test', applyIntent: () => {}, getSnapshot: () => instantaneDeLaCoop(banc.getState()) });
  const [a, b] = FakeTransport.pair();
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (d) => { recus.push(d); } });
  host.addGuest(a, 1);
  guest.connect(b);

  maybeRunEnemyTurn(banc.getState, banc.setState);
  let fenetre = false;
  let diffuse: TourEnCours | undefined;
  for (let i = 0; i < 300 && banc.getState().battle!.turn === 0; i++) {
    if (!banc.jusquALaProchaine()) break;
    if (banc.getState().pendingDefense) fenetre = true;
    host.broadcastSnapshot();
    diffuse ??= banc.getState().battle!.tourEnCours?.suite ? banc.getState().battle!.tourEnCours : undefined;
  }
  return { banc, recus, fenetre, diffuse };
}

describe('#3058 — coop : le tour d’IA de l’hôte charge un porteur de Frappe réactive', () => {
  for (const [nom, chargeur, charge] of [
    ['l’IA ennemie de l’hôte charge un héros de l’hôte', () => mk('e', 'ennemi', { x: 0, y: 0 }), () => mk('h', 'heros', { x: 0, y: 0 })],
    ['le héros de l’hôte, en Auto-combat, charge un ennemi', () => mk('h', 'heros', { x: 0, y: 0 }), () => mk('e', 'ennemi', { x: 0, y: 0 })],
  ] as const) {
    it(`${nom} (graine 2) : chez l’hôte, UNE décision, UNE frappe, le tour avance ; l’invité applique le tour d’IA diffusé`, () => {
      const c = chargeur();
      const { banc, recus, fenetre, diffuse } = table(c, charge());
      const log = banc.getState().battle!.log;
      expect(fenetre, 'chemin : la riposte ouvre une fenêtre de défense').toBe(true);
      expect(aiTurnLog().filter((r) => r.id === c.id && r.round === 1).length, 'une décision').toBe(1);
      expect(log.filter((l) => l.kind === 'attaque' && l.actorId === c.id).length, 'une frappe').toBe(1);
      expect(banc.getState().battle!.turn, 'le tour a avancé').toBe(1);

      expect(diffuse?.cle, 'chemin : un tour d’IA à suite a été diffusé').toBe(`1:0:${c.id}`);
      const chezLInvite = appliquerLInstantane(recus[recus.length - 1], { ...etatInitialDuJeu(), net: NET('invite', 1) }).etat;
      expect(chezLInvite.net.mode, 'l’instantané est appliqué chez l’invité').toBe('invite');
      expect(chezLInvite.battle?.tourEnCours, 'l’invité porte le tour d’IA de l’hôte').toEqual(banc.getState().battle!.tourEnCours);
    });
  }
});

describe('#3059 — coop : seul l’hôte rejoue la frappe pilotée d’un invité', () => {
  it('l’invité charge par intent (graine 4) ; chez l’invité, la frappe parquée de l’instantané ne se rejoue pas, même fenêtre close', () => {
    const banc = ouvrirLeBanc({ cadence: 'manuel' });
    seedBattleRng(4);
    const h = mk('h', 'heros', { x: 4, y: 0 });
    const e = mk('e', 'ennemi', { x: 0, y: 0 });
    e.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
    e.characteristics.initiative = 99;
    const ids = [h.id, e.id];
    const battle = {
      combatants: [h, e], order: ids, baseOrder: ids, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as BattleState;
    banc.setState({ battle, mode: 'battle', scene: testScene(), party: [h], pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [], net: { ...NET('hote', 0), ownership: { h: 1 } } } as never);
    expect(appliquerLIntentionDUnSiege(banc.getState, 1, 'cliquerLaCase', [{ x: 0, y: 0 }, 'e', { confirm: true, intentionId: 'charge' }]), 'chemin : l’intent est appliqué chez l’hôte').toBe('appliquee');
    banc.reprendreTout();
    const tour = banc.getState().battle!.tourEnCours;
    expect([tour?.suite?.geste.kind, tour?.parquee, !!banc.getState().pendingDefense], 'chemin : chez l’hôte, la frappe échue pendant la défense est parquée').toEqual(['frappePilotee', true, true]);
    const chezLInvite = appliquerLInstantane(instantaneDeLaCoop(banc.getState()), { ...etatInitialDuJeu(), net: { ...NET('invite', 1), ownership: { h: 1 } } }).etat;
    banc.setState({ ...chezLInvite, pendingDefense: null, pendingCascade: null, suspendedCascades: [] } as never);
    banc.getState().reprendreLaCadence();
    banc.reprendreTout();
    expect([banc.getState().net.mode, banc.getState().pendingAttack], 'l’invité n’ouvre aucune frappe de lui-même').toEqual(['invite', null]);
  });
});
