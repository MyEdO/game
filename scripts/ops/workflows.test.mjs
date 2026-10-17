import { ast } from '../guards/lib/dialecte.mjs'
import { readFileSync as lireCalibrage } from 'node:fs'
const CALIBRAGE = lireCalibrage(new URL('../../.claude/skills/orchestrer-des-agents/SKILL.md', import.meta.url), 'utf8')
import test from 'node:test'

import assert from 'node:assert/strict'

import { defautsDesSitesDAgent, lireWorkflow } from '../guards/lib/formeDeWorkflow.mjs'

import { TYPES_DECLARES, TEMOIN, SOURCE_TEMOIN, muter, vus as voirDefauts } from '../test/lib/bancWorkflows.mjs'

const LIST_TYPE = "const LIST = {\n  type: 'object', additionalProperties: false,";

const LIST_DOCS = "docs: { type: 'array', items: { type: 'string' } } },";

const LIST_REQUIS = "  required: ['rawFiles', 'docs'],\n}";

const SCOUT = "{ label: 'scout', phase: 'Scout', schema: LIST,";

const STATS = 'const STATS_VIDES = ';

const JUGEMENT = "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: 'high' }";

const NON_UNIQUE = (n) => `racine : racine non littérale — \`schema\` : \`LIST\` ne se résout pas en \`const\` de premier niveau, UNIQUE, initialisée d’un objet littéral (${n} déclaration(s) du nom)`;

const ATTEIGNABLE = (parent) => `maillon : \`LIST\` : maillon de racine atteignable par le code (${parent}) — un maillon n'est lu que comme valeur de \`schema:\` ou d'un autre maillon`;

const NON_DIRECT = (parent) => `agent-direct : \`agent\` non appelé directement (${parent}) — seul un appel \`agent(…)\` est un site que la porte lit`;

const NON_EMPLOYEE = (phase) => `phase-declaree : phase \`${phase}\` déclarée dans \`meta.phases\` et jamais employée`;

test('témoin : le script témoin, base des mutations, ne porte aucun défaut', () => {
  assert.deepEqual(vus(SOURCE_TEMOIN), []);
});

test('a01 — un paramètre qui OMBRE un maillon : la racine ne se résout plus', () => {
  assert.deepEqual(vus(muter(TEMOIN, 'function verifyPrompt(f) {', 'function verifyPrompt(f, LIST) {')), [NON_UNIQUE(2)]);
});

test('a02 — `for (const S …)` qui ombre un maillon : la racine ne se résout plus', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `for (const LIST of []) log(LIST)\n${STATS}`)), [NON_UNIQUE(2)]);
});

