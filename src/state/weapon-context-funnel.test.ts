import { describe, it, expect } from 'vitest';
import { firedWeapon, attackerFumbled, defenderFumbled } from '../noyau/combatFlow';
import { hasQuality } from '../engine/qualities/dispatch';
import type { Combatant, Weapon, Trauma } from '../engine/types';
import { armeDeTest } from '../engine/objetsDeTest.testkit';
import type { AttackResult } from '../engine/combat';

// Funnel UNIQUE des règles d'arme contextuelles (LDB 62) : `firedWeapon` lie attaquant ⊕ arme ⊕ contexte.
// La MÊME arme transformée sert la touche/les Dégâts (resolveAttack) ET la Maladresse sur un RATÉ
// (attackConfirm/IA re-dérivent via firedWeapon → attackerFumbled/dangerousNine voient la Dangereuse).

const CHARS = { 'capacite-de-combat': 50, 'capacite-de-tir': 35, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const fleau: Weapon = { label: 'Fléau', type: 'melee', subType: 'fleau', reach: 'Moyenne', uid: 'fl', damage: { plusBF: true, flat: 5 }, qualities: [{ id: 'perturbante' }] };
const lance = armeDeTest('lance-de-cavalerie', { uid: 'la' });

const mk = (p: Partial<Combatant>): Combatant => ({
  id: 'a', name: 'X', kind: 'hero', characteristics: CHARS,
  wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
} as unknown as Combatant);
const target = mk({ id: 't', kind: 'enemy', pos: { x: 1, y: 0 } });
const fingers = (loc: 'brasG' | 'brasD', count: number): Trauma => ({ label: '', traumaId: 'doigt-ampute', location: loc, count });
// Arme à 1 main tenue à DROITE par défaut (hand indéfini ≠ 'off') → n'implique QUE brasD (weaponUsesHand, LDB 18).
const weaponRight: Weapon = { label: 'Dague', type: 'melee', hands: 1, qualities: [], damage: { plusBF: true, flat: 3 } };

describe('firedWeapon — règles d’arme contextuelles repliées sur le profil (LDB 62)', () => {
  it('Fléau SANS la Spé → Dangereuse + Atouts retirés ; un RATÉ avec 9 fumble', () => {
    const atk = mk({ skills: [], weapons: [fleau] });
    const w = firedWeapon(atk, target, 'fl');
    expect(hasQuality(w, 'dangereuse')).toBe(true);
    expect(hasQuality(w, 'perturbante')).toBe(false);
    // Le RATÉ passe par le MÊME `w` que la touche → la Maladresse Dangereuse se déclenche.
    const miss = { attackerDetail: { roll: 19, success: false } } as unknown as AttackResult;
    expect(attackerFumbled(miss, w)).toBe(true);
  });
  it('Fléau AVEC la Spé → intact (pas Dangereuse, Atouts conservés)', () => {
    const atk = mk({ skills: [{ id: 'corps-a-corps', spec: 'fleau', advances: 10 } as any], weapons: [fleau] });
    const w = firedWeapon(atk, target, 'fl');
    expect(hasQuality(w, 'dangereuse')).toBe(false);
    expect(hasQuality(w, 'perturbante')).toBe(true);
  });
  it('Lance de cavalerie : improvisée hors Charge, normale en Charge', () => {
    const notCharged = firedWeapon(mk({ weapons: [lance] }), target, 'la');
    expect(notCharged.damage).toEqual({ plusBF: true, flat: 1 });
    expect(hasQuality(notCharged, 'inoffensive')).toBe(true);
    const charged = firedWeapon(mk({ weapons: [lance], chargedThisTurn: true }), target, 'la');
    expect(charged.damage).toEqual({ plusBF: true, flat: 6 });
    expect(hasQuality(charged, 'empaleuse')).toBe(true);
  });
});

describe('attackerFumbled/defenderFumbled — escalade de Maladresse par Doigts amputés (LDB 18 l.251, #144)', () => {
  it('N doigts perdus sur la main IMPLIQUÉE + jet raté (non-double) d’unité ≤ N → Maladresse', () => {
    const atk = mk({ traumas: [fingers('brasD', 2)] });
    const miss = { attackerDetail: { roll: 42, success: false } } as unknown as AttackResult; // unité 2 ≤ N=2, pas un double
    expect(attackerFumbled(miss, weaponRight, atk)).toBe(true);
  });
  it('chiffre des unités du jet > N doigts perdus → PAS de Maladresse', () => {
    const atk = mk({ traumas: [fingers('brasD', 2)] });
    const miss = { attackerDetail: { roll: 43, success: false } } as unknown as AttackResult; // unité 3 > N=2
    expect(attackerFumbled(miss, weaponRight, atk)).toBe(false);
  });
  it('main NON impliquée par l’arme (doigts perdus à GAUCHE, arme tenue à DROITE) → PAS de Maladresse', () => {
    const atk = mk({ traumas: [fingers('brasG', 2)] });
    const miss = { attackerDetail: { roll: 42, success: false } } as unknown as AttackResult;
    expect(attackerFumbled(miss, weaponRight, atk)).toBe(false);
  });
  it('0 doigt perdu (aucun trauma) → comportement inchangé (pas de Maladresse hors double)', () => {
    const atk = mk({ traumas: [] });
    const miss = { attackerDetail: { roll: 41, success: false } } as unknown as AttackResult;
    expect(attackerFumbled(miss, weaponRight, atk)).toBe(false);
  });
  it('même escalade côté DÉFENSEUR (parade ratée, Test opposé, LDB 14 l.13)', () => {
    const def = mk({ traumas: [fingers('brasD', 3)] });
    const miss = { defenderDetail: { roll: 53, success: false } } as unknown as AttackResult; // unité 3 ≤ N=3, pas un double
    expect(defenderFumbled(miss, weaponRight, def)).toBe(true);
  });
});
