import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { API, Program } from 'typescript/unstable/sync';
import { analyserCorpus, analyserTexte, ast, scriptKindDe, typescript } from './dialecte.mjs';
import path from 'node:path';

test('une analyse détachée garde son AST et ses diagnostics sans exposer le checker fermé', () => {
  const close = API.prototype.close;
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this); });
  try {
    const fichier = { rel: 'detache.ts', text: 'export const valeur = ;' };
    const analyse = analyserTexte(fichier);
    assert.equal(spy.mock.callCount(), 1);
    assert.equal(analyse.fichier, fichier);
    assert.deepEqual(Object.keys(analyse).sort(), ['diagnostics', 'fichier', 'sourceFile']);
    assert.equal(analyse.sourceFile.statements[0].getText(), fichier.text);
    assert.equal(analyse.diagnostics[0].code, 1109);
  } finally { spy.mock.restore(); }
});

for (const methode of ['getSourceFile', 'getSyntacticDiagnostics']) test(`erreur native ${methode} et erreur de fermeture conservées ensemble`, () => {
  const analyse = new Error(`analyse ${methode}`);
  const fermeture = new Error('fermeture cache');
  const close = API.prototype.close;
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this); });
  const lecteur = mock.method(Program.prototype, methode, () => { throw analyse; });
  const cache = mock.method(API.prototype, 'clearSourceFileCache', () => { throw fermeture; });
  try {
    assert.throws(() => analyserTexte({ rel: 'erreur.ts', text: 'const a=1;' }), e => {
      assert.ok(e instanceof AggregateError);
      assert.deepEqual(e.errors, [analyse, fermeture]);
      assert.equal(e.cause, analyse);
      return true;
    });
    assert.equal(spy.mock.callCount(), 1);
  } finally { cache.mock.restore(); lecteur.mock.restore(); spy.mock.restore(); }
});

for (const [rel, text] of [
  ['simple.ts', '  export const meta = "😀";'],
  ['bom.TS', '\uFEFF  export const meta = "😀";'],
  ['crlf.TS', '\uFEFFconst s="😀";\r\n  export const meta=1;'],
  ['jsx.TSX', '\uFEFF  export const meta = <div/>;'],
  ['js.JS', '\uFEFF  export const meta = "😀";'],
  ['data.JSON', '\uFEFF{"x":1}'],
  ['unicode.ts', '\uFEFFexport const a="\uFEFFx"; export const b="\\uD800"; export const c="😀"; export const d="\\uD800\\uFEFFx";'],
  ['diagnostic.ts', '\uFEFFconst s="😀";\r\nexport const meta = ;'],
  ['diagnostic.TS', '\uFEFFconst s="😀";\r\nexport const meta = ;'],
  ['diagnostic.JS', '\uFEFFconst s="😀";\r\nexport const meta = ;'],
]) test(`parité native texte, positions UTF16, dialecte et diagnostics : ${rel}`, () => {
  const { sourceFile: sf, diagnostics } = analyserTexte({ rel, text });
  assert.equal(sf.text, text);
  assert.equal(sf.fileName, path.resolve(rel).replaceAll('\\', '/'));
  assert.equal(sf.end, text.length);
  assert.equal(sf.scriptKind, scriptKindDe(rel));
  for (const n of sf.statements) assert.equal(n.getText(sf), text.slice(n.getStart(sf), n.end));
  if (rel === 'bom.TS') assert.equal(text.slice(sf.statements[0].getStart(sf), sf.statements[0].getStart(sf) + 17), 'export const meta');
  if (rel === 'crlf.TS') assert.equal(sf.statements[1].getStart(sf), text.indexOf('export'));
  if (rel === 'unicode.ts') assert.deepEqual(sf.statements.map(n => n.declarationList.declarations[0].initializer.text), ['\uFEFFx', '\uD800', '😀', '\uD800\uFEFFx']);
  if (rel.startsWith('diagnostic.')) {
    assert.equal(diagnostics[0].fileName, rel);
    assert.equal(diagnostics[0].pos, text.indexOf(';', text.indexOf('export')));
    assert.equal(diagnostics[0].end, text.length);
  } else assert.deepEqual(diagnostics, []);
});

