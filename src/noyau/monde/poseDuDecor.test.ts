/**
 * La pose d'un décor dans sa case (#3731) : son calage dans le jeu libre de son empreinte, le dessus d'un décor qui en
 * porte un autre, le pied d'un objet posé, les appuis qui ne tiennent plus, et ce que le monde en lit (volume, ligne
 * de vue).
 */
import { describe, expect, it } from 'vitest';
import { findPropById } from '../../data';
import { calageDuDecalage, decalageDuCalage, dessusSous } from '../../data/props.types';
import { ancreDuDecor } from './footprint';
import { tileBlocksSight } from './lineOfSight';
import { appuiSous, emporterLesObjets, fauteDAppui, normaliserLesAppuis, piedDuDecor, poseDeLAncre } from './poseDuDecor';
import { emptyScene, type Scene, type SceneEntity } from './scene';
import { volumeDuMonde, type VolumeDuMonde } from './volume/volume';

const decor = (id: string, ref: string, x: number, y: number, plus: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id, kind: 'prop', decor: { id: ref }, pos: { x, y }, ...plus });
const scene = (entities: SceneEntity[], metresPerTile?: number): Scene =>
  ({ ...emptyScene('pose-du-decor', 6, 4), entities, ...(metresPerTile ? { metresPerTile } : {}) });

describe('calage d’un décor dans le jeu libre de son empreinte', () => {
  const coffre = findPropById('coffre');

  it('à 2 m/case, un coffre plaqué au nord recule de son jeu libre, sa serrure comprise ; centré sans calage', () => {
    // Corps du coffre au cap S : x ∈ [-0,44 ; 0,44] m, y ∈ [-0,32 ; 0,34] m dans une case de 2 m.
    expect(decalageDuCalage(coffre, 'S', 2, undefined)).toEqual({ x: 0, y: 0 });
    const nord = decalageDuCalage(coffre, 'S', 2, { x: 0, y: -1 });
    expect(nord.y).toBeCloseTo(-0.34);
    expect(decalageDuCalage(coffre, 'S', 2, { x: 0, y: 1 }).y).toBeCloseTo(0.33);
    expect(decalageDuCalage(coffre, 'S', 2, { x: 1, y: 0 }).x).toBeCloseTo(0.28);
  });

  it('le calage suit le cap : tourné d’un quart, le même coffre a son jeu libre sur l’autre axe', () => {
    expect(decalageDuCalage(coffre, 'E', 2, { x: 1, y: 0 }).x).toBeCloseTo(decalageDuCalage(coffre, 'S', 2, { x: 0, y: 1 }).y);
  });

  it('à 1 m/case, le jeu libre se resserre et le corps reste dans sa case', () => {
    const est = decalageDuCalage(coffre, 'S', 1, { x: 1, y: 0 });
    expect(est.x).toBeCloseTo(0.06);
  });

  it('le calage et le décalage sont inverses l’un de l’autre, et un décalage au-delà du jeu libre se borne au bord', () => {
    for (const mpt of [1, 2])
      for (const c of [{ x: 0.5, y: -0.25 }, { x: -1, y: 1 }]) {
        const retour = calageDuDecalage(coffre, 'S', mpt, decalageDuCalage(coffre, 'S', mpt, c));
        expect(retour.x).toBeCloseTo(c.x);
        expect(retour.y).toBeCloseTo(c.y);
      }
    expect(calageDuDecalage(coffre, 'S', 2, { x: 3, y: -3 })).toEqual({ x: 1, y: -1 });
  });
});

describe('dessus d’un décor', () => {
  it('le plateau d’une table, à 0,78 m ; rien hors de la table', () => {
    expect(dessusSous(findPropById('table'), 'S', 0.2, -0.1)).toBeCloseTo(0.78);
    expect(dessusSous(findPropById('table'), 'S', 0.6, 0)).toBeUndefined();
  });

  it('le plateau rond d’une table ronde, porté par un cylindre debout', () => {
    const rond = dessusSous(findPropById('table-ronde-4-tabourets'), 'S', 0.3, 0.3);
    expect(rond).toBeGreaterThan(0.7);
    expect(rond).toBeLessThan(0.9);
  });

  it('le dessus d’un lit est le plus haut de ses épaisseurs à l’aplomb du point', () => {
    expect(dessusSous(findPropById('lit'), 'S', 0.4, 0)).toBeCloseTo(0.62);
    expect(dessusSous(findPropById('lit'), 'S', -0.8, 0)).toBeCloseTo(0.66);
  });

  it('un couvercle bombé ne porte rien', () => {
    expect(dessusSous(findPropById('coffre'), 'S', 0, 0)).toBeUndefined();
  });
});

