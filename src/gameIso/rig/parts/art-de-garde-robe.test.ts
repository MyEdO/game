import { describe, it, expect } from 'vitest';
import { gardeRobe } from '../../../data';
import { HEAD_DEFS } from './heads';
import { HAIRSTYLE_DEFS } from './hairstyles';

/**
 * Sens inverse du typage des defs (`HeadDef.tete: TeteId`, `HairstyleDef.coiffure: CoiffureId`, #3113) :
 * toute ligne `tete` ou `coiffure` de `garde-robe.json` a au moins un art SVG.
 */
describe('garde-robe.json : toute tête et toute coiffure de la donnée a un art', () => {
  const sansArt = (kind: 'tete' | 'coiffure', dessines: ReadonlySet<string>) =>
    gardeRobe.filter((e) => e.kind === kind && !dessines.has(e.id)).map((e) => e.id);

  it('tête', () => {
    expect(sansArt('tete', new Set(HEAD_DEFS.map((d) => d.tete)))).toEqual([]);
  });

  it('coiffure', () => {
    expect(sansArt('coiffure', new Set(HAIRSTYLE_DEFS.map((d) => d.coiffure)))).toEqual([]);
  });
});
