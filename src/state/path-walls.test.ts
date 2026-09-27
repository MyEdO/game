import { describe, it, expect } from 'vitest';
import { emptyScene, wallBetween, setDoorOpen, type Scene } from './scene';
import { areteEntre } from '../geometry/arete';
import { pathTo, reachable, walkComponentAt, walkNeighbors } from './path';

/**
 * Murs sur ARÊTES (cloisons fines) : ils bloquent le PASSAGE entre deux cases adjacentes sans rendre
 * la case infranchissable (contrairement au terrain `mur`). Une `door` laisse passer. Le BFS (pathTo/
 * reachable) en tient compte ; les scènes sans `walls` sont strictement inchangées (non-régression).
 */
function walledColumn(doorAtY?: number): Scene {
  const s = emptyScene(4, 4); // tout marchable
  s.walls = [0, 1, 2, 3].map((y) => ({ x: 1 as const, y, side: 'E' as const, door: y === doorAtY }));
  return s;
}
const empty = new Set<string>();

describe('murs sur arêtes — walkability', () => {
  it('areteEntre canonicalise l’arête entre deux cases adjacentes', () => {
    expect(areteEntre(1, 1, 2, 1)).toEqual({ x: 1, y: 1, side: 'E' }); // vers l'est
    expect(areteEntre(2, 1, 1, 1)).toEqual({ x: 1, y: 1, side: 'E' }); // symétrique
    expect(areteEntre(1, 1, 1, 2)).toEqual({ x: 1, y: 2, side: 'N' }); // vers le sud = N de (1,2)
    expect(areteEntre(1, 1, 3, 1)).toBeNull(); // pas adjacentes
  });

  it('wallBetween détecte le mur (pas la porte)', () => {
    const s = walledColumn(2);
    expect(wallBetween(s, 1, 1, 2, 1)).toBe(true); // mur
    expect(wallBetween(s, 1, 2, 2, 2)).toBe(false); // porte
    expect(wallBetween(s, 2, 1, 3, 1)).toBe(false); // pas de mur ici
  });

  it('un mur plein sur arête isole la moitié droite (pathTo null)', () => {
    expect(pathTo(walledColumn(), { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty })).toBeNull();
  });

  it('une PORTE dans le mur rétablit le passage (le chemin l’emprunte)', () => {
    const path = pathTo(walledColumn(2), { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty });
    expect(path).not.toBeNull();
    expect(path!.some((t) => t.x === 1 && t.y === 2)).toBe(true); // passe par la porte (y=2)
  });

  it('reachable n’atteint pas l’autre côté d’un mur plein', () => {
    const reach = reachable(walledColumn(), { x: 0, y: 0 }, 20, { blocked: empty });
    expect(reach.has('0,0')).toBe(true);
    expect(reach.has('3,0')).toBe(false); // muré
  });

  it('non-régression : sans `walls`, le BFS est inchangé', () => {
    expect(pathTo(emptyScene(4, 4), { x: 0, y: 0 }, { x: 3, y: 3 }, { blocked: empty })).not.toBeNull();
  });

  it('perf — `wallEdges` (mémoïsé par identité de `scene`) s’invalide quand une porte s’ouvre (nouvelle réf `scene`)', () => {
    const s = emptyScene(4, 4);
    s.walls = [{ x: 1, y: 1, side: 'E', door: true, closed: true }]; // arête entre (1,1) et (2,1)
    const before = walkNeighbors(s, { x: 1, y: 1 });
    expect(before.some((n) => n.x === 2 && n.y === 1)).toBe(false); // porte fermée bloque
    const opened = setDoorOpen(s, 1, 1, 'E', 0, true); // NOUVELLE réf scène
    const after = walkNeighbors(opened, { x: 1, y: 1 });
    expect(after.some((n) => n.x === 2 && n.y === 1)).toBe(true); // cache invalidé, porte franchissable
  });
});

/**
 * COMPOSANTES marchables (#1416) : l'étiquetage qui répond « existe-t-il un chemin de A à B ? » sans
 * refaire un parcours par question. Il doit dire EXACTEMENT ce que dit `pathTo` sur environnement nu,
 * et suivre l'état RUNTIME des portes — un étiquetage figé à l'état de départ serait pire que pas
 * d'étiquetage : il condamnerait à jamais ce qu'une porte ouverte vient de relier.
 */
describe('composantes marchables — même verdict que `pathTo`, et rafraîchies avec la scène', () => {
  const comp = (s: Scene, x: number, y: number) => walkComponentAt(s, x, y, 0);

  it('un mur plein sépare les composantes, une porte les réunit — comme `pathTo`', () => {
    const mur = walledColumn();
    const porte = walledColumn(2);

    expect(comp(mur, 0, 0)).not.toBeNull();
    expect(comp(mur, 0, 0)).toBe(comp(mur, 1, 3)); // même côté
    expect(comp(mur, 0, 0)).not.toBe(comp(mur, 3, 0)); // de part et d'autre du mur
    expect(pathTo(mur, { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty })).toBeNull();

    expect(comp(porte, 0, 0)).toBe(comp(porte, 3, 0)); // la porte réunit
    expect(pathTo(porte, { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty })).not.toBeNull();
  });

  it('une case NON marchable n’a aucune étiquette', () => {
    const s = emptyScene(4, 4);
    s.layers[0].tiles[1 * 4 + 1] = 'mur';

    expect(comp(s, 1, 1)).toBeNull();
    expect(comp(s, 0, 0)).not.toBeNull();
  });

  it('ouvrir une porte (scène neuve) refait l’étiquetage : les deux côtés se rejoignent', () => {
    const s = emptyScene(4, 4);
    s.walls = [0, 1, 2, 3].map((y) => ({ x: 1 as const, y, side: 'E' as const, door: y === 2, closed: y === 2 }));
    expect(comp(s, 0, 0), 'porte fermée : les deux côtés sont séparés').not.toBe(comp(s, 3, 0));

    const ouvert = setDoorOpen(s, 1, 2, 'E', 0, true); // NOUVELLE réf de scène

    expect(comp(ouvert, 0, 0), 'porte ouverte : même composante').toBe(comp(ouvert, 3, 0));
    expect(pathTo(ouvert, { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty })).not.toBeNull();
  });
});
