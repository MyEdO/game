import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RACINE, sourcesSuivies } from '../scripts/guards/lib/modulesFeuilles.mjs';
import { detectionsDePointDEntree } from '../scripts/guards/lib/pointDEntree.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';

/**
 * Garde de classe #1801 — un module sait s'il est le point d'entrée du processus par
 * `import.meta.main`, jamais par une détection écrite à la main (`scripts/guards/lib/pointDEntree.mjs`
 * en porte la définition structurelle, sans liste d'exception par fichier).
 *
 * PÉRIMÈTRE : toute source JS/TS SUIVIE par git (`sourcesSuivies`), racine et tests compris.
 * Les cas plantés sont des CHAÎNES, et la garde lit l'AST, où une chaîne n'est pas du code : ce
 * fichier est balayé comme le reste du périmètre, sans détection.
 */

const ARGV = 'process.argv';
const URL_DU_MODULE = 'import.meta.url';
const FICHIER_DU_MODULE = 'import.meta.filename';
const PROCESS = "'node:process'";
const REQUIRE_PROCESS = `require(${PROCESS})`;
const ARGV_GLOBAL = `globalThis.${ARGV}`;
const MODULE_PARENT = 'module.parent';

const detecte = (source: string) => detectionsDePointDEntree(source).length > 0;

