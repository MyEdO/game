import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { hasInlineSourceRef } from '../../scripts/guards/lib/sourceRefInline.mjs';

/**
 * Garde-fou « réf de source `{book,page}` réinventée » (#281, F20/V10 du programme structurel
 * #276). `z.strictObject({ book: z.string(), page: z.number() })` réinvente `sourceRefSchema`
 * (`src/data/schemas/grammaire/valeurs.ts`) — importer `sourceRefSchema` à la place. Tolérance ZÉRO
 * (bloquant).
 *
 * `grammaire/valeurs.ts` HORS SCAN : c'est le foyer de la primitive, sa définition EST le motif.
 */

const SCAN_DIR = 'src/data/schemas';
const EXCLUDED = (rel: string) => rel === 'src/data/schemas/grammaire/valeurs.ts';

describe('garde-fou « sourceRefSchema » — réf de source `{book,page}` réinventée (#281)', () => {
  it('aucune def zod hors `grammaire/valeurs.ts` ne réinvente `{book:string, page:number}`', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus([SCAN_DIR], { tests: true })) {
      if (EXCLUDED(rel)) continue;
      if (hasInlineSourceRef(rel, text)) offenders.push(rel);
    }
    expect(
      offenders,
      `Réf de source {book,page} réinventée inline — importer sourceRefSchema (src/data/schemas/grammaire/valeurs.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
