import { describe, it, expect } from 'vitest';
import { memoByDeps, memoByRef, memoByRefDeps } from './sceneMemo';

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

describe('memoByDeps — une variante, par identité de ses dépendances', () => {
  const a = { n: 1 };
  const b = { n: 2 };

  it('le même jeu rend le même objet sans rappeler le constructeur', () => {
    const memo = memoByDeps<{ somme: number }>();
    let appels = 0;
    const bati = (): { somme: number } => (appels++, { somme: a.n + b.n });
    const premier = memo([a, b], bati);
    expect(memo([a, b], bati)).toBe(premier);
    expect(appels).toBe(1);
  });

  it('un jeu qui diffère par une position, ou par sa longueur, rebâtit', () => {
    const memo = memoByDeps<object>();
    const premier = memo([a, b], () => ({}));
    const parPosition = memo([a, { n: 2 }], () => ({}));
    expect(parPosition).not.toBe(premier);
    const parLongueur = memo([a], () => ({}));
    expect(parLongueur).not.toBe(parPosition);
    expect(memo([a, undefined], () => ({}))).not.toBe(parLongueur);
  });

  it('le constructeur reçoit null la première fois, puis la variante précédente, ses dépendances et sa valeur', () => {
    const memo = memoByDeps<{ v: number }>();
    const recus: unknown[] = [];
    const premier = memo([a], (precedent) => (recus.push(precedent), { v: 1 }));
    const depsSuivantes = [b];
    memo(depsSuivantes, (precedent) => (recus.push(precedent), { v: 2 }));
    expect(recus[0]).toBeNull();
    expect(recus[1]).toEqual({ deps: [a], value: premier });
    expect((recus[1] as { value: unknown }).value).toBe(premier);
    expect((recus[1] as { deps: unknown[] }).deps[0]).toBe(a);
  });
});