describe('garde de classe — le point d’entrée se lit à import.meta.main', () => {
  it('cas plantés : chaque variante écrite à la main est détectée', () => {
    const variantes = [
      `const principal = ${ARGV}[1] && resolve(${ARGV}[1]) === fileURLToPath(${URL_DU_MODULE})`,
      `if (${ARGV}[1] && resolve(${ARGV}[1]) === resolve(fileURLToPath(${URL_DU_MODULE}))) main()`,
      `if (${URL_DU_MODULE} === pathToFileURL(${ARGV}[1]).href) {`,
      `if (fileURLToPath(${URL_DU_MODULE}) === ${ARGV}[1])`,
      `const principal = ${ARGV}[1] && ${ARGV}[1].endsWith('reconcile.mjs')`,
      `if (${URL_DU_MODULE} === \`file://\${join(process.cwd(), 'scripts/x.mjs')}\`) {`,
      `if (${ARGV}?.[1]?.endsWith('x.mjs')) main()`,
      `if (${ARGV}.at(1) === ${FICHIER_DU_MODULE}) main()`,
      `if (${ARGV}.includes(${FICHIER_DU_MODULE})) main()`,
      `if (resolve(${ARGV}.slice(1)[0]) === soi) main()`,
      'if (require.main === module) main()',
      'if (process.mainModule) main()',
      `const [, lance] = ${ARGV}`,
      `const lance = ${ARGV}[1] ?? ''`,
      // Un ALIAS d'`import.meta.main` : un second terme pour la même décision.
      'const principal = import.meta.main',
      'export const lance = import.meta.main',
      // Toute LECTURE du script lancé, même hors comparaison : un message d'usage la lit aussi.
      `\`Usage : node \${${ARGV}[1]} <dossier>\\n\``,
      `console.log(\`usage : node \${basename(${ARGV}[1])} <x>\`)`,
      `'process.stdout.write(JSON.stringify({ entree: ' + ${ARGV}[1] + ' }))'`,
      `const cible = resolve(${ARGV}[1] === undefined ? '.' : 'x')`,
      `if (${ARGV_GLOBAL}[1] === soi) main()`,
      `if (global.${ARGV}.at(1) === soi) main()`,
      "if (process['argv'][1] === soi) main()",
      'if (process["argv"]?.[1] === soi) main()',
      `if (${REQUIRE_PROCESS}.argv[1] === soi) main()`,
      `if (resolve(${ARGV}.slice(1, 2)[0]) === soi) main()`,
      `if (${ARGV}.slice(1).shift() === soi) main()`,
      `const [lance] = ${ARGV}.slice(1)`,
      `if (!${MODULE_PARENT}) main()`,
      `module.exports = ${MODULE_PARENT} ? api : main()`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : l’élément 1 d’`argv` lu par chaînage optionnel, crochets, tranche ou déstructuration', () => {
    const variantes = [
      `if (${ARGV}?.at(1) === soi) main()`,
      `if (${ARGV}.at?.(1) === soi) main()`,
      `if (${ARGV}.slice(1)?.shift() === soi) main()`,
      `if (${ARGV}.slice(1).at(0) === soi) main()`,
      `if (${ARGV}.slice(0).slice(1)[0] === soi) main()`,
      `if (process?.argv?.[1] === soi) main()`,
      `if (globalThis?.${ARGV}[1] === soi) main()`,
      `if (global['process'].argv[1] === soi) main()`,
      `if (globalThis['process']?.['argv']?.at(1) === soi) main()`,
      `if (require?.(${PROCESS}).argv[1] === soi) main()`,
      "if (require('process').argv[1] === soi) main()",
      `if ((${ARGV} as string[])[1] === soi) main()`,
      `if (${ARGV}![1] === soi) main()`,
      `const lance = (await import(${PROCESS})).argv[1]`,
      `const [noeud, lance] = ${ARGV}`,
      `const { 1: lance } = ${ARGV}`,
      `const [lance] = ${ARGV}.slice(1, 2)`,
      `function f([, lance] = ${ARGV}) { return lance }`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : un NOM lié à `argv` ou à `process` lit le même script lancé', () => {
    const sources = [
      [`import { argv } from ${PROCESS}`, `if (argv[1] && resolve(argv[1]) === soi) {`],
      [`import { argv as a } from ${PROCESS}`, 'if (a[1] === soi) main()'],
      [`const a = ${ARGV}`, 'if (a[1] === soi) main()'],
      [`const { argv: [, lance] } = process`, 'if (lance === soi) main()'],
      [`import proc from ${PROCESS}`, 'if (proc.argv[1] === soi) main()'],
      [`import * as proc from ${PROCESS}`, 'if (proc.argv.at(1) === soi) main()'],
      [`const { argv } = ${REQUIRE_PROCESS}`, 'if (argv[1] === soi) main()'],
      [`const { argv: [, lance] } = ${REQUIRE_PROCESS}`, 'if (lance === soi) main()'],
      [`const a = ${ARGV}, b = 2`, 'if (a[1] === soi) main()'],
      ['let a', "a = process['argv']", 'if (a[1] === soi) main()'],
      [`const proc = ${REQUIRE_PROCESS}`, 'if (proc.argv[1] === soi) main()'],
      ['const proc = globalThis.process', 'if (proc.argv[1] === soi) main()'],
      // Affectation séparée, alias d'alias, tranche liée, déstructuration en affectation.
      ['let r', `r = ${ARGV}`, 'if (r?.[1] === soi) main()'],
      ['let p', 'p = process', 'if (p.argv.at(1) === soi) main()'],
      [`const a = ${ARGV}`, 'const b = a', 'if (b[1] === soi) main()'],
      [`const reste = ${ARGV}.slice(1)`, 'if (reste[0] === soi) main()'],
      [`const [, ...reste] = ${ARGV}`, 'if (reste.at(0) === soi) main()'],
      [`const { argv: a } = process`, 'if (a.at(1) === soi) main()'],
      [`const { argv } = globalThis.process`, 'if (argv[1] === soi) main()'],
      ["import * as p from 'process'", "if (p['argv'][1] === soi) main()"],
      ['let lance', `[, lance] = ${ARGV}`],
      ['let lance', '({ argv: [, lance] } = process)'],
    ];
    for (const lignes of sources) {
      expect(detectionsDePointDEntree(lignes.join('\n')), lignes.join(' ⏎ ')).not.toEqual([]);
    }
  });

  it('cas plantés : `require.main`, `process.mainModule`, `module.parent` sous toutes leurs graphies', () => {
    const variantes = [
      'if (require?.main === module) main()',
      "if (require['main'] === module) main()",
      "if (!process['mainModule']) main()",
      'if (!module?.parent) main()',
      'const { mainModule } = process',
      'const { parent } = module',
      "const r = createRequire(import.meta.url)\nif (r.main === module) main()",
      "const r = module.require\nif (r.main === module) main()",
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : l’identité du module dans toute égalité, ou cherchée dans `argv`', () => {
    const variantes = [
      `if (${URL_DU_MODULE} != cible) return`,
      `if (cible == ${FICHIER_DU_MODULE}) main()`,
      `if (${URL_DU_MODULE} !== cible) return`,
      'if (__filename === cible) main()',
      `if (${ARGV}.indexOf(__filename) > 0) main()`,
      `if (${ARGV}?.includes(fileURLToPath(${URL_DU_MODULE}))) main()`,
      `if (${ARGV}.lastIndexOf(${FICHIER_DU_MODULE}) > 0) main()`,
      `if (Object.is(${URL_DU_MODULE}, cible)) main()`,
      'if (Object.is(cible, __filename)) main()',
      'const m = import.meta\nif (m.url === cible) main()',
      "if (import.meta['filename'] === cible) main()",
      `const estLance = () => ${URL_DU_MODULE} === cible`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : `import.meta.main` lié à un nom, par affectation ou déstructuration', () => {
    for (const v of ['let p\np = import.meta.main', 'const { main } = import.meta', 'const m = import.meta\nconst p = m.main']) {
      expect(detecte(v), v).toBe(true);
    }
  });

  it('cas plantés : une lecture coupée par un saut de ligne est détectée, à sa ligne', () => {
    expect(detectionsDePointDEntree(`const soi = 1\nif (${ARGV}\n[1] === soi) main()`)).toEqual([
      expect.objectContaining({ ligne: 2 }),
    ]);
    expect(detectionsDePointDEntree(`if (\n  resolve(\n    ${ARGV}[1]\n  ) === soi) main()`)).toEqual([
      expect.objectContaining({ ligne: 3 }),
    ]);
    expect(detecte(`if (${URL_DU_MODULE}\n  === pathToFileURL(x).href) main()`)).toBe(true);
    expect(detectionsDePointDEntree(`const lance =\n  ${ARGV}[1]`)).toEqual([expect.objectContaining({ ligne: 2 })]);
    expect(detectionsDePointDEntree('const { mainModule:\n  m } = process')).toEqual([expect.objectContaining({ ligne: 1 })]);
    expect(detectionsDePointDEntree(`let r\nr = ${ARGV}\nconst x = 1\nif (r[1] === soi) main()`)).toEqual([
      expect.objectContaining({ ligne: 4, extrait: 'if (r[1] === soi) main()' }),
    ]);
  });

  it('cas plantés : une clé, un spécificateur ou un identifiant ÉCHAPPÉ se lit décodé', () => {
    const variantes = [
      "if (process['\\x61rgv'][1] === soi) main()",
      "if (require['m\\x61in'] === module) main()",
      "if (!module['p\\x61rent']) main()",
      "if (process['m\\x61inModule']) main()",
      'if (process.\\u0061rgv[1] === soi) main()',
      "if (require('pro\\x63ess').argv[1] === soi) main()",
      "if (process['ar\\\ngv'][1] === soi) main()",
      'const p = import/* coupé */.meta.main',
      "if (process['ar\\gv'][1] === soi) main()",
      "if (require['m\\ain'] === module) main()",
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : `default` d’un espace de noms de `node:process` vaut `process`', () => {
    expect(detecte(`const lance = (await import(${PROCESS})).default.argv[1]`)).toBe(true);
    expect(detecte(`import * as p from ${PROCESS}\nif (p.default.argv[1] === soi) main()`)).toBe(true);
  });

  it('cas planté : `argv.includes`/`indexOf` appelé par crochets', () => {
    expect(detecte(`if (${ARGV}['includes'](__filename)) main()`)).toBe(true);
    expect(detecte(`if (${ARGV}?.['indexOf'](${FICHIER_DU_MODULE}) > 0) main()`)).toBe(true);
  });

  it('une tranche qui se réaffecte sa propre tranche : le point fixe termine, sans détection', () => {
    const sources = [
      `let args = ${ARGV}.slice(2)\nwhile (args.length) args = args.slice(1)`,
      `let r = ${ARGV}.slice(2)\nwhile (r.length) { [, ...r] = r }`,
    ];
    const module = pathToFileURL(join(RACINE, 'scripts/guards/lib/pointDEntree.mjs')).href;
    const code = `import { detectionsDePointDEntree as d } from ${JSON.stringify(module)}\nconsole.log(JSON.stringify(${JSON.stringify(sources)}.map((s) => d(s))))`;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 5000 });
    expect(r.signal, 'la garde ne rend pas de verdict sous 5 s').toBeNull();
    expect(JSON.parse(r.stdout)).toEqual([[], []]);
  });

  it('cas plantés : la ligne et l’extrait suivent le découpage de TypeScript (`\\r` seul, U+2028)', () => {
    for (const saut of ['\r', '\u2028', '\u2029']) {
      const source = [`const a = 1`, `if (${ARGV}[1] === soi) main()`, 'const z = 3'].join(saut);
      expect(detectionsDePointDEntree(source), JSON.stringify(saut)).toEqual([{ ligne: 2, extrait: `if (${ARGV}[1] === soi) main()` }]);
    }
  });

  it('cas plantés : un reste de déstructuration d’objet porte la base', () => {
    const sources = [
      'const { ...r } = process\nif (r.argv[1] === soi) main()',
      'const { env, ...p } = process\nif (p.argv[1] === soi) main()',
      'let r\n({ ...r } = process)\nif (r.argv[1] === soi) main()',
      `const { ...a } = ${ARGV}\nif (a[1] === soi) main()`,
    ];
    for (const v of sources) expect(detecte(v), v).toBe(true);
  });

  it('cas plantés : `at`/`slice` tronquent leur argument littéral', () => {
    const variantes = [
      `if (${ARGV}.at(1.5) === soi) main()`,
      `if (${ARGV}.at(1e0) === soi) main()`,
      `if (${ARGV}.slice(1.5)[0] === soi) main()`,
      `if (${ARGV}.at('1') === soi) main()`,
      `if (${ARGV}.slice(1).at() === soi) main()`,
      `if (${ARGV}.slice(1).at(-0) === soi) main()`,
      `if (${ARGV}.slice(1).at('x') === soi) main()`,
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
    for (const n of [`const x = ${ARGV}.slice(2.9)[0]`, `const x = ${ARGV}.at(2.5)`, `const x = ${ARGV}.at(0.9)`, `const x = ${ARGV}.slice(2).at(-1)`]) expect(detecte(n), n).toBe(false);
  });

  it('cas plantés : chaque forme d’expression du contrat mène à `argv`', () => {
    const variantes = [
      `if (globalThis.global.${ARGV}[1] === soi) main()`,
      'const p = c ? process : x\nif (p.argv[1] === soi) main()',
      `const a = x ?? ${ARGV}\nif (a[1] === soi) main()`,
      `const a = x || ${ARGV}\nif (a[1] === soi) main()`,
      `if ((<any>${ARGV})[1] === soi) main()`,
      `if ((${ARGV} satisfies string[])[1] === soi) main()`,
      "const { ['argv']: a } = process\nif (a[1] === soi) main()",
      'let a\n({ argv: a = [] } = process)\nif (a[1] === soi) main()',
    ];
    for (const v of variantes) expect(detecte(v), v).toBe(true);
  });

  it('contrôle négatif : ni lecture de l’élément 1, ni égalité à l’identité du module', { timeout: 30_000 }, () => {
    const neutres = [
      'if (import.meta.main) main()',
      `const root = resolve(${ARGV}[3] ?? join(dirname(fileURLToPath(${URL_DU_MODULE})), '..'))`,
      `const [, , commande] = ${ARGV}`,
      `const args = ${ARGV}.slice(2)`,
      "assert.notEqual(argv[1], 'graphql')",
      `const css = fileURLToPath(new URL('./x.css', ${URL_DU_MODULE}))`,
      `const flag = ${ARGV}.includes('--write')`,
      `const estFichier = ${URL_DU_MODULE}.startsWith('file:')`,
      `if (${URL_DU_MODULE}.includes('/node_modules/')) return`,
      `console.log(\`usage : node \${basename(${FICHIER_DU_MODULE})} <x>\`)`,
      `const n = ${ARGV}.slice(1).length`,
      `const [commande, ...reste] = ${ARGV}.slice(2)`,
      `const args = ${ARGV_GLOBAL}.slice(2)`,
      `const args = ${REQUIRE_PROCESS}.argv.slice(2)`,
      `const a = ${ARGV}.slice(2)\nif (a[1] === soi) main()`,
      `const { argv } = ${REQUIRE_PROCESS}\nconst args = argv.slice(2)`,
      'module.exports = { main }',
      'const chemins = module.paths',
      `const [, second] = ${ARGV}.slice(2)`,
      `const deuxieme = ${ARGV}.slice(2).at(1)`,
      `const reste = ${ARGV}.slice(2)\nconst x = reste[0]`,
      'function f(argv) { return argv[1] }',
      `if (a === b) console.log(${URL_DU_MODULE})`,
      `const egal = (x) => x === 1\negal(${URL_DU_MODULE})`,
      'const x = config.main',
      'const p = element.parent',
      'const r = outil.createRequire(x)\nif (r.main === module) main()',
      "const code = 'if (process.argv[1] === x) main()'",
      "spawnSync(process.execPath, ['-e', 'console.log(require.main)'])",
    ];
    for (const n of neutres) expect(detecte(n), n).toBe(false);
  });

  it('HORS DE PORTÉE : parcours d’`argv` par rappel ou `for…of`, `join`, `String(argv)`, `import.meta.main` en propriété ou `export default`', () => {
    const horsDePortee = [
      `if (${ARGV}.some((a) => a.endsWith('cli.mjs'))) main()`,
      `const lance = ${ARGV}.find((a) => a.endsWith('cli.mjs'))`,
      `if (${ARGV}.findIndex((a) => a.endsWith('cli.mjs')) > 0) main()`,
      `for (const a of ${ARGV}) if (a.endsWith('cli.mjs')) main()`,
      `if (${ARGV}.join(' ').includes('cli.mjs')) main()`,
      `if (String(${ARGV}).includes('cli.mjs')) main()`,
      'const etat = { lance: import.meta.main }',
      'export default import.meta.main',
    ];
    for (const h of horsDePortee) expect(detecte(h), h).toBe(false);
  });

  it('cas planté : la même détection CITÉE en commentaire est hors de portée', () => {
    const source = [`// ${ARGV}[1] === fileURLToPath(${URL_DU_MODULE})`, `/* ${ARGV}[1].endsWith('x.mjs') */`].join('\n');
    expect(detectionsDePointDEntree(source)).toEqual([]);
  });

  it('aucune source suivie ne détecte son point d’entrée à la main (tolérance ZÉRO)', { timeout: 120_000 }, () => {
    const suivies: string[] = sourcesSuivies();
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
      for (const { ligne, extrait } of detectionsDePointDEntree(text, rel, sourceFile!)) offenders.push(`${rel}:${ligne} → ${extrait}`);
    }
    expect(offenders, `Détection(s) du point d'entrée écrite(s) à la main — utiliser \`import.meta.main\` :\n${offenders.join('\n')}`).toEqual([]);
  });
});
