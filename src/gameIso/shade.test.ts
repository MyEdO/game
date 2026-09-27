/**
 * Calibration de l'ombrage : `shade(base, SIDE_N)` doit reproduire (à ±3/canal) la face N pré-ombrée
 * de l'iso ACTUEL, à partir de la seule couleur de base (face E/éclairée). C'est la garantie de
 * NON-RÉGRESSION visuelle du passage « palette pré-ombrée → base + shade() » (Phase 1+).
 */
import { describe, it, expect } from 'vitest';
import { shade, tonsDArete, SIDE_N, SIDE_LIT, POST_CAP, POST_BASE } from './shade';
import { distanceTeinte, mix, parseHex, SEUIL_TEINTES_CONTIGUES } from '../data/couleur';

/** Bases (face E/éclairée) → face N (ombre) telles que codées aujourd'hui dans walls.ts::houseWallIso. */
const WOOD_LIT_TO_N: [string, string][] = [
  ['#6e5940', '#5d4c36'], // face
  ['#594732', '#4b3d2b'], // inset
  ['#7c6647', '#6b573e'], // frame
  ['#917a58', '#806b4b'], // cap
  ['#473829', '#3c3022'], // skirt
];

function near(a: string, b: string, tol = 3): boolean {
  const ca = parseHex(a)!;
  const cb = parseHex(b)!;
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

describe('tonsDArete — le cœur est la base à l’identique, le bord poussé vers le pôle lointain au double du plancher des teintes contiguës', () => {
  /** Échantillon DENSE du cube RVB : 16 niveaux par canal (0, 17, … 255), 4 096 bases. */
  const NIVEAUX = Array.from({ length: 16 }, (_, i) => i * 17);
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  const ECHANTILLON = NIVEAUX.flatMap((r) => NIVEAUX.flatMap((g) => NIVEAUX.map((b) => hex(r, g, b))));

  it('pour toute base : cœur = base à l’identique, cœur ⇄ bord ≥ 2 × SEUIL_TEINTES_CONTIGUES, le bord du côté du pôle le plus lointain, canal par canal', () => {
    const fautes: string[] = [];
    for (const base of ECHANTILLON) {
      const { coeur, bord } = tonsDArete(base);
      if (coeur !== base) fautes.push(`${base} : cœur ${coeur}`);
      if (distanceTeinte(coeur, bord) < 2 * SEUIL_TEINTES_CONTIGUES) fautes.push(`${base} : ${coeur} ⇄ ${bord}`);
      const versNoir = distanceTeinte(base, '#000000') >= distanceTeinte(base, '#ffffff');
      const [b, o] = [base, bord].map((x) => parseHex(x)!);
      if (b.some((v, i) => (versNoir ? o[i] > v : o[i] < v))) fautes.push(`${base} : bord ${bord} hors du chemin vers le pôle lointain`);
    }
    expect(fautes).toEqual([]);
  });

  it('pour toute base et tout fond de l’échantillon, l’un des deux tons tient SEUIL_TEINTES_CONTIGUES du fond', () => {
    const fonds = ECHANTILLON.filter((_, i) => i % 7 === 0);
    const sous: string[] = [];
    for (const base of ECHANTILLON) {
      const { coeur, bord } = tonsDArete(base);
      for (const fond of fonds)
        if (Math.max(distanceTeinte(coeur, fond), distanceTeinte(bord, fond)) < SEUIL_TEINTES_CONTIGUES) sous.push(`${base} sur ${fond}`);
    }
    expect(sous).toEqual([]);
  });

  it('une base non hexadécimale est refusée', () => {
    expect(() => tonsDArete('var(--pierre)')).toThrow(/rrggbb/);
  });
});
