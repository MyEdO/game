import { describe, it, expect, afterEach } from 'vitest';
import { restoreDataDir } from './fsPersist';
import { __setFabriqueIdbForTest } from '../lib/indexedDb';
import { brancherBasesSimulees } from '../lib/indexedDb.testkit';

type FenetreFs = Window & { showDirectoryPicker?: unknown };

afterEach(() => {
  __setFabriqueIdbForTest(null);
  delete (globalThis as { window?: FenetreFs }).window;
});

describe('`wfrp4-data-editor` — déclarée (#2404)', () => {
  it('base neuve : `handles` à clés externes, aucun dossier mémorisé', async () => {
    (globalThis as { window?: FenetreFs }).window = { showDirectoryPicker: () => undefined } as FenetreFs;
    const bases = brancherBasesSimulees();
    await expect(restoreDataDir()).resolves.toBeNull();
    expect([...bases.base('wfrp4-data-editor').magasins].map(([nom, m]) => [nom, m.keyPath])).toEqual([['handles', undefined]]);
  });
});
