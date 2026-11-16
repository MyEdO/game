/**
 * #1273 — « Tout résoudre » (`jetLancer('cascade')` sans rangée) sur une bande PARTAGÉE (`groupOwner`), en coop : un siège
 * ne résout que SES rangées en attente, l'hôte toute la bande (arbitrage du 2026-11-16 au ticket). « Continuer »
 * (`jetValider('cascade')`) ne fait rien avancer tant qu'une rangée attend son jet (`stepReady`) ; la fenêtre affichée au siège
 * dit la même chose (`fermeturesDeLaFenetre`). Chemin complet : `appliquerLIntentionDUnSiege`, comme l'hôte le joue.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { initialFields } from './stateFields';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { startCascade } from './cascade';
import { seedBattleRng } from './battleRng';
import { TOUT_RESOUDRE } from './combatAuto';
import { cleDuGeste } from './modalArbiter';
import { fermeturesDeLaFenetre, fermeturesDuFlux } from './verbesOuverts';
import { testScene } from '../scenes/test-fixture';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { Combatant } from '../engine/types';
import type { BatchParticipant, CascadeStep } from './pendings';
import { fixtureText } from '../i18n/fixtureText';
import { cleDeFixture } from './noyau.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind: 'heros', characteristics: { ...CHARS }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(12), resolve: 0, fortune: 0,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** Table coop : `h1` au siège 0 (l'hôte), `h2` au siège 1 (l'invité) ; `net` surcharge le réseau (solo). */
function table(net: Record<string, unknown> = { mode: 'hote', mySeat: 0, ownership: { h1: 0, h2: 1 }, slots: [0, 1, 0, 0] }) {
  seedBattleRng(11);
  const h1 = mk('h1', { x: 0, y: 0 });
  const h2 = mk('h2', { x: 3, y: 3 });
  const battle = {
    combatants: [h1, h2], order: ['h1', 'h2'], baseOrder: ['h1', 'h2'], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    ...initialFields(), battle, mode: 'battle', scene: testScene(), party: [h1, h2],
    net: { ...initialNet(), gmSeat: undefined, seatNames: { 0: 'Hôte', 1: 'Invité' }, ...net },
  });
  const row = (id: string): BatchParticipant => ({ id, interactive: true, base: 50, target: 50, result: null });
  const bande: CascadeStep = { id: 'bande', kind: cleDeFixture('bande-partagee'), label: fixtureText('Bande'), aggregate: 'none', participants: [row('h1'), row('h2')], result: null, groupOwner: true };
  startCascade(banc.getState, banc.setState, { title: 'Bande', purpose: 'test', steps: [bande] });
}

const resultatDe = (id: string) => banc.getState().pendingCascade?.participants[0].participants!.find((r) => r.id === id)!.result;
const intention = (siege: number, action: string, args: unknown[]) => appliquerLIntentionDUnSiege(banc.getState, siege, action, args);
const toutResoudreAuSiege = (siege: number) => {
  banc.setState({ net: { ...banc.getState().net, mySeat: siege } });
  return fermeturesDeLaFenetre(banc.getState()).get(cleDuGeste(TOUT_RESOUDRE));
};

describe('#1273 — « Tout résoudre » d’une bande partagée : chacun les siens, l’hôte tout', () => {
  it('l’invité ne résout que SA rangée, puis « Continuer » ne fait rien avancer tant que celle de l’hôte attend', () => {
    table();
    expect(intention(1, 'jetLancer', ['cascade'])).toBe('appliquee');
    expect(resultatDe('h2'), 'la rangée de l’invité').toBeTruthy();
    expect(resultatDe('h1'), 'l’invité résolvait la rangée de l’hôte').toBeNull();
    expect(banc.getState().pendingCascade!.cursor, 'la bande reste ouverte').toBe(0);
    expect(toutResoudreAuSiege(1), 'l’invité n’a plus rien à résoudre').toBe('jetLance');
    expect(toutResoudreAuSiege(0), 'l’hôte garde « Tout résoudre »').toBeNull();
    banc.setState({ net: { ...banc.getState().net, mySeat: 0 } });
    expect(fermeturesDuFlux(banc.getState(), 'cascade').valider, '« Continuer » affiché fermé').toBe('jetNonLance');
    intention(1, 'jetValider', ['cascade']);
    expect(banc.getState().pendingCascade!.cursor, '« Continuer » avançait par-dessus la rangée de l’hôte').toBe(0);
    expect(resultatDe('h1')).toBeNull();
    const deDeLInvite = resultatDe('h2');
    expect(intention(0, 'jetLancer', ['cascade'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.cursor, 'l’hôte résout la rangée restante').toBe(1);
    expect(resultatDe('h2'), 'le dé de l’invité est gardé').toEqual(deDeLInvite);
  });

  it('l’hôte résout toute la bande', () => {
    table();
    expect(intention(0, 'jetLancer', ['cascade'])).toBe('appliquee');
    expect(banc.getState().pendingCascade!.cursor, 'la bande résolue, la séquence est au bilan').toBe(1);
    expect(banc.getState().pendingCascade!.participants[0].participants!.every((r) => !!r.result)).toBe(true);
  });

  it('hors coop, le joueur seul résout toute la bande', () => {
    table({ mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    banc.getState().jetLancer('cascade');
    expect(banc.getState().pendingCascade!.cursor).toBe(1);
  });
});