test('a03 — `const lire = agent` : agent non appelé directement', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const lire = agent\n${STATS}`)), [NON_DIRECT('VariableDeclaration')]);
});

test('a04 — `agent.call(…)` : agent non appelé directement', () => {
  const mute = muter(TEMOIN, "? await agent(verifyPrompt(f), { label: etiquette, phase: 'Verify'", "? await agent.call(null, verifyPrompt(f), { label: etiquette, phase: 'Verify'");
  assert.deepEqual(vus(mute), [
    NON_DIRECT('PropertyAccessExpression'),
    NON_EMPLOYEE('Verify'),
  ]);
});

test('a05 — `agent` passé en argument : agent non appelé directement', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `log(agent)\n${STATS}`)), [NON_DIRECT('CallExpression')]);
});

test('a06 — `{ agent }.agent(…)` : le raccourci lit `agent` sans l’appeler', () => {
  const mute = muter(TEMOIN, 'const scout = await agent(', 'const scout = await { agent }.agent(');
  assert.deepEqual(vus(mute), [NON_DIRECT('ShorthandPropertyAssignment'), NON_EMPLOYEE('Scout')]);
});

test('une déclaration qui lie le nom `agent` est un défaut', () => {
  const mute = muter(TEMOIN, 'function chunk(arr, n) {', 'function chunk(arr, n, agent) {');
  assert.deepEqual(vus(mute), ['agent-direct : déclaration qui lie le nom `agent` — l’identifiant du harnais ne se masque pas']);
});

test('a07 — un spread dans les options : options non fermées', () => {
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, `${SCOUT} ...SURCHARGE,`)), ['options : options non fermées : spread `...SURCHARGE`']);
});

test('a08 — `schema` en double dans les options : options non fermées', () => {
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, `${SCOUT} schema: FINDINGS,`)), [
    'options : options non fermées : clé « schema » en double',
    "maillon : `FINDINGS` : maillon de racine atteignable par le code (PropertyAssignment) — un maillon n'est lu que comme valeur de `schema:` ou d'un autre maillon",
  ]);
});

test('a09 — `type: T` puis `T.push(…)` : le `type` d’une propriété racine n’est pas littéral', () => {
  const mute = muter(TEMOIN, LIST_TYPE, `const T = ['array']\nT.push('string')\n${LIST_TYPE}`, LIST_DOCS, "docs: { type: T, items: { type: 'string' } } },");
  assert.deepEqual(vus(mute), ['racine : racine non littérale — `type` de la propriété racine « docs » : Identifier `T`']);
});

test('a10 — un alias `P = S.properties` : maillon atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const P = LIST.properties\nP.t = { type: 'string' }\n${STATS}`)), [ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a11 — une mutation par paramètre : maillon atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const ajouter = (o) => { o.t = { type: 'string' } }\najouter(LIST.properties)\n${STATS}`)), [ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a12 — `Reflect.set(S.properties, …)` : maillon atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `Reflect.set(LIST.properties, 't', { type: 'string' })\n${STATS}`)), [ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a13 — `with` : portée non statique', () => {
  const mute = muter(TEMOIN, STATS, `with (LIST.properties) { t = { type: 'string' } }\n${STATS}`);
  assert.deepEqual(vus(mute), ['portee : instruction `with` — la liaison des noms ne se lit plus à la forme', ATTEIGNABLE('PropertyAccessExpression')]);
});

test('a14 — `eval` : portée non statique', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `eval("LIST.properties.t = { type: 'string' }")\n${STATS}`)), ['portee : `eval` — du code que la forme ne lit pas']);
});

test('a15 — `__proto__` en raccourci dans `properties` : racine non fermée', () => {
  const mute = muter(TEMOIN, 'properties: { rawFiles:', 'properties: { __proto__, rawFiles:');
  assert.deepEqual(vus(mute), ['racine : racine non fermée — `properties` : `__proto__`']);
});

test('a16 — `properties` en double à la racine : racine non fermée', () => {
  const mute = muter(TEMOIN, LIST_REQUIS, "  required: ['rawFiles', 'docs'],\n  properties: { t: { type: 'string' } },\n}");
  assert.deepEqual(vus(mute), ['racine : racine non fermée — `schema` : clé « properties » en double']);
});

test('a18 — `agent` sans `export const meta` : défaut de reconnaissance', () => {
  const mute = muter(TEMOIN, 'export const meta', 'const meta');
  assert.equal(lireWorkflow(mute, TEMOIN).script, false);
  assert.deepEqual(vus(mute), [
    'reconnaissance : `agent` libre référencé sans `export const meta` de premier niveau',
    'meta : `export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script',
  ]);
});

test('a19 — `export { meta }` n’est pas `export const meta` de premier niveau', () => {
  const mute = `${muter(TEMOIN, 'export const meta', 'const meta')}\nexport { meta }\n`;
  assert.equal(lireWorkflow(mute, TEMOIN).script, false);
  assert.deepEqual(vus(mute), [
    'reconnaissance : `agent` libre référencé sans `export const meta` de premier niveau',
    'meta : `export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script',
  ]);
});

test('a20 — BOM, `export const meta` indenté et `agent (` : reconnu, sans défaut', () => {
  const mute = `\uFEFF  ${muter(TEMOIN, 'const scout = await agent(', 'const scout = await agent (')}`;
  const lu = lireWorkflow(mute, TEMOIN);
  assert.equal(lu.script, true);
  assert.equal(mute.slice(lu.exportDeMeta, lu.exportDeMeta + 'export const meta'.length), 'export const meta');
  assert.deepEqual(vus(mute), []);
});

test('a21 — `arguments`, lié à l’enveloppe, est un alias de `agent` : portée non statique', () => {
  const site = "await lire('p', { label: 'x', phase: 'Scout', schema: { type: 'object', additionalProperties: false, properties: { t: { type: 'string' } }, required: ['t'] }, agentType: 'verif-mecanique', model: 'claude-haiku-5-5', effort: 'low' })";
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const lire = arguments[0]\n${site}\n${STATS}`)), [
    'portee : `arguments` — alias des doublures du harnais, que la forme ne lit pas',
  ]);
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const aussi = () => arguments.length\n${STATS}`)), [
    'portee : `arguments` — alias des doublures du harnais, que la forme ne lit pas',
  ], 'une flèche n’a pas d’`arguments` propre');
  assert.deepEqual(vus(muter(TEMOIN, STATS, `function compte() { return (() => arguments.length)() }\n${STATS}`)), [], 'témoin : l’`arguments` d’une fonction non fléchée est le sien');
});

