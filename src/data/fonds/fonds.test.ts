/**
 * Le registre des fonds d'ambiance (`src/data/fonds/defs`) : ses dessins, et l'espace `vocabulaire:fonds`
 * (`src/data/schemas/grammaire/vocabulaires.ts`, #2968 P-art), sa projection : mêmes ids, mêmes libellés, même ordre.
 */
import { describe, expect, it } from 'vitest';
import { FOND_DEFS } from '.';
import { VOCABULAIRES } from '../schemas/grammaire/vocabulaires';
import { IDS_PAR_ESPACE } from '../schemas/_ids.generated';

describe('le registre des fonds d’ambiance', () => {
  it('le vocabulaire des fonds porte ses ids et ses libellés', () => {
    expect(FOND_DEFS.length).toBeGreaterThan(0);
    expect(VOCABULAIRES.fonds).toEqual(Object.fromEntries(FOND_DEFS.map((f) => [f.id, f.label])));
  });

  it('l’index des ids porte l’espace `vocabulaire:fonds`, les ids du registre dans son ordre', () => {
    expect(IDS_PAR_ESPACE['vocabulaire:fonds']).toEqual(FOND_DEFS.map((f) => f.id));
  });

  it('aucun dessin ne porte de couleur en dur : `fill` et `stroke` nomment un jeton `var(--…)`', () => {
    for (const f of FOND_DEFS) {
      expect(f.svg, f.id).toMatch(/<(path|circle|ellipse|rect|line|polyline|polygon|g)[\s>]/);
      for (const m of f.svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(m[1], `${f.id} : ${m[0]}`).toMatch(/^(none|var\(--[a-z0-9-]+\))$/);
    }
  });
});
