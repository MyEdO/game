/**
 * MORSURE des PORTES de `2026-09-24-1473-graphie-ops-de-talent.mjs` (#1473) — volet `src/data` : les ops
 * `grantTalent` / `grantCareerTalent` passent de `{ talentId, spec? }` à `talent: { id, spec? }`, et les
 * réfs de Talent d'axe (`axes.json › [].talents[]`) de `{ talentId, spec? }` à `{ id, spec? }`.
 *
 * La migration est jouée sur un dépôt JETABLE (`./joue.mjs`), une fois par scénario, avec la primitive
 * qu'elle importe (`src/data/graphieOpsDeTalent.ts`, COPIÉE de l'arbre) : migration réelle, idempotence,
 * op à deux graphies, réf d'axe à deux graphies, formatage non canonique. Les rouges d'avant-écriture
 * exigent sortie 1, message NOMINATIF et ZÉRO fichier touché. FIXTURES FABRIQUÉES, état d'arrivée écrit
 * à la main.
 *
 * Ce banc vit sous `lib/` : `replay.mjs` scanne le dossier des migrations à PLAT et n'y admet que
 * des `.mjs` à préfixe DATÉ.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { FORME_DATA, serialise } from './croissance.mjs';
import { depot, efface, joue, lireDans, refuse, rienTouche } from './joue.mjs';

const MIGRATION = '2026-09-24-1473-graphie-ops-de-talent.mjs';
const COPIES = ['src/data/graphieOpsDeTalent.ts'];
const TRAITS = 'src/data/traits.json';
const AXES = 'src/data/axes.json';

/** Un trait porteur : une op de carrière imbriquée, spécialisée, et une op d'une autre famille intacte. */
const traits = () => [
  { id: 'marque', passive: [{ op: 'perRound', ops: [{ op: 'grantCareerTalent', talentId: 'savoir-vivre', spec: 'nobles' }] }, { op: 'grantCareerSkill', skill: { id: 'art' } }] },
  { id: 'nu', passive: [{ op: 'grantTalent', talentId: 'chanceux' }] },
];
const traitsApres = () => [
  { id: 'marque', passive: [{ op: 'perRound', ops: [{ op: 'grantCareerTalent', talent: { id: 'savoir-vivre', spec: 'nobles' } }] }, { op: 'grantCareerSkill', skill: { id: 'art' } }] },
  { id: 'nu', passive: [{ op: 'grantTalent', talent: { id: 'chanceux' } }] },
];
const axes = () => [{ id: 'axe', talents: [{ talentId: 'sens-aiguise', spec: 'odorat' }, { talentId: 'chanceux' }] }];
const axesApres = () => [{ id: 'axe', talents: [{ id: 'sens-aiguise', spec: 'odorat' }, { id: 'chanceux' }] }];

const poses = (t = traits(), a = axes()) => ({ [TRAITS]: serialise(t, FORME_DATA), [AXES]: serialise(a, FORME_DATA) });

test('(a) MIGRATION RÉELLE : chaque op et chaque réf d’axe prend sa graphie À SA PLACE, le reste intact', (t) => {
  const d = depot(poses(), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.equal(lireDans(d.racine, TRAITS), serialise(traitsApres(), FORME_DATA));
  assert.equal(lireDans(d.racine, AXES), serialise(axesApres(), FORME_DATA));
  assert.ok(sortie.includes('ops de Talent : 2 réécrite(s)'), `le compte d’ops ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes('réfs de Talent d’axe : 2 réécrite(s)'), `le compte d’axe ne se DIT pas : ${sortie.slice(0, 1200)}`);
});

test('(b) IDEMPOTENCE : rejouée sur l’état d’arrivée, sortie 0 sans rien écrire', (t) => {
  const d = depot(poses(traitsApres(), axesApres()), COPIES);
  t.after(() => efface(d.racine));
  const { code, sortie } = joue(d.racine, MIGRATION);
  assert.equal(code, 0, `sortie ${code} : ${sortie.slice(0, 1200)}`);
  assert.ok(sortie.includes('Fichiers réécrits : aucun'), `le no-op ne se DIT pas : ${sortie.slice(0, 1200)}`);
  assert.deepEqual(rienTouche(d.racine, d.avant), [], 'le rejeu a écrit');
});

test('(c) FAIL-FAST op à DEUX graphies (`talentId` ET `talent`) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const t = traits();
  t[1].passive[0].talent = { id: 'chanceux' };
  refuse(MIGRATION, poses(t), 'traits.json traits.json[1].passive[0] : porte À LA FOIS `talentId` et `talent`', COPIES);
});

test('(d) FAIL-FAST réf d’axe à DEUX graphies (`talentId` ET `id`) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  const a = axes();
  a[0].talents[1].id = 'chanceux';
  refuse(MIGRATION, poses(traits(), a), 'axes.json axe.talents[1] : porte À LA FOIS `talentId` et `id`', COPIES);
});

test('(e) FORMATAGE non canonique (saut de ligne final) → sortie 1 NOMINATIVE, rien d’écrit', () => {
  refuse(MIGRATION, { ...poses(), [TRAITS]: `${serialise(traits(), FORME_DATA)}\n` }, 'traits.json n’est pas sous sa forme canonique', COPIES);
});
