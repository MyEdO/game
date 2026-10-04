/**
 * GARDE — un `ts.Program` ne se construit que dans ses fabriques partagées (#1806,
 * `scripts/guards/lib/tsProgram.mjs`) : une API native hors de ce FOYER est une recopie.
 * Périmètre des gardes (`corpusDesGardes`), tests compris ; tolérance zéro, sans registre.
 */
import { describe, it, expect } from 'vitest';
import {
  CONSTRUCTION_DE_PROGRAMME, constructionsReserveesDuCorpus, scanConstructionsReservees,
} from '../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import * as native from 'typescript/unstable/ast';
import { origineImportee } from '../scripts/guards/lib/canonUnique.mjs';

const PROGRAMME = { ...CONSTRUCTION_DE_PROGRAMME, foyer: 'scripts/guards/lib/tsProgram.mjs' };
const EXPORT_AST = {
  nom: 'EXPORT_AST_NATIF',
  indice: (texte: string) => texte.includes('typescript/unstable/ast'),
  reconnait: (n: native.Node, sf: native.SourceFile) => {
    if (!native.isPropertyAccessExpression(n) && !native.isElementAccessExpression(n)) return null;
    const origine = origineImportee(n, sf);
    return origine?.module === 'typescript/unstable/ast' && !Object.prototype.hasOwnProperty.call(native, origine.nom)
      ? `Export AST natif absent : ${origine.nom}` : null;
  },
};
const lignes = (text: string, rel = 'src/temoin.test.ts') =>
  scanConstructionsReservees({ rel, text }, [PROGRAMME]).map((t) => t.line);

describe('construction d’un `ts.Program` hors de `tsProgram.mjs`', () => {
  it('exports AST natifs : membre absent refusé, alias suivi et homonyme local neutre', () => {
    const scan = (text: string) => scanConstructionsReservees({ rel: 'src/native.test.ts', text }, [EXPORT_AST]);
    expect(scan("import * as tsModule from 'typescript/unstable/ast'; const ts=tsModule; ts.nativeUnknownMember();")).toHaveLength(1);
    expect(scan("import * as ts from 'typescript/unstable/ast'; ts.isIdentifier(node);")).toEqual([]);
    expect(scan("import * as ts from 'typescript/unstable/ast'; function f(ts: unknown) { ts.nativeUnknownMember(); }")).toEqual([]);
  });
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
    ['vue', 'API native renommée', "import { API as Native } from 'typescript/unstable/sync';", 'new Native();'],
    ['vue', 'API native alias local', "import { API } from 'typescript/unstable/sync';", 'const Native = API; new Native();'],
    ['vue', 'API native alias affecté', "import { API } from 'typescript/unstable/sync';", 'let Native; Native = API; new Native();'],
    ['vue', 'API native require destructuré', "const { API: Native } = require('typescript/unstable/sync');", 'new Native();'],
    ['non vue', 'API métier', "import { API } from './metier';", 'new API();'],
    ['non vue', 'paramètre masquant API', "import { API } from 'typescript/unstable/sync';", 'function f(API: unknown) { return new API(); }'],
    ['non vue', 'fonction masquant API', "import { API } from 'typescript/unstable/sync';", 'function f() { function API() {} return new API(); }'],
    ['non vue', 'classe masquant API', "import { API } from 'typescript/unstable/sync';", 'function f() { class API {} return new API(); }'],
    ['vue', 'import nommé renommé', "import { createProgram as fab } from 'typescript';", 'fab([], {});'],
    ['vue', 'import d’espace de noms', "import * as tsc from 'typescript';", 'tsc.createProgram([], {});'],
    ['vue', 'fabrique de LanguageService', "import ts from 'typescript';", 'ts.createLanguageService(hote);'],
    ['vue', 'fabrique de programme de construction', "import ts from 'typescript';", 'ts.createSemanticDiagnosticsBuilderProgram([], {});'],
    ['non vue', 'homonyme local', 'function createProgram() { return 1; }', 'createProgram();'],
    ['non vue', 'membre d’un autre objet', "import ts from 'typescript';", 'metier.createProgram([], {});'],
    ['non vue', 'import nommé d’un autre module', "import { createProgram } from './metier';", 'createProgram([], {});'],
    ['vue', 'accès calculé', "import ts from 'typescript';", "ts['createProgram']([], {});"],
    ['vue', 'déstructuration renommée', "import ts from 'typescript';", 'const { createProgram: fab } = ts; fab([], {});'],
    ['vue', 'alias de membre', "import ts from 'typescript';", 'const creer = ts.createProgram; creer([], {});'],
    ['hors de portée', 'compilateur reçu en paramètre', 'export const f = (compilateur: C) =>', '  compilateur.createProgram([], {});'],
    ['vue', '`require`', "const tsr = require('typescript');", 'tsr.createProgram([], {});'],
    ['vue', '`import()` dynamique', "const tsd = await import('typescript');", 'tsd.createProgram([], {});'],
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
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [PROGRAMME, EXPORT_AST])).toEqual([]);
  });
});
