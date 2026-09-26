/**
 * MORSURE des PORTES de `2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs` (#1473) — une op de Talent
 * d'un document de projet prend la graphie `talent: { id, spec? }`, et le document passe au `schema` 15.
 * Sa borne haute est CLOSE (`schema` ∈ {14, 15}) : DERNIÈRE de la chaîne, elle NOMME un `schema` futur.
 *
 * La migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario, avec la primitive
 * qu'elle importe (`src/data/graphieOpsDeTalent.ts`, COPIÉE de l'arbre) ; les rouges d'avant-écriture
 * exigent sortie 1, message NOMINATIF et ZÉRO fichier posé touché, projet SAIN posé à côté compris.
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

const MIGRATION = '2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs';
const COPIES = ['src/data/graphieOpsDeTalent.ts'];
const SCHEMA_AVANT = 14;
const SCHEMA_APRES = 15;

const ALPHA = 'src/scenes/alpha/alpha-projet.json';
const BETA = 'src/scenes/beta/beta-projet.json';

/** Flow d'une action authorée, ops fournies. */
const flow = (ops) => ({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'ops', on: 'party', ops } }] });

/** Campagne jouet PORTEUSE : deux ops de Talent à l'ancienne graphie, l'une spécialisée, sous un Flow. */
const alpha = (schema = SCHEMA_AVANT, ops = [{ op: 'grantTalent', talentId: 'chanceux' }, { op: 'grantTalent', talentId: 'sens-aiguise', spec: 'odorat', label: 'Autel' }]) => ({
  type: 'projet',
  schema,
  id: 'alpha',
  scenes: [{ id: 'chapelle', entities: [{ id: 'autel', usable: { actions: [{ id: 'prier', flow: flow(ops) }] } }] }],
});

/** L'ÉTAT D'ARRIVÉE d'`alpha`, écrit à la main : `talent` à la POSITION de `talentId`, `spec` dedans. */
const alphaApres = (schema = SCHEMA_APRES) =>
  alpha(schema, [{ op: 'grantTalent', talent: { id: 'chanceux' } }, { op: 'grantTalent', talent: { id: 'sens-aiguise', spec: 'odorat' }, label: 'Autel' }]);

/** Campagne jouet SANS op de Talent : le passage n'y fait que le bump. */
const beta = (schema = SCHEMA_AVANT) => ({ type: 'projet', schema, id: 'beta', scenes: [{ id: 'cour' }] });

const poses = (a, b = beta()) => ({ [ALPHA]: serialise(a, FORME_PROJET), [BETA]: serialise(b, FORME_PROJET) });

test('(a) MIGRATION RÉELLE : chaque op de Talent prend `talent: { id, spec? }` À SA PLACE, le document passe à 15, le reste intact', (t) => {
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
  refuse(MIGRATION, poses({ ...alpha(), scenes: { chapelle: {} } }), `${ALPHA} : \`scenes\` absent ou non-tableau`, COPIES);
});

test('(g) FAIL-FAST op à DEUX graphies (`talentId` ET `talent`) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const ambigue = alpha(SCHEMA_AVANT, [{ op: 'grantTalent', talentId: 'chanceux', talent: { id: 'chanceux' } }]);
  refuse(MIGRATION, poses(ambigue), `${ALPHA} : op « grantTalent » : porte À LA FOIS \`talentId\` (« chanceux ») et \`talent\``, COPIES);
});

test('(h) FAIL-FAST PÉRIMÈTRE VIDE (aucun projet de scène) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { 'src/scenes/orpheline/notes.txt': 'un dossier de campagne sans document de projet\n' }, 'aucun projet de scène trouvé — périmètre déplacé', COPIES);
});

test('(i) FORMATAGE non canonique (indentation 4) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { ...poses(alpha()), [ALPHA]: `${JSON.stringify(alpha(), null, 4)}\n` }, `${ALPHA} : FORME NON CANONIQUE`, COPIES);
});
