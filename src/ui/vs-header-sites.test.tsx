// @vitest-environment jsdom
/**
 * #1078 LOT B2 (correction de contrat, décision utilisateur 2026-08-04) — l'A→B d'une fenêtre de jet
 * est le BANDEAU canonique (`VsHeader` : portraits + flèche annotée), jamais une phrase « A écrase B ».
 * Contrat mesuré à l'ÉCRAN (montage réel, patron `createRoot`/`act` du repo).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { BattementModal } from './BattementModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind: 'enemy', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 2, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 0, fortune: 0,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4, traits: [],
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

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
  useGame.setState({ battle: null, pendingBattement: null } as never);
});

const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');

/**
 * Battement (LDB 10 l.103 / AA 13 l.17) — Action de Corps à corps contre un adversaire : VRAI
 * face-à-face entre deux `Combatant`, donc bandeau, jamais « X bat l'arme de Y ».
 */
describe('Battement — l’A→B est le bandeau, pas une phrase', () => {
  it('bandeau complet + coût annoncé sur la flèche ; aucune phrase composée', () => {
    const attacker = mk('Bretteur', { kind: 'hero' } as Partial<Combatant>);
    const foe = mk('Rufian');
    useGame.setState({
      battle: { combatants: [attacker, foe], over: false },
      pendingBattement: { attackerId: attacker.id, foeId: foe.id, result: null },
    } as never);
    act(() => root.render(<BattementModal />));
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un bandeau d’opposition, un seul').toHaveLength(1);
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(host.querySelector('.rm-vs-arrow')?.textContent).toContain('Battement');
    expect(screen(), 'plus aucun A→B TEXTUEL').not.toContain("bat l'arme de");
  });
});
