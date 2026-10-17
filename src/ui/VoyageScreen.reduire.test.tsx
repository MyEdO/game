// @vitest-environment jsdom
/**
 * « Réduire » l'écran de voyage pendant qu'une étape attend (#2533) : `CampaignView` garde l'écran OUVERT
 * tant qu'une cascade ou une nuit attend — le bouton serait une affordance MORTE. Patron canonique :
 * `GatedAction` (via `ScreenShell.closeRefus`), grisé (`aria-disabled`, jamais `disabled`) et portant sa
 * raison au survol. Sans étape en attente, « Réduire » reste un bouton offert.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { VoyageScreen } from './VoyageScreen';
import { useGame } from '../state/store';
import { t } from '../i18n';
import type { TravelPlan } from '../state/travelFlow';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  useGame.setState({ travelPlan: null });
});

const plan: TravelPlan = { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'pied', departAt: 0, hoursPerDay: 6, km: 60, kmDone: 24, interrupted: false };

async function monter(reduireRefus?: string): Promise<HTMLButtonElement> {
  useGame.setState({ travelPlan: plan });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<VoyageScreen onClose={() => {}} reduireRefus={reduireRefus} />); });
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Réduire')!;
}

describe('VoyageScreen — « Réduire » pendant une étape', () => {
  it('une étape attend : « Réduire » est grisé et dit pourquoi', async () => {
    const raison = t('vs.reduireRefus');
    const bouton = await monter(raison);
    expect(bouton.getAttribute('aria-disabled')).toBe('true');
    expect(bouton.hasAttribute('disabled'), 'atteignable au clavier : aria-disabled, jamais disabled').toBe(false);
    expect(container!.textContent).toContain(raison);
  });

  it('test opposé, aucune étape en attente : « Réduire » est offert', async () => {
    const bouton = await monter(undefined);
    expect(bouton.getAttribute('aria-disabled')).toBeNull();
    expect(container!.textContent).not.toContain(t('vs.reduireRefus'));
  });
});
