/**
 * Calibration de l'ombrage : `shade(base, SIDE_N)` doit reproduire (à ±3/canal) la face N pré-ombrée
 * de l'iso ACTUEL, à partir de la seule couleur de base (face E/éclairée). C'est la garantie de
 * NON-RÉGRESSION visuelle du passage « palette pré-ombrée → base + shade() » (Phase 1+).
 */
import { describe, it, expect } from 'vitest';
import { shade, mix, SIDE_N, SIDE_LIT, POST_CAP, POST_BASE } from './ombrage';

/** Bases (face E/éclairée) → face N (ombre) telles que codées aujourd'hui dans walls.ts::houseWallIso. */
const WOOD_LIT_TO_N: [string, string][] = [
  ['#6e5940', '#5d4c36'], // face
  ['#594732', '#4b3d2b'], // inset
  ['#7c6647', '#6b573e'], // frame
  ['#917a58', '#806b4b'], // cap
  ['#473829', '#3c3022'], // skirt
];

function channels(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function near(a: string, b: string, tol = 3): boolean {
  const ca = channels(a);
  const cb = channels(b);
  return ca.every((v, i) => Math.abs(v - cb[i]) <= tol);
}

describe('shade — calibration ombre bois iso', () => {
  it.each(WOOD_LIT_TO_N)('shade(%s, SIDE_N) ≈ %s (face N actuelle)', (lit, n) => {
    expect(near(shade(lit, SIDE_N), n), `${lit}×SIDE_N = ${shade(lit, SIDE_N)}, attendu ~${n}`).toBe(true);
  });

  it('SIDE_LIT est l’identité', () => {
    for (const [lit] of WOOD_LIT_TO_N) expect(shade(lit, SIDE_LIT)).toBe(lit);
  });

  it('poteau : chapiteau clair, socle sombre (calibrés sur walls.ts::post)', () => {
    // post body #352b1f → chapiteau #5b4a35, socle #241c12 (valeurs iso actuelles).
    expect(near(shade('#352b1f', POST_CAP), '#5b4a35', 4)).toBe(true);
    expect(near(shade('#352b1f', POST_BASE), '#241c12', 4)).toBe(true);
  });

  it('un non-hex (var CSS de chrome UI) passe tel quel', () => {
    expect(shade('var(--combat-gold)', SIDE_N)).toBe('var(--combat-gold)');
  });

  it('shade clampe et ne déborde pas', () => {
    expect(shade('#ffffff', 2)).toBe('#ffffff');
    expect(shade('#000000', 0.5)).toBe('#000000');
  });

  it('mix interpole les extrêmes et le milieu', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
