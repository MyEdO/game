import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, Snapshot, SymbolFlags } from 'typescript/unstable/sync';
import { typescript } from './dialecte.mjs';
import { virtualProgram, syntaxProgram, repoProgram, VIRTUAL_ROOT, libererSessions } from './tsProgram.mjs';

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
test('syntaxProgram : configuration propre, corpus fermé et une seule ouverture native', () => {
  const rootSyntaxe = chemin('__analyse_syntaxique__').replace(/^([A-Za-z]):/, (_, drive) => `${drive.toLowerCase()}:`);
  const racine = `${rootSyntaxe}/racine.TS`;
  const sources = {
    [chemin('tsconfig.json')]: JSON.stringify({ compilerOptions: { noLib: false, noResolve: true, allowJs: false, resolveJsonModule: false }, files: [] }),
    [path.resolve(path.sep, 'tsconfig.json').replaceAll('\\', '/')]: JSON.stringify({ compilerOptions: { noLib: false, allowJs: false }, files: [] }),
    [chemin('valide.TS')]: '\uFEFFexport const x="😀";',
    [chemin('invalide.TS')]: '\uFEFFexport const x=;',
    [chemin('valide.TSX')]: '\uFEFFexport const x=<div/>;',
    [chemin('invalide.TSX')]: '\uFEFFexport const x=<div>;',
    [chemin('valide.JS')]: '\uFEFFexport const x="😀";',
    [chemin('invalide.JS')]: '\uFEFFexport const x=;',
    [chemin('valide.JSON')]: '\uFEFF{"x":1}',
    [chemin('invalide.JSON')]: '\uFEFF{"x":}',
    [chemin('import.ts')]: 'import "./absent.ts";',
  };
  const update = API.prototype.updateSnapshot;
  const ouvertures = mock.method(API.prototype, 'updateSnapshot', function (...args) { return update.apply(this, args); });
  const choisir = Snapshot.prototype.getDefaultProjectForFile;
  const selections = mock.method(Snapshot.prototype, 'getDefaultProjectForFile', function (...args) { return choisir.apply(this, args); });
  let session;
  try {
    session = syntaxProgram(sources);
    assert.equal(ouvertures.mock.callCount(), 1);
    assert.deepEqual(ouvertures.mock.calls[0].arguments, [{ openProjects: [`${rootSyntaxe}/tsconfig.json`], openFiles: [racine] }]);
    assert.equal(selections.mock.callCount(), 1);
    assert.deepEqual(selections.mock.calls[0].arguments, [racine]);
    for (const [nom, texte] of Object.entries(sources)) {
      const sf = session.program.getSourceFile(nom);
      assert.ok(sf, nom);
      assert.equal(sf.fileName, nom);
      assert.equal(sf.text, texte);
      assert.equal(sf.end, texte.length);
      const diagnostics = session.program.getSyntacticDiagnostics(nom);
      if (nom.includes('/invalide.')) assert.ok(diagnostics.length, nom);
      else assert.deepEqual(diagnostics, [], nom);
    }
    assert.equal(session.program.getSourceFileNames().some(nom => /\/lib\..*\.d\.ts$/.test(nom)), false);
    assert.equal(session.program.getSourceFile(chemin('absent.ts')), undefined);
  } finally { session?.dispose(); selections.mock.restore(); ouvertures.mock.restore(); }
});

for (const nom of ['simple".TS', "simple'.TS", 'esperluette&<angle>.TS']) {
  test(`syntaxProgram : référence au nom original sans encodage : ${nom}`, () => {
    const texte = '\uFEFFexport const x="😀";';
    const session = syntaxProgram({ [nom]: texte });
    try {
      const sf = session.program.getSourceFile(chemin(nom));
      assert.ok(sf);
      assert.equal(sf.fileName, chemin(nom));
      assert.equal(sf.text, texte);
      assert.deepEqual(session.program.getSyntacticDiagnostics(chemin(nom)), []);
    } finally { session.dispose(); }
  });
}

