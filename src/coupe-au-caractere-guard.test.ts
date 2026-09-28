/**
 * GARDE — aucun texte coupé au caractère puis ellipsé sous `src/` (#1806, R-M2 de
 * `docs/plans/2026-08-16-spec-hud-combat.md`) : la coupe d'un texte ellipsé est `coupeAuMot`
 * (`src/lib/coupeAuMot.ts`). Tolérance zéro, sans registre ; tests compris.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { coupesAuCaractere } from '../scripts/guards/lib/coupeAuCaractere.mjs';

describe('coupe au caractère suivie d’une ellipse', () => {
  it('témoin : gabarit, concaténation, ternaire, `trimEnd`, ellipse en trois points — vus ; tableau et préfixe sans ellipse — non', () => {
    const texte = [
      'const a = `${s.slice(0, n)}…`;',
      "const b = s.substring(0, 12) + '...';",
      "const c = s.length > 9 ? `${s.slice(0, 9)}${s.length > 9 ? '…' : ''}` : s;",
      'const d = `${t.slice(0, 400).trimEnd()}…`;',
      "const e = (s.substr(0, 3)) + '…';",
      "const f = `${xs.slice(0, 3).join(', ')}…`;",
      'const g = s.slice(0, coupe).trimEnd();',
      "// `${s.slice(0, n)}…` en commentaire",
      "const h = '`${s.slice(0, n)}…`';",
    ].join('\n');
    expect(coupesAuCaractere([{ rel: 'temoin.ts', text: texte }])).toEqual(['temoin.ts:1', 'temoin.ts:2', 'temoin.ts:3', 'temoin.ts:4', 'temoin.ts:5']);
  });

  it('aucun site sous `src/`', () => {
    expect(coupesAuCaractere(readCorpus(['src'], { exts: ['.ts', '.tsx'], tests: true }))).toEqual([]);
  });
});
