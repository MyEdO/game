/**
 * La Difficulté par DÉFAUT a un nom (#1874) : `DIFFICULTE_PAR_DEFAUT` (`src/engine/types.ts`, LDB 12 l.166).
 * Aucun `'intermediaire'` posé en défaut dans `src/`, `hotes/` ni `scripts/`, tests compris
 * (`DEFAUT_DE_DIFFICULTE`, `scripts/guards/lib/difficulteParDefaut.mjs`). Sans stock ni exemption.
 */
import { describe, expect, it } from 'vitest';
import { constructionsReserveesDuCorpus, scanConstructionsReservees } from '../scripts/guards/lib/canonUnique.mjs';
import { DEFAUT_DE_DIFFICULTE } from '../scripts/guards/lib/difficulteParDefaut.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

const vu = (text: string) => scanConstructionsReservees({ rel: 'src/sonde.ts', text }, [DEFAUT_DE_DIFFICULTE]).map((t) => t.line);

describe('DEFAUT_DE_DIFFICULTE — le défaut d’une Difficulté s’écrit `DIFFICULTE_PAR_DEFAUT`', () => {
  it('aucun défaut littéral dans le corpus', () => {
    const corpus = [
      ...readCorpus(['src', 'hotes'], { tests: true }),
      ...readCorpus(['scripts'], { exts: ['.ts', '.mts', '.mjs'], tests: true }),
    ];
    expect(constructionsReserveesDuCorpus(corpus, [DEFAUT_DE_DIFFICULTE])).toEqual([]);
  }, 120_000);

  it('morsure : `??`, `||`, `??=`, paramètre, déstructuration, à travers parenthèses et assertion', () => {
    expect(vu([
      "const a = d ?? 'intermediaire';",
      "const b = d || 'intermediaire';",
      "x.d ??= 'intermediaire';",
      "function f(d: Difficulty = 'intermediaire') {}",
      "const { d = 'intermediaire' } = o;",
      "const c = d ?? ('intermediaire' as Difficulty);",
    ].join('\n'))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('une Difficulté fixée, une autre valeur ou la constante ne sont pas des défauts recopiés', () => {
    expect(vu([
      "const d: Difficulty = 'intermediaire';",
      "const t = { difficulty: 'intermediaire' };",
      "const e = d ?? 'facile';",
      'const f = d ?? DIFFICULTE_PAR_DEFAUT;',
      "const g = `d ?? 'intermediaire'`;",
    ].join('\n'))).toEqual([]);
  });
});
