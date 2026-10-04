import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { API } from 'typescript/unstable/sync';
import { virtualProgram, repoProgram, VIRTUAL_ROOT, libererSessions } from './tsProgram.mjs';

test('libererSessions : premier échec, fermeture suivante et dédoublage', () => {
  const erreur = new Error('première fermeture');
  const fermetures = [];
  const premier = { dispose() { fermetures.push('premier'); throw erreur; } };
  const second = { dispose() { fermetures.push('second'); } };
  assert.throws(() => libererSessions([premier, second, premier]), e => e === erreur);
  assert.deepEqual(fermetures, ['premier', 'second']);
});

test('libererSessions : collection réentrante photographiée avant fermeture', () => {
  const fermetures = [];
  const sessions = new Set();
  const second = { dispose() { fermetures.push('second'); } };
  sessions.add({ dispose() { fermetures.push('premier'); sessions.clear(); sessions.add({ dispose() { throw new Error('session nouvelle'); } }); } });
  sessions.add(second);
  libererSessions(sessions);
  assert.deepEqual(fermetures, ['premier', 'second']);
});

test('libererSessions : erreur d’analyse et erreurs de fermeture observables ensemble', () => {
  const analyse = new Error('analyse');
  const fermeture = new Error('fermeture');
  const suivante = new Error('suivante');
  assert.throws(() => libererSessions([{ dispose() { throw fermeture; } }, { dispose() { throw suivante; } }], [analyse]), e => {
    assert.ok(e instanceof AggregateError);
    assert.deepEqual(e.errors, [analyse, fermeture, suivante]);
    assert.equal(e.cause, analyse);
    return true;
  });
  assert.throws(() => libererSessions([], [analyse]), e => e === analyse);
});

test('dispose : erreurs du snapshot et du cache conservées, fermeture native unique', () => {
  const erreurSnapshot = new Error('snapshot dispose');
  const erreurCache = new Error('cache dispose');
  const update = API.prototype.updateSnapshot;
  const close = API.prototype.close;
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this); });
  const snapshots = [];
  const snapshotMock = mock.method(API.prototype, 'updateSnapshot', function (...args) {
    const snapshot = update.apply(this, args);
    const dispose = snapshot.dispose.bind(snapshot);
    snapshots.push(mock.method(snapshot, 'dispose', () => { dispose(); throw erreurSnapshot; }));
    return snapshot;
  });
  const session = virtualProgram({ 'a.ts': 'const a=1;' });
  const cache = mock.method(API.prototype, 'clearSourceFileCache', () => { throw erreurCache; });
  try {
    assert.throws(() => session.dispose(), e => {
      assert.ok(e instanceof AggregateError);
      assert.deepEqual(e.errors, [erreurSnapshot, erreurCache]);
      return true;
    });
    assert.equal(spy.mock.callCount(), 1);
    session.dispose();
    assert.equal(spy.mock.callCount(), 1);
  } finally { cache.mock.restore(); snapshotMock.mock.restore(); for (const s of snapshots) s.mock.restore(); spy.mock.restore(); }
});

const chemin = rel => path.resolve(VIRTUAL_ROOT, rel).replaceAll('\\', '/');
test('VFS : bibliothèques natives, déclarations exactes, homonymes et isolement disque', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ts7-isolation-'));
  const physique = path.join(root, 'physique.ts').replaceAll('\\', '/');
  writeFileSync(physique, 'export const physique = 1;');
  const source = 'export interface Base { same: string; count: number }\nexport type P = Partial<Base>; export type K = Pick<Base, "same">; export type M = { [T in keyof Base]: Base[T] }; export namespace Other { export interface Base { same: boolean } } export type U = Base | Other.Base; export const tableau: Array<string> = [];';
  const session = virtualProgram({ 'types.ts': source, 'disque.ts': `import { physique } from '${physique}'; export const n = physique;` });
  try {
    const { program, checker } = session;
    const tree = program.getSourceFile(chemin('types.ts'));
    const declarations = name => {
      const declaration = tree.statements.find(s => s.name?.text === name);
      return checker.getPropertiesOfType(checker.getTypeAtLocation(declaration.name))[0].declarations.map(h => h.resolve());
    };
    const original = declarations('Base')[0];
    for (const name of ['P', 'K', 'M']) assert.equal(declarations(name)[0], original);
    assert.equal(declarations('U').length, 2);
    assert.notEqual(declarations('U')[0], declarations('U')[1]);
    assert.deepEqual(program.getSemanticDiagnostics(chemin('types.ts')), []);
    assert.ok(program.getSourceFileNames().some(f => /\/lib\.es5\.d\.ts$/.test(f)));
    assert.equal(program.getSourceFileNames().includes(physique), false);
    assert.deepEqual(program.getSemanticDiagnostics(chemin('disque.ts')).map(d => d.code), [2307]);
  } finally { session.dispose(); session.dispose(); rmSync(root, { recursive: true, force: true }); }
});

test('fermeture : échec du snapshot et échec du nettoyage libèrent API une seule fois', () => {
  const close = API.prototype.close;
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this); });
  const snapshot = mock.method(API.prototype, 'updateSnapshot', () => { throw new Error('snapshot'); });
  try {
    assert.throws(() => virtualProgram({ 'a.ts': 'const a = 1;' }), /snapshot/);
    assert.equal(spy.mock.callCount(), 1);
    snapshot.mock.restore();
    const session = virtualProgram({ 'a.ts': 'const a = 1;' });
    const cache = mock.method(API.prototype, 'clearSourceFileCache', () => { throw new Error('cache'); });
    try {
      assert.throws(() => session.dispose(), /cache/);
      assert.equal(spy.mock.callCount(), 2);
      session.dispose();
      assert.equal(spy.mock.callCount(), 2);
    } finally { cache.mock.restore(); }
  } finally { snapshot.mock.restore(); spy.mock.restore(); }
});

test('repoProgram : config héritée, racines choisies, recouvrement et erreur partielle', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ts7-program-'));
  const close = API.prototype.close;
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this); });
  try {
    writeFileSync(path.join(root, 'base.json'), JSON.stringify({ compilerOptions: { strict: true, noLib: true, types: [] } }));
    writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ extends: './base.json', files: ['a.ts', 'b.ts'] }));
    writeFileSync(path.join(root, 'a.ts'), 'export const a = 1;');
    writeFileSync(path.join(root, 'b.ts'), 'export const b = 2;');
    const session = repoProgram(root, files => files.filter(f => f.endsWith('/a.ts')), { 'a.ts': 'export const a = "recouvert";' });
    try {
      assert.equal(session.program.getSourceFileNames().length, 1);
      assert.equal(session.program.getSourceFile(path.join(root, 'a.ts')).text, 'export const a = "recouvert";');
      assert.equal(session.program.getCompilerOptions().strict, true);
    } finally { session.dispose(); session.dispose(); }
    assert.equal(spy.mock.callCount(), 1);
    assert.throws(() => repoProgram(root, () => { throw new Error('sélection'); }), /sélection/);
    assert.equal(spy.mock.callCount(), 2);
  } finally { spy.mock.restore(); rmSync(root, { recursive: true, force: true }); }
});
