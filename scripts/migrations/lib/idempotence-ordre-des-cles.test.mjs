/**
 * MORSURE — une migration DATÉE n'écrit que ce qu'elle POSSÈDE (#1657).
 *
 * Le no-op d'une migration ne peut pas se décider par une égalité à l'OCTET du fichier entier :
 * plusieurs de ces scripts NORMALISENT l'enveloppe des documents qu'ils rendent (`label` en 2ᵉ clé
 * pour la vague 10, `id`/`type` en tête pour les vagues 11 et 12, `id`/`type`/`label` en tête pour
 * les vagues 7a/8a, `ORDRE_DES_CLES` pour `2026-09-02-1680-props-provenance.mjs`). Sur un fichier
 * dont les clés sont dans un AUTRE ordre, cette normalisation suffit à faire diverger le texte : le
 * script réécrit un fichier qu'il n'a sémantiquement rien à changer, et `npm run migrations:replay`
 * rend ROUGE.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ — un `.test.mjs` posé à côté des migrations y serait rejoué ou refusé.
 *
 * Quatre familles de cas, toutes DÉRIVÉES du dossier des migrations — aucune liste cueillie :
 *
 *  1. NO-OP SUR CORPUS RENVERSÉ : `src/data` ENTIER est recopié dans un dépôt jetable, clés
 *     renversées document par document, puis TOUTES les migrations datées y sont rejouées une à une.
 *     Exigé : zéro réécriture (octet ET horodatage), et sortie 0 partout.
 *  2. FAIL-FAST `id` HORS TÊTE : pour chaque migration qui porte cette porte (dérivée du motif
 *     `Object.keys(e).indexOf('id')`), le premier dataset de sa table reçoit son entrée de tête avec
 *     `id` repoussé au rang 1. Exigé : sortie 1, message NOMINATIF, fichier ni réécrit ni touché.
 *  3. Les deux morsures INVERSES — une entrée à `cover` privée de sa `maison`, un
 *     `steam-breakdown.json` dont `id` n'ouvre plus l'entrée DOIVENT être migrés : un no-op qui
 *     avale tout ne prouverait rien.
 *  4. PORTE DE FORME (#1812) : ce qui protège d'un rejeu sur une donnée d'une AUTRE époque est la
 *     FORME des entrées, jamais leur NOMBRE. Pour chaque migration qui porte cette porte (dérivée du
 *     motif de son message), la première entrée de son premier dataset reçoit un `type` ÉTRANGER :
 *     ni la forme source ni la forme cible. Exigé : sortie 1, message NOMINATIF, rien d'écrit.
 *     Sa garde de CLASSE — « +1 entrée ne coûte rien » — ne lit pas le code mais fabrique l'ajout et
 *     rejoue tout : `npm run migrations:replay:croissance` (`lib/croissance.mjs`).
 *
 * CE QUE LE RENVERSEMENT PRÉSERVE : la TÊTE d'enveloppe, jamais la queue. Sur une entrée de racine
 * tableau, `id` reste en tête (l'invariant que les vagues 9 à 12 posent et vérifient) ; sur une
 * racine OBJET, c'est le préfixe de clés d'enveloppe (`CLES_ENVELOPPE`, dérivé de
 * `src/data/schemas/grammaire/document.ts`) qui reste en place — le défaire mesurerait la violation
 * d'un invariant que les migrations POSSÈDENT au lieu de l'ordre des AUTRES clés.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { ANTIDATE, efface, joue } from './joue.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATIONS = path.join(RACINE, 'scripts/migrations');

/** Les migrations DATÉES du dossier, dans l'ordre lexical — le périmètre que `replay.mjs` rejoue. */
const DATEES = fs
  .readdirSync(MIGRATIONS)
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.mjs$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en'));

/** Le texte d'une migration — les dérivations ci-dessous s'y font par motif. */
const texteDe = (migration) => fs.readFileSync(path.join(MIGRATIONS, migration), 'utf8');

/**
 * Ce que les migrations mesurées LISENT hors `src/data` : la lib de dérivation des labels d'art et
 * les defs d'art dont elle tire le label. COPIÉ, jamais monté en lien : le dépôt jetable ne doit
 * porter aucun chemin qui débouche sur l'arbre réel.
 */
const LUS = ['scripts/guards/lib', 'src/gameIso/catalog/decor/defs'];

/**
 * Dépôt jetable : une COPIE de `src/data` (les migrations y écrivent) et des seuls répertoires que
 * les migrations lisent. `transforme` reçoit le document lu et rend celui à poser.
 * REND `{ racine, cible, avant }` — `avant` étant le texte posé, référence de la comparaison.
 */
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

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Les clés d'ENVELOPPE, dérivées du texte de la grammaire — jamais recopiées ici. */
const CLES_ENVELOPPE = (() => {
  const grammaire = fs.readFileSync(path.join(RACINE, 'src/data/schemas/grammaire/document.ts'), 'utf8');
  const m = /export const CLES_ENVELOPPE = \[([^\]]*)\]/.exec(grammaire);
  assert.ok(m, 'CLES_ENVELOPPE introuvable dans `src/data/schemas/grammaire/document.ts`');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/gu, '')).filter(Boolean);
})();

