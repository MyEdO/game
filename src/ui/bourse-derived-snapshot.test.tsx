// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { withBourseMoney } from '../engine/bourse';
import { toMoney, spellMoney } from '../engine/money';
import { SeaActivitiesModal } from './SeaActivitiesModal';
import { ManannPriestModal } from './ManannPriestModal';
import { PortView } from './PortView';

const initial = useGame.getState();
const hero = (gold: number) => withBourseMoney(makePregens()[0], toMoney({ gold }));
const vessel = { vehicleId: 'cogue', label: 'Navire de test', morale: { score: 75, lastMoraleWeek: 0, factors: [] } };
const port = {
  placeId: 'port-test', label: 'Port de test',
  port: { taille: 4, richesse: 5, production: [], surplus: {}, demande: {}, cosmopolite: false },
  freeEnc: 5, maxLoadEnc: 5,
  offers: [{ cargoId: 'poisson-sale', label: 'Poisson salé', enc: 5, basePrice: 1, surplus: false }],
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  useGame.setState({
    party: [hero(3)], vessel, port, net: { ...initial.net, mode: 'local' },
    pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 0, hours: 0, lines: [] } },
    pendingManannPriest: { cost: toMoney({ gold: 5 }) }, pendingShoreLeave: null,
  });
});

afterEach(() => {
  demonterRacines();
  useGame.setState(initial);
  vi.unstubAllGlobals();
});

const bouton = (container: HTMLElement, texte: string) => {
  const trouvé = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(texte));
  expect(trouvé, `bouton ${texte}`).toBeDefined();
  return trouvé!;
};
const coins = (container: HTMLElement, gold: number) =>
  [...container.querySelectorAll('.coins')].some((c) => c.getAttribute('title') === spellMoney(toMoney({ gold })));

describe('bourses dérivées — trois consommateurs montés sous StrictMode', () => {
  it.each(['mer', 'manann', 'port'] as const)('%s : montage stable puis mise à jour de la bourse', async (cas) => {
    const node = cas === 'mer' ? <SeaActivitiesModal /> : cas === 'manann' ? <ManannPriestModal /> : <PortView initialTab="cargaison" />;
    const { container } = monterRacine(<StrictMode>{node}</StrictMode>);
    if (cas === 'mer') {
      await act(async () => bouton(container, "Commerce d'opportunité").click());
      expect(container.textContent).toContain('Mise (CO, max 3)');
      expect(coins(container, 3)).toBe(true);
    } else {
      expect(bouton(container, cas === 'manann' ? 'Payer' : 'Acheter').getAttribute('aria-disabled')).toBe('true');
      if (cas === 'port') expect(coins(container, 3)).toBe(true);
    }

    const html = container.innerHTML;
    await act(async () => useGame.setState({ flags: { ...useGame.getState().flags, 'sonde-bourse': true } }));
    expect(container.innerHTML).toBe(html);

    await act(async () => useGame.setState({ party: [hero(80)] }));
    if (cas === 'mer') {
      expect(container.textContent).toContain('Mise (CO, max 80)');
      expect(coins(container, 80)).toBe(true);
    } else {
      expect(bouton(container, cas === 'manann' ? 'Payer' : 'Acheter').getAttribute('aria-disabled')).not.toBe('true');
      if (cas === 'port') expect(coins(container, 80)).toBe(true);
    }
  });
});
