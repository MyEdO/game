import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from './ai';
import { emptyScene } from './scene';
import type { Combatant, Weapon } from '../engine/types';

// IA — Tentacules (LDB 85 l.405) : « vous pouvez utiliser une Action d'Attaque GRATUITE pour résoudre
// l'Empoignade AU LIEU de l'Action de la créature ». Une créature qui TIENT une Empoignade par un TENTACULE
// n'est donc PAS verrouillée sur la lutte (contrairement au verrou générique LOT B) : le tentacule tient
// pendant que le corps garde son Action normale. La Langue préhensile (p.340) n'a PAS cette dérogation
// (« voir page 163 ») → elle est VERROUILLÉE comme tout grappleur (LOT B). Décision PURE.

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}
const scene = emptyScene(12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

/** Empoigné (côté tenant) : `grapplingWith` + État *Empêtré* (posés ensemble, LDB 14 l.159). */
function holds(e: Combatant, hId: string): void {
  e.grapplingWith = [hId];
  e.conditions = [{ id: 'empetre', value: 1, sourceId: hId }];
}

describe('IA — Tentacules/Langue : l’Empoignade tenue ne VERROUILLE pas la créature (LDB 85 l.405/213)', () => {
  it('Tentacules + grapplingWith → action NORMALE (pas { grapple }) : le membre tient pendant que le corps agit', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { traits: [{ id: 'tentacules', value: 9, count: 2 }] });
    holds(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 0 }); // adjacent → la créature attaque normalement
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a.kind).not.toBe('grapple'); // PAS verrouillée sur la lutte
    expect(a.kind).not.toBe('recover'); // ni reléguée à « se libérer » : elle prend une vraie Action
  });

  it('Langue préhensile + grapplingWith → VERROUILLÉE sur le Test opposé (pas de dérogation p.343, règle générale p.163)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { traits: [{ id: 'langue-prehensile', value: 9 }] });
    holds(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 0 });
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'grapple', targetId: 'h', resolution: 'test' }); // Langue = grappleur ordinaire, LOT B
  });

  it('contraste : SANS trait tentacule/langue, l’Empoigné reste VERROUILLÉ sur le Test opposé (LOT B inchangé)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    holds(e, 'h');
    const h = mk('h', 'hero', { x: 5, y: 6 }, { advantage: 0 });
    const a = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(a).toEqual({ kind: 'grapple', targetId: 'h', resolution: 'test' });
  });
});
