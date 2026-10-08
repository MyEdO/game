/**
 * Les TÉMOINS d'écriture du dépôt jetable (`./joue.mjs`) mordent : `crees` voit un fichier que la
 * migration a posé à côté des fichiers posés, `rienTouche` voit un octet ou un horodatage remonté.
 * Un témoin qui rendrait toujours `[]` laisserait passer toute écriture d'un rouge d'avant-écriture.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { crees, depot, efface, joue, rienTouche } from './joue.mjs';

test('joue transporte les imports statiques hors de la copie et conserve les fichiers posés', (t) => {
  const banc = "import { parUnitesDeCode } from './scripts/guards/lib/lister.mjs'; console.log(['b', 'a'].sort(parUnitesDeCode).join(','));";
  for (const remplacement of [null, 'export const parUnitesDeCode = (a, b) => a < b ? 1 : a > b ? -1 : 0; export const parLibelle = parUnitesDeCode;']) {
    const fichiers = { 'banc.mjs': banc, ...(remplacement === null ? {} : { 'src/lib/ordre.mjs': remplacement }) };
    const d = depot(fichiers, ['scripts/guards/lib/lister.mjs']);
    t.after(() => efface(d.racine));
    const migration = joue(d.racine, '../guards/lib/lister.mjs');
    assert.equal(migration.code, 0, migration.sortie);
    assert.ok(fs.existsSync(path.join(d.racine, 'src/lib/ordre.mjs')));
    const execution = spawnSync(process.execPath, [path.join(d.racine, 'banc.mjs')], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(execution.error, undefined);
    assert.equal(execution.status, 0, execution.stdout + execution.stderr);
    assert.equal(execution.stdout.trim(), remplacement === null ? 'a,b' : 'b,a');
    assert.deepEqual(rienTouche(d.racine, d.avant), []);
  }
});

test('`crees` NOMME le fichier créé dans le dossier surveillé, et lui seul', (t) => {
  const d = depot({ 'src/data/a.json': '[]' });
  t.after(() => efface(d.racine));
  assert.deepEqual(crees(d.racine, d.avant, 'src/data'), [], 'un dépôt intact porte déjà un fichier « créé »');
  fs.writeFileSync(path.join(d.racine, 'src/data/b.json'), '[]', 'utf8');
  assert.deepEqual(crees(d.racine, d.avant, 'src/data'), ['src/data/b.json : fichier CRÉÉ']);
});

test('`rienTouche` NOMME une réécriture à contenu égal (horodatage) et un octet divergent', (t) => {
  const d = depot({ 'src/data/a.json': '[]', 'src/data/b.json': '{}' });
  t.after(() => efface(d.racine));
  assert.deepEqual(rienTouche(d.racine, d.avant), []);
  fs.writeFileSync(path.join(d.racine, 'src/data/a.json'), '[]', 'utf8');
  fs.writeFileSync(path.join(d.racine, 'src/data/b.json'), '{"x":1}', 'utf8');
  assert.deepEqual(rienTouche(d.racine, d.avant), [
    'src/data/a.json : horodatage remonté (écriture)',
    'src/data/b.json : octet DIVERGENT',
    'src/data/b.json : horodatage remonté (écriture)',
  ]);
});
