/**
 * MORSURE des PORTES de `2026-10-18-2820-renvoi-codex-des-enjeux.mjs` — le foyer de règle (`rule` id
 * nu + `ruleCategory`) devient une référence typée `{ id, type }`.
 *
 * Joué sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario : migration réelle (catégorie
 * explicite, défaut `regles` écrit, rangée nichée de `crew-test-types.json`), idempotence, fail-fast
 * (catégorie hors table, `ruleCategory` sans `rule`, id absent du catalogue de son type, double
 * graphie, `rule` de forme étrangère, forme non canonique). Les rouges d'avant-écriture exigent
 * sortie 1, message NOMINATIF et ZÉRO fichier touché. FIXTURES FABRIQUÉES, état d'arrivée écrit à la
 * main.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { crees, depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-10-18-2820-renvoi-codex-des-enjeux.mjs';

const catalogues = {
  'src/data/regles.json': serialise([{ id: 'chute' }, { id: 'exposition' }], FORME_DATA),
  'src/data/spells.json': serialise([{ id: 'chute' }], FORME_DATA),
  'src/data/skills.json': serialise([{ id: 'survie-en-exterieur' }], FORME_DATA),
};

const actions = () => [
  { id: 'sauter', rule: 'chute', label: 'Sauter' },
  { id: 'voler', ruleCategory: 'spells', rule: 'chute' },
  { id: 'attendre' },
];
const actionsApres = () => [
  { id: 'sauter', rule: { id: 'chute', type: 'regle' }, label: 'Sauter' },
  { id: 'voler', rule: { id: 'chute', type: 'spell' } },
  { id: 'attendre' },
];
const equipage = () => ({ types: [{ id: 'abri', rule: 'survie-en-exterieur', ruleCategory: 'skills' }] });
const equipageApres = () => ({ types: [{ id: 'abri', rule: { id: 'survie-en-exterieur', type: 'skill' } }] });

/** Le dépôt : catalogues fabriqués, `actions` et `crew-test-types` sous la forme demandée, porteurs vides. */
const fichiers = (liste = actions(), crew = equipage()) => ({
  ...catalogues,
  'src/data/actions.json': serialise(liste, FORME_DATA),
  'src/data/activities.json': serialise([], FORME_DATA),
  'src/data/combat-stakes.json': serialise([], FORME_DATA),
  'src/data/flow-stakes.json': serialise([], FORME_DATA),
  'src/data/night-stakes.json': serialise([], FORME_DATA),
  'src/data/voyage-stakes.json': serialise([], FORME_DATA),
  'src/data/crew-test-types.json': serialise(crew, FORME_DATA),
});

/** `actions()` dont l'action `id` est REMPLACÉE par `entree`. */
const avec = (id, entree) => actions().map((a) => (a.id === id ? entree : a));

test('(a) MIGRATION RÉELLE : catégorie explicite et défaut `regles` en `{ id, type }`, À LEUR PLACE, rangée nichée comprise', (t) => {
  const d = depot(fichiers());
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, 'src/data/actions.json'), serialise(actionsApres(), FORME_DATA));
  assert.equal(lireDans(d.racine, 'src/data/crew-test-types.json'), serialise(equipageApres(), FORME_DATA));
  assert.ok(sortie.includes('3 id(s) nu(s) migré(s) en { id, type } dont 1 au défaut « regles », 2 fichier(s) écrit(s)'),
    `le compte ne se DIT pas : ${sortie.slice(0, 1200)}`);
});

test('(b) IDEMPOTENCE : rejouée sur l’état d’arrivée (clés dans un autre ordre comprises), sortie 0 sans rien écrire', (t) => {
  const arrivee = actionsApres().map((a) => (a.id === 'voler' ? { id: 'voler', rule: { type: 'spell', id: 'chute' } } : a));
  const d = depot(fichiers(arrivee, equipageApres()));
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes('no-op'), `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual([...rienTouche(d.racine, d.avant), ...crees(d.racine, d.avant, 'src/data')], [], 'le rejeu a écrit');
});

test('(c) FAIL-FAST catégorie hors de la table figée → NOMMÉE, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('voler', { id: 'voler', ruleCategory: 'creatures', rule: 'chute' })),
    'actions.json « voler » : catégorie « creatures » hors de la table figée');
});

test('(d) FAIL-FAST `ruleCategory` sans `rule` → NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('voler', { id: 'voler', ruleCategory: 'spells' })),
    'actions.json « voler » : ruleCategory « spells » sans rule');
});

test('(e) FAIL-FAST id absent du catalogue de SON type (présent dans un autre) → NOMMÉ, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('voler', { id: 'voler', ruleCategory: 'spells', rule: 'exposition' })),
    'actions.json « voler » : « exposition » absent du catalogue spells.json (catégorie « spells »)');
});

test('(f) FAIL-FAST double graphie : référence typée ET `ruleCategory` → NOMMÉE, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('voler', { id: 'voler', ruleCategory: 'spells', rule: { id: 'chute', type: 'spell' } })),
    'actions.json « voler » : référence typée {"id":"chute","type":"spell"} ET ruleCategory « spells » — deux graphies du même foyer');
});

test('(g) PORTE DE FORME : `rule` ni id ni `{ id, type }`, fichier non canonique → NOMMÉS, rien d’écrit', () => {
  refuse(MIGRATION, fichiers(avec('voler', { id: 'voler', rule: { id: 'chute' } })),
    'actions.json « voler » : rule {"id":"chute"} n’est ni un id ni une référence { id, type }');
  refuse(MIGRATION, { ...fichiers(), 'src/data/actions.json': `${serialise(actions(), FORME_DATA)}\n` },
    'actions.json : le fichier n’est pas sous sa forme canonique');
});
