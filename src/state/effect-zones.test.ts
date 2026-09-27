/**
 * Zones d'effet AUTHORÉES (pièges/hasards posés dans l'éditeur). Réutilisent le runtime des zones de
 * Sort : `sceneZonesToBattle` convertit `Scene.effectZones` → `BattleZone` PERMANENTES (pas de TTL),
 * appliquées par `crossZones` (traversée) / `zonesRoundTick` (stationnement). `startCombat` les sème.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { useGame } from './store';
import type { Scene } from './scene';
import {
  zoneAreaTiles, sceneZonesToBattle, decayZones, crossZones, zonesRoundTick, barrierTilesFor, type BattleZone,
} from './zones';
import { occupied } from './combatGeometry';
import type { BattleState } from './store';

const rng: RNG = { int: () => 5 } as RNG;

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Cobaye', kind: 'enemy', size: 'moyenne', advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 12, max: 12 }, pos: { x: 5, y: 5 },
    ...over,
  } as unknown as Combatant;
}

describe('zoneAreaTiles — rect plein / disque de Chebyshev', () => {
  it('rectangle : toutes les cases de la boîte', () => {
    const t = zoneAreaTiles({ kind: 'rect', x: 2, y: 3, w: 2, h: 2 });
    expect(t).toHaveLength(4);
    expect(t).toContainEqual({ x: 2, y: 3 });
    expect(t).toContainEqual({ x: 3, y: 4 });
  });
  it('disque rayon 1 → 3×3 cases', () => {
    expect(zoneAreaTiles({ kind: 'disc', cx: 5, cy: 5, radius: 1 })).toHaveLength(9);
  });
});

describe('sceneZonesToBattle — zones authorées → BattleZone PERMANENTES', () => {
  it('porte tiles + onCross/perRound + permanent', () => {
    const [z] = sceneZonesToBattle([
      {
        id: 'trap1', label: 'Pieux dissimulés', area: { kind: 'rect', x: 4, y: 4, w: 1, h: 1 },
        onCross: [{ op: 'wounds', amount: 7, ignoreTB: false, ignoreAP: true }],
      },
    ]);
    expect(z.permanent).toBe(true);
    expect(z.tiles).toEqual([{ x: 4, y: 4 }]);
    expect(z.onCross?.[0]).toMatchObject({ op: 'wounds', amount: 7 });
  });
  it('liste absente → []', () => {
    expect(sceneZonesToBattle(undefined)).toEqual([]);
  });
});

describe('decayZones — les pièges authorés (permanent) ne se dissipent JAMAIS', () => {
  it('la zone temporaire tombe, la permanente survit intacte', () => {
    const { zones } = decayZones([
      { label: 'Brasier', tiles: [{ x: 1, y: 1 }], rounds: 1 },
      { label: 'Fosse à pieux', tiles: [{ x: 2, y: 2 }], rounds: 1, permanent: true, onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: false }] },
    ]);
    expect(zones).toHaveLength(1);
    expect(zones[0].label).toBe('Fosse à pieux');
    expect(zones[0].rounds).toBe(1); // pas décrémenté
  });
});

describe('runtime : un piège authoré frappe via le runtime des zones de Sort', () => {
  const [trap] = sceneZonesToBattle([
    {
      id: 'acid', label: 'Flaque acide', area: { kind: 'disc', cx: 5, cy: 5, radius: 1 },
      perRound: [{ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: true }],
      onCross: [{ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: true }, { op: 'condition', id: 'empoisonne' }],
    },
  ]);
  it('stationner dedans (perRound) : 8 − BE 3 = 5 Blessures', () => {
    const victim = mk({ id: 'v', pos: { x: 5, y: 5 } });
    zonesRoundTick([trap as BattleZone], [victim], rng);
    expect(victim.wounds.current).toBe(7);
  });
  it('traverser (onCross) : Dégâts + État Empoisonné', () => {
    const victim = mk({ id: 'v2', pos: { x: 3, y: 5 } });
    crossZones([trap as BattleZone], victim, [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }], () => undefined, rng);
    expect(victim.wounds.current).toBe(7);
    expect(victim.conditions.some((c) => c.id === 'empoisonne')).toBe(true);
  });
});

describe('barrières — infranchissables pour les créatures gatées (via occupied)', () => {
  const barrier = (blockGroups?: string[]): BattleZone => ({ label: 'Cercle de ward', tiles: [{ x: 5, y: 5 }], rounds: 1, permanent: true, barrier: { blockGroups } });
  const battleWith = (zones: BattleZone[]): BattleState => ({ combatants: [], zones } as unknown as BattleState);

  it('sceneZonesToBattle porte la barrière', () => {
    const [z] = sceneZonesToBattle([{ id: 'w', label: 'Ward', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, barrier: { blockGroups: ['Démon'] } }]);
    expect(z.barrier).toEqual({ blockGroups: ['Démon'] });
  });

  it('barrierTilesFor : sans filtre bloque tout le monde ; filtré ne bloque que les Groupes visés', () => {
    expect(barrierTilesFor([barrier()], mk({ groups: ['Humain'] }))).toEqual([{ x: 5, y: 5 }]);
    expect(barrierTilesFor([barrier(['Démon'])], mk({ groups: ['Démon'] }))).toEqual([{ x: 5, y: 5 }]);
    expect(barrierTilesFor([barrier(['Démon'])], mk({ groups: ['Humain'] }))).toEqual([]);
  });

  it('occupied : un Démon est bloqué par la barrière sacrée, pas un vivant', () => {
    const b = battleWith([barrier(['Démon'])]);
    expect(occupied(b, mk({ id: 'd', groups: ['Démon'] })).has('5,5')).toBe(true);
    expect(occupied(b, mk({ id: 'h', groups: ['Humain'] })).has('5,5')).toBe(false);
  });

  it('occupied : une barrière sans filtre bloque même un vivant', () => {
    expect(occupied(battleWith([barrier()]), mk({ id: 'h', groups: ['Humain'] })).has('5,5')).toBe(true);
  });
});

describe('intégration : startCombat sème les pièges de la scène dans battle.zones', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('une scène avec effectZones → zone permanente dans le combat', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const scene: Scene = {
      ...testScene,
      effectZones: [
        { id: 'pit', label: 'Fosse à pieux', area: { kind: 'rect', x: 16, y: 11, w: 1, h: 1 }, onCross: [{ op: 'wounds', amount: 9, ignoreTB: false, ignoreAP: true }] },
      ],
    };
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(scene);
    useGame.getState().startCombat('enc-mutants');
    const zones = useGame.getState().battle!.zones ?? [];
    const pit = zones.find((z) => z.label === 'Fosse à pieux')!;
    expect(pit).toBeTruthy();
    expect(pit.permanent).toBe(true);
    expect(pit.tiles).toEqual([{ x: 16, y: 11 }]);
  });
});
