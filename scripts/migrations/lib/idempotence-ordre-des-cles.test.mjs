import { strict as assert } from 'node:assert'

import fs from 'node:fs'

import os from 'node:os'

import path from 'node:path'

import test from 'node:test'

import { fileURLToPath } from 'node:url'

import { echapperRegex } from '../../../src/lib/regex.ts'

import { ANTIDATE, efface, joue } from './joue.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

const MIGRATIONS = path.join(RACINE, 'scripts/migrations');

const DATEES = fs
  .readdirSync(MIGRATIONS)
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.mjs$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en'));

const texteDe = (migration) => fs.readFileSync(path.join(MIGRATIONS, migration), 'utf8');

const LUS = ['scripts/guards/lib', 'src/gameIso/catalog/decor/defs'];

function depotJetable(fichier, transforme) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-idem-'));
  fs.mkdirSync(path.join(racine, 'src/data'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'scripts/migrations'), { recursive: true });
  for (const rel of LUS) fs.cpSync(path.join(RACINE, rel), path.join(racine, rel), { recursive: true });
  for (const f of fs.readdirSync(path.join(RACINE, 'src/data')))
    if (f.endsWith('.json')) fs.copyFileSync(path.join(RACINE, 'src/data', f), path.join(racine, 'src/data', f));

  const cible = path.join(racine, 'src/data', fichier);
  const avant = `${JSON.stringify(transforme(JSON.parse(fs.readFileSync(cible, 'utf8'))), null, 2)}`;
  fs.writeFileSync(cible, avant, 'utf8');
  return { racine, cible, avant };
}

const PORTEURS_ID_EN_TETE = DATEES.filter((m) => /Object\.keys\(e\)\.indexOf\('id'\)/.test(texteDe(m)));

