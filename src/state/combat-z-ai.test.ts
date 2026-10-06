import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import type { Combatant } from '../engine/types';
import { chebyshev } from '../engine/grid';
import { emptyScene, heightAt, type Scene, type Terrain } from './scene';
import { aiApproachPlan } from './combatFlow';
import { makeRNG } from '../engine/dice';
import { tileKey, type Pt } from './path';

/**
 * IA de mêlée z-aware (relief unifié) : un ennemi au SOL (h = 0 m) ne « frappe » PAS un héros perché
 * en hauteur (h = 4 m) même 2D-adjacent — la séparation VERTICALE (`verticalTiles` = Δhauteur ÷ mpt)
 * plie la distance de combat au-delà de l'Allonge. Il s'approche (cherche un chemin) au lieu de
 * mouliner dans le vide. Coplanaire (même hauteur) → il frappe normalement.
 */
const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 30, h: 21 }, layers: [{ z: 0, tiles: Array(630).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const C = (kind: 'hero' | 'enemy', id: string, pos: { x: number; y: number; z?: number; h?: number }): Combatant =>
  ({
    id, name: id, kind, pos, movement: 4,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    conditions: [], skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [],
  }) as unknown as Combatant;

function actionFor(heroH?: number) {
  const enemy = C('enemy', 'e', { x: 2, y: 10 }); // sol (h = 0)
  const hero = C('hero', 'h', { x: 3, y: 10, ...(heroH ? { h: heroH } : {}) }); // 2D-adjacent
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), blocked: new Set(['3,10']), movement: 4, spells: [] };
  return chooseEnemyAction(input);
}

describe('chooseEnemyAction — mêlée bornée par la séparation verticale MÉTRIQUE', () => {
  it('héros perché à 4 m, 2D-adjacent : l’ennemi au sol NE frappe PAS (approche)', () => {
    const action = actionFor(4); // verticalTiles(0,4,2)=2 → distance de combat 2 > Allonge 1
    expect(action.kind).not.toBe('melee');
  });

  it('contrôle : MÊME héros coplanaire (0 m) 2D-adjacent → l’ennemi frappe (melee)', () => {
    const action = actionFor(); // même hauteur : distance 1 ≤ Allonge 1
    expect(action.kind).toBe('melee');
  });
});

/** Rez herbe à 0 m sous un plancher d'étage (z1) à 4 m couvrant toute la carte : aucun lien de relief
 *  entre les deux (falaise), chaque étage est un plan de mêlée à part. */
function etage(): Scene {
  const s = emptyScene(10, 4);
  s.layers.push({ z: 1, tiles: new Array(40).fill('plancher') as Terrain[], height: new Array(40).fill(4) as number[] });
  return s;
}

function approche(z: 0 | 1) {
  const h = z ? { z, h: 4 } : {};
  const enemy = C('enemy', 'e', { x: 1, y: 1, ...h });
  const hero = C('hero', 'h', { x: 5, y: 1, ...h });
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: etage(), blocked: new Set([tileKey(5, 1, z)]), movement: 4, spells: [] };
  return { hero, action: chooseEnemyAction(input) };
}

describe('chooseEnemyAction — l’approche garde l’étage de la case atteinte (#2139)', () => {
  it('à l’étage : l’ennemi s’approche au contact du héros SUR le plancher z1', () => {
    const { hero, action } = approche(1);
    expect(action.kind).toBe('move');
    const to = (action as { to: Pt }).to;
    expect(to.z).toBe(1);
    expect(chebyshev(to, hero.pos!)).toBe(1);
  });

  it('opposé, au rez : la même approche rend une case au sol, sans z', () => {
    const { hero, action } = approche(0);
    expect(action.kind).toBe('move');
    const to = (action as { to: Pt }).to;
    expect('z' in to).toBe(false);
    expect(chebyshev(to, hero.pos!)).toBe(1);
  });
});