for (const nom of ['__analyse_syntaxique__/tsconfig.json', '__analyse_syntaxique__/racine.TS', '__analyse_syntaxique__/racine.ts', '__ANALYSE_SYNTAXIQUE__/TSCONFIG.JSON', 'deux"\'.ts', 'ligne\r.ts', 'ligne\n.ts', 'ligne\u2028.ts', 'ligne\u2029.ts']) {
  test(`syntaxProgram : chemin refusé avant ouverture native : ${JSON.stringify(nom)}`, () => {
    const update = mock.method(API.prototype, 'updateSnapshot', () => { throw new Error('API ouverte'); });
    const close = mock.method(API.prototype, 'close', () => { throw new Error('API fermée'); });
    try {
      assert.throws(() => syntaxProgram({ [nom]: '' }), erreur =>
        erreur.message.includes(chemin(nom)) && /Fichier réservé|Chemin non représentable/.test(erreur.message));
      assert.equal(update.mock.callCount(), 0);
      assert.equal(close.mock.callCount(), 0);
    } finally { close.mock.restore(); update.mock.restore(); }
  });
}

test('syntaxProgram : homonymes par casse gardés distincts sur hôte sensible', { skip: process.platform === 'win32' }, () => {
  const sources = { 'Foo.ts': 'export const majuscule=1;', 'foo.ts': 'export const minuscule=2;' };
  const session = syntaxProgram(sources);
  try {
    const majuscule = session.program.getSourceFile(chemin('Foo.ts'));
    const minuscule = session.program.getSourceFile(chemin('foo.ts'));
    assert.ok(majuscule);
    assert.ok(minuscule);
    assert.notEqual(majuscule, minuscule);
    assert.equal(majuscule.fileName, chemin('Foo.ts'));
    assert.equal(minuscule.fileName, chemin('foo.ts'));
    assert.equal(majuscule.text, sources['Foo.ts']);
    assert.equal(minuscule.text, sources['foo.ts']);
  } finally { session.dispose(); }
});

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

const diagnostics = program => [...program.getProgramDiagnostics(), ...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics(), ...program.getGlobalDiagnostics()];
function identifiers(source, nom) {
  const ts = typescript();
  const resultat = [];
  function visit(n) {
    if (ts.isIdentifier(n) && n.text === nom) resultat.push(n);
    n.forEachChild(visit);
  }
  visit(source);
  return resultat;
}

function aliasCible(session, fichier, nom) {
  const { program, checker } = session;
  const source = program.getSourceFile(chemin(fichier));
  assert.ok(source);
  const symbol = checker.getSymbolAtLocation(identifiers(source, nom)[0]);
  assert.ok(symbol.flags & SymbolFlags.Alias);
  return checker.getAliasedSymbol(symbol);
}

test('virtualProgram charge les racines .js, .mjs et .cjs avec allowJs', () => {
  const files = Object.fromEntries(['js', 'mjs', 'cjs'].map((extension) => [
    `racine.${extension}`, 'export const valeur = 1;',
  ]));
  const session = virtualProgram(files, { allowJs: true });
  try {
    for (const fichier of Object.keys(files)) assert.ok(session.program.getSourceFile(chemin(fichier)), fichier);
    assert.equal(diagnostics(session.program).length, 0);
  } finally { session.dispose(); }
});

test('virtualProgram résout les alias importés de JS vers TS et de TS vers JS', () => {
  const files = {
    'source.mjs': 'export const donnees = [1];',
    'source.ts': 'export const valeur = 2;',
    'depuis-ts.ts': "import { donnees as table } from './source.mjs'; export const result = table;",
    'depuis-js.mjs': "import { valeur as nombre } from './source'; export const result = nombre;",
  };
  const session = virtualProgram(files, { allowJs: true });
  try {
    for (const [importeur, nom, origine] of [
      ['depuis-ts.ts', 'table', 'source.mjs'],
      ['depuis-js.mjs', 'nombre', 'source.ts'],
    ]) {
      const cible = aliasCible(session, importeur, nom);
      assert.ok(cible.declarations?.length, `${importeur} : ${nom}`);
      assert.equal(cible.declarations[0].resolve().getSourceFile().fileName, chemin(origine));
    }
    assert.equal(diagnostics(session.program).length, 0);
  } finally { session.dispose(); }
});

