import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type CastableSpell } from './ai';
import { Scene } from './scene';
import { Combatant } from '../../engine/types';
import type { SpellData } from '../../data';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';
import { idDeFixture } from '../../data/idDeFixture.testkit';

/** Projectile magique RÉSOLU minimal (`CastableSpell`) — `range` en cases (null = pas de gate). */
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data: SpellData = { id: idDeFixture('spell', over.id ?? 'carreau'), type: 'spells', label: 'Carreau', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', missile: true, damage: 8, source: { book: 'LDB', page: 0 } };
  return { id: over.id ?? 'carreau', data, cn: 0, range: over.range ?? null, shape: 'single', landProb: 1, focusState: 'none', active: false };
}

const enemy = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({ id: 'E', name: 'Tireur', kind: 'ennemi', characteristics: {} as any, wounds: blessuresDeBase(10), advantage: 0, conditions: [], weapons: [{ name: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }], armour: {} as any, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 }, ...over })) as unknown as Combatant;

const hero = (x: number): Combatant =>
  (blessuresSurLeProfil({ id: 'H', name: 'Héros', kind: 'heros', characteristics: {} as any, wounds: blessuresDeBase(10), conditions: [], pos: { x, y: 0 } })) as unknown as Combatant;

function scene(w: number, tiles?: Record<string, string>): Scene {
  const grid = new Array(w).fill('herbe');
  if (tiles) for (const [k, v] of Object.entries(tiles)) grid[Number(k.split(',')[0])] = v;
  return { id: 's', name: 's', dimensions: { w, h: 1 }, ambiance: 'jour', layers: [{ z: 0, tiles: grid }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
}

describe('IA — respecte la Ligne de Vue au tir (LDB 13 l.114)', () => {
  it('cible visible → tire', () => {
    const action = chooseEnemyAction({ enemy: enemy(), heroes: [hero(5)], scene: scene(7), blocked: new Set(), movement: 4, spells: [] });
    expect(action.kind).toBe('tir');
  });
  it('cible derrière un mur (LdV bloquée) → ne tire PAS', () => {
    const action = chooseEnemyAction({ enemy: enemy(), heroes: [hero(6)], scene: scene(8, { '3,0': 'mur' }), blocked: new Set(), movement: 4, spells: [] });
    expect(action.kind).not.toBe('tir');
  });
});

describe('IA — respecte la PORTÉE (tir : bande Extrême ×3 ; sort : portée du sort)', () => {
  it('héros au-delà de Portée ×3 → ne tire pas (s’approche) ; à exactement ×3 → tire', () => {
    // Arc 10 m → Extrême ≤ 30 m = 15 cases.
    const e = () => enemy({ weapons: [{ name: 'Arc', type: 'distance', damage: { plusBF: false, flat: 8 }, range: 10, qualities: [] }] as never });
    const far = chooseEnemyAction({ enemy: e(), heroes: [hero(20)], scene: scene(25), blocked: new Set(), movement: 4, spells: [] });
    expect(far.kind).toBe('deplacement');
    const edge = chooseEnemyAction({ enemy: e(), heroes: [hero(15)], scene: scene(25), blocked: new Set(), movement: 4, spells: [] });
    expect(edge.kind).toBe('tir');
  });
  it('sort hors de portée → ne lance pas (s’approche) ; à portée → cast', () => {
    const e = () => enemy({ weapons: [] });
    const far = chooseEnemyAction({ enemy: e(), heroes: [hero(5)], scene: scene(10), blocked: new Set(), movement: 4, spells: [castable({ range: 3 })] });
    expect(far.kind).toBe('deplacement');
    const ok = chooseEnemyAction({ enemy: e(), heroes: [hero(3)], scene: scene(10), blocked: new Set(), movement: 4, spells: [castable({ range: 3 })] });
    expect(ok.kind).toBe('incantation');
  });
  it('portée non chiffrable (sort spécial / arme sans Portée) → pas de gate', () => {
    const ok = chooseEnemyAction({ enemy: enemy({ weapons: [] }), heroes: [hero(8)], scene: scene(10), blocked: new Set(), movement: 4, spells: [castable({ range: null })] });
    expect(ok.kind).toBe('incantation');
  });
});
