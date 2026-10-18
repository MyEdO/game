// Banc du mur `murs/interne` (#2724) : la config RÉELLE (`oxlint.config.mjs`) jouée par le lanceur Oxlint
// sur un arbre de fixtures, jamais une copie de la règle.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lintFixtures, selectionnerMessages } from './lint.testkit.mjs';
import { porteurDInterne } from './interneLint.mjs';

/** Les lignes signalées par `murs/interne`, par fichier de fixture, en ordre croissant. */
function lignesSignalees(fixtures) {
  const resultats = lintFixtures(fixtures);
  return Object.fromEntries(fixtures.map((f, i) => [
    f.filePath,
    selectionnerMessages(resultats[i], (m) => m.ruleId === 'murs/interne').map((m) => m.line).sort((x, y) => x - y),
  ]));
}

const ARBRE = [
  { filePath: 'src/zz/interne/a.ts', code: "export const a = 1;\nexport * from './b';\n" },
  { filePath: 'src/zz/interne/b.ts', code: 'export const b = 2;\n' },
  { filePath: 'src/zz/interne/x/interne/d.ts', code: 'export const d = 4;\n' },
  { filePath: 'src/zz/interne/x/f.ts', code: "import { d } from './interne/d';\nexport const f = d;\n" },
  { filePath: 'src/zz/interne/e.ts', code: "import { d } from './x/interne/d';\nexport const e = d;\n" },
  { filePath: 'src/zz/porte.ts', code: "export { a } from './interne/a';\nimport { b } from './interne/b';\nexport const p = b;\n" },
  { filePath: 'src/zz/enveloppe.ts', code: "import { a } from './interne/a';\nexport function lireA() { return a; }\n" },
  {
    filePath: 'src/zz/liaison.ts',
    code: [
      'export { a, a as a2 };',
      "import { a } from './interne/a';",
      "import * as ns from './interne/b';",
      'export default ns;',
      "import r = require('./interne/a');",
      'export { r };',
      "export import r2 = require('./interne/a');",
    ].join('\n') + '\n',
  },
  { filePath: 'src/zz/egal.ts', code: "import { a } from './interne/a';\nexport = a;\n" },
  { filePath: 'src/zz/sous/c.ts', code: "import { a } from '../interne/a';\nexport const c = a;\n" },
  { filePath: 'src/zz/fuite.ts', code: "export * from './interne/a';\n" },
  {
    filePath: 'src/yy/cousin.ts',
    code: [
      "import { a } from '../zz/interne/a';",
      "import type { b } from '../zz/interne/b';",
      "import { a as a2 } from '@/zz/interne/a';",
      "export const m = import('../zz/interne/b');",
      "export { b as b2 } from '../zz/interne/b';",
      "export type T = typeof import('../zz/interne/a');",
      "export const r = require('../zz/interne/a');",
      "import { a as a3 } from '../yy/../zz/interne/a';",
      'export const u = [a, a2, a3];',
      'export type B = typeof b;',
      "export const g = import(`../zz/interne/b`);",
      "import { p } from '../zz/porte';",
      'export const v = p;',
      "import a4 = require('../zz/interne/a');",
      "export const gl = import.meta.glob('../zz/interne/*.ts');",
      "export const gl2 = import.meta.glob(['../zz/sous/*.ts', '/src/zz/interne/**', '!../zz/interne/b.ts']);",
      "export const ia = vi.importActual('../zz/interne/a');",
      "export const im = vi.importMock('../zz/interne/a');",
      "vi.mock('../zz/interne/a');",
      "vi.doMock('../zz/interne/a');",
      "vi.unmock('../zz/interne/a');",
      "export const cr = createRequire(import.meta.url)('../zz/interne/a');",
      'export const req = createRequire(import.meta.url);',
      "export const cr2 = req('../zz/interne/a');",
      'export const calcule = import(`../zz/interne/${p}`);',
      "export const mr = module.require('../zz/interne/a');",
      'let req2;',
      'req2 = createRequire(import.meta.url);',
      "export const cr3 = req2('../zz/interne/a');",
      "export const cr4 = tot('../zz/interne/a');",
      'const tot = createRequire(import.meta.url);',
      "vi.doUnmock('../zz/interne/a');",
      "vitest.mock('../zz/interne/a');",
      "export const cr5 = module.createRequire(import.meta.url)('../zz/interne/a');",
      "export const gl3 = import.meta.glob(['../zz/sous/*.ts', '!../zz/interne/b.ts']);",
      "export const joker = import.meta.glob('/src/zz/**/*.ts');",
      "export const autre = lire('../zz/interne/a');",
    ].join('\n') + '\n',
  },
  { filePath: 'src/yy/cousin.test.ts', code: "import { a } from '../zz/interne/a';\nexport const t = a;\n" },
  { filePath: 'src/zz/interne/a.test.ts', code: "import { a } from './a';\nexport const t = a;\n" },
  { filePath: 'src/yy/non-stage.ts', code: "import { w } from '../ww/interne/w';\nimport { x } from '../ww/interne';\nexport const n = [w, x];\n" },
  { filePath: 'scripts/zz/outil.mjs', code: "import { a } from '../../src/zz/interne/a.ts';\nexport const o = a;\n" },
];

