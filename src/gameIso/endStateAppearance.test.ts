import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { END_STATE_APPEARANCE, applyEndStateColor, endStateFilter } from './endStateAppearance';

const CAS = [
  ['mort', 0.85, 0, 0.6],
  ['inconscient', 0.85, 0, 0.6],
  ['rendu', 0, 0, 0.85],
  ['hors-combat', 0.75, 0.25, 0.6],
] as const;

describe('allure commune des états de fin', () => {
  it.each(CAS)('%s produit la désaturation, le sépia et l’opacité attendus', (state, desaturation, sepia, opacity) => {
    expect(END_STATE_APPEARANCE[state]).toEqual({ desaturation, sepia, opacity });
    expect(endStateFilter(state)).toBe(`grayscale(${desaturation}) sepia(${sepia})`);
  });

  it('le gris de mort est calculé par luminance puis assombri dans l’espace sRGB', () => {
    const color = applyEndStateColor(new Color('#ff0000'), 'mort').convertLinearToSRGB();
    const pasSrgb8Bits = 1 / 255;
    expect(Math.abs(color.r - 0.198426)).toBeLessThan(pasSrgb8Bits);
    expect(Math.abs(color.g - 0.108426)).toBeLessThan(pasSrgb8Bits);
    expect(Math.abs(color.b - 0.108426)).toBeLessThan(pasSrgb8Bits);
  });

  it('la reddition reste colorée et atténue les trois canaux sRGB du même coefficient', () => {
    const color = new Color('#2080ff').convertLinearToSRGB();
    const avant = color.clone();
    applyEndStateColor(color.convertSRGBToLinear(), 'rendu').convertLinearToSRGB();
    expect(Math.abs(color.r / avant.r - 0.85)).toBeLessThan(1e-3);
    expect(Math.abs(color.g / avant.g - 0.85)).toBeLessThan(1e-3);
    expect(Math.abs(color.b / avant.b - 0.85)).toBeLessThan(1e-3);
    expect(color.b - color.r).toBeGreaterThan(0.7);
  });

  it('le hors-combat réchauffe une couleur neutre par le sépia', () => {
    const color = applyEndStateColor(new Color('#808080'), 'hors-combat').convertLinearToSRGB();
    expect(color.r).toBeGreaterThan(color.g);
    expect(color.g).toBeGreaterThan(color.b);
  });
});
