import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { livresExtraits, mesurerProseInline } from './proseInline.mjs';

const LIVRE = 'ennemi-dans-l-ombre';
const RACINE = Object.freeze({ dossier: 'fixtures', suffixe: '-projet.json', recursif: true });

/** Mesure un projet de fixture à racine `source` extraite, posé dans un dépôt temporaire. */
const mesurer = (noeud) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-inline-'));
  try {
    fs.mkdirSync(path.join(root, RACINE.dossier));
    const doc = { type: 'projet', source: { book: LIVRE, page: 12 }, dialogues: [{ id: 'd', nodes: [noeud] }] };
    fs.writeFileSync(path.join(root, RACINE.dossier, 'fixture-projet.json'), JSON.stringify(doc));
    return mesurerProseInline([RACINE], root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

test('le livre de la fixture est extrait (la mesure le voit)', () => {
  assert.ok(livresExtraits().has(LIVRE));
});
test('un nœud nu sous une racine `source` extraite hérite de sa source : compté', () => {
  assert.deepEqual(mesurer({ id: 'n1', desc: 'Réplique.' }).projet?.noeuds, ['fixtures/fixture-projet.json › dialogues[0].nodes[0]']);
});
test('`adapteDe` l’emporte sur une `source` propre, comme `sourceHeritee` : pas compté', () => {
  const noeud = { id: 'n1', desc: 'Réplique.', source: { book: LIVRE, page: 12 }, adapteDe: { book: LIVRE, page: 14 } };
  assert.deepEqual(mesurer(noeud), {});
});
test('un nœud `adapteDe` coupe l’héritage : pas compté, ni ce qu’il contient', () => {
  const noeud = { id: 'n1', desc: 'Réplique.', adapteDe: { book: LIVRE, page: 14 }, sous: { desc: 'Imbriquée.' } };
  assert.deepEqual(mesurer(noeud), {});
});
