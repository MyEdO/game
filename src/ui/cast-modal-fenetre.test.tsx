// @vitest-environment jsdom
/**
 * LES FENÊTRES MAGIQUES DESSINENT LA FENÊTRE DU NOYAU (#3059) — `CastModal` ne lit que `fenetreDIncantation` (effets
 * d'Incantation Critique et leurs refus, annulation jugée par le flux), `FocusModal` que `ligneDeFocalisation` (NI,
 * valeur du résolveur), `DispelModal` que la ligne figée au pending. Montage réel (patron `createRoot`/`act` du repo).
 * LDB 46 l.26-32, l.128-132, l.158-162.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { testScene } from '../scenes/test-fixture';
import { CastModal } from './CastModal';
import { FocusModal } from './FocusModal';
import { DispelModal } from './DispelModal';
import { ligneDeFocalisation } from '../noyau/fenetreDIncantation';
import type { BattleState } from '../noyau/etat';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'heros' | 'ennemi'): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], talents: [], items: [],
     skills: [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 20 }, { id: 'focalisation', characteristic: 'force-mentale', advances: 12 }],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: kind === 'heros' ? 0 : 1, y: 0 }, wounds: blessuresDeBase(18), resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant);

const SOLO = { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} };
const CRITIQUE = { cast: true, roll: 11, target: 60, sl: 4, isCritical: true, isFumble: false, log: '', niRequired: 2 };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ pendingCast: null, pendingCastOpposition: null, pendingCounterspell: null, pendingCascade: null, pendingFocus: null, pendingDispel: null,
    battle: null, party: [], net: SOLO as never, mode: 'exploration', scene: null } as never);
});

/** Monte la fenêtre d'incantation de `casterId` sur `spellId`, au jet `result` (`null` : avant le jet). */
function monter(casterId: 'H' | 'E', spellId: string, result: object | null, net: object = SOLO): void {
  const H = mk('H', 'heros');
  const E = mk('E', 'ennemi');
  useGame.setState({
    battle: { combatants: [H, E], order: ['H', 'E'], baseOrder: ['H', 'E'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState,
    mode: 'battle', scene: testScene(), party: [H], net: net as never,
    pendingCast: { casterId, targetId: casterId === 'H' ? 'E' : 'H', spellId, missile: false, focused: false, result } as never,
  });
  act(() => { root.render(<CastModal />); });
}

/** Le bouton dont le texte contient `texte`. */
const bouton = (texte: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(texte));

describe('CastModal : les effets d’Incantation Critique sont ceux de la fenêtre (LDB 46 l.26-32)', () => {
  it('Sort à op de Dégâts hors Projectile : « Blessure Critique » offerte', () => {
    monter('H', 'destruction-de-demon-mineur', CRITIQUE);
    const b = bouton('Blessure Critique');
    expect(b, 'l’effet est dessiné').toBeTruthy();
    expect(b!.getAttribute('aria-disabled')).toBeNull();
  });

  it('Arme aethyrique : « Blessure Critique » dessinée refusée, avec sa raison', () => {
    monter('H', 'arme-aethyrique', CRITIQUE);
    const b = bouton('Blessure Critique');
    expect(b!.getAttribute('aria-disabled')).toBe('true');
    expect(host.textContent).toContain('n’inflige pas de Dégâts');
    expect(bouton('Force inéluctable')!.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('CastModal : l’annulation suit le flux, jamais le genre du lanceur (Q3)', () => {
  it('ennemi conduit au siège MJ, avant le jet : « Annuler » est offert', () => {
    monter('E', 'destruction-de-demon-mineur', null, { ...SOLO, gmSeat: 0 });
    expect(bouton('Annuler'), 'le MJ renonce pour son lanceur').toBeTruthy();
  });

  it('jet lancé : « Annuler » n’est plus offert (LDB 46 l.24)', () => {
    monter('H', 'destruction-de-demon-mineur', { ...CRITIQUE, isCritical: false });
    expect(bouton('Annuler')).toBeUndefined();
  });
});

describe('FocusModal et DispelModal : la ligne vient du noyau', () => {
  it('Focalisation : le NI et la valeur annoncés sont ceux de `ligneDeFocalisation`', () => {
    const W = mk('W', 'heros');
    useGame.setState({ battle: null, party: [W], pendingFocus: { casterId: W.id, spellId: 'forme-bestiale', result: null } } as never);
    const ligne = ligneDeFocalisation(useGame.getState())!;
    act(() => { root.render(<FocusModal />); });
    expect(host.textContent).toContain(`/ ${ligne.ni}`);
    expect(host.textContent).toContain(String(ligne.base));
  });

  it('Dissipation : la valeur annoncée est celle figée au pending, pas une relecture du lanceur', () => {
    const W = mk('W', 'heros');
    useGame.setState({ battle: null, party: [W], pendingDispel: {
      casterId: W.id, spellId: 'malefice', spellCasterId: 'E', label: 'Maléfice', ni: 3, value: 57,
      ligne: { base: 57, mods: [], target: 57, difficulty: 'intermediaire' }, result: null,
    } } as never);
    act(() => { root.render(<DispelModal />); });
    expect(host.textContent, 'la valeur figée').toContain('57');
  });
});
