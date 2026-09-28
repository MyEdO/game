/**
 * Les TÉMOINS d'écriture du dépôt jetable (`./joue.mjs`) mordent : `crees` voit un fichier que la
 * migration a posé à côté des fichiers posés, `rienTouche` voit un octet ou un horodatage remonté.
 * Un témoin qui rendrait toujours `[]` laisserait passer toute écriture d'un rouge d'avant-écriture.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { crees, depot, efface, rienTouche } from './joue.mjs';

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
