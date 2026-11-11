// @vitest-environment jsdom
/**
 * Panneau de départ de la carte du monde (#3059) : le bouton `worldmap-depart` lit le refus du geste
 * (`refusDeDepart`), les rations affichées lisent le devis (`devisDeTrajet`). Le lieu se choisit au clic.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { useGame } from '../state/store';
import type { MapRouteTrace, WorldMap } from '../noyau/worldMap';
import { emptyScene } from '../noyau/monde/scene';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { creditBourse } from '../noyau/bourseFlow';
import type { Combatant, ItemInstance } from '../engine/types';
import { setRule, resetRule } from '../engine/policy';
import type { Possession } from '../engine/possession';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const carte = (route: Partial<MapRouteTrace>): WorldMap => ({
  id: 'c', label: 'Carte',
  places: [
    { id: 'pa', label: 'Village A', pos: { x: 20, y: 40 }, scene: { id: 's-a' } },
    { id: 'pb', label: 'Bourg B', pos: { x: 70, y: 40 }, scene: { id: 's-b' } },
  ],
  routes: [{ id: 'r1', a: { id: 'pa' }, b: { id: 'pb' }, km: 90, modes: ['pied'], perilDie: 0, ...route }],
});

const dixRations = (): ItemInstance[] => Array.from({ length: 10 }, (_, i) => ({ ...itemFromTrappingById('ration', idsDeTest)!, uid: `r${i}`, enc: 0 }));

/** Marcheur M4 : 90 km à 24 km/jour, quatre jours, trois nuits en route. */
const marcheur = (p: Partial<Combatant> = {}): Combatant => ({
  ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Marcheur', seed: 3059 }),
  movement: 4, items: dixRations(), ...p,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useGame.setState({ worldMap: null, party: [], scene: null, net: { ...useGame.getState().net, mode: 'local' } });
});

/** Monte la carte au Village A et clique le médaillon de Bourg B. */
async function choisirBourgB(route: Partial<MapRouteTrace>, party: Combatant[], avant?: () => void): Promise<void> {
  useGame.setState({ worldMap: carte(route), lieu: 'pa', scene: { ...emptyScene('s-a', 5, 5), label: 'Village A' }, party, pendingDeparture: null });
  avant?.();
  await act(async () => { root.render(<WorldMapView />); });
  const medaillon = container.querySelector('g[aria-label="Bourg B"]')!;
  await act(async () => { medaillon.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

/** Le bouton de départ, par son nom accessible (`wm.partir`, `wm.payerEtPartir`). */
const depart = (): HTMLButtonElement =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => ['Partir', 'Payer et partir'].includes(b.getAttribute('aria-label') ?? ''))!;
const raison = (): string | null => container.querySelector('#worldmap-depart-reason')?.textContent ?? null;

describe('WorldMapView — le départ lit `refusDeDepart`', () => {
  it('Ogre (ADE II 2 l.708) : les rations des trois nuits sont 6', async () => {
    await choisirBourgB({}, [marcheur({ traits: [{ id: 'ogre' }] })]);
    expect(container.textContent).toContain('Rations pour les nuits : 6 (le groupe en porte 10)');
  });

  it('Brouet (LDB 10 l.139) : les rations des trois nuits sont 2', async () => {
    await choisirBourgB({}, [marcheur({ talents: [{ talentId: 'brouet', times: 1 }] })]);
    expect(container.textContent).toContain('Rations pour les nuits : 2 (le groupe en porte 10)');
  });

  it('en selle (EDOC 07 l.140) : les nuits en route se comptent aussi au devis', async () => {
    setRule('voyage-allures', true);
    try {
      const h = marcheur();
      const palefroi: Possession = { uid: 'm1', ownerId: h.id, nature: 'bete', ref: { id: 'cheval-de-monte' }, location: { kind: 'avec-le-groupe' }, items: [] };
      await choisirBourgB({ km: 200 }, [h], () => useGame.setState({ possessions: [palefroi] }));
      const enSelle = [...container.querySelectorAll<HTMLElement>('[role="radio"], button')].find((b) => b.textContent?.includes('En selle'))!;
      await act(async () => { enSelle.click(); });
      expect(container.textContent).toContain('Rations pour les nuits : 3 (le groupe en porte 10)');
    } finally {
      resetRule('voyage-allures');
      useGame.setState({ possessions: [] });
    }
  });

  it('bourse insuffisante : le bouton est fermé, avec la raison du geste', async () => {
    await choisirBourgB({ km: 600, modes: ['diligence'] }, [marcheur()]);
    expect(depart().getAttribute('aria-disabled')).toBe('true');
    expect(raison()).toBe('Le passage (diligence, 2 CO 10/–) dépasse les moyens du groupe.');
  });

  it('offre absente (véhicule sans tarif) : le bouton est fermé, avec la raison du geste', async () => {
    await choisirBourgB({ modes: ['charrette'], speed: { charrette: 4 } }, [marcheur()]);
    expect(depart().getAttribute('aria-disabled')).toBe('true');
    expect(raison()).toBe('Aucun passage n’est proposé pour ce mode sur cette route.');
  });

  it('siège invité : le bouton est fermé, « L’hôte décide des départs. »', async () => {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'invite' } });
    await choisirBourgB({}, [marcheur()]);
    expect(depart().getAttribute('aria-disabled')).toBe('true');
    expect(raison()).toBe('L’hôte décide des départs.');
  });

  it('départ permis : le bouton est ouvert, sans raison', async () => {
    const h = marcheur();
    await choisirBourgB({ km: 12, modes: ['diligence'] }, [h], () => creditBourse(useGame.getState, useGame.setState, h.id, { gold: 1, silver: 0, brass: 0 }));
    expect(depart().getAttribute('aria-disabled')).not.toBe('true');
    expect(raison()).toBeNull();
  });
});
