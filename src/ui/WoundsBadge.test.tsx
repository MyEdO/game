import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WoundsBadge } from './WoundsBadge';

describe('WoundsBadge — rendu unique de la VALEUR des Blessures', () => {
  it('affiche TOUJOURS courant/max (jamais le max seul)', () => {
    const html = renderToStaticMarkup(<WoundsBadge wounds={{ current: 8, max: 12 }} />);
    expect(html).toContain('8/12');
    expect(html).toContain('wounds-badge');
  });

  it("n'EMBARQUE plus d'icône : l'icône est le choix du site d'appel (directive user 2026-07-13)", () => {
    const html = renderToStaticMarkup(<WoundsBadge wounds={{ current: 8, max: 12 }} />);
    expect(html).not.toContain('<svg'); // plus d'icône ressource/blessures dans le badge
  });

  it('à pleine santé aussi : courant/max (l’unité est le composant)', () => {
    const html = renderToStaticMarkup(<WoundsBadge wounds={{ current: 12, max: 12 }} />);
    expect(html).toContain('12/12');
  });
});
