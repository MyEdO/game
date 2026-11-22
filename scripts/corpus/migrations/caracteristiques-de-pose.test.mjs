import { deepStrictEqual, match, strictEqual } from 'node:assert';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../campagne/migrer-caracteristiques-de-pose.mjs', import.meta.url));
const migration = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8', timeout: 5_000 });
const projet = (entities) => ({
  type: 'projet',
  id: 'patrouille',
  scenes: [{ id: 'cour', entities }, { id: 'chemin' }],
});
const profil = { type: 'statblock', label: 'Garde', char: { force: 30 } };

test('le projet migré conserve le réglage qui jouait pour chaque pose', () => {
  const poses = [
    { id: 'herite', kind: 'personnage', statblock: { ...profil, randomChars: true } },
    { id: 'conflit', kind: 'personnage', statblock: { ...profil, randomChars: true }, combat: { randomChars: false, hiddenUntilCombat: true } },
    { id: 'double', kind: 'personnage', statblock: { ...profil, randomChars: true }, combat: { randomChars: true } },
    { id: 'fixe', kind: 'personnage', statblock: { ...profil, randomChars: false } },
    { id: 'pose', kind: 'personnage', statblock: { ...profil, randomChars: false }, combat: { randomChars: true } },
    { id: 'preset', kind: 'personnage', presetId: 'garde', statblock: { ...profil, randomChars: true }, combat: { randomChars: false } },
    { id: 'preset-vide', kind: 'personnage', presetId: '', statblock: { ...profil, randomChars: true } },
    { id: 'decor', kind: 'prop', statblock: { ...profil, randomChars: true } },
    { id: 'depart', kind: 'heroStart', statblock: { ...profil, randomChars: true } },
  ];
  const attaque = { assaillant: { statblock: { ...profil, randomChars: true } } };
  const ancien = projet(poses);
  ancien.scenes[0].attaquesSubies = [attaque];
  const vu = migration(JSON.stringify(ancien));
  strictEqual(vu.status, 0, vu.stderr);

  const combats = [
    { randomChars: true },
    { randomChars: true, hiddenUntilCombat: true },
    { randomChars: true },
    undefined,
    { randomChars: true },
    { randomChars: false },
    { randomChars: true },
    undefined,
    undefined,
  ];
  const attendu = projet(poses.map(({ combat: _combat, ...pose }, rang) => ({
    ...pose,
    statblock: profil,
    ...(combats[rang] && { combat: combats[rang] }),
  })));
  attendu.scenes[0].attaquesSubies = [attaque];
  deepStrictEqual(JSON.parse(vu.stdout), attendu);

  const seconde = migration(vu.stdout);
  strictEqual(seconde.status, 0, seconde.stderr);
  strictEqual(seconde.stdout, vu.stdout);
});

test('un projet canonique reçu par flux conserve ses octets', () => {
  const exporte = JSON.stringify({ ...projet([]), label: 'é'.repeat(128 * 1024) }) + '\n';
  const vu = migration(exporte);
  strictEqual(vu.status, 0, vu.stderr);
  strictEqual(vu.stdout, exporte);
});

test('un booléen illisible arrête la conversion au champ et ne rend aucun projet partiel', () => {
  const valide = { id: 'premier', kind: 'personnage', statblock: { ...profil, randomChars: true } };
  for (const [champ, pose] of [
    ['statblock', { ...valide, statblock: { ...profil, randomChars: 'true' } }],
    ['combat', { ...valide, combat: { randomChars: 1 } }],
  ]) {
    const vu = migration(JSON.stringify(projet([valide, { ...pose, id: 'second' }])));
    strictEqual(vu.status, 1);
    strictEqual(vu.stdout, '');
    match(vu.stderr, new RegExp(`scenes\\[0\\]\\.entities\\[1\\]\\.${champ}\\.randomChars : un booléen`));
  }
});

test('les enveloppes de projet interne et de partie enregistrée sont refusées', () => {
  for (const enveloppe of [{ project: projet([]) }, { data: { campaignDoc: projet([]) } }]) {
    const vu = migration(JSON.stringify(enveloppe));
    strictEqual(vu.status, 1);
    strictEqual(vu.stdout, '');
    match(vu.stderr, /attendu : un export de projet/);
  }
});