/** Une ENTRÉE aux clés renversées, `id` maintenu en tête (cf. en-tête). */
const renverseEntree = (e) => (estObjet(e)
  ? Object.fromEntries([['id', e.id], ...Object.entries(e).filter(([k]) => k !== 'id').reverse()]) : e);

/** Une RACINE OBJET aux clés renversées, son préfixe d'enveloppe maintenu en place (cf. en-tête). */
const renverseRacine = (doc) => {
  const cles = Object.keys(doc);
  let tete = 0;
  while (tete < cles.length && CLES_ENVELOPPE.includes(cles[tete])) tete++;
  return Object.fromEntries([
    ...cles.slice(0, tete).map((k) => [k, doc[k]]),
    ...cles.slice(tete).map((k) => [k, doc[k]]).reverse(),
  ]);
};

/** Le document, même contenu, AUTRE sérialisation. Ce qui n'est ni entrée ni racine à `id` passe. */
const renverse = (doc) => {
  if (Array.isArray(doc)) return doc.map(renverseEntree);
  if (estObjet(doc) && typeof doc.id === 'string') return renverseRacine(doc);
  return doc;
};

// --- 1. NO-OP SUR LE CORPUS ENTIER, CLÉS RENVERSÉES ---------------------------------------------

/**
 * Ce que le dépôt jetable doit porter pour qu'une migration échoue sur son CONTRAT et jamais sur une
 * absence de dépôt. Mesuré en retirant chaque poste : sans `Source/`, quatre migrations sortent 1 sur
 * une extraction introuvable — une raison de dépôt, pas de contrat. COPIE PURE : aucun lien.
 *
 * Ce que les migrations lisent de `Source/`, ce sont les extractions `.md` ; les `.pdf` (4,7 Go,
 * gitignorés) sont écartés de la copie par leur EXTENSION — jamais par le nom de leur dossier.
 */
const CORPUS = ['src/data', 'src/scenes', 'scripts', 'src/gameIso/catalog', 'docs/raw', 'Source'];

test('les migrations DATÉES sont NO-OP sur `src/data` ENTIER aux clés renversées', (t) => {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-corpus-'));
  t.after(() => efface(racine));
  for (const rel of CORPUS)
    fs.cpSync(path.join(RACINE, rel), path.join(racine, rel), {
      recursive: true,
      filter: (src) => path.extname(src).toLowerCase() !== '.pdf',
    });

  const data = path.join(racine, 'src/data');
  const jsons = fs.readdirSync(data).filter((f) => f.endsWith('.json'));
  // Plancher 121 → 119 (#1686 lot 2) : les trois catalogues de matières fusionnent en `materials.json`.
  assert.ok(jsons.length >= 119, `corpus de ${jsons.length} document(s) — la copie n'a pas pris \`src/data\``);

  /** Le corpus RENVERSÉ, posé et gardé en référence : toute divergence ultérieure est une écriture. */
  const avant = new Map();
  for (const f of jsons) {
    const cible = path.join(data, f);
    const texte = `${JSON.stringify(renverse(JSON.parse(fs.readFileSync(cible, 'utf8'))), null, 2)}`;
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(f, texte);
  }

  const fautes = [];
  for (const migration of DATEES) {
    const r = joue(racine, migration);
    if (r.code !== 0) {
      const queue = `${r.stdout}${r.stderr}`.trim().split(/\r?\n/).slice(-4).join(' / ');
      fautes.push(`${migration} : sortie ${r.code} — ${queue}`);
    }
    const touches = jsons.filter((f) => fs.statSync(path.join(data, f)).mtimeMs !== ANTIDATE.getTime());
    for (const f of touches) {
      const octets = fs.readFileSync(path.join(data, f), 'utf8') === avant.get(f) ? 'octet IDENTIQUE' : 'octet DIVERGENT';
      fautes.push(`${migration} : ${f} RÉÉCRIT alors que rien n’a changé (${octets})`);
      fs.writeFileSync(path.join(data, f), avant.get(f), 'utf8');
      fs.utimesSync(path.join(data, f), ANTIDATE, ANTIDATE);
    }
  }

  for (const f of jsons) {
    if (fs.readFileSync(path.join(data, f), 'utf8') !== avant.get(f)) fautes.push(`${f} : corpus ALTÉRÉ à l’issue du rejeu`);
  }
  assert.deepEqual(fautes, [], `${fautes.length} faute(s) sur ${DATEES.length} migration(s) :\n  ${fautes.join('\n  ')}`);
});

