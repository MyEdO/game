import { describe, it, expect } from 'vitest';
import { memoByRef, memoByRefDeps } from './sceneMemo';

describe('memoByRef — le contrat d’identité, tenu par le gel en développement et en test', () => {
  it('une clé mémorisée est gelée en profondeur : une écriture en place LÈVE', () => {
    const cle = { entities: [{ id: 'a', pos: { x: 1, y: 2 } }], dimensions: { w: 3, h: 1 } };
    const nombre = memoByRef((k: typeof cle) => k.entities.length);
    expect(nombre(cle)).toBe(1);
    expect(() => { cle.entities.push({ id: 'b', pos: { x: 0, y: 0 } }); }).toThrow(TypeError);
    expect(() => { cle.entities[0].pos.x = 7; }).toThrow(TypeError);
    expect(() => { (cle as { dimensions: unknown }).dimensions = { w: 9, h: 9 }; }).toThrow(TypeError);
  });

  it('memoByRefDeps gèle sa clé de la même façon', () => {
    const cle = { tiles: ['herbe'] };
    const lire = memoByRefDeps<typeof cle, string>();
    expect(lire(cle, [1], () => cle.tiles[0])).toBe('herbe');
    expect(() => { cle.tiles[0] = 'eau'; }).toThrow(TypeError);
  });

  it('une instance de classe n’est ni gelée ni parcourue', () => {
    const index = new Map<string, number>();
    const cle = { index, dejaVus: new Set<string>() };
    memoByRef((k: typeof cle) => k.index.size)(cle);
    index.set('a', 1);
    cle.dejaVus.add('a');
    expect(Object.isFrozen(index)).toBe(false);
    expect(index.get('a')).toBe(1);
  });
});
