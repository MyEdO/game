import { describe, it, expect } from 'vitest';
import { upgradeEditeurDeDonnees } from './fsPersist';
import { baseSimulee } from '../lib/indexedDb.testkit';

describe('upgradeEditeurDeDonnees — montée de `wfrp4-data-editor`', () => {
  it('base neuve : crée `handles`, à clés externes', () => {
    const base = baseSimulee();
    upgradeEditeurDeDonnees(base.db, 0);
    expect([...base.magasins.keys()]).toEqual(['handles']);
    expect(base.magasins.get('handles')?.keyPath).toBeUndefined();
  });
});
