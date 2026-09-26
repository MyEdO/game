/**
 * MORSURE des PORTES de la migration #877 — le TYPE d'un décor se NOMME.
 *
 *  - `2026-09-21-877-ref-de-decor-nommee.mjs` (racine `src/scenes`) : pose `ref` en QUEUE de toute
 *    entité `kind:'prop'` qui n'en porte pas, et porte le document au `schema` 12 au moins. Sa borne
 *    haute est OUVERTE (`schema` ∈ {11, ≥ 12}) : un document plus récent traverse à l'octet, seule la
 *    DERNIÈRE de la chaîne (`src/scenes/migrations-format-projet.test.ts`) nomme un `schema` futur.
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté), y compris sur le projet SAIN posé à côté du projet fautif.
 *
 * FIXTURES FABRIQUÉES : deux campagnes jouets, jamais les projets livrés — ce passage ne porte aucun
 * cardinal d'identité (#1812), la forme suffit. La ref ATTENDUE est récitée ici, jamais importée de
 * la migration : un banc qui lirait sa constante ne mesurerait que sa cohérence avec elle-même.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { joue } from './joue.mjs';

const MIGRATION = '2026-09-21-877-ref-de-decor-nommee.mjs';

/** Forme d'entrée et CIBLE du bump porté par cette migration — borne haute OUVERTE. */
const SCHEMA_AVANT = 11;
const SCHEMA_APRES = 12;
/** La ref que `src/state/projet-migration-11-vers-12.test.ts` exige du migrateur de chargement. */
const REF_ATTENDUE = 'tonneau';

/** Formatage canonique d'un document de projet de scène. */
const serialise = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

const ANTIDATE = new Date('2000-01-01T00:00:00Z');

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const BETA = 'src/scenes/beta/beta-projet.json';

/** Campagne jouet PORTEUSE : un décor nu (la population), un décor nommé, un décor à ref MORTE, une
 *  entité non-décor sans `ref`, une Scène sans `entities`, et des clés de document hors du passage. */
const alpha = (schema = SCHEMA_AVANT) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  label: 'Alpha',
  scenes: [
    {
      id: 'quai',
      entities: [
        { id: 'nu', kind: 'prop', x: 1, y: 2 },
        { id: 'nomme', kind: 'prop', ref: 'table-ronde-4-tabourets', x: 0, y: 0 },
        { id: 'mort', kind: 'prop', ref: 'id-hors-registre', x: 3, y: 3 },
        { id: 'pnj', kind: 'npc', x: 4, y: 4 },
      ],
    },
    { id: 'vide' },
  ],
  narratif: { affaires: [] },
});

/** L'ÉTAT D'ARRIVÉE d'`alpha`, écrit à la main : `ref` en QUEUE du seul décor nu, `schema` à sa
 *  place, tout le reste identique. */
const alphaApres = (schema = SCHEMA_APRES) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  label: 'Alpha',
  scenes: [
    {
      id: 'quai',
      entities: [
        { id: 'nu', kind: 'prop', x: 1, y: 2, ref: REF_ATTENDUE },
        { id: 'nomme', kind: 'prop', ref: 'table-ronde-4-tabourets', x: 0, y: 0 },
        { id: 'mort', kind: 'prop', ref: 'id-hors-registre', x: 3, y: 3 },
        { id: 'pnj', kind: 'npc', x: 4, y: 4 },
      ],
    },
    { id: 'vide' },
  ],
  narratif: { affaires: [] },
});

/** Campagne jouet SANS décor nu : le passage n'y fait que le bump. */
const beta = (schema = SCHEMA_AVANT) => ({
  type: 'projet',
  schema,
  id: 'beta',
  label: 'Beta',
  scenes: [{ id: 'cour', entities: [{ id: 'banc', kind: 'prop', ref: 'banc' }] }],
});

/** Dépôt jetable portant EXACTEMENT les fichiers demandés, plus la migration. */
function depot(fichiers) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'migr-877-'));
  const avant = new Map();
  for (const [rel, texte] of Object.entries(fichiers)) {
    const cible = path.join(racine, rel);
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, texte, 'utf8');
    fs.utimesSync(cible, ANTIDATE, ANTIDATE);
    avant.set(rel, texte);
  }
  return { racine, avant };
}

const efface = (racine) => fs.rmSync(racine, { recursive: true, force: true });
const lireDans = (racine, rel) => fs.readFileSync(path.join(racine, rel), 'utf8');

/** Les fichiers posés sont INTACTS (octet + horodatage). */
function rienTouche(racine, avant) {
  const fautes = [];
  for (const [rel, texte] of avant) {
    const cible = path.join(racine, rel);
    if (!fs.existsSync(cible)) { fautes.push(`${rel} : SUPPRIMÉ`); continue; }
    if (fs.readFileSync(cible, 'utf8') !== texte) fautes.push(`${rel} : octet DIVERGENT`);
    if (fs.statSync(cible).mtimeMs !== ANTIDATE.getTime()) fautes.push(`${rel} : horodatage remonté (écriture)`);
  }
  return fautes;
}