const premierDataset = (migration) => {
  const texte = texteDe(migration);
  const table = /const TYPES = \{([\s\S]*?)\n\};/.exec(texte);
  const dans = table ? /'([^']+\.json)'\s*:/.exec(table[1]) : /const FICHIER = '([^']+\.json)'/.exec(texte);
  return dans ? dans[1] : null;
};

test('la porte `id` hors tête est portée par les 5 vagues d’enveloppe', () => {
  assert.ok(PORTEURS_ID_EN_TETE.length >= 5, `${PORTEURS_ID_EN_TETE.length} porteur(s) — la regex dérivée ne trouve plus rien`);
  for (const m of ['2026-08-28-l1b-11a-entite-type.mjs', '2026-08-28-l1b-11b-entite-type.mjs',
    '2026-08-28-l1b-12a-entite-type.mjs', '2026-08-28-l1b-12b-entite-type.mjs', '2026-08-28-l1b-14-oups-type.mjs']) {
    assert.ok(PORTEURS_ID_EN_TETE.includes(m), `${m} n’est plus reconnue porteuse de la porte \`id\` en tête`);
  }
});

for (const migration of PORTEURS_ID_EN_TETE) {
  const fichier = premierDataset(migration);
  test(`${migration} : \`id\` au rang 1 dans ${fichier} → sortie 1 NOMINATIVE, rien d’écrit`, (t) => {
    assert.ok(fichier, `${migration} : ni table \`TYPES\` ni \`FICHIER\` — le dataset de la morsure ne se dérive pas`);
    const { racine, cible, avant } = depotJetable(fichier, (doc) => {
      const { id, type, ...reste } = doc[0];
      return [{ type, id, ...reste }, ...doc.slice(1)];
    });
    t.after(() => efface(racine));
    const tete = JSON.parse(avant)[0];
    assert.equal(Object.keys(tete).indexOf('id'), 1, 'la fixture ne porte pas `id` au rang 1 — la morsure ne mesure rien');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    const mtimeAvant = fs.statSync(cible).mtimeMs;

    const r = joue(racine, migration);
    const sortie = `${r.stdout}${r.stderr}`;
    assert.equal(r.code, 1, `sortie ${r.code} — un \`id\` hors tête doit ARRÊTER la migration : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echapperRegex(fichier)), `arrêt MUET sur le fichier visé : ${sortie.slice(0, 500)}`);
    assert.match(sortie, /rang 1/, `arrêt sans NOMMER le rang de \`id\` : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echapperRegex(String(tete.id))), `arrêt sans NOMMER l’entrée : ${sortie.slice(0, 500)}`);
    assert.equal(fs.readFileSync(cible, 'utf8'), avant, `${fichier} RÉÉCRIT alors que l’arrêt précède toute écriture`);
    assert.equal(fs.statSync(cible).mtimeMs, mtimeAvant, `${fichier} touché (mtime) alors que l’arrêt précède toute écriture`);
  });
}

test('2026-08-28-l1b-12a-entite-type.mjs : `steam-breakdown.json` à `id` au rang 2 EST migré', (t) => {
  const { racine, cible, avant } = depotJetable('steam-breakdown.json', (doc) => doc.map((e) => {
    const { id, type, ...reste } = e;
    return { min: reste.min, max: reste.max, id, type, ...reste };
  }));
  t.after(() => efface(racine));
  assert.equal(Object.keys(JSON.parse(avant)[0]).indexOf('id'), 2, 'la fixture ne porte pas `id` au rang 2 — la morsure ne mesure rien');
  fs.utimesSync(cible, ANTIDATE, ANTIDATE);

  const r = joue(racine, '2026-08-28-l1b-12a-entite-type.mjs');
  assert.equal(r.code, 0, `sortie ${r.code} — ${r.stderr.slice(0, 900)}`);
  assert.doesNotMatch(r.stdout, /steam-breakdown\.json : no-op/, `no-op MUET sur une promotion de \`id\` due : ${r.stdout.slice(0, 500)}`);
  const apres = JSON.parse(fs.readFileSync(cible, 'utf8'));
  for (const e of apres) assert.deepEqual(Object.keys(e).slice(0, 2), ['id', 'type'], `${e.id} : tête ≠ id,type`);
  assert.notEqual(fs.readFileSync(cible, 'utf8'), avant, 'fichier inchangé alors que `id` restait au rang 2');
});

test('2026-09-02-1680-props-provenance.mjs : une entrée à `cover` privée de `maison` EST migrée', (t) => {
  let vise = null;
  const { racine, cible, avant } = depotJetable('props.json', (doc) => doc.map((e) => {
    if (vise || !e || e.cover === undefined || typeof e.maison !== 'string') return e;
    vise = e.id;
    const { maison: _absente, ...reste } = e;
    return reste;
  }));
  t.after(() => efface(racine));
  assert.ok(vise, 'aucune entrée à `cover` pourvue de `maison` dans props.json — la morsure ne mesure rien');

  const r = joue(racine, '2026-09-02-1680-props-provenance.mjs');
  assert.equal(r.code, 0, `sortie ${r.code} — ${r.stderr.slice(0, 900)}`);
  assert.match(r.stdout, /1 provenance\(s\)/, `compteur de provenances ≠ 1 : ${r.stdout.slice(0, 500)}`);
  const apres = JSON.parse(fs.readFileSync(cible, 'utf8'));
  assert.equal(typeof apres.find((e) => e.id === vise).maison, 'string', `${vise} : \`maison\` non écrite`);
  assert.notEqual(fs.readFileSync(cible, 'utf8'), avant, 'fichier inchangé alors qu’une provenance manquait');
});

const PORTEURS_DE_FORME = DATEES.filter((m) => /forme INATTENDUE/.test(texteDe(m)));

test('la porte de FORME est portée par les 4 vagues `entite`', () => {
  for (const m of ['2026-08-28-l1b-11a-entite-type.mjs', '2026-08-28-l1b-11b-entite-type.mjs',
    '2026-08-28-l1b-12a-entite-type.mjs', '2026-08-28-l1b-12b-entite-type.mjs']) {
    assert.ok(PORTEURS_DE_FORME.includes(m), `${m} n’est plus reconnue porteuse de la porte de FORME`);
  }
});

const TYPE_ETRANGER = 'document-d-une-autre-epoque';

for (const migration of PORTEURS_DE_FORME) {
  const fichier = premierDataset(migration);
  test(`${migration} : une entrée de ${fichier} ni à la forme SOURCE ni à la forme CIBLE → sortie 1 NOMINATIVE, rien d’écrit`, (t) => {
    assert.ok(fichier, `${migration} : ni table \`TYPES\` ni \`FICHIER\` — le dataset de la morsure ne se dérive pas`);
    const { racine, cible, avant } = depotJetable(fichier, (doc) => [{ ...doc[0], type: TYPE_ETRANGER }, ...doc.slice(1)]);
    t.after(() => efface(racine));
    const tete = JSON.parse(avant)[0];
    assert.equal(tete.type, TYPE_ETRANGER, 'la fixture ne porte pas le `type` étranger — la morsure ne mesure rien');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    const mtimeAvant = fs.statSync(cible).mtimeMs;

    const r = joue(racine, migration);
    const sortie = `${r.stdout}${r.stderr}`;
    assert.equal(r.code, 1, `sortie ${r.code} — une forme ÉTRANGÈRE doit ARRÊTER la migration : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echapperRegex(fichier)), `arrêt MUET sur le fichier visé : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echapperRegex(String(tete.id))), `arrêt sans NOMMER l’entrée : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echapperRegex(TYPE_ETRANGER)), `arrêt sans NOMMER la forme rencontrée : ${sortie.slice(0, 500)}`);
    assert.equal(fs.readFileSync(cible, 'utf8'), avant, `${fichier} RÉÉCRIT alors que l’arrêt précède toute écriture`);
    assert.equal(fs.statSync(cible).mtimeMs, mtimeAvant, `${fichier} touché (mtime) alors que l’arrêt précède toute écriture`);
  });
}
