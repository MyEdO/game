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
import test from 'node:test';
import { FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-21-877-ref-de-decor-nommee.mjs';

/** Forme d'entrée et CIBLE du bump porté par cette migration — borne haute OUVERTE. */
const SCHEMA_AVANT = 11;
const SCHEMA_APRES = 12;
/** La ref que `src/state/projet-migration-11-vers-12.test.ts` exige du migrateur de chargement. */
const REF_ATTENDUE = 'tonneau';

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

test('(a) MIGRATION RÉELLE : le décor nu reçoit sa ref en QUEUE, le document passe à 12, le reste est intact', (t) => {
  const d = depot({ [ALPHA]: serialise(alpha(), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, ALPHA), serialise(alphaApres(), FORME_PROJET), `${ALPHA} produit ≠ état d’arrivée`);
  assert.equal(lireDans(d.racine, BETA), serialise(beta(SCHEMA_APRES), FORME_PROJET), `${BETA} : autre chose que le bump a changé`);
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
  const d = depot({ [ALPHA]: serialise(alphaApres(), FORME_PROJET), [BETA]: serialise(beta(SCHEMA_APRES), FORME_PROJET) });
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

test('(c) BORNE HAUTE OUVERTE : un `schema` FUTUR traverse en NO-OP nommé — aucun RABAISSEMENT', (t) => {
  const futur = SCHEMA_APRES + 7;
  const d = depot({ [ALPHA]: serialise(alphaApres(futur), FORME_PROJET), [BETA]: serialise(beta(futur), FORME_PROJET) });
  t.after(() => efface(d.racine));

  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  assert.ok(
    sortie.includes(`${ALPHA} — schema ${futur} → ${futur} — DÉJÀ MIGRÉ au-delà de ${SCHEMA_APRES}`),
    `le passage d'un schema futur ne se DIT pas : ${sortie.slice(0, 1200)}`,
  );
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'un schema futur a été réécrit');
});

test('(d) BORNE BASSE : un `schema` antérieur à la chaîne est refusé et NOMMÉ, rien d’écrit', () => {
  const ancien = SCHEMA_AVANT - 1;
  refuse(
    MIGRATION,
    { [ALPHA]: serialise(alpha(ancien), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`schema\` inattendu ${ancien} (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(e) FAIL-FAST `schema` ABSENT → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const { schema: _retire, ...sansSchema } = alpha();
  refuse(
    MIGRATION,
    { [ALPHA]: serialise(sansSchema, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`schema\` inattendu undefined (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(f) FAIL-FAST `schema` NON NUMÉRIQUE (la chaîne "11") → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: serialise(alpha(String(SCHEMA_AVANT)), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`schema\` inattendu "${SCHEMA_AVANT}" (${SCHEMA_AVANT} ou plus récent attendu)`,
  );
});

test('(g) FAIL-FAST `scenes` NON-TABLEAU → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: serialise({ ...alpha(), scenes: { quai: {} } }, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`scenes\` absent ou non-tableau`,
  );
});

test('(h) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' },
    'aucun projet de scène trouvé — périmètre déplacé',
  );
});

test('(i) FAIL-FAST PÉRIMÈTRE VIDE (aucune Scène embarquée) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: serialise({ ...alpha(), scenes: [] }, FORME_PROJET) },
    'aucune Scène embarquée — périmètre déplacé',
  );
});

test('(j) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n`, [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : FORME NON CANONIQUE`,
  );
});
