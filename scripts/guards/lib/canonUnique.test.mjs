import test from 'node:test';
import assert from 'node:assert/strict';
import * as ts from 'typescript/unstable/ast';
import { ast, analyserCorpus } from './dialecte.mjs';
import * as canon from './canonUnique.mjs';

const avecAnalyse = (fichier, utiliser) => {
  for (const analyse of analyserCorpus([fichier])) return utiliser(analyse.sourceFile, analyse.checker);
};

const scan = (text, construction = canon.CONSTRUCTION_DE_PROGRAMME) => canon.scanConstructionsReservees({ rel: 'scripts/probe.ts', text }, [construction]);
const calls = (sf) => {
  const out = [];
  const walk = (n) => { if (ts.isCallExpression(n)) out.push(n); n.forEachChild(walk); };
  walk(sf);
  return out;
};

test('appel direct : le paramètre homonyme ne provient pas du compilateur', () => {
  assert.equal(scan("import { createProgram } from 'typescript'; function f(createProgram) { createProgram({}); }").length, 0);
});
test('appel namespace : le paramètre homonyme ne provient pas du compilateur', () => {
  assert.equal(scan("import * as ts from 'typescript'; function f(ts) { ts.createProgram({}); }").length, 0);
});
test('extract masqué ne blanchit pas une recopie de canon', () => {
  const c = canon.recopieDeCanon({ nom: 'PALIER', membres: ['a', 'b'] });
  const prefix = "import { availabilitySchema as schema } from '../src/data/schemas/grammaire/valeurs';";
  assert.equal(scan(`${prefix} schema.extract(['a', 'b']);`, c).length, 0);
  assert.equal(scan(`${prefix} function f(schema) { schema.extract(['a', 'b']); }`, c).length, 1);
});
test('imports nommés, alias, défaut, namespace et captures restent reconnus', () => {
  for (const text of [
    "import { createProgram } from 'typescript'; createProgram({});",
    "import { createProgram as build } from 'typescript'; function f() { build({}); }",
    "import ts from 'typescript'; ts.createProgram({});",
    "import * as compiler from 'typescript'; compiler.createProgram({});",
    "import type { createProgram } from 'typescript'; createProgram({});",
  ]) assert.equal(scan(text).length, 1, text);
});
test('locals, déstructurations, captures masquées et module homonyme sont opposés', () => {
  for (const text of [
    "import { createProgram } from 'typescript'; { const createProgram = other; createProgram({}); }",
    "import { createProgram } from 'typescript'; function f({ createProgram }) { createProgram({}); }",
    "import { createProgram } from 'typescript'; function f(createProgram) { return () => createProgram({}); }",
    "import { createProgram } from 'other'; createProgram({});",
  ]) assert.equal(scan(text).length, 0, text);
});
test('liaisonImportee distingue les symboles locaux des alias non résolus', () => {
  return avecAnalyse({ rel: 'scripts/probe.ts', text: "import { f as first } from 'one'; import { f as second } from 'two'; first(); second(); function h(first) { first(); }" }, (sf, checker) => {
  const contexte = canon.contexteImports(sf, checker);
  assert.deepEqual(calls(sf).map((n) => canon.liaisonImportee(n.expression, sf, contexte)), [
    { spec: 'one', nom: 'f' }, { spec: 'two', nom: 'f' }, null,
  ]);
  });
});
test('exports conservent ordre, clauses et doublons, sans espace ni étoile ni equals', () => {
  const text = "export { f as a } from 'one'; export function f() {} export { f as a }; export const g = () => 0; export { f as z, f as z } from 'two'; export * as f from 'three'; export * from 'four'; export import f = require('five');";
  assert.deepEqual(canon.tableDesExports([{ rel: 'scripts/probe.ts', text }], ['f', 'g']), { 'scripts/probe.ts': ['a', 'f', 'a', 'g', 'z', 'z'] });
});

const collection = () => canon.lectureBruteDeCollection({ nom: 'COLLECTION', liaisons: [{ module: 'src/data/index.ts', exporte: 'raw' }], json: 'items.json', seam: { module: 'src/data/index.ts', fonctions: ['read'] }, dataset: 'items' });
test('collection : JSON direct et imports nommés type compris', () => {
  assert.equal(scan("import data from '../src/data/items.json';", collection()).length, 1);
  assert.equal(scan("import type { raw as renamed } from '../src/data/index';", collection()).length, 1);
});
test('collection : namespace importé contre namespace masqué', () => {
  const prefix = "import * as data from '../src/data/index';\n";
  assert.equal(scan(`${prefix}data.raw;`, collection()).length, 1);
  assert.equal(scan(`${prefix}function f(data) { data.raw; }`, collection()).length, 0);
});
test('collection : réexport nommé seulement', () => {
  assert.equal(scan("export { raw as renamed } from '../src/data/index';", collection()).length, 1);
  assert.equal(scan("export * as raw from '../src/data/index'; export * from '../src/data/index';", collection()).length, 0);
});