test('virtualProgram sépare le symbole importé de son homonyme local', () => {
  const ts = typescript();
  const session = virtualProgram({
    'source.mjs': 'export const valeur = 1;',
    'porteur.mjs': "import { valeur as cible } from './source.mjs'; function lire(cible) { return cible; } export const result = cible;",
  }, { allowJs: true });
  try {
    const source = session.program.getSourceFile(chemin('porteur.mjs'));
    assert.ok(source);
    const checker = session.checker;
    const refs = identifiers(source, 'cible');
    assert.equal(refs.length, 4);
    const symboles = refs.map((n) => checker.getSymbolAtLocation(n));
    assert.equal(symboles[0], symboles[3]);
    assert.equal(symboles[1], symboles[2]);
    assert.notEqual(symboles[0], symboles[1]);
    assert.ok(symboles[0].flags & SymbolFlags.Alias);
    assert.equal(symboles[1].flags & SymbolFlags.Alias, 0);
    assert.ok(ts.isParameterDeclaration(symboles[1].declarations[0].resolve()));
    assert.equal(checker.getAliasedSymbol(symboles[0]).declarations[0].resolve().getSourceFile().fileName, chemin('source.mjs'));
  } finally { session.dispose(); }
});

test('virtualProgram ne lit pas un module réel absent des images fournies', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const porteur = chemin(fileURLToPath(new URL('porteur-en-memoire.ts', import.meta.url)));
  const modules = ['tsProgram.mjs', 'tsProgram.d.mts'].map((nom) => chemin(fileURLToPath(new URL(nom, import.meta.url))));
  for (const module of modules) assert.ok(existsSync(module), module);
  const texte = "import { virtualProgram as fabrique } from './tsProgram.mjs'; export const result = fabrique;";
  const disque = repoProgram(root, () => [porteur], { [path.relative(root, porteur)]: texte });
  try {
    const cible = aliasCible(disque, porteur, 'fabrique');
    assert.ok(cible.declarations?.length);
    const origine = cible.declarations[0].resolve().getSourceFile();
    assert.ok(modules.includes(chemin(origine.fileName)), origine.fileName);
    assert.equal(disque.program.getSourceFile(origine.fileName), origine);
    const session = virtualProgram({ [path.relative(VIRTUAL_ROOT, porteur)]: texte }, { allowJs: true });
    try {
      for (const module of modules) assert.equal(session.program.getSourceFile(module), undefined, module);
      assert.equal(aliasCible(session, porteur, 'fabrique').declarations.length, 0);
      assert.ok(diagnostics(session.program).some((d) => d.code === 2307 && d.fileName === porteur));
    } finally { session.dispose(); }
  } finally { disque.dispose(); }
});

test('virtualProgram conserve le programme TypeScript par défaut', () => {
  const files = {
    'source.ts': 'export const valeur: number = 1;',
    'porteur.ts': "import { valeur as nombre } from './source'; export const result: number = nombre;",
  };
  for (const options of [{}, { allowJs: false }]) {
    const session = virtualProgram(files, options);
    try {
      assert.equal(Boolean(session.program.getCompilerOptions().allowJs), false);
      assert.equal(session.program.getCompilerOptions().strict, true);
      assert.equal(session.program.getCompilerOptions().noEmit, true);
      assert.equal(diagnostics(session.program).length, 0);
      assert.equal(aliasCible(session, 'porteur.ts', 'nombre').declarations[0].resolve().getSourceFile().fileName, chemin('source.ts'));
    } finally { session.dispose(); }
  }
});

test('virtualProgram refuse encore les racines JavaScript sans activation explicite', () => {
  const files = { 'racine.mjs': 'export const valeur = 1;' };
  for (const options of [{}, { allowJs: false }]) {
    const session = virtualProgram(files, options);
    try {
      assert.equal(Boolean(session.program.getSourceFile(chemin('racine.mjs'))), false);
      assert.ok(diagnostics(session.program).some((d) => d.code === 6504));
    } finally { session.dispose(); }
  }
});