// --- 2. FAIL-FAST « `id` HORS TÊTE » -------------------------------------------------------------

/** Les migrations qui portent la porte `id` hors tête — DÉRIVÉES du motif qui la code. */
const PORTEURS_ID_EN_TETE = DATEES.filter((m) => /Object\.keys\(e\)\.indexOf\('id'\)/.test(texteDe(m)));

/**
 * Le PREMIER dataset qu'une migration traite : la première clé de sa table `TYPES`, ou son unique
 * `FICHIER` quand elle n'en tient qu'un. Rendu `null` si la migration ne déclare ni l'un ni l'autre —
 * le cas le NOMME plutôt que de le sauter.
 */
const premierDataset = (migration) => {
  const texte = texteDe(migration);
  const table = /const TYPES = \{([\s\S]*?)\n\};/.exec(texte);
  const dans = table ? /'([^']+\.json)'\s*:/.exec(table[1]) : /const FICHIER = '([^']+\.json)'/.exec(texte);
  return dans ? dans[1] : null;
};

test('la porte `id` hors tête est portée par les 5 vagues d’enveloppe', () => {
  assert.ok(PORTEURS_ID_EN_TETE.length >= 5, `${PORTEURS_ID_EN_TETE.length} porteur(s) — le motif dérivé ne trouve plus rien`);
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
    const echappe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    assert.equal(r.code, 1, `sortie ${r.code} — un \`id\` hors tête doit ARRÊTER la migration : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echappe(fichier)), `arrêt MUET sur le fichier visé : ${sortie.slice(0, 500)}`);
    assert.match(sortie, /rang 1/, `arrêt sans NOMMER le rang de \`id\` : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echappe(tete.id)), `arrêt sans NOMMER l’entrée : ${sortie.slice(0, 500)}`);
    assert.equal(fs.readFileSync(cible, 'utf8'), avant, `${fichier} RÉÉCRIT alors que l’arrêt précède toute écriture`);
    assert.equal(fs.statSync(cible).mtimeMs, mtimeAvant, `${fichier} touché (mtime) alors que l’arrêt précède toute écriture`);
  });
}

// --- 3. MORSURES INVERSES ------------------------------------------------------------------------

/**
 * MORSURE INVERSE de la PROMOTION de `id` — `2026-08-28-l1b-12a-entite-type.mjs` DÉCLARE
 * (`ID_PROMU`) que `steam-breakdown.json` ouvrait ses entrées sur sa fourchette de tirage, `id` au
 * rang 2. Cette promotion est un geste POSSÉDÉ : elle doit COMPTER dans le cardinal du no-op, sinon
 * un fichier à `type` déjà posé mais `id` hors tête ressort en no-op muet, sorti 0, jamais promu.
 */
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

// --- 4. PORTE DE FORME : ni la forme SOURCE, ni la forme CIBLE (#1812) ---------------------------

/** Les migrations qui portent la porte de FORME — DÉRIVÉES du message qui la code. */
// Le repère est le REFUS que le code prononce (`ARBITRAGE REQUIS — forme INATTENDUE`), jamais une
// phrase de prose : une porte se reconnaît à ce qu'elle DIT en sortant, pas à son commentaire.
const PORTEURS_DE_FORME = DATEES.filter((m) => /forme INATTENDUE/.test(texteDe(m)));

test('la porte de FORME est portée par les 4 vagues `entite`', () => {
  for (const m of ['2026-08-28-l1b-11a-entite-type.mjs', '2026-08-28-l1b-11b-entite-type.mjs',
    '2026-08-28-l1b-12a-entite-type.mjs', '2026-08-28-l1b-12b-entite-type.mjs']) {
    assert.ok(PORTEURS_DE_FORME.includes(m), `${m} n’est plus reconnue porteuse de la porte de FORME`);
  }
});

/** Un `type` qu'AUCUN def ne déclare : ni la forme source (pas de `type`), ni la forme cible. */
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
    const echappe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    assert.equal(r.code, 1, `sortie ${r.code} — une forme ÉTRANGÈRE doit ARRÊTER la migration : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echappe(fichier)), `arrêt MUET sur le fichier visé : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echappe(tete.id)), `arrêt sans NOMMER l’entrée : ${sortie.slice(0, 500)}`);
    assert.match(sortie, new RegExp(echappe(TYPE_ETRANGER)), `arrêt sans NOMMER la forme rencontrée : ${sortie.slice(0, 500)}`);
    assert.equal(fs.readFileSync(cible, 'utf8'), avant, `${fichier} RÉÉCRIT alors que l’arrêt précède toute écriture`);
    assert.equal(fs.statSync(cible).mtimeMs, mtimeAvant, `${fichier} touché (mtime) alors que l’arrêt précède toute écriture`);
  });
}
