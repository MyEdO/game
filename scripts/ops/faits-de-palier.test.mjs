// Les fonctions PURES de `faits-de-palier.mjs` : lecture des arguments, des commits du journal, des
// fermetures, du journal de dérogations et des courses CI. La lecture RÉELLE (git, gh, npm audit)
// n'est pas testée ici — elle compose des hôtes qui portent déjà leurs propres tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { soldesSuivis } from './fermetures-non-citees.mjs';
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs';
import {
  analyserArguments,
  commitDuJournal,
  fermeturesDesCommits,
  marquerSubstance,
  coursesDeLaFenetre,
  coursesParCommit,
  sortieParDefaut,
} from './faits-de-palier.mjs';
import { lancerGit } from '../test/gitDeBanc.mjs'

test('analyserArguments : la fenêtre se lit, elle ne se devine pas', () => {
  const lu = analyserArguments(['--base', 'aaaaaaaaa', '--tete', 'bbbbbbbbb', '--revue-precedente', 'x.md', '--hors-ligne']);
  assert.equal(lu.base, 'aaaaaaaaa');
  assert.equal(lu.tete, 'bbbbbbbbb');
  assert.equal(lu.revuePrecedente, 'x.md');
  assert.equal(lu.horsLigne, true);
  assert.equal(lu.sansChainage, false);
  assert.equal(lu.sortie, null);
});

test('analyserArguments : `--sortie` et `--sans-chainage` (banc) se lisent', () => {
  // Le chemin n'est ici qu'un JETON : `analyserArguments` est PUR, il ne l'ouvre pas. Il s'écrit donc
  // sans lettre de lecteur — une fixture ne nomme aucune machine (`src/portable-paths-guard.test.ts`).
  const lu = analyserArguments(['--base', 'aaaaaaaaa', '--tete', 'bbbbbbbbb', '--sortie', '/faits-de-banc.json', '--sans-chainage']);
  assert.equal(lu.sortie, '/faits-de-banc.json');
  assert.equal(lu.sansChainage, true);
});

test('sortieParDefaut : hors de l’arbre mesuré, nommée par la fenêtre', () => {
  const chemin = sortieParDefaut('f0f9436f5', 'c5b9087dcabc').replace(/\\/g, '/');
  assert.match(chemin, /wfrp-faits-de-palier\/faits-f0f9436f5-c5b9087dc\.json$/);
});

test('analyserArguments : sans base ni tête, l’erreur NOMME ce qui manque', () => {
  assert.throws(() => analyserArguments([]), /--base <sha>.*--tete <sha>/s);
  assert.throws(() => analyserArguments(['--base', 'aaa']), /--tete <sha>/);
});

test('commitDuJournal : le sujet est la première ligne du message, le corps le message entier', () => {
  const commit = commitDuJournal({ sha: 'aaa111', message: 'feat: un sujet\n\ncorrige #12\n' });
  assert.deepEqual(commit, { sha: 'aaa111', sujet: 'feat: un sujet', corps: 'feat: un sujet\n\ncorrige #12\n' });
});

test('marquerSubstance : seuls les commits qui touchent src/scripts comptent pour le palier', () => {
  const marques = marquerSubstance([{ sha: 'aaa' }, { sha: 'bbb' }], ['aaa']);
  assert.deepEqual(marques.map((c) => c.substance), [true, false]);
});

test('fermeturesDesCommits : les fermetures citées, croisées avec les soldes SUIVIS', () => {
  const commits = [
    { sha: 'aaa', sujet: 'feat: x', corps: 'corrige #1679' },
    { sha: 'bbb', sujet: 'fix: y closes #42', corps: 'fix: y closes #42' },
  ];
  const fermetures = fermeturesDesCommits(commits, new Set(['1679']));
  assert.deepEqual(fermetures.map((f) => [f.numero, f.sha, f.solde]), [['1679', 'aaa', true], ['42', 'bbb', false]]);
});

test('fermeturesDesCommits : un numéro cité deux fois par le MÊME commit ne compte qu’une fois', () => {
  const commits = [{ sha: 'aaa', sujet: 'feat: x corrige #7', corps: 'feat: x corrige #7\n\ncorrige #7' }];
  assert.equal(fermeturesDesCommits(commits, []).length, 1);
});

