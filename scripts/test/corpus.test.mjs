import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testsDuCorpusPour, jouerTestsDuCorpus, lireArgumentsCorpus, fichiersDuCorpusDepuis } from './corpus.mjs';
import { INDEX, SUIVI, TRAVAIL } from '../guards/lib/gitPorte.mjs';
import { depotReel } from '../guards/lib/depotGabarit.mjs';
import { gitDe } from './gitDeBanc.mjs';

test('un dépôt réel fournit base, index, WIP et imports WIP sans borne :travail', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'corpus-2337-'));
  t.after(() => rmSync(racine, { recursive: true, force: true }));
  const git = gitDe(racine);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'corpus@example.test');
  git('config', 'user.name', 'Corpus fixture');
  mkdirSync(join(racine, 'src/data'), { recursive: true });
  mkdirSync(join(racine, 'src/scenes'), { recursive: true });
  writeFileSync(join(racine, 'CLAUDE.md'), '@base.md\n');
  writeFileSync(join(racine, 'src/data/suivi.json'), '[]');
  git('add', '--', 'CLAUDE.md', 'src/data/suivi.json');
  git('commit', '-q', '-m', 'fixture initiale');
  writeFileSync(join(racine, 'CLAUDE.md'), '@index.md\n');
  writeFileSync(join(racine, 'src/data/indexe.json'), '[]');
  git('add', '--', 'CLAUDE.md', 'src/data/indexe.json');
  writeFileSync(join(racine, 'CLAUDE.md'), '@travail.md\n');
  writeFileSync(join(racine, 'src/data/suivi.json'), '[{}]');
  writeFileSync(join(racine, 'src/scenes/neuf-projet.json'), '{}');
  const scope = fichiersDuCorpusDepuis('HEAD', depotReel(racine));
  assert.deepEqual(scope.fichiers, ['CLAUDE.md', 'src/data/indexe.json', 'src/data/suivi.json', 'src/scenes/neuf-projet.json']);
  assert.deepEqual(scope.imports, ['base.md', 'index.md', 'travail.md']);
});

test('la sélection de base inclut index, WIP, non suivis et imports avant/après', () => {
  const images = [];
  const depot = {};
  const scope = fichiersDuCorpusDepuis('base-fixture', depot, {
    ceQuiChange: (d, avant, apres) => {
      assert.equal(d, depot);
      assert.equal(avant, 'base-fixture');
      assert.equal(apres, SUIVI);
      return { chemins: () => ['src/data/indexe.json', 'src/scenes/wip-projet.json'] };
    },
    listerImage: (d, image) => image === 'HEAD' ? ['src/data/indexe.json'] : ['src/data/indexe.json', 'src/scenes/wip-projet.json', 'src/data/neuf.json'],
    lireEnLot: (d, image) => {
      assert.notEqual(image, TRAVAIL);
      images.push(image);
      return new Map([['CLAUDE.md', image === 'base-fixture' ? '@avant.md' : image === INDEX ? '@index.md' : '@apres.md']]);
    },
    lireTravail: (d) => { assert.equal(d, depot); return '@travail.md'; },
  });
  assert.deepEqual(scope.fichiers, ['src/data/indexe.json', 'src/data/neuf.json', 'src/scenes/wip-projet.json']);
  assert.deepEqual(scope.imports, ['avant.md', 'apres.md', 'index.md', 'travail.md']);
  assert.deepEqual(images, ['base-fixture', 'HEAD', INDEX]);
});

test('un lieu ou un déclencheur livré sélectionne les cinq contrats de corpus', () => {
  assert.deepEqual(testsDuCorpusPour(['src/scenes/diligence/diligence-projet.json']), [{ lanceur: 'npm test', tests: ['src/data/maison-sans-source.test.ts', 'src/data/refs-migrated.test.ts', 'src/data/schemas/grammaire/flow-de-scene.test.ts', 'src/data/slots-contrat.test.ts', 'src/data/structures-contrat.test.ts'] }]);
});

test('une donnée sélectionne aussi les deux contrôles d’intégrité, une seule fois', () => {
  assert.deepEqual(testsDuCorpusPour(['src/data/creatures.json', 'src/data/lieux.json'])[0].tests, ['src/data/maison-sans-source.test.ts', 'src/data/refs-migrated.test.ts', 'src/data/schemas/grammaire/flow-de-scene.test.ts', 'src/data/slots-contrat.test.ts', 'src/data/structures-contrat.test.ts']);
});

test('les imports du budget des deux images sont jugés, le RAW utilise le runner canonique', () => {
  assert.deepEqual(testsDuCorpusPour(['.claude/memory/fiche.md', 'Source/Livre/08.md', 'scripts/raw/coverage.mjs'], ['.claude/memory/fiche.md']), [
    { lanceur: 'node-tests', gate: 'test:raw' },
    { lanceur: 'node --test', tests: ['scripts/guards/budget-contexte.test.mjs'] },
    { lanceur: 'node --test', tests: ['scripts/hooks/solde-ticket-guard.test.mjs'], motif: 'budget' },
  ]);
  assert.deepEqual(testsDuCorpusPour(['src/engine/test.ts']), []);
});

test('les refus sont collectés séquentiellement, y compris un signal sans code', () => {
  const selections = testsDuCorpusPour(['src/data/creatures.json', 'scripts/raw/coverage.mjs', 'CLAUDE.md']);
  const appels = [];
  const refus = jouerTestsDuCorpus(selections, { journal: () => {}, lancer: (bin, args) => {
    appels.push([bin, args]);
    return appels.length === 1 ? { status: 7, signal: null } : appels.length === 2 ? { status: null, signal: 'SIGTERM' } : { status: 0, signal: null };
  } });
  assert.equal(appels.length, selections.length);
  assert.deepEqual(refus.map((r) => r.code), [7, 1]);
  assert.equal(appels[0][1][0], 'scripts/test/run.mjs');
  assert.deepEqual(appels[1][1], ['scripts/test/node-tests.mjs', 'test:raw']);
  assert.deepEqual(appels.at(-1)[1], ['--test', '--test-name-pattern=budget', 'scripts/hooks/solde-ticket-guard.test.mjs']);
});

test('le périmètre explicite et la base se combinent, les arguments incomplets sont refusés', () => {
  assert.deepEqual(lireArgumentsCorpus(['--base', 'origin/main', '--fichier', 'src/data/creatures.json']), { base: 'origin/main', fichiers: ['src/data/creatures.json'] });
  assert.throws(() => lireArgumentsCorpus([]));
  assert.throws(() => lireArgumentsCorpus(['--base']));
  assert.throws(() => lireArgumentsCorpus(['--tout']));
});
