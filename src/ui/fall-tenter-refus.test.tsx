// @vitest-environment jsdom
/**
 * « Tenter un Test d'Athlétisme » (chute volontaire, LDB 15 l.82) consomme l'Action (LDB 13 l.86-88) :
 * Action déjà prise → l'option porte le refus de `fallChoose` (`refusDuTestDeChute`,
 * `state/gesteDArete.ts`), éteinte ; Action libre → offerte. Afficher = agir.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { FallModal } from './FallModal';
import { phaseDeChute } from '../state/fallMove';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 40 };
const sauteur = { id: 'S', name: 'S', label: 'S', kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
  weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
  species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4, traits: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant;

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
  useGame.setState({ pendingFall: null, battle: null, mode: 'exploration' } as never);
});

const tenter = (): HTMLElement => {
  const b = [...host.querySelectorAll('button')].find((x) => x.textContent?.includes('Tenter'));
  if (!b) throw new Error('l’option « Tenter » n’est pas rendue');
  return b;
};

function monter(acted: boolean): void {
  useGame.setState({
    mode: 'battle',
    battle: { combatants: [sauteur], order: [sauteur.id], turn: 0, acted, over: null },
    party: [sauteur],
    pendingFall: { to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [{ id: sauteur.id, interactive: true, attempt: null, result: null }] },
  } as never);
  act(() => root.render(<FallModal />));
}

describe('chute volontaire — l’option « Tenter » suit le verdict de `fallChoose`', () => {
  it('Action déjà prise : option éteinte (aria-disabled), clic inerte', () => {
    monter(true);
    expect(tenter().getAttribute('aria-disabled')).toBe('true');
    act(() => tenter().click());
    expect(phaseDeChute(useGame.getState().pendingFall!)).toBe('choice');
  });

  it('le refus SUIT le store sans nouveau rendu du parent : l’entrée en combat éteint l’option', () => {
    monter(true);
    act(() => { useGame.setState({ mode: 'exploration' } as never); });
    expect(tenter().getAttribute('aria-disabled')).not.toBe('true');
    act(() => { useGame.setState({ mode: 'battle' } as never); });
    expect(tenter().getAttribute('aria-disabled')).toBe('true');
  });

  it('Action libre : option offerte, le clic ouvre le jet', () => {
    monter(false);
    expect(tenter().getAttribute('aria-disabled')).not.toBe('true');
    act(() => tenter().click());
    expect(phaseDeChute(useGame.getState().pendingFall!)).toBe('roll');
  });
});

describe('chute du groupe en coop (EDO 01 l.231) — chaque rangée se déclare depuis le siège de SON héros', () => {
  const compagnon = { ...sauteur, id: 'K', name: 'K', label: 'Kurt' } as Combatant;
  afterEach(() => useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {} } }));

  it('le siège 1 déclare pour Kurt ; la rangée du héros de l’hôte attend, sans option', () => {
    useGame.setState({
      mode: 'exploration', battle: null, party: [sauteur, compagnon],
      net: { ...useGame.getState().net, mode: 'guest', mySeat: 1, ownership: { K: 1 } },
      pendingFall: { to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, participants: [
        { id: sauteur.id, interactive: true, attempt: null, result: null },
        { id: compagnon.id, interactive: true, attempt: null, result: null },
      ] },
    } as never);
    act(() => root.render(<FallModal />));
    const tenters = [...host.querySelectorAll('button')].filter((x) => x.textContent?.includes('Tenter'));
    expect(tenters, 'une seule rangée offre la déclaration : celle du siège').toHaveLength(1);
    expect(host.textContent).toContain('en attente de la déclaration de S');
    expect(host.textContent).not.toContain('en attente de la déclaration de Kurt');
  });
});