/** Sol herbe 12×5 à 0 m ; ESTRADE à 4 m sur x 5..7, gagnée par une rampe de marches de 1 m en y=2
 *  (x 2..4 : 1, 2, 3 m). `plat` : la même carte sans relief. */
function estrade(plat: boolean): Scene {
  const s = emptyScene(12, 5);
  const hauteurs = new Array(60).fill(0) as number[];
  if (!plat) {
    for (let y = 0; y < 5; y++) for (const x of [5, 6, 7]) hauteurs[y * 12 + x] = 4;
    [1, 2, 3].forEach((m, i) => { hauteurs[2 * 12 + 2 + i] = m; });
  }
  s.layers[0].height = hauteurs;
  return s;
}

function cibleChoisie(plat: boolean) {
  const sur = plat ? {} : { h: 4 };
  const enemy = C('enemy', 'e', { x: 1, y: 2 });
  const haut = C('hero', 'haut', { x: 6, y: 2, ...sur });
  haut.wounds.current = 1;
  const bas = C('hero', 'bas', { x: 1, y: 4 });
  const input: EnemyTurnInput = { enemy, heroes: [haut, bas], scene: estrade(plat), blocked: new Set(['6,2', '1,4']), movement: 4, spells: [] };
  const action = chooseEnemyAction(input);
  return { input, haut, action, ...aiApproachPlan(input, enemy, action, makeRNG(3)) };
}

describe('chooseEnemyAction — une case candidate se juge à SA hauteur (#2139)', () => {
  it('ennemi au sol : le héros sur l’estrade, joignable par la rampe, est frappable ce tour depuis le haut de la rampe', () => {
    const { input, haut, action, plan, ran } = cibleChoisie(false);
    expect(action).toMatchObject({ kind: 'move', thenTargetId: 'haut' });
    const to = (action as { to: Pt }).to;
    expect(heightAt(input.scene, to.x, to.y, 0)).toBe(4);
    expect(chebyshev(to, haut.pos!)).toBe(1);
    // La Marche l'amène au contact sur l'estrade : ni Charge ni Course (LDB 15 l.35-41).
    expect(plan).toBe(action);
    expect(ran).toBeNull();
  });

  it('opposé, sans relief : même choix sur la carte plate', () => {
    const { haut, action, plan, ran } = cibleChoisie(true);
    expect(action).toMatchObject({ kind: 'move', thenTargetId: 'haut' });
    expect(chebyshev((action as { to: Pt }).to, haut.pos!)).toBe(1);
    expect(plan).toBe(action);
    expect(ran).toBeNull();
  });
});

function chargeVersEstrade(plat: boolean) {
  const enemy = C('enemy', 'e', { x: 0, y: 0 });
  const haut = C('hero', 'haut', { x: 6, y: 2, ...(plat ? {} : { h: 4 }) });
  const input: EnemyTurnInput = { enemy, heroes: [haut], scene: estrade(plat), blocked: new Set(['6,2']), movement: 4, spells: [] };
  return { input, haut, ...aiApproachPlan(input, enemy, chooseEnemyAction(input), makeRNG(3)) };
}

describe('aiApproachPlan — l’arrivée d’une Charge se mesure à la hauteur de SA case (#2139)', () => {
  it('héros sur l’estrade hors de portée de Marche : CHARGE au contact sur l’estrade, sans Course', () => {
    const { input, haut, plan, ran } = chargeVersEstrade(false);
    expect(ran).toBeNull();
    const to = (plan as { to: Pt }).to;
    expect(plan.kind).toBe('move');
    expect(heightAt(input.scene, to.x, to.y, 0)).toBe(4);
    expect(chebyshev(to, haut.pos!)).toBe(1);
  });

  it('opposé, sans relief : la même Charge, au contact', () => {
    const { haut, plan, ran } = chargeVersEstrade(true);
    expect(ran).toBeNull();
    expect(plan.kind).toBe('move');
    expect(chebyshev((plan as { to: Pt }).to, haut.pos!)).toBe(1);
  });
});
