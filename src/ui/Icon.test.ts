import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ICON_DEFS } from '../data/icons';
import { Icon } from './Icon';

describe('primitive <Icon>', () => {
  it('rend le fragment du registre dans un viewBox 24×24 (défaut md=18px)', () => {
    const html = renderToStaticMarkup(React.createElement(Icon, { id: 'action/attaquer' }));
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('width="18"');
    expect(html).toContain('class="icon"');
    expect(html).toContain('aria-hidden');
    // le contenu du registre est bien injecté
    expect(html).toContain(ICON_DEFS['action/attaquer'].svg.slice(0, 40));
  });

  it('accepte les tailles nommées et numériques', () => {
    const sm = renderToStaticMarkup(React.createElement(Icon, { id: 'interface/attendre', size: 'sm' }));
    expect(sm).toContain('width="14"');
    const lg = renderToStaticMarkup(React.createElement(Icon, { id: 'interface/attendre', size: 'lg' }));
    expect(lg).toContain('width="24"');
    const px = renderToStaticMarkup(React.createElement(Icon, { id: 'interface/attendre', size: 32 }));
    expect(px).toContain('width="32"');
  });

  it('jette sur un id inconnu en DEV (rien de silencieux)', () => {
    // @ts-expect-error -- un id hors registre ne compile pas ; le rendu le refuse aussi.
    expect(() => renderToStaticMarkup(React.createElement(Icon, { id: 'nope/inconnu' }))).toThrow(/Icône inconnue/);
  });
});
