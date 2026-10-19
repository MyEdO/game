// @vitest-environment jsdom
/**
 * Départ DIFFÉRÉ à l'aube (#2533) — de nuit (`cause: 'nuit'`) ou route du jour faite (`cause: 'budget'`) :
 * le panneau d'attente REMPLACE le panneau de départ de la route sélectionnée. Un seul panneau, un seul
 * « Annuler ».
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WorldMapView } from './WorldMapView';
import { useGame } from '../state/store';
import { t } from '../i18n';
import type { WorldMap } from '../state/worldMap';
import { dayIndex } from '../engine/clock';
import { createHero } from '../engine/character';
import { emptyScene } from '../noyau/monde/scene';

/** La scène de l'auberge, d'où part la route. */
const auberge = () => ({ ...emptyScene(5, 5), id: 's-auberge', label: 'La Diligence' });

const marcheur = () => [createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Marcheur', seed: 2533 })];

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const carte: WorldMap = {
  id: 'c', label: 'Carte',
  places: [
    { id: 'auberge', label: 'La Diligence', pos: { x: 10, y: 30 }, scene: 's-auberge' },
    { id: 'altdorf', label: 'Altdorf', pos: { x: 20, y: 30 }, scene: 's-altdorf' },
  ],
  routes: [{ id: 'auberge-altdorf', a: 'auberge', b: 'altdorf', km: 30, modes: ['pied'] }],
};

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
  useGame.setState({ worldMap: null, pendingDeparture: null, pendingRest: null, party: [], scene: null });
});

async function monter(): Promise<void> {
  await act(async () => { root.render(<WorldMapView hereSceneId="s-auberge" initialRouteId="auberge-altdorf" />); });
}
const boutons = (texte: string): number =>
  [...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === texte).length;

describe('WorldMapView — départ différé à l’aube', () => {
  it('route du jour FAITE, avant le clic : le panneau l’annonce, et l’action est « Attendre l’aube »', async () => {
    const { gameTime } = useGame.getState();
    useGame.setState({ worldMap: carte, scene: auberge(), party: marcheur(), pendingDeparture: null, pendingRest: null, travelDayHours: { day: dayIndex(gameTime), foot: 24, mount: 0, marched: true } });
    await monter();
    expect(container.textContent).toContain(t('wm.departAvantAube'));
    expect(boutons('Partir')).toBe(0);
    const attendre = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === t('wm.attendreAube'))!;
    await act(async () => { attendre.click(); });
    expect(useGame.getState().pendingDeparture).toBeNull();
    expect(useGame.getState().pendingRest, 'la nuit se passe sur place, d’un geste').not.toBeNull();
  });

  it('budget du jour intact : « Partir », sans annonce de départ à l’aube', async () => {
    const { gameTime } = useGame.getState();
    useGame.setState({ worldMap: carte, party: marcheur(), pendingDeparture: null, travelDayHours: { day: dayIndex(gameTime), foot: 0, mount: 0, marched: false } });
    await monter();
    expect(container.textContent).not.toContain(t('wm.departAvantAube'));
    expect(boutons('Partir')).toBe(1);
  });

  it('sans départ différé : le panneau de départ de la route, avec son « Annuler »', async () => {
    useGame.setState({ worldMap: carte, pendingDeparture: null });
    await monter();
    expect(boutons('Annuler')).toBe(1);
    expect(boutons(t('wm.attendreAube'))).toBe(0);
  });

  for (const cause of ['budget', 'nuit'] as const) {
    it(`cause « ${cause} » : le panneau d’attente remplace celui du départ — un seul « Annuler »`, async () => {
      useGame.setState({ worldMap: carte, pendingDeparture: { mode: 'pied', cause, dawnAt: 0 } });
      await monter();
      expect(boutons('Annuler')).toBe(1);
      expect(boutons(t('wm.attendreAube'))).toBe(1);
      const titre = t(cause === 'budget' ? 'wm.departBudgetTitre' : 'wm.departDeNuit');
      expect(container.querySelector(`[role="alertdialog"][aria-label="${titre}"]`)).not.toBeNull();
    });
  }
});
