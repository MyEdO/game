/**
 * GARDE — un `ts.Program` ne se construit que dans ses fabriques partagées (#1806,
 * `scripts/guards/lib/tsProgram.mjs`, en-tête) : `create*Program` hors de ce FOYER est une recopie.
 * Périmètre des gardes (`corpusDesGardes`), tests compris ; tolérance zéro, sans registre.
 */
import { describe, it, expect } from 'vitest';
import {
  CONSTRUCTION_DE_PROGRAMME, constructionsReserveesDuCorpus, scanConstructionsReservees,
} from '../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../scripts/guards/lib/commentPoison.mjs';

const PROGRAMME = { ...CONSTRUCTION_DE_PROGRAMME, foyer: 'scripts/guards/lib/tsProgram.mjs' };
const lignes = (text: string, rel = 'src/temoin.test.ts') =>
  scanConstructionsReservees({ rel, text }, [PROGRAMME]).map((t) => t.line);

describe('construction d’un `ts.Program` hors de `tsProgram.mjs`', () => {
  it('témoin : appel membre, appel nu, fabriques incrémentale et de veille — vus ; texte d’un littéral et nom seul — non', () => {
    const texte = [
      "import ts, { createProgram } from 'typescript';",
      'const a = ts.createProgram({ rootNames: [], options: {} });',
      'const b = createProgram([], {});',
      'const c = ts.createIncrementalProgram({ rootNames: [], options: {} });',
      'const d = ts.createWatchProgram(hote);',
      "const e = 'ts.createProgram({ rootNames: [], options: {} })';",
      'const f = `export const DIRECT = ts.createProgram({ rootNames: [], options: {} });`;',
      "const g = ['createProgram'];",
      'const h = ts.createSourceFile(n, t, ts.ScriptTarget.Latest);',
    ].join('\n');
    expect(lignes(texte)).toEqual([2, 3, 4, 5]);
  });

  it('le FOYER seul est hors de la garde : son texte, sous un autre chemin, est vu', () => {
    const [foyer] = corpusDesGardes().filter(({ rel }) => rel === PROGRAMME.foyer);
    expect(foyer, 'le foyer existe').toBeTruthy();
    expect(lignes(foyer.text, PROGRAMME.foyer)).toEqual([]);
    expect(lignes(foyer.text, 'scripts/copie.mjs').length).toBeGreaterThan(0);
  });

  it('aucun site sous `src/` ni `scripts/`', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [PROGRAMME])).toEqual([]);
  });
});
