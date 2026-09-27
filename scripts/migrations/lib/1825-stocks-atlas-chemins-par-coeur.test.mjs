// Banc de la migration `2026-09-20-1825-stocks-atlas-chemins-par-coeur.mjs` — jouée par `joue` dans
// un DÉPÔT JETABLE sous `os.tmpdir()`, jamais sur l'arbre réel. Sous `lib/` : un `.mjs` sans préfixe
// daté à la racine des migrations y est inclassable (scripts/migrations/replay.mjs:90, :175-177).
import { strict as assert } from 'node:assert';
import path from 'node:path';
import test from 'node:test';

import { coeursDuRegistre } from '../../raw/_lib.mjs';
import { serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-20-1825-stocks-atlas-chemins-par-coeur.mjs';

/** Ce que la migration LIT hors de l'Atlas et des stocks : la couture `_lib.mjs` et ses imports. */
const LUS = ['scripts/raw', 'scripts/guards/lib', 'scripts/port-dev.mjs', 'scripts/source/nom-ascii.mjs', 'src/data/books.json', 'src/data/hash.ts', 'src/data/source'];

// Chemins d'Atlas composés à l'exécution : scripts/docs/check-doc-refs.mjs:262 (`DOC_REF_RE`, l.247).
const RAWDIR = path.posix.join('docs', 'raw');
const STOCK = 'scripts/raw/reanchor-low-stock.json';
const AUTRES_STOCKS = ['scripts/raw/graphy-stock.json', 'scripts/raw/reconciliation-stock.json'];

/** Les deux premiers cœurs du registre — jamais un nom de cœur écrit ici. */
const deuxCoeurs = () => {
  const coeurs = coeursDuRegistre();
  assert.ok(coeurs.length >= 2, `le registre ne déclare que ${coeurs.length} cœur(s) : l'homonymie inter-cœurs n'est pas jouable`);
  return coeurs.slice(0, 2);
};

/** Le texte d'un stock tel que le banc le pose. */
const texteDe = (doc) => serialise(doc, { indent: 2, nl: true });

/**
 * Dépôt jetable : les `LUS` copiés, `STOCK` posé à `doc` — ABSENT sans `doc` —, les autres stocks
 * vides et les `pages` (chemins relatifs à l'Atlas), tous antidatés. REND `{ racine, avant }`.
 */
function depotAtlas(t, pages, doc) {
  const d = depot({
    ...(doc === undefined ? {} : { [STOCK]: texteDe(doc) }),
    ...Object.fromEntries(AUTRES_STOCKS.map((rel) => [rel, texteDe({ entrees: [] })])),
    ...Object.fromEntries(pages.map((page) => [path.posix.join(RAWDIR, page), '# page\n'])),
  }, LUS);
  t.after(() => efface(d.racine));
  return d;
}

/** Les lignes d'anomalie du fail-fast groupé. */
const lignesDAnomalie = (stderr) => stderr.split(/\r?\n/u).filter((l) => l.startsWith('  - '));

test('un nom CITÉ À PLAT que deux cœurs portent : sortie 1, UNE anomalie nommant le stock et les deux cœurs, rien d’écrit', (t) => {
  const [a, b] = deuxCoeurs();
  const plat = `${RAWDIR}/x.md`;
  const { racine, avant } = depotAtlas(t, [`${a}/x.md`, `${b}/x.md`], {
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
  assert.deepEqual(rienTouche(racine, avant), []);
});

test('un nom que deux cœurs portent, cité PAR SON CŒUR : sortie 0, RIEN À FAIRE, rien d’écrit', (t) => {
  const [a, b] = deuxCoeurs();
  const { racine, avant } = depotAtlas(t, [`${a}/x.md`, `${b}/x.md`], {
    entrees: [{ fichier: `${RAWDIR}/${a}/x.md`, occurrence: 1 }],
  });
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.stdout, /RIEN À FAIRE/u);
  assert.deepEqual(rienTouche(racine, avant), []);
});

test('MIXTE — un homonyme NON cité et un nom à UN cœur cité à plat : sortie 0, seul ce chemin prend son cœur', (t) => {
  const [a, b] = deuxCoeurs();
  const { racine, avant } = depotAtlas(t, [`${a}/x.md`, `${b}/x.md`, `${a}/y.md`], {
    entrees: [{ fichier: `${RAWDIR}/y.md`, occurrence: 1 }],
  });
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 0, r.sortie);
  assert.equal(
    lireDans(racine, STOCK),
    texteDe({ entrees: [{ fichier: `${RAWDIR}/${a}/y.md`, occurrence: 1 }] }),
  );
  avant.delete(STOCK);
  assert.deepEqual(rienTouche(racine, avant), []);
});

test('un stock SOLDÉ, ABSENT du disque : sortie 0, RIEN À FAIRE, le stock n’est pas recréé', (t) => {
  const [a] = deuxCoeurs();
  const { racine, avant } = depotAtlas(t, [`${a}/y.md`]);
  assert.throws(() => lireDans(racine, STOCK), { code: 'ENOENT' }, `${STOCK} présent avant le jeu : le cas ne joue pas un stock SOLDÉ`);
  const r = joue(racine, MIGRATION);
  assert.equal(r.code, 0, r.sortie);
  assert.match(r.stdout, /RIEN À FAIRE/u);
  assert.throws(() => lireDans(racine, STOCK), { code: 'ENOENT' }, `${STOCK} recréé`);
  assert.deepEqual(rienTouche(racine, avant), []);
});
