import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileResilient } from './lib/spawnResilient.mjs';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const empreintes = { '7.0.2': '93e6a612f8594b4bfa07af28548a182ce2e63ed22028316d7778c8643f9a760e' };

export function verifierInstallation(root = racine) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const versions = [manifest.dependencies?.typescript, manifest.devDependencies?.typescript, manifest.optionalDependencies?.typescript].filter(v => v !== undefined);
  assert.equal(versions.length, 1, 'Une unique dépendance TypeScript est requise');
  const version = versions[0];
  assert.match(version, /^\d+\.\d+\.\d+$/, 'La version TypeScript doit être exacte');
  const patch = path.join(root, 'patches', `typescript+${version}.patch`);
  assert.ok(fs.existsSync(patch), `Patch TypeScript absent : ${patch}`);
  const installe = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/typescript/package.json'), 'utf8'));
  assert.equal(installe.version, version, 'La version TypeScript installée diffère du manifest');
  return version;
}

export function appliquerPatch(root = racine) {
  const version = verifierInstallation(root);
  const patch = path.resolve(root, 'patches', `typescript+${version}.patch`);
  assert.ok(Object.hasOwn(empreintes, version), 'Aucune empreinte de patch approuvée pour cette version TypeScript');
  assert.equal(createHash('sha256').update(fs.readFileSync(patch)).digest('hex'), empreintes[version], 'Empreinte du patch TypeScript non conforme');
  const cible = 'node_modules/typescript/dist/api/node/wtf8.js';
  const git = options => execFileResilient('git', ['-c', 'core.autocrlf=false', 'apply', '--whitespace=error', `--include=${cible}`, ...options, patch], { cwd: path.resolve(root), encoding: 'utf8', stdio: 'pipe' }, { site: 'contrat-typescript' });
  try {
    git(['--check']);
  } catch (erreur) {
    if (erreur.status !== 1) throw erreur;
    try {
      git(['--reverse', '--check']);
    } catch (inverse) {
      throw new AggregateError([erreur, inverse], 'Patch TypeScript inapplicable', { cause: inverse });
    }
    return false;
  }
  git([]);
  return true;
}

export async function verifierApiNative() {
  const { typescript } = await import('./lib/dialecte.mjs');
  const { libererSessions, virtualProgram, VIRTUAL_ROOT } = await import('./lib/tsProgram.mjs');
  const texte = '\uFEFFconst initial = "\uFEFFx";\r\n  export const segments = "\\uD800\\uFEFFx";';
  const invalide = '\uFEFFconst accent = "é😀";\r\nconst echec = ;';
  const fichiers = { 'contrat.ts': texte, 'diagnostic.ts': invalide };
  const session = virtualProgram(fichiers, { noLib: true, noResolve: true });
  const erreurs = [];
  try {
    const ts = typescript();
    const nom = path.resolve(VIRTUAL_ROOT, 'contrat.ts').replaceAll('\\', '/');
    const sf = session.program.getSourceFile(nom);
    assert.ok(sf, 'Source native absente');
    assert.equal(sf.text, texte, 'Le texte source UTF-16 doit rester exact');
    assert.equal(sf.end, texte.length);
    assert.deepEqual(session.program.getSyntacticDiagnostics(nom), []);
    const valeurs = [];
    for (const statement of sf.statements) {
      assert.equal(statement.getText(sf), texte.slice(statement.getStart(sf), statement.end));
      assert.ok(ts.isVariableStatement(statement));
      const literal = statement.declarationList.declarations[0].initializer;
      assert.ok(literal && ts.isStringLiteral(literal));
      valeurs.push(literal.text);
      assert.equal(literal.getText(sf), texte.slice(literal.getStart(sf), literal.end));
    }
    assert.deepEqual(valeurs, ['\uFEFFx', '\uD800\uFEFFx']);
    assert.equal(sf.statements[1].getStart(sf), texte.indexOf('export'));
    const diagnostics = session.program.getSyntacticDiagnostics(path.resolve(VIRTUAL_ROOT, 'diagnostic.ts').replaceAll('\\', '/'));
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].pos, invalide.lastIndexOf(';'));
    assert.equal(diagnostics[0].end, invalide.lastIndexOf(';') + 1);
  } catch (erreur) {
    erreurs.push(erreur);
  } finally {
    libererSessions([session], erreurs);
  }
}

export async function verifierContratTypeScript() {
  appliquerPatch();
  await verifierApiNative();
}

if (import.meta.main) {
  await verifierContratTypeScript();
  console.log('Contrat TypeScript : installation et UTF-16 natif conformes');
}
