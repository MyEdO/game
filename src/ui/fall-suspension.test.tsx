// @vitest-environment jsdom
/**
 * Axe HAUTEUR de la chute volontaire (EDO 01 l.231) dans la rangée de `FallModal` : offert seulement
 * quand l'étape porte `suspendu`, déclaré avec le Test par `fallChoose`, éteint quand le Mouvement ne le
 * couvre pas (`refusDeLaSuspension`, `state/gesteDArete.ts`). Afficher = agir.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { FallModal } from './FallModal';
import { emptyScene } from '../state/scene';
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
  useGame.setState({ pendingFall: null, battle: null, mode: 'exploration', scene: null } as never);
});

const option = (texte: string): HTMLElement | undefined => [...host.querySelectorAll('button')].find((x) => x.textContent?.includes(texte));

function monter(suspendu: number | undefined, battle: Record<string, unknown> | null): void {
  useGame.setState({
    mode: battle ? 'battle' : 'exploration',
    scene: emptyScene(4, 4),
    battle: battle ? { combatants: [sauteur], order: [sauteur.id], turn: 0, acted: false, over: null, ...battle } : null,
    party: [sauteur],
    pendingFall: {
      to: { x: 0, y: 1 }, metres: 4, initiateurId: sauteur.id, croisee: true,
      ...(suspendu !== undefined ? { suspendu } : {}),
      participants: [{ id: sauteur.id, interactive: true, attempt: null, ...(suspendu !== undefined ? { suspendre: null } : {}), result: null }],
    },
  } as never);
  act(() => root.render(<FallModal />));
}

describe('chute volontaire — l’axe « se suspendre d’abord »', () => {
  it('suspension non offerte : aucune option de suspension', () => {
    monter(undefined, null);
    expect(option('Se suspendre')).toBeUndefined();
  });

  it('offerte : « Se suspendre, puis se lâcher » déclare les DEUX axes de la rangée', () => {
    monter(2, null);
    const b = option('Se suspendre, puis se lâcher (chute de 2 m)')!;
    expect(b.getAttribute('aria-disabled')).not.toBe('true');
    act(() => b.click());
    expect(useGame.getState().pendingFall, 'la seule rangée a déclaré sans Test : l’étape est résolue').toBeNull();
  });

  it('offerte : « Se suspendre, puis tenter » ouvre le jet, suspendu', () => {
    monter(2, null);
    act(() => option('Se suspendre, puis tenter')!.click());
    expect(useGame.getState().pendingFall!.participants[0]).toMatchObject({ attempt: true, suspendre: true });
  });

  it('combat, Mouvement insuffisant : les options de suspension sont éteintes, « Sauter » reste offert', () => {
    monter(2, { movementUsed: 1 }); // Marche 4 − 1 = 3 < 1 + allège 1 + descente 2
    expect(option('Se suspendre, puis se lâcher')!.getAttribute('aria-disabled')).toBe('true');
    expect(option('Sauter')!.getAttribute('aria-disabled')).not.toBe('true');
  });
});