/** Un rouge d'AVANT-écriture : sortie 1, la faute NOMMÉE, aucun fichier touché. */
function refuse(fichiers, message) {
  const d = depot(fichiers);
  try {
    const { code, sortie } = joue(d.racine, MIGRATION);
    assert.equal(code, 1, `sortie ${code} — la migration devait ARRÊTER : ${sortie.slice(0, 1200)}`);
    assert.ok(sortie.includes('ARBITRAGE REQUIS'), `arrêt sans DEMANDER l’arbitrage : ${sortie.slice(0, 1200)}`);
    assert.ok(sortie.includes(message), `arrêt sans NOMMER « ${message} » : ${sortie.slice(0, 1200)}`);
    assert.deepEqual(rienTouche(d.racine, d.avant), [], 'la migration a écrit alors que l’arrêt précède toute écriture');
  } finally {
    efface(d.racine);
  }
}

test('(a) MIGRATION RÉELLE : le décor nu reçoit sa ref en QUEUE, le document passe à 12, le reste est intact', (t) => {
  const d = depot({ [ALPHA]: serialise(alpha()), [BETA]: serialise(beta()) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, ALPHA), serialise(alphaApres()), `${ALPHA} produit ≠ état d’arrivée`);
  assert.equal(lireDans(d.racine, BETA), serialise(beta(SCHEMA_APRES)), `${BETA} : autre chose que le bump a changé`);
  assert.ok(
    sortie.includes(`${ALPHA} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, décors dont le type se NOMME désormais : 1 (scènes : 2) — fichier réécrit`),
    `${ALPHA} : le bump ou la pose ne DIT pas son compte : ${sortie.slice(0, 1200)}`,
  );
  assert.ok(
    sortie.includes(`${BETA} — schema ${SCHEMA_AVANT} → ${SCHEMA_APRES}, décors dont le type se NOMME désormais : 0 (scènes : 1) — fichier réécrit`),
    `${BETA} : le bump seul ne se DIT pas : ${sortie.slice(0, 1200)}`,
  );
});

test('(b) IDEMPOTENT : rejouée sur l’état final, sortie 0 et rien d’écrit', (t) => {
  const d = depot({ [ALPHA]: serialise(alphaApres()), [BETA]: serialise(beta(SCHEMA_APRES)) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  for (const rel of [ALPHA, BETA]) {
    const ligne = sortie.split('\n').find((l) => l.includes(`${rel} — `)) ?? '';
    assert.ok(
      ligne.includes(`schema ${SCHEMA_APRES} → ${SCHEMA_APRES}, décors dont le type se NOMME désormais : 0`)
        && ligne.endsWith('fichier INCHANGÉ'),
      `${rel} : le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`,
    );
  }
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) BORNE HAUTE OUVERTE : un document déjà porté au-delà de 12 traverse à l’octet, jamais rabaissé', (t) => {
  const futur = SCHEMA_APRES + 1;
  const d = depot({ [ALPHA]: serialise(alphaApres(futur)), [BETA]: serialise(beta(futur)) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes(`${ALPHA} — schema ${futur} → ${futur} — DÉJÀ MIGRÉ au-delà de ${SCHEMA_APRES}`), `le no-op au-delà ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le document est réécrit ou rabaissé');
});

test('(d) BORNE BASSE : un `schema` antérieur à la chaîne est refusé et NOMMÉ, rien d’écrit', () => {
  const ancien = SCHEMA_AVANT - 1;
  refuse(
    { [ALPHA]: serialise(alpha(ancien)), [BETA]: serialise(beta()) },
    `${ALPHA} : \`schema\` inattendu ${ancien} (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(e) FAIL-FAST `schema` ABSENT → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const { schema: _retire, ...sansSchema } = alpha();
  refuse(
    { [ALPHA]: serialise(sansSchema), [BETA]: serialise(beta()) },
    `${ALPHA} : \`schema\` inattendu undefined (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(f) FAIL-FAST `schema` NON NUMÉRIQUE (la chaîne "11") → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    { [ALPHA]: serialise(alpha(String(SCHEMA_AVANT))), [BETA]: serialise(beta()) },
    `${ALPHA} : \`schema\` inattendu "${SCHEMA_AVANT}" (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(g) FAIL-FAST `scenes` NON-TABLEAU → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    { [ALPHA]: serialise({ ...alpha(), scenes: { quai: {} } }), [BETA]: serialise(beta()) },
    `${ALPHA} : \`scenes\` absent ou non-tableau`,
  );
});

test('(h) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    { 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' },
    'aucun projet de scène trouvé — périmètre déplacé',
  );
});

test('(i) FAIL-FAST PÉRIMÈTRE VIDE (aucune Scène embarquée) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    { [ALPHA]: serialise({ ...alpha(), scenes: [] }) },
    'aucune Scène embarquée — périmètre déplacé',
  );
});

test('(j) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    { [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n`, [BETA]: serialise(beta()) },
    `${ALPHA} : FORME NON CANONIQUE`,
  );
});
