// Banc de la migration `2026-09-20-1825-stocks-atlas-chemins-par-coeur.mjs` — jouée par `joue` dans
// un DÉPÔT JETABLE sous `os.tmpdir()`, jamais sur l'arbre réel. Sous `lib/` : un `.mjs` sans préfixe
// daté à la racine des migrations y est inclassable (scripts/migrations/replay.mjs:90, :175-177).
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { coeursDuRegistre } from '../../raw/_lib.mjs';
import { joue } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATION = '2026-09-20-1825-stocks-atlas-chemins-par-coeur.mjs';

/** Ce que la migration LIT hors de l'Atlas et des stocks : la couture `_lib.mjs` et ses imports. */
const LUS = ['scripts/raw', 'scripts/guards/lib', 'scripts/port-dev.mjs', 'scripts/source/nom-ascii.mjs', 'src/data/books.json', 'src/data/hash.ts', 'src/data/source'];

// Chemins d'Atlas composés à l'exécution : scripts/docs/check-doc-refs.mjs:262 (`DOC_REF_RE`, l.247).
const RAWDIR = path.posix.join('docs', 'raw');
const STOCK = 'scripts/raw/reanchor-low-stock.json';
const AUTRES_STOCKS = ['scripts/raw/graphy-stock.json', 'scripts/raw/reconciliation-stock.json'];

const ANTIDATE = new Date('2000-01-01T00:00:00Z');

/** Les deux premiers cœurs du registre — jamais un nom de cœur écrit ici. */
const deuxCoeurs = () => {
  const coeurs = coeursDuRegistre();
  assert.ok(coeurs.length >= 2, `le registre ne déclare que ${coeurs.length} cœur(s) : l'homonymie inter-cœurs n'est pas jouable`);
  return coeurs.slice(0, 2);
};

/** Le texte d'un stock tel que le banc le pose. */
const texteDe = (doc) => `${JSON.stringify(doc, null, 2)}\n`;

/**
 * Dépôt jetable : les `LUS` copiés, les `pages` (chemins relatifs à l'Atlas), `STOCK` posé à `doc`
 * et les autres stocks vides — tous antidatés. REND `{ racine, stocks }` — `stocks` : chemin
 * absolu -> texte posé.
 */
function depot(t, pages, doc) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-1825-'));
  t.after(() => fs.rmSync(racine, { recursive: true, force: true }));
  for (const rel of LUS) fs.cpSync(path.join(RACINE, rel), path.join(racine, rel), { recursive: true });
  for (const page of pages) {
    const abs = path.join(racine, RAWDIR, page);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '# page\n', 'utf8');
  }
  const stocks = new Map();
  const pose = (rel, contenu) => {
    const abs = path.join(racine, rel);
    const texte = texteDe(contenu);
    fs.writeFileSync(abs, texte, 'utf8');
    fs.utimesSync(abs, ANTIDATE, ANTIDATE);
    stocks.set(abs, texte);
  };
  pose(STOCK, doc);
  for (const rel of AUTRES_STOCKS) pose(rel, { entrees: [] });
  return { racine, stocks };
}

/** Stocks non réécrits : octet ET horodatage. */
const intacts = (stocks) => {
  for (const [abs, texte] of stocks) {
    assert.equal(fs.readFileSync(abs, 'utf8'), texte, `${abs} réécrit`);
    assert.equal(fs.statSync(abs).mtimeMs, ANTIDATE.getTime(), `${abs} touché`);
  }
};

/** Les lignes d'anomalie du fail-fast groupé. */
const lignesDAnomalie = (stderr) => stderr.split(/\r?\n/u).filter((l) => l.startsWith('  - '));

test('un nom CITÉ À PLAT que deux cœurs portent : sortie 1, UNE anomalie nommant le stock et les deux cœurs, rien d’écrit', (t) => {
  const [a, b] = deuxCoeurs();
  const plat = `${RAWDIR}/x.md`;
  const { racine, stocks } = depot(t, [`${a}/x.md`, `${b}/x.md`], {
    quoi: `Dette citée en prose : ${plat}.`,
    entrees: [{ fichier: plat, occurrence: 1 }],
  });
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 1, r.sortie);
  assert.match(r.stderr, /AUCUNE écriture/u);
  const lignes = lignesDAnomalie(r.stderr);
  assert.equal(lignes.length, 1, r.stderr);
  assert.ok(lignes[0].includes(STOCK), lignes[0]);
  assert.ok(lignes[0].includes(`${a}/x.md`) && lignes[0].includes(`${b}/x.md`), lignes[0]);
  intacts(stocks);
});

test('un nom que deux cœurs portent, cité PAR SON CŒUR : sortie 0, RIEN À FAIRE, rien d’écrit', (t) => {
  const [a, b] = deuxCoeurs();
  const { racine, stocks } = depot(t, [`${a}/x.md`, `${b}/x.md`], {
    entrees: [{ fichier: `${RAWDIR}/${a}/x.md`, occurrence: 1 }],
  });
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.stdout, /RIEN À FAIRE/u);
  intacts(stocks);
});

test('MIXTE — un homonyme NON cité et un nom à UN cœur cité à plat : sortie 0, seul ce chemin prend son cœur', (t) => {
  const [a, b] = deuxCoeurs();
  const { racine, stocks } = depot(t, [`${a}/x.md`, `${b}/x.md`, `${a}/y.md`], {
    entrees: [{ fichier: `${RAWDIR}/y.md`, occurrence: 1 }],
  });
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 0, r.sortie);
  const abs = path.join(racine, STOCK);
  assert.equal(
    fs.readFileSync(abs, 'utf8'),
    texteDe({ entrees: [{ fichier: `${RAWDIR}/${a}/y.md`, occurrence: 1 }] }),
  );
  stocks.delete(abs);
  intacts(stocks);
});

test('un stock SOLDÉ, ABSENT du disque : sortie 0, RIEN À FAIRE, le stock n’est pas recréé', (t) => {
  const [a] = deuxCoeurs();
  const { racine, stocks } = depot(t, [`${a}/y.md`], { entrees: [] });
  const abs = path.join(racine, STOCK);
  fs.rmSync(abs);
  stocks.delete(abs);
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.stdout, /RIEN À FAIRE/u);
  assert.equal(fs.existsSync(abs), false, `${STOCK} recréé`);
  intacts(stocks);
});
