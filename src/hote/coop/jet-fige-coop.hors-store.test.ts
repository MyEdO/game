/**
 * LE CALENDRIER D'UN TEST OPPOSÉ À JET FIGÉ EN COOP (#990, #3059 J6), sur transport en mémoire (`FakeTransport`) :
 * l'hôte du siège 0 tient le rôle MJ et jette pour l'ennemi ; l'invité du siège 1 répond avec son héros, chez l'hôte
 * (`appliquerLIntentionDUnSiege`). Avant la réponse, le jet figé de l'ennemi est révélé à l'hôte, qui l'a jeté, et
 * masqué chez l'invité (`jetFigeRevele`), dans la fenêtre comme dans ses jets en vue (`jetsEnVue`) ; après, les deux côtés
 * voient la même ligne. En Défense, puis au Contre-sort.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { openAttackCascade, openCastCascade, routeCounterspell } from '../../noyau/combatFlow';
import { JET_FIGE, jetFigeRevele } from '../../noyau/netOwnership';
import { jetsEnVue } from '../../noyau/jetsEnVue';
import type { FlowKey } from '../../noyau/flowVerbs';
import { seedBattleRng } from '../../noyau/battleRng';
import { testScene } from '../../scenes/test-fixture';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { etatInitialDuJeu, type BattleState, type Jeu, type NetState } from '../../noyau/etat';
import { herosDeScenario } from '../../scenes/test-scenarios/_heros';
import type { Combatant, Weapon } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const NET = (mode: 'hote' | 'invite', mySeat: number, invite: string): NetState => ({
  mode, mySeat, roomCode: 'ABCDEF', seatNames: { 0: 'Hôte', 1: 'Antoine' }, presence: {},
  connection: 'connecte', hoteAbsent: false, ownership: { [invite]: 1 }, slots: [1, 1, 0, 0], rangs: {}, gmSeat: 0,
});

/** L'hôte du siège 0 et l'invité du siège 1 ; `chezLInvite` rend l'état de l'invité après le dernier instantané. */
function table(banc: Banc, invite: string): { guest: GuestSession; chezLInvite: () => Jeu } {
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
      return { ...banc.getState(), ...appliquerLInstantane(recus[recus.length - 1], { ...etatInitialDuJeu(), net: NET('invite', 1, invite) }).etat };
    },
  };
}

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };
const rapiere: Weapon = { name: 'Rapière', label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'ra', qualities: [{ id: 'rapide' }] } as unknown as Weapon;
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [rapiere], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** Ce que la Défense montre de l'attaque figée : son verdict de révélation, et la ligne de l'attaquant. */
function attaqueVue(s: Jeu): { revele: boolean; ligne: unknown } {
  const pd = s.pendingDefense!;
  return { revele: jetFigeRevele(s, JET_FIGE.defense(pd)), ligne: pd.result ? pd.result.attackerDetail : pd.atk };
}

/** Ce que l'incantation montre du jet figé du lanceur, avec les rangées du Contre-sort. */
function incantationVue(s: Jeu): { revele: boolean; jet: unknown } {
  const pc = s.pendingCast!;
  return { revele: jetFigeRevele(s, JET_FIGE.incantation(s, pc)), jet: pc.result };
}

/** La ligne de `qui` dans les jets en vue du flux `flux`. */
const ligneEnVue = (s: Jeu, flux: FlowKey, qui: string) => jetsEnVue(s).find((v) => v.flux === flux)?.lignes.find((l) => l.qui === qui);

