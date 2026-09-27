import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ICON_FAMILIES } from './_registry.generated';
import { ICON_DEFS } from './index';
import { Icon, IconG } from '../Icon';

const ALL = ICON_FAMILIES.flat();

describe('registre d’icônes (src/ui/icons/defs)', () => {
  it('a des ids uniques', () => {
    const seen = new Set<string>();
    for (const d of ALL) {
      expect(seen.has(d.id), `id en double : ${d.id}`).toBe(false);
      seen.add(d.id);
    }
    expect(Object.keys(ICON_DEFS).length).toBe(ALL.length);
  });

  it('nomme chaque icône `famille/nom` en kebab-case', () => {
    const kebab = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
    for (const d of ALL) expect(d.id, d.id).toMatch(kebab);
  });

  it('a un label FR non vide pour chaque def', () => {
    for (const d of ALL) expect(d.label.trim().length, d.id).toBeGreaterThan(0);
  });

  it('ne contient AUCUNE couleur en dur (currentColor / none / var(--gold) seulement)', () => {
    for (const d of ALL) {
      expect(d.svg, `${d.id} : couleur hex interdite`).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      for (const m of d.svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
        expect(['currentColor', 'none', 'var(--gold)'], `${d.id} : ${m[0]}`).toContain(m[1]);
      }
    }
  });

  it('a un fragment svg non vide (paths dans le viewBox 24×24)', () => {
    for (const d of ALL) expect(d.svg, d.id).toMatch(/<(path|circle|ellipse|rect|line|polyline|polygon|g)[\s>]/);
  });
});

describe('primitive <Icon>', () => {
  it('rend le fragment du registre dans un viewBox 24×24 (défaut md=18px)', () => {
    const html = renderToStaticMarkup(React.createElement(Icon, { id: 'action/attack' }));
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('width="18"');
    expect(html).toContain('class="icon"');
    expect(html).toContain('data-icon="action/attack"');
    expect(html).toContain('aria-hidden');
    // le contenu du registre est bien injecté
    expect(html).toContain(ICON_DEFS['action/attack'].svg.slice(0, 40));
  });

  it('`IconG` porte aussi l’id de son icône au DOM (`data-icon`)', () => {
    const html = renderToStaticMarkup(React.createElement('svg', null, React.createElement(IconG, { id: 'action/attack' })));
    expect(html).toContain('<g transform="translate(0,0) scale(1)" data-icon="action/attack"');
  });

  it('accepte les tailles nommées et numériques', () => {
    const sm = renderToStaticMarkup(React.createElement(Icon, { id: 'ui/wait', size: 'sm' }));
    expect(sm).toContain('width="14"');
    const lg = renderToStaticMarkup(React.createElement(Icon, { id: 'ui/wait', size: 'lg' }));
    expect(lg).toContain('width="24"');
    const px = renderToStaticMarkup(React.createElement(Icon, { id: 'ui/wait', size: 32 }));
    expect(px).toContain('width="32"');
  });

  it('jette sur un id inconnu en DEV (rien de silencieux)', () => {
    expect(() => renderToStaticMarkup(React.createElement(Icon, { id: 'nope/inconnu' }))).toThrow(/Icône inconnue/);
  });
});
