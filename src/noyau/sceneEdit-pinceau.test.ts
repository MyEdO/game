import { describe, it, expect } from 'vitest';
import { emptyScene, crenellatedAt, heightAt, tileAt } from './monde/scene';
import { empriseDuPinceau } from './sceneEditLecture';
import { paintCrenellated, paintHeight, paintTiles } from './sceneEdit';

/** Cases que l'écriture a changées, par comparaison case à case avec la scène d'avant. */
function casesChangees(w: number, h: number, lire: (x: number, y: number) => unknown, avant: (x: number, y: number) => unknown) {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lire(x, y) !== avant(x, y)) out.push({ x, y });
  return out;
}

const trie = (cases: { x: number; y: number }[]) => [...cases].sort((a, b) => a.y - b.y || a.x - b.x);

describe('empriseDuPinceau — une seule emprise pour tous les peintres de case (#3059)', () => {
  const dims = { w: 6, h: 5 };

  it('carré centré, rogné à la carte au coin', () => {
    expect(trie(empriseDuPinceau(dims, { x: 0, y: 0 }, 3))).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    expect(empriseDuPinceau(dims, { x: 3, y: 2 }, 1)).toEqual([{ x: 3, y: 2 }]);
    expect(empriseDuPinceau(dims, { x: 3, y: 2 }, 3)).toHaveLength(9);
  });

  it('un centre hors carte ne peint rien, même si le carré déborderait dedans', () => {
    expect(empriseDuPinceau(dims, { x: -1, y: 0 }, 3)).toEqual([]);
    expect(empriseDuPinceau(dims, { x: 6, y: 4 }, 5)).toEqual([]);
  });

  const s = emptyScene('pinceau', dims.w, dims.h);
  const coin = { x: 5, y: 0 };
  const attendu = trie(empriseDuPinceau(dims, coin, 3));

  it('paintTiles peint exactement l’emprise', () => {
    const apres = paintTiles(s, coin, 'eau', 3);
    expect(casesChangees(dims.w, dims.h, (x, y) => tileAt(apres, x, y), (x, y) => tileAt(s, x, y))).toEqual(attendu);
  });

  it('paintHeight peint exactement l’emprise', () => {
    const apres = paintHeight(s, coin, 2, 3);
    expect(casesChangees(dims.w, dims.h, (x, y) => heightAt(apres, x, y), (x, y) => heightAt(s, x, y))).toEqual(attendu);
  });

  it('paintCrenellated peint exactement l’emprise', () => {
    const apres = paintCrenellated(s, coin, 'mur-en-pierre', 3);
    expect(casesChangees(dims.w, dims.h, (x, y) => crenellatedAt(apres, x, y), (x, y) => crenellatedAt(s, x, y))).toEqual(attendu);
  });

  it('un centre hors carte laisse la scène intacte', () => {
    expect(paintTiles(s, { x: -1, y: 0 }, 'eau', 3)).toBe(s);
    expect(paintHeight(s, { x: -1, y: 0 }, 2, 3)).toBe(s);
    expect(paintCrenellated(s, { x: -1, y: 0 }, 'mur-en-pierre', 3)).toBe(s);
  });
});