test('a22 — `export let meta` n’est pas `export const meta` : UN lecteur de `meta`, les deux défauts tombent', () => {
  const mute = muter(TEMOIN, 'export const meta', 'export let meta');
  assert.equal(lireWorkflow(mute, TEMOIN).script, false);
  assert.deepEqual(vus(mute), [
    'reconnaissance : `agent` libre référencé sans `export const meta` de premier niveau',
    'meta : `export const meta` absent ou non littéral — le harnais lit cet objet sans exécuter le script',
  ]);
});

test('RACINE : sans `additionalProperties: false`, défaut nommé', () => {
  const mute = muter(TEMOIN, LIST_TYPE, "const LIST = {\n  type: 'object',");
  assert.deepEqual(vus(mute), ['racine : `additionalProperties: false` exigé à la racine (lu : absent)']);
});

test('RACINE : une clé hors liste ($ref, allOf, patternProperties, $defs), un défaut nommé chacune', () => {
  for (const cle of ['$ref', 'allOf', 'patternProperties', '$defs']) {
    const mute = muter(TEMOIN, LIST_REQUIS, `  required: ['rawFiles', 'docs'],\n  '${cle}': {},\n}`);
    assert.deepEqual(vus(mute), [`racine : clé de racine « ${cle} » hors de type/properties/required/additionalProperties`], cle);
  }
});

test('RACINE : une propriété racine sans `type`, puis à `type: [\'object\', \'string\']`', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_DOCS, "docs: { items: { type: 'string' } } },")), ['racine : propriété racine « docs » sans `type`']);
  assert.deepEqual(
    vus(muter(TEMOIN, LIST_DOCS, "docs: { type: ['object', 'string'], items: { type: 'string' } } },")),
    ['racine : propriété racine « docs » accepte une chaîne (`type` : ["object","string"])'],
  );
});

test('RACINE : `schema: args.x` et `schema: f()` ne se résolvent pas', () => {
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, "{ label: 'scout', phase: 'Scout', schema: args.x,")), ['racine : racine non littérale — `schema` : PropertyAccessExpression `args.x`']);
  assert.deepEqual(vus(muter(TEMOIN, SCOUT, "{ label: 'scout', phase: 'Scout', schema: f(),")), ['racine : racine non littérale — `schema` : CallExpression `f()`']);
});

test('schema-lu : une racine résolue SANS `required` est un défaut quand le script lit son rendu', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_REQUIS, '}')), [
    'schema-lu : `schema` sans `required` littéral alors que le script lit `.rawFiles`, `.docs` sur son rendu — un champ hors `required` peut ne pas être rendu',
  ]);
});