test('appel déclaré et seam utilisent la portée de chaque occurrence', () => {
  const prefix = "import { read } from '../src/data/index';\n";
  assert.equal(scan(`${prefix}read('items');`, collection()).length, 1);
  assert.equal(scan(`${prefix}function f(read) { read('items'); }`, collection()).length, 0);
  return avecAnalyse({ rel: 'scripts/probe.ts', text: prefix + "read('items'); function f(read) { read('items'); }" }, (sf, checker) => {
  const contexte = canon.contexteImports(sf, checker);
  assert.deepEqual(calls(sf).map((n) => canon.estAppelDeclare(n, sf, { 'src/data/index.ts': ['read'] }, contexte)), ['read', null]);
  assert.deepEqual(canon.origineImportee('read', sf, contexte), { module: 'src/data/index.ts', nom: 'read' });
  });
});
test('fragment : import de tête side-effect et type, niveau imbriqué opposé', () => {
  const c = canon.constructionDeFragment({ nom: 'FRAGMENT', natures: ['fragment'], designation: [], designationLiee: ['value'], constructeurs: { 'src/data/index.ts': ['build'] } });
  for (const head of ["import '../src/data/index';", "import type { build } from '../src/data/index';"])
    assert.equal(scan(`${head}\n({ ...base, value: x });`, c).length, 1);
  assert.equal(scan("namespace N { import { build } from '../src/data/index'; }\n({ ...base, value: x });", c).length, 0);
});
test('contexte du scan reste paresseux et partagé dans ce seul appel', () => {
  const contexts = [];
  const c = { nom: 'OBSERVATION', reconnait: (n, sf, contexte) => { contexts.push(contexte); assert.equal(contexte.checker(), contexte.checker()); return null; } };
  canon.scanConstructionsReservees({ rel: 'scripts/probe.ts', text: 'const first = 1;' }, [c, { ...c, nom: 'AUTRE' }]);
  const first = contexts[0];
  assert.ok(contexts.every((ctx) => ctx === first));
  contexts.length = 0;
  scan('const second = 2;', c);
  assert.notEqual(contexts[0], first);
  assert.equal(first.sites(), first.sites());
  assert.equal(first.liaisons(), first.liaisons());
});

test('index local : ordre, doublons, imports de tête et tableaux stables', () => {
  const sf = ast({ rel: 'scripts/probe.ts', text: "import { a as same, b as same } from 'one'; import same from 'two'; import * as ns from 'three'; import type { T as type } from 'four'; export { a as same } from 'five'; namespace N { import { a as inner } from 'six'; } import eq = require('seven');" });
  const contexte = canon.contexteImports(sf);
  assert.equal(contexte.source, sf);
  assert.throws(() => { contexte.source = ast({ rel: sf.fileName, text: '' }); }, TypeError);
  const same = contexte.liaisonsDuNom('same');
  assert.deepEqual(same.map((l) => [l.spec, l.importe.nom]), [['one', 'a'], ['one', 'b'], ['two', 'default']]);
  assert.equal(contexte.liaisonsDuNom('same'), same);
  assert.equal(contexte.liaisonsDuNom('ns')[0].importe.nom, '*');
  assert.equal(contexte.liaisonsDuNom('type')[0].typeSeul, true);
  for (const nom of ['absent', 'inner', 'eq']) {
    assert.deepEqual(contexte.liaisonsDuNom(nom), []);
    assert.equal(contexte.liaisonsDuNom(nom), contexte.liaisonsDuNom(nom));
  }
});

test('origine de tête indexée sans checker, questions lexicales avec checker partagé', () => {
  return avecAnalyse({ rel: 'scripts/probe.ts', text: "import { read, read as alias } from '../src/data/index'; import * as ns from '../src/data/index'; read(); alias(); ns.read(); function f(read) { read(); }" }, (sf, checker) => {
  const contexte = canon.contexteImports(sf, checker);
  const tete = { ...contexte, checker: () => assert.fail('origine de tête sans checker') };
  for (const nom of ['read', 'alias']) assert.deepEqual(canon.origineImportee(nom, sf, tete), { module: 'src/data/index.ts', nom: 'read' });
  assert.equal(canon.origineImportee('absent', sf, tete), null);
  const verificateurs = new Set();
  const lexical = { ...contexte, checker: () => { const c = contexte.checker(); verificateurs.add(c); return c; } };
  assert.deepEqual(calls(sf).map((n) => canon.estAppelDeclare(n, sf, { 'src/data/index.ts': ['read'] }, lexical)), ['read', 'read', 'read', null]);
  assert.equal(verificateurs.size, 1);
  });
});

test('contexte absent ou issu d’un autre AST homonyme refusé avant toute question', () => {
  const fichier = { rel: 'scripts/probe.ts', text: "import { read } from '../src/data/index'; read();" };
  return avecAnalyse(fichier, (sf, checker) => avecAnalyse(fichier, (autre, autreChecker) => {
  const contexte = canon.contexteImports(sf, checker);
  const etranger = canon.contexteImports(autre, autreChecker);
  assert.notEqual(contexte.source, etranger.source);
  assert.notEqual(contexte.checker(), etranger.checker());
  const [appel] = calls(sf);
  for (const ctx of [undefined, etranger]) {
    const refuse = (e) => e instanceof TypeError && /contexte.*SourceFile/.test(e.message);
    assert.throws(() => canon.liaisonImportee(appel.expression, sf, ctx), refuse);
    assert.throws(() => canon.origineImportee('absent', sf, ctx), refuse);
    assert.throws(() => canon.estAppelDeclare(appel, sf, {}, ctx), refuse);
  }
  assert.deepEqual(canon.liaisonImportee(appel.expression, sf, contexte), { spec: '../src/data/index', nom: 'read' });
  }));
});
