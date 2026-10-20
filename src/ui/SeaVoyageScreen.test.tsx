/**
 * Événements de bord RACONTÉS (#371 LOT 4) → carte-parchemin (`ParchmentCard`) dans `SeaVoyageBody` —
 * un récit = une carte, distinct du procès-verbal de routine (`RecapLineList`/`MultiRollList`).
 * Rendu statique (même patron que `InterludeScreen.test.tsx`, #383 — flux non couvert avant ce lot).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeaVoyageBody } from './SeaVoyageScreen';
import type { TravelRecapDay } from '../noyau/travelFlow';
import type { SeaRecapChrome } from '../noyau/seaVoyageFlow';
import { t } from '../i18n';

const chrome: SeaRecapChrome = {
  weatherLabel: 'Ciel dégagé', windForce: 'vent-modere', windFrom: 'ouest', heading: 'est',
  hullDelta: 0, morale: 75, manann: 0, milesLeft: 300, daysLeft: 4,
};

function day(events: TravelRecapDay['events']): TravelRecapDay {
  return { kmFrom: 0, kmTo: 50, hours: 24, lines: [], entries: [], events, sea: chrome };
}

describe('SeaVoyageBody — événement de bord raconté en carte-parchemin', () => {
  it('un jour SANS event ne rend aucune `.parchment-card`', () => {
    const html = renderToStaticMarkup(<SeaVoyageBody day={day([])} />);
    expect(html).not.toContain('parchment-card');
  });

  it('un jour AVEC un event rend une `.parchment-card` portant le titre + le texte verbatim', () => {
    const html = renderToStaticMarkup(<SeaVoyageBody day={day([{ title: 'Calme plat', text: 'Les vents vous abandonnent pour les prochains 1d10 jours.', roll: 21 }])} />);
    expect(html).toContain('parchment-card');
    expect(html).toContain('Calme plat');
    expect(html).toContain('Les vents vous abandonnent pour les prochains 1d10 jours.');
    expect(html).toContain('parchment-seal'); // sceau : tirage capturé
  });
});

describe('SeaVoyageBody — vent relatif au cap (#1935)', () => {
  it.each([
    ['ouest', 'est', 'vent arrière'],
    ['est', 'est', 'vent de face'],
    ['nord', 'est', 'vent latéral'],
  ] as const)('vent d%s, cap %s → cartouche « Vent relatif » = %s', (windFrom, heading, aspect) => {
    const html = renderToStaticMarkup(<SeaVoyageBody day={{ ...day([]), sea: { ...chrome, windFrom, heading } }} />);
    expect(html).toContain(`<span class="sc-label">${t('sv.ventRelatif')}</span><span class="sc-value">${aspect}</span>`);
  });
});
