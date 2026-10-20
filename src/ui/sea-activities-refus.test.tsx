// @vitest-environment jsdom
/**
 * Activités en mer : l'Activité est un Test CHOISI (MDG 15 l.268). Un héros qui ne peut pas en tenter le
 * Test (LDB 09 l.30 ; Métier (Cartographe) avancée, MDG 15 l.290) la voit offerte, FERMÉE avec sa
 * raison, dans SA section ; les autres héros la gardent ouverte (#2588).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { refusNePeutTenter } from '../engine/skills';
import type { PendingSeaActivities } from '../noyau/seaActivities';
import type { Combatant } from '../engine/types';
import { SeaActivitiesModal } from './SeaActivitiesModal';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { resetDismissLayers } from './useDismissLayer';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
let retirerLayout: () => void;
const etatInitial = useGame.getState();

beforeEach(() => {
  resetDismissLayers();
  retirerLayout = poserLayoutJsdom();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  retirerLayout();
  resetDismissLayers();
  useGame.setState(etatInitial, true);
});

const hero = (id: string, label: string, over: Partial<Combatant> = {}): Combatant => ({
  id, label, kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...over,
} as Combatant);

const HILDA = hero('h1', 'Hilda');
const KARL = hero('h2', 'Karl', { skills: [{ id: 'metier', spec: 'cartographe', characteristic: 'dexterite', advances: 10 }] } as Partial<Combatant>);

const option = (heroLabel: string, activite: string): HTMLButtonElement => {
  const section = [...host.ownerDocument.querySelectorAll<HTMLElement>('.sea-act-hero')].find((s) => s.querySelector('h4')?.textContent?.includes(heroLabel))!;
  return [...section.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === activite)!;
};

describe('Activités en mer — une Activité non tentable est FERMÉE par candidat', () => {
  beforeEach(() => {
    useGame.setState({
      party: [HILDA, KARL],
      vessel: null,
      pendingSeaActivities: { day: { events: [] } } as unknown as PendingSeaActivities,
    });
    act(() => root.render(<SeaActivitiesModal />));
  });

  it('Cartographie : éteinte pour Hilda avec sa raison nommée, ouverte pour Karl', () => {
    const fermee = option('Hilda', 'Cartographie');
    expect(fermee.getAttribute('aria-disabled')).toBe('true');
    expect(fermee.hasAttribute('disabled'), 'atteignable, jamais disabled').toBe(false);
    const raison = document.getElementById(fermee.getAttribute('aria-describedby')!);
    expect(raison?.textContent).toContain(refusNePeutTenter(HILDA, { skill: 'metier', spec: 'cartographe' }));
    expect(option('Karl', 'Cartographie').getAttribute('aria-disabled')).toBeNull();
  });

  it('cliquer l’Activité fermée ne la retient pas', () => {
    act(() => { option('Hilda', 'Cartographie').click(); });
    expect(option('Hilda', 'Cartographie').getAttribute('aria-pressed')).not.toBe('true');
  });
});
