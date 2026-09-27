import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { occupied } from './combatGeometry';
import { placeCombatant } from './spawn';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { emptyScene, type Scene, type Terrain } from './scene';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';

/**
 * Combat z-aware (relief unifié) : un occupant d'une couche haute (z=1) ne bloque QUE son étage ; la
 * position d'un combattant porte sa HAUTEUR MÉTRIQUE (`pos.h`), (re)stampée par `placeCombatant` depuis
 * le relief de la scène à CHAQUE placement. DISCIPLINE : le sol reste byte-identique (z ET h OMIS à 0).
 */
const mk = (id: string, x: number, y: number, z?: number): Combatant =>
  ({ id, name: id, pos: z ? { x, y, z } : { x, y }, wounds: { current: 10, max: 10, base: 10 }, conditions: [] }) as unknown as Combatant;
const battle = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;

describe('occupied — un bloqueur n’occupe que SON étage (clé z-aware)', () => {
  it('un combattant z=1 n’apparaît PAS dans l’ensemble bloquant d’un mover z=0 (on passe dessous)', () => {
    const mover = mk('m', 5, 5);       // sol
    const upper = mk('u', 5, 5, 1);    // couche 1, MÊME (x,y)
    const blocked = occupied(battle([mover, upper]), mover);
    expect(blocked.has('5,5')).toBe(false);   // invisible au sol (clé « x,y » absente)
    expect(blocked.has('5,5,1')).toBe(true);  // mais bien occupée à la couche 1 (« x,y,z »)
  });

  it('deux combattants z=0 se bloquent comme avant (clé « x,y » sans suffixe)', () => {
    const a = mk('a', 0, 0);
    const z0 = mk('z', 5, 5);
    expect(occupied(battle([a, z0]), a).has('5,5')).toBe(true);
  });
});

describe('placeCombatant — (re)stampe pos.h depuis le relief de la scène', () => {
  function reliefScene(): Scene {
    const s = emptyScene(3, 3); // z0 herbe, 0 m
    const w = 3;
    const z1 = new Array(w * 3).fill('vide') as Terrain[];
    const h1 = new Array(w * 3).fill(0) as number[];
    z1[1 * w + 1] = 'plancher'; h1[1 * w + 1] = 4; // tablier (1,1,z1) à 4 m
    s.layers.push({ z: 1, tiles: z1, height: h1 });
    s.layers[0].height = new Array(w * 3).fill(0) as number[];
    s.layers[0].height![2 * w + 2] = 2; // sol surélevé à 2 m en (2,2)
    return s;
  }

  it('sur une case de tablier à 4 m → pos.h = 4 (et z=1)', () => {
    const s = reliefScene();
    const c = mk('c', 0, 0);
    placeCombatant(c, s, { x: 1, y: 1, z: 1 });
    expect(c.pos).toEqual({ x: 1, y: 1, z: 1, h: 4 });
  });

  it('sur un sol surélevé à 2 m → pos.h = 2, sans z (couche 0)', () => {
    const s = reliefScene();
    const c = mk('c', 0, 0);
    placeCombatant(c, s, { x: 2, y: 2 });
    expect(c.pos).toEqual({ x: 2, y: 2, h: 2 });
  });

  it('sur une surface à 0 m → byte-identique au plan (ni z ni h)', () => {
    const s = reliefScene();
    const c = mk('c', 5, 5);
    placeCombatant(c, s, { x: 0, y: 0 });
    expect(c.pos).toEqual({ x: 0, y: 0 });
  });
});

describe('spawn — la SceneEntity.z se propage en Combatant.pos.z', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('une entité enrôlée à z:1 → son Combattant a pos.z===1 ; un ennemi au sol n’a PAS de z', () => {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    const scene = structuredClone(testScene());
    const ent = scene.entities.find((e) => e.id === 'enemy-enc-mutants-0')!;
    ent.z = 1; // posté sur une couche supérieure
    useGame.getState().startScene(scene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === 'enemy-enc-mutants-0')!.pos?.z).toBe(1);
    expect(b.combatants.find((c) => c.id === 'enemy-enc-mutants-1')!.pos?.z).toBeUndefined(); // sol = byte-identique
  });
});

describe('startCombat — partyPos.z (étage du groupe) se propage aux Combattants HÉROS (#801)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('groupe posté à z=1 → tous les héros placés ont pos.z===1 (pas téléportés au rez)', () => {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    const scene = structuredClone(testScene());
    useGame.getState().startScene(scene);
    useGame.setState({ partyPos: { ...useGame.getState().partyPos, z: 1 } });
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero' && !c.mountable);
    expect(heroes.length).toBeGreaterThan(0);
    for (const h of heroes) expect(h.pos?.z).toBe(1);
  });

  it('groupe au rez (z absent) → héros placés SANS z (byte-identique, non-régression)', () => {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    const scene = structuredClone(testScene());
    useGame.getState().startScene(scene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero' && !c.mountable);
    expect(heroes.length).toBeGreaterThan(0);
    for (const h of heroes) expect(h.pos?.z).toBeUndefined();
  });
});