test('RACINE : un conteneur de type CHAMPS qui référence un maillon le rend atteignable', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const CHAMPS = [{ champ: 'docs', schema: LIST }]\n${STATS}`)), [ATTEIGNABLE('PropertyAssignment')]);
});

test('témoins : spread et `Object.fromEntries` SOUS une propriété racine, maillon EN propriété racine', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_TYPE, `const AUTRES = ['b']\n${LIST_TYPE}`, LIST_DOCS, "docs: { type: 'array', items: { type: 'string', enum: ['a', ...AUTRES] } } },")), []);
  assert.deepEqual(vus(muter(TEMOIN, LIST_DOCS, "docs: { type: 'array', items: { type: 'object', properties: Object.fromEntries(['a'].map((k) => [k, { type: 'string' }])) } } },")), []);
  assert.deepEqual(vus(muter(TEMOIN, LIST_TYPE, `const DOCS = { type: 'array', items: { type: 'string' } }\n${LIST_TYPE}`, LIST_DOCS, 'docs: DOCS },')), []);
});

test('la porte MORD quand le schéma cesse d’exiger la clé que le script lit', () => {
  assert.deepEqual(vus(muter(TEMOIN, LIST_REQUIS, "  required: ['rawFiles'],\n}")), [
    "schema-lu : le script lit `.docs` sur le rendu de cet agent, absent du `required` du schéma (rawFiles) — un champ hors schéma n'est pas rendu par le harnais",
  ]);
});

test('défaut 28 — l’effort est LITTÉRAL et présent à chaque site, et vaut celui de l’étage', () => {
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: String(args) }")),
    ["options : `effort` non littéral — un étage d'agent se lit à la forme du script, jamais à l'exécution"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus' }")),
    ["agent : phase de JUGEMENT `Jugement` : `effort: 'high'` exigé AUSSI (lu : absent)"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'juge', model: 'opus', effort: 'low' }")),
    ["agent : phase de JUGEMENT `Jugement` : `effort: 'high'` exigé AUSSI (lu : `low`)"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, "{ label: 'scout', phase: 'Scout', schema: LIST, agentType: 'verif-mecanique', model: 'claude-haiku-5-5', effort: 'low' }", "{ label: 'scout', phase: 'Scout', schema: LIST, agentType: 'verif-mecanique', model: 'claude-haiku-5-5' }")),
    ['agent : phase MÉCANIQUE `Scout` : `effort` littéral exigé (lu : absent)'],
  );
});

test('#2537 — en phase MÉCANIQUE, le modèle se lit au couple (type, modèle) du Calibrage, jamais à une liste plate', () => {
  assert.deepEqual(
    vus(muter(TEMOIN, "agentType: 'verif-mecanique', model: 'claude-haiku-5-5', effort: 'low' })\n\nconst STATS_VIDES", "agentType: 'verif-mecanique', model: 'sonnet', effort: 'low' })\n\nconst STATS_VIDES")),
    ["agent : phase MÉCANIQUE `Scout` : `model` littéral parmi claude-haiku-5-5 exigé pour verif-mecanique (lu : `sonnet`)"],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, "phase: 'Find', schema: FINDINGS, agentType: 'lecteur', model: 'sonnet'", "phase: 'Find', schema: FINDINGS, agentType: 'lecteur', model: 'claude-haiku-5-5'")),
    ["agent : phase MÉCANIQUE `Find` : `model` littéral parmi sonnet exigé pour lecteur (lu : `claude-haiku-5-5`)"],
  );
});

function vus(source, fichier) { return voirDefauts(source, fichier, CALIBRAGE) }

const sansLieu = (m) => m.slice(m.indexOf(' — ') + 3)

test('#2537 — `agentType` absent ou non déclaré sous `.claude/agents/` : défaut universel', () => {
  const declares = [...TYPES_DECLARES].join('/');
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, model: 'opus', effort: 'high' }")),
    [`agent : \`agentType\` absent — un agent de workflow nomme un type déclaré sous \`.claude/agents/\` (${declares})`],
  );
  assert.deepEqual(
    vus(muter(TEMOIN, JUGEMENT, "phase: 'Jugement', schema: VERDICT, agentType: 'general-purpose', model: 'opus', effort: 'high' }")),
    [
      `agent : \`agentType\` \`general-purpose\` : aucun type de ce nom déclaré sous \`.claude/agents/\` (${declares})`,
      "agent : phase de JUGEMENT `Jugement` : `agentType: 'juge'` exigé (lu : `general-purpose`)",
    ],
  );
});

test('#2537 — la couche UNIVERSELLE seule (la garde de l’outil `Workflow`) n’exige ni phase, ni modèle, ni effort', () => {
  const universel = (source) => defautsDesSitesDAgent(ast({ rel: 'w.js', text: source }), { typesDeclares: TYPES_DECLARES }).map((d) => sansLieu(d.message));
  assert.deepEqual(universel("await agent('p', { agentType: 'lecteur' })"), []);
  assert.deepEqual(universel(muter(TEMOIN, JUGEMENT, "schema: VERDICT, agentType: 'juge' }")), []);
  assert.deepEqual(universel("await agent('p', { label: 'x' })"), [`\`agentType\` absent — un agent de workflow nomme un type déclaré sous \`.claude/agents/\` (${[...TYPES_DECLARES].join('/')})`]);
  assert.deepEqual(universel("await agent('p', { agentType: T })"), ["`agentType` non littéral — un étage d'agent se lit à la forme du script, jamais à l'exécution"]);
  assert.deepEqual(universel("await agent('p', OPTIONS)"), ["options de l'agent non littérales — la porte ne peut pas lire son étage"]);
});

test('#2537 — un script qui ne PARSE pas : chaque diagnostic du parseur est un défaut `syntaxe`, et rien d’autre ne se juge', () => {
  assert.deepEqual(vus(muter(TEMOIN, STATS, `const = 1\n${STATS}`)), ['syntaxe : Variable declaration expected.', 'syntaxe : Variable declaration expected.']);
});
