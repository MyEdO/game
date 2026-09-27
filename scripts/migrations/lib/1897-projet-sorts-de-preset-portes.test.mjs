/**
 * MORSURE des PORTES de la migration #1897 — la référence de sort d'un preset de PNJ se DÉNUDE.
 *
 *  - `2026-09-24-1897-projet-sorts-de-preset-ids-nus.mjs` (racine `src/scenes`) : dans
 *    `narratif.presetsPnj[].profil.spells`, tout `{ id }` devient l'id NU à sa position, et le
 *    document passe au `schema` 15. Sa borne haute est OUVERTE (`schema` ∈ {14, ≥ 15}) : un `schema`
 *    futur la traverse sans être RABAISSÉ, la DERNIÈRE de la chaîne étant seule à le nommer.
 *
 * Une déclaration n'est pas une porte tant qu'on ne l'a pas vue MORDRE : ce banc joue la migration
 * sur un dépôt JETABLE (`os.tmpdir()`), une fois par scénario, et exige la sortie attendue, un
 * message NOMINATIF, et — pour les rouges d'avant-écriture — ZÉRO fichier touché (octet ET
 * horodatage antidaté), y compris sur le projet SAIN posé à côté du projet fautif.
 *
 * FIXTURES FABRIQUÉES : deux campagnes jouets, jamais les projets livrés — ce passage ne porte aucun
 * cardinal d'identité (#1812), la forme suffit. L'état d'arrivée est écrit à la main, jamais dérivé
 * de la migration : un banc qui lirait ses constantes ne mesurerait que sa cohérence avec elle-même.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-24-1897-projet-sorts-de-preset-ids-nus.mjs';

/** Forme d'entrée et CIBLE du bump porté par cette migration — borne haute OUVERTE. */
const SCHEMA_AVANT = 14;
const SCHEMA_APRES = 15;

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const BETA = 'src/scenes/beta/beta-projet.json';

/** Campagne jouet PORTEUSE : un preset aux sorts `{ id }`, un preset MIXTE (nu puis `{ id }`), un
 *  preset sans `profil.spells`, et des clés de document hors du passage. */
const alpha = (schema = SCHEMA_AVANT) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  label: 'Alpha',
  scenes: [{ id: 'quai' }],
  narratif: {
    affaires: [],
    presetsPnj: [
      { id: 'sorcier', base: 'squelette', profil: { spells: [{ id: 'flechette' }, { id: 'alerte' }] } },
      { id: 'mixte', base: 'squelette', profil: { spells: ['flechette', { id: 'alerte' }] } },
      { id: 'muet', base: 'squelette' },
    ],
  },
});

/** L'ÉTAT D'ARRIVÉE d'`alpha`, écrit à la main : chaque `{ id }` devenu l'id nu À SA PLACE,
 *  `schema` à sa place, tout le reste identique. */
const alphaApres = (schema = SCHEMA_APRES) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  label: 'Alpha',
  scenes: [{ id: 'quai' }],
  narratif: {
    affaires: [],
    presetsPnj: [
      { id: 'sorcier', base: 'squelette', profil: { spells: ['flechette', 'alerte'] } },
      { id: 'mixte', base: 'squelette', profil: { spells: ['flechette', 'alerte'] } },
      { id: 'muet', base: 'squelette' },
    ],
  },
});

/** Campagne jouet SANS sort de preset : le passage n'y fait que le bump. */
const beta = (schema = SCHEMA_AVANT) => ({
  type: 'projet',
  schema,
  id: 'beta',
  label: 'Beta',
  scenes: [{ id: 'cour' }],
  narratif: { presetsPnj: [] },
});

test('(a) MIGRATION RÉELLE : les sorts `{ id }` deviennent des ids nus À LEUR PLACE, le document passe à 15, le reste est intact', (t) => {
  const d = depot({ [ALPHA]: serialise(alpha(), FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, ALPHA), serialise(alphaApres(), FORME_PROJET), `${ALPHA} produit ≠ état d’arrivée`);
  assert.equal(lireDans(d.racine, BETA), serialise(beta(SCHEMA_APRES), FORME_PROJET), `${BETA} : autre chose que le bump a changé`);
  assert.match(sortie, /références de sort de preset dénudées : 3/, `le compte des dénudées ne se DIT pas : ${sortie.slice(0, 1200)}`);
});

test('(b) IDEMPOTENCE : rejouée sur l’état d’arrivée, la migration sort 0 sans rien écrire', (t) => {
  const d = depot({ [ALPHA]: serialise(alphaApres(), FORME_PROJET), [BETA]: serialise(beta(SCHEMA_APRES), FORME_PROJET) });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /fichier INCHANGÉ/, `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) BORNE HAUTE OUVERTE : un `schema` FUTUR traverse en NO-OP nommé — aucun RABAISSEMENT', (t) => {
  const futur = SCHEMA_APRES + 7;
  const d = depot({ [ALPHA]: serialise(alphaApres(futur), FORME_PROJET), [BETA]: serialise(beta(SCHEMA_APRES), FORME_PROJET) });
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} — un schema futur doit TRAVERSER : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes(`${ALPHA} — schema ${futur} → ${futur}`), `le passage d'un schema futur ne se DIT pas : ${sortie.slice(0, 1200)}`);
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

test('(f) FAIL-FAST `schema` NON NUMÉRIQUE (la chaîne "14") → sortie 1 NOMINATIVE, rien d’écrit', () => {
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

test('(h) FAIL-FAST `narratif.presetsPnj` NON-TABLEAU → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: serialise({ ...alpha(), narratif: { affaires: [] } }, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : \`narratif.presetsPnj\` absent ou non-tableau`,
  );
});

test('(i) PORTE DE FORME : un sort ni `{ id }` ni id nu → sortie 1 NOMMANT le preset et le rang, rien d’écrit', () => {
  const etranger = alpha();
  etranger.narratif.presetsPnj[0].profil.spells = [{ id: 'flechette' }, { id: 'alerte', rang: 2 }];
  refuse(
    MIGRATION,
    { [ALPHA]: serialise(etranger, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} preset « sorcier » profil.spells[1] : {"id":"alerte","rang":2} — ni \`{ id }\` ni id nu`,
  );
});

test('(j) PORTE DE FORME : `profil.spells` NON-TABLEAU → sortie 1 NOMMANT le preset, rien d’écrit', () => {
  const etranger = alpha();
  etranger.narratif.presetsPnj[0].profil.spells = { id: 'flechette' };
  refuse(
    MIGRATION,
    { [ALPHA]: serialise(etranger, FORME_PROJET), [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} preset « sorcier » : \`profil.spells\` non-tableau`,
  );
});

test('(k) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' },
    'aucun projet de scène trouvé — périmètre déplacé',
  );
});

test('(l) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(
    MIGRATION,
    { [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n`, [BETA]: serialise(beta(), FORME_PROJET) },
    `${ALPHA} : FORME NON CANONIQUE`,
  );
});
