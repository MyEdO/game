// @vitest-environment jsdom
/**
 * Modale de Repos — la halte de voyage dit POURQUOI la nuit n'a pas d'Exposition quand « Plein air » a
 * réussi à l'Étape du jour (EDOC 08 l.141), au lieu de taire le mauvais temps (#2533).
 * Rendu jsdom (`createRoot`) : `RestBody` lit le store, que le rendu SSR sert à l'état INITIAL.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RestBody } from './RestModal';
import { useGame } from '../state/store';
import { t } from '../i18n';
import { fixtureText } from '../i18n/fixtureText';
import type { Combatant } from '../engine/types';
import type { TravelPlan, TravelRecapDay } from '../noyau/travelFlow';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; });

const hero = blessuresSurLeProfil({
  id: 'h', label: 'Hilda', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [], movement: 4,
}) as Combatant;

/** Halte de nuit après un jour d'averse (`pluie-diluvienne`), Plein air réussi ou non. */
function halte(pleinAir: boolean): string {
  const jour: TravelRecapDay = { kmFrom: 0, kmTo: 24, hours: 6, lines: [], weather: { id: 'pluie-diluvienne', roll: 95 }, ...(pleinAir ? { pleinAir: true as const } : {}) };
  const plan: TravelPlan = { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'pied', hoursPerDay: 6, km: 60, kmDone: 24, interrupted: false, log: [jour] };
  useGame.setState({
    party: [hero], travelPlan: plan,
    pendingRest: { places: { camp: true }, lieu: fixtureText('sur la route de A à B'), quality: 'normale', days: 1, perHero: { h: { lodging: 'dehors', food: 'rien' } }, phase: 'setup', travelHalt: true } as never,
  });
  const el = document.createElement('div');
  root = createRoot(el);
  act(() => root!.render(<RestBody />));
  return el.textContent ?? '';
}

describe('RestBody — Plein air (EDOC 08 l.141)', () => {
  beforeEach(() => { useGame.setState({ pendingRest: null, travelPlan: null }); });

  it('Plein air réussi : la modale nomme la dispense, et ne compte aucune Exposition', () => {
    const html = halte(true);
    expect(html).toContain(t('rf.pleinAirDispense'));
    expect(html).not.toContain('Temps de chien');
    expect(html).not.toContain('Exposition ×');
  });

  it('test opposé, Plein air raté : le temps de chien et l’Exposition s’affichent, sans dispense', () => {
    const html = halte(false);
    expect(html).not.toContain(t('rf.pleinAirDispense'));
    expect(html).toContain('Temps de chien');
    expect(html).toContain('Exposition ×');
  });
});