describe('murs/interne (#2724) — un fichier sous X/interne/ n’est importable que depuis X/', () => {
  const signale = lignesSignalees(ARBRE);

  it('admet le dossier porteur, ses descendants et l’interne lui-même', () => {
    for (const f of ['src/zz/interne/a.ts', 'src/zz/interne/x/f.ts', 'src/zz/sous/c.ts']) {
      assert.deepEqual(signale[f], [], f);
    }
  });

  it('refuse la réexportation d’un interne hors de son dossier `interne/` : la porte expose sa propre fonction', () => {
    assert.deepEqual(signale['src/zz/porte.ts'], [1]);
    assert.deepEqual(signale['src/zz/enveloppe.ts'], []);
  });

  it('refuse `export { x }`, `export default x`, `export = x` et `export import` d’une liaison importée d’un interne', () => {
    assert.deepEqual(signale['src/zz/liaison.ts'], [1, 1, 4, 6, 7]);
    assert.deepEqual(signale['src/zz/egal.ts'], [2]);
  });

  it('refuse le cousin sous toutes les formes d’import, alias `@/` et `../` détourné compris', () => {
    assert.deepEqual(signale['src/yy/cousin.ts'].filter((l) => l <= 13), [1, 2, 3, 4, 5, 6, 7, 8, 11]);
  });

  it('refuse le cousin sous `import = require`, `import.meta.glob`, les moqueurs de Vitest et `createRequire` ; le calculé passe', () => {
    assert.deepEqual(signale['src/yy/cousin.ts'].filter((l) => l > 13 && l <= 25), [14, 15, 16, 17, 18, 19, 20, 21, 22, 24]);
  });

  it('refuse `module.require`, la liaison `createRequire` assignée ou appelée avant sa déclaration, `vi.doUnmock`, `vitest.*`, `module.createRequire` ; le motif nié, le joker et un appel quelconque passent', () => {
    assert.deepEqual(signale['src/yy/cousin.ts'].filter((l) => l > 25), [26, 29, 30, 32, 33, 34]);
  });

  it('refuse `export *` d’un interne hors de ce dossier interne', () => {
    assert.deepEqual(signale['src/zz/fuite.ts'], [1]);
  });

  it('juge le DERNIER segment `interne` : un interne imbriqué est fermé à l’interne parent', () => {
    assert.deepEqual(signale['src/zz/interne/e.ts'], [1]);
  });

  it('juge `scripts/` comme `src/`', () => {
    assert.deepEqual(signale['scripts/zz/outil.mjs'], [1]);
  });

  it('juge un test comme la production : son banc vit sous le dossier porteur', () => {
    assert.deepEqual(signale['src/yy/cousin.test.ts'], [1]);
    assert.deepEqual(signale['src/zz/interne/a.test.ts'], []);
  });

  it('juge sans lire le disque : une cible absente (pre-commit, fichier non stagé) et un dossier `interne` nu', () => {
    assert.deepEqual(signale['src/yy/non-stage.ts'], [1, 2]);
  });

  it('cas fondateur : le résumeur d’atelier importé depuis une surface joueur rougit (#495)', () => {
    const surface = { filePath: 'src/ui/compendium/__sonde-interne.ts', code: "import { opSummary } from '../editor/interne/resumeDOp';\nexport const s = opSummary;\n" };
    assert.deepEqual(lignesSignalees([surface])[surface.filePath], [1]);
  });

  it('porteurDInterne : parent du dernier segment, jamais le nom de fichier', () => {
    assert.equal(porteurDInterne('/r/src/a/interne/b/interne/c.ts'), '/r/src/a/interne/b');
    assert.equal(porteurDInterne('/r/src/a/interne/index.ts'), '/r/src/a');
    assert.equal(porteurDInterne('/r/src/a/interne.ts'), null);
    assert.equal(porteurDInterne('/r/src/a/interne'), '/r/src/a');
  });
});
