/** Conseil de bord (#229, #1652) : la solde due d'un bloc de semaines, telle que l'écran la rend (MDG 14 l.293-302). */
import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CouncilModal } from './CouncilModal';
import { useGame } from '../state/store';
import { Coins } from './Coins';
import { fromBrass } from '../engine/money';
import { t } from '../i18n';
import type { CampaignVessel } from '../noyau/etat';

const vessel: CampaignVessel = { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } };
afterEach(() => {
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, { pendingCouncil: null, vessel: null });
});

describe('Conseil de bord — solde due du bloc', () => {
  it('quatre semaines franchies : la ligne « Solde due » porte quatre soldes', () => {
    Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, {
      vessel, pendingCouncil: { today: 28, wageBrass: 288, phase: 'choix' },
    });
    const html = renderToStaticMarkup(<CouncilModal />);
    const debut = html.indexOf(t('crew.soldeDue', { n: 4, s: 's' }));
    expect(debut).toBeGreaterThanOrEqual(0);
    const ligne = html.slice(debut, html.indexOf('</p>', debut));
    expect(ligne).toContain(renderToStaticMarkup(<Coins money={fromBrass(4 * 288)} />));
  });
});
