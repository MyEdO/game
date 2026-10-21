import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from '../noyau/monde/ai';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}
const scene = emptyScene('scene-test', 12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

describe('IA — auto-récupération d’État (LDB 16 l.66/l.84)', () => {
  it('En flammes : un ennemi non frénétique se roule au sol (priorité survie)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'en-flammes', value: 1 }] });
    const h = mk('h', 'hero', { x: 5, y: 6 }); // pourtant adjacent → attaquable
    const action = chooseEnemyAction(input(e, [h]));
    expect(action).toEqual({ kind: 'recover', state: 'en-flammes' });
  });

  it('En flammes + frénétique : ignore le feu et attaque (Frénésie)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'en-flammes', value: 1 }], psychState: [{ type: 'frenesie' }] });
    const h = mk('h', 'hero', { x: 5, y: 6 });
    const action = chooseEnemyAction(input(e, [h]));
    expect(action.kind).toBe('melee');
  });

  it('Empêtré (Mouvement nul) sans cible au contact : se libère plutôt que perdre son tour', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'empetre', value: 1, sourceId: 'h' }] });
    const h = mk('h', 'hero', { x: 9, y: 9 }); // loin
    const action = chooseEnemyAction(input(e, [h], { movement: 0 })); // Empêtré → Mouvement 0
    expect(action).toEqual({ kind: 'recover', state: 'empetre' });
  });

  it('Empêtré mais cible déjà au contact : attaque (Empêtré ne bloque pas l’Action)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { conditions: [{ id: 'empetre', value: 1, sourceId: 'h' }] });
    const h = mk('h', 'hero', { x: 5, y: 6 }); // adjacent
    const action = chooseEnemyAction(input(e, [h], { movement: 0 }));
    expect(action.kind).toBe('melee');
  });
});
