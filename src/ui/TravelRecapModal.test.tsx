/**
 * Récapitulatif de voyage (audit M4/M5) : la modale raconte le segment (jours, péripéties) et
 * relance la carte (« Continuer le voyage »). Rendu statique via seam (store SSR = état initial).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TravelRecapModal } from './TravelRecapModal';
import type { TravelRecap } from '../state/travelFlow';

const base: TravelRecap = {
  fromLabel: 'Weiler', toLabel: 'Federholz', mode: 'pied', status: 'arrived',
  km: 24, kmDone: 24,
  days: [
    { kmFrom: 0, kmTo: 24, hours: 6, lines: [{ text: 'Péripétie : Un colporteur partage la route.' }] },
  ],
  daysTotal: 1,
};

describe('TravelRecapModal', () => {
  // ARRIVÉE amincie (diagnostic fil 4, vague « lisibilité 2/2 ») : un ACCUSÉ (route, durée, date),
  // plus de dump jour par jour — il fait doublon avec la halte du soir / la chronique du hub.
  it('arrivée : itinéraire, durée, « Continuer le voyage » — sans dump jour par jour', () => {
    const html = renderToStaticMarkup(<TravelRecapModal seam={base} />);
    expect(html).toContain('Arrivée à Federholz');
    expect(html).toContain('Voyage de 1 jour');
    expect(html).not.toContain('colporteur'); // le déroulé du jour n'est plus re-dérouné à l'arrivée
    expect(html).toContain('Continuer le voyage');
  });

  // INTERRUPTION : seule trace de la raison de l'arrêt — GARDE le déroulé jour par jour (migré ici
  // depuis le cas arrivée, désormais amincie).
  it('interruption : km restants + reprise par la carte + déroulé du jour (péripéties)', () => {
    const html = renderToStaticMarkup(<TravelRecapModal seam={{ ...base, status: 'interrupted', kmDone: 10, days: [{ kmFrom: 0, kmTo: 10, hours: 2.5, lines: [{ text: 'Péripétie : Un colporteur partage la route.' }, { text: 'Péripétie : Brigands !' }] }] }} />);
    expect(html).toContain('Voyage interrompu');
    expect(html).toContain('14 km restants');
    expect(html).toContain('colporteur');
    expect(html).toContain('reprendre depuis la carte');
    expect(html).toContain('Ouvrir la carte');
  });

  it('surcharge : « stalled » explique comment repartir', () => {
    const html = renderToStaticMarkup(<TravelRecapModal seam={{ ...base, status: 'stalled', kmDone: 0, days: [] }} />);
    expect(html).toContain('convoi s&#x27;arrête');
    expect(html).toContain('allégez les sacs');
  });
});
