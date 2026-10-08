import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { clotureDImports } from './lib/importGraph.mjs';
import { appliquerPatch, verifierInstallation, verifierApiNative, verifierContratTypeScript } from './contrat-typescript.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = manifest.devDependencies.typescript;
const nomPatch = `typescript+${version}.patch`;

function installation(t) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'contrat-typescript-'));
  t.after(() => fs.rmSync(dossier, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dossier, 'node_modules/typescript'), { recursive: true });
  fs.mkdirSync(path.join(dossier, 'patches'));
  fs.writeFileSync(path.join(dossier, 'package.json'), JSON.stringify({ devDependencies: { typescript: version } }));
  fs.writeFileSync(path.join(dossier, 'node_modules/typescript/package.json'), JSON.stringify({ name: 'typescript', version }));
  fs.copyFileSync(path.join(root, 'patches', nomPatch), path.join(dossier, 'patches', nomPatch));
  return dossier;
}

test('le contrat réel valide installation et API native UTF-16', async () => {
  assert.equal(verifierInstallation(), version);
  await verifierApiNative();
  await verifierContratTypeScript();
});

test('un patch absent refuse installation avant toute analyse native', t => {
  const dossier = installation(t);
  fs.unlinkSync(path.join(dossier, 'patches', nomPatch));
  assert.throws(() => appliquerPatch(dossier), /Patch TypeScript absent/);
});

test('une version installée différente refuse installation', t => {
  const dossier = installation(t);
  fs.writeFileSync(path.join(dossier, 'node_modules/typescript/package.json'), JSON.stringify({ version: '7.0.1' }));
  assert.throws(() => appliquerPatch(dossier), /version TypeScript installée diffère/);
});

test('la dépendance TypeScript doit être unique et exacte', t => {
  const dossier = installation(t);
  const fichier = path.join(dossier, 'package.json');
  fs.writeFileSync(fichier, JSON.stringify({ devDependencies: { typescript: `^${version}` } }));
  assert.throws(() => verifierInstallation(dossier), /version TypeScript doit être exacte/);
  fs.writeFileSync(fichier, JSON.stringify({ dependencies: { typescript: version }, devDependencies: { typescript: version } }));
  assert.throws(() => verifierInstallation(dossier), /unique dépendance TypeScript/);
});

test('Git refuse un patch inapplicable dans une installation isolée', t => {
  const dossier = installation(t);
  const cible = path.join(dossier, 'node_modules/typescript/dist/api/node/wtf8.js');
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, 'export const autre = 1;\n');
  assert.throws(() => appliquerPatch(dossier), /Correctif inapplicable/);
  assert.equal(fs.readFileSync(cible, 'utf8'), 'export const autre = 1;\n');
});

test('le contrat précède hooks et générateurs dans postinstall', () => {
  assert.ok(manifest.scripts.postinstall.startsWith('node scripts/guards/contrat-typescript.mjs && git config core.hooksPath'));
});

test('un patch vide, incomplet ou altéré est refusé même avec un décodeur corrigé', t => {
  const dossier = installation(t);
  const cible = path.join(dossier, 'node_modules/typescript/dist/api/node/wtf8.js');
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.copyFileSync(path.join(root, 'node_modules/typescript/dist/api/node/wtf8.js'), cible);
  const patch = fs.readFileSync(path.join(root, 'patches', nomPatch), 'utf8');
  for (const contenu of ['', patch.replace('+        super("utf-8", { ignoreBOM: true });\n', ''), patch.replace('ignoreBOM: true', 'ignoreBOM: false')]) {
    fs.writeFileSync(path.join(dossier, 'patches', nomPatch), contenu);
    assert.throws(() => appliquerPatch(dossier), /Empreinte du patch TypeScript non conforme/);
  }
});

test('Git applique le patch initial puis le contrat natif démarre et se répète', t => {
  const dossier = installation(t);
  fs.cpSync(path.join(root, 'node_modules/typescript'), path.join(dossier, 'node_modules/typescript'), { recursive: true });
  const paquet = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/typescript/package.json'), 'utf8'));
  for (const nom of Object.keys(paquet.optionalDependencies)) {
    const origine = path.join(root, 'node_modules', nom);
    if (fs.existsSync(origine)) fs.cpSync(origine, path.join(dossier, 'node_modules', nom), { recursive: true });
  }
  for (const rel of clotureDImports(['scripts/guards/contrat-typescript.mjs'], { racine: root, dynamiques: true, typesEffaces: true })) {
    const destination = path.join(dossier, rel);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, rel), destination);
  }
  const cible = path.join(dossier, 'node_modules/typescript/dist/api/node/wtf8.js');
  const corrige = fs.readFileSync(cible, 'utf8');
  const constructeur = '    constructor() {\n        super("utf-8", { ignoreBOM: true });\n    }\n';
  assert.ok(corrige.includes(constructeur));
  fs.writeFileSync(cible, corrige.replace(constructeur, ''));
  for (let repetition = 0; repetition < 2; repetition++) {
    const execution = spawnSync(process.execPath, [path.join(dossier, 'scripts/guards/contrat-typescript.mjs')], { cwd: dossier, encoding: 'utf8', timeout: 30_000 });
    assert.equal(execution.error, undefined);
    assert.equal(execution.signal, null);
    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.match(execution.stdout, /installation et UTF-16 natif conformes/);
    assert.equal(fs.readFileSync(cible, 'utf8'), corrige);
  }
});
