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

  /** La frontière de la garde est une DONNÉE : chaque forme, son verdict (`[2]` vue, `[]` non vue ou
   *  HORS DE PORTÉE, `CONSTRUCTION_DE_PROGRAMME`, JSDoc). */
  const FORMES: readonly (readonly [string, string, string, number[]])[] = [
    ['vue', 'import nommé renommé', "import { createProgram as fab } from 'typescript';", 'fab([], {});'],
    ['vue', 'import d’espace de noms', "import * as tsc from 'typescript';", 'tsc.createProgram([], {});'],
    ['vue', 'fabrique de LanguageService', "import ts from 'typescript';", 'ts.createLanguageService(hote);'],
    ['vue', 'fabrique de programme de construction', "import ts from 'typescript';", 'ts.createSemanticDiagnosticsBuilderProgram([], {});'],
    ['non vue', 'homonyme local', 'function createProgram() { return 1; }', 'createProgram();'],
    ['non vue', 'membre d’un autre objet', "import ts from 'typescript';", 'metier.createProgram([], {});'],
    ['non vue', 'import nommé d’un autre module', "import { createProgram } from './metier';", 'createProgram([], {});'],
    ['hors de portée', 'accès calculé', "import ts from 'typescript';", "ts['createProgram']([], {});"],
    ['hors de portée', 'déstructuration renommée', "import ts from 'typescript';", 'const { createProgram: fab } = ts; fab([], {});'],
    ['hors de portée', 'alias de membre', "import ts from 'typescript';", 'const creer = ts.createProgram; creer([], {});'],
    ['hors de portée', 'compilateur reçu en paramètre', 'export const f = (compilateur: C) =>', '  compilateur.createProgram([], {});'],
    ['hors de portée', '`require`', "const tsr = require('typescript');", 'tsr.createProgram([], {});'],
    ['hors de portée', '`import()` dynamique', "const tsd = await import('typescript');", 'tsd.createProgram([], {});'],
  ].map(([verdict, forme, tete, appel]) => [verdict, forme, `${tete}\n${appel}`, verdict === 'vue' ? [2] : []] as const);

  it.each(FORMES)('frontière — %s : %s', (_verdict, _forme, texte, attendu) => {
    expect(lignes(texte)).toEqual(attendu);
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
