import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ViewControls } from './ViewControls';
import { Icon } from './Icon';

const noop = () => {};

function renderControls(extra: Partial<React.ComponentProps<typeof ViewControls>> = {}) {
  return renderToStaticMarkup(
    <ViewControls
      zoom={1}
      onZoomIn={noop}
      onZoomOut={noop}
      onZoomReset={noop}
      onRotateLeft={noop}
      onRotateRight={noop}
      view="iso"
      onToggleView={noop}
      {...extra}
    />,
  );
}

function iconMarkup(id: React.ComponentProps<typeof Icon>['id']) {
  return renderToStaticMarkup(<Icon id={id} size="sm" />);
}

describe('ViewControls', () => {
  it('ne porte aucune bascule d’inspection : l’inspection est un geste sur l’entité (#1822)', () => {
    const html = renderControls({ onTogglePov: noop });
    expect(html).not.toMatch(/inspection/i);
    expect(html).not.toContain(iconMarkup('nav/identify'));
  });

  it('expose l’état pressé de la projection et du POV', () => {
    const html = renderControls({ view: 'top', pov: true, onTogglePov: noop });
    expect(html).toContain('aria-label="Vue isométrique" aria-pressed="true"');
    expect(html).toContain('aria-label="Vue normale (au-dessus)" aria-pressed="true"');
  });

  it('structure les commandes en trois groupes nommés', () => {
    const html = renderControls({ onTogglePov: noop });
    expect(html.match(/role="group"/g)?.length).toBe(3);
    expect(html).toContain('aria-label="Orientation"');
    expect(html).toContain('aria-label="Affichage"');
    expect(html).toContain('aria-label="Zoom"');
  });

  it('remplace tous les glyphes locaux par les icônes attendues', () => {
    const html = renderControls({ zoom: 1.25, onTogglePov: noop });
    for (const glyph of ['⟲', '⟳', '◇', '▦', '+', '−', '1×']) {
      expect(html).not.toContain(`>${glyph}<`);
    }
    for (const id of [
      'ui/rotate-left',
      'ui/rotate-right',
      'ui/projection-top',
      'ui/zoom-out',
      'ui/zoom-in',
      'ui/zoom-reset',
    ] as const) {
      expect(html).toContain(iconMarkup(id));
    }
  });

  it('affiche le zoom courant arrondi dans le groupe Zoom', () => {
    const html = renderControls({ zoom: 1.296 });
    expect(html).toContain('<output class="vc-zoom-value">130%</output>');
  });

  it('omet seulement le reset quand le zoom vaut 100 %', () => {
    const html = renderControls({ zoom: 1 });
    expect(html).toContain('<output class="vc-zoom-value">100%</output>');
    expect(html).not.toContain(iconMarkup('ui/zoom-reset'));
  });
});
