import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RACINE, sourcesSuivies } from '../scripts/guards/lib/modulesFeuilles.mjs';
import { estFichierVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { lecturesDHote } from '../scripts/guards/lib/graphiesDHote.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';

/**
 * Garde de classe #1801 — le rendu sous win32 (`scripts/docs/lib/plateforme-win32.mjs`) ne simule
 * pas les lectures définies par `scripts/guards/lib/graphiesDHote.mjs` : une source qui en porte une
 * rendrait sous win32 la graphie de l'hôte.
 *
 * PÉRIMÈTRE : toute source JS/TS SUIVIE par git (`sourcesSuivies`) hors instruments Vitest
 * (`estFichierVitest`), que le rendu sous win32 ne joue pas.
 * Les cas plantés sont des CHAÎNES, et la garde lit l'AST, où une chaîne n'est pas du code : ce
 * fichier, instrument Vitest hors du balayage, ne porte aucune lecture d'hôte (cas « ce fichier ne
 * porte aucune lecture d’hôte »).
 */

const detecte = (source: string) => lecturesDHote(source).length > 0;

describe('garde de classe — aucune lecture d’hôte que le rendu sous win32 ne simule', () => {
  it('cas plantés : chaque forme de lecture d’`import.meta.dirname`/`filename` est détectée', () => {
    const variantes = [
      'const ici = import.meta.dirname',
      'const soi = import.meta.filename',
      'const soi = import.meta?.filename',
      'const ici = import.meta . dirname',
      "const soi = import.meta['filename']",
      'const ici = import.meta[`dirname`]',
      'const { dirname } = import.meta',
      'const { filename: soi, url } = import.meta',
      "const racine = join(import.meta.dirname, '..')",
      "const ici = import.meta?.['dirname']",
      'let ici\n({ dirname: ici } = import.meta)',
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : `__dirname` et `__filename` du chargeur CJS, dans un `.cjs` comme dans un `.cts`', () => {
    const variantes = [
      "const racine = path.join(__dirname, '..')",
      'const soi = __filename',
      'console.log(__dirname)',
      'module.exports = { ici: __dirname }',
    ];
    for (const v of variantes) {
      for (const chemin of ['source.cjs', 'source.cts']) expect(lecturesDHote(v, chemin), `${chemin} : ${v}`).not.toEqual([]);
    }
    expect(lecturesDHote("const a = 1\nconst ici = __dirname", 'source.cjs')).toEqual([expect.objectContaining({ ligne: 2 })]);
  });

  it('cas plantés : un NOM lié à `import.meta` lit de même, à sa ligne', () => {
    expect(lecturesDHote('const m = import.meta\nconst ici = m.dirname')).toEqual([expect.objectContaining({ ligne: 2 })]);
    expect(lecturesDHote('const m = import.meta\nconst { filename: f } = m')).toEqual([expect.objectContaining({ ligne: 2 })]);
    expect(lecturesDHote('let m\nm = import.meta\nconst n = m\nconst soi = n?.filename')).toEqual([
      expect.objectContaining({ ligne: 4 }),
    ]);
  });

  it('cas plantés : chaque acquisition de `path`/`url` hors hooks ESM est détectée', () => {
    const variantes = [
      "const path = require('path')",
      'const path = require("node:path")',
      "const { posix } = require('node:path/posix')",
      'const url = require(`node:url`)',
      "const path = createRequire(import.meta.url)('node:path')",
      "const url = createRequire(join(a, b))('url')",
      "const path = process.getBuiltinModule('node:path')",
      "const w = getBuiltinModule('path/win32')",
      "const path = require?.('path')",
      "const path = module.require('node:path')",
      "const url = process.getBuiltinModule?.('url')",
      "const path = process?.getBuiltinModule('path')",
      "const path = globalThis.process.getBuiltinModule('node:path/win32')",
      "const { join } = require('node:path')",
      "const url = module.createRequire(x)('node:url')",
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : un NOM lié à un chargeur acquiert de même, à sa ligne', () => {
    expect(lecturesDHote("const req = createRequire(import.meta.url)\nconst path = req('node:path')")).toEqual([
      expect.objectContaining({ ligne: 2 }),
    ]);
    expect(detecte("const charger = module.createRequire(x)\ncharger('url')")).toBe(true);
    const sources = [
      ['let r', 'r = createRequire(x)', "r('node:path')"],
      ["import { createRequire as cr } from 'node:module'", "cr(x)('path')"],
      ["import * as nodeModule from 'node:module'", "nodeModule.createRequire(x)('path')"],
      ['const r = createRequire(x)', 'const r2 = r', "r2('url')"],
      ['const charger = process.getBuiltinModule', "charger('node:path')"],
      ["const { getBuiltinModule: g } = await import('node:process')", "g('path')"],
    ];
    for (const lignes of sources) {
      expect(lecturesDHote(lignes.join('\n')), lignes.join(' ⏎ ')).toEqual([expect.objectContaining({ ligne: lignes.length })]);
    }
  });

  it('cas plantés : une lecture coupée par un saut de ligne est détectée, à sa première ligne', () => {
    expect(lecturesDHote('const a = 1\nconst ici = import.meta\n  .dirname')).toEqual([expect.objectContaining({ ligne: 2 })]);
    expect(lecturesDHote("const path = require(\n  'node:path',\n)")).toEqual([expect.objectContaining({ ligne: 1 })]);
    expect(lecturesDHote('const ici =\n  import.meta.dirname')).toEqual([expect.objectContaining({ ligne: 2 })]);
  });

  it('cas plantés : une clé ou un spécificateur ÉCHAPPÉ se lit décodé', () => {
    const variantes = [
      "const ici = import.meta['dir\\u006eame']",
      'const ici = import.meta[`dir\\u{6e}ame`]',
      "const path = require('pa\\x74h')",
      "const url = require('node:ur\\154')",
      'const soi = import.meta.file\\u006eame',
      "const ici = import.meta['dirnam\\e']",
      "const path = require('pat\\h')",
      'const ici = import.meta[`dirn\\ame`]',
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : `createRequire` de `node:module`, quelle que soit son acquisition', () => {
    const variantes = [
      "const M = require('node:module')\nM.createRequire(x)('path')",
      "const { createRequire: cr } = process.getBuiltinModule('module')\ncr(x)('url')",
      "(await import('node:module')).createRequire(x)('path')",
      "import * as m from 'node:module'\nm.default.createRequire(x)('path')",
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('une tranche qui se réaffecte sa propre tranche : le point fixe termine', () => {
    const sources = ["let args = process.argv.slice(2)\nwhile (args.length) args = args.slice(1)\nconst d = path.dirname(x)"];
    const module = pathToFileURL(join(RACINE, 'scripts/guards/lib/graphiesDHote.mjs')).href;
    const code = `import { lecturesDHote as l } from ${JSON.stringify(module)}\nconsole.log(JSON.stringify(${JSON.stringify(sources)}.map((s) => l(s))))`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 5000 });
    expect(r.signal, 'la garde ne rend pas de verdict sous 5 s').toBeNull();
    expect(JSON.parse(r.stdout)).toEqual([[]]);
  });

  it('cas plantés : un reste de déstructuration d’objet porte la base', () => {
    const sources = [
      'const { url, ...reste } = import.meta\nconst ici = reste.dirname',
      "const { ...m } = module\nm.require('path')",
      'let m\n({ ...m } = import.meta)\nconst ici = m.dirname',
    ];
    for (const v of sources) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : chaque forme d’expression du contrat mène à `import.meta` ou à un chargeur', () => {
    const variantes = [
      'const m = c ? import.meta : x\nconst ici = m.dirname',
      'const m = x ?? import.meta\nconst ici = m.dirname',
      'const m = x || import.meta\nconst ici = m.dirname',
      'const ici = (<any>import.meta).dirname',
      'const ici = (import.meta satisfies object).dirname',
      "const { ['dirname']: d } = import.meta",
      "let r\n({ getBuiltinModule: r = f } = process)\nr('path')",
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('contrôle négatif : ce que les hooks ESM couvrent, et ce qui n’est pas une lecture d’hôte', () => {
    const neutres = [
      "const ici = fileURLToPath(new URL('.', import.meta.url))",
      'if (import.meta.main) main()',
      "import path from 'node:path'",
      "const { posix } = await import('node:path')",
      "const ts = createRequire(import.meta.url)('typescript')",
      "const m = require('./path')",
      "const m = require('node:path-extra')",
      'const dirname = path.dirname(fichier)',
      'const { dirname } = path',
      "const x = config.require('path')",
      "const nom = import.meta.url.endsWith('filename')",
      'const m = import.meta\nconst u = m.url',
      "import { createRequire as cr } from 'node:module'\ncr(x)('typescript')",
      "const r = module.require\nr('./path')",
      "const lu = 'import.meta.dirname'",
      "spawnSync(process.execPath, ['-e', \"require('node:path')\"])",
      "const chemin = require.resolve('path')",
      "const r = outil.createRequire(x)\nr('path')",
      "(await import('node:url')).fileURLToPath(x)",
      'const o = { __dirname: 1 }',
      'const x = config.__filename',
    ];
    for (const n of neutres) expect(detecte(n), n).toBe(false);
  });

  it('cas planté : la même lecture CITÉE en commentaire est hors de portée', () => {
    const source = ['// import.meta.filename', "/* require('node:path') */"].join('\n');
    expect(lecturesDHote(source)).toEqual([]);
  });

  it('ce fichier ne porte aucune lecture d’hôte', () => {
    const rel = 'src/graphies-d-hote-guard.test.ts';
    expect(lecturesDHote(readFileSync(join(RACINE, rel), 'utf8'), rel)).toEqual([]);
  });

  it('aucune source suivie hors instruments ne porte une lecture d’hôte (tolérance ZÉRO)', { timeout: 60_000 }, () => {
    const suivies: string[] = sourcesSuivies().filter((rel: string) => !estFichierVitest(rel));
    expect(suivies.length, 'le listage des sources suivies est vide').toBeGreaterThan(1000);
    const offenders: string[] = [];
    const fichiers: { rel: string; text: string }[] = [];
    for (const rel of suivies) {
      let texte: string;
      try {
        texte = readFileSync(join(RACINE, rel), 'utf8');
      } catch {
        continue; // suivi mais supprimé de l'arbre : aucun code à lire
      }
      fichiers.push({ rel, text: texte });
    }
    for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(fichiers)) {
      for (const { ligne, extrait } of lecturesDHote(text, rel, sourceFile!)) offenders.push(`${rel}:${ligne} → ${extrait}`);
    }
    expect(
      offenders,
      `Lecture(s) d'hôte non simulée(s) sous win32 — \`fileURLToPath(new URL(…, import.meta.url))\` et \`import … from\` :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
