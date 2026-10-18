import { describe, it, expect } from 'vitest';
import { attackEnv } from './combatFlow';
import type { ModLine } from '../engine/combat';
import { emptyScene } from './scene';
import type { Get } from './flowTypes';
import type { Combatant, Weapon } from '../engine/types';
import { ligneDeRegle } from '../engine/reglesChiffrees';

/**
 * MALUS « EN CONTREBAS DE LA CIBLE » (Difficultés de Combat) — en MÊLÉE, l'attaquant dont la surface
 * est plus BASSE que celle de sa cible de plus de `STEP_MAX_M` (1 m) subit −10. RAW STRICT : c'est le
 * SEUL effet de la hauteur — dominer NE donne AUCUN bonus « high-ground ». Comparaison de la hauteur
 * métrique réelle des surfaces (`pos.h`) ; coplanaire → aucun modificateur.
 */

const melee = { name: 'Épée', type: 'melee' } as unknown as Weapon;

const mk = (id: string, kind: 'hero' | 'enemy', h: number): Combatant =>
  ({ id, name: id, kind, size: 'moyenne', pos: h ? { x: 5, y: 5, h } : { x: 5, y: 5 }, conditions: [] }) as unknown as Combatant;

/** `get` stub : scène claire de jour + une bataille à deux combattants (aucun grapple/monture). */
function envFor(attackerH: number, targetH: number) {
  const attacker = mk('att', 'hero', attackerH);
  const target = mk('tgt', 'enemy', targetH);
  target.pos = { x: 6, y: 5, ...(targetH ? { h: targetH } : {}) }; // adjacent, sur sa propre case
  const get = (() => ({
    scene: { ...emptyScene(), weather: 'clair' },
    battle: { combatants: [attacker, target] },
    gameTime: 12 * 60,
    facing: {},
  })) as unknown as Get;
  return attackEnv(get, attacker, target, melee).env;
}

const below = (env: ModLine[]) => env.find((e) => e.label === 'En contrebas de la cible');

describe('attackEnv (mêlée) — −10 « En contrebas de la cible »', () => {
  it('attaquant SOUS la cible de > STEP_MAX (0 m vs 4 m) → −10', () => {
    const env = envFor(0, 4);
    expect(below(env)).toEqual(ligneDeRegle('cible-en-contrebas', 'en-contrebas'));
  });

  it('attaquant AU-DESSUS de la cible (4 m vs 0 m) → AUCUN modificateur (pas de bonus high-ground)', () => {
    expect(envFor(4, 0)).toEqual([]); // ni −10 ni bonus : dominer ne donne rien (RAW)
  });

  it('coplanaire (0 m vs 0 m) → aucun modificateur', () => {
    expect(envFor(0, 0)).toEqual([]);
  });

  it('cible dominant d’exactement STEP_MAX (0 m vs 1 m) → aucun malus (seuil STRICT : > 1 m)', () => {
    expect(envFor(0, 1)).toEqual([]);
  });

  it('cible dominant de 1,5 m (> STEP_MAX) → −10', () => {
    expect(below(envFor(0, 1.5))).toEqual(ligneDeRegle('cible-en-contrebas', 'en-contrebas'));
  });
});
