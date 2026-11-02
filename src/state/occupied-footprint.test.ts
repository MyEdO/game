import { describe, it, expect } from 'vitest';
import { occupied } from '../noyau/monde/combatGeometry';
import { displaceSmaller } from '../noyau/combatPlacement';
import { occupiesTile, footprintN } from '../noyau/monde/footprint';
import type { BattleState } from '../noyau/etat';
import type { Scene } from '../noyau/monde/scene';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';

const flatScene = (w: number, h: number): Scene =>
  ({ id: 's', label: 's', dimensions: { w, h }, ambiance: 'exterieur', layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} }) as unknown as Scene;

// occupied() = tuiles bloquant le déplacement d'un mover : empreinte (LDB 15 l.12) de chaque autre
// combattant, SAUF ceux de Taille strictement inférieure (« dégagés du chemin », LDB 85 l.373-374).
const mk = (id: string, x: number, y: number, size?: SizeCategory): Combatant =>
  ({ id, name: id, pos: { x, y }, size, wounds: { current: 10, max: 10 }, conditions: [] }) as unknown as Combatant;
const battle = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;

describe('occupied — empreinte + relativité de Taille au déplacement', () => {
  it('un mover plus GRAND ignore les combattants plus petits (dégagés du chemin, 85 l.373-374)', () => {
    const big = mk('big', 0, 0, 'grande');
    const small = mk('small', 5, 5, 'moyenne');
    expect(occupied(battle([big, small]), big).has('5,5')).toBe(false);
  });

  it('un mover plus PETIT est bloqué par TOUTE l’empreinte d’un plus grand (2×2)', () => {
    const big = mk('big', 5, 5, 'grande'); // occupe 5..6 × 5..6
    const small = mk('small', 0, 0, 'moyenne');
    const blocked = occupied(battle([big, small]), small);
    expect(blocked.has('5,5')).toBe(true);
    expect(blocked.has('6,5')).toBe(true);
    expect(blocked.has('5,6')).toBe(true);
    expect(blocked.has('6,6')).toBe(true);
  });

  it('Taille égale : les combattants se bloquent mutuellement', () => {
    const a = mk('a', 0, 0, 'moyenne');
    const z = mk('z', 5, 5, 'moyenne');
    expect(occupied(battle([a, z]), a).has('5,5')).toBe(true);
  });

  it('argument id (legacy/tests) : aucun filtrage de Taille — tout bloque', () => {
    const big = mk('big', 0, 0, 'grande');
    const small = mk('small', 5, 5, 'moyenne');
    expect(occupied(battle([big, small]), 'big').has('5,5')).toBe(true);
  });
});

describe('displaceSmaller — un grand dégage les plus petits de son empreinte (LDB 85 l.373-374)', () => {
  it('pousse une créature plus petite sous l’empreinte vers une case libre hors-empreinte', () => {
    const big = mk('big', 5, 5, 'grande'); // occupe 5..6 × 5..6
    const small = mk('small', 6, 6, 'moyenne'); // SOUS l’empreinte du grand
    const b = battle([big, small]);
    const get = (() => ({ battle: b, scene: flatScene(12, 12) })) as unknown as () => GameStateLike;
    expect(displaceSmaller(get as never, big)).toBe(true);
    expect(occupiesTile(big.pos!, footprintN(big), small.pos!.x, small.pos!.y)).toBe(false); // plus sous le grand
  });
  it('ne touche pas une créature de Taille égale/supérieure', () => {
    const big = mk('big', 5, 5, 'grande');
    const peer = mk('peer', 6, 6, 'grande');
    const b = battle([big, peer]);
    const get = (() => ({ battle: b, scene: flatScene(12, 12) })) as unknown as () => GameStateLike;
    displaceSmaller(get as never, big);
    expect(peer.pos).toEqual({ x: 6, y: 6 }); // inchangé
  });
});

type GameStateLike = { battle: BattleState; scene: Scene };
