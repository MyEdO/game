import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotchGauge, type GaugeTone } from './NotchGauge';

const countOn = (html: string): number => (html.match(/data-on=""/g) ?? []).length;

describe('NotchGauge — crans, valeur, tons', () => {
  it('Coque (wounds) : 20/50 danger → 4/10 crans allumés, valeur affichée', () => {
    const html = renderToStaticMarkup(<NotchGauge label="Coque" value={20} max={50} tone="danger" />);
    expect(html).toContain('data-tone="danger"');
    expect(countOn(html)).toBe(4); // round(20/50 * 10)
    expect(html).toContain('20 / 50');
  });

  it('Moral (bande → ton par fonction) : 75/100 → 8/10 crans, ton warn dérivé', () => {
    const tone = (v: number): GaugeTone => (v >= 76 ? 'ok' : v >= 51 ? 'warn' : 'danger');
    const html = renderToStaticMarkup(<NotchGauge label="Moral" value={75} max={100} tone={tone} stacked />);
    expect(html).toContain('data-tone="warn"');
    expect(countOn(html)).toBe(8); // round(75/100 * 10)
    expect(html).toContain('data-stacked=""');
  });

  it('Surcharge de soute : seuils gravés (marks) + domaine à valeur > max', () => {
    const html = renderToStaticMarkup(
      <NotchGauge label="Soute" value={130} max={150} marks={[100, 120, 140]} tone="warn" format={(v) => `${v} %`} />,
    );
    expect((html.match(/notch-gauge__mark/g) ?? []).length).toBe(3);
    expect(html).toContain('data-mark="120"');
    expect(html).toContain('130 %');
  });

  it('Humeur de Manann : domaine à borne basse négative → fraction correcte', () => {
    // min=-15, max=15, value=0 → milieu → 5/10 crans allumés.
    const html = renderToStaticMarkup(<NotchGauge label="Manann" value={0} min={-15} max={15} />);
    expect(countOn(html)).toBe(5);
    expect(html).toContain('data-tone="neutre"');
  });
});
