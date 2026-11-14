/**
 * LES FENÊTRES DE DÉFENSE ET DU SOIN EN COOP (#3059, J5), sur transport en mémoire (`FakeTransport`) : le héros de
 * l'invité du siège 1 se défend, puis soigne, chez l'hôte (`appliquerLIntentionDUnSiege`). Les deux côtés lisent la
 * même `fenetreDeDefense` (réaction et cible de chaque mode comprises) et la même `fenetreDuSoin` (l'acte et ses
 * refus), au masque près ; le réglage de l'invité arrive chez l'hôte.
 */
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { openAttackCascade } from '../../noyau/combatFlow';
import { seedBattleRng } from '../../noyau/battleRng';
import { testScene } from '../../scenes/test-fixture';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { fenetreDeDefense } from '../../noyau/fenetreDeDefense';
import { fenetreDuSoin } from '../../noyau/soin';
import { etatInitialDuJeu, type BattleState, type Jeu, type NetState } from '../../noyau/etat';
import type { Combatant, Weapon } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const NET = (mode: 'hote' | 'invite', mySeat: number): NetState => ({
  mode, mySeat, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { h: 1 }, slots: [1, 1, 0, 0], rangs: {},
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [rapiere], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, ...over }) as unknown as Combatant);
const rapiere: Weapon = { name: 'Rapière', label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'ra', qualities: [{ id: 'rapide' }] } as unknown as Weapon;

/** La fenêtre sans ce qui juge le siège qui la lit : les refus. */
const auMasque = (v: object | null): unknown => JSON.parse(JSON.stringify(v, (k, x) => (/^refus/.test(k) ? undefined : x)));

/** L'hôte du siège 0 et l'invité du siège 1, qui tient le héros `h` ; `chezLInvite` rend l'état de l'invité après le
 *  dernier instantané diffusé, sous les actions du banc, que les lecteurs purs ne lisent pas. */
function table(banc: Banc): { guest: GuestSession; chezLInvite: () => Jeu } {
  const recus: Record<string, unknown>[] = [];
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(banc.getState, seat, action, args); },
    getSnapshot: () => instantaneDeLaCoop(banc.getState()),
  });
  const [a, b] = FakeTransport.pair();
  const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (d) => { recus.push(d); } });
  host.addGuest(a, 1);
  guest.connect(b);
  return {
    guest,
    chezLInvite: () => {
      host.broadcastSnapshot();
      return { ...banc.getState(), ...appliquerLInstantane(recus[recus.length - 1], { ...etatInitialDuJeu(), net: NET('invite', 1) }).etat };
    },
  };
}

function combat(banc: Banc, combatants: Combatant[], turn: number): void {
  const order = combatants.map((c) => c.id);
  const battle = {
    combatants, order, baseOrder: order, turn, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: testScene(), party: combatants.filter((c) => c.kind === 'heros'), pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingHeal: null });
}

describe('Défense et soin en coop : la même fenêtre des deux côtés', () => {
  it('la Défense du héros de l’invité : même réaction, mêmes cibles ; l’Esquive de l’invité se règle chez l’hôte', () => {
    const banc = ouvrirLeBanc({ etat: { net: NET('hote', 0) } });
    seedBattleRng(7);
    combat(banc, [mk('e', 'ennemi', { x: 1, y: 0 }), mk('h', 'heros', { x: 0, y: 0 })], 0);
    const { guest, chezLInvite } = table(banc);
    openAttackCascade(banc.getState, banc.setState, { attackerId: 'e', targetId: 'h', location: null, result: null, weaponUid: 'ra' }, 'Attaque', 'action/attaquer');
    banc.getState().jetLancer('attaque');
    banc.getState().jetValider('attaque');
    const vueHote = fenetreDeDefense(banc.getState());
    expect(vueHote?.reaction, 'chemin : la Défense du héros de l’invité s’ouvre chez l’hôte').toBeTruthy();
    expect(auMasque(fenetreDeDefense(chezLInvite()))).toEqual(auMasque(vueHote));
    guest.sendIntent('jetRegler', ['defense', 'reaction', 'esquive']);
    expect(banc.getState().pendingDefense!.mode, 'l’Esquive de l’invité est posée chez l’hôte').toBe('esquive');
    expect(auMasque(fenetreDeDefense(chezLInvite()))).toEqual(auMasque(fenetreDeDefense(banc.getState())));
  });

  it('le soin du héros de l’invité : même acte, mêmes raisons ; l’Hémorragie de l’invité se règle chez l’hôte', () => {
    const banc = ouvrirLeBanc({ etat: { net: NET('hote', 0) } });
    const doc = mk('h', 'heros', { x: 0, y: 0 }, { skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }] } as Partial<Combatant>);
    const al = mk('al', 'heros', { x: 1, y: 0 }, { wounds: blessuresDeBase(18, 5), conditions: [{ id: 'hemorragique', value: 2 }] } as Partial<Combatant>);
    combat(banc, [doc, al], 0);
    const { guest, chezLInvite } = table(banc);
    banc.setState({ battle: { ...banc.getState().battle!, action: 'soins' } });
    guest.sendIntent('cliquerLaCase', [{ x: 1, y: 0 }, 'al']);
    const vueHote = fenetreDuSoin(banc.getState());
    expect(vueHote?.mode.choisie, 'chemin : le soin du héros de l’invité s’ouvre chez l’hôte').toBe('blessures');
    const vueInvite = fenetreDuSoin(chezLInvite());
    expect(auMasque(vueInvite)).toEqual(auMasque(vueHote));
    expect(vueInvite!.mode.options.map((o) => o.refus === null), 'chez l’invité, les mêmes actes s’offrent').toEqual(vueHote!.mode.options.map((o) => o.refus === null));
    guest.sendIntent('jetRegler', ['soins', 'mode', 'hemorragie']);
    expect(banc.getState().pendingHeal!.mode, 'l’Hémorragie de l’invité est posée chez l’hôte').toBe('hemorragie');
  });
});