test('coursesParCommit : un commit sans course est rendu VIDE, jamais omis', () => {
  const servies = [
    { headSha: 'aaa', conclusion: 'success', status: 'completed', workflowName: 'CI' },
    { headSha: 'aaa', conclusion: 'failure', status: 'completed', workflowName: 'Canari' },
    { headSha: 'ccc', conclusion: 'success', status: 'completed', workflowName: 'CI' },
  ];
  const parSha = coursesParCommit(servies, ['aaa', 'bbb']);
  assert.deepEqual(parSha.map((r) => r.sha), ['aaa', 'bbb']);
  assert.deepEqual(parSha[0].courses.map((c) => c.conclusion), ['success', 'failure']);
  assert.deepEqual(parSha[1].courses, []);
});

test('coursesDeLaFenetre : une liste PÉRIMÉE (aucune course de la tête, la plus récente avant sa date) est INDISPONIBLE, jamais `courses: []`', () => {
  const figee = [{ headSha: 'vvv', createdAt: '2026-09-27T19:48:17Z', conclusion: 'success', status: 'completed', workflowName: 'CI' }];
  const vu = coursesDeLaFenetre({ disponible: true, valeur: figee }, { shas: ['aaa', 'ttt'], tete: 'ttt', dateTete: '2026-09-29T10:00:00+02:00' });
  assert.equal(vu.disponible, false);
  assert.match(vu.raison, /PÉRIMÉE/);
  assert.match(vu.raison, /2026-09-27T19:48:17/);
});

test('coursesDeLaFenetre : une liste qui porte la tête, ou une course postérieure à sa date, est lue par commit', () => {
  const tete = { headSha: 'ttt', createdAt: '2026-09-29T07:59:00Z', conclusion: 'success', status: 'completed', workflowName: 'CI' };
  const avecTete = coursesDeLaFenetre({ disponible: true, valeur: [tete] }, { shas: ['aaa', 'ttt'], tete: 'ttt', dateTete: '2026-09-29T10:00:00+02:00' });
  assert.equal(avecTete.disponible, true);
  assert.deepEqual(avecTete.valeur.map((r) => r.courses.length), [0, 1]);
  const posterieure = { headSha: 'zzz', createdAt: '2026-09-29T08:30:00Z', conclusion: 'success', status: 'completed', workflowName: 'CI' };
  const vu = coursesDeLaFenetre({ disponible: true, valeur: [posterieure] }, { shas: ['ttt'], tete: 'ttt', dateTete: '2026-09-29T10:00:00+02:00' });
  assert.deepEqual(vu, { disponible: true, valeur: [{ sha: 'ttt', courses: [] }] });
});

test('coursesDeLaFenetre : une lecture indisponible, ou vide, le reste', () => {
  assert.deepEqual(coursesDeLaFenetre({ disponible: false, raison: 'gh a rendu 1' }, { shas: ['ttt'], tete: 'ttt', dateTete: '2026-09-29T10:00:00Z' }).disponible, false);
  assert.equal(coursesDeLaFenetre({ disponible: true, valeur: [] }, { shas: ['ttt'], tete: 'ttt', dateTete: '2026-09-29T10:00:00Z' }).disponible, false);
});

test('soldesSuivis lit l’ARBRE qu’on lui donne (un objet de faits ne mélange pas deux arbres)', () => {
  const { racine: depot } = instanceDeDepot({ commit: false });
  mkdirSync(join(depot, '.claude', 'soldes'), { recursive: true });
  writeFileSync(join(depot, '.claude', 'soldes', '4242.md'), 'solde de banc\n');
  writeFileSync(join(depot, '.claude', 'soldes', '4243.md'), 'jamais ajouté à l’index\n');
  lancerGit(['add', '.claude/soldes/4242.md'], { cwd: depot });
  const suivis = soldesSuivis(depot);
  assert.equal(suivis.has('4242'), true, 'le solde SUIVI de cet arbre est vu');
  assert.equal(suivis.has('4243'), false, 'un fichier seulement présent sur le disque n’est pas un solde suivi');
});
