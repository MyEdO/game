import { describe, it, expect } from 'vitest';
import { firedWeapon } from './combatFlow';
import type { Combatant, Weapon } from '../engine/types';

const W = (uid: string, name: string): Weapon =>
  ({ uid, label: name, type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: uid === 'm' ? 'main' : 'off', hands: 1 });
const atk = (): Combatant =>
  ({ id: 'a', name: 'A', kind: 'hero', pos: { x: 0, y: 0 }, weapons: [W('m', 'Épée'), W('o', 'Dague')], size: 3 } as unknown as Combatant);
const tgt = (): Combatant =>
  ({ id: 't', name: 'T', kind: 'enemy', pos: { x: 1, y: 0 }, size: 3 } as unknown as Combatant);

describe('firedWeapon : honore weaponUid', () => {
  it('sans weaponUid : auto-choix (1ʳᵉ mêlée au contact)', () => {
    expect(firedWeapon(atk(), tgt()).label).toBe('Épée');
  });
  it('weaponUid valide : renvoie l’arme choisie (main secondaire)', () => {
    expect(firedWeapon(atk(), tgt(), 'o').label).toBe('Dague');
  });
  it('weaponUid inconnu : repli auto', () => {
    expect(firedWeapon(atk(), tgt(), 'zzz').label).toBe('Épée');
  });
});

describe('firedWeapon : sous-effectif d’une pièce SERVIE (poste, MDG 12) — bake selon les servants présents', () => {
  const cannon = (): Weapon =>
    ({ uid: 'cannon', label: 'Canon', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 100,
      qualities: [{ id: 'arme-d-equipe', value: 3 }], reload: 3, hand: 'main', hands: 2 }) as Weapon;
  const chef = (crewIds: string[]): Combatant =>
    ({ id: 'chef', name: 'Chef', kind: 'hero', pos: { x: 0, y: 0 }, size: 3, weapons: [cannon()],
      wounds: { current: 5, max: 5 }, mannedPoste: { item: {}, side: 'tribord', crewIds } }) as unknown as Combatant;
  const sailor = (id: string, alive = true): Combatant =>
    ({ id, name: id, kind: 'npc', dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;
  const far = (): Combatant => ({ id: 't', name: 'T', kind: 'enemy', pos: { x: 5, y: 0 }, size: 3 } as unknown as Combatant);
  const hasQ = (w: Weapon, id: string) => w.qualities.some((q) => q.id === id);

  it('effectif COMPLET (3/3) → arme nette : Arme d’équipe retirée, aucun Défaut, recharge normale', () => {
    const c = chef(['chef', 's1', 's2']);
    const w = firedWeapon(c, far(), 'cannon', [c, sailor('s1'), sailor('s2')]);
    expect(hasQ(w, 'arme-d-equipe')).toBe(false);
    expect(hasQ(w, 'imprecise')).toBe(false);
    expect(w.reload).toBe(3);
  });

  it('sous-effectif (chef seul, 2 servants à terre) → recharge ×2 + Imprécise', () => {
    const c = chef(['chef', 's1', 's2']);
    const w = firedWeapon(c, far(), 'cannon', [c, sailor('s1', false), sailor('s2', false)]); // présent 1, Indice 3, déficit 2
    expect(w.reload).toBe(6);
    expect(hasQ(w, 'imprecise')).toBe(true);
  });

  it('sans liste de combattants (sites qui ne lisent que `.type`) → arme inchangée', () => {
    const w = firedWeapon(chef(['chef', 's1', 's2']), far(), 'cannon');
    expect(hasQ(w, 'arme-d-equipe')).toBe(true);
  });
});
