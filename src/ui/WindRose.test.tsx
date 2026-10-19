import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WindRose } from './WindRose';
import { DIR8_ORDER, type Dir8 } from '../noyau/monde/dir8';

const DEG: Record<Dir8, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315 };

describe('WindRose — directions et forces', () => {
  it('les 8 directions sont mappées à leur angle horaire (rotation de la flèche)', () => {
    for (const dir of DIR8_ORDER) {
      const html = renderToStaticMarkup(<WindRose dir={dir} force="brise-fraiche" />);
      expect(html).toContain(`data-dir="${dir}"`);
      expect(html).toContain(`rotate(${DEG[dir]} 50 50)`);
    }
  });

  it('force → classe (data-force) et libellé affiché', () => {
    const html = renderToStaticMarkup(<WindRose dir="O" force="violente-tempete" />);
    expect(html).toContain('data-force="violente-tempete"');
    expect(html).toContain('Violente tempête');
  });

  it('cap du navire = second index optionnel (aiguille), taille sm', () => {
    const html = renderToStaticMarkup(<WindRose dir="N" force="calme-plat" heading="SE" size="sm" />);
    expect(html).toContain('wind-rose--sm');
    expect(html).toContain('data-heading="SE"');
    expect(html).toContain('wind-rose__heading');
  });

  it('sans cap : aucune aiguille de navire', () => {
    const html = renderToStaticMarkup(<WindRose dir="N" force="calme-plat" />);
    expect(html).not.toContain('wind-rose__heading');
  });
});
