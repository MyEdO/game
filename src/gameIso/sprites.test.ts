import { describe, it, expect } from 'vitest';
import { entitySprite } from './sprites';
import { propSvg } from './catalog/decor';
import { creatureSpeciesOptions } from './rig/creatures';

// Le bestiaire ET les PNJ passent par le RIG (tokenBodyKind) ; le backend sprite (entitySprite) ne sert
// que le DÉCOR (props). Tout kind non-prop est routé vers le rig EN AMONT et n'atteint pas entitySprite
// → chaîne vide (jamais un sprite de créature monolithique).
describe('entitySprite — backend sprite = décor uniquement', () => {
  it('prop → sprite décor (propSvg)', () => {
    expect(entitySprite({ kind: 'prop', id: 'd1', ref: 'arbre' })).toBe(propSvg('arbre'));
  });
  it('tout kind non-prop (personnage, départ héros) → chaîne vide (rendu géré par le rig en amont)', () => {
    expect(entitySprite({ kind: 'personnage', id: 'c1' })).toBe('');
    expect(entitySprite({ kind: 'personnage', id: 'c2', ref: 'pigeon' })).toBe('');
    expect(entitySprite({ kind: 'heroStart', id: 'h1' })).toBe('');
  });
});

describe('creatureSpeciesOptions — source du picker éditeur (defs rig : id + libellé)', () => {
  it('contient des créatures canon variées et > 10 entrées', () => {
    const opts = creatureSpeciesOptions();
    expect(opts.some((o) => o.id === 'skaven' && o.label === 'Skaven')).toBe(true);
    expect(opts.some((o) => o.id === 'loup' && o.label === 'Loup')).toBe(true);
    expect(opts.length).toBeGreaterThan(10);
  });
});