describe('Test opposé à jet figé en coop : masqué chez l’invité avant sa réponse, la même ligne ensuite', () => {
  it('Défense du héros de l’invité contre l’ennemi que l’hôte jette au siège MJ', () => {
    const banc = ouvrirLeBanc({ etat: { net: NET('hote', 0, 'h') } });
    seedBattleRng(7);
    const combatants = [mk('e', 'ennemi', { x: 1, y: 0 }), mk('h', 'heros', { x: 0, y: 0 })];
    const order = combatants.map((c) => c.id);
    banc.setState({
      battle: { combatants, order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
        movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState,
      mode: 'battle', scene: testScene(), party: combatants.filter((c) => c.kind === 'heros'),
    });
    const { guest, chezLInvite } = table(banc, 'h');
    openAttackCascade(banc.getState, banc.setState, { attackerId: 'e', targetId: 'h', location: null, result: null, weaponUid: 'ra' }, 'Attaque', 'action/attaquer');
    banc.getState().jetLancer('attaque');
    banc.getState().jetValider('attaque');
    expect(banc.getState().pendingDefense?.result, 'chemin : la Défense du héros de l’invité s’ouvre, sans réponse').toBeNull();
    expect(attaqueVue(banc.getState()).revele, 'l’hôte a jeté l’attaque : il la voit').toBe(true);
    expect(attaqueVue(chezLInvite()).revele, 'l’invité n’a pas répondu : l’attaque lui est masquée').toBe(false);
    expect(ligneEnVue(banc.getState(), 'defense', 'e')?.jet, 'jets en vue de l’hôte : l’attaque tombée').toMatchObject({ d100: expect.any(Number) });
    expect(ligneEnVue(chezLInvite(), 'defense', 'e'), 'jets en vue de l’invité : l’attaque à lancer, sans d100 ni DR ni verdict')
      .toEqual({ genre: 'test', qui: 'e', test: 'Attaque', cible: null, jet: null });
    expect(jetsEnVue(chezLInvite()).find((v) => v.flux === 'defense')?.oppose, 'aucune gagnante ni DR net chez l’invité').toBeNull();
    guest.sendIntent('jetLancer', ['defense']);
    expect(banc.getState().pendingDefense?.result, 'la réponse de l’invité est posée chez l’hôte').toBeTruthy();
    expect(attaqueVue(chezLInvite())).toEqual({ ...attaqueVue(banc.getState()), revele: true });
    expect(ligneEnVue(chezLInvite(), 'defense', 'e')?.jet, 'après la réponse : l’attaque tombée chez l’invité').toMatchObject({ d100: expect.any(Number) });
    expect(jetsEnVue(chezLInvite()), 'après la réponse : les mêmes jets en vue des deux côtés').toEqual(jetsEnVue(banc.getState()));
  });

  it('Contre-sort du héros de l’invité contre le sort que l’hôte jette au siège MJ', () => {
    const L = herosDeScenario(idsDeTest, 'sorcier');
    L.id = 'L'; L.label = 'L';
    const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [L], net: NET('hote', 0, 'L') } });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const [E, ...autres] = b.combatants.filter((c) => c.kind === 'ennemi');
    autres.forEach((e) => (e.dead = true));
    E.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
    E.spells = ['carreau'];
    const heros = b.combatants.find((c) => c.id === 'L')!;
    heros.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 };
    banc.setState({
      battle: { ...b },
      pendingCast: {
        casterId: E.id, targetId: 'L', spellId: 'carreau', missile: true, focused: false,
        result: { cast: true, roll: 30, target: 60, sl: 3, isCritical: false, isFumble: false, log: 'Sort lancé' },
      },
    } as unknown as Partial<Jeu>);
    expect(openCastCascade(banc.getState, banc.setState, E), 'chemin : la fenêtre d’incantation s’ouvre').toBe(true);
    const { guest, chezLInvite } = table(banc, 'L');
    expect(routeCounterspell(banc.getState, banc.setState), 'chemin : la fenêtre du Contre-sort s’ouvre').toBe(true);
    expect(banc.getState().pendingCounterspell?.participants, 'une rangée jouée, celle du héros de l’invité').toMatchObject([{ id: 'L', interactive: true, result: null }]);
    expect(incantationVue(banc.getState()).revele, 'l’hôte a jeté le sort : il le voit').toBe(true);
    expect(incantationVue(chezLInvite()).revele, 'l’invité n’a pas répondu : le sort lui est masqué').toBe(false);
    expect(ligneEnVue(banc.getState(), 'incantation', E.id)?.jet, 'jets en vue de l’hôte : l’incantation tombée').toEqual({ d100: 30, dr: 3, reussi: true });
    expect(ligneEnVue(chezLInvite(), 'incantation', E.id), 'jets en vue de l’invité : l’incantation à lancer, sans d100 ni DR ni verdict').toMatchObject({ cible: null, jet: null });
    guest.sendIntent('jetRegler', ['contreSort', 'declaration', 'solo', 'L']);
    guest.sendIntent('jetLancer', ['contreSort', 'L']);
    expect(banc.getState().pendingCounterspell?.participants[0]?.result, 'la réponse de l’invité est posée chez l’hôte').toBeTruthy();
    expect(incantationVue(chezLInvite())).toEqual({ ...incantationVue(banc.getState()), revele: true });
    expect(ligneEnVue(chezLInvite(), 'incantation', E.id)?.jet, 'après la réponse : l’incantation tombée chez l’invité').toEqual({ d100: 30, dr: 3, reussi: true });
    expect(jetsEnVue(chezLInvite()), 'après la réponse : les mêmes jets en vue des deux côtés').toEqual(jetsEnVue(banc.getState()));
  });
});
