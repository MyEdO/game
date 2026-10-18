import { describe, it, expect } from 'vitest';
import { mountedAttackMods, mountedDodgeMods, mountMovement, mountUp } from './mount';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';
import { ligneDeRegle } from '../engine/reglesChiffrees';

const mk = (id: string, size: SizeCategory, extra: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, size, movement: 4, characteristics: { force: 30, endurance: 30 }, talents: [], items: [], wounds: { current: 10, max: 10, base: 10 }, conditions: [], ...extra }) as unknown as Combatant;
const battle = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;

describe('mount — modificateurs de Combat monté (LDB 14 l.179-184)', () => {
  it('+20 : un cavalier frappe une cible plus petite que sa monture (l.180), mêlée ET tir', () => {
    const horse = mk('h', 'grande', { movement: 8 });
    const knight = mk('k', 'moyenne');
    mountUp(knight, horse);
    const b = battle([horse, knight]);
    const ogre = mk('o', 'moyenne'); // plus petit que la monture (grande)
    expect(mountedAttackMods(b, knight, ogre, 'melee')).toContainEqual(ligneDeRegle('combat-monte', 'cible-plus-petite'));
    expect(mountedAttackMods(b, knight, ogre, 'ranged')).toContainEqual(ligneDeRegle('combat-monte', 'cible-plus-petite'));
    // cible AUSSI grande que la monture → pas de bonus
    const giant = mk('g', 'grande');
    expect(mountedAttackMods(b, knight, giant, 'melee')).toEqual([]);
  });

  it('−10 : viser le cavalier en mêlée quand on est plus petit que sa monture (l.181) — pas au tir', () => {
    const horse = mk('h', 'grande');
    const knight = mk('k', 'moyenne');
    mountUp(knight, horse);
    const goblin = mk('gob', 'petite'); // plus petit que la monture (grande)
    const b = battle([horse, knight, goblin]);
    expect(mountedAttackMods(b, goblin, knight, 'melee')).toContainEqual(ligneDeRegle('combat-monte', 'cibler-le-cavalier'));
    expect(mountedAttackMods(b, goblin, knight, 'ranged')).toEqual([]); // le −10 est « en combat rapproché » seulement
    // attaquant aussi grand que la monture → pas de pénalité
    const ogre = mk('o', 'grande');
    expect(mountedAttackMods(b, ogre, knight, 'melee')).toEqual([]);
  });

  it('aucun modificateur quand personne n’est monté', () => {
    const a = mk('a', 'moyenne');
    const t = mk('t', 'petite');
    expect(mountedAttackMods(battle([a, t]), a, t, 'melee')).toEqual([]);
  });

  it('Esquive : −20 à cheval, annulé par Acrobaties équestres, nul à pied (l.184)', () => {
    expect(mountedDodgeMods(mk('x', 'moyenne', { mountId: 'h' }))).toEqual([ligneDeRegle('combat-monte', 'esquive-a-cheval')]);
    expect(mountedDodgeMods(mk('x', 'moyenne', { mountId: 'h', talents: [{ talentId: 'acrobaties-equestres', times: 1 }] as any }))).toEqual([]);
    expect(mountedDodgeMods(mk('x', 'moyenne'))).toEqual([]); // à pied
  });

  it('mountMovement : le cavalier se déplace avec le Mouvement de sa monture (l.179)', () => {
    const horse = mk('h', 'grande', { movement: 8 });
    const knight = mk('k', 'moyenne', { movement: 4 });
    mountUp(knight, horse);
    const b = battle([horse, knight]);
    expect(mountMovement(b, knight)).toBe(8); // monture
    expect(mountMovement(b, horse)).toBe(8);  // la monture elle-même
    expect(mountMovement(battle([knight]), mk('foot', 'moyenne', { movement: 4 }))).toBe(4); // à pied
  });
});
