import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { ast } from './dialecte.mjs';
import * as canon from './canonUnique.mjs';
import { AVAILABILITIES } from '../../../src/engine/types.ts';

const scan = (text, construction = canon.CONSTRUCTION_DE_PROGRAMME) => canon.scanConstructionsReservees({ rel: 'scripts/probe.ts', text }, [construction]);
const calls = (sf) => {
  const out = [];
  const walk = (n) => { if (ts.isCallExpression(n)) out.push(n); ts.forEachChild(n, walk); };
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
  const c = canon.recopieDeCanon({ nom: 'PALIER', membres: AVAILABILITIES });
  const prefix = "import { availabilitySchema as schema } from '../src/data/schemas/grammaire/valeurs';";
  assert.equal(scan(`${prefix} schema.extract(['Commune', 'Rare']);`, c).length, 0);
  assert.equal(scan(`${prefix} function f(schema) { schema.extract(['Commune', 'Rare']); }`, c).length, 1);
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
  const sf = ast({ rel: 'scripts/probe.ts', text: "import { f as first } from 'one'; import { f as second } from 'two'; first(); second(); function h(first) { first(); }" });
  assert.deepEqual(calls(sf).map((n) => canon.liaisonImportee(n.expression, sf)), [
    { spec: 'one', nom: 'f' }, { spec: 'two', nom: 'f' }, null,
  ]);
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
  const sf = ast({ rel: 'scripts/probe.ts', text: prefix + "read('items'); function f(read) { read('items'); }" });
  assert.deepEqual(calls(sf).map((n) => canon.estAppelDeclare(n, sf, { 'src/data/index.ts': ['read'] })), ['read', null]);
  assert.deepEqual(canon.origineImportee('read', sf), { module: 'src/data/index.ts', nom: 'read' });
});
test('fragment : import de tête side-effect et type, niveau imbriqué opposé', () => {
  const c = canon.constructionDeFragment({ nom: 'FRAGMENT', natures: ['fragment'], designation: [], designationLiee: ['value'], constructeurs: { 'src/data/index.ts': ['build'] } });
  for (const head of ["import '../src/data/index';", "import type { build } from '../src/data/index';"])
    assert.equal(scan(`${head}\n({ ...base, value: x });`, c).length, 1);
  assert.equal(scan("namespace N { import { build } from '../src/data/index'; }\n({ ...base, value: x });", c).length, 0);
});
test('contexte du scan reste paresseux et partagé dans ce seul appel', () => {
  const contexts = [];
  const c = { nom: 'OBSERVATION', reconnait: (n, sf, contexte) => { contexts.push(contexte); return null; } };
  scan('const first = 1;', c);
  const first = contexts[0];
  assert.ok(contexts.every((ctx) => ctx === first));
  contexts.length = 0;
  scan('const second = 2;', c);
  assert.notEqual(contexts[0], first);
  assert.equal(first.sites(), first.sites());
  assert.equal(first.liaisons(), first.liaisons());
  assert.equal(first.checker(), first.checker());
});
