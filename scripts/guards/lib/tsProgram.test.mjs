import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { typescript } from './dialecte.mjs';
import { virtualProgram, VIRTUAL_ROOT } from './tsProgram.mjs';

const chemin = (f) => resolve(VIRTUAL_ROOT, f).replaceAll('\\', '/');

function identifiers(source, nom) {
  const ts = typescript();
  const resultat = [];
  function visit(n) {
    if (ts.isIdentifier(n) && n.text === nom) resultat.push(n);
    ts.forEachChild(n, visit);
  }
  visit(source);
  return resultat;
}

function aliasCible(program, fichier, nom) {
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(chemin(fichier));
  assert.ok(source);
  const symbol = checker.getSymbolAtLocation(identifiers(source, nom)[0]);
  assert.ok(symbol.flags & typescript().SymbolFlags.Alias);
  return checker.getAliasedSymbol(symbol);
}

test('virtualProgram charge les racines .js, .mjs et .cjs avec allowJs', () => {
  const files = Object.fromEntries(['js', 'mjs', 'cjs'].map((extension) => [
    `racine.${extension}`, 'export const valeur = 1;',
  ]));
  const program = virtualProgram(files, { allowJs: true });
  for (const fichier of Object.keys(files)) assert.ok(program.getSourceFile(chemin(fichier)), fichier);
  assert.equal(typescript().getPreEmitDiagnostics(program).length, 0);
});

test('virtualProgram résout les alias importés de JS vers TS et de TS vers JS', () => {
  const files = {
    'source.mjs': 'export const donnees = [1];',
    'source.ts': 'export const valeur = 2;',
    'depuis-ts.ts': "import { donnees as table } from './source.mjs'; export const result = table;",
    'depuis-js.mjs': "import { valeur as nombre } from './source'; export const result = nombre;",
  };
  const program = virtualProgram(files, { allowJs: true });
  for (const [importeur, nom, origine] of [
    ['depuis-ts.ts', 'table', 'source.mjs'],
    ['depuis-js.mjs', 'nombre', 'source.ts'],
  ]) {
    const cible = aliasCible(program, importeur, nom);
    assert.ok(cible.declarations?.length, `${importeur} : ${nom}`);
    assert.equal(cible.declarations[0].getSourceFile().fileName, chemin(origine));
  }
  assert.equal(typescript().getPreEmitDiagnostics(program).length, 0);
});

test('virtualProgram sépare le symbole importé de son homonyme local', () => {
  const ts = typescript();
  const program = virtualProgram({
    'source.mjs': 'export const valeur = 1;',
    'porteur.mjs': "import { valeur as cible } from './source.mjs'; function lire(cible) { return cible; } export const result = cible;",
  }, { allowJs: true });
  const source = program.getSourceFile(chemin('porteur.mjs'));
  assert.ok(source);
  const checker = program.getTypeChecker();
  const refs = identifiers(source, 'cible');
  assert.equal(refs.length, 4);
  const symboles = refs.map((n) => checker.getSymbolAtLocation(n));
  assert.equal(symboles[0], symboles[3]);
  assert.equal(symboles[1], symboles[2]);
  assert.notEqual(symboles[0], symboles[1]);
  assert.ok(symboles[0].flags & ts.SymbolFlags.Alias);
  assert.equal(symboles[1].flags & ts.SymbolFlags.Alias, 0);
  assert.ok(ts.isParameter(symboles[1].declarations[0]));
  assert.equal(checker.getAliasedSymbol(symboles[0]).declarations[0].getSourceFile().fileName, chemin('source.mjs'));
});

test('virtualProgram ne lit pas un module réel absent des images fournies', () => {
  const ts = typescript();
  const dossier = mkdtempSync(join(tmpdir(), 'ts-program-images-'));
  const reel = join(dossier, 'module-reel.mjs');
  writeFileSync(reel, 'export const valeur = 1;');
  try {
    const porteur = join(relative(VIRTUAL_ROOT, dossier), 'porteur-en-memoire.ts');
    const program = virtualProgram({
      [porteur]: "import { valeur as nombre } from './module-reel.mjs'; export const result = nombre;",
    }, { allowJs: true });
    assert.equal(Boolean(program.getSourceFile(reel.replaceAll('\\', '/'))), false);
    assert.equal(aliasCible(program, porteur, 'nombre').declarations, undefined);
    assert.ok(ts.getPreEmitDiagnostics(program).some((d) => d.code === 2307));
  } finally {
    unlinkSync(reel);
    rmdirSync(dossier);
  }
});

test('virtualProgram conserve le programme TypeScript par défaut', () => {
  const ts = typescript();
  const files = {
    'source.ts': 'export const valeur: number = 1;',
    'porteur.ts': "import { valeur as nombre } from './source'; export const result: number = nombre;",
  };
  for (const program of [virtualProgram(files), virtualProgram(files, { allowJs: false })]) {
    assert.equal(program.getCompilerOptions().allowJs, false);
    assert.equal(program.getCompilerOptions().strict, true);
    assert.equal(program.getCompilerOptions().noEmit, true);
    assert.equal(ts.getPreEmitDiagnostics(program).length, 0);
    assert.equal(aliasCible(program, 'porteur.ts', 'nombre').declarations[0].getSourceFile().fileName, chemin('source.ts'));
  }
});

test('virtualProgram refuse encore les racines JavaScript sans activation explicite', () => {
  const ts = typescript();
  const files = { 'racine.mjs': 'export const valeur = 1;' };
  for (const program of [virtualProgram(files), virtualProgram(files, { allowJs: false })]) {
    assert.equal(Boolean(program.getSourceFile(chemin('racine.mjs'))), false);
    assert.ok(ts.getPreEmitDiagnostics(program).some((d) => d.code === 6504));
  }
});
