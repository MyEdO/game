import { describe, it, expect } from 'vitest';
import { MIGRATIONS_EDITEUR_DE_DONNEES } from './fsPersist';
import { migrerBase } from '../lib/indexedDb';
import { baseSimulee } from '../lib/indexedDb.testkit';

describe('MIGRATIONS_EDITEUR_DE_DONNEES — migration de `wfrp4-data-editor`', () => {
  it('base neuve : crée `handles`, à clés externes', () => {
    const base = baseSimulee();
    migrerBase(MIGRATIONS_EDITEUR_DE_DONNEES, base.db, 0);
    expect([...base.magasins.keys()]).toEqual(['handles']);
    expect(base.magasins.get('handles')?.keyPath).toBeUndefined();
  });
});
