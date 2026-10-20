// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LandMarketView } from './LandMarketView';
import { useGame } from '../state/store';
import { emptyScene } from '../noyau/monde/scene';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from '../noyau/battleRng';
import type { WorldMap } from '../noyau/worldMap';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const get = useGame.getState.bind(useGame);

const landMap: WorldMap = {
  id: 'm', label: 'Reikland',
  places: [{ id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'ville-a', market: { taille: 4, richesse: 4, produits: ['vivres', 'vin', 'metal', 'commerce'] } }],
  routes: [],
};

/** « Évaluer » du premier lot de Vin, monté au client : état du geste et raison rendue. */
function evaluer() {
  const wine = get().landMarket!.offers.find((o) => o.wine && !o.wineTier)!;
  const hote = document.createElement('div');
  const root = createRoot(hote);
  act(() => root.render(<LandMarketView />));
  const bouton = [...hote.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === `Évaluer ${wine.label}`);
  const etat = { rendu: !!bouton, ferme: bouton?.getAttribute('aria-disabled') ?? null, raison: hote.querySelector(`#market-eval-${wine.cargoId}-reason`)?.textContent ?? null };
  act(() => root.unmount());
  return etat;
}

describe('LandMarketView — « Évaluer » le vin suit qui peut tenter le Test (LDB 09 l.30)', () => {
  beforeEach(() => {
    useGame.setState({
      party: makePregens().slice(0, 3), possessions: [],
      scene: { ...emptyScene(2, 2), id: 'ville-a', label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: landMap, travelPlan: null, landMarket: null, journal: [],
    } as never);
    seedBattleRng(3);
    get().openLandMarket();
  });

  it('un héros formé à l’Évaluation : le geste est offert', () => {
    expect(get().party.some((h) => h.skills.some((sk) => sk.id === 'evaluation' && (sk.advances ?? 0) > 0))).toBe(true);
    expect(evaluer()).toEqual({ rendu: true, ferme: null, raison: null });
  });

  it('personne qui l’ait : le geste est fermé, sa raison NOMMÉE', () => {
    useGame.setState({ party: get().party.map((h) => ({ ...h, skills: h.skills.filter((sk) => sk.id !== 'evaluation') })) });
    expect(evaluer()).toEqual({ rendu: true, ferme: 'true', raison: 'Personne dans le groupe ne peut tenter le Test d’Évaluation.' });
  });
});
