/**
 * MORSURE des PORTES de `2026-10-05-1988-projet-dons-d-objet-en-fk.mjs` (#1988 B4a) — un don d'objet d'un
 * document de projet ne désigne plus un objet que par son id, et le document passe au `schema` 18.
 * Sa borne haute est CLOSE (`schema` ∈ {17, 18}) : DERNIÈRE de la chaîne, elle NOMME un `schema` futur.
 *
 * La migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario, avec ce qu'elle lit
 * (`src/data/donsDObjet.ts`, `src/data/qualities.json`, `src/data/trappings.json`, COPIÉS de l'arbre) ;
 * les rouges d'avant-écriture exigent sortie 1, message NOMINATIF et ZÉRO fichier posé touché, projet
 * SAIN posé à côté compris.
 *
 * FIXTURES FABRIQUÉES : deux campagnes jouets, jamais les projets livrés. L'état d'arrivée est écrit à la
 * main, jamais dérivé de la primitive.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_PROJET, serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-10-05-1988-projet-dons-d-objet-en-fk.mjs';
const COPIES = ['src/data/donsDObjet.ts', 'src/data/qualities.json', 'src/data/trappings.json'];
const SCHEMA_AVANT = 17;
const SCHEMA_APRES = 18;

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const BETA = 'src/scenes/beta/beta-projet.json';

/** Flow d'une action authorée, effets fournis. */
const flow = (effets) => ({ kind: 'seq', steps: effets.map((effect) => ({ kind: 'do', effect })) });

/** Campagne jouet PORTEUSE : un Effet et une op `giveTrapping`, des qualités en chaînes, sous un Flow. */
const alpha = (schema = SCHEMA_AVANT, effets = [
  { type: 'giveTrapping', trappingId: 'epee-batarde', qualities: ['magique', 'de-plaies-atroces'], identified: false },
  { type: 'ops', on: 'party', ops: [{ op: 'giveTrapping', trappingId: 'ration' }] },
]) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  scenes: [{ id: 'cour', entities: [{ id: 'coffre', usable: { actions: [{ id: 'fouiller', flow: flow(effets) }] } }] }],
});

/** L'ÉTAT D'ARRIVÉE d'`alpha`, écrit à la main : chaque qualité `{ id }`, le reste intact. */
const alphaApres = (schema = SCHEMA_APRES) => alpha(schema, [
  { type: 'giveTrapping', trappingId: 'epee-batarde', qualities: [{ id: 'magique' }, { id: 'de-plaies-atroces' }], identified: false },
  { type: 'ops', on: 'party', ops: [{ op: 'giveTrapping', trappingId: 'ration' }] },
]);

/** Campagne jouet SANS don : le passage n'y fait que le bump. */
const beta = (schema = SCHEMA_AVANT) => ({ type: 'projet', schema, id: 'beta', scenes: [{ id: 'cour' }] });

const poses = (a, b = beta()) => ({ [ALPHA]: serialise(a, FORME_PROJET), [BETA]: serialise(b, FORME_PROJET) });

test('(a) MIGRATION RÉELLE : chaque qualité devient `{ id }`, le document passe à 18, le reste intact', (t) => {
  const d = depot(poses(alpha()), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, ALPHA), serialise(alphaApres(), FORME_PROJET), `${ALPHA} produit ≠ état d’arrivée`);
  assert.equal(lireDans(d.racine, BETA), serialise(beta(SCHEMA_APRES), FORME_PROJET), `${BETA} : autre chose que le bump a changé`);
});

test('(b) IDEMPOTENCE : rejouée sur l’état d’arrivée, la migration sort 0 sans rien écrire', (t) => {
  const d = depot(poses(alphaApres(), beta(SCHEMA_APRES)), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.match(sortie, /fichier INCHANGÉ/, `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) BORNE HAUTE CLOSE : un `schema` FUTUR est refusé et NOMMÉ, rien d’écrit', () => {
  const futur = SCHEMA_APRES + 1;
  refuse(MIGRATION, poses(alphaApres(futur)), `${ALPHA} : \`schema\` inattendu ${futur} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`, COPIES);
});

test('(d) BORNE BASSE : un `schema` antérieur est refusé et NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, poses(alpha(SCHEMA_AVANT - 1)), `${ALPHA} : \`schema\` inattendu ${SCHEMA_AVANT - 1} (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`, COPIES);
});

test('(e) FAIL-FAST `schema` ABSENT → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const { schema: _retire, ...sansSchema } = alpha();
  refuse(MIGRATION, poses(sansSchema), `${ALPHA} : \`schema\` inattendu undefined (${SCHEMA_AVANT} ou ${SCHEMA_APRES} attendus)`, COPIES);
});

test('(f) FAIL-FAST `scenes` NON-TABLEAU → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, poses({ ...alpha(), scenes: { cour: {} } }), `${ALPHA} : \`scenes\` absent ou non-tableau`, COPIES);
});

test('(g) FAIL-FAST qualité hors des ids du catalogue : le dépôt DIT ne pas résoudre un libellé → sortie 1, rien d’écrit', () => {
  const inconnue = alpha(SCHEMA_AVANT, [{ type: 'giveTrapping', trappingId: 'dague', qualities: ['De plaies atroces'] }]);
  refuse(MIGRATION, poses(inconnue), `${ALPHA} : le dépôt ne résout pas un libellé (« De plaies atroces ») : charger le projet par l'éditeur (\`parseProject\`), qui le résout ou le refuse.`, COPIES);
});

test('(h) FAIL-FAST objet LIBRE (`custom`) : le dépôt DIT ne pas résoudre un libellé → sortie 1, rien d’écrit', () => {
  const libre = alpha(SCHEMA_AVANT, [{ type: 'giveTrapping', custom: 'Corde' }]);
  refuse(MIGRATION, poses(libre), `${ALPHA} : le dépôt ne résout pas un libellé (« Corde ») : charger le projet par l'éditeur (\`parseProject\`), qui le résout ou le refuse.`, COPIES);
});

test('(i) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' }, 'aucun projet de scène trouvé — périmètre déplacé', COPIES);
});

test('(j) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { ...poses(alpha()), [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n` }, `${ALPHA} : FORME NON CANONIQUE`, COPIES);
});
