import { describe, it, expect } from 'vitest';
import { MONTEES_EDITEUR_DE_DONNEES } from './fsPersist';
import { monterBase } from '../lib/indexedDb';
import { baseSimulee } from '../lib/indexedDb.testkit';

describe('MONTEES_EDITEUR_DE_DONNEES — montée de `wfrp4-data-editor`', () => {
  it('base neuve : crée `handles`, à clés externes', () => {
    const base = baseSimulee();
    monterBase(MONTEES_EDITEUR_DE_DONNEES, base.db, 0);
    expect([...base.magasins.keys()]).toEqual(['handles']);
    expect(base.magasins.get('handles')?.keyPath).toBeUndefined();
  });
});