test('la casse des noms originaux reste distincte dans le même corpus', () => {
  const fichiers = [
    { rel: 'EntreeMajuscule.TS', text: 'export const premier = "😀";' },
    { rel: 'autreEntree.ts', text: 'export const second = "é";' },
  ];
  const analyses = [...analyserCorpus(fichiers)];
  assert.equal(analyses.length, fichiers.length);
  for (let i = 0; i < fichiers.length; i++) {
    assert.equal(analyses[i].fichier, fichiers[i]);
    assert.equal(analyses[i].sourceFile.fileName, path.resolve(fichiers[i].rel).replaceAll('\\', '/'));
    assert.equal(analyses[i].sourceFile.text, fichiers[i].text);
    assert.deepEqual(analyses[i].diagnostics, []);
  }
  assert.notEqual(analyses[0].sourceFile, analyses[1].sourceFile);
});

for (const [premier, second] of [['dossier/../identique.ts', 'identique.ts'], ['foo', 'foo.ts']]) {
  test(`collision de chemins refusée avant API : ${premier} et ${second}`, () => {
    const update = API.prototype.updateSnapshot;
    const spy = mock.method(API.prototype, 'updateSnapshot', function (...args) { return update.apply(this, args); });
    try {
      assert.throws(() => [...analyserCorpus([
        { rel: premier, text: 'export const premier = 1;' },
        { rel: second, text: 'export const second = 2;' },
      ])], error => /chemins de parse en collision/.test(error.message) && error.message.includes(premier) && error.message.includes(second));
      assert.equal(spy.mock.callCount(), 0);
    } finally { spy.mock.restore(); }
  });
}

test('dialectes, positions UTF16, diagnostics séparés et AST après fermeture', () => {
  const ts = typescript();
  const fichiers = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(ext => ({ rel: `fixture.${ext}`, text: 'const emoji = "😀";\nexport const n = 1;' }));
  fichiers.push({ rel: 'fixture.tsx', text: 'const x = <div/>;' }, { rel: 'fixture.jsx', text: 'const x = <div/>;' }, { rel: 'fixture.json', text: '{"x":1}' });
  for (const { fichier, sourceFile, diagnostics } of analyserCorpus(fichiers)) {
    assert.equal(sourceFile.scriptKind, scriptKindDe(fichier.rel));
    assert.deepEqual(diagnostics, []);
    assert.equal(sourceFile.statements[0].parent, sourceFile);
  }
  const result = analyserTexte({ rel: 'réel.ts', text: 'const emoji = "😀";\nconst broken = ;' });
  assert.equal(result.sourceFile.statements[1].getStart(), 20);
  assert.equal(result.diagnostics[0].fileName, 'réel.ts');
  assert.equal(result.diagnostics[0].code, 1109);
  assert.equal(result.sourceFile.statements[0].getText(), 'const emoji = "😀";');
  assert.equal(ts.getTokenAtPosition(result.sourceFile, 20).getText(), 'const');
  assert.equal(ast({ rel: 'inconnu', text: 'const x = 1;' }).scriptKind, scriptKindDe('fixture.ts'));
  assert.deepEqual(analyserTexte({ rel: 'inconnu', text: '}' }, { inconnu: 'refus' }), { fichier: { rel: 'inconnu', text: '}' }, sourceFile: null, diagnostics: [] });
});

for (const mode of ['épuisement', 'break', 'exception']) test(`une API par corpus, libérée sur ${mode}`, () => {
  const close = API.prototype.close;
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this); });
  const instances = [];
  const update = API.prototype.updateSnapshot;
  const snapshot = mock.method(API.prototype, 'updateSnapshot', function (...args) { instances.push(this); return update.apply(this, args); });
  const fichiers = Array.from({ length: 100 }, (_, i) => ({ rel: `${i}.ts`, text: `const n = ${i}` }));
  try {
    let emprunt;
    let nombre = 0;
    const verifier = ({ sourceFile, checker }) => {
      assert.ok(sourceFile);
      assert.equal(spy.mock.callCount(), 0);
      if (emprunt) assert.equal(checker, emprunt);
      emprunt = checker;
      assert.equal(checker.getSymbolAtLocation(sourceFile.statements[0].declarationList.declarations[0].name).name, 'n');
      nombre++;
    };
    if (mode === 'épuisement') {
      for (const analyse of analyserCorpus(fichiers)) verifier(analyse);
      assert.equal(nombre, 100);
    } else if (mode === 'break') for (const analyse of analyserCorpus(fichiers)) { verifier(analyse); break; }
    else assert.throws(() => { for (const analyse of analyserCorpus(fichiers)) { verifier(analyse); throw new Error('consommateur'); } }, /consommateur/);
    assert.equal(snapshot.mock.callCount(), 1);
    assert.equal(spy.mock.callCount(), 1);
  } finally { snapshot.mock.restore(); spy.mock.restore(); for (const instance of instances) close.call(instance); }
});