describe('appui d’un décor posé sur un autre', () => {
  const table = decor('table-1', 'table', 2, 1);
  const lettre = decor('lettre-1', 'lettre', 2, 1, { sur: 'table-1' });

  it('le pied d’un objet posé est le dessus de son support ; sans appui, le sol de sa case', () => {
    const s = scene([table, lettre]);
    expect(piedDuDecor(s, lettre)).toBeCloseTo(0.78);
    expect(piedDuDecor(s, table)).toBe(0);
    const pile = decor('pile', 'lettre', 2, 1, { sur: 'lettre-1' });
    expect(piedDuDecor(scene([table, lettre, pile]), pile), 'sur le cachet de la première').toBeCloseTo(0.802);
  });

  it('un appui fautif est dit : support absent, autre couche, hors du dessus, chaîne qui revient sur soi', () => {
    expect(fauteDAppui(scene([lettre]), lettre)).toEqual({ faute: 'support', support: 'table-1' });
    expect(fauteDAppui(scene([{ ...table, z: 1 }, lettre]), lettre)?.faute).toBe('couche');
    expect(fauteDAppui(scene([table, { ...lettre, pos: { x: 4, y: 1 } }]), { ...lettre, pos: { x: 4, y: 1 } })?.faute).toBe('dessus');
    const a = decor('a', 'table', 1, 1, { sur: 'b' });
    const b = decor('b', 'table', 1, 1, { sur: 'a' });
    expect(fauteDAppui(scene([a, b]), a)?.faute).toBe('cycle');
    expect(fauteDAppui(scene([table, lettre]), lettre)).toBeUndefined();
  });

  it('la normalisation retire le seul appui qui ne tient plus, et rend la même scène quand tous tiennent', () => {
    const tient = scene([table, lettre]);
    expect(normaliserLesAppuis(tient)).toBe(tient);
    const orpheline = normaliserLesAppuis(scene([lettre]));
    expect(orpheline.entities[0]).toEqual(decor('lettre-1', 'lettre', 2, 1));
  });

  it('le support sous un point est le dessus le plus haut, jamais le décor posé ni ce qu’il porte', () => {
    const s = scene([table, lettre]);
    expect(appuiSous(s, { x: 2, y: 1 }, 0, 'autre')?.id).toBe('lettre-1');
    expect(appuiSous(s, { x: 2, y: 1 }, 0, 'table-1')).toBeUndefined();
    expect(appuiSous(s, { x: 2.1, y: 1 }, 0, 'lettre-1')?.id).toBe('table-1');
    expect(appuiSous(s, { x: 4, y: 1 }, 0, 'lettre-1')).toBeUndefined();
  });

  it('un décor qui bouge emporte ce qui repose sur lui, du même déplacement', () => {
    const avant = scene([table, { ...lettre, calage: { x: 0.3, y: 0 } }]);
    const apres = { ...avant, entities: avant.entities.map((e) => (e.id === 'table-1' ? { ...e, pos: { x: 3, y: 2 } } : e)) };
    const emporte = emporterLesObjets(avant, apres, 'table-1');
    const l = emporte.entities.find((e) => e.id === 'lettre-1')!;
    const mpt = 2;
    const de = ancreDuDecor(avant.entities[1], mpt);
    const a = ancreDuDecor(l, mpt);
    expect([a.x - de.x, a.y - de.y]).toEqual([1, 1]);
    expect(l.sur).toBe('table-1');
  });

  it('la pose d’une ancre : la case qui la porte et le calage borné à son jeu libre', () => {
    const s = scene([]);
    expect(poseDeLAncre(s, decor('c', 'coffre', 0, 0), { x: 1, y: 0.5 })).toEqual({ pos: { x: 1, y: 1 }, calage: { x: 0, y: -1 } });
    expect(poseDeLAncre(s, decor('c', 'coffre', 0, 0), { x: -3, y: 9 }).pos).toEqual({ x: 0, y: 3 });
  });
});

describe('ce que le monde lit d’un décor posé', () => {
  /** Les triangles de `v` en clés de sommets, et leurs hauteurs. */
  const triangles = (v: VolumeDuMonde) => v.morceaux.flatMap((m) => Array.from({ length: m.positions.length / 9 }, (_, t) => {
    const p = Array.from(m.positions.slice(t * 9, t * 9 + 9), (n) => Math.round(n * 1000) / 1000);
    return { cle: p.join(','), ys: [p[1], p[4], p[7]] };
  }));

  it('le volume pose la lettre sur le plateau de la table, à 0,78 m', () => {
    const table = decor('table-1', 'table', 2, 1);
    const seule = new Set(triangles(volumeDuMonde(scene([table]))).map((t) => t.cle));
    const lettre = triangles(volumeDuMonde(scene([table, decor('lettre-1', 'lettre', 2, 1, { sur: 'table-1' })]))).filter((t) => !seule.has(t.cle));
    expect(lettre.length).toBeGreaterThan(0);
    expect(Math.min(...lettre.flatMap((t) => t.ys))).toBeCloseTo(0.78);
  });

  it('un décor opaque coupe la vue même quand il n’est pas le premier de sa case', () => {
    expect(tileBlocksSight(scene([decor('t', 'tonneau', 1, 1), decor('p', 'paravent', 1, 1)]), 1, 1)).toBe(true);
    expect(tileBlocksSight(scene([decor('t', 'tonneau', 1, 1)]), 1, 1)).toBe(false);
  });
});
